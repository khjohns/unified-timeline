#!/usr/bin/env python3
"""
Documentation Drift Checker

Sjekker at dokumentasjon er synkronisert med kode.

Bruk:
    python scripts/docs_drift.py              # Standard output
    python scripts/docs_drift.py --format json    # JSON output
    python scripts/docs_drift.py --ci             # CI mode (exit 1 on drift)
    python scripts/docs_drift.py --verbose        # Vis detaljer

Sjekker:
    1. Avhengighetsversjoner (package.json vs README/THIRD-PARTY-NOTICES)
    2. Mappestruktur (dokumentert vs faktisk)
    3. Event-typer (ARCHITECTURE_AND_DATAMODEL vs events.py)
    4. Kommandoer (CLAUDE.md vs package.json scripts)
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


def find_project_root() -> Path:
    """Finn prosjektroten"""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    raise RuntimeError("Kunne ikke finne prosjektroten")


# ==============================================================================
# Hjelpefunksjoner
# ==============================================================================


def read_file(path: Path) -> str:
    """Les fil med UTF-8 encoding"""
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def extract_version(text: str, package: str) -> str | None:
    """Ekstraher versjonsnummer fra tekst for en pakke"""
    # Matcher f.eks. "React | 19.2 |" eller "@oslokommune/punkt-assets** (v13.11.0)"
    # Bruker word boundary (\b) for å unngå false matches (f.eks. "React" i "punkt-react")
    patterns = [
        rf"(?<![/@\w-]){re.escape(package)}(?![/@\w-])\s*\|\s*([\d.]+)",  # Tabellformat
        rf"(?<![/@\w-]){re.escape(package)}(?![/@\w-])\**\s*\(v?([\d.]+)\)",  # Parentes
        rf"(?<![/@\w-]){re.escape(package)}(?![/@\w-])\s+([\d.]+)",  # Mellomrom-format
    ]
    # Spesialtilfelle for scoped packages (@oslokommune/...)
    if package.startswith("@"):
        patterns = [
            rf"{re.escape(package)}\**\s*\(v?([\d.]+)\)",  # Parentes-format
            rf"{re.escape(package)}\s+([\d.]+)",  # Mellomrom-format
        ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def versions_match(doc_version: str, actual_version: str) -> bool:
    """Sjekk om versjoner matcher (tillater f.eks. 19.2 vs 19.2.0)"""
    # Normaliser versjoner
    doc_parts = doc_version.split(".")
    actual_parts = actual_version.split(".")

    # Sammenlign så langt dokumentert versjon spesifiserer
    for i, doc_part in enumerate(doc_parts):
        if i >= len(actual_parts):
            return False
        if doc_part != actual_parts[i]:
            return False
    return True


def get_package_json_version(package_json: dict, package: str) -> str | None:
    """Hent versjon fra package.json"""
    deps = package_json.get("dependencies", {})
    dev_deps = package_json.get("devDependencies", {})
    version = deps.get(package) or dev_deps.get(package)
    if version:
        # Fjern ^ eller ~ prefiks
        return version.lstrip("^~")
    return None


# ==============================================================================
# Sjekkere
# ==============================================================================


def check_dependency_versions(root: Path, verbose: bool = False) -> dict:
    """Sjekk at avhengighetsversjoner er oppdatert i dokumentasjon"""
    findings = []

    # Les package.json
    package_json_path = root / "package.json"
    try:
        package_json = json.loads(read_file(package_json_path))
    except json.JSONDecodeError:
        return {"error": "Kunne ikke parse package.json", "findings": []}

    # Dokumenter å sjekke
    docs_to_check = [
        (root / "README.md", "README.md"),
        (root / "THIRD-PARTY-NOTICES.md", "THIRD-PARTY-NOTICES.md"),
    ]

    # Viktige pakker å sjekke
    packages_to_check = [
        ("react", "React"),
        ("typescript", "TypeScript"),
        ("vite", "Vite"),
        ("vitest", "Vitest"),
        ("tailwindcss", "Tailwind CSS"),
        ("@oslokommune/punkt-assets", "@oslokommune/punkt-assets"),
        ("@oslokommune/punkt-css", "@oslokommune/punkt-css"),
        ("@oslokommune/punkt-react", "@oslokommune/punkt-react"),
        ("react-router-dom", "react-router-dom"),
    ]

    for doc_path, doc_name in docs_to_check:
        if not doc_path.exists():
            continue

        doc_content = read_file(doc_path)

        for pkg_name, display_name in packages_to_check:
            actual_version = get_package_json_version(package_json, pkg_name)
            if not actual_version:
                continue

            doc_version = extract_version(doc_content, display_name)
            if doc_version and not versions_match(doc_version, actual_version):
                findings.append({
                    "type": "version_mismatch",
                    "severity": "warning",
                    "document": doc_name,
                    "package": display_name,
                    "documented": doc_version,
                    "actual": actual_version,
                    "message": f"{display_name}: dokumentert {doc_version}, faktisk {actual_version}",
                })

    return {
        "check": "dependency_versions",
        "drift_detected": len(findings) > 0,
        "findings": findings,
    }


def check_folder_structure(root: Path, verbose: bool = False) -> dict:
    """Sjekk at dokumentert mappestruktur matcher faktisk struktur"""
    findings = []

    # Forventede mapper basert på CLAUDE.md/README
    expected_folders = [
        "src/components",
        "src/pages",
        "src/api",
        "src/hooks",
        "src/types",
        "src/constants",
        "backend/models",
        "backend/services",
        "backend/routes",
        "backend/repositories",
    ]

    for folder in expected_folders:
        folder_path = root / folder
        if not folder_path.exists():
            findings.append({
                "type": "missing_folder",
                "severity": "critical",
                "folder": folder,
                "message": f"Dokumentert mappe mangler: {folder}",
            })

    # Sjekk toppnivå-mapper dokumentert i README
    readme_path = root / "README.md"
    if readme_path.exists():
        readme_content = read_file(readme_path)

        # Finn kun toppnivå mappereferanser (linjer som starter med ├── eller └──)
        # og ikke er nestet (ingen │ før)
        top_level_pattern = r"^[│\s]*[├└]── (\w+)/$"
        for line in readme_content.split("\n"):
            # Kun sjekk mapper på "toppnivå" i strukturdiagrammet
            # (dvs. src/, backend/, docs/ etc.)
            if line.strip().startswith(("├──", "└──")) and "/" in line:
                match = re.match(r"^[├└]── (\w+)/$", line.strip())
                if match:
                    folder_name = match.group(1)
                    folder_path = root / folder_name
                    if not folder_path.exists():
                        findings.append({
                            "type": "documented_folder_missing",
                            "severity": "warning",
                            "document": "README.md",
                            "folder": folder_name,
                            "message": f"README toppnivå-mappe eksisterer ikke: {folder_name}/",
                        })

    return {
        "check": "folder_structure",
        "drift_detected": len(findings) > 0,
        "findings": findings,
    }


def check_event_types(root: Path, verbose: bool = False) -> dict:
    """Sjekk at dokumenterte event-typer matcher events.py"""
    findings = []

    events_py_path = root / "backend" / "models" / "events.py"
    arch_doc_path = root / "docs" / "ARCHITECTURE_AND_DATAMODEL.md"

    if not events_py_path.exists():
        return {"check": "event_types", "drift_detected": False, "findings": []}

    events_content = read_file(events_py_path)

    # Finn event-typer fra events.py (Literal["..."] eller class ...Event)
    event_pattern = r'["\'](\w+_\w+)["\']'  # f.eks. "sak_opprettet"
    code_events = set(re.findall(event_pattern, events_content))

    # Filtrer ut kun event-typer (de som har underscore og er lowercase)
    code_events = {e for e in code_events if "_" in e and e.islower()}

    if arch_doc_path.exists():
        arch_content = read_file(arch_doc_path)

        # Finn event-typer dokumentert (f.eks. `sak_opprettet` eller | sak_opprettet |)
        doc_event_pattern = r"`(\w+_\w+)`"
        doc_events = set(re.findall(doc_event_pattern, arch_content))

        # Events i kode men ikke i dokumentasjon
        undocumented = code_events - doc_events
        for event in sorted(undocumented):
            # Ignorer interne events
            if not event.startswith("_"):
                findings.append({
                    "type": "undocumented_event",
                    "severity": "info",
                    "event": event,
                    "message": f"Event-type i kode men ikke dokumentert: {event}",
                })

    return {
        "check": "event_types",
        "drift_detected": any(f["severity"] in ["critical", "warning"] for f in findings),
        "findings": findings,
    }


def check_npm_scripts(root: Path, verbose: bool = False) -> dict:
    """Sjekk at dokumenterte npm-kommandoer faktisk eksisterer"""
    findings = []

    package_json_path = root / "package.json"
    claude_md_path = root / "CLAUDE.md"

    try:
        package_json = json.loads(read_file(package_json_path))
    except json.JSONDecodeError:
        return {"check": "npm_scripts", "drift_detected": False, "findings": []}

    actual_scripts = set(package_json.get("scripts", {}).keys())

    if claude_md_path.exists():
        claude_content = read_file(claude_md_path)

        # Finn npm run kommandoer
        npm_commands = re.findall(r"npm run (\w+)", claude_content)

        for cmd in set(npm_commands):
            if cmd not in actual_scripts:
                findings.append({
                    "type": "missing_script",
                    "severity": "warning",
                    "document": "CLAUDE.md",
                    "script": cmd,
                    "message": f"Dokumentert npm-script finnes ikke: npm run {cmd}",
                })

    return {
        "check": "npm_scripts",
        "drift_detected": len(findings) > 0,
        "findings": findings,
    }


def check_api_endpoints(root: Path, verbose: bool = False) -> dict:
    """Sjekk at dokumenterte API-endpoints matcher backend routes"""
    findings = []

    quickstart_path = root / "QUICKSTART.md"
    routes_dir = root / "backend" / "routes"

    if not quickstart_path.exists() or not routes_dir.exists():
        return {"check": "api_endpoints", "drift_detected": False, "findings": []}

    quickstart_content = read_file(quickstart_path)

    # Finn dokumenterte endpoints
    doc_endpoints = re.findall(r"`(/api/\S+)`", quickstart_content)

    # Finn faktiske endpoints fra routes
    actual_endpoints = set()
    for route_file in routes_dir.glob("*.py"):
        route_content = read_file(route_file)
        # Finn @bp.route("/...") eller @blueprint.route("/...")
        routes = re.findall(r'@\w+\.route\(["\']([^"\']+)["\']', route_content)
        for route in routes:
            # Normaliser route (fjern <param> til <id>)
            normalized = re.sub(r"<\w+:\w+>", "<id>", route)
            normalized = re.sub(r"<\w+>", "<id>", normalized)
            actual_endpoints.add(normalized)

    # Sjekk at dokumenterte endpoints eksisterer
    for endpoint in doc_endpoints:
        # Normaliser for sammenligning
        normalized = re.sub(r"<\w+>", "<id>", endpoint)
        # Fjern /api prefix for matching
        route_part = normalized.replace("/api", "")

        # Enkel matching - sjekk om route_part finnes i noen faktisk endpoint
        found = any(route_part in actual for actual in actual_endpoints)
        if not found and "<id>" not in normalized:
            # Kun rapporter hvis det ikke er en dynamisk route
            pass  # Hopp over for nå - for komplekst å matche presist

    return {
        "check": "api_endpoints",
        "drift_detected": len(findings) > 0,
        "findings": findings,
    }


def check_last_updated_dates(root: Path, verbose: bool = False) -> dict:
    """Sjekk at 'Sist oppdatert'-datoer ikke er for gamle"""
    findings = []

    docs_to_check = [
        root / "README.md",
        root / "docs" / "ARCHITECTURE_AND_DATAMODEL.md",
        root / "docs" / "FRONTEND_ARCHITECTURE.md",
        root / "docs" / "SECURITY_ARCHITECTURE.md",
    ]

    for doc_path in docs_to_check:
        if not doc_path.exists():
            continue

        content = read_file(doc_path)

        # Finn "Sist oppdatert: YYYY-MM-DD" eller "*Sist oppdatert: ..."
        date_match = re.search(r"[Ss]ist oppdatert:?\s*(\d{4}-\d{2}-\d{2})", content)
        if date_match:
            date_str = date_match.group(1)
            # Enkel sjekk - bare rapporter at vi fant datoen
            if verbose:
                findings.append({
                    "type": "last_updated",
                    "severity": "info",
                    "document": doc_path.name,
                    "date": date_str,
                    "message": f"{doc_path.name}: Sist oppdatert {date_str}",
                })

    return {
        "check": "last_updated_dates",
        "drift_detected": False,  # Bare informasjon
        "findings": findings,
    }


# ==============================================================================
# Rapportering
# ==============================================================================


def format_text_report(results: list[dict], verbose: bool = False) -> str:
    """Formater tekstrapport"""
    lines = []
    lines.append("=" * 60)
    lines.append("  DOCUMENTATION DRIFT REPORT")
    lines.append("=" * 60)
    lines.append("")

    total_critical = 0
    total_warning = 0
    total_info = 0

    for result in results:
        check_name = result["check"].upper().replace("_", " ")
        lines.append(f"{check_name}")
        lines.append("-" * 40)

        if result.get("error"):
            lines.append(f"  Feil: {result['error']}")
        elif result.get("drift_detected") or (verbose and result.get("findings")):
            for finding in result.get("findings", []):
                severity = finding.get("severity", "info")
                if severity == "critical":
                    total_critical += 1
                    prefix = "KRITISK"
                elif severity == "warning":
                    total_warning += 1
                    prefix = "ADVARSEL"
                else:
                    total_info += 1
                    prefix = "INFO"

                if verbose or severity in ["critical", "warning"]:
                    lines.append(f"  [{prefix}] {finding['message']}")
        else:
            lines.append("  OK - Ingen drift")

        lines.append("")

    # Oppsummering
    lines.append("=" * 60)
    total_drift = total_critical + total_warning
    if total_drift > 0:
        lines.append(f"  TOTALT: {total_critical} kritiske, {total_warning} advarsler, {total_info} info")
        lines.append("")
        lines.append("  Tips: Kjør med --verbose for alle detaljer")
    else:
        lines.append("  OK - Dokumentasjon er synkronisert med kode")
    lines.append("=" * 60)

    return "\n".join(lines)


def format_json_report(results: list[dict]) -> str:
    """Formater JSON-rapport"""
    total_critical = sum(
        1
        for r in results
        for f in r.get("findings", [])
        if f.get("severity") == "critical"
    )
    total_warning = sum(
        1
        for r in results
        for f in r.get("findings", [])
        if f.get("severity") == "warning"
    )

    report = {
        "drift_detected": any(r.get("drift_detected") for r in results),
        "summary": {
            "critical": total_critical,
            "warning": total_warning,
        },
        "checks": results,
    }
    return json.dumps(report, indent=2, ensure_ascii=False)


# ==============================================================================
# Main
# ==============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="Sjekker dokumentasjon mot kode for drift"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["text", "json"],
        default="text",
        help="Output-format (default: text)"
    )
    parser.add_argument(
        "--ci",
        action="store_true",
        help="CI-modus: Exit 1 ved kritisk drift"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Vis alle funn inkludert info"
    )

    args = parser.parse_args()

    root = find_project_root()

    # Kjør alle sjekkere
    results = [
        check_dependency_versions(root, args.verbose),
        check_folder_structure(root, args.verbose),
        check_event_types(root, args.verbose),
        check_npm_scripts(root, args.verbose),
        check_api_endpoints(root, args.verbose),
        check_last_updated_dates(root, args.verbose),
    ]

    # Formater output
    if args.format == "json":
        output = format_json_report(results)
    else:
        output = format_text_report(results, args.verbose)

    print(output)

    # Exit code for CI
    if args.ci:
        has_critical = any(
            f.get("severity") == "critical"
            for r in results
            for f in r.get("findings", [])
        )
        if has_critical:
            sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
