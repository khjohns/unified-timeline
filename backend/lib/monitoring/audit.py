"""
Audit Logging Module

Implementerer strukturert audit logging for sikkerhetshendelser og brukeraktiviteter.

Audit logging er kritisk for:
- Security incident response (hvem gjorde hva når)
- Compliance (GDPR, ISO 27001, etc.)
- Debugging (trace user actions)
- Anomaly detection (uvanlige mønstre)

Event Types:
- auth: Autentisering (login, token validation)
- access: Tilgangskontroll (read, denied access)
- modify: Dataendringer (create, update, delete)
- webhook: Webhook events fra eksterne systemer
- security: Sikkerhetshendelser (CSRF fail, rate limit, injection attempts)

Log Format:
- JSON Lines (newline-delimited JSON)
- Ett JSON-objekt per linje
- Enkel å parse med `jq`, `grep`, eller log aggregering tools

Referanser:
- OWASP Logging Cheat Sheet
- NIST SP 800-92 (Guide to Computer Security Log Management)
- ISO 27001 A.12.4 (Logging and monitoring)

Forfatter: Claude
Dato: 2025-11-24
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from flask import g, request


class AuditLogger:
    """
    Audit logger for sikkerhetshendelser.

    Logger til JSON Lines format (en JSON-object per linje).
    Dette gjør det enkelt å:
    - Parse logs med `jq`
    - Import til log aggregering tools (ELK, Splunk, etc.)
    - Søke med grep

    Example log entry:
        {
            "timestamp": "2025-11-24T10:15:30.123Z",
            "event_type": "access",
            "user": "te@example.com",
            "resource": "case:ABC123",
            "action": "read",
            "result": "success",
            "ip": "192.168.1.100",
            "user_agent": "Mozilla/5.0...",
            "details": {"project_id": "550e8400..."}
        }
    """

    def __init__(self, log_file: str = "audit.log"):
        """
        Initialize audit logger.

        Args:
            log_file: Path til log-fil (relativ til backend/)
        """
        self.log_file = log_file

        # Ensure log file exists and is writable
        self._ensure_log_file()

    def _ensure_log_file(self):
        """Create log file if it doesn't exist."""
        log_path = Path(self.log_file)
        if not log_path.exists():
            log_path.touch()
            print(f"📝 Created audit log: {self.log_file}")

    def log_event(
        self,
        event_type: str,
        user: str,
        resource: str,
        action: str,
        result: str,
        details: dict[str, Any] | None = None,
    ):
        """
        Log en sikkerhetshendelse til audit log.

        Args:
            event_type: Type hendelse
                - "auth": Autentisering (token validation, login)
                - "access": Tilgangskontroll (read, denied)
                - "modify": Dataendring (create, update, delete)
                - "webhook": Webhook event mottatt
                - "security": Sikkerhetshendelse (CSRF fail, injection, rate limit)

            user: Bruker-identifikator
                - Email/username for autentiserte brukere
                - "anonymous" for uautentiserte requests
                - "system" for automatiske prosesser
                - "catenda" for webhook events

            resource: Ressurs som ble aksessert
                - Format: "type:identifier"
                - Examples: "case:ABC123", "project:550e8400", "webhook:catenda"

            action: Handling som ble utført
                - CRUD: "create", "read", "update", "delete"
                - Auth: "login", "logout", "validate_token"
                - Webhook: "received", "processed"
                - Other: "submit", "approve", "reject"

            result: Resultat av handling
                - "success": Operasjon fullført uten feil
                - "denied": Tilgang nektet (403, 401)
                - "error": Teknisk feil oppstod (500, etc.)
                - "blocked": Blokkert av sikkerhetstiltak (CSRF, rate limit)

            details: Ekstra kontekstuell informasjon (optional)
                - project_id, role, status, error_message, etc.
                - Unngå å logge sensitiv data (passwords, tokens)

        Example:
            >>> audit.log_event(
            ...     event_type="access",
            ...     user="te@example.com",
            ...     resource="case:ABC123",
            ...     action="read",
            ...     result="success",
            ...     details={"project_id": "550e8400"}
            ... )
        """
        # Build log entry
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "event_type": event_type,
            "user": user,
            "resource": resource,
            "action": action,
            "result": result,
            "ip": self._get_client_ip(),
            "user_agent": self._get_user_agent(),
            "details": details or {},
        }

        # Write to file (JSON Lines format)
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception as e:
            # Fallback: Print to stderr if file write fails
            print(f"⚠️ Audit log error: {e}", flush=True)
            print(f"   Entry: {json.dumps(entry)}", flush=True)

    def _get_client_ip(self) -> str | None:
        """
        Hent klient IP-adresse fra request.

        Sjekker flere headers for å håndtere proxies/load balancers:
        1. X-Forwarded-For (standard proxy header)
        2. X-Real-IP (nginx)
        3. request.remote_addr (direkte connection)

        Returns:
            str: IP-adresse eller None
        """
        try:
            # Sjekk proxy headers først (for ngrok, nginx, etc.)
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                # X-Forwarded-For kan ha multiple IPs: "client, proxy1, proxy2"
                # Første IP er klient
                return forwarded_for.split(",")[0].strip()

            # Nginx reverse proxy
            real_ip = request.headers.get("X-Real-IP")
            if real_ip:
                return real_ip

            # Direct connection
            return request.remote_addr

        except Exception:
            return None

    def _get_user_agent(self) -> str | None:
        """
        Hent User-Agent fra request.

        User-Agent identifiserer klient (browser, curl, etc.)
        og er nyttig for:
        - Identifisere automatiserte angrep (bots)
        - Debug (hvilken browser/versjon?)
        - Analytics

        Returns:
            str: User-Agent string eller None
        """
        try:
            return request.headers.get("User-Agent")
        except Exception:
            return None

    def log_auth_success(self, user: str, details: dict | None = None):
        """Convenience method: Log successful authentication."""
        self.log_event(
            event_type="auth",
            user=user,
            resource="auth:token",
            action="validate",
            result="success",
            details=details,
        )

    def log_auth_failure(self, reason: str, details: dict | None = None):
        """Convenience method: Log failed authentication."""
        self.log_event(
            event_type="auth",
            user="anonymous",
            resource="auth:token",
            action="validate",
            result="denied",
            details={"reason": reason, **(details or {})},
        )

    def log_access_denied(self, user: str, resource: str, reason: str):
        """Convenience method: Log access denied."""
        self.log_event(
            event_type="access",
            user=user,
            resource=resource,
            action="access",
            result="denied",
            details={"reason": reason},
        )

    def log_webhook_received(self, event_type: str, event_id: str):
        """Convenience method: Log webhook received."""
        self.log_event(
            event_type="webhook",
            user="catenda",
            resource="webhook:catenda",
            action="received",
            result="success",
            details={"event_type": event_type, "event_id": event_id},
        )

    def log_security_event(self, threat_type: str, details: dict | None = None):
        """Convenience method: Log security event (CSRF, injection, etc.)."""
        self.log_event(
            event_type="security",
            user=g.get("user", {}).get("email", "anonymous"),
            resource="security",
            action=threat_type,
            result="blocked",
            details=details,
        )


# Global audit logger instance
audit = AuditLogger("audit.log")


# Utility functions for log analysis
def search_audit_log(
    log_file: str = "audit.log",
    event_type: str | None = None,
    user: str | None = None,
    result: str | None = None,
    limit: int = 100,
) -> list:
    """
    Søk i audit log (for debugging/analysis).

    Args:
        log_file: Path til log-fil
        event_type: Filter på event_type (optional)
        user: Filter på user (optional)
        result: Filter på result (optional)
        limit: Maksimalt antall resultater

    Returns:
        List[Dict]: Matching log entries

    Example:
        >>> # Finn alle denied events
        >>> denied = search_audit_log(result="denied")
        >>> for event in denied:
        ...     print(f"{event['user']} denied access to {event['resource']}")
    """
    matches = []

    try:
        with open(log_file, encoding="utf-8") as f:
            for line in f:
                try:
                    entry = json.loads(line)

                    # Apply filters
                    if event_type and entry.get("event_type") != event_type:
                        continue
                    if user and entry.get("user") != user:
                        continue
                    if result and entry.get("result") != result:
                        continue

                    matches.append(entry)

                    if len(matches) >= limit:
                        break

                except json.JSONDecodeError:
                    continue  # Skip malformed lines

    except FileNotFoundError:
        pass  # Log file doesn't exist yet

    return matches


# Helper function for testing
def _test_audit_logging():
    """
    Test audit logging.
    Kjør med: python -c "from audit import _test_audit_logging; _test_audit_logging()"
    """
    import tempfile

    print("Testing audit logging...")

    # Create temp log file
    temp_log = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".log")
    temp_log.close()

    try:
        # Create logger with temp file
        test_audit = AuditLogger(temp_log.name)

        # Log test events
        test_audit.log_event(
            event_type="access",
            user="test@example.com",
            resource="case:TEST123",
            action="read",
            result="success",
            details={"test": True},
        )
        print("✓ Event logged")

        test_audit.log_auth_failure("Invalid token")
        print("✓ Auth failure logged")

        test_audit.log_security_event("csrf_fail", {"detail": "Token missing"})
        print("✓ Security event logged")

        # Search logs
        results = search_audit_log(temp_log.name, result="denied")
        assert len(results) >= 1, "Failed to find logged events"
        print(f"✓ Found {len(results)} denied events")

        print("✅ All audit logging tests passed!")

    finally:
        # Cleanup
        os.unlink(temp_log.name)


if __name__ == "__main__":
    _test_audit_logging()
