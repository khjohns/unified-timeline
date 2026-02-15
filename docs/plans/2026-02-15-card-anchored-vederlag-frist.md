# Card-Anchored Contextual Editing: Vederlag og Frist

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Utvide card-anchored editing-mønsteret (ADR-003) fra grunnlag-sporet til vederlag- og frist-sporene. BH-svarskjemaer flyttes fra fullskjerm-modaler til inline card+panel-layout i bento-siden.

**Designdokument:** `docs/ADR-003-card-anchored-contextual-editing.md`

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS v4, react-hook-form, Vitest

---

## Arkitekturbeslutninger

### B1: Dedikerte hooks, ikke generisk bridge

Grunnlag-bridgen har 2 felter. Frist har ~7 felter med betinget synlighet. Vederlag har 15+ felter med komplekse avhengigheter. En generisk `useCardFormBridge<T>` ville kreve så mange type-parametere at den blir verre enn dedikerte hooks.

**Beslutning:** Tre separate hooks — `useFristBridge`, `useVederlagBridge` — hver med domene-spesifikk logikk og computed state.

### B2: editState-bag for kort-props

I stedet for 15+ individuelle props til kortet, pass en strukturert `editState`-objekt (eller `null` i read-only-modus). Kortet sjekker `if (editState)` for å vise interaktive kontroller.

```typescript
interface FristEditState {
  // Port 1: Varsling
  fristVarselOk: boolean;
  onFristVarselOkChange: (v: boolean) => void;
  showFristVarselOk: boolean;
  // ... (andre felter)
  // Computed
  erPrekludert: boolean;
  beregningsResultat: string | undefined;
}

<FristCard state={state} editState={fristBridge.cardProps} />
```

### B3: Tall-input i kortet

`godkjent_dager` og `godkjent_belop` hører i kortet, ved siden av `krevd_dager` / `krevd_belop`. Brukeren ser krevet beløp og skriver inn godkjent beløp i samme visuelle område. Validering inline (min 0, advarsel hvis > krevd).

### B4: BH-svar først, TE-oppdateringer som naturlig neste steg

Card-anchored mønsteret passer for **alle skjemaer der kortet allerede viser data
som brukeren vurderer eller endrer**. Den iterative flyten er:

```
TE sender krav → TE kan oppdatere kravet
  → BH svarer på krav → BH kan oppdatere svaret
    → TE svarer på BH-respons → TE kan oppdatere eget svar
      → Gjentas til enighet eller trekking
```

**BH-svar** (respond/updateResponse) er det naturlige startpunktet fordi
BH vurderer data som allerede vises i kortet — en-til-en match med mønsteret.

**TE-oppdateringer** (revider) passer like godt: kortet viser nåværende krav,
og TE endrer verdier inline. InlineReviseVederlag og InlineReviseFrist gjør
allerede noe lignende i kompakt form. Card-anchored gir en fullverdig versjon.

**TE førstegangs-innsending** (send) er minst naturlig — kortet er tomt, så
det er ingen kontekst å forankre kontrollene i. Disse forblir i TrackFormView.

**Implementeringsstrategi:** Start med BH-svar (fase 1-2). Evaluer mønsteret.
Deretter vurder TE-oppdateringer som fase 3 basert på erfaringene.

### B5: Frist først, deretter Vederlag

Frist er enklere (færre kontroller, enklere betinget logikk) og validerer mønsteret før vi tar den komplekse vederlag-implementeringen.

### B6: Layout-mønster

Når `frist:respond` eller `vederlag:respond` er aktiv i CasePageBento:
- Kort (col-5, interaktiv modus) + Formpanel (col-7)
- Andre kort kollapser til col-6 under
- Identisk med grunnlag-mønsteret, men med FristCard/VederlagCard i stedet for MasterCard

### B7: Modaler beholdes som fallback

De klassiske modalene (RespondVederlagModal, RespondFristModal) slettes IKKE. De forblir som fallback for klassisk CasePage (`/saker/:id`). Bento-siden bruker inline card-anchored, klassisk side bruker modaler.

---

## Faseplan

| Fase | Spor | Innhold | Tasks |
|------|------|---------|-------|
| 0 | Delte primitiver | InlineYesNo, InlineNumberInput, konsekvens-utvidelse | 1–3 |
| 1 | Frist (BH-svar) | useFristBridge, FristCard interaktiv, BentoRespondFrist, wiring | 4–8 |
| 2 | Vederlag (BH-svar) | useVederlagBridge, VederlagCard interaktiv, BentoRespondVederlag, wiring | 9–13 |
| 3 | TE-oppdateringer | Evaluer mønsteret fra fase 1-2, vurder card-anchored for TE revider | Planlegges etter evaluering |

**Fase 3 (fremtidig):** Etter fase 1-2 evaluerer vi om card-anchored fungerer
godt nok til å erstatte InlineReviseVederlag/InlineReviseFrist med fullverdige
card-anchored TE-oppdateringsskjemaer. Bridge-hookene og de interaktive kortene
fra fase 1-2 kan gjenbrukes med TE-spesifikke tilpasninger (andre felter
redigerbare, andre read-only).

---

## Fase 0: Delte primitiver

### Task 1: InlineYesNo — Gjenbrukbar ja/nei-toggle

Ekstraher ja/nei-togglen fra CaseMasterCard (linje 231-265) til en egen komponent.

**Filer:**
- Opprett: `src/components/bento/InlineYesNo.tsx`
- Test: `src/components/bento/__tests__/InlineYesNo.test.tsx`

**Steg 1: Skriv test**

```tsx
// src/components/bento/__tests__/InlineYesNo.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InlineYesNo } from '../InlineYesNo';

describe('InlineYesNo', () => {
  it('renders label and both buttons', () => {
    render(<InlineYesNo label="Varslet i tide?" value={undefined} onChange={() => {}} />);
    expect(screen.getByText('Varslet i tide?')).toBeInTheDocument();
    expect(screen.getByText('Ja')).toBeInTheDocument();
    expect(screen.getByText('Nei')).toBeInTheDocument();
  });

  it('calls onChange with true when Ja is clicked', () => {
    const onChange = vi.fn();
    render(<InlineYesNo label="Test" value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByText('Ja'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when Nei is clicked', () => {
    const onChange = vi.fn();
    render(<InlineYesNo label="Test" value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByText('Nei'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('highlights Ja when value is true', () => {
    const { container } = render(<InlineYesNo label="Test" value={true} onChange={() => {}} />);
    const jaBtn = container.querySelector('[data-value="true"]');
    expect(jaBtn?.className).toContain('border-pkt-brand-dark-green-1000');
  });

  it('highlights Nei when value is false', () => {
    const { container } = render(<InlineYesNo label="Test" value={false} onChange={() => {}} />);
    const neiBtn = container.querySelector('[data-value="false"]');
    expect(neiBtn?.className).toContain('border-pkt-brand-red-1000');
  });

  it('shows PREKLUDERT badge when value is false and showPrekludert is true', () => {
    render(<InlineYesNo label="Test" value={false} onChange={() => {}} showPrekludert />);
    expect(screen.getByText('PREKLUDERT')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<InlineYesNo label="Test" subtitle="§33.4" value={undefined} onChange={() => {}} />);
    expect(screen.getByText('§33.4')).toBeInTheDocument();
  });
});
```

**Steg 2: Kjør test — forvent FAIL (modul mangler)**

```bash
npx vitest run src/components/bento/__tests__/InlineYesNo.test.tsx
```

**Steg 3: Implementer**

Ekstraher mønsteret fra CaseMasterCard linje 231-265. Grensesnitt:

```tsx
export interface InlineYesNoProps {
  label: string;
  subtitle?: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  showPrekludert?: boolean;  // Vis PREKLUDERT-badge når value === false
  disabled?: boolean;
  className?: string;
}
```

Design: Kompakt rad med label til venstre, to mini-knapper til høyre (✓ Ja / ✕ Nei). Bruk CheckIcon/Cross2Icon. Fargekoding: grønn for Ja, rød for Nei, dimme den uvalgte.

**Steg 4: Kjør test — forvent PASS**

```bash
npx vitest run src/components/bento/__tests__/InlineYesNo.test.tsx
```

**Steg 5: Refaktorer CaseMasterCard**

Erstatt inline-togglen i CaseMasterCard (linje 231-265) med `<InlineYesNo>`. Verifiser at grunnlag-mønsteret fortsatt fungerer.

```bash
npx vitest run src/components/bento/__tests__/
```

**Steg 6: Commit**

```
feat: extract InlineYesNo toggle component from CaseMasterCard
```

---

### Task 2: InlineNumberInput — Kompakt tallinput

Liten inline-tallinput for `godkjent_dager` og `godkjent_belop`. Vises ved siden av krevd-verdien i kortet.

**Filer:**
- Opprett: `src/components/bento/InlineNumberInput.tsx`
- Test: `src/components/bento/__tests__/InlineNumberInput.test.tsx`

**Steg 1: Skriv test**

```tsx
// src/components/bento/__tests__/InlineNumberInput.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InlineNumberInput } from '../InlineNumberInput';

describe('InlineNumberInput', () => {
  it('renders label and input', () => {
    render(<InlineNumberInput label="Godkjent" value={10} onChange={() => {}} />);
    expect(screen.getByText('Godkjent')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(10);
  });

  it('renders suffix', () => {
    render(<InlineNumberInput label="Dager" value={5} onChange={() => {}} suffix="d" />);
    expect(screen.getByText('d')).toBeInTheDocument();
  });

  it('calls onChange on input', () => {
    const onChange = vi.fn();
    render(<InlineNumberInput label="Test" value={0} onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('shows error state', () => {
    const { container } = render(
      <InlineNumberInput label="Test" value={-1} onChange={() => {}} error="Må være >= 0" />
    );
    expect(screen.getByText('Må være >= 0')).toBeInTheDocument();
    expect(container.querySelector('input')?.className).toContain('border-pkt-brand-red-1000');
  });

  it('shows reference value for comparison', () => {
    render(<InlineNumberInput label="Godkjent" value={5} onChange={() => {}} referenceLabel="Krevd" referenceValue="10d" />);
    expect(screen.getByText('Krevd')).toBeInTheDocument();
    expect(screen.getByText('10d')).toBeInTheDocument();
  });

  it('respects min value', () => {
    render(<InlineNumberInput label="Test" value={0} onChange={() => {}} min={0} />);
    expect(screen.getByRole('spinbutton')).toHaveAttribute('min', '0');
  });
});
```

**Steg 2: Kjør test — forvent FAIL**

**Steg 3: Implementer**

```tsx
export interface InlineNumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;           // "d" for dager, "kr" for beløp
  min?: number;
  error?: string;
  referenceLabel?: string;    // "Krevd"
  referenceValue?: string;    // "10d" eller "250 000 kr"
  disabled?: boolean;
  className?: string;
}
```

Design: Kompakt layout — label + liten number-input med suffix. Viser referanseverdi (krevd) over input for sammenligning. Font: mono tabular-nums for tall-alignment. Bredde: max ~100px for input.

**Steg 4: Kjør test — forvent PASS**

**Steg 5: Commit**

```
feat: add InlineNumberInput for card-anchored numeric fields
```

---

### Task 3: Utvid konsekvens-callout for alle spor

Utvid `getConsequence` i `consequenceCallout.ts` med støtte for frist- og vederlag-spesifikke konsekvenser.

**Filer:**
- Endre: `src/components/bento/consequenceCallout.ts`
- Endre: `src/components/bento/__tests__/consequenceCallout.test.ts`

**Steg 1: Legg til nye tester**

```ts
// Legg til i eksisterende testfil
describe('getFristConsequence', () => {
  it('returns null when no resultat', () => {
    expect(getFristConsequence({ resultat: undefined })).toBeNull();
  });

  it('returns success for godkjent', () => {
    const result = getFristConsequence({ resultat: 'godkjent', godkjentDager: 10, krevdDager: 10 });
    expect(result?.variant).toBe('success');
    expect(result?.text).toContain('godkjent');
  });

  it('returns warning for delvis_godkjent', () => {
    const result = getFristConsequence({ resultat: 'delvis_godkjent', godkjentDager: 5, krevdDager: 10 });
    expect(result?.variant).toBe('warning');
  });

  it('returns danger for avslatt with forsering reference', () => {
    const result = getFristConsequence({ resultat: 'avslatt', godkjentDager: 0, krevdDager: 10 });
    expect(result?.variant).toBe('danger');
    expect(result?.text).toContain('§33.8');
  });

  it('includes subsidiary text when relevant', () => {
    const result = getFristConsequence({ resultat: 'godkjent', godkjentDager: 10, krevdDager: 10, erSubsidiaer: true });
    expect(result?.text).toContain('subsidiært');
  });

  it('handles preclusion consequence', () => {
    const result = getFristConsequence({ resultat: 'avslatt', erPrekludert: true, godkjentDager: 0, krevdDager: 10 });
    expect(result?.variant).toBe('danger');
    expect(result?.text).toContain('preklu');
  });
});

describe('getVederlagConsequence', () => {
  it('returns null when no resultat', () => {
    expect(getVederlagConsequence({ resultat: undefined })).toBeNull();
  });

  it('returns success for godkjent', () => {
    const result = getVederlagConsequence({ resultat: 'godkjent' });
    expect(result?.variant).toBe('success');
  });

  it('returns warning for delvis_godkjent', () => {
    const result = getVederlagConsequence({ resultat: 'delvis_godkjent', godkjentBelop: 50000, krevdBelop: 100000 });
    expect(result?.variant).toBe('warning');
  });

  it('returns info for hold_tilbake', () => {
    const result = getVederlagConsequence({ resultat: 'hold_tilbake' });
    expect(result?.variant).toBe('info');
    expect(result?.text).toContain('§30.2');
  });

  it('returns danger for avslatt', () => {
    const result = getVederlagConsequence({ resultat: 'avslatt' });
    expect(result?.variant).toBe('danger');
  });
});
```

**Steg 2: Kjør test — forvent FAIL (nye funksjoner eksisterer ikke)**

**Steg 3: Implementer `getFristConsequence` og `getVederlagConsequence`**

Basert på konsekvens-logikken i RespondFristModal (§33.8 forsering-advarsel) og RespondVederlagModal (preklusion, metodeendring, hold_tilbake). Legg funksjonene til i `consequenceCallout.ts` og eksporter.

**Steg 4: Kjør test — forvent PASS**

```bash
npx vitest run src/components/bento/__tests__/consequenceCallout.test.ts
```

**Steg 5: Commit**

```
feat: extend consequence callout for frist and vederlag tracks
```

---

## Fase 1: Frist card-anchored editing

### Task 4: useFristBridge hook

State-koordineringshook mellom FristCard og BentoRespondFrist.

**Filer:**
- Opprett: `src/hooks/useFristBridge.ts`
- Test: `src/hooks/__tests__/useFristBridge.test.ts`

**Steg 1: Skriv test**

```ts
// src/hooks/__tests__/useFristBridge.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useFristBridge } from '../useFristBridge';

const defaultConfig = {
  isOpen: true,
  krevdDager: 10,
  varselType: 'spesifisert' as const,
  grunnlagStatus: 'godkjent' as const,
  fristTilstand: {},
};

describe('useFristBridge', () => {
  it('initializes with TE-favorable defaults', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    expect(result.current.cardProps.fristVarselOk).toBe(true);
    expect(result.current.cardProps.vilkarOppfylt).toBe(true);
    expect(result.current.cardProps.godkjentDager).toBe(10); // krevd dager
  });

  it('computes prinsipalt resultat as godkjent when all positive', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    expect(result.current.computed.prinsipaltResultat).toBe('godkjent');
  });

  it('computes avslatt when prekludert', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    act(() => result.current.cardProps.onFristVarselOkChange(false));
    expect(result.current.computed.erPrekludert).toBe(true);
    expect(result.current.computed.prinsipaltResultat).toBe('avslatt');
  });

  it('computes avslatt when vilkar not met', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    act(() => result.current.cardProps.onVilkarOppfyltChange(false));
    expect(result.current.computed.prinsipaltResultat).toBe('avslatt');
  });

  it('computes delvis_godkjent when godkjent dager < krevd', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    act(() => result.current.cardProps.onGodkjentDagerChange(5));
    expect(result.current.computed.prinsipaltResultat).toBe('delvis_godkjent');
  });

  it('resets state when isOpen changes to true', () => {
    const { result, rerender } = renderHook(
      (props) => useFristBridge(props),
      { initialProps: { ...defaultConfig, isOpen: false } }
    );
    act(() => result.current.cardProps.onGodkjentDagerChange(3));
    rerender({ ...defaultConfig, isOpen: true });
    expect(result.current.cardProps.godkjentDager).toBe(10);
  });

  it('shows fristVarselOk only for varsel type', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, varselType: 'varsel',
    }));
    expect(result.current.cardProps.showFristVarselOk).toBe(true);
  });

  it('shows spesifisertKravOk for spesifisert type', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    expect(result.current.cardProps.showSpesifisertKravOk).toBe(true);
  });

  it('hides godkjentDager when sendForesporsel is true', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, varselType: 'varsel',
    }));
    act(() => result.current.cardProps.onSendForesporselChange(true));
    expect(result.current.cardProps.showGodkjentDager).toBe(false);
  });

  it('computes subsidiary result ignoring preclusion', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    act(() => result.current.cardProps.onFristVarselOkChange(false));
    // Prekludert → prinsipalt avslått, men subsidiært fremdeles godkjent
    expect(result.current.computed.subsidiaertResultat).toBe('godkjent');
  });
});
```

**Steg 2: Kjør test — forvent FAIL**

**Steg 3: Implementer**

Hooken tar inn konfig og returnerer:

```typescript
interface UseFristBridgeConfig {
  isOpen: boolean;
  krevdDager: number;
  varselType?: 'varsel' | 'spesifisert' | 'begrunnelse_utsatt';
  grunnlagStatus?: string;
  grunnlagVarsletForSent?: boolean;
  fristTilstand?: Partial<FristTilstand>;
  lastResponseEvent?: any;  // For update-modus
}

interface FristBridgeReturn {
  cardProps: FristEditState;  // State + handlers for FristCard
  formProps: {
    externalSelections: Record<string, unknown>;
    begrunnelseDefaults: { placeholder: string };
  };
  computed: {
    erPrekludert: boolean;
    erRedusert: boolean;
    erGrunnlagSubsidiaer: boolean;
    prinsipaltResultat: string | undefined;
    subsidiaertResultat: string | undefined;
    visSubsidiaertResultat: boolean;
    visForsering: boolean;
    avslatteDager: number;
    sendForesporsel: boolean;
    subsidiaerTriggers: string[];
  };
  validate: () => boolean;
}
```

**Logikk:** Portér beregningene fra RespondFristModal:
- `beregnPrinsipaltResultat()` — kopiér fra modalen
- `beregnSubsidiaertResultat()` — kopiér fra modalen
- Synlighets-flagg basert på `varselType`, `harTidligereFristVarsel`, `erSvarPaForesporsel`
- Preklusion: `fristVarselOk === false` eller `foresporselSvarOk === false`
- Reduksjon: `spesifisertKravOk === false` (ikke preklusion, kun begrensning)

**Steg 4: Kjør test — forvent PASS**

**Steg 5: Commit**

```
feat: add useFristBridge hook for card-form state coordination
```

---

### Task 5: FristCard interaktiv modus

Utvid FristCard til å støtte `editState`-prop for interaktiv modus.

**Filer:**
- Endre: `src/components/bento/track-cards/FristCard.tsx`
- Test: `src/components/bento/track-cards/__tests__/FristCard.test.tsx`

**Steg 1: Skriv test**

```tsx
// src/components/bento/track-cards/__tests__/FristCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FristCard } from '../FristCard';

const baseState = {
  frist: {
    status: 'te_sendt',
    krevd_dager: 10,
    frist_varsel: { dato_sendt: '2024-01-15' },
    ny_sluttdato: '2024-06-01',
  },
  // ... minimal SakState
} as any;

describe('FristCard read-only', () => {
  it('renders krevd dager', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={{} as any} />);
    expect(screen.getByText('10d')).toBeInTheDocument();
  });
});

describe('FristCard interactive mode', () => {
  const editState = {
    fristVarselOk: true,
    onFristVarselOkChange: vi.fn(),
    showFristVarselOk: true,
    spesifisertKravOk: true,
    onSpesifisertKravOkChange: vi.fn(),
    showSpesifisertKravOk: false,
    foresporselSvarOk: true,
    onForesporselSvarOkChange: vi.fn(),
    showForesporselSvarOk: false,
    sendForesporsel: false,
    onSendForesporselChange: vi.fn(),
    showSendForesporsel: false,
    vilkarOppfylt: true,
    onVilkarOppfyltChange: vi.fn(),
    godkjentDager: 10,
    onGodkjentDagerChange: vi.fn(),
    showGodkjentDager: true,
    erPrekludert: false,
    beregningsResultat: 'godkjent',
  };

  it('shows InlineYesNo for varslet i tide when editState.showFristVarselOk', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={{} as any} editState={editState} />);
    expect(screen.getByText(/Varslet i tide/)).toBeInTheDocument();
  });

  it('shows vilkår toggle', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={{} as any} editState={editState} />);
    expect(screen.getByText(/Vilkår oppfylt/)).toBeInTheDocument();
  });

  it('shows godkjent dager input when showGodkjentDager is true', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={{} as any} editState={editState} />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('hides CTA strip when in edit mode', () => {
    const { container } = render(
      <FristCard state={baseState} entries={[]} userRole="BH" actions={{} as any} editState={editState} />
    );
    expect(container.querySelector('[data-track-cta]')).toBeNull();
  });
});
```

**Steg 2: Kjør test — forvent FAIL (editState-prop finnes ikke)**

**Steg 3: Implementer**

Utvid `FristCardProps` med `editState?: FristEditState | null`. I JSX:

```tsx
// Etter eksisterende key-value rows, INNENFOR isEmpty-sjekken:

{/* Inline controls when in edit mode */}
{editState && (
  <div className="mt-2 pt-2 border-t border-pkt-border-subtle space-y-2">
    {/* Port 1: Varsling-kontroller */}
    {editState.showFristVarselOk && (
      <InlineYesNo
        label="Varslet i tide?"
        subtitle="§33.4"
        value={editState.fristVarselOk}
        onChange={editState.onFristVarselOkChange}
        showPrekludert
      />
    )}
    {editState.showSpesifisertKravOk && (
      <InlineYesNo
        label="Spesifisert i tide?"
        subtitle="§33.6.1"
        value={editState.spesifisertKravOk}
        onChange={editState.onSpesifisertKravOkChange}
      />
    )}
    {editState.showForesporselSvarOk && (
      <InlineYesNo
        label="Svart i tide?"
        subtitle="§33.6.2"
        value={editState.foresporselSvarOk}
        onChange={editState.onForesporselSvarOkChange}
        showPrekludert
      />
    )}
    {editState.showSendForesporsel && (
      <InlineYesNo
        label="Send forespørsel?"
        subtitle="§33.6.2"
        value={editState.sendForesporsel}
        onChange={editState.onSendForesporselChange}
      />
    )}

    {/* Port 2: Vilkår */}
    <InlineYesNo
      label="Vilkår oppfylt?"
      subtitle="§33.1"
      value={editState.vilkarOppfylt}
      onChange={editState.onVilkarOppfyltChange}
    />

    {/* Port 3: Beregning */}
    {editState.showGodkjentDager && (
      <InlineNumberInput
        label="Godkjent"
        value={editState.godkjentDager}
        onChange={editState.onGodkjentDagerChange}
        suffix="d"
        min={0}
        referenceLabel="Krevd"
        referenceValue={`${state.frist.krevd_dager}d`}
      />
    )}
  </div>
)}
```

Skjul TrackCTA og BH-respons-seksjon når `editState` er satt (identisk med grunnlag-mønsteret i CaseMasterCard).

**Steg 4: Kjør test — forvent PASS**

```bash
npx vitest run src/components/bento/track-cards/__tests__/FristCard.test.tsx
```

**Steg 5: Commit**

```
feat: add interactive edit mode to FristCard for card-anchored editing
```

---

### Task 6: BentoRespondFrist formpanel

Formpanelet som vises til høyre for FristCard i interaktiv modus. Inneholder kun konsekvens-callout, forsering-advarsel, begrunnelse-editor og submit/avbryt.

**Filer:**
- Opprett: `src/components/bento/BentoRespondFrist.tsx`
- Test: `src/components/bento/__tests__/BentoRespondFrist.test.tsx`

**Steg 1: Skriv test**

```tsx
describe('BentoRespondFrist', () => {
  it('renders begrunnelse editor', () => {
    render(<BentoRespondFrist {...defaultProps} />);
    expect(screen.getByText(/begrunnelse/i)).toBeInTheDocument();
  });

  it('shows consequence callout when resultat is set', () => {
    render(<BentoRespondFrist {...defaultProps} externalResultat="godkjent" />);
    expect(screen.getByText(/godkjent/i)).toBeInTheDocument();
  });

  it('shows forsering warning when rejecting days', () => {
    render(<BentoRespondFrist {...defaultProps} externalResultat="avslatt" visForsering />);
    expect(screen.getByText(/§33.8/)).toBeInTheDocument();
  });

  it('shows resultat-error alert when resultat is missing externally', () => {
    render(<BentoRespondFrist {...defaultProps} externalResultat={undefined} />);
    // Submit should require resultat set in card
  });

  it('calls onSuccess after successful submit', async () => {
    // Mock useSubmitEvent, trigger submit
  });
});
```

**Steg 2: Kjør test — forvent FAIL**

**Steg 3: Implementer**

Struktur: Kopier BentoRespondGrunnlag-mønsteret, men tilpasset frist:

```tsx
interface BentoRespondFristProps {
  sakId: string;
  fristKravId: string;
  // External state from bridge hook
  externalFristVarselOk?: boolean;
  externalSpesifisertKravOk?: boolean;
  externalForesporselSvarOk?: boolean;
  externalVilkarOppfylt?: boolean;
  externalGodkjentDager?: number;
  externalResultat?: string;
  externalSendForesporsel?: boolean;
  // Computed from bridge
  erPrekludert?: boolean;
  erRedusert?: boolean;
  erGrunnlagSubsidiaer?: boolean;
  visForsering?: boolean;
  avslatteDager?: number;
  subsidiaerTriggers?: string[];
  subsidiaertResultat?: string;
  visSubsidiaertResultat?: boolean;
  krevdDager?: number;
  // Callbacks
  onSuccess: () => void;
  onCancel: () => void;
  onCatendaWarning?: () => void;
  approvalEnabled?: boolean;
  onSaveDraft?: (data: any) => void;
}
```

Formpanelet synkroniserer `externalXxx`-props via `useEffect(() => setValue(...))` — identisk med BentoRespondGrunnlag-mønsteret.

Innhold:
1. Konsekvens-callout fra `getFristConsequence()`
2. §33.8 forsering-advarsel (kun når dager avslås)
3. Begrunnelse RichTextEditor (primær arbeidsflate)
4. Submit/Avbryt footer

**Steg 4: Kjør test — forvent PASS**

**Steg 5: Commit**

```
feat: add BentoRespondFrist form panel for card-anchored editing
```

---

### Task 7: Wire frist card-anchored i CasePageBento

Koble FristCard (interaktiv) + BentoRespondFrist i CasePageBento.

**Filer:**
- Endre: `src/pages/CasePageBento.tsx`
- Endre: `src/components/bento/index.ts` (eksporter)

**Steg 1: Legg til useFristBridge i CasePageBento**

```tsx
// Under grunnlag-bridgen (linje ~292):
const isFristFormOpen = expandedTrack?.track === 'frist' &&
  (expandedTrack.action === 'respond' || expandedTrack.action === 'updateResponse');

const fristBridge = useFristBridge({
  isOpen: isFristFormOpen,
  krevdDager: state.frist.krevd_dager ?? 0,
  varselType: state.frist.varsel_type,
  grunnlagStatus: grunnlagStatus,
  grunnlagVarsletForSent: grunnlagVarsletForSent,
  fristTilstand: state.frist,
  lastResponseEvent: expandedTrack?.action === 'updateResponse'
    ? { event_id: `frist-response-${sakId}`, /* ... */ }
    : undefined,
});
```

**Steg 2: Endre primaryAction for BH frist-respons**

Erstatt `modals.respondFrist.setOpen(true)` med `handleExpandTrack('frist', 'respond')` for bento-siden. Tilsvarende for `updateFristResponse`.

```tsx
// I vederlagPrimaryAction / fristPrimaryAction:
if (actions.canRespondToFrist) return {
  label: 'Svar på krav',
  onClick: () => handleExpandTrack('frist', 'respond'),
};
```

**Steg 3: Legg til layout for frist:respond**

I layout-seksjonen (linje ~923), legg til card-anchored rendering for frist:

```tsx
// Etter grunnlag-sjekken:
const isFristInline = expandedTrack.track === 'frist' &&
  (expandedTrack.action === 'respond' || expandedTrack.action === 'updateResponse');

if (isFristInline) {
  return (
    <>
      {/* FristCard (col-5) — interactive */}
      <div className="col-span-12 md:col-span-5">
        <FristCard
          state={state}
          godkjentDager={godkjentDager ?? undefined}
          fristGrad={fristGrad ?? undefined}
          isSubsidiary={fristErSubsidiaer}
          userRole={userRole}
          actions={actions}
          entries={fristEntries}
          editState={fristBridge.cardProps}
        />
      </div>
      {/* BentoRespondFrist (col-7) */}
      <div className="col-span-12 md:col-span-7">
        <BentoRespondFrist
          sakId={sakId}
          fristKravId={`frist-${sakId}`}
          externalFristVarselOk={fristBridge.cardProps.fristVarselOk}
          externalGodkjentDager={fristBridge.cardProps.godkjentDager}
          externalResultat={fristBridge.computed.prinsipaltResultat}
          {...fristBridge.computed}
          krevdDager={state.frist.krevd_dager}
          onSuccess={handleCollapseTrack}
          onCancel={handleCollapseTrack}
        />
      </div>
    </>
  );
}
```

**Steg 4: Oppdater barrel export**

```ts
// src/components/bento/index.ts
export { BentoRespondFrist } from './BentoRespondFrist';
export { InlineYesNo } from './InlineYesNo';
export { InlineNumberInput } from './InlineNumberInput';
```

**Steg 5: Type-sjekk og eksisterende tester**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
npx vitest run src/components/bento/__tests__/
```

**Steg 6: Commit**

```
feat: wire frist card-anchored editing in CasePageBento
```

---

### Task 8: Visuell verifisering — Frist

**Steg 1:** Start dev server: `npm run dev`

**Steg 2:** Naviger til en testsak med frist sendt (BH-rolle).

**Steg 3:** Verifiser:
- [ ] Klikk "Svar på krav" på FristCard → card transformeres + formpanel åpnes
- [ ] FristCard viser InlineYesNo for varsling
- [ ] FristCard viser InlineYesNo for vilkår oppfylt
- [ ] FristCard viser InlineNumberInput for godkjent dager
- [ ] Konsekvens-callout oppdateres dynamisk i formpanelet
- [ ] §33.8 forsering-advarsel vises når dager avslås
- [ ] Begrunnelse-editor fungerer
- [ ] Submit fungerer (event sendes korrekt)
- [ ] MasterCard og VederlagCard vises under
- [ ] Mobil-viewport: 1-kolonne med kort først, panel under

**Steg 4:** Kjør full testsuite

```bash
npm run test
```

**Steg 5:** Commit eventuelle fiksefiler

```
fix: visual polish for frist card-anchored editing
```

---

## Fase 2: Vederlag card-anchored editing

### Task 9: useVederlagBridge hook

State-koordineringshook for vederlag-sporet. Vesentlig mer kompleks enn frist pga. 3 underkrav, metodevalg og betingede felter.

**Filer:**
- Opprett: `src/hooks/useVederlagBridge.ts`
- Test: `src/hooks/__tests__/useVederlagBridge.test.ts`

**Steg 1: Skriv test**

```ts
describe('useVederlagBridge', () => {
  // Port 1: Preklusion
  it('initializes with TE-favorable defaults', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig));
    expect(result.current.cardProps.hovedkravVarsletITide).toBe(true);
    expect(result.current.cardProps.akseptererMetode).toBe(true);
    expect(result.current.cardProps.hovedkravVurdering).toBe('godkjent');
  });

  it('shows hovedkrav varslet only for SVIKT/ANDRE', () => {
    const { result } = renderHook(() => useVederlagBridge({
      ...defaultConfig, hovedkategori: 'ENDRING',
    }));
    expect(result.current.cardProps.showHovedkravVarsletITide).toBe(false);
  });

  it('shows rigg varslet only when rigg krav exists', () => {
    const { result } = renderHook(() => useVederlagBridge({
      ...defaultConfig,
      vederlagEvent: { ...defaultVederlagEvent, saerskilt_krav: { rigg_drift: { belop: 50000 } } },
    }));
    expect(result.current.cardProps.showRiggVarsletITide).toBe(true);
  });

  // Port 2: Metode
  it('shows oensket_metode when akseptererMetode is false', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig));
    act(() => result.current.cardProps.onAkseptererMetodeChange(false));
    expect(result.current.cardProps.showOensketMetode).toBe(true);
  });

  // Port 3: Beløp
  it('shows godkjent_belop when vurdering is delvis', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig));
    act(() => result.current.cardProps.onHovedkravVurderingChange('delvis'));
    expect(result.current.cardProps.showHovedkravGodkjentBelop).toBe(true);
  });

  // Resultat
  it('computes godkjent when all accepted', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig));
    expect(result.current.computed.prinsipaltResultat).toBe('godkjent');
  });

  it('computes hold_tilbake when flagged', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig));
    act(() => result.current.cardProps.onHoldTilbakeChange(true));
    expect(result.current.computed.prinsipaltResultat).toBe('hold_tilbake');
  });

  it('computes total amounts correctly', () => {
    const { result } = renderHook(() => useVederlagBridge({
      ...defaultConfig,
      vederlagEvent: {
        ...defaultVederlagEvent,
        belop_direkte: 100000,
        saerskilt_krav: { rigg_drift: { belop: 20000 }, produktivitet: { belop: 10000 } },
      },
    }));
    expect(result.current.computed.totalKrevdBelop).toBe(130000);
  });
});
```

**Steg 2: Kjør test — forvent FAIL**

**Steg 3: Implementer**

```typescript
interface UseVederlagBridgeConfig {
  isOpen: boolean;
  hovedkategori?: string;
  grunnlagStatus?: string;
  grunnlagVarsletForSent?: boolean;
  vederlagEvent: {
    metode?: string;
    belop_direkte?: number;
    kostnads_overslag?: number;
    krever_justert_ep?: boolean;
    varslet_for_oppstart?: boolean;
    saerskilt_krav?: any;
    dato_oppdaget?: string;
    dato_krav_mottatt?: string;
  };
  lastResponseEvent?: any;
  vederlagTilstand?: any;
}

interface VederlagBridgeReturn {
  cardProps: VederlagEditState;
  formProps: { externalSelections: Record<string, unknown> };
  computed: {
    harPreklusjonsSteg: boolean;
    harRiggKrav: boolean;
    harProduktivitetKrav: boolean;
    prinsipaltResultat: string | undefined;
    subsidiaertResultat: string | undefined;
    visSubsidiaertResultat: boolean;
    totalKrevdBelop: number;
    totalGodkjentBelop: number;
    harMetodeendring: boolean;
    holdTilbake: boolean;
    subsidiaerTriggers: string[];
  };
  validate: () => boolean;
}
```

Portér beregningslogikken fra RespondVederlagModal:
- `beregnPrinsipaltResultat()` — fra modal
- `beregnSubsidiaertResultat()` — fra modal
- Preklusions-flagg per underkrav
- Metode-avhengigheter (EP-justering, hold_tilbake)
- Beløps-beregninger (total krevd, total godkjent, per underkrav)

**Steg 4: Kjør test — forvent PASS**

**Steg 5: Commit**

```
feat: add useVederlagBridge hook for card-form state coordination
```

---

### Task 10: VederlagCard interaktiv modus

Utvid VederlagCard med `editState`-prop. Mer kompleks enn FristCard pga. ekspanderbare underkrav-seksjoner.

**Filer:**
- Endre: `src/components/bento/track-cards/VederlagCard.tsx`
- Test: `src/components/bento/track-cards/__tests__/VederlagCard.test.tsx`

**Steg 1: Skriv test**

```tsx
describe('VederlagCard interactive mode', () => {
  it('shows method accept/reject toggle', () => {
    render(<VederlagCard {...baseProps} editState={editState} />);
    expect(screen.getByText(/Aksepterer metode/)).toBeInTheDocument();
  });

  it('shows hovedkrav vurdering verdictcards', () => {
    render(<VederlagCard {...baseProps} editState={editState} />);
    expect(screen.getByText('Godkjent')).toBeInTheDocument();
    expect(screen.getByText('Avslått')).toBeInTheDocument();
  });

  it('shows godkjent beløp input when vurdering is delvis', () => {
    render(<VederlagCard {...baseProps} editState={{
      ...editState, hovedkravVurdering: 'delvis', showHovedkravGodkjentBelop: true,
    }} />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('shows rigg section when rigg krav exists', () => {
    render(<VederlagCard {...baseProps} editState={{
      ...editState, showRiggVarsletITide: true,
    }} />);
    expect(screen.getByText(/Rigg\/drift/)).toBeInTheDocument();
  });

  it('hides CTA strip in edit mode', () => {
    const { container } = render(<VederlagCard {...baseProps} editState={editState} />);
    expect(container.querySelector('[data-track-cta]')).toBeNull();
  });
});
```

**Steg 2: Kjør test — forvent FAIL**

**Steg 3: Implementer**

VederlagCard interaktiv modus layout:

```
┌──────────────────────────────────┐
│ VEDERLAG §34      [Subsidiært]   │
│ Krevd: 250 000 kr    Metode: EP  │
│──────────────────────────────────│
│ Aksepterer metode?    [✓] [✕]    │
│──────────────────────────────────│
│ HOVEDKRAV                        │
│ Varslet i tide?       [✓] [✕]    │
│ Vurdering                        │
│ [✓ Godkjent][Delvis][✕ Avslått]  │
│ Godkjent: [_______] kr           │
│──────────────────────────────────│
│ ▸ RIGG/DRIFT (+50 000)           │ ← Ekspanderbar
│──────────────────────────────────│
│ ▸ PRODUKTIVITET (+10 000)        │ ← Ekspanderbar
└──────────────────────────────────┘
```

Rigg og produktivitet-seksjonene er ekspanderbare (ChevronDown/Up) for å håndtere kortets tetthet. Hver inneholder sin egen varslet-toggle + vurdering + beløp-input.

Bruk `VerdictCards` med 3 opsjoner (godkjent/delvis/avslått) for vurdering. Bruk `InlineYesNo` for toggles. Bruk `InlineNumberInput` for beløp.

**Steg 4: Kjør test — forvent PASS**

**Steg 5: Commit**

```
feat: add interactive edit mode to VederlagCard with expandable subclaims
```

---

### Task 11: BentoRespondVederlag formpanel

Formpanelet for vederlag card-anchored editing.

**Filer:**
- Opprett: `src/components/bento/BentoRespondVederlag.tsx`
- Test: `src/components/bento/__tests__/BentoRespondVederlag.test.tsx`

**Steg 1: Skriv test**

```tsx
describe('BentoRespondVederlag', () => {
  it('renders begrunnelse editor', () => {
    render(<BentoRespondVederlag {...defaultProps} />);
    expect(screen.getByText(/begrunnelse/i)).toBeInTheDocument();
  });

  it('shows consequence callout', () => {
    render(<BentoRespondVederlag {...defaultProps} externalResultat="godkjent" />);
    expect(screen.getByText(/godkjent/i)).toBeInTheDocument();
  });

  it('shows hold_tilbake consequence', () => {
    render(<BentoRespondVederlag {...defaultProps} externalResultat="hold_tilbake" />);
    expect(screen.getByText(/§30.2/)).toBeInTheDocument();
  });

  it('shows subsidiary summary when relevant', () => {
    render(<BentoRespondVederlag {...defaultProps}
      visSubsidiaertResultat={true}
      subsidiaertResultat="godkjent"
      subsidiaertGodkjentBelop={100000}
    />);
    expect(screen.getByText(/subsidiært/i)).toBeInTheDocument();
  });
});
```

**Steg 2: Kjør test — forvent FAIL**

**Steg 3: Implementer**

```tsx
interface BentoRespondVederlagProps {
  sakId: string;
  vederlagKravId: string;
  // External state from bridge
  externalResultat?: string;
  externalTotalGodkjentBelop?: number;
  externalTotalKrevdBelop?: number;
  // Computed from bridge
  harMetodeendring?: boolean;
  holdTilbake?: boolean;
  erPrekludert?: boolean;
  prinsipaltResultat?: string;
  subsidiaertResultat?: string;
  visSubsidiaertResultat?: boolean;
  subsidiaertGodkjentBelop?: number;
  subsidiaerTriggers?: string[];
  // All form values for submit payload
  formValues?: Record<string, unknown>;
  // Callbacks
  onSuccess: () => void;
  onCancel: () => void;
  onCatendaWarning?: () => void;
  approvalEnabled?: boolean;
  onSaveDraft?: (data: any) => void;
}
```

Innhold:
1. Oppsummering av valgene (kort sammendrag av alle innstillinger i kortet)
2. Konsekvens-callout fra `getVederlagConsequence()`
3. Subsidiær-oppsummering (når relevant)
4. Begrunnelse RichTextEditor med auto-begrunnelse-knapp
5. Vedlegg-seksjon
6. Submit/Avbryt footer

Auto-begrunnelse: Integrer `generateVederlagResponseBegrunnelse()` fra eksisterende verktøy.

**Steg 4: Kjør test — forvent PASS**

**Steg 5: Commit**

```
feat: add BentoRespondVederlag form panel for card-anchored editing
```

---

### Task 12: Wire vederlag card-anchored i CasePageBento

**Filer:**
- Endre: `src/pages/CasePageBento.tsx`
- Endre: `src/components/bento/index.ts`

**Steg 1: Legg til useVederlagBridge**

```tsx
const isVederlagFormOpen = expandedTrack?.track === 'vederlag' &&
  (expandedTrack.action === 'respond' || expandedTrack.action === 'updateResponse');

const vederlagBridge = useVederlagBridge({
  isOpen: isVederlagFormOpen,
  hovedkategori: state.grunnlag.hovedkategori,
  grunnlagStatus: grunnlagStatus,
  grunnlagVarsletForSent: grunnlagVarsletForSent,
  vederlagEvent: {
    metode: state.vederlag.metode,
    belop_direkte: state.vederlag.belop_direkte,
    kostnads_overslag: state.vederlag.kostnads_overslag,
    krever_justert_ep: state.vederlag.krever_justert_ep,
    varslet_for_oppstart: state.vederlag.varslet_for_oppstart,
    saerskilt_krav: state.vederlag.saerskilt_krav,
    dato_oppdaget: state.grunnlag.dato_oppdaget,
    dato_krav_mottatt: vederlagHistorikk.find(e => e.endring_type === 'sendt')?.tidsstempel,
  },
  // ... lastResponseEvent for update mode
});
```

**Steg 2: Endre primaryAction**

Erstatt `modals.respondVederlag.setOpen(true)` med `handleExpandTrack('vederlag', 'respond')`.

**Steg 3: Legg til layout**

```tsx
const isVederlagInline = expandedTrack.track === 'vederlag' &&
  (expandedTrack.action === 'respond' || expandedTrack.action === 'updateResponse');

if (isVederlagInline) {
  return (
    <>
      <div className="col-span-12 md:col-span-5">
        <VederlagCard
          state={state}
          krevdBelop={krevdBelop}
          // ... standard props
          editState={vederlagBridge.cardProps}
        />
      </div>
      <div className="col-span-12 md:col-span-7">
        <BentoRespondVederlag
          sakId={sakId}
          vederlagKravId={`vederlag-${sakId}`}
          {...vederlagBridge.computed}
          formValues={vederlagBridge.cardProps}
          onSuccess={handleCollapseTrack}
          onCancel={handleCollapseTrack}
        />
      </div>
    </>
  );
}
```

**Steg 4: Oppdater barrel export**

**Steg 5: Type-sjekk og tester**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
npx vitest run
```

**Steg 6: Commit**

```
feat: wire vederlag card-anchored editing in CasePageBento
```

---

### Task 13: Visuell verifisering — Vederlag

**Steg 1:** Start dev server: `npm run dev`

**Steg 2:** Naviger til testsak med vederlag sendt (BH-rolle).

**Steg 3:** Verifiser:
- [ ] Klikk "Svar på krav" → VederlagCard transformeres + formpanel åpnes
- [ ] Varslet-i-tide kontroller for hver underkrav
- [ ] Metode aksept/avvisning med alternativt metodevalg
- [ ] Vurdering per underkrav (VerdictCards: godkjent/delvis/avslått)
- [ ] Godkjent beløp-input vises kun for "delvis"
- [ ] Ekspanderbare rigg/produktivitet-seksjoner
- [ ] Konsekvens-callout i formpanelet
- [ ] Auto-begrunnelse genereres
- [ ] Subsidiær oppsummering vises når relevant
- [ ] Submit fungerer korrekt
- [ ] Andre kort (MasterCard, FristCard) vises under

**Steg 4:** Kjør full testsuite

```bash
npm run test
```

**Steg 5:** Commit eventuelle fikser

```
fix: visual polish for vederlag card-anchored editing
```

---

## Verifiseringssjekkliste (etter alle faser)

- [ ] Grunnlag card-anchored fungerer som før (ingen regresjon)
- [ ] Frist card-anchored fungerer med alle varsel-typer
- [ ] Vederlag card-anchored fungerer med alle underkrav-kombinasjoner
- [ ] Klassiske modaler (RespondVederlagModal, RespondFristModal) fungerer fremdeles for klassisk CasePage
- [ ] Alle eksisterende tester passerer
- [ ] Ingen TypeScript-feil
- [ ] Mobil-layout: 1-kolonne, kort først
- [ ] Draft/approval workflow fungerer med nye inline-forms

## Viktige implementeringsnotater

### Hva som IKKE skal endres
- RespondVederlagModal.tsx (klassisk modal)
- RespondFristModal.tsx (klassisk modal)
- RespondGrunnlagForm.tsx (klassisk form)
- Backend events/state-modeller (ingen nye events nødvendig)
- Klassisk CasePage (`/saker/:id`)

### Risikofaktorer
1. **Vederlag-kortets tetthet** — Mange kontroller i kortet. Mitiger med ekspanderbare seksjoner.
2. **State-synkronisering** — Bridge-hooks og useEffect-synk kan gi race conditions. Test grundig.
3. **Auto-begrunnelse** — Eksisterende `generateVederlagResponseBegrunnelse()` forventer form-data i bestemt format. Tilpass.
4. **Update-modus** — Krever pre-fill fra eksisterende respons. Test med reelle update-scenarioer.
