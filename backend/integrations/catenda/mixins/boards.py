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

# Default timeout for HTTP requests (seconds)
DEFAULT_TIMEOUT = 30

logger = logging.getLogger(__name__)


class BoardsMixin:
    """Topic board management methods."""

    # Type hints for attributes from CatendaClientBase
    base_url: str
    topic_board_id: str | None
    project_id: str | None

    def get_headers(self: "CatendaClientBase") -> dict[str, str]: ...

    def list_topic_boards(self: "CatendaClientBase") -> list[dict]:
        """
        List all available topic boards (BCF projects).

        Returns:
            List of topic boards
        """
        logger.info("Henter topic boards...")

        url = f"{self.base_url}/opencde/bcf/3.0/projects"

        try:
            response = requests.get(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            boards = response.json()
            logger.info(f"Fant {len(boards)} topic board(s)")

            for board in boards:
                logger.info(f"  - {board['name']} (ID: {board['project_id']})")

            return boards

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av topic boards: {e}")
            return []

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

        try:
            response = requests.get(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            board = response.json()
            logger.info(f"Hentet board: {board.get('name')}")
            return board

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av topic board: {e}")
            return None

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

        try:
            response = requests.post(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            board = response.json()
            logger.info(
                f"Opprettet board: {board.get('name')} (ID: {board.get('project_id')})"
            )
            return board

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved opprettelse av topic board: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return None

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

        try:
            response = requests.put(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            board = response.json()
            logger.info(f"Oppdatert board: {board.get('name')}")
            return board

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved oppdatering av topic board: {e}")
            return None

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

        try:
            response = requests.get(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            extensions = response.json()
            logger.info("Hentet extensions")
            return extensions

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av extensions: {e}")
            return None

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

        try:
            response = requests.get(
                url, headers=self.get_headers(), params=params, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            board = response.json()
            logger.info(
                f"Hentet board med {len(board.get('customFieldInstances', []))} custom field(s)"
            )
            return board

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av board med custom fields: {e}")
            return None

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

        try:
            response = requests.get(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            board_data = response.json()
            logger.info(f"Detaljer hentet for board '{board_data['name']}'")
            return board_data

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av topic board detaljer: {e}")
            return None
