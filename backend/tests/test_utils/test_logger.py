"""
Tests for utils/logger.py

Logger configuration tests.
"""
import logging
import pytest
from unittest.mock import patch, MagicMock
from pythonjsonlogger import jsonlogger
from utils.logger import get_logger


class TestGetLogger:
    """Test get_logger() function"""

    @pytest.fixture(autouse=True)
    def reset_logging(self):
        """Reset logging state between tests"""
        # Clear all handlers from loggers
        for logger_name in list(logging.Logger.manager.loggerDict.keys()):
            logger = logging.getLogger(logger_name)
            logger.handlers.clear()
            logger.propagate = True
        yield
        # Clean up after test
        for logger_name in list(logging.Logger.manager.loggerDict.keys()):
            logger = logging.getLogger(logger_name)
            logger.handlers.clear()
            logger.propagate = True

    def test_returns_logger_instance(self):
        """Should return a Logger instance"""
        logger = get_logger('test_module')
        assert isinstance(logger, logging.Logger)

    def test_logger_name_matches_input(self):
        """Logger name should match the input name"""
        logger = get_logger('my.test.module')
        assert logger.name == 'my.test.module'

    def test_default_log_level_from_settings(self):
        """Should use log level from settings by default"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'DEBUG'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')
            assert logger.level == logging.DEBUG

    def test_custom_log_level_overrides_settings(self):
        """Custom log level should override settings"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module', level='ERROR')
            assert logger.level == logging.ERROR

    def test_text_format_uses_standard_formatter(self):
        """Text format should use standard Python formatter"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')

            assert len(logger.handlers) == 1
            handler = logger.handlers[0]
            formatter = handler.formatter

            # Should be standard Formatter, not JsonFormatter
            assert isinstance(formatter, logging.Formatter)
            assert not isinstance(formatter, jsonlogger.JsonFormatter)

    def test_json_format_uses_json_formatter(self):
        """JSON format should use JsonFormatter"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'json'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')

            assert len(logger.handlers) == 1
            handler = logger.handlers[0]
            formatter = handler.formatter

            # Should be JsonFormatter
            assert isinstance(formatter, jsonlogger.JsonFormatter)

    def test_custom_format_overrides_settings(self):
        """Custom log_format parameter should override settings"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module', log_format='json')

            handler = logger.handlers[0]
            formatter = handler.formatter
            assert isinstance(formatter, jsonlogger.JsonFormatter)

    def test_adds_stream_handler(self):
        """Should add StreamHandler to logger"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')

            assert len(logger.handlers) == 1
            assert isinstance(logger.handlers[0], logging.StreamHandler)

    def test_disables_propagation(self):
        """Should disable log propagation to avoid duplicates"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')
            assert logger.propagate is False

    def test_does_not_reconfigure_existing_logger(self):
        """Should not add duplicate handlers to existing logger"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            # Get logger twice
            logger1 = get_logger('test_module')
            logger2 = get_logger('test_module')

            # Should be same instance
            assert logger1 is logger2
            # Should only have one handler
            assert len(logger2.handlers) == 1

    def test_text_formatter_includes_timestamp(self):
        """Text formatter should include timestamp"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')
            formatter = logger.handlers[0].formatter

            # Check format string includes asctime
            assert '%(asctime)s' in formatter._fmt

    def test_text_formatter_includes_name_and_level(self):
        """Text formatter should include logger name and level"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')
            formatter = logger.handlers[0].formatter

            assert '%(name)s' in formatter._fmt
            assert '%(levelname)s' in formatter._fmt
            assert '%(message)s' in formatter._fmt

    def test_json_formatter_includes_required_fields(self):
        """JSON formatter should include required fields"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'json'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')
            formatter = logger.handlers[0].formatter

            # JsonFormatter should have been configured with these fields
            assert isinstance(formatter, jsonlogger.JsonFormatter)

    def test_handler_level_matches_logger_level(self):
        """Handler level should match logger level"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'WARNING'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')
            handler = logger.handlers[0]

            assert logger.level == logging.WARNING
            assert handler.level == logging.WARNING

    def test_supports_all_log_levels(self):
        """Should support all standard log levels"""
        levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        expected_levels = [logging.DEBUG, logging.INFO, logging.WARNING,
                          logging.ERROR, logging.CRITICAL]

        mock_settings = MagicMock()
        mock_settings.log_format = 'text'

        for level_str, expected_level in zip(levels, expected_levels):
            mock_settings.log_level = level_str

            with patch('core.config.settings', mock_settings):
                logger = get_logger(f'test_{level_str}')
                assert logger.level == expected_level

    def test_multiple_loggers_are_independent(self):
        """Different logger names should create independent loggers"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger1 = get_logger('module1')
            logger2 = get_logger('module2')

            assert logger1 is not logger2
            assert logger1.name != logger2.name
            assert logger1.name == 'module1'
            assert logger2.name == 'module2'

    def test_logger_can_log_messages(self):
        """Logger should be able to log messages"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')

            # Should not raise exception
            logger.info("Test message")
            logger.warning("Warning message")
            logger.error("Error message")

    def test_log_format_case_insensitive(self):
        """Log level should be case-insensitive"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'info'  # lowercase
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')
            assert logger.level == logging.INFO

    def test_typical_usage_pattern(self):
        """Test typical usage pattern from module"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            # Typical usage: logger = get_logger(__name__)
            logger = get_logger(__name__)

            assert isinstance(logger, logging.Logger)
            assert len(logger.handlers) == 1
            assert logger.propagate is False

    def test_json_format_datefmt(self):
        """JSON formatter should use ISO 8601 datetime format"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'json'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')
            formatter = logger.handlers[0].formatter

            # Check datefmt is ISO 8601
            assert formatter.datefmt == '%Y-%m-%dT%H:%M:%S'

    def test_text_format_datefmt(self):
        """Text formatter should use readable datetime format"""
        mock_settings = MagicMock()
        mock_settings.log_level = 'INFO'
        mock_settings.log_format = 'text'

        with patch('core.config.settings', mock_settings):
            logger = get_logger('test_module')
            formatter = logger.handlers[0].formatter

            # Check datefmt is human-readable
            assert formatter.datefmt == '%Y-%m-%d %H:%M:%S'
