"""
Tests for WebhookService.

Verifies business logic for webhook event handling:
- New topic creation (case creation)
- Topic modification (status updates)
- PDF upload to Catenda
"""
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime

from services.webhook_service import WebhookService
from core.generated_constants import SAK_STATUS


class TestWebhookService:
    """Test WebhookService business logic"""

    @pytest.fixture
    def mock_repository(self):
        """Create mock repository"""
        repo = MagicMock()
        repo.create_case.return_value = 'KOE-20251130-123456'
        repo.get_case_by_topic_id.return_value = {
            'sak_id': 'KOE-20251130-123456',
            'sak': {
                'catenda_board_id': 'board-123'
            }
        }
        repo.get_case.return_value = {
            'sak': {
                'catenda_board_id': 'board-123'
            }
        }
        return repo

    @pytest.fixture
    def mock_catenda(self):
        """Create mock Catenda client"""
        catenda = MagicMock()
        catenda.get_topic_details.return_value = {
            'title': 'Test Topic',
            'bimsync_creation_author': {
                'user': {
                    'name': 'John Doe',
                    'email': 'john@example.com'
                }
            },
            'bimsync_custom_fields': [
                {'customFieldName': 'Byggherre', 'value': 'Oslo Kommune'},
                {'customFieldName': 'Leverandør', 'value': 'Byggfirma AS'},
                {'customFieldName': 'Saksstatus KOE', 'value': SAK_STATUS['UNDER_VARSLING']}
            ]
        }
        catenda.get_topic_board_details.return_value = {
            'bimsync_project_id': 'project-789'
        }
        catenda.get_project_details.return_value = {
            'name': 'Test Project'
        }
        catenda.create_comment.return_value = True
        # Return 32-character GUID to trigger formatting
        catenda.upload_document.return_value = {
            'id': 'abc123def456abc123def456abc123de'
        }
        catenda.create_document_reference.return_value = True
        return catenda

    @pytest.fixture
    def mock_magic_link_generator(self):
        """Create mock magic link generator"""
        generator = MagicMock()
        generator.generate.return_value = 'test-magic-token-123'
        return generator

    @pytest.fixture
    def webhook_service(self, mock_repository, mock_catenda, mock_magic_link_generator):
        """Create WebhookService with mocked dependencies"""
        config = {
            'catenda_project_id': 'project-123',
            'catenda_library_id': 'library-456',
            'react_app_url': 'http://localhost:3000'
        }
        return WebhookService(
            repository=mock_repository,
            catenda_client=mock_catenda,
            config=config,
            magic_link_generator=mock_magic_link_generator
        )

    # ========================================================================
    # handle_new_topic_created tests
    # ========================================================================

    def test_handle_new_topic_created_success(self, webhook_service, mock_repository, mock_catenda, mock_magic_link_generator):
        """Test successful topic creation"""
        payload = {
            'issue': {
                'id': 'topic-123',
                'topic_type': 'KOE',
                'boardId': 'board-456'
            },
            'project_id': 'board-456'
        }

        with patch('utils.filtering_config.should_process_topic', return_value=(True, None)):
            result = webhook_service.handle_new_topic_created(payload)

        assert result['success'] is True
        assert 'sak_id' in result
        assert result['sak_id'] == 'KOE-20251130-123456'

        # Verify repository was called to create case
        mock_repository.create_case.assert_called_once()
        sak_data = mock_repository.create_case.call_args[0][0]
        assert sak_data['catenda_topic_id'] == 'topic-123'
        assert sak_data['sakstittel'] == 'Test Topic'
        assert sak_data['byggherre'] == 'Oslo Kommune'
        assert sak_data['entreprenor'] == 'Byggfirma AS'

        # Verify magic link was generated
        mock_magic_link_generator.generate.assert_called_once_with(
            sak_id='KOE-20251130-123456',
            email='john@example.com'
        )

    def test_handle_new_topic_created_filtered_out(self, webhook_service):
        """Test topic filtered out by filtering rules"""
        payload = {
            'issue': {
                'id': 'topic-123',
                'topic_type': 'WRONG_TYPE',
                'boardId': 'board-456'
            }
        }

        with patch('utils.filtering_config.should_process_topic', return_value=(False, 'Wrong type')):
            result = webhook_service.handle_new_topic_created(payload)

        assert result['success'] is True
        assert result['action'] == 'ignored_due_to_filter'
        assert result['reason'] == 'Wrong type'

    def test_handle_new_topic_created_missing_topic_id(self, webhook_service):
        """Test missing topic_id in payload"""
        payload = {
            'issue': {},
            'project_id': 'board-456'
        }

        with patch('utils.filtering_config.should_process_topic', return_value=(True, None)):
            result = webhook_service.handle_new_topic_created(payload)

        assert result['success'] is False
        assert 'Mangler topic_id eller board_id' in result['error']

    def test_handle_new_topic_created_topic_details_not_found(self, webhook_service, mock_catenda):
        """Test when Catenda API fails to return topic details"""
        payload = {
            'issue': {
                'id': 'topic-123',
                'boardId': 'board-456'
            },
            'project_id': 'board-456'
        }

        # Mock Catenda to return None (failure)
        mock_catenda.get_topic_details.return_value = None

        with patch('utils.filtering_config.should_process_topic', return_value=(True, None)):
            result = webhook_service.handle_new_topic_created(payload)

        assert result['success'] is False
        assert 'Kunne ikke hente topic-detaljer' in result['error']

    def test_handle_new_topic_created_without_magic_link_generator(self, mock_repository, mock_catenda):
        """Test topic creation without magic link generator"""
        config = {'catenda_project_id': 'project-123'}
        service = WebhookService(
            repository=mock_repository,
            catenda_client=mock_catenda,
            config=config,
            magic_link_generator=None  # No magic link generator
        )

        payload = {
            'issue': {
                'id': 'topic-123',
                'boardId': 'board-456'
            },
            'project_id': 'board-456'
        }

        with patch('utils.filtering_config.should_process_topic', return_value=(True, None)):
            result = service.handle_new_topic_created(payload)

        # Should still succeed even without magic link
        assert result['success'] is True
        assert 'sak_id' in result

    # ========================================================================
    # handle_topic_modification tests
    # ========================================================================

    def test_handle_topic_modification_status_updated_lukket(self, webhook_service, mock_repository):
        """Test topic status updated to 'Lukket'"""
        payload = {
            'issue': {
                'id': 'topic-123'
            },
            'modification': {
                'event': 'status_updated',
                'value': 'Lukket'
            }
        }

        result = webhook_service.handle_topic_modification(payload)

        assert result['success'] is True
        assert result['action'] == 'updated'
        assert result['status'] == 'Lukket'

        # Verify status was updated in repository
        mock_repository.update_case_status.assert_called_once_with('KOE-20251130-123456', 'Lukket')

    def test_handle_topic_modification_status_updated_godkjent(self, webhook_service, mock_repository):
        """Test topic status updated to 'Godkjent'"""
        payload = {
            'issue': {
                'id': 'topic-123'
            },
            'modification': {
                'event': 'status_updated',
                'value': 'Godkjent'
            }
        }

        result = webhook_service.handle_topic_modification(payload)

        assert result['success'] is True
        assert result['action'] == 'updated'
        assert result['status'] == 'Godkjent'

    def test_handle_topic_modification_comment_godkjent(self, webhook_service, mock_repository):
        """Test comment containing 'godkjent'"""
        payload = {
            'issue': {
                'id': 'topic-123'
            },
            'comment': {
                'comment': 'Dette er godkjent av byggherre'
            }
        }

        result = webhook_service.handle_topic_modification(payload)

        assert result['success'] is True
        assert result['action'] == 'updated'
        assert result['status'] == 'Godkjent'

    def test_handle_topic_modification_comment_avslatt(self, webhook_service, mock_repository):
        """Test comment containing 'avslått'"""
        payload = {
            'issue': {
                'id': 'topic-123'
            },
            'comment': {
                'comment': 'Dette er avslått'
            }
        }

        result = webhook_service.handle_topic_modification(payload)

        assert result['success'] is True
        assert result['action'] == 'updated'
        assert result['status'] == 'Avslått'

    def test_handle_topic_modification_unknown_topic(self, webhook_service, mock_repository):
        """Test modification for unknown topic (not in our system)"""
        # Mock repository to return None (topic not found)
        mock_repository.get_case_by_topic_id.return_value = None

        payload = {
            'issue': {
                'id': 'unknown-topic-999'
            },
            'modification': {
                'event': 'status_updated',
                'value': 'Lukket'
            }
        }

        result = webhook_service.handle_topic_modification(payload)

        assert result['success'] is True
        assert result['action'] == 'ignored_unknown_topic'

        # Should not try to update status
        mock_repository.update_case_status.assert_not_called()

    def test_handle_topic_modification_no_relevant_changes(self, webhook_service, mock_repository):
        """Test modification with no relevant status changes"""
        payload = {
            'issue': {
                'id': 'topic-123'
            },
            'modification': {
                'event': 'description_updated',
                'value': 'New description'
            }
        }

        result = webhook_service.handle_topic_modification(payload)

        assert result['success'] is True
        assert result['action'] == 'no_change'

        # Should not update status
        mock_repository.update_case_status.assert_not_called()

    # ========================================================================
    # handle_pdf_upload tests
    # ========================================================================

    def test_handle_pdf_upload_success(self, webhook_service, mock_catenda):
        """Test successful PDF upload"""
        import base64
        pdf_content = b'%PDF-1.4\nMock PDF'
        pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')

        result = webhook_service.handle_pdf_upload(
            sak_id='KOE-20251130-123456',
            pdf_base64=pdf_base64,
            filename='test.pdf',
            topic_guid='topic-abc-123'
        )

        assert result['success'] is True
        assert result['documentGuid'] == 'abc123de-f456-abc1-23de-f456abc123de'  # Formatted GUID
        assert result['filename'] == 'test.pdf'

        # Verify PDF was uploaded
        mock_catenda.upload_document.assert_called_once()

        # Verify document was linked to topic
        mock_catenda.create_document_reference.assert_called_once()

    def test_handle_pdf_upload_formatted_guid_fallback_to_compact(self, mock_repository, mock_magic_link_generator):
        """Test PDF upload falling back to compact GUID when formatted fails"""
        import base64

        # Create a fresh mock catenda for this specific test
        mock_catenda = MagicMock()
        mock_catenda.upload_document.return_value = {
            'id': 'abc123def456abc123def456abc123de'  # 32-char compact GUID
        }
        # Mock formatted GUID to fail, compact to succeed
        mock_catenda.create_document_reference.side_effect = [False, True]

        config = {
            'catenda_project_id': 'project-123',
            'catenda_library_id': 'library-456'
        }
        service = WebhookService(
            repository=mock_repository,
            catenda_client=mock_catenda,
            config=config,
            magic_link_generator=mock_magic_link_generator
        )

        pdf_content = b'%PDF-1.4\nMock PDF'
        pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')

        result = service.handle_pdf_upload(
            sak_id='KOE-20251130-123456',
            pdf_base64=pdf_base64,
            filename='test.pdf',
            topic_guid='topic-abc-123'
        )

        assert result['success'] is True
        assert result['documentGuid'] == 'abc123def456abc123def456abc123de'  # Compact GUID (original)

        # Should have been called twice (formatted then compact)
        assert mock_catenda.create_document_reference.call_count == 2

    def test_handle_pdf_upload_both_guid_formats_fail(self, webhook_service, mock_catenda):
        """Test PDF upload when both GUID formats fail to link"""
        import base64
        pdf_content = b'%PDF-1.4\nMock PDF'
        pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')

        # Mock both GUID formats to fail
        mock_catenda.create_document_reference.return_value = False

        result = webhook_service.handle_pdf_upload(
            sak_id='KOE-20251130-123456',
            pdf_base64=pdf_base64,
            filename='test.pdf',
            topic_guid='topic-abc-123'
        )

        assert result['success'] is False
        assert 'begge GUID-formater feilet' in result['error']

    def test_handle_pdf_upload_catenda_upload_fails(self, webhook_service, mock_catenda):
        """Test PDF upload when Catenda upload fails"""
        import base64
        pdf_content = b'%PDF-1.4\nMock PDF'
        pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')

        # Mock upload to fail
        mock_catenda.upload_document.return_value = None

        result = webhook_service.handle_pdf_upload(
            sak_id='KOE-20251130-123456',
            pdf_base64=pdf_base64,
            filename='test.pdf',
            topic_guid='topic-abc-123'
        )

        assert result['success'] is False
        assert 'error' in result

    def test_handle_pdf_upload_uses_library_id_from_config(self, webhook_service, mock_catenda):
        """Test PDF upload uses library_id from config when provided"""
        import base64
        pdf_content = b'%PDF-1.4\nMock PDF'
        pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')

        webhook_service.handle_pdf_upload(
            sak_id='KOE-20251130-123456',
            pdf_base64=pdf_base64,
            filename='test.pdf',
            topic_guid='topic-abc-123'
        )

        # Verify library_id was set from config
        assert mock_catenda.library_id == 'library-456'

    def test_handle_pdf_upload_auto_selects_library_if_not_in_config(self, mock_repository, mock_catenda, mock_magic_link_generator):
        """Test PDF upload auto-selects library when not in config"""
        import base64

        config = {
            'catenda_project_id': 'project-123'
            # No library_id in config
        }
        service = WebhookService(
            repository=mock_repository,
            catenda_client=mock_catenda,
            config=config,
            magic_link_generator=mock_magic_link_generator
        )

        pdf_content = b'%PDF-1.4\nMock PDF'
        pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')

        service.handle_pdf_upload(
            sak_id='KOE-20251130-123456',
            pdf_base64=pdf_base64,
            filename='test.pdf',
            topic_guid='topic-abc-123'
        )

        # Verify select_library was called
        mock_catenda.select_library.assert_called_once_with('project-123')

    # ========================================================================
    # get_react_app_base_url tests
    # ========================================================================

    def test_get_react_app_base_url_from_dev_setting(self, mock_repository, mock_catenda):
        """Test React app URL from DEV_REACT_APP_URL setting"""
        with patch('core.config.settings') as mock_settings:
            mock_settings.dev_react_app_url = 'http://dev.localhost:3000'
            mock_settings.react_app_url = None

            config = {}
            service = WebhookService(
                repository=mock_repository,
                catenda_client=mock_catenda,
                config=config,
                magic_link_generator=None
            )

            url = service.get_react_app_base_url()
            assert url == 'http://dev.localhost:3000'

    def test_get_react_app_base_url_from_react_setting(self, mock_repository, mock_catenda):
        """Test React app URL from REACT_APP_URL setting"""
        with patch('core.config.settings') as mock_settings:
            mock_settings.dev_react_app_url = None
            mock_settings.react_app_url = 'https://prod.example.com'

            config = {}
            service = WebhookService(
                repository=mock_repository,
                catenda_client=mock_catenda,
                config=config,
                magic_link_generator=None
            )

            url = service.get_react_app_base_url()
            assert url == 'https://prod.example.com'

    def test_get_react_app_base_url_from_config(self, mock_repository, mock_catenda):
        """Test React app URL from config dict"""
        with patch('core.config.settings') as mock_settings:
            mock_settings.dev_react_app_url = None
            mock_settings.react_app_url = None

            config = {'react_app_url': 'http://config.localhost:3000'}
            service = WebhookService(
                repository=mock_repository,
                catenda_client=mock_catenda,
                config=config,
                magic_link_generator=None
            )

            url = service.get_react_app_base_url()
            assert url == 'http://config.localhost:3000'

    def test_get_react_app_base_url_fallback_to_localhost(self, mock_repository, mock_catenda):
        """Test React app URL falls back to localhost"""
        with patch('core.config.settings') as mock_settings:
            mock_settings.dev_react_app_url = None
            mock_settings.react_app_url = None

            config = {}
            service = WebhookService(
                repository=mock_repository,
                catenda_client=mock_catenda,
                config=config,
                magic_link_generator=None
            )

            url = service.get_react_app_base_url()
            assert url == 'http://localhost:3000'
