"""
Catenda Boards Mixin
====================

Topic board management methods for Catenda API client.
"""

import logging
from typing import TYPE_CHECKING

import requests

if TYPE_CHECKING:
    from ..base import CatendaClientBase

logger = logging.getLogger(__name__)


class BoardsMixin:
    """Topic board management methods."""

    # Type hints for attributes from CatendaClientBase
    base_url: str
    topic_board_id: str | None
    project_id: str | None

    if TYPE_CHECKING:

        def get_headers(self: "CatendaClientBase") -> dict[str, str]: ...
        def _safe_request(
            self: "CatendaClientBase",
            method: str,
            url: str,
            error_message: str = "API request failed",
            **kwargs,
        ) -> requests.Response | None: ...

    def list_topic_boards(self: "CatendaClientBase") -> list[dict]:
        """
        List all available topic boards (BCF projects).

        Returns:
            List of topic boards
        """
        logger.info("Henter topic boards...")

        url = f"{self.base_url}/opencde/bcf/3.0/projects"

        response = self._safe_request("GET", url, "Feil ved henting av topic boards")
        if response is None:
            return []

        boards = response.json()
        logger.info(f"Fant {len(boards)} topic board(s)")

        for board in boards:
            logger.info(f"  - {board['name']} (ID: {board['project_id']})")

        return boards

    def select_topic_board(self: "CatendaClientBase", board_index: int = 0) -> bool:
        """
        Select a topic board for operations.

        Args:
            board_index: Index of board to use (default: 0)

        Returns:
            True if successful
        """
        boards = self.list_topic_boards()

        if not boards:
            logger.error("Ingen topic boards funnet")
            return False

        if board_index >= len(boards):
            logger.error(f"Ugyldig board index: {board_index}")
            return False

        selected = boards[board_index]
        self.topic_board_id = selected["project_id"]

        logger.info(f"Valgte topic board: {selected['name']}")
        return True

    def get_topic_board(
        self: "CatendaClientBase", board_id: str | None = None
    ) -> dict | None:
        """
        Get details for a topic board.

        Args:
            board_id: Topic board ID (uses self.topic_board_id if not specified)

        Returns:
            Board data or None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID angitt")
            return None

        logger.info(f"Henter topic board {board_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}"

        response = self._safe_request("GET", url, "Feil ved henting av topic board")
        if response is None:
            return None

        board = response.json()
        logger.info(f"Hentet board: {board.get('name')}")
        return board

    def create_topic_board(
        self: "CatendaClientBase", name: str, project_id: str | None = None
    ) -> dict | None:
        """
        Create a new topic board.

        Args:
            name: Name of the board
            project_id: Catenda project ID (uses self.project_id if not specified)

        Returns:
            Created board or None
        """
        project_id = project_id or self.project_id
        if not project_id:
            logger.error("Ingen project ID angitt")
            return None

        logger.info(f"Oppretter topic board '{name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects"

        payload = {"name": name, "bimsync_project_id": project_id}

        response = self._safe_request(
            "POST", url, "Feil ved opprettelse av topic board", json=payload
        )
        if response is None:
            return None

        board = response.json()
        logger.info(
            f"Opprettet board: {board.get('name')} (ID: {board.get('project_id')})"
        )
        return board

    def update_topic_board(
        self: "CatendaClientBase", name: str, board_id: str | None = None
    ) -> dict | None:
        """
        Update topic board name.

        Args:
            name: New name
            board_id: Topic board ID (uses self.topic_board_id if not specified)

        Returns:
            Updated board or None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID angitt")
            return None

        logger.info(f"Oppdaterer topic board '{board_id}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}"

        payload = {"name": name}

        response = self._safe_request(
            "PUT", url, "Feil ved oppdatering av topic board", json=payload
        )
        if response is None:
            return None

        board = response.json()
        logger.info(f"Oppdatert board: {board.get('name')}")
        return board

    def get_topic_board_extensions(
        self: "CatendaClientBase", board_id: str | None = None
    ) -> dict | None:
        """
        Get extensions (statuses, types, labels, priorities, users, etc) for a board.

        Args:
            board_id: Topic board ID (uses self.topic_board_id if not specified)

        Returns:
            Extensions data or None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID angitt")
            return None

        logger.info(f"Henter extensions for board {board_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions"

        response = self._safe_request("GET", url, "Feil ved henting av extensions")
        if response is None:
            return None

        extensions = response.json()
        logger.info("Hentet extensions")
        return extensions

    def get_topic_board_with_custom_fields(
        self: "CatendaClientBase",
        board_id: str | None = None,
        project_id: str | None = None,
    ) -> dict | None:
        """
        Get topic board with custom fields (v2 API).

        Args:
            board_id: Topic board ID (uses self.topic_board_id if not specified)
            project_id: Catenda project ID (uses self.project_id if not specified)

        Returns:
            Board data with custom fields or None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID angitt")
            return None

        project_id = project_id or self.project_id
        if not project_id:
            logger.error("Ingen project ID angitt")
            return None

        logger.info("Henter board med custom fields...")
        url = f"{self.base_url}/v2/projects/{project_id}/issues/boards/{board_id}"
        params = {"include": "customFields,customFieldInstances"}

        response = self._safe_request(
            "GET", url, "Feil ved henting av board med custom fields", params=params
        )
        if response is None:
            return None

        board = response.json()
        logger.info(
            f"Hentet board med {len(board.get('customFieldInstances', []))} custom field(s)"
        )
        return board

    def get_topic_board_details(
        self: "CatendaClientBase", topic_board_id: str | None = None
    ) -> dict | None:
        """
        Get details for a specific topic board (BCF project).

        Args:
            topic_board_id: ID for topic board (uses self.topic_board_id if None)

        Returns:
            Topic board data or None
        """
        board_id = topic_board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID spesifisert")
            return None

        logger.info(f"Henter detaljer for topic board {board_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}"

        response = self._safe_request(
            "GET", url, "Feil ved henting av topic board detaljer"
        )
        if response is None:
            return None

        board_data = response.json()
        logger.info(f"Detaljer hentet for board '{board_data['name']}'")
        return board_data
