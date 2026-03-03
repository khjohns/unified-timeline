# Design System — Anskaffelser

## Direction: "Analysebordet"

Dense, number-forward evaluation workspace. Inspired by financial analysis tools.
Authoritative, precise, data-dense. The evaluation matrix IS the interface.

**Feel:** Like a financial analyst's desk — numbers are the primary content, everything serves the numbers.
**Not:** Warm, friendly, spacious. This is analytical tooling.

---

## Tokens

The following subsections show the **dark theme** token values. For light theme values and the full side-by-side comparison, see [## Themes](#themes) below.

### Surfaces (cool dark blues)

```
--color-canvas: #0c0e14          /* workspace background */
--color-felt: #12151e             /* cards, panels — barely lifted */
--color-felt-raised: #181c28      /* elevated: dropdowns, popovers */
--color-felt-hover: #1e2233       /* hover state */
--color-felt-active: #242840      /* pressed/active state */
```

### Ink (text hierarchy)

```
--color-ink: #e2e5ef              /* primary text */
--color-ink-secondary: #8890a4    /* supporting text, labels */
--color-ink-muted: #7b829b        /* labels, metadata, section titles */
--color-ink-ghost: #5a6178        /* disabled, placeholder, decorative */
```

### Wire (borders)

```
--color-wire: rgba(255, 255, 255, 0.06)       /* standard separation */
--color-wire-strong: rgba(255, 255, 255, 0.10) /* emphasis, group dividers */
--color-wire-focus: rgba(232, 168, 56, 0.35)   /* focus rings */
```

### Vekt (weight accent — amber)

```
--color-vekt: #e8a838                         /* primary weight color */
--color-vekt-dim: #c49030                     /* secondary weight */
--color-vekt-bg: rgba(232, 168, 56, 0.08)    /* weight row tint */
--color-vekt-bg-strong: rgba(232, 168, 56, 0.14) /* weight emphasis */
```

### Score Semantics

```
--color-score-high: #3d9a6e                      /* high scores (7+) */
--color-score-high-bg: rgba(61, 154, 110, 0.10) /* high score background */
--color-score-mid: #8890a4                       /* mid scores (4-6) */
--color-score-low: #c45858                       /* low scores (≤3) */
--color-score-low-bg: rgba(196, 88, 88, 0.10)   /* low score background */
```

---

## Themes

Light theme is the default (standard web convention). Dark mode is activated by adding a `.dark` class to `<html>`. OS-level preference (`prefers-color-scheme: dark`) is respected automatically; a manual toggle overrides it. An anti-flash inline script in `<head>` reads `localStorage` and applies `.dark` before first paint to prevent FOUC.

All tokens are defined in `@theme` (light values) in `app.css` and overridden in a `.dark { ... }` block.

### Token values by theme

| Token | Light | Dark |
|---|---|---|
| **Surfaces** | | |
| `--color-canvas` | `#f4f5f8` | `#0c0e14` |
| `--color-felt` | `#ffffff` | `#12151e` |
| `--color-felt-raised` | `#ffffff` | `#181c28` |
| `--color-felt-hover` | `#eef0f5` | `#1e2233` |
| `--color-felt-active` | `#e4e7ee` | `#242840` |
| **Ink** | | |
| `--color-ink` | `#1a1d26` | `#e2e5ef` |
| `--color-ink-secondary` | `#555b6e` | `#8890a4` |
| `--color-ink-muted` | `#666c82` | `#7b829b` |
| `--color-ink-ghost` | `#9ba1b4` | `#5a6178` |
| **Wire** | | |
| `--color-wire` | `rgba(0,0,0,0.07)` | `rgba(255,255,255,0.06)` |
| `--color-wire-strong` | `rgba(0,0,0,0.13)` | `rgba(255,255,255,0.10)` |
| `--color-wire-focus` | `rgba(153,101,16,0.35)` | `rgba(232,168,56,0.35)` |
| **Vekt** | | |
| `--color-vekt` | `#996510` | `#e8a838` |
| `--color-vekt-dim` | `#7a5210` | `#c49030` |
| `--color-vekt-bg` | `rgba(153,101,16,0.06)` | `rgba(232,168,56,0.08)` |
| `--color-vekt-bg-strong` | `rgba(153,101,16,0.10)` | `rgba(232,168,56,0.14)` |
| **Score** | | |
| `--color-score-high` | `#2d7a54` | `#3d9a6e` |
| `--color-score-high-bg` | `rgba(45,122,84,0.08)` | `rgba(61,154,110,0.10)` |
| `--color-score-mid` | `#555b6e` | `#8890a4` |
| `--color-score-low` | `#b04040` | `#c45858` |
| `--color-score-low-bg` | `rgba(176,64,64,0.08)` | `rgba(196,88,88,0.10)` |

The subsections below document the **dark theme** token values in CSS custom property format.

---

## Typography

```
--font-data: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Consolas', monospace
--font-ui: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

- **Numbers/scores/percentages:** Always `--font-data` with `font-variant-numeric: tabular-nums`
- **Headlines:** `--font-ui`, 20px, weight 700, tracking -0.025em
- **Body/labels:** `--font-ui`, 13px, weight 500
- **Section labels:** 11px, weight 600, uppercase, tracking 0.08em, color `--color-ink-muted`
- **Data values:** `--font-data`, 13px, weight 500

---

## Spacing

Base unit: **4px**

```
--spacing-1: 4px      /* micro: icon gaps */
--spacing-2: 8px      /* tight: element pairs */
--spacing-3: 12px     /* component: cell padding */
--spacing-4: 16px     /* card padding */
--spacing-5: 20px     /* generous card padding */
--spacing-6: 24px     /* section gaps */
--spacing-8: 32px     /* workspace padding, major separation */
--spacing-12: 48px    /* page bottom padding */
```

---

## Radius

Technical, not friendly:

```
--radius-sm: 4px      /* inputs, buttons, score segments */
--radius-md: 6px      /* small cards, badges */
--radius-lg: 8px      /* major containers, matrix wrap */
```

---

## Depth Strategy

**Borders-only.** No shadows. Dark mode + dense data = borders define structure quietly.

- Group rows: `border-left: 3px solid var(--color-vekt)` (weight spine)
- Sub-rows: `border-left: 3px solid rgba(232, 168, 56, 0.15)` (faded spine)
- Separators: `1px solid var(--color-wire)` standard, `var(--color-wire-strong)` for group dividers
- Annotation panel: `border-left: 3px solid var(--color-vekt)` (connects to spine)

---

## Signature Element: Vektlinjen (Weight Spine)

A vertical amber accent running down the left edge of the evaluation matrix.

- **Group rows:** solid amber left border (3px)
- **Sub-criteria:** faded amber left border (15% opacity)
- **Weight bars:** proportional horizontal bars in the weight column, max 48px width
- **Weight numbers:** amber monospace with % suffix in dim amber

The weight spine makes the abstract concept of "weighted evaluation" physically scannable.

---

## Component Patterns

### Evaluation Matrix

- `<table>` with `border-collapse: collapse`, `table-layout: fixed`
- Wrapped in `.matrix-wrap` with border and radius
- Columns: weight (72px) | criteria (260px) | suppliers (flexible, equal)
- Header: sticky, uppercase, 10px, tracking 0.08em

### Group Rows (main criteria)

- Background: `var(--color-vekt-bg)` (amber tint)
- Left border: solid amber (weight spine)
- Score values: 14px, weight 700, one decimal
- Criteria name: weight 600

### Sub-criterion Rows

- Background: transparent, hover → `var(--color-felt-hover)`
- Left border: faded amber
- Criteria name: indented (padding-left: 32px), with `::before` dash
- Score values: integer, weight 500

### Score Cells

- Font: `--font-data`, centered, tabular-nums
- Color coding: `.score-high` (green ≥7), `.score-mid` (neutral ≥4), `.score-low` (rose <4)
- Best in row: `.score-best` → green background + bold
- Has notes: `.has-notes` → 5px amber dot, top-right corner
- Drilldown variant: `▾` chevron (8px, `--color-ink-ghost`) after score, rotates on expand
- Derived scores: always `.toFixed(1)`, integer scores show as-is

### Annotation Panel

- Full-width row below the scored row
- Shows: context (supplier › criterion), score selector (0-10 segments), textarea
- Score segments: 30×32px buttons, filled state = green, active = solid green
- Textarea: `var(--color-felt)` background, wire border, focus → amber wire

### ItemEvaluationPanel

- Full-width row below sub-criterion row (same pattern as AnnotationPanel)
- Left border: 3px solid `--color-vekt` (connects to weight spine)
- Context bar: supplier name (bold) › sub-criterion name (muted), 11px
- Contains: AggregationStrip + ItemTable + AddItem + Notes textarea

### AggregationStrip

- Horizontal flex, `--color-felt` background, `--color-wire` border, `--radius-sm` radius
- Label: "AGGREGERING" in section label style (10px uppercase ghost)
- Radio-style options: 12px circle (border `--color-wire-strong`, checked = `--color-vekt` fill with inset ring)
- Active option: `--color-vekt` color, weight 600
- Result: right-aligned, `--font-data`, 16px, weight 700, tier-colored

### ItemTable

- Dense `<table>`, `--color-felt` background, `--color-wire` border, `--radius-sm` radius
- Header: criterion name (10px uppercase) + weight in `--color-vekt-dim` (9px)
- Columns: item name (flex) | criteria (80px each) | average (72px)
- Item rows: name (13px, weight 500) + label after em-dash (muted), hover → `--color-felt-hover`
- Remove button: `×`, absolute right, opacity 0 → 1 on row hover, hover → rose
- Footer: `--color-canvas` background, `--color-wire-strong` top border, weight 600 averages

### ItemScoreCell (compact)

- Button: 36×28px, `--font-data`, 13px, tier-colored, transparent border
- Hover: `--color-felt-hover` + `--color-wire` border
- Focus-visible: `--color-wire-focus` border
- Best: green background + weight 700
- Edit popover: positioned below, `--color-felt-raised`, `--color-wire-strong` border, shadow
- Popover segments: 22×26px, same filled/active states as AnnotationPanel segments

### Ranking Cards

- Flex row, equal width cards
- Shows: rank position, supplier name, total score (28px monospace), score bar
- #1 card: amber-tinted border + gradient background, "Anbefalt" badge

### Total Row

- Background: `var(--color-canvas)` (darker than matrix)
- Score: 18px, weight 700
- Best score: amber color + amber background

### Progress Indicators

- Compact flex row below matrix
- Label + fraction value (monospace) + thin bar (3px height, 80px width)
- Complete: green fill. Partial: amber fill.

---

## Navigation

Sidebar (228px) with same canvas background, border-separated:
- Brand icon + text at top
- Nav items: 13px, weight 500, subtle hover
- Active item: amber background tint + amber text
- User footer: avatar circle + name + organization

### Method Toggle

- Segmented control: `--color-felt` background, `--color-wire` border, `--radius-md` radius
- Buttons: 12px, weight 500, `--color-ink-secondary`
- Active: `--color-vekt-bg-strong` background, `--color-vekt` text, weight 600
- Placed between header and ranking strip

### Config Strip (Prismodell)

- Horizontal flex row, `--color-felt` surface, `--color-wire` border, `--radius-md` radius
- Labels: 11px, weight 500, `--color-ink-muted`
- Inputs: `--color-canvas` background (inset feel), `--font-data`, right-aligned
- Shows kontraktsverdi + per-supplier prices
- Hidden by default, visible when prismodell active

### Prismodell Matrix

- Same matrix structure as poengmodell
- Weight column → "Maks fradrag" in kr (monospace, 11px)
- Supplier columns → "Fradrag" in kr with `+` prefix on group rows
- Color coding: `.fradrag-low` (green), `.fradrag-mid` (neutral), `.fradrag-high` (rose), `.fradrag-best` (green bg)
- Bottom rows: Tilbudt pris → Sum kvalitetsfradrag → Evaluert pris
- Result row: 16px, weight 700, best = amber

### Innsikt Panel

- Collapsible section below matrix, toggle arrow rotates on collapse
- Three tabs: Betalingsvilje, Robusthet, Metodekontroll
- Tabs: flex row, `--color-wire` bottom border, active = `--color-vekt` text + amber bottom border (2px)
- Content panes: `--spacing-5` padding

**Betalingsvilje tab:**
- Data table (`.bv-table`) with criterion, weight, implisitt maks fradrag, per-poeng value
- Sub-criteria indented with `::before` dash (mirrors matrix pattern)
- Summary card: `--color-vekt-bg` background, `--color-vekt` left border (3px), highlights in amber monospace

**Robusthet tab:**
- Ranking items: `--color-felt-raised` background, `--color-wire` border, leader = amber border
- Insight cards: `--color-felt-raised` surface, `--color-vekt` left border (3px), section label + text
- Key data in `.mono` spans (amber, monospace)

**Metodekontroll tab:**
- Side-by-side grid (2 columns) comparing poengmodell vs prismodell rankings
- Each column: `--color-felt-raised`, `--color-wire` border, `--radius-md` radius
- Verdict bar: `.match` (green bg) or `.mismatch` (rose bg) with icon + text

---

## Qualification Matrix (Kvalifikasjonsmatrise)

Binary pass/fail matrix for supplier qualification requirements. Fundamentally different from
the evaluation matrix: no weighting, no scoring, binary verdicts.

### Structural accent

- Left spine: `--wire-strong` (not amber) — no weights, so the vektlinjen concept doesn't apply
- The cells carry all semantic color (green/rose/ghost)
- Differentiates visually from the amber-spined evaluation matrix

### QualificationMatrix

- Same `<table>` structure as EvaluationMatrix but simpler
- No weight column — requirements aren't weighted
- Columns: requirement description (auto) | suppliers (140px each)
- Header: same sticky uppercase pattern (10px, tracking 0.08em)

### Requirement Rows

- Background: `var(--canvas)`, hover → `var(--felt-hover)`
- Left border: `3px solid var(--wire-strong)` (structural spine)
- Name: weight 600, `--ink`, 12px
- Description: 11px, `--ink-muted`, line-height 1.4 (brief text below name)

### QualificationCell (verdict cells)

- Clickable `<td>` centered, opens expansion panel
- Icon container: 28×28px, `--r-sm` radius
- **Oppfylt (met):** `✓` in `--score-high`, background `--score-high-bg`
- **Ikke oppfylt (not_met):** `✗` in `--score-low`, background `--score-low-bg`
- **Ikke vurdert (not_assessed):** `—` in `--ink-ghost`, transparent
- **Støtte-markør:** amber `◆` (7px) positioned top-right when supplier relies on supporting entity
- **Notat-markør:** 5px amber dot bottom-right (same pattern as ScoreCell `.has-notes`)

### QualificationPanel (expansion panel)

- Same full-width row pattern as AnnotationPanel
- Left border: `3px solid var(--wire-strong)` (connects to spine)
- Context bar: supplier name (bold) › requirement name (muted), 11px
- Three field groups in horizontal flex: Dokumentasjon, Grunnlag, Vurdering
- Radio-style option buttons: `--felt` background, `--wire` border, `--r-sm` radius
  - Active state has semantic color: submitted = green, not_submitted = rose, met = green, not_met = rose
- Support entity input: appears when "Støtter seg på" is selected, `--canvas` inset input
- Notes textarea: same pattern as AnnotationPanel

### QualificationSummary (status strip)

- Same card layout as RankingStrip
- Per-supplier cards with flex-equal width
- Badge: 9px uppercase bold pill
  - **Kvalifisert:** green text + `--score-high-bg`
  - **Avvist:** rose text + `--score-low-bg`
  - **Uavklart:** `--ink-muted` text + `--felt-active`
- Count: `met/total oppfylt` in monospace (22px value, 14px denominator)
- Green top bar accent on qualified cards (same `::before` pattern as rank-1)
- Rose top bar accent on rejected cards
- Progress bar: 3px, green fill

### Result Row

- Bottom of matrix, `border-top: 2px solid var(--wire-strong)`
- Label: "KVALIFISERT" uppercase, weight 700
- Value pills: "Ja" (green bg) / "Nei" (rose bg) / "—" (ghost)

---

## View Switching

- `.view-poeng` and `.view-pris` containers toggle via `.active` class
- Both share the same matrix CSS patterns, different data columns
- Method toggle drives visibility of views and config strip

---

## States

- **Hover (rows):** `var(--color-felt-hover)` background
- **Hover (score cells):** same + cursor pointer
- **Focus (inputs):** `border-color: var(--color-wire-focus)` (amber)
- **Active (score segment):** solid green background
- **Active (method btn):** amber background tint + amber text
- **Active (innsikt tab):** amber text + amber bottom border
- **Collapsed (innsikt):** toggle icon rotates -90deg, body hidden
- **Status badge:** pill with pulsing dot, amber background
