# Handoff Summary: Logic Fixes for DESIGN_WORKSPACE_PANELS.md

This handoff document outlines corrections and additions needed for a contract administration tool design based on NS 8407. Four Claude Sonnet agents have reviewed the design against the React/TypeScript implementation in `unified-timeline/`, identifying discrepancies across four domain areas.

## Three-Part Task Structure

**Task 1: Fix 9 Errors** — Direct corrections to existing text:
- Frafalt visibility (add conditional logic)
- §32.2 notification exclusion for EO category
- Passivity thresholds (correct amber/red ranges, add EO exception)
- Footer section references (verify correct statutory citations)
- §33.1 reclassification (separate from objections into causation assessment)
- 30%-rule presentation (convert to read-only key-value display)
- Enforced cost verdict terminology clarification
- Withdrawal justification (change from required to optional)

**Task 2: Add 8 Missing Sections** — New content blocks:
- Request lifecycle (§33.6.2 forespørsel flow with response evaluation)
- Consequence asymmetry documentation (§33.4 vs. §33.6.1 outcomes)
- §33.8 acceleration warning (triggered by partial/rejected deadlines)
- Broader subsidiary condition triggers
- Response obligation alert (vederlag over 5-day threshold)
- Per-claim line evaluation for acceleration (rigg/drift, produktivitet)
- Per-track acceptance logic (not global)
- Per-track withdrawal with cascade rules

**Task 3: Mock Component Planning** — Defer until user approval; document what's missing (TE forms for all tracks, field-specific alerts).

## Key Clarifications Confirmed

The design uses inline choice display throughout (no separate wizard steps). The justification field resides in the right panel as a TipTap editor with auto-generated text and regenerate button, already documented. Large file growth should trigger separate documents for new sections (e.g., TE forms).
