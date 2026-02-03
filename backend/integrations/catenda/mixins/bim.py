"""
Catenda BIM Mixin
=================

BIM object extraction methods for Catenda API client.
"""

import logging
from typing import TYPE_CHECKING

import requests

if TYPE_CHECKING:
    from ..base import CatendaClientBase

logger = logging.getLogger(__name__)


class BIMMixin:
    """BIM object extraction methods."""

    # Type hints for attributes from CatendaClientBase
    base_url: str
    topic_board_id: str | None

    if TYPE_CHECKING:

        def get_headers(self: "CatendaClientBase") -> dict[str, str]: ...
        def _safe_request(
            self: "CatendaClientBase",
            method: str,
            url: str,
            error_message: str = "API request failed",
            **kwargs,
        ) -> requests.Response | None: ...
        def get_all_viewpoints(
            self: "CatendaClientBase", topic_id: str
        ) -> list[dict]: ...
        def get_viewpoint_selection(
            self: "CatendaClientBase", topic_id: str, viewpoint_id: str
        ) -> list[dict]: ...

    def get_bim_objects_for_topic(
        self: "CatendaClientBase", topic_id: str
    ) -> list[dict]:
        """
        Complete function: Get all BIM objects linked to a topic.
        Makes extra lookups against the /selection endpoint.

        Returns:
            List of BIM objects with IFC GUIDs and metadata
        """
        # 1. Get all viewpoints
        viewpoints = self.get_all_viewpoints(topic_id)
        if not viewpoints:
            return []

        all_bim_objects = []

        logger.info(
            f"Henter detaljert utvalg (selection) for {len(viewpoints)} viewpoint(s)..."
        )

        # 2. For each viewpoint, get specific selection
        for vp in viewpoints:
            vp_guid = vp["guid"]

            # Get selection via separate API call
            selection = self.get_viewpoint_selection(topic_id, vp_guid)

            if selection:
                logger.info(
                    f"   Fant {len(selection)} objekt(er) i viewpoint {vp_guid}"
                )

                for obj in selection:
                    ifc_guid = obj.get("ifc_guid")
                    if ifc_guid:
                        all_bim_objects.append(
                            {
                                "ifc_guid": ifc_guid,
                                "originating_system": obj.get("originating_system"),
                                "authoring_tool_id": obj.get("authoring_tool_id"),
                                "viewpoint_guid": vp_guid,
                                "source": "selection",
                            }
                        )
            else:
                logger.info(f"   Ingen utvalg i viewpoint {vp_guid}")

        # 3. Remove duplicates (same object can be in multiple viewpoints)
        unique_objects: dict[str, dict] = {}
        for obj in all_bim_objects:
            guid = obj["ifc_guid"]
            if guid not in unique_objects:
                unique_objects[guid] = obj

        result = list(unique_objects.values())
        logger.info(f"Totalt {len(result)} unike BIM-objekt(er) funnet.")

        return result

    def get_product_details_by_guid(
        self: "CatendaClientBase", project_id: str, ifc_guid: str
    ) -> dict | None:
        """
        Get full product information (Psets, Qsets, Materials) for a given IFC GUID.
        """
        logger.info(f"Slar opp produktdata for GUID: {ifc_guid}...")

        # Use 'POST' to search (Query)
        url = f"{self.base_url}/v2/projects/{project_id}/ifc/products"

        # Payload to filter on GlobalId
        # Request to include propertySets, quantitySets and materials in response
        payload = {
            "query": {"attributes.GlobalId": ifc_guid},
            # We can also specify which fields we want (1 = include)
            # If we omit 'fields', we get everything by default.
        }

        response = self._safe_request(
            "POST", url, f"Feil ved produktsok for GUID {ifc_guid}", json=payload
        )
        if response is None:
            return None

        products = response.json()

        if products and len(products) > 0:
            product = products[0]
            logger.info(
                f"Fant produkt: {product.get('attributes', {}).get('Name', 'Uten navn')}"
            )
            logger.info(f"   Type: {product.get('ifcType')}")

            # Log number of property sets for overview
            psets = product.get("propertySets", {})
            logger.info(f"   Property Sets: {len(psets)} stk funnet")

            return product
        else:
            logger.warning(f"Ingen produkter funnet med GUID {ifc_guid}")
            return None
