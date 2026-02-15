# Plan: Card-Anchored Vederlag — Fase 2

> Mål: Implementer krav-linje-gruppert BH-svar for vederlag i bento-layout.
> Avhenger av: `vederlagDomain.ts` (ferdig), ADR-003, frist-bridge-mønster.

---

## Designbeslutninger

### D1: Krav-linje-gruppering (ikke wizard-port-gruppering)

Modalen grupperer etter domene-steg: varsling → metode → beløp → oppsummering.
Kortet grupperer **per krav-linje**: hovedkrav, rigg/drift, produktivitet.

Hver krav-linje samler alt BH trenger å vurdere for det kravet:
- Varseldato + "varslet i tide?" (kontekst + beslutning i samme rad)
- Krevd beløp (read-only) + godkjent beløp (input)
- Automatisk avledet vurdering (godkjent/delvis/avslått)

Metode er en global beslutning og vises øverst, utenfor krav-linjene.

### D2: Beløp-input ER vurderingen

Ingen dropdown for `vurdering`. Avledet fra godkjent vs krevd:
- `godkjent === krevd` → godkjent
- `0 < godkjent < krevd` → delvis
- `godkjent === 0` (eller prekludert) → avslått

Domenelogikken i `beregnGodkjentBelop()` kjøres i revers.

### D3: Metode som tre klikkbare info-kort

Tre små kort viser metodene. TEs valgte metode er highlighted.
BH klikker på et annet kort for å avvise — ingen eksplisitt "aksepterer du?".
Tooltip viser §-detaljer og beskrivelse.

- BH klikker samme som TE = akseptert (default)
- BH klikker annet kort = avvist → viser "TE: X → BH: Y"

Kondisjonelle under-elementer under kortene:
- EP-justering (kun ENHETSPRISER + `krever_justert_ep`): varseldato + Ja/Nei + aksepterer Ja/Nei
- Tilbakeholdelse (kun REGNINGSARBEID uten overslag): info + Ja/Nei

### D4: Varseldato synlig i krav-linjer

Krav-linjer med varslingskrav (rigg/produktivitet, og hovedkrav ved SVIKT/ANDRE)
viser TEs `dato_klar_over` som kontekst ved siden av Ja/Nei-knappene.
BH ser når TE varslet og vurderer om det var "uten ugrunnet opphold".

---

## TypeScript-interfaces

### KravLinjeEditState

```typescript
interface KravLinjeEditState {
  label: string;                       // "Hovedkrav" | "Rigg/drift" | "Produktivitet"
  paragraf: string;                    // "" | "§34.1.3"
  krevdBelop: number;

  // Beløp
  godkjentBelop: number;
  onGodkjentBelopChange: (v: number) => void;

  // Varsling (kondisjonelt synlig)
  showVarsling: boolean;
  varsletDato?: string;                // "2026-01-14" → formateres til "14.01.2026"
  varsletITide: boolean;
  onVarsletITideChange: (v: boolean) => void;

  // Computed (avledet fra godkjent vs krevd)
  vurdering: BelopVurdering;           // 'godkjent' | 'delvis' | 'avslatt'
  erPrekludert: boolean;
}
```

### VederlagEditState

```typescript
interface VederlagEditState {
  // ── Metode-seksjon ──
  teMetode: VederlagsMetode;           // TEs valgte metode (read-only)
  bhMetode: VederlagsMetode;           // BHs valg (default = teMetode)
  onBhMetodeChange: (m: VederlagsMetode) => void;
  harMetodeendring: boolean;           // bhMetode !== teMetode

  // EP-justering (kun ENHETSPRISER + krever_justert_ep)
  showEpJustering: boolean;
  epJusteringVarsletITide?: boolean;
  onEpJusteringVarsletITideChange: (v: boolean) => void;
  epJusteringAkseptert?: boolean;
  onEpJusteringAkseptertChange: (v: boolean) => void;

  // Tilbakeholdelse (kun REGNINGSARBEID uten overslag)
  showTilbakeholdelse: boolean;
  holdTilbake: boolean;
  onHoldTilbakeChange: (v: boolean) => void;

  // ── Krav-linjer ──
  hovedkrav: KravLinjeEditState;
  rigg?: KravLinjeEditState;           // undefined hvis !harRiggKrav
  produktivitet?: KravLinjeEditState;   // undefined hvis !harProduktivitetKrav

  // ── Resultat (computed) ──
  prinsipaltResultat: VederlagBeregningResultat;
  subsidiaertResultat: VederlagBeregningResultat;
  visSubsidiaertResultat: boolean;
  totalKrevd: number;
  totalGodkjent: number;
  totalGodkjentInklPrekludert: number;
  godkjenningsgradProsent: number;

  // ── Subsidiær kontekst ──
  erSubsidiaer: boolean;               // grunnlag avslått eller §32.2
  subsidiaerTriggers: SubsidiaerTrigger[];

  // ── Card actions ──
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
```

### VederlagEditorProps

```typescript
interface VederlagEditorProps {
  begrunnelse: string;
  onBegrunnelseChange: (value: string) => void;
  begrunnelseError?: string;
  placeholder: string;
  autoBegrunnelse: string;
  onRegenerate: () => void;
  showRegenerate: boolean;
}
```

---

## Oppgaver

### Fase 2a: Ny primitiv — MethodCards

**Fil:** `src/components/bento/MethodCards.tsx`

Tre klikkbare kort for beregningsmetode. Props:

```typescript
interface MethodCardsProps {
  teMetode: VederlagsMetode;           // Highlighted som "TEs valg"
  bhMetode: VederlagsMetode;           // Aktivt valg (border-markert)
  onChange: (m: VederlagsMetode) => void;
}
```

Hver kort viser: kort-label, §-referanse, tooltip med full beskrivelse.
TEs valg har "TE"-badge. BHs valg (hvis forskjellig) har "BH"-badge.
Gjenbruk farger/stil fra InlineYesNo.

**Test:** `src/components/bento/__tests__/MethodCards.test.tsx`

### Fase 2b: Ny primitiv — InlineCurrencyInput

**Fil:** `src/components/bento/InlineCurrencyInput.tsx`

Wrapper rundt InlineNumberInput med `prefix="kr"` og `suffix=",-"`.
Viser referanseverdi (krevd beløp) og avledet vurdering-badge.

```typescript
interface InlineCurrencyInputProps {
  label: string;                       // "Godkjent"
  value: number;
  onChange: (v: number) => void;
  krevdBelop: number;                  // Referanse for %-beregning
  vurdering: BelopVurdering;           // Avledet badge
  erPrekludert?: boolean;
  disabled?: boolean;
}
```

Visuelt: `Godkjent  [  100 000] kr  → Godkjent ✓`

**Test:** `src/components/bento/__tests__/InlineCurrencyInput.test.tsx`

### Fase 2c: Ny primitiv — KravLinje

**Fil:** `src/components/bento/KravLinje.tsx`

Gjenbrukbar komponent for en krav-linje i kortet.
Rendrer varsling + beløp + vurdering for ett krav.

```typescript
interface KravLinjeProps {
  editState: KravLinjeEditState;
}
```

Layout:
```
── Rigg/drift §34.1.3 ────────
Varslet 14.01.2026  Varslet i tide? [Ja][Nei]
                                  PREKLUDERT
Krevd        kr 30 000
Godkjent [ 20 000 ] kr   → Delvis (67%)
```

**Test:** `src/components/bento/__tests__/KravLinje.test.tsx`

### Fase 2d: useVederlagBridge hook

**Fil:** `src/hooks/useVederlagBridge.ts`

Følger useFristBridge-mønsteret:

1. **Config** — mottar sak/krav-data, callbacks, approval-config
2. **State** — konsolidert `useState<VederlagFormState>` (fra vederlagDomain)
3. **Domain** — `beregnAlt(formState, domainConfig)` for alle computed values
4. **Auto-begrunnelse** — `generateVederlagResponseBegrunnelse()` med token-format
5. **Submit** — `buildEventData()` → `mutation.mutate()`
6. **Return** — `{ cardProps: VederlagEditState, editorProps: VederlagEditorProps }`

Nøkkelforskjell fra frist-bridgen:
- `bhMetode` state (default = teMetode, bruker endrer ved å klikke annet kort)
- `KravLinjeEditState`-generering for 1–3 krav-linjer basert på config
- Avledet `vurdering` per linje (fra godkjent vs krevd beløp)

**Test:** `src/hooks/__tests__/useVederlagBridge.test.ts` — hook-test med renderHook

### Fase 2e: VederlagCard interaktivitet

**Fil:** `src/components/bento/track-cards/VederlagCard.tsx` (oppdater)

Legg til `editState?: VederlagEditState | null` prop.
Når `editState` er satt, rendrer interaktive kontroller:

1. Metode-seksjon med MethodCards
2. EP-justering / tilbakeholdelse (kondisjonelt)
3. KravLinje for hovedkrav
4. KravLinje for rigg (hvis finnes)
5. KravLinje for produktivitet (hvis finnes)
6. Resultat-boks (prinsipalt + subsidiært)
7. Submit-footer (som FristCard)

### Fase 2f: BentoRespondVederlag panel

**Fil:** `src/components/bento/BentoRespondVederlag.tsx`

Identisk struktur som BentoRespondFrist — ren begrunnelse-editor.
Mottar `VederlagEditorProps`, rendrer RichTextEditor + regenerer-knapp.

### Fase 2g: CasePageBento routing

**Fil:** `src/pages/CasePageBento.tsx` (oppdater)

Legg til `vederlag:respond` case i action-switch:

```typescript
case 'vederlag:respond':
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-5">
        <VederlagCard editState={vederlagBridge.cardProps} ... />
      </div>
      <div className="col-span-7">
        <BentoRespondVederlag editorProps={vederlagBridge.editorProps} />
      </div>
    </div>
  );
```

Wire opp `useVederlagBridge` med sak-data fra CasePageBento.

### Fase 2h: Tester

- Enhetstester for MethodCards, InlineCurrencyInput, KravLinje
- Hook-test for useVederlagBridge med renderHook
- Eksisterende 729 tester må fortsatt passere

---

## Implementeringsrekkefølge

```
2a: MethodCards          ← ny primitiv, ingen avhengigheter
2b: InlineCurrencyInput  ← ny primitiv, ingen avhengigheter
2c: KravLinje            ← avhenger av InlineCurrencyInput + InlineYesNo
─── kan parallelliseres over ───
2d: useVederlagBridge    ← avhenger av vederlagDomain (ferdig)
2e: VederlagCard         ← avhenger av 2a, 2b, 2c, 2d
2f: BentoRespondVederlag ← trivielt, kan gjøres når som helst
2g: CasePageBento        ← avhenger av 2d, 2e, 2f
2h: Tester               ← løpende per fase
```

## Avgrensninger

- **Ikke** endre RespondVederlagModal — den forblir som fallback for CasePage
- **Ikke** implementer TE-oppdateringer (fase 3)
- **Ikke** endre backend — event-formatet er identisk

## Forventet filstruktur (nye/endrede)

```
src/
├── components/bento/
│   ├── MethodCards.tsx                    ← NY
│   ├── InlineCurrencyInput.tsx            ← NY
│   ├── KravLinje.tsx                      ← NY
│   ├── BentoRespondVederlag.tsx           ← NY
│   ├── track-cards/VederlagCard.tsx        ← ENDRET
│   └── __tests__/
│       ├── MethodCards.test.tsx            ← NY
│       ├── InlineCurrencyInput.test.tsx    ← NY
│       └── KravLinje.test.tsx             ← NY
├── hooks/
│   ├── useVederlagBridge.ts               ← NY
│   └── __tests__/
│       └── useVederlagBridge.test.ts       ← NY
└── pages/
    └── CasePageBento.tsx                  ← ENDRET
```
