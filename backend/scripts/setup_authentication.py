#!/usr/bin/env python3
"""
Catenda Setup - Automatisert oppsett av autentisering og prosjektkonfigurasjon.

Kjorer med minimal interaksjon:
- Eksisterende .env-verdier brukes uten bekreftelse
- OAuth-token fanges automatisk via lokal HTTP-server
- Prosjekt/bibliotek velges automatisk hvis kun ett finnes
"""

import os
import re
import socket
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests as req

# Legg til parent directory i path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

env_file = Path(__file__).parent.parent / ".env"
load_dotenv(env_file)

try:
    from integrations.catenda import CatendaClient
except ImportError as e:
    print(f"Import feilet: {e}")
    print("Sorg for at scriptet kjores fra backend/-mappen.")
    sys.exit(1)


# ==========================================================
# OAuth Callback Server
# ==========================================================


class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """Fanger OAuth authorization code fra redirect."""

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if "code" in params:
            self.server.auth_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                b"<html><body><h2>Autentisering vellykket!</h2>"
                b"<p>Du kan lukke denne fanen.</p></body></html>"
            )
        else:
            error = params.get("error", ["ukjent"])[0]
            self.server.auth_code = None
            self.send_response(400)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                f"<html><body><h2>Feil: {error}</h2></body></html>".encode()
            )

    def log_message(self, format, *args):
        pass  # Undertykk HTTP-logg


def find_free_port(preferred: int = 18080) -> int:
    """Finn en ledig port. Proev preferred forst."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", preferred))
            return preferred
    except OSError:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]


def capture_oauth_code(client: CatendaClient, registered_redirect_uri: str = "") -> dict | None:
    """Start lokal server, aapne nettleser, fang OAuth-kode, bytt mot token.

    Bruker registrert redirect URI fra .env hvis tilgjengelig.
    Proever auto-capture med lokal server, faller tilbake til manuell innliming.
    """
    if registered_redirect_uri:
        parsed = urlparse(registered_redirect_uri)
        port = parsed.port or 80
        redirect_uri = registered_redirect_uri
        print(f"\n  Redirect URI (fra .env): {redirect_uri}")
    else:
        port = find_free_port()
        redirect_uri = f"http://127.0.0.1:{port}/callback"
        print(f"\n  Redirect URI: {redirect_uri}")
        print("  (Registrer denne i Catenda Developer Portal)\n")

    # Proev aa starte lokal server for auto-capture
    try:
        server = HTTPServer(("127.0.0.1", port), OAuthCallbackHandler)
        server.auth_code = None
        server.timeout = 120
    except PermissionError:
        print(f"\n  Kan ikke lytte paa port {port} (krever root-tilgang).")
        print("  Tips: Oppdater redirect URI i Catenda Developer Portal til:")
        print("    http://127.0.0.1:18080/callback")
        print("  og sett CATENDA_REDIRECT_URI=http://127.0.0.1:18080/callback i .env\n")
        return _manual_oauth_flow(client, redirect_uri)
    except OSError as e:
        print(f"\n  Kan ikke starte server paa port {port}: {e}")
        return _manual_oauth_flow(client, redirect_uri)

    auth_url = client.get_authorization_url(redirect_uri)

    print("  Aapner nettleser for autentisering...")
    webbrowser.open(auth_url)
    print("  Venter paa callback (maks 2 min)...\n")

    server.handle_request()

    if not server.auth_code:
        print("  Ingen authorization code mottatt.")
        return None

    print("  Authorization code mottatt! Bytter mot token...")

    if client.exchange_code_for_token(server.auth_code, redirect_uri):
        result = {"CATENDA_ACCESS_TOKEN": client.access_token}
        if client.refresh_token:
            result["CATENDA_REFRESH_TOKEN"] = client.refresh_token
        result["CATENDA_REDIRECT_URI"] = redirect_uri
        return result

    print("  Kunne ikke bytte code mot token.")
    return None


def _manual_oauth_flow(client: CatendaClient, redirect_uri: str) -> dict | None:
    """Manuell OAuth-flyt: bruker kopierer authorization code fra nettleser."""
    auth_url = client.get_authorization_url(redirect_uri)

    print("  Faller tilbake til manuell autentisering.\n")
    print(f"  Aapne denne URL-en i nettleseren:\n\n    {auth_url}\n")
    print("  Etter godkjenning, kopier 'code' fra redirect-URL-en.")
    print(f"  (URL-en starter med {redirect_uri}?code=...)\n")

    code = input("  Authorization code: ").strip()
    if not code:
        print("  Ingen code angitt.")
        return None

    print("  Bytter code mot token...")
    if client.exchange_code_for_token(code, redirect_uri):
        result = {"CATENDA_ACCESS_TOKEN": client.access_token}
        if client.refresh_token:
            result["CATENDA_REFRESH_TOKEN"] = client.refresh_token
        result["CATENDA_REDIRECT_URI"] = redirect_uri
        return result

    print("  Kunne ikke bytte code mot token.")
    return None


# ==========================================================
# Hjelpefunksjoner
# ==========================================================


def validate_token(token: str) -> list[dict] | None:
    """
    Valider token ved aa kalle list_projects() direkte.

    Returns:
        Liste av prosjekter hvis token er gyldig, None hvis ugyldig.
    """
    try:
        response = req.get(
            "https://api.catenda.com/v2/projects",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        if response.status_code in (401, 403):
            return None
        response.raise_for_status()
        return response.json()
    except req.exceptions.RequestException:
        return None


def update_env_file(updates: dict):
    """Oppdater eller legg til variabler i .env-filen."""
    env_path = Path(__file__).parent.parent / ".env"

    existing_lines = []
    if env_path.exists():
        with open(env_path) as f:
            existing_lines = f.readlines()

    existing_vars = {}
    for i, line in enumerate(existing_lines):
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            match = re.match(r"^([A-Z_][A-Z0-9_]*)=", stripped)
            if match:
                existing_vars[match.group(1)] = i

    vars_to_add = []
    for key, value in updates.items():
        safe_value = str(value).replace('"', '\\"')
        new_line = f"{key}={safe_value}\n"

        if key in existing_vars:
            existing_lines[existing_vars[key]] = new_line
        else:
            vars_to_add.append(new_line)

    with open(env_path, "w") as f:
        f.writelines(existing_lines)
        if vars_to_add:
            if existing_lines and not existing_lines[-1].endswith("\n"):
                f.write("\n")
            f.write("\n# Catenda konfigurasjon (generert av setup_authentication.py)\n")
            f.writelines(vars_to_add)

    print(f"\n  Konfigurasjon lagret til {env_path}")


def pick_from_list(
    items: list[dict],
    label_key: str,
    id_key: str = "id",
    prompt: str = "Velg",
) -> dict | None:
    """Vis nummerert liste og la bruker velge. Auto-velg hvis kun ett element."""
    if not items:
        return None

    if len(items) == 1:
        chosen = items[0]
        print(f"  Auto-valgt: {chosen.get(label_key, '?')} ({chosen.get(id_key, '?')})")
        return chosen

    for i, item in enumerate(items, 1):
        name = item.get(label_key, "?")
        item_id = item.get(id_key, "?")
        print(f"  {i}. {name}  ({item_id})")

    choice = input(f"\n  {prompt} [1]: ").strip()
    idx = int(choice) - 1 if choice.isdigit() else 0
    idx = max(0, min(idx, len(items) - 1))
    return items[idx]


# ==========================================================
# Hovedflyt
# ==========================================================


def main():
    """Automatisert oppsett - minimal interaksjon."""

    print("\n" + "=" * 60)
    print("  CATENDA OPPSETT")
    print("=" * 60)

    env_updates = {}

    # --- Steg 1: Les eksisterende konfig ---
    client_id = os.environ.get("CATENDA_CLIENT_ID", "")
    client_secret = os.environ.get("CATENDA_CLIENT_SECRET", "")
    access_token = os.environ.get("CATENDA_ACCESS_TOKEN", "")
    redirect_uri = os.environ.get("CATENDA_REDIRECT_URI", "")
    project_id = os.environ.get("CATENDA_PROJECT_ID", "")
    library_id = os.environ.get("CATENDA_LIBRARY_ID", "")

    # --- Steg 2: Client ID (pakrevd) ---
    if not client_id:
        print("\n  Client ID mangler i .env.")
        print("  Finn den i Catenda Developer Portal -> OAuth Apps\n")
        client_id = input("  Client ID: ").strip()
        if not client_id:
            print("  Client ID er pakrevd!")
            sys.exit(1)
        env_updates["CATENDA_CLIENT_ID"] = client_id

    # --- Steg 3: Autentisering ---
    client = CatendaClient(client_id=client_id, client_secret=client_secret or None)
    projects = None  # Gjenbrukes i prosjekt-picker

    if access_token:
        print("\n  Tester eksisterende token...")
        projects = validate_token(access_token)
        if projects is not None:
            print(f"  Token OK - fant {len(projects)} prosjekt(er)")
            client.set_access_token(access_token)
        else:
            print("  Token ugyldig eller utgaatt.")
            access_token = ""

    if not access_token:
        if client_secret:
            print("\n  Proever Client Credentials Grant...")
            if client.authenticate():
                print("  Autentisering vellykket!")
                env_updates["CATENDA_ACCESS_TOKEN"] = client.access_token
                access_token = client.access_token
            else:
                print("  Client Credentials feilet, proever Authorization Code...")
                tokens = capture_oauth_code(client, redirect_uri)
                if tokens:
                    env_updates.update(tokens)
                    access_token = tokens.get("CATENDA_ACCESS_TOKEN", "")
                else:
                    print("  Autentisering feilet!")
                    sys.exit(1)
        else:
            print("\n  Starter Authorization Code Grant...")
            tokens = capture_oauth_code(client, redirect_uri)
            if tokens:
                env_updates.update(tokens)
                access_token = tokens.get("CATENDA_ACCESS_TOKEN", "")
            else:
                print("  Autentisering feilet!")
                sys.exit(1)

    # Oppdater klienten med gyldig token
    if not client.access_token and access_token:
        client.set_access_token(access_token)

    # --- Steg 4: Prosjekt ---
    if not project_id:
        print("\n  Henter prosjekter...")
        if projects is None:
            projects = client.list_projects()

        if not projects:
            print("  Ingen prosjekter funnet!")
            project_id = input("  Project ID (manuelt): ").strip()
        else:
            print(f"\n  Fant {len(projects)} prosjekt(er):")
            chosen = pick_from_list(projects, label_key="name", id_key="id")
            if chosen:
                project_id = chosen["id"]
                env_updates["CATENDA_PROJECT_ID"] = project_id
    else:
        print(f"\n  Prosjekt: {project_id} (fra .env)")

    # --- Steg 5: Bibliotek ---
    if not library_id and project_id:
        print("\n  Henter biblioteker...")
        libraries = client.list_libraries(project_id)
        if libraries:
            print(f"  Fant {len(libraries)} bibliotek(er):")
            chosen = pick_from_list(libraries, label_key="name", id_key="id")
            if chosen:
                library_id = chosen["id"]
                env_updates["CATENDA_LIBRARY_ID"] = library_id
        else:
            print("  Ingen biblioteker funnet (kan legges til senere).")
    elif library_id:
        print(f"  Bibliotek: {library_id} (fra .env)")

    # --- Steg 6: Lagre ---
    if env_updates:
        update_env_file(env_updates)

    # --- Oppsummering ---
    print("\n" + "=" * 60)
    print("  OPPSETT FULLFORT")
    print("=" * 60)
    client_display = f"{client_id[:20]}..." if len(client_id) > 20 else client_id
    print(f"\n  Client ID:    {client_display}")
    print(f"  Token:        {'OK' if access_token else 'MANGLER'}")
    print(f"  Prosjekt:     {project_id or 'ikke satt'}")
    print(f"  Bibliotek:    {library_id or 'ikke satt'}")
    print(f"\n  Konfig: backend/.env")
    print(f"  Start:  cd backend && make run\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nAvbrutt.")
        sys.exit(0)
