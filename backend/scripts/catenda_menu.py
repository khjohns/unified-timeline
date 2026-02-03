#!/usr/bin/env python3
"""
Catenda Interactive Menu - Interaktivt menybasert script for Catenda API
Basert på suksessfulle tester av ID-mapping og document_references
"""

import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

# Legg til parent directory i path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Last .env
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# Import settings og Catenda client
try:
    from core.config import settings
    from integrations.catenda import CatendaClient
except ImportError as e:
    print(f"❌ Import feilet: {e}")
    print("Sørg for at scriptet kjøres fra backend/-mappen.")
    sys.exit(1)


class CatendaInteractiveMenu:
    """Interaktiv meny for Catenda API-operasjoner"""

    def __init__(self):
        self.tester: CatendaClient | None = None
        self.project_id: str | None = None
        self.library_id: str | None = None
        self.topic_board_id: str | None = None
        self.current_topic_id: str | None = None

        # Konfigurer logging
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
            handlers=[
                logging.FileHandler("catenda_interactive.log"),
                logging.StreamHandler(),
            ],
        )
        self.logger = logging.getLogger(__name__)

    def clear_screen(self):
        """Tøm skjermen"""
        os.system("clear" if os.name == "posix" else "cls")

    def pause(self):
        """Vent på brukerinput"""
        input("\nTrykk Enter for å fortsette...")

    def print_header(self, title: str):
        """Print formatert header"""
        self.clear_screen()
        print("=" * 70)
        print(f"  {title}")
        print("=" * 70)
        print()

    def initialize_connection(self) -> bool:
        """Initialiser forbindelse til Catenda"""
        self.print_header("🔐 Koble til Catenda")

        try:
            # Last inn credentials fra .env (via settings)
            print("Leser credentials fra .env...")
            client_id = settings.catenda_client_id
            client_secret = settings.catenda_client_secret
            access_token_from_config = settings.catenda_access_token

            if not client_id:
                print("❌ CATENDA_CLIENT_ID mangler i .env")
                print(
                    "   Kjør 'python scripts/setup_authentication.py' for å konfigurere."
                )
                return False

            # Opprett tester-objekt
            self.tester = CatendaClient(
                client_id=client_id, client_secret=client_secret
            )

            if access_token_from_config:
                # Sett manuelt access token for å sikre at token_expiry blir satt
                self.tester.set_access_token(access_token_from_config)

            # Autentiser
            print("\nAutentiserer...")
            if not self.tester.ensure_authenticated():
                if not self.tester.authenticate():
                    print("❌ Autentisering feilet. Sjekk credentials i .env")
                    print(
                        "   Kjør 'python scripts/setup_authentication.py' for nytt token."
                    )
                    return False

            print("✅ Autentisering vellykket!")

            # Hent project og library ID fra .env, eller be brukeren
            self.project_id = settings.catenda_project_id
            if not self.project_id:
                print("\nOppgi informasjon om Catenda-prosjektet:")
                self.project_id = input("Catenda Project ID: ").strip()
            else:
                print(f"\nBruker Project ID fra .env: {self.project_id}")

            if not self.project_id:
                print("❌ Project ID er påkrevd")
                return False

            self.library_id = settings.catenda_library_id
            if self.library_id:
                print(f"Bruker Library ID fra .env: {self.library_id}")

            # Hent topic boards
            print("\nHenter tilgjengelige topic boards (BCF prosjekter)...")
            boards = self.tester.list_topic_boards()

            if not boards:
                print("❌ Fant ingen topic boards")
                return False

            print(f"\n✅ Fant {len(boards)} topic board(s):")
            for i, board in enumerate(boards, 1):
                print(f"  {i}. {board['name']} (ID: {board['project_id']})")

            # Velg topic board
            while True:
                try:
                    if len(boards) == 1:
                        choice = "1"
                        print("\nVelger eneste tilgjengelige topic board.")
                    else:
                        choice = input(
                            f"\nVelg topic board (1-{len(boards)}): "
                        ).strip()

                    idx = int(choice) - 1
                    if 0 <= idx < len(boards):
                        selected_board = boards[idx]
                        self.topic_board_id = selected_board["project_id"]
                        self.tester.topic_board_id = (
                            self.topic_board_id
                        )  # Sett på tester-objektet
                        print(f"✅ Valgte: {selected_board['name']}")
                        break
                    else:
                        print("❌ Ugyldig valg")
                except (ValueError, IndexError):
                    print("❌ Skriv inn et gyldig tall")

            # Sett bibliotek
            print("\nSetter dokumentbibliotek...")
            if self.library_id:
                self.tester.library_id = self.library_id
                print(f"✅ Bibliotek satt til: {self.library_id}")
            else:
                if self.tester.select_library(self.project_id, "Documents"):
                    self.library_id = self.tester.library_id
                    print("✅ Bibliotek 'Documents' valgt automatisk.")
                else:
                    print(
                        "⚠️ Kunne ikke velge bibliotek automatisk. Du kan sette det manuelt fra menyen."
                    )

            print("\n✅ Forbindelse etablert!")
            return True

        except Exception as e:
            print(f"❌ Feil ved initialisering: {e}")
            self.logger.exception("Initialization error")
            return False

    def menu_main(self):
        """Hovedmeny"""
        while True:
            self.print_header("🏠 Hovedmeny - Catenda Interactive")

            print("KONFIGURASJON:")
            print(f"  Project ID: {self.project_id or '(ikke satt)'}")
            print(f"  Library ID: {self.library_id or '(ikke satt)'}")
            print(f"  Topic Board: {self.topic_board_id or '(ikke satt)'}")
            print(f"  Aktiv Topic: {self.current_topic_id or '(ingen)'}")
            print()

            print("VALG:")
            print("  1. 📋 Håndter Topics (liste, opprett, søk)")
            print("  2. 📄 Last opp dokument")
            print("  3. 🔗 Knytt dokument til topic")
            print("  4. 💬 Legg til kommentar på topic")
            print("  5. 🔔 Håndter Webhooks")
            print("  6. ⚙️  Endre konfigurasjon")
            print("  7. 🔄 Full KOE-flyt demonstrasjon")
            print("  8. 🏗️  Inspiser BIM-objekt direkte")
            print("  9. 🎛️  Administrer Topic Board (statuser, typer)")
            print(" 10. 📁 Håndter mapper (liste, opprett, naviger)")
            print("  0. 🚪 Avslutt")
            print()

            choice = input("Velg (0-10): ").strip()

            if choice == "1":
                self.menu_topics()
            elif choice == "2":
                self.action_upload_document()
            elif choice == "3":
                self.action_link_document_to_topic()
            elif choice == "4":
                self.action_add_comment()
            elif choice == "5":
                self.menu_webhooks()
            elif choice == "6":
                self.action_change_config()
            elif choice == "7":
                self.demo_koe_flow()
            elif choice == "8":
                self.action_inspect_bim_object()
            elif choice == "9":
                self.menu_topic_boards()
            elif choice == "10":
                self.menu_folders()
            elif choice == "0":
                print("\n👋 Ha det!")
                sys.exit(0)
            else:
                print("❌ Ugyldig valg")
                self.pause()

    def menu_topic_boards(self):
        """Meny for Topic Board-administrasjon"""
        while True:
            self.print_header("🎛️  Topic Board Administrasjon")

            print(f"Aktivt board: {self.topic_board_id or '(ikke satt)'}\n")

            print("VALG:")
            print("  1. 📋 Vis board-info og extensions")
            print("  2. 📋 Liste alle topic boards")
            print("  3. ➕ Opprett nytt topic board")
            print("  4. ✏️  Endre board-navn")
            print("  5. 🎨 Administrer statuser")
            print("  6. 🏷️  Administrer typer")
            print("  7. 🔧 Administrer custom fields")
            print("  0. Tilbake til hovedmeny")
            print()

            choice = input("Velg (0-7): ").strip()

            if choice == "1":
                self.action_show_board_info()
            elif choice == "2":
                self.action_list_all_boards()
            elif choice == "3":
                self.action_create_topic_board()
            elif choice == "4":
                self.action_update_board_name()
            elif choice == "5":
                self.menu_statuses()
            elif choice == "6":
                self.menu_types()
            elif choice == "7":
                self.menu_custom_fields()
            elif choice == "0":
                break
            else:
                print("❌ Ugyldig valg")
                self.pause()

    def menu_statuses(self):
        """Submeny for status-administrasjon"""
        while True:
            self.print_header("🎨 Status-administrasjon")

            print("VALG:")
            print("  1. 📋 Liste alle statuser")
            print("  2. ➕ Opprett ny status")
            print("  3. ✏️  Oppdater status")
            print("  4. 🗑️  Slett status")
            print("  0. Tilbake")
            print()

            choice = input("Velg (0-4): ").strip()

            if choice == "1":
                self.action_list_statuses()
            elif choice == "2":
                self.action_create_status()
            elif choice == "3":
                self.action_update_status()
            elif choice == "4":
                self.action_delete_status()
            elif choice == "0":
                break
            else:
                print("❌ Ugyldig valg")
                self.pause()

    def menu_types(self):
        """Submeny for type-administrasjon"""
        while True:
            self.print_header("🏷️  Type-administrasjon")

            print("VALG:")
            print("  1. 📋 Liste alle typer")
            print("  2. ➕ Opprett ny type")
            print("  3. ✏️  Oppdater type")
            print("  4. 🗑️  Slett type")
            print("  0. Tilbake")
            print()

            choice = input("Velg (0-4): ").strip()

            if choice == "1":
                self.action_list_types()
            elif choice == "2":
                self.action_create_type()
            elif choice == "3":
                self.action_update_type()
            elif choice == "4":
                self.action_delete_type()
            elif choice == "0":
                break
            else:
                print("❌ Ugyldig valg")
                self.pause()

    def menu_custom_fields(self):
        """Submeny for custom field-administrasjon"""
        while True:
            self.print_header("🔧 Custom Field-administrasjon")

            print("VALG:")
            print("  1. 📋 Vis custom fields på boardet")
            print("  2. 📋 Vis alle tilgjengelige custom fields")
            print("  3. ➕ Legg til custom field på board")
            print("  4. ✏️  Endre innstillinger for field")
            print("  5. 🚫 Deaktiver custom field")
            print("  6. ♻️  Gjenopprett deaktivert field")
            print("  7. 🗑️  Fjern custom field fra board")
            print("  0. Tilbake")
            print()

            choice = input("Velg (0-7): ").strip()

            if choice == "1":
                self.action_show_custom_fields()
            elif choice == "2":
                self.action_list_available_custom_fields()
            elif choice == "3":
                self.action_add_custom_field()
            elif choice == "4":
                self.action_modify_custom_field()
            elif choice == "5":
                self.action_disable_custom_field()
            elif choice == "6":
                self.action_restore_custom_field()
            elif choice == "7":
                self.action_delete_custom_field()
            elif choice == "0":
                break
            else:
                print("❌ Ugyldig valg")
                self.pause()

    def menu_topics(self):
        """Meny for topic-håndtering"""
        while True:
            self.print_header("📋 Topic-håndtering")

            print("VALG:")
            print("  1. Liste alle topics")
            print("  2. Opprett ny topic")
            print("  3. Søk etter topic")
            print("  4. Vis detaljer om en topic")
            print("  5. 🔗 Håndter topic-relasjoner")
            print("  6. 🗑️  Slett topic")
            print("  7. 🗑️  Slett ALLE topics (opprydding)")
            print("  0. Tilbake til hovedmeny")
            print()

            choice = input("Velg (0-7): ").strip()

            if choice == "1":
                self.action_list_topics()
            elif choice == "2":
                self.action_create_topic()
            elif choice == "3":
                self.action_search_topics()
            elif choice == "4":
                self.action_show_topic_details()
            elif choice == "5":
                self.menu_topic_relations()
            elif choice == "6":
                self.action_delete_topic()
            elif choice == "7":
                self.action_delete_all_topics()
            elif choice == "0":
                break
            else:
                print("❌ Ugyldig valg")
                self.pause()

    def action_list_topics(self):
        """List alle topics i topic board"""
        self.print_header("📋 Liste Topics")

        if not self.topic_board_id:
            print("❌ Topic Board ID er ikke satt")
            self.pause()
            return

        print(f"Henter topics fra board {self.topic_board_id}...\n")

        try:
            topics = self.tester.list_topics()

            if not topics:
                print("Ingen topics funnet.")
            else:
                print(f"Fant {len(topics)} topic(s):\n")
                for i, topic in enumerate(topics, 1):
                    print(f"{i}. {topic.get('title', 'Uten tittel')}")
                    print(f"   GUID: {topic['guid']}")
                    print(f"   Status: {topic.get('topic_status', 'N/A')}")
                    print(f"   Type: {topic.get('topic_type', 'N/A')}")
                    print()

            # Tilby å velge en topic
            if topics:
                choice = (
                    input("Vil du velge en av disse som aktiv topic? (j/n): ")
                    .strip()
                    .lower()
                )
                if choice == "j":
                    while True:
                        try:
                            idx = int(input(f"Velg nummer (1-{len(topics)}): ")) - 1
                            if 0 <= idx < len(topics):
                                self.current_topic_id = topics[idx]["guid"]
                                print(f"✅ Satt aktiv topic: {topics[idx]['title']}")
                                break
                        except ValueError:
                            print("❌ Ugyldig valg")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error listing topics")

        self.pause()

    def action_create_topic(self):
        """Opprett ny topic"""
        self.print_header("📝 Opprett Ny Topic")

        if not self.topic_board_id:
            print("❌ Topic Board ID er ikke satt")
            self.pause()
            return

        print("Oppgi informasjon om den nye topicen:\n")

        title = input("Tittel: ").strip()
        if not title:
            print("❌ Tittel er påkrevd")
            self.pause()
            return

        description = input("Beskrivelse (valgfri): ").strip()
        topic_type = input("Type (valgfri, f.eks. 'Request'): ").strip()
        topic_status = input("Status (valgfri, f.eks. 'Open'): ").strip()

        print("\nOppretter topic...")

        try:
            result = self.tester.create_topic(
                title=title,
                description=description or None,
                topic_type=topic_type or None,
                topic_status=topic_status or None,
            )

            if result and "guid" in result:
                print("\n✅ Topic opprettet!")
                print(f"   GUID: {result['guid']}")
                print(f"   Tittel: {result.get('title')}")

                choice = input("\nSett denne som aktiv topic? (j/n): ").strip().lower()
                if choice == "j":
                    self.current_topic_id = result["guid"]
                    print("✅ Satt som aktiv topic")
            else:
                print("❌ Opprettelse feilet")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error creating topic")

        self.pause()

    def action_search_topics(self):
        """Søk etter topics"""
        self.print_header("🔍 Søk Topics")

        if not self.topic_board_id:
            print("❌ Topic Board ID er ikke satt")
            self.pause()
            return

        search_term = input("Søkeord: ").strip()
        if not search_term:
            print("❌ Søkeord er påkrevd")
            self.pause()
            return

        print(f"\nSøker etter '{search_term}'...\n")

        try:
            topics = self.tester.list_topics()

            # Enkel søkelogikk (case-insensitive)
            matches = [
                t
                for t in topics
                if search_term.lower() in t.get("title", "").lower()
                or search_term.lower() in t.get("description", "").lower()
            ]

            if not matches:
                print("Ingen treff funnet.")
            else:
                print(f"Fant {len(matches)} treff:\n")
                for i, topic in enumerate(matches, 1):
                    print(f"{i}. {topic.get('title', 'Uten tittel')}")
                    print(f"   GUID: {topic['guid']}")
                    print()

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error searching topics")

        self.pause()

    def action_show_topic_details(self):
        """Vis detaljer om en topic og dump all relatert data."""
        self.print_header("🔎 Topic Detaljer (Full Data Dump)")

        topic_id = self.current_topic_id

        if not topic_id:
            topic_id = input("Topic GUID: ").strip()
            if not topic_id:
                print("❌ Topic GUID er påkrevd")
                self.pause()
                return

        print(f"\nHenter detaljer for topic {topic_id}...\n")

        try:
            # 1. Hent Topic-data
            topic = self.tester.get_topic_details(topic_id)
            if not topic:
                print("❌ Kunne ikke hente topic-informasjon")
                self.pause()
                return

            print("=" * 29 + " 📋 TOPIC DATA " + "=" * 30)
            print(json.dumps(topic, indent=2, ensure_ascii=False))
            print("=" * 70)
            print()

            # 2. Hent Topic Board (BCF Project) data
            topic_board = self.tester.get_topic_board_details()
            if topic_board:
                print("=" * 24 + " 📋 TOPIC BOARD DATA " + "=" * 25)
                print(json.dumps(topic_board, indent=2, ensure_ascii=False))
                print("=" * 70)
                print()

                # 3. Hent fulle Project (v2) detaljer
                bimsync_project_id = topic_board.get("bimsync_project_id")
                if bimsync_project_id:
                    project_details = self.tester.get_project_details(
                        bimsync_project_id
                    )
                    if project_details:
                        print("=" * 26 + " 📋 PROJECT DATA " + "=" * 27)
                        print(json.dumps(project_details, indent=2, ensure_ascii=False))
                        print("=" * 70)
                        print()

            # 4. Hent kommentarer
            comments = self.tester.get_comments(topic_id)
            print(f"💬 KOMMENTARER ({len(comments)})")
            if comments:
                print(json.dumps(comments, indent=2, ensure_ascii=False))
            else:
                print("Ingen kommentarer funnet.")
            print("=" * 70)
            print()

            # 5. Hent dokumentreferanser
            docs = self.tester.list_document_references(topic_id)
            print(f"📄 DOKUMENTREFERANSER ({len(docs)})")
            if docs:
                print(json.dumps(docs, indent=2, ensure_ascii=False))
            else:
                print("Ingen dokumentreferanser funnet.")
            print("=" * 70)

            # 6. Hent BIM-objekter (IFC GUIDs)
            bim_objects = self.tester.get_bim_objects_for_topic(topic_id)
            print(f"🕋 BIM-OBJEKTER ({len(bim_objects)})")
            if bim_objects:
                print(json.dumps(bim_objects, indent=2, ensure_ascii=False))
            else:
                print("Ingen BIM-objekter funnet.")
            print("=" * 70)

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error showing topic details")

        self.pause()

    def action_delete_topic(self):
        """Slett en enkelt topic"""
        self.print_header("🗑️ Slett Topic")

        if not self.topic_board_id:
            print("❌ Topic Board ID er ikke satt")
            self.pause()
            return

        # La bruker velge topic
        topic_id = self.current_topic_id
        topic_title = None

        if topic_id:
            use_current = (
                input(f"Bruke aktiv topic ({topic_id})? [J/n]: ").strip().lower()
            )
            if use_current in ("n", "nei", "no"):
                topic_id = None

        if not topic_id:
            # Vis liste og la bruker velge
            try:
                topics = self.tester.list_topics()
                if not topics:
                    print("Ingen topics funnet.")
                    self.pause()
                    return

                print(f"\nFant {len(topics)} topic(s):\n")
                for i, topic in enumerate(topics, 1):
                    print(f"  {i}. {topic.get('title', 'Uten tittel')}")
                    print(f"     GUID: {topic['guid']}")
                    print(f"     Status: {topic.get('topic_status', '?')}")
                    print()

                choice = input(f"Velg nummer (1-{len(topics)}) eller GUID: ").strip()
                if not choice:
                    print("Avbrutt.")
                    self.pause()
                    return

                if choice.isdigit():
                    idx = int(choice) - 1
                    if 0 <= idx < len(topics):
                        topic_id = topics[idx]["guid"]
                        topic_title = topics[idx].get("title")
                    else:
                        print("❌ Ugyldig valg")
                        self.pause()
                        return
                else:
                    topic_id = choice

            except Exception as e:
                print(f"❌ Feil ved henting av topics: {e}")
                self.pause()
                return

        # Bekreftelse
        print("\n⚠️  ADVARSEL: Dette vil permanent slette topic:")
        print(f"   GUID: {topic_id}")
        if topic_title:
            print(f"   Tittel: {topic_title}")
        print()

        confirm = input("Er du sikker? Skriv 'SLETT' for å bekrefte: ").strip()
        if confirm != "SLETT":
            print("Avbrutt.")
            self.pause()
            return

        # Slett
        print(f"\nSletter topic {topic_id}...")
        try:
            if self.tester.delete_topic(topic_id):
                print("✅ Topic slettet!")
                if self.current_topic_id == topic_id:
                    self.current_topic_id = None
            else:
                print("❌ Kunne ikke slette topic")
        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error deleting topic")

        self.pause()

    def action_delete_all_topics(self):
        """Slett ALLE topics på topic board (opprydding)"""
        self.print_header("🗑️ Slett ALLE Topics")

        if not self.topic_board_id:
            print("❌ Topic Board ID er ikke satt")
            self.pause()
            return

        # Hent ALLE topics med paginering
        print("Henter alle topics (kan ta litt tid)...\n")
        try:
            topics = self.tester.list_topics(fetch_all=True)
            if not topics:
                print("Ingen topics funnet på dette boardet.")
                self.pause()
                return

            print(f"⚠️  ADVARSEL: Dette vil slette {len(topics)} topic(s)!\n")
            print("Topics som vil bli slettet:")
            # Vis maks 20 for lesbarhet
            for topic in topics[:20]:
                print(
                    f"  - {topic.get('title', 'Uten tittel')} ({topic['guid'][:8]}...)"
                )
            if len(topics) > 20:
                print(f"  ... og {len(topics) - 20} til")
            print()

        except Exception as e:
            print(f"❌ Feil ved henting av topics: {e}")
            self.pause()
            return

        # Ekstra bekreftelse
        print("⚠️  DETTE KAN IKKE ANGRES!")
        confirm1 = input(
            f"Skriv antall topics ({len(topics)}) for å bekrefte: "
        ).strip()
        if confirm1 != str(len(topics)):
            print("Avbrutt.")
            self.pause()
            return

        confirm2 = input("Skriv 'SLETT ALLE' for endelig bekreftelse: ").strip()
        if confirm2 != "SLETT ALLE":
            print("Avbrutt.")
            self.pause()
            return

        # Slett alle
        print(f"\nSletter {len(topics)} topics...")
        deleted = 0
        failed = 0

        for i, topic in enumerate(topics, 1):
            topic_id = topic["guid"]
            title = topic.get("title", "Uten tittel")[:30]
            print(f"  [{i}/{len(topics)}] Sletter: {title}...", end=" ")

            try:
                if self.tester.delete_topic(topic_id):
                    print("✅")
                    deleted += 1
                else:
                    print("❌")
                    failed += 1
            except Exception as e:
                print(f"❌ ({e})")
                failed += 1

        print(f"\n{'=' * 40}")
        print(f"Resultat: {deleted} slettet, {failed} feilet")

        if self.current_topic_id:
            self.current_topic_id = None
            print("(Aktiv topic nullstilt)")

        self.pause()

    # ========================================================================
    # TOPIC RELATIONS
    # ========================================================================

    def menu_topic_relations(self):
        """Meny for topic-relasjoner"""
        while True:
            self.print_header("🔗 Topic-relasjoner")

            print(f"Aktiv Topic: {self.current_topic_id or '(ingen valgt)'}")
            print()

            print("VALG:")
            print("  1. Se relaterte topics")
            print("  2. Opprett relasjon (knytt saker)")
            print("  3. Opprett toveis-relasjon")
            print("  4. Slett relasjon")
            print("  0. Tilbake")
            print()

            choice = input("Velg (0-4): ").strip()

            if choice == "1":
                self.action_list_related_topics()
            elif choice == "2":
                self.action_create_topic_relation()
            elif choice == "3":
                self.action_create_bidirectional_relation()
            elif choice == "4":
                self.action_delete_topic_relation()
            elif choice == "0":
                break
            else:
                print("❌ Ugyldig valg")
                self.pause()

    def action_list_related_topics(self):
        """Vis relaterte topics for aktiv topic"""
        self.print_header("🔗 Relaterte Topics")

        topic_id = self.current_topic_id
        if not topic_id:
            topic_id = input("Topic GUID: ").strip()
            if not topic_id:
                print("❌ Topic GUID er påkrevd")
                self.pause()
                return

        print(f"\nHenter relaterte topics for {topic_id}...\n")

        try:
            related = self.tester.list_related_topics(
                topic_id, include_project_topics=True
            )

            if not related:
                print("Ingen relaterte topics funnet.")
            else:
                print(f"Fant {len(related)} relatert(e) topic(s):\n")
                for i, rel in enumerate(related, 1):
                    related_guid = rel.get("related_topic_guid", "N/A")
                    board_ref = rel.get("bimsync_issue_board_ref", "samme board")
                    print(f"  {i}. {related_guid}")
                    print(f"     Board: {board_ref}")
                    print()

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error listing related topics")

        self.pause()

    def action_create_topic_relation(self):
        """Opprett relasjon mellom topics (enveis)"""
        self.print_header("🔗 Opprett Topic-relasjon")

        print("Opprett en enveis-relasjon fra én topic til andre topics.\n")

        source_topic = self.current_topic_id
        if not source_topic:
            source_topic = input("Kilde-topic GUID: ").strip()
            if not source_topic:
                print("❌ Kilde-topic GUID er påkrevd")
                self.pause()
                return
        else:
            print(f"Bruker aktiv topic som kilde: {source_topic}")
            confirm = input("Vil du bruke denne? (j/n): ").strip().lower()
            if confirm != "j":
                source_topic = input("Kilde-topic GUID: ").strip()

        print(
            "\nOppgi GUIDs til topics som skal relateres (én per linje, tom linje avslutter):"
        )
        target_guids = []
        while True:
            guid = input("  GUID: ").strip()
            if not guid:
                break
            target_guids.append(guid)

        if not target_guids:
            print("❌ Minst én mål-topic er påkrevd")
            self.pause()
            return

        print(f"\nOppretter {len(target_guids)} relasjon(er)...")

        try:
            success = self.tester.create_topic_relations(
                topic_id=source_topic, related_topic_guids=target_guids
            )

            if success:
                print("✅ Relasjoner opprettet!")
                for guid in target_guids:
                    print(f"   {source_topic} → {guid}")
            else:
                print("❌ Kunne ikke opprette relasjoner")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error creating topic relations")

        self.pause()

    def action_create_bidirectional_relation(self):
        """Opprett toveis-relasjon mellom topics"""
        self.print_header("🔗 Opprett Toveis-relasjon")

        print("Opprett toveis-relasjoner (begge topics peker på hverandre).\n")
        print("Dette er nyttig for å knytte f.eks. KOE ↔ Endringsordre.\n")

        # Topic A - bruk aktiv topic eller velg fra liste
        topic_a = self.current_topic_id
        topic_a_title = "Aktiv topic"
        if not topic_a:
            result = self._select_topic("Velg Topic A:")
            if not result:
                print("❌ Avbrutt")
                self.pause()
                return
            topic_a, topic_a_title = result
        else:
            print(f"Aktiv topic: {topic_a[:8]}...")
            choice = input("Bruk aktiv topic som Topic A? (j/n) [j]: ").strip().lower()
            if choice == "n":
                result = self._select_topic("Velg Topic A:")
                if not result:
                    print("❌ Avbrutt")
                    self.pause()
                    return
                topic_a, topic_a_title = result

        if not topic_a:
            print("❌ Topic A er påkrevd")
            self.pause()
            return

        print(f"\n📌 Topic A: {topic_a_title} ({topic_a[:8]}...)")

        # Topic B - velg fra liste (ekskluder topic A)
        result = self._select_topic("Velg Topic B:", exclude_guid=topic_a)
        if not result:
            print("❌ Avbrutt")
            self.pause()
            return
        topic_b, topic_b_title = result

        print(f"\n📌 Topic A: {topic_a_title}")
        print(f"📌 Topic B: {topic_b_title}")
        print(f"\nOppretter toveis-relasjon: {topic_a_title} ↔ {topic_b_title}...")

        try:
            # A → B
            success_a = self.tester.create_topic_relations(
                topic_id=topic_a, related_topic_guids=[topic_b]
            )

            # B → A
            success_b = self.tester.create_topic_relations(
                topic_id=topic_b, related_topic_guids=[topic_a]
            )

            if success_a and success_b:
                print("✅ Toveis-relasjon opprettet!")
                print(f"   {topic_a_title} → {topic_b_title}")
                print(f"   {topic_b_title} → {topic_a_title}")
            else:
                print("⚠️ Delvis feil ved opprettelse")
                print(
                    f"   {topic_a_title} → {topic_b_title}: {'✅' if success_a else '❌'}"
                )
                print(
                    f"   {topic_b_title} → {topic_a_title}: {'✅' if success_b else '❌'}"
                )

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error creating bidirectional relation")

        self.pause()

    def action_delete_topic_relation(self):
        """Slett relasjon mellom topics"""
        self.print_header("🗑️  Slett Topic-relasjon")

        topic_id = self.current_topic_id
        if not topic_id:
            topic_id = input("Topic GUID: ").strip()
            if not topic_id:
                print("❌ Topic GUID er påkrevd")
                self.pause()
                return

        related_topic_id = input("GUID til relatert topic som skal fjernes: ").strip()
        if not related_topic_id:
            print("❌ Relatert topic GUID er påkrevd")
            self.pause()
            return

        bidirectional = (
            input("Slett begge veier (toveis)? (j/n): ").strip().lower() == "j"
        )

        confirm = (
            input(f"\nSlett relasjon{'er' if bidirectional else ''}? (j/n): ")
            .strip()
            .lower()
        )
        if confirm != "j":
            print("❌ Avbrutt")
            self.pause()
            return

        try:
            # Slett A → B
            success_a = self.tester.delete_topic_relation(
                topic_id=topic_id, related_topic_id=related_topic_id
            )
            print(
                f"   {topic_id} → {related_topic_id}: {'✅ Slettet' if success_a else '❌ Feilet'}"
            )

            if bidirectional:
                # Slett B → A
                success_b = self.tester.delete_topic_relation(
                    topic_id=related_topic_id, related_topic_id=topic_id
                )
                print(
                    f"   {related_topic_id} → {topic_id}: {'✅ Slettet' if success_b else '❌ Feilet'}"
                )

            print("\n✅ Ferdig!")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error deleting topic relation")

        self.pause()

    # ==========================================================================
    # TOPIC BOARD MANAGEMENT ACTIONS
    # ==========================================================================

    def action_show_board_info(self):
        """Vis informasjon om aktivt topic board"""
        self.print_header("📋 Board-informasjon")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt. Velg et board først.")
            self.pause()
            return

        print(f"Board ID: {self.topic_board_id}\n")

        try:
            # Hent board-info
            board = self.tester.get_topic_board(self.topic_board_id)
            if board:
                print("📌 BOARD-INFO:")
                print(f"   Navn: {board.get('name', 'N/A')}")
                print(f"   Project ID: {board.get('bimsync_project_id', 'N/A')}")
                print(f"   Project: {board.get('bimsync_project_name', 'N/A')}")
                print()

            # Hent extensions
            extensions = self.tester.get_topic_board_extensions(self.topic_board_id)
            if extensions:
                print("📌 EXTENSIONS:")

                statuses = extensions.get("topic_status", [])
                print(f"\n   Statuser ({len(statuses)}):")
                for s in statuses:
                    print(f"     - {s}")

                types = extensions.get("topic_type", [])
                print(f"\n   Typer ({len(types)}):")
                for t in types:
                    print(f"     - {t}")

                labels = extensions.get("topic_label", [])
                print(f"\n   Labels ({len(labels)}):")
                for label in labels[:10]:
                    print(f"     - {label}")
                if len(labels) > 10:
                    print(f"     ... og {len(labels) - 10} til")

                priorities = extensions.get("priority", [])
                print(f"\n   Prioriteter ({len(priorities)}):")
                for p in priorities:
                    print(f"     - {p}")

                users = extensions.get("users", [])
                print(f"\n   Brukere ({len(users)}):")
                for u in users[:5]:
                    print(f"     - {u}")
                if len(users) > 5:
                    print(f"     ... og {len(users) - 5} til")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error showing board info")

        self.pause()

    def action_list_all_boards(self):
        """Liste alle topic boards i prosjektet"""
        self.print_header("📋 Alle Topic Boards")

        try:
            boards = self.tester.list_topic_boards()

            if not boards:
                print("Ingen topic boards funnet.")
            else:
                print(f"Fant {len(boards)} board(s):\n")
                for i, board in enumerate(boards, 1):
                    is_active = (
                        "⭐" if board.get("project_id") == self.topic_board_id else "  "
                    )
                    print(f"{is_active} {i}. {board.get('name', 'Uten navn')}")
                    print(f"      ID: {board.get('project_id')}")
                    print(f"      Project: {board.get('bimsync_project_name', 'N/A')}")
                    print()

                # Tilby å velge et board
                choice = (
                    input("Vil du velge et board som aktivt? (j/n): ").strip().lower()
                )
                if choice == "j":
                    try:
                        idx = int(input(f"Velg nummer (1-{len(boards)}): ")) - 1
                        if 0 <= idx < len(boards):
                            self.topic_board_id = boards[idx]["project_id"]
                            self.tester.topic_board_id = self.topic_board_id
                            print(f"✅ Satt aktivt board: {boards[idx]['name']}")
                    except ValueError:
                        print("❌ Ugyldig valg")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error listing boards")

        self.pause()

    def action_create_topic_board(self):
        """Opprett nytt topic board"""
        self.print_header("➕ Opprett Topic Board")

        name = input("Navn på nytt board: ").strip()
        if not name:
            print("❌ Navn er påkrevd")
            self.pause()
            return

        print(f"\nOppretter board '{name}'...")

        try:
            board = self.tester.create_topic_board(name, self.project_id)

            if board:
                print(f"✅ Opprettet board: {board.get('name')}")
                print(f"   ID: {board.get('project_id')}")

                # Tilby å sette som aktivt
                choice = input("\nSett som aktivt board? (j/n): ").strip().lower()
                if choice == "j":
                    self.topic_board_id = board.get("project_id")
                    self.tester.topic_board_id = self.topic_board_id
                    print("✅ Board satt som aktivt")
            else:
                print("❌ Kunne ikke opprette board")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error creating board")

        self.pause()

    def action_update_board_name(self):
        """Oppdater navn på aktivt board"""
        self.print_header("✏️  Endre Board-navn")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        # Vis nåværende navn
        board = self.tester.get_topic_board(self.topic_board_id)
        if board:
            print(f"Nåværende navn: {board.get('name')}\n")

        new_name = input("Nytt navn: ").strip()
        if not new_name:
            print("❌ Navn er påkrevd")
            self.pause()
            return

        try:
            updated = self.tester.update_topic_board(new_name, self.topic_board_id)
            if updated:
                print(f"✅ Oppdatert board-navn til: {updated.get('name')}")
            else:
                print("❌ Kunne ikke oppdatere board")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error updating board")

        self.pause()

    def action_show_custom_fields(self):
        """Vis custom fields konfigurert på boardet med innstillinger"""
        self.print_header("🔧 Custom Fields på Boardet")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        try:
            board = self.tester.get_topic_board_with_custom_fields(
                self.topic_board_id, self.project_id
            )

            if not board:
                print("❌ Kunne ikke hente board")
                self.pause()
                return

            fields = board.get("customFields", [])
            instances = board.get("customFieldInstances", [])

            print(f"Board: {board.get('name')}\n")

            if not instances:
                print("Ingen custom fields konfigurert på dette boardet.")
                print(
                    "\nBruk 'Vis alle tilgjengelige' for å se fields du kan legge til."
                )
            else:
                print(f"Konfigurerte fields ({len(instances)}):\n")

                # Bygg map fra field ID til field-data
                field_map = {f.get("id"): f for f in fields}

                for i, inst in enumerate(instances, 1):
                    field_id = inst.get("id")
                    field = field_map.get(field_id, {})

                    name = field.get("name", "Ukjent")
                    field_type = field.get("type", "N/A")

                    print(f"  {i}. {name} [{field_type}]")
                    print(f"      ID: {field_id}")
                    print(f"      Påkrevd: {'Ja' if inst.get('required') else 'Nei'}")
                    print(
                        f"      Deaktivert: {'Ja' if inst.get('disabled') else 'Nei'}"
                    )

                    if inst.get("defaultValue"):
                        print(f"      Standardverdi: {inst.get('defaultValue')}")

                    # Vis dropdown-verdier for enumeration
                    if field_type == "enumeration":
                        items = field.get("dropdownItems", [])
                        if items:
                            active_items = [i for i in items if not i.get("disabled")]
                            print(
                                f"      Verdier: {len(active_items)} aktive av {len(items)} totalt"
                            )
                    print()

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error showing custom fields")

        self.pause()

    def action_list_available_custom_fields(self):
        """Vis alle tilgjengelige custom fields på prosjektnivå"""
        self.print_header("📋 Alle Custom Fields i Prosjektet")

        if not self.project_id:
            print("❌ Ingen project ID satt")
            self.pause()
            return

        try:
            # Hent ALLE custom fields fra prosjektnivå
            fields = self.tester.list_project_custom_fields(self.project_id)

            if not fields:
                print("Ingen custom fields definert i prosjektet.")
            else:
                # Hent også instanser for å vise hvilke som er aktive på boardet
                active_ids = set()
                if self.topic_board_id:
                    board = self.tester.get_topic_board_with_custom_fields(
                        self.topic_board_id, self.project_id
                    )
                    if board:
                        active_ids = {
                            inst.get("id")
                            for inst in board.get("customFieldInstances", [])
                        }

                print(f"Fant {len(fields)} custom field(s) i prosjektet:\n")
                for i, field in enumerate(fields, 1):
                    field_id = field.get("id", "N/A")
                    name = field.get("name", "Ukjent")
                    field_type = field.get("type", "N/A")
                    archived = " (arkivert)" if field.get("archived") else ""
                    active = " ✓ på board" if field_id in active_ids else ""

                    print(f"  {i}. {name} [{field_type}]{archived}{active}")
                    print(f"      ID: {field_id}")

                    if field.get("description"):
                        print(f"      Beskrivelse: {field.get('description')}")

                    if field_type == "enumeration":
                        items = field.get("dropdownItems", [])
                        if items:
                            item_names = [item.get("name") for item in items[:3]]
                            more = f" (+{len(items) - 3})" if len(items) > 3 else ""
                            print(f"      Verdier: {', '.join(item_names)}{more}")
                    print()

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error listing available custom fields")

        self.pause()

    def action_add_custom_field(self):
        """Legg til custom field på board"""
        self.print_header("➕ Legg til Custom Field")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        try:
            # Hent ALLE fields fra prosjektnivå
            all_fields = self.tester.list_project_custom_fields(self.project_id)

            if not all_fields:
                print("Ingen custom fields definert i prosjektet.")
                self.pause()
                return

            # Hent aktive på boardet
            board = self.tester.get_topic_board_with_custom_fields(
                self.topic_board_id, self.project_id
            )
            active_ids = set()
            if board:
                active_ids = {
                    inst.get("id") for inst in board.get("customFieldInstances", [])
                }

            # Filtrer ut allerede aktive og arkiverte
            available = [
                f
                for f in all_fields
                if f.get("id") not in active_ids and not f.get("archived")
            ]

            if not available:
                print("Alle custom fields er allerede lagt til på boardet.")
                self.pause()
                return

            print(
                f"Tilgjengelige custom fields ({len(available)} av {len(all_fields)}):\n"
            )
            for i, field in enumerate(available, 1):
                print(f"  {i}. {field.get('name')} [{field.get('type')}]")

            try:
                idx = int(input("\nVelg field å legge til: ")) - 1
                if not 0 <= idx < len(available):
                    print("❌ Ugyldig valg")
                    self.pause()
                    return
            except ValueError:
                print("❌ Ugyldig valg")
                self.pause()
                return

            field = available[idx]
            print(f"\nLegger til: {field.get('name')}")

            required = (
                input("Skal feltet være påkrevd? (j/n) [n]: ").strip().lower() == "j"
            )

            result = self.tester.add_custom_field_to_board(
                field.get("id"), self.topic_board_id, self.project_id, required=required
            )

            if result:
                print(f"\n✅ Custom field '{field.get('name')}' lagt til på boardet")
            else:
                print("❌ Kunne ikke legge til custom field")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error adding custom field")

        self.pause()

    def action_modify_custom_field(self):
        """Endre innstillinger for custom field"""
        self.print_header("✏️  Endre Custom Field")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        try:
            board = self.tester.get_topic_board_with_custom_fields(
                self.topic_board_id, self.project_id
            )
            if not board:
                print("❌ Kunne ikke hente board")
                self.pause()
                return

            instances = board.get("customFieldInstances", [])
            fields = {f.get("id"): f for f in board.get("customFields", [])}

            if not instances:
                print("Ingen custom fields på boardet.")
                self.pause()
                return

            print("Custom fields på boardet:\n")
            for i, inst in enumerate(instances, 1):
                field = fields.get(inst.get("id"), {})
                required = "✓ påkrevd" if inst.get("required") else ""
                disabled = "(deaktivert)" if inst.get("disabled") else ""
                print(f"  {i}. {field.get('name', 'Ukjent')} {required} {disabled}")

            try:
                idx = int(input("\nVelg field å endre: ")) - 1
                if not 0 <= idx < len(instances):
                    print("❌ Ugyldig valg")
                    self.pause()
                    return
            except ValueError:
                print("❌ Ugyldig valg")
                self.pause()
                return

            inst = instances[idx]
            field = fields.get(inst.get("id"), {})
            print(f"\nEndrer: {field.get('name')}")
            print(
                f"  Nåværende: required={inst.get('required')}, disabled={inst.get('disabled')}"
            )

            print("\nHva vil du endre?")
            print("  1. Påkrevd (required)")
            print("  2. Deaktivert (disabled)")
            print("  0. Avbryt")
            choice = input("Velg: ").strip()

            if choice == "1":
                new_required = (
                    input("Skal feltet være påkrevd? (j/n): ").strip().lower() == "j"
                )
                result = self.tester.modify_custom_field_on_board(
                    inst.get("id"),
                    self.topic_board_id,
                    self.project_id,
                    required=new_required,
                )
            elif choice == "2":
                new_disabled = (
                    input("Skal feltet være deaktivert? (j/n): ").strip().lower() == "j"
                )
                result = self.tester.modify_custom_field_on_board(
                    inst.get("id"),
                    self.topic_board_id,
                    self.project_id,
                    disabled=new_disabled,
                )
            else:
                print("❌ Avbrutt")
                self.pause()
                return

            if result:
                print("\n✅ Custom field oppdatert")
            else:
                print("❌ Kunne ikke oppdatere custom field")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error modifying custom field")

        self.pause()

    def action_disable_custom_field(self):
        """Deaktiver custom field"""
        self.print_header("🚫 Deaktiver Custom Field")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        try:
            board = self.tester.get_topic_board_with_custom_fields(
                self.topic_board_id, self.project_id
            )
            if not board:
                print("❌ Kunne ikke hente board")
                self.pause()
                return

            instances = [
                i
                for i in board.get("customFieldInstances", [])
                if not i.get("disabled")
            ]
            fields = {f.get("id"): f for f in board.get("customFields", [])}

            if not instances:
                print("Ingen aktive custom fields å deaktivere.")
                self.pause()
                return

            print("Aktive custom fields:\n")
            for i, inst in enumerate(instances, 1):
                field = fields.get(inst.get("id"), {})
                print(f"  {i}. {field.get('name', 'Ukjent')}")

            try:
                idx = int(input("\nVelg field å deaktivere: ")) - 1
                if not 0 <= idx < len(instances):
                    print("❌ Ugyldig valg")
                    self.pause()
                    return
            except ValueError:
                print("❌ Ugyldig valg")
                self.pause()
                return

            inst = instances[idx]
            field = fields.get(inst.get("id"), {})

            confirm = (
                input(f"\nDeaktiver '{field.get('name')}'? (j/n): ").strip().lower()
            )
            if confirm != "j":
                print("❌ Avbrutt")
                self.pause()
                return

            result = self.tester.disable_custom_field_on_board(
                inst.get("id"), self.topic_board_id, self.project_id
            )

            if result:
                print(f"\n✅ Custom field '{field.get('name')}' deaktivert")
            else:
                print("❌ Kunne ikke deaktivere custom field")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error disabling custom field")

        self.pause()

    def action_restore_custom_field(self):
        """Gjenopprett deaktivert custom field"""
        self.print_header("♻️  Gjenopprett Custom Field")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        try:
            board = self.tester.get_topic_board_with_custom_fields(
                self.topic_board_id, self.project_id
            )
            if not board:
                print("❌ Kunne ikke hente board")
                self.pause()
                return

            instances = [
                i for i in board.get("customFieldInstances", []) if i.get("disabled")
            ]
            fields = {f.get("id"): f for f in board.get("customFields", [])}

            if not instances:
                print("Ingen deaktiverte custom fields å gjenopprette.")
                self.pause()
                return

            print("Deaktiverte custom fields:\n")
            for i, inst in enumerate(instances, 1):
                field = fields.get(inst.get("id"), {})
                print(f"  {i}. {field.get('name', 'Ukjent')}")

            try:
                idx = int(input("\nVelg field å gjenopprette: ")) - 1
                if not 0 <= idx < len(instances):
                    print("❌ Ugyldig valg")
                    self.pause()
                    return
            except ValueError:
                print("❌ Ugyldig valg")
                self.pause()
                return

            inst = instances[idx]
            field = fields.get(inst.get("id"), {})

            result = self.tester.restore_custom_field_on_board(
                inst.get("id"), self.topic_board_id, self.project_id
            )

            if result:
                print(f"\n✅ Custom field '{field.get('name')}' gjenopprettet")
            else:
                print("❌ Kunne ikke gjenopprette custom field")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error restoring custom field")

        self.pause()

    def action_delete_custom_field(self):
        """Fjern custom field fra board"""
        self.print_header("🗑️  Fjern Custom Field")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        try:
            board = self.tester.get_topic_board_with_custom_fields(
                self.topic_board_id, self.project_id
            )
            if not board:
                print("❌ Kunne ikke hente board")
                self.pause()
                return

            instances = board.get("customFieldInstances", [])
            fields = {f.get("id"): f for f in board.get("customFields", [])}

            if not instances:
                print("Ingen custom fields på boardet.")
                self.pause()
                return

            print("Custom fields på boardet:\n")
            for i, inst in enumerate(instances, 1):
                field = fields.get(inst.get("id"), {})
                disabled = " (deaktivert)" if inst.get("disabled") else ""
                print(f"  {i}. {field.get('name', 'Ukjent')}{disabled}")

            try:
                idx = int(input("\nVelg field å fjerne: ")) - 1
                if not 0 <= idx < len(instances):
                    print("❌ Ugyldig valg")
                    self.pause()
                    return
            except ValueError:
                print("❌ Ugyldig valg")
                self.pause()
                return

            inst = instances[idx]
            field = fields.get(inst.get("id"), {})

            print("\n⚠️  Dette fjerner feltet fra boardet.")
            print("   Eksisterende data på topics beholdes, men feltet vises ikke.")
            confirm = input(f"\nFjern '{field.get('name')}'? (j/n): ").strip().lower()
            if confirm != "j":
                print("❌ Avbrutt")
                self.pause()
                return

            result = self.tester.delete_custom_field_from_board(
                inst.get("id"), self.topic_board_id, self.project_id
            )

            if result:
                print(f"\n✅ Custom field '{field.get('name')}' fjernet fra boardet")
            else:
                print("❌ Kunne ikke fjerne custom field")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error deleting custom field")

        self.pause()

    # --------------------------------------------------------------------------
    # STATUS ACTIONS
    # --------------------------------------------------------------------------

    def action_list_statuses(self):
        """Liste alle statuser"""
        self.print_header("📋 Statuser")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        try:
            statuses = self.tester.list_statuses(
                self.topic_board_id, include_unlinked=True
            )

            if not statuses:
                print("Ingen statuser funnet.")
            else:
                print(f"Fant {len(statuses)} status(er):\n")
                for s in statuses:
                    color = s.get("color", "#???")
                    stype = s.get("type", "N/A")
                    unlinked = " (ukoblet)" if s.get("unlinked") else ""
                    print(f"  • {s.get('name')} [{stype}] {color}{unlinked}")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error listing statuses")

        self.pause()

    def action_create_status(self):
        """Opprett ny status"""
        self.print_header("➕ Opprett Status")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        name = input("Navn på status: ").strip()
        if not name:
            print("❌ Navn er påkrevd")
            self.pause()
            return

        print("\nType:")
        print("  1. open (åpen)")
        print("  2. closed (lukket)")
        print("  3. candidate (kandidat)")
        type_choice = input("Velg type (1-3) [1]: ").strip()
        status_type = {"1": "open", "2": "closed", "3": "candidate"}.get(
            type_choice, "open"
        )

        color = (
            input("Farge (hex, f.eks. #FF0000) [Enter for standard]: ").strip() or None
        )

        try:
            status = self.tester.create_status(
                name, color, status_type, self.topic_board_id
            )
            if status:
                print(
                    f"\n✅ Opprettet status: {status.get('name')} [{status.get('type')}]"
                )
            else:
                print("❌ Kunne ikke opprette status")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error creating status")

        self.pause()

    def action_update_status(self):
        """Oppdater eksisterende status"""
        self.print_header("✏️  Oppdater Status")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        # List eksisterende statuser
        statuses = self.tester.list_statuses(self.topic_board_id)
        if not statuses:
            print("Ingen statuser å oppdatere.")
            self.pause()
            return

        print("Eksisterende statuser:")
        for i, s in enumerate(statuses, 1):
            print(f"  {i}. {s.get('name')} [{s.get('type')}] {s.get('color')}")

        try:
            idx = int(input("\nVelg status å oppdatere: ")) - 1
            if not 0 <= idx < len(statuses):
                print("❌ Ugyldig valg")
                self.pause()
                return
        except ValueError:
            print("❌ Ugyldig valg")
            self.pause()
            return

        existing = statuses[idx]
        print(f"\nOppdaterer: {existing.get('name')}")

        new_name = input(f"Nytt navn [{existing.get('name')}]: ").strip() or None

        print("\nType:")
        print("  1. open (åpen)")
        print("  2. closed (lukket)")
        print("  3. candidate (kandidat)")
        print("  0. Behold eksisterende")
        type_choice = input("Velg type [0]: ").strip()
        status_type = {"1": "open", "2": "closed", "3": "candidate"}.get(type_choice)

        color = input(f"Farge [{existing.get('color')}]: ").strip() or None

        try:
            result = self.tester.update_status(
                existing.get("name"), new_name, color, status_type, self.topic_board_id
            )
            if result:
                print(f"\n✅ Oppdatert status: {result.get('name')}")
            else:
                print("❌ Kunne ikke oppdatere status")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error updating status")

        self.pause()

    def action_delete_status(self):
        """Slett status"""
        self.print_header("🗑️  Slett Status")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        statuses = self.tester.list_statuses(self.topic_board_id)
        if not statuses:
            print("Ingen statuser å slette.")
            self.pause()
            return

        print("Eksisterende statuser:")
        for i, s in enumerate(statuses, 1):
            print(f"  {i}. {s.get('name')} [{s.get('type')}]")

        try:
            idx = int(input("\nVelg status å slette: ")) - 1
            if not 0 <= idx < len(statuses):
                print("❌ Ugyldig valg")
                self.pause()
                return
        except ValueError:
            print("❌ Ugyldig valg")
            self.pause()
            return

        status = statuses[idx]
        confirm = input(f"\nSlett '{status.get('name')}'? (j/n): ").strip().lower()
        if confirm != "j":
            print("❌ Avbrutt")
            self.pause()
            return

        try:
            if self.tester.delete_status(status.get("name"), self.topic_board_id):
                print(f"✅ Slettet status: {status.get('name')}")
            else:
                print("❌ Kunne ikke slette status")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error deleting status")

        self.pause()

    # --------------------------------------------------------------------------
    # TYPE ACTIONS
    # --------------------------------------------------------------------------

    def action_list_types(self):
        """Liste alle typer"""
        self.print_header("📋 Typer")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        try:
            types = self.tester.list_types(self.topic_board_id, include_unlinked=True)

            if not types:
                print("Ingen typer funnet.")
            else:
                print(f"Fant {len(types)} type(r):\n")
                for t in types:
                    color = t.get("color", "#???")
                    unlinked = " (ukoblet)" if t.get("unlinked") else ""
                    print(f"  • {t.get('name')} {color}{unlinked}")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error listing types")

        self.pause()

    def action_create_type(self):
        """Opprett ny type"""
        self.print_header("➕ Opprett Type")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        name = input("Navn på type: ").strip()
        if not name:
            print("❌ Navn er påkrevd")
            self.pause()
            return

        color = (
            input("Farge (hex, f.eks. #3D85C6) [Enter for standard]: ").strip() or None
        )

        try:
            topic_type = self.tester.create_type(name, color, self.topic_board_id)
            if topic_type:
                print(f"\n✅ Opprettet type: {topic_type.get('name')}")
            else:
                print("❌ Kunne ikke opprette type")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error creating type")

        self.pause()

    def action_update_type(self):
        """Oppdater eksisterende type"""
        self.print_header("✏️  Oppdater Type")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        types = self.tester.list_types(self.topic_board_id)
        if not types:
            print("Ingen typer å oppdatere.")
            self.pause()
            return

        print("Eksisterende typer:")
        for i, t in enumerate(types, 1):
            print(f"  {i}. {t.get('name')} {t.get('color')}")

        try:
            idx = int(input("\nVelg type å oppdatere: ")) - 1
            if not 0 <= idx < len(types):
                print("❌ Ugyldig valg")
                self.pause()
                return
        except ValueError:
            print("❌ Ugyldig valg")
            self.pause()
            return

        existing = types[idx]
        print(f"\nOppdaterer: {existing.get('name')}")

        new_name = input(f"Nytt navn [{existing.get('name')}]: ").strip() or None
        color = input(f"Farge [{existing.get('color')}]: ").strip() or None

        try:
            result = self.tester.update_type(
                existing.get("name"), new_name, color, self.topic_board_id
            )
            if result:
                print(f"\n✅ Oppdatert type: {result.get('name')}")
            else:
                print("❌ Kunne ikke oppdatere type")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error updating type")

        self.pause()

    def action_delete_type(self):
        """Slett type"""
        self.print_header("🗑️  Slett Type")

        if not self.topic_board_id:
            print("❌ Ingen topic board valgt")
            self.pause()
            return

        types = self.tester.list_types(self.topic_board_id)
        if not types:
            print("Ingen typer å slette.")
            self.pause()
            return

        print("Eksisterende typer:")
        for i, t in enumerate(types, 1):
            print(f"  {i}. {t.get('name')}")

        try:
            idx = int(input("\nVelg type å slette: ")) - 1
            if not 0 <= idx < len(types):
                print("❌ Ugyldig valg")
                self.pause()
                return
        except ValueError:
            print("❌ Ugyldig valg")
            self.pause()
            return

        topic_type = types[idx]
        confirm = input(f"\nSlett '{topic_type.get('name')}'? (j/n): ").strip().lower()
        if confirm != "j":
            print("❌ Avbrutt")
            self.pause()
            return

        try:
            if self.tester.delete_type(topic_type.get("name"), self.topic_board_id):
                print(f"✅ Slettet type: {topic_type.get('name')}")
            else:
                print("❌ Kunne ikke slette type")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error deleting type")

        self.pause()

    # ==========================================================================
    # END TOPIC BOARD MANAGEMENT ACTIONS
    # ==========================================================================

    def _select_or_create_folder(self) -> str | None:
        """Hjelpefunksjon for å velge eller opprette mappe"""
        print("\n📁 Velg mappe:")
        print("  1. Velg eksisterende mappe")
        print("  2. Opprett ny mappe")
        print("  3. Skriv inn mappe-ID direkte")
        print("  0. Avbryt (bruk root)")
        print()

        choice = input("Velg (0-3): ").strip()

        if choice == "1":
            return self._browse_folders()

        elif choice == "2":
            return self._create_folder_interactive()

        elif choice == "3":
            folder_id = input("Mappe-ID (32 tegn uten bindestreker): ").strip()
            if folder_id:
                item = self.tester.get_library_item(self.project_id, folder_id)
                if item:
                    is_folder = (
                        item.get("type") == "folder"
                        or item.get("document", {}).get("type") == "folder"
                    )
                    if is_folder:
                        print(f"✅ Fant mappe: {item.get('name')}")
                        return folder_id
                    else:
                        print(f"⚠️ ID {folder_id} er ikke en mappe")
                        use_anyway = (
                            input("Bruke ID-en likevel som parentId? (j/n): ")
                            .strip()
                            .lower()
                        )
                        if use_anyway == "j":
                            return folder_id
                else:
                    print(f"❌ Fant ikke item med ID {folder_id}")
            return None

        return None

    def _select_topic(
        self, prompt: str = "Velg topic", exclude_guid: str | None = None
    ) -> tuple | None:
        """
        Vis liste over topics og la bruker velge én.

        Args:
            prompt: Tekst som vises over listen
            exclude_guid: GUID som skal ekskluderes fra listen (f.eks. aktiv topic)

        Returns:
            Tuple (guid, title) eller None hvis avbrutt
        """
        print(f"\n{prompt}")
        print("-" * 50)

        try:
            topics = self.tester.list_topics()

            if not topics:
                print("Ingen topics funnet.")
                return None

            # Filtrer ut excluded guid
            if exclude_guid:
                topics = [t for t in topics if t.get("guid") != exclude_guid]

            if not topics:
                print("Ingen andre topics tilgjengelig.")
                return None

            # Sorter alfabetisk på tittel
            topics.sort(key=lambda t: t.get("title", "").lower())

            # Vis liste
            print(f"\nFant {len(topics)} topic(s):\n")
            for i, topic in enumerate(topics, 1):
                title = topic.get("title", "Uten tittel")
                guid = topic.get("guid", "")[:8]
                topic_type = topic.get("topic_type", "")
                status = topic.get("topic_status", "")
                print(f"  {i:3}. {title}")
                print(f"       [{topic_type}] {status} - {guid}...")

            print("\n  S = Søk etter tittel")
            print("  G = Skriv GUID direkte")
            print("  0 = Avbryt\n")

            while True:
                choice = input("Velg (nummer/S/G/0): ").strip()

                if choice == "0":
                    return None

                if choice.upper() == "S":
                    search_term = input("Søkeord: ").strip().lower()
                    if search_term:
                        matches = [
                            t
                            for t in topics
                            if search_term in t.get("title", "").lower()
                        ]
                        if not matches:
                            print("Ingen treff.")
                            continue
                        elif len(matches) == 1:
                            topic = matches[0]
                            print(f"✅ Valgt: {topic.get('title')}")
                            return (topic.get("guid"), topic.get("title"))
                        else:
                            print(f"\nFant {len(matches)} treff:")
                            for i, t in enumerate(matches, 1):
                                print(f"  {i}. {t.get('title')}")
                            try:
                                idx = int(input("Velg nummer: ")) - 1
                                if 0 <= idx < len(matches):
                                    topic = matches[idx]
                                    print(f"✅ Valgt: {topic.get('title')}")
                                    return (topic.get("guid"), topic.get("title"))
                            except ValueError:
                                pass
                    continue

                if choice.upper() == "G":
                    guid = input("GUID: ").strip()
                    if guid:
                        # Sjekk om det finnes i listen
                        matching = [t for t in topics if t.get("guid") == guid]
                        if matching:
                            topic = matching[0]
                            print(f"✅ Valgt: {topic.get('title')}")
                            return (topic.get("guid"), topic.get("title"))
                        else:
                            # Godta GUID uansett (kan være fra annet board)
                            print(f"⚠️ GUID ikke i listen, bruker likevel: {guid}")
                            return (guid, "Ukjent topic")
                    continue

                try:
                    idx = int(choice) - 1
                    if 0 <= idx < len(topics):
                        topic = topics[idx]
                        print(f"✅ Valgt: {topic.get('title')}")
                        return (topic.get("guid"), topic.get("title"))
                    else:
                        print(f"❌ Velg mellom 1 og {len(topics)}")
                except ValueError:
                    print("❌ Ugyldig valg")

        except Exception as e:
            print(f"❌ Feil ved henting av topics: {e}")
            self.logger.exception("Error selecting topic")
            return None

    def _browse_folders(
        self, parent_id: str | None = None, path: str = "/"
    ) -> str | None:
        """Naviger i mappestrukturen"""
        # Hent mapper på dette nivået
        folders = self.tester.list_folders(
            self.project_id, parent_id=parent_id, include_subfolders=False
        )

        if not folders and parent_id is None:
            print("Ingen mapper funnet. Vil du opprette en?")
            if input("(j/n): ").strip().lower() == "j":
                return self._create_folder_interactive()
            return None

        # Sorter alfabetisk
        folders.sort(key=lambda f: f.get("name", "").lower())

        print(f"\n📁 Mappe: {path}")
        print("-" * 50)

        if parent_id:
            print("  0. ⬆️  Opp ett nivå")
            print("  U. ✅ Bruk denne mappen")

        if not folders:
            print("  (ingen undermapper)")
        else:
            for i, folder in enumerate(folders, 1):
                print(f"  {i}. 📁 {folder.get('name', 'Uten navn')}")

        print()
        choice = input("Velg (nummer, U for bruk, eller 0 for opp): ").strip().lower()

        if choice == "0" and parent_id:
            # Gå opp - returner None for å indikere at vi vil fortsette å browse
            # Dette er litt komplisert, så vi bare returnerer None
            return None
        elif choice == "u" and parent_id:
            return parent_id
        elif choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(folders):
                selected = folders[idx]
                new_path = f"{path}{selected.get('name')}/"
                # Naviger ned i denne mappen
                result = self._browse_folders(parent_id=selected["id"], path=new_path)
                if result:
                    return result
                # Hvis brukeren gikk opp, fortsett å vise denne mappen
                return self._browse_folders(parent_id=parent_id, path=path)

        print("❌ Ugyldig valg")
        return None

    def _create_folder_interactive(self, parent_id: str | None = None) -> str | None:
        """Opprett mappe interaktivt"""
        folder_name = input("Mappenavn: ").strip()
        if not folder_name:
            print("❌ Mappenavn er påkrevd")
            return None

        result = self.tester.create_folder(
            self.project_id, folder_name, parent_id=parent_id
        )
        if result:
            print(f"✅ Mappe opprettet: {result['id']}")
            return result["id"]

        print("❌ Kunne ikke opprette mappe")
        return None

    def menu_folders(self):
        """Meny for mappe-håndtering"""
        # Bruk CATENDA_FOLDER_ID fra config som default parent
        default_parent = getattr(settings, "catenda_folder_id", None)
        current_parent_id = default_parent
        current_path = "/"

        while True:
            self.print_header("📁 Mappe-håndtering")

            if not self.library_id:
                print(
                    "⚠️ Library ID er ikke satt. Velger standard 'Documents' bibliotek..."
                )
                if not self.tester.select_library(self.project_id, "Documents"):
                    print("❌ Kunne ikke finne/velge 'Documents' bibliotek.")
                    self.library_id = input("Library ID: ").strip()
                    if not self.library_id:
                        print("❌ Library ID er påkrevd")
                        self.pause()
                        return
                self.library_id = self.tester.library_id
            self.tester.library_id = self.library_id

            # Hent mapper på dette nivået
            folders = self.tester.list_folders(
                self.project_id, parent_id=current_parent_id, include_subfolders=False
            )
            folders = folders or []
            folders.sort(key=lambda f: f.get("name", "").lower())

            print(f"📍 Nåværende mappe: {current_path}")
            if current_parent_id:
                print(f"   (ID: {current_parent_id})")
            print()
            print("MAPPER:")
            if not folders:
                print("  (ingen undermapper)")
            else:
                for i, folder in enumerate(folders, 1):
                    print(f"  {i}. 📁 {folder.get('name', 'Uten navn')}")
            print()
            print("VALG:")
            if current_parent_id and current_parent_id != default_parent:
                print("  0. ⬆️  Opp ett nivå")
            print("  N. ➕ Opprett ny mappe her")
            print("  R. 🏠 Gå til rot (config folder)")
            print("  Q. 🚪 Tilbake til hovedmeny")
            print()

            choice = input("Velg (nummer for å navigere, N/R/Q): ").strip().lower()

            if choice == "q":
                return
            elif choice == "r":
                current_parent_id = default_parent
                current_path = "/"
            elif (
                choice == "0"
                and current_parent_id
                and current_parent_id != default_parent
            ):
                # Gå opp - for enkelhets skyld går vi til root
                current_parent_id = default_parent
                current_path = "/"
            elif choice == "n":
                new_folder = self._create_folder_interactive(
                    parent_id=current_parent_id
                )
                if new_folder:
                    print(f"\n✅ Ny mappe opprettet med ID: {new_folder}")
                    self.pause()
            elif choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < len(folders):
                    selected = folders[idx]
                    current_parent_id = selected.get("id")
                    current_path = f"{current_path}{selected.get('name')}/"
                else:
                    print("❌ Ugyldig valg")
                    self.pause()
            else:
                print("❌ Ugyldig valg")
                self.pause()

    def action_upload_document(self):
        """Last opp dokument til library"""
        self.print_header("📤 Last Opp Dokument")

        if not self.library_id:
            print("⚠️ Library ID er ikke satt. Velger standard 'Documents' bibliotek...")
            if not self.tester.select_library(self.project_id, "Documents"):
                print("❌ Kunne ikke finne/velge 'Documents' bibliotek. Oppgi manuelt:")
                self.library_id = input("Library ID: ").strip()
                if not self.library_id:
                    print("❌ Library ID er påkrevd")
                    self.pause()
                    return
            self.library_id = self.tester.library_id

        # Sørg for at tester-objektet har ID-en
        self.tester.library_id = self.library_id

        file_path = input("\nFilsti til dokument: ").strip()

        if not file_path or not Path(file_path).exists():
            print("❌ Filen finnes ikke")
            self.pause()
            return

        # Velg mappe
        folder_id = None
        use_folder = input("\nLaste opp til en mappe? (j/n): ").strip().lower()
        if use_folder == "j":
            folder_id = self._select_or_create_folder()

        document_name = Path(file_path).name
        print(f"\nLaster opp {document_name}...")

        try:
            result = self.tester.upload_document(
                project_id=self.project_id,
                file_path=file_path,
                document_name=f"TEST-{document_name}",
                folder_id=folder_id,
            )

            if result:
                library_item_id = result.get("id")
                print("✅ Opplasting vellykket!")
                print(f"   Library Item ID: {library_item_id}")
                print(f"   Navn: {result.get('name', 'N/A')}")

                # Tilby å knytte til aktiv topic
                if self.current_topic_id:
                    choice = (
                        input(
                            f"\nKnytte til aktiv topic ({self.current_topic_id})? (j/n): "
                        )
                        .strip()
                        .lower()
                    )
                    if choice == "j":
                        self.action_link_document_to_topic(library_item_id)
            else:
                print("❌ Opplasting feilet")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error uploading document")

        self.pause()

    def action_link_document_to_topic(self, library_item_id: str | None = None):
        """Knytt dokument til topic"""
        if not library_item_id:
            self.print_header("🔗 Knytt Dokument til Topic")

        if not self.current_topic_id:
            print("❌ Ingen aktiv topic satt")
            topic_id = input("Oppgi Topic GUID: ").strip()
            if not topic_id:
                self.pause()
                return
        else:
            topic_id = self.current_topic_id

        if not library_item_id:
            library_item_id = input("Library Item ID (32 tegn): ").strip()
            if not library_item_id:
                print("❌ Library Item ID er påkrevd")
                self.pause()
                return

        print(f"\nKnytter dokument {library_item_id} til topic {topic_id}...\n")

        try:
            # V2 API returnerer en kompakt UUID, BCF API forventer standard UUID med bindestreker.
            if len(library_item_id) == 32 and "-" not in library_item_id:
                document_guid = (
                    f"{library_item_id[0:8]}-"
                    f"{library_item_id[8:12]}-"
                    f"{library_item_id[12:16]}-"
                    f"{library_item_id[16:20]}-"
                    f"{library_item_id[20:32]}"
                )
                print(
                    f"Konverterer library-item-id til BCF document_guid: {document_guid}"
                )
            else:
                document_guid = library_item_id

            result = self.tester.create_document_reference(
                topic_id=topic_id,
                document_guid=document_guid,
                description="Knyttet via interaktivt script",
            )

            if result:
                print("✅ Dokument knyttet til topic!")
                print(f"   Reference GUID: {result.get('guid')}")
                print(f"   Document GUID: {result.get('document_guid')}")
            else:
                print("❌ Kunne ikke knytte dokument")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error linking document")

        if not library_item_id:
            self.pause()

    def action_add_comment(self):
        """Legg til kommentar på topic"""
        self.print_header("💬 Legg til Kommentar")

        if not self.current_topic_id:
            print("❌ Ingen aktiv topic satt")
            topic_id = input("Oppgi Topic GUID: ").strip()
            if not topic_id:
                self.pause()
                return
        else:
            topic_id = self.current_topic_id

        print("\nSkriv din kommentar (avslutt med tom linje):")
        lines = []
        while True:
            line = input()
            if not line:
                break
            lines.append(line)

        comment_text = "\n".join(lines)

        if not comment_text:
            print("❌ Kommentar kan ikke være tom")
            self.pause()
            return

        print("\nLegger til kommentar...\n")

        try:
            result = self.tester.create_comment(
                topic_id=topic_id, comment_text=comment_text
            )

            if result:
                print("✅ Kommentar lagt til!")
                print(f"   GUID: {result.get('guid')}")
            else:
                print("❌ Kunne ikke legge til kommentar")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error adding comment")

        self.pause()

    def action_inspect_bim_object(self):
        self.print_header("🏗️ Inspiser BIM-objekt")

        ifc_guid = input("Skriv inn IFC GUID: ").strip()

        # OBS: Dette krever v2 project_id, ikke topic_board_id
        if not self.project_id:
            print("❌ Mangler Project ID (v2)")
            self.pause()
            return

        product = self.tester.get_product_details_by_guid(self.project_id, ifc_guid)

        if product:
            print("\n" + "=" * 60)
            print(f"OBJ: {product.get('attributes', {}).get('Name')}")
            print(f"TYPE: {product.get('ifcType')}")
            print("=" * 60)

            # Vis Property Sets (Egenskaper)
            psets = product.get("propertySets", {})
            if psets:
                print("\n📋 EGENSKAPER (Property Sets):")
                for pset_name, pset_data in psets.items():
                    print(f"  🔹 {pset_name}:")
                    for prop_name, prop_val in pset_data.get("properties", {}).items():
                        # Verdien ligger ofte nøstet, f.eks. "value": "EI30"
                        val = prop_val.get("value", "N/A")
                        print(f"     - {prop_name}: {val}")

            # Vis Quantity Sets (Mengder)
            qsets = product.get("quantitySets", {})
            if qsets:
                print("\nu001F4CF MENGDER (Quantity Sets):")
                for qset_name, qset_data in qsets.items():
                    print(f"  🔹 {qset_name}:")
                    for quant_name, quant_val in qset_data.get(
                        "quantities", {}
                    ).items():
                        val = quant_val.get("value", {}).get("value", "N/A")
                        unit = quant_val.get("value", {}).get("unit", "")
                        print(f"     - {quant_name}: {val} {unit}")

            # Vis Materialer
            materials = product.get("materials", [])
            if materials:
                print("\n🧱 MATERIALER:")
                for mat in materials:
                    # Materialstrukturen kan variere litt (LayerSet vs Material)
                    print(
                        f"  - {json.dumps(mat.get('attributes', {}), ensure_ascii=False)}"
                    )

        self.pause()

    def menu_webhooks(self):
        """Meny for webhook-håndtering"""
        while True:
            self.print_header("🔔 Webhook-håndtering")

            print("VALG:")
            print("  1. Liste aktive webhooks")
            print("  2. Opprett ny webhook")
            print("  3. Slett webhook")
            print("  0. Tilbake til hovedmeny")
            print()

            choice = input("Velg (0-3): ").strip()

            if choice == "1":
                self.action_list_webhooks()
            elif choice == "2":
                self.action_create_webhook()
            elif choice == "3":
                self.action_delete_webhook()
            elif choice == "0":
                break
            else:
                print("❌ Ugyldig valg")
                self.pause()

    def action_list_webhooks(self):
        """List alle webhooks"""
        self.print_header("🔔 Liste Webhooks")

        print("Henter webhooks...\n")

        try:
            webhooks = self.tester.list_webhooks(self.project_id)

            if not webhooks:
                print("Ingen webhooks funnet.")
            else:
                print(f"Fant {len(webhooks)} webhook(s):\n")
                for i, webhook in enumerate(webhooks, 1):
                    print(f"{i}. {webhook.get('name', 'Uten navn')}")
                    print(f"   ID: {webhook['id']}")
                    print(f"   URL: {webhook.get('url', 'N/A')}")
                    print(f"   Events: {', '.join(webhook.get('events', []))}")
                    print()

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error listing webhooks")

        self.pause()

    def action_create_webhook(self):
        """Opprett ny webhook"""
        self.print_header("🔔 Opprett Webhook")

        print("Oppgi informasjon om webhoken:\n")

        name = input("Navn (f.eks. 'KOE-varsler'): ").strip()
        target_url = input("Callback URL: ").strip()

        if not name or not target_url:
            print("❌ Navn og URL er påkrevd")
            self.pause()
            return

        print("\nVelg event å lytte på (ett om gangen, f.eks. 'issue.created'):")
        event = input("Event: ").strip()

        if not event:
            print("❌ Event er påkrevd")
            self.pause()
            return

        print(f"\nOppretter webhook for '{event}'...")

        try:
            result = self.tester.create_webhook(
                project_id=self.project_id,
                name=f"{name} ({event})",
                target_url=target_url,
                event=event,
            )

            if result:
                print("\n✅ Webhook opprettet!")
                print(f"   ID: {result.get('id')}")
                print(f"   Navn: {result.get('name')}")
                print(f"   Event: {result.get('event')}")
            else:
                print("❌ Opprettelse feilet")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error creating webhook")

        self.pause()

    def action_delete_webhook(self):
        """Slett webhook"""
        self.print_header("🗑️  Slett Webhook")

        webhook_id = input("Webhook ID: ").strip()

        if not webhook_id:
            print("❌ Webhook ID er påkrevd")
            self.pause()
            return

        confirm = (
            input(f"\nEr du sikker på at du vil slette webhook {webhook_id}? (j/n): ")
            .strip()
            .lower()
        )

        if confirm != "j":
            print("❌ Avbrutt")
            self.pause()
            return

        print("\nSletter webhook...")

        try:
            success = self.tester.delete_webhook(self.project_id, webhook_id)

            if success:
                print("✅ Webhook slettet!")
            else:
                print("❌ Sletting feilet")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error deleting webhook")

        self.pause()

    def action_change_config(self):
        """Endre konfigurasjon"""
        self.print_header("⚙️  Endre Konfigurasjon")

        print("Nåværende verdier:")
        print(f"  Project ID: {self.project_id}")
        print(f"  Library ID: {self.library_id or '(ikke satt)'}")
        print(f"  Topic Board ID: {self.topic_board_id}")
        print()

        print("La stå tomt for å beholde nåværende verdi.\n")

        new_project = input(f"Ny Project ID [{self.project_id}]: ").strip()
        if new_project:
            self.project_id = new_project

        new_library = input(f"Ny Library ID [{self.library_id or 'ingen'}]: ").strip()
        if new_library:
            self.library_id = new_library

        new_board = input(f"Ny Topic Board ID [{self.topic_board_id}]: ").strip()
        if new_board:
            self.topic_board_id = new_board

        print("\n✅ Konfigurasjon oppdatert!")
        self.pause()

    def demo_koe_flow(self):
        """Demonstrer full KOE-flyt"""
        self.print_header("🔄 Full KOE-Flyt Demonstrasjon")

        print("Denne demonstrasjonen vil:")
        print("  1. Opprette en ny topic (simulerer ny sak fra webhook)")
        print("  2. Laste opp et dokument (KOE-dokument fra TE)")
        print("  3. Knytte dokumentet til topicen")
        print("  4. Legge til en kommentar (simulerer BH-respons)")
        print()

        choice = input("Vil du fortsette? (j/n): ").strip().lower()
        if choice != "j":
            return

        try:
            # Steg 1: Opprett topic
            print("\n[Steg 1/4] Oppretter topic...")
            topic_title = f"KOE Demo {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            topic = self.tester.create_topic(
                title=topic_title,
                description="Demonstrasjon av KOE-flyt via Catenda API",
                topic_type="Request",
                topic_status="Open",
            )

            if not topic or "guid" not in topic:
                print("❌ Kunne ikke opprette topic")
                self.pause()
                return

            topic_id = topic["guid"]
            print(f"✅ Topic opprettet: {topic_id}")

            # Steg 2: Last opp dokument
            print("\n[Steg 2/4] Laster opp dokument...")
            file_path_input = input(
                "Filsti til dokument (eller Enter for test-dokument): "
            ).strip()

            if not file_path_input:
                import tempfile

                # Opprett test-dokument i temp-mappe
                temp_dir = tempfile.gettempdir()
                test_file = Path(temp_dir) / "koe_demo_test.txt"
                test_file.write_text(
                    f"KOE Demo Test Dokument\nOpprettet: {datetime.now()}\nTopic: {topic_id}"
                )
                file_path = str(test_file)
                print(f"Bruker midlertidig test-dokument: {file_path}")
            else:
                file_path = file_path_input

            if not self.library_id:
                print("⚠️ Library ID er ikke satt, velger 'Documents'...")
                if not self.tester.select_library(self.project_id, "Documents"):
                    print("❌ Fant ikke 'Documents' library. Avbryter.")
                    self.pause()
                    return
                self.library_id = self.tester.library_id

            self.tester.library_id = self.library_id

            doc = self.tester.upload_document(
                project_id=self.project_id, file_path=file_path
            )

            if not doc or "id" not in doc:
                print("❌ Kunne ikke laste opp dokument")
                self.pause()
                return

            library_item_id = doc["id"]
            print(f"✅ Dokument lastet opp: {library_item_id}")

            # Steg 3: Knytt dokument
            print("\n[Steg 3/4] Knytter dokument til topic...")

            # Konverter til standard UUID-format
            if len(library_item_id) == 32 and "-" not in library_item_id:
                document_guid = (
                    f"{library_item_id[0:8]}-"
                    f"{library_item_id[8:12]}-"
                    f"{library_item_id[12:16]}-"
                    f"{library_item_id[16:20]}-"
                    f"{library_item_id[20:32]}"
                )
            else:
                document_guid = library_item_id

            doc_ref = self.tester.create_document_reference(
                topic_id=topic_id, document_guid=document_guid
            )

            if not doc_ref:
                print("❌ Kunne ikke knytte dokument")
                self.pause()
                return

            print(f"✅ Dokument knyttet: {document_guid}")

            # Steg 4: Legg til kommentar
            print("\n[Steg 4/4] Legger til kommentar...")
            comment_text = f"BH har mottatt kravet og vil vurdere det.\nDokument referanse: {document_guid}"

            comment = self.tester.create_comment(
                topic_id=topic_id, comment_text=comment_text
            )

            if not comment:
                print("❌ Kunne ikke legge til kommentar")
                self.pause()
                return

            print("✅ Kommentar lagt til")

            # Oppsummering
            print("\n" + "=" * 70)
            print("✅ FULL KOE-FLYT FULLFØRT!")
            print("=" * 70)
            print(f"\nTopic ID: {topic_id}")
            print(f"Tittel: {topic_title}")
            print(f"Dokument: {document_guid}")
            print("\nGå til Catenda for å se resultatet!")

        except Exception as e:
            print(f"\n❌ Feil under demonstrasjon: {e}")
            self.logger.exception("Error in demo flow")

        self.pause()

    def run(self):
        """Kjør interaktiv meny"""
        try:
            # Initialiser forbindelse
            if not self.initialize_connection():
                print("\n❌ Kunne ikke initialisere forbindelse")
                sys.exit(1)

            self.pause()

            # Kjør hovedmeny
            self.menu_main()

        except KeyboardInterrupt:
            print("\n\n👋 Avbrutt av bruker. Ha det!")
            sys.exit(0)
        except Exception as e:
            print(f"\n❌ Uventet feil: {e}")
            self.logger.exception("Unexpected error")
            sys.exit(1)


def main():
    """Hovedfunksjon"""
    menu = CatendaInteractiveMenu()
    menu.run()


if __name__ == "__main__":
    main()
