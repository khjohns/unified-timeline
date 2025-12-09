# Implementation Plan: EventDetailModal Enhancement

> **Context**: This document outlines the implementation plan for enhancing the EventDetailModal component and related data flow. It is intended for handoff to another LLM developer.

**Date**: 2025-12-09
**Status**: Partially implemented - Backend changes pending
**Priority**: High

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Architecture Overview](#architecture-overview)
4. [Implementation Tasks](#implementation-tasks)
5. [UI Mockups](#ui-mockups)
6. [File Reference](#file-reference)
7. [Type Definitions](#type-definitions)
8. [Port Model Documentation](#port-model-documentation)
9. [Code Examples](#code-examples)
10. [Testing Checklist](#testing-checklist)

---

## Executive Summary

The timeline component on CasePage should display event history and allow users to click on events to see full submitted form data. Currently:

- ✅ Frontend `EventDetailModal` component exists (`src/components/views/EventDetailModal.tsx`, 783 lines)
- ✅ Frontend has type-specific section rendering for all 18 event types
- ✅ Frontend types support `event_type` and `event_data` fields (`src/types/timeline.ts`)
- ✅ Mock data includes `event_type` and `event_data` (works in development mode)
- ❌ **Backend** `TimelineService.get_timeline()` does NOT return `event_type` or `event_data`
- ❌ **Backend** label mapping missing some event types (update events, forsering)
- ⚠️ **EventDetailModal** BH response sections use flat structure (port-based enhancement optional)

### Key Changes Required

1. **Backend (Required)**: Modify `TimelineService.get_timeline()` to include `event_type` and `event_data`
2. **Backend (Required)**: Add missing event type labels to `_event_type_to_label()`
3. **Frontend (Optional)**: Enhance response sections in EventDetailModal to show port-based structure

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

**Additional requirement**: Update `_event_type_to_label()` method (lines 541-559) to include missing event types:

```python
def _event_type_to_label(self, event_type: EventType) -> str:
    """Konverterer event-type til lesbar label"""
    labels = {
        EventType.SAK_OPPRETTET: "Sak opprettet",
        EventType.GRUNNLAG_OPPRETTET: "Grunnlag sendt",
        EventType.GRUNNLAG_OPPDATERT: "Grunnlag oppdatert",
        EventType.GRUNNLAG_TRUKKET: "Grunnlag trukket",
        EventType.VEDERLAG_KRAV_SENDT: "Vederlagskrav sendt",
        EventType.VEDERLAG_KRAV_OPPDATERT: "Vederlagskrav oppdatert",
        EventType.VEDERLAG_KRAV_TRUKKET: "Vederlagskrav trukket",
        EventType.FRIST_KRAV_SENDT: "Fristkrav sendt",
        EventType.FRIST_KRAV_OPPDATERT: "Fristkrav oppdatert",
        EventType.FRIST_KRAV_TRUKKET: "Fristkrav trukket",
        EventType.RESPONS_GRUNNLAG: "BH svarte på grunnlag",
        EventType.RESPONS_GRUNNLAG_OPPDATERT: "BH oppdaterte svar på grunnlag",  # ADD
        EventType.RESPONS_VEDERLAG: "BH svarte på vederlag",
        EventType.RESPONS_VEDERLAG_OPPDATERT: "BH oppdaterte svar på vederlag",  # ADD
        EventType.RESPONS_FRIST: "BH svarte på frist",
        EventType.RESPONS_FRIST_OPPDATERT: "BH oppdaterte svar på frist",  # ADD
        EventType.FORSERING_VARSEL: "Varsel om forsering (§33.8)",  # ADD
        EventType.EO_UTSTEDT: "Endringsordre utstedt",
    }
    return labels.get(event_type, str(event_type))
```

**Validation**:
- Test with mock data
- Test with real backend by creating new events and checking timeline response

---

### Task 2: Frontend - Visual Organization of BH Response Sections (OPTIONAL)

> **Note**: This enhancement is optional. The current flat structure displays all fields correctly.

**Design Principles**:
- ✅ **ALL data visible at once** - No wizard steps, no hidden content
- ✅ **Visual grouping** with headers and dividers (not collapsible sections)
- ✅ **Long text fields** (>150 chars) use `LongTextField` with expand/collapse
- ❌ **NO port-based collapsibles** - users should see everything immediately

**File**: `src/components/views/EventDetailModal.tsx`
**Section**: `ResponsVederlagSection` (lines 440-503)

---

## UI Mockups

### General Modal Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  ╳  Svar på vederlagskrav                                           │
│      Innsendt av Kari Nordmann (BH)                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📅 22. jan. 2025 kl. 14:30    👤 Kari Nordmann    [BH]    [Vederlag]│
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌─ Sammendrag ──────────────────────────────────────────────────┐  │
│  │ Vederlagskrav delvis godkjent - 1 200 000 av 2 500 000 kr     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ═══════════════════════════════════════════════════════════════    │
│  📄 Skjemadata                                                      │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  [INNHOLD VARIERER BASERT PÅ EVENT TYPE - SE MOCKUPS UNDER]         │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  Event ID: evt-001-abc-123                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Mockup: BH Respons på Vederlagskrav

Alle felt synlige - visuelt gruppert med overskrifter:

```
┌─────────────────────────────────────────────────────────────────────┐
│  📄 Skjemadata                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Resultat                    [████ Delvis godkjent ████]            │
│  Godkjent beløp              1 200 000 kr                           │
│  Valgt metode                Regningsarbeid (§30.2/§34.4)           │
│                                                                     │
│  ── Varselvurdering (§34.1.3) ─────────────────────────────────     │
│                                                                     │
│  Rigg/drift varsel OK        [✓ Ja]                                 │
│  Justert EP varsel OK        [✓ Ja]                                 │
│  Regningsarbeid varsel OK    [✗ Nei]                                │
│  Krav fremmet i tide         [✓ Ja]                                 │
│                                                                     │
│  Begrunnelse varselvurdering ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Varsler for rigg/drift og justert EP ble sendt innen fristen. │  │
│  │ Regningsarbeid ble ikke varslet før oppstart, men BH velger   │  │
│  │ å ikke gjøre preklusjon gjeldende da...                       │  │
│  │ [Klikk for å utvide]                                          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ── Beløpsvurdering ───────────────────────────────────────────     │
│                                                                     │
│  Begrunnelse beregning       ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Godkjenner 1 200 000 kr av totalt 2 500 000 kr krevd.         │  │
│  │ Avslag på 800 000 kr skyldes manglende dokumentasjon på...    │  │
│  │ [Klikk for å utvide]                                          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Frist for spesifikasjon     15. feb. 2025                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Mockup: BH Respons på Fristkrav

```
┌─────────────────────────────────────────────────────────────────────┐
│  📄 Skjemadata                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Resultat                    [████ Delvis godkjent ████]            │
│  Godkjente dager             30 dager                               │
│  Ny sluttdato                15. mars 2025                          │
│                                                                     │
│  ── Varselvurdering (§33.4, §33.6) ────────────────────────────     │
│                                                                     │
│  Nøytralt varsel OK          [✓ Ja]                                 │
│  Spesifisert krav OK         [✗ Nei]                                │
│  BH har etterlyst            [⚠ Ja]                                 │
│                                                                     │
│  Begrunnelse varselvurdering ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Nøytralt varsel mottatt i tide. Spesifisert krav mangler...   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ── Vilkårsvurdering (§33.5) ──────────────────────────────────     │
│                                                                     │
│  Vilkår oppfylt              [✓ Ja]                                 │
│                                                                     │
│  Begrunnelse vilkår          ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Årsakssammenheng mellom uventet fjell og forsinkelse er...    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ── Beregning ─────────────────────────────────────────────────     │
│                                                                     │
│  Begrunnelse beregning       ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 30 dager godkjent. Omprosjektering kan gjøres parallelt...    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Frist for spesifisering     1. feb. 2025                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Mockup: TE Vederlagskrav

```
┌─────────────────────────────────────────────────────────────────────┐
│  📄 Skjemadata                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Metode                      Regningsarbeid (§30.2/§34.4)           │
│  Kostnadsoverslag            2 500 000 kr                           │
│                                                                     │
│  Begrunnelse                 ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Kravet inkluderer:                                            │  │
│  │ - Ekstra borekostnader: 1 200 000 NOK                         │  │
│  │ - Endret fundamentløsning: 800 000 NOK                        │  │
│  │ - Prosjektering og rådgivning: 300 000 NOK                    │  │
│  │ - Rigg og drift: 200 000 NOK                                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ── Særskilte krav (§34.1.3) ──────────────────────────────────     │
│                                                                     │
│  │ Rigg/drift                                                       │
│  │   Beløp                   200 000 kr                             │
│  │   Klar over dato          15. jan. 2025                          │
│                                                                     │
│  ── Varsler ───────────────────────────────────────────────────     │
│                                                                     │
│  Rigg/drift varsel           15. jan. 2025 (epost)                  │
│  Regningsarbeid varsel       15. jan. 2025 (epost)                  │
│  Krav fremmet dato           18. jan. 2025                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Mockup: TE Grunnlag

```
┌─────────────────────────────────────────────────────────────────────┐
│  📄 Skjemadata                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Tittel                      Uventet fjell ved fundament B3         │
│  Hovedkategori               Svikt i BH forutsetninger              │
│  Underkategori               Grunnforhold                           │
│  Dato oppdaget               15. jan. 2025                          │
│  Varsel sendt                15. jan. 2025 (epost, byggemøte)       │
│                                                                     │
│  Beskrivelse                 ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Ved peling av fundament B3 ble det påtruffet uventet fjell    │  │
│  │ 2,5 meter høyere enn antatt i prosjekteringsgrunnlaget.       │  │
│  │ Dette krever omprosjektering og endrede løsninger for         │  │
│  │ fundamentering. Geoteknisk rapport fra Multiconsult vedlagt.  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Kontraktsreferanser         §23.1, Vedlegg A - Geoteknisk rapport  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Mockup: Forsering Varsel (§33.8)

```
┌─────────────────────────────────────────────────────────────────────┐
│  📄 Skjemadata                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [████████ Forsering iverksatt (§33.8) ████████]                    │
│                                                                     │
│  Estimert kostnad            450 000 kr                             │
│  Dato iverksettelse          1. feb. 2025                           │
│  30%-regel bekreftet         [✓ Ja - innenfor grensen]              │
│                                                                     │
│  Begrunnelse                 ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ BH har avslått fristkrav. TE varsler herved om iverksettelse  │  │
│  │ av forsering iht. §33.8. Estimert forseringskostnad er...     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Referanse fristkrav         evt-frist-001                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### LongTextField Behavior

For tekstfelt over 150 tegn brukes `LongTextField`-komponenten:

```
┌─ Kort tekst (<150 tegn) ─────────────────────────────────────────┐
│                                                                   │
│  Begrunnelse                 Grunnlaget godkjennes.               │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─ Lang tekst (≥150 tegn) - KOLLAPSET ─────────────────────────────┐
│                                                                   │
│  Begrunnelse                 ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Ved peling av fundament B3 ble det påtruffet uventet...     │  │
│  │ [Klikk for å utvide]                                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─ Lang tekst (≥150 tegn) - UTVIDET ───────────────────────────────┐
│                                                                   │
│  Begrunnelse                 ▲                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Ved peling av fundament B3 ble det påtruffet uventet fjell  │  │
│  │ 2,5 meter høyere enn antatt i prosjekteringsgrunnlaget.     │  │
│  │ Dette krever omprosjektering og endrede løsninger for       │  │
│  │ fundamentering.                                             │  │
│  │                                                             │  │
│  │ Følgende tiltak er nødvendige:                              │  │
│  │ 1. Ny geoteknisk vurdering                                  │  │
│  │ 2. Omprosjektering av fundament                             │  │
│  │ 3. Endret boremetode                                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

### Task 3: Frontend - Visuell Gruppering (OPTIONAL)

> **Note**: Se UI Mockups-seksjonen over for visuell referanse.

**File**: `src/components/views/EventDetailModal.tsx`

**Implementation approach**:

For å implementere visuell gruppering uten wizard/collapsibles, bruk enkle overskrifter med CSS-skillelinjer:

```tsx
// Visual section divider - NOT a collapsible
function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 py-2 mt-4">
      <span className="text-xs font-medium text-pkt-grays-gray-500 uppercase tracking-wide">
        {title}
      </span>
      <div className="flex-1 border-t border-gray-200" />
    </div>
  );
}

// Usage in ResponsVederlagSection:
function ResponsVederlagSection({ data }: { data: ResponsVederlagEventData }) {
  const badge = getVederlagResultatBadge(data.beregnings_resultat);
  const hasVarselFields = /* check if any varsel fields exist */;

  return (
    <dl>
      {/* Summary fields - always visible */}
      <Field label="Resultat" value={<Badge ...>{badge.label}</Badge>} />
      <Field label="Godkjent beløp" value={formatCurrency(data.godkjent_belop)} />
      <Field label="Valgt metode" value={getVederlagsmetodeLabel(data.vederlagsmetode)} />

      {/* Varsel section - with visual divider */}
      {hasVarselFields && (
        <>
          <SectionDivider title="Varselvurdering (§34.1.3)" />
          <Field label="Rigg/drift varsel OK" value={...} />
          <Field label="Justert EP varsel OK" value={...} />
          {/* etc. */}
          <LongTextField label="Begrunnelse varselvurdering" value={data.begrunnelse_varsel} />
        </>
      )}

      {/* Beløpsvurdering section */}
      <SectionDivider title="Beløpsvurdering" />
      <LongTextField label="Begrunnelse beregning" value={data.begrunnelse_beregning} />
      <Field label="Frist for spesifikasjon" value={formatDate(data.frist_for_spesifikasjon)} />
    </dl>
  );
}
```

**Key points**:
- All data visible immediately - no hidden content
- Visual dividers separate logical groups
- Only `LongTextField` (>150 chars) uses expand/collapse
- Groups are NOT collapsible sections

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
| `backend/services/timeline_service.py` | Main timeline service | 515-539 (get_timeline), 541-559 (_event_type_to_label) |
| `backend/models/events.py` | Event model definitions | Reference only |
| `backend/routes/event_routes.py` | API endpoints | 389-407 (get_case_timeline) |

### Frontend Files

| File | Purpose | Lines to modify |
|------|---------|-----------------|
| `src/components/views/EventDetailModal.tsx` | Modal component (783 lines) | 440-503, 521-577 (optional port-structure) |
| `src/components/views/Timeline.tsx` | Timeline list (232 lines) | Reference only |
| `src/types/timeline.ts` | TypeScript types (469 lines) | Reference only |
| `src/types/api.ts` | API response types | Reference only |
| `src/api/state.ts` | API fetch functions | Reference only |
| `src/pages/CasePage.tsx` | Main page | Reference only |
| `src/mocks/mockData.ts` | Mock data with event_type/event_data | Reference only (verified) |

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
- [ ] `_event_type_to_label()` handles all 18 event types (including update types)
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

5. **Mock data**: The mock data in `src/mocks/mockData.ts` already includes `event_type` and `event_data` (verified).

6. **Error handling**: The `GenericSection` component serves as a fallback for unknown event types or malformed data.

7. **Field name inconsistency**: Note that field naming varies slightly between types:
   - `frist_for_spesifisering` in `ResponsFristEventData`
   - `frist_for_spesifikasjon` in `ResponsVederlagEventData`

   This is intentional and matches the backend model. Do not attempt to "fix" this.

8. **Frontend is complete**: The `EventDetailModal` component (783 lines) already handles all 18 event types with dedicated section components. Only backend changes are blocking.

---

## Questions for Product Owner

1. Should we distinguish principal vs subsidiary results in the display?
2. Should we show a "revision" indicator linking response to the specific claim version?
3. Should we add PDF preview/download capability from the modal?
4. Should we add ability to compare current vs previous versions?

---

*Document prepared by: Claude (LLM Assistant)*
*Last updated: 2025-12-09*
*Quality reviewed: 2025-12-09*
