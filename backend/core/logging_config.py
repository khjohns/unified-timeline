"""
Logging Configuration Module

Centralizes logging setup for the application.
Supports both JSON (production/Azure) and text (development) formats.
"""

import logging
import os
import sys

from pythonjsonlogger import jsonlogger


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter with extra fields for Azure Application Insights."""

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record['level'] = record.levelname
        log_record['logger'] = record.name
        if record.exc_info:
            log_record['exception'] = self.formatException(record.exc_info)


def setup_logging(log_file: str = 'koe_automation.log') -> logging.Logger:
    """
    Configure application logging.

    Uses LOG_FORMAT env var or config setting to determine format:
    - "json": Structured JSON logging (production, Azure)
    - "text": Human-readable text (development)

    Args:
        log_file: Path to log file (only used in text mode)

    Returns:
        Logger instance
    """
    # Determine log format from environment (defaults to json for production)
    log_format = os.getenv('LOG_FORMAT', 'json').lower()
    log_level = os.getenv('LOG_LEVEL', 'INFO').upper()

    # Clear any existing handlers
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(getattr(logging, log_level, logging.INFO))

    if log_format == 'json':
        # JSON logging for production/Azure
        handler = logging.StreamHandler(sys.stdout)
        formatter = CustomJsonFormatter(
            '%(asctime)s %(level)s %(name)s %(message)s',
            timestamp=True
        )
        handler.setFormatter(formatter)
        root_logger.addHandler(handler)
    else:
        # Text logging for development
        logging.basicConfig(
            level=getattr(logging, log_level, logging.INFO),
            format='%(asctime)s - %(levelname)s - %(name)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )

    # Silence noisy HTTP libraries (httpx, httpcore, hpack used by Supabase)
    for noisy_logger in ['httpx', 'httpcore', 'hpack', 'h2', 'h11']:
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)

    return logging.getLogger(__name__)
