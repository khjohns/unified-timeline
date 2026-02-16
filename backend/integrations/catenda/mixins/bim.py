"""
Catenda BIM Mixin
=================

BIM object extraction methods for Catenda API client.
Includes Model API methods for listing models, revisions, and IFC products.
"""

import logging
from typing import TYPE_CHECKING

import requests

if TYPE_CHECKING:
    from ..base import CatendaClientBase

logger = logging.getLogger(__name__)


class BIMMixin:
    """BIM object extraction and Model API methods."""

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

    # =========================================================================
    # Model API — Models & Revisions
    # =========================================================================

    def list_models(
        self: "CatendaClientBase", project_id: str
    ) -> list[dict]:
        """
        List all models in a project.

        Args:
            project_id: Catenda v2 project ID

        Returns:
            List of model dicts with id, name, etc.
        """
        url = f"{self.base_url}/v2/projects/{project_id}/models"
        response = self._safe_request("GET", url, "Feil ved henting av modeller")
        if response is None:
            return []
        return response.json()

    def list_revisions(
        self: "CatendaClientBase",
        project_id: str,
        model_id: str | None = None,
    ) -> list[dict]:
        """
        List model revisions, optionally filtered by model.

        Args:
            project_id: Catenda v2 project ID
            model_id: Optional model ID to filter by

        Returns:
            List of revision dicts
        """
        url = f"{self.base_url}/v2/projects/{project_id}/revisions"
        params = {}
        if model_id:
            params["model"] = model_id
        response = self._safe_request(
            "GET", url, "Feil ved henting av revisjoner", params=params
        )
        if response is None:
            return []
        return response.json()

    # =========================================================================
    # Model API — IFC Products
    # =========================================================================

    def list_ifc_products(
        self: "CatendaClientBase",
        project_id: str,
        model_id: str | None = None,
        revision_id: str | None = None,
        ifc_type: str | None = None,
        page: int | None = None,
        page_size: int | None = None,
    ) -> list[dict]:
        """
        List IFC products (objects) in a project.

        Args:
            project_id: Catenda v2 project ID
            model_id: Optional model filter
            revision_id: Optional revision filter
            ifc_type: Optional IFC type filter (e.g. "IfcWall")
            page: Page number (1-indexed, default 1)
            page_size: Number of items per page (default 100, max 1000)

        Returns:
            List of ifc-product dicts
        """
        url = f"{self.base_url}/v2/projects/{project_id}/ifc/products"
        params: dict = {}
        if model_id:
            params["model"] = model_id
        if revision_id:
            params["revision"] = revision_id
        if ifc_type:
            params["ifcType"] = ifc_type
        if page is not None:
            params["page"] = page
        if page_size is not None:
            params["pageSize"] = page_size

        response = self._safe_request(
            "GET", url, "Feil ved henting av IFC-produkter", params=params
        )
        if response is None:
            return []
        return response.json()

    def query_ifc_products(
        self: "CatendaClientBase",
        project_id: str,
        query: dict | None = None,
        fields: dict | None = None,
        model_ids: list[str] | None = None,
        revision_ids: list[str] | None = None,
        page: int | None = None,
        page_size: int | None = None,
    ) -> list[dict]:
        """
        Query IFC products with filtering and field selection.

        Args:
            project_id: Catenda v2 project ID
            query: Query filter object (e.g. {"ifcType": {"$ifcType": "IfcWall"}})
            fields: Field projection (e.g. {"attributes.Name": 1, "ifcType": 1})
            model_ids: Filter by model IDs (latest revision)
            revision_ids: Filter by specific revision IDs
            page: Page number
            page_size: Items per page

        Returns:
            List of ifc-product dicts
        """
        url = f"{self.base_url}/v2/projects/{project_id}/ifc/products"
        params: dict = {}
        if page is not None:
            params["page"] = page
        if page_size is not None:
            params["pageSize"] = page_size

        payload: dict = {}
        if query:
            payload["query"] = query
        if fields:
            payload["fields"] = fields
        if model_ids:
            payload["models"] = model_ids
        if revision_ids:
            payload["revisions"] = revision_ids

        response = self._safe_request(
            "POST",
            url,
            "Feil ved query av IFC-produkter",
            params=params,
            json=payload,
        )
        if response is None:
            return []
        return response.json()

    def get_ifc_type_summary(
        self: "CatendaClientBase",
        project_id: str,
        model_id: str | None = None,
        revision_id: str | None = None,
    ) -> dict:
        """
        Get summary of IFC types and instance counts.

        Args:
            project_id: Catenda v2 project ID
            model_id: Optional model filter
            revision_id: Optional revision filter

        Returns:
            Dict mapping IFC type names to counts, e.g. {"IfcWall": 577, "IfcSpace": 865}
        """
        url = f"{self.base_url}/v2/projects/{project_id}/ifc/products/ifctypes"
        params: dict = {}
        if model_id:
            params["model"] = model_id
        if revision_id:
            params["revision"] = revision_id

        response = self._safe_request(
            "GET", url, "Feil ved henting av IFC type-oppsummering", params=params
        )
        if response is None:
            return {}
        return response.json()

    def get_ifc_product(
        self: "CatendaClientBase",
        project_id: str,
        object_id: int | str,
        revision_id: str | None = None,
    ) -> dict | None:
        """
        Get a single IFC product by objectId (full details incl. propertySets, quantitySets, materials).

        Args:
            project_id: Catenda v2 project ID
            object_id: Numeric object ID from list response
            revision_id: Optional revision filter

        Returns:
            Full ifc-product dict or None
        """
        url = f"{self.base_url}/v2/projects/{project_id}/ifc/products/{object_id}"
        params: dict = {}
        if revision_id:
            params["revision"] = revision_id

        response = self._safe_request(
            "GET", url, f"Feil ved henting av produkt {object_id}", params=params
        )
        if response is None:
            return None
        return response.json()

    def get_ifc_product_relations(
        self: "CatendaClientBase",
        project_id: str,
        object_id: int | str,
    ) -> dict:
        """
        Get relations (parent, children, type, systems, zones, groups) for an IFC product.

        Args:
            project_id: Catenda v2 project ID
            object_id: Numeric object ID

        Returns:
            Dict with relation categories, or empty dict on failure
        """
        url = f"{self.base_url}/v2/projects/{project_id}/ifc/products/{object_id}/relations"
        response = self._safe_request(
            "GET", url, f"Feil ved henting av relasjoner for produkt {object_id}"
        )
        if response is None:
            return {}
        return response.json()

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
