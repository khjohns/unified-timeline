"""
Authentication and authorization utilities

Supports multiple authentication methods:
- Magic Links: For external users (TE - Totalentreprenør)
- Entra ID/IDA: For internal users (BH - Byggherre/Oslobygg)
- Supabase Auth: Alternative for development
"""

from .csrf_protection import generate_csrf_token, require_csrf
from .entra_id import (
    EntraUser,
    get_entra_user,
    require_approval_role,
    require_bh_role,
    require_entra_auth,
    validate_entra_token,
)
from .magic_link import MagicLinkManager, get_magic_link_manager, require_magic_link
from .supabase_validator import (
    get_current_user,
    require_supabase_auth,
    validate_supabase_token,
)

__all__ = [
    # CSRF
    "require_csrf",
    "generate_csrf_token",
    # Magic Links (eksterne brukere)
    "MagicLinkManager",
    "require_magic_link",
    "get_magic_link_manager",
    # Supabase Auth
    "require_supabase_auth",
    "validate_supabase_token",
    "get_current_user",
    # Entra ID / IDA (alle brukere)
    "EntraUser",
    "validate_entra_token",
    "require_entra_auth",
    "require_approval_role",
    "require_bh_role",
    "get_entra_user",
]
