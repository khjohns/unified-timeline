"""
Tests for utils/filtering_config.py

Topic filtering logic tests - validates filtering rules and edge cases.
"""
import pytest
from unittest.mock import patch
from utils.filtering_config import (
    should_process_topic,
    get_filter_summary,
    validate_config,
    custom_filter,
)


class TestShouldProcessTopic:
    """Test the main filtering logic function"""

    def test_empty_topic_data_passes_with_no_filters(self):
        """Empty topic should pass when all filters are None"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            should_process, reason = should_process_topic({})
            assert should_process is True
            assert reason == ""

    def test_topic_type_filter_passes_allowed_type(self):
        """Topic with allowed type should pass"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', ['Request', 'Issue']), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            topic_data = {'topic_type': 'Request'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is True

    def test_topic_type_filter_rejects_disallowed_type(self):
        """Topic with disallowed type should be rejected"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', ['Request', 'Issue']), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            topic_data = {'topic_type': 'Remark'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is False
            assert 'Topic type' in reason
            assert 'Remark' in reason

    def test_topic_type_filter_checks_both_keys(self):
        """Filter should check both 'topic_type' and 'type' keys"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', ['Request']), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            # Test with 'type' key instead of 'topic_type'
            topic_data = {'type': 'Request'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is True

    def test_board_filter_passes_allowed_board(self):
        """Topic from allowed board should pass"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', ['board-123']), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            topic_data = {'board_id': 'board-123'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is True

    def test_board_filter_rejects_disallowed_board(self):
        """Topic from disallowed board should be rejected"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', ['board-123']), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            topic_data = {'board_id': 'board-999'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is False
            assert 'Board' in reason
            assert 'board-999' in reason

    def test_board_filter_handles_missing_board_id(self):
        """Missing board_id should be rejected when filter is active"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', ['board-123']), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            topic_data = {}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is False
            assert 'Board ID mangler' in reason

    def test_board_filter_normalizes_guids(self):
        """Board filter should normalize GUIDs for comparison"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', ['ffc8413d-1ec5-4834-878b-2955db96e734']), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            # Test with non-hyphenated GUID
            topic_data = {'board_id': 'ffc8413d1ec54834878b2955db96e734'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is True

            # Test with hyphenated GUID matching allowed list
            topic_data = {'board_id': 'ffc8413d-1ec5-4834-878b-2955db96e734'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is True

    def test_keyword_filter_passes_with_keyword_in_title(self):
        """Topic with required keyword in title should pass"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', ['KOE', 'Endringsordre']), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            topic_data = {'title': 'KOE-2025-001 - New Request'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is True

    def test_keyword_filter_passes_with_keyword_in_description(self):
        """Topic with required keyword in description should pass"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', ['KOE', 'Endringsordre']), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            topic_data = {
                'title': 'Request',
                'description': 'Dette er en Endringsordre'
            }
            should_process, reason = should_process_topic(topic_data)
            assert should_process is True

    def test_keyword_filter_is_case_insensitive(self):
        """Keyword filter should be case-insensitive"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', ['KOE']), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            topic_data = {'title': 'koe-request-lowercase'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is True

    def test_keyword_filter_rejects_without_keyword(self):
        """Topic without required keywords should be rejected"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', ['KOE', 'Endringsordre']), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            topic_data = {'title': 'Some random topic'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is False
            assert 'required keywords' in reason

    def test_author_filter_passes_allowed_author(self):
        """Topic from allowed author should pass"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', ['John Doe', 'Jane Smith']), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            topic_data = {'creation_author': 'John Doe'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is True

    def test_author_filter_checks_both_keys(self):
        """Author filter should check both 'creation_author' and 'author' keys"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', ['John Doe']), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            # Test with 'author' key
            topic_data = {'author': 'John Doe'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is True

    def test_author_filter_rejects_disallowed_author(self):
        """Topic from disallowed author should be rejected"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', ['John Doe']), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            topic_data = {'creation_author': 'Unknown Person'}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is False
            assert 'Author' in reason

    def test_label_filter_passes_with_required_label(self):
        """Topic with required label should pass"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', ['KOE', 'Priority-High']):

            topic_data = {'labels': ['KOE', 'Other-Label']}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is True

    def test_label_filter_rejects_without_required_label(self):
        """Topic without required labels should be rejected"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', ['KOE']):

            topic_data = {'labels': ['Other-Label', 'Random']}
            should_process, reason = should_process_topic(topic_data)
            assert should_process is False
            assert 'required labels' in reason

    def test_custom_filter_is_called(self):
        """Custom filter function should be invoked"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None), \
             patch('utils.filtering_config.custom_filter', return_value=False) as mock_filter:

            topic_data = {'title': 'Test'}
            should_process, reason = should_process_topic(topic_data)

            mock_filter.assert_called_once_with(topic_data)
            assert should_process is False
            assert 'Custom filter' in reason

    def test_multiple_filters_all_must_pass(self):
        """All active filters must pass for topic to be processed"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', ['Request']), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', ['board-123']), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', ['KOE']), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            # All conditions met
            topic_data = {
                'topic_type': 'Request',
                'board_id': 'board-123',
                'title': 'KOE Request'
            }
            should_process, reason = should_process_topic(topic_data)
            assert should_process is True

            # One condition fails (wrong board)
            topic_data = {
                'topic_type': 'Request',
                'board_id': 'board-999',
                'title': 'KOE Request'
            }
            should_process, reason = should_process_topic(topic_data)
            assert should_process is False

    def test_handles_none_values_gracefully(self):
        """Filter should handle None values in topic_data"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', ['KOE']), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            topic_data = {
                'title': None,
                'description': None
            }
            should_process, reason = should_process_topic(topic_data)
            assert should_process is False


class TestGetFilterSummary:
    """Test filter summary generation"""

    def test_no_filters_active(self):
        """Summary should indicate no active filters"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            summary = get_filter_summary()
            assert 'Ingen filtre aktive' in summary

    def test_topic_type_filter_in_summary(self):
        """Summary should include topic type filter"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', ['Request', 'Issue']), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', None), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            summary = get_filter_summary()
            assert 'Topic types: Request, Issue' in summary

    def test_board_filter_in_summary(self):
        """Summary should include board filter"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', None), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', ['board-123', 'board-456']), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', None), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', None), \
             patch('utils.filtering_config.REQUIRED_LABELS', None):

            summary = get_filter_summary()
            assert 'Boards: board-123, board-456' in summary

    def test_multiple_filters_in_summary(self):
        """Summary should include all active filters"""
        with patch('utils.filtering_config.ALLOWED_TOPIC_TYPES', ['Request']), \
             patch('utils.filtering_config.ALLOWED_BOARD_IDS', ['board-123']), \
             patch('utils.filtering_config.REQUIRED_KEYWORDS', ['KOE']), \
             patch('utils.filtering_config.ALLOWED_AUTHORS', ['John Doe']), \
             patch('utils.filtering_config.REQUIRED_LABELS', ['Priority-High']):

            summary = get_filter_summary()
            assert 'Topic types: Request' in summary
            assert 'Boards: board-123' in summary
            assert 'Keywords: KOE' in summary
            assert 'Authors: John Doe' in summary
            assert 'Labels: Priority-High' in summary


class TestValidateConfig:
    """Test configuration validation"""

    def test_valid_config_passes(self):
        """Valid configuration should pass validation"""
        with patch('utils.filtering_config.ACTION_ON_FILTERED', 'log'), \
             patch('utils.filtering_config.EMAIL_NOTIFICATION_ON_FILTERED', False), \
             patch('utils.filtering_config.EMAIL_NOTIFICATION_ON_PROCESSED', False):

            assert validate_config() is True

    def test_invalid_action_raises_error(self):
        """Invalid ACTION_ON_FILTERED should raise ValueError"""
        with patch('utils.filtering_config.ACTION_ON_FILTERED', 'invalid_action'), \
             patch('utils.filtering_config.EMAIL_NOTIFICATION_ON_FILTERED', False), \
             patch('utils.filtering_config.EMAIL_NOTIFICATION_ON_PROCESSED', False):

            with pytest.raises(ValueError, match='ACTION_ON_FILTERED'):
                validate_config()

    def test_email_notification_without_recipients_raises_error(self):
        """Email notifications enabled without recipients should raise error"""
        with patch('utils.filtering_config.ACTION_ON_FILTERED', 'log'), \
             patch('utils.filtering_config.EMAIL_NOTIFICATION_ON_FILTERED', True), \
             patch('utils.filtering_config.EMAIL_RECIPIENTS', []):

            with pytest.raises(ValueError, match='EMAIL_RECIPIENTS'):
                validate_config()

    def test_all_valid_actions(self):
        """All valid actions should pass validation"""
        valid_actions = ["ignore", "log", "comment", "label"]

        for action in valid_actions:
            with patch('utils.filtering_config.ACTION_ON_FILTERED', action), \
                 patch('utils.filtering_config.EMAIL_NOTIFICATION_ON_FILTERED', False), \
                 patch('utils.filtering_config.EMAIL_NOTIFICATION_ON_PROCESSED', False):

                assert validate_config() is True


class TestCustomFilter:
    """Test custom filter function"""

    def test_default_custom_filter_returns_true(self):
        """Default custom filter should accept all topics"""
        result = custom_filter({'title': 'Test Topic'})
        assert result is True

    def test_custom_filter_receives_topic_data(self):
        """Custom filter should receive full topic_data dict"""
        test_data = {
            'title': 'Test',
            'type': 'Request',
            'board_id': 'board-123'
        }
        result = custom_filter(test_data)
        assert isinstance(result, bool)
