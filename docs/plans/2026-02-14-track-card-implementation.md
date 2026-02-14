# Track Card Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 4-dot stepper track cards with KPI-first growing cards that have status-colored top accent, inline history, and hybrid CTA strips.

**Architecture:** Three standalone card components (`GrunnlagCard`, `VederlagCard`, `FristCard`) built from scratch — no `BentoDashboardCard` wrapper. Shared utilities (`getAccentBorder`, `StatusDot`, `TrackCTA`, `TrackHistory`) are extracted into `src/components/bento/track-cards/`. The old `TrackStepper` component is removed from the card rendering but not deleted (may be used elsewhere).

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS v4 (Punkt design system), Radix UI icons, clsx.

**Design doc:** `docs/plans/2026-02-14-track-card-redesign.md`

---

### Task 1: Shared utilities — accent border + status dot

**Files:**
- Create: `src/components/bento/track-cards/trackCardUtils.ts`
- Test: `src/components/bento/track-cards/__tests__/trackCardUtils.test.ts`

**Step 1: Write the failing test**

```typescript
// src/components/bento/track-cards/__tests__/trackCardUtils.test.ts
import { describe, it, expect } from 'vitest';
import { getAccentBorderClass, getStatusDotClass, getStatusLabel } from '../trackCardUtils';

describe('getAccentBorderClass', () => {
  it('returns gray for utkast', () => {
    expect(getAccentBorderClass('utkast')).toBe('border-t-pkt-grays-gray-400');
  });
  it('returns blue for sendt', () => {
    expect(getAccentBorderClass('sendt')).toBe('border-t-pkt-brand-warm-blue-1000');
  });
  it('returns blue for under_behandling', () => {
    expect(getAccentBorderClass('under_behandling')).toBe('border-t-pkt-brand-warm-blue-1000');
  });
  it('returns green for godkjent', () => {
    expect(getAccentBorderClass('godkjent')).toBe('border-t-pkt-brand-dark-green-1000');
  });
  it('returns amber for delvis_godkjent', () => {
    expect(getAccentBorderClass('delvis_godkjent')).toBe('border-t-pkt-brand-yellow-1000');
  });
  it('returns red for avslatt', () => {
    expect(getAccentBorderClass('avslatt')).toBe('border-t-pkt-brand-red-1000');
  });
  it('returns amber for under_forhandling', () => {
    expect(getAccentBorderClass('under_forhandling')).toBe('border-t-pkt-brand-yellow-1000');
  });
  it('returns gray for trukket', () => {
    expect(getAccentBorderClass('trukket')).toBe('border-t-pkt-grays-gray-400');
  });
  it('returns gray for ikke_relevant', () => {
    expect(getAccentBorderClass('ikke_relevant')).toBe('border-t-pkt-grays-gray-300');
  });
});

describe('getStatusDotClass', () => {
  it('returns green dot for godkjent', () => {
    expect(getStatusDotClass('godkjent')).toBe('bg-pkt-brand-dark-green-1000');
  });
  it('returns red dot for avslatt', () => {
    expect(getStatusDotClass('avslatt')).toBe('bg-pkt-brand-red-1000');
  });
  it('returns gray for utkast (open circle)', () => {
    expect(getStatusDotClass('utkast')).toBe('bg-pkt-grays-gray-400');
  });
});

describe('getStatusLabel', () => {
  it('returns Norwegian label', () => {
    expect(getStatusLabel('under_behandling')).toBe('Under behandling');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/bento/track-cards/__tests__/trackCardUtils.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/components/bento/track-cards/trackCardUtils.ts
import type { SporStatus } from '../../../types/timeline';
import { getSporStatusStyle } from '../../../constants/statusStyles';

const ACCENT_MAP: Record<SporStatus, string> = {
  ikke_relevant: 'border-t-pkt-grays-gray-300',
  utkast: 'border-t-pkt-grays-gray-400',
  sendt: 'border-t-pkt-brand-warm-blue-1000',
  under_behandling: 'border-t-pkt-brand-warm-blue-1000',
  godkjent: 'border-t-pkt-brand-dark-green-1000',
  delvis_godkjent: 'border-t-pkt-brand-yellow-1000',
  avslatt: 'border-t-pkt-brand-red-1000',
  under_forhandling: 'border-t-pkt-brand-yellow-1000',
  trukket: 'border-t-pkt-grays-gray-400',
  laast: 'border-t-pkt-brand-dark-green-1000',
};

const DOT_MAP: Record<SporStatus, string> = {
  ikke_relevant: 'bg-pkt-grays-gray-300',
  utkast: 'bg-pkt-grays-gray-400',
  sendt: 'bg-pkt-brand-warm-blue-1000',
  under_behandling: 'bg-pkt-brand-warm-blue-1000',
  godkjent: 'bg-pkt-brand-dark-green-1000',
  delvis_godkjent: 'bg-pkt-brand-yellow-1000',
  avslatt: 'bg-pkt-brand-red-1000',
  under_forhandling: 'bg-pkt-brand-yellow-1000',
  trukket: 'bg-pkt-grays-gray-400',
  laast: 'bg-pkt-brand-dark-green-1000',
};

export function getAccentBorderClass(status: SporStatus): string {
  return ACCENT_MAP[status] ?? 'border-t-pkt-grays-gray-300';
}

export function getStatusDotClass(status: SporStatus): string {
  return DOT_MAP[status] ?? 'bg-pkt-grays-gray-300';
}

export function getStatusLabel(status: SporStatus): string {
  return getSporStatusStyle(status).label;
}

/** Approval grade color: >=70% green, 40-69% amber, <40% red */
export function getGradColor(grad: number): string {
  if (grad >= 70) return 'text-pkt-brand-dark-green-1000';
  if (grad >= 40) return 'text-pkt-brand-yellow-1000';
  return 'text-pkt-brand-red-1000';
}

/** Whether the status represents a resolved/terminal state */
export function isResolved(status: SporStatus): boolean {
  return status === 'godkjent' || status === 'laast' || status === 'trukket';
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/bento/track-cards/__tests__/trackCardUtils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/bento/track-cards/
git commit -m "feat: add track card utility functions (accent border, status dot, grad color)"
```

---

### Task 2: StatusDot component

**Files:**
- Create: `src/components/bento/track-cards/StatusDot.tsx`

**Step 1: Write the component**

```tsx
// src/components/bento/track-cards/StatusDot.tsx
import { clsx } from 'clsx';
import type { SporStatus } from '../../../types/timeline';
import { getStatusDotClass, getStatusLabel } from './trackCardUtils';

interface StatusDotProps {
  status: SporStatus;
  className?: string;
}

/**
 * Colored dot + text label indicating track status.
 * Replaces the 4-dot TrackStepper.
 */
export function StatusDot({ status, className }: StatusDotProps) {
  const isOpen = status === 'utkast' || status === 'ikke_relevant';
  const label = getStatusLabel(status);

  return (
    <div className={clsx('flex items-center gap-1.5', className)}>
      <div
        className={clsx(
          'w-2 h-2 rounded-full shrink-0',
          isOpen ? 'border border-pkt-grays-gray-400' : getStatusDotClass(status),
        )}
      />
      <span className="text-[11px] font-medium text-pkt-text-body-subtle leading-none">
        {label}
      </span>
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to StatusDot

**Step 3: Commit**

```bash
git add src/components/bento/track-cards/StatusDot.tsx
git commit -m "feat: add StatusDot component replacing TrackStepper"
```

---

### Task 3: TrackHistory component

**Files:**
- Create: `src/components/bento/track-cards/TrackHistory.tsx`

This is a simplified inline history list. It reuses `SporHistoryEntry` from `SporHistory.tsx` as data type.

**Step 1: Write the component**

```tsx
// src/components/bento/track-cards/TrackHistory.tsx
import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import type { SporHistoryEntry } from '../../views/SporHistory';

interface TrackHistoryProps {
  entries: SporHistoryEntry[];
  className?: string;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

const MAX_VISIBLE = 5;

export function TrackHistory({ entries, className }: TrackHistoryProps) {
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;

  const label = entries.length === 1 ? '1 hendelse' : `${entries.length} hendelser`;
  const visible = open ? entries.slice(0, MAX_VISIBLE) : [];
  const hasMore = entries.length > MAX_VISIBLE;

  return (
    <div className={clsx('mt-2', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] text-pkt-text-body-subtle hover:text-pkt-text-body-default transition-colors"
      >
        {open ? (
          <ChevronUpIcon className="w-3 h-3" />
        ) : (
          <ChevronDownIcon className="w-3 h-3" />
        )}
        {label}
      </button>

      {open && (
        <div className="bg-pkt-bg-subtle/30 rounded-sm p-2 mt-1 space-y-1 animate-in slide-in-from-top-1 duration-200">
          {visible.map((entry) => (
            <div key={entry.id} className="flex items-baseline gap-2">
              <span className="text-[10px] font-mono text-pkt-text-body-muted tabular-nums shrink-0">
                {formatShortDate(entry.tidsstempel)}
              </span>
              <span className="text-[11px] text-pkt-text-body-default truncate">
                {entry.sammendrag}
              </span>
              <span
                className={clsx(
                  'text-[9px] font-medium uppercase shrink-0 px-1 py-0.5 rounded-sm',
                  entry.aktorRolle === 'BH'
                    ? 'bg-pkt-brand-warm-blue-1000/10 text-pkt-brand-warm-blue-1000'
                    : 'bg-pkt-grays-gray-100 text-pkt-text-body-subtle',
                )}
              >
                {entry.aktorRolle}
              </span>
            </div>
          ))}
          {hasMore && (
            <button
              type="button"
              className="text-[11px] text-pkt-brand-warm-blue-1000 hover:underline mt-1"
              onClick={() => {/* could expand further or open modal */}}
            >
              Vis alle {entries.length} hendelser
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/bento/track-cards/TrackHistory.tsx
git commit -m "feat: add TrackHistory inline collapsible history"
```

---

### Task 4: TrackCTA component

**Files:**
- Create: `src/components/bento/track-cards/TrackCTA.tsx`

The CTA strip at the bottom of each card. Uses the existing `TrackNextStep` logic
(via `generateStatusAlert`) for determining text, plus action callbacks for overflow menu.

**Step 1: Write the component**

```tsx
// src/components/bento/track-cards/TrackCTA.tsx
import { useMemo } from 'react';
import { ArrowRightIcon, CheckIcon, DotsHorizontalIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import { DropdownMenu } from '../../primitives';
import type { SakState, SporType, SporStatus } from '../../../types/timeline';
import type { AvailableActions } from '../../../hooks/useActionPermissions';
import { generateStatusAlert } from '../../StatusAlert/statusAlertGenerator';
import { isResolved } from './trackCardUtils';

interface TrackCTAAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface TrackCTAProps {
  spor: SporType;
  status: SporStatus;
  state: SakState;
  userRole: 'TE' | 'BH';
  actions: AvailableActions;
  primaryAction?: { label: string; onClick: () => void };
  secondaryActions?: TrackCTAAction[];
  className?: string;
}

export function TrackCTA({
  spor,
  status,
  state,
  userRole,
  actions,
  primaryAction,
  secondaryActions = [],
  className,
}: TrackCTAProps) {
  // Use the status alert system to determine what the CTA text should be
  const hint = useMemo(() => {
    const alert = generateStatusAlert(state, userRole, actions);
    if (!alert || alert.relatedSpor !== spor) return null;
    return alert;
  }, [state, userRole, actions, spor]);

  const resolved = isResolved(status);

  // Determine primary CTA display
  let ctaText: string;
  let ctaClickable: boolean;
  let showArrow: boolean;

  if (resolved) {
    ctaText = 'Avgjort';
    ctaClickable = false;
    showArrow = false;
  } else if (primaryAction) {
    ctaText = primaryAction.label;
    ctaClickable = true;
    showArrow = true;
  } else if (hint) {
    ctaText = hint.title;
    ctaClickable = hint.type === 'action';
    showArrow = hint.type === 'action';
  } else {
    // Passive waiting state
    ctaText = 'Venter på svar';
    ctaClickable = false;
    showArrow = false;
  }

  const hasOverflow = secondaryActions.length > 0;

  return (
    <div
      className={clsx(
        'mt-2 pt-2 border-t border-pkt-border-subtle',
        'flex items-center justify-between',
        'bg-pkt-bg-subtle/50 -mx-3 -mb-3 px-3 py-2 rounded-b-lg',
        className,
      )}
    >
      {/* Primary CTA */}
      {ctaClickable && primaryAction ? (
        <button
          type="button"
          onClick={primaryAction.onClick}
          className="flex items-center gap-1.5 text-xs font-semibold text-pkt-brand-warm-blue-1000 hover:text-pkt-brand-dark-blue-1000 transition-colors"
        >
          {showArrow && <ArrowRightIcon className="w-3.5 h-3.5" />}
          {ctaText}
        </button>
      ) : (
        <span
          className={clsx(
            'flex items-center gap-1.5 text-xs',
            resolved
              ? 'text-pkt-text-body-muted font-medium'
              : 'text-pkt-text-body-subtle',
          )}
        >
          {resolved && <CheckIcon className="w-3 h-3" />}
          {ctaText}
        </span>
      )}

      {/* Overflow menu */}
      {hasOverflow && (
        <DropdownMenu
          trigger={
            <button
              type="button"
              className="p-1 rounded-md text-pkt-text-body-subtle hover:text-pkt-text-body-default hover:bg-pkt-bg-subtle transition-colors"
              aria-label="Flere handlinger"
            >
              <DotsHorizontalIcon className="w-4 h-4" />
            </button>
          }
          items={secondaryActions.map((a) => ({
            label: a.label,
            onClick: a.onClick,
            variant: a.variant,
          }))}
        />
      )}
    </div>
  );
}
```

**Note:** The `DropdownMenu` component may need to be created or adapted from existing primitives. Check `src/components/primitives/` for existing dropdown implementations. If `DropdownMenu` doesn't exist, use Radix `DropdownMenu` directly with the `DropdownMenuItem` already imported in CasePageBento.

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors (or address DropdownMenu import)

**Step 3: Commit**

```bash
git add src/components/bento/track-cards/TrackCTA.tsx
git commit -m "feat: add TrackCTA hybrid action strip"
```

---

### Task 5: GrunnlagCard component

**Files:**
- Create: `src/components/bento/track-cards/GrunnlagCard.tsx`

**Step 1: Write the component**

The Grunnlag card's hero is the category name. It grows through stages:
empty -> category + date -> varslet date -> BH response section.

```tsx
// src/components/bento/track-cards/GrunnlagCard.tsx
import { clsx } from 'clsx';
import { CheckIcon, Cross2Icon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import type { SakState, SporType } from '../../../types/timeline';
import type { AvailableActions } from '../../../hooks/useActionPermissions';
import { CategoryLabel } from '../../shared/CategoryLabel';
import { formatDateShort } from '../../../utils/formatters';
import { getAccentBorderClass } from './trackCardUtils';
import { StatusDot } from './StatusDot';
import { TrackHistory } from './TrackHistory';
import { TrackCTA } from './TrackCTA';
import type { SporHistoryEntry } from '../../views/SporHistory';

interface GrunnlagCardProps {
  state: SakState;
  userRole: 'TE' | 'BH';
  actions: AvailableActions;
  entries: SporHistoryEntry[];
  primaryAction?: { label: string; onClick: () => void };
  secondaryActions?: { label: string; onClick: () => void; variant?: 'default' | 'danger' }[];
  className?: string;
  style?: React.CSSProperties;
}

export function GrunnlagCard({
  state,
  userRole,
  actions,
  entries,
  primaryAction,
  secondaryActions,
  className,
  style,
}: GrunnlagCardProps) {
  const g = state.grunnlag;
  const status = g.status;
  const hasCategory = !!g.hovedkategori;
  const hasDates = !!(g.dato_oppdaget || g.grunnlag_varsel?.dato_sendt);
  const hasBhResponse = !!g.bh_resultat;
  const isEmpty = !hasCategory && !hasDates && status === 'utkast';

  return (
    <div
      className={clsx(
        'bg-pkt-bg-card rounded-lg border-t-2 p-3',
        getAccentBorderClass(status),
        className,
      )}
      style={style}
    >
      {/* Header: label + hjemmel + status dot */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Ansvarsgrunnlag
          </span>
          <span className="text-[10px] text-pkt-text-body-muted">
            §25.2
          </span>
        </div>
        <StatusDot status={status} />
      </div>

      {/* Hero zone: category */}
      {isEmpty ? (
        <p className="text-xs text-pkt-text-body-muted italic">Ingen data ennå</p>
      ) : (
        <>
          {hasCategory && (
            <CategoryLabel
              hovedkategori={g.hovedkategori!}
              underkategori={
                Array.isArray(g.underkategori) ? g.underkategori[0] : g.underkategori
              }
            />
          )}

          {/* Dates (label-value pairs) */}
          {hasDates && (
            <div className="mt-2 space-y-1.5">
              {g.dato_oppdaget && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-pkt-text-body-subtle">Oppdaget</span>
                  <span className="text-xs font-mono text-pkt-text-body-default">
                    {formatDateShort(g.dato_oppdaget)}
                  </span>
                </div>
              )}
              {g.grunnlag_varsel?.dato_sendt && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-pkt-text-body-subtle">Varslet</span>
                  <span
                    className={clsx(
                      'text-xs font-mono',
                      g.grunnlag_varslet_i_tide === false
                        ? 'font-semibold text-pkt-brand-red-1000'
                        : 'text-pkt-text-body-default',
                    )}
                  >
                    {formatDateShort(g.grunnlag_varsel.dato_sendt)}
                    {g.grunnlag_varslet_i_tide === false && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-pkt-brand-red-1000">
                        <ExclamationTriangleIcon className="w-3 h-3" />
                        <span className="text-[10px]">§32.2</span>
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* BH response section (grows in when BH responds) */}
          {hasBhResponse && (
            <div className="mt-2 pt-2 border-t border-pkt-border-subtle">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">BH resultat</span>
                <span
                  className={clsx(
                    'text-xs font-semibold flex items-center gap-1',
                    g.bh_resultat === 'godkjent' && 'text-pkt-brand-dark-green-1000',
                    g.bh_resultat === 'avslatt' && 'text-pkt-brand-red-1000',
                    g.bh_resultat === 'frafalt' && 'text-pkt-text-body-muted',
                  )}
                >
                  {g.bh_resultat === 'godkjent' ? 'Godkjent' : g.bh_resultat === 'avslatt' ? 'Avslått' : 'Frafalt'}
                  {g.bh_resultat === 'godkjent' && <CheckIcon className="w-3.5 h-3.5" />}
                  {g.bh_resultat === 'avslatt' && <Cross2Icon className="w-3.5 h-3.5" />}
                </span>
              </div>
              {g.bh_resultat === 'avslatt' && g.bh_begrunnelse && (
                <p className="text-[11px] text-pkt-text-body-muted mt-1 truncate" title={g.bh_begrunnelse}>
                  {g.bh_begrunnelse}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* History */}
      <TrackHistory entries={entries} />

      {/* CTA strip */}
      <TrackCTA
        spor="grunnlag"
        status={status}
        state={state}
        userRole={userRole}
        actions={actions}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/bento/track-cards/GrunnlagCard.tsx
git commit -m "feat: add GrunnlagCard with growing card pattern"
```

---

### Task 6: VederlagCard component

**Files:**
- Create: `src/components/bento/track-cards/VederlagCard.tsx`

**Step 1: Write the component**

The Vederlag card's hero is the krevd amount. It transforms to a 3-column KPI row
when BH responds. When resolved, hero becomes the godkjent amount in green.

```tsx
// src/components/bento/track-cards/VederlagCard.tsx
import { clsx } from 'clsx';
import { CheckIcon } from '@radix-ui/react-icons';
import type { SakState } from '../../../types/timeline';
import type { AvailableActions } from '../../../hooks/useActionPermissions';
import { formatCurrencyCompact } from '../../../utils/formatters';
import { getVederlagsmetodeShortLabel } from '../../../constants/paymentMethods';
import { getAccentBorderClass, getGradColor, isResolved } from './trackCardUtils';
import { StatusDot } from './StatusDot';
import { TrackHistory } from './TrackHistory';
import { TrackCTA } from './TrackCTA';
import type { SporHistoryEntry } from '../../views/SporHistory';

interface VederlagCardProps {
  state: SakState;
  krevdBelop?: number;
  godkjentBelop?: number;
  vederlagGrad?: number;
  isSubsidiary?: boolean;
  isDimmed?: boolean;
  userRole: 'TE' | 'BH';
  actions: AvailableActions;
  entries: SporHistoryEntry[];
  primaryAction?: { label: string; onClick: () => void };
  secondaryActions?: { label: string; onClick: () => void; variant?: 'default' | 'danger' }[];
  className?: string;
  style?: React.CSSProperties;
}

export function VederlagCard({
  state,
  krevdBelop,
  godkjentBelop,
  vederlagGrad,
  isSubsidiary,
  isDimmed,
  userRole,
  actions,
  entries,
  primaryAction,
  secondaryActions,
  className,
  style,
}: VederlagCardProps) {
  const v = state.vederlag;
  const status = v.status;
  const hasBhResponse = !!v.bh_resultat;
  const resolved = isResolved(status) || v.te_akseptert === true;
  const isEmpty = krevdBelop == null && !v.metode;

  // Dimmed state: grunnlag not sent
  if (isDimmed) {
    return (
      <div
        className={clsx(
          'bg-pkt-bg-card rounded-lg border-t-2 p-3 opacity-60',
          'border-t-pkt-grays-gray-300',
          className,
        )}
        style={style}
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Vederlag
          </span>
          <span className="text-[10px] text-pkt-text-body-muted">§34</span>
        </div>
        <p className="text-xs text-pkt-text-body-muted italic mt-2">Krever ansvarsgrunnlag</p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-pkt-bg-card rounded-lg border-t-2 p-3',
        getAccentBorderClass(status),
        className,
      )}
      style={style}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Vederlag
          </span>
          <span className="text-[10px] text-pkt-text-body-muted">§34</span>
          {isSubsidiary && (
            <span className="bg-badge-warning-bg text-badge-warning-text rounded-sm text-[10px] px-1.5 py-0.5 font-medium ml-1">
              Subsidiært
            </span>
          )}
        </div>
        <StatusDot status={status} />
      </div>

      {/* Hero zone */}
      {isEmpty ? (
        <p className="text-xs text-pkt-text-body-muted italic">Ingen data ennå</p>
      ) : hasBhResponse && godkjentBelop != null && !resolved ? (
        /* Stage 4: KPI row (BH has responded, not yet resolved) */
        <div>
          <div className="flex items-baseline gap-4">
            <div>
              <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">Krevd</span>
              <p className="text-sm font-semibold font-mono tabular-nums text-pkt-brand-yellow-1000">
                {formatCurrencyCompact(krevdBelop!)}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">
                {isSubsidiary ? 'Subs.' : 'Godkjent'}
              </span>
              <p className="text-sm font-semibold font-mono tabular-nums text-pkt-brand-dark-green-1000">
                {formatCurrencyCompact(godkjentBelop)}
              </p>
            </div>
            {vederlagGrad != null && (
              <div className="ml-auto text-right">
                <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">Grad</span>
                <p className={clsx('text-sm font-bold font-mono tabular-nums', getGradColor(vederlagGrad))}>
                  {vederlagGrad}%
                </p>
              </div>
            )}
          </div>
          {vederlagGrad != null && (
            <div className="mt-1.5 h-1.5 bg-pkt-grays-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-pkt-brand-dark-green-1000 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(vederlagGrad, 100)}%` }}
              />
            </div>
          )}
        </div>
      ) : resolved && godkjentBelop != null ? (
        /* Stage 5: Resolved — hero is godkjent amount in green */
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-lg font-bold font-mono tabular-nums text-pkt-brand-dark-green-1000">
              {formatCurrencyCompact(godkjentBelop)}
            </p>
            <CheckIcon className="w-4 h-4 text-pkt-brand-dark-green-1000" />
          </div>
          {v.metode && (
            <p className="text-[11px] text-pkt-text-body-subtle mt-0.5">
              {getVederlagsmetodeShortLabel(v.metode)}
            </p>
          )}
        </div>
      ) : (
        /* Stage 2/3: Hero is krevd amount in amber */
        <div>
          {krevdBelop != null && (
            <>
              <p className="text-lg font-bold font-mono tabular-nums text-pkt-brand-yellow-1000">
                {formatCurrencyCompact(krevdBelop)}
              </p>
              {v.metode && (
                <p className="text-[11px] text-pkt-text-body-subtle mt-0.5">
                  {getVederlagsmetodeShortLabel(v.metode)}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Context details below separator */}
      {(() => {
        // Resolved: show krevd + grad in context
        if (resolved && krevdBelop != null) {
          return (
            <div className="mt-2 pt-2 border-t border-pkt-border-subtle space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Krevd</span>
                <span className="text-xs font-mono text-pkt-text-body-default">
                  {formatCurrencyCompact(krevdBelop)}
                </span>
              </div>
              {vederlagGrad != null && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-pkt-text-body-subtle">Godkjenningsgrad</span>
                  <span className={clsx('text-xs font-mono font-semibold', getGradColor(vederlagGrad))}>
                    {vederlagGrad}%
                  </span>
                </div>
              )}
            </div>
          );
        }

        // Non-resolved: show method + rigg/drift + produktivitet
        const hasDetails = v.metode || v.saerskilt_krav?.rigg_drift?.belop || v.saerskilt_krav?.produktivitet?.belop;
        const showMethodInContext = hasBhResponse; // Method moves to context when KPI row is showing
        if (!hasDetails) return null;
        if (!showMethodInContext && !v.saerskilt_krav?.rigg_drift?.belop && !v.saerskilt_krav?.produktivitet?.belop) return null;

        return (
          <div className="mt-2 pt-2 border-t border-pkt-border-subtle space-y-1.5">
            {showMethodInContext && v.metode && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Metode</span>
                <span className="text-xs text-pkt-text-body-default">
                  {getVederlagsmetodeShortLabel(v.metode)}
                </span>
              </div>
            )}
            {v.saerskilt_krav?.rigg_drift?.belop != null && v.saerskilt_krav.rigg_drift.belop > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Rigg/drift</span>
                <span className="text-xs font-mono text-pkt-text-body-default">
                  +{formatCurrencyCompact(v.saerskilt_krav.rigg_drift.belop)}
                </span>
              </div>
            )}
            {v.saerskilt_krav?.produktivitet?.belop != null && v.saerskilt_krav.produktivitet.belop > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Produktivitet</span>
                <span className="text-xs font-mono text-pkt-text-body-default">
                  +{formatCurrencyCompact(v.saerskilt_krav.produktivitet.belop)}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* History */}
      <TrackHistory entries={entries} />

      {/* CTA strip */}
      <TrackCTA
        spor="vederlag"
        status={status}
        state={state}
        userRole={userRole}
        actions={actions}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/bento/track-cards/VederlagCard.tsx
git commit -m "feat: add VederlagCard with KPI hero and growing stages"
```

---

### Task 7: FristCard component

**Files:**
- Create: `src/components/bento/track-cards/FristCard.tsx`

**Step 1: Write the component**

```tsx
// src/components/bento/track-cards/FristCard.tsx
import { clsx } from 'clsx';
import { CheckIcon } from '@radix-ui/react-icons';
import type { SakState } from '../../../types/timeline';
import type { AvailableActions } from '../../../hooks/useActionPermissions';
import { formatDateShort } from '../../../utils/formatters';
import { getAccentBorderClass, getGradColor, isResolved } from './trackCardUtils';
import { StatusDot } from './StatusDot';
import { TrackHistory } from './TrackHistory';
import { TrackCTA } from './TrackCTA';
import type { SporHistoryEntry } from '../../views/SporHistory';

interface FristCardProps {
  state: SakState;
  godkjentDager?: number;
  fristGrad?: number;
  isSubsidiary?: boolean;
  isDimmed?: boolean;
  userRole: 'TE' | 'BH';
  actions: AvailableActions;
  entries: SporHistoryEntry[];
  primaryAction?: { label: string; onClick: () => void };
  secondaryActions?: { label: string; onClick: () => void; variant?: 'default' | 'danger' }[];
  className?: string;
  style?: React.CSSProperties;
}

export function FristCard({
  state,
  godkjentDager,
  fristGrad,
  isSubsidiary,
  isDimmed,
  userRole,
  actions,
  entries,
  primaryAction,
  secondaryActions,
  className,
  style,
}: FristCardProps) {
  const f = state.frist;
  const status = f.status;
  const hasBhResponse = !!f.bh_resultat;
  const resolved = isResolved(status) || f.te_akseptert === true;
  const hasDays = f.krevd_dager != null;
  const hasVarselOnly = !hasDays && f.frist_varsel?.dato_sendt;
  const isEmpty = !hasDays && !hasVarselOnly && status === 'utkast';

  // Dimmed state
  if (isDimmed) {
    return (
      <div
        className={clsx(
          'bg-pkt-bg-card rounded-lg border-t-2 p-3 opacity-60',
          'border-t-pkt-grays-gray-300',
          className,
        )}
        style={style}
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Fristforlengelse
          </span>
          <span className="text-[10px] text-pkt-text-body-muted">§33</span>
        </div>
        <p className="text-xs text-pkt-text-body-muted italic mt-2">Krever ansvarsgrunnlag</p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-pkt-bg-card rounded-lg border-t-2 p-3',
        getAccentBorderClass(status),
        className,
      )}
      style={style}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Fristforlengelse
          </span>
          <span className="text-[10px] text-pkt-text-body-muted">§33</span>
          {isSubsidiary && (
            <span className="bg-badge-warning-bg text-badge-warning-text rounded-sm text-[10px] px-1.5 py-0.5 font-medium ml-1">
              Subsidiært
            </span>
          )}
        </div>
        <StatusDot status={status} />
      </div>

      {/* Hero zone */}
      {isEmpty ? (
        <p className="text-xs text-pkt-text-body-muted italic">Ingen data ennå</p>
      ) : hasVarselOnly && !hasDays ? (
        /* Stage 2: Varslet only, no days yet */
        <div>
          <p className="text-sm font-semibold text-pkt-text-body-dark">Varslet</p>
          <p className="text-[11px] text-pkt-text-body-subtle mt-0.5">
            {formatDateShort(f.frist_varsel!.dato_sendt)}
          </p>
        </div>
      ) : hasBhResponse && godkjentDager != null && !resolved ? (
        /* Stage 4: KPI row */
        <div>
          <div className="flex items-baseline gap-4">
            <div>
              <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">Krevd</span>
              <p className="text-sm font-semibold font-mono tabular-nums text-pkt-brand-yellow-1000">
                {f.krevd_dager}d
              </p>
            </div>
            <div>
              <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">
                {isSubsidiary ? 'Subs.' : 'Godkjent'}
              </span>
              <p className="text-sm font-semibold font-mono tabular-nums text-pkt-brand-dark-green-1000">
                {godkjentDager}d
              </p>
            </div>
            {fristGrad != null && (
              <div className="ml-auto text-right">
                <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">Grad</span>
                <p className={clsx('text-sm font-bold font-mono tabular-nums', getGradColor(fristGrad))}>
                  {fristGrad}%
                </p>
              </div>
            )}
          </div>
          {fristGrad != null && (
            <div className="mt-1.5 h-1.5 bg-pkt-grays-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-pkt-brand-dark-green-1000 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(fristGrad, 100)}%` }}
              />
            </div>
          )}
        </div>
      ) : resolved && godkjentDager != null ? (
        /* Stage 5: Resolved hero */
        <div className="flex items-baseline justify-between">
          <p className="text-lg font-bold font-mono tabular-nums text-pkt-brand-dark-green-1000">
            {godkjentDager}d
          </p>
          <CheckIcon className="w-4 h-4 text-pkt-brand-dark-green-1000" />
        </div>
      ) : hasDays ? (
        /* Stage 3: Hero days in amber */
        <p className="text-lg font-bold font-mono tabular-nums text-pkt-brand-yellow-1000">
          {f.krevd_dager}d
        </p>
      ) : null}

      {/* Context details */}
      {(() => {
        if (resolved && hasDays) {
          return (
            <div className="mt-2 pt-2 border-t border-pkt-border-subtle space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Krevd</span>
                <span className="text-xs font-mono text-pkt-text-body-default">{f.krevd_dager}d</span>
              </div>
              {f.ny_sluttdato && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-pkt-text-body-subtle">Ny sluttdato</span>
                  <span className="text-xs font-mono font-semibold text-pkt-brand-warm-blue-1000">
                    {formatDateShort(f.ny_sluttdato)}
                  </span>
                </div>
              )}
            </div>
          );
        }

        // Non-resolved: show varsel date (when hero is days) + ny sluttdato
        const hasContext = (hasDays && f.frist_varsel?.dato_sendt) || f.ny_sluttdato;
        if (!hasContext) return null;

        return (
          <div className="mt-2 pt-2 border-t border-pkt-border-subtle space-y-1.5">
            {hasDays && f.frist_varsel?.dato_sendt && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Varslet</span>
                <span className="text-xs font-mono text-pkt-text-body-default">
                  {formatDateShort(f.frist_varsel.dato_sendt)}
                </span>
              </div>
            )}
            {f.ny_sluttdato && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Ny sluttdato</span>
                <span className="text-xs font-mono font-semibold text-pkt-brand-warm-blue-1000">
                  {formatDateShort(f.ny_sluttdato)}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* History */}
      <TrackHistory entries={entries} />

      {/* CTA strip */}
      <TrackCTA
        spor="frist"
        status={status}
        state={state}
        userRole={userRole}
        actions={actions}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/bento/track-cards/FristCard.tsx
git commit -m "feat: add FristCard with growing days hero"
```

---

### Task 8: Barrel export + register in bento index

**Files:**
- Create: `src/components/bento/track-cards/index.ts`
- Modify: `src/components/bento/index.ts`

**Step 1: Create barrel export**

```typescript
// src/components/bento/track-cards/index.ts
export { GrunnlagCard } from './GrunnlagCard';
export { VederlagCard } from './VederlagCard';
export { FristCard } from './FristCard';
export { StatusDot } from './StatusDot';
export { TrackHistory } from './TrackHistory';
export { TrackCTA } from './TrackCTA';
export { getAccentBorderClass, getStatusDotClass, getGradColor, isResolved } from './trackCardUtils';
```

**Step 2: Add to bento index**

Add to `src/components/bento/index.ts`:
```typescript
export { GrunnlagCard, VederlagCard, FristCard } from './track-cards';
```

**Step 3: Commit**

```bash
git add src/components/bento/track-cards/index.ts src/components/bento/index.ts
git commit -m "feat: barrel exports for new track cards"
```

---

### Task 9: Wire into CasePageBento — replace Grunnlag card

**Files:**
- Modify: `src/pages/CasePageBento.tsx`

This is the integration task. Replace the `BentoDashboardCard` + `TrackStepper` + `CategoryLabel` + dates + `TrackNextStep` + `SporHistory` block for Grunnlag with the new `GrunnlagCard`.

**Step 1: Update imports**

In `CasePageBento.tsx`, add import:
```typescript
import { GrunnlagCard, VederlagCard, FristCard } from '../components/bento/track-cards';
```

Remove `TrackStepper` and `TrackNextStep` from the bento imports (they're no longer used in this file).

**Step 2: Replace Grunnlag card section**

Find the Grunnlag `BentoDashboardCard` block (around lines 738-818) and replace with:

```tsx
<GrunnlagCard
  state={state}
  userRole={userRole}
  actions={actions}
  entries={grunnlagEntries}
  primaryAction={grunnlagPrimaryAction}
  secondaryActions={grunnlagSecondaryActions}
  className="animate-fade-in-up"
/>
```

You'll need to construct `grunnlagPrimaryAction` and `grunnlagSecondaryActions` from the existing `BentoGrunnlagActionButtons` logic. Extract the primary action (the one the CTA strip shows) and secondary actions (for the overflow menu).

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Fix any type errors.

**Step 4: Visual verification**

Run: `npm run dev`
Navigate to a case page, verify the Grunnlag card renders correctly in different states.

**Step 5: Commit**

```bash
git add src/pages/CasePageBento.tsx
git commit -m "feat: wire GrunnlagCard into CasePageBento"
```

---

### Task 10: Wire into CasePageBento — replace Vederlag card

**Files:**
- Modify: `src/pages/CasePageBento.tsx`

**Step 1: Replace Vederlag card section**

Find the Vederlag `BentoDashboardCard` block (around lines 886-1016) and replace with:

```tsx
<VederlagCard
  state={state}
  krevdBelop={krevdBelop}
  godkjentBelop={godkjentBelop}
  vederlagGrad={vederlagGrad}
  isSubsidiary={vederlagErSubsidiaer}
  isDimmed={grunnlagIkkeSendt}
  userRole={userRole}
  actions={actions}
  entries={vederlagEntries}
  primaryAction={vederlagPrimaryAction}
  secondaryActions={vederlagSecondaryActions}
  className="animate-fade-in-up"
  style={{ animationDelay: '75ms' }}
/>
```

Keep the `InlineReviseVederlag` component rendered after the card (outside it), since it's a separate expansion.

**Step 2: Visual verification**

Run: `npm run dev`
Check all stages: empty, sent with amount, BH responded, resolved.

**Step 3: Commit**

```bash
git add src/pages/CasePageBento.tsx
git commit -m "feat: wire VederlagCard into CasePageBento"
```

---

### Task 11: Wire into CasePageBento — replace Frist card

**Files:**
- Modify: `src/pages/CasePageBento.tsx`

**Step 1: Replace Frist card section**

Find the Frist `BentoDashboardCard` block (around lines 1020-1151) and replace with:

```tsx
<FristCard
  state={state}
  godkjentDager={godkjentDager}
  fristGrad={fristGrad}
  isSubsidiary={fristErSubsidiaer}
  isDimmed={grunnlagIkkeSendt}
  userRole={userRole}
  actions={actions}
  entries={fristEntries}
  primaryAction={fristPrimaryAction}
  secondaryActions={fristSecondaryActions}
  className="animate-fade-in-up"
  style={{ animationDelay: '150ms' }}
/>
```

Keep `InlineReviseFrist` rendered outside the card.

**Step 2: Visual verification**

Run: `npm run dev`
Check: varslet-only state, days specified, BH responded, resolved.

**Step 3: Commit**

```bash
git add src/pages/CasePageBento.tsx
git commit -m "feat: wire FristCard into CasePageBento"
```

---

### Task 12: Extract primary/secondary actions from BentoTrackActionButtons

**Files:**
- Modify: `src/pages/CasePageBento.tsx`
- Possibly modify: `src/components/BentoTrackActionButtons.tsx`

The new cards use `primaryAction` + `secondaryActions` props instead of rendering action button components. We need to extract the action logic from `BentoGrunnlagActionButtons`, `BentoVederlagActionButtons`, `BentoFristActionButtons` into data structures.

**Step 1: Create action extraction helpers**

In `CasePageBento.tsx`, create `useMemo` blocks that produce `primaryAction` and `secondaryActions` for each track, based on the existing `actions` object and `userRole`. Example pattern:

```typescript
const grunnlagPrimaryAction = useMemo(() => {
  if (actions.canSendGrunnlag) return { label: 'Send varsel om krav', onClick: () => handleExpandTrack('grunnlag', 'send') };
  if (actions.canRespondGrunnlag) return { label: 'Besvar krav', onClick: () => handleExpandTrack('grunnlag', 'respond') };
  if (actions.canAcceptGrunnlagResponse) return { label: 'Aksepter BH-svar', onClick: () => handleExpandTrack('grunnlag', 'accept') };
  return undefined;
}, [actions, /* relevant deps */]);

const grunnlagSecondaryActions = useMemo(() => {
  const items: { label: string; onClick: () => void; variant?: 'default' | 'danger' }[] = [];
  if (actions.canUpdateGrunnlag) items.push({ label: 'Revider', onClick: () => handleExpandTrack('grunnlag', 'update') });
  if (actions.canWithdrawGrunnlag) items.push({ label: 'Trekk tilbake', onClick: () => handleExpandTrack('grunnlag', 'withdraw'), variant: 'danger' });
  if (actions.canUtstEO) items.push({ label: 'Utstett EO', onClick: () => modals.utstEO.setOpen(true) });
  return items;
}, [actions, /* relevant deps */]);
```

Repeat for vederlag and frist.

**Step 2: Verify all actions still work**

Run through each action in the UI:
- Send grunnlag -> should expand inline form
- Respond -> should expand or open modal
- Revider -> should trigger revision flow
- Trekk tilbake -> should trigger withdraw

**Step 3: Commit**

```bash
git add src/pages/CasePageBento.tsx
git commit -m "feat: extract track actions into primary/secondary for CTA strips"
```

---

### Task 13: Clean up unused imports

**Files:**
- Modify: `src/pages/CasePageBento.tsx`

**Step 1: Remove unused imports**

After integration, remove:
- `BentoDashboardCard` from primitives import (if no longer used)
- `TrackStepper` from bento import
- `TrackNextStep` from bento import
- `BentoGrunnlagActionButtons`, `BentoVederlagActionButtons`, `BentoFristActionButtons` if fully replaced
- `Badge` if no longer used for status badges
- `getSporStatusStyle` if no longer used
- `getStatusBadge` helper function

**Step 2: Run lint + type check**

Run: `npm run lint && npx tsc --noEmit`
Fix any issues.

**Step 3: Run tests**

Run: `npm run test`
Ensure nothing is broken.

**Step 4: Commit**

```bash
git add src/pages/CasePageBento.tsx
git commit -m "refactor: clean up unused imports after track card migration"
```

---

### Task 14: Final verification

**Step 1: Run full test suite**

Run: `npm run test`

**Step 2: Visual verification across states**

Open the app (`npm run dev`) and verify each card in these states:
1. Grunnlag: utkast (tom), utkast (med data), sendt, BH godkjent, BH avslått
2. Vederlag: dimmed, sendt, BH delvis godkjent, godkjent
3. Frist: dimmed, varslet (no days), krevd (days), BH delvis godkjent, godkjent
4. Expand/collapse forms still work
5. History expands/collapses
6. Overflow menu works
7. CTA strip shows correct action per role (toggle TE/BH)

**Step 3: Run lint**

Run: `npm run lint`

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address visual/lint issues from track card redesign"
```

---

Plan complete and saved to `docs/plans/2026-02-14-track-card-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?