#!/usr/bin/env python3
"""
Unified Timeline - Backend API

Flask backend using Event Sourcing architecture.

Functionality:
1. Webhook: Detects new cases in Catenda -> Creates case -> Sends link to React App
2. Event API: Receives events from React -> Validates -> Persists with optimistic locking
3. State API: Computes current state by replaying events -> Returns to frontend
4. PDF: Accepts client-generated PDF or generates fallback -> Uploads to Catenda

Architecture:
- routes/event_routes.py: Event submission and state retrieval
- routes/webhook_routes.py: Catenda webhook integration
- routes/utility_routes.py: Health, CSRF, magic links
- services/: Business logic (framework-agnostic)
- repositories/: Event store with optimistic locking
- models/: Domain models (Pydantic) - events and state
"""

import atexit
import os
import signal
import subprocess
import sys
import time

# Server start time for uptime tracking
SERVER_START_TIME: float | None = None

# Last .env fil (VIKTIG for sikkerhetsvariabler)
from pathlib import Path

from dotenv import load_dotenv

dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=dotenv_path)

# Flask
try:
    from flask import Flask
except ImportError:
    print("❌ Flask ikke installert. Kjør: pip install flask flask-cors")
    sys.exit(1)

# Core modules
from core.config import settings
from core.cors_config import setup_cors
from core.logging_config import setup_logging

# Request context
from core.request_context import init_request_context
from core.system_context import SystemContext
from lib.auth.magic_link import MagicLinkManager
from lib.project_context import init_project_context

# Security
from lib.security.rate_limiter import init_limiter

# Filtering
from utils.filtering_config import get_filter_summary


def get_uptime() -> str:
    """Get server uptime as human-readable string."""
    if SERVER_START_TIME is None:
        return "unknown"
    seconds = int(time.time() - SERVER_START_TIME)
    if seconds < 60:
        return f"{seconds}s"
    elif seconds < 3600:
        return f"{seconds // 60}m {seconds % 60}s"
    else:
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        return f"{hours}h {minutes}m"


# ============================================================================
# Logging Setup
# ============================================================================

logger = setup_logging("unified_timeline.log")


# ============================================================================
# Global System Instance & Singletons
# ============================================================================

system: SystemContext | None = None
magic_link_manager: MagicLinkManager | None = None


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
            if not config.get("catenda_client_id"):
                logger.warning(
                    "⚠️  CATENDA_CLIENT_ID missing in .env - running without Catenda integration"
                )

            # Pass the singleton manager to the context
            system = SystemContext(config, magic_link_manager=get_magic_link_manager())
            logger.info(f"System started. {get_filter_summary()}")
        except Exception as e:
            logger.error(f"Could not start system: {e}")
            sys.exit(1)
    assert system is not None  # Guaranteed by sys.exit(1) above
    return system


# ============================================================================
# Flask App Setup
# ============================================================================

app = Flask(__name__)

# Flask Secret Key (required for sessions and security features)
app.config["SECRET_KEY"] = os.getenv(
    "FLASK_SECRET_KEY", "dev-only-secret-CHANGE-IN-PRODUCTION"
)
if app.config["SECRET_KEY"] == "dev-only-secret-CHANGE-IN-PRODUCTION":
    logger.warning(
        "⚠️  FLASK_SECRET_KEY not set - using dev default. Set in .env for production!"
    )

# Flask 3.1+: Secret key fallbacks for key rotation
# When rotating keys, add old key here to keep existing sessions valid
# Format: FLASK_SECRET_KEY_FALLBACKS=oldkey1,oldkey2
fallback_keys = os.getenv("FLASK_SECRET_KEY_FALLBACKS", "")
if fallback_keys:
    app.config["SECRET_KEY_FALLBACKS"] = [
        k.strip() for k in fallback_keys.split(",") if k.strip()
    ]

# Flask 3.1+: Form security limits (DoS protection)
# MAX_FORM_MEMORY_SIZE: Max bytes for form data in memory (default 500KB)
# MAX_FORM_PARTS: Max number of form fields/files (default 1000)
app.config["MAX_FORM_MEMORY_SIZE"] = int(os.getenv("MAX_FORM_MEMORY_SIZE", 500 * 1024))
app.config["MAX_FORM_PARTS"] = int(os.getenv("MAX_FORM_PARTS", 1000))

# Max content length for uploads (16MB default)
app.config["MAX_CONTENT_LENGTH"] = int(
    os.getenv("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)
)

# CORS Configuration
setup_cors(app)

# Rate Limiting
init_limiter(app)

# Request context (request ID tracking)
init_request_context(app)

# Project context (X-Project-ID header)
init_project_context(app)


# ============================================================================
# Register Blueprints
# ============================================================================

from kofa.web import (
    create_mcp_blueprint as create_kofa_mcp_blueprint,  # MCP server for KOFA
)
from paragraf.web import (
    create_mcp_blueprint,  # MCP server for Lovdata (external package)
)

from routes.analytics_routes import analytics_bp
from routes.bim_link_routes import bim_bp
from routes.catenda_webhook_routes import webhook_bp  # Catenda-specific webhooks
from routes.cloudevents_routes import cloudevents_bp
from routes.endringsordre_routes import endringsordre_bp
from routes.error_handlers import register_error_handlers
from routes.event_routes import events_bp
from routes.forsering_routes import forsering_bp
from routes.fravik_routes import fravik_bp
from routes.letter_routes import letter_bp
from routes.membership_routes import membership_bp
from routes.oauth_auto_consent_routes import oauth_auto_consent_bp  # noqa: F401
from routes.oauth_consent_routes import oauth_consent_bp  # OAuth consent API
from routes.project_routes import projects_bp
from routes.sync_routes import sync_bp
from routes.utility_routes import utility_bp
from routes.wellknown_routes import wellknown_bp  # OAuth discovery endpoints

# Register routes
app.register_blueprint(utility_bp)
app.register_blueprint(events_bp)
app.register_blueprint(webhook_bp)
app.register_blueprint(forsering_bp)
app.register_blueprint(endringsordre_bp)
app.register_blueprint(cloudevents_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(sync_bp)
app.register_blueprint(fravik_bp)
app.register_blueprint(letter_bp)
app.register_blueprint(create_mcp_blueprint(), url_prefix="/mcp/paragraf")
app.register_blueprint(create_kofa_mcp_blueprint(), url_prefix="/mcp/kofa")
app.register_blueprint(oauth_consent_bp)
app.register_blueprint(oauth_auto_consent_bp)
app.register_blueprint(wellknown_bp)
app.register_blueprint(projects_bp)
app.register_blueprint(membership_bp)
app.register_blueprint(bim_bp)

# Register error handlers
register_error_handlers(app)


# ============================================================================
# Main Entrypoint
# ============================================================================

if __name__ == "__main__":
    start_time = time.time()

    # ANSI colors
    BOLD = "\033[1m"
    DIM = "\033[2m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    CYAN = "\033[36m"
    RESET = "\033[0m"

    # Startup validation
    warnings = []
    if not os.getenv("FLASK_SECRET_KEY"):
        warnings.append("FLASK_SECRET_KEY ikke satt (bruker dev-default)")
    if not os.getenv("CSRF_SECRET"):
        warnings.append("CSRF_SECRET ikke satt")
    if os.getenv("EVENT_STORE_BACKEND") == "supabase":
        if not os.getenv("SUPABASE_URL"):
            warnings.append("SUPABASE_URL mangler (EVENT_STORE_BACKEND=supabase)")
        if not os.getenv("SUPABASE_KEY"):
            warnings.append("SUPABASE_KEY mangler (EVENT_STORE_BACKEND=supabase)")

    # Graceful shutdown handler
    def shutdown_handler(signum, frame):
        sig_name = signal.Signals(signum).name
        logger.info(f"Mottok {sig_name}, avslutter...")
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)

    # Log shutdown on exit
    @atexit.register
    def log_shutdown():
        if SERVER_START_TIME:
            logger.info(f"Server stoppet. Kjørte i {get_uptime()}")

    # Git version
    try:
        git_commit = subprocess.getoutput("git rev-parse --short HEAD")
    except Exception:
        git_commit = "unknown"

    # Port (Azure App Service sets PORT env var)
    port = int(os.getenv("PORT", 8080))

    # Count routes per blueprint
    blueprint_routes = {}
    for rule in app.url_map.iter_rules():
        if "." in rule.endpoint:
            bp_name = rule.endpoint.split(".")[0]
            blueprint_routes[bp_name] = blueprint_routes.get(bp_name, 0) + 1

    total_routes = len(list(app.url_map.iter_rules()))

    # Configuration status
    log_level = os.getenv("LOG_LEVEL", "INFO")
    log_format = os.getenv("LOG_FORMAT", "json")
    event_store = os.getenv("EVENT_STORE_BACKEND", "csv")
    entra_enabled = os.getenv("ENTRA_ENABLED", "false").lower() == "true"
    catenda_ok = settings.is_catenda_enabled
    dalux_ok = settings.is_dalux_enabled

    def status_color(enabled: bool) -> str:
        return f"{GREEN}Enabled{RESET}" if enabled else f"{DIM}Disabled{RESET}"

    startup_ms = int((time.time() - start_time) * 1000)

    # Only print banner once (skip in reloader parent process)
    is_reloader_process = os.getenv("WERKZEUG_RUN_MAIN") == "true"
    if is_reloader_process or not app.config["DEBUG"]:
        print(f"\n{DIM}{'─' * 50}{RESET}")
        print(f"{BOLD}  Unified Timeline API{RESET}  {DIM}{git_commit}{RESET}")
        print(f"{DIM}{'─' * 50}{RESET}")
        print(f"\n  {DIM}Server{RESET}       {CYAN}http://localhost:{port}{RESET}")
        print(
            f"  {DIM}Environment{RESET}  {'Development' if app.config['DEBUG'] else 'Production'}"
        )
        print(f"  {DIM}Log level{RESET}    {log_level} {DIM}({log_format}){RESET}")
        print(f"  {DIM}Data store{RESET}   {event_store}")
        print(
            f"  {DIM}Auth{RESET}         {GREEN}Entra ID{RESET}"
            if entra_enabled
            else f"  {DIM}Auth{RESET}         {DIM}Disabled{RESET}"
        )
        print(f"\n  {DIM}Integrations{RESET}")
        print(f"    Catenda    {status_color(catenda_ok)}")
        print(f"    Dalux      {status_color(dalux_ok)}")
        print(f"\n  {DIM}Endpoints{RESET}    {total_routes} routes")
        print(f"  {DIM}Docs{RESET}         GET /api/health, /api/routes")
        print(f"  {DIM}Ready in{RESET}     {startup_ms}ms")

        # Show startup warnings
        if warnings:
            print(f"\n  {YELLOW}Advarsler:{RESET}")
            for warn in warnings:
                print(f"    {YELLOW}!{RESET} {warn}")

    print(f"{DIM}{'─' * 50}{RESET}\n")

    # Set server start time for uptime tracking (both global and in app.config)
    SERVER_START_TIME = time.time()
    app.config["SERVER_START_TIME"] = SERVER_START_TIME

    # Detect if running in cloud environment
    is_cloud = any(
        [
            os.getenv("RENDER"),  # Render
            os.getenv("WEBSITE_HOSTNAME"),  # Azure App Service
            os.getenv("DYNO"),  # Heroku
            os.getenv("GAE_ENV"),  # Google App Engine
            os.getenv("AWS_EXECUTION_ENV"),  # AWS
        ]
    )

    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"

    if debug_mode and is_cloud:
        RED = "\033[31m"
        logger.warning(
            f"{RED}ADVARSEL: debug=True i sky-miljø! Sett FLASK_DEBUG=false{RESET}"
        )

    app.run(host="0.0.0.0", port=port, debug=debug_mode)
