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
    ("Venter på svar", "open"),
    ("Under behandling", "open"),
    ("Under forhandling", "open"),
    ("Omforent", "closed"),
    ("Lukket", "closed")
]

REQUIRED_CUSTOM_FIELDS = [
    "Byggherre",
    "Leverandør"
]

# Testverdier for komplett KOE-flyt
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
        "total_godkjent_belop": 100000.0,  # 100k av 150k
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

# Testverdier for forsering-flyt (§33.8)
FORSERING_TEST_DATA = {
    # To KOE-saker med fristkrav som vil bli avslått
    "koe_saker": [
        {
            "tittel": "Forsering-test KOE-1",
            "grunnlag": {
                "hovedkategori": "ENDRING",
                "underkategori": "EO",
                "beskrivelse": "KOE-1 for forseringstest - formell endringsordre",
                "kontraktsreferanse": "31.3"
            },
            "frist": {
                "varsel_type": "spesifisert",
                "antall_dager": 14,
                "begrunnelse": "Fristkrav KOE-1"
            }
        },
        {
            "tittel": "Forsering-test KOE-2",
            "grunnlag": {
                "hovedkategori": "ENDRING",
                "underkategori": "IRREG",
                "beskrivelse": "KOE-2 for forseringstest - irregulær endring",
                "kontraktsreferanse": "32.1"
            },
            "frist": {
                "varsel_type": "spesifisert",
                "antall_dager": 10,
                "begrunnelse": "Fristkrav KOE-2"
            }
        }
    ],

    # BH avslag på frist (brukes for alle KOE-saker)
    "bh_frist_avslag": {
        "beregnings_resultat": "avslatt",
        "spesifisert_krav_ok": False,
        "vilkar_oppfylt": False,
        "begrunnelse": "Fristkrav avslås - ingen grunnlag for forlengelse"
    },

    # Forsering-data
    "forsering": {
        "dagmulktsats": 50000.0,  # 50k kr/dag
        "estimert_kostnad": 1200000.0,  # 1.2M kr (under 1.56M grensen)
        "begrunnelse": "Iverksetter forsering iht. NS 8407 §33.8"
    },

    # BH aksept av forsering
    "bh_forsering_aksept": {
        "aksepterer": True,
        "godkjent_kostnad": 1200000.0,
        "begrunnelse": "Aksepterer forseringskostnad"
    }
}

# Testverdier for endringsordre-flyt (§31.3)
EO_TEST_DATA = {
    # To KOE-saker som skal samles
    "koe_saker": [
        {
            "tittel": "EO-test KOE-1",
            "grunnlag": {
                "hovedkategori": "ENDRING",
                "underkategori": "EO",
                "beskrivelse": "KOE-1 for EO-test - formell endringsordre",
                "kontraktsreferanse": "31.3"
            },
            "vederlag": {
                "metode": "ENHETSPRISER",
                "belop_direkte": 100000.0,
                "begrunnelse": "Vederlagskrav KOE-1"
            }
        },
        {
            "tittel": "EO-test KOE-2",
            "grunnlag": {
                "hovedkategori": "ENDRING",
                "underkategori": "IRREG",
                "beskrivelse": "KOE-2 for EO-test",
                "kontraktsreferanse": "32.1"
            },
            "vederlag": {
                "metode": "ENHETSPRISER",
                "belop_direkte": 75000.0,
                "begrunnelse": "Vederlagskrav KOE-2"
            }
        }
    ],

    # Endringsordre-data
    "endringsordre": {
        "eo_nummer": "EO-001",
        "beskrivelse": "Samler endringskrav fra KOE-1 og KOE-2",
        "konsekvenser": {
            "sha": False,
            "kvalitet": False,
            "fremdrift": True,
            "pris": True,
            "annet": False
        },
        "kompensasjon_belop": 175000.0,  # Sum av KOE-saker
        "frist_dager": 7,
        "oppgjorsform": "ENHETSPRISER"
    },

    # TE aksept
    "te_aksept": {
        "akseptert": True,
        "kommentar": "Aksepterer endringsordre"
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
# BASE TESTER - Gjenbrukbar logikk for alle flyttyper
# =============================================================================

class BaseTester:
    """Gjenbrukbar testlogikk for alle flyttyper (KOE, Forsering, EO)"""

    def __init__(self, client: CatendaClient, project_id: str,
                 library_id: Optional[str], folder_id: Optional[str],
                 topic_board_id: str):
        self.client = client
        self.project_id = project_id
        self.library_id = library_id
        self.folder_id = folder_id
        self.topic_board_id = topic_board_id
        self.csrf_token: Optional[str] = None

    # =========================================================================
    # Auth & CSRF
    # =========================================================================

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

    def _get_auth_headers(self, magic_token: Optional[str] = None) -> Dict[str, str]:
        """Bygg headers med CSRF og magic token (Bearer format)"""
        headers = {"Content-Type": "application/json"}
        if self.csrf_token:
            headers["X-CSRF-Token"] = self.csrf_token
        if magic_token:
            headers["Authorization"] = f"Bearer {magic_token}"
        return headers

    # =========================================================================
    # PDF-verifisering
    # =========================================================================

    def verify_pdf_upload(self, topic_guid: str) -> bool:
        """Verifiser PDF-generering og opplasting for et topic"""
        print_header("Verifiser PDF")

        if not self.library_id:
            print_warn("Inget bibliotek konfigurert - hopper over PDF-sjekk")
            return True

        print_info("Sjekker dokumentreferanser på topic...")

        # Vent på asynkron PDF-generering
        time.sleep(3)

        documents = self.client.list_document_references(topic_guid)

        if documents:
            print_ok(f"Fant {len(documents)} dokument(er) lenket til topic")
            for doc in documents:
                print_info(f"  - {doc.get('description', 'Ukjent')} ({doc.get('guid')})")
        else:
            print_warn("Ingen dokumenter funnet ennå")
            print_info("PDF-generering kan ta noen sekunder")

        return True

    # =========================================================================
    # Catenda-integrasjon
    # =========================================================================

    def _create_topic(self, title: str, topic_type: str, description: str,
                      initial_status: Optional[str] = None) -> Optional[str]:
        """Opprett topic i Catenda og returner GUID"""
        # Finn første tilgjengelige status hvis ikke spesifisert
        if not initial_status:
            extensions = self.client.get_topic_board_extensions()
            if extensions:
                statuses = extensions.get('topic_status', [])
                if 'Under varsling' in statuses:
                    initial_status = 'Under varsling'
                elif statuses:
                    initial_status = statuses[0]

        result = self.client.create_topic(
            title=title,
            description=description,
            topic_type=topic_type,
            topic_status=initial_status
        )

        if result:
            return result.get('guid')
        return None

    def _create_case_directly(self, topic_guid: str, topic_title: str,
                              sakstype: str = "koe") -> Tuple[Optional[str], Optional[str]]:
        """
        Opprett sak direkte via backend.

        Returns:
            Tuple[sak_id, magic_token] eller (None, None) ved feil
        """
        from datetime import datetime
        from repositories.event_repository import JsonFileEventRepository
        from repositories.sak_metadata_repository import SakMetadataRepository, SakMetadata
        from models.events import SakOpprettetEvent
        from lib.auth.magic_link import get_magic_link_manager

        # Generer sak_id
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        sak_id = f"SAK-{timestamp}"

        print_info(f"Genererer sak: {sak_id} (type: {sakstype})")

        try:
            # Opprett SakOpprettetEvent
            event = SakOpprettetEvent(
                sak_id=sak_id,
                sakstittel=topic_title,
                aktor="Test Script",
                aktor_rolle="TE",
                prosjekt_id=self.project_id,
                catenda_topic_id=topic_guid,
                sakstype=sakstype,
            )

            # Persist event
            event_repo = JsonFileEventRepository()
            new_version = event_repo.append(event, expected_version=0)
            print_ok(f"SakOpprettetEvent lagret (versjon: {new_version})")

            # Opprett metadata
            metadata = SakMetadata(
                sak_id=sak_id,
                prosjekt_id=self.project_id,
                catenda_topic_id=topic_guid,
                catenda_board_id=self.topic_board_id,
                catenda_project_id=self.project_id,
                created_at=datetime.now(),
                created_by="Test Script",
                cached_title=topic_title,
                cached_status="UNDER_VARSLING",
            )
            metadata_repo = SakMetadataRepository()
            metadata_repo.create(metadata)
            print_ok("Metadata opprettet")

            # Generer magic link og post kommentar til Catenda
            magic_link_manager = get_magic_link_manager()
            magic_token = magic_link_manager.generate(sak_id=sak_id)

            base_url = os.getenv('DEV_REACT_APP_URL') or os.getenv('REACT_APP_URL') or 'http://localhost:5173'

            # Bruk riktig frontend-rute basert på sakstype
            frontend_routes = {
                "standard": f"/saker/{sak_id}",
                "koe": f"/saker/{sak_id}",
                "forsering": f"/forsering/{sak_id}",
                "endringsordre": f"/endringsordre/{sak_id}"
            }
            frontend_route = frontend_routes.get(sakstype, f"/saker/{sak_id}")
            magic_link = f"{base_url}{frontend_route}?magicToken={magic_token}"

            # Post initial kommentar
            dato = datetime.now().strftime('%Y-%m-%d')
            sakstype_label = {
                "koe": "Krav om endringsordre",
                "standard": "Krav om endringsordre",
                "forsering": "Forseringssak",
                "endringsordre": "Endringsordre"
            }.get(sakstype, sakstype)

            comment_text = (
                f"**Ny {sakstype_label} opprettet**\n\n"
                f"Intern saks-ID: `{sak_id}`\n"
                f"Dato: {dato}\n\n"
                f"[Apne skjema]({magic_link})"
            )

            self.client.create_comment(topic_guid, comment_text)
            print_ok("Initial kommentar postet til Catenda")

            # Hent CSRF token
            if self._fetch_csrf_token():
                print_ok("CSRF-token hentet")

            return sak_id, magic_token

        except Exception as e:
            print_fail(f"Feil ved opprettelse av sak: {e}")
            import traceback
            traceback.print_exc()
            return None, None

    # =========================================================================
    # Verifikasjon av Catenda-integrasjon
    # =========================================================================

    def _get_comment_count(self, topic_guid: str) -> int:
        """Hent antall kommentarer på topic"""
        comments = self.client.get_comments(topic_guid)
        return len(comments) if comments else 0

    def _get_document_count(self, topic_guid: str) -> int:
        """Hent antall dokumenter linket til topic"""
        documents = self.client.list_document_references(topic_guid)
        return len(documents) if documents else 0

    def _verify_new_comment(self, topic_guid: str, baseline: int,
                           expected_increase: int = 1, wait_seconds: int = 3) -> Tuple[bool, int]:
        """
        Verifiser at nye kommentarer er postet.

        Returns:
            Tuple[success, new_count]
        """
        time.sleep(wait_seconds)
        new_count = self._get_comment_count(topic_guid)
        expected_count = baseline + expected_increase

        if new_count >= expected_count:
            print_ok(f"Kommentar verifisert ({new_count} totalt)")
            return True, new_count
        else:
            print_warn(f"Forventet {expected_count} kommentarer, fant {new_count}")
            return False, new_count

    def _verify_new_document(self, topic_guid: str, baseline: int,
                            expected_increase: int = 1, wait_seconds: int = 3) -> Tuple[bool, int]:
        """
        Verifiser at nye dokumenter er linket.

        Returns:
            Tuple[success, new_count]
        """
        time.sleep(wait_seconds)
        new_count = self._get_document_count(topic_guid)
        expected_count = baseline + expected_increase

        if new_count >= expected_count:
            print_ok(f"Dokument verifisert ({new_count} totalt)")
            return True, new_count
        else:
            print_warn(f"Forventet {expected_count} dokumenter, fant {new_count}")
            return False, new_count

    # =========================================================================
    # State-håndtering
    # =========================================================================

    def _get_state_and_version(self, sak_id: str, magic_token: str) -> Tuple[Optional[Dict], int]:
        """
        Hent state og versjon for en sak.

        Returns:
            Tuple[state_dict, version] eller (None, 1) ved feil
        """
        try:
            response = requests.get(
                f"{BACKEND_URL}/api/cases/{sak_id}/state",
                headers=self._get_auth_headers(magic_token),
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                return data.get('state', {}), data.get('version', 1)
        except requests.exceptions.RequestException:
            pass
        return None, 1

    def _send_event(self, sak_id: str, topic_guid: str, magic_token: str,
                   event_type: str, event_data: Dict[str, Any],
                   aktor: str, aktor_rolle: str,
                   expected_version: int) -> Tuple[bool, int, Optional[str]]:
        """
        Send event til backend.

        Returns:
            Tuple[success, new_version, event_id]
        """
        payload = {
            "sak_id": sak_id,
            "expected_version": expected_version,
            "catenda_topic_id": topic_guid,
            "event": {
                "event_type": event_type,
                "aktor": aktor,
                "aktor_rolle": aktor_rolle,
                "data": event_data
            }
        }

        try:
            response = requests.post(
                f"{BACKEND_URL}/api/events",
                json=payload,
                headers=self._get_auth_headers(magic_token),
                timeout=10
            )

            if response.status_code in [200, 201]:
                result = response.json()
                new_version = result.get('new_version', expected_version + 1)
                event_id = result.get('event_id')
                if result.get('pdf_uploaded'):
                    print_ok(f"  PDF lastet opp (kilde: {result.get('pdf_source')})")
                return True, new_version, event_id
            else:
                print_fail(f"Feil ved sending: {response.status_code}")
                print_info(f"  {response.text[:200]}")
                return False, expected_version, None

        except requests.exceptions.RequestException as e:
            print_fail(f"Nettverksfeil: {e}")
            return False, expected_version, None


# =============================================================================
# FASE 2: TEST STANDARD KOE-FLYT
# =============================================================================

class KOEFlowTester(BaseTester):
    """Tester standard KOE-flyt"""

    def __init__(self, client: CatendaClient, project_id: str,
                 library_id: Optional[str], folder_id: Optional[str],
                 topic_board_id: str):
        super().__init__(client, project_id, library_id, folder_id, topic_board_id)

        self.topic_guid: Optional[str] = None
        self.sak_id: Optional[str] = None
        self.topic_title: Optional[str] = None
        self.magic_token: Optional[str] = None

        # Tracking for verification
        self.initial_comment_count: int = 0
        self.initial_document_count: int = 0

    def _get_auth_headers_local(self) -> Dict[str, str]:
        """Lokale auth headers med instansens magic_token"""
        return self._get_auth_headers(self.magic_token)

    def _get_comment_count_local(self) -> int:
        """Hent antall kommentarer på instansens topic"""
        return self._get_comment_count(self.topic_guid)

    def _get_document_count_local(self) -> int:
        """Hent antall dokumenter på instansens topic"""
        return self._get_document_count(self.topic_guid)

    def _verify_new_comment_local(self, expected_increase: int = 1, wait_seconds: int = 3) -> bool:
        """Verifiser nye kommentarer og oppdater baseline"""
        success, new_count = self._verify_new_comment(
            self.topic_guid, self.initial_comment_count, expected_increase, wait_seconds
        )
        self.initial_comment_count = new_count
        return success

    def _verify_new_document_local(self, expected_increase: int = 1, wait_seconds: int = 3) -> bool:
        """Verifiser nye dokumenter og oppdater baseline"""
        success, new_count = self._verify_new_document(
            self.topic_guid, self.initial_document_count, expected_increase, wait_seconds
        )
        self.initial_document_count = new_count
        return success

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

        # Bruk BaseTester._create_case_directly()
        sak_id, magic_token = super()._create_case_directly(
            topic_guid=self.topic_guid,
            topic_title=self.topic_title,
            sakstype="koe"
        )

        if sak_id and magic_token:
            self.sak_id = sak_id
            self.magic_token = magic_token
            return True

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
        self.initial_comment_count = self._get_comment_count_local()
        self.initial_document_count = self._get_document_count_local()
        print_info(f"Baseline: {self.initial_comment_count} kommentar(er), {self.initial_document_count} dokument(er)")

        return True

    def send_grunnlag(self) -> bool:
        """Steg 2.4: Send grunnlag (simuler TE)"""
        print_header("STEG 2.4: Send grunnlag")

        print_info("Sender grunnlag_opprettet event til backend...")
        print_info(f"  Hovedkategori: {TEST_DATA['grunnlag']['hovedkategori']}")
        print_info(f"  Underkategori: {TEST_DATA['grunnlag']['underkategori']}")

        # Hent versjon først
        _, current_version = self._get_state_and_version(self.sak_id, self.magic_token)

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
                headers=self._get_auth_headers_local(),
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
                self._verify_new_comment_local()
                self._verify_new_document_local()

                return True
            else:
                print_fail(f"Feil ved sending: {response.status_code}")
                print_info(f"  {response.text[:200]}")
                return False

        except requests.exceptions.RequestException as e:
            print_fail(f"Nettverksfeil: {e}")
            return False

    def send_vederlag_and_frist(self) -> bool:
        """Steg 2.7: Send vederlag og frist"""
        print_header("STEG 2.7: Send vederlag og fristkrav")

        # Hent gjeldende versjon
        _, current_version = self._get_state_and_version(self.sak_id, self.magic_token)

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
                headers=self._get_auth_headers_local(),
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
                self._verify_new_comment_local()
                self._verify_new_document_local()
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
                headers=self._get_auth_headers_local(),
                timeout=10
            )

            if response.status_code in [200, 201]:
                result = response.json()
                print_ok("Fristkrav sendt!")
                if result.get('pdf_uploaded'):
                    print_ok(f"  PDF lastet opp (kilde: {result.get('pdf_source')})")

                # Verifiser Catenda-integrasjon
                print_subheader("Verifiserer Catenda-integrasjon for frist")
                self._verify_new_comment_local()
                self._verify_new_document_local()
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

        # Hent gjeldende versjon
        state, current_version = self._get_state_and_version(self.sak_id, self.magic_token)
        if state is None:
            print_fail("Kunne ikke hente state")
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
                headers=self._get_auth_headers_local(),
                timeout=10
            )
            if response.status_code in [200, 201]:
                result = response.json()
                print_ok("Grunnlag-respons sendt!")
                current_version = result.get('new_version', current_version + 1)
                self._verify_new_comment_local()
            else:
                print_fail(f"Feil: {response.status_code} - {response.text[:200]}")
                return False
        except Exception as e:
            print_fail(f"Feil: {e}")
            return False

        # 3.2 Respons på vederlag (delvis godkjent)
        print_subheader("3.2: BH svarer på vederlag")
        print_info(f"  Resultat: {TEST_DATA['bh_vederlag']['beregnings_resultat']}")
        print_info(f"  Godkjent: {TEST_DATA['bh_vederlag']['total_godkjent_belop']:,.0f} kr av 150.000 kr")

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
                headers=self._get_auth_headers_local(),
                timeout=10
            )
            if response.status_code in [200, 201]:
                result = response.json()
                print_ok("Vederlag-respons sendt!")
                current_version = result.get('new_version', current_version + 1)
                self._verify_new_comment_local()
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
                headers=self._get_auth_headers_local(),
                timeout=10
            )
            if response.status_code in [200, 201]:
                result = response.json()
                print_ok("Frist-respons sendt!")
                current_version = result.get('new_version', current_version + 1)
                self._verify_new_comment_local()
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

        # Hent gjeldende versjon
        state, current_version = self._get_state_and_version(self.sak_id, self.magic_token)
        if state is None:
            print_fail("Kunne ikke hente state")
            return False

        # Hent timeline for å finne event IDs
        try:
            timeline_resp = requests.get(
                f"{BACKEND_URL}/api/cases/{self.sak_id}/timeline",
                headers=self._get_auth_headers_local(),
                timeout=5
            )
            if timeline_resp.status_code == 200:
                timeline = timeline_resp.json().get('events', [])
            else:
                timeline = []
        except Exception as e:
            print_fail(f"Feil ved henting av timeline: {e}")
            timeline = []

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
                    headers=self._get_auth_headers_local(),
                    timeout=10
                )
                if response.status_code in [200, 201]:
                    result = response.json()
                    print_ok("Vederlag-revisjon sendt!")
                    current_version = result.get('new_version', current_version + 1)
                    self._verify_new_comment_local()
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
                    headers=self._get_auth_headers_local(),
                    timeout=10
                )
                if response.status_code in [200, 201]:
                    result = response.json()
                    print_ok("Frist-revisjon sendt!")
                    self._verify_new_comment_local()
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
                headers=self._get_auth_headers_local(),
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
                headers=self._get_auth_headers_local(),
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
        final_comments = self._get_comment_count_local()
        final_documents = self._get_document_count_local()
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
# FORSERING FLOW TESTER (§33.8)
# =============================================================================

class ForseringFlowTester(BaseTester):
    """
    Tester forsering-flyt (NS 8407 §33.8).

    Flyten:
    1. Opprett 2+ KOE-saker med fristkrav
    2. BH avslår fristkrav på alle KOE-saker
    3. Valider 30%-regelen
    4. TE oppretter forsering-sak som samler de avslåtte sakene
    5. BH aksepterer/avviser forsering
    """

    def __init__(self, client: CatendaClient, project_id: str,
                 library_id: Optional[str], folder_id: Optional[str],
                 topic_board_id: str):
        super().__init__(client, project_id, library_id, folder_id, topic_board_id)

        # KOE-saker som opprettes for forsering
        self.koe_saker: List[Dict[str, Any]] = []  # [{sak_id, topic_guid, magic_token, frist_dager}]

        # Forsering-sak
        self.forsering_sak: Optional[Dict[str, Any]] = None
        self.forsering_topic_guid: Optional[str] = None

    def run_full_flow(self) -> bool:
        """Kjør full forsering-testflyt"""
        print_header("FORSERING TESTFLYT (§33.8)")

        print("Denne testen gjør følgende:")
        print("  1. Oppretter 2 KOE-saker med fristkrav")
        print("  2. BH avslår fristkravene")
        print("  3. Validerer 30%-regelen")
        print("  4. TE varsler forsering")
        print("  5. BH aksepterer forsering")
        print()

        # Steg 1: Opprett KOE-saker
        if not self.create_koe_cases():
            print_fail("Kunne ikke opprette KOE-saker")
            return False

        # Steg 2: BH avslår fristkrav
        if not self.bh_reject_deadlines():
            print_fail("Kunne ikke sende frist-avslag")
            return False

        # Steg 3: Valider 30%-regelen
        if not self.validate_30_percent_rule():
            print_fail("30%-regelen ikke oppfylt")
            return False

        # Steg 4: TE varsler forsering
        if not self.create_forsering():
            print_fail("Kunne ikke opprette forsering")
            return False

        # Steg 5: BH aksepterer forsering
        if not self.bh_respond_to_forsering():
            print_fail("Kunne ikke sende forsering-respons")
            return False

        # Steg 6: Verifiser PDF
        if self.forsering_topic_guid:
            self.verify_pdf_upload(self.forsering_topic_guid)

        # Oppsummering
        self.show_summary()

        print_ok("Forsering-testflyt fullført!")
        return True

    def create_koe_cases(self) -> bool:
        """Steg 1: Opprett KOE-saker med fristkrav"""
        print_header("FORSERING STEG 1: Opprett KOE-saker")

        for i, koe_config in enumerate(FORSERING_TEST_DATA['koe_saker'], 1):
            print_subheader(f"Oppretter KOE-{i}")

            # Opprett topic
            topic_guid = self._create_topic(
                title=koe_config['tittel'],
                topic_type="Krav om endringsordre",
                description=f"Forsering-test KOE-{i}\n\n{koe_config['grunnlag']['beskrivelse']}"
            )

            if not topic_guid:
                print_fail(f"Kunne ikke opprette topic for KOE-{i}")
                return False

            print_ok(f"Topic opprettet: {topic_guid}")

            # Opprett sak
            sak_id, magic_token = self._create_case_directly(
                topic_guid=topic_guid,
                topic_title=koe_config['tittel'],
                sakstype="koe"
            )

            if not sak_id:
                print_fail(f"Kunne ikke opprette sak for KOE-{i}")
                return False

            print_ok(f"Sak opprettet: {sak_id}")

            # Send grunnlag
            _, version = self._get_state_and_version(sak_id, magic_token)
            success, version, _ = self._send_event(
                sak_id=sak_id,
                topic_guid=topic_guid,
                magic_token=magic_token,
                event_type="grunnlag_opprettet",
                event_data={
                    "tittel": koe_config['tittel'],
                    **koe_config['grunnlag'],
                    "dato_oppdaget": datetime.now().strftime('%Y-%m-%d')
                },
                aktor="Test Script",
                aktor_rolle="TE",
                expected_version=version
            )
            if success:
                print_ok(f"Grunnlag sendt for KOE-{i}")
            else:
                print_fail(f"Kunne ikke sende grunnlag for KOE-{i}")
                return False

            # Send fristkrav - track event_id for forsering reference
            success, version, frist_krav_id = self._send_event(
                sak_id=sak_id,
                topic_guid=topic_guid,
                magic_token=magic_token,
                event_type="frist_krav_sendt",
                event_data={
                    **koe_config['frist'],
                    "spesifisert_varsel": {
                        "dato_sendt": datetime.now().strftime('%Y-%m-%d')
                    }
                },
                aktor="Test Script",
                aktor_rolle="TE",
                expected_version=version
            )
            if success:
                print_ok(f"Fristkrav sendt for KOE-{i}: {koe_config['frist']['antall_dager']} dager")
            else:
                print_fail(f"Kunne ikke sende fristkrav for KOE-{i}")
                return False

            # Lagre info med frist_krav_id
            self.koe_saker.append({
                "sak_id": sak_id,
                "topic_guid": topic_guid,
                "magic_token": magic_token,
                "frist_dager": koe_config['frist']['antall_dager'],
                "frist_krav_id": frist_krav_id,
                "version": version
            })

            time.sleep(1)  # Kort pause mellom opprettelser

        print_ok(f"Opprettet {len(self.koe_saker)} KOE-saker")
        return True

    def bh_reject_deadlines(self) -> bool:
        """Steg 2: BH avslår fristkrav på alle KOE-saker"""
        print_header("FORSERING STEG 2: BH avslår fristkrav")

        for i, koe in enumerate(self.koe_saker, 1):
            print_subheader(f"Avslår frist på KOE-{i}")

            # Hent nyeste versjon
            _, version = self._get_state_and_version(koe['sak_id'], koe['magic_token'])

            success, new_version, respons_frist_id = self._send_event(
                sak_id=koe['sak_id'],
                topic_guid=koe['topic_guid'],
                magic_token=koe['magic_token'],
                event_type="respons_frist",
                event_data=FORSERING_TEST_DATA['bh_frist_avslag'],
                aktor="Test Script BH",
                aktor_rolle="BH",
                expected_version=version
            )

            if success:
                print_ok(f"Frist avslått for KOE-{i}")
                koe['version'] = new_version
                koe['respons_frist_id'] = respons_frist_id
            else:
                print_fail(f"Kunne ikke avslå frist for KOE-{i}")
                return False

            time.sleep(1)

        print_ok("Alle fristkrav avslått")
        return True

    def validate_30_percent_rule(self) -> bool:
        """Steg 3: Valider 30%-regelen"""
        print_header("FORSERING STEG 3: Valider 30%-regelen")

        total_rejected_days = sum(k['frist_dager'] for k in self.koe_saker)
        dagmulktsats = FORSERING_TEST_DATA['forsering']['dagmulktsats']
        estimert_kostnad = FORSERING_TEST_DATA['forsering']['estimert_kostnad']

        # Dagmulktgrunnlag
        dagmulkt_grunnlag = total_rejected_days * dagmulktsats

        # 30% tillegg
        maks_forseringskostnad = dagmulkt_grunnlag * 1.3

        print_info(f"  Avslåtte dager:        {total_rejected_days} dager")
        print_info(f"  Dagmulktsats:          {dagmulktsats:,.0f} kr/dag")
        print_info(f"  Dagmulktgrunnlag:      {dagmulkt_grunnlag:,.0f} kr")
        print_info(f"  + 30% tillegg:         {dagmulkt_grunnlag * 0.3:,.0f} kr")
        print_info(f"  = Maks forsering:      {maks_forseringskostnad:,.0f} kr")
        print_info(f"  Estimert kostnad:      {estimert_kostnad:,.0f} kr")
        print()

        if estimert_kostnad <= maks_forseringskostnad:
            print_ok(f"30%-regelen oppfylt: {estimert_kostnad:,.0f} <= {maks_forseringskostnad:,.0f}")
            return True
        else:
            print_fail(f"30%-regelen IKKE oppfylt: {estimert_kostnad:,.0f} > {maks_forseringskostnad:,.0f}")
            return False

    def create_forsering(self) -> bool:
        """Steg 4: TE varsler forsering"""
        print_header("FORSERING STEG 4: TE varsler forsering")

        # Opprett forsering-topic
        self.forsering_topic_guid = self._create_topic(
            title=f"FORSERING - {datetime.now().strftime('%Y%m%d-%H%M%S')}",
            topic_type="Forsering",
            description=f"Forseringssak (§33.8)\n\n"
                       f"Relaterte KOE-saker: {len(self.koe_saker)}\n"
                       f"Estimert kostnad: {FORSERING_TEST_DATA['forsering']['estimert_kostnad']:,.0f} kr"
        )

        if not self.forsering_topic_guid:
            print_fail("Kunne ikke opprette forsering-topic")
            return False

        print_ok(f"Forsering-topic opprettet: {self.forsering_topic_guid}")

        # Opprett toveis topic-relasjoner mellom forsering og KOE-saker
        koe_topic_guids = [k['topic_guid'] for k in self.koe_saker]

        # Forsering → KOE (forseringen peker på KOE-sakene)
        self.client.create_topic_relations(
            topic_id=self.forsering_topic_guid,
            related_topic_guids=koe_topic_guids
        )
        print_ok(f"Opprettet relasjoner: Forsering → {len(koe_topic_guids)} KOE-saker")

        # KOE → Forsering (hver KOE-sak peker tilbake på forseringen)
        for koe in self.koe_saker:
            self.client.create_topic_relations(
                topic_id=koe['topic_guid'],
                related_topic_guids=[self.forsering_topic_guid]
            )
        print_ok(f"Opprettet relasjoner: {len(koe_topic_guids)} KOE-saker → Forsering")

        # Opprett forsering-sak med riktig sakstype
        sak_id, magic_token = self._create_case_directly(
            topic_guid=self.forsering_topic_guid,
            topic_title=f"FORSERING - {datetime.now().strftime('%Y%m%d')}",
            sakstype="forsering"
        )

        if not sak_id:
            print_fail("Kunne ikke opprette forsering-sak")
            return False

        print_ok(f"Forsering-sak opprettet: {sak_id}")

        self.forsering_sak = {
            "sak_id": sak_id,
            "topic_guid": self.forsering_topic_guid,
            "magic_token": magic_token
        }

        # Send forsering-varsel event
        # Bruk første KOE-sak som referanse for forsering
        # (I praksis ville forsering kunne referere til flere avslåtte krav)
        _, version = self._get_state_and_version(sak_id, magic_token)

        total_rejected_days = sum(k['frist_dager'] for k in self.koe_saker)
        dagmulktsats = FORSERING_TEST_DATA['forsering']['dagmulktsats']

        # Bruk første KOE-sak som basis (§33.8 gjelder per avslått krav)
        first_koe = self.koe_saker[0]

        success, _, _ = self._send_event(
            sak_id=sak_id,
            topic_guid=self.forsering_topic_guid,
            magic_token=magic_token,
            event_type="forsering_varsel",
            event_data={
                "frist_krav_id": first_koe['frist_krav_id'],
                "respons_frist_id": first_koe['respons_frist_id'],
                "estimert_kostnad": FORSERING_TEST_DATA['forsering']['estimert_kostnad'],
                "begrunnelse": FORSERING_TEST_DATA['forsering']['begrunnelse'],
                "bekreft_30_prosent": True,
                "dato_iverksettelse": datetime.now().strftime('%Y-%m-%d'),
                "avslatte_dager": total_rejected_days,
                "dagmulktsats": dagmulktsats
            },
            aktor="Test Script",
            aktor_rolle="TE",
            expected_version=version
        )

        if success:
            print_ok("Forsering-varsel sendt")
            print_info(f"  Refererer til KOE-sak: {first_koe['sak_id']}")
            return True
        else:
            print_fail("Kunne ikke sende forsering-varsel")
            return False

    def bh_respond_to_forsering(self) -> bool:
        """Steg 5: BH aksepterer forsering"""
        print_header("FORSERING STEG 5: BH aksepterer forsering")

        if not self.forsering_sak:
            print_fail("Ingen forsering-sak å svare på")
            return False

        sak_id = self.forsering_sak['sak_id']
        topic_guid = self.forsering_sak['topic_guid']
        magic_token = self.forsering_sak['magic_token']

        _, version = self._get_state_and_version(sak_id, magic_token)

        success, _, _ = self._send_event(
            sak_id=sak_id,
            topic_guid=topic_guid,
            magic_token=magic_token,
            event_type="forsering_respons",
            event_data={
                "aksepterer": FORSERING_TEST_DATA['bh_forsering_aksept']['aksepterer'],
                "godkjent_kostnad": FORSERING_TEST_DATA['bh_forsering_aksept']['godkjent_kostnad'],
                "begrunnelse": FORSERING_TEST_DATA['bh_forsering_aksept']['begrunnelse'],
                "dato_respons": datetime.now().strftime('%Y-%m-%d')
            },
            aktor="Test Script BH",
            aktor_rolle="BH",
            expected_version=version
        )

        if success:
            print_ok("BH aksepterer forsering")
            return True
        else:
            print_fail("Kunne ikke sende forsering-respons")
            return False

    def show_summary(self) -> None:
        """Vis oppsummering av forsering-test"""
        print_header("FORSERING TEST FULLFØRT")

        print("  KOE-saker (avslåtte fristkrav):")
        for i, koe in enumerate(self.koe_saker, 1):
            print(f"    KOE-{i}: {koe['sak_id']} ({koe['frist_dager']} dager)")

        if self.forsering_sak:
            print()
            print(f"  Forsering-sak: {self.forsering_sak['sak_id']}")
            print(f"  Estimert kostnad: {FORSERING_TEST_DATA['forsering']['estimert_kostnad']:,.0f} kr")
            print(f"  Status: Akseptert av BH")

        print()
        print("  Flyten testet:")
        print("    1. KOE-saker opprettet med fristkrav")
        print("    2. BH avslår fristkravene")
        print("    3. 30%-regelen validert")
        print("    4. TE varsler forsering")
        print("    5. BH aksepterer forsering")
        print()


# =============================================================================
# ENDRINGSORDRE FLOW TESTER (§31.3)
# =============================================================================

class EOFlowTester(BaseTester):
    """
    Tester endringsordre-flyt (NS 8407 §31.3).

    Flyten:
    1. Opprett 2+ KOE-saker med vederlagskrav
    2. BH oppretter endringsordre som samler KOE-sakene
    3. BH utsteder endringsordre
    4. TE aksepterer/bestrider EO
    """

    def __init__(self, client: CatendaClient, project_id: str,
                 library_id: Optional[str], folder_id: Optional[str],
                 topic_board_id: str):
        super().__init__(client, project_id, library_id, folder_id, topic_board_id)

        # KOE-saker som samles i EO
        self.koe_saker: List[Dict[str, Any]] = []

        # Endringsordre-sak
        self.eo_sak: Optional[Dict[str, Any]] = None
        self.eo_topic_guid: Optional[str] = None

    def run_full_flow(self) -> bool:
        """Kjør full EO-testflyt"""
        print_header("ENDRINGSORDRE TESTFLYT (§31.3)")

        print("Denne testen gjør følgende:")
        print("  1. Oppretter 2 KOE-saker med vederlagskrav")
        print("  2. BH godkjenner grunnlag og vederlag på KOE-saker")
        print("  3. BH oppretter endringsordre")
        print("  4. BH utsteder EO")
        print("  5. TE aksepterer EO")
        print()

        # Steg 1: Opprett KOE-saker
        if not self.create_koe_cases():
            print_fail("Kunne ikke opprette KOE-saker")
            return False

        # Steg 2: BH godkjenner KOE-kravene
        if not self.bh_approve_koe_claims():
            print_fail("Kunne ikke godkjenne KOE-krav")
            return False

        # Steg 3: BH oppretter EO
        if not self.create_endringsordre():
            print_fail("Kunne ikke opprette endringsordre")
            return False

        # Steg 4: BH utsteder EO
        if not self.issue_endringsordre():
            print_fail("Kunne ikke utstede endringsordre")
            return False

        # Steg 5: TE aksepterer EO
        if not self.te_accept_eo():
            print_fail("Kunne ikke akseptere EO")
            return False

        # Steg 6: Verifiser PDF
        if self.eo_topic_guid:
            self.verify_pdf_upload(self.eo_topic_guid)

        # Oppsummering
        self.show_summary()

        print_ok("Endringsordre-testflyt fullført!")
        return True

    def create_koe_cases(self) -> bool:
        """Steg 1: Opprett KOE-saker med vederlagskrav"""
        print_header("EO STEG 1: Opprett KOE-saker")

        for i, koe_config in enumerate(EO_TEST_DATA['koe_saker'], 1):
            print_subheader(f"Oppretter KOE-{i}")

            # Opprett topic
            topic_guid = self._create_topic(
                title=koe_config['tittel'],
                topic_type="Krav om endringsordre",
                description=f"EO-test KOE-{i}\n\n{koe_config['grunnlag']['beskrivelse']}"
            )

            if not topic_guid:
                print_fail(f"Kunne ikke opprette topic for KOE-{i}")
                return False

            print_ok(f"Topic opprettet: {topic_guid}")

            # Opprett sak
            sak_id, magic_token = self._create_case_directly(
                topic_guid=topic_guid,
                topic_title=koe_config['tittel'],
                sakstype="koe"
            )

            if not sak_id:
                print_fail(f"Kunne ikke opprette sak for KOE-{i}")
                return False

            print_ok(f"Sak opprettet: {sak_id}")

            # Send grunnlag
            _, version = self._get_state_and_version(sak_id, magic_token)
            success, version, _ = self._send_event(
                sak_id=sak_id,
                topic_guid=topic_guid,
                magic_token=magic_token,
                event_type="grunnlag_opprettet",
                event_data={
                    "tittel": koe_config['tittel'],
                    **koe_config['grunnlag'],
                    "dato_oppdaget": datetime.now().strftime('%Y-%m-%d')
                },
                aktor="Test Script",
                aktor_rolle="TE",
                expected_version=version
            )
            if success:
                print_ok(f"Grunnlag sendt for KOE-{i}")
            else:
                print_fail(f"Kunne ikke sende grunnlag for KOE-{i}")
                return False

            # Send vederlagskrav
            success, version, _ = self._send_event(
                sak_id=sak_id,
                topic_guid=topic_guid,
                magic_token=magic_token,
                event_type="vederlag_krav_sendt",
                event_data=koe_config['vederlag'],
                aktor="Test Script",
                aktor_rolle="TE",
                expected_version=version
            )
            if success:
                print_ok(f"Vederlagskrav sendt for KOE-{i}: {koe_config['vederlag']['belop_direkte']:,.0f} kr")
            else:
                print_fail(f"Kunne ikke sende vederlagskrav for KOE-{i}")
                return False

            # Lagre info
            self.koe_saker.append({
                "sak_id": sak_id,
                "topic_guid": topic_guid,
                "magic_token": magic_token,
                "belop": koe_config['vederlag']['belop_direkte'],
                "version": version
            })

            time.sleep(1)

        print_ok(f"Opprettet {len(self.koe_saker)} KOE-saker")
        return True

    def bh_approve_koe_claims(self) -> bool:
        """Steg 2: BH godkjenner grunnlag og vederlag på KOE-saker"""
        print_header("EO STEG 2: BH godkjenner KOE-krav")

        for i, koe in enumerate(self.koe_saker, 1):
            print_subheader(f"Godkjenner KOE-{i}")

            sak_id = koe['sak_id']
            topic_guid = koe['topic_guid']
            magic_token = koe['magic_token']

            # Godkjenn grunnlag
            _, version = self._get_state_and_version(sak_id, magic_token)
            success, version, _ = self._send_event(
                sak_id=sak_id,
                topic_guid=topic_guid,
                magic_token=magic_token,
                event_type="respons_grunnlag",
                event_data={
                    "resultat": "godkjent",
                    "begrunnelse": "Grunnlag godkjent for EO-aggregering"
                },
                aktor="Test Script BH",
                aktor_rolle="BH",
                expected_version=version
            )
            if success:
                print_ok(f"Grunnlag godkjent for KOE-{i}")
            else:
                print_fail(f"Kunne ikke godkjenne grunnlag for KOE-{i}")
                return False

            # Godkjenn vederlag
            success, version, _ = self._send_event(
                sak_id=sak_id,
                topic_guid=topic_guid,
                magic_token=magic_token,
                event_type="respons_vederlag",
                event_data={
                    "beregnings_resultat": "godkjent",
                    "total_godkjent_belop": koe['belop'],
                    "begrunnelse": "Vederlag godkjent for EO-aggregering"
                },
                aktor="Test Script BH",
                aktor_rolle="BH",
                expected_version=version
            )
            if success:
                print_ok(f"Vederlag godkjent for KOE-{i}: {koe['belop']:,.0f} kr")
                koe['version'] = version
            else:
                print_fail(f"Kunne ikke godkjenne vederlag for KOE-{i}")
                return False

            time.sleep(1)

        print_ok("Alle KOE-krav godkjent")
        return True

    def create_endringsordre(self) -> bool:
        """Steg 3: BH oppretter endringsordre"""
        print_header("EO STEG 3: BH oppretter endringsordre")

        eo_config = EO_TEST_DATA['endringsordre']

        # Opprett EO-topic
        self.eo_topic_guid = self._create_topic(
            title=f"ENDRINGSORDRE {eo_config['eo_nummer']} - {datetime.now().strftime('%Y%m%d')}",
            topic_type="Endringsordre",
            description=f"Endringsordre {eo_config['eo_nummer']}\n\n{eo_config['beskrivelse']}"
        )

        if not self.eo_topic_guid:
            print_fail("Kunne ikke opprette EO-topic")
            return False

        print_ok(f"EO-topic opprettet: {self.eo_topic_guid}")

        # Opprett toveis topic-relasjoner mellom EO og KOE-saker
        koe_topic_guids = [k['topic_guid'] for k in self.koe_saker]

        # EO → KOE (endringsordren peker på KOE-sakene)
        self.client.create_topic_relations(
            topic_id=self.eo_topic_guid,
            related_topic_guids=koe_topic_guids
        )
        print_ok(f"Opprettet relasjoner: EO → {len(koe_topic_guids)} KOE-saker")

        # KOE → EO (hver KOE-sak peker tilbake på EO)
        for koe in self.koe_saker:
            self.client.create_topic_relations(
                topic_id=koe['topic_guid'],
                related_topic_guids=[self.eo_topic_guid]
            )
        print_ok(f"Opprettet relasjoner: {len(koe_topic_guids)} KOE-saker → EO")

        # Opprett EO-sak med riktig sakstype
        sak_id, magic_token = self._create_case_directly(
            topic_guid=self.eo_topic_guid,
            topic_title=f"ENDRINGSORDRE {eo_config['eo_nummer']}",
            sakstype="endringsordre"
        )

        if not sak_id:
            print_fail("Kunne ikke opprette EO-sak")
            return False

        print_ok(f"EO-sak opprettet: {sak_id}")

        self.eo_sak = {
            "sak_id": sak_id,
            "topic_guid": self.eo_topic_guid,
            "magic_token": magic_token
        }

        return True

    def issue_endringsordre(self) -> bool:
        """Steg 4: BH utsteder endringsordre"""
        print_header("EO STEG 4: BH utsteder endringsordre")

        if not self.eo_sak:
            print_fail("Ingen EO-sak å utstede")
            return False

        sak_id = self.eo_sak['sak_id']
        topic_guid = self.eo_sak['topic_guid']
        magic_token = self.eo_sak['magic_token']
        eo_config = EO_TEST_DATA['endringsordre']

        _, version = self._get_state_and_version(sak_id, magic_token)

        success, _, _ = self._send_event(
            sak_id=sak_id,
            topic_guid=topic_guid,
            magic_token=magic_token,
            event_type="eo_utstedt",
            event_data={
                "eo_nummer": eo_config['eo_nummer'],
                "beskrivelse": eo_config['beskrivelse'],
                "konsekvenser": eo_config['konsekvenser'],
                "kompensasjon_belop": eo_config['kompensasjon_belop'],
                "frist_dager": eo_config['frist_dager'],
                "oppgjorsform": eo_config['oppgjorsform'],
                "relaterte_sak_ids": [k['sak_id'] for k in self.koe_saker],
                "dato_utstedt": datetime.now().strftime('%Y-%m-%d')
            },
            aktor="Test Script BH",
            aktor_rolle="BH",
            expected_version=version
        )

        if success:
            print_ok(f"Endringsordre {eo_config['eo_nummer']} utstedt")
            print_info(f"  Kompensasjon: {eo_config['kompensasjon_belop']:,.0f} kr")
            print_info(f"  Frist: {eo_config['frist_dager']} dager")
            return True
        else:
            print_fail("Kunne ikke utstede endringsordre")
            return False

    def te_accept_eo(self) -> bool:
        """Steg 5: TE aksepterer endringsordre"""
        print_header("EO STEG 5: TE aksepterer endringsordre")

        if not self.eo_sak:
            print_fail("Ingen EO-sak å akseptere")
            return False

        sak_id = self.eo_sak['sak_id']
        topic_guid = self.eo_sak['topic_guid']
        magic_token = self.eo_sak['magic_token']

        _, version = self._get_state_and_version(sak_id, magic_token)

        success, _, _ = self._send_event(
            sak_id=sak_id,
            topic_guid=topic_guid,
            magic_token=magic_token,
            event_type="eo_akseptert",
            event_data={
                "akseptert": EO_TEST_DATA['te_aksept']['akseptert'],
                "kommentar": EO_TEST_DATA['te_aksept']['kommentar'],
                "dato_akseptert": datetime.now().strftime('%Y-%m-%d')
            },
            aktor="Test Script",
            aktor_rolle="TE",
            expected_version=version
        )

        if success:
            print_ok("TE aksepterer endringsordre")
            return True
        else:
            print_fail("Kunne ikke akseptere endringsordre")
            return False

    def show_summary(self) -> None:
        """Vis oppsummering av EO-test"""
        print_header("ENDRINGSORDRE TEST FULLFØRT")

        print("  KOE-saker (samlet i EO):")
        total_belop = 0
        for i, koe in enumerate(self.koe_saker, 1):
            print(f"    KOE-{i}: {koe['sak_id']} ({koe['belop']:,.0f} kr)")
            total_belop += koe['belop']

        if self.eo_sak:
            eo_config = EO_TEST_DATA['endringsordre']
            print()
            print(f"  Endringsordre: {self.eo_sak['sak_id']}")
            print(f"  EO-nummer: {eo_config['eo_nummer']}")
            print(f"  Sum KOE-krav: {total_belop:,.0f} kr")
            print(f"  BH kompensasjon: {eo_config['kompensasjon_belop']:,.0f} kr")
            print(f"  Status: Akseptert av TE")

        print()
        print("  Flyten testet:")
        print("    1. KOE-saker opprettet med vederlagskrav")
        print("    2. BH oppretter endringsordre")
        print("    3. BH utsteder endringsordre")
        print("    4. TE aksepterer endringsordre")
        print()


# =============================================================================
# HOVEDFUNKSJON
# =============================================================================

def run_koe_flow(validator: SetupValidator) -> bool:
    """Kjør standard KOE-flyt"""
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
        return False

    if not tester.verify_webhook_received():
        print("\n[AVBRUTT] Kunne ikke opprette sak")
        return False

    tester.set_verification_baseline()

    # FASE 2: TE sender initiale krav
    if not tester.send_grunnlag():
        print("\n[ADVARSEL] Grunnlag-sending feilet, fortsetter...")

    tester.verify_pdf_upload(tester.topic_guid)
    tester.send_vederlag_and_frist()

    # FASE 3: BH svarer på krav
    if not tester.send_bh_responses():
        print("\n[ADVARSEL] BH-responser feilet, fortsetter...")

    # FASE 4: TE sender revisjoner
    if not tester.send_te_revisions():
        print("\n[ADVARSEL] TE-revisjoner feilet, fortsetter...")

    # Oppsummering
    tester.show_summary()
    return True


def run_forsering_flow(validator: SetupValidator) -> bool:
    """Kjør forsering-flyt"""
    tester = ForseringFlowTester(
        client=validator.client,
        project_id=validator.project_id,
        library_id=validator.library_id,
        folder_id=validator.folder_id,
        topic_board_id=validator.topic_board_id
    )
    return tester.run_full_flow()


def run_eo_flow(validator: SetupValidator) -> bool:
    """Kjør endringsordre-flyt"""
    tester = EOFlowTester(
        client=validator.client,
        project_id=validator.project_id,
        library_id=validator.library_id,
        folder_id=validator.folder_id,
        topic_board_id=validator.topic_board_id
    )
    return tester.run_full_flow()


def main(flow_type: str = "koe"):
    """Hovedfunksjon"""

    print("\n" + "=" * 70)
    print("  FULL FLOW TEST - Catenda Integration")
    print("  Se docs/FULL_FLOW_TEST_PLAN.md for detaljer")
    print("=" * 70)

    # Vis meny hvis ikke spesifisert via CLI
    if flow_type == "menu":
        print("\nVelg testflyt:")
        print("  1. Standard KOE-flyt (TE/BH dialog)")
        print("  2. Forsering-flyt (33.8 - avslatt fristkrav)")
        print("  3. Endringsordre-flyt (31.3 - samle KOE-saker)")
        print("  4. Alle flyter")
        print()

        if AUTO_CONFIRM:
            choice = "1"
            print(f"[auto-confirm: valg 1]")
        else:
            choice = input("Valg [1]: ").strip() or "1"

        flow_map = {"1": "koe", "2": "forsering", "3": "eo", "4": "all"}
        flow_type = flow_map.get(choice, "koe")

    # Vis info om valgt flyt
    flow_descriptions = {
        "koe": "Standard KOE-flyt: TE sender krav, BH svarer, TE reviderer",
        "forsering": "Forsering-flyt (33.8): KOE-saker med avslatte fristkrav, 30%-regel",
        "eo": "Endringsordre-flyt (31.3): BH samler KOE-saker i formell EO",
        "all": "Alle flyter kjores sekvensielt"
    }
    print(f"\n{flow_descriptions.get(flow_type, flow_type)}")

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

    # Kjor valgt flyt
    results = {}

    if flow_type in ["koe", "all"]:
        print_header("STARTER KOE-FLYT")
        results["koe"] = run_koe_flow(validator)

    if flow_type in ["forsering", "all"]:
        print_header("STARTER FORSERING-FLYT")
        results["forsering"] = run_forsering_flow(validator)

    if flow_type in ["eo", "all"]:
        print_header("STARTER ENDRINGSORDRE-FLYT")
        results["eo"] = run_eo_flow(validator)

    # Oppsummering
    print_header("TESTRESULTATER")
    for flow_name, success in results.items():
        status = "[OK]" if success else "[FEIL]"
        print(f"  {status} {flow_name}")

    print("\n[FERDIG] Test(er) gjennomfort!")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Full flow test for KOE system")
    parser.add_argument("--yes", "-y", action="store_true", help="Auto-confirm all prompts")
    parser.add_argument(
        "--flow",
        choices=["koe", "forsering", "eo", "all", "menu"],
        default="menu",
        help="Testflyt: koe (standard), forsering (33.8), eo (31.3), all, menu (interaktiv)"
    )
    args = parser.parse_args()

    if args.yes:
        # Modify global variable
        globals()['AUTO_CONFIRM'] = True

    try:
        main(flow_type=args.flow)
    except KeyboardInterrupt:
        print("\n\nAvbrutt av bruker.")
        sys.exit(0)
    except Exception as e:
        print(f"\nUventet feil: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
