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

### Normal-modus

```
Row 0: ← Tilbake til saksoversikt                          (breadcrumb, ikke tile)

Row 1: CaseIdentityTile                                    (col-12)
       KOE-2024-042
       Grunnforhold avviker fra beskrivelse
       ● Pågår   │   Veidekke (TE) → Oslobygg (BH)   │   Endring
       Krevd: 1 200 000 kr · 45 dager     Godkjent: 800 000 kr · 30 dager

Row 2: CaseActivityStripTile                                (col-12)
       ⚡ Grunnlag godkjent · 2t    Vederlag sendt · 3d    Frist · vent

Row 3: TrackTile(grunnlag)  TrackTile(vederlag)  TrackTile(frist)   (3 × col-4)
       Hver med: stepper, status, sammendrag, [▾ Historikk], [Handling]
```

### Utvidet-modus (skjema åpent)

```
Row 3: TrackTile i skjema-modus                             (col-12)
       Fullt skjema rendret inline
                                        [Avbryt] [Send →]

Row 4: TrackTile(nabo1)         TrackTile(nabo2)            (col-6 + col-6)
       Uendret innhold
```

### Mobil (< md)

- Alle tiles stacker `col-span-12`
- ActivityStrip: horisontal scroll
- Utvidet: skjemakort øverst, de to andre under

### Forsering/EO-bannere

Beholdes som tynne varsler over CaseIdentityTile ved behov (uendret).

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
| `CaseActivityStripTile` | Siste hendelse per spor med relativ tid |
| `TrackTile` | Generisk sporkort (stepper, status, sammendrag, historikk, handlinger) |
| `TrackFormView` | Wrapper som rendrer skjema inne i utvidet kort |

### Gjenbruk

| Eksisterende | Gjenbruk |
|-------------|----------|
| `BentoCard` | Wrapper for alle tiles (uendret) |
| `BentoDashboardCard` | Basis for TrackTile (rolle, dim, subsidiary) |
| `TrackStepper`, `TrackNextStep`, `DependencyIndicator` | Fra V2, brukes i TrackTile |
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
