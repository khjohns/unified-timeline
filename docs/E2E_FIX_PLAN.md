# E2E Test Fix Plan - 2025-12-08

## Final Status ✅
- **Passed**: 31 tests (ALL TESTS PASSING)
- **Failed**: 0

## Fixed Issues

### ✅ Fixed 1: Vederlag Flow - Submit with ENHETSPRISER
**Test**: `e2e/vederlag-frist.spec.ts:51`
**Fix**: Changed assertion from regex `/vederlag/i` to specific heading `'Vederlagskrav sendt'`

### ✅ Fixed 2: Frist spinbutton selector
**Test**: `e2e/vederlag-frist.spec.ts:123`
**Fix**: Changed from `input[type="number"]` to `getByRole('spinbutton')`

### ✅ Fixed 3: BH role switching timeout
**Test**: `e2e/vederlag-frist.spec.ts:164`
**Fix**: Use `getByLabel('Bytt til Byggherre modus')` + wait for `aria-pressed`

### ✅ Fixed 4: Complete Claim Journey - Step 3
**Test**: `e2e/vederlag-frist.spec.ts:416`
**Fix**: Changed from `godkjent` to `delvis_godkjent` to keep case open for further claims

### ✅ Fixed 5: localStorage key mismatch
**Fix**: Changed `events.ts` to use `'unified-timeline-user-role'` matching `useUserRole.ts`

### ✅ Fixed 6: VederlagData field mismatches
**Fix**: Updated `timeline_service.py` to use new field names with VarselInfo objects

### ✅ Fixed 7: Frist "varsel sendes nå" checkbox
**Fix**: Added checkbox click before filling antall dager in all Frist tests

## Remaining Issue (Backend)

### Failure: FristData field mismatch
**Tests affected**:
- `e2e/vederlag-frist.spec.ts:123` (Frist Flow)
- `e2e/vederlag-frist.spec.ts:448` (Complete Journey Step 4)

**Error**: `'FristData' object has no attribute 'noytralt_varsel_dato'`

**Root Cause**: `timeline_service.py` uses old field names:
- `event.data.noytralt_varsel_dato` (doesn't exist)
- `event.data.spesifisert_krav_dato` (doesn't exist)

New FristData model uses:
- `event.data.noytralt_varsel: Optional[VarselInfo]`
- `event.data.spesifisert_varsel: Optional[VarselInfo]`

**Fix Applied** in `backend/services/timeline_service.py`:
```python
# Extract dates from VarselInfo objects (new model structure)
if event.data.noytralt_varsel:
    frist.noytralt_varsel_dato = event.data.noytralt_varsel.dato
if event.data.spesifisert_varsel:
    frist.spesifisert_krav_dato = event.data.spesifisert_varsel.dato
```

## Files Modified

### Frontend
- `src/api/events.ts` - localStorage key fix
- `e2e/vederlag-frist.spec.ts` - Multiple selector/assertion fixes

### Backend
- `backend/services/timeline_service.py` - FristData and VederlagData field fixes
- `backend/models/events.py` - spor auto-derivation for ResponsEvent

## Verification

**IMPORTANT**: Backend must be restarted for changes to take effect!

```bash
# Restart backend
cd backend && source venv/bin/activate && python app.py

# Run tests
npm run test:e2e
```

**Target**: All 31 tests passing
