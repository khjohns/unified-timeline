# Judgment Panel — Redesign av RespondGrunnlagForm

## Problem

Dagens RespondGrunnlagForm har flere UX-svakheter:

- **Tabs fragmenterer** — BH kan ikke se vurdering og begrunnelse samtidig
- **Kontekst forsvinner** — skjemaet tar col-span-12, TE's krav er ikke synlig
- **Alert-fatigue** — 5-6 juridiske infobokser konkurrerer om oppmerksomhet
- **Radioknapper** — føles byråkratisk for en viktig juridisk avgjørelse
- **Ingen flyt** — hopper mellom fane 1 og fane 2

## Løsning: Split-panel med progressiv avsløring

En to-kolonners layout der TE's krav alltid er synlig (venstre) mens BH svarer (høyre). Radioknapper erstattes med store, fargekodede verdict cards. Juridisk info flyttes fra alerts til inline ⓘ-popovers med én dynamisk konsekvens-callout.

## Layout

### Desktop (≥ md)

```
┌─ ClaimContextPanel (col-5) ─┬─ Response panel (col-7) ─────────────┐
│                              │                                       │
│  ENDRING · §32.1             │  §32.2 Varslet i tide?  ⓘ           │
│  Irregulær endring —         │  ○ Ja    ● Nei                       │
│  Bæring, fundamentering     │                                       │
│                              │  ┌──────┐  ┌──────┐  ┌──────┐       │
│  Oppdaget   12.01.2024      │  │  ✓   │  │  ✗   │  │  ↩   │       │
│  Varslet    15.01.2024      │  │Godkj.│  │Avsl. │  │Fraf. │       │
│                              │  └──────┘  └──────┘  └──────┘       │
│  «Fundamenteringen ble      │                                       │
│   endret fra peler til      │  → Konsekvens-callout                 │
│   plate grunnet uventede    │                                       │
│   grunnforhold.»            │  Begrunnelse                          │
│                              │  ┌───────────────────────────────┐   │
│  ─── Historikk ───          │  │ Rik tekst-editor              │   │
│  15.01  TE varslet          │  │ (dynamisk placeholder)         │   │
│  12.01  TE oppdaget         │  └───────────────────────────────┘   │
│                              │                                       │
│                              │  ──────────────────────────────────   │
│                              │           [Avbryt]  [Send svar →]    │
└──────────────────────────────┴───────────────────────────────────────┘
```

### Mobil (< md)

- Grid endres til `grid-cols-1`
- ClaimContextPanel kollapser til kompakt sticky header: kategori + datoer på én linje, "Se detaljer ▾"-knapp som ekspanderer
- Response panel rendres under

## Nye komponenter

### ClaimContextPanel

**Fil:** `src/components/bento/ClaimContextPanel.tsx`

Viser TE's kravdata i en sticky venstre kolonne. Ingen CTA/actions — ren kontekst.

**Props:**
```typescript
interface ClaimContextPanelProps {
  grunnlagEvent: {
    hovedkategori?: string;
    underkategori?: string | string[];
    beskrivelse?: string;
    dato_oppdaget?: string;
    dato_varslet?: string;
  };
  entries: SporHistoryEntry[];  // For kompakt historikk
}
```

**Innhold (top-down):**

1. **Kategori-header** — Hovedkategori + hjemmel (f.eks. "ENDRING · §32.1")
2. **Underkategori** — Label med hjemmel (f.eks. "Irregulær endring — §32.1")
3. **Beskrivelse** — TE's tekst, italic, line-clamp-6
4. **Hva kategorien gir grunnlag for** — "Gir grunnlag for krav om: Vederlag (§34.x) + Frist (§33.x)" eller "Gir grunnlag for krav om: Kun frist (§33.3)" for FM
5. **Datoer** — Oppdaget / Varslet som key-value par
6. **Historikk** — Kompakt liste (gjenbruk TrackHistory)

**Desktop:** `position: sticky; top: 1rem` slik at panelet følger med ved scroll.

### VerdictCards

**Fil:** `src/components/bento/VerdictCards.tsx`

Tre klikkbare kort som erstatter RadioGroup for resultat-valget.

**Props:**
```typescript
interface VerdictCardsProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: VerdictOption[];
  error?: boolean;
}

interface VerdictOption {
  value: string;           // 'godkjent' | 'avslatt' | 'frafalt'
  label: string;           // 'Godkjent' | 'Avslått' | 'Frafalt'
  description: string;     // Kort konsekvens (3-5 ord)
  icon: 'check' | 'cross' | 'undo';
  colorScheme: 'green' | 'red' | 'gray';
}
```

**Visuell oppførsel:**

| Tilstand | Styling |
|----------|---------|
| Uvalgt (ingen valgt) | Alle kort: `bg-pkt-bg-subtle`, `border-pkt-border-default`, full opacity |
| Valgt | Valgt kort: farget border + svak bakgrunn. Andre kort: `opacity-50`, grå |
| Hover | `scale(1.01)`, skygge-økning |
| Error | Rød border rundt hele gruppen |

**Kort-innhold:**

```
┌─────────────────┐
│  ✓              │  ← Ikon (CheckIcon/Cross2Icon/ResetIcon)
│  Godkjent       │  ← Label
│                 │
│  Grunnlag for   │  ← Description (3-5 ord)
│  krav anerkjent │
└─────────────────┘
```

**Frafalt** filtreres bort av RespondGrunnlagForm (som i dag) dersom saken ikke er palegg.

## VerdictCards — beskrivelser per alternativ

| Resultat | Description i kortet |
|----------|---------------------|
| godkjent | "Grunnlag for krav anerkjent" |
| avslatt | "Grunnlag for krav avvist" |
| frafalt | "Pålegget frafalles" |

## ConsequenceCallout — logikk

Vises kun etter resultat er valgt. Maks 2-3 setninger. Én callout, dynamisk innhold.

### Matrise

| Resultat | erEndring (ikke EO) | Preklusjon | Variant | Innhold |
|----------|---------------------|------------|---------|---------|
| godkjent | nei | — | `success` | "Byggherren anerkjenner at TE kan ha grunnlag for krav. Vederlag og frist behandles separat." |
| godkjent | ja, varslet i tide | — | `success` | "Byggherren godtar at varselet ble sendt i tide, og anerkjenner grunnlag for krav. Vederlag og frist behandles separat." |
| godkjent | ja, varslet for sent | — | `success` | "Byggherren mener varselet ble sendt for sent (§32.2), men anerkjenner subsidiært grunnlag for krav. Preklusjonsstandpunktet gjelder prinsipalt." |
| godkjent + FM | — | — | `success` | "Byggherren anerkjenner force majeure. TE kan ha grunnlag for krav om fristforlengelse — ikke vederlag (§33.3)." |
| avslatt | nei | — | `warning` | "Saken markeres som omtvistet. TE kan fortsatt sende krav om vederlag og frist, som BH behandler subsidiært." |
| avslatt | ja, varslet i tide | — | `warning` | "Byggherren godtar at varselet ble sendt i tide, men avslår grunnlaget. Vederlag og frist behandles subsidiært." |
| avslatt | ja, varslet for sent | ja | `danger` | "Byggherren påberoper §32.2-preklusjon (varslet for sent) og avslår subsidiært grunnlaget. Vederlag og frist behandles dobbelt-subsidiært." |
| avslatt + FM | — | — | `warning` | "Byggherren mener forholdet ikke kvalifiserer som force majeure. TE kan likevel sende krav om fristforlengelse." |
| frafalt | — | — | `info` | "Pålegget frafalles (§32.3 c). Arbeidet trenger ikke utføres." |

### Snuoperasjon (update mode, avslått → godkjent)

Ekstra tekst legges til under hoved-callout:

> "Subsidiaere svar på vederlag og frist konverteres til prinsipale svar."

## §32.2 Varselvurdering — ny layout

I dag er dette en stor SectionContainer med ExpandableText, radioknapper og en alert.

**Nytt:** Kompakt inline seksjon med popover.

```
┌─────────────────────────────────────────────────────┐
│  Varslet i tide? (§32.2)  ⓘ                        │
│                                                      │
│  ○ Ja — varslet uten ugrunnet opphold               │
│  ● Nei — varslet for sent (preklusjon)              │
└─────────────────────────────────────────────────────┘
```

- **ⓘ-ikon** åpner en Popover med §32.2/§32.3 lovtekst (samme tekst som dagens ExpandableText)
- Ingen SectionContainer-wrapper, ingen Alert for "varslet i tide" — dette dekkes av ConsequenceCallout
- Passivitetsvarsel (>10 dager) beholdes som en liten Alert over verdict-cards (dette er et viktig varsel BH trenger å se)

## Begrunnelse-felt — dynamisk oppførsel

| Valgt resultat | Placeholder |
|----------------|-------------|
| (inget valgt) | "Velg resultat over for å skrive begrunnelse..." |
| godkjent | "Begrunn din vurdering av ansvarsgrunnlaget..." |
| godkjent + preklusjon | "Begrunn din preklusjonsinnsigelse og din subsidiære godkjenning..." |
| avslatt | "Forklar hvorfor forholdet ikke gir grunnlag for krav..." |
| avslatt + preklusjon | "Begrunn din preklusjonsinnsigelse og ditt subsidiære avslag..." |
| frafalt | "Begrunn hvorfor pålegget frafalles..." |

Editor starter med `minHeight={280}` (ned fra 400) siden alt er synlig uten tabs.

## Uendret fra dagens implementasjon

- **Zod-schema** — samme felter: `grunnlag_varslet_i_tide`, `resultat`, `begrunnelse`
- **Form backup** — useFormBackup med samme keys
- **Submit-logikk** — useSubmitEvent, same event types
- **Approval workflow** — onSaveDraft, approvalEnabled
- **Update mode** — lastResponseEvent, snuoperasjon-deteksjon
- **TokenExpiredAlert**
- **CasePageBento** — kaller RespondGrunnlagForm med samme props
- **TrackFormView** — wrapper forblir uendret

## Komponentarkitektur-oppsummering

```
TrackFormView (uendret wrapper)
└── RespondGrunnlagForm (refaktorert layout)
    ├── grid grid-cols-12 gap-6
    │   ├── ClaimContextPanel (col-span-5, sticky)   ← NY
    │   └── div (col-span-7)                          ← Response panel
    │       ├── §32.2 inline + popover               ← Forenklet
    │       ├── VerdictCards                           ← NY
    │       ├── ConsequenceCallout                     ← Erstatter 5-6 alerts
    │       ├── RichTextEditor                         ← Beholdt
    │       └── Footer (Avbryt + Send)                 ← Beholdt
    └── (mobil: grid-cols-1, context som sticky header)
```
