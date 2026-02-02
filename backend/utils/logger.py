"""
Logger utility module.

Delegates to centralized logging configuration in core/logging_config.py.
Kept for backwards compatibility with existing imports.
"""
import logging
from typing import Optional


def get_logger(name: str, level: Optional[str] = None, log_format: Optional[str] = None) -> logging.Logger:
    """
    Get logger for module.

    Uses centralized logging configuration from core/logging_config.py.
    The level and log_format parameters are kept for backwards compatibility
    but are ignored - use LOG_LEVEL and LOG_FORMAT env vars instead.

    Args:
        name: Logger name (typically __name__)
        level: Deprecated - use LOG_LEVEL env var
        log_format: Deprecated - use LOG_FORMAT env var

    Returns:
        Logger instance
    """
    return logging.getLogger(name)
