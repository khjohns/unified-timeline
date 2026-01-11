#!/usr/bin/env python3
"""
Label Coverage Checker

Sjekker at alle enum-verdier har tilhørende labels/tekster.
Verifiserer at:
- EVENT_TYPE_LABELS dekker alle EventType-verdier
- SUBSIDIAER_TRIGGER_LABELS dekker alle SubsidiaerTrigger-verdier
- BH response options dekker alle resultat-enums

Bruk:
    python scripts/label_coverage.py              # Standard output
    python scripts/label_coverage.py --format json    # JSON output
    python scripts/label_coverage.py --format markdown # Markdown output
    python scripts/label_coverage.py --ci             # CI mode (exit 1 on missing)
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
    """Alvorlighetsgrad for funn"""
    CRITICAL = "critical"  # Manglende label
    WARNING = "warning"    # Ekstra label (ikke i enum)
    INFO = "info"          # Informasjon


@dataclass
class CoverageResult:
    """Resultat av coverage-sjekk for én mapping"""
    name: str
    enum_source: str       # Fil hvor enum er definert
    label_source: str      # Fil hvor labels er definert
    enum_values: set = field(default_factory=set)
    label_keys: set = field(default_factory=set)
    missing_labels: set = field(default_factory=set)  # I enum, ikke i labels
    extra_labels: set = field(default_factory=set)    # I labels, ikke i enum

    @property
    def is_complete(self) -> bool:
        return len(self.missing_labels) == 0

    @property
    def coverage_percent(self) -> float:
        if not self.enum_values:
            return 100.0
        covered = len(self.enum_values) - len(self.missing_labels)
        return (covered / len(self.enum_values)) * 100


def find_project_root() -> Path:
    """Finn prosjektroten ved å lete etter package.json"""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    raise RuntimeError("Kunne ikke finne prosjektroten (package.json)")


def parse_ts_union_type(file_path: Path, type_name: str) -> set[str]:
    """
    Parser en TypeScript union type og ekstraherer verdier.
    Eksempel: type EventType = 'a' | 'b' | 'c';
    """
    values = set()

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Finn type-definisjonen (kan spenne over flere linjer)
    pattern = rf"export\s+type\s+{type_name}\s*=\s*([\s\S]*?);"

    match = re.search(pattern, content)
    if not match:
        return values

    type_body = match.group(1)

    # Fjern kommentarer
    # Fjern single-line kommentarer
    type_body = re.sub(r'//[^\n]*', '', type_body)
    # Fjern multi-line kommentarer
    type_body = re.sub(r'/\*[\s\S]*?\*/', '', type_body)

    # Finn alle string literals (bare selve verdien, ikke whitespace/pipes)
    for literal in re.findall(r"'([a-z_]+)'", type_body):
        if literal:  # Ignorer tomme strenger
            values.add(literal)

    return values


def parse_ts_record_keys(file_path: Path, record_name: str) -> set[str]:
    """
    Parser en TypeScript Record og ekstraherer keys.
    Eksempel: const EVENT_TYPE_LABELS: Record<EventType, string> = { a: 'A', b: 'B' };
    """
    keys = set()

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Finn Record-definisjonen (kan spenne over flere linjer)
    # Matcher: export const NAME: Record<...> = { ... }
    # eller:   export const NAME = { ... } as Record<...>
    pattern = rf"export\s+const\s+{record_name}[^=]*=\s*\{{([\s\S]*?)\}}\s*(?:as\s+Record|;)"

    match = re.search(pattern, content)
    if not match:
        # Prøv alternativ pattern for Record<Type, string> = {
        pattern2 = rf"const\s+{record_name}\s*:\s*Record<[^>]+>\s*=\s*\{{([\s\S]*?)\}}"
        match = re.search(pattern2, content)

    if not match:
        return keys

    record_body = match.group(1)

    # Finn alle keys (enten 'key': eller key:)
    for key in re.findall(r"['\"]?(\w+)['\"]?\s*:", record_body):
        # Ignorer tomme linjer og kommentarer
        if key and not key.startswith('//'):
            keys.add(key)

    return keys


def parse_ts_dropdown_values(file_path: Path, array_name: str) -> set[str]:
    """
    Parser en TypeScript DropdownOption[] array og ekstraherer value-felter.
    Eksempel: const OPTIONS: DropdownOption[] = [{ value: 'a', label: 'A' }];
    """
    values = set()

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Finn array-definisjonen
    pattern = rf"export\s+const\s+{array_name}[^=]*=\s*\[([\s\S]*?)\];"

    match = re.search(pattern, content)
    if not match:
        return values

    array_body = match.group(1)

    # Finn alle value: 'xxx' eller value: "xxx"
    for value in re.findall(r'value:\s*["\']([^"\']*)["\']', array_body):
        # Ignorer tomme verdier (placeholder)
        if value:
            values.add(value)

    return values


def check_event_type_labels(root: Path) -> CoverageResult:
    """Sjekk at EVENT_TYPE_LABELS dekker alle EventType-verdier"""
    timeline_path = root / 'src' / 'types' / 'timeline.ts'
    labels_path = root / 'src' / 'constants' / 'eventTypeLabels.ts'

    enum_values = parse_ts_union_type(timeline_path, 'EventType')
    label_keys = parse_ts_record_keys(labels_path, 'EVENT_TYPE_LABELS')

    return CoverageResult(
        name='EventType → EVENT_TYPE_LABELS',
        enum_source='src/types/timeline.ts',
        label_source='src/constants/eventTypeLabels.ts',
        enum_values=enum_values,
        label_keys=label_keys,
        missing_labels=enum_values - label_keys,
        extra_labels=label_keys - enum_values
    )


def check_subsidiaer_trigger_labels(root: Path) -> CoverageResult:
    """Sjekk at SUBSIDIAER_TRIGGER_LABELS dekker alle SubsidiaerTrigger-verdier"""
    timeline_path = root / 'src' / 'types' / 'timeline.ts'
    options_path = root / 'src' / 'constants' / 'responseOptions.ts'

    enum_values = parse_ts_union_type(timeline_path, 'SubsidiaerTrigger')
    label_keys = parse_ts_record_keys(options_path, 'SUBSIDIAER_TRIGGER_LABELS')

    return CoverageResult(
        name='SubsidiaerTrigger → SUBSIDIAER_TRIGGER_LABELS',
        enum_source='src/types/timeline.ts',
        label_source='src/constants/responseOptions.ts',
        enum_values=enum_values,
        label_keys=label_keys,
        missing_labels=enum_values - label_keys,
        extra_labels=label_keys - enum_values
    )


def check_grunnlag_response_options(root: Path) -> CoverageResult:
    """Sjekk at BH_GRUNNLAGSVAR_OPTIONS dekker alle GrunnlagResponsResultat-verdier"""
    timeline_path = root / 'src' / 'types' / 'timeline.ts'
    options_path = root / 'src' / 'constants' / 'responseOptions.ts'

    enum_values = parse_ts_union_type(timeline_path, 'GrunnlagResponsResultat')
    option_values = parse_ts_dropdown_values(options_path, 'BH_GRUNNLAGSVAR_OPTIONS')

    return CoverageResult(
        name='GrunnlagResponsResultat → BH_GRUNNLAGSVAR_OPTIONS',
        enum_source='src/types/timeline.ts',
        label_source='src/constants/responseOptions.ts',
        enum_values=enum_values,
        label_keys=option_values,
        missing_labels=enum_values - option_values,
        extra_labels=option_values - enum_values
    )


def check_vederlag_response_options(root: Path) -> CoverageResult:
    """Sjekk at BH_VEDERLAGSSVAR_OPTIONS dekker alle VederlagBeregningResultat-verdier"""
    timeline_path = root / 'src' / 'types' / 'timeline.ts'
    options_path = root / 'src' / 'constants' / 'responseOptions.ts'

    enum_values = parse_ts_union_type(timeline_path, 'VederlagBeregningResultat')
    option_values = parse_ts_dropdown_values(options_path, 'BH_VEDERLAGSSVAR_OPTIONS')

    return CoverageResult(
        name='VederlagBeregningResultat → BH_VEDERLAGSSVAR_OPTIONS',
        enum_source='src/types/timeline.ts',
        label_source='src/constants/responseOptions.ts',
        enum_values=enum_values,
        label_keys=option_values,
        missing_labels=enum_values - option_values,
        extra_labels=option_values - enum_values
    )


def check_frist_response_options(root: Path) -> CoverageResult:
    """Sjekk at BH_FRISTSVAR_OPTIONS dekker alle FristBeregningResultat-verdier"""
    timeline_path = root / 'src' / 'types' / 'timeline.ts'
    options_path = root / 'src' / 'constants' / 'responseOptions.ts'

    enum_values = parse_ts_union_type(timeline_path, 'FristBeregningResultat')
    option_values = parse_ts_dropdown_values(options_path, 'BH_FRISTSVAR_OPTIONS')

    return CoverageResult(
        name='FristBeregningResultat → BH_FRISTSVAR_OPTIONS',
        enum_source='src/types/timeline.ts',
        label_source='src/constants/responseOptions.ts',
        enum_values=enum_values,
        label_keys=option_values,
        missing_labels=enum_values - option_values,
        extra_labels=option_values - enum_values
    )


def run_all_checks(root: Path) -> list[CoverageResult]:
    """Kjør alle coverage-sjekker"""
    return [
        check_event_type_labels(root),
        check_subsidiaer_trigger_labels(root),
        check_grunnlag_response_options(root),
        check_vederlag_response_options(root),
        check_frist_response_options(root),
    ]


def format_text(results: list[CoverageResult]) -> str:
    """Formater resultater som tekst"""
    lines = []
    lines.append("=" * 60)
    lines.append("  LABEL COVERAGE REPORT")
    lines.append("=" * 60)
    lines.append("")

    total_missing = 0
    total_extra = 0

    for result in results:
        if result.is_complete and not result.extra_labels:
            icon = "✅"
        elif result.missing_labels:
            icon = "🔴"
        else:
            icon = "🟡"

        lines.append(f"{icon} {result.name}")
        lines.append(f"   Coverage: {result.coverage_percent:.0f}% ({len(result.enum_values) - len(result.missing_labels)}/{len(result.enum_values)})")

        if result.missing_labels:
            lines.append(f"   MISSING LABELS ({len(result.missing_labels)}):")
            for val in sorted(result.missing_labels):
                lines.append(f"     - {val}")
            total_missing += len(result.missing_labels)

        if result.extra_labels:
            lines.append(f"   EXTRA LABELS ({len(result.extra_labels)}) - not in enum:")
            for val in sorted(result.extra_labels):
                lines.append(f"     - {val}")
            total_extra += len(result.extra_labels)

        lines.append("")

    lines.append("=" * 60)
    if total_missing == 0 and total_extra == 0:
        lines.append("  ✅ ALL LABELS COMPLETE")
    else:
        lines.append(f"  SUMMARY: {total_missing} missing, {total_extra} extra")
    lines.append("=" * 60)

    return "\n".join(lines)


def format_json(results: list[CoverageResult]) -> str:
    """Formater resultater som JSON"""
    data = {
        "summary": {
            "total_checks": len(results),
            "complete": sum(1 for r in results if r.is_complete),
            "missing_count": sum(len(r.missing_labels) for r in results),
            "extra_count": sum(len(r.extra_labels) for r in results),
        },
        "results": [
            {
                "name": r.name,
                "enum_source": r.enum_source,
                "label_source": r.label_source,
                "coverage_percent": round(r.coverage_percent, 1),
                "enum_count": len(r.enum_values),
                "label_count": len(r.label_keys),
                "is_complete": r.is_complete,
                "missing_labels": sorted(r.missing_labels),
                "extra_labels": sorted(r.extra_labels),
            }
            for r in results
        ]
    }
    return json.dumps(data, indent=2, ensure_ascii=False)


def format_markdown(results: list[CoverageResult]) -> str:
    """Formater resultater som Markdown"""
    lines = []
    lines.append("# Label Coverage Report")
    lines.append("")

    total_missing = sum(len(r.missing_labels) for r in results)
    total_extra = sum(len(r.extra_labels) for r in results)

    if total_missing == 0 and total_extra == 0:
        lines.append("✅ **All labels complete!**")
    else:
        lines.append(f"**Summary:** {total_missing} missing, {total_extra} extra")
    lines.append("")

    lines.append("| Mapping | Coverage | Missing | Extra |")
    lines.append("|---------|----------|---------|-------|")

    for result in results:
        icon = "✅" if result.is_complete and not result.extra_labels else ("🔴" if result.missing_labels else "🟡")
        lines.append(f"| {icon} {result.name} | {result.coverage_percent:.0f}% | {len(result.missing_labels)} | {len(result.extra_labels)} |")

    lines.append("")

    # Detaljer for problemer
    problems = [r for r in results if r.missing_labels or r.extra_labels]
    if problems:
        lines.append("## Details")
        lines.append("")

        for result in problems:
            lines.append(f"### {result.name}")
            lines.append("")

            if result.missing_labels:
                lines.append("**Missing labels** (in enum, not in labels):")
                for val in sorted(result.missing_labels):
                    lines.append(f"- `{val}`")
                lines.append("")

            if result.extra_labels:
                lines.append("**Extra labels** (in labels, not in enum):")
                for val in sorted(result.extra_labels):
                    lines.append(f"- `{val}`")
                lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Check label coverage for enums")
    parser.add_argument('--format', choices=['text', 'json', 'markdown'], default='text')
    parser.add_argument('--ci', action='store_true', help='CI mode: exit 1 on missing labels')
    args = parser.parse_args()

    root = find_project_root()

    # Kjør alle sjekker
    results = run_all_checks(root)

    # Output
    if args.format == 'json':
        print(format_json(results))
    elif args.format == 'markdown':
        print(format_markdown(results))
    else:
        print(format_text(results))

    # CI mode
    if args.ci:
        total_missing = sum(len(r.missing_labels) for r in results)
        if total_missing > 0:
            sys.exit(1)

    sys.exit(0)


if __name__ == '__main__':
    main()
