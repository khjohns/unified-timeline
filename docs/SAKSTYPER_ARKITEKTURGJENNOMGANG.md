# Sakstyper - Arkitekturgjennomgang

**Gjennomgang av datamodeller for sakstyper i backend**

*Opprettet: 2025-12-19*

---

## Innhold

1. [Sammendrag](#1-sammendrag)
2. [Eksisterende sakstyper](#2-eksisterende-sakstyper)
3. [Vurdering av arkitekturen](#3-vurdering-av-arkitekturen)
4. [Forsering som vederlagsmodell](#4-forsering-som-vederlagsmodell)
5. [Fremtidige sakstyper](#5-fremtidige-sakstyper)
6. [Vederlagsbærende protokoll](#6-vederlagsbærende-protokoll)
7. [Anbefalinger](#7-anbefalinger)

---

## 1. Sammendrag

### Dagens tilstand

Systemet støtter tre sakstyper definert i `SaksType` enum (`backend/models/sak_state.py:26-39`):

| Sakstype | Kode | Beskrivelse | NS 8407 |
|----------|------|-------------|---------|
| Standard (KOE) | `standard` | Krav om endringsordre med tre-spor modell | §32, §33, §34 |
| Forsering | `forsering` | Akselerasjon ved avslag på fristforlengelse | §33.8 |
| Endringsordre | `endringsordre` | Formell endring fra byggherre | §31.3 |

### Planlagte utvidelser

| Sakstype | Beskrivelse | NS 8407 |
|----------|-------------|---------|
| Prisforespørsel | BH ber om tilbud før EO | §31.1, §34.2 |
| Opsjon (positiv) | Utløsning av tilleggsarbeid | Kontrakt |
| Opsjon (negativ) | Fradrag/besparelse | §34.4 |

### Hovedfunn

1. **Styrker**: Event sourcing, god relasjonshåndtering, modulær service-arkitektur
2. **Forbedringspunkter**: Forsering bør følge vederlagsmodellen, mangler robusthet for grunnlagssjekk
3. **Utvidbarhet**: Arkitekturen er godt forberedt for nye sakstyper

---

## 2. Eksisterende sakstyper

### 2.1 Standard sak (KOE)

**Lokasjon**: `backend/models/sak_state.py:695-1129`

Standard sak bruker tre-spor modellen:

```
┌─────────────────────────────────────────────────────────────┐
│                     STANDARD SAK (KOE)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │  GRUNNLAG   │  │  VEDERLAG   │  │    FRIST    │        │
│   │  (Hvorfor?) │  │ (Hvor mye?) │  │ (Hvor lenge)│        │
│   ├─────────────┤  ├─────────────┤  ├─────────────┤        │
│   │ Ansvar      │  │ Metode      │  │ Varseltype  │        │
│   │ Kategori    │  │ Beløp       │  │ Dager       │        │
│   │ Beskrivelse │  │ Særskilte   │  │ Sluttdato   │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              BH RESPONS (per spor)                   │  │
│   │  • Port 1: Preklusjon/varsling                       │  │
│   │  • Port 2: Vilkår/årsakssammenheng                   │  │
│   │  • Port 3: Beregning/utmåling                        │  │
│   │  • Subsidiært standpunkt                             │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Nøkkelmodeller**:
- `GrunnlagTilstand` (linje 76-118)
- `VederlagTilstand` (linje 120-271)
- `FristTilstand` (linje 574-691)

### 2.2 Forseringssak

**Lokasjon**: `backend/models/sak_state.py:301-390`

Forsering opprettes når BH avslår fristforlengelse og TE velger å akselerere arbeidet.

```
┌─────────────────────────────────────────────────────────────┐
│                     FORSERINGSSAK (§33.8)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   GRUNNLAG (implisitt):                                      │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Uberettiget avslag på fristforlengelse              │   │
│   │  • avslatte_fristkrav: List[str]                     │   │
│   │  • Referanse til original KOE med frist-avslag       │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   KALKULASJON:                                               │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  • avslatte_dager × dagmulktsats × 1.3              │   │
│   │  • = maks_forseringskostnad                          │   │
│   │  • estimert_kostnad ≤ maks_forseringskostnad        │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   LIVSSYKLUS:                                                │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  varslet → iverksatt → (stoppet?) → BH respons      │   │
│   │                                                      │   │
│   │  • er_iverksatt: bool                                │   │
│   │  • er_stoppet: bool (BH godkjenner frist etter)     │   │
│   │  • paalopte_kostnader: float                         │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   BH RESPONS:                                                │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  • bh_aksepterer_forsering: bool                     │   │
│   │  • bh_godkjent_kostnad: float                        │   │
│   │  • bh_begrunnelse: str                               │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Endringsordresak

**Lokasjon**: `backend/models/sak_state.py:443-572`

Endringsordre samler en eller flere KOE-er i et formelt dokument.

```
┌─────────────────────────────────────────────────────────────┐
│                  ENDRINGSORDRESAK (§31.3)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   IDENTIFIKASJON:                                            │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  • eo_nummer: str                                    │   │
│   │  • revisjon_nummer: int                              │   │
│   │  • relaterte_koe_saker: List[str]                   │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   KONSEKVENSER (EOKonsekvenser):                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  □ SHA      □ Kvalitet    □ Fremdrift               │   │
│   │  □ Pris     □ Annet                                  │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   OPPGJØR:                                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  • oppgjorsform: ENHETSPRISER | REGNING | FASTPRIS  │   │
│   │  • kompensasjon_belop: float                         │   │
│   │  • fradrag_belop: float                              │   │
│   │  • frist_dager: int                                  │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   STATUS (EOStatus):                                         │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  UTKAST → UTSTEDT → AKSEPTERT | BESTRIDT → REVIDERT │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Vurdering av arkitekturen

### 3.1 Styrker

#### Event Sourcing
- Immutable events gir full sporbarhet
- Enkel å utvide med nye event-typer
- Projeksjon via `TimelineService` er ren og forutsigbar

#### Relasjonshåndtering
- `SakRelasjon` støtter toveis-koblinger
- `BaseSakService` gir felles funksjonalitet for container-saker
- Catenda-integrasjon for ekstern synkronisering

#### Modulær service-arkitektur
- `ForseringService` og `EndringsordreService` arver fra `BaseSakService`
- `RelatedCasesService` aggregerer data fra relaterte saker
- Klar separasjon mellom domenelogikk og persistens

### 3.2 Svakheter

#### Inkonsistent modellering av sakstyper
- Standard sak har tre-spor modell (grunnlag/vederlag/frist)
- Forsering og Endringsordre har egne Data-klasser
- Ingen felles abstraksjon for vederlagsbærende saker

#### Forsering mangler vederlagsmodell-struktur
- Forsering er et pengekrav, men følger ikke VederlagTilstand-strukturen
- Grunnlaget (avslått fristforlengelse) er implisitt, ikke eksplisitt modellert
- Mangler robusthet for å sjekke at grunnlaget fortsatt er gyldig

#### SakState vokser med nye felter
```python
class SakState(BaseModel):
    sakstype: SaksType

    # Tre-spor (kun STANDARD)
    grunnlag: GrunnlagTilstand
    vederlag: VederlagTilstand
    frist: FristTilstand

    # Type-spesifikke data
    forsering_data: Optional[ForseringData]      # FORSERING
    endringsordre_data: Optional[EndringsordreData]  # ENDRINGSORDRE
    # prisforespørsel_data: Optional[...]         # Fremtidig
    # opsjon_data: Optional[...]                  # Fremtidig
```

---

## 4. Forsering som vederlagsmodell

### 4.1 Problemstilling

Forsering er i realiteten et **pengekrav** med et **grunnlag**:

| Aspekt | Standard KOE | Forsering |
|--------|--------------|-----------|
| **Grunnlag** | Endring, forsinkelse, etc. | Uberettiget avslag på fristforlengelse |
| **Vederlag** | Beløp per metode | Forseringskostnad innenfor 30%-grense |
| **Frist** | Dager forlengelse | (Ikke relevant - forsering innebærer å holde fristen) |

### 4.2 Grunnlag for forsering

Grunnlaget for forsering er **sammensatt**:

```
┌─────────────────────────────────────────────────────────────┐
│              FORSERINGSGRUNNLAG (§33.8)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   FORUTSETNINGER:                                            │
│   1. TE har fremmet berettiget krav om fristforlengelse     │
│   2. BH har avslått kravet (helt eller delvis)              │
│   3. TE mener avslaget er uberettiget                       │
│                                                              │
│   AVSLAGET MÅ FORTSATT EKSISTERE:                            │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Hvis BH "snur" og godkjenner fristforlengelsen,     │   │
│   │  faller grunnlaget for forsering bort.               │   │
│   │                                                      │   │
│   │  Konsekvens: Forsering stoppes, kun påløpte          │   │
│   │  kostnader kan kreves (ikke estimert kostnad).       │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   REFERANSER:                                                │
│   • avslatte_fristkrav: List[str]  (SAK-IDs)                │
│   • Hvert krav må ha frist.bh_resultat == AVSLATT           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Vederlagsmodell for forsering

Forseringskostnad bør følge samme struktur som VederlagTilstand:

```
┌─────────────────────────────────────────────────────────────┐
│           FORSERING SOM VEDERLAGSMODELL                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   METODE:                                                    │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Forseringsvederlag følger typisk REGNINGSARBEID     │   │
│   │  (påløpte kostnader dokumenteres fortløpende)        │   │
│   │                                                      │   │
│   │  Alternativt: FASTPRIS hvis TE gir fast estimat     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   BELØPSSTRUKTUR:                                            │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Hovedkrav:                                          │   │
│   │  • estimert_kostnad (TEs krav)                       │   │
│   │  • paalopte_kostnader (faktisk påløpt)               │   │
│   │                                                      │   │
│   │  Grense (30%-regelen):                               │   │
│   │  • maks = avslatte_dager × dagmulktsats × 1.3       │   │
│   │  • estimert_kostnad ≤ maks                           │   │
│   │                                                      │   │
│   │  Særskilte krav (kan også gjelde forsering):         │   │
│   │  • Rigg/drift ved forsering                          │   │
│   │  • Produktivitetstap ved akselerert tempo            │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   BH RESPONS:                                                │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Port 1: Er grunnlaget (avslaget) fortsatt gyldig?  │   │
│   │  Port 2: Er 30%-regelen overholdt?                   │   │
│   │  Port 3: Godkjent beløp                              │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Robusthet: Grunnlagssjekk

Systemet bør validere at forseringsgrunnlaget fortsatt er gyldig:

```python
# Forslag til validering i ForseringService

def valider_grunnlag_fortsatt_gyldig(self, forsering_sak_id: str) -> GrunnlagValideringsResultat:
    """
    Sjekker om grunnlaget for forsering fortsatt er gyldig.

    Grunnlaget er UGYLDIG hvis:
    1. BH har snudd og godkjent fristforlengelsen (RESPONS_FRIST_OPPDATERT)
    2. TE har trukket fristkravet
    3. Saken er lukket/omforent på annen måte

    Returns:
        GrunnlagValideringsResultat med status og begrunnelse
    """
    forsering_state = self._hent_state(forsering_sak_id)

    for avslatt_sak_id in forsering_state.forsering_data.avslatte_fristkrav:
        koe_state = self._hent_state(avslatt_sak_id)

        # Sjekk om frist-sporet fortsatt er avslått
        if koe_state.frist.bh_resultat != FristBeregningResultat.AVSLATT:
            return GrunnlagValideringsResultat(
                er_gyldig=False,
                grunn="BH har endret standpunkt på fristforlengelse",
                pavirket_sak_id=avslatt_sak_id,
                ny_status=koe_state.frist.bh_resultat
            )

        # Sjekk om det har kommet RESPONS_FRIST_OPPDATERT
        if self._har_bh_snudd(avslatt_sak_id):
            return GrunnlagValideringsResultat(
                er_gyldig=False,
                grunn="BH har oppdatert frist-respons etter forseringsvarslet",
                pavirket_sak_id=avslatt_sak_id
            )

    return GrunnlagValideringsResultat(er_gyldig=True)
```

### 4.5 Konsekvens av ugyldig grunnlag

```
┌─────────────────────────────────────────────────────────────┐
│        NÅR BH SNUR OG GODKJENNER FRISTFORLENGELSE           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   SCENARIO:                                                  │
│   1. TE varsler forsering basert på frist-avslag            │
│   2. TE iverksetter forsering, påløper kostnader            │
│   3. BH "snur" og godkjenner fristforlengelsen              │
│                                                              │
│   KONSEKVENS:                                                │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  • Forsering STOPPES automatisk                      │   │
│   │  • er_stoppet = True                                 │   │
│   │  • dato_stoppet = dato for BHs snuoperasjon         │   │
│   │                                                      │   │
│   │  VEDERLAG:                                           │   │
│   │  • Kun paalopte_kostnader kan kreves                 │   │
│   │  • IKKE estimert_kostnad (arbeidet trenger ikke     │   │
│   │    lenger akselereres)                               │   │
│   │                                                      │   │
│   │  FRIST:                                              │   │
│   │  • TE får fristforlengelsen som opprinnelig krevd   │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Fremtidige sakstyper

### 5.1 Prisforespørsel

**Brukscase**: BH ønsker pris på arbeid før formell EO.

```python
class PrisforespørselData(BaseModel):
    """
    Data for prisforespørsel (BH → TE → BH → EO).

    Livssyklus:
    1. BH oppretter forespørsel med beskrivelse av arbeid
    2. TE sender tilbud (vederlag + evt. frist)
    3. BH aksepterer/avslår/ber om revisjon
    4. Ved aksept: BH utsteder EO basert på tilbudet
    """
    # Forespørselen
    beskrivelse: str
    arbeid_kategori: str  # F.eks. "tilleggsarbeid", "endring"
    frist_for_tilbud: str  # YYYY-MM-DD
    vedlegg_ids: List[str]

    # TEs tilbud
    tilbud: Optional[TilbudData] = None  # Se under

    # BHs respons på tilbud
    tilbud_status: Optional[TilbudStatus] = None  # AKSEPTERT, AVSLATT, REVISJON_ØNSKET
    tilbud_kommentar: Optional[str] = None

    # Resultat
    resulterende_eo_sak_id: Optional[str] = None


class TilbudData(BaseModel):
    """TEs tilbud på prisforespørsel"""
    # Vederlag - gjenbruker VederlagKompensasjon
    vederlag: VederlagKompensasjon

    # Frist (hvis arbeidet påvirker fremdrift)
    frist_dager: Optional[int] = None

    # Gyldighet
    gyldig_til: str  # YYYY-MM-DD

    # Forbehold
    forbehold: Optional[str] = None
```

### 5.2 Opsjon

**Brukscase**: Utløsning av kontraktsfestede tillegg eller fradrag.

```python
class OpsjonType(str, Enum):
    POSITIV = "positiv"    # Tilleggsarbeid (øker kontraktssum)
    NEGATIV = "negativ"    # Fradrag/besparelse (reduserer)


class OpsjonData(BaseModel):
    """
    Data for opsjonsutløsning.

    Opsjoner er forhåndsdefinert i kontrakten med fast pris.
    Utløsning skjer ved at BH (eller i noen tilfeller TE)
    aktiverer opsjonen.
    """
    # Identifikasjon
    opsjon_type: OpsjonType
    opsjon_referanse: str  # Referanse til kontrakt (f.eks. "Opsjon A.3")
    beskrivelse: str

    # Beløp (fra kontrakten)
    kontraktsfestet_belop: float

    # Indeksregulering (hvis aktuelt)
    indeksregulert: bool = False
    indeks_dato: Optional[str] = None
    justert_belop: Optional[float] = None

    # Frist (hvis opsjonen påvirker fremdrift)
    frist_dager: Optional[int] = None

    # Utløsning
    utlost_av_rolle: Literal["BH", "TE"]
    dato_utlost: str

    # For negative opsjoner (fradrag)
    besparelse_begrunnelse: Optional[str] = None  # Hvorfor er det billigere

    # Resultat
    status: OpsjonStatus  # UTLOST, BEKREFTET, BESTRIDT
    resulterende_eo_sak_id: Optional[str] = None


class OpsjonStatus(str, Enum):
    UTLOST = "utlost"          # Part har utløst opsjonen
    BEKREFTET = "bekreftet"    # Motpart har bekreftet
    BESTRIDT = "bestridt"      # Motpart bestrider (f.eks. mener opsjonen ikke gjelder)
```

---

## 6. Vederlagsbærende protokoll

### 6.1 Formål

En felles protokoll for alle sakstyper som innebærer økonomisk oppgjør gjør det mulig å:
- Aggregere totaler på tvers av sakstyper
- Gjenbruke visningskomponenter
- Sikre konsistent rapportering

### 6.2 Utvidet protokoll

```python
from typing import Protocol, Optional, List


class SaerskiltKravProtocol(Protocol):
    """Protokoll for særskilte krav (§34.1.3)"""

    @property
    def rigg_drift_belop(self) -> Optional[float]:
        """Rigg/drift krav (§34.1.3 første ledd)"""
        ...

    @property
    def produktivitet_belop(self) -> Optional[float]:
        """Produktivitetstap krav (§34.1.3 annet ledd)"""
        ...

    @property
    def sum_saerskilte_krav(self) -> float:
        """Sum av alle særskilte krav"""
        ...


class VederlagsbærendeSakProtocol(Protocol):
    """
    Protokoll for saker med økonomisk konsekvens.

    Implementeres av:
    - VederlagTilstand (standard KOE)
    - ForseringData
    - EndringsordreData
    - TilbudData (prisforespørsel)
    - OpsjonData
    """

    # ===== HOVEDBELØP =====

    @property
    def metode(self) -> Optional[str]:
        """Vederlagsmetode (ENHETSPRISER, REGNINGSARBEID, FASTPRIS_TILBUD)"""
        ...

    @property
    def krevd_belop(self) -> Optional[float]:
        """Totalt krevd beløp (hovedkrav)"""
        ...

    @property
    def godkjent_belop(self) -> Optional[float]:
        """Totalt godkjent beløp av BH"""
        ...

    # ===== FRADRAG =====

    @property
    def fradrag_belop(self) -> Optional[float]:
        """Fradragsbeløp (§34.4)"""
        ...

    @property
    def netto_belop(self) -> float:
        """Netto beløp (krevd - fradrag)"""
        ...

    # ===== SÆRSKILTE KRAV =====

    @property
    def har_saerskilte_krav(self) -> bool:
        """Om saken har særskilte krav (rigg/drift, produktivitet)"""
        ...

    @property
    def saerskilte_krav(self) -> Optional[SaerskiltKravProtocol]:
        """Detaljer for særskilte krav"""
        ...

    # ===== TOTALER =====

    @property
    def total_krevd(self) -> float:
        """Total krevd (hovedkrav + særskilte)"""
        ...

    @property
    def total_godkjent(self) -> float:
        """Total godkjent (hovedkrav + særskilte)"""
        ...

    @property
    def differanse(self) -> float:
        """Differanse mellom krevd og godkjent"""
        ...

    # ===== METADATA =====

    @property
    def er_estimat(self) -> bool:
        """Om beløpet er et estimat (endelig oppgjør senere)"""
        ...

    @property
    def status(self) -> str:
        """Status for vederlagskravet"""
        ...
```

### 6.3 Implementasjon per sakstype

| Sakstype | Hovedkrav | Særskilte krav | Fradrag | Merknader |
|----------|-----------|----------------|---------|-----------|
| Standard KOE | `belop_direkte` / `kostnads_overslag` | rigg_drift, produktivitet | Ja | Full VederlagTilstand |
| Forsering | `estimert_kostnad` | Kan ha rigg/produktivitet | Nei | Begrenset av 30%-regel |
| Endringsordre | `kompensasjon_belop` | Arves fra underliggende KOE | Ja | Aggregert fra KOE-er |
| Prisforespørsel | `tilbud.vederlag` | Hvis tilbudet inkluderer | Mulig | TEs tilbud |
| Opsjon | `kontraktsfestet_belop` | Nei (fast pris) | Kun negativ opsjon | Indeksregulering mulig |

---

## 7. Anbefalinger

### 7.1 Kortsiktige forbedringer

1. **Utvid ForseringData med vederlagsstruktur**
   - Legg til `metode` felt (typisk REGNINGSARBEID)
   - Legg til støtte for særskilte krav ved forsering
   - Implementer `VederlagsbærendeSakProtocol`

2. **Implementer grunnlagsvalidering for forsering**
   - Sjekk at avslåtte fristkrav fortsatt er avslått
   - Detekter `RESPONS_FRIST_OPPDATERT` events
   - Automatisk stopp av forsering hvis BH snur

3. **Legg til computed field på SakState**
   ```python
   @computed_field
   @property
   def forsering_grunnlag_gyldig(self) -> Optional[bool]:
       """Sjekker om forseringsgrunnlaget fortsatt er gyldig"""
       if self.sakstype != SaksType.FORSERING:
           return None
       # Valideringslogikk
   ```

### 7.2 Mellomlange forbedringer

1. **Refaktorer til generisk type_data**
   ```python
   class SakState(BaseModel):
       sakstype: SaksType
       type_data: Union[
           StandardSakData,
           ForseringData,
           EndringsordreData,
           PrisforespørselData,
           OpsjonData,
       ] = Field(discriminator='sakstype')
   ```

2. **Implementer prisforespørsel-støtte**
   - Ny sakstype og events
   - Kobling til EO ved aksept

3. **Implementer opsjon-støtte**
   - Positive og negative opsjoner
   - Indeksregulering

### 7.3 Langsiktige forbedringer

1. **Abstrakt vederlagsaggregering**
   - Prosjektrapporter som summerer på tvers av sakstyper
   - Dashboard med totaler

2. **Regelmotor for validering**
   - Konfigurerbare forretningsregler per sakstype
   - Preklusjonsfrister, varselkrav, etc.

---

## Appendiks A: Filreferanser

| Komponent | Fil | Linjer |
|-----------|-----|--------|
| SaksType enum | `backend/models/sak_state.py` | 26-39 |
| SakState | `backend/models/sak_state.py` | 695-1129 |
| ForseringData | `backend/models/sak_state.py` | 301-390 |
| EndringsordreData | `backend/models/sak_state.py` | 443-572 |
| VederlagTilstand | `backend/models/sak_state.py` | 120-271 |
| VederlagKompensasjon | `backend/models/events.py` | 101-169 |
| ForseringEvents | `backend/models/events.py` | 1165-1370 |
| EndringsordreEvents | `backend/models/events.py` | 1389-1668 |
| BaseSakService | `backend/services/base_sak_service.py` | 1-220 |
| ForseringService | `backend/services/forsering_service.py` | - |
| EndringsordreService | `backend/services/endringsordre_service.py` | - |

---

## Appendiks B: Event-typer per sakstype

### Standard KOE
- `GRUNNLAG_OPPRETTET`, `GRUNNLAG_OPPDATERT`, `GRUNNLAG_TRUKKET`
- `VEDERLAG_KRAV_SENDT`, `VEDERLAG_KRAV_OPPDATERT`, `VEDERLAG_KRAV_TRUKKET`
- `FRIST_KRAV_SENDT`, `FRIST_KRAV_OPPDATERT`, `FRIST_KRAV_TRUKKET`
- `RESPONS_GRUNNLAG`, `RESPONS_VEDERLAG`, `RESPONS_FRIST` (+ `_OPPDATERT`)

### Forsering
- `FORSERING_VARSEL`
- `FORSERING_RESPONS`
- `FORSERING_STOPPET`
- `FORSERING_KOSTNADER_OPPDATERT`

### Endringsordre
- `EO_OPPRETTET`
- `EO_KOE_LAGT_TIL`, `EO_KOE_FJERNET`
- `EO_UTSTEDT`
- `EO_AKSEPTERT`, `EO_BESTRIDT`
- `EO_REVIDERT`

### Prisforespørsel (foreslått)
- `PF_OPPRETTET`
- `PF_TILBUD_SENDT`
- `PF_TILBUD_AKSEPTERT`, `PF_TILBUD_AVSLATT`, `PF_REVISJON_ØNSKET`

### Opsjon (foreslått)
- `OPSJON_UTLOST`
- `OPSJON_BEKREFTET`, `OPSJON_BESTRIDT`
