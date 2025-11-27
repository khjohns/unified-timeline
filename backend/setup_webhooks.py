#!/usr/bin/env python3
"""
Catenda Webhook Setup - Automatisk oppsett av webhooks
Oppretter nødvendige webhooks for KOE Automation System
"""

import sys
import json
import logging
import requests
import os
from typing import List, Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv

try:
    from catenda_api_tester import CatendaAPITester
except ImportError:
    print("❌ Finner ikke catenda_api_tester.py")
    sys.exit(1)

# Last .env filen
load_dotenv()

# Konfigurer logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('webhook_setup.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class WebhookManager:
    """Håndterer Catenda webhooks via API"""
    
    def __init__(self, catenda: CatendaAPITester, project_id: str):
        """
        Initialiser webhook manager
        
        Args:
            catenda: Autentisert CatendaAPITester-instans
            project_id: Catenda project ID
        """
        self.catenda = catenda
        self.project_id = project_id
        self.base_url = "https://api.catenda.com"
    
    def list_webhooks(self) -> List[Dict[str, Any]]:
        """
        List alle webhooks for prosjektet
        
        Returns:
            Liste med webhook-objekter
        """
        url = f"{self.base_url}/v2/projects/{self.project_id}/webhooks/user"
        
        headers = {
            "Authorization": f"Bearer {self.catenda.access_token}",
            "Accept": "application/json"
        }
        
        try:
            response = requests.get(url, headers=headers)
            
            if response.status_code in [200, 204]:
                webhooks = response.json()
                logger.info(f"✅ Fant {len(webhooks)} webhook(s)")
                return webhooks
            else:
                logger.error(f"❌ Kunne ikke liste webhooks: {response.status_code}")
                logger.error(f"   Response: {response.text}")
                return []
        
        except Exception as e:
            logger.exception(f"❌ Feil ved listing av webhooks: {e}")
            return []
    
    def create_webhook(self, event: str, target_url: str) -> Optional[Dict[str, Any]]:
        """
        Opprett ny webhook
        
        Args:
            event: Event type (f.eks. 'issue.created')
            target_url: URL som skal kalles
        
        Returns:
            Webhook-objekt hvis vellykket, None ellers
        """
        url = f"{self.base_url}/v2/projects/{self.project_id}/webhooks/user"
        
        headers = {
            "Authorization": f"Bearer {self.catenda.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        payload = {
            "event": event,
            "target_url": target_url
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload)
            
            if response.status_code == 200:
                webhook = response.json()
                logger.info(f"✅ Webhook opprettet: {event} → {target_url}")
                logger.info(f"   Webhook ID: {webhook.get('id')}")
                return webhook
            else:
                logger.error(f"❌ Kunne ikke opprette webhook: {response.status_code}")
                logger.error(f"   Response: {response.text}")
                return None
        
        except Exception as e:
            logger.exception(f"❌ Feil ved opprettelse av webhook: {e}")
            return None
    
    def delete_webhook(self, webhook_id: str) -> bool:
        """
        Slett webhook
        
        Args:
            webhook_id: ID til webhook som skal slettes
        
        Returns:
            True hvis vellykket
        """
        url = f"{self.base_url}/v2/projects/{self.project_id}/webhooks/user/{webhook_id}"
        
        headers = {
            "Authorization": f"Bearer {self.catenda.access_token}",
            "Accept": "application/json"
        }
        
        try:
            response = requests.delete(url, headers=headers)
            
            if response.status_code == 200:
                logger.info(f"✅ Webhook slettet: {webhook_id}")
                return True
            else:
                logger.error(f"❌ Kunne ikke slette webhook: {response.status_code}")
                logger.error(f"   Response: {response.text}")
                return False
        
        except Exception as e:
            logger.exception(f"❌ Feil ved sletting av webhook: {e}")
            return False
    
    def webhook_exists(self, event: str, target_url: str) -> Optional[Dict[str, Any]]:
        """
        Sjekk om webhook allerede eksisterer
        
        Args:
            event: Event type
            target_url: Target URL
        
        Returns:
            Webhook-objekt hvis den eksisterer, None ellers
        """
        webhooks = self.list_webhooks()
        
        for webhook in webhooks:
            if webhook.get('event') == event and webhook.get('target_url') == target_url:
                return webhook
        
        return None
    
    def ensure_webhook(self, event: str, target_url: str) -> Optional[Dict[str, Any]]:
        """
        Sørg for at webhook eksisterer (opprett hvis ikke)
        
        Args:
            event: Event type
            target_url: Target URL
        
        Returns:
            Webhook-objekt
        """
        # Sjekk om den allerede eksisterer
        existing = self.webhook_exists(event, target_url)
        
        if existing:
            logger.info(f"✅ Webhook eksisterer allerede: {event}")
            return existing
        
        # Opprett ny
        logger.info(f"📝 Oppretter ny webhook: {event}")
        return self.create_webhook(event, target_url)


def print_header(title: str):
    """Print formatert header"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def load_config() -> Dict[str, Any]:
    """Last konfigurasjon fra config.json"""
    config_file = Path("config.json")
    
    if not config_file.exists():
        print("❌ config.json ikke funnet")
        print("\nKjør først: python setup_authentication.py")
        sys.exit(1)
    
    try:
        with open(config_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Kunne ikke lese config.json: {e}")
        sys.exit(1)


def authenticate_catenda(config: Dict[str, Any]) -> CatendaAPITester:
    """Autentiser mot Catenda"""
    
    tester = CatendaAPITester(
        client_id=config['catenda_client_id'],
        client_secret=config.get('catenda_client_secret')
    )
    
    # Sjekk om vi har lagret token
    access_token = config.get('catenda_access_token')
    if access_token:
        logger.info("🔑 Bruker lagret access token...")
        tester.set_access_token(access_token)
        return tester
    
    # Prøv Client Credentials Grant
    if config.get('catenda_client_secret'):
        logger.info("🔐 Autentiserer med Client Credentials Grant...")
        if tester.authenticate():
            return tester
    
    # Authorization Code Grant kreves
    print("\n❌ Autentisering kreves!")
    print("Kjør først: python setup_authentication.py")
    sys.exit(1)


def setup_webhooks_interactive():
    """Interaktivt oppsett av webhooks"""
    
    print_header("🔔 CATENDA WEBHOOK SETUP")
    
    print("Dette scriptet setter opp webhooks automatisk for KOE Automation System.\n")
    
    # Last config
    config = load_config()
    
    # Autentiser
    print("🔐 Autentiserer mot Catenda...")
    catenda = authenticate_catenda(config)
    print("✅ Autentisert!\n")
    
    # Sjekk project ID
    project_id = config.get('catenda_project_id')
    if not project_id:
        print("❌ catenda_project_id mangler i config.json")
        sys.exit(1)
    
    print(f"📂 Project ID: {project_id}\n")
    
    # Opprett webhook manager
    manager = WebhookManager(catenda, project_id)
    
    # Sjekk eksisterende webhooks
    print("📋 Sjekker eksisterende webhooks...")
    existing_webhooks = manager.list_webhooks()
    
    if existing_webhooks:
        print(f"\nFant {len(existing_webhooks)} eksisterende webhook(s):")
        for i, webhook in enumerate(existing_webhooks, 1):
            state_emoji = "✅" if webhook.get('state') == 'ENABLED' else "⚠️"
            print(f"  {i}. {state_emoji} {webhook.get('event')} → {webhook.get('target_url')}")
            print(f"     ID: {webhook.get('id')}, State: {webhook.get('state')}")
    else:
        print("Ingen eksisterende webhooks funnet.")
    
    # Spør om ngrok URL
    print("\n" + "=" * 70)
    print("WEBHOOK TARGET URL")
    print("=" * 70)
    print("\nWebhooks trenger en URL å kalle når events skjer.")
    print("Hvis du bruker ngrok, ser URL-en slik ut:")
    print("  https://abc123.ngrok.io/webhook/catenda")
    print("\nHvis du ikke har startet ngrok ennå:")
    print("  1. Åpne nytt terminalvindu")
    print("  2. Kjør: ngrok http 5000")
    print("  3. Kopier ngrok URL og legg til /webhook/catenda")
    
    # Hent base URL og hemmelig sti fra .env
    ngrok_url = os.getenv("NGROK_URL")
    secret_path = os.getenv("WEBHOOK_SECRET_PATH")

    if not ngrok_url or not secret_path:
        print("\n❌ NGROK_URL og/eller WEBHOOK_SECRET_PATH ikke funnet i .env-filen.")
        print("   Sørg for at begge variablene er satt i backend/.env")
        sys.exit(1)

    # Bygg den endelige, hemmelige URLen
    target_url = f"{ngrok_url}/webhook/catenda/{secret_path}"
    print(f"✅ Bygger hemmelig URL for Catenda: {target_url}")
    
    # Definer nødvendige webhooks
    required_webhooks = [
        {
            'event': 'issue.created',
            'target_url': target_url,
            'description': 'Trigger når ny topic/sak opprettes'
        },
        {
            'event': 'issue.modified',
            'target_url': target_url,
            'description': 'Trigger når topic oppdateres (f.eks. ny kommentar)'
        },
        {
            'event': 'issue.status.changed',
            'target_url': target_url,
            'description': 'Trigger når status på en topic endres'
        }
    ]
    
    # Opprett webhooks
    print("\n" + "=" * 70)
    print("OPPRETTER WEBHOOKS")
    print("=" * 70 + "\n")
    
    created_webhooks = []
    
    for webhook_spec in required_webhooks:
        print(f"📝 {webhook_spec['event']}")
        print(f"   {webhook_spec['description']}")
        
        webhook = manager.ensure_webhook(
            event=webhook_spec['event'],
            target_url=webhook_spec['target_url']
        )
        
        if webhook:
            created_webhooks.append(webhook)
            print(f"   ✅ OK (ID: {webhook.get('id')})\n")
        else:
            print(f"   ❌ Feilet\n")
    
    # Oppsummering
    print_header("✅ WEBHOOK-OPPSETT FULLFØRT!")
    
    print(f"Opprettet/verifisert {len(created_webhooks)} webhook(s):\n")
    for webhook in created_webhooks:
        print(f"  • {webhook.get('event')}")
        print(f"    URL: {webhook.get('target_url')}")
        print(f"    ID: {webhook.get('id')}")
        print(f"    State: {webhook.get('state')}\n")
    
    print("Neste steg:")
    print("  1. Sørg for at webhook-serveren kjører:")
    print("     python koe_automation_system.py")
    print()
    print("  2. Test ved å opprette en ny topic i Catenda")
    print()
    print("  3. Se logger i koe_automation.log")


def setup_webhooks_automatic(target_url: str):
    """
    Automatisk oppsett av webhooks (non-interactive)
    
    Args:
        target_url: Webhook target URL
    """
    config = load_config()
    catenda = authenticate_catenda(config)
    
    project_id = config.get('catenda_project_id')
    if not project_id:
        raise ValueError("catenda_project_id mangler i config.json")
    
    manager = WebhookManager(catenda, project_id)
    
    # Opprett nødvendige webhooks
    webhooks_to_create = [
        ('issue.created', target_url),
        ('issue.modified', target_url)
    ]
    
    results = []
    for event, url in webhooks_to_create:
        webhook = manager.ensure_webhook(event, url)
        results.append((event, webhook is not None))
    
    return results


def list_webhooks_command():
    """Kommando for å liste webhooks"""
    
    print_header("📋 LISTE WEBHOOKS")
    
    config = load_config()
    catenda = authenticate_catenda(config)
    
    project_id = config.get('catenda_project_id')
    if not project_id:
        print("❌ catenda_project_id mangler i config.json")
        sys.exit(1)
    
    manager = WebhookManager(catenda, project_id)
    webhooks = manager.list_webhooks()
    
    if not webhooks:
        print("Ingen webhooks funnet.")
        return
    
    print(f"\nFant {len(webhooks)} webhook(s):\n")
    
    for i, webhook in enumerate(webhooks, 1):
        state_emoji = "✅" if webhook.get('state') == 'ENABLED' else "⚠️"
        print(f"{i}. {state_emoji} {webhook.get('event')}")
        print(f"   URL: {webhook.get('target_url')}")
        print(f"   ID: {webhook.get('id')}")
        print(f"   State: {webhook.get('state')}")
        print(f"   Failures: {webhook.get('failureCount', 0)}")
        print(f"   Created: {webhook.get('createdAt')}")
        print()


def delete_webhooks_command():
    """Kommando for å slette webhooks"""
    
    print_header("🗑️  SLETTE WEBHOOKS")
    
    config = load_config()
    catenda = authenticate_catenda(config)
    
    project_id = config.get('catenda_project_id')
    if not project_id:
        print("❌ catenda_project_id mangler i config.json")
        sys.exit(1)
    
    manager = WebhookManager(catenda, project_id)
    webhooks = manager.list_webhooks()
    
    if not webhooks:
        print("Ingen webhooks å slette.")
        return
    
    print(f"\nFant {len(webhooks)} webhook(s):\n")
    
    for i, webhook in enumerate(webhooks, 1):
        state_emoji = "✅" if webhook.get('state') == 'ENABLED' else "⚠️"
        print(f"{i}. {state_emoji} {webhook.get('event')} → {webhook.get('target_url')}")
        print(f"   ID: {webhook.get('id')}")
    
    print("\nVelg webhook(s) å slette:")
    print("  - Enkelt nummer: 1")
    print("  - Flere numre: 1,3,5")
    print("  - Alle: all")
    print("  - Avbryt: Enter")
    
    choice = input("\nValg: ").strip().lower()
    
    if not choice:
        print("Avbrutt.")
        return
    
    if choice == 'all':
        to_delete = list(range(len(webhooks)))
    else:
        try:
            to_delete = [int(x.strip()) - 1 for x in choice.split(',')]
        except:
            print("❌ Ugyldig input")
            return
    
    # Bekreft
    print(f"\nSletter {len(to_delete)} webhook(s)...")
    confirm = input("Er du sikker? (j/n): ").strip().lower()
    
    if confirm != 'j':
        print("Avbrutt.")
        return
    
    # Slett
    for idx in to_delete:
        if 0 <= idx < len(webhooks):
            webhook = webhooks[idx]
            manager.delete_webhook(webhook['id'])


def main():
    """Hovedfunksjon"""
    
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == 'list':
            list_webhooks_command()
        elif command == 'delete':
            delete_webhooks_command()
        elif command == 'setup':
            setup_webhooks_interactive()
        else:
            print(f"Ukjent kommando: {command}")
            print("\nBruk:")
            print("  python setup_webhooks.py         - Interaktivt oppsett")
            print("  python setup_webhooks.py setup   - Interaktivt oppsett")
            print("  python setup_webhooks.py list    - List webhooks")
            print("  python setup_webhooks.py delete  - Slett webhooks")
    else:
        # Default: interaktivt oppsett
        setup_webhooks_interactive()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Avbrutt av bruker. Ha det!")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Uventet feil: {e}")
        logger.exception("Unexpected error")
        sys.exit(1)
