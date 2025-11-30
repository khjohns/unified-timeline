"""
Logging Configuration Module

Centralizes logging setup for the application.
"""

import logging


def setup_logging(log_file: str = 'koe_automation.log') -> logging.Logger:
    """
    Configure application logging.

    Args:
        log_file: Path to log file

    Returns:
        Logger instance
    """
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)
