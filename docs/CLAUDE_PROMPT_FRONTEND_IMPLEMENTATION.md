# Prompt for Claude Code: Frontend Greenfield Implementation

> **Use this prompt to instruct Claude Code to implement the frontend from scratch**

---

## Context

You are implementing a greenfield frontend for "Skjema Endringsmeldinger" (Change Order Forms) for Oslo Municipality. The project is migrating from a mutable document model to Event Sourcing architecture.

## Your Task

Implement the frontend according to the **Frontend Greenfield Implementation Plan** located at:
- `docs/FRONTEND_GREENFIELD_PLAN.md`

**IMPORTANT CONSTRAINTS:**
1. ⚠️ **Do NOT read the entire plan at once** - it's 2000+ lines. Read sections as needed.
2. ⚠️ **Follow phases sequentially** - Phase 1 must complete before Phase 2, etc.
3. ⚠️ **Pay special attention to sections 2.4, 2.5, 2.6** - these prevent critical production issues.
4. ⚠️ **Commit after each major step** - not just at the end of a phase.

## Implementation Strategy

### Step 1: Read the Plan Structure
First, read the **table of contents** of `docs/FRONTEND_GREENFIELD_PLAN.md`:
- Read lines 1-100 to understand the structure
- Identify the 6 implementation phases

### Step 2: Execute Phases Sequentially

For each phase:
1. **Read only the relevant section** from the plan
2. **Implement the code** according to specifications
3. **Verify the implementation** using the verification steps provided
4. **Commit your changes** with a descriptive message
5. **Ask me if you encounter ambiguity** or need clarification

### Step 3: Critical Configuration First

Before starting Phase 1 implementation, read and implement these critical sections:

**Section 2.4: Font Assets Handling** (lines ~346-437)
- Configure `vite.config.ts` with `vite-plugin-static-copy`
- Update font paths in `src/index.css`
- Verify fonts copy to `dist/fonts/` after build

**Section 2.5: Z-Index Strategy** (lines ~439-501)
- Add z-index scale to `tailwind.config.js`
- Apply to Modal components

**Section 2.6: Preventing FOUC** (lines ~502-570)
- Ensure correct CSS import order
- Add inline styles to `index.html`

These sections prevent production bugs that are hard to debug later.

## Phase Breakdown

### Phase 1: Foundation Setup (Section 5, Step 1.1-1.3)
**What to read:**
- Section 1.1: Install Dependencies (lines ~1230-1278)
- Section 1.2: Configure Tailwind CSS & Critical Setup (lines ~1280-1299)
- Section 1.3: Create Type Definitions (lines ~1301-1310)

**What to implement:**
1. Install new packages (Radix UI, TanStack Query, React Hook Form, Zod, date-fns, clsx)
2. Remove unused packages (PDF libraries if not needed)
3. Configure `vite.config.ts` (font copying)
4. Configure `tailwind.config.js` (Punkt tokens + z-index)
5. Create `src/index.css` with correct import order
6. Update `index.html` with FOUC prevention
7. Create `src/types/timeline.ts` (copy from migration plan)
8. Create `src/types/api.ts`

**Commit:** "feat: Phase 1 - Foundation setup with Tailwind, Vite, and TypeScript types"

**Verification before moving on:**
```bash
npm run dev
# Check DevTools: Punkt CSS variables exist
# Check Network: No 404 errors

npm run build
ls dist/fonts/  # Should show OsloSans-*.woff2 files
npm run preview
```

---

### Phase 2: Primitive Components (Section 5, Step 2.1)
**What to read:**
- Section 3.2A: Primitives (Radix + Punkt Styling) (lines ~599-750)
- Look for: Button.tsx, Modal.tsx, Card.tsx examples

**What to implement:**
1. Create `src/components/primitives/Button.tsx`
2. Create `src/components/primitives/Card.tsx`
3. Create `src/components/primitives/Modal.tsx`
4. Create `src/components/primitives/Tooltip.tsx` (wrap Radix)
5. Create `src/components/primitives/AlertDialog.tsx` (wrap Radix)
6. Create `src/components/primitives/index.ts` (barrel export)
7. *Optional:* Create `src/pages/ComponentShowcase.tsx` to test components

**Commit:** "feat: Phase 2 - Add primitive components (Button, Modal, Card)"

**Verification:**
- Run dev server
- Test Button variants (primary, secondary, ghost, danger)
- Test Modal (open, close, focus trap with Tab key, Escape to close)
- Verify z-index: Modal should appear above all content

---

### Phase 3: State Management Layer (Section 5, Step 3.1-3.3)
**What to read:**
- Section 5, Phase 3: State Management Layer (lines ~1328-1420)

**What to implement:**
1. Create `src/api/client.ts` (fetch wrapper)
2. Create `src/api/state.ts` (GET /api/saker/{id}/state)
3. Create `src/api/events.ts` (POST /api/saker/{id}/events)
4. Create `src/hooks/useCaseState.ts` (TanStack Query hook)
5. Create `src/hooks/useSubmitEvent.ts` (TanStack Mutation hook)
6. Update `src/main.tsx` (add QueryClientProvider)

**Commit:** "feat: Phase 3 - Add state management with TanStack Query"

**Verification:**
- Check that `src/main.tsx` wraps `<App>` with `<QueryClientProvider>`
- API functions should have proper TypeScript types

---

### Phase 4: View Components (Section 5, Step 4.1-4.3)
**What to read:**
- Section 3.2B: View Components (lines ~751-950)
- Section 5, Phase 4 (lines ~1422-1520)

**What to implement:**
1. Create `src/components/views/StatusCard.tsx`
2. Create `src/components/views/StatusDashboard.tsx`
3. Create `src/components/views/TimelineItem.tsx`
4. Create `src/components/views/Timeline.tsx`
5. Create `src/components/views/index.ts`
6. Create `src/pages/CasePage.tsx`
7. Update `src/App.tsx` to route to CasePage

**Commit:** "feat: Phase 4 - Add view components (Dashboard, Timeline, CasePage)"

**Verification:**
- Navigate to `/saker/:sakId` route
- Verify StatusDashboard renders 3 cards (Grunnlag, Vederlag, Frist)
- Verify Timeline renders event list
- Check ARIA live regions (screen reader announces status changes)

---

### Phase 5: Action Components (Section 5, Step 5.1-5.2)
**What to read:**
- Section 3.2C: Action Components (lines ~951-1140)
- Section 5, Phase 5 (lines ~1522-1620)

**What to implement:**
1. Create `src/hooks/useActionPermissions.ts`
2. Create `src/components/actions/SendGrunnlagModal.tsx`
3. Create `src/components/actions/SendVederlagModal.tsx` (full example in plan)
4. Create `src/components/actions/SendFristModal.tsx`
5. Create `src/components/actions/RespondGrunnlagModal.tsx`
6. Create `src/components/actions/RespondVederlagModal.tsx`
7. Create `src/components/actions/RespondFristModal.tsx`
8. Create `src/components/actions/index.ts`
9. Update `CasePage.tsx` to conditionally show action buttons

**Commit:** "feat: Phase 5 - Add action components (event submission modals)"

**Verification:**
- Click action button (e.g., "Send vederlagskrav")
- Modal opens, focus trapped inside
- Fill form, submit
- Check DevTools Network: POST to /api/saker/{id}/events
- Modal closes, focus returns to trigger button
- Timeline updates with new event

---

### Phase 6: Accessibility Audit (Section 5, Step 6.1-6.2)
**What to read:**
- Section 6: Accessibility Audit & Testing (lines ~1622-1705)

**What to implement:**
1. Install `@axe-core/react` and `eslint-plugin-jsx-a11y`
2. Add `.eslintrc.json` configuration
3. Create basic a11y tests in `src/tests/a11y.test.tsx`
4. Run manual accessibility tests (checklist in plan)

**Commit:** "test: Phase 6 - Add accessibility testing and WCAG verification"

**Verification:**
- Run `npm test` (axe tests should pass)
- Test keyboard navigation (Tab through all elements)
- Test with screen reader (NVDA/JAWS)
- Verify color contrast (DevTools)
- Test 200% zoom (no overflow)

---

## Important Notes

### When to Ask for Help
- If a section references code that doesn't exist yet, ask me which file to read
- If verification fails, debug before moving to next phase
- If you encounter TypeScript errors, resolve them before committing

### Commit Strategy
- Commit after each phase completes
- Use conventional commit format: `feat:`, `fix:`, `test:`, `docs:`
- Reference phase number in commit message
- Push to branch after every 2-3 commits

### Testing Strategy
- Test in development mode (`npm run dev`)
- Test in production mode (`npm run build && npm run preview`)
- Verify fonts load (check Network tab)
- Verify no FOUC (throttle to Slow 3G)

### If Backend Doesn't Exist Yet
- Mock the API responses in `src/api/client.ts`
- Use static data matching `SakState` type
- Add comment: `// TODO: Replace with real API when backend ready`

---

## Final Deliverable

After completing all 6 phases, you should have:

1. ✅ Complete directory structure (`src/components/`, `src/api/`, `src/hooks/`, etc.)
2. ✅ All primitive components (Button, Modal, Card, etc.)
3. ✅ View components (StatusDashboard, Timeline)
4. ✅ Action components (modals for event submission)
5. ✅ State management (TanStack Query hooks)
6. ✅ Accessibility tests
7. ✅ Working application at `npm run dev`
8. ✅ Production build that passes all checks

Run the deployment checklist (Section 9, lines ~1598-1627) to verify everything works.

---

## Example Prompt to Start

```
Hi Claude! I need you to implement the frontend for our Event Sourcing application following the plan in docs/FRONTEND_GREENFIELD_PLAN.md.

Please start with Phase 1: Foundation Setup.

1. Read section 1.1 (Install Dependencies) - around line 1230
2. Read sections 2.4, 2.5, 2.6 (Critical Configuration) - lines 346-570
3. Install packages and configure Vite/Tailwind/TypeScript
4. Verify setup works before moving to Phase 2

Please proceed step-by-step and commit after each major change. Ask me if you need clarification or encounter any issues.
```

---

**Good luck! 🚀**
