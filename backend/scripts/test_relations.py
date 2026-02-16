#!/usr/bin/env python3
"""
Quick test: get_ifc_product_relations()

Connects to Catenda, picks the first IFC product it finds, and calls
the relations endpoint. Non-interactive — prints results and exits.

Usage:
    cd backend && python scripts/test_relations.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.lib.catenda_setup import (
    create_authenticated_client,
    print_fail,
    print_header,
    print_info,
    print_ok,
    print_subheader,
    print_warn,
    setup_script_path,
)

setup_script_path()

RELATION_LABELS = {
    "parent": "Overordnet",
    "children": "I samme rom/etasje",
    "type": "Samme type",
    "systems": "Samme system",
    "zones": "Samme sone",
    "groups": "Grupper",
}


def main():
    print_header("Test: get_ifc_product_relations()")

    # 1. Authenticate
    client = create_authenticated_client()
    if not client:
        sys.exit(1)

    # 2. Get project ID from settings
    from core.config import settings

    project_id = settings.catenda_project_id
    if not project_id:
        print_fail("CATENDA_PROJECT_ID not set in .env")
        sys.exit(1)

    print_ok(f"Project: {project_id}")

    # 3. Get a sample IFC product to test with
    # Try IfcBuildingStorey first (has children), then IfcWall, then anything
    for try_type in ["IfcWall", "IfcBuildingStorey", "IfcSpace", None]:
        label = try_type or "alle typer"
        print_info(f"Prøver {label}...")
        products = client.list_ifc_products(
            project_id, ifc_type=try_type, page=1, page_size=5
        )
        if products:
            break
    if not products:
        print_fail("Ingen IFC-produkter funnet i prosjektet")
        sys.exit(1)

    # Pick a product — prefer one with a real name (not first which may be a dummy)
    product = next(
        (p for p in products if p.get("attributes", {}).get("Name") and "default" not in str(p.get("attributes", {}).get("Name", "")).lower()),
        products[0],
    )
    object_id = product.get("objectId")
    attrs = product.get("attributes", {})
    name = attrs.get("Name", "Ukjent")
    ifc_type = product.get("ifcType", "?")

    print_ok(f"Tester med: {name} ({ifc_type}, objectId={object_id})")

    # 4. Call get_ifc_product_relations
    print_subheader("Kaller get_ifc_product_relations()")
    relations = client.get_ifc_product_relations(project_id, object_id)

    if not relations:
        print_warn("Tomt svar — endepunktet returnerte ingenting")
        print_info("Dette kan bety at endepunktet ikke eksisterer i denne Catenda-versjonen")
        sys.exit(0)

    # 5. Show results
    print_ok(f"Svar mottatt! Nøkler: {list(relations.keys())}")

    total = 0
    for category, label in RELATION_LABELS.items():
        raw = relations.get(category)
        if raw is None:
            continue
        # Normalise: single dict → list of one (matches backend logic)
        items = [raw] if isinstance(raw, dict) else raw if isinstance(raw, list) else []
        if not items:
            continue

        print(f"\n  {label} ({len(items)}):")
        for item in items[:5]:
            obj_id = item.get("objectId") or item.get("object_id", "?")
            item_name = item.get("name", "?")
            item_type = item.get("ifcType", "?")
            print(f"    {item_type:25s} | {item_name:30s} | id:{obj_id}")
            total += 1
        if len(items) > 5:
            print(f"    ... og {len(items) - 5} til")
            total += len(items) - 5

    # Also check for unexpected keys (API might use different names)
    unknown_keys = set(relations.keys()) - set(RELATION_LABELS.keys())
    if unknown_keys:
        print_warn(f"\n  Ukjente nøkler i respons: {unknown_keys}")
        for key in unknown_keys:
            val = relations[key]
            if isinstance(val, list):
                print(f"    {key}: {len(val)} elementer")
                if val:
                    print(f"      Første: {json.dumps(val[0], indent=2, ensure_ascii=False)}")
            else:
                print(f"    {key}: {val}")

    print_ok(f"\nTotalt {total} relaterte objekter funnet")

    # 6. Raw JSON for inspection
    print_subheader("Rå JSON-respons")
    print(json.dumps(relations, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
