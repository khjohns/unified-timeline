#!/usr/bin/env python3
"""
Hardcoded Constants Detector

Finner dupliserte hardkodede verdier som bør sentraliseres.
Sjekker både frontend (TypeScript) og backend (Python) for:
- Tall som gjentas 3+ ganger
- URL-strenger
- Magic strings/constants

Bruk:
    python scripts/constant_drift.py              # Standard output
    python scripts/constant_drift.py --format json    # JSON output
    python scripts/constant_drift.py --format markdown # Markdown output
    python scripts/constant_drift.py --ci             # CI mode (exit 1 on findings)
"""

import re
import json
import argparse
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum
from collections import defaultdict


class Severity(str, Enum):
    """Alvorlighetsgrad for funn"""
    CRITICAL = "critical"  # 5+ duplikater, høy risiko
    WARNING = "warning"    # 3-4 duplikater
    INFO = "info"          # Informasjon


@dataclass
class Location:
    """En lokasjon hvor en konstant er funnet"""
    file: str
    line: int
    context: str  # Linje-innhold (trimmet)


@dataclass
class DuplicatedConstant:
    """En duplisert konstant"""
    value: str
    value_type: str  # 'number', 'url', 'string'
    locations: list = field(default_factory=list)
    suggested_name: Optional[str] = None
    severity: Severity = Severity.WARNING

    @property
    def count(self) -> int:
        return len(self.locations)


# Kjente konstanter som kan ignoreres
IGNORED_VALUES = {
    # Vanlige tall
    '0', '1', '2', '3', '100', '200', '300', '400', '500',
    # HTTP status codes
    '200', '201', '400', '401', '403', '404', '409', '422', '500',
    # Vanlige CSS/layout verdier
    '4', '8', '12', '16', '24', '32', '48', '64',
    # Tomme strenger og whitespace
    '', ' ', '  ',
}

# Patterns for å finne konstanter
PATTERNS = {
    'number': [
        # Tall uten desimal (50000, 1000000, etc.)
        (r'\b(\d{4,})\b', lambda m: m.group(1)),
        # Desimaltall (1.3, 0.5, etc.)
        (r'\b(\d+\.\d+)\b', lambda m: m.group(1)),
    ],
    'url': [
        # HTTP URLs
        (r'["\']?(https?://[^\s"\']+)["\']?', lambda m: m.group(1)),
    ],
    'magic_string': [
        # Spesifikke magic strings vi leter etter
        (r'["\']([A-Z][A-Z_]{2,})["\']', lambda m: m.group(1)),
    ],
}

# Forslag til konstantnavn basert på verdi
SUGGESTED_NAMES = {
    '50000': 'DAGMULKTSATS_DEFAULT',
    '1.3': 'FORSERING_MULTIPLIER',
    '500000': 'APPROVAL_THRESHOLD_TIER_1',
    '2000000': 'APPROVAL_THRESHOLD_TIER_2',
    '5000000': 'APPROVAL_THRESHOLD_TIER_3',
    '10000000': 'APPROVAL_THRESHOLD_TIER_4',
    'http://localhost:8080': 'API_BASE_URL_DEV',
    'http://localhost:3000': 'FRONTEND_URL_DEV',
    'http://localhost:5000': 'BACKEND_URL_DEV',
}


def find_project_root() -> Path:
    """Finn prosjektroten ved å lete etter package.json"""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    raise RuntimeError("Kunne ikke finne prosjektroten (package.json)")


def should_skip_file(file_path: Path) -> bool:
    """Sjekk om filen skal hoppes over"""
    skip_patterns = [
        'node_modules', '.git', 'dist', 'build', '__pycache__',
        '.venv', 'venv', 'coverage', '.next',
        # Skip lock files
        'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
        # Skip generated files
        '.d.ts',
    ]
    path_str = str(file_path)
    return any(pattern in path_str for pattern in skip_patterns)


def scan_file(file_path: Path, value_type: str, patterns: list) -> dict[str, list[Location]]:
    """Skann en fil for konstanter av en bestemt type"""
    findings = defaultdict(list)

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception:
        return findings

    for line_num, line in enumerate(lines, 1):
        # Skip comments
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('#') or stripped.startswith('*'):
            continue

        for pattern, extractor in patterns:
            for match in re.finditer(pattern, line):
                value = extractor(match)
                if value and value not in IGNORED_VALUES:
                    # Trim context
                    context = stripped[:100] + ('...' if len(stripped) > 100 else '')
                    findings[value].append(Location(
                        file=str(file_path),
                        line=line_num,
                        context=context
                    ))

    return findings


def scan_codebase(root: Path) -> dict[str, dict[str, list[Location]]]:
    """Skann hele kodebasen for dupliserte konstanter"""
    all_findings = defaultdict(lambda: defaultdict(list))

    # Filer å skanne
    extensions = {'.ts', '.tsx', '.js', '.jsx', '.py'}

    # Skann src/ og backend/
    scan_dirs = [root / 'src', root / 'backend', root / 'e2e', root / '__mocks__']

    for scan_dir in scan_dirs:
        if not scan_dir.exists():
            continue

        for file_path in scan_dir.rglob('*'):
            if file_path.suffix not in extensions:
                continue
            if should_skip_file(file_path):
                continue

            for value_type, patterns in PATTERNS.items():
                findings = scan_file(file_path, value_type, patterns)
                for value, locations in findings.items():
                    all_findings[value_type][value].extend(locations)

    return all_findings


def analyze_findings(raw_findings: dict, min_occurrences: int = 3) -> list[DuplicatedConstant]:
    """Analyser funn og filtrer til relevante duplikater"""
    results = []

    for value_type, values in raw_findings.items():
        for value, locations in values.items():
            # Filtrer ut duplikater i samme fil (ofte OK)
            unique_files = set(loc.file for loc in locations)

            if len(unique_files) >= min_occurrences:
                severity = Severity.CRITICAL if len(unique_files) >= 5 else Severity.WARNING

                results.append(DuplicatedConstant(
                    value=value,
                    value_type=value_type,
                    locations=locations,
                    suggested_name=SUGGESTED_NAMES.get(value),
                    severity=severity
                ))

    # Sorter etter alvorlighet og antall
    results.sort(key=lambda x: (-len(x.locations), x.severity.value))

    return results


def format_text(findings: list[DuplicatedConstant], root: Path) -> str:
    """Formater funn som tekst"""
    if not findings:
        return "✅ Ingen dupliserte konstanter funnet.\n"

    lines = []
    lines.append("=" * 60)
    lines.append("  HARDCODED CONSTANTS REPORT")
    lines.append("=" * 60)
    lines.append("")

    critical_count = sum(1 for f in findings if f.severity == Severity.CRITICAL)
    warning_count = sum(1 for f in findings if f.severity == Severity.WARNING)

    for finding in findings:
        icon = "🔴" if finding.severity == Severity.CRITICAL else "🟡"
        lines.append(f"{icon} DUPLICATED {finding.value_type.upper()}: {finding.value}")
        lines.append(f"   Occurrences: {finding.count} across {len(set(l.file for l in finding.locations))} files")

        if finding.suggested_name:
            lines.append(f"   Suggestion: Create constant '{finding.suggested_name}'")

        lines.append("   Locations:")
        # Vis maks 5 locations
        shown = finding.locations[:5]
        for loc in shown:
            rel_path = Path(loc.file).relative_to(root)
            lines.append(f"     - {rel_path}:{loc.line}")

        if len(finding.locations) > 5:
            lines.append(f"     ... and {len(finding.locations) - 5} more")

        lines.append("")

    lines.append("=" * 60)
    lines.append(f"  SUMMARY: {critical_count} critical, {warning_count} warnings")
    lines.append("=" * 60)

    return "\n".join(lines)


def format_json(findings: list[DuplicatedConstant], root: Path) -> str:
    """Formater funn som JSON"""
    data = {
        "summary": {
            "total": len(findings),
            "critical": sum(1 for f in findings if f.severity == Severity.CRITICAL),
            "warning": sum(1 for f in findings if f.severity == Severity.WARNING),
        },
        "findings": [
            {
                "value": f.value,
                "type": f.value_type,
                "severity": f.severity.value,
                "count": f.count,
                "suggested_name": f.suggested_name,
                "locations": [
                    {
                        "file": str(Path(loc.file).relative_to(root)),
                        "line": loc.line,
                        "context": loc.context
                    }
                    for loc in f.locations
                ]
            }
            for f in findings
        ]
    }
    return json.dumps(data, indent=2, ensure_ascii=False)


def format_markdown(findings: list[DuplicatedConstant], root: Path) -> str:
    """Formater funn som Markdown"""
    lines = []
    lines.append("# Hardcoded Constants Report")
    lines.append("")

    if not findings:
        lines.append("✅ Ingen dupliserte konstanter funnet.")
        return "\n".join(lines)

    critical_count = sum(1 for f in findings if f.severity == Severity.CRITICAL)
    warning_count = sum(1 for f in findings if f.severity == Severity.WARNING)

    lines.append(f"**Summary:** {critical_count} critical, {warning_count} warnings")
    lines.append("")

    # Critical first
    critical = [f for f in findings if f.severity == Severity.CRITICAL]
    if critical:
        lines.append("## 🔴 Critical (5+ occurrences)")
        lines.append("")
        for finding in critical:
            lines.append(f"### `{finding.value}`")
            lines.append(f"- Type: {finding.value_type}")
            lines.append(f"- Occurrences: {finding.count}")
            if finding.suggested_name:
                lines.append(f"- Suggested constant: `{finding.suggested_name}`")
            lines.append("")
            lines.append("| File | Line |")
            lines.append("|------|------|")
            for loc in finding.locations[:10]:
                rel_path = Path(loc.file).relative_to(root)
                lines.append(f"| `{rel_path}` | {loc.line} |")
            if len(finding.locations) > 10:
                lines.append(f"| ... | +{len(finding.locations) - 10} more |")
            lines.append("")

    # Warnings
    warnings = [f for f in findings if f.severity == Severity.WARNING]
    if warnings:
        lines.append("## 🟡 Warning (3-4 occurrences)")
        lines.append("")
        for finding in warnings:
            lines.append(f"### `{finding.value}`")
            lines.append(f"- Type: {finding.value_type}")
            lines.append(f"- Occurrences: {finding.count}")
            if finding.suggested_name:
                lines.append(f"- Suggested constant: `{finding.suggested_name}`")
            lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Detect hardcoded constants")
    parser.add_argument('--format', choices=['text', 'json', 'markdown'], default='text')
    parser.add_argument('--ci', action='store_true', help='CI mode: exit 1 on critical findings')
    parser.add_argument('--min', type=int, default=3, help='Minimum occurrences to report')
    args = parser.parse_args()

    root = find_project_root()

    # Skann kodebasen
    raw_findings = scan_codebase(root)

    # Analyser
    findings = analyze_findings(raw_findings, min_occurrences=args.min)

    # Output
    if args.format == 'json':
        print(format_json(findings, root))
    elif args.format == 'markdown':
        print(format_markdown(findings, root))
    else:
        print(format_text(findings, root))

    # CI mode
    if args.ci:
        critical_count = sum(1 for f in findings if f.severity == Severity.CRITICAL)
        if critical_count > 0:
            sys.exit(1)

    sys.exit(0)


if __name__ == '__main__':
    main()
