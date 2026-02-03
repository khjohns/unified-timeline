"""
Catenda Comments Mixin
======================

Comment and viewpoint management methods for Catenda API client.
"""

import json
import logging
from typing import TYPE_CHECKING

import requests

if TYPE_CHECKING:
    from ..base import CatendaClientBase

# Default timeout for HTTP requests (seconds)
DEFAULT_TIMEOUT = 30

logger = logging.getLogger(__name__)


class CommentsMixin:
    """Comment and viewpoint management methods."""

    # Type hints for attributes from CatendaClientBase
    base_url: str
    topic_board_id: str | None

    def get_headers(self: "CatendaClientBase") -> dict[str, str]: ...

    # ==========================================
    # COMMENTS (BCF API)
    # ==========================================

    def create_comment(
        self: "CatendaClientBase", topic_id: str, comment_text: str
    ) -> dict | None:
        """
        Create a comment on a topic.

        Args:
            topic_id: Topic GUID
            comment_text: Comment text

        Returns:
            Comment data
        """
        if not self.topic_board_id:
            logger.error("Ingen topic board valgt")
            return None

        logger.info(f"Oppretter kommentar pa topic {topic_id}...")

        url = (
            f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
            f"/topics/{topic_id}/comments"
        )

        payload = {"comment": comment_text}

        try:
            # Add timeout to prevent hanging (30 seconds total)
            response = requests.post(
                url, headers=self.get_headers(), json=payload, timeout=30
            )
            response.raise_for_status()

            comment = response.json()

            logger.info("Kommentar opprettet!")
            logger.info(f"   Comment GUID: {comment['guid']}")
            logger.info(f"   Forfatter: {comment.get('author', 'N/A')}")

            return comment

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved oppretting av kommentar: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None

    def get_comments(self: "CatendaClientBase", topic_id: str) -> list[dict]:
        """
        Get all comments for a topic.

        Args:
            topic_id: Topic GUID

        Returns:
            List of comments
        """
        if not self.topic_board_id:
            logger.error("Ingen topic board valgt")
            return []

        logger.info(f"Henter kommentarer for topic {topic_id}...")

        url = (
            f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
            f"/topics/{topic_id}/comments"
        )

        try:
            response = requests.get(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            comments = response.json()
            logger.info(f"Fant {len(comments)} kommentar(er)")

            return comments

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av kommentarer: {e}")
            return []

    # ==========================================
    # VIEWPOINTS (BCF API)
    # ==========================================

    def get_all_viewpoints(self: "CatendaClientBase", topic_id: str) -> list[dict]:
        """
        Get ALL viewpoints for a topic (both from comments and directly on topic).

        Returns:
            List of viewpoint objects, each containing components.selection with IFC GUIDs
        """
        if not self.topic_board_id:
            logger.error("Ingen topic board valgt")
            return []

        logger.info(f"Henter viewpoints for topic {topic_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics/{topic_id}/viewpoints"

        try:
            response = requests.get(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()
            viewpoints = response.json()
            logger.info(f"Fant {len(viewpoints)} viewpoint(s).")
            # Log the viewpoints for debugging
            logger.debug(
                f"Raw viewpoints: {json.dumps(viewpoints, indent=2, ensure_ascii=False)}"
            )
            return viewpoints
        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av viewpoints: {e}")
            return []

    def get_viewpoint_details(
        self: "CatendaClientBase", topic_id: str, viewpoint_id: str
    ) -> dict | None:
        """
        Get all details for a single viewpoint.

        Args:
            topic_id: ID for topic the viewpoint belongs to
            viewpoint_id: ID for viewpoint to fetch

        Returns:
            A complete viewpoint object or None
        """
        if not self.topic_board_id:
            logger.error("Ingen topic board valgt")
            return None

        logger.info(f"Henter detaljer for viewpoint {viewpoint_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics/{topic_id}/viewpoints/{viewpoint_id}"

        try:
            response = requests.get(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()
            viewpoint = response.json()
            logger.info(f"Detaljer hentet for viewpoint {viewpoint_id}.")
            logger.debug(
                f"Viewpoint details: {json.dumps(viewpoint, indent=2, ensure_ascii=False)}"
            )
            return viewpoint
        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved henting av viewpoint-detaljer: {e}")
            return None

    def get_viewpoint_selection(
        self: "CatendaClientBase", topic_id: str, viewpoint_id: str
    ) -> list[dict]:
        """
        Get selection (IFC GUIDs) for a specific viewpoint.
        This is necessary because the main viewpoint endpoint doesn't return components.
        """
        if not self.topic_board_id:
            return []

        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics/{topic_id}/viewpoints/{viewpoint_id}/selection"

        try:
            response = requests.get(
                url, headers=self.get_headers(), timeout=DEFAULT_TIMEOUT
            )
            if response.status_code == 404:
                return []
            response.raise_for_status()

            data = response.json()
            # API returns an object: {"selection": [...]}
            return data.get("selection", [])
        except requests.exceptions.RequestException as e:
            logger.error(
                f"Kunne ikke hente selection for viewpoint {viewpoint_id}: {e}"
            )
            return []

    def extract_ifc_guids_from_viewpoints(
        self: "CatendaClientBase", viewpoints: list[dict]
    ) -> list[dict]:
        """
        Extract all IFC GUIDs from a list of viewpoints.

        Returns:
            List of dicts containing:
            - ifc_guid: IfcGloballyUniqueId
            - originating_system: System (e.g. "Revit")
            - viewpoint_guid: Reference to viewpoint
        """
        ifc_objects = []

        for viewpoint in viewpoints:
            viewpoint_guid = viewpoint.get("guid")
            components = viewpoint.get("components", {})

            # Get from selection (selected objects)
            selection = components.get("selection", [])
            for selected_obj in selection:
                ifc_guid = selected_obj.get("ifc_guid")
                if ifc_guid:
                    ifc_objects.append(
                        {
                            "ifc_guid": ifc_guid,
                            "originating_system": selected_obj.get(
                                "originating_system"
                            ),
                            "authoring_tool_id": selected_obj.get("authoring_tool_id"),
                            "viewpoint_guid": viewpoint_guid,
                            "source": "selection",
                        }
                    )

            # Also get from coloring (colored objects)
            coloring = components.get("coloring", [])
            for color_group in coloring:
                for component in color_group.get("components", []):
                    ifc_guid = component.get("ifc_guid")
                    if ifc_guid:
                        ifc_objects.append(
                            {
                                "ifc_guid": ifc_guid,
                                "originating_system": component.get(
                                    "originating_system"
                                ),
                                "authoring_tool_id": component.get("authoring_tool_id"),
                                "viewpoint_guid": viewpoint_guid,
                                "source": "coloring",
                                "color": color_group.get("color"),
                            }
                        )

            # Also get from visibility.exceptions (hidden/shown objects)
            visibility = components.get("visibility", {})
            exceptions = visibility.get("exceptions", [])
            for exception in exceptions:
                ifc_guid = exception.get("ifc_guid")
                if ifc_guid:
                    ifc_objects.append(
                        {
                            "ifc_guid": ifc_guid,
                            "originating_system": exception.get("originating_system"),
                            "authoring_tool_id": exception.get("authoring_tool_id"),
                            "viewpoint_guid": viewpoint_guid,
                            "source": "visibility_exception",
                        }
                    )

        # Return unique objects (based on ifc_guid)
        unique_objects: dict[str, dict] = {}
        for obj in ifc_objects:
            guid = obj["ifc_guid"]
            if guid not in unique_objects:
                unique_objects[guid] = obj

        logger.info(f"Ekstraherte {len(unique_objects)} unike BIM-objekt(er).")
        return list(unique_objects.values())
