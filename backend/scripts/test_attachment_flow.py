#!/usr/bin/env python3
"""
Test: Vedleggsflyt Dalux → Catenda

Tester den komplette flyten:
1. Hent filer fra Dalux (via File Areas API)
2. Last ned filen
3. Last opp til Catenda bibliotek
4. Knytt til Catenda topic via document_reference

NB: Task attachments har 403-problem. File Areas fungerer.

Bruk: python scripts/test_attachment_flow.py
"""

import os
import sys
import tempfile
from pathlib import Path

# Legg til backend i path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()

from integrations.catenda import CatendaClient
from integrations.dalux.client import DaluxClient


def main():
    print("=" * 70)
    print("TEST: Vedleggsflyt Dalux → Catenda")
    print("=" * 70)

    # Hent config fra env
    dalux_api_key = os.getenv("DALUX_API_KEY")
    dalux_base_url = os.getenv("DALUX_BASE_URL")
    dalux_project_id = os.getenv("DALUX_PROJECT_ID", "6070718657")

    catenda_client_id = os.getenv("CATENDA_CLIENT_ID")
    catenda_access_token = os.getenv("CATENDA_ACCESS_TOKEN")
    catenda_project_id = os.getenv("CATENDA_PROJECT_ID")
    catenda_library_id = os.getenv("CATENDA_LIBRARY_ID")
    catenda_folder_id = os.getenv("CATENDA_FOLDER_ID")
    catenda_board_id = os.getenv("CATENDA_TOPIC_BOARD_ID")

    if not dalux_api_key or not dalux_base_url:
        print("❌ DALUX_API_KEY og DALUX_BASE_URL må settes i .env")
        return

    if not catenda_client_id or not catenda_access_token:
        print("❌ CATENDA_CLIENT_ID og CATENDA_ACCESS_TOKEN må settes i .env")
        return

    if not catenda_project_id:
        print("❌ CATENDA_PROJECT_ID mangler i .env")
        return

    print("\n📋 Konfigurasjon:")
    print(f"   Dalux prosjekt:  {dalux_project_id}")
    print(f"   Catenda prosjekt: {catenda_project_id}")
    print(f"   Catenda mappe:    {catenda_folder_id or 'Rot'}")
    print(f"   Catenda board:    {catenda_board_id}")

    # Initialiser klienter
    dalux = DaluxClient(api_key=dalux_api_key, base_url=dalux_base_url)
    catenda = CatendaClient(client_id=catenda_client_id)

    # Sett access token via set_access_token() som håndterer token_expiry
    catenda.set_access_token(catenda_access_token)

    # Sett Catenda-config
    if catenda_library_id:
        catenda.library_id = catenda_library_id
    if catenda_board_id:
        catenda.topic_board_id = catenda_board_id

    # =========================================================================
    # STEG 1: Hent file areas og filer fra Dalux
    # =========================================================================
    print("\n" + "=" * 70)
    print("STEG 1: Henter filer fra Dalux File Areas")
    print("=" * 70)

    try:
        file_areas = dalux.get_file_areas(dalux_project_id)
    except Exception as e:
        print(f"❌ Kunne ikke hente file areas: {e}")
        return

    if not file_areas:
        print("⚠️ Ingen file areas funnet i Dalux-prosjektet")
        return

    # Bruk første file area
    file_area = file_areas[0]
    file_area_id = file_area.get("data", {}).get("fileAreaId")
    file_area_name = file_area.get("data", {}).get("fileAreaName")
    print(f"✅ Bruker file area: {file_area_name} ({file_area_id})")

    try:
        files = dalux.get_files(dalux_project_id, file_area_id)
    except Exception as e:
        print(f"❌ Kunne ikke hente filer: {e}")
        return

    if not files:
        print("⚠️ Ingen filer funnet i file area")
        return

    # Vis første 3 filer
    print(f"\nFant {len(files)} filer. Viser første 3:")
    for i, f in enumerate(files[:3]):
        data = f.get("data", {})
        name = data.get("fileName", "ukjent")
        size = data.get("fileSize", 0)
        print(f"   {i + 1}. {name} ({size:,} bytes)")

    # Velg første fil for test
    test_file = files[0].get("data", {})
    file_id = test_file.get("fileId")
    file_rev_id = test_file.get("fileRevisionId")
    file_name = test_file.get("fileName", "test_file")
    file_size = test_file.get("fileSize", 0)

    print("\n📎 Valgt fil for test:")
    print(f"   File ID:    {file_id}")
    print(f"   Filnavn:    {file_name}")
    print(f"   Størrelse:  {file_size:,} bytes")

    # =========================================================================
    # STEG 2: Last ned fil
    # =========================================================================
    print("\n" + "=" * 70)
    print("STEG 2: Laster ned fil fra Dalux")
    print("=" * 70)

    try:
        file_content = dalux.download_file(
            dalux_project_id, file_area_id, file_id, file_rev_id
        )
    except Exception as e:
        print(f"❌ Kunne ikke laste ned: {e}")
        return

    print(f"✅ Lastet ned {len(file_content):,} bytes")

    # Lagre til midlertidig fil
    suffix = Path(file_name).suffix or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_content)
        tmp_path = tmp.name

    print(f"   Lagret til: {tmp_path}")

    # =========================================================================
    # STEG 3: Last opp til Catenda bibliotek
    # =========================================================================
    print("\n" + "=" * 70)
    print("STEG 3: Laster opp til Catenda bibliotek")
    print("=" * 70)

    try:
        upload_result = catenda.upload_document(
            project_id=catenda_project_id,
            file_path=tmp_path,
            document_name=f"Dalux_{file_name}",
            folder_id=catenda_folder_id,
        )
    except Exception as e:
        print(f"❌ Opplasting feilet: {e}")
        os.unlink(tmp_path)
        return
    finally:
        # Slett midlertidig fil
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    if not upload_result:
        print("❌ Opplasting returnerte None")
        return

    document_id = upload_result.get("id")
    print("✅ Dokument lastet opp!")
    print(f"   Document ID: {document_id}")
    print(f"   Navn:        {upload_result.get('name', 'N/A')}")

    # =========================================================================
    # STEG 4: Knytt til Catenda topic (hvis board er konfigurert)
    # =========================================================================
    if not catenda_board_id:
        print("\n" + "=" * 70)
        print("STEG 4: HOPPET OVER (ingen topic board konfigurert)")
        print("=" * 70)
        print("   For å teste document_reference: Sett CATENDA_TOPIC_BOARD_ID i .env")
    else:
        print("\n" + "=" * 70)
        print("STEG 4: Knytter dokument til topic")
        print("=" * 70)

        # Hent en eksisterende topic for test
        topics = catenda.list_topics()
        if not topics:
            print("⚠️ Ingen topics funnet - hopper over document_reference test")
        else:
            test_topic = topics[0]
            topic_guid = test_topic.get("guid")
            topic_title = test_topic.get("title", "Ukjent")

            print(f"   Knytter til topic: {topic_title}")
            print(f"   Topic GUID: {topic_guid}")

            try:
                # Prøv først med kompakt GUID
                doc_ref = catenda.create_document_reference(
                    topic_id=topic_guid,
                    document_guid=document_id,
                    description=f"Fra Dalux: {file_name}",
                )

                # Hvis kompakt feilet, prøv med formatert UUID
                if not doc_ref and len(document_id) == 32:
                    formatted_uuid = (
                        f"{document_id[0:8]}-"
                        f"{document_id[8:12]}-"
                        f"{document_id[12:16]}-"
                        f"{document_id[16:20]}-"
                        f"{document_id[20:32]}"
                    )
                    print(f"   Prøver formatert UUID: {formatted_uuid}")
                    doc_ref = catenda.create_document_reference(
                        topic_id=topic_guid,
                        document_guid=formatted_uuid,
                        description=f"Fra Dalux: {file_name}",
                    )

                if doc_ref:
                    print("✅ Document reference opprettet!")
                    print(f"   Reference GUID: {doc_ref.get('guid')}")
                else:
                    print("⚠️ Document reference feilet (begge UUID-format)")
            except Exception as e:
                print(f"⚠️ Document reference feilet: {e}")

    # =========================================================================
    # OPPSUMMERING
    # =========================================================================
    print("\n" + "=" * 70)
    print("OPPSUMMERING")
    print("=" * 70)
    print("✅ Steg 1: Hent filer fra Dalux        - OK")
    print("✅ Steg 2: Last ned fil                - OK")
    print("✅ Steg 3: Last opp til Catenda        - OK")
    print("ℹ️  Steg 4: Knytt til topic            - Se output over")
    print()
    print("🎉 Vedleggsflyten fungerer!")
    print()
    print("⚠️  MERK: Task attachments (via tasks/attachments API) gir 403.")
    print("   File Areas API fungerer for fil-synkronisering.")


if __name__ == "__main__":
    main()
