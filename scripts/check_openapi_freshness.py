#!/usr/bin/env python3
"""
OpenAPI Freshness Checker

Sjekker om docs/openapi.yaml er utdatert i forhold til kildefilene.

Bruk:
    python scripts/check_openapi_freshness.py           # Standard sjekk
    python scripts/check_openapi_freshness.py --ci      # Exit 1 hvis utdatert
    python scripts/check_openapi_freshness.py --fix     # Regenerer hvis utdatert

Kildefiler som overvåkes:
    - backend/models/events.py (Pydantic-modeller, enums)
    - backend/models/sak_state.py (State-modeller)
    - backend/constants/*.py (Kategorier, konstanter)
    - backend/scripts/generate_openapi.py (Generatoren selv)
"""

import argparse
import hashlib
import subprocess
import sys
from pathlib import Path


def find_project_root() -> Path:
    """Finn prosjektroten"""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    raise RuntimeError("Kunne ikke finne prosjektroten")


# Filer som påvirker openapi.yaml
SOURCE_FILES = [
    "backend/models/events.py",
    "backend/models/sak_state.py",
    "backend/constants/__init__.py",
    "backend/constants/grunnlag_categories.py",
    "backend/scripts/generate_openapi.py",
]

OPENAPI_OUTPUT = "backend/docs/openapi.yaml"


def get_file_hash(path: Path) -> str | None:
    """Beregn MD5 hash av fil"""
    if not path.exists():
        return None
    content = path.read_bytes()
    return hashlib.md5(content).hexdigest()


def get_file_mtime(path: Path) -> float | None:
    """Hent modifikasjonstid for fil"""
    if not path.exists():
        return None
    return path.stat().st_mtime


def check_freshness(root: Path) -> dict:
    """
    Sjekk om openapi.yaml er fersk.

    Returnerer dict med:
        - is_fresh: bool
        - openapi_mtime: float | None
        - newest_source: str
        - newest_source_mtime: float
        - sources_checked: list
    """
    openapi_path = root / OPENAPI_OUTPUT

    if not openapi_path.exists():
        return {
            "is_fresh": False,
            "reason": "openapi.yaml eksisterer ikke",
            "openapi_exists": False,
            "sources_checked": [],
        }

    openapi_mtime = get_file_mtime(openapi_path)

    sources_checked = []
    newest_source = None
    newest_source_mtime = 0

    for rel_path in SOURCE_FILES:
        source_path = root / rel_path
        if source_path.exists():
            mtime = get_file_mtime(source_path)
            sources_checked.append({
                "path": rel_path,
                "mtime": mtime,
                "newer_than_openapi": mtime > openapi_mtime if mtime else False,
            })
            if mtime and mtime > newest_source_mtime:
                newest_source_mtime = mtime
                newest_source = rel_path

    is_fresh = openapi_mtime >= newest_source_mtime if newest_source_mtime else True

    outdated_sources = [s["path"] for s in sources_checked if s.get("newer_than_openapi")]

    return {
        "is_fresh": is_fresh,
        "openapi_exists": True,
        "openapi_mtime": openapi_mtime,
        "newest_source": newest_source,
        "newest_source_mtime": newest_source_mtime,
        "sources_checked": sources_checked,
        "outdated_sources": outdated_sources,
        "reason": None if is_fresh else f"Kildefiler endret etter openapi.yaml: {', '.join(outdated_sources)}",
    }


def regenerate_openapi(root: Path) -> bool:
    """Kjør generate_openapi.py for å regenerere"""
    generator_path = root / "backend" / "scripts" / "generate_openapi.py"

    if not generator_path.exists():
        print(f"FEIL: Generator ikke funnet: {generator_path}")
        return False

    try:
        result = subprocess.run(
            [sys.executable, str(generator_path)],
            cwd=root / "backend",
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            print("OpenAPI spec regenerert OK")
            return True
        else:
            print(f"FEIL ved regenerering: {result.stderr}")
            return False
    except Exception as e:
        print(f"FEIL ved kjøring av generator: {e}")
        return False


def format_report(result: dict) -> str:
    """Formater rapport for terminal"""
    lines = []
    lines.append("=" * 60)
    lines.append("  OPENAPI FRESHNESS CHECK")
    lines.append("=" * 60)
    lines.append("")

    if not result.get("openapi_exists"):
        lines.append("  [KRITISK] openapi.yaml eksisterer ikke!")
        lines.append(f"            Kjør: python backend/scripts/generate_openapi.py")
    elif result["is_fresh"]:
        lines.append("  [OK] openapi.yaml er oppdatert")
    else:
        lines.append("  [ADVARSEL] openapi.yaml er utdatert!")
        lines.append("")
        lines.append("  Kildefiler endret etter openapi.yaml:")
        for source in result.get("outdated_sources", []):
            lines.append(f"    - {source}")
        lines.append("")
        lines.append("  Løsning:")
        lines.append("    python backend/scripts/generate_openapi.py")
        lines.append("  eller:")
        lines.append("    python scripts/check_openapi_freshness.py --fix")

    lines.append("")
    lines.append("=" * 60)

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Sjekker om openapi.yaml er oppdatert med kildefilene"
    )
    parser.add_argument(
        "--ci",
        action="store_true",
        help="CI-modus: Exit 1 hvis utdatert"
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Regenerer openapi.yaml hvis utdatert"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Kun vis output ved problemer"
    )

    args = parser.parse_args()

    root = find_project_root()
    result = check_freshness(root)

    if not args.quiet or not result["is_fresh"]:
        print(format_report(result))

    if not result["is_fresh"] and args.fix:
        print("\nRegenererer openapi.yaml...")
        if regenerate_openapi(root):
            print("Ferdig!")
            sys.exit(0)
        else:
            sys.exit(1)

    if args.ci and not result["is_fresh"]:
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
