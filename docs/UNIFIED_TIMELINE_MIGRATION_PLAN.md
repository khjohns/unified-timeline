# Unified Timeline Migration & Implementation Plan

> **Status:** PLANNING
> **Created:** 2025-12-01
> **Target:** Prototype Implementation

This document outlines a structured migration from the legacy `Sak`/`KoeRevisjon`/`BhSvar` model to the new Event Sourcing-based **Unified Timeline Architecture**.

---

## Executive Summary

The migration transforms the system from a **mutable document model** (where forms are edited in place) to an **immutable event stream** (where every action is recorded and state is computed).

### Key Benefits
- **Full Audit Trail**: Complete history of all actions
- **Parallel Processing**: Grunnlag, Vederlag, Frist handled independently
- **Clear Business Rules**: State machine validates transitions
- **Cleaner API**: Read state from computed `SakState`, write via events

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  types.ts: SakState, SakEvent                                   │
│  useCaseLoader → GET /api/case/{id}/state                       │
│  useEventSubmit → POST /api/events                              │
│  VarselPanel, KravKoePanel (read-only state)                    │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTP API
┌─────────────────▼───────────────────────────────────────────────┐
│                        BACKEND (Flask)                          │
├─────────────────────────────────────────────────────────────────┤
│  Routes: /api/events, /api/case/{id}/state                      │
│  TimelineService.compute_state(events) → SakState               │
│  BusinessRuleValidator.validate(event, current_state)           │
│  EventRepository.append(event), EventRepository.get(sak_id)     │
└─────────────────┬───────────────────────────────────────────────┘
                  │ Storage
┌─────────────────▼───────────────────────────────────────────────┐
│                    EVENT STORE (JSON/CSV)                       │
│  koe_data/events/{sak_id}.json → List[SakEvent]                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Backend Foundation (The Core)

### 1.1 Event Persistence Strategy

**Decision: Create new `EventRepository` alongside `CSVRepository`**

The existing `CSVRepository` stores form data as mutable JSON blobs. Events require append-only storage with guaranteed ordering.

#### Implementation: `backend/repositories/event_repository.py`

```python
"""
New file: backend/repositories/event_repository.py
"""
from abc import ABC, abstractmethod
from typing import List, Optional
from pathlib import Path
import json
from datetime import datetime
from models.events import AnyEvent, SakEvent

class EventRepository(ABC):
    """Abstract event store interface."""

    @abstractmethod
    def append(self, event: AnyEvent) -> bool:
        """Append a single event to the store."""
        pass

    @abstractmethod
    def get_events(self, sak_id: str) -> List[AnyEvent]:
        """Get all events for a case, ordered by timestamp."""
        pass

    @abstractmethod
    def get_events_after(self, sak_id: str, after_event_id: str) -> List[AnyEvent]:
        """Get events after a specific event (for incremental sync)."""
        pass


class JsonFileEventRepository(EventRepository):
    """
    JSON file-based event store.

    Storage format:
    koe_data/events/{sak_id}.json

    Each file contains: { "events": [...], "version": 1 }
    """

    def __init__(self, base_path: str = "koe_data/events"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, sak_id: str) -> Path:
        return self.base_path / f"{sak_id}.json"

    def append(self, event: AnyEvent) -> bool:
        file_path = self._get_file_path(event.sak_id)

        # Load existing events or create new
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = {"events": [], "version": 1}

        # Append event (as dict for JSON serialization)
        data["events"].append(event.model_dump(mode='json'))

        # Write atomically (write to temp, then rename)
        temp_path = file_path.with_suffix('.tmp')
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        temp_path.rename(file_path)

        return True

    def get_events(self, sak_id: str) -> List[AnyEvent]:
        file_path = self._get_file_path(sak_id)

        if not file_path.exists():
            return []

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Deserialize events using discriminated union
        from models.events import parse_event
        return [parse_event(e) for e in data["events"]]
```

#### Storage Structure

```
koe_data/
├── saker.csv              # Case overview (keep for list view)
├── form_data/             # DEPRECATED - legacy form storage
│   └── {sak_id}.json
└── events/                # NEW - event store
    ├── KOE-20251201-001.json
    ├── KOE-20251201-002.json
    └── ...
```

---

### 1.2 New API Endpoints

#### `POST /api/events` - Submit New Event

**File:** `backend/routes/event_routes.py` (NEW)

```python
"""
New file: backend/routes/event_routes.py
"""
from flask import Blueprint, request, jsonify
from services.timeline_service import TimelineService
from services.business_rules import BusinessRuleValidator
from repositories.event_repository import JsonFileEventRepository
from models.events import parse_event_from_request
from decorators.auth import require_csrf, require_magic_link

events_bp = Blueprint('events', __name__)
event_repo = JsonFileEventRepository()
timeline_service = TimelineService()
validator = BusinessRuleValidator()

@events_bp.route('/api/events', methods=['POST'])
@require_csrf
@require_magic_link
def submit_event():
    """
    Submit a new event to the timeline.

    Request body:
    {
        "event_type": "vederlag_krav_sendt",
        "sak_id": "KOE-20251201-001",
        "aktor": "ola.nordmann@example.com",
        "aktor_rolle": "TE",
        "data": { ... event-specific payload ... }
    }

    Response:
    {
        "success": true,
        "event_id": "uuid-...",
        "new_state": { ... computed SakState ... }
    }
    """
    try:
        # 1. Parse event from request
        event = parse_event_from_request(request.json)

        # 2. Load current events and compute state
        existing_events = event_repo.get_events(event.sak_id)
        current_state = timeline_service.compute_state(existing_events)

        # 3. Validate business rules
        validation_result = validator.validate(event, current_state)
        if not validation_result.is_valid:
            return jsonify({
                "success": False,
                "error": "BUSINESS_RULE_VIOLATION",
                "message": validation_result.message,
                "rule": validation_result.violated_rule
            }), 400

        # 4. Persist event
        event_repo.append(event)

        # 5. Compute new state
        all_events = existing_events + [event]
        new_state = timeline_service.compute_state(all_events)

        # 6. Trigger side effects (Catenda, notifications)
        # ... handled by separate service

        return jsonify({
            "success": True,
            "event_id": str(event.event_id),
            "new_state": new_state.model_dump(mode='json')
        }), 201

    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
```

#### `GET /api/case/{id}/state` - Get Computed State

```python
@events_bp.route('/api/case/<sak_id>/state', methods=['GET'])
@require_magic_link
def get_case_state(sak_id: str):
    """
    Get the computed state for a case.

    Response:
    {
        "sak_id": "KOE-20251201-001",
        "sakstittel": "...",
        "grunnlag": { status, bh_resultat, ... },
        "vederlag": { status, siste_krav, ... },
        "frist": { status, siste_krav, ... },
        "overordnet_status": "SENDT",
        "kan_utstede_eo": false,
        "neste_handling": { rolle: "BH", beskrivelse: "..." }
    }
    """
    events = event_repo.get_events(sak_id)

    if not events:
        return jsonify({"error": "Case not found"}), 404

    state = timeline_service.compute_state(events)
    return jsonify(state.model_dump(mode='json'))


@events_bp.route('/api/case/<sak_id>/timeline', methods=['GET'])
@require_magic_link
def get_case_timeline(sak_id: str):
    """
    Get the full event timeline for a case (for timeline UI display).

    Response:
    {
        "events": [
            {
                "event_id": "...",
                "event_type": "grunnlag_opprettet",
                "tidsstempel": "2025-12-01T10:00:00Z",
                "aktor": "...",
                "display_text": "Grunnlag opprettet: Risiko/Grunnforhold",
                "spor": "grunnlag"
            },
            ...
        ]
    }
    """
    events = event_repo.get_events(sak_id)
    timeline = timeline_service.get_timeline(events)
    return jsonify({"events": timeline})
```

---

### 1.3 Business Rule Validation

**Critical Rules to Enforce:**

| Rule | Description | Implementation |
|------|-------------|----------------|
| R1 | Cannot send Vederlag/Frist krav unless Grunnlag is SENDT | Check `state.grunnlag.status` |
| R2 | Cannot issue EO unless all tracks are GODKJENT or IKKE_RELEVANT | Check `state.kan_utstede_eo` |
| R3 | BH cannot respond to a track that hasn't been sent | Check track status >= SENDT |
| R4 | Only TE can create/update krav, only BH can respond | Check `event.aktor_rolle` |
| R5 | Cannot update a LAAST track | Check track status != LAAST |
| R6 | Versjon must be sequential | Check `event.versjon == current + 1` |

**File:** `backend/services/business_rules.py` (NEW)

```python
"""
New file: backend/services/business_rules.py
"""
from dataclasses import dataclass
from typing import Optional
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
                return result

        return ValidationResult(is_valid=True)

    def _get_rules_for_event(self, event_type: EventType):
        """Map event types to applicable rules."""

        common_rules = [
            ("R4_role_check", self._rule_role_check),
        ]

        rules_by_type = {
            # Vederlag/Frist requires Grunnlag to be sent first
            EventType.VEDERLAG_KRAV_SENDT: [
                ("R1_grunnlag_required", self._rule_grunnlag_required),
            ],
            EventType.FRIST_KRAV_SENDT: [
                ("R1_grunnlag_required", self._rule_grunnlag_required),
            ],

            # EO requires all tracks approved
            EventType.EO_UTSTEDT: [
                ("R2_all_approved", self._rule_all_approved_for_eo),
            ],

            # BH responses require track to be sent
            EventType.RESPONS_GRUNNLAG: [
                ("R3_track_sent", self._rule_track_must_be_sent),
            ],
            EventType.RESPONS_VEDERLAG: [
                ("R3_track_sent", self._rule_track_must_be_sent),
            ],
            EventType.RESPONS_FRIST: [
                ("R3_track_sent", self._rule_track_must_be_sent),
            ],
        }

        return common_rules + rules_by_type.get(event_type, [])

    # --- Rule Implementations ---

    def _rule_grunnlag_required(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R1: Cannot send Vederlag/Frist unless Grunnlag is at least SENDT."""
        if state.grunnlag.status in [SporStatus.IKKE_RELEVANT, SporStatus.UTKAST]:
            return ValidationResult(
                is_valid=False,
                message="Grunnlag må være sendt før du kan sende krav om vederlag/frist",
                violated_rule="R1_grunnlag_required"
            )
        return ValidationResult(is_valid=True)

    def _rule_all_approved_for_eo(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R2: Cannot issue EO unless all tracks are approved."""
        if not state.kan_utstede_eo:
            return ValidationResult(
                is_valid=False,
                message="Kan ikke utstede EO før alle spor er godkjent eller ikke relevant",
                violated_rule="R2_all_approved"
            )
        return ValidationResult(is_valid=True)

    def _rule_role_check(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R4: Check actor role matches allowed roles for event type."""
        te_only_events = [
            EventType.GRUNNLAG_OPPRETTET, EventType.GRUNNLAG_OPPDATERT,
            EventType.VEDERLAG_KRAV_SENDT, EventType.VEDERLAG_KRAV_OPPDATERT,
            EventType.FRIST_KRAV_SENDT, EventType.FRIST_KRAV_OPPDATERT,
        ]
        bh_only_events = [
            EventType.RESPONS_GRUNNLAG, EventType.RESPONS_VEDERLAG,
            EventType.RESPONS_FRIST,
        ]

        if event.event_type in te_only_events and event.aktor_rolle != "TE":
            return ValidationResult(
                is_valid=False,
                message="Kun TE kan utføre denne handlingen",
                violated_rule="R4_role_check"
            )

        if event.event_type in bh_only_events and event.aktor_rolle != "BH":
            return ValidationResult(
                is_valid=False,
                message="Kun BH kan utføre denne handlingen",
                violated_rule="R4_role_check"
            )

        return ValidationResult(is_valid=True)

    def _rule_track_must_be_sent(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R3: BH cannot respond to a track that hasn't been sent."""
        track_map = {
            EventType.RESPONS_GRUNNLAG: state.grunnlag,
            EventType.RESPONS_VEDERLAG: state.vederlag,
            EventType.RESPONS_FRIST: state.frist,
        }

        track = track_map.get(event.event_type)
        if track and track.status in [SporStatus.IKKE_RELEVANT, SporStatus.UTKAST]:
            return ValidationResult(
                is_valid=False,
                message="Kan ikke besvare et spor som ikke er sendt",
                violated_rule="R3_track_sent"
            )

        return ValidationResult(is_valid=True)
```

---

### 1.4 Register New Routes

**Update:** `backend/routes/__init__.py`

```python
# Add to existing register_blueprints function:
from routes.event_routes import events_bp

def register_blueprints(app):
    # ... existing blueprints ...
    app.register_blueprint(events_bp)
```

---

## Phase 2: Frontend Adaptation (The Consumer)

### 2.1 New TypeScript Interfaces

**Update:** `types.ts`

```typescript
// ============================================
// NEW UNIFIED TIMELINE TYPES
// ============================================

// --- Enums ---

export enum SporType {
    GRUNNLAG = "grunnlag",
    VEDERLAG = "vederlag",
    FRIST = "frist"
}

export enum SporStatus {
    IKKE_RELEVANT = "ikke_relevant",
    UTKAST = "utkast",
    SENDT = "sendt",
    UNDER_BEHANDLING = "under_behandling",
    GODKJENT = "godkjent",
    DELVIS_GODKJENT = "delvis_godkjent",
    AVVIST = "avvist",
    UNDER_FORHANDLING = "under_forhandling",
    TRUKKET = "trukket",
    LAAST = "laast"
}

export enum ResponsResultat {
    GODKJENT = "godkjent",
    DELVIS_GODKJENT = "delvis_godkjent",
    AVVIST_UENIG = "avvist_uenig",
    AVVIST_FOR_SENT = "avvist_for_sent",
    KREVER_AVKLARING = "krever_avklaring"
}

export enum OverordnetStatus {
    UTKAST = "utkast",
    SENDT = "sendt",
    VENTER_PAA_SVAR = "venter_paa_svar",
    UNDER_BEHANDLING = "under_behandling",
    UNDER_FORHANDLING = "under_forhandling",
    OMFORENT = "omforent",
    LUKKET = "lukket"
}

// --- Track States ---

export interface GrunnlagTilstand {
    status: SporStatus;
    hovedkategori?: string;
    underkategori?: string;
    beskrivelse?: string;
    dato_oppdaget?: string;
    vedlegg_ids: string[];
    bh_resultat?: ResponsResultat;
    bh_begrunnelse?: string;
    siste_event_id?: string;
    sist_oppdatert?: string;
}

export interface VederlagTilstand {
    status: SporStatus;
    siste_krav?: {
        belop: number;
        metode: string;
        begrunnelse: string;
        versjon: number;
    };
    bh_resultat?: ResponsResultat;
    bh_godkjent_belop?: number;
    bh_begrunnelse?: string;
    siste_event_id?: string;
    sist_oppdatert?: string;
    antall_versjoner: number;
}

export interface FristTilstand {
    status: SporStatus;
    siste_krav?: {
        antall_dager: number;
        frist_type: "kalenderdager" | "arbeidsdager";
        begrunnelse: string;
        versjon: number;
    };
    bh_resultat?: ResponsResultat;
    bh_godkjent_dager?: number;
    bh_begrunnelse?: string;
    siste_event_id?: string;
    sist_oppdatert?: string;
    antall_versjoner: number;
}

// --- Main State ---

export interface SakState {
    sak_id: string;
    sakstittel: string;

    // Track states
    grunnlag: GrunnlagTilstand;
    vederlag: VederlagTilstand;
    frist: FristTilstand;

    // Computed properties
    overordnet_status: OverordnetStatus;
    kan_utstede_eo: boolean;
    neste_handling?: {
        rolle: "TE" | "BH";
        beskrivelse: string;
        spor?: SporType;
    };

    // Aggregates
    sum_krevd: number;
    sum_godkjent: number;
    dager_krevd: number;
    dager_godkjent: number;

    // Metadata
    opprettet_dato: string;
    sist_oppdatert: string;
}

// --- Events (for submissions) ---

export type EventType =
    | "sak_opprettet"
    | "grunnlag_opprettet"
    | "grunnlag_oppdatert"
    | "grunnlag_trukket"
    | "vederlag_krav_sendt"
    | "vederlag_krav_oppdatert"
    | "vederlag_krav_trukket"
    | "frist_krav_sendt"
    | "frist_krav_oppdatert"
    | "frist_krav_trukket"
    | "respons_grunnlag"
    | "respons_vederlag"
    | "respons_frist"
    | "eo_utstedt";

export interface SakEventBase {
    event_type: EventType;
    sak_id: string;
    aktor: string;
    aktor_rolle: "TE" | "BH";
    kommentar?: string;
}

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
    spesifikasjon?: string;
    inkluderer_produktivitetstap?: boolean;
    inkluderer_rigg_drift?: boolean;
}

export interface FristEventData {
    antall_dager: number;
    frist_type: "kalenderdager" | "arbeidsdager";
    begrunnelse: string;
    pavirker_kritisk_linje?: boolean;
    milepael_pavirket?: string;
    ny_sluttdato?: string;
}

export interface ResponsEventData {
    resultat: ResponsResultat;
    begrunnelse: string;
    godkjent_belop?: number;  // For vederlag
    godkjent_dager?: number;  // For frist
}

// --- Timeline Display ---

export interface TimelineEntry {
    event_id: string;
    event_type: EventType;
    tidsstempel: string;
    aktor: string;
    aktor_rolle: "TE" | "BH";
    display_text: string;
    spor: SporType;
}
```

---

### 2.2 Update Data Fetching Layer

**Update:** `hooks/useCaseLoader.ts`

```typescript
// New hook for event-based architecture
export const useCaseState = (sakId: string | null) => {
    const [state, setState] = useState<SakState | null>(null);
    const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchState = useCallback(async () => {
        if (!sakId) return;

        setIsLoading(true);
        try {
            const response = await fetch(`/api/case/${sakId}/state`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });

            if (!response.ok) throw new Error('Failed to load case');

            const data = await response.json();
            setState(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [sakId]);

    const fetchTimeline = useCallback(async () => {
        if (!sakId) return;

        const response = await fetch(`/api/case/${sakId}/timeline`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (response.ok) {
            const data = await response.json();
            setTimeline(data.events);
        }
    }, [sakId]);

    // Refresh function for after event submission
    const refresh = useCallback(async () => {
        await Promise.all([fetchState(), fetchTimeline()]);
    }, [fetchState, fetchTimeline]);

    useEffect(() => {
        fetchState();
        fetchTimeline();
    }, [fetchState, fetchTimeline]);

    return { state, timeline, isLoading, error, refresh };
};
```

**New hook for event submission:** `hooks/useEventSubmit.ts`

```typescript
export const useEventSubmit = (sakId: string, onSuccess?: () => void) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submitEvent = useCallback(async (
        eventType: EventType,
        data: Record<string, any>,
        aktor: string,
        aktorRolle: "TE" | "BH"
    ) => {
        setIsSubmitting(true);
        setError(null);

        try {
            const csrfToken = await getCsrfToken();

            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    event_type: eventType,
                    sak_id: sakId,
                    aktor,
                    aktor_rolle: aktorRolle,
                    data
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Submission failed');
            }

            onSuccess?.();
            return result;

        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            setError(message);
            throw e;
        } finally {
            setIsSubmitting(false);
        }
    }, [sakId, onSuccess]);

    return { submitEvent, isSubmitting, error };
};
```

---

### 2.3 UI Panel Update Strategy

**Strategy: Adapter Pattern**

Rather than rewriting all panels at once, create an adapter that converts `SakState` to the shape panels expect:

**New file:** `utils/stateAdapter.ts`

```typescript
/**
 * Adapter to convert new SakState to legacy FormDataModel shape.
 * This allows gradual migration of UI components.
 */
export function adaptStateToFormData(state: SakState): Partial<FormDataModel> {
    return {
        sak: {
            sak_id_display: state.sak_id,
            sakstittel: state.sakstittel,
            opprettet_dato: state.opprettet_dato,
            status: mapOverordnetStatusToLegacy(state.overordnet_status),
        },
        varsel: {
            hovedkategori: state.grunnlag.hovedkategori || '',
            underkategori: state.grunnlag.underkategori ? [state.grunnlag.underkategori] : [],
            varsel_beskrivelse: state.grunnlag.beskrivelse || '',
            dato_forhold_oppdaget: state.grunnlag.dato_oppdaget || '',
            vedlegg: state.grunnlag.vedlegg_ids,
        },
        koe_revisjoner: adaptVederlagFristToKoe(state),
        bh_svar_revisjoner: adaptResponsesToBhSvar(state),
    };
}

function mapOverordnetStatusToLegacy(status: OverordnetStatus): string {
    const mapping: Record<OverordnetStatus, string> = {
        [OverordnetStatus.UTKAST]: '100000000',
        [OverordnetStatus.SENDT]: '100000001',
        // ... etc
    };
    return mapping[status] || '100000000';
}
```

**Panel Update Priority:**

1. **Phase 2a: Read-only adaptation** - Panels read from adapted state
2. **Phase 2b: Event submission** - Replace `setFormData` with `submitEvent`
3. **Phase 2c: Native state reading** - Panels read directly from `SakState`

**Example: VarselPanel update (Phase 2b)**

```tsx
// Before: Mutable form data
const handleSubmit = () => {
    setFormData(prev => ({ ...prev, varsel: { ... } }));
    submitForm();
};

// After: Event submission
const { submitEvent } = useEventSubmit(sakId, refresh);

const handleSubmit = async () => {
    await submitEvent('grunnlag_opprettet', {
        hovedkategori: selectedKategori,
        underkategori: selectedUnderkategori,
        beskrivelse: description,
        dato_oppdaget: datoOppdaget,
        vedlegg_ids: uploadedFiles.map(f => f.id)
    }, currentUser, 'TE');
};
```

---

## Phase 3: The Output (PDF & Integration)

### 3.1 PDF Generator Update

**Decision: Generate "Status Report" from SakState**

The PDF should reflect the current computed state, showing:
- Case summary (grunnlag, status)
- Vederlag: All versions with BH responses
- Frist: All versions with BH responses
- Timeline of events
- Current status and next action

**Update:** `utils/pdf/pdfGenerator.ts`

```typescript
// New function for state-based PDF
export async function generateStatusReportPdf(
    state: SakState,
    timeline: TimelineEntry[]
): Promise<{ blob: Blob; filename: string }> {

    const doc = (
        <StatusReportDocument
            state={state}
            timeline={timeline}
        />
    );

    const blob = await pdf(doc).toBlob();
    const filename = `Statusrapport_${state.sak_id}_${formatDate(new Date())}.pdf`;

    return { blob, filename };
}
```

**New component:** `utils/pdf/StatusReportDocument.tsx`

```tsx
export const StatusReportDocument: React.FC<{
    state: SakState;
    timeline: TimelineEntry[];
}> = ({ state, timeline }) => (
    <Document>
        <Page style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Statusrapport</Text>
                <Text style={styles.caseId}>{state.sak_id}</Text>
                <Text style={styles.status}>
                    Status: {translateStatus(state.overordnet_status)}
                </Text>
            </View>

            {/* Grunnlag Section */}
            <GrunnlagSection grunnlag={state.grunnlag} />

            {/* Vederlag Section */}
            <VederlagSection vederlag={state.vederlag} />

            {/* Frist Section */}
            <FristSection frist={state.frist} />

            {/* Summary */}
            <SummarySection
                sumKrevd={state.sum_krevd}
                sumGodkjent={state.sum_godkjent}
                dagerKrevd={state.dager_krevd}
                dagerGodkjent={state.dager_godkjent}
            />

            {/* Timeline */}
            <TimelineSection events={timeline} />
        </Page>
    </Document>
);
```

---

### 3.2 Catenda Integration

**Event-driven Comment Posting**

When events are persisted, post formatted comments to Catenda:

**Update:** `backend/services/event_side_effects.py` (NEW)

```python
"""
Side effects triggered after event persistence.
"""
from models.events import AnyEvent, EventType
from models.sak_state import SakState
from services.catenda_service import CatendaService

class EventSideEffects:
    def __init__(self, catenda_service: CatendaService):
        self.catenda = catenda_service

    def process(self, event: AnyEvent, new_state: SakState, topic_guid: str):
        """Process side effects for a newly persisted event."""

        # 1. Post comment to Catenda
        comment = self._format_comment(event, new_state)
        if comment:
            self.catenda.post_comment(topic_guid, comment)

        # 2. Upload PDF if EO issued
        if event.event_type == EventType.EO_UTSTEDT:
            self._generate_and_upload_eo_pdf(new_state, topic_guid)

    def _format_comment(self, event: AnyEvent, state: SakState) -> str:
        """Format event as markdown comment for Catenda."""

        templates = {
            EventType.GRUNNLAG_OPPRETTET: self._format_grunnlag_comment,
            EventType.VEDERLAG_KRAV_SENDT: self._format_vederlag_comment,
            EventType.FRIST_KRAV_SENDT: self._format_frist_comment,
            EventType.RESPONS_GRUNNLAG: self._format_respons_comment,
            EventType.RESPONS_VEDERLAG: self._format_respons_comment,
            EventType.RESPONS_FRIST: self._format_respons_comment,
            EventType.EO_UTSTEDT: self._format_eo_comment,
        }

        formatter = templates.get(event.event_type)
        return formatter(event, state) if formatter else None

    def _format_grunnlag_comment(self, event, state) -> str:
        return f"""## Grunnlag Opprettet

**Kategori:** {event.data.hovedkategori} / {event.data.underkategori}
**Dato oppdaget:** {event.data.dato_oppdaget}

### Beskrivelse
{event.data.beskrivelse}

---
*Sendt av {event.aktor} ({event.aktor_rolle})*
"""

    def _format_vederlag_comment(self, event, state) -> str:
        return f"""## Krav om Vederlag (Versjon {event.versjon})

**Beløp:** {event.data.krav_belop:,.0f} NOK
**Metode:** {event.data.metode}

### Begrunnelse
{event.data.begrunnelse}

---
*Sendt av {event.aktor} ({event.aktor_rolle})*
"""

    def _format_respons_comment(self, event, state) -> str:
        resultat_text = {
            "godkjent": "GODKJENT",
            "delvis_godkjent": "DELVIS GODKJENT",
            "avvist_uenig": "AVVIST (Uenig)",
            "avvist_for_sent": "AVVIST (For sent)",
            "krever_avklaring": "Krever avklaring"
        }

        return f"""## Byggherre Respons - {event.spor.upper()}

**Resultat:** {resultat_text.get(event.data.resultat, event.data.resultat)}

### Begrunnelse
{event.data.begrunnelse}

---
*Besvart av {event.aktor} ({event.aktor_rolle})*
"""
```

---

## Phase 4: Migration/Transition

### 4.1 Fresh Data Strategy (Prototype)

For the prototype, we start with **empty data**:

1. **Clear event store:** Delete contents of `koe_data/events/`
2. **Create test case:** Use API to create a new case from scratch
3. **Manual migration (optional):** Use `MigrationHelper` for specific test cases

**Test Script:** `scripts/create_test_case.py`

```python
"""
Script to create a test case for prototype development.
"""
from backend.repositories.event_repository import JsonFileEventRepository
from backend.models.events import SakOpprettetEvent
from datetime import datetime
import uuid

def create_test_case():
    repo = JsonFileEventRepository()

    # Create case
    sak_id = f"KOE-{datetime.now().strftime('%Y%m%d')}-TEST01"

    event = SakOpprettetEvent(
        event_id=uuid.uuid4(),
        sak_id=sak_id,
        event_type="sak_opprettet",
        tidsstempel=datetime.now(),
        aktor="test@example.com",
        aktor_rolle="TE",
        data={
            "sakstittel": "Test - Grunnforhold på tomt",
            "prosjekt_navn": "Prototype Prosjekt",
            "te_navn": "Test Entreprenør AS",
            "byggherre": "Test Byggherre AS"
        }
    )

    repo.append(event)
    print(f"Created test case: {sak_id}")
    return sak_id

if __name__ == "__main__":
    create_test_case()
```

---

### 4.2 Files to Deprecate/Delete

| File | Status | Notes |
|------|--------|-------|
| `backend/models/koe_revisjon.py` | **DEPRECATE** | Keep for migration, remove after prototype |
| `backend/models/bh_svar.py` | **DEPRECATE** | Keep for migration, remove after prototype |
| `backend/services/koe_service.py` | **DEPRECATE** | Replace with event submission |
| `backend/services/svar_service.py` | **DEPRECATE** | Replace with event submission |
| `backend/routes/koe_routes.py` | **DEPRECATE** | Replace with `/api/events` |
| `backend/routes/svar_routes.py` | **DEPRECATE** | Replace with `/api/events` |
| `koe_data/form_data/*.json` | **DELETE** | Old form data format |

**Files to Keep (Prototype):**

| File | Notes |
|------|-------|
| `backend/models/sak.py` | Still used for overview data |
| `backend/models/varsel.py` | Base data, maps to Grunnlag |
| `backend/repositories/csv_repository.py` | Keep for `saker.csv` overview |
| `backend/services/varsel_service.py` | Can wrap event submission |
| `backend/routes/varsel_routes.py` | Keep, update to use events |
| All Catenda integration files | Keep as-is |

---

## Implementation Checklist

### Phase 1: Backend Foundation
- [ ] Create `backend/repositories/event_repository.py`
- [ ] Create `backend/services/business_rules.py`
- [ ] Create `backend/routes/event_routes.py`
- [ ] Update `backend/routes/__init__.py` to register events blueprint
- [ ] Add event parsing function to `backend/models/events.py`
- [ ] Write unit tests for business rules
- [ ] Test event persistence with JSON files

### Phase 2: Frontend Adaptation
- [ ] Add new types to `types.ts`
- [ ] Create `hooks/useCaseState.ts`
- [ ] Create `hooks/useEventSubmit.ts`
- [ ] Create `utils/stateAdapter.ts`
- [ ] Update `useCaseLoader.ts` to use new state endpoint
- [ ] Update VarselPanel for event submission
- [ ] Update KravKoePanel for event submission
- [ ] Update BhSvarPanel for event submission

### Phase 3: PDF & Integration
- [ ] Create `StatusReportDocument.tsx`
- [ ] Update `pdfGenerator.ts` with state-based generation
- [ ] Create `backend/services/event_side_effects.py`
- [ ] Wire up Catenda comments on event submission
- [ ] Test PDF generation from SakState

### Phase 4: Migration
- [ ] Create `scripts/create_test_case.py`
- [ ] Clear prototype data directory
- [ ] Run end-to-end test with fresh case
- [ ] Document deprecated files

---

## Appendix A: Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVENT SUBMISSION FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

User Action          Frontend                Backend                  Storage
    │                   │                       │                        │
    │  Click "Send"     │                       │                        │
    ├──────────────────>│                       │                        │
    │                   │  POST /api/events     │                        │
    │                   │  {event_type, data}   │                        │
    │                   ├──────────────────────>│                        │
    │                   │                       │                        │
    │                   │                       │  1. Parse event        │
    │                   │                       │  2. Load existing      │
    │                   │                       │     events             │
    │                   │                       │<───────────────────────│
    │                   │                       │                        │
    │                   │                       │  3. Compute current    │
    │                   │                       │     state              │
    │                   │                       │                        │
    │                   │                       │  4. Validate rules     │
    │                   │                       │     (BusinessRules)    │
    │                   │                       │                        │
    │                   │   (if invalid)        │                        │
    │                   │<──400 + error msg─────│                        │
    │                   │                       │                        │
    │                   │   (if valid)          │  5. Append event       │
    │                   │                       ├───────────────────────>│
    │                   │                       │                        │
    │                   │                       │  6. Compute new state  │
    │                   │                       │                        │
    │                   │                       │  7. Post to Catenda    │
    │                   │                       │     (async)            │
    │                   │                       │                        │
    │                   │<──201 + new_state─────│                        │
    │                   │                       │                        │
    │  Update UI        │                       │                        │
    │<──────────────────│                       │                        │
    │                   │                       │                        │
```

---

## Appendix B: State Computation Example

```
Events (chronological):
1. sak_opprettet        → State: { overordnet: UTKAST }
2. grunnlag_opprettet   → State: { grunnlag: SENDT, overordnet: SENDT }
3. vederlag_krav_sendt  → State: { vederlag: SENDT }
4. frist_krav_sendt     → State: { frist: SENDT, overordnet: VENTER_PAA_SVAR }
5. respons_grunnlag     → State: { grunnlag: GODKJENT, overordnet: UNDER_BEHANDLING }
   (resultat: godkjent)
6. respons_vederlag     → State: { vederlag: DELVIS_GODKJENT }
   (resultat: delvis)
7. respons_frist        → State: { frist: GODKJENT }
   (resultat: godkjent)
8. vederlag_krav_opd    → State: { vederlag: SENDT (v2), overordnet: UNDER_FORHANDLING }
   (versjon: 2)
9. respons_vederlag     → State: { vederlag: GODKJENT }
   (resultat: godkjent)
10. eo_utstedt          → State: { overordnet: OMFORENT, all tracks: LAAST }

Final State:
{
    grunnlag: { status: LAAST, bh_resultat: GODKJENT },
    vederlag: { status: LAAST, bh_resultat: GODKJENT, antall_versjoner: 2 },
    frist: { status: LAAST, bh_resultat: GODKJENT },
    overordnet_status: OMFORENT,
    kan_utstede_eo: false (already issued)
}
```
