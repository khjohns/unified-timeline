# Bento CasePage Redesign

## Problem

CasePageBento har flere UX-problemer:
- Header-området mangler hierarki (breadcrumb, ansvarsgrunnlag, status, beløp flyter)
- Tre sporkort med ulik høyde og dårlig visuell harmoni
- Bunn-seksjonen (Navigasjon + Detaljer) tar plass uten å gi verdi
- 25+ modaler for alle handlinger bryter flyten
- Siden føles ikke som bento - mangler tile-komposisjonen fra SaksoversiktPage

## Løsning

Samme komposisjonsmodell som SaksoversiktPage: alt er tiles i et flat 12-kolonne grid. Handlinger (send krav, responder, revider) rendres inline i utvidet kort i stedet for modaler.

## Sidelayout

### Designprinsipp: Semantisk hierarki

Grunnlag er ikke et "spor" på linje med Vederlag og Frist. Grunnlag er *hjemmelen* —
den juridiske begrunnelsen (§25.2) som Vederlag og Frist henger på. Layouten
reflekterer dette ved å løfte Grunnlag opp til kontekst-nivå.

### Normal-modus (v2 — hierarkisk layout)

```
Row 0: ← Tilbake til saksoversikt                          (breadcrumb, ikke tile)

Row 1: CaseIdentityTile(5)  GrunnlagTile(4)  ActivityCard(3)
       KOE-2024-042          §25.2 Endring     ⚡ Siste
       Grunnforhold...        ● Godkjent        · Grunnlag 2t
       Veidekke → Oslo        Stepper           · Vederlag 3d
       Krevd/Godkjent         [Handling]        · Frist venter

Row 2: VederlagTile(6)                    FristTile(6)
       §34 · Krav sendt                    §33 · Venter
       Stepper                             Stepper
       1 200 000 kr                        45 dager
       [Send krav]                         [Send krav]
```

Grunnlag + Identity + Aktivitet danner en "kontekst-rad" — alt du trenger for å forstå saken.
Vederlag + Frist er "krav-raden" — de to tingene som kreves.
Ingen dependency-piler nødvendig — hierarkiet er visuelt tydelig.

### Utvidet-modus (skjema åpent, f.eks. Vederlag)

```
Row 1: CaseIdentityTile(5)  GrunnlagTile(4)  ActivityCard(3)     (uendret)

Row 2: VederlagTile i skjema-modus                                (col-12)
       Fullt skjema rendret inline
                                              [Avbryt] [Send →]

Row 3: FristTile                                                  (col-12)
```

Ved Grunnlag expand:
```
Row 1: CaseIdentityTile(5)  GrunnlagTile i skjema-modus(7)       (identity + utvidet)

Row 1b: ActivityCard(12) -- eller skjules midlertidig

Row 2: VederlagTile(6)                    FristTile(6)            (uendret)
```

### Mobil (< md)

- Alle tiles stacker `col-span-12`
- Rekkefølge: Identity → Grunnlag → Aktivitet → Vederlag → Frist
- Utvidet: skjemakort der det er, resten under

### Forsering/EO-bannere

Beholdes som tynne varsler over CaseIdentityTile ved behov (uendret).

### Kortstil — "bento-stil"

Sporkortene skal ha visuell stil som matcher saksoversikt-tiles:
- Store tall (beløp, dager) prominent med mono font
- Status-badge visuelt fremtredende
- Stepper som visuelt element
- Mindre tekst, mer visuelt hierarki
- Ikke InlineDataList-skjema-stil

## Utvid-i-kort-mønsteret

### Mekanikk

- Kun ett kort kan være utvidet om gangen
- Utvidet kort: `col-span-12`, rendrer skjema direkte
- Nabokort: skyves ned til ny rad, `col-span-6` + `col-span-6`
- "Avbryt": kollapser tilbake til 3×4-layout med dirty-check

### Handling → mønster

| Handling | Mønster | Spor |
|----------|---------|------|
| SendGrunnlag | Utvid i kort | Grunnlag |
| SendVederlag | Utvid i kort | Vederlag |
| SendFrist | Utvid i kort | Frist |
| RespondGrunnlag | Utvid i kort | Grunnlag |
| RespondVederlag | **Modal** (utsatt) | – |
| RespondFrist | **Modal** (utsatt) | – |
| RevideVederlag | Utvid i kort | Vederlag |
| RevideFrist | Utvid i kort | Frist |
| UpdateGrunnlag | Utvid i kort | Grunnlag |
| Trekk * | Utvid i kort | Relevant spor |
| Aksepter * | Utvid i kort | Relevant spor |

RespondVederlag og RespondFrist beholder modal fordi de er komplekse (4-port wizard / betinget logikk). Vurderes for utvidelse senere.

## Komponentarkitektur

### Nye komponenter

| Komponent | Ansvar |
|-----------|--------|
| `CaseIdentityTile` | Saks-ID, tittel, status, parter, beløp/frist |
| `CaseActivityCard` | Siste hendelse per spor, kompakt kort (ikke stripe) |
| `TrackTile` | Generisk sporkort (stepper, status, sammendrag, historikk, handlinger) |
| `TrackFormView` | Wrapper som rendrer skjema inne i utvidet kort |

### Gjenbruk

| Eksisterende | Gjenbruk |
|-------------|----------|
| `BentoCard` | Wrapper for alle tiles (uendret) |
| `BentoDashboardCard` | Basis for TrackTile (rolle, dim, subsidiary) |
| `TrackStepper`, `TrackNextStep` | Fra V2, brukes i TrackTile (DependencyIndicator fjernes) |
| Skjemainnhold fra modaler | Extraheres - Modal-wrapper erstattes med TrackFormView |

### Skjema-ekstraksjon

Dagens modaler:
```
Modal → FormProvider → SectionContainer[] → felter → Submit
```

Nytt mønster:
```
TrackFormView → FormProvider → SectionContainer[] → felter → Submit
```

TrackFormView gir:
- Header med spornavn + aksjonsnavn + stepper
- Scrollbar ved behov
- Footer med Avbryt + Submit-knapper
- Dirty-check dialog ved avbryt

### State-management

```typescript
const [expandedTrack, setExpandedTrack] = useState<{
  track: 'grunnlag' | 'vederlag' | 'frist';
  action: string;
} | null>(null);
```

Kun ett kort utvidet om gangen. Styrer grid-layout:
- `null` → 3 × col-4
- Utvidet → aktivt kort col-12, naboer col-6

### TrackTile med historikk

Hvert sporkort har kollapserbar historikk:

```
┌─ Grunnlag (§25.2) ──────────────────┐
│ ● ● ● ○ ○  Stepper                  │
│ Status: Godkjent av BH              │
│ Sammendrag / nøkkelinfo             │
│                                      │
│ [▾ Historikk (4)]     [Send krav]   │
│ ┌─ Utvidet historikk ─────────────┐ │
│ │ 12.02 BH godkjente grunnlag    │ │
│ │ 10.02 TE sendte grunnlag       │ │
│ │ 08.02 TE varslet               │ │
│ └─────────────────────────────────┘ │
└──────────────────────────────────────┘
```

Kollapset som default. Samme mønster som CaseDashboardBentoV2.

## Hva fjernes

- Bunn-seksjonen (Navigasjon + Metadata-tiles) - helt fjernet
- Floating ansvarsgrunnlag-beskrivelse - flyttes inn i GrunnlagTile
- Separate status-badge og beløp - integrert i CaseIdentityTile
- De fleste modaler - erstattes av utvid-i-kort (unntatt RespondVederlag/RespondFrist)

## Hva beholdes

- Forsering/EO-bannere (tynne varsler)
- RespondVederlag-modal (4-port wizard)
- RespondFrist-modal (kompleks betinget logikk)
- Alle skjema-valideringsregler og form-backup
- BentoCard-primitiven med stagger-animasjoner
