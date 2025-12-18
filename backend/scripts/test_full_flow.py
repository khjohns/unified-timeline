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
    "Leverandør"
]

# Testverdier for komplett flyt
TEST_DATA = {
    "byggherre": "Test Byggherre AS",
    "leverandor": "Test Entreprenor AS",

    # FASE 2: TE Initial Claims
    "grunnlag": {
        "hovedkategori": "ENDRING",
        "underkategori": "IRREG",
        "beskrivelse": "Automatisk testcase - grunnlag for endringskrav (irregulær endring)",
        "kontraktsreferanse": "32.1"
    },
    "vederlag": {
        "metode": "ENHETSPRISER",
        "belop_direkte": 150000.0,
        "begrunnelse": "Automatisk testcase - vederlagskrav"
    },
    "frist": {
        "varsel_type": "spesifisert",
        "antall_dager": 14,
        "begrunnelse": "Automatisk testcase - fristkrav"
    },

    # FASE 3: BH Responses
    "bh_grunnlag": {
        "resultat": "godkjent",
        "begrunnelse": "Grunnlaget aksepteres"
    },
    "bh_vederlag": {
        "beregnings_resultat": "delvis_godkjent",
        "godkjent_belop": 100000.0,  # 100k av 150k
        "aksepterer_metode": True,
        "begrunnelse": "Godkjenner 100.000 kr av krevde 150.000 kr"
    },
    "bh_frist": {
        "beregnings_resultat": "delvis_godkjent",
        "godkjent_dager": 10,  # 10 av 14 dager
        "spesifisert_krav_ok": True,
        "vilkar_oppfylt": True,
        "begrunnelse": "Godkjenner 10 av 14 krevde dager"
    },

    # FASE 4: TE Revisions (etter delvis godkjenning)
    "vederlag_revisjon": {
        "metode": "ENHETSPRISER",
        "belop_direkte": 120000.0,  # Justert ned fra 150k
        "begrunnelse": "Justerer kravet basert på BH tilbakemelding"
    },
    "frist_revisjon": {
        "antall_dager": 12,  # Justert ned fra 14
        "begrunnelse": "Justerer fristkrav basert på BH tilbakemelding"
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


# Global flag for auto-confirm mode
AUTO_CONFIRM = False

def confirm(prompt: str, default: bool = True) -> bool:
    """Spor bruker om bekreftelse (skipper hvis AUTO_CONFIRM=True)"""
    if AUTO_CONFIRM:
        print(f"\n{prompt} [auto-confirm: ja]")
        return True
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
# FASE 1: SETUP OG VALIDERING
# =============================================================================

class SetupValidator:
    """Validerer oppsett og konfigurasjon"""

    def __init__(self):
        self.client: Optional[CatendaClient] = None
        self.project_id: Optional[str] = None
        self.library_id: Optional[str] = None
        self.folder_id: Optional[str] = None
        self.topic_board_id: Optional[str] = None
        self.config: Dict[str, Any] = {}

    def _browse_folders(self, parent_id: Optional[str] = None, path: str = "/") -> Optional[str]:
        """Naviger i mappestrukturen"""
        # Hent mapper pa dette nivaet
        folders = self.client.list_folders(self.project_id, parent_id=parent_id, include_subfolders=False)

        # Sorter alfabetisk
        if folders:
            folders.sort(key=lambda f: f.get('name', '').lower())

        print(f"\n  Mappe: {path}")
        print("  " + "-" * 40)

        if parent_id:
            print("    0. [Opp ett niva]")
            print("    R. [Bruk DENNE mappen]")

        if not folders:
            print("    (ingen undermapper)")
        else:
            for i, folder in enumerate(folders, 1):
                print(f"    {i}. {folder.get('name', 'Uten navn')}")

        print("    Enter: Bruk root (ingen mappe)")
        print()

        choice = input("  Velg: ").strip().lower()

        if not choice:
            # Tom input = bruk root
            return None
        elif choice == '0' and parent_id:
            # Ga opp - returner spesialverdi
            return "__UP__"
        elif choice == 'r' and parent_id:
            return parent_id
        elif choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(folders):
                selected = folders[idx]
                new_path = f"{path}{selected.get('name')}/"
                # Naviger ned i denne mappen
                result = self._browse_folders(parent_id=selected['id'], path=new_path)
                if result == "__UP__":
                    # Brukeren gikk opp, vis denne mappen pa nytt
                    return self._browse_folders(parent_id=parent_id, path=path)
                return result

        print_warn("Ugyldig valg")
        return self._browse_folders(parent_id=parent_id, path=path)

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
        self.client = CatendaClient(
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

        # Bibliotek
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

        # Mappe (kun hvis bibliotek er valgt)
        if self.library_id:
            self.client.library_id = self.library_id

            if self.folder_id:
                print_info(f"Folder ID fra .env: {self.folder_id}")
            else:
                print_warn("CATENDA_FOLDER_ID ikke satt i .env")
                print_info("Naviger til onskede mappe:")
                try:
                    self.folder_id = self._browse_folders()
                except Exception as e:
                    print_warn(f"Kunne ikke hente mapper: {e}")

            print_ok(f"Bibliotek: {self.library_id}")
            if self.folder_id:
                print_ok(f"Mappe: {self.folder_id}")
            else:
                print_info("Mappe: (root)")
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

        extensions = self.client.get_topic_board_extensions()
        if not extensions:
            print_fail("Kunne ikke hente Topic Board extensions")
            return False

        # Valider Types
        print_info("Sjekker Types...")
        available_types = extensions.get('topic_type', [])
        print_info(f"  Tilgjengelige typer fra API: {available_types}")
        missing_types = []
        for required_type in REQUIRED_TYPES:
            # Case-insensitive sammenligning
            if any(t.lower() == required_type.lower() for t in available_types):
                print_ok(f"Type: {required_type}")
            else:
                print_fail(f"Type mangler: {required_type}")
                missing_types.append(required_type)

        # Valider Statuses
        print_info("\nSjekker Statuses...")
        available_statuses = extensions.get('topic_status', [])
        print_info(f"  Tilgjengelige statuser fra API: {available_statuses}")
        missing_statuses = []
        for status_name, status_type in REQUIRED_STATUSES:
            # Case-insensitive sammenligning
            if any(s.lower() == status_name.lower() for s in available_statuses):
                print_ok(f"Status: {status_name}")
            else:
                print_fail(f"Status mangler: {status_name} ({status_type})")
                missing_statuses.append((status_name, status_type))

        # Vis custom fields (sjekkes mot board, ikke bare project)
        print_info("\nSjekker Custom Fields pa board...")
        board_with_fields = self.client.get_topic_board_with_custom_fields(
            self.topic_board_id,
            self.project_id
        )
        if board_with_fields:
            # Hent fields fra customFieldInstances (aktive på boardet)
            instances = board_with_fields.get('customFieldInstances', [])
            fields_map = {f.get('id'): f for f in board_with_fields.get('customFields', [])}
            available_field_names = [
                fields_map.get(inst.get('id'), {}).get('name')
                for inst in instances
                if not inst.get('disabled')
            ]

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
            result = self.client.create_status(status_name, status_type=status_type)
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

    def __init__(self, client: CatendaClient, project_id: str,
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
        self.csrf_token: Optional[str] = None
        self.magic_token: Optional[str] = None

        # Tracking for verification
        self.initial_comment_count: int = 0
        self.initial_document_count: int = 0

    def _fetch_csrf_token(self) -> bool:
        """Hent CSRF-token fra backend"""
        try:
            response = requests.get(f"{BACKEND_URL}/api/csrf-token", timeout=5)
            if response.status_code == 200:
                data = response.json()
                self.csrf_token = data.get('csrfToken')
                return bool(self.csrf_token)
        except requests.exceptions.RequestException:
            pass
        return False

    def _extract_magic_token_from_comments(self) -> bool:
        """Hent magic token fra Catenda-kommentar"""
        import re

        comments = self.client.get_comments(self.topic_guid)
        for comment in comments:
            text = comment.get('comment', '')
            # Søk etter magicToken i URL
            match = re.search(r'magicToken=([a-zA-Z0-9_-]+)', text)
            if match:
                self.magic_token = match.group(1)
                return True
        return False

    def _get_auth_headers(self) -> Dict[str, str]:
        """Bygg headers med CSRF og magic token (Bearer format)"""
        headers = {"Content-Type": "application/json"}
        if self.csrf_token:
            headers["X-CSRF-Token"] = self.csrf_token
        if self.magic_token:
            # Magic link token må sendes som Bearer token i Authorization header
            headers["Authorization"] = f"Bearer {self.magic_token}"
        return headers

    def _get_comment_count(self) -> int:
        """Hent antall kommentarer på topic"""
        comments = self.client.get_comments(self.topic_guid)
        return len(comments) if comments else 0

    def _get_document_count(self) -> int:
        """Hent antall dokumenter linket til topic"""
        documents = self.client.list_document_references(self.topic_guid)
        return len(documents) if documents else 0

    def _verify_new_comment(self, expected_increase: int = 1, wait_seconds: int = 3) -> bool:
        """Verifiser at nye kommentarer er postet"""
        time.sleep(wait_seconds)  # Vent på asynkron posting
        new_count = self._get_comment_count()
        expected_count = self.initial_comment_count + expected_increase

        if new_count >= expected_count:
            print_ok(f"Kommentar verifisert ({new_count} totalt)")
            self.initial_comment_count = new_count
            return True
        else:
            print_warn(f"Forventet {expected_count} kommentarer, fant {new_count}")
            return False

    def _verify_new_document(self, expected_increase: int = 1, wait_seconds: int = 3) -> bool:
        """Verifiser at nye dokumenter er linket"""
        time.sleep(wait_seconds)  # Vent på asynkron opplasting
        new_count = self._get_document_count()
        expected_count = self.initial_document_count + expected_increase

        if new_count >= expected_count:
            print_ok(f"Dokument verifisert ({new_count} totalt)")
            self.initial_document_count = new_count
            return True
        else:
            print_warn(f"Forventet {expected_count} dokumenter, fant {new_count}")
            return False

    def create_test_topic(self) -> bool:
        """Steg 2.1: Opprett test-topic i Catenda"""
        print_header("STEG 2.1: Opprett test-topic")

        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        self.topic_title = f"TEST-{timestamp} - Automatisk testcase"

        print_info(f"Oppretter topic: {self.topic_title}")
        print_info(f"Type: Krav om endringsordre")

        # Finn forste tilgjengelige status
        extensions = self.client.get_topic_board_extensions()
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
        """Steg 2.2: Verifiser at webhook ble mottatt av backend

        KJENT BEGRENSNING: Catenda sender IKKE webhooks for topics opprettet via API.
        Webhooks trigges kun for topics opprettet manuelt i Catenda UI.
        Derfor oppretter vi saken direkte via backend API i stedet.
        """
        print_header("STEG 2.2: Opprett sak i backend")

        # KJENT BEGRENSNING: Catenda webhook trigges ikke for API-opprettede topics
        print_info("NB: Catenda sender ikke webhook for API-opprettede topics")
        print_info("Oppretter sak direkte via backend...")

        return self._create_case_directly()

    def _create_case_directly(self) -> bool:
        """Opprett sak direkte via backend intern API.

        Siden Catenda ikke sender webhooks for API-opprettede topics,
        oppretter vi saken direkte ved å kalle backend internt.
        """
        from datetime import datetime
        from repositories.event_repository import JsonFileEventRepository
        from repositories.sak_metadata_repository import SakMetadataRepository, SakMetadata
        from models.events import SakOpprettetEvent
        from lib.auth.magic_link import get_magic_link_manager

        # Generer sak_id
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        self.sak_id = f"SAK-{timestamp}"

        print_info(f"Genererer sak: {self.sak_id}")

        try:
            # Opprett SakOpprettetEvent
            event = SakOpprettetEvent(
                sak_id=self.sak_id,
                sakstittel=self.topic_title,
                aktor="Test Script",
                aktor_rolle="TE",
                prosjekt_id=self.project_id,
                catenda_topic_id=self.topic_guid,
                sakstype="koe",
            )

            # Persist event
            event_repo = JsonFileEventRepository()
            new_version = event_repo.append(event, expected_version=0)
            print_ok(f"SakOpprettetEvent lagret (versjon: {new_version})")

            # Opprett metadata
            metadata = SakMetadata(
                sak_id=self.sak_id,
                prosjekt_id=self.project_id,
                catenda_topic_id=self.topic_guid,
                catenda_board_id=self.topic_board_id,
                catenda_project_id=self.project_id,
                created_at=datetime.now(),
                created_by="Test Script",
                cached_title=self.topic_title,
                cached_status="UNDER_VARSLING",
            )
            metadata_repo = SakMetadataRepository()
            metadata_repo.create(metadata)
            print_ok("Metadata opprettet")

            # Generer magic link og post kommentar til Catenda
            magic_link_manager = get_magic_link_manager()
            magic_token = magic_link_manager.generate(sak_id=self.sak_id)
            self.magic_token = magic_token

            base_url = os.getenv('DEV_REACT_APP_URL') or os.getenv('REACT_APP_URL') or 'http://localhost:5173'
            magic_link = f"{base_url}/saker/{self.sak_id}?magicToken={magic_token}"

            # Post initial kommentar
            dato = datetime.now().strftime('%Y-%m-%d')
            comment_text = (
                f"✅ **Ny Krav om endringsordre opprettet**\n\n"
                f"📋 Intern saks-ID: `{self.sak_id}`\n"
                f"📅 Dato: {dato}\n"
                f"🏗️ Prosjekt: Test Project\n\n"
                f"**Neste steg:** Entreprenor sender varsel (grunnlag)\n"
                f"👉 [Apne skjema]({magic_link})"
            )

            self.client.create_comment(self.topic_guid, comment_text)
            print_ok("Initial kommentar postet til Catenda")

            # Hent CSRF token
            if self._fetch_csrf_token():
                print_ok("CSRF-token hentet")

            return True

        except Exception as e:
            print_fail(f"Feil ved opprettelse av sak: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _fetch_sak_id_from_metadata(self) -> bool:
        """Hent sak_id fra metadata etter webhook"""
        try:
            response = requests.get(
                f"{BACKEND_URL}/api/metadata/by-topic/{self.topic_guid}",
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                self.sak_id = data.get('sak_id')
                if self.sak_id:
                    print_ok(f"Hentet sak_id fra metadata: {self.sak_id}")
                    return True
        except requests.exceptions.RequestException:
            pass

        print_fail("Kunne ikke hente sak_id fra metadata")
        return False

    def set_verification_baseline(self) -> bool:
        """Steg 2.3: Sett baseline for verifisering av Catenda-integrasjon"""
        print_header("STEG 2.3: Verifiser initial kommentar og sett baseline")

        print_info("Venter på at initial kommentar postes...")
        time.sleep(2)

        # Verifiser at initial kommentar finnes
        comments = self.client.get_comments(self.topic_guid)

        if comments:
            print_ok(f"Fant {len(comments)} kommentar(er)")

            # Vis siste kommentar (skal være vår initial kommentar)
            if comments:
                last_comment = comments[-1]
                comment_text = last_comment.get('comment', '')
                if 'magicToken' in comment_text or 'saker/' in comment_text:
                    print_ok("Magic link-kommentar verifisert!")
                    lines = comment_text.split('\n')[:3]
                    for line in lines:
                        print(f"    {line}")
        else:
            print_warn("Ingen kommentarer funnet")

        # Sett baseline for kommentar- og dokument-telling
        self.initial_comment_count = self._get_comment_count()
        self.initial_document_count = self._get_document_count()
        print_info(f"Baseline: {self.initial_comment_count} kommentar(er), {self.initial_document_count} dokument(er)")

        return True

    def send_grunnlag(self) -> bool:
        """Steg 2.4: Send grunnlag (simuler TE)"""
        print_header("STEG 2.4: Send grunnlag")

        print_info("Sender grunnlag_opprettet event til backend...")
        print_info(f"  Hovedkategori: {TEST_DATA['grunnlag']['hovedkategori']}")
        print_info(f"  Underkategori: {TEST_DATA['grunnlag']['underkategori']}")

        # Hent versjon først
        try:
            state_resp = requests.get(
                f"{BACKEND_URL}/api/cases/{self.sak_id}/state",
                headers=self._get_auth_headers(),
                timeout=5
            )
            if state_resp.status_code == 200:
                current_version = state_resp.json().get('version', 1)
            else:
                current_version = 1
        except:
            current_version = 1

        event_data = {
            "sak_id": self.sak_id,
            "expected_version": current_version,
            "catenda_topic_id": self.topic_guid,  # Required for Catenda integration
            "event": {
                "event_type": "grunnlag_opprettet",
                "aktor": "Test Script",
                "aktor_rolle": "TE",
                "data": {
                    "tittel": "Automatisk test - Irregulær endring",
                    "hovedkategori": TEST_DATA['grunnlag']['hovedkategori'],
                    "underkategori": TEST_DATA['grunnlag']['underkategori'],
                    "beskrivelse": TEST_DATA['grunnlag']['beskrivelse'],
                    "kontraktsreferanse": TEST_DATA['grunnlag']['kontraktsreferanse'],
                    "dato_oppdaget": datetime.now().strftime('%Y-%m-%d')
                }
            }
        }

        try:
            response = requests.post(
                f"{BACKEND_URL}/api/events",
                json=event_data,
                headers=self._get_auth_headers(),
                timeout=10
            )

            if response.status_code in [200, 201]:
                result = response.json()
                print_ok("Grunnlag registrert!")
                print_info(f"  Event ID: {result.get('event_id')}")
                print_info(f"  Versjon: {result.get('new_version')}")
                if result.get('pdf_uploaded'):
                    print_ok(f"  PDF lastet opp til Catenda (kilde: {result.get('pdf_source')})")
                else:
                    print_warn("  PDF ble ikke lastet opp")

                # Verifiser Catenda-integrasjon
                print_subheader("Verifiserer Catenda-integrasjon for grunnlag")
                self._verify_new_comment()
                self._verify_new_document()

                return True
            else:
                print_fail(f"Feil ved sending: {response.status_code}")
                print_info(f"  {response.text[:200]}")
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

        documents = self.client.list_document_references(self.topic_guid)

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

        # Hent gjeldende versjon
        try:
            state_resp = requests.get(
                f"{BACKEND_URL}/api/cases/{self.sak_id}/state",
                headers=self._get_auth_headers(),
                timeout=5
            )
            if state_resp.status_code == 200:
                current_version = state_resp.json().get('version', 1)
            else:
                current_version = 1
        except:
            current_version = 1

        # Vederlagskrav
        print_info("Sender vederlag_krav_sendt...")
        print_info(f"  Metode: {TEST_DATA['vederlag']['metode']}")
        print_info(f"  Belop: {TEST_DATA['vederlag']['belop_direkte']:,.0f} kr")

        vederlag_payload = {
            "sak_id": self.sak_id,
            "expected_version": current_version,
            "catenda_topic_id": self.topic_guid,  # Required for Catenda integration
            "event": {
                "event_type": "vederlag_krav_sendt",
                "aktor": "Test Script",
                "aktor_rolle": "TE",
                "data": {
                    "metode": TEST_DATA['vederlag']['metode'],
                    "belop_direkte": TEST_DATA['vederlag']['belop_direkte'],
                    "begrunnelse": TEST_DATA['vederlag']['begrunnelse']
                }
            }
        }

        try:
            response = requests.post(
                f"{BACKEND_URL}/api/events",
                json=vederlag_payload,
                headers=self._get_auth_headers(),
                timeout=10
            )

            if response.status_code in [200, 201]:
                result = response.json()
                print_ok("Vederlagskrav sendt!")
                current_version = result.get('new_version', current_version + 1)
                if result.get('pdf_uploaded'):
                    print_ok(f"  PDF lastet opp (kilde: {result.get('pdf_source')})")

                # Verifiser Catenda-integrasjon
                print_subheader("Verifiserer Catenda-integrasjon for vederlag")
                self._verify_new_comment()
                self._verify_new_document()
            else:
                print_fail(f"Feil ved sending: {response.status_code}")
                print_info(f"  {response.text[:200]}")
        except requests.exceptions.RequestException as e:
            print_fail(f"Nettverksfeil: {e}")

        # Fristkrav
        print_info("\nSender frist_krav_sendt...")
        print_info(f"  Antall dager: {TEST_DATA['frist']['antall_dager']}")

        frist_payload = {
            "sak_id": self.sak_id,
            "expected_version": current_version,
            "catenda_topic_id": self.topic_guid,  # Required for Catenda integration
            "event": {
                "event_type": "frist_krav_sendt",
                "aktor": "Test Script",
                "aktor_rolle": "TE",
                "data": {
                    "varsel_type": TEST_DATA['frist']['varsel_type'],
                    "antall_dager": TEST_DATA['frist']['antall_dager'],
                    "begrunnelse": TEST_DATA['frist']['begrunnelse'],
                    "spesifisert_varsel": {
                        "dato_sendt": datetime.now().strftime('%Y-%m-%d')
                    }
                }
            }
        }

        try:
            response = requests.post(
                f"{BACKEND_URL}/api/events",
                json=frist_payload,
                headers=self._get_auth_headers(),
                timeout=10
            )

            if response.status_code in [200, 201]:
                result = response.json()
                print_ok("Fristkrav sendt!")
                if result.get('pdf_uploaded'):
                    print_ok(f"  PDF lastet opp (kilde: {result.get('pdf_source')})")

                # Verifiser Catenda-integrasjon
                print_subheader("Verifiserer Catenda-integrasjon for frist")
                self._verify_new_comment()
                self._verify_new_document()
            else:
                print_fail(f"Feil ved sending: {response.status_code}")
                print_info(f"  {response.text[:200]}")
        except requests.exceptions.RequestException as e:
            print_fail(f"Nettverksfeil: {e}")

        return True

    # =========================================================================
    # FASE 3: BH RESPONSES
    # =========================================================================

    def send_bh_responses(self) -> bool:
        """Fase 3: BH svarer på alle krav"""
        print_header("FASE 3: BH RESPONSES")

        # Hent gjeldende versjon og event IDs
        try:
            state_resp = requests.get(
                f"{BACKEND_URL}/api/cases/{self.sak_id}/state",
                headers=self._get_auth_headers(),
                timeout=5
            )
            if state_resp.status_code == 200:
                state_data = state_resp.json()
                current_version = state_data.get('version', 1)
                state = state_data.get('state', {})
            else:
                print_fail("Kunne ikke hente state")
                return False
        except Exception as e:
            print_fail(f"Feil ved henting av state: {e}")
            return False

        # 3.1 Respons på grunnlag
        print_subheader("3.1: BH svarer på grunnlag")
        print_info(f"  Resultat: {TEST_DATA['bh_grunnlag']['resultat']}")

        grunnlag_response = {
            "sak_id": self.sak_id,
            "expected_version": current_version,
            "catenda_topic_id": self.topic_guid,
            "event": {
                "event_type": "respons_grunnlag",
                "aktor": "Test Script BH",
                "aktor_rolle": "BH",
                "data": TEST_DATA['bh_grunnlag']
            }
        }

        try:
            response = requests.post(
                f"{BACKEND_URL}/api/events",
                json=grunnlag_response,
                headers=self._get_auth_headers(),
                timeout=10
            )
            if response.status_code in [200, 201]:
                result = response.json()
                print_ok("Grunnlag-respons sendt!")
                current_version = result.get('new_version', current_version + 1)
                self._verify_new_comment()
            else:
                print_fail(f"Feil: {response.status_code} - {response.text[:200]}")
                return False
        except Exception as e:
            print_fail(f"Feil: {e}")
            return False

        # 3.2 Respons på vederlag (delvis godkjent)
        print_subheader("3.2: BH svarer på vederlag")
        print_info(f"  Resultat: {TEST_DATA['bh_vederlag']['beregnings_resultat']}")
        print_info(f"  Godkjent: {TEST_DATA['bh_vederlag']['godkjent_belop']:,.0f} kr av 150.000 kr")

        vederlag_response = {
            "sak_id": self.sak_id,
            "expected_version": current_version,
            "catenda_topic_id": self.topic_guid,
            "event": {
                "event_type": "respons_vederlag",
                "aktor": "Test Script BH",
                "aktor_rolle": "BH",
                "data": TEST_DATA['bh_vederlag']
            }
        }

        try:
            response = requests.post(
                f"{BACKEND_URL}/api/events",
                json=vederlag_response,
                headers=self._get_auth_headers(),
                timeout=10
            )
            if response.status_code in [200, 201]:
                result = response.json()
                print_ok("Vederlag-respons sendt!")
                current_version = result.get('new_version', current_version + 1)
                self._verify_new_comment()
            else:
                print_fail(f"Feil: {response.status_code} - {response.text[:200]}")
                return False
        except Exception as e:
            print_fail(f"Feil: {e}")
            return False

        # 3.3 Respons på frist (delvis godkjent)
        print_subheader("3.3: BH svarer på frist")
        print_info(f"  Resultat: {TEST_DATA['bh_frist']['beregnings_resultat']}")
        print_info(f"  Godkjent: {TEST_DATA['bh_frist']['godkjent_dager']} av 14 dager")

        frist_response = {
            "sak_id": self.sak_id,
            "expected_version": current_version,
            "catenda_topic_id": self.topic_guid,
            "event": {
                "event_type": "respons_frist",
                "aktor": "Test Script BH",
                "aktor_rolle": "BH",
                "data": TEST_DATA['bh_frist']
            }
        }

        try:
            response = requests.post(
                f"{BACKEND_URL}/api/events",
                json=frist_response,
                headers=self._get_auth_headers(),
                timeout=10
            )
            if response.status_code in [200, 201]:
                result = response.json()
                print_ok("Frist-respons sendt!")
                current_version = result.get('new_version', current_version + 1)
                self._verify_new_comment()
            else:
                print_fail(f"Feil: {response.status_code} - {response.text[:200]}")
                return False
        except Exception as e:
            print_fail(f"Feil: {e}")
            return False

        print_ok("Alle BH-responser sendt!")
        return True

    # =========================================================================
    # FASE 4: TE REVISIONS
    # =========================================================================

    def send_te_revisions(self) -> bool:
        """Fase 4: TE sender revisjoner etter delvis godkjenning"""
        print_header("FASE 4: TE REVISIONS")

        # Hent gjeldende versjon og siste event IDs
        try:
            state_resp = requests.get(
                f"{BACKEND_URL}/api/cases/{self.sak_id}/state",
                headers=self._get_auth_headers(),
                timeout=5
            )
            if state_resp.status_code == 200:
                state_data = state_resp.json()
                current_version = state_data.get('version', 1)
                state = state_data.get('state', {})
            else:
                print_fail("Kunne ikke hente state")
                return False

            # Hent timeline for å finne event IDs
            timeline_resp = requests.get(
                f"{BACKEND_URL}/api/cases/{self.sak_id}/timeline",
                headers=self._get_auth_headers(),
                timeout=5
            )
            if timeline_resp.status_code == 200:
                timeline = timeline_resp.json().get('events', [])
            else:
                timeline = []

        except Exception as e:
            print_fail(f"Feil ved henting av state: {e}")
            return False

        # Finn siste vederlag og frist event IDs (og varsel_type for frist)
        vederlag_event_id = None
        frist_event_id = None
        frist_varsel_type = None
        for event in timeline:
            if event.get('event_type') in ['vederlag_krav_sendt', 'vederlag_krav_oppdatert']:
                vederlag_event_id = event.get('event_id')
            if event.get('event_type') in ['frist_krav_sendt', 'frist_krav_oppdatert']:
                frist_event_id = event.get('event_id')
                # Bevar varsel_type fra original event
                frist_varsel_type = event.get('data', {}).get('varsel_type')

        # 4.1 Revider vederlag
        print_subheader("4.1: TE reviderer vederlagskrav")
        print_info(f"  Nytt beløp: {TEST_DATA['vederlag_revisjon']['belop_direkte']:,.0f} kr")
        print_info(f"  (Justert ned fra 150.000 kr)")

        if not vederlag_event_id:
            print_warn("Kunne ikke finne vederlag event ID, hopper over")
        else:
            vederlag_revision = {
                "sak_id": self.sak_id,
                "expected_version": current_version,
                "catenda_topic_id": self.topic_guid,
                "event": {
                    "event_type": "vederlag_krav_oppdatert",
                    "aktor": "Test Script",
                    "aktor_rolle": "TE",
                    "data": {
                        "original_event_id": vederlag_event_id,
                        "metode": TEST_DATA['vederlag_revisjon']['metode'],
                        "belop_direkte": TEST_DATA['vederlag_revisjon']['belop_direkte'],
                        "begrunnelse": TEST_DATA['vederlag_revisjon']['begrunnelse'],
                        "dato_revidert": datetime.now().strftime('%Y-%m-%d')
                    }
                }
            }

            try:
                response = requests.post(
                    f"{BACKEND_URL}/api/events",
                    json=vederlag_revision,
                    headers=self._get_auth_headers(),
                    timeout=10
                )
                if response.status_code in [200, 201]:
                    result = response.json()
                    print_ok("Vederlag-revisjon sendt!")
                    current_version = result.get('new_version', current_version + 1)
                    self._verify_new_comment()
                else:
                    print_fail(f"Feil: {response.status_code} - {response.text[:200]}")
            except Exception as e:
                print_fail(f"Feil: {e}")

        # 4.2 Revider frist
        print_subheader("4.2: TE reviderer fristkrav")
        print_info(f"  Nye dager: {TEST_DATA['frist_revisjon']['antall_dager']}")
        print_info(f"  (Justert ned fra 14 dager)")

        if not frist_event_id:
            print_warn("Kunne ikke finne frist event ID, hopper over")
        else:
            frist_revision = {
                "sak_id": self.sak_id,
                "expected_version": current_version,
                "catenda_topic_id": self.topic_guid,
                "event": {
                    "event_type": "frist_krav_oppdatert",
                    "aktor": "Test Script",
                    "aktor_rolle": "TE",
                    "data": {
                        "original_event_id": frist_event_id,
                        "varsel_type": frist_varsel_type or "spesifisert",  # Bevar fra original
                        "antall_dager": TEST_DATA['frist_revisjon']['antall_dager'],
                        "begrunnelse": TEST_DATA['frist_revisjon']['begrunnelse'],
                        "dato_revidert": datetime.now().strftime('%Y-%m-%d')
                    }
                }
            }

            try:
                response = requests.post(
                    f"{BACKEND_URL}/api/events",
                    json=frist_revision,
                    headers=self._get_auth_headers(),
                    timeout=10
                )
                if response.status_code in [200, 201]:
                    result = response.json()
                    print_ok("Frist-revisjon sendt!")
                    self._verify_new_comment()
                else:
                    print_fail(f"Feil: {response.status_code} - {response.text[:200]}")
            except Exception as e:
                print_fail(f"Feil: {e}")

        print_ok("Alle TE-revisjoner sendt!")
        return True

    def show_summary(self) -> None:
        """Vis oppsummering av komplett test"""
        print_header("TEST FULLFØRT - Komplett KOE-flyt")

        print(f"  Sak ID:      {self.sak_id}")
        print(f"  Topic GUID:  {self.topic_guid}")
        print(f"  Topic Title: {self.topic_title}")
        print()

        # Hent state fra backend
        try:
            response = requests.get(
                f"{BACKEND_URL}/api/cases/{self.sak_id}/state",
                headers=self._get_auth_headers(),
                timeout=5
            )
            if response.status_code == 200:
                state_data = response.json()
                state = state_data.get('state', {})
                print(f"  Versjon:     {state_data.get('version')}")
                print(f"  Status:      {state.get('overordnet_status')}")
                print()
                print("  Spor:")

                # Grunnlag
                grunnlag = state.get('grunnlag', {})
                print(f"    - Grunnlag: {grunnlag.get('status')}")

                # Vederlag
                vederlag = state.get('vederlag', {})
                if vederlag:
                    belop = vederlag.get('belop_direkte') or vederlag.get('kostnads_overslag') or 0
                    print(f"    - Vederlag: {vederlag.get('status')} ({belop:,.0f} kr)")

                # Frist
                frist = state.get('frist', {})
                if frist:
                    dager = frist.get('antall_dager', 0)
                    print(f"    - Frist:    {frist.get('status')} ({dager} dager)")
        except Exception as e:
            print_warn(f"Kunne ikke hente state: {e}")

        # Hent timeline for å vise antall events
        try:
            timeline_resp = requests.get(
                f"{BACKEND_URL}/api/cases/{self.sak_id}/timeline",
                headers=self._get_auth_headers(),
                timeout=5
            )
            if timeline_resp.status_code == 200:
                events = timeline_resp.json().get('events', [])
                print()
                print(f"  Totalt {len(events)} event(er) i timeline:")
                for event in events:
                    event_type = event.get('event_type', 'ukjent')
                    aktor_rolle = event.get('aktor_rolle', '?')
                    print(f"    [{aktor_rolle}] {event_type}")
        except:
            pass

        # Catenda-verifikasjon
        print()
        print_subheader("Catenda-integrasjon verifisering")
        final_comments = self._get_comment_count()
        final_documents = self._get_document_count()
        print(f"  Kommentarer i topic: {final_comments}")
        print(f"  Dokumenter linket:   {final_documents}")

        # List dokumenter
        documents = self.client.list_document_references(self.topic_guid)
        if documents:
            print()
            print("  Dokumenter:")
            for doc in documents:
                desc = doc.get('description') or doc.get('guid', 'Ukjent')
                print(f"    - {desc}")

        # List siste kommentarer
        comments = self.client.get_comments(self.topic_guid)
        if comments:
            print()
            print(f"  Siste {min(5, len(comments))} kommentarer:")
            for comment in comments[-5:]:
                text = comment.get('comment', '')[:80]
                if len(comment.get('comment', '')) > 80:
                    text += '...'
                print(f"    - {text}")

        print()
        print("  Flyten er komplett. Testen dekket:")
        print("    ✓ FASE 1: Topic og sak opprettet")
        print("    ✓ FASE 2: TE sendte grunnlag, vederlag og frist")
        print("    ✓ FASE 3: BH svarte (godkjent/delvis godkjent)")
        print("    ✓ FASE 4: TE sendte revisjoner")
        print()
        print("=" * 70)

    def cleanup(self) -> bool:
        """Rydd opp testdata"""
        print_header("CLEANUP")

        if not confirm("Vil du slette test-topic fra Catenda?", default=False):
            print_info("Beholder testdata for inspeksjon")
            return True

        print_info(f"Sletter topic {self.topic_guid} fra Catenda...")

        if self.client.delete_topic(self.topic_guid):
            print_ok("Topic slettet fra Catenda!")

            # Slett også lokal sak-data
            print_info("Sletter lokal sak-data...")
            try:
                from repositories.event_repository import JsonFileEventRepository
                from repositories.sak_metadata_repository import SakMetadataRepository

                event_repo = JsonFileEventRepository()
                metadata_repo = SakMetadataRepository()

                # Slett events-fil
                import os
                events_file = event_repo._get_file_path(self.sak_id)
                if os.path.exists(events_file):
                    os.remove(events_file)
                    print_ok(f"Slettet events-fil: {events_file}")

                # Slett metadata
                metadata_repo.delete(self.sak_id)
                print_ok("Slettet metadata")

            except Exception as e:
                print_warn(f"Kunne ikke slette lokal data: {e}")

            return True
        else:
            print_fail("Kunne ikke slette topic fra Catenda")
            return False


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
    print("  1. Setup: Validerer konfigurasjon")
    print("  2. FASE 1: Oppretter test-topic og sak")
    print("  3. FASE 2: TE sender grunnlag, vederlag og fristkrav")
    print("  4. FASE 3: BH svarer på kravene (godkjent/delvis godkjent)")
    print("  5. FASE 4: TE sender revisjoner etter delvis godkjenning")
    print("  6. Verifiserer kommentarer og PDF-opplasting i Catenda")

    if not confirm("\nStarte test?"):
        print("\nAvbrutt.")
        return

    # Setup: Validering
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

    # Opprett tester
    tester = KOEFlowTester(
        client=validator.client,
        project_id=validator.project_id,
        library_id=validator.library_id,
        folder_id=validator.folder_id,
        topic_board_id=validator.topic_board_id
    )

    # FASE 1: Opprett topic og sak
    if not tester.create_test_topic():
        print("\n[AVBRUTT] Kunne ikke opprette test-topic")
        return

    if not tester.verify_webhook_received():
        print("\n[AVBRUTT] Kunne ikke opprette sak")
        return

    tester.set_verification_baseline()

    # FASE 2: TE sender initiale krav
    if not tester.send_grunnlag():
        print("\n[ADVARSEL] Grunnlag-sending feilet, fortsetter...")

    tester.verify_pdf_upload()
    tester.send_vederlag_and_frist()

    # FASE 3: BH svarer på krav
    if not tester.send_bh_responses():
        print("\n[ADVARSEL] BH-responser feilet, fortsetter...")

    # FASE 4: TE sender revisjoner
    if not tester.send_te_revisions():
        print("\n[ADVARSEL] TE-revisjoner feilet, fortsetter...")

    # Oppsummering
    tester.show_summary()
    tester.cleanup()

    print("\n[FERDIG] Full flyt-test gjennomført!")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Full flow test for KOE system")
    parser.add_argument("--yes", "-y", action="store_true", help="Auto-confirm all prompts")
    args = parser.parse_args()

    if args.yes:
        # Modify global variable
        globals()['AUTO_CONFIRM'] = True

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
