#!/usr/bin/env python3
"""
Explore BIM Objects — Interaktivt skript for å browse modeller og IFC-objekter i Catenda.

Bruk:
    cd backend && python scripts/explore_bim_objects.py

Flyt:
    1. Autentiser mot Catenda
    2. Velg prosjekt
    3. Se modeller og IFC type-oppsummering
    4. Browse objekter per type
    5. Inspiser enkelt-objekt med egenskaper, mengder og materialer
"""

import json
import sys
from pathlib import Path

# Setup path
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.lib.catenda_setup import (
    create_authenticated_client,
    print_fail,
    print_header,
    print_info,
    print_ok,
    print_subheader,
    print_warn,
    select_project,
    setup_script_path,
)

setup_script_path()


def _attr_str(val) -> str:
    """Trekk ut streng fra en IFC-attributtverdi (kan være str, dict, eller annet)."""
    if isinstance(val, str):
        return val
    if isinstance(val, dict):
        return str(val.get("value", val.get("Name", val)))
    return str(val) if val is not None else "?"


def format_product_summary(product: dict) -> str:
    """Enlinjes oppsummering av et IFC-produkt."""
    attrs = product.get("attributes", {})
    name = _attr_str(attrs.get("Name", "Uten navn"))
    global_id = _attr_str(attrs.get("GlobalId", "?"))
    ifc_type = str(product.get("ifcType", "?"))
    return f"{ifc_type:25s} | {name:40s} | {global_id}"


def print_product_details(product: dict):
    """Skriv ut detaljert info om ett IFC-produkt."""
    attrs = product.get("attributes", {})

    print(f"\n{'=' * 70}")
    print(f"  {_attr_str(attrs.get('Name', 'Uten navn'))}")
    print(f"  Type: {product.get('ifcType', '?')}")
    print(f"  GlobalId: {_attr_str(attrs.get('GlobalId', '?'))}")
    print(f"  ObjectId: {product.get('objectId', '?')}")
    print(f"  Revision: {product.get('revisionId', '?')}")
    print(f"{'=' * 70}")

    # Alle IFC-attributter
    if len(attrs) > 2:
        print("\n  ATTRIBUTTER:")
        for key, val in attrs.items():
            if key not in ("Name", "GlobalId"):
                print(f"    {key}: {_attr_str(val)}")

    # Property Sets
    psets = product.get("propertySets", {})
    if psets:
        print(f"\n  EGENSKAPER ({len(psets)} property sets):")
        for pset_name, pset_data in psets.items():
            print(f"    [{pset_name}]")
            for prop_name, prop_val in pset_data.get("properties", {}).items():
                val = prop_val.get("value", "N/A")
                unit = prop_val.get("unit", "")
                suffix = f" {unit}" if unit else ""
                print(f"      {prop_name}: {val}{suffix}")

    # Quantity Sets
    qsets = product.get("quantitySets", {})
    if qsets:
        print(f"\n  MENGDER ({len(qsets)} quantity sets):")
        for qset_name, qset_data in qsets.items():
            print(f"    [{qset_name}]")
            for q_name, q_val in qset_data.get("quantities", {}).items():
                val_obj = q_val.get("value", {})
                val = val_obj.get("value", "N/A") if isinstance(val_obj, dict) else val_obj
                unit = val_obj.get("unit", "") if isinstance(val_obj, dict) else ""
                suffix = f" {unit}" if unit else ""
                print(f"      {q_name}: {val}{suffix}")

    # Materialer
    materials = product.get("materials", [])
    if materials:
        print(f"\n  MATERIALER ({len(materials)}):")
        for mat in materials:
            mat_attrs = mat.get("attributes", {})
            print(f"    - {mat_attrs.get('Name', json.dumps(mat_attrs, ensure_ascii=False))}")


def browse_by_type(client, project_id: str, model_id: str | None = None):
    """Browse objekter filtrert på IFC-type."""
    print_subheader("IFC Type-oppsummering")

    type_summary = client.get_ifc_type_summary(project_id, model_id=model_id)
    if not type_summary:
        print_fail("Ingen IFC-typer funnet")
        return

    # Sorter etter antall (synkende)
    sorted_types = sorted(type_summary.items(), key=lambda x: int(x[1]), reverse=True)

    print(f"  {'#':>4}  {'IFC-type':30s}  {'Antall':>8}")
    print(f"  {'─' * 4}  {'─' * 30}  {'─' * 8}")
    for i, (ifc_type, count) in enumerate(sorted_types, 1):
        print(f"  {i:>4}  {ifc_type:30s}  {count:>8}")

    print(f"\n  Totalt: {sum(int(c) for c in type_summary.values())} objekter i {len(sorted_types)} typer")

    # Velg type å utforske
    while True:
        try:
            choice = input("\nVelg typenr for å browse (0 = tilbake): ").strip()
            if choice == "0" or not choice:
                return

            idx = int(choice) - 1
            if 0 <= idx < len(sorted_types):
                selected_type = sorted_types[idx][0]
                browse_products(client, project_id, selected_type, model_id)
            else:
                print_warn(f"Velg mellom 1 og {len(sorted_types)}")
        except ValueError:
            print_warn("Oppgi et tall")
        except KeyboardInterrupt:
            print()
            return


def browse_products(
    client, project_id: str, ifc_type: str, model_id: str | None = None
):
    """Browse og inspiser objekter av en gitt IFC-type."""
    PAGE_SIZE = 20
    page = 1  # Catenda API is 1-indexed

    while True:
        print_subheader(f"{ifc_type} — side {page}")

        products = client.list_ifc_products(
            project_id,
            model_id=model_id,
            ifc_type=ifc_type,
            page=page,
            page_size=PAGE_SIZE,
        )

        if not products:
            print_info("Ingen flere objekter.")
            if page > 1:
                print_info("(Siste side nådd)")
            input("\nTrykk Enter for å gå tilbake...")
            return

        # Vis liste
        print(f"  {'#':>4}  {'Type':25s} | {'Navn':40s} | GlobalId")
        print(f"  {'─' * 4}  {'─' * 25}─┼─{'─' * 40}─┼─{'─' * 36}")
        for i, product in enumerate(products, 1):
            print(f"  {i:>4}  {format_product_summary(product)}")

        print(f"\n  Viser {len(products)} objekter (side {page})")
        print("  [nummer] = inspiser objekt | [n] = neste side | [p] = forrige | [0] = tilbake")

        choice = input("\n> ").strip().lower()

        if choice == "0" or not choice:
            return
        elif choice == "n":
            page += 1
        elif choice == "p":
            page = max(1, page - 1)
        else:
            try:
                idx = int(choice) - 1
                if 0 <= idx < len(products):
                    inspect_product(client, project_id, products[idx])
                else:
                    print_warn(f"Velg mellom 1 og {len(products)}")
            except ValueError:
                print_warn("Ugyldig valg")


RELATION_LABELS = {
    "parent": "Overordnet",
    "children": "I samme rom/etasje",
    "type": "Samme type",
    "systems": "Samme system",
    "zones": "Samme sone",
    "groups": "Grupper",
}


def show_relations(client, project_id: str, object_id):
    """Hent og vis relasjoner for et IFC-objekt."""
    print_subheader(f"Relasjoner for objectId {object_id}")

    relations = client.get_ifc_product_relations(project_id, object_id)
    if not relations:
        print_warn("Ingen relasjoner funnet (tomt svar fra API)")
        return

    total = 0
    for category, label in RELATION_LABELS.items():
        raw = relations.get(category)
        if raw is None:
            continue
        # Normalise: single dict → list of one
        items = [raw] if isinstance(raw, dict) else raw if isinstance(raw, list) else []
        if not items:
            continue

        print(f"\n  {label} ({len(items)}):")
        print(f"  {'─' * 60}")
        for item in items[:20]:
            obj_id = item.get("objectId") or item.get("object_id", "?")
            name = item.get("name", "Uten navn")
            ifc_type = item.get("ifcType", "?")
            global_id = item.get("globalId", "")
            gid_str = f" [{global_id[:12]}...]" if global_id else ""
            print(f"    {ifc_type:25s} | {name:30s} | id:{obj_id}{gid_str}")
            total += 1
        if len(items) > 20:
            print(f"    ... og {len(items) - 20} til")
            total += len(items) - 20

    if total == 0:
        print_info("  Ingen relaterte objekter i noen kategori")
    else:
        print_ok(f"\n  Totalt {total} relaterte objekter")

    # Vis rå JSON
    show_raw = input("\n  Vis rå JSON? [j/N]: ").strip().lower()
    if show_raw in ("j", "ja", "y"):
        print(json.dumps(relations, indent=2, ensure_ascii=False))


def inspect_product(client, project_id: str, product_summary: dict):
    """Hent og vis full detaljer for et produkt via GET /ifc/products/{objectId}."""
    object_id = product_summary.get("objectId")
    global_id = _attr_str(product_summary.get("attributes", {}).get("GlobalId", "?"))

    if not object_id:
        print_fail("Objektet mangler objectId")
        input("\nTrykk Enter...")
        return

    print_info(f"Henter detaljer for {global_id} (objectId: {object_id})...")
    full_product = client.get_ifc_product(project_id, object_id)

    if full_product:
        print_product_details(full_product)

        # Tilby videre utforskning
        while True:
            print("\n  [r] Vis relasjoner | [j] Vis rå JSON | [Enter] Tilbake")
            choice = input("  > ").strip().lower()
            if choice in ("r", "rel"):
                show_relations(client, project_id, object_id)
            elif choice in ("j", "ja", "json"):
                print(json.dumps(full_product, indent=2, ensure_ascii=False))
            else:
                break
    else:
        # Fallback: vis det vi allerede har
        print_warn("Kunne ikke hente fulle detaljer, viser oppsummering:")
        print_product_details(product_summary)
        input("\nTrykk Enter for å gå tilbake...")


def main():
    print_header("BIM Object Explorer — Catenda Model API")

    # 1. Autentiser
    client = create_authenticated_client()
    if not client:
        sys.exit(1)

    # 2. Velg prosjekt
    project_id = select_project(client)
    if not project_id:
        print_fail("Inget prosjekt valgt")
        sys.exit(1)

    # 3. Vis modeller
    print_subheader("Modeller i prosjektet")
    models = client.list_models(project_id)

    if not models:
        print_fail("Fant ingen modeller i prosjektet")
        sys.exit(1)

    print_ok(f"Fant {len(models)} modell(er):")
    for i, model in enumerate(models, 1):
        print(f"  {i}. {model.get('name', '?')} (id: {model.get('id', '?')})")

    # Velg modell eller se alle
    selected_model_id = None
    if len(models) > 1:
        print(f"\n  0 = Alle modeller")
        try:
            choice = input(f"\nVelg modell (0-{len(models)}): ").strip()
            if choice and choice != "0":
                idx = int(choice) - 1
                if 0 <= idx < len(models):
                    selected_model_id = models[idx].get("id")
                    print_ok(f"Filtrerer på: {models[idx].get('name')}")
        except (ValueError, KeyboardInterrupt):
            pass

    # 4. Hovedloop
    while True:
        print_subheader("BIM Explorer — Hovedmeny")
        filter_text = f" (modell: {selected_model_id[:12]}...)" if selected_model_id else " (alle modeller)"
        print(f"  Prosjekt: {project_id[:12]}...{filter_text}\n")
        print("  1. Browse objekter per IFC-type")
        print("  2. Sok objekt pa GlobalId")
        print("  3. Vis type-oppsummering (statistikk)")
        print("  4. Vis modeller og revisjoner")
        print("  0. Avslutt")

        try:
            choice = input("\nVelg (0-4): ").strip()
        except KeyboardInterrupt:
            print("\n\nHa det!")
            break

        if choice == "1":
            browse_by_type(client, project_id, selected_model_id)
        elif choice == "2":
            guid = input("GlobalId: ").strip()
            if guid:
                print_info(f"Soker etter {guid}...")
                product = client.get_product_details_by_guid(project_id, guid)
                if product:
                    print_product_details(product)
                else:
                    print_fail(f"Fant ikke objekt med GlobalId {guid}")
                input("\nTrykk Enter...")
        elif choice == "3":
            browse_by_type(client, project_id, selected_model_id)
        elif choice == "4":
            print_subheader("Modeller og revisjoner")
            for model in models:
                mid = model.get("id", "?")
                print(f"\n  {model.get('name', '?')} ({mid})")
                revisions = client.list_revisions(project_id, model_id=mid)
                if revisions:
                    for rev in revisions[:5]:
                        print(f"    - {rev.get('comment', '?')} ({rev.get('id', '?')[:12]}...)")
                    if len(revisions) > 5:
                        print(f"    ... og {len(revisions) - 5} til")
                else:
                    print("    (ingen revisjoner)")
            input("\nTrykk Enter...")
        elif choice == "0":
            print("\nHa det!")
            break


if __name__ == "__main__":
    main()
