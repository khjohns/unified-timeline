"""
Dalux Build API Client.

Production-ready client for Dalux Build API with X-API-KEY authentication.
Follows the same patterns as CatendaClient for consistency.

API Documentation: https://app.swaggerhub.com/apis-docs/Dalux/DaluxBuild-api/4.13
"""

import requests
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from utils.logger import get_logger

logger = get_logger(__name__)


class DaluxAuthError(Exception):
    """Raised when Dalux authentication fails (invalid or expired API key)."""
    pass


class DaluxAPIError(Exception):
    """Raised when Dalux API returns an error."""
    pass


class DaluxClient:
    """
    Client for Dalux Build API.

    Authentication is via X-API-KEY header (per-project API key from Dalux).
    Base URL is customer-specific (e.g., https://node1.field.dalux.com/service/api/).

    Note: API keys created before the new API identity system expire on 28 Feb 2026.
    """

    # API version endpoints (from Dalux OpenAPI spec)
    PROJECTS_VERSION = "5.1"
    TASKS_LIST_VERSION = "5.2"
    TASK_DETAIL_VERSION = "3.4"
    TASKS_CHANGES_VERSION = "2.3"
    TASK_ATTACHMENTS_VERSION = "1.1"
    FILE_AREAS_VERSION = "5.1"
    FILES_VERSION = "6.0"
    FILE_CONTENT_VERSION = "2.0"

    def __init__(self, api_key: str, base_url: str):
        """
        Initialize Dalux API client.

        Args:
            api_key: Dalux API key (from entrepreneur's Dalux account)
            base_url: Customer-specific base URL (e.g., https://node1.field.dalux.com/service/api/)
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')

        # Rate limiting
        self._last_request_time: Optional[float] = None
        self._min_request_interval = 0.1  # 100ms between requests (10 req/sec)

        logger.info(f"DaluxClient initialized for {self.base_url}")

    # ==========================================
    # HTTP HELPERS
    # ==========================================

    def get_headers(self) -> Dict[str, str]:
        """Return standard headers for API calls."""
        return {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def _rate_limit(self) -> None:
        """Ensure minimum interval between requests."""
        if self._last_request_time is not None:
            elapsed = time.time() - self._last_request_time
            if elapsed < self._min_request_interval:
                time.sleep(self._min_request_interval - elapsed)
        self._last_request_time = time.time()

    def _make_request(
        self,
        method: str,
        url: str,
        timeout: int = 30,
        **kwargs
    ) -> requests.Response:
        """
        Make HTTP request with rate limiting and error handling.

        Args:
            method: HTTP method (GET, POST, etc.)
            url: Full URL
            timeout: Request timeout in seconds
            **kwargs: Additional arguments for requests

        Returns:
            Response object

        Raises:
            DaluxAuthError: For 401/403 errors
            DaluxAPIError: For other API errors
        """
        self._rate_limit()

        try:
            response = requests.request(
                method,
                url,
                headers=self.get_headers(),
                timeout=timeout,
                **kwargs
            )

            # Handle auth errors
            if response.status_code == 401:
                logger.error(f"Dalux API key invalid or expired")
                raise DaluxAuthError("Invalid API key")
            elif response.status_code == 403:
                logger.error(f"Dalux API key lacks permission for this resource")
                raise DaluxAuthError("Insufficient permissions")

            response.raise_for_status()
            return response

        except requests.exceptions.Timeout:
            logger.error(f"Dalux API timeout: {url}")
            raise DaluxAPIError(f"Request timeout: {url}")
        except requests.exceptions.RequestException as e:
            if isinstance(e, requests.exceptions.HTTPError):
                if hasattr(e, 'response') and e.response is not None:
                    logger.error(f"Dalux API error {e.response.status_code}: {e.response.text}")
            else:
                logger.error(f"Dalux API request failed: {e}")
            raise DaluxAPIError(str(e))

    # ==========================================
    # PROJECTS
    # ==========================================

    def get_projects(self) -> List[Dict[str, Any]]:
        """
        Get all available projects.

        Returns:
            List of project objects with 'data' containing projectId and projectName.

        Example response item:
            {
                "data": {
                    "projectId": "6070718657",
                    "projectName": "Stovner skole"
                }
            }
        """
        logger.info("Fetching Dalux projects...")
        url = f"{self.base_url}/{self.PROJECTS_VERSION}/projects"

        try:
            response = self._make_request("GET", url)
            data = response.json()

            # Dalux returns { items: [...], metadata: {...}, links: [...] }
            items = data.get("items", [])
            logger.info(f"Found {len(items)} Dalux project(s)")

            for item in items:
                project_data = item.get("data", {})
                logger.debug(f"  - {project_data.get('projectName')} (ID: {project_data.get('projectId')})")

            return items

        except (DaluxAuthError, DaluxAPIError):
            raise
        except Exception as e:
            logger.error(f"Failed to fetch projects: {e}")
            raise DaluxAPIError(f"Failed to fetch projects: {e}")

    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific project.

        Args:
            project_id: Dalux project ID

        Returns:
            Project data or None if not found.
        """
        logger.info(f"Fetching Dalux project {project_id}...")
        url = f"{self.base_url}/5.0/projects/{project_id}"

        try:
            response = self._make_request("GET", url)
            data = response.json()
            logger.info(f"Fetched project: {data.get('data', {}).get('projectName')}")
            return data

        except DaluxAPIError as e:
            if "404" in str(e):
                logger.warning(f"Project {project_id} not found")
                return None
            raise

    # ==========================================
    # TASKS
    # ==========================================

    def get_tasks(
        self,
        project_id: str,
        limit: Optional[int] = None,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get all tasks for a project.

        Includes tasks, approvals, and safety issues.

        Args:
            project_id: Dalux project ID
            limit: Maximum number of tasks to return (None = all)
            offset: Number of tasks to skip (for pagination)

        Returns:
            List of task objects.
        """
        logger.info(f"Fetching tasks for project {project_id}...")
        url = f"{self.base_url}/{self.TASKS_LIST_VERSION}/projects/{project_id}/tasks"

        all_tasks = []
        current_offset = offset
        page_size = 100  # Dalux default

        while True:
            params = {"offset": current_offset}
            if limit:
                params["limit"] = min(page_size, limit - len(all_tasks))

            try:
                response = self._make_request("GET", url, params=params)
                data = response.json()

                items = data.get("items", [])
                all_tasks.extend(items)

                metadata = data.get("metadata", {})
                remaining = metadata.get("totalRemainingItems", 0)

                logger.debug(f"Fetched {len(items)} tasks, {remaining} remaining")

                # Check if we should continue
                if not items or remaining == 0:
                    break
                if limit and len(all_tasks) >= limit:
                    break

                current_offset += len(items)

            except (DaluxAuthError, DaluxAPIError):
                raise
            except Exception as e:
                logger.error(f"Failed to fetch tasks: {e}")
                raise DaluxAPIError(f"Failed to fetch tasks: {e}")

        logger.info(f"Fetched {len(all_tasks)} tasks total")
        return all_tasks

    def get_task_changes(
        self,
        project_id: str,
        since: datetime
    ) -> List[Dict[str, Any]]:
        """
        Get tasks that changed since a given timestamp.

        This is the preferred method for incremental sync.

        Args:
            project_id: Dalux project ID
            since: Only return tasks changed after this time

        Returns:
            List of changed task objects.
        """
        logger.info(f"Fetching task changes for project {project_id} since {since}...")
        url = f"{self.base_url}/{self.TASKS_CHANGES_VERSION}/projects/{project_id}/tasks/changes"

        # Dalux expects ISO 8601 format
        params = {"since": since.isoformat()}

        try:
            response = self._make_request("GET", url, params=params)
            data = response.json()

            items = data.get("items", [])
            logger.info(f"Found {len(items)} changed tasks since {since}")

            return items

        except (DaluxAuthError, DaluxAPIError):
            raise
        except Exception as e:
            logger.error(f"Failed to fetch task changes: {e}")
            raise DaluxAPIError(f"Failed to fetch task changes: {e}")

    def get_task(self, project_id: str, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific task with full details.

        Args:
            project_id: Dalux project ID
            task_id: Dalux task ID

        Returns:
            Task data or None if not found.
        """
        logger.info(f"Fetching task {task_id}...")
        url = f"{self.base_url}/{self.TASK_DETAIL_VERSION}/projects/{project_id}/tasks/{task_id}"

        try:
            response = self._make_request("GET", url)
            data = response.json()
            logger.info(f"Fetched task: {data.get('data', {}).get('title')}")
            return data

        except DaluxAPIError as e:
            if "404" in str(e):
                logger.warning(f"Task {task_id} not found")
                return None
            raise

    # ==========================================
    # ATTACHMENTS
    # ==========================================

    def get_task_attachments(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get all task attachments for a project.

        Args:
            project_id: Dalux project ID

        Returns:
            List of attachment relations (TaskAttachmentRelation).
        """
        logger.info(f"Fetching task attachments for project {project_id}...")
        url = f"{self.base_url}/{self.TASK_ATTACHMENTS_VERSION}/projects/{project_id}/tasks/attachments"

        try:
            response = self._make_request("GET", url)
            data = response.json()

            items = data.get("items", [])
            logger.info(f"Found {len(items)} task attachments")

            return items

        except (DaluxAuthError, DaluxAPIError):
            raise
        except Exception as e:
            logger.error(f"Failed to fetch attachments: {e}")
            raise DaluxAPIError(f"Failed to fetch attachments: {e}")

    # ==========================================
    # USERS, COMPANIES & WORKPACKAGES
    # ==========================================

    USERS_VERSION = "1.2"
    COMPANIES_VERSION = "3.1"
    WORKPACKAGES_VERSION = "1.0"

    def get_project_users(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get all users on a project.

        Args:
            project_id: Dalux project ID

        Returns:
            List of user objects with userId, firstName, lastName, email.
        """
        logger.info(f"Fetching users for project {project_id}...")
        url = f"{self.base_url}/{self.USERS_VERSION}/projects/{project_id}/users"

        try:
            response = self._make_request("GET", url)
            data = response.json()

            items = data.get("items", [])
            logger.info(f"Found {len(items)} project users")

            return items

        except (DaluxAuthError, DaluxAPIError):
            raise
        except Exception as e:
            logger.error(f"Failed to fetch users: {e}")
            raise DaluxAPIError(f"Failed to fetch users: {e}")

    def get_project_companies(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get all companies on a project.

        Args:
            project_id: Dalux project ID

        Returns:
            List of company objects with companyId and name.
        """
        logger.info(f"Fetching companies for project {project_id}...")
        url = f"{self.base_url}/{self.COMPANIES_VERSION}/projects/{project_id}/companies"

        try:
            response = self._make_request("GET", url)
            data = response.json()

            items = data.get("items", [])
            logger.info(f"Found {len(items)} project companies")

            return items

        except (DaluxAuthError, DaluxAPIError):
            raise
        except Exception as e:
            logger.error(f"Failed to fetch companies: {e}")
            raise DaluxAPIError(f"Failed to fetch companies: {e}")

    def get_project_workpackages(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get all workpackages (entreprises) on a project.

        Args:
            project_id: Dalux project ID

        Returns:
            List of workpackage objects with workpackageId and name.
        """
        logger.info(f"Fetching workpackages for project {project_id}...")
        url = f"{self.base_url}/{self.WORKPACKAGES_VERSION}/projects/{project_id}/workpackages"

        try:
            response = self._make_request("GET", url)
            data = response.json()

            items = data.get("items", [])
            logger.info(f"Found {len(items)} project workpackages")

            return items

        except (DaluxAuthError, DaluxAPIError):
            raise
        except Exception as e:
            logger.error(f"Failed to fetch workpackages: {e}")
            raise DaluxAPIError(f"Failed to fetch workpackages: {e}")

    def download_attachment(
        self,
        download_url: str,
        timeout: int = 120
    ) -> bytes:
        """
        Download an attachment file.

        Args:
            download_url: Full URL to download (from mediaFile.fileDownload)
            timeout: Download timeout in seconds

        Returns:
            File content as bytes.
        """
        logger.info(f"Downloading attachment from {download_url}...")

        try:
            response = self._make_request("GET", download_url, timeout=timeout)
            content = response.content

            logger.info(f"Downloaded {len(content)} bytes")
            return content

        except (DaluxAuthError, DaluxAPIError):
            raise
        except Exception as e:
            logger.error(f"Failed to download attachment: {e}")
            raise DaluxAPIError(f"Failed to download attachment: {e}")

    # ==========================================
    # FILES & FILE AREAS
    # ==========================================

    def get_file_areas(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get all file areas for a project.

        Args:
            project_id: Dalux project ID

        Returns:
            List of file area objects.
        """
        logger.info(f"Fetching file areas for project {project_id}...")
        url = f"{self.base_url}/{self.FILE_AREAS_VERSION}/projects/{project_id}/file_areas"

        try:
            response = self._make_request("GET", url)
            data = response.json()

            items = data.get("items", [])
            logger.info(f"Found {len(items)} file areas")

            return items

        except (DaluxAuthError, DaluxAPIError):
            raise
        except Exception as e:
            logger.error(f"Failed to fetch file areas: {e}")
            raise DaluxAPIError(f"Failed to fetch file areas: {e}")

    def get_files(
        self,
        project_id: str,
        file_area_id: str,
        since: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get files from a file area.

        Args:
            project_id: Dalux project ID
            file_area_id: File area ID
            since: Only return files changed after this time

        Returns:
            List of file objects.
        """
        logger.info(f"Fetching files for file area {file_area_id}...")
        url = f"{self.base_url}/{self.FILES_VERSION}/projects/{project_id}/file_areas/{file_area_id}/files"

        params = {}
        if since:
            params["since"] = since.isoformat()

        try:
            response = self._make_request("GET", url, params=params if params else None)
            data = response.json()

            items = data.get("items", [])
            logger.info(f"Found {len(items)} files")

            return items

        except (DaluxAuthError, DaluxAPIError):
            raise
        except Exception as e:
            logger.error(f"Failed to fetch files: {e}")
            raise DaluxAPIError(f"Failed to fetch files: {e}")

    def download_file(
        self,
        project_id: str,
        file_area_id: str,
        file_id: str,
        revision: int,
        timeout: int = 120
    ) -> bytes:
        """
        Download a file revision.

        Args:
            project_id: Dalux project ID
            file_area_id: File area ID
            file_id: File ID
            revision: File revision number
            timeout: Download timeout in seconds

        Returns:
            File content as bytes.
        """
        logger.info(f"Downloading file {file_id} rev {revision}...")
        url = (
            f"{self.base_url}/{self.FILE_CONTENT_VERSION}/projects/{project_id}"
            f"/file_areas/{file_area_id}/files/{file_id}/revisions/{revision}/content"
        )

        try:
            response = self._make_request("GET", url, timeout=timeout)
            content = response.content

            logger.info(f"Downloaded {len(content)} bytes")
            return content

        except (DaluxAuthError, DaluxAPIError):
            raise
        except Exception as e:
            logger.error(f"Failed to download file: {e}")
            raise DaluxAPIError(f"Failed to download file: {e}")

    # ==========================================
    # FORMS
    # ==========================================

    FORMS_VERSION = "2.1"

    def get_forms(
        self,
        project_id: str,
        limit: Optional[int] = None,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get all forms for a project.

        Args:
            project_id: Dalux project ID
            limit: Maximum number of forms to return (None = all)
            offset: Number of forms to skip (for pagination)

        Returns:
            List of form objects.
        """
        logger.info(f"Fetching forms for project {project_id}...")
        url = f"{self.base_url}/{self.FORMS_VERSION}/projects/{project_id}/forms"

        params = {"offset": offset}
        if limit:
            params["pageSize"] = limit

        try:
            response = self._make_request("GET", url, params=params)
            data = response.json()

            items = data.get("items", [])
            logger.info(f"Found {len(items)} forms")

            return items

        except (DaluxAuthError, DaluxAPIError):
            raise
        except Exception as e:
            logger.error(f"Failed to fetch forms: {e}")
            raise DaluxAPIError(f"Failed to fetch forms: {e}")

    # ==========================================
    # HEALTH CHECK
    # ==========================================

    def health_check(self) -> bool:
        """
        Verify API key is valid by attempting to fetch projects.

        Returns:
            True if API key is valid and working.
        """
        try:
            projects = self.get_projects()
            logger.info(f"Health check passed: {len(projects)} project(s) accessible")
            return True
        except DaluxAuthError:
            logger.error("Health check failed: Invalid API key")
            return False
        except DaluxAPIError as e:
            logger.error(f"Health check failed: {e}")
            return False
