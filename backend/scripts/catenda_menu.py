#!/usr/bin/env python3
"""
Catenda Interactive Menu - Interaktivt menybasert script for Catenda API
Basert på suksessfulle tester av ID-mapping og document_references
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime

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
        self.tester: Optional[CatendaClient] = None
        self.project_id: Optional[str] = None
        self.library_id: Optional[str] = None
        self.topic_board_id: Optional[str] = None
        self.current_topic_id: Optional[str] = None
        
        # Konfigurer logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('catenda_interactive.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def clear_screen(self):
        """Tøm skjermen"""
        os.system('clear' if os.name == 'posix' else 'cls')
    
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
                print("   Kjør 'python scripts/setup_authentication.py' for å konfigurere.")
                return False
            
            # Opprett tester-objekt
            self.tester = CatendaClient(
                client_id=client_id,
                client_secret=client_secret
            )

            if access_token_from_config:
                # Sett manuelt access token for å sikre at token_expiry blir satt
                self.tester.set_access_token(access_token_from_config)

            # Autentiser
            print("\nAutentiserer...")
            if not self.tester.ensure_authenticated():
                if not self.tester.authenticate():
                    print("❌ Autentisering feilet. Sjekk credentials i .env")
                    print("   Kjør 'python scripts/setup_authentication.py' for nytt token.")
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
                        choice = input(f"\nVelg topic board (1-{len(boards)}): ").strip()
                    
                    idx = int(choice) - 1
                    if 0 <= idx < len(boards):
                        selected_board = boards[idx]
                        self.topic_board_id = selected_board['project_id']
                        self.tester.topic_board_id = self.topic_board_id # Sett på tester-objektet
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
                     print(f"✅ Bibliotek 'Documents' valgt automatisk.")
                else:
                    print("⚠️ Kunne ikke velge bibliotek automatisk. Du kan sette det manuelt fra menyen.")
            
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
            print("  0. 🚪 Avslutt")
            print()
            
            choice = input("Velg (0-8): ").strip()
            
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
            elif choice == "0":
                print("\n👋 Ha det!")
                sys.exit(0)
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
            print("  0. Tilbake til hovedmeny")
            print()

            choice = input("Velg (0-5): ").strip()

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
                choice = input("Vil du velge en av disse som aktiv topic? (j/n): ").strip().lower()
                if choice == 'j':
                    while True:
                        try:
                            idx = int(input(f"Velg nummer (1-{len(topics)}): ")) - 1
                            if 0 <= idx < len(topics):
                                self.current_topic_id = topics[idx]['guid']
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
                topic_status=topic_status or None
            )
            
            if result and 'guid' in result:
                print(f"\n✅ Topic opprettet!")
                print(f"   GUID: {result['guid']}")
                print(f"   Tittel: {result.get('title')}")
                
                choice = input("\nSett denne som aktiv topic? (j/n): ").strip().lower()
                if choice == 'j':
                    self.current_topic_id = result['guid']
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
                t for t in topics 
                if search_term.lower() in t.get('title', '').lower() or
                   search_term.lower() in t.get('description', '').lower()
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
            
            print("="*29 + " 📋 TOPIC DATA " + "="*30)
            print(json.dumps(topic, indent=2, ensure_ascii=False))
            print("="*70)
            print()

            # 2. Hent Topic Board (BCF Project) data
            topic_board = self.tester.get_topic_board_details()
            if topic_board:
                print("="*24 + " 📋 TOPIC BOARD DATA " + "="*25)
                print(json.dumps(topic_board, indent=2, ensure_ascii=False))
                print("="*70)
                print()

                # 3. Hent fulle Project (v2) detaljer
                bimsync_project_id = topic_board.get('bimsync_project_id')
                if bimsync_project_id:
                    project_details = self.tester.get_project_details(bimsync_project_id)
                    if project_details:
                        print("="*26 + " 📋 PROJECT DATA " + "="*27)
                        print(json.dumps(project_details, indent=2, ensure_ascii=False))
                        print("="*70)
                        print()

            # 4. Hent kommentarer
            comments = self.tester.get_comments(topic_id)
            print(f"💬 KOMMENTARER ({len(comments)})")
            if comments:
                print(json.dumps(comments, indent=2, ensure_ascii=False))
            else:
                print("Ingen kommentarer funnet.")
            print("="*70)
            print()
            
            # 5. Hent dokumentreferanser
            docs = self.tester.list_document_references(topic_id)
            print(f"📄 DOKUMENTREFERANSER ({len(docs)})")
            if docs:
                print(json.dumps(docs, indent=2, ensure_ascii=False))
            else:
                print("Ingen dokumentreferanser funnet.")
            print("="*70)

            # 6. Hent BIM-objekter (IFC GUIDs)
            bim_objects = self.tester.get_bim_objects_for_topic(topic_id)
            print(f"🕋 BIM-OBJEKTER ({len(bim_objects)})")
            if bim_objects:
                print(json.dumps(bim_objects, indent=2, ensure_ascii=False))
            else:
                print("Ingen BIM-objekter funnet.")
            print("="*70)

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error showing topic details")

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
            related = self.tester.list_related_topics(topic_id, include_project_topics=True)

            if not related:
                print("Ingen relaterte topics funnet.")
            else:
                print(f"Fant {len(related)} relatert(e) topic(s):\n")
                for i, rel in enumerate(related, 1):
                    related_guid = rel.get('related_topic_guid', 'N/A')
                    board_ref = rel.get('bimsync_issue_board_ref', 'samme board')
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
            if confirm != 'j':
                source_topic = input("Kilde-topic GUID: ").strip()

        print("\nOppgi GUIDs til topics som skal relateres (én per linje, tom linje avslutter):")
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
                topic_id=source_topic,
                related_topic_guids=target_guids
            )

            if success:
                print(f"✅ Relasjoner opprettet!")
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

        topic_a = self.current_topic_id
        if not topic_a:
            topic_a = input("Topic A GUID: ").strip()
        else:
            print(f"Bruker aktiv topic som Topic A: {topic_a}")
            confirm = input("Vil du bruke denne? (j/n): ").strip().lower()
            if confirm != 'j':
                topic_a = input("Topic A GUID: ").strip()

        if not topic_a:
            print("❌ Topic A GUID er påkrevd")
            self.pause()
            return

        topic_b = input("Topic B GUID: ").strip()
        if not topic_b:
            print("❌ Topic B GUID er påkrevd")
            self.pause()
            return

        print(f"\nOppretter toveis-relasjon: {topic_a} ↔ {topic_b}...")

        try:
            # A → B
            success_a = self.tester.create_topic_relations(
                topic_id=topic_a,
                related_topic_guids=[topic_b]
            )

            # B → A
            success_b = self.tester.create_topic_relations(
                topic_id=topic_b,
                related_topic_guids=[topic_a]
            )

            if success_a and success_b:
                print(f"✅ Toveis-relasjon opprettet!")
                print(f"   {topic_a} → {topic_b}")
                print(f"   {topic_b} → {topic_a}")
            else:
                print("⚠️ Delvis feil ved opprettelse")
                print(f"   A → B: {'✅' if success_a else '❌'}")
                print(f"   B → A: {'✅' if success_b else '❌'}")

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

        bidirectional = input("Slett begge veier (toveis)? (j/n): ").strip().lower() == 'j'

        confirm = input(f"\nSlett relasjon{'er' if bidirectional else ''}? (j/n): ").strip().lower()
        if confirm != 'j':
            print("❌ Avbrutt")
            self.pause()
            return

        try:
            # Slett A → B
            success_a = self.tester.delete_topic_relation(
                topic_id=topic_id,
                related_topic_id=related_topic_id
            )
            print(f"   {topic_id} → {related_topic_id}: {'✅ Slettet' if success_a else '❌ Feilet'}")

            if bidirectional:
                # Slett B → A
                success_b = self.tester.delete_topic_relation(
                    topic_id=related_topic_id,
                    related_topic_id=topic_id
                )
                print(f"   {related_topic_id} → {topic_id}: {'✅ Slettet' if success_b else '❌ Feilet'}")

            print("\n✅ Ferdig!")

        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error deleting topic relation")

        self.pause()

    def _select_or_create_folder(self) -> Optional[str]:
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
                        item.get('type') == 'folder' or
                        item.get('document', {}).get('type') == 'folder'
                    )
                    if is_folder:
                        print(f"✅ Fant mappe: {item.get('name')}")
                        return folder_id
                    else:
                        print(f"⚠️ ID {folder_id} er ikke en mappe")
                        use_anyway = input("Bruke ID-en likevel som parentId? (j/n): ").strip().lower()
                        if use_anyway == 'j':
                            return folder_id
                else:
                    print(f"❌ Fant ikke item med ID {folder_id}")
            return None

        return None

    def _browse_folders(self, parent_id: Optional[str] = None, path: str = "/") -> Optional[str]:
        """Naviger i mappestrukturen"""
        # Hent mapper på dette nivået
        folders = self.tester.list_folders(self.project_id, parent_id=parent_id, include_subfolders=False)

        if not folders and parent_id is None:
            print("Ingen mapper funnet. Vil du opprette en?")
            if input("(j/n): ").strip().lower() == 'j':
                return self._create_folder_interactive()
            return None

        # Sorter alfabetisk
        folders.sort(key=lambda f: f.get('name', '').lower())

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

        if choice == '0' and parent_id:
            # Gå opp - returner None for å indikere at vi vil fortsette å browse
            # Dette er litt komplisert, så vi bare returnerer None
            return None
        elif choice == 'u' and parent_id:
            return parent_id
        elif choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(folders):
                selected = folders[idx]
                new_path = f"{path}{selected.get('name')}/"
                # Naviger ned i denne mappen
                result = self._browse_folders(parent_id=selected['id'], path=new_path)
                if result:
                    return result
                # Hvis brukeren gikk opp, fortsett å vise denne mappen
                return self._browse_folders(parent_id=parent_id, path=path)

        print("❌ Ugyldig valg")
        return None

    def _create_folder_interactive(self) -> Optional[str]:
        """Opprett mappe interaktivt"""
        folder_name = input("Mappenavn: ").strip()
        if not folder_name:
            print("❌ Mappenavn er påkrevd")
            return None

        result = self.tester.create_folder(self.project_id, folder_name)
        if result:
            print(f"✅ Mappe opprettet: {result['id']}")
            return result['id']

        print("❌ Kunne ikke opprette mappe")
        return None

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
        if use_folder == 'j':
            folder_id = self._select_or_create_folder()

        document_name = Path(file_path).name
        print(f"\nLaster opp {document_name}...")

        try:
            result = self.tester.upload_document(
                project_id=self.project_id,
                file_path=file_path,
                document_name=f"TEST-{document_name}",
                folder_id=folder_id
            )
            
            if result:
                library_item_id = result.get('id')
                print(f"✅ Opplasting vellykket!")
                print(f"   Library Item ID: {library_item_id}")
                print(f"   Navn: {result.get('name', 'N/A')}")
                
                # Tilby å knytte til aktiv topic
                if self.current_topic_id:
                    choice = input(f"\nKnytte til aktiv topic ({self.current_topic_id})? (j/n): ").strip().lower()
                    if choice == 'j':
                        self.action_link_document_to_topic(library_item_id)
            else:
                print("❌ Opplasting feilet")
        
        except Exception as e:
            print(f"❌ Feil: {e}")
            self.logger.exception("Error uploading document")
        
        self.pause()
    
    def action_link_document_to_topic(self, library_item_id: Optional[str] = None):
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
            if len(library_item_id) == 32 and '-' not in library_item_id:
                document_guid = (
                    f"{library_item_id[0:8]}-"
                    f"{library_item_id[8:12]}-"
                    f"{library_item_id[12:16]}-"
                    f"{library_item_id[16:20]}-"
                    f"{library_item_id[20:32]}"
                )
                print(f"Konverterer library-item-id til BCF document_guid: {document_guid}")
            else:
                document_guid = library_item_id
            
            result = self.tester.create_document_reference(
                topic_id=topic_id,
                document_guid=document_guid,
                description="Knyttet via interaktivt script"
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
                topic_id=topic_id,
                comment_text=comment_text
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
            print("\n" + "="*60)
            print(f"OBJ: {product.get('attributes', {}).get('Name')}")
            print(f"TYPE: {product.get('ifcType')}")
            print("="*60)
            
            # Vis Property Sets (Egenskaper)
            psets = product.get('propertySets', {})
            if psets:
                print("\n📋 EGENSKAPER (Property Sets):")
                for pset_name, pset_data in psets.items():
                    print(f"  🔹 {pset_name}:")
                    for prop_name, prop_val in pset_data.get('properties', {}).items():
                        # Verdien ligger ofte nøstet, f.eks. "value": "EI30"
                        val = prop_val.get('value', 'N/A')
                        print(f"     - {prop_name}: {val}")

            # Vis Quantity Sets (Mengder)
            qsets = product.get('quantitySets', {})
            if qsets:
                print("\nu001F4CF MENGDER (Quantity Sets):")
                for qset_name, qset_data in qsets.items():
                    print(f"  🔹 {qset_name}:")
                    for quant_name, quant_val in qset_data.get('quantities', {}).items():
                         val = quant_val.get('value', {}).get('value', 'N/A')
                         unit = quant_val.get('value', {}).get('unit', '')
                         print(f"     - {quant_name}: {val} {unit}")
            
            # Vis Materialer
            materials = product.get('materials', [])
            if materials:
                print("\n🧱 MATERIALER:")
                for mat in materials:
                    # Materialstrukturen kan variere litt (LayerSet vs Material)
                    print(f"  - {json.dumps(mat.get('attributes', {}), ensure_ascii=False)}")

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
                event=event
            )
            
            if result:
                print(f"\n✅ Webhook opprettet!")
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
        
        confirm = input(f"\nEr du sikker på at du vil slette webhook {webhook_id}? (j/n): ").strip().lower()
        
        if confirm != 'j':
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
        if choice != 'j':
            return
        
        try:
            # Steg 1: Opprett topic
            print("\n[Steg 1/4] Oppretter topic...")
            topic_title = f"KOE Demo {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            topic = self.tester.create_topic(
                title=topic_title,
                description="Demonstrasjon av KOE-flyt via Catenda API",
                topic_type="Request",
                topic_status="Open"
            )
            
            if not topic or 'guid' not in topic:
                print("❌ Kunne ikke opprette topic")
                self.pause()
                return
            
            topic_id = topic['guid']
            print(f"✅ Topic opprettet: {topic_id}")
            
            # Steg 2: Last opp dokument
            print("\n[Steg 2/4] Laster opp dokument...")
            file_path_input = input("Filsti til dokument (eller Enter for test-dokument): ").strip()
            
            if not file_path_input:
                import tempfile
                # Opprett test-dokument i temp-mappe
                temp_dir = tempfile.gettempdir()
                test_file = Path(temp_dir) / "koe_demo_test.txt"
                test_file.write_text(f"KOE Demo Test Dokument\nOpprettet: {datetime.now()}\nTopic: {topic_id}")
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
                project_id=self.project_id,
                file_path=file_path
            )
            
            if not doc or 'id' not in doc:
                print("❌ Kunne ikke laste opp dokument")
                self.pause()
                return
            
            library_item_id = doc['id']
            print(f"✅ Dokument lastet opp: {library_item_id}")
            
            # Steg 3: Knytt dokument
            print("\n[Steg 3/4] Knytter dokument til topic...")
            
            # Konverter til standard UUID-format
            if len(library_item_id) == 32 and '-' not in library_item_id:
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
                topic_id=topic_id,
                document_guid=document_guid
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
                topic_id=topic_id,
                comment_text=comment_text
            )
            
            if not comment:
                print("❌ Kunne ikke legge til kommentar")
                self.pause()
                return
            
            print(f"✅ Kommentar lagt til")
            
            # Oppsummering
            print("\n" + "="*70)
            print("✅ FULL KOE-FLYT FULLFØRT!")
            print("="*70)
            print(f"\nTopic ID: {topic_id}")
            print(f"Tittel: {topic_title}")
            print(f"Dokument: {document_guid}")
            print(f"\nGå til Catenda for å se resultatet!")
            
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
