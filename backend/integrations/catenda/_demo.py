"""
Catenda API Demo/Test Script
============================

This module contains demo and test functions for the Catenda API client.
Not imported by default - use directly for testing.

Usage:
    python -m integrations.catenda._demo
"""

import logging
import time
from datetime import datetime

from .client import CatendaClient

logger = logging.getLogger(__name__)


def create_test_pdf(file_path: str = "test_document.pdf"):
    """
    Create a simple test PDF for testing.

    Args:
        file_path: Path where PDF should be saved
    """
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas

        c = canvas.Canvas(file_path, pagesize=letter)
        c.drawString(100, 750, "Catenda API Test Document")
        c.drawString(100, 730, f"Generated: {datetime.now().isoformat()}")
        c.drawString(100, 710, "This is a test document for API verification.")
        c.save()

        logger.info(f"Test-PDF opprettet: {file_path}")
        return True

    except ImportError:
        logger.warning("reportlab ikke installert, oppretter dummy tekstfil...")

        # Fallback: create a text file that can be used for testing
        dummy_path = file_path.replace(".pdf", ".txt")
        with open(dummy_path, "w", encoding="utf-8") as f:
            f.write("Catenda API Test Document\n")
            f.write(f"Generated: {datetime.now().isoformat()}\n")
            f.write("This is a test document for API verification.\n")

        logger.info(f"Test-fil opprettet: {dummy_path}")
        return dummy_path


def test_id_mapping(
    client: CatendaClient,
    project_id: str,
    test_file_path: str,
    topic_id: str | None = None,
) -> tuple[bool, str]:
    """
    CRITICAL TEST: Verify if library-item-id can be used as document_guid.

    This test:
    1. Uploads a document via v2 API (gets library-item-id)
    2. Attempts to use library-item-id as document_guid in BCF API
    3. Verifies if document reference was created correctly

    Args:
        client: CatendaClient instance
        project_id: Catenda project ID
        test_file_path: Path to test file to upload
        topic_id: Topic ID to link document to (uses client.test_topic_id if None)

    Returns:
        Tuple: (success: bool, message: str)
    """
    topic_id = topic_id or client.test_topic_id

    if not topic_id:
        return False, "Ingen topic ID spesifisert"

    logger.info("=" * 80)
    logger.info("KRITISK TEST: ID MAPPING VERIFICATION")
    logger.info("=" * 80)

    # Step 1: Upload document
    logger.info("\nSTEG 1: Laster opp testdokument via v2 API...")

    library_item = client.upload_document(
        project_id=project_id,
        file_path=test_file_path,
        document_name=f"TEST_ID_MAPPING_{int(time.time())}",
    )

    if not library_item:
        return False, "Dokumentopplasting feilet"

    library_item_id = library_item["id"]

    logger.info(f"\nDokument lastet opp, library-item-id: {library_item_id}")
    logger.info(f"   Format: {len(library_item_id)} tegn")

    # Step 2: Try to use library-item-id as document_guid
    logger.info("\nSTEG 2: Forsoker a opprette document reference...")
    logger.info(f"   Bruker library-item-id som document_guid: {library_item_id}")

    doc_ref = client.create_document_reference(
        topic_id=topic_id,
        document_guid=library_item_id,
        description="TEST: ID Mapping Verification",
    )

    if not doc_ref:
        # Try with formatted UUID (add hyphens)
        logger.info("\nForste forsok feilet, prover med formatert UUID...")

        if len(library_item_id) == 32:
            # Convert from compact to standard UUID format
            formatted_uuid = (
                f"{library_item_id[0:8]}-"
                f"{library_item_id[8:12]}-"
                f"{library_item_id[12:16]}-"
                f"{library_item_id[16:20]}-"
                f"{library_item_id[20:32]}"
            )

            logger.info(f"   Prover med formatert UUID: {formatted_uuid}")

            doc_ref = client.create_document_reference(
                topic_id=topic_id,
                document_guid=formatted_uuid,
                description="TEST: ID Mapping Verification (formatted UUID)",
            )

            if doc_ref:
                logger.info("=" * 80)
                logger.info("SUKSESS: ID mapping fungerer med FORMATERT UUID!")
                logger.info(f"   library-item-id: {library_item_id}")
                logger.info(f"   document_guid:   {formatted_uuid}")
                logger.info("   Konklusjon: Konverter til standard UUID-format")
                logger.info("=" * 80)
                return True, "ID mapping fungerer med formatert UUID"

        return False, "ID mapping fungerer IKKE - begge formater feilet"

    # Step 3: Verify that document reference exists
    logger.info("\nDocument reference opprettet!")
    logger.info("\nSTEG 3: Verifiserer at dokumentet er synlig i topic...")

    doc_refs = client.list_document_references(topic_id)

    found = any(ref.get("document_guid") == library_item_id for ref in doc_refs)

    if found:
        logger.info("=" * 80)
        logger.info("SUKSESS: ID mapping fungerer direkte!")
        logger.info(f"   library-item-id == document_guid: {library_item_id}")
        logger.info("   Konklusjon: Bruk library-item-id direkte som document_guid")
        logger.info("=" * 80)
        return True, "ID mapping fungerer direkte (kompakt UUID)"
    else:
        logger.warning("Document reference opprettet, men ikke funnet i liste")
        logger.warning("   Dette kan vare en timing-issue. Venter 2 sekunder...")
        time.sleep(2)

        doc_refs = client.list_document_references(topic_id)
        found = any(ref.get("document_guid") == library_item_id for ref in doc_refs)

        if found:
            logger.info("=" * 80)
            logger.info("SUKSESS (etter retry): ID mapping fungerer!")
            logger.info("=" * 80)
            return True, "ID mapping fungerer (kompakt UUID, bekreftet etter retry)"
        else:
            return (
                False,
                "Usikker status - document reference opprettet men ikke verifisert",
            )


def main():
    """
    Main function for testing.
    """
    print("\n" + "=" * 80)
    print("CATENDA API TESTER - POC VERIFICATION")
    print("=" * 80 + "\n")

    # ==========================================
    # CONFIGURATION
    # ==========================================
    print("Konfigurasjon:\n")

    client_id = input("Client ID: ").strip()

    if not client_id:
        print("Client ID er pakrevd!")
        return

    print("\n" + "=" * 80)
    print("VELG AUTENTISERINGSMETODE")
    print("=" * 80)
    print("\n1. Client Credentials Grant (kun for Catenda Boost-kunder)")
    print("2. Authorization Code Grant (for alle brukere)")
    print("3. Jeg har allerede et access token")

    auth_choice = input("\nValg (1/2/3): ").strip()

    client = None

    if auth_choice == "1":
        # Client Credentials Grant
        client_secret = input("Client Secret: ").strip()

        if not client_secret:
            print("Client Secret er pakrevd for Client Credentials Grant!")
            return

        client = CatendaClient(client_id, client_secret)

        print("\n" + "=" * 80)
        print("TEST 1: AUTHENTICATION (CLIENT CREDENTIALS)")
        print("=" * 80)

        if not client.authenticate():
            print("\nHvis du ikke er Catenda Boost-kunde, kjor scriptet pa nytt")
            print("   og velg Authorization Code Grant (alternativ 2)")
            return

    elif auth_choice == "2":
        # Authorization Code Grant
        client_secret = (
            input("Client Secret (valgfritt, kan vare tom): ").strip() or None
        )
        redirect_uri = input("Redirect URI: ").strip()

        if not redirect_uri:
            print("Redirect URI er pakrevd!")
            return

        client = CatendaClient(client_id, client_secret)

        print("\n" + "=" * 80)
        print("TEST 1: AUTHENTICATION (AUTHORIZATION CODE)")
        print("=" * 80)

        # Generate authorization URL
        auth_url = client.get_authorization_url(redirect_uri)

        print("\nApne denne URL-en i nettleser:")
        print(f"   {auth_url}\n")

        input("Trykk ENTER nar du har godkjent og er klar til a fortsette...")

        code = input("\nLim inn authorization code fra redirect URL: ").strip()

        if not code:
            print("Authorization code er pakrevd!")
            return

        if not client.exchange_code_for_token(code, redirect_uri):
            print("Kunne ikke bytte code mot token")
            return

    elif auth_choice == "3":
        # Manual token
        access_token = input("Access Token: ").strip()

        if not access_token:
            print("Access Token er pakrevd!")
            return

        client = CatendaClient(client_id, access_token=access_token)

        print("\n" + "=" * 80)
        print("TEST 1: AUTHENTICATION (MANUAL TOKEN)")
        print("=" * 80)
        print("Access token satt manuelt")

    else:
        print("Ugyldig valg!")
        return

    # ==========================================
    # TEST 2: PROJECT & TOPIC BOARD DISCOVERY
    # ==========================================
    print("\n" + "=" * 80)
    print("TEST 2: PROJECT & TOPIC BOARD DISCOVERY")
    print("=" * 80)

    if not client.select_topic_board(0):
        print("Kunne ikke velge topic board - avbryter testing")
        return

    # ==========================================
    # TEST 3: TOPIC LISTING
    # ==========================================
    print("\n" + "=" * 80)
    print("TEST 3: TOPIC LISTING")
    print("=" * 80)

    if not client.select_topic(0):
        print("Kunne ikke velge topic - avbryter testing")
        return

    # ==========================================
    # TEST 4: LIBRARY DISCOVERY
    # ==========================================
    print("\n" + "=" * 80)
    print("TEST 4: LIBRARY DISCOVERY")
    print("=" * 80)

    # Note: project_id is NOT the same as topic_board_id
    # For testing, ask user for project_id
    print("\nVIKTIG: Du ma oppgi Catenda PROJECT ID (ikke topic_board_id)")
    print("   Dette finner du i Catenda URL: https://catenda.com/projects/<PROJECT_ID>")

    project_id = input("\nCatenda Project ID: ").strip()

    if not project_id:
        print("Project ID er pakrevd for dokumentopplasting")
        return

    if not client.select_library(project_id, "Documents"):
        print("Kunne ikke velge library - avbryter testing")
        return

    # ==========================================
    # TEST 5: CRITICAL ID MAPPING TEST
    # ==========================================
    print("\n" + "=" * 80)
    print("TEST 5: CRITICAL ID MAPPING VERIFICATION")
    print("=" * 80)

    print("\nOppretter test-dokument...")
    test_file = create_test_pdf("catenda_test_doc.pdf")

    if isinstance(test_file, str):
        test_file_path = test_file
    else:
        test_file_path = "catenda_test_doc.pdf"

    success, message = test_id_mapping(
        client=client, project_id=project_id, test_file_path=test_file_path
    )

    print("\n" + "=" * 80)
    print("TEST RESULTAT:")
    print("=" * 80)
    print(f"\nStatus: {'SUKSESS' if success else 'FEILET'}")
    print(f"Melding: {message}")

    # ==========================================
    # TEST 6: COMMENT POSTING
    # ==========================================
    print("\n" + "=" * 80)
    print("TEST 6: COMMENT POSTING")
    print("=" * 80)

    client.create_comment(
        topic_id=client.test_topic_id,
        comment_text=f"Test-kommentar fra API tester ({datetime.now().strftime('%Y-%m-%d %H:%M')})",
    )

    # ==========================================
    # SUMMARY
    # ==========================================
    print("\n" + "=" * 80)
    print("TESTING FULLFORT")
    print("=" * 80)
    print("\nSe 'catenda_api_test.log' for komplett testlogg.")
    print("\nViktigste funn:")
    print("  - Autentisering: OK")
    print(f"  - Topic Board valgt: {client.topic_board_id}")
    print(f"  - Library valgt: {client.library_id}")
    print(f"  - ID Mapping: {'OK' if success else 'FEIL'} {message}")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
