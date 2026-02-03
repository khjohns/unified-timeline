"""
Catenda Relations Mixin
=======================

Topic relation management methods for Catenda API client.
"""

import logging
from typing import TYPE_CHECKING

import requests

if TYPE_CHECKING:
    from ..base import CatendaClientBase

# Default timeout for HTTP requests (seconds)
DEFAULT_TIMEOUT = 30

logger = logging.getLogger(__name__)


class RelationsMixin:
    """Topic relation management methods."""

    # Type hints for attributes from CatendaClientBase
    base_url: str
    topic_board_id: str | None

    def get_headers(self: "CatendaClientBase") -> dict[str, str]: ...

    def list_related_topics(
        self: "CatendaClientBase", topic_id: str, include_project_topics: bool = True
    ) -> list[dict]:
        """
        List all related topics for a given topic.

        Args:
            topic_id: Topic GUID
            include_project_topics: Include topics from other topic boards in same project

        Returns:
            List of related topics
        """
        if not self.topic_board_id:
            logger.error("Ingen topic board valgt")
            return []

        logger.info(f"Henter relaterte topics for {topic_id}...")

        url = (
            f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
            f"/topics/{topic_id}/related_topics"
        )

        params = {}
        if include_project_topics:
            params["includeBimsyncProjectTopics"] = "true"

        try:
            response = requests.get(
                url, headers=self.get_headers(), params=params, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            related = response.json()
            logger.info(f"Fant {len(related)} relatert(e) topic(s)")

            for rel in related:
                logger.info(
                    f"  - {rel.get('related_topic_guid')} (Board: {rel.get('bimsync_issue_board_ref')})"
                )

            return related

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av relaterte topics: {e}")
            return []

    def create_topic_relations(
        self: "CatendaClientBase", topic_id: str, related_topic_guids: list[str]
    ) -> bool:
        """
        Create relations from a topic to other topics.

        Used to link e.g. an acceleration case to time extension cases.

        Args:
            topic_id: Topic GUID (e.g. the acceleration case)
            related_topic_guids: List of GUIDs for topics to relate to

        Returns:
            True if successful
        """
        if not self.topic_board_id:
            logger.error("Ingen topic board valgt")
            return False

        logger.info(
            f"Oppretter {len(related_topic_guids)} relasjon(er) for topic {topic_id}..."
        )

        url = (
            f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
            f"/topics/{topic_id}/related_topics"
        )

        # Payload is a list of objects
        payload = [{"related_topic_guid": guid} for guid in related_topic_guids]

        try:
            response = requests.put(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            logger.info("Relasjoner opprettet!")
            for guid in related_topic_guids:
                logger.info(f"  - {topic_id} -> {guid}")

            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved oppretting av topic-relasjoner: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return False

    def delete_topic_relation(
        self: "CatendaClientBase", topic_id: str, related_topic_id: str
    ) -> bool:
        """
        Delete a relation between two topics.

        Args:
            topic_id: Topic GUID
            related_topic_id: GUID of related topic to remove

        Returns:
            True if successful
        """
        if not self.topic_board_id:
            logger.error("Ingen topic board valgt")
            return False

        logger.info(f"Sletter relasjon {topic_id} -> {related_topic_id}...")

        url = (
            f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
            f"/topics/{topic_id}/related_topics/{related_topic_id}"
        )

        try:
            response = requests.delete(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            logger.info("Relasjon slettet")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved sletting av relasjon: {e}")
            return False
