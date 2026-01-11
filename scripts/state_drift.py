#!/usr/bin/env python3
"""
State Model Drift Detector

Detekterer mismatches mellom TypeScript interfaces og Pydantic BaseModel-klasser.
Fokuserer på state-modeller som brukes av frontend (SakState, Tilstander, etc.).

Bruk:
    python scripts/state_drift.py              # Standard output
    python scripts/state_drift.py --format json    # JSON output
    python scripts/state_drift.py --format markdown # Markdown output
    python scripts/state_drift.py --ci             # CI mode (exit 1 on drift)
"""

import ast
import re
import json
import argparse
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class Severity(str, Enum):
    """Alvorlighetsgrad for drift"""
    CRITICAL = "critical"  # Felt mangler helt
    WARNING = "warning"    # Type-mismatch eller optional-mismatch
    INFO = "info"          # Informasjon


@dataclass
class FieldInfo:
    """Informasjon om et felt"""
    name: str
    type_str: str
    optional: bool = False


@dataclass
class ModelInfo:
    """Informasjon om en modell/interface"""
    name: str
    fields: dict  # name -> FieldInfo


@dataclass
class DriftFinding:
    """En enkelt drift-funn"""
    model_name: str
    severity: Severity
    message: str
    field_name: Optional[str] = None


@dataclass
class ModelComparison:
    """Resultat av sammenligning av en modell"""
    name: str
    ts_fields: dict = field(default_factory=dict)
    py_fields: dict = field(default_factory=dict)
    findings: list = field(default_factory=list)

    @property
    def has_drift(self) -> bool:
        return len(self.findings) > 0


def find_project_root() -> Path:
    """Finn prosjektroten ved å lete etter package.json"""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    raise RuntimeError("Kunne ikke finne prosjektroten (package.json)")


def parse_pydantic_models(file_path: Path) -> dict[str, ModelInfo]:
    """
    Parser Python-fil og ekstraherer Pydantic BaseModel-felt.

    Returnerer dict med modell-navn -> ModelInfo.
    Inkluderer både vanlige felt og @computed_field properties.
    """
    models = {}

    with open(file_path, 'r', encoding='utf-8') as f:
        source = f.read()

    tree = ast.parse(source)

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            # Sjekk om klassen arver fra BaseModel
            bases = [_get_base_name(b) for b in node.bases]
            if 'BaseModel' in bases or any(b.endswith('Tilstand') for b in bases):
                fields = {}

                for item in node.body:
                    # Håndter annoterte felt (name: Type = ...)
                    if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                        field_name = item.target.id
                        type_str = _get_type_string(item.annotation)
                        optional = _is_optional(item.annotation)

                        fields[field_name] = FieldInfo(
                            name=field_name,
                            type_str=type_str,
                            optional=optional
                        )

                    # Håndter @computed_field @property
                    if isinstance(item, ast.FunctionDef):
                        has_computed = any(
                            _get_decorator_name(d) == 'computed_field'
                            for d in item.decorator_list
                        )
                        has_property = any(
                            _get_decorator_name(d) == 'property'
                            for d in item.decorator_list
                        )
                        if has_computed or has_property:
                            field_name = item.name
                            # Hent return type annotation
                            if item.returns:
                                type_str = _get_type_string(item.returns)
                                optional = _is_optional(item.returns)
                            else:
                                type_str = "unknown"
                                optional = True

                            fields[field_name] = FieldInfo(
                                name=field_name,
                                type_str=type_str,
                                optional=optional
                            )

                if fields:
                    models[node.name] = ModelInfo(name=node.name, fields=fields)

    return models


def _get_decorator_name(node) -> str:
    """Hent navnet på en decorator"""
    if isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Attribute):
        return node.attr
    elif isinstance(node, ast.Call):
        return _get_decorator_name(node.func)
    return ""


def _get_base_name(node) -> str:
    """Hent navnet på en base-klasse"""
    if isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Attribute):
        return node.attr
    return ""


def _get_type_string(node) -> str:
    """Konverter AST-node til type-streng"""
    if isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Constant):
        return str(node.value)
    elif isinstance(node, ast.Subscript):
        base = _get_type_string(node.value)
        if isinstance(node.slice, ast.Tuple):
            args = ", ".join(_get_type_string(e) for e in node.slice.elts)
        else:
            args = _get_type_string(node.slice)
        return f"{base}[{args}]"
    elif isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
        # Union type: X | Y
        left = _get_type_string(node.left)
        right = _get_type_string(node.right)
        return f"{left} | {right}"
    elif isinstance(node, ast.Attribute):
        return f"{_get_type_string(node.value)}.{node.attr}"
    return "unknown"


def _is_optional(node) -> bool:
    """Sjekk om en type er Optional"""
    type_str = _get_type_string(node)
    return (
        type_str.startswith("Optional[") or
        "None" in type_str or
        " | None" in type_str
    )


def parse_typescript_interfaces(file_path: Path) -> dict[str, ModelInfo]:
    """
    Parser TypeScript-fil og ekstraherer interface-felt.

    Returnerer dict med interface-navn -> ModelInfo.
    """
    interfaces = {}

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fjern kommentarer før parsing
    content = re.sub(r'//[^\n]*', '', content)
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)

    # Pattern for å finne interface X { ... }
    interface_pattern = r"export\s+interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{([\s\S]*?)\n\}"

    for match in re.finditer(interface_pattern, content):
        interface_name = match.group(1)
        interface_body = match.group(2)

        fields = {}

        # Parser felt: name?: Type;
        field_pattern = r"(\w+)(\?)?:\s*([^;]+);"

        for field_match in re.finditer(field_pattern, interface_body):
            field_name = field_match.group(1)
            optional = field_match.group(2) == "?"
            type_str = field_match.group(3).strip()

            fields[field_name] = FieldInfo(
                name=field_name,
                type_str=type_str,
                optional=optional
            )

        if fields:
            interfaces[interface_name] = ModelInfo(name=interface_name, fields=fields)

    return interfaces


def normalize_type(type_str: str) -> str:
    """Normaliser type for sammenligning"""
    # Fjern whitespace
    type_str = re.sub(r'\s+', '', type_str)

    # Map Python -> TypeScript typer
    type_map = {
        'str': 'string',
        'int': 'number',
        'float': 'number',
        'bool': 'boolean',
        'List': 'Array',
        'Dict': 'Record',
        'datetime': 'string',
        'Optional': '',
    }

    for py_type, ts_type in type_map.items():
        type_str = type_str.replace(py_type, ts_type)

    return type_str.lower()


def compare_models(
    ts_interfaces: dict[str, ModelInfo],
    py_models: dict[str, ModelInfo],
    mappings: dict[str, str]
) -> list[ModelComparison]:
    """
    Sammenlign TypeScript interfaces med Python modeller.

    Args:
        ts_interfaces: Dict med TS interface-navn -> ModelInfo
        py_models: Dict med Python modell-navn -> ModelInfo
        mappings: Dict som mapper TS-navn til Python-navn
    """
    results = []

    for ts_name, py_name in mappings.items():
        ts_model = ts_interfaces.get(ts_name)
        py_model = py_models.get(py_name)

        comparison = ModelComparison(name=ts_name)

        if ts_model:
            comparison.ts_fields = ts_model.fields
        if py_model:
            comparison.py_fields = py_model.fields

        if not ts_model and not py_model:
            comparison.findings.append(DriftFinding(
                model_name=ts_name,
                severity=Severity.WARNING,
                message=f"Modell finnes ikke i hverken TypeScript eller Python"
            ))
            results.append(comparison)
            continue

        if not ts_model:
            comparison.findings.append(DriftFinding(
                model_name=ts_name,
                severity=Severity.CRITICAL,
                message=f"Mangler i TypeScript (finnes i Python som {py_name})"
            ))
            results.append(comparison)
            continue

        if not py_model:
            comparison.findings.append(DriftFinding(
                model_name=ts_name,
                severity=Severity.CRITICAL,
                message=f"Mangler i Python (finnes i TypeScript som {ts_name})"
            ))
            results.append(comparison)
            continue

        # Sammenlign felt
        ts_field_names = set(ts_model.fields.keys())
        py_field_names = set(py_model.fields.keys())

        # Felt som mangler i TypeScript
        for field_name in py_field_names - ts_field_names:
            # Ignorer private felt
            if field_name.startswith('_'):
                continue
            comparison.findings.append(DriftFinding(
                model_name=ts_name,
                severity=Severity.CRITICAL,
                message=f"Felt '{field_name}' mangler i TypeScript",
                field_name=field_name
            ))

        # Felt som mangler i Python
        for field_name in ts_field_names - py_field_names:
            comparison.findings.append(DriftFinding(
                model_name=ts_name,
                severity=Severity.CRITICAL,
                message=f"Felt '{field_name}' mangler i Python",
                field_name=field_name
            ))

        # Sjekk type og optional-mismatch for felles felt
        for field_name in ts_field_names & py_field_names:
            ts_field = ts_model.fields[field_name]
            py_field = py_model.fields[field_name]

            # Sjekk type-mismatch
            ts_type_norm = normalize_type(ts_field.type_str)
            py_type_norm = normalize_type(py_field.type_str)
            if ts_type_norm != py_type_norm:
                comparison.findings.append(DriftFinding(
                    model_name=ts_name,
                    severity=Severity.WARNING,
                    message=f"Felt '{field_name}' type-mismatch: TS={ts_field.type_str}, Py={py_field.type_str}",
                    field_name=field_name
                ))

            # Sjekk optional-mismatch
            if ts_field.optional != py_field.optional:
                comparison.findings.append(DriftFinding(
                    model_name=ts_name,
                    severity=Severity.WARNING,
                    message=f"Felt '{field_name}' optional-mismatch: TS={ts_field.optional}, Py={py_field.optional}",
                    field_name=field_name
                ))

        results.append(comparison)

    return results


def format_text(results: list[ModelComparison]) -> str:
    """Formater resultater som lesbar tekst"""
    lines = []

    drift_count = sum(1 for r in results if r.has_drift)

    if drift_count == 0:
        lines.append("OK - Ingen state model drift funnet")
        lines.append("")
        lines.append(f"Sjekket {len(results)} modeller")
        return "\n".join(lines)

    lines.append(f"DRIFT DETECTED - {drift_count} av {len(results)} modeller har avvik")
    lines.append("")

    for result in results:
        if not result.has_drift:
            continue

        lines.append(f"  {result.name}:")
        for finding in result.findings:
            icon = "!" if finding.severity == Severity.CRITICAL else "?"
            lines.append(f"    [{icon}] {finding.message}")
        lines.append("")

    # Oppsummering
    critical = sum(1 for r in results for f in r.findings if f.severity == Severity.CRITICAL)
    warning = sum(1 for r in results for f in r.findings if f.severity == Severity.WARNING)

    lines.append(f"Totalt: {critical} kritiske, {warning} advarsler")

    return "\n".join(lines)


def format_json(results: list[ModelComparison]) -> str:
    """Formater resultater som JSON"""
    output = {
        "drift_detected": any(r.has_drift for r in results),
        "models_checked": len(results),
        "models_with_drift": sum(1 for r in results if r.has_drift),
        "findings": []
    }

    for result in results:
        if not result.has_drift:
            continue

        model_findings = {
            "model_name": result.name,
            "ts_fields": list(result.ts_fields.keys()),
            "py_fields": list(result.py_fields.keys()),
            "details": [
                {
                    "severity": f.severity.value,
                    "message": f.message,
                    "field_name": f.field_name
                }
                for f in result.findings
            ]
        }
        output["findings"].append(model_findings)

    return json.dumps(output, indent=2, ensure_ascii=False)


def format_markdown(results: list[ModelComparison]) -> str:
    """Formater resultater som Markdown"""
    lines = ["# State Model Drift Report", ""]

    drift_count = sum(1 for r in results if r.has_drift)

    if drift_count == 0:
        lines.append("> OK - Ingen state model drift funnet")
        lines.append("")
        lines.append(f"Sjekket {len(results)} modeller")
        return "\n".join(lines)

    lines.append(f"> **{drift_count}** av {len(results)} modeller har avvik")
    lines.append("")

    for result in results:
        if not result.has_drift:
            continue

        lines.append(f"## {result.name}")
        lines.append("")
        lines.append("| Severity | Field | Issue |")
        lines.append("|----------|-------|-------|")

        for finding in result.findings:
            sev = "Critical" if finding.severity == Severity.CRITICAL else "Warning"
            field = finding.field_name or "-"
            lines.append(f"| {sev} | {field} | {finding.message} |")

        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Detekterer state model drift mellom TypeScript og Python"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["text", "json", "markdown"],
        default="text",
        help="Output-format (default: text)"
    )
    parser.add_argument(
        "--ci",
        action="store_true",
        help="CI-modus: Exit 1 ved drift"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Vis detaljert output"
    )

    args = parser.parse_args()

    # Finn prosjektrot
    try:
        root = find_project_root()
    except RuntimeError as e:
        print(f"Feil: {e}", file=sys.stderr)
        sys.exit(1)

    # Definer filer som skal sjekkes
    ts_file = root / "src" / "types" / "timeline.ts"
    py_file = root / "backend" / "models" / "sak_state.py"

    if not ts_file.exists():
        print(f"Feil: TypeScript-fil ikke funnet: {ts_file}", file=sys.stderr)
        sys.exit(1)

    if not py_file.exists():
        print(f"Feil: Python-fil ikke funnet: {py_file}", file=sys.stderr)
        sys.exit(1)

    # Parser filer
    ts_interfaces = parse_typescript_interfaces(ts_file)
    py_models = parse_pydantic_models(py_file)

    if args.verbose:
        print(f"Fant {len(ts_interfaces)} TypeScript interfaces", file=sys.stderr)
        print(f"Fant {len(py_models)} Python modeller", file=sys.stderr)
        print(f"TS interfaces: {list(ts_interfaces.keys())}", file=sys.stderr)
        print(f"Py models: {list(py_models.keys())}", file=sys.stderr)

    # Definer mapping mellom TS og Python navn
    mappings = {
        "SakState": "SakState",
        "GrunnlagTilstand": "GrunnlagTilstand",
        "VederlagTilstand": "VederlagTilstand",
        "FristTilstand": "FristTilstand",
        "ForseringData": "ForseringData",
        "EndringsordreData": "EndringsordreData",
        "SakRelasjon": "SakRelasjon",
    }

    # Sammenlign
    results = compare_models(ts_interfaces, py_models, mappings)

    # Formater output
    if args.format == "json":
        output = format_json(results)
    elif args.format == "markdown":
        output = format_markdown(results)
    else:
        output = format_text(results)

    print(output)

    # Exit code for CI
    if args.ci:
        has_critical = any(
            f.severity == Severity.CRITICAL
            for r in results
            for f in r.findings
        )
        if has_critical:
            sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
