# ADR-005: Kombinert Context-endpoint for sakssider

**Status:** Akseptert
**Dato:** 2026-02-16
**Beslutningstagere:** Utviklingsteam
**Kontekst:** Ytelsesoptimalisering av BentoCasePage/CasePage (8s → <1s lastetid)

---

## Sammendrag

Sakssider (CasePage, CasePageBento) trengte 3 separate API-kall til backend for å laste data. Hvert kall hentet de samme events fra Supabase uavhengig, noe som ga 3x nettverkslatens til eu-north-1. Vi introduserte et kombinert `/context`-endpoint som henter events én gang og returnerer alle tre views i ett svar.

---

## Kontekst

### Problemet

Når en bruker åpnet en saksside, sendte frontend 3 parallelle requests:

| Endpoint | Hva | Supabase-kall |
|----------|-----|---------------|
| `/api/cases/{id}/state` | Beregnet tilstand | `get_events(sak_id)` |
| `/api/cases/{id}/timeline` | CloudEvents-tidslinje | `get_events(sak_id)` |
| `/api/cases/{id}/historikk` | Revisjonshistorikk | `get_events(sak_id)` |

Alle tre endepunktene kjørte **identisk** `get_events(sak_id)` mot Supabase. Med kald tilkobling tok hvert kall ~1.5s, som ga ~4.5s bare i database-ventetid. I tillegg ble events parset 3 ganger.

### Måling (før)

```
/state:     ~1500ms (kald) / ~200ms (varm)
/timeline:  ~1500ms (kald) / ~200ms (varm)
/historikk: ~1500ms (kald) / ~200ms (varm)
Total:      ~4500ms (kald) / ~600ms (varm)
```

### Måling (etter)

```
/context:   ~300ms (én Supabase round-trip)
```

---

## Alternativer vurdert

| Alternativ | Beskrivelse | Vurdering |
|------------|-------------|-----------|
| A: Server-side caching (Redis) | Cache events i Redis, del mellom endpoints | Introduserer ny infrastruktur, cache-invalidering er komplekst med event sourcing |
| B: Backend request-scoped cache | Cache events per HTTP-request | Løser ikke problemet — det er 3 separate requests |
| C: Kombinert endpoint | Ett endpoint returnerer alt | Enklest, eliminerer problemet helt |
| D: Frontend-side dedup | La frontend sende events-ID og gjenbruk | Krever ny protokoll, kompliserer frontend |

### Beslutning

**Alternativ C: Kombinert endpoint.** Enklest løsning som eliminerer rotårsaken (redundante Supabase round-trips) uten ny infrastruktur.

---

## Implementasjon

### Backend

**Nytt endpoint:** `GET /api/cases/{sak_id}/context`

```python
@events_bp.route("/api/cases/<sak_id>/context", methods=["GET"])
@require_magic_link
@require_project_access()
def get_case_context(sak_id):
    events, version = _fetch_and_parse_events(sak_id)  # Én DB-query
    state = timeline_service.compute_state(events)
    timeline = format_timeline_response(events)
    historikk = {
        "grunnlag": timeline_service.get_grunnlag_historikk(events),
        "vederlag": timeline_service.get_vederlag_historikk(events),
        "frist":    timeline_service.get_frist_historikk(events),
    }
    return jsonify({"version": version, "state": ..., "timeline": ..., "historikk": ...})
```

**Delt hjelper:** `_fetch_and_parse_events(sak_id)` er ekstrahert og brukes av alle 4 endepunktene (state, timeline, historikk, context).

De individuelle endepunktene beholdes for bakoverkompatibilitet og for sider som kun trenger ett view (f.eks. ForseringPage trenger bare state).

### Frontend

**Ny hook:** `useCaseContext(sakId)` erstatter kombinasjonen av:
- `useCaseStateSuspense(sakId)`
- `useTimelineSuspense(sakId)`
- `useHistorikk(sakId)`

Returnerer data strukturert for drop-in replacement:

```typescript
const { data, timelineData, grunnlagHistorikk, vederlagHistorikk, fristHistorikk } = useCaseContext(sakId);
```

**Cache-invalidering:** `useSubmitEvent` invaliderer `sakKeys.context(sakId)` i tillegg til de individuelle nøklene.

---

## Når bør dette mønsteret brukes?

### Bruk kombinert endpoint når:

- En side trenger **2+ views av samme underliggende data** (events, dokumenter, etc.)
- Data hentes fra en **ekstern database med merkbar latens** (Supabase eu-north-1: ~100-200ms per round-trip)
- Views beregnes fra **identisk kildedata** (event sourcing: state/timeline/historikk er alle projeksjoner av events)

### Bruk individuelle endpoints når:

- En side bare trenger **ett view** (ForseringPage trenger bare state)
- Data kommer fra **forskjellige kilder** (f.eks. state fra events + BIM-links fra bim_links-tabell)
- Responsene er **store nok** til at over-fetching er et problem

### Kandidater for samme mønster

| Side | Dagens mønster | Potensial |
|------|---------------|-----------|
| ForseringPage | state + kontekst (2 kall) | Mulig kombinert `/forsering/{id}/context` |
| EndringsordePage | state + kontekst (2 kall) | Mulig kombinert `/endringsordre/{id}/context` |
| CaseList + Dashboard | liste + aggregeringer | Mulig kombinert `/cases/overview` |

---

## Konsekvenser

### Positive

- **~15x raskere** sideinnlasting (4.5s → 300ms kald)
- **Enklere frontend-kode** — én hook i stedet for tre
- **DRY backend** — delt `_fetch_and_parse_events` eliminerer duplisert parsing-logikk
- **Ingen ny infrastruktur** — ingen Redis, ingen ny database

### Negative

- **Større response** — context returnerer ~3x mer data enn state alene
- **Tettere kobling** — frontend og backend må holdes synkronisert på context-shapet
- **Duplikate endpoints** — individuelle endpoints beholdes for bakoverkompatibilitet

### Risiko

- Ingen vesentlig risiko identifisert. Response-størrelsen er liten (~5-10 KB for 36 events) og context-shapet er en enkel union av eksisterende response-typer.

---

## Relaterte endringer (samme PR)

| Endring | Fil | Effekt |
|---------|-----|--------|
| Health endpoint bruker DI container | `utility_routes.py` | Eliminerer ny DB-tilkobling per health check |
| Visibility-aware health polling | `useConnectionStatus.tsx` | Null polling når tab er skjult |
| useSubmitEvent leser fra context-cache | `useSubmitEvent.ts` | Eliminerer redundant `/state`-fetch |
