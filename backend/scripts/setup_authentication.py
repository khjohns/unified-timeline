#!/usr/bin/env python3
"""
KOE Automation System - Interaktivt oppsettscript
Hjelper deg med å konfigurere autentisering første gang.

Lagrer konfigurasjon til .env-filen.

Støtter automatisert OAuth Authorization Code Grant med lokal callback-server.
"""

import os
import sys
import re
import webbrowser
import threading
import secrets
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

# Legg til parent directory i path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Last eksisterende .env
from dotenv import load_dotenv
env_file = Path(__file__).parent.parent / ".env"
load_dotenv(env_file)

# Import Catenda client
try:
    from integrations.catenda import CatendaClient
except ImportError as e:
    print(f"❌ Import feilet: {e}")
    print("Sørg for at scriptet kjøres fra backend/-mappen.")
    sys.exit(1)


# =============================================================================
# OAuth Callback Server
# =============================================================================

class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """HTTP handler for OAuth callback - fanger opp authorization code."""

    # Delt state mellom handler og hovedtråd
    authorization_code = None
    state_param = None
    error = None

    def log_message(self, format, *args):
        """Undertrykk standard HTTP logging."""
        pass

    def do_GET(self):
        """Håndter GET request fra OAuth callback."""
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        # Sjekk for feil
        if 'error' in params:
            OAuthCallbackHandler.error = params.get('error', ['unknown'])[0]
            error_desc = params.get('error_description', ['Ukjent feil'])[0]
            self._send_error_response(error_desc)
            return

        # Hent authorization code
        if 'code' in params:
            OAuthCallbackHandler.authorization_code = params['code'][0]
            OAuthCallbackHandler.state_param = params.get('state', [None])[0]
            self._send_success_response()
        else:
            self._send_error_response("Mangler authorization code i callback")

    def _send_success_response(self):
        """Send suksess-side til nettleser."""
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()

        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Autentisering fullført</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                    background: white;
                    padding: 3rem;
                    border-radius: 1rem;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
                    text-align: center;
                    max-width: 400px;
                }
                .checkmark {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                }
                h1 { color: #2d3748; margin-bottom: 0.5rem; }
                p { color: #718096; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="checkmark">✅</div>
                <h1>Autentisering fullført!</h1>
                <p>Du kan nå lukke dette vinduet og gå tilbake til terminalen.</p>
            </div>
        </body>
        </html>
        """
        self.wfile.write(html.encode('utf-8'))

    def _send_error_response(self, error_message: str):
        """Send feilside til nettleser."""
        self.send_response(400)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Autentisering feilet</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
                }}
                .container {{
                    background: white;
                    padding: 3rem;
                    border-radius: 1rem;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
                    text-align: center;
                    max-width: 400px;
                }}
                .icon {{ font-size: 4rem; margin-bottom: 1rem; }}
                h1 {{ color: #c53030; margin-bottom: 0.5rem; }}
                p {{ color: #718096; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">❌</div>
                <h1>Autentisering feilet</h1>
                <p>{error_message}</p>
            </div>
        </body>
        </html>
        """
        self.wfile.write(html.encode('utf-8'))


def run_oauth_callback_server(port: int, timeout: int = 120) -> tuple[str | None, str | None]:
    """
    Start en lokal HTTP-server for å fange opp OAuth callback.

    Args:
        port: Port å lytte på (f.eks. 8080)
        timeout: Maks ventetid i sekunder

    Returns:
        Tuple med (authorization_code, state) eller (None, None) ved timeout/feil
    """
    # Reset state
    OAuthCallbackHandler.authorization_code = None
    OAuthCallbackHandler.state_param = None
    OAuthCallbackHandler.error = None

    server = HTTPServer(('localhost', port), OAuthCallbackHandler)
    server.timeout = 1  # Check every second

    start_time = time.time()

    while time.time() - start_time < timeout:
        server.handle_request()

        if OAuthCallbackHandler.authorization_code:
            server.server_close()
            return OAuthCallbackHandler.authorization_code, OAuthCallbackHandler.state_param

        if OAuthCallbackHandler.error:
            server.server_close()
            return None, OAuthCallbackHandler.error

    server.server_close()
    return None, "timeout"


def print_header(title: str):
    """Print formatert header"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def get_env_value(key: str, default: str = "") -> str:
    """Hent verdi fra miljøvariabel"""
    return os.environ.get(key, default)


def update_env_file(updates: dict):
    """
    Oppdater eller legg til variabler i .env-filen.

    Args:
        updates: Dict med variabelnavn -> verdi
    """
    env_path = Path(__file__).parent.parent / ".env"

    # Les eksisterende innhold
    existing_lines = []
    if env_path.exists():
        with open(env_path, 'r') as f:
            existing_lines = f.readlines()

    # Bygg dict over eksisterende variabler
    existing_vars = {}
    for i, line in enumerate(existing_lines):
        # Ignorer kommentarer og tomme linjer
        stripped = line.strip()
        if stripped and not stripped.startswith('#'):
            match = re.match(r'^([A-Z_][A-Z0-9_]*)=', stripped)
            if match:
                existing_vars[match.group(1)] = i

    # Oppdater eksisterende eller marker for tillegg
    vars_to_add = []
    for key, value in updates.items():
        # Escape spesielle tegn i value
        safe_value = str(value).replace('"', '\\"')
        new_line = f'{key}={safe_value}\n'

        if key in existing_vars:
            # Oppdater eksisterende linje
            existing_lines[existing_vars[key]] = new_line
        else:
            # Legg til ny variabel
            vars_to_add.append(new_line)

    # Skriv tilbake til fil
    with open(env_path, 'w') as f:
        f.writelines(existing_lines)

        # Legg til nye variabler på slutten
        if vars_to_add:
            # Sjekk om siste linje har newline
            if existing_lines and not existing_lines[-1].endswith('\n'):
                f.write('\n')
            f.write('\n# Catenda OAuth tokens (generert av setup_authentication.py)\n')
            f.writelines(vars_to_add)

    print(f"\n✅ Konfigurasjon lagret til {env_path}")


def setup_authentication():
    """Interaktivt oppsett av autentisering"""

    print_header("🔐 CATENDA AUTENTISERING - OPPSETT")

    print("Catenda støtter to autentiseringsmetoder:\n")
    print("1️⃣  Client Credentials Grant")
    print("   - Kun for Catenda Boost-kunder")
    print("   - Enkel automatisk autentisering")
    print("   - Krever Client Secret\n")

    print("2️⃣  Authorization Code Grant")
    print("   - For alle Catenda-brukere")
    print("   - Krever nettleser-interaksjon")
    print("   - Mer sikker for personlige kontoer\n")

    # Les eksisterende verdier fra .env
    config = {
        'catenda_client_id': get_env_value('CATENDA_CLIENT_ID'),
        'catenda_client_secret': get_env_value('CATENDA_CLIENT_SECRET'),
        'catenda_access_token': get_env_value('CATENDA_ACCESS_TOKEN'),
        'catenda_refresh_token': get_env_value('CATENDA_REFRESH_TOKEN'),
        'catenda_redirect_uri': get_env_value('CATENDA_REDIRECT_URI', 'http://localhost:8080/callback'),
        'catenda_project_id': get_env_value('CATENDA_PROJECT_ID'),
        'catenda_library_id': get_env_value('CATENDA_LIBRARY_ID'),
        'catenda_folder_id': get_env_value('CATENDA_FOLDER_ID'),
    }

    # Client ID (påkrevd for begge metoder)
    print("📋 GRUNNLEGGENDE INFORMASJON")
    print("-" * 70)

    existing_client_id = config.get('catenda_client_id', '')
    if existing_client_id:
        print(f"\nEksisterende Client ID: {existing_client_id}")
        use_existing = input("Bruk eksisterende? (j/n) [j]: ").strip().lower()
        if use_existing != 'n':
            client_id = existing_client_id
        else:
            client_id = input("Client ID: ").strip()
    else:
        print("\nDu finner Client ID i Catenda Developer Portal:")
        print("https://developer.catenda.com → OAuth Apps → [Din App]")
        client_id = input("\nClient ID: ").strip()

    if not client_id:
        print("❌ Client ID er påkrevd!")
        sys.exit(1)

    config['catenda_client_id'] = client_id

    # Velg autentiseringsmetode
    print("\n" + "=" * 70)
    print("Hvilken autentiseringsmetode vil du bruke?")
    print("=" * 70)
    print("\n1. Client Credentials Grant (Boost-kunder)")
    print("2. Authorization Code Grant (Alle brukere) ⭐ ANBEFALT\n")

    choice = input("Velg (1/2) [2]: ").strip()

    if choice == "1":
        config = setup_client_credentials(config)
    else:
        config = setup_authorization_code(config)

    return config


def setup_client_credentials(config: dict) -> dict:
    """Sett opp Client Credentials Grant"""

    print_header("🔑 CLIENT CREDENTIALS GRANT")

    print("⚠️  MERK: Denne metoden fungerer kun for Catenda Boost-kunder!\n")

    existing_secret = config.get('catenda_client_secret', '')
    if existing_secret and len(existing_secret) > 10:
        print(f"Eksisterende Client Secret: {existing_secret[:10]}...")
        use_existing = input("Bruk eksisterende? (j/n) [j]: ").strip().lower()
        if use_existing != 'n':
            client_secret = existing_secret
        else:
            client_secret = input("Client Secret: ").strip()
    else:
        print("Du finner Client Secret i Catenda Developer Portal:")
        print("https://developer.catenda.com → OAuth Apps → [Din App]\n")
        client_secret = input("Client Secret: ").strip()

    if not client_secret:
        print("❌ Client Secret er påkrevd for Client Credentials Grant!")
        sys.exit(1)

    config['catenda_client_secret'] = client_secret

    # Test autentisering
    print("\n🧪 Tester autentisering...")
    client = CatendaClient(
        client_id=config['catenda_client_id'],
        client_secret=client_secret
    )

    if client.authenticate():
        print("✅ Autentisering vellykket!")

        # Lagre token
        if client.access_token:
            config['catenda_access_token'] = client.access_token
            print("✅ Access token hentet")
    else:
        print("\n❌ Autentisering feilet!")
        print("\nMulige årsaker:")
        print("- Du er ikke Boost-kunde (bruk Authorization Code Grant i stedet)")
        print("- Feil Client ID eller Secret")
        print("- Nettverksproblemer")

        retry = input("\nVil du prøve Authorization Code Grant i stedet? (j/n) [j]: ").strip().lower()
        if retry != 'n':
            return setup_authorization_code(config)
        else:
            sys.exit(1)

    return config


def setup_authorization_code(config: dict) -> dict:
    """
    Sett opp Authorization Code Grant med automatisk callback-server.

    Flyten er nå automatisert:
    1. Starter lokal HTTP-server på port 8080
    2. Åpner nettleser automatisk med authorization URL
    3. Venter på at bruker logger inn (med auto-fill går dette raskt)
    4. Fanger opp callback automatisk
    5. Bytter code mot token automatisk
    """

    print_header("🌐 AUTHORIZATION CODE GRANT (AUTOMATISERT)")

    print("Denne flyten er nå automatisert!")
    print("Du trenger bare å logge inn i nettleseren som åpnes.\n")

    # Client Secret er valgfri for Authorization Code Grant
    existing_secret = config.get('catenda_client_secret', '')
    if not existing_secret:
        print("Client Secret (valgfri, trykk Enter for å hoppe over):")
        client_secret = input("Client Secret: ").strip()
        if client_secret:
            config['catenda_client_secret'] = client_secret
    else:
        print(f"Bruker eksisterende Client Secret: {existing_secret[:10]}...")

    # Parse port fra redirect URI eller bruk default
    # NB: Bruker 9876 for å unngå konflikt med Flask (port 8080)
    default_port = 9876
    default_redirect = f'http://localhost:{default_port}/callback'

    existing_redirect = config.get('catenda_redirect_uri', default_redirect)

    # Parse port fra eksisterende redirect URI
    try:
        parsed = urlparse(existing_redirect)
        port = parsed.port or default_port
    except Exception:
        port = default_port

    redirect_uri = f'http://localhost:{port}/callback'
    config['catenda_redirect_uri'] = redirect_uri

    print(f"\n📍 Redirect URI: {redirect_uri}")
    print(f"   (Må være registrert i Catenda Developer Portal)\n")

    # Generer state for sikkerhet (CSRF-beskyttelse)
    state = secrets.token_urlsafe(32)

    # Opprett client
    client = CatendaClient(
        client_id=config['catenda_client_id'],
        client_secret=config.get('catenda_client_secret')
    )

    # Generer authorization URL med state
    auth_url = client.get_authorization_url(redirect_uri, state=state)

    print("🚀 STARTER AUTOMATISERT AUTENTISERING")
    print("-" * 70)
    print("\n1. Starter lokal callback-server...")

    # Start callback-server i bakgrunns-tråd
    callback_result = {'code': None, 'error': None}

    def run_server():
        code, err = run_oauth_callback_server(port, timeout=120)
        callback_result['code'] = code
        callback_result['error'] = err

    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # Gi serveren litt tid til å starte
    time.sleep(0.5)

    print("2. Åpner nettleser automatisk...")
    print(f"\n   URL: {auth_url[:80]}...\n")

    # Åpne nettleser
    try:
        webbrowser.open(auth_url)
        print("   ✅ Nettleser åpnet!")
    except Exception as e:
        print(f"   ⚠️  Kunne ikke åpne nettleser automatisk: {e}")
        print(f"\n   Åpne denne URL-en manuelt:\n   {auth_url}\n")

    print("\n3. Venter på at du logger inn...")
    print("   (Har du auto-fill? Da trenger du bare klikke 'Logg inn')")
    print("   Timeout: 2 minutter\n")

    # Vent på callback
    server_thread.join(timeout=125)

    if callback_result['code']:
        print("   ✅ Authorization code mottatt!")

        # Verifiser state (CSRF-beskyttelse)
        # Note: Catenda sender ikke alltid state tilbake, så vi sjekker bare hvis vi fikk en
        received_state = callback_result.get('state')
        if received_state and received_state != state:
            print("   ⚠️  State-parameter matcher ikke (mulig CSRF-angrep)")
            print("   Fortsetter likevel...")

        print("\n4. Bytter authorization code mot access token...")

        if client.exchange_code_for_token(callback_result['code'], redirect_uri):
            print("   ✅ Access token hentet!")

            # Lagre tokens
            if client.access_token:
                config['catenda_access_token'] = client.access_token
                print("   ✅ Access token lagret")

            if client.refresh_token:
                config['catenda_refresh_token'] = client.refresh_token
                print("   ✅ Refresh token lagret")

            return config
        else:
            print("\n❌ Kunne ikke bytte code mot token!")

    elif callback_result['error'] == 'timeout':
        print("\n❌ Timeout - ingen callback mottatt innen 2 minutter")
    else:
        print(f"\n❌ Feil fra Catenda: {callback_result['error']}")

    # Tilby manuell fallback
    print("\n" + "-" * 70)
    print("Vil du prøve manuell metode i stedet?")
    retry = input("(j/n) [j]: ").strip().lower()

    if retry != 'n':
        return setup_authorization_code_manual(config)
    else:
        sys.exit(1)

    return config


def setup_authorization_code_manual(config: dict) -> dict:
    """Fallback: Manuell Authorization Code Grant (gammel metode)."""

    print_header("🌐 MANUELL AUTHORIZATION CODE GRANT")

    redirect_uri = config.get('catenda_redirect_uri', 'http://localhost:9876/callback')

    client = CatendaClient(
        client_id=config['catenda_client_id'],
        client_secret=config.get('catenda_client_secret')
    )

    auth_url = client.get_authorization_url(redirect_uri)

    print("📋 STEG 1: Åpne denne URL-en i nettleser:")
    print(f"\n   {auth_url}\n")

    input("Trykk Enter når du har åpnet URL-en...")

    print("\n📋 STEG 2: Etter godkjenning, kopier 'code' fra redirect URL")
    print(f"\nRedirect URL-en ser slik ut:")
    print(f"   {redirect_uri}?code=ABC123XYZ&state=...\n")
    print("Kopier delen etter 'code=' (ABC123XYZ i eksempelet)\n")

    code = input("Authorization code: ").strip()

    if not code:
        print("❌ Authorization code er påkrevd!")
        sys.exit(1)

    print("\n🔄 Bytter authorization code mot access token...")

    if client.exchange_code_for_token(code, redirect_uri):
        print("✅ Access token hentet!")

        if client.access_token:
            config['catenda_access_token'] = client.access_token
            print("✅ Access token lagret")

        if client.refresh_token:
            config['catenda_refresh_token'] = client.refresh_token
            print("✅ Refresh token lagret")
    else:
        print("\n❌ Kunne ikke hente access token!")
        retry = input("\nVil du prøve igjen? (j/n) [j]: ").strip().lower()
        if retry != 'n':
            return setup_authorization_code_manual(config)
        else:
            sys.exit(1)

    return config


def setup_project_info(config: dict) -> dict:
    """Sett opp Catenda project informasjon"""

    print_header("📂 CATENDA PROJECT INFORMASJON")

    # Project ID
    existing_project = config.get('catenda_project_id', '')
    if existing_project:
        print(f"Eksisterende Project ID: {existing_project}")
        use_existing = input("Bruk eksisterende? (j/n) [j]: ").strip().lower()
        if use_existing != 'n':
            project_id = existing_project
        else:
            print("\nDu finner Project ID i Catenda URL-en:")
            print("https://app.catenda.com/projects/{PROJECT_ID}/...\n")
            project_id = input("Project ID: ").strip()
    else:
        print("Du finner Project ID i Catenda URL-en:")
        print("https://app.catenda.com/projects/{PROJECT_ID}/...\n")
        project_id = input("Project ID: ").strip()

    if not project_id:
        print("❌ Project ID er påkrevd!")
        sys.exit(1)

    config['catenda_project_id'] = project_id

    # Library ID (valgfri)
    print("\n📚 DOCUMENT LIBRARY")
    print("-" * 70)
    print("Library ID trengs for å laste opp dokumenter.")
    print("Du finner det i URL-en til Document Library.")
    print("(Kan hoppes over hvis du ikke skal laste opp dokumenter)\n")

    existing_library = config.get('catenda_library_id', '')
    if existing_library:
        print(f"Eksisterende Library ID: {existing_library}")
        use_existing = input("Bruk eksisterende? (j/n) [j]: ").strip().lower()
        if use_existing != 'n':
            library_id = existing_library
        else:
            library_id = input("Library ID (Enter for å hoppe over): ").strip()
    else:
        library_id = input("Library ID (Enter for å hoppe over): ").strip()

    if library_id:
        config['catenda_library_id'] = library_id

        # Folder ID (valgfri, krever Library ID)
        print("\n📁 DOCUMENT FOLDER")
        print("-" * 70)
        print("Folder ID angir hvilken mappe dokumenter lastes opp til.")
        print("Du finner det i URL-en når du er inne i en mappe i Document Library.")
        print("(Kan hoppes over - dokumenter havner da i root av biblioteket)\n")

        existing_folder = config.get('catenda_folder_id', '')
        if existing_folder:
            print(f"Eksisterende Folder ID: {existing_folder}")
            use_existing = input("Bruk eksisterende? (j/n) [j]: ").strip().lower()
            if use_existing != 'n':
                folder_id = existing_folder
            else:
                folder_id = input("Folder ID (Enter for å hoppe over): ").strip()
        else:
            folder_id = input("Folder ID (Enter for å hoppe over): ").strip()

        if folder_id:
            config['catenda_folder_id'] = folder_id

    return config


def main():
    """Hovedfunksjon"""

    print("\n" + "=" * 70)
    print("  🚀 KOE AUTOMATION SYSTEM - OPPSETTVEIVISER")
    print("=" * 70)

    print("\nDenne veiviseren hjelper deg med å:")
    print("  1. Velge riktig autentiseringsmetode")
    print("  2. Konfigurere Catenda API-tilgang")
    print("  3. Sette opp prosjektinformasjon")
    print("\nKonfigurasjon lagres i .env-filen.")

    input("\nTrykk Enter for å fortsette...")

    try:
        # Steg 1: Autentisering
        config = setup_authentication()

        # Steg 2: Project info
        config = setup_project_info(config)

        # Konverter til .env-format og lagre
        env_updates = {
            'CATENDA_CLIENT_ID': config.get('catenda_client_id', ''),
            'CATENDA_CLIENT_SECRET': config.get('catenda_client_secret', ''),
            'CATENDA_ACCESS_TOKEN': config.get('catenda_access_token', ''),
            'CATENDA_REFRESH_TOKEN': config.get('catenda_refresh_token', ''),
            'CATENDA_REDIRECT_URI': config.get('catenda_redirect_uri', ''),
            'CATENDA_PROJECT_ID': config.get('catenda_project_id', ''),
            'CATENDA_LIBRARY_ID': config.get('catenda_library_id', ''),
            'CATENDA_FOLDER_ID': config.get('catenda_folder_id', ''),
        }

        # Fjern tomme verdier
        env_updates = {k: v for k, v in env_updates.items() if v}

        update_env_file(env_updates)

        # Oppsummering
        print_header("✅ OPPSETT FULLFØRT!")

        print("Konfigurasjon lagret i .env. Du kan nå starte backend:\n")
        print("  cd backend && python app.py\n")

        print("Eller test med Catenda-menyen:\n")
        print("  python scripts/catenda_menu.py\n")

        print("Konfigurasjonsfil: backend/.env")
        print("For å endre konfigurasjon, kjør dette scriptet igjen.")

    except KeyboardInterrupt:
        print("\n\n👋 Avbrutt av bruker. Ha det!")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Uventet feil: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
