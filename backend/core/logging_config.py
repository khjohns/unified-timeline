"""
Logging Configuration Module

Centralizes logging setup for the application.
Supports both JSON (production/Azure) and text (development) formats.
"""

import logging
import os
import sys

from pythonjsonlogger import jsonlogger


# ANSI color codes
class Colors:
    RESET = "\033[0m"
    DIM = "\033[2m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"


class ColoredFormatter(logging.Formatter):
    """Colored log formatter for terminal output."""

    LEVEL_COLORS = {
        logging.DEBUG: Colors.DIM,
        logging.INFO: Colors.GREEN,
        logging.WARNING: Colors.YELLOW,
        logging.ERROR: Colors.RED,
        logging.CRITICAL: Colors.MAGENTA,
    }

    def format(self, record):
        # Color the level name
        color = self.LEVEL_COLORS.get(record.levelno, Colors.RESET)
        record.levelname = f"{color}{record.levelname:<8}{Colors.RESET}"
        # Dim the logger name
        record.name = f"{Colors.DIM}{record.name}{Colors.RESET}"
        # Add request_id with color
        request_id = getattr(record, 'request_id', '-')
        if request_id != '-':
            record.request_id = f"{Colors.CYAN}[{request_id}]{Colors.RESET}"
        else:
            record.request_id = ''
        return super().format(record)


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter with extra fields for Azure Application Insights."""

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record['level'] = record.levelname
        log_record['logger'] = record.name
        log_record['request_id'] = getattr(record, 'request_id', None)
        if record.exc_info:
            log_record['exception'] = self.formatException(record.exc_info)


def setup_logging(log_file: str = 'unified_timeline.log') -> logging.Logger:
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

    # Add request ID filter to root logger (lazy import to avoid circular deps)
    try:
        from core.request_context import RequestIdFilter
        root_logger.addFilter(RequestIdFilter())
    except ImportError:
        pass  # Request context not available yet

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
        log_fmt = '%(asctime)s  %(levelname)s  %(request_id)s  %(name)s  %(message)s'
        date_fmt = '%H:%M:%S'

        # Console handler with colors
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(ColoredFormatter(log_fmt, datefmt=date_fmt))

        # File handler without colors (simpler format)
        file_fmt = '%(asctime)s  %(levelname)s  [%(request_id)s]  %(name)s  %(message)s'
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(logging.Formatter(file_fmt, datefmt=date_fmt))

        root_logger.addHandler(console_handler)
        root_logger.addHandler(file_handler)

    # Silence noisy HTTP libraries (httpx, httpcore, hpack used by Supabase)
    for noisy_logger in ['httpx', 'httpcore', 'hpack', 'h2', 'h11']:
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)

    return logging.getLogger(__name__)
