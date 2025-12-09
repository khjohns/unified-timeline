# Design: Forseringsvarsel (§33.8)

> **Status**: Godkjent - klar for implementering
> **Dato**: 2025-12-09
> **Kontekst**: Implementering av TE's rett til å varsle om forsering ved avslag på fristkrav

---

## 1. NS 8407 §33.8 - Juridisk grunnlag

### Standardtekst

> **§33.8 Forsering ved uberettiget avslag**
>
> Hvis byggherren helt eller delvis avslår et berettiget krav på fristforlengelse, kan totalentreprenøren velge å anse avslaget som et pålegg om forsering gitt ved endringsordre. Totalentreprenøren har ikke en slik valgrett dersom vederlaget for forseringen må antas å ville overstige den dagmulkten som ville ha påløpt hvis byggherrens avslag var berettiget og forsering ikke ble iverksatt, tillagt 30 %.
>
> Før forsering etter første ledd iverksettes, skal byggherren varsles med angivelse av hva forseringen antas å ville koste.

### Nøkkelpunkter

| Krav | Beskrivelse |
|------|-------------|
| **Trigger** | BH avslår (helt/delvis) fristkrav som TE mener er berettiget |
| **TE's valgrett** | TE kan velge å behandle avslaget som pålegg om forsering |
| **Kostnadsbegrensning** | Forseringskostnad ≤ (dagmulkt + 30%) |
| **Varslingskrav** | TE skal varsle BH før forsering iverksettes |
| **Innhold i varsel** | Angivelse av estimert forseringskostnad |

---

## 2. Eksisterende implementasjon

### Backend (allerede implementert)

```python
# backend/models/events.py

class ForseringVarselData(BaseModel):
    frist_krav_id: str           # Event-ID til fristkravet som ble avslått
    estimert_kostnad: float      # Estimert kostnad for forsering
    begrunnelse: str             # Begrunnelse for forsering
    bekreft_30_prosent: bool     # TE bekrefter at estimert kostnad er innenfor grensen
    dato_iverksettelse: str      # Dato forsering iverksettes

class ForseringVarselEvent(SakEvent):
    event_type: EventType = EventType.FORSERING_VARSEL
    data: ForseringVarselData
```

### Frontend (kun advarsel)

I `RespondFristModal.tsx` vises en advarsel til BH om forsering-risiko, men TE har ingen modal for å sende forseringsvarsel.

---

## 3. Foreslått design

### 3.1 Når skal forseringsmuligheten aktiveres?

Forseringsvarsel skal være tilgjengelig for TE når **ett** av følgende er oppfylt:

| Scenario | Betingelse | Kommentar |
|----------|------------|-----------|
| **A** | BH har avslått fristkravet | `frist.bh_resultat` in `[avslatt_ingen_hindring, avvist_preklusjon]` |
| **B** | BH har delvis godkjent fristkravet | `frist.bh_resultat == delvis_godkjent` AND `godkjent_dager < krevde_dager` |
| **C** | BH har avslått grunnlaget | `grunnlag.bh_resultat` in `[avvist_uenig, avvist_for_sent]` |

**Viktig**: Scenario C medfører implisitt at fristkravet også avslås (fordi grunnlaget er forutsetningen).

**Beregning av avslåtte dager ved scenario C**:
Når grunnlag er avvist, har BH typisk gitt et subsidiært standpunkt på frist. For beregning av 30%-grensen brukes differansen mellom krevde dager og *subsidiært* godkjente dager:

```
Eksempel:
- TE krever 30 dager
- BH: Grunnlag avvist, subsidiært maks 10 dager
- Avslåtte dager for 30%-beregning = 30 - 10 = 20 dager
```

### 3.2 Flytdiagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SAK MED FRISTKRAV                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TE sender:                                                                 │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐                        │
│  │  Grunnlag  │───▶│   Frist    │    │  Vederlag  │                        │
│  └────────────┘    └────────────┘    └────────────┘                        │
│                           │                                                 │
│                           ▼                                                 │
│  BH responderer:                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Grunnlag: [Godkjent | Avvist]                                       │  │
│  │  Frist:    [Godkjent | Delvis | Avslått]                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                           │                                                 │
│                           ▼                                                 │
│         ┌─────────────────┴─────────────────┐                              │
│         │  Er fristkravet (helt/delvis)     │                              │
│         │  avslått ELLER grunnlag avvist?   │                              │
│         └─────────────────┬─────────────────┘                              │
│                 │                   │                                       │
│              [Ja]               [Nei]                                       │
│                 │                   │                                       │
│                 ▼                   ▼                                       │
│  ┌──────────────────────────┐   ┌──────────────────┐                       │
│  │  VIS "Send forserings-   │   │  Ingen forsering │                       │
│  │  varsel"-knapp i UI      │   │  tilgjengelig    │                       │
│  └──────────────────────────┘   └──────────────────┘                       │
│                 │                                                           │
│                 ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                   SendForseringModal (NY)                            │  │
│  │  ────────────────────────────────────────────────────────────────    │  │
│  │                                                                      │  │
│  │  Kontekst:                                                           │  │
│  │  - Avslåtte dager: 16 dager                                          │  │
│  │  - Dagmulktsats: 50.000/dag                                          │  │
│  │  - Maks forseringskostnad: (16 × 50.000) × 1.3 = 1.040.000           │  │
│  │                                                                      │  │
│  │  Estimert forseringskostnad: [____________] NOK                      │  │
│  │                                                                      │  │
│  │  [ ] Jeg bekrefter at estimert kostnad er innenfor dagmulkt + 30%    │  │
│  │                                                                      │  │
│  │  Begrunnelse for forsering:                                          │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │ TE mener at fristkravet er berettiget og velger derfor å       │  │  │
│  │  │ anse BH's avslag som et pålegg om forsering...                 │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                      │  │
│  │  Dato forsering iverksettes: [2025-01-20]                            │  │
│  │                                                                      │  │
│  │                           [Avbryt]  [Send varsel]                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Forseringsvederlag - Eget spor eller del av vederlag?

**Alternativ A: Eget "Forsering"-spor**
- Pros: Tydelig separasjon, egen livssyklus
- Cons: Komplekst, forseringsvederlag er juridisk et vederlagskrav

**Alternativ B: Del av vederlag-sporet (anbefalt)**
- Forseringsvarsel er et *varsel*, ikke et krav
- Etter forsering iverksettes, sender TE vederlagskrav for forseringskostnader
- Vederlagskravet refererer til forseringsvarselet

**Anbefaling**: Alternativ B - Forsering er en *trigger* for et påfølgende vederlagskrav.

```
Flyt:
1. BH avslår fristkrav
2. TE sender ForseringVarselEvent (§33.8-varsel)
3. TE iverksetter forsering
4. TE sender VederlagEvent med:
   - kravtype: "forsering" (ny enum-verdi?)
   - referanse_til_forseringsvarsel: event_id
   - metode: REGNINGSARBEID (eller FASTPRIS)
```

---

## 4. Datamodell-endringer

### 4.1 Ny enum for vederlagskrav-type (valgfritt)

```python
class VederlagKravType(str, Enum):
    """Type vederlagskrav - for å skille mellom ordinære krav og forsering"""
    ORDINAER = "ordinaer"           # Standard vederlagskrav
    FORSERING = "forsering"         # Forseringskrav (§33.8)
```

> **Merk**: Produktivitetstap/plunder og heft er allerede implementert som del av særskilte krav (§34.1.3) i `saerskilt_krav.produktivitet`.

### 4.2 Utvidet VederlagData

```python
class VederlagData(BaseModel):
    # ... eksisterende felt ...

    # Ny: Referanse til forsering (kun for forseringskrav)
    forseringsvarsel_id: Optional[str] = Field(
        default=None,
        description="Event-ID til forseringsvarsel (kun for §33.8-krav)"
    )

    # Ny: Type krav (default: ordinaer)
    kravtype: VederlagKravType = Field(
        default=VederlagKravType.ORDINAER,
        description="Type vederlagskrav"
    )
```

### 4.3 Utvidet ForseringVarselData

```python
class ForseringVarselData(BaseModel):
    # Eksisterende felt...
    frist_krav_id: str
    estimert_kostnad: float
    begrunnelse: str
    bekreft_30_prosent: bool
    dato_iverksettelse: str

    # Nye felt:
    respons_frist_id: str = Field(
        ...,
        description="Event-ID til BH's frist-respons som utløste forseringen"
    )
    avslatte_dager: int = Field(
        ...,
        description="Antall dager som ble avslått av BH"
    )
    dagmulktsats: float = Field(
        ...,
        description="Dagmulktsats (påkrevd for beregning av 30%-grense)"
    )
    grunnlag_avslag_trigger: bool = Field(
        default=False,
        description="True hvis forsering utløses av grunnlagsavslag (ikke direkte fristAvslag)"
    )
```

---

## 5. Frontend-implementasjon

### 5.1 Ny modal: SendForseringModal

**Fil**: `src/components/actions/SendForseringModal.tsx`

```typescript
interface SendForseringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** Fristkravet som ble avslått */
  fristKravId: string;
  /** Fristdata for kontekst */
  fristData: {
    krevde_dager: number;
    godkjent_dager: number;  // 0 hvis helt avslått
    bh_resultat: FristBeregningResultat;
  };
  /** Dagmulktsats - påkrevd for 30%-beregning */
  dagmulktsats: number;
  /** True hvis trigger er grunnlagsavslag */
  grunnlagAvslagTrigger?: boolean;
}
```

### 5.2 Visning av forseringsknapp

**Hvor**: I `SakPanel.tsx` eller `TimelinePanel.tsx` som en action-knapp

**Logikk**:
```typescript
const kanSendeForseringsvarsel = useMemo(() => {
  // Sjekk om det allerede er sendt forseringsvarsel for dette fristkravet
  const harSendtVarsel = events.some(
    e => e.event_type === 'forsering_varsel' &&
         e.data.frist_krav_id === fristKravId
  );
  if (harSendtVarsel) return false;

  // Sjekk om fristkravet er (helt/delvis) avslått
  const fristAvslatt = ['avslatt_ingen_hindring', 'avvist_preklusjon', 'delvis_godkjent']
    .includes(frist.bh_resultat);

  // Sjekk om grunnlaget er avslått (medfører implisitt frist-avslag)
  const grunnlagAvslatt = ['avvist_uenig', 'avvist_for_sent']
    .includes(grunnlag.bh_resultat);

  return fristAvslatt || grunnlagAvslatt;
}, [frist, grunnlag, events, fristKravId]);
```

### 5.3 Beregning av 30%-grense

```typescript
function beregn30ProsentGrense(
  avslatteDager: number,
  dagmulktsats: number
): number {
  const dagmulkt = avslatteDager * dagmulktsats;
  const grense = dagmulkt * 1.3;
  return grense;
}

// Eksempel:
// avslatteDager = 16
// dagmulktsats = 50.000
// grense = 16 * 50.000 * 1.3 = 1.040.000 NOK
```

### 5.4 Timeline-visning av forseringsvarsel

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 20. jan. 2025    👤 Per Hansen    [TE]    [Forsering]       │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Forseringsvarsel (§33.8)                                       │
│                                                                 │
│  Referanse: Fristkrav avslått 15. jan (16 dager)                │
│  Estimert kostnad: 850.000 NOK                                  │
│  Iverksettes: 22. jan. 2025                                     │
│                                                                 │
│  [Ikon: Varseltrekant / Penger-pil]                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Flyt: Komplett forserings-scenario

```
TIDSLINJE:

1.  TE sender grunnlag-varsel
2.  TE sender fristkrav (30 dager)
3.  BH avslår fristkrav: "Ingen hindring" (0 dager godkjent)
    └─> UI viser: "Send forseringsvarsel"-knapp

4.  TE klikker "Send forseringsvarsel"
    └─> Modal åpnes med:
        - Avslåtte dager: 30
        - Dagmulktsats: 50.000
        - Maks kostnad: 1.950.000 (30 × 50.000 × 1.3)

5.  TE fyller ut:
    - Estimert kostnad: 1.200.000
    - Bekrefter 30%-grense
    - Begrunnelse
    - Dato iverksettelse: 2025-02-01

6.  TE sender ForseringVarselEvent
    └─> BH mottar varsel om at TE vil forsere

7.  TE iverksetter forsering (2025-02-01)

8.  TE sender vederlagskrav for forsering:
    - Referanse: ForseringVarselEvent
    - Metode: REGNINGSARBEID
    - Beløp: (løpende fakturering)

9.  BH responderer på vederlagskravet
    └─> Normal vederlagsprosess
```

---

## 7. Spørsmål til avklaring

### 7.1 Dagmulktsats

**Spørsmål**: Hvor hentes dagmulktsats fra?

**Alternativer**:
1. Manuell input i modal (enklest)
2. Kontraktsnivå-konfigurasjon (bedre UX)
3. Prosjektnivå-innstilling

**Anbefaling**: Start med manuell input, legg til kontraktskonfigurasjon senere.

### 7.2 Når kan forsering sendes?

**Spørsmål**: Skal TE kunne sende forseringsvarsel før BH har svart på fristkravet?

**Anbefaling**: Nei - forseringsretten utløses av avslag. Før avslag foreligger, finnes ingen rett.

### 7.3 Flere forseringsvarsler?

**Spørsmål**: Kan TE sende flere forseringsvarsler for samme fristkrav?

**Anbefaling**: Nei - én til én forhold mellom fristkrav og forseringsvarsel.

### 7.4 Tilbaketrekking av forseringsvarsel?

**Spørsmål**: Kan TE trekke tilbake et forseringsvarsel?

**Anbefaling**: Ja - legg til `FORSERING_VARSEL_TRUKKET` event-type. Relevant hvis BH ombestemmer seg og godkjenner fristkravet.

---

## 8. Implementeringsplan

### Fase 1: Grunnleggende flyt

| Oppgave | Prioritet | Beskrivelse |
|---------|-----------|-------------|
| 1.1 | Høy | Opprett `SendForseringModal.tsx` |
| 1.2 | Høy | Legg til "Send forseringsvarsel"-knapp i UI |
| 1.3 | Høy | Implementer visning i Timeline |
| 1.4 | Middels | Legg til i EventDetailModal |

### Fase 2: Forseringsvederlag-kobling

| Oppgave | Prioritet | Beskrivelse |
|---------|-----------|-------------|
| 2.1 | Middels | Legg til `VederlagKravType` enum |
| 2.2 | Middels | Utvid `VederlagData` med forseringsreferanse |
| 2.3 | Lav | Opprett `SendForseringsVederlagModal` (variant av SendVederlagModal) |

### Fase 3: Forbedringer

| Oppgave | Prioritet | Beskrivelse |
|---------|-----------|-------------|
| 3.1 | Lav | Kontraktsnivå dagmulktsats |
| 3.2 | Lav | `FORSERING_VARSEL_TRUKKET` event |
| 3.3 | Lav | PDF-visning av forseringsvarsel |

---

## 9. Konklusjon

**Anbefalt implementering:**

1. **Ny modal**: `SendForseringModal` for TE å sende forseringsvarsel
2. **Automatisk trigger**: Knappen vises når BH avslår frist ELLER grunnlag
3. **Kobling til vederlag**: Forseringsvederlag sendes som vanlig vederlagskrav med referanse til forseringsvarselet
4. **Ingen ny "spor-type"**: Forsering er en event-type, ikke et eget spor

**Backend er allerede forberedt** med `ForseringVarselEvent`. Hovedjobben er frontend-implementasjon.

---

*Dokument opprettet: 2025-12-09*
*Oppdatert: 2025-12-09 - Godkjent med forbedringer*
*Forfatter: Claude (LLM Assistant)*
*Status: Godkjent - klar for implementering*

---

## Endringslogg

| Dato | Endring |
|------|---------|
| 2025-12-09 | Opprettet utkast |
| 2025-12-09 | Godkjent med forbedringer: (1) Presisert beregning av avslåtte dager ved subsidiært standpunkt, (2) Lagt til `respons_frist_id` for sporbarhet, (3) Gjort `dagmulktsats` påkrevd |
