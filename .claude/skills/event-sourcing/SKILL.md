---
name: event-sourcing
description: Guide til Event Sourcing arkitekturen. Bruk ved arbeid med events, state-projeksjoner, eller forretningsregler.
---

# Event Sourcing & Datamodell

## Oversikt

Systemet bruker Event Sourcing Light - alle endringer lagres som immutable events som kan prosesseres uavhengig på tre parallelle spor.

## Kjerneprinsipp

```
Events (immutable) → Projeksjon → SakState (computed view)
```

- **Events** lagres i Supabase event store
- **SakState** beregnes fra event-loggen ved hver request
- Ingen direkte state-mutasjon - kun nye events

## Event-Typer

### Grunnlag (TE sender, BH responderer)

| Event | Aktør | Beskrivelse |
|-------|-------|-------------|
| `grunnlag_opprettet` | TE | Oppretter varsel om endring |
| `grunnlag_oppdatert` | TE | Oppdaterer eksisterende varsel |
| `grunnlag_trukket` | TE | Trekker tilbake varselet |
| `respons_grunnlag` | BH | BH responderer (godkjent/avslått/delvis) |
| `respons_grunnlag_oppdatert` | BH | BH endrer standpunkt ("snuoperasjon") |

### Vederlag (TE sender krav, BH responderer)

| Event | Aktør | Beskrivelse |
|-------|-------|-------------|
| `vederlag_krav_sendt` | TE | Sender vederlagskrav |
| `vederlag_krav_oppdatert` | TE | Oppdaterer krav |
| `vederlag_krav_trukket` | TE | Trekker krav |
| `respons_vederlag` | BH | BH responderer på vederlag |
| `respons_vederlag_oppdatert` | BH | BH endrer standpunkt |

### Frist (TE sender krav, BH responderer)

| Event | Aktør | Beskrivelse |
|-------|-------|-------------|
| `frist_krav_sendt` | TE | Sender fristkrav (nøytralt/spesifisert) |
| `frist_krav_oppdatert` | TE | Oppdaterer krav |
| `frist_krav_spesifisert` | TE | Spesifiserer dager for nøytralt varsel |
| `frist_krav_trukket` | TE | Trekker krav |
| `respons_frist` | BH | BH responderer på frist |
| `respons_frist_oppdatert` | BH | BH endrer standpunkt |

### Forsering (§33.8)

| Event | Aktør | Beskrivelse |
|-------|-------|-------------|
| `forsering_varsel` | TE | Varsler om forsering |
| `forsering_respons` | BH | BH aksepterer/avslår forsering |
| `forsering_stoppet` | TE | Stopper pågående forsering |
| `forsering_kostnader_oppdatert` | TE | Oppdaterer påløpte kostnader |
| `forsering_koe_lagt_til` | TE | Legger til KOE i forseringssak |
| `forsering_koe_fjernet` | TE | Fjerner KOE fra forseringssak |

### Endringsordre (§31.3)

| Event | Aktør | Beskrivelse |
|-------|-------|-------------|
| `eo_opprettet` | BH | Oppretter EO-sak |
| `eo_koe_lagt_til` | BH | Legger KOE til i EO |
| `eo_koe_fjernet` | BH | Fjerner KOE fra EO |
| `eo_utstedt` | BH | Utsteder EO formelt |
| `eo_akseptert` | TE | TE aksepterer EO |
| `eo_bestridt` | TE | TE bestrider EO |
| `eo_revidert` | BH | BH reviderer EO |

### System-Events

| Event | Aktør | Beskrivelse |
|-------|-------|-------------|
| `sak_opprettet` | System | Oppretter ny sak i systemet |

## Spor-Status

Hvert spor har en status som endres basert på events:

```
IKKE_RELEVANT → UTKAST → SENDT → UNDER_BEHANDLING → GODKJENT/AVSLÅTT/DELVIS_GODKJENT
                                       ↓                    ↓
                                UNDER_FORHANDLING      TRUKKET
                                       ↓
                                    LAAST
```

**Statuser:**
- `UNDER_FORHANDLING` - BH har avslått/delvis godkjent, forhandling pågår
- `LAAST` - Grunnlag låst etter godkjenning

## Data-Strukturer

### SakEvent (Base)

```python
class SakEvent:
    event_id: str           # Unik ID
    sak_id: str             # Hvilken sak
    event_type: EventType   # Type hendelse
    tidsstempel: datetime   # Når (UTC)
    aktor: str              # Hvem
    aktor_rolle: "TE" | "BH"
    kommentar: Optional[str]
    refererer_til_event_id: Optional[str]  # For responser
```

### SakState (Projeksjon)

```python
class SakState:
    sak_id: str
    sakstittel: str
    sakstype: SaksType                           # standard/forsering/endringsordre
    grunnlag: GrunnlagTilstand
    vederlag: VederlagTilstand
    frist: FristTilstand
    relaterte_saker: List[SakRelasjon]
    forsering_data: Optional[ForseringData]      # Kun for sakstype=forsering
    endringsordre_data: Optional[EndringsordreData]  # Kun for sakstype=endringsordre
    opprettet: Optional[datetime]
    siste_aktivitet: Optional[datetime]
```

## Frontend/Backend Synkronisering

**KRITISK**: Typer må matche mellom frontend og backend!

| Frontend | Backend | Formål |
|----------|---------|--------|
| `src/types/timeline.ts` | `backend/models/events.py` | Event-typer |
| `src/types/timeline.ts` | `backend/models/sak_state.py` | State-modell |
| `src/constants/categories.ts` | `backend/constants/grunnlag_categories.py` | Kategorier |

Bruk `python scripts/check_drift.py` for å verifisere synkronisering.

## API Flyt

### Sende event

```
POST /api/events
{
  "sak_id": "SAK-001",
  "event_type": "grunnlag_opprettet",
  "aktor": "Ola Nordmann",
  "aktor_rolle": "TE",
  "data": { ... }
}
```

### Hente state

```
GET /api/cases/{sak_id}/state
→ Returns: SakState (projisert fra alle events)
```

## Regler og Validering

### Rekkefølge-regler

- Kan ikke sende `respons_grunnlag` før `grunnlag_opprettet` finnes
- Kan ikke sende `vederlag_krav_sendt` på trukket grunnlag
- BH kan bare respondere på events fra TE og vice versa

### Forretningsregler

Se `backend/services/business_rules.py` for komplett liste.

## Vanlige oppgaver

### Legge til ny event-type

1. Legg til i `EventType` enum i `backend/models/events.py`
2. Opprett data-klasse hvis nødvendig
3. Legg til i `AnyEvent` union type
4. Oppdater `src/types/timeline.ts` (frontend)
5. Oppdater state-projeksjon i `timeline_service.py`
6. Kjør `python scripts/check_drift.py` for å verifisere

### Endre state-modell

1. Oppdater Pydantic-modell i `backend/models/sak_state.py`
2. Oppdater TypeScript interface i `src/types/timeline.ts`
3. Oppdater projeksjon i `backend/services/timeline_service.py`
4. Kjør `python scripts/state_drift.py` for å verifisere
