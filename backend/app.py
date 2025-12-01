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
from typing import Optional

# Last .env fil (VIKTIG for sikkerhetsvariabler)
from pathlib import Path
from dotenv import load_dotenv
dotenv_path = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=dotenv_path)

# Flask
try:
    from flask import Flask
except ImportError:
    print("❌ Flask ikke installert. Kjør: pip install flask flask-cors")
    sys.exit(1)

# Core modules
from core.config import settings
from core.logging_config import setup_logging
from core.cors_config import setup_cors
from core.system_context import SystemContext
from lib.auth.magic_link import MagicLinkManager

# Security
from lib.security.rate_limiter import init_limiter

# Filtering
from utils.filtering_config import get_filter_summary


# ============================================================================
# Logging Setup
# ============================================================================

logger = setup_logging('koe_automation.log')


# ============================================================================
# Global System Instance & Singletons
# ============================================================================

system: Optional[SystemContext] = None
magic_link_manager: Optional[MagicLinkManager] = None


def get_magic_link_manager() -> MagicLinkManager:
    """Get or initialize the global MagicLinkManager singleton."""
    global magic_link_manager
    if magic_link_manager is None:
        magic_link_manager = MagicLinkManager()
        logger.info("🪄 MagicLinkManager singleton initialized.")
    return magic_link_manager


def get_system() -> SystemContext:
    """
    Get or initialize global SystemContext instance.
    """
    global system
    if system is None:
        try:
            config = settings.get_catenda_config()
            if not config.get('catenda_client_id'):
                logger.error("❌ CATENDA_CLIENT_ID mangler i .env")
                sys.exit(1)

            # Pass the singleton manager to the context
            system = SystemContext(config, magic_link_manager=get_magic_link_manager())
            logger.info(f"System startet. {get_filter_summary()}")
        except Exception as e:
            logger.error(f"Kunne ikke starte systemet: {e}")
            sys.exit(1)
    return system



# ============================================================================
# Flask App Setup
# ============================================================================

app = Flask(__name__)

# Flask Secret Key (required for sessions and security features)
app.config['SECRET_KEY'] = os.getenv(
    'FLASK_SECRET_KEY',
    'dev-only-secret-CHANGE-IN-PRODUCTION'
)
if app.config['SECRET_KEY'] == 'dev-only-secret-CHANGE-IN-PRODUCTION':
    logger.warning("⚠️  FLASK_SECRET_KEY ikke satt - bruker dev default. Sett i .env for produksjon!")

# CORS Configuration
setup_cors(app)

# Rate Limiting
init_limiter(app)


# ============================================================================
# Register Blueprints
# ============================================================================

from routes.utility_routes import utility_bp
from routes.case_routes import case_bp
from routes.varsel_routes import varsel_bp
from routes.koe_routes import koe_bp
from routes.svar_routes import svar_bp
from routes.webhook_routes import webhook_bp
from routes.error_handlers import register_error_handlers

app.register_blueprint(utility_bp)
app.register_blueprint(case_bp)
app.register_blueprint(varsel_bp)
app.register_blueprint(koe_bp)
app.register_blueprint(svar_bp)
app.register_blueprint(webhook_bp)

logger.info("✅ All Blueprints registered")

# Register error handlers
register_error_handlers(app)


# ============================================================================
# Main Entrypoint
# ============================================================================

if __name__ == "__main__":
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
