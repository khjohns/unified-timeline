"""
Authentication and authorization utilities

Supports multiple authentication methods:
- Magic Links: For external users (TE - Totalentreprenør)
- Entra ID/IDA: For internal users (BH - Byggherre/Oslobygg)
- Supabase Auth: Alternative for development
"""
from .csrf_protection import require_csrf, generate_csrf_token
from .magic_link import MagicLinkManager, require_magic_link, get_magic_link_manager
from .supabase_validator import require_supabase_auth, validate_supabase_token, get_current_user
from .entra_id import (
    EntraUser,
    validate_entra_token,
    require_entra_auth,
    require_approval_role,
    get_entra_user,
)

__all__ = [
    # CSRF
    'require_csrf',
    'generate_csrf_token',
    # Magic Links (eksterne brukere)
    'MagicLinkManager',
    'require_magic_link',
    'get_magic_link_manager',
    # Supabase Auth
    'require_supabase_auth',
    'validate_supabase_token',
    'get_current_user',
    # Entra ID / IDA (interne brukere)
    'EntraUser',
    'validate_entra_token',
    'require_entra_auth',
    'require_approval_role',
    'get_entra_user',
]
