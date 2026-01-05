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

    # Silence noisy HTTP libraries (httpx, httpcore, hpack used by Supabase)
    for noisy_logger in ['httpx', 'httpcore', 'hpack', 'h2', 'h11']:
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)

    return logging.getLogger(__name__)
