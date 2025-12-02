# Implementation Prompt: Unified Timeline Migration v4.1.1

> **Purpose:** Guide step-by-step implementation of Event Sourcing Light architecture
> **Approach:** Incremental, test-driven, quality-assured
> **Source:** `docs/UNIFIED_TIMELINE_MIGRATION_PLAN_V4_1_1.md`

---

## 🎯 Your Mission

Implement the Unified Timeline migration plan (Event Sourcing Light) for the KOE Automation System. This is a **greenfield implementation** - you should DELETE legacy code and build the new architecture from scratch.

**Critical Requirements:**
- ✅ Implement incrementally (one phase at a time)
- ✅ Test thoroughly after each step
- ✅ Quality assurance before complex implementations
- ✅ Ask for clarification when architecture is unclear
- ✅ Run existing tests to ensure no regressions

---

## 📚 How to Use the Migration Plan

The full plan is **3,973 lines** - don't try to read it all at once. Instead:

1. **Read targeted sections** as instructed in each phase
2. **Focus on one subsection at a time** (e.g., Phase 0.1, then 0.2)
3. **Implement, test, commit** before moving to next subsection
4. **Reference line numbers** when reading specific implementations

**Document structure:**
```
Lines 1-73:     Executive Summary & ADR
Lines 74-313:   Phase 0 (Prerequisites)
Lines 314-1420: Phase 1 (Backend Foundation)
  Lines 1421-2081: Phase 1.7 (Catenda Integration - HYBRID PDF)
  Lines 2082-2289: Phase 1.8 (Session-Based Magic Links)
Lines 1422-2251: Phase 2 (Frontend)
Lines 2252-2310: Phase 3 (Performance - Future Reference)
Lines 2311-2540: Phase 4 (Testing)
Lines 3067-3126: Implementation Checklist
Lines 3372-3634: Appendix E (Azure Production - Reference Only)
```

---

## 🚀 Implementation Phases

### **Pre-Implementation: Setup & Understanding**

1. **Read Executive Summary** (lines 1-73)
   ```bash
   # Read overview and architecture decision
   cat docs/UNIFIED_TIMELINE_MIGRATION_PLAN_V4_1_1.md | head -n 73
   ```

2. **Review current codebase structure**
   ```bash
   # Understand existing code
   ls -la backend/
   ls -la utils/pdf/
   git log --oneline -10  # Recent changes
   ```

3. **Run existing tests** (if any)
   ```bash
   cd backend
   pytest -v  # Check current test coverage
   ```

4. **Create implementation branch**
   ```bash
   git checkout -b implementation/event-sourcing-migration
   ```

---

## 📋 Phase 0: Prerequisites (CRITICAL - DO FIRST!)

> **Goal:** Implement missing infrastructure components before starting main implementation
> **Read:** Lines 74-313 of migration plan

### Step 0.1: Magic Link Decorator

**Read section:** Lines 77-151 (Phase 0.1)

**Tasks:**
1. Read the section carefully
2. Implement `require_magic_link` decorator in `backend/lib/auth/magic_link.py`
3. Export decorator in `backend/lib/auth/__init__.py`
4. Write unit test for decorator

**Implementation:**
```bash
# 1. Read the implementation
grep -A 80 "### 0.1 Magic Link Decorator" docs/UNIFIED_TIMELINE_MIGRATION_PLAN_V4_1_1.md

# 2. Implement the decorator
# (Copy implementation from plan lines 82-126)

# 3. Write test
cat > backend/tests/test_auth/test_magic_link_decorator.py << 'EOF'
import pytest
from flask import Flask, jsonify
from lib.auth import require_magic_link

def test_require_magic_link_missing_token():
    app = Flask(__name__)

    @app.route('/test')
    @require_magic_link
    def test_route():
        return jsonify({"success": True})

    with app.test_client() as client:
        response = client.get('/test')
        assert response.status_code == 401
        assert b"Mangler magic link token" in response.data

# Add more tests...
EOF

# 4. Run test
pytest backend/tests/test_auth/test_magic_link_decorator.py -v
```

**Validation:**
- [ ] Decorator blocks requests without token
- [ ] Decorator accepts valid tokens
- [ ] Decorator rejects expired/invalid tokens
- [ ] Test coverage > 90%

**Commit:** `git commit -m "feat: Add require_magic_link decorator (Phase 0.1)"`

---

### Step 0.2: Sak Metadata Repository

**Read section:** Lines 152-248 (Phase 0.2)

**Tasks:**
1. Create `backend/models/sak_metadata.py`
2. Create `backend/repositories/sak_metadata_repository.py`
3. Write comprehensive tests

**Quality Check BEFORE Implementation:**
- [ ] Review existing CSV repository pattern
- [ ] Understand cache update requirements
- [ ] Plan test cases

**Implementation:**
```bash
# 1. Read the implementation
sed -n '152,248p' docs/UNIFIED_TIMELINE_MIGRATION_PLAN_V4_1_1.md

# 2. Implement models and repository
# (Follow plan implementation)

# 3. Write tests
pytest backend/tests/test_repositories/test_sak_metadata_repository.py -v
```

**Validation:**
- [ ] Can create metadata entries
- [ ] Can update cached fields
- [ ] Can search by sak_id
- [ ] CSV format is correct
- [ ] All tests pass

**Commit:** `git commit -m "feat: Add SakMetadataRepository (Phase 0.2)"`

---

### Step 0.3: Platform Requirements Documentation

**Read section:** Lines 249-313 (Phase 0.3)

**Tasks:**
1. Document platform requirements in README
2. Add environment checks
3. Validate fcntl availability (macOS/Linux)

**Commit:** `git commit -m "docs: Add platform requirements (Phase 0.3)"`

---

## 📋 Phase 1: Backend Foundation

> **Goal:** Implement core Event Sourcing infrastructure
> **Read:** Lines 314-1420 of migration plan

### Step 1.1: Simplified Data Model

**Read section:** Lines 316-360 (Phase 1.1)

**QUALITY ASSURANCE CHECKPOINT:**
Before implementing, answer these questions:
1. What are the three independent tracks (Spor)?
2. How does SakState differ from the old FormDataModel?
3. What fields are immutable vs computed?
4. How do we handle "ikke relevant" for each track?

**Tasks:**
1. Read existing types in `types/` directory
2. Create `backend/models/sak_state.py` with Pydantic models
3. Create `backend/models/events.py` with all event types
4. Write validation tests

**Implementation:**
```bash
# 1. Review current data model
cat types/index.ts  # Understand current structure

# 2. Read Phase 1.1 implementation
sed -n '316,360p' docs/UNIFIED_TIMELINE_MIGRATION_PLAN_V4_1_1.md

# 3. Implement Pydantic models
# (Follow plan - includes GrunnlagSpor, VederlagSpor, FristSpor, SakState)

# 4. Test models
pytest backend/tests/test_models/test_sak_state.py -v
```

**Validation:**
- [ ] All Pydantic models validate correctly
- [ ] JSON serialization works
- [ ] Immutable fields cannot be changed
- [ ] Default values are correct

**Commit:** `git commit -m "feat: Add SakState and event models (Phase 1.1)"`

---

### Step 1.2: Event Repository with Optimistic Locking

**Read section:** Lines 361-542 (Phase 1.2)

**QUALITY ASSURANCE CHECKPOINT:**
This is CRITICAL for data integrity. Before implementing:
1. Understand optimistic concurrency control (OCC)
2. Review fcntl file locking on your platform
3. Plan atomic batch append strategy
4. Design ConcurrencyError handling

**Tasks:**
1. Create `backend/repositories/event_repository.py`
2. Implement `JsonFileEventRepository` with fcntl locking
3. Write comprehensive concurrency tests

**Implementation:**
```bash
# 1. Read implementation carefully
sed -n '361,542p' docs/UNIFIED_TIMELINE_MIGRATION_PLAN_V4_1_1.md

# 2. Implement repository
# CRITICAL: Test file locking on your platform first!

# 3. Test concurrency
python backend/tests/test_repositories/test_event_repository_concurrency.py
```

**Concurrency Test (CRITICAL):**
```python
# backend/tests/test_repositories/test_event_repository_concurrency.py
import pytest
from concurrent.futures import ThreadPoolExecutor, as_completed
from repositories.event_repository import JsonFileEventRepository, ConcurrencyError

def test_concurrent_writes_raise_conflict():
    """Test that concurrent writes are properly detected"""
    repo = JsonFileEventRepository()
    sak_id = "TEST-001"

    # Create initial event
    event1 = create_test_event(sak_id, "Event 1")
    repo.append_batch([event1], expected_version=0)

    # Attempt concurrent writes with same expected_version
    def concurrent_write(event_data):
        event = create_test_event(sak_id, event_data)
        return repo.append_batch([event], expected_version=1)

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(concurrent_write, f"Event {i}") for i in range(5)]

        success_count = 0
        conflict_count = 0

        for future in as_completed(futures):
            try:
                future.result()
                success_count += 1
            except ConcurrencyError:
                conflict_count += 1

        # Exactly ONE should succeed, others should conflict
        assert success_count == 1
        assert conflict_count == 4

# Add 10+ more concurrency tests...
```

**Validation:**
- [ ] File locking works correctly
- [ ] Atomic batch append is atomic
- [ ] Concurrent writes are detected (TEST EXTENSIVELY!)
- [ ] ConcurrencyError has correct expected/actual versions
- [ ] Events are never lost or duplicated
- [ ] JSON file format is correct

**Commit:** `git commit -m "feat: Add EventRepository with optimistic locking (Phase 1.2)"`

---

### Step 1.3: Event Parsing & Validation

**Read section:** Lines 543-612 (Phase 1.3)

**Tasks:**
1. Implement `parse_event()` function
2. Add server-controlled field validation
3. Test all event types

**Commit:** `git commit -m "feat: Add event parsing with validation (Phase 1.3)"`

---

### Step 1.4: Timeline Service (Event Replay)

**Read section:** Lines 613-919 (Phase 1.4 in plan)

**QUALITY ASSURANCE CHECKPOINT:**
Event replay is the CORE of Event Sourcing. Before implementing:
1. Understand the replay algorithm
2. Map each event type to state transitions
3. Plan test cases for all state combinations
4. Consider edge cases (empty events, out-of-order, etc.)

**Implementation Strategy:**
```bash
# 1. Create TimelineService skeleton
cat > backend/services/timeline_service.py << 'EOF'
class TimelineService:
    def compute_state(self, events: List[AnyEvent]) -> SakState:
        """Replay events to compute current state"""
        # Start with empty state
        state = SakState.create_empty()

        # Apply each event in order
        for event in events:
            state = self._apply_event(state, event)

        return state

    def _apply_event(self, state: SakState, event: AnyEvent) -> SakState:
        """Apply single event to state (pure function)"""
        # Implement event handlers...
        pass
EOF

# 2. Implement event handlers one at a time
# Test after EACH handler!

# 3. Write comprehensive replay tests
pytest backend/tests/test_services/test_timeline_service.py -v
```

**Test Strategy:**
```python
# Test EVERY event type independently
def test_sak_opprettet_event():
    service = TimelineService()
    event = SakOpprettetEvent(sak_id="TEST-001", sakstittel="Test")
    state = service.compute_state([event])
    assert state.sak_id == "TEST-001"
    assert state.sakstittel == "Test"

def test_grunnlag_opprettet_event():
    # ...

def test_vederlag_krav_sendt_event():
    # ...

# Test event sequences
def test_full_koe_workflow():
    events = [
        SakOpprettetEvent(...),
        GrunnlagEvent(...),
        VederlagEvent(...),
        ResponsEvent(...)
    ]
    state = service.compute_state(events)
    # Assert final state is correct
```

**Validation:**
- [ ] All event types handled correctly
- [ ] State transitions follow business rules
- [ ] Independent tracks don't interfere
- [ ] Replay is deterministic (same events = same state)
- [ ] Performance acceptable (<5ms for 100 events)

**Commit:** `git commit -m "feat: Add TimelineService with event replay (Phase 1.4)"`

---

### Step 1.5: Business Rule Validators

**Read section:** Lines 920-1159 (Phase 1.5)

**Tasks:**
1. Create `backend/services/business_rules.py`
2. Implement all validation rules
3. Write unit tests for EVERY rule

**Validation Rules to Implement:**
- `validate_grunnlag_event()` - Only TE can create, required fields
- `validate_vederlag_event()` - TE only, amount > 0, valid metode
- `validate_frist_event()` - TE only, dager > 0, valid frist_type
- `validate_respons_event()` - Only BH can respond, track must be SENDT
- `validate_laas_event()` - Only if GODKJENT

**Commit:** `git commit -m "feat: Add business rule validators (Phase 1.5)"`

---

### Step 1.6: API Routes (Event Submission)

**Read section:** Lines 613-919 (actual event_routes implementation in plan)

**QUALITY ASSURANCE CHECKPOINT:**
This is where everything comes together. Before implementing:
1. Review the complete event submission flow
2. Understand cache update requirements
3. Plan error handling for all scenarios
4. Design API response format

**Tasks:**
1. Create `backend/routes/event_routes.py`
2. Implement POST /api/events endpoint
3. Integrate: parsing → validation → persistence → replay → cache update
4. Test all error scenarios

**Commit:** `git commit -m "feat: Add event submission routes (Phase 1.6)"`

---

### Step 1.7: Intelligent Catenda Integration (HYBRID PDF)

**Read section:** Lines 1421-2081 (Phase 1.7 - HYBRID APPROACH)

**CRITICAL:** This phase uses HYBRID PDF generation:
- Primary: React PDF/Renderer (frontend)
- Fallback: WeasyPrint (backend)

**Sub-steps:**

#### 1.7.1: Frontend PDF Adaptation

**Read:** Lines 1431-1567 (Frontend PDF section)

**Tasks:**
1. Review existing `utils/pdf/pdfGenerator.ts`
2. Add `generatePdfBlobFromState()` function
3. Add `blobToBase64()` helper
4. Update `KoePdfDocument` to accept `SakState`

**Implementation:**
```bash
# 1. Review existing PDF code
cat utils/pdf/pdfGenerator.ts
cat utils/pdf/pdfComponents.tsx

# 2. Read implementation from plan
sed -n '1431,1567p' docs/UNIFIED_TIMELINE_MIGRATION_PLAN_V4_1_1.md

# 3. Implement new functions
# (Follow plan implementation)

# 4. Test PDF generation
npm run test:pdf  # If test exists
```

**Validation:**
- [ ] Can generate PDF from SakState
- [ ] Can convert to base64
- [ ] PDF matches existing layout
- [ ] File size reasonable (<500KB)

**Commit:** `git commit -m "feat: Adapt React PDF for SakState (Phase 1.7.1)"`

---

#### 1.7.2: Frontend Event Submission with PDF

**Read:** Lines 1568-1680 (Event submission hook)

**Tasks:**
1. Create `hooks/useEventSubmit.ts`
2. Integrate PDF generation
3. Handle PDF generation errors gracefully

**Commit:** `git commit -m "feat: Add useEventSubmit hook with PDF (Phase 1.7.2)"`

---

#### 1.7.3: Backend Accept Optional PDF

**Read:** Lines 1681-1967 (Backend hybrid PDF handling)

**Tasks:**
1. Update `backend/routes/event_routes.py` to accept `pdf_base64`
2. Implement priority: client PDF → server fallback
3. Add logging for monitoring

**Commit:** `git commit -m "feat: Accept optional client PDF in backend (Phase 1.7.3)"`

---

#### 1.7.4: Backend Fallback (WeasyPrint)

**Read:** Lines 1968-2036 (WeasyPrint generator)

**Tasks:**
1. Install WeasyPrint: `pip install weasyprint jinja2`
2. Create `backend/services/weasyprint_generator.py`
3. Test fallback generation

**Testing:**
```python
def test_weasyprint_fallback():
    generator = WeasyPrintGenerator()
    state = create_test_state()

    output_path = "/tmp/test_koe.pdf"
    success = generator.generate_koe_pdf(state, output_path)

    assert success
    assert os.path.exists(output_path)
    assert os.path.getsize(output_path) > 1000  # PDF has content
```

**Commit:** `git commit -m "feat: Add WeasyPrint fallback generator (Phase 1.7.4)"`

---

#### 1.7.5: Intelligent Comment Generator

**Read:** Lines 2037-2081 (Comment generator section from v4.1)

**Tasks:**
1. Create `backend/services/catenda_comment_generator.py`
2. Implement emoji mapping
3. Implement dynamic "next step" logic

**Commit:** `git commit -m "feat: Add intelligent comment generator (Phase 1.7.5)"`

---

### Step 1.8: Session-Based Magic Links

**Read section:** Lines 2082-2289 (Phase 1.8)

**Tasks:**
1. Update `backend/lib/auth/magic_link.py` verify() method
2. Add `mark_as_used` parameter (default False)
3. Update decorator to use session-based verification
4. Test multi-request scenarios

**Testing:**
```python
def test_session_based_token():
    manager = MagicLinkManager()
    token = manager.generate(sak_id="TEST-001")

    # First verification (session-based)
    valid1, msg1, data1 = manager.verify(token, mark_as_used=False)
    assert valid1

    # Second verification (should still work)
    valid2, msg2, data2 = manager.verify(token, mark_as_used=False)
    assert valid2

    # Third verification (should still work)
    valid3, msg3, data3 = manager.verify(token, mark_as_used=False)
    assert valid3
```

**Commit:** `git commit -m "feat: Implement session-based magic links (Phase 1.8)"`

---

## 📋 Phase 2: Frontend - "Kill the Form"

> **Goal:** Replace mutable form components with Event Sourcing UI
> **Read:** Lines 1422-2251 of migration plan

### Step 2.1: Delete Legacy Components

**Read section:** Lines 1424-1490 (Phase 2.1)

**BEFORE DELETING:**
1. Create a backup branch: `git branch backup/legacy-components`
2. Run all existing tests one last time
3. Document what's being deleted

**Tasks:**
1. Delete legacy panels
2. Delete legacy hooks
3. Delete legacy types

**Commit:** `git commit -m "refactor: Delete legacy form components (Phase 2.1)"`

---

### Step 2.2: New Timeline Types

**Read section:** Lines 1491-1659 (Phase 2.2)

**Tasks:**
1. Create `types/timeline.ts` with all Event Sourcing types
2. Match backend Pydantic models exactly

**Commit:** `git commit -m "feat: Add timeline types for Event Sourcing (Phase 2.2)"`

---

### Step 2.3: React Hooks

**Read section:** Lines 1660-1848 (Phase 2.3)

**Tasks:**
1. Create `hooks/useCaseState.ts` - State fetching and replay
2. Create `hooks/useEventSubmit.ts` - Event submission with OCC
3. Handle version conflicts in UI

**Commit:** `git commit -m "feat: Add Event Sourcing React hooks (Phase 2.3)"`

---

### Step 2.4: View Components

**Read section:** Lines 1849-2060 (Phase 2.4)

**Tasks:**
1. Create `components/timeline/GrunnlagCard.tsx` - Read-only view
2. Create `components/timeline/VederlagCard.tsx` - Read-only view
3. Create `components/timeline/FristCard.tsx` - Read-only view
4. Style with Punkt design system

**Commit:** `git commit -m "feat: Add timeline view components (Phase 2.4)"`

---

### Step 2.5: Action Modals

**Read section:** Lines 2061-2189 (Phase 2.5)

**Tasks:**
1. Create action modals for each event type
2. Implement version conflict handling UI
3. Add loading states and error handling

**Commit:** `git commit -m "feat: Add event action modals (Phase 2.5)"`

---

### Step 2.6: TimelineView Integration

**Read section:** Lines 2190-2251 (Phase 2.6)

**Tasks:**
1. Create `components/timeline/TimelineView.tsx`
2. Integrate all cards and modals
3. Replace main App.tsx with new component

**Commit:** `git commit -m "feat: Add TimelineView component (Phase 2.6)"`

---

## 📋 Phase 3: Integration & Testing

### Step 3.1: End-to-End Testing

**Tasks:**
1. Test complete workflow: create case → varsel → koe → svar → godkjent
2. Test concurrent submissions from TE and BH
3. Test PDF generation and Catenda upload
4. Test version conflict scenarios

**Test Cases:**
```bash
# Manual E2E test
1. Create case via Catenda webhook
2. Submit grunnlag event (TE)
3. Submit vederlag event (TE)
4. Verify PDF uploaded to Catenda
5. Verify intelligent comment posted
6. Submit respons event (BH)
7. Verify all tracks updated correctly
8. Test version conflict by submitting with wrong expected_version
```

---

### Step 3.2: Performance Validation

**Tasks:**
1. Benchmark event replay (should be <5ms for 100 events)
2. Test with realistic case sizes
3. Verify cache updates are fast

---

### Step 3.3: Security Audit

**Tasks:**
1. Verify server-controlled fields cannot be overridden
2. Test magic link security (expiry, one-time-use when needed)
3. Verify CSRF protection on all routes
4. Check debug routes are NOT loaded in production

---

## 🎯 Testing Strategy

### After Each Step:
```bash
# 1. Run unit tests
pytest backend/tests/ -v

# 2. Run type checking
mypy backend/

# 3. Run linting
flake8 backend/
black backend/ --check

# 4. Commit if all pass
git add .
git commit -m "feat: ..."
```

### Before Moving to Next Phase:
```bash
# 1. Run all tests
pytest backend/tests/ -v --cov

# 2. Manual smoke test
python backend/app.py  # Start server
# Test in browser

# 3. Git checkpoint
git tag "phase-X-complete"
git push origin implementation/event-sourcing-migration
```

---

## 🚨 When to Ask for Help

**STOP and ask if:**
1. ❓ Architecture decision is unclear
2. ❓ Business rule interpretation is ambiguous
3. ❓ Test is failing and you don't understand why
4. ❓ Performance is significantly worse than expected
5. ❓ Concurrency test shows data corruption
6. ❓ Integration with existing code is unclear

**Don't proceed if:**
- Tests are failing
- You're not confident in correctness
- Data integrity could be compromised

---

## 📊 Progress Tracking

Use this checklist (also in plan lines 3067-3126):

### Phase 0: Prerequisites
- [ ] Magic link decorator implemented and tested
- [ ] Sak metadata repository implemented and tested
- [ ] Platform requirements documented

### Phase 1: Backend
- [ ] Data models (SakState, Events) implemented
- [ ] Event repository with OCC implemented
- [ ] Timeline service (replay) implemented
- [ ] Business rules implemented
- [ ] Event routes implemented
- [ ] Catenda integration (hybrid PDF) implemented
- [ ] Session-based magic links implemented

### Phase 2: Frontend
- [ ] Legacy components deleted
- [ ] Timeline types defined
- [ ] React hooks implemented
- [ ] View components implemented
- [ ] Action modals implemented
- [ ] TimelineView integrated

### Phase 3: Testing
- [ ] E2E tests passing
- [ ] Performance validated
- [ ] Security audited

---

## 🎉 Definition of Done

A phase is complete when:
- ✅ All code implemented per plan
- ✅ All unit tests passing (>90% coverage)
- ✅ Manual testing confirms functionality
- ✅ Code reviewed (if applicable)
- ✅ Committed with clear message
- ✅ No regressions in existing functionality

---

## 📝 Final Notes

**Remember:**
- Event Sourcing is all about **immutability** and **replay**
- Every state change must come from an **event**
- **Test concurrency extensively** - data integrity is critical
- **Incremental commits** - easier to debug and rollback
- **Quality over speed** - take time to understand before implementing

**Good luck! 🚀**

If you get stuck, refer back to specific sections of the migration plan using line numbers.
