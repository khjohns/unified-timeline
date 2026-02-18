# TE Frist Card-Anchored Submission — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the full-screen SendFristForm with card-anchored inline editing in FristCard for TE's frist submission, following ADR-003 patterns.

**Architecture:** Domain → Bridge → Component (ADR-003 L14). Pure TS domain logic in `fristSubmissionDomain.ts`, thin React adapter in `useFristSubmissionBridge.ts`, and rendering split between FristCard (controls) and BentoSubmitFrist (begrunnelse editor). Two new bento primitives: InlineSegmentedControl and InlineDatePicker.

**Tech Stack:** React 19, TypeScript 5.8, Vitest, existing bento primitives (InlineYesNo, InlineNumberInput), DatePicker (react-day-picker), Radix UI.

**Design doc:** `docs/plans/2026-02-18-te-frist-card-anchored-design.md`

---

### Task 1: InlineSegmentedControl primitive

**Files:**
- Create: `src/components/bento/InlineSegmentedControl.tsx`
- Test: `src/components/bento/__tests__/InlineSegmentedControl.test.tsx`

**Step 1: Write the test**

```tsx
// src/components/bento/__tests__/InlineSegmentedControl.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { InlineSegmentedControl } from '../InlineSegmentedControl';

const options = [
  { value: 'varsel', label: 'Varsel' },
  { value: 'krav', label: 'Krav' },
];

describe('InlineSegmentedControl', () => {
  it('renders all options', () => {
    render(<InlineSegmentedControl options={options} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('Varsel')).toBeInTheDocument();
    expect(screen.getByText('Krav')).toBeInTheDocument();
  });

  it('highlights selected option', () => {
    render(<InlineSegmentedControl options={options} value="varsel" onChange={vi.fn()} />);
    const varselBtn = screen.getByText('Varsel').closest('button');
    expect(varselBtn?.className).toContain('bg-pkt-brand-dark-green-1000');
  });

  it('calls onChange when option clicked', async () => {
    const onChange = vi.fn();
    render(<InlineSegmentedControl options={options} value={undefined} onChange={onChange} />);
    await userEvent.click(screen.getByText('Krav'));
    expect(onChange).toHaveBeenCalledWith('krav');
  });

  it('does not call onChange when disabled', async () => {
    const onChange = vi.fn();
    render(<InlineSegmentedControl options={options} value={undefined} onChange={onChange} disabled />);
    await userEvent.click(screen.getByText('Krav'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/bento/__tests__/InlineSegmentedControl.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the component**

Follow InlineYesNo pattern (`src/components/bento/InlineYesNo.tsx`). Key differences: N buttons instead of 2, generic string values instead of boolean.

```tsx
// src/components/bento/InlineSegmentedControl.tsx
import { clsx } from 'clsx';

export interface SegmentOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface InlineSegmentedControlProps {
  options: SegmentOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function InlineSegmentedControl({
  options,
  value,
  onChange,
  disabled,
  className,
}: InlineSegmentedControlProps) {
  return (
    <div className={clsx('flex items-center gap-1', className)}>
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const isDisabled = disabled || opt.disabled;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(opt.value)}
            className={clsx(
              'flex-1 px-2 py-1 rounded-md border text-bento-caption font-medium transition-all text-center',
              !isDisabled && 'cursor-pointer',
              isDisabled && 'cursor-not-allowed opacity-40',
              isSelected
                ? 'border-pkt-brand-dark-green-1000 bg-pkt-brand-dark-green-1000/5 text-pkt-brand-dark-green-1000'
                : 'border-pkt-border-default bg-pkt-bg-subtle text-pkt-text-body-default',
              value !== undefined && !isSelected && !isDisabled && 'opacity-50',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 4: Run tests**

Run: `npx vitest run src/components/bento/__tests__/InlineSegmentedControl.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/bento/InlineSegmentedControl.tsx src/components/bento/__tests__/InlineSegmentedControl.test.tsx
git commit -m "feat: add InlineSegmentedControl bento primitive"
```

---

### Task 2: InlineDatePicker primitive

**Files:**
- Create: `src/components/bento/InlineDatePicker.tsx`
- Test: `src/components/bento/__tests__/InlineDatePicker.test.tsx`

**Step 1: Write the test**

```tsx
// src/components/bento/__tests__/InlineDatePicker.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InlineDatePicker } from '../InlineDatePicker';

describe('InlineDatePicker', () => {
  it('renders label', () => {
    render(<InlineDatePicker label="Varseldato" value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('Varseldato')).toBeInTheDocument();
  });

  it('renders date picker input', () => {
    render(<InlineDatePicker label="Dato" value="2026-02-14" onChange={vi.fn()} />);
    // DatePicker renders an input with the formatted date
    expect(screen.getByDisplayValue('14.02.2026')).toBeInTheDocument();
  });

  it('shows error text', () => {
    render(<InlineDatePicker label="Dato" value={undefined} onChange={vi.fn()} error="Dato er påkrevd" />);
    expect(screen.getByText('Dato er påkrevd')).toBeInTheDocument();
  });

  it('shows helper text when no error', () => {
    render(<InlineDatePicker label="Dato" value="2026-02-14" onChange={vi.fn()} helperText="Velg dato" />);
    expect(screen.getByText('Velg dato')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/bento/__tests__/InlineDatePicker.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the component**

Follow InlineNumberInput layout pattern (`src/components/bento/InlineNumberInput.tsx`).
Wraps existing DatePicker (`src/components/primitives/DatePicker.tsx`) with `width="sm"`.

```tsx
// src/components/bento/InlineDatePicker.tsx
import { clsx } from 'clsx';
import { DatePicker } from '../primitives';

export interface InlineDatePickerProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function InlineDatePicker({
  label,
  value,
  onChange,
  helperText,
  error,
  disabled,
  className,
}: InlineDatePickerProps) {
  return (
    <div className={clsx('space-y-1', className)}>
      <div className="flex justify-between items-center">
        <span className="text-bento-caption text-pkt-text-body-subtle">{label}</span>
        <DatePicker
          value={value}
          onChange={onChange}
          error={!!error}
          disabled={disabled}
          width="sm"
        />
      </div>
      {helperText && !error && (
        <p className="text-bento-label text-pkt-text-body-muted text-right">{helperText}</p>
      )}
      {error && (
        <p className="text-bento-label text-pkt-brand-red-1000 text-right">{error}</p>
      )}
    </div>
  );
}
```

**Step 4: Run tests**

Run: `npx vitest run src/components/bento/__tests__/InlineDatePicker.test.tsx`
Expected: PASS (adjust assertions if DatePicker renders differently in test env)

**Step 5: Commit**

```bash
git add src/components/bento/InlineDatePicker.tsx src/components/bento/__tests__/InlineDatePicker.test.tsx
git commit -m "feat: add InlineDatePicker bento primitive"
```

---

### Task 3: fristSubmissionDomain — pure domain logic

**Files:**
- Create: `src/domain/fristSubmissionDomain.ts`
- Test: `src/domain/__tests__/fristSubmissionDomain.test.ts`

**Step 1: Write the tests (L17 — domain tests first)**

```ts
// src/domain/__tests__/fristSubmissionDomain.test.ts
import { describe, it, expect } from 'vitest';
import * as domain from '../fristSubmissionDomain';

describe('fristSubmissionDomain', () => {
  // ── getDefaults ──
  describe('getDefaults', () => {
    it('returns empty state for new submission', () => {
      const state = domain.getDefaults({ scenario: 'new' });
      expect(state.varselType).toBeUndefined();
      expect(state.antallDager).toBe(0);
      expect(state.begrunnelse).toBe('');
      expect(state.tidligereVarslet).toBe(false);
    });

    it('returns spesifisert defaults for spesifisering scenario', () => {
      const state = domain.getDefaults({
        scenario: 'spesifisering',
        existingVarselDato: '2026-02-10',
      });
      expect(state.varselType).toBe('spesifisert');
      expect(state.tidligereVarslet).toBe(true);
      expect(state.varselDato).toBe('2026-02-10');
    });

    it('pre-fills from existing data in edit mode', () => {
      const state = domain.getDefaults({
        scenario: 'edit',
        existing: {
          varsel_type: 'spesifisert',
          antall_dager: 10,
          begrunnelse: 'Test',
          frist_varsel: { dato_sendt: '2026-02-10', metode: ['digital_oversendelse'] },
          ny_sluttdato: '2026-03-01',
        },
      });
      expect(state.varselType).toBe('spesifisert');
      expect(state.antallDager).toBe(10);
      expect(state.begrunnelse).toBe('Test');
      expect(state.varselDato).toBe('2026-02-10');
      expect(state.nySluttdato).toBe('2026-03-01');
    });
  });

  // ── beregnVisibility ──
  describe('beregnVisibility', () => {
    it('shows segmented control for new submission', () => {
      const v = domain.beregnVisibility({ varselType: undefined }, { scenario: 'new' });
      expect(v.showSegmentedControl).toBe(true);
      expect(v.showVarselSection).toBe(false);
      expect(v.showKravSection).toBe(false);
    });

    it('shows varsel section when varsel selected', () => {
      const v = domain.beregnVisibility({ varselType: 'varsel' }, { scenario: 'new' });
      expect(v.showVarselSection).toBe(true);
      expect(v.showKravSection).toBe(false);
    });

    it('shows both sections when spesifisert selected', () => {
      const v = domain.beregnVisibility({ varselType: 'spesifisert' }, { scenario: 'new' });
      expect(v.showVarselSection).toBe(true);
      expect(v.showKravSection).toBe(true);
    });

    it('hides segmented control for spesifisering scenario', () => {
      const v = domain.beregnVisibility({ varselType: 'spesifisert' }, { scenario: 'spesifisering' });
      expect(v.showSegmentedControl).toBe(false);
    });

    it('shows only krav + utsatt for forespørsel scenario', () => {
      const v = domain.beregnVisibility({ varselType: undefined }, { scenario: 'foresporsel' });
      expect(v.showSegmentedControl).toBe(true);
      expect(v.segmentOptions).toEqual([
        { value: 'spesifisert', label: 'Krav' },
        { value: 'begrunnelse_utsatt', label: 'Utsatt beregning' },
      ]);
    });
  });

  // ── beregnPreklusjonsvarsel ──
  describe('beregnPreklusjonsvarsel', () => {
    it('returns null when no dato_oppdaget', () => {
      expect(domain.beregnPreklusjonsvarsel({})).toBeNull();
    });

    it('returns warning after 7 days', () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 8);
      const result = domain.beregnPreklusjonsvarsel({
        datoOppdaget: sevenDaysAgo.toISOString().split('T')[0],
      });
      expect(result?.variant).toBe('warning');
    });

    it('returns danger after 14 days', () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      const result = domain.beregnPreklusjonsvarsel({
        datoOppdaget: fifteenDaysAgo.toISOString().split('T')[0],
      });
      expect(result?.variant).toBe('danger');
    });
  });

  // ── beregnCanSubmit ──
  describe('beregnCanSubmit', () => {
    it('cannot submit without varselType', () => {
      const state = domain.getDefaults({ scenario: 'new' });
      expect(domain.beregnCanSubmit(state, { scenario: 'new' })).toBe(false);
    });

    it('can submit varsel without begrunnelse', () => {
      const state = { ...domain.getDefaults({ scenario: 'new' }), varselType: 'varsel' as const };
      expect(domain.beregnCanSubmit(state, { scenario: 'new' })).toBe(true);
    });

    it('cannot submit spesifisert without begrunnelse', () => {
      const state = {
        ...domain.getDefaults({ scenario: 'new' }),
        varselType: 'spesifisert' as const,
        antallDager: 10,
      };
      expect(domain.beregnCanSubmit(state, { scenario: 'new' })).toBe(false);
    });

    it('can submit spesifisert with begrunnelse >= 10 chars', () => {
      const state = {
        ...domain.getDefaults({ scenario: 'new' }),
        varselType: 'spesifisert' as const,
        antallDager: 10,
        begrunnelse: 'Minst ti tegn her',
      };
      expect(domain.beregnCanSubmit(state, { scenario: 'new' })).toBe(true);
    });

    it('cannot submit spesifisert with 0 days', () => {
      const state = {
        ...domain.getDefaults({ scenario: 'new' }),
        varselType: 'spesifisert' as const,
        antallDager: 0,
        begrunnelse: 'Minst ti tegn her',
      };
      expect(domain.beregnCanSubmit(state, { scenario: 'new' })).toBe(false);
    });
  });

  // ── buildEventData ──
  describe('buildEventData', () => {
    it('builds varsel event data', () => {
      const state = {
        ...domain.getDefaults({ scenario: 'new' }),
        varselType: 'varsel' as const,
        tidligereVarslet: false,
      };
      const data = domain.buildEventData(state, { scenario: 'new', grunnlagEventId: 'g-1' });
      expect(data.varsel_type).toBe('varsel');
      expect(data.antall_dager).toBeUndefined();
      expect(data.frist_varsel?.metode).toContain('digital_oversendelse');
      expect(data.grunnlag_event_id).toBe('g-1');
    });

    it('builds spesifisert event data with days', () => {
      const state = {
        ...domain.getDefaults({ scenario: 'new' }),
        varselType: 'spesifisert' as const,
        antallDager: 14,
        begrunnelse: 'Hindret av regn',
        nySluttdato: '2026-04-01',
        tidligereVarslet: true,
        varselDato: '2026-02-10',
      };
      const data = domain.buildEventData(state, { scenario: 'new', grunnlagEventId: 'g-1' });
      expect(data.varsel_type).toBe('spesifisert');
      expect(data.antall_dager).toBe(14);
      expect(data.begrunnelse).toBe('Hindret av regn');
      expect(data.ny_sluttdato).toBe('2026-04-01');
      expect(data.frist_varsel?.dato_sendt).toBe('2026-02-10');
    });
  });

  // ── getEventType ──
  describe('getEventType', () => {
    it('returns frist_krav_sendt for new submission', () => {
      expect(domain.getEventType({ scenario: 'new' })).toBe('frist_krav_sendt');
    });

    it('returns frist_krav_spesifisert for spesifisering', () => {
      expect(domain.getEventType({ scenario: 'spesifisering' })).toBe('frist_krav_spesifisert');
    });

    it('returns frist_krav_spesifisert for foresporsel', () => {
      expect(domain.getEventType({ scenario: 'foresporsel' })).toBe('frist_krav_spesifisert');
    });

    it('returns frist_krav_oppdatert for edit', () => {
      expect(domain.getEventType({ scenario: 'edit' })).toBe('frist_krav_oppdatert');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/__tests__/fristSubmissionDomain.test.ts`
Expected: FAIL — module not found

**Step 3: Write the domain module**

Reference: `src/domain/fristDomain.ts` for structure. Key difference: TE creates data (dates, days) rather than evaluating existing data (yes/no).

```ts
// src/domain/fristSubmissionDomain.ts
/**
 * fristSubmissionDomain.ts — TE's frist submission logic (NS 8407 §33).
 *
 * Pure TypeScript — no React dependencies. Imported by useFristSubmissionBridge.ts.
 * Ref: ADR-003 L14
 */

import { differenceInDays } from 'date-fns';
import type { FristVarselType } from '../types/timeline';

// ============================================================================
// TYPES
// ============================================================================

export type SubmissionScenario = 'new' | 'spesifisering' | 'foresporsel' | 'edit';

export interface FristSubmissionFormState {
  varselType: FristVarselType | undefined;
  tidligereVarslet: boolean;
  varselDato: string | undefined;
  antallDager: number;
  nySluttdato: string | undefined;
  begrunnelse: string;
  begrunnelseValidationError: string | undefined;
}

export interface FristSubmissionDefaultsConfig {
  scenario: SubmissionScenario;
  existingVarselDato?: string;
  existing?: {
    varsel_type: FristVarselType;
    antall_dager?: number;
    begrunnelse?: string;
    frist_varsel?: { dato_sendt: string; metode: string[] };
    ny_sluttdato?: string;
  };
}

export interface FristSubmissionVisibilityConfig {
  scenario: SubmissionScenario;
}

export interface FristSubmissionVisibility {
  showSegmentedControl: boolean;
  segmentOptions: { value: string; label: string }[];
  showVarselSection: boolean;
  showKravSection: boolean;
  showForesporselAlert: boolean;
  begrunnelseRequired: boolean;
}

export interface FristSubmissionBuildConfig {
  scenario: SubmissionScenario;
  grunnlagEventId: string;
  erSvarPaForesporsel?: boolean;
}

// ============================================================================
// DEFAULTS
// ============================================================================

export function getDefaults(config: FristSubmissionDefaultsConfig): FristSubmissionFormState {
  if (config.scenario === 'edit' && config.existing) {
    return {
      varselType: config.existing.varsel_type,
      tidligereVarslet: !!config.existing.frist_varsel,
      varselDato: config.existing.frist_varsel?.dato_sendt,
      antallDager: config.existing.antall_dager ?? 0,
      nySluttdato: config.existing.ny_sluttdato,
      begrunnelse: config.existing.begrunnelse ?? '',
      begrunnelseValidationError: undefined,
    };
  }

  if (config.scenario === 'spesifisering') {
    return {
      varselType: 'spesifisert',
      tidligereVarslet: true,
      varselDato: config.existingVarselDato,
      antallDager: 0,
      nySluttdato: undefined,
      begrunnelse: '',
      begrunnelseValidationError: undefined,
    };
  }

  return {
    varselType: undefined,
    tidligereVarslet: false,
    varselDato: undefined,
    antallDager: 0,
    nySluttdato: undefined,
    begrunnelse: '',
    begrunnelseValidationError: undefined,
  };
}

// ============================================================================
// VISIBILITY
// ============================================================================

const NEW_SEGMENTS = [
  { value: 'varsel', label: 'Varsel' },
  { value: 'spesifisert', label: 'Krav' },
];

const FORESPORSEL_SEGMENTS = [
  { value: 'spesifisert', label: 'Krav' },
  { value: 'begrunnelse_utsatt', label: 'Utsatt beregning' },
];

export function beregnVisibility(
  state: Pick<FristSubmissionFormState, 'varselType'>,
  config: FristSubmissionVisibilityConfig,
): FristSubmissionVisibility {
  const showSegmentedControl = config.scenario === 'new' || config.scenario === 'foresporsel';
  const segmentOptions = config.scenario === 'foresporsel' ? FORESPORSEL_SEGMENTS : NEW_SEGMENTS;

  const showVarselSection = state.varselType === 'varsel' || state.varselType === 'spesifisert';
  const showKravSection = state.varselType === 'spesifisert';
  const showForesporselAlert = config.scenario === 'foresporsel';
  const begrunnelseRequired = state.varselType === 'spesifisert' || state.varselType === 'begrunnelse_utsatt';

  return {
    showSegmentedControl,
    segmentOptions,
    showVarselSection,
    showKravSection,
    showForesporselAlert,
    begrunnelseRequired,
  };
}

// ============================================================================
// PREKLUSION WARNING
// ============================================================================

export function beregnPreklusjonsvarsel(config: {
  datoOppdaget?: string;
}): { variant: 'warning' | 'danger'; dager: number } | null {
  if (!config.datoOppdaget) return null;
  const dager = differenceInDays(new Date(), new Date(config.datoOppdaget));
  if (dager > 14) return { variant: 'danger', dager };
  if (dager > 7) return { variant: 'warning', dager };
  return null;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function beregnCanSubmit(
  state: FristSubmissionFormState,
  config: FristSubmissionVisibilityConfig,
): boolean {
  if (!state.varselType) return false;

  if (state.varselType === 'varsel') return true;

  if (state.varselType === 'spesifisert') {
    if (state.antallDager <= 0) return false;
    if (state.begrunnelse.length < 10) return false;
    return true;
  }

  if (state.varselType === 'begrunnelse_utsatt') {
    return state.begrunnelse.length >= 10;
  }

  return false;
}

// ============================================================================
// DYNAMIC PLACEHOLDER
// ============================================================================

export function getDynamicPlaceholder(varselType: FristVarselType | undefined): string {
  if (!varselType) return 'Velg kravtype i kortet for å begynne...';
  if (varselType === 'varsel') return 'Beskriv kort hva som forårsaker behovet for fristforlengelse (valgfritt)...';
  if (varselType === 'spesifisert') return 'Begrunn antall dager krevd og den virkning hindringen har hatt for fremdriften (§33.5)...';
  return 'Begrunn hvorfor grunnlaget for å beregne kravet ikke foreligger (§33.6.2 b)...';
}

// ============================================================================
// BUILD EVENT DATA
// ============================================================================

export function buildEventData(
  state: FristSubmissionFormState,
  config: FristSubmissionBuildConfig,
): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];

  // Build frist_varsel (§33.4 notice)
  const fristVarsel = state.tidligereVarslet && state.varselDato
    ? { dato_sendt: state.varselDato, metode: ['digital_oversendelse'] }
    : !state.tidligereVarslet
      ? { dato_sendt: today, metode: ['digital_oversendelse'] }
      : undefined;

  // Build spesifisert_varsel (§33.6.1) — same logic for specified claims
  const spesifisertVarsel = state.varselType === 'spesifisert'
    ? { dato_sendt: today, metode: ['digital_oversendelse'] }
    : undefined;

  return {
    grunnlag_event_id: config.grunnlagEventId,
    varsel_type: state.varselType,
    frist_varsel: fristVarsel,
    spesifisert_varsel: spesifisertVarsel,
    antall_dager: state.varselType === 'spesifisert' ? state.antallDager : undefined,
    begrunnelse: state.begrunnelse || undefined,
    ny_sluttdato: state.nySluttdato || undefined,
    er_svar_pa_foresporsel: config.erSvarPaForesporsel,
  };
}

// ============================================================================
// EVENT TYPE
// ============================================================================

export function getEventType(config: { scenario: SubmissionScenario }): string {
  switch (config.scenario) {
    case 'new': return 'frist_krav_sendt';
    case 'spesifisering': return 'frist_krav_spesifisert';
    case 'foresporsel': return 'frist_krav_spesifisert';
    case 'edit': return 'frist_krav_oppdatert';
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/domain/__tests__/fristSubmissionDomain.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/domain/fristSubmissionDomain.ts src/domain/__tests__/fristSubmissionDomain.test.ts
git commit -m "feat: add fristSubmissionDomain — pure TE frist submission logic"
```

---

### Task 4: useFristSubmissionBridge — React adapter

**Files:**
- Create: `src/hooks/useFristSubmissionBridge.ts`
- Test: `src/hooks/__tests__/useFristSubmissionBridge.test.tsx`

**Step 1: Write the bridge hook**

Follow `src/hooks/useFristBridge.ts` structure exactly. Key differences from BH bridge:
- No auto-begrunnelse (TE writes their own)
- Segmented control state instead of yes/no evaluations
- Different event types per scenario
- Simpler computed values (no resultat/subsidiært)

```ts
// src/hooks/useFristSubmissionBridge.ts
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSubmitEvent } from './useSubmitEvent';
import { useFormBackup } from './useFormBackup';
import { useCatendaStatusHandler } from './useCatendaStatusHandler';
import { useToast } from '../components/primitives';
import * as domain from '../domain/fristSubmissionDomain';
import type { FristVarselType } from '../types/timeline';

// ============================================================================
// TYPES
// ============================================================================

export interface UseFristSubmissionBridgeConfig {
  isOpen: boolean;
  sakId: string;
  grunnlagEventId: string;
  scenario: domain.SubmissionScenario;
  // Context for pre-filling
  existingVarselDato?: string;
  existing?: domain.FristSubmissionDefaultsConfig['existing'];
  // Context for preklusion warning
  datoOppdaget?: string;
  harMottattForesporsel?: boolean;
  // Callbacks
  onSuccess: () => void;
  onCatendaWarning?: () => void;
}

export interface FristTeEditState {
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
  isSubmitting: boolean;
  canSubmit: boolean;
  submitError: string | null;
  submitLabel: string;
  showTokenExpired: boolean;
  onTokenExpiredClose: () => void;
}

export interface FristTeEditorProps {
  begrunnelse: string;
  onBegrunnelseChange: (v: string) => void;
  begrunnelseError: string | undefined;
  placeholder: string;
  required: boolean;
}

export interface FristSubmissionBridgeReturn {
  cardProps: FristTeEditState;
  editorProps: FristTeEditorProps;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFristSubmissionBridge(
  config: UseFristSubmissionBridgeConfig,
): FristSubmissionBridgeReturn {
  const {
    isOpen, sakId, grunnlagEventId, scenario,
    existingVarselDato, existing,
    datoOppdaget, harMottattForesporsel,
    onSuccess, onCatendaWarning,
  } = config;

  const toast = useToast();
  const { handleCatendaStatus } = useCatendaStatusHandler({ onWarning: onCatendaWarning });

  // ========== TOKEN EXPIRED ==========
  const [showTokenExpired, setShowTokenExpired] = useState(false);

  // ========== STATE (L1 — consolidated FormState) ==========
  const getDefaults = useCallback(
    () => domain.getDefaults({ scenario, existingVarselDato, existing }),
    [scenario, existingVarselDato, existing],
  );

  const [formState, setFormState] = useState<domain.FristSubmissionFormState>(getDefaults);

  // ========== FORM BACKUP (L12) ==========
  const backupData = useMemo(
    () => ({ ...formState }),
    [formState],
  );
  const isDirty = formState.varselType !== undefined || formState.begrunnelse.length > 0;
  const { clearBackup, getBackup } = useFormBackup(
    sakId, domain.getEventType({ scenario }), backupData, isDirty,
  );

  // ========== RESET (L2 — state-during-render) ==========
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const restoredBackupRef = useRef(false);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      const defaults = getDefaults();
      const backup = getBackup();
      if (backup && (backup as domain.FristSubmissionFormState).varselType) {
        setFormState(backup as domain.FristSubmissionFormState);
        restoredBackupRef.current = true;
      } else {
        setFormState(defaults);
      }
      setShowTokenExpired(false);
    }
  }

  useEffect(() => {
    if (restoredBackupRef.current) {
      restoredBackupRef.current = false;
      toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
    }
  }, [isOpen, toast]);

  // ========== DOMAIN COMPUTATIONS ==========
  const visibilityConfig = useMemo((): domain.FristSubmissionVisibilityConfig => ({
    scenario,
  }), [scenario]);

  const visibility = useMemo(
    () => domain.beregnVisibility(formState, visibilityConfig),
    [formState, visibilityConfig],
  );

  const preklusjonsvarsel = useMemo(
    () => domain.beregnPreklusjonsvarsel({ datoOppdaget }),
    [datoOppdaget],
  );

  const canSubmitDomain = useMemo(
    () => domain.beregnCanSubmit(formState, visibilityConfig),
    [formState, visibilityConfig],
  );

  // ========== SETTERS (L1) ==========
  const handleVarselTypeChange = useCallback((v: FristVarselType) => {
    setFormState(prev => ({
      ...prev,
      varselType: v,
      // Reset fields when switching type
      ...(v === 'varsel' ? { antallDager: 0, nySluttdato: undefined } : {}),
    }));
  }, []);

  const handleTidligereVarsletChange = useCallback((v: boolean) => {
    setFormState(prev => ({
      ...prev,
      tidligereVarslet: v,
      ...(v === false ? { varselDato: undefined } : {}),
    }));
  }, []);

  const handleVarselDatoChange = useCallback((v: string) => {
    setFormState(prev => ({ ...prev, varselDato: v }));
  }, []);

  const handleAntallDagerChange = useCallback((v: number) => {
    setFormState(prev => ({ ...prev, antallDager: v }));
  }, []);

  const handleNySluttdatoChange = useCallback((v: string | undefined) => {
    setFormState(prev => ({ ...prev, nySluttdato: v }));
  }, []);

  const handleBegrunnelseChange = useCallback((v: string) => {
    setFormState(prev => ({ ...prev, begrunnelse: v, begrunnelseValidationError: undefined }));
  }, []);

  // ========== SUBMIT MUTATION (L12) ==========
  const pendingToastId = useRef<string | null>(null);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: (result) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      clearBackup();
      onSuccess();
      const label = formState.varselType === 'varsel' ? 'Varsel sendt' : 'Fristkrav sendt';
      toast.success(label, 'Kravet ditt er registrert og sendt til byggherre.');
      handleCatendaStatus(result);
    },
    onError: (error) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      }
    },
  });

  // ========== VALIDATE + SUBMIT ==========
  const canSubmit = canSubmitDomain && !mutation.isPending;

  const handleSubmit = useCallback(() => {
    if (visibility.begrunnelseRequired && formState.begrunnelse.length < 10) {
      setFormState(prev => ({
        ...prev,
        begrunnelseValidationError: 'Begrunnelse må være minst 10 tegn',
      }));
      return;
    }

    pendingToastId.current = toast.pending('Sender krav...', 'Vennligst vent.');

    const eventData = domain.buildEventData(formState, {
      scenario,
      grunnlagEventId,
      erSvarPaForesporsel: harMottattForesporsel,
    });

    mutation.mutate({
      eventType: domain.getEventType({ scenario }),
      data: eventData,
    });
  }, [formState, visibility, scenario, grunnlagEventId, harMottattForesporsel, mutation, toast]);

  const submitLabel = (() => {
    if (mutation.isPending) return 'Sender...';
    if (formState.varselType === 'varsel') return 'Send varsel';
    if (scenario === 'foresporsel') return 'Send svar';
    if (scenario === 'edit') return 'Oppdater krav';
    return 'Send krav';
  })();

  // ========== RETURN (L11 — cardProps vs editorProps) ==========
  return {
    cardProps: {
      varselType: formState.varselType,
      onVarselTypeChange: handleVarselTypeChange,
      showSegmentedControl: visibility.showSegmentedControl,
      segmentOptions: visibility.segmentOptions,

      tidligereVarslet: formState.tidligereVarslet,
      onTidligereVarsletChange: handleTidligereVarsletChange,
      varselDato: formState.varselDato,
      onVarselDatoChange: handleVarselDatoChange,
      showVarselSection: visibility.showVarselSection,

      antallDager: formState.antallDager,
      onAntallDagerChange: handleAntallDagerChange,
      nySluttdato: formState.nySluttdato,
      onNySluttdatoChange: handleNySluttdatoChange,
      showKravSection: visibility.showKravSection,

      preklusjonsvarsel,
      showForesporselAlert: visibility.showForesporselAlert,

      onClose: onSuccess,
      onSubmit: handleSubmit,
      isSubmitting: mutation.isPending,
      canSubmit,
      submitError: mutation.isError
        ? (mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod')
        : null,
      submitLabel,
      showTokenExpired,
      onTokenExpiredClose: () => setShowTokenExpired(false),
    },
    editorProps: {
      begrunnelse: formState.begrunnelse,
      onBegrunnelseChange: handleBegrunnelseChange,
      begrunnelseError: formState.begrunnelseValidationError,
      placeholder: domain.getDynamicPlaceholder(formState.varselType),
      required: visibility.begrunnelseRequired,
    },
  };
}
```

**Step 2: Write basic integration test**

```tsx
// src/hooks/__tests__/useFristSubmissionBridge.test.tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/primitives';
import { useFristSubmissionBridge } from '../useFristSubmissionBridge';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

const baseConfig = {
  isOpen: true,
  sakId: 'test-sak',
  grunnlagEventId: 'g-1',
  scenario: 'new' as const,
  onSuccess: vi.fn(),
};

describe('useFristSubmissionBridge', () => {
  it('initializes with empty state for new scenario', () => {
    const { result } = renderHook(() => useFristSubmissionBridge(baseConfig), { wrapper: createWrapper() });
    expect(result.current.cardProps.varselType).toBeUndefined();
    expect(result.current.cardProps.showSegmentedControl).toBe(true);
    expect(result.current.cardProps.canSubmit).toBe(false);
  });

  it('updates varselType and shows correct sections', () => {
    const { result } = renderHook(() => useFristSubmissionBridge(baseConfig), { wrapper: createWrapper() });
    act(() => result.current.cardProps.onVarselTypeChange('spesifisert'));
    expect(result.current.cardProps.varselType).toBe('spesifisert');
    expect(result.current.cardProps.showVarselSection).toBe(true);
    expect(result.current.cardProps.showKravSection).toBe(true);
  });

  it('can submit varsel without begrunnelse', () => {
    const { result } = renderHook(() => useFristSubmissionBridge(baseConfig), { wrapper: createWrapper() });
    act(() => result.current.cardProps.onVarselTypeChange('varsel'));
    expect(result.current.cardProps.canSubmit).toBe(true);
  });

  it('requires begrunnelse for spesifisert', () => {
    const { result } = renderHook(() => useFristSubmissionBridge(baseConfig), { wrapper: createWrapper() });
    act(() => {
      result.current.cardProps.onVarselTypeChange('spesifisert');
      result.current.cardProps.onAntallDagerChange(10);
    });
    expect(result.current.cardProps.canSubmit).toBe(false);
    act(() => result.current.editorProps.onBegrunnelseChange('Minst ti tegn begrunnelse'));
    expect(result.current.cardProps.canSubmit).toBe(true);
  });

  it('resets state when isOpen transitions false → true', () => {
    const { result, rerender } = renderHook(
      (props) => useFristSubmissionBridge(props),
      { initialProps: baseConfig, wrapper: createWrapper() },
    );
    act(() => result.current.cardProps.onVarselTypeChange('varsel'));
    expect(result.current.cardProps.varselType).toBe('varsel');

    rerender({ ...baseConfig, isOpen: false });
    rerender({ ...baseConfig, isOpen: true });
    expect(result.current.cardProps.varselType).toBeUndefined();
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run src/hooks/__tests__/useFristSubmissionBridge.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add src/hooks/useFristSubmissionBridge.ts src/hooks/__tests__/useFristSubmissionBridge.test.tsx
git commit -m "feat: add useFristSubmissionBridge — React adapter for TE frist submission"
```

---

### Task 5: BentoSubmitFrist — formpanel component

**Files:**
- Create: `src/components/bento/BentoSubmitFrist.tsx`

Reference: `src/components/bento/BentoRespondFrist.tsx` (72 lines). Same pattern but uses Textarea instead of RichTextEditor, and no regenerate button (TE writes their own begrunnelse).

**Step 1: Write the component**

```tsx
// src/components/bento/BentoSubmitFrist.tsx
/**
 * BentoSubmitFrist — TE's begrunnelse editor for frist submission.
 *
 * All controls (segmented control, dates, days) live in FristCard.
 * This panel is exclusively a writing surface for begrunnelse.
 *
 * Follows ADR-003: "begrunnelse-feltet er kun det — fullt fokus på skriving."
 */

import { Textarea } from '../primitives';
import type { FristTeEditorProps } from '../../hooks/useFristSubmissionBridge';

export interface BentoSubmitFristProps {
  editorProps: FristTeEditorProps;
}

export function BentoSubmitFrist({ editorProps }: BentoSubmitFristProps) {
  return (
    <div className="bg-pkt-bg-card rounded-lg p-3 h-full flex flex-col">
      <div className="mb-2 bg-bento-frist -mx-3 -mt-3 px-3 pt-3 pb-2 rounded-t-lg">
        <span className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide">
          Begrunnelse
        </span>
        {editorProps.required && (
          <span className="text-pkt-brand-red-1000 ml-1">*</span>
        )}
      </div>
      <Textarea
        id="frist-te-begrunnelse"
        value={editorProps.begrunnelse}
        onChange={(e) => editorProps.onBegrunnelseChange(e.target.value)}
        rows={8}
        fullWidth
        error={!!editorProps.begrunnelseError}
        placeholder={editorProps.placeholder}
        className="flex-1"
      />
      {editorProps.begrunnelseError && (
        <div className="bg-bento-frist -mx-3 -mb-3 px-3 pt-2 pb-3 rounded-b-lg mt-2">
          <p className="text-sm font-medium text-pkt-brand-red-1000" role="alert">
            {editorProps.begrunnelseError}
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/bento/BentoSubmitFrist.tsx
git commit -m "feat: add BentoSubmitFrist — TE begrunnelse editor panel"
```

---

### Task 6: FristCard — add teEditState rendering

**Files:**
- Modify: `src/components/bento/track-cards/FristCard.tsx`

Add `teEditState?: FristTeEditState | null` prop alongside existing `editState` (BH). Render TE controls when `teEditState` is active, following the exact same visual pattern as BH controls (lines 155-377).

**Step 1: Add teEditState prop to FristCardProps**

At `FristCard.tsx:19-33`, add the new prop:

```tsx
import type { FristTeEditState } from '../../../hooks/useFristSubmissionBridge';

interface FristCardProps {
  // ... existing props ...
  editState?: FristEditState | null;
  teEditState?: FristTeEditState | null;  // NEW
  // ...
}
```

**Step 2: Add TE edit mode rendering**

After the existing `editState` block (line 377), add a parallel block for `teEditState`. Uses the same `sectionHeader` helper, same styling patterns, same submit footer.

Key sections to render:
- Forespørsel alert (conditional)
- InlineSegmentedControl for kravtype (conditional)
- §33.4 Varsel section: InlineYesNo ("Tidligere varslet?") + InlineDatePicker
- §33.6.1 Krav section: InlineNumberInput (dager) + InlineDatePicker (sluttdato)
- Preklusjonsvarsel (inline alert)
- Token expired alert
- Submit footer (same pattern as BH: lines 349-374)

The card header should show ring-2 styling when `editState || teEditState`, and the CTA strip should be hidden when either is active.

**Step 3: Run existing tests**

Run: `npx vitest run src/components/bento/__tests__/FristCard.test.tsx` (if exists)
Expected: PASS (existing tests should still pass)

**Step 4: Commit**

```bash
git add src/components/bento/track-cards/FristCard.tsx
git commit -m "feat: add TE edit mode to FristCard with inline controls"
```

---

### Task 7: CasePageBento — wire up bridge and routing

**Files:**
- Modify: `src/pages/CasePageBento.tsx`

**Step 1: Determine submission scenario**

Add logic to derive the scenario from state, near the existing `isFristFormOpen` derivation (line ~328):

```tsx
const isFristTeFormOpen = expandedTrack?.track === 'frist' &&
  ['send', 'update', 'foresporselSvar'].includes(expandedTrack.action);

const fristTeScenario = useMemo((): SubmissionScenario | undefined => {
  if (!isFristTeFormOpen) return undefined;
  if (expandedTrack?.action === 'send') return 'new';
  if (expandedTrack?.action === 'update') return 'edit';
  if (expandedTrack?.action === 'foresporselSvar') return 'foresporsel';
  return undefined;
}, [isFristTeFormOpen, expandedTrack?.action]);
```

**Step 2: Add bridge hook call**

Near the existing `useFristBridge` call (line ~331):

```tsx
const fristSubmissionBridge = useFristSubmissionBridge({
  isOpen: isFristTeFormOpen,
  sakId,
  grunnlagEventId: `grunnlag-${sakId}`,
  scenario: fristTeScenario ?? 'new',
  existingVarselDato: state.frist.frist_varsel?.dato_sendt,
  existing: expandedTrack?.action === 'update' ? {
    varsel_type: state.frist.varsel_type!,
    antall_dager: state.frist.krevd_dager,
    begrunnelse: state.frist.begrunnelse,
    frist_varsel: state.frist.frist_varsel,
    ny_sluttdato: state.frist.ny_sluttdato,
  } : undefined,
  datoOppdaget: state.grunnlag.dato_oppdaget,
  harMottattForesporsel: state.frist.har_bh_foresporsel,
  onSuccess: handleCollapseTrack,
  onCatendaWarning: () => modals.catendaWarning.setOpen(true),
});
```

**Step 3: Replace renderExpandedForm cases**

In `renderExpandedForm()`, replace the `frist:send` case (lines 531-546) and add update/foresporsel cases:

```tsx
case 'frist:send':
case 'frist:update':
case 'frist:foresporselSvar':
  return <BentoSubmitFrist editorProps={fristSubmissionBridge.editorProps} />;
```

**Step 4: Add card-anchored layout for TE**

Add layout block similar to BH frist layout (lines 814-831):

```tsx
{isFristTeFormOpen && (
  <div ref={cardAnchoredRef} className="col-span-12 grid grid-cols-12 gap-2 sm:gap-4 scroll-mt-4">
    <div ref={fristCardRef} className="col-span-12 md:col-span-5 md:order-2 md:self-start">
      <FristCard
        state={state}
        userRole={userRole}
        actions={actions}
        entries={fristEntries}
        teEditState={fristSubmissionBridge.cardProps}
      />
    </div>
    <div className="col-span-12 md:col-span-7 md:order-1 flex flex-col">
      {renderExpandedForm()}
    </div>
  </div>
)}
```

**Step 5: Update frist action buttons**

At line ~730, update the primary action for TE to use card-anchored:

```tsx
if (actions.canSendFrist) return { label: 'Send krav', onClick: () => handleExpandTrack('frist', 'send') };
// Already works — 'frist:send' now routes to BentoSubmitFrist
```

For forespørsel response (line ~731), change from modal to card-anchored:

```tsx
if (actions.canUpdateFrist && state.frist.har_bh_foresporsel) {
  return { label: 'Svar forespørsel', onClick: () => handleExpandTrack('frist', 'foresporselSvar') };
}
```

**Step 6: Run full test suite**

Run: `npm run test`
Expected: PASS

**Step 7: Commit**

```bash
git add src/pages/CasePageBento.tsx
git commit -m "feat: wire TE frist card-anchored submission in CasePageBento"
```

---

### Task 8: Manual smoke test and polish

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test each scenario**

1. **Ny innsending:** Open a sak as TE → "Send krav" on frist → verify segmented control shows, sections appear progressively
2. **Varsel-modus:** Select "Varsel" → verify only §33.4 section shows → submit without begrunnelse
3. **Krav-modus:** Select "Krav" → verify both §33.4 and §33.6.1 sections → requires begrunnelse
4. **Spesifisering:** After sending varsel, "Send krav" → segmented control hidden, locked to Krav
5. **Redigering:** After sending krav, "Oppdater" → pre-filled with existing data
6. **Mobil:** Resize to mobile → verify kort øverst, form under

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: polish TE frist card-anchored submission after smoke test"
```

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/bento/InlineSegmentedControl.tsx` | Create | Pill-tabs primitive for kravtype |
| `src/components/bento/InlineDatePicker.tsx` | Create | Compact date picker primitive |
| `src/domain/fristSubmissionDomain.ts` | Create | Pure TS domain logic for TE frist |
| `src/hooks/useFristSubmissionBridge.ts` | Create | React adapter (bridge hook) |
| `src/components/bento/BentoSubmitFrist.tsx` | Create | Formpanel (begrunnelse editor) |
| `src/components/bento/track-cards/FristCard.tsx` | Modify | Add `teEditState` prop + TE controls |
| `src/pages/CasePageBento.tsx` | Modify | Wire bridge, routing, layout |
| Tests for each new file | Create | Unit + integration tests |
