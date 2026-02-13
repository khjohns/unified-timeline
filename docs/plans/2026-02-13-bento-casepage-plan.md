# Bento CasePage Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign CasePageBento to match SaksoversiktPage's tile-based composition, replacing modals with an expand-in-card pattern for form actions.

**Architecture:** Flat 12-column grid with independent tiles (CaseIdentityTile, CaseActivityStripTile, 3x TrackTile). When a user triggers an action, the track tile expands to col-span-12 and renders the form inline, pushing sibling tiles to a col-span-6 row below. RespondVederlag and RespondFrist keep their modals.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS v4 (Punkt design tokens), React Hook Form + Zod, Vitest.

**Design doc:** `docs/plans/2026-02-13-bento-casepage-design.md`

---

## Task 1: CaseIdentityTile

New tile showing case ID, title, status, parties, amounts, and days.

**Files:**
- Create: `src/components/bento/CaseIdentityTile.tsx`
- Create: `src/components/bento/__tests__/CaseIdentityTile.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/bento/__tests__/CaseIdentityTile.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CaseIdentityTile } from '../CaseIdentityTile';

const mockState = {
  sak_id: 'KOE-2024-042',
  sakstittel: 'Grunnforhold avviker fra beskrivelse',
  overordnet_status: 'pagar' as const,
  entreprenor: 'Veidekke',
  byggherre: 'Oslobygg',
  sakstype: 'standard' as const,
  sum_krevd: 1200000,
  sum_godkjent: 800000,
  frist: { dager_krevd: 45, dager_godkjent: 30 },
};

describe('CaseIdentityTile', () => {
  it('renders case ID and title', () => {
    render(<CaseIdentityTile state={mockState as any} />);
    expect(screen.getByText('KOE-2024-042')).toBeInTheDocument();
    expect(screen.getByText(/Grunnforhold avviker/)).toBeInTheDocument();
  });

  it('renders parties', () => {
    render(<CaseIdentityTile state={mockState as any} />);
    expect(screen.getByText(/Veidekke/)).toBeInTheDocument();
    expect(screen.getByText(/Oslobygg/)).toBeInTheDocument();
  });

  it('renders amounts and days', () => {
    render(<CaseIdentityTile state={mockState as any} />);
    expect(screen.getByText(/1\s*200\s*000/)).toBeInTheDocument();
    expect(screen.getByText(/800\s*000/)).toBeInTheDocument();
    expect(screen.getByText(/45 dager/)).toBeInTheDocument();
    expect(screen.getByText(/30 dager/)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/bento/__tests__/CaseIdentityTile.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement CaseIdentityTile**

Pattern follows `ProjectIdentityTile` from saksoversikt. Key elements:
- Wraps in `<BentoCard colSpan="col-span-12" delay={delay}>`
- Row 1: sak_id (mono, small)
- Row 2: sakstittel (large, semibold)
- Row 3: Status badge + parter (TE → BH) + sakstype — flex row with `·` separators
- Row 4: Krevd/Godkjent amounts + days — `text-pkt-text-body-subtle` with mono for numbers

Reference files:
- `src/components/dashboard/ProjectIdentityTile.tsx` — tile composition pattern
- `src/components/bento/BentoPageHeader.tsx` — BentoSumIndicators for amount formatting, BentoHeaderMeta for party display
- `src/types/timeline.ts` — SakState interface (line ~557), OverordnetStatus type
- `src/components/dashboard/BentoCard.tsx` — BentoCard wrapper

Props:
```tsx
interface CaseIdentityTileProps {
  state: SakState;
  delay?: number;
}
```

Use `formatCurrency` from existing utils for amounts. Use existing status badge patterns from BentoHeaderMeta.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/bento/__tests__/CaseIdentityTile.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/bento/CaseIdentityTile.tsx src/components/bento/__tests__/CaseIdentityTile.test.tsx
git commit -m "feat: add CaseIdentityTile for bento casepage"
```

---

## Task 2: CaseActivityStripTile

Thin horizontal tile showing last event per track with relative time.

**Files:**
- Create: `src/components/bento/CaseActivityStripTile.tsx`
- Create: `src/components/bento/__tests__/CaseActivityStripTile.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/bento/__tests__/CaseActivityStripTile.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CaseActivityStripTile } from '../CaseActivityStripTile';

describe('CaseActivityStripTile', () => {
  it('renders last event per track', () => {
    const events = [
      { event_type: 'respons_grunnlag', created_at: new Date().toISOString() },
      { event_type: 'vederlag_krav_sendt', created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
    ];
    render(<CaseActivityStripTile events={events as any} />);
    expect(screen.getByText(/Grunnlag/)).toBeInTheDocument();
    expect(screen.getByText(/Vederlag/)).toBeInTheDocument();
  });

  it('shows waiting state for tracks without events', () => {
    render(<CaseActivityStripTile events={[]} />);
    expect(screen.getByText(/venter/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/bento/__tests__/CaseActivityStripTile.test.tsx`
Expected: FAIL

**Step 3: Implement CaseActivityStripTile**

Pattern follows `RecentActivityTile` from saksoversikt. Key elements:
- `<BentoCard colSpan="col-span-12">` with thin padding (`py-2 px-3`)
- Flex row with 3 items (one per track), each showing: colored dot + track name + last event description + relative time
- Mobile: horizontal scroll with `overflow-x-auto scrollbar-hide`
- Map event_type prefix to track: `grunnlag_*` → Grunnlag, `vederlag_*` → Vederlag, `frist_*` → Frist, `respons_grunnlag` → Grunnlag, etc.

Reference files:
- `src/components/dashboard/RecentActivityTile.tsx` — relative time formatting (lines 13-34), responsive layout
- `src/components/views/CaseDashboardBentoV2.tsx` — CrossTrackActivity component (lines 438-445)
- `src/types/timeline.ts` — TimelineEvent type

Props:
```tsx
interface CaseActivityStripTileProps {
  events: TimelineEvent[];
  delay?: number;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/bento/__tests__/CaseActivityStripTile.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/bento/CaseActivityStripTile.tsx src/components/bento/__tests__/CaseActivityStripTile.test.tsx
git commit -m "feat: add CaseActivityStripTile for bento casepage"
```

---

## Task 3: TrackFormView wrapper

Generic wrapper that renders a form inside an expanded track card, replacing Modal wrapper.

**Files:**
- Create: `src/components/bento/TrackFormView.tsx`
- Create: `src/components/bento/__tests__/TrackFormView.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/bento/__tests__/TrackFormView.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TrackFormView } from '../TrackFormView';

describe('TrackFormView', () => {
  it('renders track name and action title', () => {
    render(
      <TrackFormView
        trackName="Vederlag"
        actionTitle="Send krav"
        onCancel={() => {}}
        isDirty={false}
      >
        <div>form content</div>
      </TrackFormView>
    );
    expect(screen.getByText('Vederlag')).toBeInTheDocument();
    expect(screen.getByText('Send krav')).toBeInTheDocument();
    expect(screen.getByText('form content')).toBeInTheDocument();
  });

  it('calls onCancel when Avbryt is clicked and form is not dirty', () => {
    const onCancel = vi.fn();
    render(
      <TrackFormView trackName="Grunnlag" actionTitle="Send" onCancel={onCancel} isDirty={false}>
        <div />
      </TrackFormView>
    );
    fireEvent.click(screen.getByText('Avbryt'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows confirmation dialog when Avbryt is clicked and form is dirty', () => {
    const onCancel = vi.fn();
    render(
      <TrackFormView trackName="Grunnlag" actionTitle="Send" onCancel={onCancel} isDirty={true}>
        <div />
      </TrackFormView>
    );
    fireEvent.click(screen.getByText('Avbryt'));
    expect(screen.getByText(/ulagrede endringer/i)).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/bento/__tests__/TrackFormView.test.tsx`
Expected: FAIL

**Step 3: Implement TrackFormView**

Key elements:
- Wraps in `<BentoCard colSpan="col-span-12">`
- Header: track name (bold) + action title + optional stepper
- Content area: `{children}` — the form content from the extracted modal
- Footer: Avbryt + submit button (provided via children or slot)
- Dirty-check: `useState` for confirmation dialog, checks `isDirty` prop before calling `onCancel`

Reference files:
- `src/components/primitives/BentoDashboardCard.tsx` — card styling patterns (accent, master role)
- `src/components/dashboard/BentoCard.tsx` — BentoCard wrapper
- All action modals — the footer pattern with `Avbryt` + primary button

Props:
```tsx
interface TrackFormViewProps {
  trackName: string;         // "Vederlag"
  actionTitle: string;       // "Send krav"
  hjemmel?: string;          // "§34"
  onCancel: () => void;
  isDirty: boolean;
  children: ReactNode;
}
```

Note: The submit button lives inside the form content (children), not in TrackFormView. TrackFormView only provides the Avbryt button with dirty-check. This mirrors how modals work — the submit button is part of the form's `<form onSubmit>`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/bento/__tests__/TrackFormView.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/bento/TrackFormView.tsx src/components/bento/__tests__/TrackFormView.test.tsx
git commit -m "feat: add TrackFormView wrapper for expand-in-card forms"
```

---

## Task 4: Extract SendGrunnlag form content

Extract the form content from SendGrunnlagModal into a reusable component that can render both in modal and in TrackFormView.

**Files:**
- Create: `src/components/actions/forms/SendGrunnlagForm.tsx`
- Modify: `src/components/actions/SendGrunnlagModal.tsx` — refactor to use extracted form

**Step 1: Understand the extraction pattern**

Current structure in `SendGrunnlagModal.tsx`:
```
<Modal open={open} onOpenChange={...} title={...} size="lg">
  <form onSubmit={handleSubmit(onSubmit)}>
    {isUpdateMode && <SectionContainer>current grunnlag summary</SectionContainer>}
    {isUpdateMode && kategoriEndres && <Alert>category change warning</Alert>}
    <GrunnlagForm form={form} ... />
    <SectionContainer title="Vedlegg"><AttachmentUpload .../></SectionContainer>
    {mutation.isError && <Alert>error</Alert>}
    <div className="actions footer">Avbryt + Submit</div>
  </form>
  <TokenExpiredAlert .../>
</Modal>
```

New structure:
```
SendGrunnlagForm — contains: useForm, useSubmitEvent, form JSX, submit handler
  Used by: SendGrunnlagModal (wraps in Modal)
  Used by: CasePageBento expanded track (wraps in TrackFormView)
```

**Step 2: Create SendGrunnlagForm**

Extract everything inside `<Modal>` into `SendGrunnlagForm`. The component owns:
- `useForm` with zodResolver
- `useSubmitEvent` mutation
- `useFormBackup`
- Form JSX (SectionContainers, GrunnlagForm, AttachmentUpload)
- Submit handler
- Error display

Props:
```tsx
interface SendGrunnlagFormProps {
  sakId: string;
  onSuccess: () => void;          // called after successful submission
  onCancel: () => void;           // called when user clicks Avbryt
  onCatendaWarning?: () => void;
  originalEvent?: { event_id: string; grunnlag: GrunnlagTilstand };
  renderFooter?: (props: { isSubmitting: boolean; isDirty: boolean }) => ReactNode;
}
```

The `renderFooter` prop allows Modal and TrackFormView to provide different footer layouts. If not provided, use the default footer pattern (Avbryt + Submit in flex row).

Reference files:
- `src/components/actions/SendGrunnlagModal.tsx` — source of extraction
- `src/components/forms/GrunnlagForm.tsx` — already extracted pattern to follow

**Step 3: Refactor SendGrunnlagModal to use SendGrunnlagForm**

```tsx
// SendGrunnlagModal.tsx (simplified)
export function SendGrunnlagModal({ open, onOpenChange, sakId, ...props }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={...} size="lg">
      <SendGrunnlagForm
        sakId={sakId}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        {...props}
      />
    </Modal>
  );
}
```

**Step 4: Run existing tests**

Run: `npm run test -- --grep "Grunnlag"`
Expected: All existing tests still PASS — this is a refactor, not a behavior change.

**Step 5: Commit**

```bash
git add src/components/actions/forms/SendGrunnlagForm.tsx src/components/actions/SendGrunnlagModal.tsx
git commit -m "refactor: extract SendGrunnlagForm from modal for reuse"
```

---

## Task 5: Extract remaining form contents

Same extraction pattern for the other actions that will use expand-in-card.

**Files:**
- Create: `src/components/actions/forms/SendVederlagForm.tsx`
- Create: `src/components/actions/forms/SendFristForm.tsx`
- Create: `src/components/actions/forms/RespondGrunnlagForm.tsx`
- Create: `src/components/actions/forms/WithdrawForm.tsx`
- Create: `src/components/actions/forms/AcceptResponseForm.tsx`
- Modify: Corresponding modal files to use extracted forms

**For each form, follow the same pattern as Task 4:**

1. Extract everything inside `<Modal>` into a `*Form.tsx` component
2. The form component owns: useForm, useSubmitEvent, useFormBackup, JSX, submit handler
3. Props: `sakId`, `onSuccess`, `onCancel`, plus action-specific props
4. Refactor the modal to import and wrap the extracted form
5. Verify existing tests still pass

**Extraction priority (simplest first):**
1. `WithdrawForm` — 1 field (begrunnelse), straightforward
2. `AcceptResponseForm` — 1 field (kommentar) + read-only summary
3. `RespondGrunnlagForm` — tabbed (vurdering + begrunnelse), medium
4. `SendFristForm` — conditional sections, medium
5. `SendVederlagForm` — most complex of the group (but not wizard-level)

Reference files:
- `src/components/actions/WithdrawModal.tsx`
- `src/components/actions/AcceptResponseModal.tsx`
- `src/components/actions/RespondGrunnlagModal.tsx`
- `src/components/actions/SendFristModal.tsx`
- `src/components/actions/SendVederlagModal.tsx`

**Step (for each): Run tests after refactor**

Run: `npm run test`
Expected: All existing tests PASS — pure refactor.

**Step: Commit after each extraction**

```bash
git commit -m "refactor: extract WithdrawForm from modal for reuse"
git commit -m "refactor: extract AcceptResponseForm from modal for reuse"
git commit -m "refactor: extract RespondGrunnlagForm from modal for reuse"
git commit -m "refactor: extract SendFristForm from modal for reuse"
git commit -m "refactor: extract SendVederlagForm from modal for reuse"
```

---

## Task 6: Expand/collapse state and grid layout

Add expandedTrack state to CasePageBento and wire up the grid layout switching.

**Files:**
- Modify: `src/pages/CasePageBento.tsx`

**Step 1: Add expandedTrack state**

Add to `CasePageBentoDataLoader` (the component with all the hooks):

```tsx
const [expandedTrack, setExpandedTrack] = useState<{
  track: 'grunnlag' | 'vederlag' | 'frist';
  action: string;
} | null>(null);

const handleExpandTrack = useCallback((track: 'grunnlag' | 'vederlag' | 'frist', action: string) => {
  setExpandedTrack({ track, action });
}, []);

const handleCollapseTrack = useCallback(() => {
  setExpandedTrack(null);
}, []);
```

**Step 2: Compute grid layout based on state**

```tsx
const trackOrder: Array<'grunnlag' | 'vederlag' | 'frist'> = ['grunnlag', 'vederlag', 'frist'];

const expandedTracks = expandedTrack
  ? [expandedTrack.track]  // expanded track first
  : [];
const collapsedTracks = expandedTrack
  ? trackOrder.filter(t => t !== expandedTrack.track)
  : [];

function getTrackColSpan(track: 'grunnlag' | 'vederlag' | 'frist') {
  if (!expandedTrack) return 'col-span-12 xl:col-span-4';
  if (track === expandedTrack.track) return 'col-span-12';
  return 'col-span-12 md:col-span-6';
}
```

**Step 3: Replace CaseDashboardBentoV2 with direct TrackTile rendering**

Replace the single `<CaseDashboardBentoV2>` with individual tiles in the grid. The existing V2 component's logic (stepper, next-step, dependency indicator, history) moves into the tile rendering directly in CasePageBento — or into TrackTile if we create one.

For this task, render the track cards directly using `BentoDashboardCard` with the new colSpan logic. The expanded track renders TrackFormView + the extracted form component. The collapsed tracks render normally.

Pattern:
```tsx
{/* Track tiles */}
{expandedTrack && (
  <BentoCard colSpan="col-span-12">
    <TrackFormView
      trackName={trackConfig[expandedTrack.track].name}
      actionTitle={trackConfig[expandedTrack.track].actions[expandedTrack.action].title}
      onCancel={handleCollapseTrack}
      isDirty={/* from form ref */}
    >
      {/* Render the appropriate extracted form based on expandedTrack.action */}
    </TrackFormView>
  </BentoCard>
)}

{(expandedTrack ? collapsedTracks : trackOrder).map(track => (
  <BentoDashboardCard
    key={track}
    colSpan={getTrackColSpan(track)}
    /* ... existing track card props from V2 ... */
  />
))}
```

Reference files:
- `src/pages/SaksoversiktPage.tsx` — tile composition in grid (lines 129-171)
- `src/components/views/CaseDashboardBentoV2.tsx` — existing track card rendering (move to page level)
- `src/components/dashboard/CaseListTile.tsx` — expand/collapse colSpan pattern

**Step 4: Wire action buttons to expand instead of modal open**

Currently: `onSendGrunnlag={() => modals.sendGrunnlag.setOpen(true)}`
New: `onSendGrunnlag={() => handleExpandTrack('grunnlag', 'send')}`

Keep modal opens for RespondVederlag and RespondFrist.

**Step 5: Run tests**

Run: `npm run test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/pages/CasePageBento.tsx
git commit -m "feat: add expand-in-card grid layout to CasePageBento"
```

---

## Task 7: Wire expanded forms to TrackFormView

Connect each action's extracted form to the TrackFormView inside the expanded track.

**Files:**
- Modify: `src/pages/CasePageBento.tsx`

**Step 1: Create action→form mapping**

```tsx
function renderExpandedForm(
  expandedTrack: { track: string; action: string },
  sakId: string,
  state: SakState,
  onSuccess: () => void,
  onCancel: () => void,
) {
  const key = `${expandedTrack.track}:${expandedTrack.action}`;
  switch (key) {
    case 'grunnlag:send':
      return <SendGrunnlagForm sakId={sakId} onSuccess={onSuccess} onCancel={onCancel} />;
    case 'grunnlag:update':
      return <SendGrunnlagForm sakId={sakId} onSuccess={onSuccess} onCancel={onCancel} originalEvent={...} />;
    case 'grunnlag:respond':
      return <RespondGrunnlagForm sakId={sakId} onSuccess={onSuccess} onCancel={onCancel} ... />;
    case 'vederlag:send':
      return <SendVederlagForm sakId={sakId} onSuccess={onSuccess} onCancel={onCancel} ... />;
    case 'vederlag:revise':
      return <SendVederlagForm sakId={sakId} onSuccess={onSuccess} onCancel={onCancel} ... />;
    case 'frist:send':
      return <SendFristForm sakId={sakId} onSuccess={onSuccess} onCancel={onCancel} ... />;
    // withdraw and accept for all tracks
    case 'grunnlag:withdraw':
    case 'vederlag:withdraw':
    case 'frist:withdraw':
      return <WithdrawForm sakId={sakId} track={expandedTrack.track} onSuccess={onSuccess} onCancel={onCancel} ... />;
    case 'grunnlag:accept':
    case 'vederlag:accept':
    case 'frist:accept':
      return <AcceptResponseForm sakId={sakId} track={expandedTrack.track} onSuccess={onSuccess} onCancel={onCancel} ... />;
    default:
      return null;
  }
}
```

**Step 2: Wire onSuccess to collapse**

```tsx
const handleFormSuccess = useCallback(() => {
  setExpandedTrack(null);
  // Toast is handled by the form component itself
}, []);
```

**Step 3: Remove unused modals**

Remove modal state entries from `useCasePageModals` and modal JSX from CasePageBento for actions that now use expand-in-card. Keep:
- `respondVederlag` modal
- `respondFrist` modal
- `sendForsering` modal
- `utstEO` modal
- `pdfPreview` modal
- `catendaWarning` modal
- Approval workflow modals

**Step 4: Run all tests**

Run: `npm run test`
Expected: PASS

**Step 5: Manual test**

Run: `npm run dev`
- Navigate to a case page via `/bento` route
- Verify normal layout: Identity tile → Activity strip → 3 track tiles
- Click "Send krav" on grunnlag → tile expands, form renders inline
- Fill form → submit → tile collapses, toast shows
- Click "Send krav" on vederlag → vederlag expands, grunnlag+frist go col-6 below
- Click "Avbryt" with dirty form → confirmation dialog
- Click "Avbryt" with clean form → immediate collapse
- Verify RespondVederlag and RespondFrist still open modals

**Step 6: Commit**

```bash
git add src/pages/CasePageBento.tsx src/hooks/useCasePageModals.ts
git commit -m "feat: wire expanded forms to TrackFormView, remove unused modals"
```

---

## Task 8: Replace header and remove bottom section

Replace the existing BentoHeaderMeta/BentoSumIndicators with CaseIdentityTile, add CaseActivityStripTile, and remove bottom section.

**Files:**
- Modify: `src/pages/CasePageBento.tsx`

**Step 1: Replace header area**

Remove from the grid:
- `BentoHeaderMeta` component usage
- `BentoSumIndicators` component usage
- Any loose metadata rendering

Add in their place:
```tsx
{/* Row 1: Case identity */}
<CaseIdentityTile state={state} delay={0} />

{/* Row 2: Activity strip */}
<CaseActivityStripTile events={timelineEvents} delay={50} />
```

**Step 2: Remove bottom section**

Remove from the grid:
- Related cases tile (navigasjon)
- Metadata tile (detaljer)

The related cases info (forsering/EO) is already shown as banners above Row 1.

**Step 3: Update breadcrumb**

Keep breadcrumb as plain text above the grid (not a tile):
```tsx
<BentoBreadcrumb prosjektNavn={state.prosjekt_navn} sakId={sakId} />
```

**Step 4: Run tests and verify visually**

Run: `npm run test && npm run dev`
Expected: Clean tile-based layout matching design doc.

**Step 5: Commit**

```bash
git add src/pages/CasePageBento.tsx
git commit -m "feat: replace header with CaseIdentityTile, add ActivityStrip, remove bottom section"
```

---

## Task 9: Polish and visual harmony

Final pass for spacing, animation stagger, and responsive behavior.

**Files:**
- Modify: `src/pages/CasePageBento.tsx`
- Possibly modify: `src/components/bento/CaseIdentityTile.tsx`
- Possibly modify: `src/components/bento/CaseActivityStripTile.tsx`

**Step 1: Stagger animation delays**

```
CaseIdentityTile:    delay={0}
CaseActivityStripTile: delay={50}
GrunnlagTile:        delay={100}
VederlagTile:        delay={150}
FristTile:           delay={200}
```

**Step 2: Verify responsive breakpoints**

- `xl`: 3 track tiles side-by-side (col-4)
- `md`: Grunnlag full-width, Vederlag + Frist side-by-side (col-6) — or all stacked
- `< md`: All stacked col-12
- Expanded mode: expanded col-12, siblings col-6 on md+, col-12 on mobile

**Step 3: Ensure equal card heights**

Track tiles should have consistent minimum height. Use `min-h-[200px]` or similar if needed, or let content flow naturally if heights are close enough.

**Step 4: Test on mobile viewport**

Use browser dev tools to verify:
- Cards stack properly
- Activity strip scrolls horizontally
- Expanded form is usable on mobile
- No horizontal overflow

**Step 5: Commit**

```bash
git commit -m "polish: animation stagger, responsive breakpoints, visual harmony"
```

---

## Summary of deliverables

| Task | Component | Type |
|------|-----------|------|
| 1 | CaseIdentityTile | New tile |
| 2 | CaseActivityStripTile | New tile |
| 3 | TrackFormView | New wrapper |
| 4 | SendGrunnlagForm extraction | Refactor |
| 5 | Remaining form extractions | Refactor |
| 6 | Expand/collapse grid layout | Feature |
| 7 | Wire forms to TrackFormView | Feature |
| 8 | Replace header, remove bottom | Feature |
| 9 | Polish and visual harmony | Polish |

Tasks 1-3 are independent and can be parallelized. Tasks 4-5 are independent of 1-3 but sequential within themselves. Tasks 6-8 depend on all previous. Task 9 is final polish.
