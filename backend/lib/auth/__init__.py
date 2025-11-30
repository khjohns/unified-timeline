"""
Authentication and authorization utilities
"""
from .csrf_protection import require_csrf, generate_csrf_token
from .magic_link import MagicLinkManager

__all__ = ['require_csrf', 'generate_csrf_token', 'MagicLinkManager']
