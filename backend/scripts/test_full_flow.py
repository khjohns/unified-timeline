#!/usr/bin/env python3
"""
Full Flow Test Script - Catenda Integration

Tester den komplette flyten fra topic-opprettelse i Catenda
til ferdig behandlet sak med PDF-arkivering.

Se docs/FULL_FLOW_TEST_PLAN.md for detaljert plan.
"""

import os
import sys
import time
import json
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

# Legg til parent directory i path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Last .env
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

# Imports
try:
    from core.config import settings
    from integrations.catenda import CatendaClient
except ImportError as e:
    print(f"Import feilet: {e}")
    print("Sorg for at scriptet kjores fra backend/-mappen.")
    sys.exit(1)


# =============================================================================
# KONFIGURASJON
# =============================================================================

# Topic Board konfigurasjon (fra plan)
REQUIRED_TYPES = [
    "Krav om endringsordre",
    "Endringsordre",
    "Forsering"
]

REQUIRED_STATUSES = [
    ("Under varsling", "open"),
    ("Sendt", "open"),
    ("Under behandling", "open"),
    ("Under forhandling", "open"),
    ("Omforent", "closed"),
    ("Lukket", "closed")
]

REQUIRED_CUSTOM_FIELDS = [
    "Byggherre",
    "Leverandor"
]

# Testverdier
TEST_DATA = {
    "byggherre": "Test Byggherre AS",
    "leverandor": "Test Entreprenor AS",
    "grunnlag": {
        "hovedkategori": "ENDRING",
        "underkategori": "INSTRUKS",
        "beskrivelse": "Automatisk testcase - grunnlag for endringskrav",
        "kontraktsreferanse": "31.1"
    },
    "vederlag": {
        "metode": "DIREKTE",
        "belop": 150000.0,
        "beskrivelse": "Automatisk testcase - vederlagskrav"
    },
    "frist": {
        "varseltype": "SPESIFIKT",
        "antall_dager": 14,
        "beskrivelse": "Automatisk testcase - fristkrav"
    }
}

# Backend URL
BACKEND_URL = "http://localhost:8080"


# =============================================================================
# HJELPEFUNKSJONER
# =============================================================================

def print_header(title: str):
    """Print formatert header"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def print_subheader(title: str):
    """Print formatert subheader"""
    print(f"\n--- {title} ---\n")


def print_ok(message: str):
    """Print OK-melding"""
    print(f"  [OK] {message}")


def print_fail(message: str):
    """Print feil-melding"""
    print(f"  [FEIL] {message}")


def print_warn(message: str):
    """Print advarsel"""
    print(f"  [!] {message}")


def print_info(message: str):
    """Print info"""
    print(f"  {message}")


def confirm(prompt: str, default: bool = True) -> bool:
    """Spor bruker om bekreftelse"""
    suffix = "[J/n]" if default else "[j/N]"
    response = input(f"\n{prompt} {suffix}: ").strip().lower()
    if not response:
        return default
    return response in ('j', 'ja', 'y', 'yes')


def wait_with_spinner(seconds: int, message: str):
    """Vent med spinner-animasjon"""
    spinner = ['|', '/', '-', '\\']
    for i in range(seconds * 4):
        sys.stdout.write(f"\r  {spinner[i % 4]} {message}...")
        sys.stdout.flush()
        time.sleep(0.25)
    sys.stdout.write("\r" + " " * 60 + "\r")
    sys.stdout.flush()


# =============================================================================
# CATENDA CLIENT UTVIDELSE
# =============================================================================

class ExtendedCatendaClient(CatendaClient):
    """Utvidet Catenda-klient med ekstra metoder for testing"""

    def list_projects(self) -> List[Dict]:
        """
        List alle prosjekter brukeren har tilgang til.

        Returns:
            Liste med prosjekter
        """
        url = f"{self.base_url}/v2/projects"
        headers = self.get_headers()

        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"  Feil ved listing av prosjekter: {response.status_code}")
                return []
        except Exception as e:
            print(f"  Feil: {e}")
            return []

    def get_topic_board_extensions_full(self) -> Optional[Dict]:
        """
        Hent fullstendige extensions for topic board (types, statuses, etc.)

        Returns:
            Extensions-data eller None
        """
        if not self.topic_board_id:
            print("  Ingen topic_board_id satt")
            return None

        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/extensions"
        headers = self.get_headers()

        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"  Feil ved henting av extensions: {response.status_code}")
                return None
        except Exception as e:
            print(f"  Feil: {e}")
            return None

    def list_topic_comments(self, topic_id: str) -> List[Dict]:
        """
        List kommentarer for en topic.

        Args:
            topic_id: Topic GUID

        Returns:
            Liste med kommentarer
        """
        if not self.topic_board_id:
            return []

        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics/{topic_id}/comments"
        headers = self.get_headers()

        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                return response.json()
            else:
                return []
        except Exception:
            return []

    def get_topic_documents(self, topic_id: str) -> List[Dict]:
        """
        Hent dokumentreferanser for en topic.

        Args:
            topic_id: Topic GUID

        Returns:
            Liste med dokumentreferanser
        """
        if not self.topic_board_id:
            return []

        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics/{topic_id}/document_references"
        headers = self.get_headers()

        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                return response.json()
            else:
                return []
        except Exception:
            return []


# =============================================================================
# FASE 1: SETUP OG VALIDERING
# =============================================================================

class SetupValidator:
    """Validerer oppsett og konfigurasjon"""

    def __init__(self):
        self.client: Optional[ExtendedCatendaClient] = None
        self.project_id: Optional[str] = None
        self.library_id: Optional[str] = None
        self.folder_id: Optional[str] = None
        self.topic_board_id: Optional[str] = None
        self.config: Dict[str, Any] = {}

    def validate_authentication(self) -> bool:
        """Steg 1.1: Valider autentisering"""
        print_header("STEG 1.1: Autentisering")

        # Last config
        if not settings.catenda_client_id:
            print_fail("CATENDA_CLIENT_ID mangler i .env")
            print_info("Kjor forst: python scripts/setup_authentication.py")
            return False

        self.config = settings.get_catenda_config()

        # Opprett klient
        self.client = ExtendedCatendaClient(
            client_id=self.config['catenda_client_id'],
            client_secret=self.config.get('catenda_client_secret')
        )

        # Sjekk access token
        access_token = self.config.get('catenda_access_token')
        if access_token:
            print_info("Bruker lagret access token fra .env")
            self.client.set_access_token(access_token)
        elif self.config.get('catenda_client_secret'):
            print_info("Autentiserer med Client Credentials...")
            if not self.client.authenticate():
                print_fail("Autentisering feilet")
                return False
        else:
            print_fail("Ingen access token eller client secret funnet")
            print_info("Kjor forst: python scripts/setup_authentication.py")
            return False

        # Test autentisering ved a liste prosjekter
        projects = self.client.list_projects()
        if not projects:
            print_fail("Kunne ikke hente prosjekter - sjekk autentisering")
            return False

        print_ok(f"Autentisert! Fant {len(projects)} prosjekt(er)")

        # Vis prosjekter og la bruker velge/bekrefte
        print_subheader("Tilgjengelige prosjekter")

        current_project_id = self.config.get('catenda_project_id')
        selected_idx = 0

        for i, project in enumerate(projects):
            marker = "[*]" if project.get('id') == current_project_id else "[ ]"
            if project.get('id') == current_project_id:
                selected_idx = i
            print(f"  {i+1}. {marker} {project.get('name')} ({project.get('id')})")

        if current_project_id:
            print_info(f"\nForhandsvalgt prosjekt fra .env: {current_project_id}")
            if confirm("Bruk dette prosjektet?"):
                self.project_id = current_project_id
            else:
                choice = input("Velg prosjektnummer: ").strip()
                try:
                    idx = int(choice) - 1
                    self.project_id = projects[idx]['id']
                except (ValueError, IndexError):
                    print_fail("Ugyldig valg")
                    return False
        else:
            choice = input("Velg prosjektnummer: ").strip()
            try:
                idx = int(choice) - 1
                self.project_id = projects[idx]['id']
            except (ValueError, IndexError):
                print_fail("Ugyldig valg")
                return False

        self.client.project_id = self.project_id
        print_ok(f"Prosjekt valgt: {self.project_id}")
        return True

    def validate_library_and_folder(self) -> bool:
        """Steg 1.2: Valider bibliotek og mappe"""
        print_header("STEG 1.2: Bibliotek og mappe")

        self.library_id = self.config.get('catenda_library_id')
        self.folder_id = self.config.get('catenda_folder_id')

        if self.library_id:
            print_info(f"Library ID fra .env: {self.library_id}")
        else:
            print_warn("CATENDA_LIBRARY_ID ikke satt i .env")
            # Vis tilgjengelige biblioteker
            libraries = self.client.list_libraries(self.project_id)
            if libraries:
                print_info("Tilgjengelige biblioteker:")
                for i, lib in enumerate(libraries):
                    print(f"  {i+1}. {lib.get('name')} ({lib.get('id')})")
                choice = input("Velg bibliotek (eller Enter for a hoppe over): ").strip()
                if choice:
                    try:
                        idx = int(choice) - 1
                        self.library_id = libraries[idx]['id']
                    except (ValueError, IndexError):
                        print_warn("Ugyldig valg, fortsetter uten bibliotek")

        if self.folder_id:
            print_info(f"Folder ID fra .env: {self.folder_id}")

        if self.library_id:
            self.client.library_id = self.library_id
            print_ok(f"Bibliotek: {self.library_id}")
            if self.folder_id:
                print_ok(f"Mappe: {self.folder_id}")
        else:
            print_warn("Inget bibliotek valgt - PDF-opplasting vil hoppes over")

        if not confirm("Er dette riktig?"):
            print_info("Oppdater .env-filen og kjor scriptet pa nytt")
            return False

        return True

    def validate_topic_board(self) -> bool:
        """Steg 1.3: Valider Topic Board"""
        print_header("STEG 1.3: Topic Board")

        self.topic_board_id = self.config.get('catenda_topic_board_id')

        if not self.topic_board_id:
            # Hent tilgjengelige boards
            print_info("Henter tilgjengelige Topic Boards...")
            self.client.project_id = self.project_id

            # Bruk get_project_details for a finne topic boards
            project_details = self.client.get_project_details(self.project_id)
            if project_details:
                print_info(f"Prosjekt: {project_details.get('name')}")

            # Fors a hente boards via BCF API
            # Vi trenger a iterere gjennom boards - bruk extensions
            print_warn("CATENDA_TOPIC_BOARD_ID ikke satt i .env")
            print_info("Du kan finne Board ID i Catenda URL-en")

            board_id = input("Angi Topic Board ID: ").strip()
            if not board_id:
                print_fail("Topic Board ID er pakrevd")
                return False
            self.topic_board_id = board_id

        self.client.topic_board_id = self.topic_board_id
        print_ok(f"Topic Board ID: {self.topic_board_id}")

        # Valider board-konfigurasjon
        print_subheader("Validerer Topic Board konfigurasjon")

        extensions = self.client.get_topic_board_extensions_full()
        if not extensions:
            print_fail("Kunne ikke hente Topic Board extensions")
            return False

        # Valider Types
        print_info("Sjekker Types...")
        available_types = extensions.get('topic_type', [])
        missing_types = []
        for required_type in REQUIRED_TYPES:
            if required_type in available_types:
                print_ok(f"Type: {required_type}")
            else:
                print_fail(f"Type mangler: {required_type}")
                missing_types.append(required_type)

        # Valider Statuses
        print_info("\nSjekker Statuses...")
        available_statuses = extensions.get('topic_status', [])
        missing_statuses = []
        for status_name, status_type in REQUIRED_STATUSES:
            if status_name in available_statuses:
                print_ok(f"Status: {status_name}")
            else:
                print_fail(f"Status mangler: {status_name} ({status_type})")
                missing_statuses.append((status_name, status_type))

        # Vis custom fields (sjekkes mot board, ikke bare project)
        print_info("\nSjekker Custom Fields pa board...")
        board_with_fields = self.client.get_topic_board_with_custom_fields(self.project_id)
        if board_with_fields:
            custom_fields = board_with_fields.get('bimsync_custom_fields', [])
            available_field_names = [f.get('name') for f in custom_fields]

            for required_field in REQUIRED_CUSTOM_FIELDS:
                if required_field in available_field_names:
                    print_ok(f"Custom Field: {required_field}")
                else:
                    print_warn(f"Custom Field ikke aktivert pa board: {required_field}")

        # Oppsummering
        if missing_types or missing_statuses:
            print_subheader("Manglende konfigurasjon")
            if missing_types:
                print_info("Manglende Types:")
                for t in missing_types:
                    print(f"    - {t}")
            if missing_statuses:
                print_info("Manglende Statuses:")
                for s, st in missing_statuses:
                    print(f"    - {s} ({st})")

            print_info("\nOpprett disse i Catenda Topic Board settings,")
            print_info("eller la scriptet opprette dem automatisk.")

            if confirm("Opprette manglende Types og Statuses automatisk?"):
                success = self._create_missing_board_config(missing_types, missing_statuses)
                if not success:
                    return False
            else:
                if not confirm("Fortsette likevel?"):
                    return False

        print_ok("Topic Board validert!")
        return True

    def _create_missing_board_config(
        self,
        missing_types: List[str],
        missing_statuses: List[Tuple[str, str]]
    ) -> bool:
        """Opprett manglende types og statuses"""

        # Opprett types
        for type_name in missing_types:
            print_info(f"Oppretter type: {type_name}...")
            result = self.client.create_type(type_name)
            if result:
                print_ok(f"Type opprettet: {type_name}")
            else:
                print_fail(f"Kunne ikke opprette type: {type_name}")
                return False

        # Opprett statuses
        for status_name, status_type in missing_statuses:
            print_info(f"Oppretter status: {status_name} ({status_type})...")
            result = self.client.create_status(status_name, status_type)
            if result:
                print_ok(f"Status opprettet: {status_name}")
            else:
                print_fail(f"Kunne ikke opprette status: {status_name}")
                return False

        return True

    def validate_webhooks(self) -> bool:
        """Steg 1.4: Valider webhooks"""
        print_header("STEG 1.4: Webhooks")

        # Hent webhooks
        webhooks = self.client.list_webhooks(self.project_id)

        if not webhooks:
            print_warn("Ingen webhooks funnet for prosjektet")
        else:
            print_info(f"Fant {len(webhooks)} webhook(s):")
            for wh in webhooks:
                state = "[ON]" if wh.get('state') == 'ENABLED' else "[OFF]"
                print(f"  {state} {wh.get('event')} -> {wh.get('target_url')}")

        # Sjekk pakrevde webhooks
        required_events = ['issue.created', 'issue.modified']
        ngrok_url = os.getenv('NGROK_URL')
        secret_path = os.getenv('WEBHOOK_SECRET_PATH')

        if not ngrok_url or not secret_path:
            print_warn("NGROK_URL og/eller WEBHOOK_SECRET_PATH ikke satt i .env")
            print_info("Webhooks kan ikke valideres fullstendig")
        else:
            expected_url = f"{ngrok_url}/webhook/catenda/{secret_path}"
            print_info(f"Forventet webhook URL: {expected_url}")

            for event in required_events:
                found = any(
                    wh.get('event') == event and
                    wh.get('target_url') == expected_url and
                    wh.get('state') == 'ENABLED'
                    for wh in webhooks
                )
                if found:
                    print_ok(f"Webhook: {event}")
                else:
                    print_fail(f"Webhook mangler/inaktiv: {event}")

        if not confirm("Fortsette med testing?"):
            return False

        return True


# =============================================================================
# FASE 2: TEST STANDARD KOE-FLYT
# =============================================================================

class KOEFlowTester:
    """Tester standard KOE-flyt"""

    def __init__(self, client: ExtendedCatendaClient, project_id: str,
                 library_id: Optional[str], folder_id: Optional[str],
                 topic_board_id: str):
        self.client = client
        self.project_id = project_id
        self.library_id = library_id
        self.folder_id = folder_id
        self.topic_board_id = topic_board_id

        self.topic_guid: Optional[str] = None
        self.sak_id: Optional[str] = None
        self.topic_title: Optional[str] = None

    def create_test_topic(self) -> bool:
        """Steg 2.1: Opprett test-topic i Catenda"""
        print_header("STEG 2.1: Opprett test-topic")

        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        self.topic_title = f"TEST-{timestamp} - Automatisk testcase"

        print_info(f"Oppretter topic: {self.topic_title}")
        print_info(f"Type: Krav om endringsordre")

        # Finn forste tilgjengelige status
        extensions = self.client.get_topic_board_extensions_full()
        first_status = None
        if extensions:
            statuses = extensions.get('topic_status', [])
            if 'Under varsling' in statuses:
                first_status = 'Under varsling'
            elif statuses:
                first_status = statuses[0]

        result = self.client.create_topic(
            title=self.topic_title,
            description="Automatisk opprettet testcase for full flyt-test.\n\n"
                       f"Byggherre: {TEST_DATA['byggherre']}\n"
                       f"Leverandor: {TEST_DATA['leverandor']}",
            topic_type="Krav om endringsordre",
            topic_status=first_status
        )

        if not result:
            print_fail("Kunne ikke opprette topic")
            return False

        self.topic_guid = result.get('guid')
        print_ok(f"Topic opprettet!")
        print_info(f"GUID: {self.topic_guid}")

        return True

    def verify_webhook_received(self) -> bool:
        """Steg 2.2: Verifiser at webhook ble mottatt av backend"""
        print_header("STEG 2.2: Verifiser webhook-mottak")

        print_info("Venter pa at backend mottar webhook...")

        # Poll backend for ny sak
        max_attempts = 30
        for attempt in range(max_attempts):
            wait_with_spinner(1, f"Venter pa webhook ({attempt+1}/{max_attempts})")

            # Sjekk metadata repository for topic_guid
            try:
                response = requests.get(
                    f"{BACKEND_URL}/api/metadata/by-topic/{self.topic_guid}",
                    timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    self.sak_id = data.get('sak_id')
                    if self.sak_id:
                        print_ok(f"Webhook mottatt!")
                        print_info(f"Sak ID: {self.sak_id}")
                        return True
            except requests.exceptions.RequestException:
                pass  # Backend ikke tilgjengelig, prove igjen

        print_fail("Timeout - webhook ikke mottatt innen 30 sekunder")
        print_info("Sjekk at backend kjorer og webhooks er konfigurert")

        # Alternativ: Bruker angir sak_id manuelt
        manual_sak_id = input("\nAngi sak_id manuelt (eller Enter for a avbryte): ").strip()
        if manual_sak_id:
            self.sak_id = manual_sak_id
            print_ok(f"Bruker manuell sak_id: {self.sak_id}")
            return True

        return False

    def verify_magic_link_comment(self) -> bool:
        """Steg 2.3: Verifiser magic link-kommentar"""
        print_header("STEG 2.3: Verifiser magic link-kommentar")

        print_info("Henter kommentarer fra topic...")

        # Vent litt for asynkron kommentar-posting
        time.sleep(2)

        comments = self.client.list_topic_comments(self.topic_guid)

        if not comments:
            print_warn("Ingen kommentarer funnet enna")
            print_info("Kommentar kan ta noen sekunder a poste")

            # Prov igjen
            time.sleep(3)
            comments = self.client.list_topic_comments(self.topic_guid)

        if comments:
            print_ok(f"Fant {len(comments)} kommentar(er)")

            # Sok etter magic link
            magic_link_found = False
            for comment in comments:
                comment_text = comment.get('comment', '')
                if 'magicToken' in comment_text or 'saker/' in comment_text:
                    magic_link_found = True
                    print_ok("Magic link-kommentar funnet!")
                    # Vis utdrag
                    lines = comment_text.split('\n')[:5]
                    for line in lines:
                        print(f"    {line}")
                    break

            if not magic_link_found:
                print_warn("Ingen magic link funnet i kommentarer")
        else:
            print_warn("Ingen kommentarer funnet")

        return True  # Fortsett selv om kommentar mangler

    def send_grunnlag(self) -> bool:
        """Steg 2.4: Send grunnlag (simuler TE)"""
        print_header("STEG 2.4: Send grunnlag")

        print_info("Sender grunnlag_opprettet event til backend...")
        print_info(f"  Hovedkategori: {TEST_DATA['grunnlag']['hovedkategori']}")
        print_info(f"  Underkategori: {TEST_DATA['grunnlag']['underkategori']}")

        event_data = {
            "sak_id": self.sak_id,
            "event_type": "grunnlag_opprettet",
            "aktor": "Test Script",
            "aktor_rolle": "TE",
            "hovedkategori": TEST_DATA['grunnlag']['hovedkategori'],
            "underkategori": TEST_DATA['grunnlag']['underkategori'],
            "beskrivelse": TEST_DATA['grunnlag']['beskrivelse'],
            "kontraktsreferanse": TEST_DATA['grunnlag']['kontraktsreferanse']
        }

        try:
            response = requests.post(
                f"{BACKEND_URL}/api/events",
                json=event_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )

            if response.status_code in [200, 201]:
                result = response.json()
                print_ok("Grunnlag registrert!")
                print_info(f"  Event ID: {result.get('event_id')}")
                print_info(f"  Versjon: {result.get('version')}")
                return True
            else:
                print_fail(f"Feil ved sending: {response.status_code}")
                print_info(f"  {response.text}")
                return False

        except requests.exceptions.RequestException as e:
            print_fail(f"Nettverksfeil: {e}")
            return False

    def verify_pdf_upload(self) -> bool:
        """Steg 2.5: Verifiser PDF-generering og opplasting"""
        print_header("STEG 2.5: Verifiser PDF")

        if not self.library_id:
            print_warn("Inget bibliotek konfigurert - hopper over PDF-sjekk")
            return True

        print_info("Sjekker dokumentreferanser pa topic...")

        # Vent pa asynkron PDF-generering
        time.sleep(3)

        documents = self.client.get_topic_documents(self.topic_guid)

        if documents:
            print_ok(f"Fant {len(documents)} dokument(er) lenket til topic")
            for doc in documents:
                print_info(f"  - {doc.get('description', 'Ukjent')} ({doc.get('guid')})")
        else:
            print_warn("Ingen dokumenter funnet enna")
            print_info("PDF-generering kan ta noen sekunder")

        return True

    def send_vederlag_and_frist(self) -> bool:
        """Steg 2.7: Send vederlag og frist"""
        print_header("STEG 2.7: Send vederlag og fristkrav")

        # Vederlagskrav
        print_info("Sender vederlag_krav_sendt...")
        print_info(f"  Metode: {TEST_DATA['vederlag']['metode']}")
        print_info(f"  Belop: {TEST_DATA['vederlag']['belop']:,.0f} kr")

        vederlag_event = {
            "sak_id": self.sak_id,
            "event_type": "vederlag_krav_sendt",
            "aktor": "Test Script",
            "aktor_rolle": "TE",
            "metode": TEST_DATA['vederlag']['metode'],
            "belop_direkte": TEST_DATA['vederlag']['belop'],
            "beskrivelse": TEST_DATA['vederlag']['beskrivelse']
        }

        try:
            response = requests.post(
                f"{BACKEND_URL}/api/events",
                json=vederlag_event,
                headers={"Content-Type": "application/json"},
                timeout=10
            )

            if response.status_code in [200, 201]:
                print_ok("Vederlagskrav sendt!")
            else:
                print_fail(f"Feil ved sending: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print_fail(f"Nettverksfeil: {e}")

        # Fristkrav
        print_info("\nSender frist_krav_sendt...")
        print_info(f"  Antall dager: {TEST_DATA['frist']['antall_dager']}")

        frist_event = {
            "sak_id": self.sak_id,
            "event_type": "frist_krav_sendt",
            "aktor": "Test Script",
            "aktor_rolle": "TE",
            "varseltype": TEST_DATA['frist']['varseltype'],
            "antall_dager": TEST_DATA['frist']['antall_dager'],
            "beskrivelse": TEST_DATA['frist']['beskrivelse']
        }

        try:
            response = requests.post(
                f"{BACKEND_URL}/api/events",
                json=frist_event,
                headers={"Content-Type": "application/json"},
                timeout=10
            )

            if response.status_code in [200, 201]:
                print_ok("Fristkrav sendt!")
            else:
                print_fail(f"Feil ved sending: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print_fail(f"Nettverksfeil: {e}")

        return True

    def show_summary(self) -> None:
        """Steg 2.8: Vis oppsummering"""
        print_header("TEST FULLFORT - Standard KOE-flyt")

        print(f"  Sak ID:      {self.sak_id}")
        print(f"  Topic GUID:  {self.topic_guid}")
        print(f"  Topic Title: {self.topic_title}")
        print()

        # Hent state fra backend
        try:
            response = requests.get(
                f"{BACKEND_URL}/api/cases/{self.sak_id}/state",
                timeout=5
            )
            if response.status_code == 200:
                state = response.json()
                print(f"  Status:      {state.get('overordnet_status')}")
                print()
                print("  Spor:")
                print(f"    - Grunnlag: {state.get('grunnlag', {}).get('status')}")
                print(f"    - Vederlag: {state.get('vederlag', {}).get('status')}")
                print(f"    - Frist:    {state.get('frist', {}).get('status')}")
        except:
            pass

        print()
        print("  Neste steg:")
        print("    BH ma manuelt svare pa grunnlag, vederlag og frist")
        print("    i frontend-applikasjonen.")
        print()
        print("=" * 70)

    def cleanup(self) -> bool:
        """Steg 2.9: Rydd opp testdata"""
        print_header("STEG 2.9: Cleanup")

        if not confirm("Vil du slette test-topic fra Catenda?", default=False):
            print_info("Beholder testdata for inspeksjon")
            return True

        print_info("Sletter topic fra Catenda...")

        # Catenda BCF API stotter ikke sletting direkte
        # Vi kan sette status til "Lukket" i stedet
        print_warn("Catenda BCF API stotter ikke sletting av topics")
        print_info("Setter status til 'Lukket' i stedet...")

        # Dette krever at vi har en "Lukket" status
        # For na hopper vi over
        print_info("Cleanup ikke implementert - manuell sletting pavkreves")

        return True


# =============================================================================
# HOVEDFUNKSJON
# =============================================================================

def main():
    """Hovedfunksjon"""

    print("\n" + "=" * 70)
    print("  FULL FLOW TEST - Catenda Integration")
    print("  Se docs/FULL_FLOW_TEST_PLAN.md for detaljer")
    print("=" * 70)

    print("\nDette scriptet tester den komplette KOE-flyten:")
    print("  1. Validerer konfigurasjon")
    print("  2. Oppretter test-topic i Catenda")
    print("  3. Verifiserer webhook-mottak")
    print("  4. Sender grunnlag, vederlag og fristkrav")
    print("  5. Verifiserer PDF-opplasting")

    if not confirm("\nStarte test?"):
        print("\nAvbrutt.")
        return

    # Fase 1: Setup og validering
    validator = SetupValidator()

    if not validator.validate_authentication():
        print("\n[AVBRUTT] Autentisering feilet")
        return

    if not validator.validate_library_and_folder():
        print("\n[AVBRUTT] Bibliotek/mappe-validering feilet")
        return

    if not validator.validate_topic_board():
        print("\n[AVBRUTT] Topic Board-validering feilet")
        return

    if not validator.validate_webhooks():
        print("\n[AVBRUTT] Webhook-validering feilet")
        return

    # Fase 2: Test KOE-flyt
    tester = KOEFlowTester(
        client=validator.client,
        project_id=validator.project_id,
        library_id=validator.library_id,
        folder_id=validator.folder_id,
        topic_board_id=validator.topic_board_id
    )

    if not tester.create_test_topic():
        print("\n[AVBRUTT] Kunne ikke opprette test-topic")
        return

    if not tester.verify_webhook_received():
        print("\n[AVBRUTT] Webhook ikke mottatt")
        return

    tester.verify_magic_link_comment()

    if not tester.send_grunnlag():
        print("\n[ADVARSEL] Grunnlag-sending feilet, fortsetter...")

    tester.verify_pdf_upload()

    tester.send_vederlag_and_frist()

    tester.show_summary()

    tester.cleanup()

    print("\n[FERDIG] Full flyt-test gjennomfort!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nAvbrutt av bruker.")
        sys.exit(0)
    except Exception as e:
        print(f"\nUventet feil: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
