#!/usr/bin/env python3
"""
Category Drift Checker

Sammenligner grunnlagskategorier mellom frontend og backend.

Sjekker:
- Hovedkategorier (koder og labels)
- Underkategorier per hovedkategori (koder)
- Manglende eller ekstra kategorier

Bruk:
    python scripts/category_drift.py              # Standard output
    python scripts/category_drift.py --verbose    # Vis detaljer
    python scripts/category_drift.py --format json
    python scripts/category_drift.py --ci         # Exit 1 ved drift
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Any, Set


def find_project_root() -> Path:
    """Finn prosjektroten"""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    raise RuntimeError("Kunne ikke finne prosjektroten")


def parse_typescript_categories(file_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Parse kategorier fra TypeScript-filen.
    Returnerer dict med hovedkategori-kode som nøkkel.
    """
    content = file_path.read_text(encoding='utf-8')

    categories = {}

    # Finn KRAV_STRUKTUR_NS8407 array content
    array_match = re.search(
        r'export const KRAV_STRUKTUR_NS8407.*?=\s*\[(.*)\];',
        content,
        re.DOTALL
    )

    if not array_match:
        return categories

    array_content = array_match.group(1)

    # Split på hovedkategorier - finn blokker som starter med { og har kode:
    # Vi må være forsiktige med nested underkategorier
    # Bruk en enklere tilnærming: finn alle kode: 'XXX' på toppnivå

    # Finn hovedkategorier ved å lete etter mønsteret for en hovedkategori
    # En hovedkategori har felter som hjemmel_frist som underkategorier ikke har
    hovedkat_pattern = re.compile(
        r"kode:\s*['\"](\w+)['\"].*?"
        r"label:\s*['\"]([^'\"]+)['\"].*?"
        r"hjemmel_frist:.*?"  # Kun hovedkategorier har dette
        r"underkategorier:\s*\[(.*?)\]",
        re.DOTALL
    )

    underkat_pattern = re.compile(
        r"kode:\s*['\"](\w+)['\"]"
    )

    for match in hovedkat_pattern.finditer(array_content):
        kode = match.group(1)
        label = match.group(2)
        underkat_content = match.group(3)

        # Finn alle underkategori-koder
        underkategorier = underkat_pattern.findall(underkat_content)

        categories[kode] = {
            "kode": kode,
            "label": label,
            "underkategorier": underkategorier,
        }

    return categories


def parse_python_categories(file_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Parse kategorier fra Python-filen.
    Returnerer dict med hovedkategori-kode som nøkkel.
    """
    content = file_path.read_text(encoding='utf-8')

    categories = {}

    # Finn hver hovedkategori i GRUNNLAG_KATEGORIER
    # Match blokker som starter med "KATEGORI": {
    hovedkat_pattern = re.compile(
        r'"(\w+)":\s*\{\s*'  # hovedkategori-kode
        r'"kode":\s*"\w+".*?'
        r'"label":\s*"([^"]+)".*?'  # label
        r'"underkategorier":\s*\[(.*?)\]',  # underkategorier
        re.DOTALL
    )

    underkat_pattern = re.compile(
        r'"kode":\s*"(\w+)"',
        re.DOTALL
    )

    for match in hovedkat_pattern.finditer(content):
        kode = match.group(1)
        label = match.group(2)
        underkat_content = match.group(3)

        underkategorier = underkat_pattern.findall(underkat_content)

        categories[kode] = {
            "kode": kode,
            "label": label,
            "underkategorier": underkategorier,
        }

    return categories


def compare_categories(
    ts_categories: Dict[str, Dict[str, Any]],
    py_categories: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Sammenlign kategorier og returner avvik.
    """
    findings = []

    ts_koder = set(ts_categories.keys())
    py_koder = set(py_categories.keys())

    # Sjekk manglende hovedkategorier
    missing_in_ts = py_koder - ts_koder
    missing_in_py = ts_koder - py_koder

    for kode in missing_in_ts:
        findings.append({
            "type": "hovedkategori_mangler",
            "severity": "critical",
            "kode": kode,
            "message": f"Hovedkategori '{kode}' finnes i backend men mangler i frontend",
        })

    for kode in missing_in_py:
        findings.append({
            "type": "hovedkategori_mangler",
            "severity": "critical",
            "kode": kode,
            "message": f"Hovedkategori '{kode}' finnes i frontend men mangler i backend",
        })

    # Sammenlign underkategorier for felles hovedkategorier
    common_koder = ts_koder & py_koder

    for kode in common_koder:
        ts_cat = ts_categories[kode]
        py_cat = py_categories[kode]

        ts_under = set(ts_cat["underkategorier"])
        py_under = set(py_cat["underkategorier"])

        # Sjekk label-mismatch
        if ts_cat["label"] != py_cat["label"]:
            findings.append({
                "type": "label_mismatch",
                "severity": "warning",
                "hovedkategori": kode,
                "ts_label": ts_cat["label"],
                "py_label": py_cat["label"],
                "message": f"Label-mismatch for '{kode}': TS='{ts_cat['label']}', Py='{py_cat['label']}'",
            })

        # Sjekk manglende underkategorier
        missing_in_ts_under = py_under - ts_under
        missing_in_py_under = ts_under - py_under

        for under_kode in missing_in_ts_under:
            findings.append({
                "type": "underkategori_mangler",
                "severity": "critical",
                "hovedkategori": kode,
                "underkategori": under_kode,
                "message": f"Underkategori '{under_kode}' i {kode} finnes i backend men mangler i frontend",
            })

        for under_kode in missing_in_py_under:
            findings.append({
                "type": "underkategori_mangler",
                "severity": "critical",
                "hovedkategori": kode,
                "underkategori": under_kode,
                "message": f"Underkategori '{under_kode}' i {kode} finnes i frontend men mangler i backend",
            })

    # Oppsummering
    critical_count = sum(1 for f in findings if f["severity"] == "critical")
    warning_count = sum(1 for f in findings if f["severity"] == "warning")

    return {
        "drift_detected": len(findings) > 0,
        "critical_count": critical_count,
        "warning_count": warning_count,
        "findings": findings,
        "ts_categories_count": len(ts_categories),
        "py_categories_count": len(py_categories),
    }


def format_text_report(result: Dict[str, Any], verbose: bool = False) -> str:
    """Formater rapport som tekst."""
    lines = []
    lines.append("=" * 60)
    lines.append("  CATEGORY DRIFT CHECK")
    lines.append("=" * 60)
    lines.append("")

    lines.append(f"  Hovedkategorier i frontend: {result['ts_categories_count']}")
    lines.append(f"  Hovedkategorier i backend:  {result['py_categories_count']}")
    lines.append("")

    if not result["drift_detected"]:
        lines.append("  [OK] Ingen drift funnet - kategorier er synkronisert")
    else:
        lines.append(f"  [DRIFT] {result['critical_count']} kritiske, {result['warning_count']} advarsler")
        lines.append("")

        # Grupper funn etter type
        by_type: Dict[str, List] = {}
        for finding in result["findings"]:
            ftype = finding["type"]
            if ftype not in by_type:
                by_type[ftype] = []
            by_type[ftype].append(finding)

        for ftype, findings in by_type.items():
            severity = findings[0]["severity"]
            icon = "[!]" if severity == "critical" else "[?]"
            lines.append(f"  {icon} {ftype.upper().replace('_', ' ')} ({len(findings)}):")

            for finding in findings[:10]:  # Max 10 per type
                if verbose:
                    lines.append(f"      - {finding['message']}")
                else:
                    if ftype == "underkategori_mangler":
                        lines.append(f"      - {finding['hovedkategori']}/{finding['underkategori']}")
                    elif ftype == "hovedkategori_mangler":
                        lines.append(f"      - {finding['kode']}")
                    elif ftype == "label_mismatch":
                        lines.append(f"      - {finding['hovedkategori']}")

            if len(findings) > 10:
                lines.append(f"      ... og {len(findings) - 10} til")
            lines.append("")

    lines.append("=" * 60)
    return "\n".join(lines)


def format_json_report(result: Dict[str, Any]) -> str:
    """Formater rapport som JSON."""
    return json.dumps(result, indent=2, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(
        description="Sammenlign grunnlagskategorier mellom frontend og backend"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["text", "json"],
        default="text",
        help="Output-format (default: text)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Vis detaljerte meldinger"
    )
    parser.add_argument(
        "--ci",
        action="store_true",
        help="CI-modus: Exit 1 ved kritisk drift"
    )

    args = parser.parse_args()

    root = find_project_root()

    ts_file = root / "src" / "constants" / "categories.ts"
    py_file = root / "backend" / "constants" / "grunnlag_categories.py"

    if not ts_file.exists():
        print(f"FEIL: TypeScript-fil ikke funnet: {ts_file}")
        sys.exit(1)
    if not py_file.exists():
        print(f"FEIL: Python-fil ikke funnet: {py_file}")
        sys.exit(1)

    # Parse kategorier
    ts_categories = parse_typescript_categories(ts_file)
    py_categories = parse_python_categories(py_file)

    # Sammenlign
    result = compare_categories(ts_categories, py_categories)

    # Output
    if args.format == "json":
        print(format_json_report(result))
    else:
        print(format_text_report(result, args.verbose))

    # Exit code
    if args.ci and result["critical_count"] > 0:
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
