"""
Catenda Custom Fields Mixin
===========================

Custom field management methods for Catenda API client.
"""

import logging
from typing import TYPE_CHECKING, Any

import requests

if TYPE_CHECKING:
    from ..base import CatendaClientBase

# Default timeout for HTTP requests (seconds)
DEFAULT_TIMEOUT = 30

logger = logging.getLogger(__name__)


class CustomFieldsMixin:
    """Custom field management methods."""

    # Type hints for attributes from CatendaClientBase
    base_url: str
    topic_board_id: str | None
    project_id: str | None

    def get_headers(self: "CatendaClientBase") -> dict[str, str]: ...
    def get_topic_board_with_custom_fields(
        self: "CatendaClientBase",
        board_id: str | None = None,
        project_id: str | None = None,
    ) -> dict | None: ...

    # ------------------------------------------
    # Board-level Custom Field Management
    # ------------------------------------------

    def _update_custom_fields(
        self: "CatendaClientBase", board_id: str, project_id: str, payload: dict
    ) -> dict | None:
        """
        Internal helper method to update custom fields on a board.

        Args:
            board_id: Topic board ID
            project_id: Catenda project ID
            payload: Request body with custom field operations

        Returns:
            Updated board or None
        """
        url = f"{self.base_url}/v2/projects/{project_id}/issues/boards/{board_id}"
        params = {"include": "customFields,customFieldInstances"}

        try:
            response = requests.patch(
                url,
                headers=self.get_headers(),
                json=payload,
                params=params,
                timeout=DEFAULT_TIMEOUT,
            )
            response.raise_for_status()

            board = response.json()
            return board

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved oppdatering av custom fields: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return None

    def add_custom_field_to_board(
        self: "CatendaClientBase",
        custom_field_id: str,
        board_id: str | None = None,
        project_id: str | None = None,
        required: bool = False,
        default_value: Any | None = None,
        disabled: bool = False,
    ) -> dict | None:
        """
        Add an existing custom field to a topic board.

        Args:
            custom_field_id: ID of custom field to add
            board_id: Topic board ID
            project_id: Catenda project ID
            required: Whether the field is required
            default_value: Default value for the field
            disabled: Whether the field should be disabled

        Returns:
            Updated board or None
        """
        board_id = board_id or self.topic_board_id
        project_id = project_id or self.project_id

        if not board_id or not project_id:
            logger.error("board_id og project_id er pakrevd")
            return None

        logger.info(f"Legger til custom field {custom_field_id} pa board...")

        field_config: dict[str, Any] = {
            "id": custom_field_id,
            "required": required,
            "disabled": disabled,
        }
        if default_value is not None:
            field_config["defaultValue"] = default_value

        payload = {"customFieldsToAdd": [field_config]}
        result = self._update_custom_fields(board_id, project_id, payload)

        if result:
            logger.info("Custom field lagt til")
        return result

    def modify_custom_field_on_board(
        self: "CatendaClientBase",
        custom_field_id: str,
        board_id: str | None = None,
        project_id: str | None = None,
        required: bool | None = None,
        default_value: Any | None = None,
        disabled: bool | None = None,
    ) -> dict | None:
        """
        Modify settings for a custom field on a board.

        Args:
            custom_field_id: ID of custom field
            board_id: Topic board ID
            project_id: Catenda project ID
            required: Whether the field is required (None = don't change)
            default_value: Default value (None = don't change)
            disabled: Whether the field should be disabled (None = don't change)

        Returns:
            Updated board or None
        """
        board_id = board_id or self.topic_board_id
        project_id = project_id or self.project_id

        if not board_id or not project_id:
            logger.error("board_id og project_id er pakrevd")
            return None

        logger.info(f"Oppdaterer custom field {custom_field_id}...")

        field_config: dict[str, Any] = {"id": custom_field_id}
        if required is not None:
            field_config["required"] = required
        if default_value is not None:
            field_config["defaultValue"] = default_value
        if disabled is not None:
            field_config["disabled"] = disabled

        payload = {"customFieldsToModify": [field_config]}
        result = self._update_custom_fields(board_id, project_id, payload)

        if result:
            logger.info("Custom field oppdatert")
        return result

    def disable_custom_field_on_board(
        self: "CatendaClientBase",
        custom_field_id: str,
        board_id: str | None = None,
        project_id: str | None = None,
    ) -> dict | None:
        """
        Disable a custom field on a board.

        Args:
            custom_field_id: ID of custom field
            board_id: Topic board ID
            project_id: Catenda project ID

        Returns:
            Updated board or None
        """
        board_id = board_id or self.topic_board_id
        project_id = project_id or self.project_id

        if not board_id or not project_id:
            logger.error("board_id og project_id er pakrevd")
            return None

        logger.info(f"Deaktiverer custom field {custom_field_id}...")

        payload = {"customFieldsToDisable": [{"id": custom_field_id}]}
        result = self._update_custom_fields(board_id, project_id, payload)

        if result:
            logger.info("Custom field deaktivert")
        return result

    def restore_custom_field_on_board(
        self: "CatendaClientBase",
        custom_field_id: str,
        board_id: str | None = None,
        project_id: str | None = None,
    ) -> dict | None:
        """
        Restore a disabled custom field on a board.

        Args:
            custom_field_id: ID of custom field
            board_id: Topic board ID
            project_id: Catenda project ID

        Returns:
            Updated board or None
        """
        board_id = board_id or self.topic_board_id
        project_id = project_id or self.project_id

        if not board_id or not project_id:
            logger.error("board_id og project_id er pakrevd")
            return None

        logger.info(f"Gjenoppretter custom field {custom_field_id}...")

        payload = {"customFieldstoRestore": [{"id": custom_field_id}]}
        result = self._update_custom_fields(board_id, project_id, payload)

        if result:
            logger.info("Custom field gjenopprettet")
        return result

    def delete_custom_field_from_board(
        self: "CatendaClientBase",
        custom_field_id: str,
        board_id: str | None = None,
        project_id: str | None = None,
    ) -> dict | None:
        """
        Remove a custom field from a board.

        Args:
            custom_field_id: ID of custom field
            board_id: Topic board ID
            project_id: Catenda project ID

        Returns:
            Updated board or None
        """
        board_id = board_id or self.topic_board_id
        project_id = project_id or self.project_id

        if not board_id or not project_id:
            logger.error("board_id og project_id er pakrevd")
            return None

        logger.info(f"Fjerner custom field {custom_field_id} fra board...")

        payload = {"customFieldsToDelete": [{"id": custom_field_id}]}
        result = self._update_custom_fields(board_id, project_id, payload)

        if result:
            logger.info("Custom field fjernet")
        return result

    def list_available_custom_fields(
        self: "CatendaClientBase",
        board_id: str | None = None,
        project_id: str | None = None,
    ) -> list[dict]:
        """
        List all available custom fields (both active and inactive on the board).

        Args:
            board_id: Topic board ID
            project_id: Catenda project ID

        Returns:
            List of custom fields
        """
        board = self.get_topic_board_with_custom_fields(board_id, project_id)
        if not board:
            return []

        return board.get("customFields", [])

    # ------------------------------------------
    # Project-level Custom Fields (v2 API)
    # ------------------------------------------

    def list_project_custom_fields(
        self: "CatendaClientBase", project_id: str | None = None
    ) -> list[dict]:
        """
        List all custom fields defined at project level.

        Args:
            project_id: Catenda project ID

        Returns:
            List of custom fields
        """
        project_id = project_id or self.project_id
        if not project_id:
            logger.error("project_id er pakrevd")
            return []

        logger.info(f"Henter custom fields for prosjekt {project_id}...")
        url = f"{self.base_url}/v2/projects/{project_id}/custom-fields"

        try:
            response = requests.get(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            fields = response.json()
            logger.info(f"Fant {len(fields)} custom field(s)")
            return fields

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av custom fields: {e}")
            return []

    def create_project_custom_field(
        self: "CatendaClientBase",
        name: str,
        field_type: str = "text",
        description: str | None = None,
        project_id: str | None = None,
    ) -> dict | None:
        """
        Create a new custom field at project level.

        Args:
            name: Name of custom field
            field_type: Type ('text', 'integer', 'double', 'enumeration')
            description: Description (optional)
            project_id: Catenda project ID

        Returns:
            Created custom field or None
        """
        project_id = project_id or self.project_id
        if not project_id:
            logger.error("project_id er pakrevd")
            return None

        logger.info(f"Oppretter custom field '{name}'...")
        url = f"{self.base_url}/v2/projects/{project_id}/custom-fields"

        payload: dict[str, Any] = {"name": name, "type": field_type}
        if description:
            payload["description"] = description

        try:
            response = requests.post(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            field = response.json()
            logger.info(
                f"Opprettet custom field: {field.get('name')} (ID: {field.get('id')})"
            )
            return field

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved opprettelse av custom field: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return None

    def get_project_custom_field(
        self: "CatendaClientBase", custom_field_id: str, project_id: str | None = None
    ) -> dict | None:
        """
        Get a single custom field from project level.

        Args:
            custom_field_id: ID of custom field
            project_id: Catenda project ID

        Returns:
            Custom field or None
        """
        project_id = project_id or self.project_id
        if not project_id:
            logger.error("project_id er pakrevd")
            return None

        url = (
            f"{self.base_url}/v2/projects/{project_id}/custom-fields/{custom_field_id}"
        )

        try:
            response = requests.get(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av custom field: {e}")
            return None

    def update_project_custom_field(
        self: "CatendaClientBase",
        custom_field_id: str,
        name: str | None = None,
        description: str | None = None,
        archived: bool | None = None,
        project_id: str | None = None,
    ) -> dict | None:
        """
        Update a custom field at project level.

        Args:
            custom_field_id: ID of custom field
            name: New name (optional)
            description: New description (optional)
            archived: Archive/restore (optional)
            project_id: Catenda project ID

        Returns:
            Updated custom field or None
        """
        project_id = project_id or self.project_id
        if not project_id:
            logger.error("project_id er pakrevd")
            return None

        logger.info(f"Oppdaterer custom field {custom_field_id}...")
        url = (
            f"{self.base_url}/v2/projects/{project_id}/custom-fields/{custom_field_id}"
        )

        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if description is not None:
            payload["description"] = description
        if archived is not None:
            payload["archived"] = archived

        try:
            response = requests.patch(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            field = response.json()
            logger.info(f"Oppdatert custom field: {field.get('name')}")
            return field

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved oppdatering av custom field: {e}")
            return None

    def add_enumeration_items(
        self: "CatendaClientBase",
        custom_field_id: str,
        items: list[dict],
        project_id: str | None = None,
    ) -> dict | None:
        """
        Add enumeration items to a custom field.

        Args:
            custom_field_id: ID of custom field
            items: List of items [{"name": "Item 1"}, {"name": "Item 2"}]
            project_id: Catenda project ID

        Returns:
            Updated custom field or None
        """
        project_id = project_id or self.project_id
        if not project_id:
            logger.error("project_id er pakrevd")
            return None

        logger.info(f"Legger til {len(items)} enumeration items...")
        url = (
            f"{self.base_url}/v2/projects/{project_id}/custom-fields/{custom_field_id}"
        )

        payload = {"enumerationItemsToAdd": items}

        try:
            response = requests.patch(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            field = response.json()
            logger.info("Enumeration items lagt til")
            return field

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved tillegg av enumeration items: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return None

    # ------------------------------------------
    # Topic Board Statuses
    # ------------------------------------------

    def list_statuses(
        self: "CatendaClientBase",
        board_id: str | None = None,
        include_unlinked: bool = False,
    ) -> list[dict]:
        """
        List statuses for a topic board.

        Args:
            board_id: Topic board ID (uses self.topic_board_id if not specified)
            include_unlinked: Include unlinked statuses

        Returns:
            List of statuses
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID angitt")
            return []

        logger.info(f"Henter statuser for board {board_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/statuses"
        params = {"includeUnlinked": str(include_unlinked).lower()}

        try:
            response = requests.get(
                url, headers=self.get_headers(), params=params, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            statuses = response.json()
            logger.info(f"Fant {len(statuses)} status(er)")
            return statuses

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av statuser: {e}")
            return []

    def create_status(
        self: "CatendaClientBase",
        name: str,
        color: str | None = None,
        status_type: str = "open",
        board_id: str | None = None,
    ) -> dict | None:
        """
        Create a new status for topic board.

        Args:
            name: Status name
            color: Color (hex, e.g. '#FF0000')
            status_type: Type ('open', 'closed', 'candidate')
            board_id: Topic board ID

        Returns:
            Created status or None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID angitt")
            return None

        logger.info(f"Oppretter status '{name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/statuses"

        # Build payload - color is optional according to API spec
        payload: dict[str, Any] = {"name": name, "type": status_type}

        # Add color if specified, otherwise let API choose default
        if color:
            # Ensure uppercase hex color with #
            final_color = color.upper()
            if not final_color.startswith("#"):
                final_color = "#" + final_color
            payload["color"] = final_color
        else:
            # Use default colors from API documentation
            default_colors = {
                "open": "#DD7E6B",  # From API docs
                "closed": "#57BB8A",  # Green
                "candidate": "#FFD666",  # Yellow
            }
            payload["color"] = default_colors.get(status_type, "#DD7E6B")

        logger.debug(f"   Create status payload: {payload}")

        try:
            response = requests.post(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            status = response.json()
            logger.info(f"Opprettet status: {status.get('name')}")
            return status

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved opprettelse av status: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return None

    def update_status(
        self: "CatendaClientBase",
        existing_name: str,
        new_name: str | None = None,
        color: str | None = None,
        status_type: str | None = None,
        board_id: str | None = None,
    ) -> dict | None:
        """
        Update a status for topic board.

        Args:
            existing_name: Existing status name
            new_name: New name (optional)
            color: New color (optional)
            status_type: New type (optional)
            board_id: Topic board ID

        Returns:
            Updated status or None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID angitt")
            return None

        logger.info(f"Oppdaterer status '{existing_name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/statuses"

        payload: dict[str, Any] = {"existingName": existing_name}
        if new_name:
            payload["name"] = new_name
        if color:
            payload["color"] = color
        if status_type:
            payload["type"] = status_type

        try:
            response = requests.put(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            status = response.json()
            logger.info(f"Oppdatert status: {status.get('name')}")
            return status

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved oppdatering av status: {e}")
            return None

    def delete_status(
        self: "CatendaClientBase", name: str, board_id: str | None = None
    ) -> bool:
        """
        Delete a status from topic board.

        Args:
            name: Name of status to delete
            board_id: Topic board ID

        Returns:
            True if successful
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID angitt")
            return False

        logger.info(f"Sletter status '{name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/statuses"

        payload = {"name": name}

        try:
            response = requests.delete(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            logger.info(f"Slettet status: {name}")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved sletting av status: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return False

    # ------------------------------------------
    # Topic Board Types
    # ------------------------------------------

    def list_types(
        self: "CatendaClientBase",
        board_id: str | None = None,
        include_unlinked: bool = False,
    ) -> list[dict]:
        """
        List types for a topic board.

        Args:
            board_id: Topic board ID (uses self.topic_board_id if not specified)
            include_unlinked: Include unlinked types

        Returns:
            List of types
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID angitt")
            return []

        logger.info(f"Henter typer for board {board_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/types"
        params = {"includeUnlinked": str(include_unlinked).lower()}

        try:
            response = requests.get(
                url, headers=self.get_headers(), params=params, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            types = response.json()
            logger.info(f"Fant {len(types)} type(r)")
            return types

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av typer: {e}")
            return []

    def create_type(
        self: "CatendaClientBase",
        name: str,
        color: str | None = None,
        board_id: str | None = None,
    ) -> dict | None:
        """
        Create a new type for topic board.

        Args:
            name: Type name
            color: Color (hex, e.g. '#3D85C6')
            board_id: Topic board ID

        Returns:
            Created type or None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID angitt")
            return None

        logger.info(f"Oppretter type '{name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/types"

        # Default color if not specified (uppercase hex as API requires)
        default_color = "#3D85C6"  # Blue

        # Ensure uppercase hex color
        final_color = (color or default_color).upper()

        payload = {"name": name, "color": final_color}

        try:
            response = requests.post(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            topic_type = response.json()
            logger.info(f"Opprettet type: {topic_type.get('name')}")
            return topic_type

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved opprettelse av type: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return None

    def update_type(
        self: "CatendaClientBase",
        existing_name: str,
        new_name: str | None = None,
        color: str | None = None,
        board_id: str | None = None,
    ) -> dict | None:
        """
        Update a type for topic board.

        Args:
            existing_name: Existing type name
            new_name: New name (optional)
            color: New color (optional)
            board_id: Topic board ID

        Returns:
            Updated type or None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID angitt")
            return None

        logger.info(f"Oppdaterer type '{existing_name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/types"

        payload: dict[str, Any] = {"existingName": existing_name}
        if new_name:
            payload["name"] = new_name
        if color:
            payload["color"] = color

        try:
            response = requests.put(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            topic_type = response.json()
            logger.info(f"Oppdatert type: {topic_type.get('name')}")
            return topic_type

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved oppdatering av type: {e}")
            return None

    def delete_type(
        self: "CatendaClientBase", name: str, board_id: str | None = None
    ) -> bool:
        """
        Delete a type from topic board.

        Args:
            name: Name of type to delete
            board_id: Topic board ID

        Returns:
            True if successful
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("Ingen topic board ID angitt")
            return False

        logger.info(f"Sletter type '{name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/types"

        payload = {"name": name}

        try:
            response = requests.delete(
                url, headers=self.get_headers(), json=payload, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            logger.info(f"Slettet type: {name}")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved sletting av type: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return False
