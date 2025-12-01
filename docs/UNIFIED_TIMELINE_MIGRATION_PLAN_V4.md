# Unified Timeline Migration Plan v4

> **Status:** READY FOR IMPLEMENTATION
> **Version:** 4.0
> **Created:** 2025-12-01
> **Last Updated:** 2025-12-01
> **Approach:** Greenfield (No Legacy Migration)
> **Changes from v3:** Critical fixes for production readiness (prerequisites, performance, platform compatibility)

---

## Executive Summary

This document specifies the complete migration from a mutable document model to an **Event Sourcing Light** architecture. Since we are in prototype/dev phase with no active users, we take a **greenfield approach**:

- **DELETE** legacy UI components instead of adapting them
- **NO** data migration from old format
- **FULL** freedom for breaking changes

### The Core Problem We're Solving

Today's revision-based model creates "deadlocks" in negotiations:
```
┌─────────────────────────────────────────────────────────┐
│ CURRENT: Must approve/reject entire revision            │
│                                                         │
│  KoeRevisjon v1 ─────────────────────────────────────► │
│  ├─ Grunnlag: "Grunnforhold avvik"     ✓ Agree         │
│  ├─ Vederlag: 500,000 NOK              ✗ Dispute       │
│  └─ Frist: 14 dager                    ✓ Agree         │
│                                                         │
│  BH MUST reject entire revision even though they       │
│  agree on 2 of 3 items → DEADLOCK                      │
└─────────────────────────────────────────────────────────┘
```

**Solution: Three Independent Tracks (Spor)**
```
┌─────────────────────────────────────────────────────────┐
│ NEW: Each track processed independently                 │
│                                                         │
│  GRUNNLAG ──► BH: GODKJENT ──► LOCKED ✓                │
│                                                         │
│  VEDERLAG ──► BH: DELVIS ──► TE: v2 ──► BH: GODKJENT  │
│                                                         │
│  FRIST ─────► BH: GODKJENT ✓                           │
│                                                         │
│  Partial agreement unlocked! No more deadlocks.        │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture Decision Record

### Why Event Sourcing Light?

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Event Sourcing Light** | Natural audit trail, temporal queries, parallel tracks | Learning curve, replay latency | ✅ **CHOSEN** |
| Relational + Status Columns | Familiar, simple queries | Dual-write complexity, manual history tracking | ❌ More complex for this use case |
| Full Event Sourcing | CQRS, projections, snapshots | Over-engineered for prototype | ❌ Too heavy |

**Key Constraints:**
- Python/Azure Functions (stateless compute)
- JSON file storage initially (can upgrade to Cosmos DB)
- React frontend with Punkt design system
- Must integrate with Catenda (webhooks, comments)
- **Frontend constraint:** Single case view (navigation via Catenda) - eliminates list performance concerns

---

## Phase 0: Prerequisites (MUST COMPLETE FIRST)

Before implementing Phase 1, we need to create missing infrastructure components.

### 0.1 Magic Link Decorator

**Problem:** Plan references `require_magic_link` decorator that doesn't exist.

```python
# backend/lib/auth/magic_link.py (ADD TO EXISTING FILE)
"""
Magic link authentication decorator.
"""
from functools import wraps
from flask import request, jsonify

# Singleton instance (reuse existing MagicLinkManager)
_magic_link_manager = None

def get_magic_link_manager():
    global _magic_link_manager
    if _magic_link_manager is None:
        _magic_link_manager = MagicLinkManager()
    return _magic_link_manager


def require_magic_link(f):
    """
    Dekoratør som krever gyldig magic link token.

    Token må sendes i Authorization header som Bearer token.
    Ved suksess legges token-data i request.magic_link_data.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Hent token fra Authorization header
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '').strip()

        if not token:
            return jsonify({
                "success": False,
                "error": "UNAUTHORIZED",
                "message": "Mangler magic link token"
            }), 401

        # Verifiser token
        manager = get_magic_link_manager()
        valid, message, data = manager.verify(token)

        if not valid:
            return jsonify({
                "success": False,
                "error": "UNAUTHORIZED",
                "message": f"Ugyldig token: {message}"
            }), 401

        # Legg token-data i request context
        request.magic_link_data = data

        return f(*args, **kwargs)

    return decorated_function
```

**Update exports:**
```python
# backend/lib/auth/__init__.py
from .csrf_protection import require_csrf, generate_csrf_token
from .magic_link import MagicLinkManager, require_magic_link

__all__ = ['require_csrf', 'generate_csrf_token', 'MagicLinkManager', 'require_magic_link']
```

### 0.2 SakMetadata Repository

```python
# backend/repositories/sak_metadata_repository.py (NEW)
"""
Repository for lightweight case metadata with cached fields.
"""
import csv
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from models.sak_metadata import SakMetadata
from threading import RLock


class SakMetadataRepository:
    """
    Manages case metadata in CSV format.

    Handles cache updates when events are created.
    """

    def __init__(self, csv_path: str = "koe_data/saker.csv"):
        self.csv_path = Path(csv_path)
        self.lock = RLock()
        self.csv_path.parent.mkdir(parents=True, exist_ok=True)

        # Ensure file exists with headers
        if not self.csv_path.exists():
            with open(self.csv_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'sak_id', 'prosjekt_id', 'catenda_topic_id',
                    'catenda_project_id', 'created_at', 'created_by',
                    '_cached_title', '_cached_status', '_last_event_at'
                ])

    def create(self, metadata: SakMetadata) -> None:
        """Create new case metadata entry."""
        with self.lock:
            with open(self.csv_path, 'a', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    metadata.sak_id,
                    metadata.prosjekt_id or '',
                    metadata.catenda_topic_id or '',
                    metadata.catenda_project_id or '',
                    metadata.created_at.isoformat(),
                    metadata.created_by,
                    metadata._cached_title or '',
                    metadata._cached_status or '',
                    metadata._last_event_at.isoformat() if metadata._last_event_at else ''
                ])

    def get(self, sak_id: str) -> Optional[SakMetadata]:
        """Get case metadata by ID."""
        with self.lock:
            if not self.csv_path.exists():
                return None

            with open(self.csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['sak_id'] == sak_id:
                        return SakMetadata(
                            sak_id=row['sak_id'],
                            prosjekt_id=row['prosjekt_id'] or None,
                            catenda_topic_id=row['catenda_topic_id'] or None,
                            catenda_project_id=row['catenda_project_id'] or None,
                            created_at=datetime.fromisoformat(row['created_at']),
                            created_by=row['created_by'],
                            _cached_title=row['_cached_title'] or None,
                            _cached_status=row['_cached_status'] or None,
                            _last_event_at=datetime.fromisoformat(row['_last_event_at']) if row['_last_event_at'] else None
                        )
            return None

    def update_cache(
        self,
        sak_id: str,
        cached_title: Optional[str] = None,
        cached_status: Optional[str] = None,
        last_event_at: Optional[datetime] = None
    ) -> None:
        """
        Update cached fields for a case.

        Called after every event submission to keep metadata in sync.
        """
        with self.lock:
            if not self.csv_path.exists():
                return

            # Read all rows
            rows = []
            with open(self.csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                for row in reader:
                    if row['sak_id'] == sak_id:
                        # Update cached fields
                        if cached_title is not None:
                            row['_cached_title'] = cached_title
                        if cached_status is not None:
                            row['_cached_status'] = cached_status
                        if last_event_at is not None:
                            row['_last_event_at'] = last_event_at.isoformat()
                    rows.append(row)

            # Write back
            with open(self.csv_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)

    def list_all(self) -> List[SakMetadata]:
        """List all cases (for case list view)."""
        with self.lock:
            if not self.csv_path.exists():
                return []

            cases = []
            with open(self.csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cases.append(SakMetadata(
                        sak_id=row['sak_id'],
                        prosjekt_id=row['prosjekt_id'] or None,
                        catenda_topic_id=row['catenda_topic_id'] or None,
                        catenda_project_id=row['catenda_project_id'] or None,
                        created_at=datetime.fromisoformat(row['created_at']),
                        created_by=row['created_by'],
                        _cached_title=row['_cached_title'] or None,
                        _cached_status=row['_cached_status'] or None,
                        _last_event_at=datetime.fromisoformat(row['_last_event_at']) if row['_last_event_at'] else None
                    ))
            return cases
```

### 0.3 Platform Compatibility Check

**Decision:** For Phase 1, we **require Linux/Unix for backend development**.

Add to README:

```markdown
## Platform Requirements

**Backend Development:**
- **Supported:** Linux, macOS, WSL2 on Windows
- **Not Supported:** Native Windows (due to file locking with `fcntl`)

**Frontend Development:**
- All platforms supported

**Production Deployment:**
- Azure Functions (Linux-based)
```

**Rationale:**
- `fcntl` is Unix-only but provides robust file locking
- Azure Functions runs on Linux (production environment)
- WSL2 is available for Windows developers
- Documenting this is cleaner than maintaining dual locking implementations

---

## Phase 1: Backend Foundation

### 1.1 Simplified Data Model

**CRITICAL:** The `Sak` table becomes metadata-only. All business data lives in events.

```python
# backend/models/sak_metadata.py (NEW - replaces parts of sak.py)
"""
Minimal Sak metadata. All actual data computed from events.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class SakMetadata(BaseModel):
    """
    Lightweight case metadata for indexing/lookup only.

    IMPORTANT: NO business data here. All amounts, descriptions,
    statuses are computed from events via TimelineService.
    """
    sak_id: str = Field(..., description="Case ID (e.g., KOE-20251201-001)")
    prosjekt_id: Optional[str] = Field(default=None)
    catenda_topic_id: Optional[str] = Field(default=None)
    catenda_project_id: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)
    created_by: str = Field(default="system")

    # Denormalized for list queries ONLY (updated on each event)
    # These are convenience fields, source of truth is always events
    _cached_title: Optional[str] = None
    _cached_status: Optional[str] = None
    _last_event_at: Optional[datetime] = None
```

**Files to DELETE (not deprecate):**
```
backend/models/koe_revisjon.py    # DELETE
backend/models/bh_svar.py         # DELETE
backend/services/koe_service.py   # DELETE
backend/services/svar_service.py  # DELETE
backend/routes/koe_routes.py      # DELETE
backend/routes/svar_routes.py     # DELETE
koe_data/form_data/*.json         # DELETE ALL
```

### 1.2 Event Repository with Optimistic Locking

```python
# backend/repositories/event_repository.py (NEW)
"""
Event store with optimistic concurrency control.

Platform: Requires Linux/macOS/WSL2 (uses fcntl for file locking)
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
from pathlib import Path
import json
import fcntl  # Unix-only - see platform requirements
from datetime import datetime
from models.events import AnyEvent, parse_event

class ConcurrencyError(Exception):
    """Kastes når expected_version ikke matcher faktisk versjon."""
    def __init__(self, expected: int, actual: int):
        self.expected = expected
        self.actual = actual
        super().__init__(f"Versjonskonflikt: forventet {expected}, fikk {actual}")


class EventRepository(ABC):
    """Abstract event store with optimistic locking."""

    @abstractmethod
    def append(self, event: AnyEvent, expected_version: int) -> int:
        """
        Append event with optimistic concurrency control.

        Args:
            event: The event to append
            expected_version: Expected current version (0 for new case)

        Returns:
            New version number

        Raises:
            ConcurrencyError: If expected_version != current version
        """
        pass

    @abstractmethod
    def append_batch(self, events: List[AnyEvent], expected_version: int) -> int:
        """
        Atomically append multiple events.

        All events must be for the same sak_id.
        Either all succeed or none are persisted.
        """
        pass

    @abstractmethod
    def get_events(self, sak_id: str) -> Tuple[List[AnyEvent], int]:
        """
        Get all events and current version for a case.

        Returns:
            Tuple of (events_list, current_version)
        """
        pass


class JsonFileEventRepository(EventRepository):
    """
    JSON file-based event store with file locking.

    Storage format per case:
    {
        "version": 5,
        "events": [...]
    }
    """

    def __init__(self, base_path: str = "koe_data/events"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, sak_id: str) -> Path:
        # Sanitize sak_id for filesystem
        safe_id = sak_id.replace("/", "_").replace("\\", "_")
        return self.base_path / f"{safe_id}.json"

    def _load_with_lock(self, sak_id: str) -> Tuple[dict, any]:
        """Load data with exclusive lock, returns (data, file_handle)."""
        file_path = self._get_file_path(sak_id)

        if not file_path.exists():
            return {"version": 0, "events": []}, None

        f = open(file_path, 'r+', encoding='utf-8')
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        data = json.load(f)
        return data, f

    def append(self, event: AnyEvent, expected_version: int) -> int:
        return self.append_batch([event], expected_version)

    def append_batch(self, events: List[AnyEvent], expected_version: int) -> int:
        """
        Atomic batch append with optimistic locking.

        Uses file locking to ensure atomicity.
        """
        if not events:
            raise ValueError("Kan ikke legge til tom event-liste")

        sak_id = events[0].sak_id
        if not all(e.sak_id == sak_id for e in events):
            raise ValueError("Alle events må tilhøre samme sak_id")

        file_path = self._get_file_path(sak_id)

        # Create new file for version 0
        if expected_version == 0:
            if file_path.exists():
                raise ConcurrencyError(0, self._get_current_version(sak_id))

            data = {
                "version": len(events),
                "events": [e.model_dump(mode='json') for e in events]
            }

            # Write atomically
            temp_path = file_path.with_suffix('.tmp')
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
            temp_path.rename(file_path)

            return len(events)

        # Existing file - lock and update
        data, f = self._load_with_lock(sak_id)

        try:
            current_version = data.get("version", 0)

            if current_version != expected_version:
                raise ConcurrencyError(expected_version, current_version)

            # Append events
            for event in events:
                data["events"].append(event.model_dump(mode='json'))

            new_version = current_version + len(events)
            data["version"] = new_version

            # Write atomically
            temp_path = file_path.with_suffix('.tmp')
            with open(temp_path, 'w', encoding='utf-8') as tf:
                json.dump(data, tf, ensure_ascii=False, indent=2, default=str)
            temp_path.rename(file_path)

            return new_version

        finally:
            if f:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                f.close()

    def get_events(self, sak_id: str) -> Tuple[List[AnyEvent], int]:
        file_path = self._get_file_path(sak_id)

        if not file_path.exists():
            return [], 0

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        events = [parse_event(e) for e in data.get("events", [])]
        version = data.get("version", len(events))

        return events, version

    def _get_current_version(self, sak_id: str) -> int:
        _, version = self.get_events(sak_id)
        return version
```

### 1.3 Event Parsing Function

Add to `backend/models/events.py`:

```python
# Add at bottom of events.py

def parse_event(data: dict) -> AnyEvent:
    """
    Parse a dict into the correct event type.

    Uses event_type field to determine which model to instantiate.
    """
    event_type = data.get("event_type")

    if not event_type:
        raise ValueError("Mangler event_type i event-data")

    # Map event types to classes
    type_map = {
        EventType.SAK_OPPRETTET.value: SakOpprettetEvent,
        EventType.GRUNNLAG_OPPRETTET.value: GrunnlagEvent,
        EventType.GRUNNLAG_OPPDATERT.value: GrunnlagEvent,
        EventType.GRUNNLAG_TRUKKET.value: GrunnlagEvent,
        EventType.VEDERLAG_KRAV_SENDT.value: VederlagEvent,
        EventType.VEDERLAG_KRAV_OPPDATERT.value: VederlagEvent,
        EventType.VEDERLAG_KRAV_TRUKKET.value: VederlagEvent,
        EventType.FRIST_KRAV_SENDT.value: FristEvent,
        EventType.FRIST_KRAV_OPPDATERT.value: FristEvent,
        EventType.FRIST_KRAV_TRUKKET.value: FristEvent,
        EventType.RESPONS_GRUNNLAG.value: ResponsEvent,
        EventType.RESPONS_VEDERLAG.value: ResponsEvent,
        EventType.RESPONS_FRIST.value: ResponsEvent,
        EventType.EO_UTSTEDT.value: EOUtstedtEvent,
    }

    event_class = type_map.get(event_type)
    if not event_class:
        raise ValueError(f"Ukjent event_type: {event_type}")

    return event_class.model_validate(data)


def parse_event_from_request(request_data: dict) -> AnyEvent:
    """
    Parse API request into event, adding server-side fields.

    SECURITY: Validates that client doesn't send server-controlled fields.

    Adds:
    - event_id (generated)
    - tidsstempel (server time)
    """
    from uuid import uuid4

    # SIKKERHET: Blokker klient-kontrollerte felter
    forbidden_fields = {'event_id', 'tidsstempel'}
    for field in forbidden_fields:
        if field in request_data:
            raise ValueError(
                f"Feltet '{field}' kan ikke sendes av klient - genereres av server"
            )

    # Add server-controlled fields
    request_data["event_id"] = str(uuid4())
    request_data["tidsstempel"] = datetime.now().isoformat()

    return parse_event(request_data)
```

### 1.4 API Routes with Concurrency Control

```python
# backend/routes/event_routes.py (NEW)
"""
Event submission API with optimistic concurrency control.
"""
from flask import Blueprint, request, jsonify
from services.timeline_service import TimelineService
from services.business_rules import BusinessRuleValidator
from repositories.event_repository import JsonFileEventRepository, ConcurrencyError
from repositories.sak_metadata_repository import SakMetadataRepository
from models.events import parse_event_from_request
from lib.auth import require_csrf, require_magic_link
from datetime import datetime

events_bp = Blueprint('events', __name__)

# Dependencies (consider DI container for production)
event_repo = JsonFileEventRepository()
metadata_repo = SakMetadataRepository()
timeline_service = TimelineService()
validator = BusinessRuleValidator()


@events_bp.route('/api/events', methods=['POST'])
@require_csrf
@require_magic_link
def submit_event():
    """
    Submit a single event.

    Request:
    {
        "event_type": "vederlag_krav_sendt",
        "sak_id": "KOE-20251201-001",
        "expected_version": 3,
        "aktor": "ola.nordmann@example.com",
        "aktor_rolle": "TE",
        "data": { ... }
    }

    Response 201:
    {
        "success": true,
        "event_id": "uuid",
        "new_version": 4,
        "state": { ... computed SakState ... }
    }

    Response 409 (Conflict):
    {
        "success": false,
        "error": "VERSION_CONFLICT",
        "expected_version": 3,
        "current_version": 5,
        "message": "Tilstanden har endret seg. Vennligst last inn på nytt."
    }
    """
    try:
        data = request.json
        expected_version = data.pop('expected_version', None)

        if expected_version is None:
            return jsonify({
                "success": False,
                "error": "MISSING_VERSION",
                "message": "expected_version er påkrevd"
            }), 400

        # 1. Parse event (validates server-controlled fields)
        event = parse_event_from_request(data)

        # 2. Load current state for validation
        existing_events, current_version = event_repo.get_events(event.sak_id)

        # 3. Validate expected version BEFORE business rules
        if current_version != expected_version:
            return jsonify({
                "success": False,
                "error": "VERSION_CONFLICT",
                "expected_version": expected_version,
                "current_version": current_version,
                "message": "Tilstanden har endret seg. Vennligst last inn på nytt."
            }), 409

        # 4. Compute current state and validate business rules
        if existing_events:
            current_state = timeline_service.compute_state(existing_events)
            validation = validator.validate(event, current_state)

            if not validation.is_valid:
                return jsonify({
                    "success": False,
                    "error": "BUSINESS_RULE_VIOLATION",
                    "rule": validation.violated_rule,
                    "message": validation.message
                }), 400

        # 5. Persist event (with optimistic lock)
        try:
            new_version = event_repo.append(event, expected_version)
        except ConcurrencyError as e:
            return jsonify({
                "success": False,
                "error": "VERSION_CONFLICT",
                "expected_version": e.expected,
                "current_version": e.actual,
                "message": "Samtidig endring oppdaget. Vennligst last inn på nytt."
            }), 409

        # 6. Compute new state
        all_events = existing_events + [event]
        new_state = timeline_service.compute_state(all_events)

        # 7. Update cached metadata
        metadata_repo.update_cache(
            sak_id=event.sak_id,
            cached_title=new_state.sakstittel,
            cached_status=new_state.overordnet_status,
            last_event_at=datetime.now()
        )

        # 8. Return success with new state
        return jsonify({
            "success": True,
            "event_id": event.event_id,
            "new_version": new_version,
            "state": new_state.model_dump(mode='json')
        }), 201

    except ValueError as e:
        return jsonify({
            "success": False,
            "error": "VALIDATION_ERROR",
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": str(e)
        }), 500


@events_bp.route('/api/events/batch', methods=['POST'])
@require_csrf
@require_magic_link
def submit_batch():
    """
    Submit multiple events atomically.

    Used for initial case creation where Grunnlag + Vederlag + Frist
    are submitted together.

    Request:
    {
        "sak_id": "KOE-20251201-001",
        "expected_version": 0,
        "events": [
            { "event_type": "sak_opprettet", ... },
            { "event_type": "grunnlag_opprettet", ... },
            { "event_type": "vederlag_krav_sendt", ... }
        ]
    }

    ATOMICITY: All events are persisted in a single transaction.
    If any validation fails, NONE are persisted.
    """
    try:
        data = request.json
        sak_id = data.get('sak_id')
        expected_version = data.get('expected_version')
        event_datas = data.get('events', [])

        if not sak_id or expected_version is None or not event_datas:
            return jsonify({
                "success": False,
                "error": "INVALID_REQUEST",
                "message": "sak_id, expected_version og events[] er påkrevd"
            }), 400

        # 1. Parse all events
        events = []
        for ed in event_datas:
            ed['sak_id'] = sak_id  # Ensure consistent sak_id
            events.append(parse_event_from_request(ed))

        # 2. Load current state
        existing_events, current_version = event_repo.get_events(sak_id)

        # 3. Validate version
        if current_version != expected_version:
            return jsonify({
                "success": False,
                "error": "VERSION_CONFLICT",
                "expected_version": expected_version,
                "current_version": current_version,
                "message": "Tilstanden har endret seg. Vennligst last inn på nytt."
            }), 409

        # 4. Validate business rules for EACH event in sequence
        if existing_events:
            state = timeline_service.compute_state(existing_events)
        else:
            state = None

        validated_events = []
        for event in events:
            if state:
                validation = validator.validate(event, state)
                if not validation.is_valid:
                    return jsonify({
                        "success": False,
                        "error": "BUSINESS_RULE_VIOLATION",
                        "rule": validation.violated_rule,
                        "message": validation.message,
                        "failed_event_type": event.event_type.value
                    }), 400

            validated_events.append(event)

            # Simulate state after this event for next validation
            if state:
                state = timeline_service.compute_state(
                    existing_events + validated_events
                )

        # 5. Persist ALL events atomically
        try:
            new_version = event_repo.append_batch(events, expected_version)
        except ConcurrencyError as e:
            return jsonify({
                "success": False,
                "error": "VERSION_CONFLICT",
                "expected_version": e.expected,
                "current_version": e.actual,
                "message": "Samtidig endring oppdaget. Vennligst last inn på nytt."
            }), 409

        # 6. Compute final state
        all_events = existing_events + events
        final_state = timeline_service.compute_state(all_events)

        # 7. Update cached metadata
        metadata_repo.update_cache(
            sak_id=sak_id,
            cached_title=final_state.sakstittel,
            cached_status=final_state.overordnet_status,
            last_event_at=datetime.now()
        )

        return jsonify({
            "success": True,
            "event_ids": [e.event_id for e in events],
            "new_version": new_version,
            "state": final_state.model_dump(mode='json')
        }), 201

    except Exception as e:
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": str(e)
        }), 500


@events_bp.route('/api/case/<sak_id>/state', methods=['GET'])
@require_magic_link
def get_case_state(sak_id: str):
    """
    Get computed state for a case.

    Response includes version for optimistic locking.
    """
    events, version = event_repo.get_events(sak_id)

    if not events:
        return jsonify({"error": "Sak ikke funnet"}), 404

    state = timeline_service.compute_state(events)

    return jsonify({
        "version": version,
        "state": state.model_dump(mode='json')
    })


@events_bp.route('/api/case/<sak_id>/timeline', methods=['GET'])
@require_magic_link
def get_case_timeline(sak_id: str):
    """
    Get full event timeline for UI display.
    """
    events, version = event_repo.get_events(sak_id)

    if not events:
        return jsonify({"error": "Sak ikke funnet"}), 404

    timeline = timeline_service.get_timeline(events)

    return jsonify({
        "version": version,
        "events": timeline
    })
```

### 1.5 Business Rule Validators

```python
# backend/services/business_rules.py (NEW)
"""
Business rule validation before event persistence.

All rules are validated BEFORE events are stored.
This ensures the event log never contains invalid state transitions.
"""
from dataclasses import dataclass
from typing import Optional, List, Callable
from models.events import AnyEvent, EventType, SporStatus
from models.sak_state import SakState


@dataclass
class ValidationResult:
    is_valid: bool
    message: Optional[str] = None
    violated_rule: Optional[str] = None


class BusinessRuleValidator:
    """
    Validates business rules before allowing events to be persisted.

    Rules are implemented as pure functions that take (event, state)
    and return ValidationResult.
    """

    def validate(self, event: AnyEvent, current_state: SakState) -> ValidationResult:
        """
        Run all applicable rules for the given event type.
        Returns first violation found, or success if all pass.
        """
        rules = self._get_rules_for_event(event.event_type)

        for rule_name, rule_fn in rules:
            result = rule_fn(event, current_state)
            if not result.is_valid:
                result.violated_rule = rule_name
                return result

        return ValidationResult(is_valid=True)

    def _get_rules_for_event(self, event_type: EventType) -> List[tuple]:
        """Map event types to applicable rules."""

        # Rules that apply to all events
        common_rules = [
            ("ROLE_CHECK", self._rule_role_check),
            ("CASE_NOT_CLOSED", self._rule_case_not_closed),
        ]

        # Event-specific rules
        specific_rules = {
            # Vederlag/Frist requires Grunnlag to be sent
            EventType.VEDERLAG_KRAV_SENDT: [
                ("GRUNNLAG_REQUIRED", self._rule_grunnlag_required),
            ],
            EventType.VEDERLAG_KRAV_OPPDATERT: [
                ("GRUNNLAG_REQUIRED", self._rule_grunnlag_required),
                ("ACTIVE_CLAIM_EXISTS", self._rule_active_vederlag_exists),
            ],
            EventType.FRIST_KRAV_SENDT: [
                ("GRUNNLAG_REQUIRED", self._rule_grunnlag_required),
            ],
            EventType.FRIST_KRAV_OPPDATERT: [
                ("GRUNNLAG_REQUIRED", self._rule_grunnlag_required),
                ("ACTIVE_CLAIM_EXISTS", self._rule_active_frist_exists),
            ],

            # BH responses require track to be sent
            EventType.RESPONS_GRUNNLAG: [
                ("TRACK_SENT", self._rule_grunnlag_sent),
                ("NOT_LOCKED", self._rule_grunnlag_not_locked),
            ],
            EventType.RESPONS_VEDERLAG: [
                ("TRACK_SENT", self._rule_vederlag_sent),
            ],
            EventType.RESPONS_FRIST: [
                ("TRACK_SENT", self._rule_frist_sent),
            ],

            # EO requires all tracks approved
            EventType.EO_UTSTEDT: [
                ("ALL_APPROVED", self._rule_all_approved_for_eo),
            ],

            # Cannot update locked grunnlag
            EventType.GRUNNLAG_OPPDATERT: [
                ("NOT_LOCKED", self._rule_grunnlag_not_locked),
            ],
        }

        return common_rules + specific_rules.get(event_type, [])

    # ========== COMMON RULES ==========

    def _rule_role_check(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Actor role must match allowed roles for event type."""
        te_only_events = {
            EventType.GRUNNLAG_OPPRETTET, EventType.GRUNNLAG_OPPDATERT,
            EventType.GRUNNLAG_TRUKKET,
            EventType.VEDERLAG_KRAV_SENDT, EventType.VEDERLAG_KRAV_OPPDATERT,
            EventType.VEDERLAG_KRAV_TRUKKET,
            EventType.FRIST_KRAV_SENDT, EventType.FRIST_KRAV_OPPDATERT,
            EventType.FRIST_KRAV_TRUKKET,
        }

        bh_only_events = {
            EventType.RESPONS_GRUNNLAG, EventType.RESPONS_VEDERLAG,
            EventType.RESPONS_FRIST, EventType.EO_UTSTEDT,
        }

        if event.event_type in te_only_events and event.aktor_rolle != "TE":
            return ValidationResult(
                is_valid=False,
                message="Kun TE kan utføre denne handlingen"
            )

        if event.event_type in bh_only_events and event.aktor_rolle != "BH":
            return ValidationResult(
                is_valid=False,
                message="Kun BH kan utføre denne handlingen"
            )

        return ValidationResult(is_valid=True)

    def _rule_case_not_closed(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Cannot modify a closed case."""
        closed_statuses = {"OMFORENT", "LUKKET", "LUKKET_TRUKKET"}

        if state.overordnet_status in closed_statuses:
            # Allow only viewing, not modifications
            return ValidationResult(
                is_valid=False,
                message="Saken er lukket og kan ikke endres"
            )

        return ValidationResult(is_valid=True)

    # ========== GRUNNLAG RULES ==========

    def _rule_grunnlag_required(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Vederlag/Frist requires Grunnlag to be at least SENT."""
        invalid_statuses = {SporStatus.IKKE_RELEVANT, SporStatus.UTKAST}

        if state.grunnlag.status in invalid_statuses:
            return ValidationResult(
                is_valid=False,
                message="Grunnlag må være sendt før du kan sende krav"
            )

        return ValidationResult(is_valid=True)

    def _rule_grunnlag_sent(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Cannot respond to unsent grunnlag."""
        invalid_statuses = {SporStatus.IKKE_RELEVANT, SporStatus.UTKAST}

        if state.grunnlag.status in invalid_statuses:
            return ValidationResult(
                is_valid=False,
                message="Kan ikke besvare grunnlag som ikke er sendt"
            )

        return ValidationResult(is_valid=True)

    def _rule_grunnlag_not_locked(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Cannot modify locked grunnlag."""
        if state.grunnlag.laast or state.grunnlag.status == SporStatus.LAAST:
            return ValidationResult(
                is_valid=False,
                message="Grunnlag er låst og kan ikke endres"
            )

        return ValidationResult(is_valid=True)

    # ========== VEDERLAG RULES ==========

    def _rule_vederlag_sent(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Cannot respond to unsent vederlag."""
        invalid_statuses = {SporStatus.IKKE_RELEVANT, SporStatus.UTKAST}

        if state.vederlag.status in invalid_statuses:
            return ValidationResult(
                is_valid=False,
                message="Kan ikke besvare vederlag som ikke er sendt"
            )

        return ValidationResult(is_valid=True)

    def _rule_active_vederlag_exists(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Can only update if there's an active vederlag claim."""
        if state.vederlag.status == SporStatus.IKKE_RELEVANT:
            return ValidationResult(
                is_valid=False,
                message="Ingen aktivt vederlagskrav å oppdatere"
            )

        return ValidationResult(is_valid=True)

    # ========== FRIST RULES ==========

    def _rule_frist_sent(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Cannot respond to unsent frist."""
        invalid_statuses = {SporStatus.IKKE_RELEVANT, SporStatus.UTKAST}

        if state.frist.status in invalid_statuses:
            return ValidationResult(
                is_valid=False,
                message="Kan ikke besvare frist som ikke er sendt"
            )

        return ValidationResult(is_valid=True)

    def _rule_active_frist_exists(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Can only update if there's an active frist claim."""
        if state.frist.status == SporStatus.IKKE_RELEVANT:
            return ValidationResult(
                is_valid=False,
                message="Ingen aktivt fristkrav å oppdatere"
            )

        return ValidationResult(is_valid=True)

    # ========== EO RULES ==========

    def _rule_all_approved_for_eo(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: All active tracks must be approved to issue EO."""
        if not state.kan_utstede_eo:
            return ValidationResult(
                is_valid=False,
                message="Alle aktive spor må være godkjent før EO kan utstedes"
            )

        return ValidationResult(is_valid=True)
```

### 1.6 Debug State Seeder

```python
# backend/routes/debug_routes.py (NEW)
"""
Debug endpoints for development/testing.

⛔ SECURITY: These endpoints are ONLY for development!
Production deployment will fail if FLASK_ENV=production.
"""
import os

# CRITICAL: Block loading in production
if os.getenv('FLASK_ENV') == 'production':
    raise RuntimeError(
        "⛔ SIKKERHETSFEIL: Forsøk på å laste debug-ruter i produksjon!\n"
        "Debug-endepunkter kan eksponere sensitiv data og må ALDRI være tilgjengelige i prod.\n"
        "Løsning: Fjern import av debug_bp i routes/__init__.py for produksjon."
    )

from flask import Blueprint, request, jsonify
from datetime import datetime
from uuid import uuid4
from repositories.event_repository import JsonFileEventRepository
from repositories.sak_metadata_repository import SakMetadataRepository
from services.timeline_service import TimelineService
from models.events import (
    SakOpprettetEvent, GrunnlagEvent, VederlagEvent, FristEvent,
    ResponsEvent, GrunnlagData, VederlagData, FristData,
    VederlagResponsData, FristResponsData, GrunnlagResponsData,
    EventType, SporType, ResponsResultat
)
from models.sak_metadata import SakMetadata

debug_bp = Blueprint('debug', __name__)
event_repo = JsonFileEventRepository()
metadata_repo = SakMetadataRepository()
timeline_service = TimelineService()


@debug_bp.route('/api/debug/seed-case', methods=['POST'])
def seed_case():
    """
    Create a case with a specific target state.

    Automatically generates the required event chain.

    Request:
    {
        "sakstittel": "Test Case",
        "target_state": {
            "grunnlag": "GODKJENT",      // UTKAST, SENDT, GODKJENT, AVVIST, LAAST
            "vederlag": "DELVIS_GODKJENT", // IKKE_RELEVANT, SENDT, GODKJENT, etc.
            "frist": "SENDT"
        },
        "data": {
            "vederlag_belop": 500000,
            "vederlag_godkjent": 350000,
            "frist_dager": 14
        }
    }

    Response:
    {
        "sak_id": "KOE-...",
        "events_created": 5,
        "final_state": { ... }
    }
    """
    data = request.json
    sakstittel = data.get('sakstittel', 'Seeded Test Case')
    target = data.get('target_state', {})
    seed_data = data.get('data', {})

    # Generate unique sak_id
    sak_id = f"KOE-{datetime.now().strftime('%Y%m%d')}-SEED{uuid4().hex[:4].upper()}"

    events = []
    aktor_te = "test.te@example.com"
    aktor_bh = "test.bh@example.com"

    # 1. Always create SAK_OPPRETTET
    events.append(SakOpprettetEvent(
        sak_id=sak_id,
        sakstittel=sakstittel,
        aktor=aktor_te,
        aktor_rolle="TE"
    ))

    # 2. Generate Grunnlag events
    grunnlag_target = target.get('grunnlag', 'SENDT')
    if grunnlag_target != 'IKKE_RELEVANT':
        events.append(GrunnlagEvent(
            sak_id=sak_id,
            event_type=EventType.GRUNNLAG_OPPRETTET,
            aktor=aktor_te,
            aktor_rolle="TE",
            data=GrunnlagData(
                hovedkategori="Risiko",
                underkategori="Grunnforhold",
                beskrivelse="Seeded grunnlag for testing",
                dato_oppdaget=datetime.now().strftime("%Y-%m-%d")
            )
        ))

        if grunnlag_target in ['GODKJENT', 'LAAST']:
            events.append(ResponsEvent(
                sak_id=sak_id,
                event_type=EventType.RESPONS_GRUNNLAG,
                aktor=aktor_bh,
                aktor_rolle="BH",
                spor=SporType.GRUNNLAG,
                data=GrunnlagResponsData(
                    resultat=ResponsResultat.GODKJENT,
                    begrunnelse="Godkjent for testing"
                )
            ))
        elif grunnlag_target == 'AVVIST':
            events.append(ResponsEvent(
                sak_id=sak_id,
                event_type=EventType.RESPONS_GRUNNLAG,
                aktor=aktor_bh,
                aktor_rolle="BH",
                spor=SporType.GRUNNLAG,
                data=GrunnlagResponsData(
                    resultat=ResponsResultat.AVVIST_UENIG,
                    begrunnelse="Avvist for testing"
                )
            ))

    # 3. Generate Vederlag events
    vederlag_target = target.get('vederlag', 'IKKE_RELEVANT')
    if vederlag_target != 'IKKE_RELEVANT':
        belop = seed_data.get('vederlag_belop', 500000)
        events.append(VederlagEvent(
            sak_id=sak_id,
            event_type=EventType.VEDERLAG_KRAV_SENDT,
            aktor=aktor_te,
            aktor_rolle="TE",
            versjon=1,
            data=VederlagData(
                krav_belop=belop,
                metode="ENTREPRENORENS_TILBUD",
                begrunnelse="Seeded vederlag for testing"
            )
        ))

        if vederlag_target == 'GODKJENT':
            events.append(ResponsEvent(
                sak_id=sak_id,
                event_type=EventType.RESPONS_VEDERLAG,
                aktor=aktor_bh,
                aktor_rolle="BH",
                spor=SporType.VEDERLAG,
                data=VederlagResponsData(
                    resultat=ResponsResultat.GODKJENT,
                    begrunnelse="Godkjent for testing",
                    godkjent_belop=belop
                )
            ))
        elif vederlag_target == 'DELVIS_GODKJENT':
            godkjent = seed_data.get('vederlag_godkjent', belop * 0.7)
            events.append(ResponsEvent(
                sak_id=sak_id,
                event_type=EventType.RESPONS_VEDERLAG,
                aktor=aktor_bh,
                aktor_rolle="BH",
                spor=SporType.VEDERLAG,
                data=VederlagResponsData(
                    resultat=ResponsResultat.DELVIS_GODKJENT,
                    begrunnelse="Delvis godkjent for testing",
                    godkjent_belop=godkjent
                )
            ))
        elif vederlag_target == 'AVVIST':
            events.append(ResponsEvent(
                sak_id=sak_id,
                event_type=EventType.RESPONS_VEDERLAG,
                aktor=aktor_bh,
                aktor_rolle="BH",
                spor=SporType.VEDERLAG,
                data=VederlagResponsData(
                    resultat=ResponsResultat.AVVIST_UENIG,
                    begrunnelse="Avvist for testing"
                )
            ))

    # 4. Generate Frist events
    frist_target = target.get('frist', 'IKKE_RELEVANT')
    if frist_target != 'IKKE_RELEVANT':
        dager = seed_data.get('frist_dager', 14)
        events.append(FristEvent(
            sak_id=sak_id,
            event_type=EventType.FRIST_KRAV_SENDT,
            aktor=aktor_te,
            aktor_rolle="TE",
            versjon=1,
            data=FristData(
                antall_dager=dager,
                frist_type="kalenderdager",
                begrunnelse="Seeded frist for testing"
            )
        ))

        if frist_target == 'GODKJENT':
            events.append(ResponsEvent(
                sak_id=sak_id,
                event_type=EventType.RESPONS_FRIST,
                aktor=aktor_bh,
                aktor_rolle="BH",
                spor=SporType.FRIST,
                data=FristResponsData(
                    resultat=ResponsResultat.GODKJENT,
                    begrunnelse="Godkjent for testing",
                    godkjent_dager=dager
                )
            ))

    # 5. Create case metadata
    metadata = SakMetadata(
        sak_id=sak_id,
        created_by=aktor_te,
        _cached_title=sakstittel,
        _cached_status="UTKAST"  # Will be updated after events
    )
    metadata_repo.create(metadata)

    # 6. Persist all events atomically
    new_version = event_repo.append_batch(events, expected_version=0)

    # 7. Compute final state
    final_state = timeline_service.compute_state(events)

    # 8. Update cache
    metadata_repo.update_cache(
        sak_id=sak_id,
        cached_title=final_state.sakstittel,
        cached_status=final_state.overordnet_status,
        last_event_at=datetime.now()
    )

    return jsonify({
        "success": True,
        "sak_id": sak_id,
        "events_created": len(events),
        "version": new_version,
        "final_state": final_state.model_dump(mode='json')
    }), 201


@debug_bp.route('/api/debug/health', methods=['GET'])
def health_check():
    """Simple health check that debug routes are loaded."""
    return jsonify({
        "status": "ok",
        "environment": os.getenv('FLASK_ENV', 'unknown'),
        "warning": "⚠️ Debug routes are ACTIVE - DO NOT use in production!"
    })
```

---

## Phase 2: Frontend - "Kill the Form"

### 2.1 Delete Legacy Components

**DELETE these files completely:**
```
components/panels/VarselPanel.tsx      # DELETE
components/panels/KravKoePanel.tsx     # DELETE
components/panels/BhSvarPanel.tsx      # DELETE
hooks/useAutoSave.ts                   # DELETE - no more drafts
hooks/useHandleInputChange.ts          # DELETE - no more form binding
hooks/useFormSubmission.ts             # DELETE - replaced by useEventSubmit
```

### 2.2 New Type Definitions

```typescript
// types/timeline.ts (NEW)
/**
 * Unified Timeline Types
 *
 * These types mirror the backend models exactly.
 * State is READ-ONLY - all mutations happen via events.
 */

// ========== ENUMS ==========

export type SporType = 'grunnlag' | 'vederlag' | 'frist';

export type SporStatus =
  | 'ikke_relevant'
  | 'utkast'
  | 'sendt'
  | 'under_behandling'
  | 'godkjent'
  | 'delvis_godkjent'
  | 'avvist'
  | 'under_forhandling'
  | 'trukket'
  | 'laast';

export type ResponsResultat =
  | 'godkjent'
  | 'delvis_godkjent'
  | 'avvist_uenig'
  | 'avvist_for_sent'
  | 'krever_avklaring';

export type OverordnetStatus =
  | 'UTKAST'
  | 'SENDT'
  | 'VENTER_PAA_SVAR'
  | 'UNDER_BEHANDLING'
  | 'UNDER_FORHANDLING'
  | 'OMFORENT'
  | 'LUKKET'
  | 'LUKKET_TRUKKET';

// ========== TRACK STATES (Read-Only) ==========

export interface GrunnlagTilstand {
  status: SporStatus;
  hovedkategori?: string;
  underkategori?: string;
  beskrivelse?: string;
  dato_oppdaget?: string;
  kontraktsreferanser: string[];
  bh_resultat?: ResponsResultat;
  bh_begrunnelse?: string;
  laast: boolean;
  siste_oppdatert?: string;
  antall_versjoner: number;
}

export interface VederlagTilstand {
  status: SporStatus;
  krevd_belop?: number;
  metode?: string;
  begrunnelse?: string;
  bh_resultat?: ResponsResultat;
  bh_begrunnelse?: string;
  godkjent_belop?: number;
  differanse?: number;
  godkjenningsgrad_prosent?: number;
  siste_oppdatert?: string;
  antall_versjoner: number;
}

export interface FristTilstand {
  status: SporStatus;
  krevd_dager?: number;
  frist_type?: 'kalenderdager' | 'arbeidsdager';
  begrunnelse?: string;
  bh_resultat?: ResponsResultat;
  bh_begrunnelse?: string;
  godkjent_dager?: number;
  differanse_dager?: number;
  siste_oppdatert?: string;
  antall_versjoner: number;
}

// ========== MAIN STATE (Read-Only) ==========

export interface SakState {
  sak_id: string;
  sakstittel: string;

  // The three tracks
  grunnlag: GrunnlagTilstand;
  vederlag: VederlagTilstand;
  frist: FristTilstand;

  // Computed
  overordnet_status: OverordnetStatus;
  kan_utstede_eo: boolean;
  neste_handling: {
    rolle: 'TE' | 'BH' | null;
    handling: string;
    spor: SporType | null;
  };

  // Aggregates
  sum_krevd: number;
  sum_godkjent: number;

  // Metadata
  opprettet?: string;
  siste_aktivitet?: string;
  antall_events: number;
}

// ========== API RESPONSE ==========

export interface StateResponse {
  version: number;
  state: SakState;
}

export interface EventSubmitResponse {
  success: boolean;
  event_id?: string;
  new_version?: number;
  state?: SakState;
  error?: string;
  message?: string;
}

// ========== EVENT PAYLOADS (for submission) ==========

export type EventType =
  | 'sak_opprettet'
  | 'grunnlag_opprettet'
  | 'grunnlag_oppdatert'
  | 'grunnlag_trukket'
  | 'vederlag_krav_sendt'
  | 'vederlag_krav_oppdatert'
  | 'vederlag_krav_trukket'
  | 'frist_krav_sendt'
  | 'frist_krav_oppdatert'
  | 'frist_krav_trukket'
  | 'respons_grunnlag'
  | 'respons_vederlag'
  | 'respons_frist'
  | 'eo_utstedt';

export interface GrunnlagEventData {
  hovedkategori: string;
  underkategori: string;
  beskrivelse: string;
  dato_oppdaget: string;
  kontraktsreferanser?: string[];
  vedlegg_ids?: string[];
}

export interface VederlagEventData {
  krav_belop: number;
  metode: string;
  begrunnelse: string;
  inkluderer_produktivitetstap?: boolean;
  inkluderer_rigg_drift?: boolean;
}

export interface FristEventData {
  antall_dager: number;
  frist_type: 'kalenderdager' | 'arbeidsdager';
  begrunnelse: string;
  pavirker_kritisk_linje?: boolean;
}

export interface ResponsEventData {
  resultat: ResponsResultat;
  begrunnelse: string;
  godkjent_belop?: number;
  godkjent_dager?: number;
}

// ========== TIMELINE DISPLAY ==========

export interface TimelineEntry {
  event_id: string;
  tidsstempel: string;
  type: string;
  aktor: string;
  rolle: 'TE' | 'BH';
  spor: SporType | null;
  sammendrag: string;
}
```

### 2.3 New Hooks

```typescript
// hooks/useCaseState.ts (NEW)
/**
 * Hook for loading and managing case state.
 *
 * State is READ-ONLY. Use useEventSubmit for mutations.
 */
import { useState, useCallback, useEffect } from 'react';
import { SakState, StateResponse, TimelineEntry } from '../types/timeline';
import { getCsrfToken, getMagicToken } from '../services/api';

interface UseCaseStateResult {
  state: SakState | null;
  version: number;
  timeline: TimelineEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCaseState(sakId: string | null): UseCaseStateResult {
  const [state, setState] = useState<SakState | null>(null);
  const [version, setVersion] = useState(0);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!sakId) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = getMagicToken();

      const response = await fetch(`/api/case/${sakId}/state`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error(`Kunne ikke laste sak: ${response.status}`);
      }

      const data: StateResponse = await response.json();
      setState(data.state);
      setVersion(data.version);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ukjent feil');
    } finally {
      setIsLoading(false);
    }
  }, [sakId]);

  const fetchTimeline = useCallback(async () => {
    if (!sakId) return;

    try {
      const token = getMagicToken();

      const response = await fetch(`/api/case/${sakId}/timeline`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTimeline(data.events);
      }
    } catch (e) {
      // Timeline is non-critical, don't set error
      console.error('Kunne ikke laste tidslinje:', e);
    }
  }, [sakId]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchState(), fetchTimeline()]);
  }, [fetchState, fetchTimeline]);

  useEffect(() => {
    fetchState();
    fetchTimeline();
  }, [fetchState, fetchTimeline]);

  return { state, version, timeline, isLoading, error, refresh };
}
```

```typescript
// hooks/useEventSubmit.ts (NEW)
/**
 * Hook for submitting events with optimistic concurrency control.
 *
 * Handles:
 * - CSRF tokens
 * - Version conflicts (409)
 * - Automatic state refresh on success
 */
import { useState, useCallback } from 'react';
import { EventType, EventSubmitResponse } from '../types/timeline';
import { getCsrfToken, getMagicToken } from '../services/api';

interface UseEventSubmitOptions {
  onSuccess?: (response: EventSubmitResponse) => void;
  onConflict?: (expected: number, actual: number) => void;
  onError?: (error: string) => void;
}

interface UseEventSubmitResult {
  submitEvent: (
    eventType: EventType,
    data: Record<string, any>,
    expectedVersion: number
  ) => Promise<EventSubmitResponse>;
  submitBatch: (
    events: Array<{ event_type: EventType; data: Record<string, any> }>,
    expectedVersion: number
  ) => Promise<EventSubmitResponse>;
  isSubmitting: boolean;
  error: string | null;
}

export function useEventSubmit(
  sakId: string,
  aktor: string,
  aktorRolle: 'TE' | 'BH',
  options: UseEventSubmitOptions = {}
): UseEventSubmitResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitEvent = useCallback(async (
    eventType: EventType,
    data: Record<string, any>,
    expectedVersion: number
  ): Promise<EventSubmitResponse> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const csrfToken = await getCsrfToken();
      const magicToken = getMagicToken();

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Authorization': magicToken ? `Bearer ${magicToken}` : '',
        },
        body: JSON.stringify({
          event_type: eventType,
          sak_id: sakId,
          expected_version: expectedVersion,
          aktor,
          aktor_rolle: aktorRolle,
          data,
        }),
      });

      const result: EventSubmitResponse = await response.json();

      if (response.status === 409) {
        // Version conflict
        options.onConflict?.(
          expectedVersion,
          (result as any).current_version
        );
        setError('Data har blitt endret. Vennligst last inn på nytt.');
        return result;
      }

      if (!response.ok) {
        const errorMsg = result.message || 'Innsending feilet';
        setError(errorMsg);
        options.onError?.(errorMsg);
        return result;
      }

      options.onSuccess?.(result);
      return result;

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Ukjent feil';
      setError(errorMsg);
      options.onError?.(errorMsg);
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  }, [sakId, aktor, aktorRolle, options]);

  const submitBatch = useCallback(async (
    events: Array<{ event_type: EventType; data: Record<string, any> }>,
    expectedVersion: number
  ): Promise<EventSubmitResponse> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const csrfToken = await getCsrfToken();
      const magicToken = getMagicToken();

      const eventPayloads = events.map(e => ({
        event_type: e.event_type,
        aktor,
        aktor_rolle: aktorRolle,
        data: e.data,
      }));

      const response = await fetch('/api/events/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Authorization': magicToken ? `Bearer ${magicToken}` : '',
        },
        body: JSON.stringify({
          sak_id: sakId,
          expected_version: expectedVersion,
          events: eventPayloads,
        }),
      });

      const result: EventSubmitResponse = await response.json();

      if (response.status === 409) {
        options.onConflict?.(
          expectedVersion,
          (result as any).current_version
        );
        setError('Data har blitt endret. Vennligst last inn på nytt.');
        return result;
      }

      if (!response.ok) {
        const errorMsg = result.message || 'Innsending feilet';
        setError(errorMsg);
        options.onError?.(errorMsg);
        return result;
      }

      options.onSuccess?.(result);
      return result;

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Ukjent feil';
      setError(errorMsg);
      options.onError?.(errorMsg);
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  }, [sakId, aktor, aktorRolle, options]);

  return { submitEvent, submitBatch, isSubmitting, error };
}
```

### 2.4 New UI Pattern: View + Action Components

**Pattern: Read-only Views + Modal Actions**

```
┌─────────────────────────────────────────────────────────┐
│                    CaseView (Read-Only)                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ GrunnlagCard│ │ VederlagCard│ │  FristCard  │       │
│  │  (view)     │ │  (view)     │ │  (view)     │       │
│  │             │ │             │ │             │       │
│  │ [Action Btn]│ │ [Action Btn]│ │ [Action Btn]│       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              TimelineView (read-only)            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘

         ↓ Click "Send Krav" button

┌─────────────────────────────────────────────────────────┐
│               SendVederlagModal (Action)                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  LOCAL FORM STATE (react-hook-form)                     │
│  - NOT bound to global state                            │
│  - Validates locally                                    │
│  - On submit: calls useEventSubmit()                    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Beløp: [___________]                             │   │
│  │ Metode: [dropdown]                               │   │
│  │ Begrunnelse: [textarea]                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Cancel]                              [Send Krav]      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Example View Component:**

```tsx
// components/views/VederlagCard.tsx (NEW)
/**
 * Read-only view of Vederlag track state.
 *
 * NO form state. NO editing. Just displays SakState.vederlag.
 */
import { VederlagTilstand, SporStatus } from '../../types/timeline';
import { formatCurrency, formatDate } from '../../utils/format';
import { StatusBadge } from '../ui/StatusBadge';

interface VederlagCardProps {
  vederlag: VederlagTilstand;
  canAct: boolean;
  onAction: () => void; // Opens modal
}

export function VederlagCard({ vederlag, canAct, onAction }: VederlagCardProps) {
  const isActive = vederlag.status !== 'ikke_relevant';

  return (
    <div className="card">
      <div className="card-header">
        <h3>Vederlag</h3>
        <StatusBadge status={vederlag.status} />
      </div>

      {isActive ? (
        <div className="card-body">
          {/* Krevd */}
          <div className="stat-row">
            <span className="label">Krevd:</span>
            <span className="value">{formatCurrency(vederlag.krevd_belop)}</span>
          </div>

          {/* Godkjent (if responded) */}
          {vederlag.godkjent_belop !== undefined && (
            <div className="stat-row">
              <span className="label">Godkjent:</span>
              <span className="value">{formatCurrency(vederlag.godkjent_belop)}</span>
            </div>
          )}

          {/* Differanse */}
          {vederlag.differanse !== undefined && (
            <div className="stat-row highlight">
              <span className="label">Differanse:</span>
              <span className="value negative">
                {formatCurrency(vederlag.differanse)}
              </span>
            </div>
          )}

          {/* BH Response */}
          {vederlag.bh_resultat && (
            <div className="response-section">
              <h4>BH Svar</h4>
              <StatusBadge status={vederlag.bh_resultat} />
              {vederlag.bh_begrunnelse && (
                <p className="begrunnelse">{vederlag.bh_begrunnelse}</p>
              )}
            </div>
          )}

          {/* Versjon info */}
          <div className="meta">
            Versjon {vederlag.antall_versjoner} •
            Oppdatert {formatDate(vederlag.siste_oppdatert)}
          </div>
        </div>
      ) : (
        <div className="card-body empty">
          <p>Ingen vederlagskrav</p>
        </div>
      )}

      {/* Action button */}
      {canAct && (
        <div className="card-footer">
          <button onClick={onAction} className="btn-primary">
            {vederlag.status === 'ikke_relevant' || vederlag.status === 'utkast'
              ? 'Send vederlagskrav'
              : 'Oppdater krav'}
          </button>
        </div>
      )}
    </div>
  );
}
```

**Example Action Modal:**

```tsx
// components/actions/SendVederlagModal.tsx (NEW)
/**
 * Modal for submitting/updating vederlag claim.
 *
 * LOCAL form state only. Not bound to global state.
 * On submit, creates event via useEventSubmit.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useEventSubmit } from '../../hooks/useEventSubmit';
import { VederlagEventData } from '../../types/timeline';
import { Modal } from '../ui/Modal';

interface FormData {
  krav_belop: string;
  metode: string;
  begrunnelse: string;
  inkluderer_produktivitetstap: boolean;
}

interface SendVederlagModalProps {
  sakId: string;
  currentVersion: number;
  aktor: string;
  isUpdate: boolean; // true if updating existing claim
  onSuccess: () => void;
  onClose: () => void;
}

export function SendVederlagModal({
  sakId,
  currentVersion,
  aktor,
  isUpdate,
  onSuccess,
  onClose,
}: SendVederlagModalProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  // LOCAL form state - NOT bound to global SakState
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      krav_belop: '',
      metode: 'ENTREPRENORENS_TILBUD',
      begrunnelse: '',
      inkluderer_produktivitetstap: false,
    },
  });

  const { submitEvent, isSubmitting, error } = useEventSubmit(
    sakId,
    aktor,
    'TE',
    {
      onSuccess: () => {
        onSuccess();
        onClose();
      },
      onConflict: () => {
        // Show reload message
        alert('Data har blitt endret av en annen bruker. Vennligst last inn siden på nytt.');
      },
    }
  );

  const onSubmit = async (data: FormData) => {
    const eventData: VederlagEventData = {
      krav_belop: parseFloat(data.krav_belop),
      metode: data.metode,
      begrunnelse: data.begrunnelse,
      inkluderer_produktivitetstap: data.inkluderer_produktivitetstap,
    };

    await submitEvent(
      isUpdate ? 'vederlag_krav_oppdatert' : 'vederlag_krav_sendt',
      eventData,
      currentVersion
    );
  };

  return (
    <Modal
      title={isUpdate ? 'Oppdater vederlagskrav' : 'Send vederlagskrav'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Beløp */}
        <div className="form-field">
          <label>Krevd beløp (NOK) *</label>
          <input
            type="number"
            {...register('krav_belop', {
              required: 'Beløp er påkrevd',
              min: { value: 0, message: 'Beløp må være positivt' },
            })}
          />
          {errors.krav_belop && (
            <span className="error">{errors.krav_belop.message}</span>
          )}
        </div>

        {/* Metode */}
        <div className="form-field">
          <label>Vederlagsmetode *</label>
          <select {...register('metode', { required: true })}>
            <option value="ENTREPRENORENS_TILBUD">Entreprenørens tilbud</option>
            <option value="KONTRAKTENS_ENHETSPRISER">Kontraktens enhetspriser</option>
            <option value="REGNING">Regning</option>
          </select>
        </div>

        {/* Begrunnelse */}
        <div className="form-field">
          <label>Begrunnelse *</label>
          <textarea
            {...register('begrunnelse', {
              required: 'Begrunnelse er påkrevd',
              minLength: { value: 10, message: 'Minimum 10 tegn' },
            })}
            rows={4}
          />
          {errors.begrunnelse && (
            <span className="error">{errors.begrunnelse.message}</span>
          )}
        </div>

        {/* Checkbox */}
        <div className="form-field checkbox">
          <input
            type="checkbox"
            id="produktivitetstap"
            {...register('inkluderer_produktivitetstap')}
          />
          <label htmlFor="produktivitetstap">
            Inkluderer produktivitetstap
          </label>
        </div>

        {/* Error display */}
        {error && (
          <div className="error-banner">{error}</div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={isSubmitting}>
            Avbryt
          </button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Sender...' : (isUpdate ? 'Oppdater' : 'Send krav')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

---

## Phase 3: Performance (Fremtidig optimalisering)

### 3.1 Current Approach: On-the-fly Replay

State beregnes ved å replaye alle events for en sak:

```python
events = event_repo.get_events(sak_id)  # Last alle events
state = timeline_service.compute_state(events)  # Replay i minne
```

**Performance-karakteristikk**:
- Typisk KOE-sak: 20-100 events
- Replay-tid: <5ms per sak
- Frontend: Viser én sak om gangen (navigerer via Catenda)
- **Konklusjon**: Replay er tilstrekkelig for foreseelig fremtid

### 3.2 Listevisning (hvis behov oppstår)

**Frontend-arkitektur eliminerer ytelsesrisiko**:

Siden frontend navigerer via Catenda og viser **én sak om gangen**, er det ingen "listevisning-problematikk":
- Ingen behov for å beregne state for 100+ saker samtidig
- Hver sak lastes individuelt når bruker navigerer til den
- Replay av <100 events per sak er trivialt

**Hvis** listevisning skulle bli nødvendig senere:
- Bruk denormaliserte felter i `SakMetadata` (`_cached_status`, `_cached_title`)
- Disse oppdateres allerede ved hver event (se event_routes.py)
- Listvisning leser kun CSV, ikke events

### 3.3 Fremtidig snapshot-strategi (usannsynlig behov)

Snapshot kan legges til **uten API-endringer** hvis:
- Saker får >1000 events (ekstremt usannsynlig for KOE-saker)
- Compliance krav for rask temporal queries på historiske datoer

Se Appendix D for referanse-implementering.

---

## Implementation Checklist

### Phase 0: Prerequisites (DO FIRST!)
- [ ] Implementer `require_magic_link` dekoratør i `backend/lib/auth/magic_link.py`
- [ ] Eksporter `require_magic_link` i `backend/lib/auth/__init__.py`
- [ ] Test at decorator blokkerer requests uten token
- [ ] Opprett `backend/repositories/sak_metadata_repository.py`
- [ ] Test metadata cache-oppdatering
- [ ] Dokumenter plattformkrav (Linux/macOS/WSL2) i README
- [ ] Legg til miljøsjekk i debug_routes.py

### Phase 1: Backend Foundation
- [ ] Create `backend/models/sak_metadata.py`
- [ ] Create `backend/repositories/event_repository.py`
- [ ] Add `parse_event()` og `parse_event_from_request()` to `backend/models/events.py`
- [ ] Test server-controlled field validation
- [ ] Create `backend/services/business_rules.py`
- [ ] Write unit tests for ALL business rules
- [ ] Create `backend/routes/event_routes.py` with cache updates
- [ ] Create `backend/routes/debug_routes.py` with environment check
- [ ] Register blueprints in `backend/routes/__init__.py`
- [ ] Write integration tests for event submission
- [ ] Test optimistic locking with concurrent requests
- [ ] Delete legacy files (koe_routes, svar_routes, etc.)
- [ ] Delete `koe_data/form_data/` directory

### Phase 2: Frontend
- [ ] Create `types/timeline.ts`
- [ ] Create `hooks/useCaseState.ts`
- [ ] Create `hooks/useEventSubmit.ts`
- [ ] Create view components (GrunnlagCard, VederlagCard, FristCard)
- [ ] Create action modals (SendGrunnlagModal, SendVederlagModal, etc.)
- [ ] Create TimelineView component
- [ ] Update main App to use new components
- [ ] Delete legacy panels (VarselPanel, KravKoePanel, BhSvarPanel)
- [ ] Delete legacy hooks (useAutoSave, useHandleInputChange, etc.)
- [ ] Test version conflict handling in UI

### Phase 3: Integration
- [ ] Update Catenda webhook handler to create events
- [ ] Update PDF generation to use SakState
- [ ] Test full flow: create case → submit events → BH response → EO
- [ ] Test concurrency: simultaneous submissions from TE and BH
- [ ] Verify cache updates happen correctly

### Phase 4: Testing & Validation
- [ ] Test all business rules with unit tests
- [ ] Test optimistic locking with load testing tool
- [ ] Verify Norwegian error messages throughout
- [ ] Test on Linux/macOS (if applicable)
- [ ] Security audit: server-controlled fields can't be overridden
- [ ] Verify debug routes are NOT loaded in production

### Phase 5: Documentation
- [ ] Update README with platform requirements
- [ ] Document environment variables (FLASK_ENV)
- [ ] Create seed script examples
- [ ] Update API documentation

---

## Appendix A: Corrections Pattern

Since events are immutable, we correct errors with compensating events:

```
Scenario: TE submitted wrong amount (100,000 instead of 1,000,000)

WRONG approach:
  ❌ Edit event #3 to change amount

CORRECT approach:
  ✅ Submit new event: VEDERLAG_KRAV_OPPDATERT with correct amount

Timeline:
  #1 sak_opprettet
  #2 grunnlag_opprettet
  #3 vederlag_krav_sendt (100,000)  ← Error!
  #4 vederlag_krav_oppdatert (1,000,000)  ← Correction

State after #4:
  vederlag.krevd_belop = 1,000,000
  vederlag.antall_versjoner = 2
```

---

## Appendix B: Conflict Resolution Flow

```
┌─────────────────────────────────────────────────────────┐
│                   USER A (TE)                           │
├─────────────────────────────────────────────────────────┤
│ 1. Load state (version=3)                               │
│ 2. Fill out vederlag form                               │
│ 3. Click "Send"                                         │
│    POST /api/events                                     │
│    { expected_version: 3, ... }                         │
│                                                         │
│    Meanwhile, User B submitted, version is now 4        │
│                                                         │
│ 4. Response: 409 Conflict                               │
│    { expected_version: 3, current_version: 4 }          │
│                                                         │
│ 5. UI shows: "Data har blitt endret. Last inn på nytt." │
│                                                         │
│ 6. User clicks reload                                   │
│ 7. Load state (version=4)                               │
│ 8. Review changes from User B                           │
│ 9. Decide: still submit? adjust values?                 │
│ 10. Submit with expected_version: 4                     │
│ 11. Success! New version: 5                             │
└─────────────────────────────────────────────────────────┘
```

---

## Appendix C: File Structure After Migration

```
unified-timeline/
├── backend/
│   ├── models/
│   │   ├── events.py           # Event types (EXISTS)
│   │   ├── sak_state.py        # State model (EXISTS)
│   │   ├── sak_metadata.py     # NEW: Minimal metadata
│   │   └── sak.py              # DEPRECATED (keep for reference)
│   │
│   ├── repositories/
│   │   ├── event_repository.py # NEW: Event store
│   │   ├── sak_metadata_repository.py  # NEW: Metadata + cache
│   │   └── csv_repository.py   # Keep for legacy case list
│   │
│   ├── services/
│   │   ├── timeline_service.py # EXISTS: State computation
│   │   ├── business_rules.py   # NEW: Validators
│   │   └── catenda_service.py  # Keep as-is
│   │
│   ├── lib/
│   │   └── auth/
│   │       ├── __init__.py     # UPDATED: Export require_magic_link
│   │       ├── csrf_protection.py
│   │       └── magic_link.py   # UPDATED: Add decorator
│   │
│   └── routes/
│       ├── event_routes.py     # NEW: /api/events
│       ├── debug_routes.py     # NEW: /api/debug/* (dev only)
│       └── webhook_routes.py   # Keep, update for events
│
├── components/
│   ├── views/                  # NEW: Read-only components
│   │   ├── CaseView.tsx
│   │   ├── GrunnlagCard.tsx
│   │   ├── VederlagCard.tsx
│   │   ├── FristCard.tsx
│   │   └── TimelineView.tsx
│   │
│   ├── actions/                # NEW: Modal/Form components
│   │   ├── SendGrunnlagModal.tsx
│   │   ├── SendVederlagModal.tsx
│   │   ├── SendFristModal.tsx
│   │   ├── ResponsGrunnlagModal.tsx
│   │   ├── ResponsVederlagModal.tsx
│   │   └── ResponsFristModal.tsx
│   │
│   └── ui/                     # Keep existing UI components
│
├── hooks/
│   ├── useCaseState.ts         # NEW
│   ├── useEventSubmit.ts       # NEW
│   └── useUrlParams.ts         # Keep
│
├── types/
│   └── timeline.ts             # NEW: All timeline types
│
└── koe_data/
    ├── events/                 # NEW: Event store
    │   └── {sak_id}.json
    └── saker.csv               # Updated with cached fields
```

---

## Appendix D: Snapshot Pattern (Future Reference)

**NOTE:** This is included for completeness but is **NOT expected to be needed** given:
- Frontend shows one case at a time
- Typical cases have <100 events
- Replay takes <5ms

If snapshot optimization becomes necessary (>1000 events per case):

```python
# backend/repositories/snapshot_repository.py (FUTURE)
"""
Snapshot repository for performance optimization.

Stores pre-computed state at specific versions.
Falls back to full replay if snapshot is stale.
"""
from typing import Optional, Tuple
from pathlib import Path
import json
from models.sak_state import SakState


class SnapshotRepository:
    """
    Stores snapshots of SakState at specific version numbers.

    Snapshots are saved every N events (e.g., every 50).
    """

    def __init__(self, base_path: str = "koe_data/snapshots"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.snapshot_interval = 50  # Save snapshot every 50 events

    def get_latest_snapshot(self, sak_id: str) -> Optional[Tuple[SakState, int]]:
        """
        Get latest snapshot for a case.

        Returns:
            (SakState, version_number) or None if no snapshot exists
        """
        snapshot_file = self.base_path / f"{sak_id}_snapshot.json"

        if not snapshot_file.exists():
            return None

        with open(snapshot_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        state = SakState.model_validate(data['state'])
        version = data['version']

        return state, version

    def save_snapshot(self, sak_id: str, state: SakState, version: int):
        """Save snapshot at specific version."""
        snapshot_file = self.base_path / f"{sak_id}_snapshot.json"

        data = {
            "version": version,
            "state": state.model_dump(mode='json')
        }

        with open(snapshot_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)


# Updated TimelineService (FUTURE)
class TimelineService:
    def __init__(self, snapshot_repo: Optional[SnapshotRepository] = None):
        self.snapshot_repo = snapshot_repo

    def compute_state_optimized(self, sak_id: str) -> SakState:
        """
        Optimized state computation with snapshots.

        1. Try to load latest snapshot
        2. If found, replay only events after snapshot version
        3. If not found, full replay
        """
        if not self.snapshot_repo:
            # Fallback to normal replay
            events, _ = self.event_repo.get_events(sak_id)
            return self.compute_state(events)

        snapshot = self.snapshot_repo.get_latest_snapshot(sak_id)
        events, current_version = self.event_repo.get_events(sak_id)

        if snapshot:
            state, snapshot_version = snapshot

            # Only replay events after snapshot
            # Events are chronologically ordered, so use list slicing
            new_events = events[snapshot_version:]

            for event in new_events:
                state = self._apply_event(state, event)

            # Save new snapshot if we've processed enough events
            if current_version - snapshot_version >= self.snapshot_repo.snapshot_interval:
                self.snapshot_repo.save_snapshot(sak_id, state, current_version)

            return state

        # No snapshot - do full replay
        state = self.compute_state(events)

        # Save first snapshot
        if current_version >= self.snapshot_repo.snapshot_interval:
            self.snapshot_repo.save_snapshot(sak_id, state, current_version)

        return state
```

---

## Changes from v3

**Critical fixes**:
1. ✅ Added Phase 0 with missing `require_magic_link` decorator
2. ✅ Added `SakMetadataRepository` with cache update logic
3. ✅ Rewrote Phase 3 to reflect single-case frontend architecture
4. ✅ Moved snapshot strategy to Appendix D (future reference only)
5. ✅ Documented platform requirement (Linux/macOS/WSL2)
6. ✅ Standardized all error messages to Norwegian
7. ✅ Added environment check for debug routes
8. ✅ Added validation for server-controlled fields
9. ✅ Fixed Norwegian messages in ConcurrencyError
10. ✅ Updated checklist with prerequisite phase

**Rationale**: These changes make the plan **production-ready** by addressing security gaps, platform compatibility, and eliminating misleading performance concerns.

---

**END OF DOCUMENT**
