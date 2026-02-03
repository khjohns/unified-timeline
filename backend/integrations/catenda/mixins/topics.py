"""
Catenda Topics Mixin
====================

BCF topic management methods for Catenda API client.
"""

import logging
from typing import TYPE_CHECKING

import requests

if TYPE_CHECKING:
    from ..base import CatendaClientBase

logger = logging.getLogger(__name__)


class TopicsMixin:
    """BCF topic management methods."""

    # Type hints for attributes from CatendaClientBase
    base_url: str
    topic_board_id: str | None
    test_topic_id: str | None

    if TYPE_CHECKING:

        def get_headers(self: "CatendaClientBase") -> dict[str, str]: ...
        def _safe_request(
            self: "CatendaClientBase",
            method: str,
            url: str,
            error_message: str = "API request failed",
            **kwargs,
        ) -> requests.Response | None: ...

    def list_topics(
        self: "CatendaClientBase", limit: int | None = None, fetch_all: bool = False
    ) -> list[dict]:
        """
        List topics in selected topic board.

        Args:
            limit: Max number of topics to return (None = API default 100)
            fetch_all: If True, fetch ALL topics with pagination (ignores limit)

        Returns:
            List of topics
        """
        if not self.topic_board_id:
            logger.error("Ingen topic board valgt")
            return []

        logger.info(f"Henter topics fra board {self.topic_board_id}...")

        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics"

        if fetch_all:
            # Fetch all topics with pagination
            all_topics: list[dict] = []
            page_size = 500  # Max allowed by API
            skip = 0

            while True:
                params = {"$top": str(page_size), "$skip": str(skip)}
                response = self._safe_request(
                    "GET", url, "Feil ved henting av topics", params=params
                )
                if response is None:
                    return all_topics  # Return what we have so far

                batch = response.json()
                if not batch:
                    break

                all_topics.extend(batch)
                logger.info(f"  Hentet {len(batch)} topics (totalt: {len(all_topics)})")

                if len(batch) < page_size:
                    break  # Last page

                skip += page_size

            topics = all_topics
        else:
            # Standard fetch with optional limit
            params = {}
            if limit:
                params["$top"] = str(limit)

            response = self._safe_request(
                "GET",
                url,
                "Feil ved henting av topics",
                params=params if params else None,
            )
            if response is None:
                return []
            topics = response.json()

        logger.info(f"Fant {len(topics)} topic(s)")

        for topic in topics[:10]:  # Log only first 10
            logger.info(
                f"  - {topic['title']} (ID: {topic['guid']}, Status: {topic.get('topic_status', 'N/A')})"
            )
        if len(topics) > 10:
            logger.info(f"  ... og {len(topics) - 10} til")

        return topics

    def select_topic(self: "CatendaClientBase", topic_index: int = 0) -> bool:
        """
        Select a topic for operations.

        Args:
            topic_index: Index of topic to use

        Returns:
            True if successful
        """
        topics = self.list_topics()

        if not topics:
            logger.error("Ingen topics funnet")
            return False

        if topic_index >= len(topics):
            logger.error(f"Ugyldig topic index: {topic_index}")
            return False

        selected = topics[topic_index]
        self.test_topic_id = selected["guid"]

        logger.info(f"Valgte topic: {selected['title']}")
        return True

    def get_topic_details(
        self: "CatendaClientBase", topic_id: str | None = None
    ) -> dict | None:
        """
        Get details for a specific topic.

        Args:
            topic_id: Topic GUID (uses self.test_topic_id if None)

        Returns:
            Topic data or None
        """
        topic_id = topic_id or self.test_topic_id

        if not topic_id:
            logger.error("Ingen topic ID spesifisert")
            return None

        logger.info(f"Henter detaljer for topic {topic_id}...")

        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics/{topic_id}"

        response = self._safe_request("GET", url, "Feil ved henting av topic")
        if response is None:
            return None

        topic = response.json()
        logger.info(f"Topic hentet: {topic['title']}")

        return topic

    def create_topic(
        self: "CatendaClientBase",
        title: str,
        description: str | None = None,
        topic_type: str | None = None,
        topic_status: str | None = None,
    ) -> dict | None:
        """
        Create a new topic in selected topic board.

        Args:
            title: Topic title
            description: Description
            topic_type: Type (e.g. 'Error', 'Request')
            topic_status: Status (e.g. 'Open', 'Closed')

        Returns:
            Topic data or None
        """
        if not self.topic_board_id:
            logger.error("Ingen topic board valgt")
            return None

        logger.info(f"Oppretter ny topic i board {self.topic_board_id}...")

        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics"

        payload: dict = {"title": title}
        if description:
            payload["description"] = description
        if topic_type:
            payload["topic_type"] = topic_type
        if topic_status:
            payload["topic_status"] = topic_status

        response = self._safe_request(
            "POST", url, "Feil ved oppretting av topic", json=payload
        )
        if response is None:
            return None

        topic = response.json()
        logger.info(f"Topic opprettet: {topic['title']} (GUID: {topic['guid']})")

        return topic

    def delete_topic(self: "CatendaClientBase", topic_id: str) -> bool:
        """
        Delete a topic from Catenda.

        Args:
            topic_id: Topic GUID

        Returns:
            True if successful, False otherwise
        """
        if not self.topic_board_id:
            logger.error("Ingen topic board valgt")
            return False

        logger.info(f"Sletter topic {topic_id}...")

        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics/{topic_id}"

        response = self._safe_request("DELETE", url, "Feil ved sletting av topic")
        if response is None:
            return False

        if response.status_code == 204:
            logger.info(f"Topic slettet: {topic_id}")
            return True
        else:
            logger.error(f"Feil ved sletting: {response.status_code}")
            return False

    def update_topic(
        self: "CatendaClientBase",
        topic_guid: str,
        topic_status: str | None = None,
        title: str | None = None,
        description: str | None = None,
    ) -> dict | None:
        """
        Update a topic (status, title, description).

        BCF 3.0 PUT requires 'title' field, so we fetch existing topic first
        and merge updates.

        Args:
            topic_guid: Topic GUID
            topic_status: New status (e.g. 'Under behandling', 'Omforent')
            title: New title (optional)
            description: New description (optional)

        Returns:
            Updated topic data or None on error
        """
        if not self.topic_board_id:
            logger.error("Ingen topic board valgt")
            return None

        if not any([topic_status, title, description]):
            logger.warning("Ingen felter a oppdatere")
            return None

        # BCF 3.0 PUT requires title, so fetch existing topic first
        existing = self.get_topic_details(topic_guid)
        if not existing:
            logger.error(f"Kunne ikke hente eksisterende topic {topic_guid}")
            return None

        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics/{topic_guid}"

        # Build payload with existing values as base, then apply updates
        payload: dict = {
            "title": title or existing.get("title"),
        }
        if topic_status:
            payload["topic_status"] = topic_status
        elif existing.get("topic_status"):
            payload["topic_status"] = existing.get("topic_status")

        if description is not None:
            payload["description"] = description
        elif existing.get("description"):
            payload["description"] = existing.get("description")

        logger.info(f"Oppdaterer topic {topic_guid}...")
        if topic_status:
            logger.info(f"   Status: {topic_status}")

        response = self._safe_request(
            "PUT", url, "Feil ved oppdatering av topic", json=payload
        )
        if response is None:
            return None

        result = response.json()
        logger.info(f"Topic oppdatert: {topic_guid}")
        return result
