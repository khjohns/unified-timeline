#!/usr/bin/env python3
"""
KOE Automation System - Backend API (Refactored)

Flask entrypoint using Blueprint architecture.

Funksjonalitet:
1. Webhook: Oppdager nye saker i Catenda -> Oppretter sak -> Sender lenke til React App.
2. Webhook: Oppdager endringer (status/kommentar) -> Oppdaterer intern status.
3. API: Tar imot skjemadata fra React -> Lagrer JSON -> Oppdaterer status.
4. API: Tar imot generert PDF fra React -> Laster opp til Catenda.

Architecture:
- routes/: HTTP endpoints (Flask Blueprints)
- services/: Business logic (framework-agnostic)
- repositories/: Data access (storage-agnostic)
- models/: Domain models (Pydantic)
"""

import os
import sys
import logging
import socket
from typing import Optional, Dict, Any

# Last .env fil (VIKTIG for sikkerhetsvariabler)
from dotenv import load_dotenv
load_dotenv()

# Import constants and settings
from core.generated_constants import SAK_STATUS
from core.config import settings

# Repository (data access layer)
from repositories.csv_repository import CSVRepository

# Flask og CORS
try:
    from flask import Flask, request, jsonify, g
    from flask_cors import CORS
except ImportError:
    print("❌ Flask eller Flask-Cors ikke installert. Kjør: pip install flask flask-cors")
    sys.exit(1)

# Catenda API
try:
    from integrations.catenda import CatendaClient
except ImportError:
    print("❌ Finner ikke catenda_api_tester.py")
    sys.exit(1)

# Filtering imports
try:
    from utils.filtering_config import should_process_topic, get_filter_summary
except ImportError:
    print("❌ Finner ikke filtering_config.py")
    sys.exit(1)

# Security modules
try:
    from lib.monitoring.audit import audit
except ImportError as e:
    print(f"⚠️  Sikkerh​etsmoduler ikke funnet: {e}")
    print("   Fortsetter uten sikkerhetsfunksjoner (kun for utvikling)")
    class audit:
        @staticmethod
        def log_event(*args, **kwargs): pass
        @staticmethod
        def log_access_denied(*args, **kwargs): pass
        @staticmethod
        def log_security_event(*args, **kwargs): pass

# Konfigurer logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('koe_automation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def get_local_ip():
    """Henter maskinens lokale nettverks-IP."""
    s = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        if s:
            s.close()
    return IP


# ============================================================================
# SystemContext - Simplified context holder (replaces KOEAutomationSystem)
# Webhook logic moved to services/webhook_service.py
# ============================================================================

class SystemContext:
    """
    Simplified system context for legacy route compatibility.

    Provides access to:
    - db: CSVRepository (data access)
    - catenda: CatendaClient (Catenda API integration)
    - get_react_app_base_url(): React app URL helper

    Note: Webhook handlers moved to services/webhook_service.py
    Future refactoring should migrate routes to use service layer directly.
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.db = CSVRepository(config.get('data_dir', 'koe_data'))
        self.catenda = CatendaClient(
            client_id=config['catenda_client_id'],
            client_secret=config.get('catenda_client_secret')
        )

        if not self._authenticate():
            logger.warning("⚠️ Kunne ikke autentisere mot Catenda ved oppstart.")

    def _authenticate(self) -> bool:
        """Enkel autentisering med lagret token eller client credentials"""
        access_token = self.config.get('catenda_access_token')
        if access_token:
            self.catenda.set_access_token(access_token)
            return True
        if self.config.get('catenda_client_secret'):
            return self.catenda.authenticate()
        return False

    def get_react_app_base_url(self) -> str:
        """Determines the correct base URL for the React application."""
        if settings.dev_react_app_url:
            return settings.dev_react_app_url
        if settings.react_app_url:
            return settings.react_app_url
        if 'react_app_url' in self.config and self.config['react_app_url']:
            return self.config['react_app_url']

        # Fallback: localhost
        local_ip = get_local_ip()
        return f"http://{local_ip}:3000"


# ============================================================================
# Flask App Setup
# ============================================================================

app = Flask(__name__)

# Flask Secret Key (required for sessions and security features)
# VIKTIG: Bruk sterk, tilfeldig secret i produksjon!
app.config['SECRET_KEY'] = os.getenv(
    'FLASK_SECRET_KEY',
    'dev-only-secret-CHANGE-IN-PRODUCTION'
)
if app.config['SECRET_KEY'] == 'dev-only-secret-CHANGE-IN-PRODUCTION':
    logger.warning("⚠️  FLASK_SECRET_KEY ikke satt - bruker dev default. Sett i .env for produksjon!")

# CORS Configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
NGROK_URL = os.getenv("NGROK_URL", "")
if NGROK_URL:
    ALLOWED_ORIGINS.append(NGROK_URL)

CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "X-CSRF-Token", "Authorization"],
        "expose_headers": ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
        "supports_credentials": False,
        "max_age": 3600
    }
})

# Rate Limiting (via sentralisert modul)
from lib.security.rate_limiter import init_limiter
init_limiter(app)

# Global system instance
system: Optional[SystemContext] = None

def get_system():
    """
    Get or initialize global SystemContext instance.

    Legacy function for backwards compatibility with existing routes.
    Future refactoring should migrate routes to use service layer directly.
    """
    global system
    if system is None:
        try:
            # Bruk settings fra .env (via core/config.py)
            config = settings.get_catenda_config()

            # Sjekk at påkrevde felt er satt
            if not config.get('catenda_client_id'):
                logger.error("❌ CATENDA_CLIENT_ID mangler i .env")
                logger.error("   Kjør 'python scripts/setup_authentication.py' for å konfigurere.")
                sys.exit(1)

            system = SystemContext(config)
            logger.info(f"System startet. {get_filter_summary()}")
        except Exception as e:
            logger.error(f"Kunne ikke starte systemet: {e}")
            sys.exit(1)
    return system


# ============================================================================
# Import and Register Blueprints
# ============================================================================

from routes.utility_routes import utility_bp
from routes.case_routes import case_bp
from routes.varsel_routes import varsel_bp
from routes.koe_routes import koe_bp
from routes.svar_routes import svar_bp
from routes.webhook_routes import webhook_bp

app.register_blueprint(utility_bp)
app.register_blueprint(case_bp)
app.register_blueprint(varsel_bp)
app.register_blueprint(koe_bp)
app.register_blueprint(svar_bp)
app.register_blueprint(webhook_bp)

logger.info("✅ All Blueprints registered")


# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(429)
def ratelimit_handler(e):
    """Handler for rate limit overskredet."""
    audit.log_security_event("rate_limit_exceeded", {
        "limit": str(e.description)
    })
    return jsonify({
        "error": "Rate limit exceeded",
        "detail": str(e.description),
        "retry_after": getattr(e, 'retry_after', 60)
    }), 429

@app.errorhandler(403)
def forbidden_handler(e):
    """Handler for tilgang nektet."""
    user = g.get('user', {})
    audit.log_access_denied(
        user=user.get('email', 'anonymous'),
        resource=request.path,
        reason=str(e)
    )
    return jsonify({"error": "Forbidden", "detail": str(e)}), 403


# ============================================================================
# Main Entrypoint
# ============================================================================

if __name__ == "__main__":
    # Konfigurasjon leses nå fra .env via core/config.py
    # Sjekk at CATENDA_CLIENT_ID er satt
    if not settings.catenda_client_id:
        print("❌ CATENDA_CLIENT_ID mangler i .env")
        print("   Kopier backend/.env.example til backend/.env og fyll inn verdier,")
        print("   eller kjør 'python scripts/setup_authentication.py' for interaktivt oppsett.")
        sys.exit(1)

    print("🚀 KOE Backend API starter på port 8080...")
    print("📋 Registered routes:")
    print("  - Utility routes (CSRF, magic-link, health)")
    print("  - Case routes (get case, save draft)")
    print("  - Varsel routes (varsel submission)")
    print("  - KOE routes (KOE submission, PDF upload)")
    print("  - Svar routes (BH svar submission)")
    print("  - Webhook routes (Catenda webhooks)")
    app.run(host='0.0.0.0', port=8080, debug=True)
