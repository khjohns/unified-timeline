# Bento Typography System — Handoff Prompt

Copy everything below the line into a new Claude Code session.

---

## Task: Design and implement a bento typography token system

We're establishing consistent typography tokens for the bento card UI. The audit is done, principles are agreed. You need to: (1) write an ADR, (2) define CSS custom properties + Tailwind utilities, (3) refactor all bento components to use them.

### Context

Read `CLAUDE.md` for project overview. This is a React/TypeScript/Tailwind v4 project. The bento cards are in `src/components/bento/`.

### Completed audit — current text sizes in bento cards

From analyzing FristCard, VederlagCard, CaseMasterCard, TrackCTA, TrackHistory, StatusDot, InlineYesNo, InlineNumberInput, KravLinje, MethodCards, VerdictCards, BentoRespond*:

| Size | Weight | Color | Semantic role | Example | Count |
|------|--------|-------|---------------|---------|-------|
| `text-[10px]` | `font-medium` | `text-pkt-text-body-subtle` | **Card title** (uppercase tracking-wide) | "FRISTFORLENGELSE", "VEDERLAG" | ~10 |
| `text-[10px]` | normal | `text-pkt-text-body-muted` | **Paragraf reference** | "§33", "§34" | ~10 |
| `text-[10px]` | `font-semibold` | `text-pkt-text-body-default` | **Section header** (uppercase tracking-wide, edit mode) | "BEREGNINGSMETODE", "FORELØPIG VARSEL §33.4" | ~15 |
| `text-[10px]` | `font-medium` | `text-pkt-text-body-subtle` | **KPI label** (uppercase tracking-wide) | "KREVD", "GODKJENT", "GODKJ.GRAD" | ~8 |
| `text-[10px]` | normal | `text-pkt-text-body-muted` | **Helper/meta text** | helper text, varslet dates in KravLinje | ~10 |
| `text-[10px]` | `font-mono` | `text-pkt-text-body-muted` | **History date** (tabular-nums) | "11.02" | via TrackHistory |
| `text-[11px]` | normal | `text-pkt-text-body-subtle` | **Key-value label** | "Krevd", "Varslet §33.4", "Oppdaget" | ~20 |
| `text-[11px]` | `font-medium` | `text-pkt-text-body-subtle` | **Status label** | "Delvis godkjent" (StatusDot) | ~5 |
| `text-[11px]` | normal | `text-pkt-text-body-default` | **History summary** | "Krevd 7 dager", "Delvis godkjent: 4 dager" | via TrackHistory |
| `text-[11px]` | `font-semibold` | varies | **Resultat box** text | "Resultat: Delvis godkjent" | ~5 |
| `text-[11px]` | `font-medium` | varies | **InlineYesNo buttons** | "Ja", "Nei" | via InlineYesNo |
| `text-xs` (12px) | `font-mono font-medium` | `text-pkt-text-body-default` | **Key-value data** (tabular-nums) | "7d", "11.02.2026" | ~15 |
| `text-xs` | normal | `text-pkt-text-body-default` | **Body text** | descriptions, begrunnelse editor | ~10 |
| `text-xs` | `font-medium` | `text-pkt-brand-warm-blue-1000` | **CTA text** (TrackCTA) | "Svar på krav" | ~3 |
| `text-sm` (14px) | `font-semibold font-mono` | semantic color | **KPI value** (tabular-nums) | "7d", "4d", "57%" | ~8 |
| `text-[9px]` | `font-medium/bold` | varies | **Micro badge** (uppercase) | "TE", "BH", "PREKLUDERT" | ~8 |
| `text-[8px]` | `font-bold` | varies | **Method badge** (MethodCards) | "TE VALG", "BH" | ~2 |

### Proposed tier system (6 tiers)

| Token name | Default size | Typical weight | Role |
|------------|-------------|----------------|------|
| `--bento-text-micro` | 9px | bold | Badges: TE/BH role, PREKLUDERT |
| `--bento-text-label` | 10px | medium/semibold | Card titles, section headers, KPI labels, §-refs (all uppercase tracking-wide) |
| `--bento-text-caption` | 11px | normal/medium | Key-value labels, status labels, history summaries, inline controls |
| `--bento-text-body` | 12px | normal/medium | Data values (mono), body text, CTA text, editor content |
| `--bento-text-kpi` | 14px | semibold | KPI hero numbers: "7d", "4d", "57%" |
| `--bento-text-title` | 18px | semibold | Master card case title only (EXCLUDED from token system per agreement) |

### Design decisions already agreed

1. **Master card title (`text-lg`)** stays outside the token system — it's a one-off identity element
2. **Classic Button sizes (sm/md/lg)** are untouched — only bento cards use the new `xs` size (already implemented)
3. **The FristCard screenshot is the reference design** — it works well with its rich variation
4. **Future: text-size toggle** (small/medium/large) — these tokens make it trivial to add later by swapping CSS var values
5. **Weight and color are NOT tokenized** — only size. Weight/color vary by context within the same tier (e.g. `--bento-text-label` is `font-medium` for card titles but `font-semibold` for section headers). Tokenizing these would over-constrain.

### Implementation approach

1. **Define CSS custom properties** in `src/index.css` under `:root` (and dark mode section if needed)
2. **Add Tailwind utilities** via `@utility` directives in `src/index.css` (Tailwind v4 syntax):
   ```css
   @utility text-bento-micro { font-size: var(--bento-text-micro); }
   @utility text-bento-label { font-size: var(--bento-text-label); }
   @utility text-bento-caption { font-size: var(--bento-text-caption); }
   @utility text-bento-body { font-size: var(--bento-text-body); }
   @utility text-bento-kpi { font-size: var(--bento-text-kpi); }
   ```
3. **Refactor components** — replace hardcoded sizes with token utilities:
   - `text-[10px]` → `text-bento-label`
   - `text-[11px]` → `text-bento-caption`
   - `text-xs` → `text-bento-body`
   - `text-sm` (KPI values only) → `text-bento-kpi`
   - `text-[9px]` → `text-bento-micro`
   - `text-[8px]` → `text-bento-micro` (consolidate up from 8px to 9px)

### Files to modify

**Token definition:** `src/index.css`

**Components to refactor (all in `src/components/bento/`):**
- `track-cards/FristCard.tsx` — ~29 text-[10px], ~19 text-[11px], ~18 text-xs
- `track-cards/VederlagCard.tsx` — similar density
- `track-cards/TrackCTA.tsx` — CTA text
- `track-cards/TrackHistory.tsx` — dates, summaries, badges
- `track-cards/StatusDot.tsx` — status label
- `CaseMasterCard.tsx` — section headers, key-value rows (NOT the text-lg title)
- `InlineYesNo.tsx` — labels, buttons
- `InlineNumberInput.tsx` — labels, values
- `InlineCurrencyInput.tsx` — check for same patterns
- `KravLinje.tsx` — section headers, labels
- `MethodCards.tsx` — method labels, badges
- `VerdictCards.tsx` — verdict labels
- `BentoRespondVederlag.tsx` — header
- `BentoRespondFrist.tsx` — header
- `BentoRespondGrunnlag.tsx` — header

**ADR:** Write to `docs/ADR-004-bento-typography-tokens.md`

### Steps

1. Read FristCard.tsx, VederlagCard.tsx, and this handoff doc to confirm understanding
2. Write ADR-004 documenting the token tiers, rationale, and examples
3. Add CSS custom properties and `@utility` rules to `src/index.css`
4. Refactor components file by file, running `npx tsc --noEmit` and tests after each batch
5. Run full test suite: `npx vitest run src/components/bento/`
6. Commit with message: `refactor(bento): consolidate typography to semantic tokens (ADR-004)`

### Important: What NOT to change

- `text-lg` / `text-xl` / `text-2xl` — these are outside bento cards (PageHeader, modals, etc.)
- Classic CasePage components in `src/components/` (not under `bento/`)
- Button component text sizes (already handled by size prop)
- Alert component text (uses its own sizing)
