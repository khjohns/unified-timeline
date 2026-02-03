"""
Catenda Webhooks Mixin
======================

Webhook management methods for Catenda API client.
"""

import logging
from typing import TYPE_CHECKING

import requests

if TYPE_CHECKING:
    from ..base import CatendaClientBase

logger = logging.getLogger(__name__)


class WebhooksMixin:
    """Webhook management methods."""

    # Type hints for attributes from CatendaClientBase
    base_url: str

    if TYPE_CHECKING:

        def get_headers(self: "CatendaClientBase") -> dict[str, str]: ...
        def _safe_request(
            self: "CatendaClientBase",
            method: str,
            url: str,
            error_message: str = "API request failed",
            **kwargs,
        ) -> requests.Response | None: ...

    def create_webhook(
        self: "CatendaClientBase",
        project_id: str,
        target_url: str,
        event: str = "issue.created",
        name: str | None = None,
    ) -> dict | None:
        """
        Create a webhook for the project.

        Args:
            project_id: Catenda project ID
            target_url: URL to receive webhook notifications
            event: Event type (issue.created, issue.modified, issue.deleted)
            name: Webhook name

        Returns:
            Webhook data
        """
        logger.info(f"Oppretter webhook for event: {event}")

        url = f"{self.base_url}/v2/projects/{project_id}/webhooks/user"

        payload: dict = {"event": event, "target_url": target_url}

        if name:
            payload["name"] = name

        response = self._safe_request(
            "POST", url, "Feil ved oppretting av webhook", json=payload
        )
        if response is None:
            return None

        webhook = response.json()

        logger.info("Webhook opprettet!")
        logger.info(f"   Webhook ID: {webhook['id']}")
        logger.info(f"   State: {webhook['state']}")

        return webhook

    def list_webhooks(self: "CatendaClientBase", project_id: str) -> list[dict]:
        """
        List all webhooks for the project.

        Args:
            project_id: Catenda project ID

        Returns:
            List of webhooks
        """
        logger.info(f"Henter webhooks for prosjekt {project_id}...")

        url = f"{self.base_url}/v2/projects/{project_id}/webhooks/user"

        response = self._safe_request("GET", url, "Feil ved henting av webhooks")
        if response is None:
            return []

        webhooks = response.json()
        logger.info(f"Fant {len(webhooks)} webhook(s)")

        for hook in webhooks:
            logger.info(f"  - {hook.get('name', 'Unnamed')} ({hook['event']})")
            logger.info(
                f"    State: {hook['state']}, Failures: {hook.get('failureCount', 0)}"
            )

        return webhooks

    def delete_webhook(
        self: "CatendaClientBase", project_id: str, webhook_id: str
    ) -> bool:
        """
        Delete a webhook.

        Args:
            project_id: Catenda project ID
            webhook_id: ID of webhook to delete

        Returns:
            True if deletion was successful
        """
        logger.info(f"Sletter webhook {webhook_id}...")

        url = f"{self.base_url}/v2/projects/{project_id}/webhooks/user/{webhook_id}"

        response = self._safe_request("DELETE", url, "Feil ved sletting av webhook")
        if response is None:
            return False

        if response.status_code == 204:
            logger.info("Webhook slettet")
            return True
        else:
            logger.warning(f"Uventet statuskode ved sletting: {response.status_code}")
            return False
