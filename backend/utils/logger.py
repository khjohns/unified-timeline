"""
Centralized logging configuration for KOE Automation System.

All modules should use get_logger(__name__) to get a configured logger.
Supports both JSON (for Azure Application Insights) and text format.
"""
import logging
import sys
from pythonjsonlogger import jsonlogger
from typing import Optional


def get_logger(name: str, level: Optional[str] = None, log_format: Optional[str] = None) -> logging.Logger:
    """
    Get configured logger for module.

    Args:
        name: Logger name (typically __name__)
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: "json" or "text" (defaults to config setting)

    Returns:
        Configured logger instance

    Example:
        >>> from utils.logger import get_logger
        >>> logger = get_logger(__name__)
        >>> logger.info("Starting application", extra={"user": "admin"})
    """
    logger = logging.getLogger(name)

    # Only configure if not already configured
    if not logger.handlers:
        # Import here to avoid circular dependency
        from config import settings

        # Determine log level
        log_level = level or settings.log_level
        logger.setLevel(getattr(logging, log_level.upper()))

        # Create handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(getattr(logging, log_level.upper()))

        # Determine format
        format_type = log_format or settings.log_format

        if format_type == "json":
            # JSON format for Azure Application Insights
            formatter = jsonlogger.JsonFormatter(
                fmt='%(asctime)s %(name)s %(levelname)s %(message)s',
                datefmt='%Y-%m-%dT%H:%M:%S'
            )
        else:
            # Text format for local development
            formatter = logging.Formatter(
                fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )

        handler.setFormatter(formatter)
        logger.addHandler(handler)

        # Prevent propagation to avoid duplicate logs
        logger.propagate = False

    return logger
