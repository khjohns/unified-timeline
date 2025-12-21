"""
Event store and metadata repositories with pluggable backends.

Architecture:
    EventRepository (abstract)
        ├── JsonFileEventRepository  - Local files (prototype)
        ├── SupabaseEventRepository  - PostgreSQL (test/dev)
        └── DataverseEventRepository - Microsoft (production) [planned]

    SakMetadataRepository
        ├── SakMetadataRepository         - CSV files (prototype)
        └── SupabaseSakMetadataRepository - PostgreSQL (test/dev)

Usage:
    from repositories import create_event_repository, create_metadata_repository

    # Development (local files)
    event_repo = create_event_repository("json")
    metadata_repo = create_metadata_repository("csv")

    # Testing with Supabase
    event_repo = create_event_repository("supabase")
    metadata_repo = create_metadata_repository("supabase")

    # Auto-detect from environment (EVENT_STORE_BACKEND / METADATA_STORE_BACKEND)
    event_repo = create_event_repository()
    metadata_repo = create_metadata_repository()
"""

from .event_repository import (
    EventRepository,
    JsonFileEventRepository,
    ConcurrencyError,
)

from .supabase_event_repository import (
    SupabaseEventRepository,
    create_event_repository,
)

from .sak_metadata_repository import SakMetadataRepository

from .supabase_sak_metadata_repository import (
    SupabaseSakMetadataRepository,
    create_metadata_repository,
)

__all__ = [
    # Event repositories
    "EventRepository",
    "JsonFileEventRepository",
    "SupabaseEventRepository",
    "ConcurrencyError",
    "create_event_repository",
    # Metadata repositories
    "SakMetadataRepository",
    "SupabaseSakMetadataRepository",
    "create_metadata_repository",
]
