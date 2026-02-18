# TE Frist Card-Anchored Submission — Design

**Dato:** 2026-02-18
**Status:** Godkjent
**Kontekst:** Card-anchored inline editing for TE frist-innsending, etter ADR-003-mønsteret

---

## Sammendrag

Totalentreprenørens (TE) innsending av fristkrav flyttes fra fullskjerm modal (SendFristForm)
til card-anchored inline editing i FristCard. Mønsteret følger BH-responsens arkitektur
(ADR-003): kontroller i kortet, begrunnelse i formpanelet, bridge-hook som eier all state.

## Scenarioer

Tre scenarioer dekkes av samme editState-mekanisme:

| Scenario | Trigger | Segmented control | Event |
|----------|---------|-------------------|-------|
| **Førstegangs-innsending** | TE klikker "Send krav" (tomt kort) | `Varsel` · `Krav` | `frist_krav_sendt` |
| **Spesifisering** | TE oppfølger nøytralt varsel med dager | Skjult (låst til Krav) | `frist_krav_spesifisert` |
| **Svar på forespørsel** | BH sendte §33.6.2-forespørsel | `Krav` · `Utsatt beregning` | `frist_krav_spesifisert` |
| **Redigering** | TE oppdaterer tidligere sendt krav | Skjult (låst til opprinnelig type) | `frist_krav_oppdatert` |

## UX — Segmented Control med progressiv avdekking

### Kravtype-valg

Kompakt segmented control (pill-tabs) for valg av kravtype. Synlighet og valg avhenger av scenario:

| Scenario | Segmenter | Default |
|----------|-----------|---------|
| Førstegangs | `Varsel` · `Krav` | Ingen (må velge) |
| Spesifisering fra varsel | Ingen (låst til Krav) | `Krav` |
| Svar på forespørsel | `Krav` · `Utsatt beregning` | Ingen (må velge) |
| Redigering | Ingen (låst til opprinnelig type) | Opprinnelig type |

### Kort-layout per kravtype

**Varsel (§33.4) — Minimal:**

```
┌─────────────────────────────────────┐
│  Fristforlengelse §33           [✕] │
│                                     │
│  ┌───────────┬─────────────────┐    │
│  │▓▓Varsel▓▓▓│    Krav         │    │
│  └───────────┴─────────────────┘    │
│                                     │
│  ┌─ Varsel om fristforlengelse ℹ️ ┐ │
│  │ Tidligere varslet?              │ │
│  │ [Ja] [Nei]                      │ │
│  │                                 │ │
│  │ Dato: [__________] 📅           │ │
│  └─────────────────────────────────┘ │
│                                     │
│  ─────────────────────────────────  │
│  [Lagre utkast]  [Send varsel]     │
└─────────────────────────────────────┘
```

- "Tidligere varslet?" → InlineYesNo
  - Ja: Viser InlineDatePicker for dato varselet ble sendt
  - Nei: Auto-settes til i dag + `digital_oversendelse`
- Formpanel: Valgfri begrunnelse (kort tekst)
- Tooltip på §33.4: "Oppstår forhold som gir rett til fristforlengelse..."

**Krav (§33.6.1) — Full:**

```
┌─────────────────────────────────────┐
│  Fristforlengelse §33           [✕] │
│                                     │
│  ┌───────────┬─────────────────┐    │
│  │  Varsel   │▓▓▓▓Krav▓▓▓▓▓▓▓▓│    │
│  └───────────┴─────────────────┘    │
│                                     │
│  ┌─ §33.4 Varsel ℹ️ ─────────────┐  │
│  │ Tidligere varslet?              │ │
│  │ [Ja] [Nei]                      │ │
│  │ Dato: [__14.feb__] 📅           │ │
│  └─────────────────────────────────┘ │
│                                     │
│  ┌─ §33.6.1 Krav ℹ️ ─────────────┐  │
│  │ Kalenderdager: [____10] d       │ │
│  │ Ny sluttdato:  [________] 📅   │ │
│  └─────────────────────────────────┘ │
│                                     │
│  ⚠️ 12 dager siden oppdaget         │
│                                     │
│  ─────────────────────────────────  │
│  [Lagre utkast]  [Send krav]       │
└─────────────────────────────────────┘
```

- §33.4-seksjon: Samme som varsel-modus (InlineYesNo + InlineDatePicker)
- §33.6.1-seksjon: InlineNumberInput (dager) + InlineDatePicker (sluttdato, valgfri)
- Preklusjonsvarsel: Beregnes fra `grunnlag.dato_oppdaget`, vises som inline alert
- Formpanel: Påkrevd begrunnelse (Textarea, min 10 tegn)

**Utsatt beregning (§33.6.2 b) — Ved forespørsel:**

```
┌─────────────────────────────────────┐
│  Fristforlengelse §33           [✕] │
│                                     │
│  ⚠️ Svar på forespørsel (§33.6.2)  │
│                                     │
│  ┌───────────┬─────────────────┐    │
│  │   Krav    │▓▓▓Utsatt▓▓▓▓▓▓▓│    │
│  └───────────┴─────────────────┘    │
│                                     │
│  (Ingen ekstra kontroller i kort)   │
│                                     │
│  ─────────────────────────────────  │
│  [Send svar]                        │
└─────────────────────────────────────┘
```

- Formpanel: Påkrevd begrunnelse for hvorfor beregningsgrunnlag mangler

**Redigering — Oppdatering av eksisterende krav:**

Samme layout som opprinnelig type, men pre-utfylt med eksisterende data.
Segmented control skjult (type låst). Eksisterende read-only kontekst øverst.

### Formpanel (venstre kolonne)

| Kravtype | Formpanel-innhold | Påkrevd |
|----------|-------------------|---------|
| Varsel | Textarea — kort begrunnelse | Nei |
| Krav | Textarea — begrunnelse for antall dager | Ja (min 10 tegn) |
| Utsatt | Textarea — hvorfor kan ikke omfanget beregnes | Ja (min 10 tegn) |

Layout: `col-7` (formpanel venstre) + `col-5` (kort høyre), med `md:order-1/2` (L8).

## Arkitektur — Domene → Bridge → Komponent

Følger ADR-003 tre-lags-modell (L14):

```
┌──────────────────────────────────────────────────────────┐
│  src/domain/fristSubmissionDomain.ts                     │
│  Ren TypeScript — ingen React-avhengigheter              │
│                                                          │
│  ├── getDefaults(config)         // Initiell state       │
│  ├── beregnVisibility(state, config)  // Hva vises       │
│  ├── beregnPreklusjonsvarsel(config)  // §33.4 timing    │
│  ├── beregnCanSubmit(state, config)   // Validering      │
│  ├── buildEventData(state, config)    // Event payload   │
│  └── getEventType(config)             // Riktig event    │
│                                                          │
│  Testbar med vanlige unit-tester — ingen wrappers.       │
└────────────────────┬─────────────────────────────────────┘
                     │ importeres av
┌────────────────────▼─────────────────────────────────────┐
│  src/hooks/useFristSubmissionBridge.ts                    │
│  Tynn React-adapter                                      │
│                                                          │
│  ├── useState(FormState)          // UI-state            │
│  ├── domain.beregnVisibility()    // Kaller domene       │
│  ├── domain.beregnCanSubmit()     // Kaller domene       │
│  ├── useSubmitEvent()             // React Query mutation │
│  ├── useFormBackup()              // localStorage        │
│  ├── useToast()                   // Feedback            │
│  └── returns { cardProps, editorProps }                   │
└────────────────────┬─────────────────────────────────────┘
                     │ props
┌────────────────────▼─────────────────────────────────────┐
│  Komponenter (rene renderere)                            │
│                                                          │
│  FristCard(teEditState)            BentoSubmitFrist      │
│  ├── [✕] Lukk (øverst)            (editorProps)          │
│  ├── Segmented control             ├── Textarea           │
│  ├── §-seksjoner med kontroller    └── Placeholder        │
│  ├── Preklusjons-alert                                   │
│  └── [Send] (nederst)                                    │
└──────────────────────────────────────────────────────────┘
```

### Bridge-kontrakt

```typescript
interface FristTeEditState {
  // Kravtype
  varselType: FristVarselType | undefined;
  onVarselTypeChange: (v: FristVarselType) => void;
  showSegmentedControl: boolean;
  segmentOptions: { value: string; label: string }[];

  // §33.4 Varsel
  tidligereVarslet: boolean;
  onTidligereVarsletChange: (v: boolean) => void;
  varselDato: string | undefined;
  onVarselDatoChange: (v: string) => void;
  showVarselSection: boolean;

  // §33.6.1 Krav
  antallDager: number;
  onAntallDagerChange: (v: number) => void;
  nySluttdato: string | undefined;
  onNySluttdatoChange: (v: string | undefined) => void;
  showKravSection: boolean;

  // Computed
  preklusjonsvarsel: { variant: 'warning' | 'danger'; dager: number } | null;
  showForesporselAlert: boolean;

  // Actions (L12)
  onClose: () => void;
  onSubmit: () => void;
  onSaveDraft?: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  submitError: string | null;
  submitLabel: string;
  showTokenExpired: boolean;
  onTokenExpiredClose: () => void;
}

interface FristTeEditorProps {
  begrunnelse: string;
  onBegrunnelseChange: (v: string) => void;
  begrunnelseError: string | undefined;
  placeholder: string;
  required: boolean;
}
```

## Nye bento-primitiver

### InlineDatePicker

Kompakt datopicker i bento-stil. Følger samme visuell stil som InlineNumberInput.

```
┌─────────────────────────────────────────┐
│  Varseldato             [__14.feb__] 📅 │
└─────────────────────────────────────────┘
```

- Bruker eksisterende DatePicker-komponent internt, men med bento-sizing
- Props: `label`, `value`, `onChange`, `error?`, `disabled?`

### InlineSegmentedControl

Pill-tabs for 2-3 valg. Visuelt kompakt, én linje.

```
┌──────────┬─────────────────┐
│▓▓Varsel▓▓│     Krav        │
└──────────┴─────────────────┘
```

- Props: `options: { value: string; label: string }[]`, `value`, `onChange`
- Aktiv: solid bakgrunn. Inaktiv: ghost.

## Integrasjon i CasePageBento

### Nye action-ruter

| Action | Komponent | Bridge |
|--------|-----------|--------|
| `frist:send` | BentoSubmitFrist + FristCard(teEditState) | useFristSubmissionBridge |
| `frist:update` | BentoSubmitFrist + FristCard(teEditState) | useFristSubmissionBridge (update-modus) |
| `frist:foresporselSvar` | BentoSubmitFrist + FristCard(teEditState) | useFristSubmissionBridge (forespørsel-modus) |

Erstatter dagens `SendFristForm` i `renderExpandedForm()` for bento-kontekst.

### Layout

Samme som BH-respons (L8, L15):
- Desktop: Formpanel venstre (col-7, order-1), Kort høyre (col-5, order-2, self-start)
- Mobil: Kort øverst (col-12), Formpanel under (col-12)
- Auto-scroll til kort ved åpning (L15)

## Lærdommer fra ADR-003 som gjelder

| # | Lærdom | Anvendelse |
|---|--------|------------|
| L1 | Konsolidert FormState | Én `FristSubmissionFormState` med alle felter |
| L2 | State-during-render for reset | Reset ved isOpen-endring |
| L5 | Auto-begrunnelse | Ikke relevant for TE (TE skriver selv) |
| L6 | editState-bag | `teEditState?: FristTeEditState \| null` på FristCard |
| L7 | §-overskrifter med tooltips | §33.4 og §33.6.1 som seksjonstitler med ℹ️ |
| L8 | CSS grid order | Desktop: kort høyre, form venstre |
| L11 | cardProps vs editorProps | Bridge returnerer to kontrakter |
| L12 | Bridge eier submit | useSubmitEvent, useFormBackup, useToast i bridge |
| L14 | Domenelag | fristSubmissionDomain.ts — ren TS |
| L15 | Mobil-layout | Kort først i DOM, auto-scroll |
| L16 | Knapper | `variant="primary"/"secondary" size="xs"` |
| L17 | Domene-tester først | fristSubmissionDomain.test.ts før bridge-tester |

## Tooltip-tekster (fra eksisterende FristCard BH-modus)

| Seksjon | Tooltip |
|---------|---------|
| §33.4 Varsel | "Oppstår forhold som gir rett til fristforlengelse, må parten varsle uten ugrunnet opphold (§33.4). Varsles det ikke i tide, tapes kravet." |
| §33.6.1 Krav | "Når parten har grunnlag for å beregne omfanget, må han angi og begrunne antall dager uten ugrunnet opphold (§33.6.1). Fremsettes ikke kravet i tide, har parten bare krav på slik fristforlengelse som motparten måtte forstå." |

## Avgrensninger

- Vedlegg-opplasting utelates fra card-anchored (kan legges til senere)
- SendFristForm (modal) beholdes som fallback / for kontekster utenfor bento
- Grunnlag og vederlag TE-innsending gjøres som separate oppfølgingsoppgaver
