# Automated Setup Script Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `backend/scripts/setup_authentication.py` to be zero-prompt when fully configured, auto-capturing OAuth tokens and auto-discovering project/library IDs.

**Architecture:** Single-file rewrite. Auto-detect auth state from `.env`, validate existing tokens via API, start temporary HTTP server for OAuth callback capture, use interactive pickers only when values are missing.

**Tech Stack:** Python stdlib (`http.server`, `socketserver`, `webbrowser`, `urllib.parse`), existing `CatendaClient` from `backend/integrations/catenda`.

---

### Task 1: OAuth Callback Server

**Files:**
- Modify: `backend/scripts/setup_authentication.py`

**Step 1: Write the OAuthCallbackServer class**

Replace the entire file content. Start with imports and the callback server:

```python
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
import threading
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

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


def capture_oauth_code(client: CatendaClient, client_secret: str | None) -> dict | None:
    """Start lokal server, aapne nettleser, fang OAuth-kode, bytt mot token."""
    port = find_free_port()
    redirect_uri = f"http://localhost:{port}/callback"

    print(f"\nRedirect URI: {redirect_uri}")
    print("(Registrer denne i Catenda Developer Portal om nodvendig)\n")

    auth_url = client.get_authorization_url(redirect_uri)

    server = HTTPServer(("127.0.0.1", port), OAuthCallbackHandler)
    server.auth_code = None
    server.timeout = 120

    print("Aapner nettleser for autentisering...")
    webbrowser.open(auth_url)
    print("Venter paa callback (maks 2 min)...\n")

    server.handle_request()

    if not server.auth_code:
        print("Ingen authorization code mottatt.")
        return None

    print("Authorization code mottatt! Bytter mot token...")

    if client.exchange_code_for_token(server.auth_code, redirect_uri):
        result = {"CATENDA_ACCESS_TOKEN": client.access_token}
        if client.refresh_token:
            result["CATENDA_REFRESH_TOKEN"] = client.refresh_token
        result["CATENDA_REDIRECT_URI"] = redirect_uri
        return result

    print("Kunne ikke bytte code mot token.")
    return None
```

**Step 2: Verify syntax**

Run: `cd /Users/kasper/Projects/Catenda/unified-timeline && python -c "import ast; ast.parse(open('backend/scripts/setup_authentication.py').read()); print('OK')"`
Expected: `OK`

---

### Task 2: Helper Functions (update_env_file, pick_from_list)

**Files:**
- Modify: `backend/scripts/setup_authentication.py` (append after Task 1 code)

**Step 1: Add helper functions**

Append these functions after the `capture_oauth_code` function:

```python
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

    print(f"Konfigurasjon lagret til {env_path}")


def pick_from_list(items: list[dict], label_key: str, id_key: str = "id", prompt: str = "Velg") -> dict | None:
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

    choice = input(f"\n{prompt} [1]: ").strip()
    idx = int(choice) - 1 if choice.isdigit() else 0
    idx = max(0, min(idx, len(items) - 1))
    return items[idx]
```

**Step 2: Verify syntax**

Run: `cd /Users/kasper/Projects/Catenda/unified-timeline && python -c "import ast; ast.parse(open('backend/scripts/setup_authentication.py').read()); print('OK')"`
Expected: `OK`

---

### Task 3: Main Auto-Setup Flow

**Files:**
- Modify: `backend/scripts/setup_authentication.py` (append the main function)

**Step 1: Add the main auto-setup logic**

Append after the helper functions:

```python
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
    refresh_token = os.environ.get("CATENDA_REFRESH_TOKEN", "")
    project_id = os.environ.get("CATENDA_PROJECT_ID", "")
    library_id = os.environ.get("CATENDA_LIBRARY_ID", "")

    # --- Steg 2: Client ID (pakrevd) ---
    if not client_id:
        print("\nClient ID mangler i .env.")
        print("Finn den i Catenda Developer Portal -> OAuth Apps\n")
        client_id = input("Client ID: ").strip()
        if not client_id:
            print("Client ID er pakrevd!")
            sys.exit(1)
        env_updates["CATENDA_CLIENT_ID"] = client_id

    # --- Steg 3: Autentisering ---
    client = CatendaClient(client_id=client_id, client_secret=client_secret or None)
    projects = None  # Gjenbrukes i prosjekt-picker

    if access_token:
        # Test eksisterende token
        print("\nTester eksisterende token...")
        client.set_access_token(access_token)
        projects = client.list_projects()
        if projects is not None and len(projects) >= 0:
            print(f"Token OK - fant {len(projects)} prosjekt(er)")
        else:
            print("Token ugyldig eller utgaatt.")
            access_token = ""

    if not access_token:
        if client_secret:
            # Prov Client Credentials
            print("\nProver Client Credentials Grant...")
            if client.authenticate():
                print("Autentisering vellykket!")
                env_updates["CATENDA_ACCESS_TOKEN"] = client.access_token
                access_token = client.access_token
            else:
                print("Client Credentials feilet, proever Authorization Code...")
                tokens = capture_oauth_code(client, client_secret)
                if tokens:
                    env_updates.update(tokens)
                    access_token = tokens.get("CATENDA_ACCESS_TOKEN", "")
                else:
                    print("Autentisering feilet!")
                    sys.exit(1)
        else:
            # Authorization Code Grant
            print("\nStarter Authorization Code Grant...")
            tokens = capture_oauth_code(client, None)
            if tokens:
                env_updates.update(tokens)
                access_token = tokens.get("CATENDA_ACCESS_TOKEN", "")
            else:
                print("Autentisering feilet!")
                sys.exit(1)

    # Oppdater klienten med gyldig token
    if not client.access_token:
        client.set_access_token(access_token)

    # --- Steg 4: Prosjekt ---
    if not project_id:
        print("\nHenter prosjekter...")
        if projects is None:
            projects = client.list_projects()

        if not projects:
            print("Ingen prosjekter funnet!")
            project_id = input("Project ID (manuelt): ").strip()
        else:
            print(f"\nFant {len(projects)} prosjekt(er):")
            chosen = pick_from_list(projects, label_key="name", id_key="id")
            if chosen:
                project_id = chosen["id"]
                env_updates["CATENDA_PROJECT_ID"] = project_id
    else:
        print(f"\nProsjekt: {project_id} (fra .env)")

    # --- Steg 5: Bibliotek ---
    if not library_id and project_id:
        print("\nHenter biblioteker...")
        libraries = client.list_libraries(project_id)
        if libraries:
            print(f"Fant {len(libraries)} bibliotek(er):")
            chosen = pick_from_list(libraries, label_key="name", id_key="id")
            if chosen:
                library_id = chosen["id"]
                env_updates["CATENDA_LIBRARY_ID"] = library_id
        else:
            print("Ingen biblioteker funnet (kan legges til senere).")
    elif library_id:
        print(f"Bibliotek: {library_id} (fra .env)")

    # --- Steg 6: Lagre ---
    if env_updates:
        update_env_file(env_updates)

    # --- Oppsummering ---
    print("\n" + "=" * 60)
    print("  OPPSETT FULLFORT")
    print("=" * 60)
    print(f"\n  Client ID:    {client_id[:20]}...")
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
```

**Step 2: Verify syntax**

Run: `cd /Users/kasper/Projects/Catenda/unified-timeline && python -c "import ast; ast.parse(open('backend/scripts/setup_authentication.py').read()); print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/scripts/setup_authentication.py
git commit -m "feat: automate setup script with token capture and auto-discovery"
```

---

### Task 4: Token Validation Edge Case

The `list_projects()` call uses `_safe_request` which returns `None` on errors but also returns `[]` for valid tokens with zero projects. We need to distinguish between "token invalid" (API returned 401) and "token valid but no projects".

**Files:**
- Modify: `backend/scripts/setup_authentication.py`

**Step 1: Add explicit token validation**

Add this function after `pick_from_list`:

```python
def validate_token(client: CatendaClient) -> list[dict] | None:
    """
    Valider token ved aa kalle list_projects().

    Returns:
        Liste av prosjekter hvis token er gyldig, None hvis ugyldig.
    """
    import requests as req

    try:
        url = f"{client.base_url}/v2/projects"
        response = req.get(
            url, headers=client.get_headers(), timeout=10
        )
        if response.status_code == 401 or response.status_code == 403:
            return None
        response.raise_for_status()
        return response.json()
    except req.exceptions.RequestException:
        return None
```

**Step 2: Update main() to use validate_token instead of list_projects**

In the token test section of `main()`, replace:
```python
        projects = client.list_projects()
        if projects is not None and len(projects) >= 0:
```

With:
```python
        projects = validate_token(client)
        if projects is not None:
```

**Step 3: Verify syntax**

Run: `cd /Users/kasper/Projects/Catenda/unified-timeline && python -c "import ast; ast.parse(open('backend/scripts/setup_authentication.py').read()); print('OK')"`
Expected: `OK`

**Step 4: Commit**

```bash
git add backend/scripts/setup_authentication.py
git commit -m "fix: distinguish invalid token from empty project list"
```

---

### Task 5: Dry-run test

**Step 1: Verify script imports work**

Run: `cd /Users/kasper/Projects/Catenda/unified-timeline/backend && python -c "from scripts.setup_authentication import find_free_port, OAuthCallbackHandler; print('imports OK')"` or `cd /Users/kasper/Projects/Catenda/unified-timeline/backend && python -c "exec(open('scripts/setup_authentication.py').read().split(\"if __name__\")[0]); print('module OK')"`

Expected: No import errors

**Step 2: Test find_free_port**

Run: `cd /Users/kasper/Projects/Catenda/unified-timeline/backend && python -c "
import sys; sys.path.insert(0, '.')
from scripts.setup_authentication import find_free_port
port = find_free_port()
print(f'Port: {port}')
assert isinstance(port, int) and port > 0
print('OK')
"`
Expected: `Port: 18080` (or similar), then `OK`
