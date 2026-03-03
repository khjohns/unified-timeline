# Task 3 Design Plan — Mock Component Planning

**Scope:** Design HTML mockups for missing TE forms and field-specific alerts
**Design system:** system.md (Analysebordet) — NOT Punkt/unified-timeline
**Reference:** DESIGN_WORKSPACE_PANELS.md for component patterns and visual grammar

---

## What's Missing (from all 4 reviews)

### A. TE Grunnlag Submission Form (COMPLETELY MISSING)

The design document says "TE varsler via Forhandlingsbordet" (line 1585) but provides no form spec.
grunnlag-review #6 confirms: "TE grunnlag submission form fields not designed."

**Required fields (from domain):**

| Field | Type | Validation | Conditional |
|-------|------|-----------|-------------|
| `kategori` | RadioGroup (4 options) | Required | Always |
| `underkategori` | Grouped dropdown | Required (except FM) | Hidden for FORCE_MAJEURE |
| `tittel` | Text input | 3–100 chars | Always |
| `beskrivelse` | Textarea | Min 10 chars | Always |
| `dato_oppdaget` | DatePicker | Required | Always |
| `varsel_sendes_na` | Checkbox | — | Hidden in Update mode |
| `dato_varsel_sendt` | DatePicker | Required if !sendes_na | If varsel not sending now |
| `varsel_metode` | Dropdown | — | If varsel not sending now |

**Kategori options:**
- ENDRING (§33.1 a) — 8 underkategorier in 4 grupper
- SVIKT (§33.1 b) — 4 underkategorier in 3 grupper
- ANDRE (§33.1 c) — 5 underkategorier in 4 grupper
- FORCE_MAJEURE (§33.3) — no underkategorier

**Underkategori grouping (ENDRING example):**
- Endringsordrer: EO, IRREG, VALGRETT, SVAR_VARSEL
- Lov og forskrift: LOV_GJENSTAND, LOV_PROSESS, GEBYR
- Koordinering: SAMORD

**Inline alerts in form:**
- Preklusjonsadvarsel (between dato_oppdaget and dato_varsel):
  - 3–7d: amber "Det er N dager siden forholdet ble oppdaget. Vurder å varsle snart."
  - >14d: danger "Det er N dager. Risiko for preklusjon (§32.2)."
- Force Majeure info: "Force Majeure gir kun rett til fristforlengelse (§33.3), ikke vederlag."

**Update mode additions:**
- "Nåværende ansvarsgrunnlag" read-only summary at top
- Kategoriendring warning alert if changing category

**Layout:**
- Midtpanel: Form fields (no kravhode — TE creates, not responds)
- Høyrepanel: "Begrunnelse for kravet" TipTap editor

---

### B. Field-Specific Alerts (MISSING from multiple reviews)

#### B1. Grunnlag BH — Force Majeure alerts (grunnlag-review #5)
- Godkjent + FM → success: "Force Majeure anerkjent — kun fristforlengelse (§33.3). Vederlagssporet deaktiveres."
- Avslått + FM → warning: "Force Majeure ikke anerkjent — TE har bevisbyrden for ekstraordinært forhold."

#### B2. Grunnlag BH — Varslet i tide positive (grunnlag-review #9)
- ENDRING + §32.2 + varslet_i_tide = Ja → info: "Varslet i tide — §34.1.1 gjelder for vederlagsjustering."

#### B3. Grunnlag BH — Preklusjon + subsidiær (grunnlag-review #8)
- varslet_i_tide = Nei → danger: "Preklusjon påberopt (§32.2) — TE varslet ikke i rimelig tid."
- + warning: "Videre vurdering av vederlag og frist gjelder subsidiært."

#### B4. Grunnlag BH — Snuoperasjon precondition (grunnlag-review #4)
- avslått→godkjent + harSubsidiaereSvar → success: "Subsidiære svar (vederlag og frist) blir prinsipale."
- avslått→godkjent + !harSubsidiaereSvar → info: "Ingen subsidiære svar å promotere."

#### B5. Vederlag BH — Svarplikt (vederlag-review #10)
- >5d since krav mottatt → danger: "Svarplikt — N dager siden krav mottatt. Risiko for passiv aksept (§30.3.2)."

#### B6. Vederlag TE — REGNINGSARBEID fradrag (vederlag-review #8)
- metode = REGNINGSARBEID → info: "Ved fradrag reduseres vederlaget med besparelsen, inkludert reduksjon av fortjenesten (§34.4)."

#### B7. Frist BH — §33.8 forsering warning (frist-review #6)
- resultat = avslått OR delvis → warning: "Avslag/delvis godkjenning kan utløse forseringsrett for TE (§33.8). Forseringskostnad begrenset til dagmulkt × avslåtte dager × 1,3."

#### B8. Dynamic begrunnelse placeholders (grunnlag-review #7)
- Preklusjon + subsidiær: "Begrunn prinsipalt avslag (§32.2 preklusjon) og den subsidiære vurderingen av kravet."

---

## Design Constraints (from system.md)

- **Direction:** "Analysebordet" — dense, number-forward, analytical
- **Surfaces:** --canvas (#0c0e14 dark / #f4f5f8 light), --felt (#12151e / #ffffff), --felt-raised (#181c28 / #ffffff)
- **Ink:** 4-level hierarchy (--ink, --ink-secondary, --ink-muted, --ink-ghost)
- **Accent:** Amber (--vekt: #e8a838 dark / #996510 light)
- **Depth:** Borders-only, no shadows
- **Typography:** Inter (--font-ui) + JetBrains Mono (--font-data)
- **Spacing:** 4px base
- **Radius:** 4/6/8px (system.md) → 2/4/6px (DESIGN_WORKSPACE_PANELS.md overrides)

## Workspace Adaptations (from DESIGN_WORKSPACE_PANELS.md)

- Oslo Sans replaces Inter (Punkt platform requirement)
- Sharper radii: 2/4/6px instead of 4/6/8px
- Sone structure: ①②③④ zones
- Verdict buttons (horizontal, semantic color)
- Checkbox with human-first text, §-ref secondary
- Konsekvens-callout pattern (left-border + tinted bg)
- Key-value rows with dotted leaders

---

## Mock Deliverables

### Mock 1: TE Grunnlag Form (te-grunnlag-mock.html)
Full-width HTML mock showing the TE grunnlag submission form in the three-panel workspace.
Shows: new submission mode + update mode state indicators.

### Mock 2: Alert Catalog (alerts-catalog-mock.html)
Visual catalog of all field-specific alerts, organized by form context.
Each alert shown with trigger condition, severity, and exact text.
