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

# Default timeout for HTTP requests (seconds)
DEFAULT_TIMEOUT = 30

logger = logging.getLogger(__name__)


class WebhooksMixin:
    """Webhook management methods."""

    # Type hints for attributes from CatendaClientBase
    base_url: str

    def get_headers(self: "CatendaClientBase") -> dict[str, str]: ...

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

        try:
            response = requests.post(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            webhook = response.json()

            logger.info("Webhook opprettet!")
            logger.info(f"   Webhook ID: {webhook['id']}")
            logger.info(f"   State: {webhook['state']}")

            return webhook

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved oppretting av webhook: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None

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

        try:
            response = requests.get(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            webhooks = response.json()
            logger.info(f"Fant {len(webhooks)} webhook(s)")

            for hook in webhooks:
                logger.info(f"  - {hook.get('name', 'Unnamed')} ({hook['event']})")
                logger.info(
                    f"    State: {hook['state']}, Failures: {hook.get('failureCount', 0)}"
                )

            return webhooks

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av webhooks: {e}")
            return []

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

        try:
            response = requests.delete(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            if response.status_code == 204:
                logger.info("Webhook slettet")
                return True
            else:
                logger.warning(
                    f"Uventet statuskode ved sletting: {response.status_code}"
                )
                return False

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved sletting av webhook: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return False
