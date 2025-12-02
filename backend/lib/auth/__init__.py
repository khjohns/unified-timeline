"""
Authentication and authorization utilities
"""
from .csrf_protection import require_csrf, generate_csrf_token
from .magic_link import MagicLinkManager, require_magic_link, get_magic_link_manager

__all__ = ['require_csrf', 'generate_csrf_token', 'MagicLinkManager', 'require_magic_link', 'get_magic_link_manager']
