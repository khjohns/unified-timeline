#!/usr/bin/env python3
"""
Test: Hent all data for en Dalux-sak

Viser hva som er tilgjengelig fra Dalux API for en enkelt sak:
- Grunndata (tittel, type, status, etc.)
- Lokasjon og koordinater
- Egendefinerte felt
- Vedlegg

Bruk: python scripts/test_task_data.py [task_id]
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from integrations.dalux.client import DaluxClient


def main():
    project_id = os.getenv("DALUX_PROJECT_ID", "6070718657")

    # Task ID fra kommandolinje eller default
    task_id = sys.argv[1] if len(sys.argv) > 1 else None

    client = DaluxClient(
        api_key=os.getenv('DALUX_API_KEY'),
        base_url=os.getenv('DALUX_BASE_URL')
    )

    print("=" * 70)
    print("DALUX SAKSDATA - KOMPLETT OVERSIKT")
    print("=" * 70)

    # Hvis ingen task_id, list noen saker først
    if not task_id:
        print("\nHenter saker fra prosjektet...")
        tasks = client.get_tasks(project_id, limit=20)

        print(f"\nFant {len(tasks)} saker. Velger en med data:\n")
        print(f"{'Task ID':<22} {'Type':<15} {'Nummer':<10} {'Tittel':<30}")
        print("-" * 77)

        for t in tasks[:10]:
            data = t.get('data', {})
            tid = data.get('taskId', '?')
            ttype = data.get('type', {}).get('name', '?')[:14]
            number = data.get('number', '?')[:9]
            subject = data.get('subject', 'Ingen tittel')[:29]
            print(f"{tid:<22} {ttype:<15} {number:<10} {subject:<30}")

        # Velg første sak
        task_id = tasks[0].get('data', {}).get('taskId')
        print(f"\n→ Bruker task: {task_id}")

    # =========================================================================
    # HENT SAKSDETALJER
    # =========================================================================
    print("\n" + "=" * 70)
    print(f"SAKSDETALJER: {task_id}")
    print("=" * 70)

    task = client.get_task(project_id, task_id)

    if not task:
        print("❌ Kunne ikke hente sak")
        return

    data = task.get('data', {})

    # Grunndata
    print("\n📋 GRUNNDATA")
    print("-" * 40)
    print(f"  Task ID:     {data.get('taskId')}")
    print(f"  Nummer:      {data.get('number', 'N/A')}")
    print(f"  Tittel:      {data.get('subject', 'N/A')}")
    print(f"  Type:        {data.get('type', {}).get('name', 'N/A')}")
    print(f"  Bruk:        {data.get('usage', 'N/A')}")
    print(f"  Workflow:    {data.get('workflow', {}).get('name', 'N/A')}")
    print(f"  Opprettet:   {data.get('created', 'N/A')[:19]}")

    created_by = data.get('createdBy', {})
    print(f"  Opprettet av: {created_by.get('userId', 'N/A')}")

    # Tilordning
    assigned = data.get('assignedTo', {})
    if assigned:
        print(f"  Tilordnet:   {assigned.get('email', assigned.get('userId', 'N/A'))}")

    # Status/deadline
    if data.get('deadline'):
        print(f"  Frist:       {data.get('deadline')[:10]}")

    # Lokasjon
    location = data.get('location', {})
    if location:
        print("\n📍 LOKASJON")
        print("-" * 40)

        if location.get('building'):
            print(f"  Bygning:     {location['building'].get('name', 'N/A')}")
        if location.get('level'):
            print(f"  Etasje:      {location['level'].get('name', 'N/A')}")
        if location.get('room'):
            print(f"  Rom:         {location['room'].get('name', 'N/A')}")

        coord = location.get('coordinate', {}).get('xyz', {})
        if coord:
            print(f"  Koordinater: X={coord.get('x', 0):.2f}, Y={coord.get('y', 0):.2f}, Z={coord.get('z', 0):.2f}")

        # BIM-objekt
        bim = location.get('bimObject', {})
        if bim:
            print(f"  BIM-objekt:  {bim.get('categoryName', '')}/{bim.get('name', 'N/A')}")

        # Tegning
        drawing = location.get('drawing', {})
        if drawing:
            print(f"  Tegning:     {drawing.get('name', 'N/A')}")

        # Lokasjonsbilder
        loc_images = location.get('locationImages', [])
        if loc_images:
            print(f"  Bilder:      {len(loc_images)} stk")
            for img in loc_images:
                print(f"               - {img.get('name', 'N/A')}")

    # Egendefinerte felt
    udf = data.get('userDefinedFields', {}).get('items', [])
    if udf:
        print(f"\n📝 EGENDEFINERTE FELT ({len(udf)} stk)")
        print("-" * 40)

        for field in udf:
            name = field.get('name', 'Ukjent')
            values = field.get('values', [])

            # Hent verdi(er)
            value_strs = []
            for v in values:
                if v.get('text'):
                    value_strs.append(v['text'])
                elif v.get('reference'):
                    value_strs.append(v['reference'].get('value', '?'))
                elif v.get('date'):
                    value_strs.append(v['date'][:10])

            value_str = ', '.join(value_strs) if value_strs else '(tom)'
            print(f"  {name[:35]:<35} = {value_str[:30]}")

    # =========================================================================
    # HENT VEDLEGG FOR DENNE SAKEN
    # =========================================================================
    print("\n" + "=" * 70)
    print("VEDLEGG")
    print("=" * 70)

    all_attachments = client.get_task_attachments(project_id)
    task_attachments = [a for a in all_attachments if a.get('taskId') == task_id]

    if task_attachments:
        print(f"\n📎 VEDLEGG ({len(task_attachments)} stk)")
        print("-" * 40)

        for att in task_attachments:
            media = att.get('mediaFile', {})
            name = media.get('name', 'Ukjent')
            created = att.get('created', '')[:19]
            print(f"  {name}")
            print(f"     Opprettet: {created}")
    else:
        print("\n  Ingen vedlegg på denne saken")

    # Sjekk lokasjonsbilder (disse er også "vedlegg")
    loc_images = data.get('location', {}).get('locationImages', [])
    if loc_images:
        print(f"\n🖼️  LOKASJONSBILDER ({len(loc_images)} stk)")
        print("-" * 40)
        for img in loc_images:
            print(f"  {img.get('name', 'N/A')}")

    # =========================================================================
    # ENDRINGER (task changes API)
    # =========================================================================
    print("\n" + "=" * 70)
    print("ENDRINGER (siste 30 dager)")
    print("=" * 70)

    since = datetime.now() - timedelta(days=30)
    try:
        changes = client.get_task_changes(project_id, since)
        task_changes = [c for c in changes if c.get('data', {}).get('taskId') == task_id]

        if task_changes:
            print(f"\n📊 ENDRINGER ({len(task_changes)} stk)")
            print("-" * 40)

            for change in task_changes[:10]:
                cdata = change.get('data', {})
                change_type = cdata.get('changeType', 'N/A')
                changed = cdata.get('changed', '')[:19]
                print(f"  [{changed}] {change_type}")
        else:
            print("\n  Ingen endringer siste 30 dager")
    except Exception as e:
        print(f"\n  Kunne ikke hente endringer: {e}")

    # =========================================================================
    # OPPSUMMERING
    # =========================================================================
    print("\n" + "=" * 70)
    print("OPPSUMMERING - TILGJENGELIG DATA")
    print("=" * 70)
    print("""
  ✅ Grunndata (ID, nummer, tittel, type, workflow)
  ✅ Lokasjon (bygning, etasje, rom, koordinater)
  ✅ BIM-objekt (kategori, navn - men IKKE IFC GUID)
  ✅ Egendefinerte felt (alle verdier)
  ✅ Endringer (via task changes API)

  ⚠️ Vedlegg (liste OK, nedlasting gir 403)
  ⚠️ Lokasjonsbilder (liste OK, nedlasting gir 403)
  ✅ File Areas (filer KAN lastes ned via denne API-en)

  ❌ Kommentarer (ikke tilgjengelig i API)
  ❌ Historikk/audit log (ikke tilgjengelig i API)
  ❌ Viewpoints/BCF (ikke tilgjengelig)
""")


if __name__ == "__main__":
    main()
