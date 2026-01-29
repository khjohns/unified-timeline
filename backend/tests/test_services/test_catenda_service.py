"""
Tests for CatendaService.

These tests verify the Catenda API integration service
without making actual API calls (using mocks).
"""
import pytest
from unittest.mock import Mock, patch
import tempfile
from pathlib import Path

from services.catenda_service import CatendaService


class TestCatendaService:
    """Test suite for CatendaService"""

    @pytest.fixture
    def mock_catenda_client(self):
        """Create mock Catenda API client"""
        client = Mock()
        client.topic_board_id = None
        client.library_id = None
        client.create_comment = Mock(return_value={'guid': 'comment-123', 'author': 'Test User'})
        client.upload_document = Mock(return_value={'library_item_id': 'doc-456', 'name': 'test.pdf'})
        client.create_document_reference = Mock(return_value={'guid': 'ref-789'})
        client.get_topic_details = Mock(return_value={'title': 'Test Topic', 'guid': 'topic-123'})
        client.get_project_details = Mock(return_value={'name': 'Test Project', 'id': 'proj-123'})
        return client

    @pytest.fixture
    def service(self, mock_catenda_client):
        """Create CatendaService instance"""
        return CatendaService(catenda_api_client=mock_catenda_client)

    @pytest.fixture
    def temp_file(self):
        """Create a temporary file for upload tests"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.pdf', delete=False) as f:
            f.write("Test PDF content")
            temp_path = f.name

        yield temp_path

        # Cleanup
        Path(temp_path).unlink(missing_ok=True)

    # ========================================================================
    # Test: Initialization
    # ========================================================================

    def test_initialization_with_client(self, mock_catenda_client):
        """Test service initializes with API client"""
        service = CatendaService(catenda_api_client=mock_catenda_client)
        assert service.client is not None
        assert service.is_configured() is True

    def test_initialization_without_client(self):
        """Test service can initialize without client"""
        service = CatendaService()
        assert service.client is None
        assert service.is_configured() is False

    # ========================================================================
    # Test: create_comment (sync mode)
    # ========================================================================

    def test_create_comment_sync_success(self, service, mock_catenda_client):
        """Test successful synchronous comment creation"""
        # Act
        result = service.create_comment('topic-123', 'Test comment', async_mode=False)

        # Assert
        assert result is not None
        assert result['guid'] == 'comment-123'
        mock_catenda_client.create_comment.assert_called_once_with('topic-123', 'Test comment')

    def test_create_comment_with_markdown(self, service, mock_catenda_client):
        """Test comment with markdown formatting"""
        # Arrange
        markdown_comment = "**Bold** and *italic* with [link](http://example.com)"

        # Act
        result = service.create_comment('topic-123', markdown_comment)

        # Assert
        assert result is not None
        mock_catenda_client.create_comment.assert_called_once_with('topic-123', markdown_comment)

    def test_create_comment_without_client(self):
        """Test comment creation without configured client"""
        # Arrange
        service = CatendaService()  # No client

        # Act
        result = service.create_comment('topic-123', 'Test')

        # Assert
        assert result is None  # Should return None gracefully

    def test_create_comment_api_failure(self, service, mock_catenda_client):
        """Test handling of API failure"""
        # Arrange
        mock_catenda_client.create_comment.return_value = None  # Simulate failure

        # Act
        result = service.create_comment('topic-123', 'Test')

        # Assert
        assert result is None

    def test_create_comment_api_exception(self, service, mock_catenda_client):
        """Test handling of API exception"""
        # Arrange
        mock_catenda_client.create_comment.side_effect = Exception("API error")

        # Act
        result = service.create_comment('topic-123', 'Test')

        # Assert
        assert result is None  # Should handle exception gracefully

    # ========================================================================
    # Test: create_comment (async mode)
    # ========================================================================

    @patch('threading.Thread')
    def test_create_comment_async_mode(self, mock_thread, service):
        """Test asynchronous comment creation (background thread)"""
        # Arrange
        mock_thread_instance = Mock()
        mock_thread.return_value = mock_thread_instance

        # Act
        result = service.create_comment('topic-123', 'Test', async_mode=True)

        # Assert
        assert result['status'] == 'queued'
        mock_thread.assert_called_once()
        mock_thread_instance.start.assert_called_once()

    # ========================================================================
    # Test: upload_document
    # ========================================================================

    def test_upload_document_success(self, service, mock_catenda_client, temp_file):
        """Test successful document upload"""
        # Act
        result = service.upload_document('proj-123', temp_file, 'custom-name.pdf')

        # Assert
        assert result is not None
        assert result['library_item_id'] == 'doc-456'
        mock_catenda_client.upload_document.assert_called_once_with('proj-123', temp_file, 'custom-name.pdf', None)

    def test_upload_document_default_filename(self, service, mock_catenda_client, temp_file):
        """Test upload with default filename (file basename)"""
        # Act
        result = service.upload_document('proj-123', temp_file)

        # Assert
        assert result is not None
        # Should use basename of temp_file
        call_args = mock_catenda_client.upload_document.call_args
        assert call_args[0][2] == Path(temp_file).name

    def test_upload_document_file_not_found(self, service):
        """Test upload with non-existent file raises ValueError"""
        # Act & Assert
        with pytest.raises(ValueError, match="File not found"):
            service.upload_document('proj-123', '/nonexistent/file.pdf')

    def test_upload_document_without_client(self, temp_file):
        """Test upload without configured client"""
        # Arrange
        service = CatendaService()  # No client

        # Act
        result = service.upload_document('proj-123', temp_file)

        # Assert
        assert result is None

    def test_upload_document_api_exception(self, service, mock_catenda_client, temp_file):
        """Test handling of upload exception"""
        # Arrange
        mock_catenda_client.upload_document.side_effect = Exception("Upload failed")

        # Act & Assert
        with pytest.raises(Exception, match="Upload failed"):
            service.upload_document('proj-123', temp_file)

    # ========================================================================
    # Test: create_document_reference
    # ========================================================================

    def test_create_document_reference_success(self, service, mock_catenda_client):
        """Test successful document reference creation"""
        # Act
        result = service.create_document_reference('topic-123', 'doc-456')

        # Assert
        assert result is not None
        assert result['guid'] == 'ref-789'
        mock_catenda_client.create_document_reference.assert_called_once_with('topic-123', 'doc-456')

    def test_create_document_reference_without_client(self):
        """Test reference creation without configured client"""
        # Arrange
        service = CatendaService()

        # Act
        result = service.create_document_reference('topic-123', 'doc-456')

        # Assert
        assert result is None

    def test_create_document_reference_api_exception(self, service, mock_catenda_client):
        """Test handling of reference creation exception"""
        # Arrange
        mock_catenda_client.create_document_reference.side_effect = Exception("Reference failed")

        # Act
        result = service.create_document_reference('topic-123', 'doc-456')

        # Assert
        assert result is None  # Should handle exception gracefully

    # ========================================================================
    # Test: get_topic_details
    # ========================================================================

    def test_get_topic_details_success(self, service, mock_catenda_client):
        """Test getting topic details"""
        # Act
        result = service.get_topic_details('topic-123')

        # Assert
        assert result is not None
        assert result['title'] == 'Test Topic'
        mock_catenda_client.get_topic_details.assert_called_once_with('topic-123')

    def test_get_topic_details_without_client(self):
        """Test getting topic details without client"""
        # Arrange
        service = CatendaService()

        # Act
        result = service.get_topic_details('topic-123')

        # Assert
        assert result is None

    # ========================================================================
    # Test: get_project_details
    # ========================================================================

    def test_get_project_details_success(self, service, mock_catenda_client):
        """Test getting project details"""
        # Act
        result = service.get_project_details('proj-123')

        # Assert
        assert result is not None
        assert result['name'] == 'Test Project'
        mock_catenda_client.get_project_details.assert_called_once_with('proj-123')

    def test_get_project_details_without_client(self):
        """Test getting project details without client"""
        # Arrange
        service = CatendaService()

        # Act
        result = service.get_project_details('proj-123')

        # Assert
        assert result is None

    # ========================================================================
    # Test: Configuration helpers
    # ========================================================================

    def test_set_topic_board_id(self, service, mock_catenda_client):
        """Test setting topic board ID"""
        # Act
        service.set_topic_board_id('board-123')

        # Assert
        assert mock_catenda_client.topic_board_id == 'board-123'

    def test_set_library_id(self, service, mock_catenda_client):
        """Test setting library ID"""
        # Act
        service.set_library_id('lib-456')

        # Assert
        assert mock_catenda_client.library_id == 'lib-456'

    def test_is_configured_true(self, service):
        """Test is_configured returns True when client exists"""
        assert service.is_configured() is True

    def test_is_configured_false(self):
        """Test is_configured returns False without client"""
        service = CatendaService()
        assert service.is_configured() is False
