#!/usr/bin/env python3
"""
Contract Drift Detector

Detekterer mismatches mellom TypeScript-typer og Pydantic-modeller.
Fokuserer på enums og string unions som er duplisert mellom frontend og backend.

Bruk:
    python scripts/contract_drift.py              # Standard output
    python scripts/contract_drift.py --format json    # JSON output
    python scripts/contract_drift.py --format markdown # Markdown output
    python scripts/contract_drift.py --ci             # CI mode (exit 1 on drift)
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
    CRITICAL = "critical"  # Verdi mangler helt
    WARNING = "warning"    # Potensielt problem
    INFO = "info"          # Informasjon


@dataclass
class DriftFinding:
    """En enkelt drift-funn"""
    enum_name: str
    severity: Severity
    message: str
    ts_value: Optional[str] = None
    py_value: Optional[str] = None


@dataclass
class EnumComparison:
    """Resultat av sammenligning av et enum"""
    name: str
    ts_values: set = field(default_factory=set)
    py_values: set = field(default_factory=set)
    findings: list = field(default_factory=list)

    @property
    def has_drift(self) -> bool:
        return len(self.findings) > 0

    @property
    def missing_in_ts(self) -> set:
        return self.py_values - self.ts_values

    @property
    def missing_in_py(self) -> set:
        return self.ts_values - self.py_values


def find_project_root() -> Path:
    """Finn prosjektroten ved å lete etter package.json"""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    raise RuntimeError("Kunne ikke finne prosjektroten (package.json)")


def parse_python_enums(file_path: Path) -> dict[str, set[str]]:
    """
    Parser Python-fil og ekstraherer str Enum-verdier.

    Returnerer dict med enum-navn -> set av verdier.
    """
    enums = {}

    with open(file_path, 'r', encoding='utf-8') as f:
        source = f.read()

    tree = ast.parse(source)

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            # Sjekk om klassen arver fra str, Enum
            bases = [_get_base_name(b) for b in node.bases]
            if 'Enum' in bases and 'str' in bases:
                values = set()
                for item in node.body:
                    if isinstance(item, ast.Assign):
                        for target in item.targets:
                            if isinstance(target, ast.Name):
                                # Hent verdien (streng)
                                if isinstance(item.value, ast.Constant):
                                    values.add(item.value.value)
                enums[node.name] = values

    return enums


def _get_base_name(node) -> str:
    """Hent navnet på en base-klasse"""
    if isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Attribute):
        return node.attr
    return ""


def parse_typescript_unions(file_path: Path) -> dict[str, set[str]]:
    """
    Parser TypeScript-fil og ekstraherer type unions.

    Returnerer dict med type-navn -> set av verdier.
    """
    unions = {}

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fjern kommentarer før parsing
    # Fjern // kommentarer (men behold newlines)
    content = re.sub(r'//[^\n]*', '', content)
    # Fjern /* */ kommentarer
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)

    # Pattern for å finne type X = 'a' | 'b' | 'c';
    # Støtter både single-line og multi-line
    type_pattern = r"export\s+type\s+(\w+)\s*=\s*([\s\S]*?);"

    for match in re.finditer(type_pattern, content):
        type_name = match.group(1)
        type_body = match.group(2)

        # Ekstraher string literals fra union
        # Matcher 'value' der value er et gyldig identifier (bokstaver, tall, underscore)
        values = set(re.findall(r"'([a-zA-Z][a-zA-Z0-9_]*)'", type_body))

        if values:  # Kun inkluder hvis det er string literals
            unions[type_name] = values

    return unions


def normalize_value(value: str) -> str:
    """Normaliser enum-verdi for sammenligning (lowercase)"""
    return value.lower().replace('_', '').replace('-', '')


def compare_enums(
    ts_unions: dict[str, set[str]],
    py_enums: dict[str, set[str]],
    mappings: dict[str, str]
) -> list[EnumComparison]:
    """
    Sammenlign TypeScript unions med Python enums.

    Args:
        ts_unions: Dict med TS type-navn -> verdier
        py_enums: Dict med Python enum-navn -> verdier
        mappings: Dict som mapper TS-navn til Python-navn

    Returns:
        Liste med EnumComparison-resultater
    """
    results = []

    for ts_name, py_name in mappings.items():
        ts_values = ts_unions.get(ts_name, set())
        py_values = py_enums.get(py_name, set())

        comparison = EnumComparison(
            name=ts_name,
            ts_values=ts_values,
            py_values=py_values
        )

        # Finn verdier som mangler i TypeScript
        for py_val in py_values:
            # Sjekk eksakt match eller normalisert match
            if py_val not in ts_values:
                # Prøv normalisert matching
                py_normalized = normalize_value(py_val)
                ts_normalized = {normalize_value(v) for v in ts_values}

                if py_normalized not in ts_normalized:
                    comparison.findings.append(DriftFinding(
                        enum_name=ts_name,
                        severity=Severity.CRITICAL,
                        message=f"Mangler i TypeScript: '{py_val}'",
                        py_value=py_val
                    ))

        # Finn verdier som mangler i Python
        for ts_val in ts_values:
            if ts_val not in py_values:
                # Prøv normalisert matching
                ts_normalized = normalize_value(ts_val)
                py_normalized = {normalize_value(v) for v in py_values}

                if ts_normalized not in py_normalized:
                    comparison.findings.append(DriftFinding(
                        enum_name=ts_name,
                        severity=Severity.CRITICAL,
                        message=f"Mangler i Python: '{ts_val}'",
                        ts_value=ts_val
                    ))

        results.append(comparison)

    return results


def format_text(results: list[EnumComparison]) -> str:
    """Formater resultater som lesbar tekst"""
    lines = []

    drift_count = sum(1 for r in results if r.has_drift)

    if drift_count == 0:
        lines.append("OK - Ingen contract drift funnet")
        lines.append("")
        lines.append(f"Sjekket {len(results)} type-definisjoner")
        return "\n".join(lines)

    lines.append(f"DRIFT DETECTED - {drift_count} av {len(results)} typer har avvik")
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


def format_json(results: list[EnumComparison]) -> str:
    """Formater resultater som JSON"""
    output = {
        "drift_detected": any(r.has_drift for r in results),
        "types_checked": len(results),
        "types_with_drift": sum(1 for r in results if r.has_drift),
        "findings": []
    }

    for result in results:
        if not result.has_drift:
            continue

        type_findings = {
            "type_name": result.name,
            "ts_values": sorted(result.ts_values),
            "py_values": sorted(result.py_values),
            "missing_in_ts": sorted(result.missing_in_ts),
            "missing_in_py": sorted(result.missing_in_py),
            "details": [
                {
                    "severity": f.severity.value,
                    "message": f.message,
                    "ts_value": f.ts_value,
                    "py_value": f.py_value
                }
                for f in result.findings
            ]
        }
        output["findings"].append(type_findings)

    return json.dumps(output, indent=2, ensure_ascii=False)


def format_markdown(results: list[EnumComparison]) -> str:
    """Formater resultater som Markdown"""
    lines = ["# Contract Drift Report", ""]

    drift_count = sum(1 for r in results if r.has_drift)

    if drift_count == 0:
        lines.append("> OK - Ingen contract drift funnet")
        lines.append("")
        lines.append(f"Sjekket {len(results)} type-definisjoner")
        return "\n".join(lines)

    lines.append(f"> **{drift_count}** av {len(results)} typer har avvik")
    lines.append("")

    for result in results:
        if not result.has_drift:
            continue

        lines.append(f"## {result.name}")
        lines.append("")
        lines.append("| Severity | Issue |")
        lines.append("|----------|-------|")

        for finding in result.findings:
            sev = "Critical" if finding.severity == Severity.CRITICAL else "Warning"
            lines.append(f"| {sev} | {finding.message} |")

        lines.append("")

        # Vis verdier
        lines.append("<details>")
        lines.append("<summary>Alle verdier</summary>")
        lines.append("")
        lines.append(f"**TypeScript** ({len(result.ts_values)}): `{', '.join(sorted(result.ts_values))}`")
        lines.append("")
        lines.append(f"**Python** ({len(result.py_values)}): `{', '.join(sorted(result.py_values))}`")
        lines.append("")
        lines.append("</details>")
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Detekterer contract drift mellom TypeScript og Python"
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
    py_file = root / "backend" / "models" / "events.py"

    if not ts_file.exists():
        print(f"Feil: TypeScript-fil ikke funnet: {ts_file}", file=sys.stderr)
        sys.exit(1)

    if not py_file.exists():
        print(f"Feil: Python-fil ikke funnet: {py_file}", file=sys.stderr)
        sys.exit(1)

    # Parser filer
    ts_unions = parse_typescript_unions(ts_file)
    py_enums = parse_python_enums(py_file)

    if args.verbose:
        print(f"Fant {len(ts_unions)} TypeScript unions", file=sys.stderr)
        print(f"Fant {len(py_enums)} Python enums", file=sys.stderr)

    # Definer mapping mellom TS og Python navn
    # TS-navn -> Python-navn
    mappings = {
        "SporType": "SporType",
        "SporStatus": "SporStatus",
        "VederlagsMetode": "VederlagsMetode",
        "VederlagBeregningResultat": "VederlagBeregningResultat",
        "FristVarselType": "FristVarselType",
        "FristBeregningResultat": "FristBeregningResultat",
        "GrunnlagResponsResultat": "GrunnlagResponsResultat",
        "SubsidiaerTrigger": "SubsidiaerTrigger",
        "EventType": "EventType",
        "BelopVurdering": "BelopVurdering",
    }

    # Sammenlign
    results = compare_enums(ts_unions, py_enums, mappings)

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
