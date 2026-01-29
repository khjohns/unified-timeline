"""
CatendaService - Business logic for Catenda API integration.

This service wraps the CatendaClient and provides a clean interface
for posting comments, uploading documents, and managing references.
"""
from typing import Dict, Any, Optional
from pathlib import Path
import threading

from utils.logger import get_logger

logger = get_logger(__name__)

# Status mapping fra intern overordnet_status til Catenda topic_status
OVERORDNET_TO_CATENDA_STATUS = {
    "UNDER_VARSLING": "Under varsling",
    "SENDT": "Sendt",
    "VENTER_PAA_SVAR": "Venter på svar",
    "UNDER_BEHANDLING": "Under behandling",
    "UNDER_FORHANDLING": "Under forhandling",
    "OMFORENT": "Omforent",
    "LUKKET": "Lukket",
    "LUKKET_TRUKKET": "Lukket",
    "UTKAST": "Under varsling",  # Utkast mappes til Under varsling
}


def map_status_to_catenda(overordnet_status: str) -> str:
    """
    Map intern overordnet_status til Catenda topic_status.

    Args:
        overordnet_status: Intern status fra SakState.overordnet_status

    Returns:
        Catenda-kompatibel status streng
    """
    return OVERORDNET_TO_CATENDA_STATUS.get(overordnet_status, "Under behandling")


class CatendaService:
    """
    Service for Catenda API integration.

    This class provides a clean interface to Catenda operations,
    hiding implementation details and making it easy to mock for testing.
    """

    def __init__(self, catenda_api_client: Optional[Any] = None):
        """
        Initialize CatendaService.

        Args:
            catenda_api_client: CatendaClient instance (or mock)
        """
        self.client = catenda_api_client
        if not self.client:
            logger.warning("CatendaService initialized without API client")

    def create_comment(self, topic_guid: str, comment_text: str, async_mode: bool = False) -> Optional[Dict[str, Any]]:
        """
        Create a comment on a Catenda topic.

        Args:
            topic_guid: Catenda topic GUID
            comment_text: Comment text (supports markdown)
            async_mode: If True, post comment in background thread (for Flask)
                       ⚠️ TODO: Replace with Azure Service Bus queue in production

        Returns:
            Comment data dict if successful, None otherwise

        Note:
            In Flask/development, async_mode=True uses background threads.
            In Azure Functions, this should use Service Bus for reliable delivery.
        """
        if not self.client:
            logger.warning("No Catenda client configured, skipping comment")
            return None

        if async_mode:
            # ⚠️ Background thread - works in Flask but NOT reliable in Azure Functions
            # TODO: Replace with Azure Service Bus queue in production
            thread = threading.Thread(
                target=self._post_comment_sync,
                args=(topic_guid, comment_text)
            )
            thread.daemon = True
            thread.start()
            logger.info(f"Comment queued for async posting to topic {topic_guid}")
            return {"status": "queued"}
        else:
            return self._post_comment_sync(topic_guid, comment_text)

    def _post_comment_sync(self, topic_guid: str, comment_text: str) -> Optional[Dict[str, Any]]:
        """
        Post comment synchronously.

        Args:
            topic_guid: Catenda topic GUID
            comment_text: Comment text

        Returns:
            Comment data if successful, None otherwise
        """
        try:
            logger.info(f"Posting comment to Catenda topic {topic_guid}")
            result = self.client.create_comment(topic_guid, comment_text)

            if result:
                logger.info(f"✅ Comment posted successfully: {result.get('guid', 'N/A')}")
                return result
            else:
                logger.error("❌ Failed to post comment (no result)")
                return None

        except Exception as e:
            logger.error(f"❌ Exception posting comment: {e}")
            return None

    def upload_document(
        self,
        project_id: str,
        file_path: str,
        filename: Optional[str] = None,
        folder_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Upload a document to Catenda.

        Args:
            project_id: Catenda project ID
            file_path: Path to file to upload
            filename: Optional custom filename (defaults to basename)
            folder_id: Optional folder ID to upload to (None = library root)

        Returns:
            Document data with library_item_id (document_guid) if successful

        Raises:
            ValueError: If file doesn't exist
            Exception: If upload fails
        """
        if not self.client:
            logger.warning("No Catenda client configured, skipping upload")
            return None

        # Verify file exists
        path = Path(file_path)
        if not path.exists():
            raise ValueError(f"File not found: {file_path}")

        # Use provided filename or default to file basename
        upload_filename = filename or path.name

        try:
            logger.info(f"Uploading document {upload_filename} to project {project_id}" + (f" folder {folder_id}" if folder_id else ""))
            result = self.client.upload_document(project_id, file_path, upload_filename, folder_id)

            if result:
                logger.info(f"✅ Document uploaded: {result.get('library_item_id', 'N/A')}")
                return result
            else:
                logger.error("❌ Failed to upload document")
                return None

        except Exception as e:
            logger.error(f"❌ Exception uploading document: {e}")
            raise

    def create_document_reference(
        self,
        topic_guid: str,
        document_guid: str
    ) -> Optional[Dict[str, Any]]:
        """
        Create a document reference linking a document to a topic.

        Args:
            topic_guid: Catenda topic GUID
            document_guid: Document GUID (library_item_id from upload)

        Returns:
            Reference data if successful, None otherwise

        Note:
            This makes the document appear in the topic's documents list in Catenda.
        """
        if not self.client:
            logger.warning("No Catenda client configured, skipping reference")
            return None

        try:
            logger.info(f"Creating document reference: topic={topic_guid}, doc={document_guid}")
            result = self.client.create_document_reference(topic_guid, document_guid)

            if result:
                logger.info("✅ Document reference created")
                return result
            else:
                logger.error("❌ Failed to create document reference")
                return None

        except Exception as e:
            logger.error(f"❌ Exception creating document reference: {e}")
            return None

    def get_topic_details(self, topic_guid: str) -> Optional[Dict[str, Any]]:
        """
        Get details about a Catenda topic.

        Args:
            topic_guid: Catenda topic GUID

        Returns:
            Topic data dict if successful, None otherwise
        """
        if not self.client:
            logger.warning("No Catenda client configured")
            return None

        try:
            logger.info(f"Getting topic details for {topic_guid}")
            result = self.client.get_topic_details(topic_guid)

            if result:
                logger.info(f"✅ Topic details retrieved: {result.get('title', 'N/A')}")
                return result
            else:
                logger.error("❌ Failed to get topic details")
                return None

        except Exception as e:
            logger.error(f"❌ Exception getting topic details: {e}")
            return None

    def get_project_details(self, project_id: str) -> Optional[Dict[str, Any]]:
        """
        Get details about a Catenda project.

        Args:
            project_id: Catenda project ID

        Returns:
            Project data dict if successful, None otherwise
        """
        if not self.client:
            logger.warning("No Catenda client configured")
            return None

        try:
            logger.info(f"Getting project details for {project_id}")
            result = self.client.get_project_details(project_id)

            if result:
                logger.info(f"✅ Project details retrieved: {result.get('name', 'N/A')}")
                return result
            else:
                logger.error("❌ Failed to get project details")
                return None

        except Exception as e:
            logger.error(f"❌ Exception getting project details: {e}")
            return None

    def set_topic_board_id(self, board_id: str):
        """
        Set the topic board ID for BCF API calls.

        Args:
            board_id: Catenda topic board ID (project GUID for BCF)
        """
        if self.client:
            self.client.topic_board_id = board_id
            logger.info(f"Topic board ID set to: {board_id}")

    def set_library_id(self, library_id: str):
        """
        Set the library ID for document uploads.

        Args:
            library_id: Catenda library ID
        """
        if self.client:
            self.client.library_id = library_id
            logger.info(f"Library ID set to: {library_id}")

    def is_configured(self) -> bool:
        """
        Check if Catenda service is configured with a client.

        Returns:
            True if client is available, False otherwise
        """
        return self.client is not None

    def update_topic_status(
        self,
        topic_guid: str,
        overordnet_status: str
    ) -> Optional[Dict[str, Any]]:
        """
        Update topic status in Catenda based on internal overordnet_status.

        Args:
            topic_guid: Catenda topic GUID
            overordnet_status: Internal status from SakState.overordnet_status

        Returns:
            Updated topic data if successful, None otherwise
        """
        if not self.client:
            logger.warning("No Catenda client configured, skipping status update")
            return None

        catenda_status = map_status_to_catenda(overordnet_status)

        try:
            logger.info(f"Updating topic {topic_guid} status to: {catenda_status} (from {overordnet_status})")
            result = self.client.update_topic(topic_guid, topic_status=catenda_status)

            if result:
                logger.info(f"✅ Topic status updated to: {catenda_status}")
                return result
            else:
                logger.error("❌ Failed to update topic status")
                return None

        except Exception as e:
            logger.error(f"❌ Exception updating topic status: {e}")
            return None
