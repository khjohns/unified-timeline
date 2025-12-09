# Implementation Plan: EventDetailModal Enhancement

> **Context**: This document outlines the implementation plan for enhancing the EventDetailModal component and related data flow. It is intended for handoff to another LLM developer.

**Date**: 2024-12-09
**Status**: Ready for implementation
**Priority**: High

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Architecture Overview](#architecture-overview)
4. [Implementation Tasks](#implementation-tasks)
5. [File Reference](#file-reference)
6. [Type Definitions](#type-definitions)
7. [Port Model Documentation](#port-model-documentation)
8. [Code Examples](#code-examples)
9. [Testing Checklist](#testing-checklist)

---

## Executive Summary

The timeline component on CasePage should display event history and allow users to click on events to see full submitted form data. Currently:

- ✅ Frontend `EventDetailModal` exists with type-specific section rendering
- ✅ Frontend types support `event_type` and `event_data` fields
- ❌ **Backend** `TimelineService.get_timeline()` does NOT return `event_type` or `event_data`
- ❌ **EventDetailModal** does not show port-structure for BH response events

### Key Changes Required

1. **Backend**: Modify `TimelineService.get_timeline()` to include `event_type` and `event_data`
2. **Frontend**: Enhance response sections in EventDetailModal to show port-based structure

---

## Problem Statement

### Current State

When a user clicks on a timeline event, the EventDetailModal opens but shows:
- "Ingen detaljert skjemadata tilgjengelig for denne hendelsen."

This happens because the backend `/api/cases/<sak_id>/timeline` endpoint returns:
```json
{
  "event_id": "uuid",
  "tidsstempel": "2024-12-09T10:00:00",
  "type": "Vederlagskrav sendt",    // Human-readable label
  "aktor": "TE Contractor",
  "rolle": "TE",
  "spor": "vederlag",
  "sammendrag": "Krav: 150,000 NOK"
}
```

**Missing fields**:
- `event_type`: Machine-readable enum (`vederlag_krav_sendt`)
- `event_data`: Full submitted form data object

### Root Cause

The `TimelineService.get_timeline()` method (lines 515-539 in `backend/services/timeline_service.py`) intentionally strips data to return only summary fields.

---

## Architecture Overview

### Event Sourcing Pattern

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Action Modal  │────▶│   Event Store   │────▶│ TimelineService │
│  (form submit)  │     │   (JSON files)  │     │ (compute state) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                              ┌────────────────────────────────────────┐
                              │         /api/cases/{id}/timeline       │
                              │                                        │
                              │  Returns: events[] with:               │
                              │  - event_id, tidsstempel, type         │
                              │  - aktor, rolle, spor, sammendrag      │
                              │  - event_type  ❌ (MISSING)            │
                              │  - event_data  ❌ (MISSING)            │
                              └────────────────────────────────────────┘
                                                         │
                                                         ▼
                              ┌────────────────────────────────────────┐
                              │         Frontend CasePage              │
                              │                                        │
                              │  Timeline.tsx ──▶ EventDetailModal     │
                              └────────────────────────────────────────┘
```

### Event Types (NS 8407 Domain)

| Event Type | Actor | Description |
|------------|-------|-------------|
| `sak_opprettet` | TE | Case created |
| `grunnlag_opprettet` | TE | Basis claim sent (§32) |
| `grunnlag_oppdatert` | TE | Basis claim updated |
| `vederlag_krav_sendt` | TE | Compensation claim sent (§34) |
| `vederlag_krav_oppdatert` | TE | Compensation claim updated |
| `frist_krav_sendt` | TE | Deadline extension claim sent (§33) |
| `frist_krav_oppdatert` | TE | Deadline extension claim updated |
| `respons_grunnlag` | BH | Response to basis |
| `respons_grunnlag_oppdatert` | BH | Response to basis updated |
| `respons_vederlag` | BH | Response to compensation (4-port) |
| `respons_vederlag_oppdatert` | BH | Response to compensation updated |
| `respons_frist` | BH | Response to deadline (4-port) |
| `respons_frist_oppdatert` | BH | Response to deadline updated |
| `forsering_varsel` | TE | Acceleration notice (§33.8) |
| `eo_utstedt` | BH | Change order issued |

---

## Implementation Tasks

### Task 1: Backend - Add event_type and event_data to timeline response

**File**: `backend/services/timeline_service.py`
**Method**: `get_timeline()` (lines 515-539)

**Current code**:
```python
def get_timeline(self, events: List[AnyEvent]) -> List[Dict[str, Any]]:
    timeline = []
    for event in sorted(events, key=lambda e: e.tidsstempel, reverse=True):
        entry = {
            "event_id": event.event_id,
            "tidsstempel": event.tidsstempel.isoformat(),
            "type": self._event_type_to_label(event.event_type),
            "aktor": event.aktor,
            "rolle": event.aktor_rolle,
            "spor": self._get_spor_for_event(event),
            "sammendrag": self._get_event_summary(event),
        }
        timeline.append(entry)
    return timeline
```

**Required changes**:
```python
def get_timeline(self, events: List[AnyEvent]) -> List[Dict[str, Any]]:
    timeline = []
    for event in sorted(events, key=lambda e: e.tidsstempel, reverse=True):
        entry = {
            "event_id": event.event_id,
            "tidsstempel": event.tidsstempel.isoformat(),
            "type": self._event_type_to_label(event.event_type),
            "event_type": event.event_type.value,  # ADD: Machine-readable type
            "aktor": event.aktor,
            "rolle": event.aktor_rolle,
            "spor": self._get_spor_for_event(event),
            "sammendrag": self._get_event_summary(event),
            "event_data": self._serialize_event_data(event),  # ADD: Full form data
        }
        timeline.append(entry)
    return timeline

def _serialize_event_data(self, event: AnyEvent) -> Optional[Dict[str, Any]]:
    """Serialize event data payload for frontend display."""
    if not hasattr(event, 'data') or event.data is None:
        return None

    # Use Pydantic's model_dump for serialization
    if hasattr(event.data, 'model_dump'):
        return event.data.model_dump(mode='json')
    elif hasattr(event.data, 'dict'):
        return event.data.dict()

    return None
```

**Validation**:
- Test with mock data
- Test with real backend by creating new events and checking timeline response

---

### Task 2: Frontend - Enhance ResponsVederlagSection for port structure

**File**: `src/components/views/EventDetailModal.tsx`
**Section**: `ResponsVederlagSection` (lines 440-503)

The current implementation shows BH response data flat, but the 4-port wizard structure should be reflected:

**Port structure for vederlag response**:
```
Port 1: Særskilte krav - Preklusjon (§34.1.3)
  - saerskilt_varsel_rigg_drift_ok: boolean
  - varsel_justert_ep_ok: boolean
  - varsel_start_regning_ok: boolean
  - krav_fremmet_i_tide: boolean
  - begrunnelse_varsel: string

Port 2: Metode & Svarplikt
  - vederlagsmetode: VederlagsMetode
  - (handled as part of beregnings_resultat)

Port 3: Beløpsvurdering
  - beregnings_resultat: VederlagBeregningResultat
  - godkjent_belop: number
  - begrunnelse_beregning: string

Port 4: Oppsummering
  - (computed: principal vs subsidiary results)
```

**Suggested UI enhancement**:
```tsx
function ResponsVederlagSection({ data }: { data: ResponsVederlagEventData }) {
  const badge = getVederlagResultatBadge(data.beregnings_resultat);

  // Determine if Port 1 has any evaluations
  const hasPort1 = data.saerskilt_varsel_rigg_drift_ok !== undefined ||
                   data.varsel_justert_ep_ok !== undefined ||
                   data.varsel_start_regning_ok !== undefined ||
                   data.krav_fremmet_i_tide !== undefined;

  return (
    <dl className="space-y-4">
      {/* Overall Result */}
      <Field
        label="Samlet resultat"
        value={<Badge variant={badge.variant}>{badge.label}</Badge>}
      />

      {/* Port 1: Varselvurdering */}
      {hasPort1 && (
        <Collapsible
          title="Port 1: Varselvurdering (§34.1.3)"
          defaultOpen={false}
        >
          <div className="space-y-2 pl-4 border-l-2 border-blue-300">
            {data.saerskilt_varsel_rigg_drift_ok !== undefined && (
              <Field
                label="Rigg/drift varsel OK"
                value={<Badge variant={data.saerskilt_varsel_rigg_drift_ok ? 'success' : 'danger'}>
                  {data.saerskilt_varsel_rigg_drift_ok ? 'Ja' : 'Nei - prekludert'}
                </Badge>}
              />
            )}
            {/* ... other Port 1 fields ... */}
            {data.begrunnelse_varsel && (
              <LongTextField label="Begrunnelse varselvurdering" value={data.begrunnelse_varsel} />
            )}
          </div>
        </Collapsible>
      )}

      {/* Port 2: Metode */}
      {data.vederlagsmetode && (
        <Collapsible title="Port 2: Metode" defaultOpen={false}>
          <div className="pl-4 border-l-2 border-green-300">
            <Field label="Valgt metode" value={getVederlagsmetodeLabel(data.vederlagsmetode)} />
          </div>
        </Collapsible>
      )}

      {/* Port 3: Beløpsvurdering */}
      <Collapsible title="Port 3: Beløpsvurdering" defaultOpen={true}>
        <div className="space-y-2 pl-4 border-l-2 border-yellow-300">
          {data.godkjent_belop !== undefined && (
            <Field label="Godkjent beløp" value={formatCurrency(data.godkjent_belop)} />
          )}
          {data.begrunnelse_beregning && (
            <LongTextField label="Begrunnelse" value={data.begrunnelse_beregning} />
          )}
        </div>
      </Collapsible>
    </dl>
  );
}
```

---

### Task 3: Frontend - Enhance ResponsFristSection for port structure

**File**: `src/components/views/EventDetailModal.tsx`
**Section**: `ResponsFristSection` (lines 521-577)

**Port structure for frist response**:
```
Port 1: Preklusjon (§33.4, §33.6)
  - noytralt_varsel_ok: boolean
  - spesifisert_krav_ok: boolean
  - har_bh_etterlyst: boolean
  - begrunnelse_varsel: string
  - frist_for_spesifisering: string (if etterlysning)

Port 2: Vilkår (§33.5)
  - vilkar_oppfylt: boolean
  - begrunnelse_vilkar: string

Port 3: Beregning
  - beregnings_resultat: FristBeregningResultat
  - godkjent_dager: number
  - ny_sluttdato: string
  - begrunnelse_beregning: string
```

Similar enhancement pattern as Task 2.

---

### Task 4: Consider subsidiary display

In BH response modals, there's a concept of "principal vs subsidiary" results:
- **Principal (Prinsipalt)**: The main position (may include preclusion)
- **Subsidiary (Subsidiært)**: Alternative position if preclusion is overturned

The current `EventDetailModal` does not distinguish these. Consider adding:

```tsx
// In summary section
{data.principal_resultat && data.subsidiaer_resultat && (
  <div className="bg-amber-50 p-3 rounded-lg mb-4">
    <p className="text-sm font-medium text-amber-800 mb-2">
      BH har tatt subsidiær stilling
    </p>
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-amber-700">Prinsipalt:</span>
        <Badge variant={...}>{data.principal_resultat}</Badge>
      </div>
      <div>
        <span className="text-amber-700">Subsidiært:</span>
        <Badge variant={...}>{data.subsidiaer_resultat}</Badge>
      </div>
    </div>
  </div>
)}
```

**Note**: This requires backend changes to store/return both results. Currently only `beregnings_resultat` is stored.

---

## File Reference

### Backend Files

| File | Purpose | Lines to modify |
|------|---------|-----------------|
| `backend/services/timeline_service.py` | Main timeline service | 515-539 (get_timeline) |
| `backend/models/events.py` | Event model definitions | Reference only |
| `backend/routes/event_routes.py` | API endpoints | 389-407 (get_case_timeline) |

### Frontend Files

| File | Purpose | Lines to modify |
|------|---------|-----------------|
| `src/components/views/EventDetailModal.tsx` | Modal component | 440-503, 521-577 |
| `src/components/views/Timeline.tsx` | Timeline list | Reference only |
| `src/types/timeline.ts` | TypeScript types | Reference only |
| `src/types/api.ts` | API response types | Reference only |
| `src/api/state.ts` | API fetch functions | Reference only |
| `src/pages/CasePage.tsx` | Main page | Reference only |

### Reference Files (for understanding)

| File | Purpose |
|------|---------|
| `src/components/actions/RespondVederlagModal.tsx` | 4-port wizard for vederlag response |
| `src/components/actions/RespondFristModal.tsx` | 4-port wizard for frist response |

---

## Type Definitions

### EventType Enum (TypeScript)

```typescript
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
  | 'respons_grunnlag_oppdatert'
  | 'respons_vederlag'
  | 'respons_vederlag_oppdatert'
  | 'respons_frist'
  | 'respons_frist_oppdatert'
  | 'forsering_varsel'
  | 'eo_utstedt';
```

### ResponsVederlagEventData

```typescript
export interface ResponsVederlagEventData {
  // Port 1: Spesifikke varsler
  saerskilt_varsel_rigg_drift_ok?: boolean;
  varsel_justert_ep_ok?: boolean;
  varsel_start_regning_ok?: boolean;
  krav_fremmet_i_tide?: boolean;
  begrunnelse_varsel?: string;

  // Port 2: Beregning & Metode
  vederlagsmetode?: VederlagsMetode;
  beregnings_resultat: VederlagBeregningResultat;
  godkjent_belop?: number;
  begrunnelse_beregning?: string;
  frist_for_spesifikasjon?: string;
}
```

### ResponsFristEventData

```typescript
export interface ResponsFristEventData {
  // Port 1: Preklusjon (Varsling)
  noytralt_varsel_ok?: boolean;
  spesifisert_krav_ok?: boolean;
  har_bh_etterlyst?: boolean;
  begrunnelse_varsel?: string;

  // Port 2: Vilkår (Årsakssammenheng)
  vilkar_oppfylt?: boolean;
  begrunnelse_vilkar?: string;

  // Port 3: Utmåling (Beregning)
  beregnings_resultat: FristBeregningResultat;
  godkjent_dager?: number;
  ny_sluttdato?: string;
  begrunnelse_beregning?: string;
  frist_for_spesifisering?: string;
}
```

---

## Port Model Documentation

### RespondVederlagModal: 4-Port Wizard

```
┌─────────────────────────────────────────────────────────────────┐
│  PORT 1: Særskilte krav - Preklusjon (§34.1.3)                  │
│                                                                 │
│  Only applicable if TE claimed rigg/drift or produktivitet.    │
│  BH evaluates: Was the separate notice sent in time?           │
│                                                                 │
│  Fields:                                                        │
│  - rigg_varslet_i_tide: boolean                                 │
│  - produktivitet_varslet_i_tide: boolean                        │
│  - begrunnelse_preklusjon: string                               │
│                                                                 │
│  Key rule: If NOT varslet i tide → preklusjon (claim lost)      │
│  BUT: BH must still evaluate subsidiarily                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PORT 2: Metode & Svarplikt                                     │
│                                                                 │
│  BH accepts or rejects TE's chosen method.                      │
│  May withhold payment (§30.2) for regningsarbeid without        │
│  kostnadsoverslag.                                              │
│                                                                 │
│  Fields:                                                        │
│  - aksepterer_metode: boolean                                   │
│  - oensket_metode: VederlagsMetode (if not accepting)           │
│  - ep_justering_akseptert: boolean (for ENHETSPRISER)           │
│  - hold_tilbake: boolean (for REGNINGSARBEID)                   │
│  - begrunnelse_metode: string                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PORT 3: Beløpsvurdering                                        │
│                                                                 │
│  BH evaluates the claimed amount.                               │
│  Applies separately to hovedkrav and særskilte krav.            │
│  For precluded særskilte: evaluated SUBSIDIARILY                │
│                                                                 │
│  Fields:                                                        │
│  - hovedkrav_vurdering: 'godkjent' | 'delvis' | 'avvist'        │
│  - hovedkrav_godkjent_belop: number                             │
│  - rigg_vurdering: enum (if not precluded)                      │
│  - rigg_godkjent_belop: number                                  │
│  - produktivitet_vurdering: enum                                │
│  - produktivitet_godkjent_belop: number                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PORT 4: Oppsummering                                           │
│                                                                 │
│  Shows computed results:                                        │
│  - Principal result (respects preclusion)                       │
│  - Subsidiary result (ignores preclusion)                       │
│                                                                 │
│  Final field:                                                   │
│  - begrunnelse_samlet: string (required)                        │
└─────────────────────────────────────────────────────────────────┘
```

### RespondFristModal: 4-Port Wizard

```
┌─────────────────────────────────────────────────────────────────┐
│  PORT 1: Preklusjon (§33.4, §33.6)                              │
│                                                                 │
│  BH evaluates: Did TE notify in time?                           │
│  - §33.4: Nøytralt varsel "uten ugrunnet opphold"               │
│  - §33.6: Spesifisert krav "uten ugrunnet opphold"              │
│                                                                 │
│  Fields:                                                        │
│  - noytralt_varsel_ok: boolean                                  │
│  - spesifisert_krav_ok: boolean                                 │
│  - send_etterlysning: boolean (§33.6.2)                         │
│  - frist_for_spesifisering: string (if etterlysning)            │
│  - begrunnelse_preklusjon: string                               │
│                                                                 │
│  Key: BH has PASSIVE ACCEPTANCE if no response in 14 days       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PORT 2: Vilkår (§33.5)                                         │
│                                                                 │
│  BH evaluates: Was there actual hindrance?                      │
│  Even if precluded in Port 1, BH evaluates SUBSIDIARILY.        │
│                                                                 │
│  Fields:                                                        │
│  - vilkar_oppfylt: boolean                                      │
│  - begrunnelse_vilkar: string                                   │
│                                                                 │
│  If vilkar_oppfylt = false → "avslatt_ingen_hindring"           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PORT 3: Beregning                                              │
│                                                                 │
│  BH calculates approved extension days.                         │
│  Evaluated SUBSIDIARILY if precluded or no hindrance.           │
│                                                                 │
│  Fields:                                                        │
│  - godkjent_dager: number                                       │
│  - ny_sluttdato: string                                         │
│  - begrunnelse_beregning: string                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PORT 4: Oppsummering                                           │
│                                                                 │
│  Shows computed results:                                        │
│  - Principal result (respects preclusion + vilkår)              │
│  - Subsidiary result (ignores preclusion, respects vilkår)      │
│                                                                 │
│  Also shows forsering warning (§33.8) if rejected:              │
│  "Rejection may be treated as forsering order"                  │
│                                                                 │
│  Final field:                                                   │
│  - begrunnelse_samlet: string (required)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code Examples

### Backend: Updated get_timeline method

```python
def get_timeline(self, events: List[AnyEvent]) -> List[Dict[str, Any]]:
    """
    Returnerer events formatert som tidslinje for UI.

    Hvert element inneholder:
    - event_id
    - tidsstempel
    - type (lesbar tekst)
    - event_type (maskinlesbar enum-verdi)
    - aktor/rolle
    - spor (hvis relevant)
    - sammendrag (kort beskrivelse)
    - event_data (full skjemadata, hvis tilgjengelig)
    """
    timeline = []
    for event in sorted(events, key=lambda e: e.tidsstempel, reverse=True):
        entry = {
            "event_id": event.event_id,
            "tidsstempel": event.tidsstempel.isoformat(),
            "type": self._event_type_to_label(event.event_type),
            "event_type": event.event_type.value,  # NEW
            "aktor": event.aktor,
            "rolle": event.aktor_rolle,
            "spor": self._get_spor_for_event(event),
            "sammendrag": self._get_event_summary(event),
            "event_data": self._serialize_event_data(event),  # NEW
        }
        timeline.append(entry)
    return timeline

def _serialize_event_data(self, event: AnyEvent) -> Optional[Dict[str, Any]]:
    """
    Serialize event data for frontend consumption.

    Handles different event types and their data structures.
    Returns None for events without data (e.g., sak_opprettet).
    """
    # Events without data payload
    if isinstance(event, SakOpprettetEvent):
        # Return basic sak info
        return {
            "sakstittel": event.sakstittel,
            "catenda_topic_id": event.catenda_topic_id,
        }

    if isinstance(event, EOUtstedtEvent):
        return {
            "eo_nummer": event.eo_nummer,
            "endelig_vederlag": event.endelig_vederlag,
            "endelig_frist_dager": event.endelig_frist_dager,
        }

    # Events with data attribute
    if hasattr(event, 'data') and event.data is not None:
        try:
            if hasattr(event.data, 'model_dump'):
                # Pydantic v2
                return event.data.model_dump(mode='json')
            elif hasattr(event.data, 'dict'):
                # Pydantic v1
                return event.data.dict()
        except Exception as e:
            logger.warning(f"Failed to serialize event data: {e}")

    return None
```

### Frontend: Port-based ResponsVederlagSection

```tsx
function ResponsVederlagSection({ data }: { data: ResponsVederlagEventData }) {
  const badge = getVederlagResultatBadge(data.beregnings_resultat);

  // Check which ports have data
  const hasPort1Data =
    data.saerskilt_varsel_rigg_drift_ok !== undefined ||
    data.varsel_justert_ep_ok !== undefined ||
    data.varsel_start_regning_ok !== undefined ||
    data.krav_fremmet_i_tide !== undefined;

  const hasPort2Data = data.vederlagsmetode !== undefined;

  return (
    <dl className="space-y-4">
      {/* Samlet resultat */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <Field
          label="Samlet resultat"
          value={<Badge variant={badge.variant} size="lg">{badge.label}</Badge>}
        />
        {data.godkjent_belop !== undefined && (
          <Field label="Godkjent beløp" value={formatCurrency(data.godkjent_belop)} />
        )}
      </div>

      {/* Port 1: Varselvurdering */}
      {hasPort1Data && (
        <div className="border border-blue-200 rounded-lg overflow-hidden">
          <Collapsible
            title={
              <span className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium">
                  Port 1
                </span>
                Varselvurdering (§34.1.3)
              </span>
            }
            defaultOpen={false}
          >
            <div className="p-4 space-y-3 bg-blue-50">
              {data.saerskilt_varsel_rigg_drift_ok !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Rigg/drift varslet i tide</span>
                  <Badge variant={data.saerskilt_varsel_rigg_drift_ok ? 'success' : 'danger'}>
                    {data.saerskilt_varsel_rigg_drift_ok ? 'Ja' : 'Nei - prekludert'}
                  </Badge>
                </div>
              )}
              {data.varsel_justert_ep_ok !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Justert EP varslet i tide</span>
                  <Badge variant={data.varsel_justert_ep_ok ? 'success' : 'danger'}>
                    {data.varsel_justert_ep_ok ? 'Ja' : 'Nei'}
                  </Badge>
                </div>
              )}
              {data.varsel_start_regning_ok !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Regningsarbeid varslet</span>
                  <Badge variant={data.varsel_start_regning_ok ? 'success' : 'danger'}>
                    {data.varsel_start_regning_ok ? 'Ja' : 'Nei'}
                  </Badge>
                </div>
              )}
              {data.krav_fremmet_i_tide !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Krav fremmet i tide</span>
                  <Badge variant={data.krav_fremmet_i_tide ? 'success' : 'warning'}>
                    {data.krav_fremmet_i_tide ? 'Ja' : 'Nei'}
                  </Badge>
                </div>
              )}
              {data.begrunnelse_varsel && (
                <LongTextField
                  label="Begrunnelse varselvurdering"
                  value={data.begrunnelse_varsel}
                />
              )}
            </div>
          </Collapsible>
        </div>
      )}

      {/* Port 2: Metode */}
      {hasPort2Data && (
        <div className="border border-green-200 rounded-lg overflow-hidden">
          <Collapsible
            title={
              <span className="flex items-center gap-2">
                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium">
                  Port 2
                </span>
                Metode
              </span>
            }
            defaultOpen={false}
          >
            <div className="p-4 bg-green-50">
              <Field
                label="Valgt metode"
                value={getVederlagsmetodeLabel(data.vederlagsmetode)}
              />
            </div>
          </Collapsible>
        </div>
      )}

      {/* Port 3: Beløpsvurdering */}
      <div className="border border-yellow-200 rounded-lg overflow-hidden">
        <Collapsible
          title={
            <span className="flex items-center gap-2">
              <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-medium">
                Port 3
              </span>
              Beløpsvurdering
            </span>
          }
          defaultOpen={true}
        >
          <div className="p-4 space-y-3 bg-yellow-50">
            <Field
              label="Beregningsresultat"
              value={<Badge variant={badge.variant}>{badge.label}</Badge>}
            />
            {data.godkjent_belop !== undefined && (
              <Field label="Godkjent beløp" value={formatCurrency(data.godkjent_belop)} />
            )}
            {data.begrunnelse_beregning && (
              <LongTextField
                label="Begrunnelse"
                value={data.begrunnelse_beregning}
                defaultOpen={true}
              />
            )}
            {data.frist_for_spesifikasjon && (
              <Field
                label="Frist for spesifikasjon"
                value={formatDate(data.frist_for_spesifikasjon)}
              />
            )}
          </div>
        </Collapsible>
      </div>
    </dl>
  );
}
```

---

## Testing Checklist

### Backend Tests

- [ ] `get_timeline()` returns `event_type` field with correct enum value
- [ ] `get_timeline()` returns `event_data` for grunnlag events
- [ ] `get_timeline()` returns `event_data` for vederlag events
- [ ] `get_timeline()` returns `event_data` for frist events
- [ ] `get_timeline()` returns `event_data` for respons events (all types)
- [ ] `event_data` serialization handles Pydantic v1 and v2
- [ ] `event_data` is `null` for events without data (graceful fallback)

### Frontend Tests

- [ ] EventDetailModal opens when clicking timeline event
- [ ] EventDetailModal shows correct event type label
- [ ] EventDetailModal shows event metadata (date, actor, role, spor)
- [ ] GrunnlagSection renders all fields correctly
- [ ] VederlagSection renders all fields correctly
- [ ] FristSection renders all fields correctly
- [ ] ResponsGrunnlagSection renders with result badge
- [ ] ResponsVederlagSection shows port structure (if data present)
- [ ] ResponsFristSection shows port structure (if data present)
- [ ] Long text fields use Collapsible
- [ ] Generic fallback works for unknown event types

### Integration Tests

- [ ] Create new vederlag claim → verify timeline shows event_data
- [ ] Submit BH vederlag response → verify timeline shows port structure
- [ ] Submit BH frist response → verify timeline shows port structure
- [ ] Test with both mock data and real backend

---

## Notes for Implementer

1. **Start with backend**: The frontend already has the structure to render data, it just needs the backend to provide it.

2. **Test incrementally**: After backend change, verify in browser devtools that the API response includes `event_type` and `event_data`.

3. **Port sections are optional**: Only show port structure if the relevant fields are present in `event_data`. The current flat display is fine as a fallback.

4. **Subsidiary display is future work**: Don't implement principal/subsidiary distinction now unless specifically requested.

5. **Mock data**: The mock data in `src/mock/events.ts` should already include `event_type` and `event_data` (verify this).

6. **Error handling**: The `GenericSection` component serves as a fallback for unknown event types or malformed data.

---

## Questions for Product Owner

1. Should we distinguish principal vs subsidiary results in the display?
2. Should we show a "revision" indicator linking response to the specific claim version?
3. Should we add PDF preview/download capability from the modal?
4. Should we add ability to compare current vs previous versions?

---

*Document prepared by: Claude (LLM Assistant)*
*Last updated: 2024-12-09*
