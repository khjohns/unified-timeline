"""
Network Utilities Module

Helper functions for network operations.
"""

import socket


def get_local_ip() -> str:
    """
    Get the local network IP address of the machine.

    Uses socket connection to determine the local IP address used
    for outbound connections.

    Returns:
        str: Local IP address (defaults to '127.0.0.1' if unable to determine)
    """
    s = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        if s:
            s.close()
    return IP
