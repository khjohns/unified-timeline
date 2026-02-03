"""
Catenda Documents Mixin
=======================

Document and library management methods for Catenda API client.
"""

import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING

import requests

from ..exceptions import CatendaAuthError

if TYPE_CHECKING:
    from ..base import CatendaClientBase

logger = logging.getLogger(__name__)


class DocumentsMixin:
    """Document and library management methods."""

    # Type hints for attributes from CatendaClientBase
    base_url: str
    project_id: str | None
    topic_board_id: str | None
    library_id: str | None

    if TYPE_CHECKING:

        def get_headers(self: "CatendaClientBase") -> dict[str, str]: ...
        def _safe_request(
            self: "CatendaClientBase",
            method: str,
            url: str,
            error_message: str = "API request failed",
            **kwargs,
        ) -> requests.Response | None: ...
        def _make_request(
            self: "CatendaClientBase",
            method: str,
            url: str,
            error_message: str = "API request failed",
            **kwargs,
        ) -> requests.Response: ...

    # ==========================================
    # PROJECT MANAGEMENT (v2 API)
    # ==========================================

    def list_projects(self: "CatendaClientBase") -> list[dict]:
        """
        List all projects the user has access to.

        Returns:
            List of projects
        """
        logger.info("Henter tilgjengelige prosjekter...")
        url = f"{self.base_url}/v2/projects"

        response = self._safe_request("GET", url, "Feil ved listing av prosjekter")
        if response is None:
            return []

        projects = response.json()
        logger.info(f"Fant {len(projects)} prosjekt(er)")
        return projects

    def get_project_details(self: "CatendaClientBase", project_id: str) -> dict | None:
        """
        Get details for a v2 project.

        Args:
            project_id: Catenda project ID

        Returns:
            Project data or None
        """
        logger.info(f"Henter v2-prosjektdetaljer for {project_id}...")
        url = f"{self.base_url}/v2/projects/{project_id}"

        response = self._safe_request(
            "GET", url, "Feil ved henting av prosjektdetaljer"
        )
        if response is None:
            return None

        project_data = response.json()
        logger.info(f"Prosjektdetaljer hentet for '{project_data['name']}'")
        return project_data

    def find_user_in_project(
        self: "CatendaClientBase", project_id: str, email: str
    ) -> dict | None:
        """
        Find a user's details in a project based on email (username).

        Fetches all members in the project and searches for matching email.
        Email must be registered in Catenda for the project.

        Args:
            project_id: Catenda project ID
            email: User's email address (username in Catenda)

        Returns:
            User object with 'id', 'name', 'username', 'company' or None
        """
        logger.info(
            f"Soker etter bruker med e-post '{email}' i prosjekt {project_id}..."
        )

        # Validate email format first
        if not email or "@" not in email:
            logger.warning(f"Ugyldig e-post-format: {email}")
            return None

        url = f"{self.base_url}/v2/projects/{project_id}/members"

        response = self._safe_request("GET", url, "Feil ved sok etter bruker")
        if response is None:
            return None

        members = response.json()
        logger.info(f"Hentet {len(members)} medlemmer fra prosjektet")

        # Search for email (case-insensitive)
        normalized_email = email.lower().strip()
        for member in members:
            # Use the dedicated 'email' field for matching
            if "user" in member and member["user"]:
                user_details = member["user"]
                email_from_api = user_details.get("email")

                if email_from_api:
                    user_email = email_from_api.lower().strip()
                    if user_email == normalized_email:
                        logger.info(
                            f"Fant bruker: {user_details.get('name', 'Ukjent navn')} med rolle '{member.get('role')}'"
                        )
                        return user_details

        logger.warning(f"Fant ikke bruker med e-post '{email}' i prosjektet")
        return None

    # ==========================================
    # LIBRARY MANAGEMENT (v2 API)
    # ==========================================

    def list_libraries(self: "CatendaClientBase", project_id: str) -> list[dict]:
        """
        List all document libraries in a project.

        Args:
            project_id: Catenda project ID (not topic_board_id)

        Returns:
            List of libraries
        """
        logger.info(f"Henter libraries for prosjekt {project_id}...")
        url = f"{self.base_url}/v2/projects/{project_id}/libraries"

        response = self._safe_request("GET", url, "Feil ved henting av libraries")
        if response is None:
            return []

        libraries = response.json()
        logger.info(f"Fant {len(libraries)} library/libraries")

        for lib in libraries:
            logger.info(f"  - {lib['name']} (ID: {lib['id']}, Type: {lib['type']})")

        return libraries

    def select_library(
        self: "CatendaClientBase", project_id: str, library_name: str = "Documents"
    ) -> bool:
        """
        Select a library for operations.

        Args:
            project_id: Catenda project ID
            library_name: Name of library (default: "Documents")

        Returns:
            True if successful
        """
        libraries = self.list_libraries(project_id)

        if not libraries:
            logger.error("Ingen libraries funnet")
            return False

        # Search for library with matching name
        for lib in libraries:
            if lib["name"].lower() == library_name.lower():
                self.library_id = lib["id"]
                logger.info(f"Valgte library: {lib['name']}")
                return True

        # If not found, use first library
        self.library_id = libraries[0]["id"]
        logger.warning(
            f"Library '{library_name}' ikke funnet, bruker: {libraries[0]['name']}"
        )
        return True

    # ==========================================
    # DOCUMENT UPLOAD (v2 API)
    # ==========================================

    def upload_document(
        self: "CatendaClientBase",
        project_id: str,
        file_path: str,
        document_name: str | None = None,
        folder_id: str | None = None,
    ) -> dict | None:
        """
        Upload a document to Catenda document library.

        Args:
            project_id: Catenda project ID
            file_path: Path to file to upload
            document_name: Document name (uses filename if None)
            folder_id: ID of folder to upload to (None = root)

        Returns:
            Library item data including 'id' (library-item-id)

        Raises:
            CatendaAuthError: If access token has expired
        """
        if not self.library_id:
            logger.error("Ingen library valgt")
            return None

        file_path_obj = Path(file_path)

        if not file_path_obj.exists():
            logger.error(f"Fil ikke funnet: {file_path}")
            return None

        document_name = document_name or file_path_obj.name

        logger.info(f"Laster opp dokument: {document_name}")

        url = f"{self.base_url}/v2/projects/{project_id}/libraries/{self.library_id}/items"

        # Read file as binary
        with open(file_path, "rb") as f:
            file_data = f.read()

        # Bimsync-Params header (JSON)
        bimsync_params: dict = {
            "name": document_name,
            "document": {"type": "file", "filename": file_path_obj.name},
            "failOnDocumentExists": False,
        }

        # Add parentId if folder is specified
        if folder_id:
            bimsync_params["parentId"] = folder_id
            logger.info(f"   Laster opp til mappe: {folder_id}")

        headers = self.get_headers()
        headers["Content-Type"] = "application/octet-stream"
        headers["Bimsync-Params"] = json.dumps(bimsync_params)

        # Use _make_request to propagate CatendaAuthError on 401
        try:
            response = self._make_request(
                "POST",
                url,
                "Feil ved opplasting av dokument",
                headers=headers,
                data=file_data,
            )
        except CatendaAuthError:
            # Re-raise auth errors for upstream handling
            raise
        except Exception:
            return None

        result = response.json()

        # API returns a list with one element
        if isinstance(result, list) and len(result) > 0:
            library_item = result[0]
        else:
            library_item = result

        library_item_id = library_item["id"]

        logger.info("Dokument lastet opp!")
        logger.info(f"   library-item-id: {library_item_id}")
        logger.info(f"   Navn: {library_item['name']}")
        logger.info(f"   Type: {library_item['type']}")

        return library_item

    # ==========================================
    # FOLDERS (v2 API)
    # ==========================================

    def list_folders(
        self: "CatendaClientBase",
        project_id: str,
        parent_id: str | None = None,
        include_subfolders: bool = True,
    ) -> list[dict]:
        """
        List folders in the library.

        Args:
            project_id: Catenda project ID
            parent_id: ID of parent folder (None/root = root level)
            include_subfolders: Include subfolders (recursive)

        Returns:
            List of folders
        """
        if not self.library_id:
            logger.error("Ingen library valgt")
            return []

        url = f"{self.base_url}/v2/projects/{project_id}/libraries/{self.library_id}/items"

        params: dict = {
            "scope": "all",  # Include all items (also unpublished)
            "pageSize": "1000",  # Max per page
        }

        # parentId for filtering by level - "root" for root folders
        if parent_id:
            params["parentId"] = parent_id
        else:
            params["parentId"] = "root"  # Explicit root to get root folders

        # Include subfolders recursively only if desired
        if include_subfolders:
            params["subFolders"] = "true"

        response = self._safe_request(
            "GET", url, "Feil ved henting av mapper", params=params
        )
        if response is None:
            return []

        items = response.json()

        # Filter out folders - check both item.type and document.type
        folders = [
            item
            for item in items
            if item.get("type") == "folder"
            or item.get("document", {}).get("type") == "folder"
        ]

        logger.info(f"Totalt {len(items)} items, fant {len(folders)} mappe(r)")
        return folders

    def get_library_item(
        self: "CatendaClientBase", project_id: str, item_id: str
    ) -> dict | None:
        """
        Get a specific library item (document or folder) by ID.

        Args:
            project_id: Catenda project ID
            item_id: Library item ID

        Returns:
            Item data or None
        """
        if not self.library_id:
            logger.error("Ingen library valgt")
            return None

        url = f"{self.base_url}/v2/projects/{project_id}/libraries/{self.library_id}/items/{item_id}"

        response = self._safe_request("GET", url, f"Feil ved henting av item {item_id}")
        if response is None:
            return None

        item = response.json()
        # Check both top-level type and document.type
        doc_type = (
            item.get("document", {}).get("type") if item.get("document") else None
        )
        logger.info(
            f"Hentet item: {item.get('name')} (type={item.get('type')}, document.type={doc_type})"
        )
        return item

    def create_folder(
        self: "CatendaClientBase",
        project_id: str,
        folder_name: str,
        parent_id: str | None = None,
    ) -> dict | None:
        """
        Create a new folder in the library.

        Args:
            project_id: Catenda project ID
            folder_name: Folder name
            parent_id: ID of parent folder (None = root)

        Returns:
            Folder data including 'id'
        """
        if not self.library_id:
            logger.error("Ingen library valgt")
            return None

        url = f"{self.base_url}/v2/projects/{project_id}/libraries/{self.library_id}/items"

        # NB: Catenda API requires document.type, not just type at top level
        payload: dict = {"name": folder_name, "document": {"type": "folder"}}

        if parent_id:
            payload["parentId"] = parent_id

        logger.info(f"Oppretter mappe: {folder_name}")

        response = self._safe_request(
            "POST", url, "Feil ved opprettelse av mappe", json=payload
        )
        if response is None:
            return None

        result = response.json()

        # API can return list or object
        if isinstance(result, list) and len(result) > 0:
            folder = result[0]
        else:
            folder = result

        logger.info(f"Mappe opprettet: {folder['id']}")
        return folder

    def get_or_create_folder(
        self: "CatendaClientBase",
        project_id: str,
        folder_name: str,
        parent_id: str | None = None,
    ) -> str | None:
        """
        Get existing folder or create new.

        Args:
            project_id: Catenda project ID
            folder_name: Folder name
            parent_id: ID of parent folder (None = root)

        Returns:
            Folder ID
        """
        # Check if folder already exists
        folders = self.list_folders(project_id, parent_id)
        for folder in folders:
            if folder.get("name") == folder_name:
                logger.info(f"Fant eksisterende mappe: {folder['id']}")
                return folder["id"]

        # Create new folder
        new_folder = self.create_folder(project_id, folder_name, parent_id)
        if new_folder:
            return new_folder["id"]

        return None

    # ==========================================
    # DOCUMENT REFERENCES (BCF API)
    # ==========================================

    def create_document_reference(
        self: "CatendaClientBase",
        topic_id: str,
        document_guid: str,
        description: str | None = None,
    ) -> dict | None:
        """
        Create a document reference linking a document to a topic.

        Args:
            topic_id: Topic GUID
            document_guid: Document GUID (or library-item-id)
            description: Document description

        Returns:
            Document reference data
        """
        if not self.topic_board_id:
            logger.error("Ingen topic board valgt")
            return None

        logger.info("Oppretter document reference...")
        logger.info(f"   Topic ID: {topic_id}")
        logger.info(f"   Document GUID: {document_guid}")

        url = (
            f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
            f"/topics/{topic_id}/document_references"
        )

        payload: dict = {"document_guid": document_guid}

        if description:
            payload["description"] = description

        response = self._safe_request(
            "POST", url, "Feil ved oppretting av document reference", json=payload
        )
        if response is None:
            return None

        doc_ref = response.json()

        logger.info("Document reference opprettet!")
        logger.info(f"   Reference GUID: {doc_ref['guid']}")
        logger.info(f"   Document GUID: {doc_ref.get('document_guid', 'N/A')}")

        return doc_ref

    def list_document_references(
        self: "CatendaClientBase", topic_id: str | None = None
    ) -> list[dict]:
        """
        List all document references for a topic.

        Args:
            topic_id: Topic GUID (uses self.test_topic_id if None)

        Returns:
            List of document references
        """
        topic_id = topic_id or getattr(self, "test_topic_id", None)

        if not topic_id:
            logger.error("Ingen topic ID spesifisert")
            return []

        logger.info(f"Henter document references for topic {topic_id}...")

        url = (
            f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
            f"/topics/{topic_id}/document_references"
        )

        response = self._safe_request(
            "GET", url, "Feil ved henting av document references"
        )
        if response is None:
            return []

        doc_refs = response.json()
        logger.info(f"Fant {len(doc_refs)} document reference(s)")

        for ref in doc_refs:
            logger.info(f"  - {ref.get('description', 'No description')}")
            logger.info(f"    Document GUID: {ref.get('document_guid', 'N/A')}")
            logger.info(f"    URL: {ref.get('url', 'N/A')}")

        return doc_refs
