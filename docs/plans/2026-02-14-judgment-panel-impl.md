# Judgment Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign RespondGrunnlagForm from tabbed layout to split-panel "Judgment Panel" with verdict cards, context sidebar, and progressive disclosure.

**Architecture:** Two new leaf components (VerdictCards, ClaimContextPanel) plus a pure-function consequence callout helper. A new `BentoRespondGrunnlag` component is created by copying RespondGrunnlagForm and applying the judgment panel layout. The original RespondGrunnlagForm is left unchanged. No changes to Zod schema, submit logic, form backup, or event types.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, react-hook-form, Radix UI (Tooltip), Vitest

**Design doc:** `docs/plans/2026-02-14-judgment-panel-design.md`

---

### Task 1: VerdictCards component

**Files:**
- Create: `src/components/bento/VerdictCards.tsx`
- Test: `src/components/bento/__tests__/VerdictCards.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/bento/__tests__/VerdictCards.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VerdictCards, type VerdictOption } from '../VerdictCards';

const defaultOptions: VerdictOption[] = [
  { value: 'godkjent', label: 'Godkjent', description: 'Grunnlag for krav anerkjent', icon: 'check', colorScheme: 'green' },
  { value: 'avslatt', label: 'Avslått', description: 'Grunnlag for krav avvist', icon: 'cross', colorScheme: 'red' },
];

describe('VerdictCards', () => {
  it('renders all options as clickable cards', () => {
    render(<VerdictCards value={undefined} onChange={() => {}} options={defaultOptions} />);
    expect(screen.getByText('Godkjent')).toBeInTheDocument();
    expect(screen.getByText('Avslått')).toBeInTheDocument();
    expect(screen.getByText('Grunnlag for krav anerkjent')).toBeInTheDocument();
  });

  it('calls onChange when a card is clicked', () => {
    const onChange = vi.fn();
    render(<VerdictCards value={undefined} onChange={onChange} options={defaultOptions} />);
    fireEvent.click(screen.getByText('Godkjent'));
    expect(onChange).toHaveBeenCalledWith('godkjent');
  });

  it('highlights the selected card and dims others', () => {
    const { container } = render(
      <VerdictCards value="godkjent" onChange={() => {}} options={defaultOptions} />
    );
    const cards = container.querySelectorAll('[data-verdict-card]');
    expect(cards[0]).toHaveAttribute('data-selected', 'true');
    expect(cards[1]).toHaveAttribute('data-selected', 'false');
  });

  it('shows error state when error prop is true', () => {
    const { container } = render(
      <VerdictCards value={undefined} onChange={() => {}} options={defaultOptions} error />
    );
    const wrapper = container.querySelector('[data-verdict-cards]');
    expect(wrapper?.className).toContain('ring-');
  });

  it('renders with three options including frafalt', () => {
    const threeOptions: VerdictOption[] = [
      ...defaultOptions,
      { value: 'frafalt', label: 'Frafalt', description: 'Pålegget frafalles', icon: 'undo', colorScheme: 'gray' },
    ];
    render(<VerdictCards value={undefined} onChange={() => {}} options={threeOptions} />);
    expect(screen.getByText('Frafalt')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/bento/__tests__/VerdictCards.test.tsx`
Expected: FAIL — module not found

**Step 3: Write implementation**

```tsx
// src/components/bento/VerdictCards.tsx
import { clsx } from 'clsx';
import { CheckIcon, Cross2Icon, ResetIcon } from '@radix-ui/react-icons';

export interface VerdictOption {
  value: string;
  label: string;
  description: string;
  icon: 'check' | 'cross' | 'undo';
  colorScheme: 'green' | 'red' | 'gray';
}

interface VerdictCardsProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: VerdictOption[];
  error?: boolean;
}

const iconMap = {
  check: CheckIcon,
  cross: Cross2Icon,
  undo: ResetIcon,
};

const colorStyles = {
  green: {
    selected: 'border-pkt-brand-dark-green-1000 bg-pkt-brand-dark-green-1000/5',
    icon: 'text-pkt-brand-dark-green-1000',
  },
  red: {
    selected: 'border-pkt-brand-red-1000 bg-pkt-brand-red-1000/5',
    icon: 'text-pkt-brand-red-1000',
  },
  gray: {
    selected: 'border-pkt-grays-gray-500 bg-pkt-grays-gray-100',
    icon: 'text-pkt-text-body-subtle',
  },
};

export function VerdictCards({ value, onChange, options, error }: VerdictCardsProps) {
  const hasSelection = value !== undefined;

  return (
    <div
      data-verdict-cards
      className={clsx(
        'grid gap-3',
        options.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
        error && !hasSelection && 'ring-2 ring-pkt-brand-red-1000/30 rounded-lg p-1',
      )}
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        const Icon = iconMap[option.icon];
        const colors = colorStyles[option.colorScheme];

        return (
          <button
            key={option.value}
            type="button"
            data-verdict-card
            data-selected={isSelected ? 'true' : 'false'}
            onClick={() => onChange(option.value)}
            className={clsx(
              'flex flex-col items-start p-4 rounded-lg border-2 text-left',
              'transition-all duration-150 cursor-pointer',
              'hover:scale-[1.01] hover:shadow-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pkt-border-focus',
              isSelected
                ? colors.selected
                : 'border-pkt-border-default bg-pkt-bg-subtle',
              hasSelection && !isSelected && 'opacity-50',
            )}
          >
            <Icon className={clsx('w-5 h-5 mb-2', isSelected ? colors.icon : 'text-pkt-text-body-muted')} />
            <span className={clsx('text-sm font-semibold', isSelected ? 'text-pkt-text-body-dark' : 'text-pkt-text-body-default')}>
              {option.label}
            </span>
            <span className="text-[11px] text-pkt-text-body-subtle mt-1 leading-tight">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/bento/__tests__/VerdictCards.test.tsx`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/components/bento/VerdictCards.tsx src/components/bento/__tests__/VerdictCards.test.tsx
git commit -m "feat: add VerdictCards component for judgment panel"
```

---

### Task 2: ConsequenceCallout helper

Pure function that maps (resultat, erEndring, preklusjon, erForceMajeure, snuoperasjon) → { variant, text }.

**Files:**
- Create: `src/components/bento/consequenceCallout.ts`
- Test: `src/components/bento/__tests__/consequenceCallout.test.ts`

**Step 1: Write the failing test**

```ts
// src/components/bento/__tests__/consequenceCallout.test.ts
import { describe, it, expect } from 'vitest';
import { getConsequence } from '../consequenceCallout';

describe('getConsequence', () => {
  it('returns null when no resultat selected', () => {
    expect(getConsequence({ resultat: undefined })).toBeNull();
  });

  it('returns success for godkjent (non-ENDRING)', () => {
    const result = getConsequence({ resultat: 'godkjent' });
    expect(result?.variant).toBe('success');
    expect(result?.text).toContain('grunnlag for krav');
  });

  it('returns success for godkjent ENDRING varslet i tide', () => {
    const result = getConsequence({ resultat: 'godkjent', erEndringMed32_2: true, varsletITide: true });
    expect(result?.variant).toBe('success');
    expect(result?.text).toContain('varselet ble sendt i tide');
  });

  it('returns success for godkjent ENDRING varslet for sent (subsidiær godkjenning)', () => {
    const result = getConsequence({ resultat: 'godkjent', erEndringMed32_2: true, varsletITide: false });
    expect(result?.variant).toBe('success');
    expect(result?.text).toContain('for sent');
    expect(result?.text).toContain('subsidiært');
  });

  it('returns success for godkjent force majeure', () => {
    const result = getConsequence({ resultat: 'godkjent', erForceMajeure: true });
    expect(result?.variant).toBe('success');
    expect(result?.text).toContain('fristforlengelse');
    expect(result?.text).toContain('ikke vederlag');
  });

  it('returns warning for avslatt (non-ENDRING)', () => {
    const result = getConsequence({ resultat: 'avslatt' });
    expect(result?.variant).toBe('warning');
    expect(result?.text).toContain('omtvistet');
  });

  it('returns warning for avslatt ENDRING varslet i tide', () => {
    const result = getConsequence({ resultat: 'avslatt', erEndringMed32_2: true, varsletITide: true });
    expect(result?.variant).toBe('warning');
    expect(result?.text).toContain('varselet ble sendt i tide');
    expect(result?.text).toContain('subsidiært');
  });

  it('returns danger for avslatt ENDRING varslet for sent (double subsidiary)', () => {
    const result = getConsequence({ resultat: 'avslatt', erEndringMed32_2: true, varsletITide: false });
    expect(result?.variant).toBe('danger');
    expect(result?.text).toContain('preklusjon');
  });

  it('returns warning for avslatt force majeure', () => {
    const result = getConsequence({ resultat: 'avslatt', erForceMajeure: true });
    expect(result?.variant).toBe('warning');
    expect(result?.text).toContain('force majeure');
  });

  it('returns info for frafalt', () => {
    const result = getConsequence({ resultat: 'frafalt' });
    expect(result?.variant).toBe('info');
    expect(result?.text).toContain('frafalles');
  });

  it('appends snuoperasjon text when applicable', () => {
    const result = getConsequence({ resultat: 'godkjent', erSnuoperasjon: true, harSubsidiaereSvar: true });
    expect(result?.snuoperasjonText).toContain('prinsipale');
  });

  it('does not append snuoperasjon text when no subsidiaere svar', () => {
    const result = getConsequence({ resultat: 'godkjent', erSnuoperasjon: true, harSubsidiaereSvar: false });
    expect(result?.snuoperasjonText).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/bento/__tests__/consequenceCallout.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```ts
// src/components/bento/consequenceCallout.ts

interface ConsequenceInput {
  resultat: string | undefined;
  erEndringMed32_2?: boolean;
  varsletITide?: boolean;
  erForceMajeure?: boolean;
  erSnuoperasjon?: boolean;
  harSubsidiaereSvar?: boolean;
}

interface ConsequenceResult {
  variant: 'success' | 'warning' | 'danger' | 'info';
  text: string;
  snuoperasjonText?: string;
}

export function getConsequence(input: ConsequenceInput): ConsequenceResult | null {
  const { resultat, erEndringMed32_2, varsletITide, erForceMajeure, erSnuoperasjon, harSubsidiaereSvar } = input;

  if (!resultat) return null;

  const erPrekludert = erEndringMed32_2 && varsletITide === false;
  const snuoperasjonText = erSnuoperasjon && harSubsidiaereSvar
    ? 'Subsidiaere svar på vederlag og frist konverteres til prinsipale svar.'
    : undefined;

  // ---------- GODKJENT ----------
  if (resultat === 'godkjent') {
    if (erForceMajeure) {
      return {
        variant: 'success',
        text: 'Byggherren anerkjenner force majeure. TE kan ha grunnlag for krav om fristforlengelse — ikke vederlag (§33.3).',
        snuoperasjonText,
      };
    }
    if (erEndringMed32_2 && erPrekludert) {
      return {
        variant: 'success',
        text: 'Byggherren mener varselet ble sendt for sent (§32.2), men anerkjenner subsidiært grunnlag for krav. Preklusjonsstandpunktet gjelder prinsipalt.',
        snuoperasjonText,
      };
    }
    if (erEndringMed32_2 && varsletITide) {
      return {
        variant: 'success',
        text: 'Byggherren godtar at varselet ble sendt i tide, og anerkjenner grunnlag for krav. Vederlag og frist behandles separat.',
        snuoperasjonText,
      };
    }
    return {
      variant: 'success',
      text: 'Byggherren anerkjenner at TE kan ha grunnlag for krav. Vederlag og frist behandles separat.',
      snuoperasjonText,
    };
  }

  // ---------- AVSLÅTT ----------
  if (resultat === 'avslatt') {
    if (erForceMajeure) {
      return {
        variant: 'warning',
        text: 'Byggherren mener forholdet ikke kvalifiserer som force majeure. TE kan likevel sende krav om fristforlengelse.',
      };
    }
    if (erEndringMed32_2 && erPrekludert) {
      return {
        variant: 'danger',
        text: 'Byggherren påberoper §32.2-preklusjon (varslet for sent) og avslår subsidiært grunnlaget. Vederlag og frist behandles dobbelt-subsidiært.',
      };
    }
    if (erEndringMed32_2 && varsletITide) {
      return {
        variant: 'warning',
        text: 'Byggherren godtar at varselet ble sendt i tide, men avslår grunnlaget. Vederlag og frist behandles subsidiært.',
      };
    }
    return {
      variant: 'warning',
      text: 'Saken markeres som omtvistet. TE kan fortsatt sende krav om vederlag og frist, som BH behandler subsidiært.',
    };
  }

  // ---------- FRAFALT ----------
  if (resultat === 'frafalt') {
    return {
      variant: 'info',
      text: 'Pålegget frafalles (§32.3 c). Arbeidet trenger ikke utføres.',
    };
  }

  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/bento/__tests__/consequenceCallout.test.ts`
Expected: PASS (11 tests)

**Step 5: Commit**

```bash
git add src/components/bento/consequenceCallout.ts src/components/bento/__tests__/consequenceCallout.test.ts
git commit -m "feat: add consequence callout logic for judgment panel"
```

---

### Task 3: ClaimContextPanel component

**Files:**
- Create: `src/components/bento/ClaimContextPanel.tsx`
- Test: `src/components/bento/__tests__/ClaimContextPanel.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/bento/__tests__/ClaimContextPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ClaimContextPanel } from '../ClaimContextPanel';

describe('ClaimContextPanel', () => {
  const defaultProps = {
    grunnlagEvent: {
      hovedkategori: 'ENDRING',
      underkategori: 'IRREG',
      beskrivelse: 'Fundamenteringen ble endret fra peler til plate.',
      dato_oppdaget: '2024-01-12',
      dato_varslet: '2024-01-15',
    },
    entries: [],
  };

  it('renders hovedkategori label', () => {
    render(<ClaimContextPanel {...defaultProps} />);
    expect(screen.getByText(/ENDRING/)).toBeInTheDocument();
  });

  it('renders underkategori label', () => {
    render(<ClaimContextPanel {...defaultProps} />);
    expect(screen.getByText(/Irregulær endring/)).toBeInTheDocument();
  });

  it('renders beskrivelse', () => {
    render(<ClaimContextPanel {...defaultProps} />);
    expect(screen.getByText(/Fundamenteringen ble endret/)).toBeInTheDocument();
  });

  it('renders dates', () => {
    render(<ClaimContextPanel {...defaultProps} />);
    expect(screen.getByText('Oppdaget')).toBeInTheDocument();
    expect(screen.getByText('Varslet')).toBeInTheDocument();
  });

  it('renders entitlement info for ENDRING (vederlag + frist)', () => {
    render(<ClaimContextPanel {...defaultProps} />);
    expect(screen.getByText(/Vederlag/)).toBeInTheDocument();
    expect(screen.getByText(/Frist/)).toBeInTheDocument();
  });

  it('renders only frist for FORCE_MAJEURE', () => {
    render(
      <ClaimContextPanel
        grunnlagEvent={{ hovedkategori: 'FORCE_MAJEURE' }}
        entries={[]}
      />
    );
    expect(screen.getByText(/Kun frist/)).toBeInTheDocument();
  });

  it('renders gracefully with minimal data', () => {
    render(<ClaimContextPanel grunnlagEvent={{}} entries={[]} />);
    // Should not crash, just show empty/placeholder state
    expect(screen.getByText(/TE's krav/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/bento/__tests__/ClaimContextPanel.test.tsx`
Expected: FAIL — module not found

**Step 3: Write implementation**

```tsx
// src/components/bento/ClaimContextPanel.tsx
import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { getHovedkategori, getUnderkategoriObj } from '../../constants/categories';
import { formatDateShort } from '../../utils/formatters';
import { TrackHistory } from './track-cards/TrackHistory';
import type { SporHistoryEntry } from '../views/SporHistory';

interface ClaimContextPanelProps {
  grunnlagEvent: {
    hovedkategori?: string;
    underkategori?: string | string[];
    beskrivelse?: string;
    dato_oppdaget?: string;
    dato_varslet?: string;
  };
  entries: SporHistoryEntry[];
}

export function ClaimContextPanel({ grunnlagEvent, entries }: ClaimContextPanelProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const { hovedkategori, underkategori, beskrivelse, dato_oppdaget, dato_varslet } = grunnlagEvent;

  const hkObj = hovedkategori ? getHovedkategori(hovedkategori) : undefined;
  const ukCode = Array.isArray(underkategori) ? underkategori[0] : underkategori;
  const ukObj = ukCode ? getUnderkategoriObj(ukCode) : undefined;

  const hasDates = !!(dato_oppdaget || dato_varslet);

  // Entitlement line
  const entitlementLine = hkObj
    ? hkObj.hjemmel_vederlag
      ? `Vederlag (§${hkObj.hjemmel_vederlag}) + Frist (§${hkObj.hjemmel_frist})`
      : `Kun frist (§${hkObj.hjemmel_frist})`
    : null;

  // Mobile compact header
  const compactLine = [
    hkObj?.kode.replace(/_/g, ' '),
    ukObj?.label?.split('(')[0]?.trim(),
  ].filter(Boolean).join(' · ');

  return (
    <>
      {/* ===== MOBILE: Compact sticky header ===== */}
      <div className="md:hidden sticky top-0 z-10 bg-pkt-bg-card border-b border-pkt-border-subtle -mx-4 px-4 py-2">
        <button
          type="button"
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-pkt-text-body-default uppercase tracking-wide truncate">
              {compactLine || "TE's krav"}
            </p>
            {hasDates && (
              <p className="text-[10px] text-pkt-text-body-muted">
                {dato_oppdaget && formatDateShort(dato_oppdaget)}
                {dato_oppdaget && dato_varslet && ' → '}
                {dato_varslet && formatDateShort(dato_varslet)}
              </p>
            )}
          </div>
          {mobileExpanded ? (
            <ChevronUpIcon className="w-4 h-4 text-pkt-text-body-subtle shrink-0" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-pkt-text-body-subtle shrink-0" />
          )}
        </button>
        {mobileExpanded && (
          <div className="mt-2 pt-2 border-t border-pkt-border-subtle">
            <ContextContent
              hkObj={hkObj}
              ukObj={ukObj}
              beskrivelse={beskrivelse}
              dato_oppdaget={dato_oppdaget}
              dato_varslet={dato_varslet}
              entitlementLine={entitlementLine}
              entries={entries}
            />
          </div>
        )}
      </div>

      {/* ===== DESKTOP: Full sticky panel ===== */}
      <div className="hidden md:block sticky top-4">
        <div className="bg-pkt-bg-subtle/50 rounded-lg p-4">
          <p className="text-[10px] font-medium text-pkt-text-body-muted uppercase tracking-wide mb-3">
            TE's krav
          </p>
          <ContextContent
            hkObj={hkObj}
            ukObj={ukObj}
            beskrivelse={beskrivelse}
            dato_oppdaget={dato_oppdaget}
            dato_varslet={dato_varslet}
            entitlementLine={entitlementLine}
            entries={entries}
          />
        </div>
      </div>
    </>
  );
}

/** Shared content for both mobile-expanded and desktop views */
function ContextContent({
  hkObj,
  ukObj,
  beskrivelse,
  dato_oppdaget,
  dato_varslet,
  entitlementLine,
  entries,
}: {
  hkObj: ReturnType<typeof getHovedkategori>;
  ukObj: ReturnType<typeof getUnderkategoriObj>;
  beskrivelse?: string;
  dato_oppdaget?: string;
  dato_varslet?: string;
  entitlementLine: string | null;
  entries: SporHistoryEntry[];
}) {
  return (
    <div className="space-y-3">
      {/* Category header */}
      {hkObj && (
        <div>
          <p className="text-[11px] font-semibold text-pkt-text-body-default uppercase tracking-wide">
            {hkObj.kode.replace(/_/g, ' ')}
            {ukObj && (
              <span className="text-pkt-text-body-muted font-normal ml-1.5">
                · §{ukObj.hjemmel_basis}
              </span>
            )}
          </p>
          {ukObj && (
            <p className="text-sm text-pkt-text-body-default mt-0.5">
              {ukObj.label.replace(/\s*\(([^)]+)\)\s*$/, ' — $1')}
            </p>
          )}
        </div>
      )}

      {/* Beskrivelse */}
      {beskrivelse && (
        <p className="text-xs text-pkt-text-body-default italic line-clamp-6">
          «{beskrivelse}»
        </p>
      )}

      {/* Entitlement */}
      {entitlementLine && (
        <p className="text-[10px] text-pkt-text-body-muted">
          Gir grunnlag for krav om: {entitlementLine}
        </p>
      )}

      {/* Dates */}
      {(dato_oppdaget || dato_varslet) && (
        <div className="space-y-1">
          {dato_oppdaget && (
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-pkt-text-body-subtle">Oppdaget</span>
              <span className="text-xs font-mono text-pkt-text-body-default">
                {formatDateShort(dato_oppdaget)}
              </span>
            </div>
          )}
          {dato_varslet && (
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-pkt-text-body-subtle">Varslet</span>
              <span className="text-xs font-mono text-pkt-text-body-default">
                {formatDateShort(dato_varslet)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <TrackHistory entries={entries} />
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/bento/__tests__/ClaimContextPanel.test.tsx`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add src/components/bento/ClaimContextPanel.tsx src/components/bento/__tests__/ClaimContextPanel.test.tsx
git commit -m "feat: add ClaimContextPanel for judgment panel context sidebar"
```

---

### Task 4: Update barrel exports (leaf components only)

**Files:**
- Modify: `src/components/bento/index.ts`

**Step 1: Add exports for new leaf components**

Add these lines to `src/components/bento/index.ts`:

```ts
export { VerdictCards, type VerdictOption } from './VerdictCards';
export { ClaimContextPanel } from './ClaimContextPanel';
export { getConsequence } from './consequenceCallout';
```

Note: `BentoRespondGrunnlag` export is added in Task 6 after it's created.

**Step 2: Verify build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to new exports

**Step 3: Commit**

```bash
git add src/components/bento/index.ts
git commit -m "feat: barrel exports for judgment panel components"
```

---

### Task 5: Create BentoRespondGrunnlag (new bento version)

This is the main task. Copy RespondGrunnlagForm to a new file and apply the judgment panel layout. The original is left unchanged.

**Files:**
- Copy from: `src/components/actions/forms/RespondGrunnlagForm.tsx` (720 lines, read-only reference)
- Create: `src/components/bento/BentoRespondGrunnlag.tsx`

**Approach:** Copy the entire RespondGrunnlagForm file, rename the component to `BentoRespondGrunnlag`, then apply these changes:

**Remove these imports:**
- `ExpandableText`, `SectionContainer`, `Tabs` from primitives
- `KontraktsregelInline` from shared
- `BH_GRUNNLAGSVAR_DESCRIPTIONS` from constants

**Add these imports:**
- `Tooltip` from primitives
- `VerdictCards` and `type VerdictOption` from './VerdictCards'
- `ClaimContextPanel` from './ClaimContextPanel'
- `getConsequence` from './consequenceCallout'
- `InfoCircledIcon` from `@radix-ui/react-icons`
- `type SporHistoryEntry` from '../views/SporHistory'

**Remove from component body:**
- `activeTab` state and `tabs` constant
- `handleValidationError` function (no tabs to jump between)

**Add to props interface:**
- `grunnlagEntries?: SporHistoryEntry[]`

**Replace JSX structure** — the form body becomes:

```tsx
<form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
  {/* Update mode: current response banner (stays at top, above grid) */}
  {isUpdateMode && lastResponseEvent && (/* ... same as today ... */)}

  {/* ===== SPLIT PANEL GRID ===== */}
  <div className="grid grid-cols-1 md:grid-cols-12 gap-0 md:gap-6">
    {/* Left: Claim context (col-5) */}
    <div className="md:col-span-5">
      <ClaimContextPanel
        grunnlagEvent={grunnlagEvent ?? {}}
        entries={grunnlagEntries ?? []}
      />
    </div>

    {/* Right: Response panel (col-7) */}
    <div className="md:col-span-7 space-y-5">
      {/* §32.2 Varselvurdering — compact inline */}
      {erEndringMed32_2 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-pkt-text-body-default">
              Varslet i tide? (§32.2)
            </span>
            <Tooltip
              content={/* §32.2/§32.3 lovtekst fra dagens ExpandableText */}
              side="right"
            >
              <button type="button" className="text-pkt-text-body-muted hover:text-pkt-text-body-default">
                <InfoCircledIcon className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
          <Controller
            name="grunnlag_varslet_i_tide"
            control={control}
            render={({ field }) => (
              <RadioGroup
                value={field.value === undefined ? undefined : field.value ? 'ja' : 'nei'}
                onValueChange={(val: string) => field.onChange(val === 'ja')}
              >
                <RadioItem value="ja" label="Ja — varslet uten ugrunnet opphold" />
                <RadioItem value="nei" label="Nei — varslet for sent (preklusjon)" />
              </RadioGroup>
            )}
          />
        </div>
      )}

      {/* Passivitetsvarsel (>10 dager) — kept as alert, important for BH */}
      {erPassiv && (
        <Alert variant="danger" size="sm" title="Passivitetsrisiko (§32.3)">
          Du har brukt <strong>{dagerSidenVarsel} dager</strong> på å svare.
          Passivitet kan medføre at forholdet anses som en endring.
        </Alert>
      )}

      {/* Verdict cards */}
      <div>
        <p className="text-sm font-medium text-pkt-text-body-default mb-2">
          {erGrunnlagPrekludert ? 'Ditt svar (subsidiært)' : 'Ditt svar'}
        </p>
        <Controller
          name="resultat"
          control={control}
          render={({ field }) => (
            <VerdictCards
              value={field.value}
              onChange={field.onChange}
              error={!!errors.resultat}
              options={verdictOptions}
            />
          )}
        />
        {errors.resultat && (
          <p className="text-sm text-pkt-brand-red-1000 mt-1">{errors.resultat.message}</p>
        )}
      </div>

      {/* Consequence callout — single dynamic alert */}
      {consequence && (
        <Alert variant={consequence.variant} size="sm">
          {consequence.text}
          {consequence.snuoperasjonText && (
            <p className="mt-2 font-medium">{consequence.snuoperasjonText}</p>
          )}
        </Alert>
      )}

      {/* Begrunnelse — always visible, no tab switch */}
      <FormField
        label="Byggherrens begrunnelse"
        required
        error={errors.begrunnelse?.message}
      >
        <Controller
          name="begrunnelse"
          control={control}
          render={({ field }) => (
            <RichTextEditor
              id="begrunnelse"
              value={field.value ?? ''}
              onChange={field.onChange}
              minHeight={280}
              fullWidth
              error={!!errors.begrunnelse}
              placeholder={dynamicPlaceholder}
            />
          )}
        />
      </FormField>

      {/* Error */}
      {mutation.isError && (
        <Alert variant="danger" title="Feil ved innsending">
          {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
        </Alert>
      )}

      {/* Footer */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-6 border-t-2 border-pkt-border-subtle">
        {/* ... same footer as today ... */}
      </div>
    </div>
  </div>
</form>
```

**New computed values to add inside the component:**

```tsx
// Verdict card options (filtered like today's RadioGroup)
const verdictOptions = useMemo((): VerdictOption[] => {
  const opts: VerdictOption[] = [
    { value: 'godkjent', label: 'Godkjent', description: 'Grunnlag for krav anerkjent', icon: 'check', colorScheme: 'green' },
    { value: 'avslatt', label: 'Avslått', description: 'Grunnlag for krav avvist', icon: 'cross', colorScheme: 'red' },
  ];
  if (erPaalegg) {
    opts.push({ value: 'frafalt', label: 'Frafalt', description: 'Pålegget frafalles', icon: 'undo', colorScheme: 'gray' });
  }
  return opts;
}, [erPaalegg]);

// Consequence callout (replaces 5-6 conditional alerts)
const consequence = useMemo(() => getConsequence({
  resultat: selectedResultat,
  erEndringMed32_2,
  varsletITide: grunnlagVarsletITide,
  erForceMajeure,
  erSnuoperasjon,
  harSubsidiaereSvar: !!harSubsidiaereSvar,
}), [selectedResultat, erEndringMed32_2, grunnlagVarsletITide, erForceMajeure, erSnuoperasjon, harSubsidiaereSvar]);

// Dynamic placeholder for begrunnelse
const dynamicPlaceholder = useMemo(() => {
  if (!selectedResultat) return 'Velg resultat over for å skrive begrunnelse...';
  if (erGrunnlagPrekludert && selectedResultat === 'godkjent') return 'Begrunn din preklusjonsinnsigelse og din subsidiære godkjenning...';
  if (erGrunnlagPrekludert && selectedResultat === 'avslatt') return 'Begrunn din preklusjonsinnsigelse og ditt subsidiære avslag...';
  if (selectedResultat === 'godkjent') return 'Begrunn din vurdering av ansvarsgrunnlaget...';
  if (selectedResultat === 'avslatt') return 'Forklar hvorfor forholdet ikke gir grunnlag for krav...';
  if (selectedResultat === 'frafalt') return 'Begrunn hvorfor pålegget frafalles...';
  return 'Begrunn din vurdering...';
}, [selectedResultat, erGrunnlagPrekludert]);
```

**Step 3: Run tests and type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Run: `npx vitest run src/components/bento/__tests__/ 2>&1`
Expected: No type errors, existing tests pass

**Step 4: Commit**

```bash
git add src/components/bento/BentoRespondGrunnlag.tsx
git commit -m "feat: add BentoRespondGrunnlag with judgment panel layout"
```

---

### Task 6: Wire BentoRespondGrunnlag into CasePageBento

**Files:**
- Modify: `src/pages/CasePageBento.tsx` (lines ~321-345, ~347-370)
- Modify: `src/components/bento/index.ts`

**Step 1: Add barrel export**

Add to `src/components/bento/index.ts`:

```ts
export { BentoRespondGrunnlag } from './BentoRespondGrunnlag';
```

**Step 2: Replace RespondGrunnlagForm with BentoRespondGrunnlag in CasePageBento**

In `CasePageBento.tsx`, import `BentoRespondGrunnlag` from `../components/bento` and replace the `RespondGrunnlagForm` usage in the `grunnlag:respond` and `grunnlag:updateResponse` switch cases.

Replace `RespondGrunnlagForm` with `BentoRespondGrunnlag` and add `grunnlagEntries={grunnlagEntries}` prop in both cases.

The original `RespondGrunnlagForm` import can stay for any non-bento usage (e.g., if the old CasePage still uses it).

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean

**Step 4: Commit**

```bash
git add src/pages/CasePageBento.tsx src/components/bento/index.ts
git commit -m "feat: wire BentoRespondGrunnlag into CasePageBento"
```

---

### Task 7: Manual visual verification

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Navigate to a test case and verify**

1. Open a case with grunnlag sent (BH role)
2. Click "Svar på krav"
3. Verify: split-panel layout (context left, form right)
4. Verify: verdict cards render correctly, clicking highlights
5. Verify: consequence callout appears after selecting verdict
6. Verify: begrunnelse placeholder changes with verdict selection
7. Verify: mobile viewport collapses to single column with compact header
8. Verify: submit still works correctly

**Step 3: Run full test suite**

Run: `npm run test`
Expected: All tests pass

**Step 4: Final commit (if any fixes needed)**

```bash
git add -u
git commit -m "fix: visual polish for judgment panel"
```
