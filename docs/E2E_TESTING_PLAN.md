# E2E Testing Plan

## Overview

This document outlines the comprehensive E2E testing strategy for the KOE (Krav om Endringsordre) system. The system handles construction contract change management according to NS 8407 Norwegian standard.

## Running E2E Tests

### Prerequisites

1. **Install Playwright browsers**:
   ```bash
   npx playwright install
   ```

2. **Start the backend** (required - not auto-started):
   ```bash
   cd backend && source venv/bin/activate && python app.py
   ```

3. **Run tests** (frontend auto-started via webServer config):
   ```bash
   npm run test:e2e
   ```

### Test Configuration

- **Test directory**: `e2e/`
- **Config file**: `playwright.config.ts`
- **Backend URL**: `http://localhost:8080`
- **Frontend URL**: `http://localhost:3000`
- **Retries**: 2 (for flaky tests)
- **Timeout**: 60 seconds per test

## Test Coverage Status

### Current Test Files

| File | Status | Tests | Description |
|------|--------|-------|-------------|
| `e2e/smoke.spec.ts` | ✅ Complete | 4 | Backend health, frontend loads, CSRF, demo page |
| `e2e/grunnlag.spec.ts` | ✅ Complete | 9 | Grunnlag flow, BH response, auth, state persistence |
| `e2e/vederlag-frist.spec.ts` | 🔧 In Progress | ~18 | Vederlag, Frist, BH Response, RBAC, Validation |

### Test Scenarios by Feature

#### 1. Grunnlag (Basis/Grounds) - ✅ Complete

| Scenario | Status | File:Line |
|----------|--------|-----------|
| TE can submit grunnlag | ✅ | grunnlag.spec.ts:69 |
| Grunnlag modal shows form fields | ✅ | grunnlag.spec.ts:46 |
| Grunnlag appears in timeline | ✅ | grunnlag.spec.ts:131 |
| State persists across reload | ✅ | grunnlag.spec.ts:165 |

#### 2. Vederlag (Compensation) - 🔧 In Progress

| Scenario | Status | Notes |
|----------|--------|-------|
| TE can submit vederlag with ENHETSPRISER | 🔧 | Selector issues with RadioItem |
| TE can submit vederlag with REGNINGSARBEID | ⏳ | Not yet implemented |
| TE can submit vederlag with FASTPRIS_TILBUD | ⏳ | Not yet implemented |
| BH can respond to vederlag | ⏳ | Not yet implemented |
| Vederlag modal shows form fields | ✅ | vederlag-frist.spec.ts:31 |

#### 3. Frist (Deadline Extension) - 🔧 In Progress

| Scenario | Status | Notes |
|----------|--------|-------|
| TE can submit frist with spesifisert varsel | 🔧 | Selector issues with RadioItem |
| TE can submit frist with nøytralt varsel | ⏳ | Not yet implemented |
| TE can submit frist with begge varsler | ⏳ | Not yet implemented |
| BH can respond to frist | ⏳ | Not yet implemented |
| Frist modal shows form fields | ✅ | vederlag-frist.spec.ts:104 |

#### 4. BH Response Flows - 🔧 In Progress

| Scenario | Status | Notes |
|----------|--------|-------|
| BH can respond to grunnlag with "godkjent" | 🔧 | Selector issues with Select |
| BH can respond to grunnlag with "avvist" | ⏳ | Not yet implemented |
| BH can respond to vederlag | ⏳ | Not yet implemented |
| BH can respond to frist | ⏳ | Not yet implemented |

#### 5. Role-Based Access Control - 🔧 In Progress

| Scenario | Status | Notes |
|----------|--------|-------|
| TE sees TE-specific buttons | 🔧 | Test needs verification |
| BH sees BH-specific buttons | ✅ | vederlag-frist.spec.ts:243 |
| Role toggle works | ✅ | vederlag-frist.spec.ts:258 |

#### 6. Form Validation - 🔧 In Progress

| Scenario | Status | Notes |
|----------|--------|-------|
| Empty begrunnelse shows error | 🔧 | Selector issues |
| Required fields show errors | ⏳ | Not yet implemented |

## Known UI Bugs (Discovered During Testing)

### 1. RadioItem Accessibility Bug - ✅ FIXED (2025-12-08)

**Component**: `src/components/primitives/RadioGroup.tsx`

**Issue**: The `RadioItem` component used `htmlFor={props.id}` but modals don't pass `id` props to RadioItem.

**Fix Applied**: Auto-generate id from value if not provided:
```tsx
const radioId = props.id || (props.value ? `radio-${props.value}` : undefined);
```

**Test Selector Note**: Radix RadioGroup renders TWO radio elements per option (styled + native hidden).
Use `.first()` to avoid strict mode violations:
```typescript
await page.getByRole('radio', { name: 'Enhetspriser (§34.3)' }).first().click();
```

### 2. RespondGrunnlagModal Missing `spor` Field - ✅ FIXED (2025-12-08)

**Component**: `src/components/actions/RespondGrunnlagModal.tsx`

**Issue**: Backend `ResponsEvent` requires a `spor` field, but the frontend wasn't sending it.

**Fix Applied**: Added `spor: 'GRUNNLAG'` to the mutation payload.

### 3. Backend Field Mismatch (krevd_belop -> belop_direkte) - ✅ FIXED (2025-12-08)

**Components affected**:
- `backend/services/timeline_service.py`
- `backend/services/catenda_comment_generator.py`
- `backend/services/weasyprint_generator.py`
- `backend/api/validators.py`

**Issue**: Multiple backend files were using the old `krevd_belop` field, but `VederlagData` and `VederlagTilstand` models were updated to use `belop_direkte`/`kostnads_overslag` per vederlagsmetode.

**Fix Applied**: Updated all references to use the new field names:
- `belop_direkte` for ENHETSPRISER/FASTPRIS_TILBUD
- `kostnads_overslag` for REGNINGSARBEID (estimate before work is done)
- `saerskilt_krav.produktivitetstap/rigg_drift` instead of top-level `inkluderer_*` fields

### 4. ResponsEvent `spor` Field Nesting Issue - ✅ FIXED (2025-12-08)

**Components affected**:
- `backend/models/events.py` (parse_event_from_request)
- `src/components/actions/RespondGrunnlagModal.tsx`

**Issue**: Frontend sent `spor` inside the `data` object, but `ResponsEvent` Pydantic model expects `spor` as a top-level field. Error: `"1 validation error for ResponsEvent spor Field required"`.

**Root Cause**: API payload structure mismatch:
```
Frontend sends:     { event: { data: { spor: "GRUNNLAG", ... } } }
Backend expects:    { event: { spor: "GRUNNLAG", data: { ... } } }
```

**Fix Applied**: Modified `parse_event_from_request` in `backend/models/events.py` to:
1. Extract `spor` from `data` object if present (for backwards compatibility)
2. Auto-derive `spor` from `event_type` if not provided:
   - `respons_grunnlag` → `GRUNNLAG`
   - `respons_vederlag` → `VEDERLAG`
   - `respons_frist` → `FRIST`

This makes the frontend code simpler - it doesn't need to worry about where to place `spor`.

### 5. localStorage Key Mismatch (Role Toggle Bug) - ✅ FIXED (2025-12-08)

**Components affected**:
- `src/api/events.ts`
- `src/hooks/useUserRole.ts`

**Issue**: When switching roles via the UI toggle (TE/BH), the role change wasn't applied to API requests. Error: `"Kun BH kan utføre denne handlingen"` (Only BH can perform this action).

**Root Cause**: Two different localStorage keys were used:
- `useUserRole.ts` used: `'unified-timeline-user-role'`
- `events.ts` used: `'koe-user-role'`

When UI toggled the role, it updated one key, but API requests read from the other (stale) key.

**Fix Applied**: Changed `events.ts` to use the same key as `useUserRole.ts`:
```typescript
const USER_ROLE_STORAGE_KEY = 'unified-timeline-user-role';
```

### 6. timeline_service.py VederlagData Field Mismatches - ✅ FIXED (2025-12-08)

**Components affected**:
- `backend/services/timeline_service.py`

**Issue**: timeline_service.py referenced old field names that no longer exist in VederlagData. Error: `"'VederlagData' object has no attribute 'saerskilt_varsel_rigg_drift_dato'"`.

**Root Cause**: VederlagData model was updated (2025-12-06) to use `VarselInfo` objects instead of separate date fields:
- Old: `saerskilt_varsel_rigg_drift_dato`, `varsel_justert_ep_dato`, `varsel_start_regning_dato`
- New: `rigg_drift_varsel`, `justert_ep_varsel`, `regningsarbeid_varsel`, `produktivitetstap_varsel` (all VarselInfo objects)

**Fix Applied**: Updated `_handle_vederlag` method to:
- Read from correct field names (VarselInfo objects)
- Serialize VarselInfo to dicts for storage in VederlagTilstand
- Handle `krever_justert_ep` flag

### 7. E2E Test BH Role Selector Bug - ✅ FIXED (2025-12-08)

**Components affected**:
- `e2e/vederlag-frist.spec.ts`

**Issue**: Tests used `getByRole('button', { name: /bytt til byggherre/i })` but the button text is just "BH".

**Fix Applied**: Changed selector to `getByLabel('Bytt til Byggherre modus')` + wait for `aria-pressed`.

### 8. FristData VarselInfo Field Mismatch - ✅ FIXED (2025-12-08)

**Components affected**:
- `backend/services/timeline_service.py`

**Issue**: timeline_service.py used old field names for FristData that no longer exist. Error: `"'FristData' object has no attribute 'noytralt_varsel_dato'"` and `"'VarselInfo' object has no attribute 'dato'"`.

**Root Cause**: FristData model was updated to use `VarselInfo` objects:
- Old: `noytralt_varsel_dato`, `spesifisert_krav_dato` (top-level fields)
- New: `noytralt_varsel: VarselInfo`, `spesifisert_varsel: VarselInfo`

And VarselInfo uses `dato_sendt` not `dato`:
```python
class VarselInfo(BaseModel):
    dato_sendt: Optional[str] = Field(...)
    metode: Optional[List[str]] = Field(...)
```

**Fix Applied**: Updated `_handle_frist` method to extract dates correctly:
```python
if event.data.noytralt_varsel:
    frist.noytralt_varsel_dato = event.data.noytralt_varsel.dato_sendt
if event.data.spesifisert_varsel:
    frist.spesifisert_krav_dato = event.data.spesifisert_varsel.dato_sendt
```

## Testing Patterns

### Pattern 1: Serial Test Suites

For flows that depend on previous state:
```typescript
test.describe('Complete Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('Step 1', async () => { /* ... */ });
  test('Step 2', async () => { /* ... */ });
});
```

### Pattern 2: API Fixtures for Setup

Use API helpers to create test data:
```typescript
test.beforeAll(async ({ api }) => {
  testCase = await api.createCaseWithGrunnlag(sakId, 'Test');
});
```

### Pattern 3: RadioItem Selection

```typescript
// Click the parent container (div containing both radio and label)
await page.locator('label:has-text("Label Text")').locator('..').click();
```

### Pattern 4: Radix Select Components

```typescript
await page.getByTestId('select-trigger').click();
await page.locator('[data-radix-select-viewport]').waitFor({ state: 'visible' });
await page.getByRole('option', { name: /Option Text/ }).click();
```

## Test Plan by Priority

### P0 - Critical Path (Must Have)

1. [ ] TE can submit grunnlag ✅
2. [ ] BH can respond to grunnlag
3. [ ] TE can submit vederlag (any method)
4. [ ] TE can submit frist (any varsel type)
5. [ ] BH can respond to vederlag
6. [ ] BH can respond to frist

### P1 - Important Scenarios

1. [ ] All 3 vederlag calculation methods work
2. [ ] All 4 frist varsel types work
3. [ ] Form validation errors display correctly
4. [ ] Role switching shows correct buttons

### P2 - Complete Coverage

1. [ ] TE update flows (revisions to grunnlag/vederlag/frist)
2. [ ] Subsidiary (subsidiær) treatment flows
3. [ ] Force Majeure special handling
4. [ ] Irregular change (irregulær endring) flows
5. [ ] BH passivity warnings
6. [ ] Preclusion (preklusjon) warnings

## Next Steps

1. **Fix RadioItem accessibility** - Add proper id generation/passing
2. **Verify tests with running backend** - Current failures may be network errors
3. **Add remaining test scenarios** - Per priority list above
4. **Add visual regression tests** - For PDF generation
5. **CI/CD integration** - Ensure backend starts in pipeline

## Commands Reference

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test e2e/grunnlag.spec.ts

# Run tests matching pattern
npx playwright test -g "Vederlag"

# Run with UI mode (debugging)
npx playwright test --ui

# Show test report
npx playwright show-report

# View trace (on failure)
npx playwright show-trace test-results/.../trace.zip
```
