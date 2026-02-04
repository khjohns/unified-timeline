"""
Tests for utils/logger.py

Logger configuration tests.
"""

import logging

import pytest

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
        logger = get_logger("test_module")
        assert isinstance(logger, logging.Logger)

    def test_logger_name_matches_input(self):
        """Logger name should match the input name"""
        logger = get_logger("my.test.module")
        assert logger.name == "my.test.module"

    def test_same_name_returns_same_logger(self):
        """Same name should return same logger instance"""
        logger1 = get_logger("test_module")
        logger2 = get_logger("test_module")
        assert logger1 is logger2

    def test_different_names_return_different_loggers(self):
        """Different names should return different logger instances"""
        logger1 = get_logger("module1")
        logger2 = get_logger("module2")
        assert logger1 is not logger2
        assert logger1.name == "module1"
        assert logger2.name == "module2"

    def test_logger_can_log_messages(self):
        """Logger should be able to log messages without error"""
        logger = get_logger("test_module")
        # Should not raise exception
        logger.info("Test message")
        logger.warning("Warning message")
        logger.error("Error message")

    def test_typical_usage_pattern(self):
        """Test typical usage pattern from module"""
        # Typical usage: logger = get_logger(__name__)
        logger = get_logger(__name__)
        assert isinstance(logger, logging.Logger)
        assert logger.name == __name__

    def test_level_parameter_accepted(self):
        """Level parameter should be accepted (for backwards compatibility)"""
        # Should not raise, even though parameter is ignored
        logger = get_logger("test_module", level="DEBUG")
        assert isinstance(logger, logging.Logger)

    def test_log_format_parameter_accepted(self):
        """Log format parameter should be accepted (for backwards compatibility)"""
        # Should not raise, even though parameter is ignored
        logger = get_logger("test_module", log_format="json")
        assert isinstance(logger, logging.Logger)

    def test_hierarchical_logger_names(self):
        """Should support hierarchical logger names"""
        parent = get_logger("myapp")
        child = get_logger("myapp.submodule")
        grandchild = get_logger("myapp.submodule.component")

        assert parent.name == "myapp"
        assert child.name == "myapp.submodule"
        assert grandchild.name == "myapp.submodule.component"
