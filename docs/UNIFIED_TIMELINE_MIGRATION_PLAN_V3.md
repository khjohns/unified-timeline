# Unified Timeline Migration Plan v3

> **Status:** READY FOR IMPLEMENTATION
> **Version:** 3.0
> **Created:** 2025-12-01
> **Approach:** Greenfield (No Legacy Migration)

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
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
from pathlib import Path
import json
import fcntl
from datetime import datetime
from models.events import AnyEvent, parse_event

class ConcurrencyError(Exception):
    """Raised when expected_version doesn't match current version."""
    def __init__(self, expected: int, actual: int):
        self.expected = expected
        self.actual = actual
        super().__init__(f"Version conflict: expected {expected}, got {actual}")


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
            raise ValueError("Cannot append empty event list")

        sak_id = events[0].sak_id
        if not all(e.sak_id == sak_id for e in events):
            raise ValueError("All events must belong to same sak_id")

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
        raise ValueError("Missing event_type in event data")

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
        raise ValueError(f"Unknown event_type: {event_type}")

    return event_class.model_validate(data)


def parse_event_from_request(request_data: dict) -> AnyEvent:
    """
    Parse API request into event, adding server-side fields.

    Adds:
    - event_id (generated)
    - tidsstempel (server time)
    """
    from uuid import uuid4

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
from models.events import parse_event_from_request
from lib.csrf_protection import require_csrf
from lib.magic_link import require_magic_link

events_bp = Blueprint('events', __name__)

# Dependencies (consider DI container for production)
event_repo = JsonFileEventRepository()
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
        "message": "State has changed. Please reload and retry."
    }
    """
    try:
        data = request.json
        expected_version = data.pop('expected_version', None)

        if expected_version is None:
            return jsonify({
                "success": False,
                "error": "MISSING_VERSION",
                "message": "expected_version is required"
            }), 400

        # 1. Parse event
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
                "message": "State has changed. Please reload and retry."
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
                "message": "Concurrent modification detected. Please reload."
            }), 409

        # 6. Compute new state
        all_events = existing_events + [event]
        new_state = timeline_service.compute_state(all_events)

        # 7. Return success with new state
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
                "message": "sak_id, expected_version, and events[] are required"
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
                "current_version": current_version
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
                "current_version": e.actual
            }), 409

        # 6. Compute final state
        all_events = existing_events + events
        final_state = timeline_service.compute_state(all_events)

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
        return jsonify({"error": "Case not found"}), 404

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
        return jsonify({"error": "Case not found"}), 404

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

WARNING: These endpoints should be DISABLED in production!
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from uuid import uuid4
from repositories.event_repository import JsonFileEventRepository
from services.timeline_service import TimelineService
from models.events import (
    SakOpprettetEvent, GrunnlagEvent, VederlagEvent, FristEvent,
    ResponsEvent, GrunnlagData, VederlagData, FristData,
    VederlagResponsData, FristResponsData, GrunnlagResponsData,
    EventType, SporType, ResponsResultat
)

debug_bp = Blueprint('debug', __name__)
event_repo = JsonFileEventRepository()
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

    # 5. Persist all events atomically
    new_version = event_repo.append_batch(events, expected_version=0)

    # 6. Compute final state
    final_state = timeline_service.compute_state(events)

    return jsonify({
        "success": True,
        "sak_id": sak_id,
        "events_created": len(events),
        "version": new_version,
        "final_state": final_state.model_dump(mode='json')
    }), 201
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
        throw new Error(`Failed to load case: ${response.status}`);
      }

      const data: StateResponse = await response.json();
      setState(data.state);
      setVersion(data.version);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
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
      console.error('Failed to load timeline:', e);
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

## Phase 3: Performance Strategy

### 3.1 Current: On-the-fly Replay

For Phase 1, state is computed by replaying all events:

```python
# This is what TimelineService.compute_state() does
events = event_repo.get_events(sak_id)  # Load all events
state = timeline_service.compute_state(events)  # Replay in memory
```

**Acceptable for:** <100 events per case (typical construction case)

### 3.2 Future: Snapshot Strategy (Phase 2)

When performance becomes an issue, add snapshots WITHOUT changing the API:

```python
# backend/repositories/snapshot_repository.py (FUTURE)
"""
Snapshot repository for performance optimization.

Stores pre-computed state at specific versions.
Falls back to full replay if snapshot is stale.
"""

class SnapshotRepository:
    def get_latest_snapshot(self, sak_id: str) -> Tuple[SakState, int] | None:
        """Get latest snapshot and its version."""
        pass

    def save_snapshot(self, sak_id: str, state: SakState, version: int):
        """Save snapshot at specific version."""
        pass


# Updated TimelineService (FUTURE)
class TimelineService:
    def compute_state_optimized(self, sak_id: str) -> SakState:
        """
        Optimized state computation with snapshots.

        1. Try to load latest snapshot
        2. If found, replay only events after snapshot version
        3. If not found, full replay
        """
        snapshot = self.snapshot_repo.get_latest_snapshot(sak_id)

        if snapshot:
            state, snapshot_version = snapshot
            events, current_version = self.event_repo.get_events(sak_id)

            # Only replay events after snapshot
            new_events = [e for e in events if e.version > snapshot_version]

            for event in new_events:
                state = self._apply_event(state, event)

            return state

        # Fall back to full replay
        events, _ = self.event_repo.get_events(sak_id)
        return self.compute_state(events)
```

**Key Design Decision:** The `TimelineService` interface stays the same. Snapshotting is an internal optimization.

---

## Implementation Checklist

### Phase 1: Backend Foundation
- [ ] Create `backend/repositories/event_repository.py`
- [ ] Add `parse_event()` function to `backend/models/events.py`
- [ ] Create `backend/services/business_rules.py`
- [ ] Create `backend/routes/event_routes.py`
- [ ] Create `backend/routes/debug_routes.py`
- [ ] Register blueprints in `backend/routes/__init__.py`
- [ ] Write unit tests for business rules
- [ ] Write integration tests for event submission
- [ ] Delete legacy files (koe_routes, svar_routes, etc.)

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

### Phase 3: Integration
- [ ] Update Catenda webhook handler to create events
- [ ] Update PDF generation to use SakState
- [ ] Test full flow: create case → submit events → BH response → EO
- [ ] Test concurrency: simultaneous submissions

### Phase 4: Cleanup
- [ ] Delete `koe_data/form_data/` directory
- [ ] Update documentation
- [ ] Create seed script for demo data

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
│   │   └── csv_repository.py   # Keep for case list
│   │
│   ├── services/
│   │   ├── timeline_service.py # EXISTS: State computation
│   │   ├── business_rules.py   # NEW: Validators
│   │   └── catenda_service.py  # Keep as-is
│   │
│   └── routes/
│       ├── event_routes.py     # NEW: /api/events
│       ├── debug_routes.py     # NEW: /api/debug/*
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
    └── saker.csv               # Keep for list view
```

---

**END OF DOCUMENT**
