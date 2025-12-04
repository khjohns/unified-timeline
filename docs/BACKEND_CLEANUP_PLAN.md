# Backend Cleanup Plan - Event Sourcing Migration

**Date:** 2025-12-04
**Status:** DRAFT - Review before execution
**Purpose:** Remove deprecated legacy code after Event Sourcing refactoring

---

## Executive Summary

After migrating to Event Sourcing architecture, significant legacy code remains that:
1. Uses old document-based models (Sak, Varsel, KoeRevisjon, BHSvar)
2. Depends on deprecated constants (`generated_constants.py`, `status_helpers.py`)
3. Implements routes/services no longer used by the application
4. Has test coverage that needs updating

**Impact:** ~40 files affected, ~15 files to delete

---

## Phase 1: Analysis - What We Found

### 🔴 Deprecated Core Modules

#### `backend/core/generated_constants.py`
**Status:** DEPRECATED - Replaced by `backend/constants/`
**Used by:** 20+ files
**Replacement:**
- `backend/constants/grunnlag_categories.py` - NS 8407 categories
- `backend/constants/vederlag_methods.py` - Payment methods
- `models/events.py` - Enums (EventType, SporStatus, etc.)

**Files referencing it:**
```
backend/repositories/csv_repository.py          - Uses SAK_STATUS, KOE_STATUS
backend/routes/svar_routes.py                   - Uses BH_SVAR_STATUS
backend/routes/koe_routes.py                    - Uses BH_SVAR_STATUS, KOE_STATUS
backend/routes/varsel_routes.py                 - Uses KOE_STATUS
backend/models/koe_revisjon.py                  - Uses KOE_STATUS
backend/models/bh_svar.py                       - Uses BH_SVAR_STATUS
backend/core/status_helpers.py                  - Uses constants
backend/services/svar_service.py                - Uses BH_SVAR_STATUS
backend/services/webhook_service.py             - Uses SAK_STATUS
backend/services/timeline_service.py            - References it in comment
backend/services/sak_api_service.py             - Uses get_vederlagsmetoder_label
backend/tests/* (10+ test files)                - Use various constants
```

#### `backend/core/status_helpers.py`
**Status:** DEPRECATED - Logic moved to business_rules.py
**Used by:** 2 files
**Functions:**
- `krever_revisjon()` - Moved to business_rules.py
- `beregn_bh_svar_status()` - Replaced by Port model in ResponsData

**Files referencing it:**
```
backend/routes/svar_routes.py                   - Uses krever_revisjon
backend/services/svar_service.py                - Uses krever_revisjon
```

---

### 🔴 Deprecated Routes

#### Routes to DELETE:
1. **`backend/routes/case_routes.py`** - Document-based case management
   - Uses CSVRepository
   - NOT imported in app.py anymore ✅
   - Replaced by: event_routes.py GET /api/cases/<id>/state

2. **`backend/routes/varsel_routes.py`** - Old varsel submission
   - Uses varsel_service.py
   - NOT imported in app.py anymore ✅
   - Replaced by: event_routes.py POST /api/events (event_type: grunnlag_opprettet)

3. **`backend/routes/koe_routes.py`** - Old KOE submission
   - Uses koe_service.py
   - NOT imported in app.py anymore ✅
   - Replaced by: event_routes.py POST /api/events (event_type: vederlag/frist)

4. **`backend/routes/svar_routes.py`** - Old BH response
   - Uses svar_service.py
   - NOT imported in app.py anymore ✅
   - Replaced by: event_routes.py POST /api/events (event_type: respons_*)

#### Routes to KEEP:
- ✅ `event_routes.py` - Event Sourcing routes
- ✅ `webhook_routes.py` - Catenda webhooks (needs refactoring, see Phase 3)
- ✅ `utility_routes.py` - Health, CSRF, magic links
- ✅ `error_handlers.py` - Error handling

---

### 🔴 Deprecated Services

#### Services to DELETE:
1. **`backend/services/varsel_service.py`** - Old varsel logic
   - Replaced by: timeline_service.py + business_rules.py

2. **`backend/services/koe_service.py`** - Old KOE logic
   - Replaced by: timeline_service.py + business_rules.py

3. **`backend/services/svar_service.py`** - Old BH response logic
   - Replaced by: timeline_service.py + business_rules.py

#### Services to KEEP:
- ✅ `business_rules.py` - Business rule validation (Event Sourcing)
- ✅ `timeline_service.py` - Event replay and state computation
- ✅ `catenda_service.py` - Catenda API integration
- ✅ `catenda_comment_generator.py` - Comment generation
- ✅ `weasyprint_generator.py` - PDF generation
- ⚠️ `webhook_service.py` - **NEEDS REFACTORING** (see Phase 3)
- ⚠️ `sak_api_service.py` - **ASSESS** (may be unused)

---

### 🔴 Deprecated Models

#### Models to DELETE (after migration helper is no longer needed):
1. **`backend/models/varsel.py`** - Old varsel model
   - Replaced by: GrunnlagEvent, GrunnlagData

2. **`backend/models/koe_revisjon.py`** - Old KOE model
   - Replaced by: VederlagEvent, FristEvent

3. **`backend/models/bh_svar.py`** - Old BH response model
   - Replaced by: ResponsEvent, ResponsData

4. **`backend/models/sak.py`** - Old document model
   - Replaced by: SakState (computed from events)

⚠️ **Keep temporarily:** These models are used by the migration helper to convert old CSV data to events. Mark as @deprecated for now.

#### Models to KEEP:
- ✅ `events.py` - Event definitions (Event Sourcing)
- ✅ `sak_state.py` - Computed state model
- ✅ `api_responses.py` - API response models
- ✅ `sak_metadata.py` - Case metadata (lightweight)

---

### 🔴 Deprecated Repositories

#### Repositories to DELETE (after data migration):
1. **`backend/repositories/csv_repository.py`** - Old CSV storage
   - Replaced by: event_repository.py (JSON event log)

⚠️ **Keep temporarily:** May be needed for migrating old data. Mark as @deprecated.

#### Repositories to KEEP:
- ✅ `event_repository.py` - Event store with optimistic locking
- ✅ `sak_metadata_repository.py` - Case metadata cache

---

### 🔴 Deprecated Tests

#### Test files to DELETE:
```
backend/tests/test_models/test_sak.py                    - Tests old Sak model
backend/tests/test_repositories/test_csv_repository.py   - Tests CSVRepository
backend/tests/test_routes/test_case_routes.py            - Tests case_routes.py
backend/tests/test_routes/test_workflow_routes.py        - Tests old workflow
backend/tests/test_services/test_varsel_service.py       - Tests varsel_service.py
backend/tests/test_services/test_koe_service.py          - Tests koe_service.py
backend/tests/test_services/test_svar_service.py         - Tests svar_service.py
backend/tests/test_services/test_webhook_service.py      - Tests old webhook logic
```

#### Test files to KEEP:
```
✅ backend/tests/test_models/test_events.py              - Tests event models (NEW)
✅ backend/tests/test_models/test_event_parsing.py       - Tests event parsing
✅ backend/tests/test_repositories/test_event_repository.py  - Tests event store
✅ backend/tests/test_routes/test_event_routes.py        - Tests event routes
✅ backend/tests/test_services/test_business_rules.py    - Tests business rules
✅ backend/tests/test_auth/*                             - Tests auth system
✅ backend/tests/test_security/*                         - Tests security
```

---

## Phase 2: Functionality Assessment

### ⚠️ Critical: webhook_service.py Needs Refactoring

**Current State:**
- Uses `generated_constants.SAK_STATUS`
- Uses `CSVRepository` for data access
- Creates/updates old Sak documents

**Required Changes:**
1. Replace `SAK_STATUS` with `SporStatus` from events.py
2. Replace `CSVRepository` with `EventRepository`
3. When webhook creates new case:
   - Generate `SakOpprettetEvent`
   - Persist to event store
   - Create magic link
   - Post comment to Catenda

**Implementation:**
```python
# OLD (webhook_service.py)
def handle_topic_created(topic: Dict):
    sak_data = {
        "sak": {
            "sakId": f"SAK-{timestamp}",
            "status": SAK_STATUS["OPPRETTET"],
            ...
        }
    }
    self.repo.save_form_data(sak_id, sak_data)

# NEW (webhook_service.py - REFACTORED)
def handle_topic_created(topic: Dict):
    event = SakOpprettetEvent(
        sak_id=f"SAK-{timestamp}",
        sakstittel=topic['title'],
        aktor="System",
        aktor_rolle="TE",
        catenda_topic_id=topic['guid'],
        ...
    )
    self.event_repo.append(event, expected_version=0)
```

---

### ⚠️ Assess: sak_api_service.py

**Purpose:** Generates API responses from SakState
**Status:** Unknown if used
**Action:**
1. Search for imports of sak_api_service
2. If unused → DELETE
3. If used → Verify it works with new SakState model

---

### ✅ Keep: system_context.py

**Purpose:** Provides legacy compatibility layer
**Current use:** Webhook routes access `sys.db` and `sys.catenda`
**Action after webhook refactoring:**
- If webhook no longer needs CSVRepository → DELETE system_context.py
- If only used for Catenda client → Simplify to just CatendaClient initialization

---

## Phase 3: Execution Plan

### Step 1: Refactor webhook_service.py (HIGH PRIORITY)
**Why first:** Webhook integration is critical for Catenda workflow

**Tasks:**
1. Read current webhook_service.py implementation
2. Identify all webhook event types (topic_created, status_changed, comment_added)
3. Rewrite to use EventRepository and generate events
4. Update webhook_routes.py to use refactored service
5. Write new tests for refactored webhook service

**Files affected:**
- `backend/services/webhook_service.py` - Refactor
- `backend/routes/webhook_routes.py` - Update imports
- `backend/tests/test_services/test_webhook_service.py` - Rewrite tests

---

### Step 2: Update models/__init__.py
**Tasks:**
1. Add deprecation markers to legacy models:
   ```python
   # Legacy models (DEPRECATED - kept for data migration only)
   import warnings
   warnings.warn(
       "Legacy models (Sak, Varsel, etc.) are deprecated. "
       "Use events.py models instead.",
       DeprecationWarning
   )
   ```

---

### Step 3: Delete deprecated routes
**Tasks:**
1. Verify app.py doesn't import them ✅ (already done)
2. Delete files:
   ```bash
   rm backend/routes/case_routes.py
   rm backend/routes/varsel_routes.py
   rm backend/routes/koe_routes.py
   rm backend/routes/svar_routes.py
   ```

---

### Step 4: Delete deprecated services
**Tasks:**
1. Delete files:
   ```bash
   rm backend/services/varsel_service.py
   rm backend/services/koe_service.py
   rm backend/services/svar_service.py
   ```

---

### Step 5: Delete deprecated core modules
**Tasks:**
1. Verify no active code uses them (only deprecated routes/services)
2. Delete files:
   ```bash
   rm backend/core/generated_constants.py
   rm backend/core/status_helpers.py
   ```

---

### Step 6: Delete deprecated tests
**Tasks:**
1. Delete test files that test deleted code
2. Run remaining tests to ensure nothing breaks:
   ```bash
   pytest backend/tests/test_models/test_events.py
   pytest backend/tests/test_repositories/test_event_repository.py
   pytest backend/tests/test_routes/test_event_routes.py
   pytest backend/tests/test_services/test_business_rules.py
   ```

---

### Step 7: Assess and clean sak_api_service.py
**Tasks:**
1. Search for usage: `grep -r "sak_api_service" backend/`
2. If unused → Delete
3. If used → Verify compatibility with SakState

---

### Step 8: Simplify system_context.py (if possible)
**Tasks:**
1. After webhook refactoring, check if CSVRepository is still needed
2. If not → Simplify to just Catenda client wrapper
3. If still needed → Keep but mark as temporary

---

### Step 9: Mark legacy models as deprecated
**Tasks:**
1. Add deprecation warnings to:
   - `models/sak.py`
   - `models/varsel.py`
   - `models/koe_revisjon.py`
   - `models/bh_svar.py`
   - `repositories/csv_repository.py`

2. Keep these files temporarily for data migration helper

---

### Step 10: Update documentation
**Tasks:**
1. Update README.md to reflect Event Sourcing architecture
2. Update QUICKSTART.md (already done ✅)
3. Mark migration guides in docs/

---

## Phase 4: Verification

### Test Checklist
- [ ] All new event tests pass (32/32)
- [ ] Event routes tests pass
- [ ] Business rules tests pass
- [ ] Auth/security tests pass
- [ ] Webhook integration still works (after refactoring)
- [ ] Backend starts without errors
- [ ] Frontend can connect and submit events
- [ ] No import errors for removed modules

### Manual Testing
- [ ] Start backend: `python backend/app.py`
- [ ] Check no warnings about missing imports
- [ ] Test event submission via API
- [ ] Test state retrieval
- [ ] Test webhook (if Catenda configured)

---

## Phase 5: Risk Assessment

### High Risk
- **webhook_service.py refactoring** - Critical for Catenda integration
  - Mitigation: Write comprehensive tests first
  - Fallback: Keep old webhook_service.py as webhook_service_legacy.py until verified

### Medium Risk
- **Deleting tests** - May remove valuable test cases
  - Mitigation: Review each test before deletion
  - Archive old tests in `backend/tests/legacy/` instead of deleting

### Low Risk
- **Deleting unused routes/services** - Already not imported in app.py
- **Deleting deprecated constants** - Already replaced by new constants

---

## Files Summary

### DELETE (15 files):
```
backend/core/generated_constants.py
backend/core/status_helpers.py
backend/routes/case_routes.py
backend/routes/varsel_routes.py
backend/routes/koe_routes.py
backend/routes/svar_routes.py
backend/services/varsel_service.py
backend/services/koe_service.py
backend/services/svar_service.py
backend/tests/test_models/test_sak.py
backend/tests/test_repositories/test_csv_repository.py
backend/tests/test_routes/test_case_routes.py
backend/tests/test_routes/test_workflow_routes.py
backend/tests/test_services/test_varsel_service.py
backend/tests/test_services/test_koe_service.py
backend/tests/test_services/test_svar_service.py
backend/tests/test_services/test_webhook_service.py (rewrite instead)
```

### REFACTOR (2 files):
```
backend/services/webhook_service.py - Migrate to Event Sourcing
backend/routes/webhook_routes.py - Update to use refactored service
```

### DEPRECATE (5 files - keep temporarily):
```
backend/models/sak.py - For migration helper
backend/models/varsel.py - For migration helper
backend/models/koe_revisjon.py - For migration helper
backend/models/bh_svar.py - For migration helper
backend/repositories/csv_repository.py - For data migration
```

### ASSESS (2 files):
```
backend/services/sak_api_service.py - Check if used, delete if not
backend/core/system_context.py - Simplify after webhook refactoring
```

---

## Recommended Execution Order

1. **CRITICAL FIRST:** Refactor webhook_service.py (Phase 3, Step 1)
2. Delete deprecated routes (Step 3)
3. Delete deprecated services (Step 4)
4. Delete deprecated core modules (Step 5)
5. Delete deprecated tests (Step 6)
6. Assess sak_api_service (Step 7)
7. Clean up system_context (Step 8)
8. Mark legacy models as deprecated (Step 9)
9. Verify everything works (Phase 4)

**Estimated time:** 4-6 hours (webhook refactoring is bulk of work)

---

## Decision Required

**Should we proceed with this cleanup plan?**

Options:
1. ✅ **Proceed with full cleanup** - Remove all deprecated code
2. ⏸️ **Partial cleanup** - Only delete routes/services, keep models for migration
3. ❌ **Defer cleanup** - Keep everything until production deployment

**Recommendation:** Proceed with full cleanup, but:
- Start with webhook refactoring and test thoroughly
- Archive old tests to `backend/tests/legacy/` instead of deleting
- Keep deprecated models with warnings until data migration is complete

---

**Next steps:** Review this plan and confirm approach before execution.
