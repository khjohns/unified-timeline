#!/usr/bin/env python3
"""
KOE Automation System - Interaktivt oppsettscript
Hjelper deg med å konfigurere autentisering første gang
"""

import json
import sys
from pathlib import Path

# Sjekk at catenda_api_tester er tilgjengelig
try:
    from catenda_api_tester import CatendaAPITester
except ImportError:
    print("❌ Finner ikke catenda_api_tester.py")
    print("   Last ned filen og plasser den i samme mappe.")
    sys.exit(1)


def print_header(title: str):
    """Print formatert header"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def get_existing_config():
    """Last eksisterende config hvis den finnes"""
    config_file = Path("config.json")
    if config_file.exists():
        try:
            with open(config_file, 'r') as f:
                return json.load(f)
        except:
            pass
    return {}


def save_config(config: dict):
    """Lagre konfigurasjon til config.json"""
    with open('config.json', 'w') as f:
        json.dump(config, f, indent=2)
    print("\n✅ Konfigurasjon lagret til config.json")


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
    
    # Les eksisterende config
    config = get_existing_config()
    
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
        return setup_client_credentials(config)
    else:
        return setup_authorization_code(config)


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
    tester = CatendaAPITester(
        client_id=config['catenda_client_id'],
        client_secret=client_secret
    )
    
    if tester.authenticate():
        print("✅ Autentisering vellykket!")
        
        # Lagre token
        if tester.access_token:
            config['catenda_access_token'] = tester.access_token
            print("✅ Access token lagret")
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
    """Sett opp Authorization Code Grant"""
    
    print_header("🌐 AUTHORIZATION CODE GRANT")
    
    print("Denne metoden krever nettleser-interaksjon.\n")
    
    # Client Secret er valgfri for Authorization Code Grant
    print("Client Secret (valgfri, trykk Enter for å hoppe over):")
    client_secret = input("Client Secret: ").strip()
    if client_secret:
        config['catenda_client_secret'] = client_secret
    
    # Redirect URI
    print("\n📍 REDIRECT URI")
    print("-" * 70)
    print("Dette må være registrert i Catenda Developer Portal.")
    print("For lokal testing, bruk: http://localhost:8080/callback\n")
    
    existing_redirect = config.get('catenda_redirect_uri', 'http://localhost:8080/callback')
    print(f"Eksisterende Redirect URI: {existing_redirect}")
    use_existing = input("Bruk eksisterende? (j/n) [j]: ").strip().lower()
    if use_existing != 'n':
        redirect_uri = existing_redirect
    else:
        redirect_uri = input("Redirect URI: ").strip()
    
    if not redirect_uri:
        redirect_uri = "http://localhost:8080/callback"
    
    config['catenda_redirect_uri'] = redirect_uri
    
    # Start autentiseringsflyt
    print("\n🚀 STARTER AUTENTISERINGSFLYT")
    print("-" * 70)
    
    tester = CatendaAPITester(
        client_id=config['catenda_client_id'],
        client_secret=config.get('catenda_client_secret')
    )
    
    # Generer authorization URL
    auth_url = tester.get_authorization_url(redirect_uri)
    
    print("\n📋 STEG 1: Åpne denne URL-en i nettleser:")
    print(f"\n   {auth_url}\n")
    
    input("Trykk Enter når du har åpnet URL-en...")
    
    print("\n📋 STEG 2: Etter godkjenning, kopier 'code' fra redirect URL")
    print("\nRedirect URL-en ser slik ut:")
    print(f"   {redirect_uri}?code=ABC123XYZ&state=...\n")
    print("Kopier delen etter 'code=' (ABC123XYZ i eksempelet)\n")
    
    code = input("Authorization code: ").strip()
    
    if not code:
        print("❌ Authorization code er påkrevd!")
        sys.exit(1)
    
    print("\n🔄 Bytter authorization code mot access token...")
    
    if tester.exchange_code_for_token(code, redirect_uri):
        print("✅ Access token hentet!")
        
        # Lagre tokens
        if tester.access_token:
            config['catenda_access_token'] = tester.access_token
            print("✅ Access token lagret")
        
        if tester.refresh_token:
            config['catenda_refresh_token'] = tester.refresh_token
            print("✅ Refresh token lagret")
    else:
        print("\n❌ Kunne ikke hente access token!")
        print("\nMulige årsaker:")
        print("- Feil authorization code")
        print("- Authorization code er allerede brukt")
        print("- Redirect URI matcher ikke den registrerte")
        
        retry = input("\nVil du prøve igjen? (j/n) [j]: ").strip().lower()
        if retry != 'n':
            return setup_authorization_code(config)
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
    
    # Data directory
    existing_data_dir = config.get('data_dir', 'koe_data')
    print(f"\n📁 Data lagres i: {existing_data_dir}")
    use_existing = input("Bruk eksisterende? (j/n) [j]: ").strip().lower()
    if use_existing != 'n':
        data_dir = existing_data_dir
    else:
        data_dir = input("Data directory: ").strip()
    
    if not data_dir:
        data_dir = 'koe_data'
    
    config['data_dir'] = data_dir
    
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
    
    input("\nTrykk Enter for å fortsette...")
    
    try:
        # Steg 1: Autentisering
        config = setup_authentication()
        
        # Steg 2: Project info
        config = setup_project_info(config)
        
        # Lagre config
        save_config(config)
        
        # Oppsummering
        print_header("✅ OPPSETT FULLFØRT!")
        
        print("Konfigurasjon lagret. Du kan nå starte automation-systemet:\n")
        print("  python koe_automation_system.py\n")
        
        print("Eller test API-tilgang:\n")
        print("  python catenda_api_tester.py\n")
        
        print("Konfigurasjonsfi: config.json")
        print("For å endre konfigurasjon, kjør dette scriptet igjen.")
        
    except KeyboardInterrupt:
        print("\n\n👋 Avbrutt av bruker. Ha det!")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Uventet feil: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
