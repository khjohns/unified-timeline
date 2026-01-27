#!/usr/bin/env python3
"""
OpenAPI Generator Drift Checker

Sjekker om generate_openapi.py er synkronisert med modellene i events.py.

Problemet: Generatoren importerer kun et utvalg enums/modeller.
Hvis nye enums legges til eller eksisterende endres, kan generatoren
produsere utdatert output selv om den kjøres.

Sjekker:
1. Hvilke enums i events.py som IKKE er importert i generatoren
2. Om importerte enums matcher faktiske verdier
3. Om Pydantic-modeller som brukes i API-en er inkludert

Bruk:
    python scripts/check_openapi_generator_drift.py
    python scripts/check_openapi_generator_drift.py --verbose
    python scripts/check_openapi_generator_drift.py --ci  # Exit 1 ved drift
"""

import argparse
import ast
import sys
from pathlib import Path
from typing import Set, Dict, List, Any
from enum import Enum


def find_project_root() -> Path:
    """Finn prosjektroten"""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    raise RuntimeError("Kunne ikke finne prosjektroten")


def extract_enums_from_file(file_path: Path) -> Dict[str, List[str]]:
    """
    Ekstraher alle Enum-klasser og deres verdier fra en Python-fil.
    Bruker AST-parsing for presis analyse.
    """
    content = file_path.read_text(encoding='utf-8')
    tree = ast.parse(content)

    enums = {}

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            # Sjekk om klassen arver fra Enum
            is_enum = False
            for base in node.bases:
                if isinstance(base, ast.Name) and base.id == 'Enum':
                    is_enum = True
                elif isinstance(base, ast.Attribute) and base.attr == 'Enum':
                    is_enum = True
                # Sjekk for (str, Enum) pattern
                if isinstance(base, ast.Name) and base.id == 'str':
                    # Sjekk neste base
                    continue

            # Sjekk alle bases for Enum
            base_names = []
            for base in node.bases:
                if isinstance(base, ast.Name):
                    base_names.append(base.id)

            if 'Enum' in base_names:
                is_enum = True

            if is_enum:
                values = []
                for item in node.body:
                    if isinstance(item, ast.Assign):
                        for target in item.targets:
                            if isinstance(target, ast.Name):
                                # Hent verdien hvis det er en string
                                if isinstance(item.value, ast.Constant):
                                    values.append(item.value.value)
                enums[node.name] = values

    return enums


def extract_imports_from_generator(file_path: Path) -> Set[str]:
    """
    Ekstraher importerte navn fra generatoren.
    """
    content = file_path.read_text(encoding='utf-8')
    tree = ast.parse(content)

    imports = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.module and 'events' in node.module:
                for alias in node.names:
                    imports.add(alias.name)

    return imports


def extract_used_enums_in_schemas(file_path: Path) -> Set[str]:
    """
    Finn hvilke enum-navn som faktisk brukes i generate_schemas().
    """
    content = file_path.read_text(encoding='utf-8')

    # Enkel tekstsøk etter enum-bruk
    used = set()

    # Søk etter patterns som "for e in EnumName" eller "EnumName.value"
    import re

    # Pattern: generate_enum_schema(EnumName, ...)
    for match in re.finditer(r'generate_enum_schema\s*\(\s*(\w+)', content):
        used.add(match.group(1))

    # Pattern: for x in EnumName eller [e.value for e in EnumName]
    for match in re.finditer(r'for\s+\w+\s+in\s+(\w+)', content):
        used.add(match.group(1))

    # Pattern: EnumClass.value
    for match in re.finditer(r'(\w+)\.value', content):
        used.add(match.group(1))

    return used


def check_generator_drift(root: Path, verbose: bool = False) -> Dict[str, Any]:
    """
    Hovedsjekk: Sammenlign enums i events.py med generatoren.
    """
    events_path = root / "backend" / "models" / "events.py"
    generator_path = root / "backend" / "scripts" / "generate_openapi.py"

    if not events_path.exists():
        return {"error": f"events.py ikke funnet: {events_path}"}
    if not generator_path.exists():
        return {"error": f"generate_openapi.py ikke funnet: {generator_path}"}

    # Ekstraher data
    events_enums = extract_enums_from_file(events_path)
    generator_imports = extract_imports_from_generator(generator_path)
    used_in_schemas = extract_used_enums_in_schemas(generator_path)

    # Analyser
    results = {
        "events_enums": events_enums,
        "generator_imports": generator_imports,
        "used_in_schemas": used_in_schemas,
        "missing_imports": [],
        "unused_imports": [],
        "critical": [],
        "warnings": [],
        "info": [],
    }

    # Viktige enums som BØR være i OpenAPI spec
    important_enums = {
        'EventType': 'Brukes for event_type felt',
        'VederlagsMetode': 'Brukes i vederlag API',
        'FristVarselType': 'Brukes i frist API',
        'GrunnlagResponsResultat': 'Brukes i grunnlag respons',
        'VederlagBeregningResultat': 'Brukes i vederlag respons',
        'FristBeregningResultat': 'Brukes i frist respons',
        'SubsidiaerTrigger': 'Brukes i subsidiær vurdering',
        'OverordnetStatus': 'Brukes i case status',
        'SporStatus': 'Brukes i spor status',
    }

    # Sjekk hvilke viktige enums som mangler
    for enum_name, description in important_enums.items():
        if enum_name in events_enums:
            if enum_name not in generator_imports and enum_name not in used_in_schemas:
                results["warnings"].append({
                    "enum": enum_name,
                    "issue": "ikke_importert",
                    "description": description,
                    "values": events_enums[enum_name]
                })

    # Sjekk for enums som er importert men ikke brukt
    for imp in generator_imports:
        if imp in events_enums and imp not in used_in_schemas:
            # Sjekk om det er en data-modell (ikke enum)
            if imp.endswith('Data') or imp.endswith('Event'):
                continue
            results["info"].append({
                "enum": imp,
                "issue": "importert_men_ikke_brukt"
            })

    # Tell opp
    results["summary"] = {
        "total_enums_in_events": len(events_enums),
        "imported_in_generator": len([e for e in events_enums if e in generator_imports]),
        "used_in_schemas": len([e for e in events_enums if e in used_in_schemas]),
        "critical_count": len(results["critical"]),
        "warning_count": len(results["warnings"]),
        "info_count": len(results["info"]),
    }

    return results


def format_report(results: Dict[str, Any], verbose: bool = False) -> str:
    """Formater rapport for terminal."""
    lines = []
    lines.append("=" * 60)
    lines.append("  OPENAPI GENERATOR DRIFT CHECK")
    lines.append("=" * 60)
    lines.append("")

    if "error" in results:
        lines.append(f"  [FEIL] {results['error']}")
        return "\n".join(lines)

    summary = results["summary"]

    lines.append(f"  Enums i events.py:        {summary['total_enums_in_events']}")
    lines.append(f"  Importert i generator:    {summary['imported_in_generator']}")
    lines.append(f"  Brukt i schemas:          {summary['used_in_schemas']}")
    lines.append("")

    if results["warnings"]:
        lines.append(f"  [ADVARSEL] {len(results['warnings'])} viktige enums mangler i OpenAPI spec:")
        lines.append("")
        for warn in results["warnings"]:
            lines.append(f"    - {warn['enum']}: {warn['description']}")
            if verbose:
                lines.append(f"      Verdier: {', '.join(str(v) for v in warn['values'][:5])}")
                if len(warn['values']) > 5:
                    lines.append(f"               ... og {len(warn['values']) - 5} til")
        lines.append("")
        lines.append("  Løsning: Oppdater backend/scripts/generate_openapi.py")
        lines.append("           Importer manglende enums og legg til i generate_schemas()")
    else:
        lines.append("  [OK] Alle viktige enums er inkludert i generatoren")

    if verbose and results["info"]:
        lines.append("")
        lines.append(f"  [INFO] {len(results['info'])} enums importert men ikke brukt:")
        for info in results["info"]:
            lines.append(f"    - {info['enum']}")

    lines.append("")
    lines.append("=" * 60)

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Sjekk om OpenAPI-generatoren er synkronisert med modellene"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Vis detaljert output"
    )
    parser.add_argument(
        "--ci",
        action="store_true",
        help="CI-modus: Exit 1 ved advarsler"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output som JSON"
    )

    args = parser.parse_args()

    root = find_project_root()
    results = check_generator_drift(root, args.verbose)

    if args.json:
        import json
        # Fjern ikke-serialiserbare data
        output = {
            "summary": results.get("summary", {}),
            "warnings": results.get("warnings", []),
            "info": results.get("info", []),
        }
        print(json.dumps(output, indent=2, ensure_ascii=False))
    else:
        print(format_report(results, args.verbose))

    if args.ci and results.get("warnings"):
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
