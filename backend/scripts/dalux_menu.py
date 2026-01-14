#!/usr/bin/env python3
"""
Dalux Interactive Menu - Interaktivt menybasert script for Dalux API

Bruk:
    cd backend
    source venv/bin/activate
    python scripts/dalux_menu.py

Krever:
    DALUX_API_KEY og DALUX_BASE_URL i .env
"""

import os
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

# Legg til parent directory i path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Last .env
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

# Imports
try:
    from integrations.dalux import DaluxClient, DaluxAuthError, DaluxAPIError
    from lib.dalux_factory import get_dalux_client
    from repositories.sync_mapping_repository import create_sync_mapping_repository
    from services.dalux_sync_service import DaluxSyncService
    from lib.catenda_factory import get_catenda_client
except ImportError as e:
    print(f"Import feilet: {e}")
    print("Sørg for at scriptet kjøres fra backend/-mappen.")
    sys.exit(1)


class DaluxInteractiveMenu:
    """Interaktiv meny for Dalux API-operasjoner"""

    def __init__(self):
        self.client: Optional[DaluxClient] = None
        self.current_project_id: Optional[str] = None
        self.current_project_name: Optional[str] = None
        self.projects: List[Dict[str, Any]] = []

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
        print(f"  DALUX: {title}")
        print("=" * 70)
        print()

    def print_status(self):
        """Vis tilkoblingsstatus"""
        if self.client:
            print(f"[Tilkoblet] ", end="")
            if self.current_project_name:
                print(f"Prosjekt: {self.current_project_name} ({self.current_project_id})")
            else:
                print("Ingen prosjekt valgt")
        else:
            print("[Ikke tilkoblet]")
        print("-" * 70)

    def initialize_connection(self) -> bool:
        """Initialiser forbindelse til Dalux"""
        self.print_header("Koble til Dalux")

        print("Leser credentials fra .env...")
        print(f"  DALUX_API_KEY: {'***' + os.environ.get('DALUX_API_KEY', '')[-4:] if os.environ.get('DALUX_API_KEY') else 'IKKE SATT'}")
        print(f"  DALUX_BASE_URL: {os.environ.get('DALUX_BASE_URL', 'IKKE SATT')}")
        print()

        self.client = get_dalux_client()

        if not self.client:
            print("Dalux ikke konfigurert!")
            print("Sett DALUX_API_KEY og DALUX_BASE_URL i .env")
            return False

        print("Tester tilkobling...")
        try:
            if self.client.health_check():
                print("Tilkobling vellykket!")
                self.projects = self.client.get_projects()
                print(f"Fant {len(self.projects)} tilgjengelig(e) prosjekt(er)")
                return True
            else:
                print("Tilkobling feilet - sjekk API-nøkkel")
                return False
        except DaluxAuthError as e:
            print(f"Autentisering feilet: {e}")
            return False
        except DaluxAPIError as e:
            print(f"API-feil: {e}")
            return False

    def select_project(self):
        """Velg aktivt prosjekt"""
        self.print_header("Velg prosjekt")
        self.print_status()

        if not self.projects:
            print("Ingen prosjekter tilgjengelig.")
            self.pause()
            return

        print(f"\nTilgjengelige prosjekter ({len(self.projects)}):\n")
        for i, p in enumerate(self.projects, 1):
            data = p.get("data", {})
            project_id = data.get("projectId", "?")
            project_name = data.get("projectName", "Ukjent")
            marker = " <-- valgt" if project_id == self.current_project_id else ""
            print(f"  {i}. {project_name} (ID: {project_id}){marker}")

        print(f"\n  0. Tilbake")

        try:
            choice = input("\nVelg prosjekt: ").strip()
            if choice == "0" or choice == "":
                return

            idx = int(choice) - 1
            if 0 <= idx < len(self.projects):
                data = self.projects[idx].get("data", {})
                self.current_project_id = data.get("projectId")
                self.current_project_name = data.get("projectName")
                print(f"\nValgte: {self.current_project_name}")
            else:
                print("Ugyldig valg")
        except ValueError:
            print("Ugyldig input")

        self.pause()

    def list_tasks(self):
        """Vis tasks for valgt prosjekt"""
        self.print_header("Tasks")
        self.print_status()

        if not self.current_project_id:
            print("Velg et prosjekt først (meny 2)")
            self.pause()
            return

        print(f"Henter tasks for {self.current_project_name}...\n")

        try:
            tasks = self.client.get_tasks(self.current_project_id, limit=50)

            if not tasks:
                print("Ingen tasks funnet.")
                self.pause()
                return

            print(f"Fant {len(tasks)} task(s):\n")
            print(f"{'Nummer':<10} {'Task ID':<22} {'Type':<12} {'Tittel':<35}")
            print("-" * 82)

            for t in tasks[:30]:  # Vis maks 30
                data = t.get("data", {})
                number = data.get("number", "?")[:9]
                task_id = data.get("taskId", "?")[:21]
                type_obj = data.get("type", {})
                type_name = type_obj.get("name", "?") if isinstance(type_obj, dict) else str(type_obj)[:11]
                subject = data.get("subject", "Untitled")[:34]
                print(f"{number:<10} {task_id:<22} {type_name:<12} {subject:<35}")

            if len(tasks) > 30:
                print(f"\n... og {len(tasks) - 30} flere")

        except DaluxAPIError as e:
            print(f"Feil ved henting av tasks: {e}")

        self.pause()

    def view_task_details(self):
        """Vis detaljer for en spesifikk task"""
        self.print_header("Task-detaljer")
        self.print_status()

        if not self.current_project_id:
            print("Velg et prosjekt først (meny 2)")
            self.pause()
            return

        task_id = input("Oppgi Task ID: ").strip()
        if not task_id:
            return

        print(f"\nHenter task {task_id}...\n")

        try:
            task = self.client.get_task(self.current_project_id, task_id)

            if not task:
                print(f"Task {task_id} ikke funnet")
                self.pause()
                return

            data = task.get("data", {})

            print(f"Task ID:      {data.get('taskId')}")
            print(f"Nummer:       {data.get('number')}")
            print(f"Tittel:       {data.get('subject', 'Ingen tittel')}")
            print(f"Kategori:     {data.get('usage')}")
            type_obj = data.get("type", {})
            type_name = type_obj.get("name") if isinstance(type_obj, dict) else type_obj
            print(f"Type:         {type_name}")
            workflow = data.get("workflow", {})
            if workflow:
                print(f"Workflow:     {workflow.get('name', '?')}")
            print(f"Opprettet:    {data.get('created')}")

            created_by = data.get("createdBy", {})
            if created_by:
                print(f"Opprettet av: {created_by.get('userId', '?')}")

            # Location
            location = data.get("location", {})
            if location:
                building = location.get("building", {})
                level = location.get("level", {})
                if building or level:
                    loc_str = f"{building.get('name', '')} / {level.get('name', '')}"
                    print(f"Lokasjon:     {loc_str}")

            # User defined fields
            udf = data.get("userDefinedFields", {})
            if udf:
                items = udf.get("items", [])
                if items:
                    print(f"\nEgendefinerte felter:")
                    for item in items[:10]:
                        name = item.get("name", "?")
                        values = item.get("values", [])
                        if values:
                            val = values[0]
                            if "text" in val:
                                value_str = val["text"]
                            elif "reference" in val:
                                value_str = val["reference"].get("value", "?")
                            else:
                                value_str = str(val)
                            print(f"  {name}: {value_str[:50]}")

        except DaluxAPIError as e:
            print(f"Feil: {e}")

        self.pause()

    def view_full_task_info(self):
        """Vis ALL tilgjengelig informasjon for en sak"""
        self.print_header("Komplett saksvisning")
        self.print_status()

        if not self.current_project_id:
            print("Velg et prosjekt først (meny 2)")
            self.pause()
            return

        # Hent tasks og la bruker velge
        print("Henter saker...\n")
        try:
            tasks = self.client.get_tasks(self.current_project_id, limit=200)
        except DaluxAPIError as e:
            print(f"Feil ved henting av tasks: {e}")
            self.pause()
            return

        if not tasks:
            print("Ingen tasks funnet.")
            self.pause()
            return

        # Sorter RUH-saker etter nummer
        ruh_tasks = []
        other_tasks = []
        for t in tasks:
            data = t.get("data", {})
            number = data.get("number", "")
            if number.startswith("RUH"):
                try:
                    num = int(number.replace("RUH", ""))
                    ruh_tasks.append((num, t))
                except ValueError:
                    other_tasks.append(t)
            else:
                other_tasks.append(t)

        ruh_tasks.sort(key=lambda x: x[0])
        sorted_tasks = [t for _, t in ruh_tasks] + other_tasks

        # Vis de første sakene
        print(f"Tilgjengelige saker (eldste RUH først):\n")
        print(f"{'#':<4} {'Nummer':<10} {'Type':<12} {'Tittel':<40}")
        print("-" * 70)

        display_tasks = sorted_tasks[:20]
        for i, t in enumerate(display_tasks, 1):
            data = t.get("data", {})
            number = data.get("number", "?")[:9]
            type_obj = data.get("type", {})
            type_name = type_obj.get("name", "?") if isinstance(type_obj, dict) else "?"
            subject = data.get("subject", "Untitled")[:39]
            print(f"{i:<4} {number:<10} {type_name:<12} {subject:<40}")

        if len(sorted_tasks) > 20:
            print(f"\n... og {len(sorted_tasks) - 20} flere saker")

        print("\nVelg sak (nummer) eller skriv RUH-nummer direkte (f.eks. 'RUH1'):")
        choice = input("> ").strip()

        if not choice:
            return

        # Finn valgt task
        selected_task = None
        if choice.upper().startswith("RUH"):
            # Søk etter RUH-nummer
            for t in tasks:
                if t.get("data", {}).get("number", "").upper() == choice.upper():
                    selected_task = t
                    break
        else:
            try:
                idx = int(choice) - 1
                if 0 <= idx < len(display_tasks):
                    selected_task = display_tasks[idx]
            except ValueError:
                pass

        if not selected_task:
            print(f"Fant ikke sak: {choice}")
            self.pause()
            return

        task_data = selected_task.get("data", {})
        task_id = task_data.get("taskId")
        task_number = task_data.get("number", "?")

        # Hent fullstendige detaljer
        print(f"\nHenter all data for {task_number}...")

        try:
            # 1. Task-detaljer
            task = self.client.get_task(self.current_project_id, task_id)
            data = task.get("data", {}) if task else task_data

            # 2. Hent ALLE changes og filtrer
            all_changes = self.client.get_task_changes(
                self.current_project_id, datetime(2024, 1, 1)
            )
            task_changes = [c for c in all_changes if c.get("taskId") == task_id]

            # 3. Hent alle attachments og filtrer
            all_attachments = self.client.get_task_attachments(self.current_project_id)
            task_attachments = [a for a in all_attachments if a.get("taskId") == task_id]

        except DaluxAPIError as e:
            print(f"Feil ved henting av data: {e}")
            self.pause()
            return

        # === DISPLAY ===
        self.clear_screen()
        print("=" * 80)
        print(f"  {task_number}: {data.get('subject', 'Ingen tittel')}")
        print("=" * 80)

        # --- GRUNNDATA ---
        print("\n┌─ GRUNNDATA " + "─" * 66 + "┐")
        print(f"│  Task ID:      {task_id}")
        print(f"│  Nummer:       {data.get('number', 'N/A')}")
        print(f"│  Tittel:       {data.get('subject', 'N/A')}")

        type_obj = data.get("type", {})
        type_name = type_obj.get("name") if isinstance(type_obj, dict) else type_obj
        print(f"│  Type:         {type_name}")

        workflow = data.get("workflow", {})
        if workflow:
            print(f"│  Arbeidsflyt:  {workflow.get('name', 'N/A')}")

        print(f"│  Opprettet:    {data.get('created', 'N/A')[:19]}")

        created_by = data.get("createdBy", {})
        if created_by:
            print(f"│  Opprettet av: {created_by.get('userId', 'N/A')}")

        if data.get("deadline"):
            print(f"│  Frist:        {data.get('deadline')[:10]}")

        assigned = data.get("assignedTo", {})
        if assigned:
            email = assigned.get("email", assigned.get("userId", "N/A"))
            print(f"│  Tilordnet:    {email}")

        print("└" + "─" * 78 + "┘")

        # --- LOKASJON ---
        location = data.get("location", {})
        if location:
            print("\n┌─ LOKASJON " + "─" * 67 + "┐")

            building = location.get("building", {})
            if building:
                print(f"│  Bygning:      {building.get('name', 'N/A')}")

            level = location.get("level", {})
            if level:
                print(f"│  Etasje:       {level.get('name', 'N/A')}")

            room = location.get("room", {})
            if room:
                print(f"│  Rom:          {room.get('name', 'N/A')}")

            drawing = location.get("drawing", {})
            if drawing:
                print(f"│  Tegning:      {drawing.get('name', 'N/A')}")

            coord = location.get("coordinate", {}).get("xyz", {})
            if coord:
                x, y, z = coord.get("x", 0), coord.get("y", 0), coord.get("z", 0)
                print(f"│  Koordinater:  X={x:.2f}, Y={y:.2f}, Z={z:.2f}")

            zones = location.get("zones", [])
            if zones:
                zone_names = [z.get("zone", {}).get("name", "?") for z in zones]
                print(f"│  Soner:        {', '.join(zone_names)}")

            loc_images = location.get("locationImages", [])
            if loc_images:
                print(f"│  Lok.bilder:   {len(loc_images)} stk")

            print("└" + "─" * 78 + "┘")

        # --- EGENDEFINERTE FELT ---
        udf = data.get("userDefinedFields", {}).get("items", [])
        if udf:
            print("\n┌─ EGENDEFINERTE FELT " + "─" * 57 + "┐")
            for field in udf:
                name = field.get("name", "Ukjent")
                values = field.get("values", [])
                value_strs = []
                for v in values:
                    if v.get("text"):
                        value_strs.append(v["text"])
                    elif v.get("reference"):
                        value_strs.append(v["reference"].get("value", "?"))
                    elif v.get("date"):
                        value_strs.append(v["date"][:10])
                value_str = ", ".join(value_strs) if value_strs else "(tom)"
                # Truncate for display
                if len(value_str) > 50:
                    value_str = value_str[:47] + "..."
                print(f"│  {name[:25]:<25} = {value_str}")
            print("└" + "─" * 78 + "┘")

        # --- HISTORIKK/CHANGES ---
        print("\n┌─ HISTORIKK " + "─" * 66 + "┐")
        if task_changes:
            print(f"│  {len(task_changes)} endring(er) registrert:")
            print("│")
            for c in task_changes:
                timestamp = c.get("timestamp", "")[:19]
                action = c.get("action", "?")
                description = c.get("description", "")
                fields = c.get("fields", {})

                # Format action
                action_icons = {
                    "create": "📝",
                    "assign": "👤",
                    "update": "✏️",
                    "complete": "✅",
                    "approve": "✓",
                    "reject": "✗",
                    "reopen": "🔄",
                }
                icon = action_icons.get(action, "•")

                print(f"│  {icon} [{timestamp}] {action.upper()}")

                if description:
                    # Wrap long descriptions
                    desc_lines = [description[i:i+60] for i in range(0, len(description), 60)]
                    for line in desc_lines[:3]:
                        print(f"│       \"{line}\"")
                    if len(desc_lines) > 3:
                        print(f"│       ...")

                # Show who made the change
                modified_by = fields.get("modifiedBy", {})
                if modified_by:
                    print(f"│       Av: {modified_by.get('userId', 'N/A')}")

                # Show assignment info
                assigned_to = fields.get("assignedTo", {})
                if assigned_to:
                    role = assigned_to.get("roleName", assigned_to.get("roleId", ""))
                    if role:
                        print(f"│       Tildelt rolle: {role}")

                current_resp = fields.get("currentResponsible", {})
                if current_resp:
                    print(f"│       Ansvarlig: {current_resp.get('userId', 'N/A')}")

                print("│")
        else:
            print("│  ⚠️  Ingen historikk tilgjengelig (API returnerer kun 100 eldste)")
            print("│      Denne saken er trolig for ny til å være i API-responsen.")
        print("└" + "─" * 78 + "┘")

        # --- VEDLEGG ---
        print("\n┌─ VEDLEGG " + "─" * 68 + "┐")
        if task_attachments:
            print(f"│  {len(task_attachments)} vedlegg:")
            for att in task_attachments:
                media = att.get("mediaFile", {})
                name = media.get("name", "Ukjent")
                created = att.get("created", "")[:19]
                print(f"│    📎 {name}")
                print(f"│       Opprettet: {created}")
        else:
            print("│  Ingen vedlegg på denne saken")
        print("└" + "─" * 78 + "┘")

        # --- LOKASJONSBILDER ---
        loc_images = data.get("location", {}).get("locationImages", [])
        if loc_images:
            print("\n┌─ LOKASJONSBILDER " + "─" * 60 + "┐")
            for img in loc_images:
                print(f"│  🖼️  {img.get('name', 'N/A')}")
            print("│  (Nedlasting krever utvidede API-rettigheter)")
            print("└" + "─" * 78 + "┘")

        # --- OPPSUMMERING ---
        print("\n" + "=" * 80)
        has_changes = len(task_changes) > 0
        has_attachments = len(task_attachments) > 0
        has_location = bool(location)
        has_udf = len(udf) > 0

        print("DATATILGJENGELIGHET:")
        print(f"  Grunndata:        ✅")
        print(f"  Lokasjon:         {'✅' if has_location else '❌'}")
        print(f"  Egendefinerte:    {'✅ ' + str(len(udf)) + ' felt' if has_udf else '❌'}")
        print(f"  Historikk:        {'✅ ' + str(len(task_changes)) + ' endringer' if has_changes else '⚠️  Ikke i API-respons'}")
        print(f"  Vedlegg:          {'✅ ' + str(len(task_attachments)) + ' stk' if has_attachments else '❌'}")
        print("=" * 80)

        self.pause()

    def view_task_changes(self):
        """Vis endringer siden en dato"""
        self.print_header("Task-endringer")
        self.print_status()

        if not self.current_project_id:
            print("Velg et prosjekt først (meny 2)")
            self.pause()
            return

        print("Hvor langt tilbake vil du se endringer?")
        print("  1. Siste time")
        print("  2. Siste 24 timer")
        print("  3. Siste 7 dager")
        print("  4. Siste 30 dager")
        print("  5. Egendefinert dato")

        choice = input("\nValg: ").strip()

        now = datetime.utcnow()
        if choice == "1":
            since = now - timedelta(hours=1)
        elif choice == "2":
            since = now - timedelta(days=1)
        elif choice == "3":
            since = now - timedelta(days=7)
        elif choice == "4":
            since = now - timedelta(days=30)
        elif choice == "5":
            date_str = input("Dato (YYYY-MM-DD): ").strip()
            try:
                since = datetime.fromisoformat(date_str)
            except ValueError:
                print("Ugyldig datoformat")
                self.pause()
                return
        else:
            print("Ugyldig valg")
            self.pause()
            return

        print(f"\nHenter endringer siden {since.isoformat()}...\n")

        try:
            changes = self.client.get_task_changes(self.current_project_id, since)

            if not changes:
                print("Ingen endringer funnet i perioden.")
                self.pause()
                return

            print(f"Fant {len(changes)} endring(er):\n")
            print(f"{'Task ID':<20} {'Handling':<12} {'Tittel':<30} {'Tidspunkt':<20}")
            print("-" * 82)

            for t in changes[:30]:
                # Changes har annen struktur enn tasks
                task_id = t.get("taskId", "?")[:19]
                action = t.get("action", "?")[:11]
                fields = t.get("fields", {})
                title = fields.get("title", t.get("description", "?"))[:29]
                timestamp = t.get("timestamp", "?")[:19]
                print(f"{task_id:<20} {action:<12} {title:<30} {timestamp:<20}")

            if len(changes) > 30:
                print(f"\n... og {len(changes) - 30} flere")

        except DaluxAPIError as e:
            print(f"Feil: {e}")

        self.pause()

    def view_attachments(self):
        """Vis vedlegg for prosjektet"""
        self.print_header("Vedlegg")
        self.print_status()

        if not self.current_project_id:
            print("Velg et prosjekt først (meny 2)")
            self.pause()
            return

        print(f"Henter vedlegg for {self.current_project_name}...\n")

        try:
            attachments = self.client.get_task_attachments(self.current_project_id)

            if not attachments:
                print("Ingen vedlegg funnet.")
                self.pause()
                return

            print(f"Fant {len(attachments)} vedlegg:\n")
            print(f"{'Task ID':<22} {'Filnavn':<45} {'Opprettet':<20}")
            print("-" * 90)

            for a in attachments[:30]:
                # Attachments har taskId og mediaFile på toppnivå (ingen data-wrapper)
                task_id = a.get("taskId", "?")[:21]
                media_file = a.get("mediaFile", {})
                filename = media_file.get("name", "?")[:44]
                created = a.get("created", "?")[:19]
                print(f"{task_id:<22} {filename:<45} {created:<20}")

            if len(attachments) > 30:
                print(f"\n... og {len(attachments) - 30} flere")

        except DaluxAPIError as e:
            print(f"Feil: {e}")

        self.pause()

    def view_files(self):
        """Vis filer i prosjektets filområder"""
        self.print_header("Filer")
        self.print_status()

        if not self.current_project_id:
            print("Velg et prosjekt først (meny 2)")
            self.pause()
            return

        print(f"Henter filområder for {self.current_project_name}...\n")

        try:
            # Hent filområder via API direkte (ikke i DaluxClient ennå)
            import requests
            headers = {"X-API-KEY": self.client.api_key}
            base_url = self.client.base_url

            areas_url = f"{base_url}5.1/projects/{self.current_project_id}/file_areas"
            areas_resp = requests.get(areas_url, headers=headers, timeout=30)
            areas_resp.raise_for_status()
            areas = areas_resp.json().get("items", [])

            if not areas:
                print("Ingen filområder funnet.")
                self.pause()
                return

            # Vis filområder
            print(f"Fant {len(areas)} filområde(r):\n")
            for i, area in enumerate(areas, 1):
                data = area.get("data", {})
                area_id = data.get("fileAreaId", "?")
                area_name = data.get("fileAreaName", "?")
                print(f"  {i}. {area_name} (ID: {area_id})")

            # Velg filområde
            print()
            choice = input("Velg filområde (Enter for første): ").strip()
            if not choice:
                choice = "1"

            try:
                idx = int(choice) - 1
                if idx < 0 or idx >= len(areas):
                    print("Ugyldig valg")
                    self.pause()
                    return
            except ValueError:
                print("Ugyldig input")
                self.pause()
                return

            selected_area = areas[idx].get("data", {})
            area_id = selected_area.get("fileAreaId")
            area_name = selected_area.get("fileAreaName", "?")

            print(f"\nHenter filer fra '{area_name}'...\n")

            # Hent filer
            files_url = f"{base_url}6.0/projects/{self.current_project_id}/file_areas/{area_id}/files?pageSize=50"
            files_resp = requests.get(files_url, headers=headers, timeout=30)
            files_resp.raise_for_status()
            files_data = files_resp.json()
            files = files_data.get("items", [])
            total = files_data.get("metadata", {}).get("totalItems", len(files))

            if not files:
                print("Ingen filer funnet.")
                self.pause()
                return

            print(f"Fant {total} fil(er) totalt (viser {len(files)}):\n")
            print(f"{'Filnavn':<45} {'Type':<12} {'Størrelse':<12} {'Oppdatert':<12}")
            print("-" * 85)

            for f in files[:30]:
                data = f.get("data", {})
                filename = data.get("fileName", "?")[:44]
                file_type = data.get("fileType", "?")[:11]
                size = data.get("fileSize", 0)
                size_str = f"{size // 1024} KB" if size else "?"
                modified = data.get("lastModified", "?")[:11]
                print(f"{filename:<45} {file_type:<12} {size_str:<12} {modified:<12}")

            if len(files) > 30:
                print(f"\n... og {total - 30} flere")

        except requests.RequestException as e:
            print(f"Feil ved henting av filer: {e}")
        except Exception as e:
            print(f"Uventet feil: {e}")

        self.pause()

    def run_sync(self):
        """Kjør synkronisering til Catenda"""
        self.print_header("Synkroniser til Catenda")
        self.print_status()

        if not self.current_project_id:
            print("Velg et prosjekt først (meny 2)")
            self.pause()
            return

        print("Sjekker eksisterende sync mappings...\n")

        try:
            sync_repo = create_sync_mapping_repository()
            mappings = sync_repo.list_sync_mappings()

            # Finn mapping for dette prosjektet
            mapping = None
            for m in mappings:
                if m.dalux_project_id == self.current_project_id:
                    mapping = m
                    break

            if not mapping:
                print(f"Ingen sync mapping funnet for prosjekt {self.current_project_id}")
                print("\nOpprett en mapping først med:")
                print(f"  python scripts/dalux_sync.py create \\")
                print(f"    --project-id <intern_id> \\")
                print(f"    --dalux-project-id {self.current_project_id} \\")
                print(f"    --catenda-project-id <catenda_id> \\")
                print(f"    --catenda-board-id <board_id>")
                self.pause()
                return

            print(f"Fant mapping: {mapping.id}")
            print(f"  Catenda board: {mapping.catenda_board_id}")
            print(f"  Siste synk: {mapping.last_sync_at or 'aldri'}")
            print(f"  Status: {mapping.last_sync_status or 'n/a'}")

            print("\nVil du kjøre synkronisering?")
            print("  1. Inkrementell synk (kun endringer)")
            print("  2. Full synk (alle tasks)")
            print("  0. Avbryt")

            choice = input("\nValg: ").strip()

            if choice == "0" or choice == "":
                return

            full_sync = (choice == "2")

            print(f"\nStarter {'full' if full_sync else 'inkrementell'} synk...\n")

            # Opprett sync service
            catenda_client = get_catenda_client()
            if not catenda_client:
                print("Catenda ikke konfigurert - sjekk .env")
                self.pause()
                return

            sync_service = DaluxSyncService(self.client, catenda_client, sync_repo)
            result = sync_service.sync_project(mapping.id, full_sync=full_sync)

            print(f"\nSynk fullført: {result.status}")
            print(f"  Varighet: {result.duration_seconds:.2f}s")
            print(f"  Tasks prosessert: {result.tasks_processed}")
            print(f"  Tasks opprettet: {result.tasks_created}")
            print(f"  Tasks oppdatert: {result.tasks_updated}")
            print(f"  Tasks hoppet over: {result.tasks_skipped}")
            print(f"  Tasks feilet: {result.tasks_failed}")

            if result.errors:
                print(f"\nFeil:")
                for err in result.errors[:5]:
                    print(f"  - {err}")

        except Exception as e:
            print(f"Feil under synkronisering: {e}")

        self.pause()

    def show_main_menu(self):
        """Vis hovedmeny"""
        self.print_header("Hovedmeny")
        self.print_status()

        print("\n  1. Test tilkobling")
        print("  2. Velg prosjekt")
        print("  3. Vis tasks")
        print("  4. Vis task-detaljer (enkel)")
        print("  5. ⭐ Komplett saksvisning (all data)")
        print("  6. Vis task-endringer")
        print("  7. Vis vedlegg")
        print("  8. Vis filer")
        print("  9. Synkroniser til Catenda")
        print()
        print("  0. Avslutt")
        print()

        return input("Velg: ").strip()

    def run(self):
        """Kjør interaktiv meny"""
        # Initialiser tilkobling ved oppstart
        if not self.initialize_connection():
            print("\nKunne ikke koble til Dalux.")
            self.pause()
            return

        # Hvis bare ett prosjekt, velg det automatisk
        if len(self.projects) == 1:
            data = self.projects[0].get("data", {})
            self.current_project_id = data.get("projectId")
            self.current_project_name = data.get("projectName")

        self.pause()

        while True:
            choice = self.show_main_menu()

            if choice == "0":
                print("\nHa det!")
                break
            elif choice == "1":
                self.initialize_connection()
                self.pause()
            elif choice == "2":
                self.select_project()
            elif choice == "3":
                self.list_tasks()
            elif choice == "4":
                self.view_task_details()
            elif choice == "5":
                self.view_full_task_info()
            elif choice == "6":
                self.view_task_changes()
            elif choice == "7":
                self.view_attachments()
            elif choice == "8":
                self.view_files()
            elif choice == "9":
                self.run_sync()
            else:
                print("Ugyldig valg")
                self.pause()


def main():
    menu = DaluxInteractiveMenu()
    menu.run()


if __name__ == "__main__":
    main()
