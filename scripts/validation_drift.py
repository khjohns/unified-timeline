#!/usr/bin/env python3
"""
Validation Drift Detector

Detekterer mismatches mellom frontend Zod-skjemaer og backend validators.py.
Sjekker at valideringsregler for events er synkronisert.

Bruk:
    python scripts/validation_drift.py              # Standard output
    python scripts/validation_drift.py --format json    # JSON output
    python scripts/validation_drift.py --format markdown # Markdown output
    python scripts/validation_drift.py --ci             # CI mode (exit 1 on drift)
"""

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
    CRITICAL = "critical"  # Regel mangler helt
    WARNING = "warning"    # Regel-mismatch (f.eks. forskjellige min-verdier)
    INFO = "info"          # Informasjon


@dataclass
class ValidationRule:
    """En valideringsregel for et felt"""
    field_name: str
    required: bool = False
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    min_value: Optional[float] = None
    pattern: Optional[str] = None
    custom: Optional[str] = None  # Beskrivelse av custom validering


@dataclass
class SchemaInfo:
    """Informasjon om et valideringsskjema"""
    name: str
    rules: dict  # field_name -> ValidationRule
    is_update: bool = False


@dataclass
class DriftFinding:
    """En enkelt drift-funn"""
    schema_name: str
    severity: Severity
    message: str
    field_name: Optional[str] = None
    frontend_value: Optional[str] = None
    backend_value: Optional[str] = None


@dataclass
class SchemaComparison:
    """Resultat av sammenligning av et skjema"""
    name: str
    frontend_rules: dict = field(default_factory=dict)
    backend_rules: dict = field(default_factory=dict)
    findings: list = field(default_factory=list)

    @property
    def has_drift(self) -> bool:
        return any(f.severity in (Severity.CRITICAL, Severity.WARNING) for f in self.findings)


# ============================================================================
# FORVENTEDE VALIDERINGSREGLER
# ============================================================================
# Disse definerer hva som SKAL være likt mellom frontend og backend.
# Avvik fra disse rapporteres som drift.

EXPECTED_RULES = {
    "grunnlag_create": {
        "hovedkategori": ValidationRule("hovedkategori", required=True),
        "underkategori": ValidationRule("underkategori", required=False, custom="Påkrevd hvis hovedkategori har underkategorier"),
        "tittel": ValidationRule("tittel", required=True, min_length=3, max_length=100),
        "beskrivelse": ValidationRule("beskrivelse", required=True, min_length=10),
        "dato_oppdaget": ValidationRule("dato_oppdaget", required=True),
    },
    "grunnlag_update": {
        "hovedkategori": ValidationRule("hovedkategori", required=False),
        "underkategori": ValidationRule("underkategori", required=False),
        "tittel": ValidationRule("tittel", required=False),
        "beskrivelse": ValidationRule("beskrivelse", required=False),
        "dato_oppdaget": ValidationRule("dato_oppdaget", required=False),
    },
    "vederlag_create": {
        "vederlagsmetode": ValidationRule("vederlagsmetode", required=True),
        "belop_direkte": ValidationRule("belop_direkte", required=False, min_value=0),
        "kostnads_overslag": ValidationRule("kostnads_overslag", required=False, min_value=0),
        "beskrivelse": ValidationRule("beskrivelse", required=True, min_length=10),
    },
    "frist_create": {
        # antall_dager er optional for varsel, men påkrevd for spesifisert (dynamisk via refine)
        "antall_dager": ValidationRule("antall_dager", required=False, min_value=0, custom="Påkrevd hvis varsel_type=spesifisert"),
        "begrunnelse": ValidationRule("begrunnelse", required=True),
    },
}


def find_project_root() -> Path:
    """Finn prosjektroten ved å lete etter package.json"""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    raise RuntimeError("Kunne ikke finne prosjektroten (package.json)")


def parse_zod_schema(content: str, schema_name: str) -> dict[str, ValidationRule]:
    """
    Parser Zod-skjema fra TypeScript-innhold.

    Returnerer dict med felt-navn -> ValidationRule.
    """
    rules = {}

    # Finn skjemaet
    pattern = rf'const\s+{schema_name}\s*=\s*z\.object\(\{{'
    match = re.search(pattern, content)
    if not match:
        return rules

    # Finn slutten av objektet (enkel bracket-matching)
    start = match.end()
    depth = 1
    end = start
    for i, char in enumerate(content[start:], start):
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                end = i
                break

    schema_content = content[start:end]

    # Parse felt
    field_pattern = r"(\w+):\s*z\.(\w+)\(([^)]*)\)([^,\n]*)"
    for match in re.finditer(field_pattern, schema_content):
        field_name = match.group(1)
        zod_type = match.group(2)
        zod_args = match.group(3)
        chained = match.group(4)

        rule = ValidationRule(field_name)

        # Sjekk om påkrevd
        if '.optional()' in chained:
            rule.required = False
        elif zod_type == 'string' and '.min(1' in f"{zod_args}{chained}":
            rule.required = True
        elif zod_type == 'string' and '.min(' not in f"{zod_args}{chained}" and '.optional()' not in chained:
            rule.required = True  # string() uten min() eller optional() er påkrevd

        # Parse min_length for string
        min_match = re.search(r'\.min\((\d+)', f"{zod_args}{chained}")
        if min_match and zod_type == 'string':
            rule.min_length = int(min_match.group(1))
            if rule.min_length >= 1:
                rule.required = True

        # Parse max_length for string
        max_match = re.search(r'\.max\((\d+)', f"{zod_args}{chained}")
        if max_match and zod_type == 'string':
            rule.max_length = int(max_match.group(1))

        # Parse min for number
        if zod_type == 'number':
            min_match = re.search(r'\.min\((\d+)', f"{zod_args}{chained}")
            if min_match:
                rule.min_value = float(min_match.group(1))

        rules[field_name] = rule

    return rules


def parse_frontend_schemas(root: Path) -> dict[str, SchemaInfo]:
    """Parser frontend Zod-skjemaer fra action modals"""
    schemas = {}

    # SendGrunnlagModal
    grunnlag_path = root / "src/components/actions/SendGrunnlagModal.tsx"
    if grunnlag_path.exists():
        content = grunnlag_path.read_text(encoding='utf-8')

        # Create schema
        create_rules = parse_zod_schema(content, 'createGrunnlagSchema')
        if create_rules:
            # Sjekk for refine med underkategori-logikk
            if 'refine' in content and 'underkategori' in content:
                if 'underkategori' in create_rules:
                    create_rules['underkategori'].custom = "Påkrevd hvis hovedkategori har underkategorier"
            schemas['grunnlag_create'] = SchemaInfo('grunnlag_create', create_rules, is_update=False)

        # Update schema
        update_rules = parse_zod_schema(content, 'updateGrunnlagSchema')
        if update_rules:
            schemas['grunnlag_update'] = SchemaInfo('grunnlag_update', update_rules, is_update=True)

    # SendVederlagModal
    vederlag_path = root / "src/components/actions/SendVederlagModal.tsx"
    if vederlag_path.exists():
        content = vederlag_path.read_text(encoding='utf-8')

        create_rules = parse_zod_schema(content, 'vederlagSchema')
        if create_rules:
            schemas['vederlag_create'] = SchemaInfo('vederlag_create', create_rules, is_update=False)

    # SendFristModal
    frist_path = root / "src/components/actions/SendFristModal.tsx"
    if frist_path.exists():
        content = frist_path.read_text(encoding='utf-8')

        create_rules = parse_zod_schema(content, 'fristSchema')
        if create_rules:
            schemas['frist_create'] = SchemaInfo('frist_create', create_rules, is_update=False)

    return schemas


def parse_backend_validators(root: Path) -> dict[str, SchemaInfo]:
    """Parser backend validators.py for valideringsregler"""
    schemas = {}

    validators_path = root / "backend/api/validators.py"
    if not validators_path.exists():
        return schemas

    content = validators_path.read_text(encoding='utf-8')

    # Parse validate_grunnlag_event
    if 'def validate_grunnlag_event' in content:
        # Create mode rules
        create_rules = {}

        # hovedkategori
        if "if not hovedkategori:" in content and "hovedkategori er påkrevd" in content:
            create_rules['hovedkategori'] = ValidationRule('hovedkategori', required=True)

        # underkategori - dynamisk basert på hovedkategori
        if "valid_underkategorier and not underkategori" in content:
            create_rules['underkategori'] = ValidationRule(
                'underkategori',
                required=False,
                custom="Påkrevd hvis hovedkategori har underkategorier"
            )

        # beskrivelse
        if "if not data.get('beskrivelse')" in content:
            create_rules['beskrivelse'] = ValidationRule('beskrivelse', required=True)

        # dato_oppdaget
        if "if not data.get('dato_oppdaget')" in content:
            create_rules['dato_oppdaget'] = ValidationRule('dato_oppdaget', required=True)

        # tittel - sjekk om det valideres
        if "if not tittel:" in content or "tittel er påkrevd" in content:
            create_rules['tittel'] = ValidationRule('tittel', required=True, min_length=3, max_length=100)
        elif "if not data.get('tittel')" in content:
            create_rules['tittel'] = ValidationRule('tittel', required=True)
        else:
            # Tittel valideres IKKE i validators.py
            create_rules['tittel'] = ValidationRule('tittel', required=False, custom="Ikke validert i validators.py")

        schemas['grunnlag_create'] = SchemaInfo('grunnlag_create', create_rules, is_update=False)

        # Update mode - sjekk for is_update parameter
        if "is_update: bool = False" in content:
            update_rules = {
                'hovedkategori': ValidationRule('hovedkategori', required=False),
                'underkategori': ValidationRule('underkategori', required=False),
                'tittel': ValidationRule('tittel', required=False),
                'beskrivelse': ValidationRule('beskrivelse', required=False),
                'dato_oppdaget': ValidationRule('dato_oppdaget', required=False),
            }
            schemas['grunnlag_update'] = SchemaInfo('grunnlag_update', update_rules, is_update=True)

    # Parse validate_vederlag_event
    if 'def validate_vederlag_event' in content:
        vederlag_rules = {}

        if "vederlagsmetode er påkrevd" in content or "if not vederlagsmetode" in content:
            vederlag_rules['vederlagsmetode'] = ValidationRule('vederlagsmetode', required=True)

        # belop_direkte og kostnads_overslag er vanligvis valgfrie
        vederlag_rules['belop_direkte'] = ValidationRule('belop_direkte', required=False, min_value=0)
        vederlag_rules['kostnads_overslag'] = ValidationRule('kostnads_overslag', required=False, min_value=0)

        if "if not data.get('beskrivelse')" in content:
            vederlag_rules['beskrivelse'] = ValidationRule('beskrivelse', required=True)

        schemas['vederlag_create'] = SchemaInfo('vederlag_create', vederlag_rules, is_update=False)

    # Parse validate_frist_event
    if 'def validate_frist_event' in content:
        frist_rules = {}

        # antall_dager er dynamisk - optional for varsel, påkrevd for spesifisert
        if "antall_dager" in content:
            frist_rules['antall_dager'] = ValidationRule(
                'antall_dager',
                required=False,
                min_value=0,
                custom="Påkrevd hvis varsel_type=spesifisert"
            )

        if "begrunnelse er påkrevd" in content:
            frist_rules['begrunnelse'] = ValidationRule('begrunnelse', required=True)

        schemas['frist_create'] = SchemaInfo('frist_create', frist_rules, is_update=False)

    return schemas


def compare_schemas(
    frontend: dict[str, SchemaInfo],
    backend: dict[str, SchemaInfo],
    expected: dict[str, dict[str, ValidationRule]]
) -> list[SchemaComparison]:
    """Sammenlign frontend og backend skjemaer mot forventede regler"""
    comparisons = []

    all_schema_names = set(frontend.keys()) | set(backend.keys()) | set(expected.keys())

    for schema_name in sorted(all_schema_names):
        comparison = SchemaComparison(
            name=schema_name,
            frontend_rules={k: v for k, v in frontend.get(schema_name, SchemaInfo(schema_name, {})).rules.items()},
            backend_rules={k: v for k, v in backend.get(schema_name, SchemaInfo(schema_name, {})).rules.items()},
        )

        fe_schema = frontend.get(schema_name)
        be_schema = backend.get(schema_name)
        exp_rules = expected.get(schema_name, {})

        # Sjekk om skjema finnes
        if not fe_schema:
            comparison.findings.append(DriftFinding(
                schema_name=schema_name,
                severity=Severity.WARNING,
                message=f"Skjema '{schema_name}' finnes ikke i frontend"
            ))
        if not be_schema:
            comparison.findings.append(DriftFinding(
                schema_name=schema_name,
                severity=Severity.WARNING,
                message=f"Skjema '{schema_name}' finnes ikke i backend"
            ))

        # Sammenlign felt mot forventede regler
        for field_name, exp_rule in exp_rules.items():
            fe_rule = fe_schema.rules.get(field_name) if fe_schema else None
            be_rule = be_schema.rules.get(field_name) if be_schema else None

            # Sjekk required-mismatch
            if fe_rule and be_rule:
                if fe_rule.required != be_rule.required and exp_rule.custom is None:
                    comparison.findings.append(DriftFinding(
                        schema_name=schema_name,
                        severity=Severity.WARNING,
                        message=f"'{field_name}' required-mismatch",
                        field_name=field_name,
                        frontend_value=f"required={fe_rule.required}",
                        backend_value=f"required={be_rule.required}"
                    ))

            # Sjekk min_length-mismatch
            if fe_rule and exp_rule.min_length:
                if fe_rule.min_length != exp_rule.min_length:
                    comparison.findings.append(DriftFinding(
                        schema_name=schema_name,
                        severity=Severity.INFO,
                        message=f"'{field_name}' frontend min_length={fe_rule.min_length}, forventet {exp_rule.min_length}",
                        field_name=field_name,
                        frontend_value=f"min_length={fe_rule.min_length}",
                        backend_value=f"expected={exp_rule.min_length}"
                    ))

            # Sjekk om tittel ikke valideres i backend
            if field_name == 'tittel' and be_rule and be_rule.custom == "Ikke validert i validators.py":
                comparison.findings.append(DriftFinding(
                    schema_name=schema_name,
                    severity=Severity.WARNING,
                    message=f"'{field_name}' valideres i frontend (min={fe_rule.min_length if fe_rule else '?'}, max={fe_rule.max_length if fe_rule else '?'}) men IKKE i backend validators.py",
                    field_name=field_name,
                    frontend_value=f"min={fe_rule.min_length}, max={fe_rule.max_length}" if fe_rule else "?",
                    backend_value="Ikke validert"
                ))

        comparisons.append(comparison)

    return comparisons


def format_text_report(comparisons: list[SchemaComparison]) -> str:
    """Formater tekstrapport"""
    lines = []
    lines.append("=" * 60)
    lines.append("  VALIDATION DRIFT REPORT")
    lines.append("=" * 60)
    lines.append("")

    total_critical = 0
    total_warning = 0
    total_info = 0

    for comp in comparisons:
        if comp.findings:
            lines.append(f"Schema: {comp.name}")
            lines.append("-" * 40)

            for finding in comp.findings:
                icon = "❌" if finding.severity == Severity.CRITICAL else "⚠️" if finding.severity == Severity.WARNING else "ℹ️"
                lines.append(f"  {icon} [{finding.severity.value}] {finding.message}")
                if finding.frontend_value:
                    lines.append(f"      Frontend: {finding.frontend_value}")
                if finding.backend_value:
                    lines.append(f"      Backend:  {finding.backend_value}")

                if finding.severity == Severity.CRITICAL:
                    total_critical += 1
                elif finding.severity == Severity.WARNING:
                    total_warning += 1
                else:
                    total_info += 1

            lines.append("")

    if total_critical == 0 and total_warning == 0 and total_info == 0:
        lines.append("✅ Ingen drift funnet - valideringsregler er synkronisert!")
    else:
        lines.append("=" * 60)
        lines.append(f"  TOTALT: {total_critical} kritiske, {total_warning} advarsler, {total_info} info")

    lines.append("=" * 60)
    return "\n".join(lines)


def format_json_report(comparisons: list[SchemaComparison]) -> str:
    """Formater JSON-rapport"""
    findings_list = []
    for comp in comparisons:
        for finding in comp.findings:
            findings_list.append({
                "schema": finding.schema_name,
                "field": finding.field_name,
                "severity": finding.severity.value,
                "message": finding.message,
                "frontend_value": finding.frontend_value,
                "backend_value": finding.backend_value,
            })

    report = {
        "drift_detected": any(comp.has_drift for comp in comparisons),
        "schemas_checked": len(comparisons),
        "schemas_with_drift": sum(1 for comp in comparisons if comp.has_drift),
        "findings": findings_list,
        "summary": {
            "critical": sum(1 for f in findings_list if f["severity"] == "critical"),
            "warning": sum(1 for f in findings_list if f["severity"] == "warning"),
            "info": sum(1 for f in findings_list if f["severity"] == "info"),
        }
    }
    return json.dumps(report, indent=2, ensure_ascii=False)


def format_markdown_report(comparisons: list[SchemaComparison]) -> str:
    """Formater Markdown-rapport"""
    lines = []
    lines.append("# Validation Drift Report")
    lines.append("")

    has_findings = any(comp.findings for comp in comparisons)

    if not has_findings:
        lines.append("✅ **Ingen drift funnet** - valideringsregler er synkronisert!")
        return "\n".join(lines)

    lines.append("## Funn")
    lines.append("")
    lines.append("| Schema | Felt | Alvorlighet | Beskrivelse |")
    lines.append("|--------|------|-------------|-------------|")

    for comp in comparisons:
        for finding in comp.findings:
            severity_icon = "❌" if finding.severity == Severity.CRITICAL else "⚠️" if finding.severity == Severity.WARNING else "ℹ️"
            field = finding.field_name or "-"
            lines.append(f"| {finding.schema_name} | {field} | {severity_icon} {finding.severity.value} | {finding.message} |")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Detekterer drift mellom frontend og backend valideringsregler"
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

    args = parser.parse_args()

    root = find_project_root()

    # Parse skjemaer
    frontend_schemas = parse_frontend_schemas(root)
    backend_schemas = parse_backend_validators(root)

    # Sammenlign
    comparisons = compare_schemas(frontend_schemas, backend_schemas, EXPECTED_RULES)

    # Formater output
    if args.format == "json":
        output = format_json_report(comparisons)
    elif args.format == "markdown":
        output = format_markdown_report(comparisons)
    else:
        output = format_text_report(comparisons)

    print(output)

    # Exit code for CI
    if args.ci:
        has_drift = any(comp.has_drift for comp in comparisons)
        if has_drift:
            sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
