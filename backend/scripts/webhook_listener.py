#!/usr/bin/env python3
"""
Catenda Webhook Listener - Flask-server for å motta webhooks fra Catenda
Lytter på events og logger/håndterer dem
"""

import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    from flask import Flask, jsonify, request
except ImportError:
    print("❌ Flask ikke installert. Installer med:")
    print("   pip install flask")
    sys.exit(1)

# Konfigurer logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("catenda_webhook_listener.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# Opprett Flask app
app = Flask(__name__)

# Mappe for å lagre mottatte webhooks
WEBHOOK_DATA_DIR = Path("webhook_data")
WEBHOOK_DATA_DIR.mkdir(exist_ok=True)


class WebhookHandler:
    """Håndterer logikk for ulike webhook-events"""

    @staticmethod
    def handle_bcf_issue_created(payload: dict[str, Any]) -> dict[str, Any]:
        """
        Håndter ny BCF issue opprettet (tilsvarer ny sak i Catenda)
        Dette er triggeren for KOE/EO-flyten
        """
        logger.info("🆕 Ny BCF Issue opprettet!")

        # Ekstraher relevant info
        issue_data = payload.get("issue", {})
        project_id = payload.get("project_id")
        board_id = payload.get("board_id")
        topic_id = issue_data.get("guid")
        title = issue_data.get("title")
        description = issue_data.get("description")
        topic_type = issue_data.get("topic_type")
        created_by = issue_data.get("creation_author")

        logger.info(f"   Project: {project_id}")
        logger.info(f"   Board: {board_id}")
        logger.info(f"   Topic ID: {topic_id}")
        logger.info(f"   Tittel: {title}")
        logger.info(f"   Type: {topic_type}")
        logger.info(f"   Opprettet av: {created_by}")

        # Her ville man typisk:
        # 1. Opprette tilsvarende SAK-post i Dataverse
        # 2. Initiere KOE-prosessen
        # 3. Sende varsel til BH

        response = {
            "status": "received",
            "action": "create_sak_in_dataverse",
            "sak_data": {
                "catenda_topic_id": topic_id,
                "catenda_project_id": project_id,
                "catenda_board_id": board_id,
                "tittel": title,
                "beskrivelse": description,
                "opprettet_dato": datetime.utcnow().isoformat(),
                "status": "Ny",
            },
        }

        return response

    @staticmethod
    def handle_bcf_comment_created(payload: dict[str, Any]) -> dict[str, Any]:
        """Håndter ny kommentar på BCF issue"""
        logger.info("💬 Ny kommentar på BCF Issue!")

        comment_data = payload.get("comment", {})
        topic_id = payload.get("topic_guid")
        comment_text = comment_data.get("comment")
        author = comment_data.get("author")

        logger.info(f"   Topic ID: {topic_id}")
        logger.info(f"   Forfatter: {author}")
        logger.info(f"   Kommentar: {comment_text[:100]}...")

        response = {
            "status": "received",
            "action": "log_comment",
            "comment_data": {
                "topic_id": topic_id,
                "author": author,
                "text": comment_text,
                "timestamp": datetime.utcnow().isoformat(),
            },
        }

        return response

    @staticmethod
    def handle_document_uploaded(payload: dict[str, Any]) -> dict[str, Any]:
        """Håndter dokumentopplasting"""
        logger.info("📄 Nytt dokument lastet opp!")

        document_data = payload.get("document", {})
        document_id = document_data.get("id")
        filename = document_data.get("name")
        project_id = payload.get("project_id")

        logger.info(f"   Project: {project_id}")
        logger.info(f"   Dokument ID: {document_id}")
        logger.info(f"   Filnavn: {filename}")

        response = {
            "status": "received",
            "action": "index_document",
            "document_data": {
                "document_id": document_id,
                "filename": filename,
                "project_id": project_id,
                "uploaded_at": datetime.utcnow().isoformat(),
            },
        }

        return response

    @staticmethod
    def handle_topic_status_changed(payload: dict[str, Any]) -> dict[str, Any]:
        """Håndter statusendring på topic"""
        logger.info("🔄 Topic status endret!")

        topic_id = payload.get("topic_guid")
        old_status = payload.get("old_status")
        new_status = payload.get("new_status")

        logger.info(f"   Topic ID: {topic_id}")
        logger.info(f"   Fra: {old_status} → Til: {new_status}")

        response = {
            "status": "received",
            "action": "update_sak_status",
            "status_change": {
                "topic_id": topic_id,
                "old_status": old_status,
                "new_status": new_status,
                "changed_at": datetime.utcnow().isoformat(),
            },
        }

        return response

    @staticmethod
    def handle_generic_event(
        event_type: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Håndter ukjente/generiske events"""
        logger.info(f"ℹ️  Generisk event: {event_type}")

        response = {
            "status": "received",
            "action": "log_event",
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
        }

        return response


@app.route("/webhook/catenda", methods=["POST"])
def catenda_webhook():
    """
    Endepunkt for å motta webhooks fra Catenda
    """
    try:
        # Les payload
        payload = request.get_json()

        if not payload:
            logger.warning("⚠️ Mottok tom payload")
            return jsonify({"error": "Empty payload"}), 400

        # Logg rå payload
        logger.info("=" * 70)
        logger.info("📥 Webhook mottatt fra Catenda")
        logger.info("=" * 70)

        # Ekstraher event type
        event_type = payload.get("event_type") or payload.get("type") or "unknown"
        logger.info(f"Event Type: {event_type}")

        # Lagre rå data til fil
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = WEBHOOK_DATA_DIR / f"{event_type}_{timestamp}.json"
        with open(filename, "w") as f:
            json.dump(payload, f, indent=2)
        logger.info(f"💾 Lagret til: {filename}")

        # Rute til riktig handler basert på event type
        handler = WebhookHandler()

        if event_type in ["bcf.issue.created", "bcf.topic.created"]:
            response_data = handler.handle_bcf_issue_created(payload)

        elif event_type in ["bcf.comment.created"]:
            response_data = handler.handle_bcf_comment_created(payload)

        elif event_type in ["document.uploaded", "library.item.created"]:
            response_data = handler.handle_document_uploaded(payload)

        elif event_type in ["bcf.topic.status_changed", "bcf.issue.status_changed"]:
            response_data = handler.handle_topic_status_changed(payload)

        else:
            response_data = handler.handle_generic_event(event_type, payload)

        logger.info(f"✅ Event håndtert: {response_data.get('action')}")
        logger.info("=" * 70)

        # Returner suksess
        return jsonify(
            {
                "status": "success",
                "received_at": datetime.utcnow().isoformat(),
                "event_type": event_type,
                "response": response_data,
            }
        ), 200

    except Exception as e:
        logger.exception(f"❌ Feil ved håndtering av webhook: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/webhook/test", methods=["GET", "POST"])
def test_webhook():
    """
    Test-endepunkt for å verifisere at serveren kjører
    """
    if request.method == "POST":
        payload = request.get_json() or {}
        logger.info(f"📬 Test webhook mottatt: {payload}")
        return jsonify(
            {
                "status": "test_received",
                "timestamp": datetime.utcnow().isoformat(),
                "payload": payload,
            }
        ), 200
    else:
        return jsonify(
            {
                "status": "running",
                "message": "Catenda Webhook Listener er aktiv",
                "timestamp": datetime.utcnow().isoformat(),
                "endpoints": {"webhook": "/webhook/catenda", "test": "/webhook/test"},
            }
        ), 200


@app.route("/webhook/history", methods=["GET"])
def webhook_history():
    """
    Vis historikk over mottatte webhooks
    """
    try:
        # Les alle webhook-filer
        webhook_files = sorted(WEBHOOK_DATA_DIR.glob("*.json"), reverse=True)

        history = []
        for filepath in webhook_files[:50]:  # Siste 50
            with open(filepath) as f:
                data = json.load(f)
                history.append(
                    {
                        "filename": filepath.name,
                        "event_type": data.get("event_type")
                        or data.get("type")
                        or "unknown",
                        "timestamp": filepath.stem.split("_", 1)[1]
                        if "_" in filepath.stem
                        else "unknown",
                    }
                )

        return jsonify({"count": len(history), "webhooks": history}), 200

    except Exception as e:
        logger.exception(f"❌ Feil ved henting av historikk: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endepunkt"""
    return jsonify(
        {
            "status": "healthy",
            "service": "catenda-webhook-listener",
            "timestamp": datetime.utcnow().isoformat(),
        }
    ), 200


def print_startup_info():
    """Print oppstartsinformasjon"""
    print("=" * 70)
    print("🔔 CATENDA WEBHOOK LISTENER")
    print("=" * 70)
    print()
    print("Serveren starter nå og lytter på:")
    print()
    print("  Webhook endepunkt:  http://localhost:5000/webhook/catenda")
    print("  Test endepunkt:     http://localhost:5000/webhook/test")
    print("  Historikk:          http://localhost:5000/webhook/history")
    print("  Health check:       http://localhost:5000/health")
    print()
    print("For å bruke dette med Catenda:")
    print()
    print("1. Eksponer serveren til internett (f.eks. med ngrok):")
    print("   ngrok http 5000")
    print()
    print("2. Opprett webhook i Catenda med URL fra ngrok:")
    print("   https://your-ngrok-url.ngrok.io/webhook/catenda")
    print()
    print("3. Velg events å lytte på:")
    print("   - bcf.issue.created (nye saker)")
    print("   - bcf.comment.created (nye kommentarer)")
    print("   - document.uploaded (nye dokumenter)")
    print()
    print("Loggfil: catenda_webhook_listener.log")
    print("Webhook data lagres i: ./webhook_data/")
    print()
    print("=" * 70)
    print()


def main():
    """Hovedfunksjon"""

    # Print oppstartsinformasjon
    print_startup_info()

    # Les konfigurasjon
    port = int(os.environ.get("WEBHOOK_PORT", 5000))
    debug = os.environ.get("WEBHOOK_DEBUG", "False").lower() == "true"

    # Start Flask server
    try:
        app.run(host="0.0.0.0", port=port, debug=debug)
    except KeyboardInterrupt:
        print("\n\n👋 Server stoppet av bruker. Ha det!")
    except Exception as e:
        logger.exception(f"❌ Feil ved start av server: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
