# Implementeringsplan: Forsering som egen sak

## Bakgrunn

Per NS 8407 § 33.8 oppstår forsering når byggherren avslår et berettiget krav om fristforlengelse. I praksis er det mer korrekt å modellere forsering som en **egen sak** som refererer tilbake til fristforlengelsessaken(e), fremfor å ha forsering som et nestet objekt i fristsporet.

### Nåværende modell (embedded)

```
Sak A (Fristforlengelse)
└── frist
    └── forsering: ForseringTilstand  ← Nestet i samme sak
```

### Ny modell (relasjonell)

```
Sak A (Fristforlengelse)     Sak B (Forsering)
    │                            │
    └────── related_topics ──────┘
```

## Forutsetninger

- [x] CatendaClient støtter `create_topic()` for å opprette nye saker
- [x] CatendaClient støtter Topic Relations API (`list_related_topics`, `create_topic_relations`, `delete_topic_relation`)

---

## Fase 1: Backend datamodell

### 1.1 Utvid `SakState` med sakstype og relasjoner

**Fil:** `backend/models/sak_state.py`

```python
from enum import Enum
from typing import List, Optional
from dataclasses import dataclass

class SaksType(str, Enum):
    STANDARD = "standard"           # Ordinær endringssak (grunnlag/vederlag/frist)
    FORSERING = "forsering"         # § 33.8 forseringssak
    # Fremtidige utvidelser:
    # REKLAMASJON = "reklamasjon"
    # SLUTTOPPGJOR = "sluttoppgjor"

class RelasjonsType(str, Enum):
    BASERT_PAA = "basert_paa"       # Forsering basert på avslått fristforlengelse
    UTLOST_AV = "utlost_av"         # Generisk "triggered by" relasjon
    ERSTATTER = "erstatter"         # Sak som erstatter en annen

@dataclass
class SakRelasjon:
    """Relasjon til en annen sak."""
    relatert_sak_id: str            # Catenda topic GUID
    relasjonstype: RelasjonsType
    relatert_sak_tittel: Optional[str] = None  # Cached for display
    relatert_event_id: Optional[str] = None    # Spesifikt event (f.eks. BH's avslag)
```

### 1.2 Oppdater `SakState` klassen

```python
@dataclass
class SakState:
    sak_id: str
    sakstittel: str

    # NY: Sakstype og relasjoner
    sakstype: SaksType = SaksType.STANDARD
    relaterte_saker: List[SakRelasjon] = field(default_factory=list)

    # Eksisterende spor (kun relevant for STANDARD saker)
    grunnlag: Optional[GrunnlagTilstand] = None
    vederlag: Optional[VederlagTilstand] = None
    frist: Optional[FristTilstand] = None

    # NY: Forseringsspesifikke felter (kun for FORSERING saker)
    forsering_data: Optional[ForseringData] = None

    # ... resten av eksisterende felter
```

### 1.3 Ny dataklasse for forseringssak

```python
@dataclass
class ForseringData:
    """Data spesifikk for forseringssaker (§ 33.8)."""

    # Referanser til opprinnelige saker
    avslatte_fristkrav: List[str]   # SAK-IDs til avslåtte fristforlengelser

    # Varsling
    dato_varslet: str
    estimert_kostnad: float
    bekreft_30_prosent_regel: bool  # TE bekrefter kostnad < dagmulkt + 30%

    # Kalkulasjonsgrunnlag
    avslatte_dager: int             # Sum av avslåtte dager
    dagmulktsats: float             # NOK per dag
    maks_forseringskostnad: float   # Beregnet: avslatte_dager * dagmulktsats * 1.3

    # Status
    er_iverksatt: bool = False
    dato_iverksatt: Optional[str] = None
    er_stoppet: bool = False        # BH godkjenner frist etter varsling
    dato_stoppet: Optional[str] = None
    paalopte_kostnader: Optional[float] = None

    # BH respons
    bh_aksepterer_forsering: Optional[bool] = None
    bh_godkjent_kostnad: Optional[float] = None
    bh_begrunnelse: Optional[str] = None
```

---

## Fase 2: Frontend datamodell

### 2.1 Oppdater `src/types/timeline.ts`

```typescript
// Sakstyper
export type SaksType = 'standard' | 'forsering';

// Relasjonstyper mellom saker
export type RelasjonsType = 'basert_paa' | 'utlost_av' | 'erstatter';

export interface SakRelasjon {
  relatert_sak_id: string;
  relasjonstype: RelasjonsType;
  relatert_sak_tittel?: string;
  relatert_event_id?: string;
}

// Forseringsspesifikke data
export interface ForseringData {
  avslatte_fristkrav: string[];
  dato_varslet: string;
  estimert_kostnad: number;
  bekreft_30_prosent_regel: boolean;
  avslatte_dager: number;
  dagmulktsats: number;
  maks_forseringskostnad: number;
  er_iverksatt: boolean;
  dato_iverksatt?: string;
  er_stoppet: boolean;
  dato_stoppet?: string;
  paalopte_kostnader?: number;
  bh_aksepterer_forsering?: boolean;
  bh_godkjent_kostnad?: number;
  bh_begrunnelse?: string;
}

// Oppdatert SakState
export interface SakState {
  sak_id: string;
  sakstittel: string;

  // NY: Sakstype og relasjoner
  sakstype: SaksType;
  relaterte_saker: SakRelasjon[];

  // Spor (kun for standard saker)
  grunnlag: GrunnlagTilstand;
  vederlag: VederlagTilstand;
  frist: FristTilstand;

  // Forseringsdata (kun for forsering saker)
  forsering_data?: ForseringData;

  // ... resten
}
```

---

## Fase 3: Backend services

### 3.1 Ny service: `forsering_service.py`

**Fil:** `backend/services/forsering_service.py`

```python
class ForseringService:
    """Service for å håndtere forseringssaker."""

    def __init__(self, catenda_client: CatendaClient):
        self.client = catenda_client

    async def opprett_forseringssak(
        self,
        avslatte_sak_ids: List[str],
        estimert_kostnad: float,
        dagmulktsats: float,
        begrunnelse: str
    ) -> Dict:
        """
        Oppretter en ny forseringssak med relasjoner til avslåtte fristforlengelsessaker.

        Args:
            avslatte_sak_ids: Liste med sak-IDs til avslåtte fristforlengelser
            estimert_kostnad: TE's estimerte forseringskostnad
            dagmulktsats: Dagmulktsats fra kontrakten (NOK/dag)
            begrunnelse: TE's begrunnelse for forsering

        Returns:
            Den opprettede forseringssaken
        """
        # 1. Hent info fra avslåtte saker
        avslatte_dager = 0
        for sak_id in avslatte_sak_ids:
            sak = await self._hent_sak(sak_id)
            if sak and sak.frist and sak.frist.bh_resultat == 'avslatt':
                avslatte_dager += sak.frist.krevd_dager or 0

        # 2. Beregn maks forseringskostnad (§ 33.8)
        maks_kostnad = avslatte_dager * dagmulktsats * 1.3

        # 3. Valider 30%-regelen
        if estimert_kostnad > maks_kostnad:
            raise ValueError(
                f"Estimert kostnad ({estimert_kostnad:,.0f}) overstiger "
                f"dagmulkt + 30% ({maks_kostnad:,.0f})"
            )

        # 4. Opprett topic i Catenda
        titler = ", ".join([f"SAK-{id[:8]}" for id in avslatte_sak_ids])
        topic = self.client.create_topic(
            title=f"Forsering § 33.8 - {titler}",
            description=begrunnelse,
            topic_type="Forsering",
            topic_status="Open"
        )

        if not topic:
            raise RuntimeError("Kunne ikke opprette topic i Catenda")

        # 5. Opprett relasjoner til avslåtte saker
        self.client.create_topic_relations(
            topic_id=topic['guid'],
            related_topic_guids=avslatte_sak_ids
        )

        # 6. Returner opprettet sak
        return {
            "sak_id": topic['guid'],
            "sakstype": "forsering",
            "relaterte_saker": [
                {"relatert_sak_id": id, "relasjonstype": "basert_paa"}
                for id in avslatte_sak_ids
            ],
            "forsering_data": {
                "avslatte_fristkrav": avslatte_sak_ids,
                "dato_varslet": datetime.now().isoformat(),
                "estimert_kostnad": estimert_kostnad,
                "bekreft_30_prosent_regel": True,
                "avslatte_dager": avslatte_dager,
                "dagmulktsats": dagmulktsats,
                "maks_forseringskostnad": maks_kostnad,
                "er_iverksatt": False,
                "er_stoppet": False
            }
        }

    async def hent_relaterte_saker(self, sak_id: str) -> List[SakRelasjon]:
        """Henter alle relaterte saker for en gitt sak."""
        related = self.client.list_related_topics(sak_id)

        relasjoner = []
        for rel in related:
            # Hent tittel fra relatert sak
            topic = self.client.get_topic_details(rel['related_topic_guid'])
            relasjoner.append(SakRelasjon(
                relatert_sak_id=rel['related_topic_guid'],
                relasjonstype=RelasjonsType.BASERT_PAA,  # Default, kan utvides
                relatert_sak_tittel=topic['title'] if topic else None
            ))

        return relasjoner
```

### 3.2 Oppdater eksisterende event handlers

**Fil:** `backend/services/webhook_service.py`

Legg til håndtering av `forsering_sak_opprettet` event:

```python
async def handle_forsering_sak_opprettet(self, event_data: Dict):
    """Håndterer opprettelse av forseringssak."""
    # Synkroniser med Catenda
    # Oppdater lokalt repository
    # Send notifikasjoner
    pass
```

---

## Fase 4: API routes

### 4.1 Nye endpoints

**Fil:** `backend/routes/forsering_routes.py`

```python
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/forsering", tags=["Forsering"])

@router.post("/opprett")
async def opprett_forseringssak(request: OpprettForseringSakRequest):
    """
    Oppretter en ny forseringssak basert på avslåtte fristforlengelser.

    Request body:
    - avslatte_sak_ids: Liste med sak-IDs
    - estimert_kostnad: TE's estimat
    - dagmulktsats: Fra kontrakten
    - begrunnelse: Fritekst
    """
    pass

@router.get("/{sak_id}/relaterte")
async def hent_relaterte_saker(sak_id: str):
    """Henter alle saker relatert til en forseringssak."""
    pass

@router.post("/{sak_id}/iverksett")
async def iverksett_forsering(sak_id: str):
    """Markerer at forsering er iverksatt."""
    pass

@router.post("/{sak_id}/stopp")
async def stopp_forsering(sak_id: str, request: StoppForseringRequest):
    """Stopper forsering (når BH godkjenner frist i etterkant)."""
    pass
```

---

## Fase 5: Frontend UI

### 5.1 Ny komponent: `CreateForseringSakModal.tsx`

Viser:
- Liste over avslåtte fristforlengelsessaker (velg hvilke som skal inkluderes)
- Kalkulator for 30%-regelen
- Input for estimert kostnad
- Validering mot maks forseringskostnad

### 5.2 Oppdater `CasePage.tsx`

- Vis relaterte saker i sidebar/header
- Klikk på relatert sak navigerer dit
- Betinget rendering basert på `sakstype`

### 5.3 Ny komponent: `RelaterteSakerBadge.tsx`

```tsx
interface Props {
  relaterteSaker: SakRelasjon[];
}

export function RelaterteSakerBadge({ relaterteSaker }: Props) {
  if (relaterteSaker.length === 0) return null;

  return (
    <div className="flex gap-2">
      {relaterteSaker.map(rel => (
        <Link
          key={rel.relatert_sak_id}
          to={`/sak/${rel.relatert_sak_id}`}
          className="badge badge-outline"
        >
          {rel.relasjonstype === 'basert_paa' && '← '}
          {rel.relatert_sak_tittel || rel.relatert_sak_id.slice(0, 8)}
        </Link>
      ))}
    </div>
  );
}
```

---

## Fase 6: Migrering

### 6.1 Migrer eksisterende forsering-data

For saker som allerede har `frist.forsering` (embedded modell):

1. Opprett ny forseringssak i Catenda
2. Kopier data fra `frist.forsering` til `forsering_data`
3. Opprett topic relation
4. Marker gammel embedded forsering som `migrert: true`

### 6.2 Bakoverkompatibilitet

- Behold `FristTilstand.forsering` for lesing (deprecated)
- Nye forseringer opprettes kun som egne saker
- Gradvis migrering av eksisterende data

---

## Arbeidsoppgaver

| # | Oppgave | Estimat | Avhengigheter |
|---|---------|---------|---------------|
| 1 | Backend: Utvid `SakState` med sakstype og relasjoner | S | - |
| 2 | Backend: Opprett `ForseringData` dataklasse | S | 1 |
| 3 | Backend: Implementer `ForseringService` | M | 1, 2 |
| 4 | Backend: Legg til API routes | M | 3 |
| 5 | Frontend: Oppdater `timeline.ts` typer | S | 1 |
| 6 | Frontend: `CreateForseringSakModal` | M | 5 |
| 7 | Frontend: `RelaterteSakerBadge` | S | 5 |
| 8 | Frontend: Oppdater `CasePage` for sakstyper | M | 5, 6, 7 |
| 9 | Migrering: Script for eksisterende data | M | 1-4 |
| 10 | Testing: E2E tester for forsering-flow | M | 1-8 |

**Estimat-nøkkel:** S = Small (< 2 timer), M = Medium (2-4 timer), L = Large (> 4 timer)

---

## Risiko og avveininger

### Risiko 1: Catenda topic_type
Catenda kan ha begrensninger på hvilke `topic_type` verdier som er gyldige. Må verifiseres mot API.

**Mitigering:** Test med `topic_type="Request"` først, utvid ved behov.

### Risiko 2: Synkronisering
Med forsering som egen sak må vi holde to saker synkronisert (original fristforlengelse og forseringssak).

**Mitigering:** Bruk webhooks for å lytte på endringer i begge saker.

### Avveining: Kompleksitet vs. korrekthet
Embedded modell er enklere, men relasjonell modell er mer korrekt ift. NS 8407 og gir bedre sporbarhet.

**Beslutning:** Gå for relasjonell modell for langsiktig vedlikeholdbarhet.

---

## Referanser

- NS 8407 § 33.8 - Forsering
- Catenda Topic Relations API (se `backend/integrations/catenda/client.py`)
- Eksisterende `ForseringTilstand` i `src/types/timeline.ts`
