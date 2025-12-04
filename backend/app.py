#!/usr/bin/env python3
"""
KOE Automation System - Backend API (Event Sourcing Architecture)

Flask entrypoint using Event Sourcing Light architecture.

Functionality:
1. Webhook: Detects new cases in Catenda -> Creates case -> Sends link to React App
2. Event API: Receives events from React -> Validates -> Persists with optimistic locking
3. State API: Computes current state by replaying events -> Returns to frontend
4. PDF: Accepts client-generated PDF or generates fallback -> Uploads to Catenda

Architecture:
- routes/event_routes.py: Event submission and state retrieval (Event Sourcing)
- routes/webhook_routes.py: Catenda webhook integration
- routes/utility_routes.py: Health, CSRF, magic links
- services/: Business logic (framework-agnostic)
- repositories/: Event store with optimistic locking
- models/: Domain models (Pydantic) - events and state
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
                logger.warning("⚠️  CATENDA_CLIENT_ID missing in .env - running without Catenda integration")

            # Pass the singleton manager to the context
            system = SystemContext(config, magic_link_manager=get_magic_link_manager())
            logger.info(f"System started. {get_filter_summary()}")
        except Exception as e:
            logger.error(f"Could not start system: {e}")
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
    logger.warning("⚠️  FLASK_SECRET_KEY not set - using dev default. Set in .env for production!")

# CORS Configuration
setup_cors(app)

# Rate Limiting
init_limiter(app)


# ============================================================================
# Register Blueprints (Event Sourcing Architecture)
# ============================================================================

from routes.utility_routes import utility_bp
from routes.event_routes import events_bp
from routes.webhook_routes import webhook_bp
from routes.error_handlers import register_error_handlers

# Register event-sourced routes
app.register_blueprint(utility_bp)
app.register_blueprint(events_bp)
app.register_blueprint(webhook_bp)

logger.info("✅ Event Sourcing Blueprints registered")

# Register error handlers
register_error_handlers(app)


# ============================================================================
# Main Entrypoint
# ============================================================================

if __name__ == "__main__":
    # Check for Catenda configuration (optional)
    if not settings.catenda_client_id:
        logger.warning("⚠️  CATENDA_CLIENT_ID missing in .env - running without Catenda integration")
        logger.info("   To enable: copy backend/.env.example to backend/.env and fill in values")

    print("\n" + "="*70)
    print("🚀 KOE Backend API - Event Sourcing Architecture")
    print("="*70)
    print(f"\n📡 Server: http://localhost:8080")
    print(f"🔍 Environment: {'Development' if app.config['DEBUG'] else 'Production'}")
    print(f"🔗 CORS: {os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173')}")
    print("\n📋 Available Endpoints:")
    print("  ┌─ Event Submission")
    print("  ├── POST   /api/events              Submit single event")
    print("  └── POST   /api/events/batch        Submit multiple events atomically")
    print("\n  ┌─ State & Timeline")
    print("  ├── GET    /api/cases/<id>/state    Get computed case state")
    print("  └── GET    /api/cases/<id>/timeline Get event timeline")
    print("\n  ┌─ Utilities")
    print("  ├── GET    /api/health              Health check")
    print("  ├── GET    /api/csrf                Get CSRF token")
    print("  └── GET    /api/magic-link          Generate magic link")
    print("\n  └─ Webhooks")
    print("      POST   /webhook/catenda/<secret>  Catenda webhook")
    print("\n" + "="*70 + "\n")

    app.run(host='0.0.0.0', port=8080, debug=True)
