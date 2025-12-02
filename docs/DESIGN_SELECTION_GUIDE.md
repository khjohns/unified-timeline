# Design Selection Guide: Unified Timeline Components

> **Purpose:** Select visual design options for Card, StatusCard, and StatusDashboard components
>
> **Application:** Event Sourcing - Skjema Endringsmeldinger (NS 8407 Change Claims)
>
> **Design System:** Oslo Punkt Design Tokens + Tailwind CSS
>
> **Target Users:** Construction professionals (Totalentreprenør & Byggherre)
>
> **Context:** Public sector application - WCAG 2.1 AA compliance required

---

## How to Use This Document

1. **Review each design aspect** with visual examples
2. **Mark your preferred choice** with `[x]`
3. **Consider the trade-offs** specific to this application
4. **Save your selections** at the end for implementation reference

---

## Application-Specific Context

### Three-Track System
The application manages three parallel tracks that can progress independently:
- **GRUNNLAG** (Foundation) - Basis for the claim
- **VEDERLAG** (Compensation) - Financial compensation amount
- **FRIST** (Deadline) - Time extension request

### User Roles
- **TE (Totalentreprenør)** - Submits claims, sees "Send" actions
- **BH (Byggherre)** - Responds to claims, sees "Svar på" actions

### Status Flow
Each track moves through states: `utkast → sendt → under_behandling → godkjent/avvist/delvis_godkjent`

### Current State (Baseline)
- **Border:** `border border-gray-200` (subtle outline)
- **Spacing:** `p-6` (24px padding)
- **Radius:** Medium rounded corners
- **Background:** White cards on `bg-oslo-beige-100` page
- **Actions:** Now contextual (inside each status card)

---

## 1. Border Style (The "Container" Definition)

**Question:** How should the three status cards be visually separated from the beige background?

### Option A: Subtle & Clean ⭐ *Current Implementation*
```css
border border-gray-200
```

**Visual:**
```
┌─────────────────┐  Light gray line (1px)
│   GRUNNLAG      │  Defines boundary without dominating
│   Status: ✓     │  Professional, not distracting
└─────────────────┘
```

**Pros:**
- ✅ Doesn't compete with status badges (which use color)
- ✅ Maintains focus on content
- ✅ Oslo Punkt design system philosophy (subtle, functional)
- ✅ Good for 3-card grid (borders don't create visual noise)

**Cons:**
- ⚠️ Less definition on low-contrast monitors
- ⚠️ May blend with background at certain zoom levels

**Use When:**
- Users work in well-lit offices with good monitors
- Content hierarchy is more important than container emphasis
- You want a "clean" dashboard look

---

### Option B: Bold & High Contrast
```css
border-2 border-gray-300
```

**Visual:**
```
┏━━━━━━━━━━━━━━━━━┓  Darker, thicker line (2px)
┃   GRUNNLAG      ┃  Cards "pop" against background
┃   Status: ✓     ┃  Very clear boundaries
┗━━━━━━━━━━━━━━━━━┛
```

**Pros:**
- ✅ Excellent for accessibility (high visual contrast)
- ✅ Easier to distinguish cards when glancing
- ✅ Better for construction sites (portable devices, outdoor viewing)
- ✅ Reduces cognitive load (clear "zones")

**Cons:**
- ⚠️ Can feel "heavy" with 3 cards side-by-side
- ⚠️ Less "modern" aesthetic (more traditional form-like)

**Use When:**
- Users may work in challenging environments (construction trailers, outdoor)
- Accessibility is paramount
- Users need to quickly scan multiple cards

---

### Option C: Shadow Only (No Border)
```css
border-0 shadow-md
```

**Visual:**
```
┌─────────────────┐  No line, just shadow
│   GRUNNLAG      │  "Floating" appearance
│   Status: ✓     │  Modern, app-like
└─────────────────┘
   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓   (shadow underneath)
```

**Pros:**
- ✅ Modern, consumer-app aesthetic
- ✅ Works well on colored backgrounds
- ✅ Reduces visual "clutter" (no lines)

**Cons:**
- ⚠️ Shadows disappear when printing or in high-contrast mode
- ⚠️ Less professional for B2B/public sector context
- ⚠️ Can feel "floaty" (less grounded)
- ❌ **Accessibility concern:** Users with low vision may not see shadows

**Use When:**
- Target is mobile-first consumer audience (not this case)
- Background has enough contrast on its own

**Recommendation for This App:** ❌ Not recommended (accessibility issues)

---

### Option D: Colored Accent Border
```css
border-l-4 border-l-blue-500 (for Grunnlag - blue)
border-l-4 border-l-green-500 (for Vederlag - green)
border-l-4 border-l-purple-500 (for Frist - purple)
```

**Visual:**
```
┃────────────────┐  Colored left edge (4px)
┃ GRUNNLAG       │  Associates track with color
┃ Status: ✓      │  Professional dashboard feel
┗━━━━━━━━━━━━━━━━┛
  Blue = Grunnlag, Green = Vederlag, Purple = Frist
```

**Pros:**
- ✅ **Instant track identification** (color coding)
- ✅ Professional dashboard aesthetic (common in enterprise software)
- ✅ Helps colorblind users (color + position + label)
- ✅ Creates visual hierarchy without dominance
- ✅ Can use Oslo brand colors: `oslo-blue`, `oslo-green`, `warning` (orange/purple)

**Cons:**
- ⚠️ Requires choosing 3 distinct colors (must be WCAG compliant)
- ⚠️ Adds visual complexity
- ⚠️ May conflict with status badge colors (need coordination)

**Color Mapping Suggestion:**
- **GRUNNLAG:** `border-l-oslo-blue` (foundation = blue)
- **VEDERLAG:** `border-l-success` (money = green)
- **FRIST:** `border-l-warning` (time = orange)

**Use When:**
- Users manage multiple cases and need quick track identification
- Dashboard has many cards (color helps scanning)
- You want to emphasize the three-track nature of the system

---

**✅ Selection for Border Style:**
- [ ] Option A: Subtle & Clean (Current)
- [ ] Option B: Bold & High Contrast
- [ ] Option C: Shadow Only *(Not recommended)*
- [ ] Option D: Colored Accent Border

---

## 2. Spacing & Density (Information per Screen)

**Question:** How much content should be visible without scrolling on a 1920x1080 monitor?

### Current Layout (Baseline)
```
Desktop: 3 cards side-by-side (grid-cols-3)
Mobile: 1 card full-width (grid-cols-1)
Gap: 16px between cards
Padding: 24px inside each card
```

---

### Option A: Comfortable ⭐ *Current Implementation*
```css
Card: p-6 (24px padding)
Gap: gap-4 (16px between cards)
```

**Visual (3-card layout):**
```
┌────────┐ 16px ┌────────┐ 16px ┌────────┐
│        │      │        │      │        │
│ 24px   │      │ 24px   │      │ 24px   │
│padding │      │padding │      │padding │
│        │      │        │      │        │
└────────┘      └────────┘      └────────┘
```

**Content per card:**
- Track title (e.g., "GRUNNLAG")
- Status badge
- Last updated timestamp
- 2-3 action buttons (if available)

**Pros:**
- ✅ Touch-friendly (44x44px minimum button sizes easily met)
- ✅ Easy to read (no cramping)
- ✅ Room for 2-3 action buttons comfortably
- ✅ Good for accessibility (larger target areas)

**Cons:**
- ⚠️ Timeline requires scrolling on most screens
- ⚠️ Only 3 cards visible (dashboard + timeline split viewport)

**Ideal For:**
- Mixed desktop/tablet usage
- Users 40+ years old (larger text comfortable)
- Occasional users (need clear visual hierarchy)

---

### Option B: Spacious / Airy
```css
Card: p-8 (32px padding)
Gap: gap-6 (24px between cards)
```

**Visual:**
```
┌─────────┐ 24px ┌─────────┐ 24px ┌─────────┐
│         │      │         │      │         │
│  32px   │      │  32px   │      │  32px   │
│ padding │      │ padding │      │ padding │
│         │      │         │      │         │
└─────────┘      └─────────┘      └─────────┘
```

**Pros:**
- ✅ **Premium feel** (luxury whitespace)
- ✅ Great for presentations/demos
- ✅ Reduces cognitive load (more breathing room)
- ✅ Best for accessibility (maximum target sizes)

**Cons:**
- ⚠️ **Less vertical space for timeline** (primary concern)
- ⚠️ Wastes space on large monitors (1440p+)
- ⚠️ Mobile requires more scrolling

**Ideal For:**
- Executive dashboards (overview, not detail)
- Single-case focus (not managing multiple cases)
- 4K monitors (plenty of space)

---

### Option C: Compact / Data-Dense
```css
Card: p-4 (16px padding)
Gap: gap-3 (12px between cards)
```

**Visual:**
```
┌──────┐12px┌──────┐12px┌──────┐
│      │    │      │    │      │
│ 16px │    │ 16px │    │ 16px │
│pad   │    │pad   │    │pad   │
│      │    │      │    │      │
└──────┘    └──────┘    └──────┘
```

**Content:**
- Same as Option A but tighter
- Action buttons may stack (more likely to wrap)

**Pros:**
- ✅ **More vertical space for timeline** (key benefit)
- ✅ Power users prefer information density
- ✅ Fits more on laptop screens (1366x768)
- ✅ Feels more "enterprise software" (less consumer-y)

**Cons:**
- ⚠️ Touch targets may be cramped (still meets 44x44px if buttons sized properly)
- ⚠️ Less accessible for low vision users
- ⚠️ Can feel "crowded" on mobile

**Ideal For:**
- Power users who work in the system daily
- Desktop-primary workflow
- Users managing multiple cases (need to scan quickly)

---

**Trade-off Analysis for This App:**

| Aspect | Comfortable (A) | Spacious (B) | Compact (C) |
|--------|----------------|--------------|-------------|
| Timeline visibility | Good | Poor ⚠️ | Best ✅ |
| Accessibility | Best ✅ | Best ✅ | Good |
| Mobile experience | Good | Poor | Fair |
| Professional feel | Good | Premium | Enterprise |
| Daily-use workflow | Good | Poor | Best ✅ |

**Recommendation:**
- **Construction professionals = daily users** → Option C may be better
- **Public sector = accessibility priority** → Option A (current) is safer

**✅ Selection for Spacing:**
- [ ] Option A: Comfortable (Current - 24px padding)
- [ ] Option B: Spacious (32px padding)
- [ ] Option C: Compact (16px padding)

---

## 3. Corner Rounding (Visual Softness)

**Question:** How friendly vs. professional should the cards feel?

### Option A: Modern Soft ⭐ *Current Implementation*
```css
rounded-xl (12px radius)
```

**Visual:**
```
  ╭───────────╮  Smooth curve
  │ GRUNNLAG  │  Modern, friendly
  │ Status: ✓ │  Not too round
  ╰───────────╯
```

**Character:** Balance of professional and approachable

**Pros:**
- ✅ Modern without being "playful"
- ✅ Works for B2B and B2G (business-to-government)
- ✅ Oslo design system uses similar rounding
- ✅ Differentiates from pure "form" aesthetic

**Cons:**
- ⚠️ Very slightly less "serious" than sharp corners

**Ideal For:** Current application ✅

---

### Option B: Professional / Sharp
```css
rounded-md (6px radius) or rounded-none (0px)
```

**Visual:**
```
  ┌───────────┐  Slight curve or
  │ GRUNNLAG  │  completely square
  │ Status: ✓ │  Traditional form look
  └───────────┘
```

**Character:** Serious, traditional, enterprise

**Pros:**
- ✅ Maximum "professional" aesthetic
- ✅ Common in legal/financial software
- ✅ Aligns with paper forms (familiar to construction industry)

**Cons:**
- ⚠️ Can feel dated or rigid
- ⚠️ Less visually distinct from input fields (which are also sharp)

**Ideal For:**
- Very conservative audiences
- Legal/compliance-heavy applications
- Migration from paper forms (familiarity)

---

### Option C: Playful / Super Rounded
```css
rounded-2xl (16px) or rounded-3xl (24px)
```

**Visual:**
```
  ╭────────────╮  Very smooth
  │  GRUNNLAG  │  Bubble-like
  │  Status: ✓ │  Friendly, app-like
  ╰────────────╯
```

**Character:** Friendly, consumer-focused, mobile-first

**Pros:**
- ✅ Looks great on mobile
- ✅ Very approachable
- ✅ Trend in modern design

**Cons:**
- ❌ **Too casual for construction industry**
- ❌ Doesn't match Oslo brand (more conservative)
- ⚠️ May not be taken seriously in public sector context

**Recommendation for This App:** ❌ Not recommended (too informal)

---

**✅ Selection for Corner Rounding:**
- [ ] Option A: Modern Soft - `rounded-xl` (Current, 12px)
- [ ] Option B: Professional Sharp - `rounded-md` or `rounded-none` (6px or 0px)
- [ ] Option C: Playful - `rounded-2xl` *(Not recommended)*

---

## 4. Typography & Hierarchy

**Question:** How prominent should titles and status information be?

### Current Implementation
```
Track Title: text-heading-sm (Punkt token) uppercase font-bold
Status Label: text-sm
Last Updated: text-sm text-gray-600
Action Buttons: text-base
```

---

### Option A: Large & Readable ⭐ *Current Recommendation*
```css
Title: text-xl (20px) font-bold uppercase
Status: text-base (16px)
Body: text-base (16px)
```

**Visual Hierarchy:**
```
GRUNNLAG              ← 20px bold uppercase
Status: Godkjent ✓    ← 16px medium
Sist oppdatert: 1.des ← 16px regular
[Send grunnlag]       ← 16px button
```

**Pros:**
- ✅ Easy to scan from distance (construction sites)
- ✅ Excellent accessibility (large text)
- ✅ Clear hierarchy (title dominates)
- ✅ Works well for 50+ age demographic

**Cons:**
- ⚠️ Takes up more vertical space
- ⚠️ May feel "large" on 4K monitors

---

### Option B: Standard Desktop
```css
Title: text-lg (18px) font-bold
Status: text-sm (14px)
Body: text-sm (14px)
```

**Visual Hierarchy:**
```
GRUNNLAG             ← 18px bold uppercase
Status: Godkjent ✓   ← 14px medium
Sist oppdatert: 1.des← 14px regular
[Send grunnlag]      ← 14px button
```

**Pros:**
- ✅ Standard for enterprise software
- ✅ More content fits in same space
- ✅ Familiar sizing for daily computer users

**Cons:**
- ⚠️ Less accessible (smaller text)
- ⚠️ Harder to scan quickly
- ⚠️ May strain eyes over long sessions

---

### Option C: Bold Headers with Standard Body
```css
Title: text-lg (18px) font-black uppercase
Status: text-sm (14px)
Body: text-sm (14px)
```

**Character:** Aggressive title emphasis

**Pros:**
- ✅ Strongest visual hierarchy
- ✅ Track names are unmissable
- ✅ Saves space vs. Option A

**Cons:**
- ⚠️ `font-black` can feel overwhelming
- ⚠️ May create too much contrast

---

**Oslo Punkt Design Tokens (Available):**
```css
Heading tokens:
--pkt-font-size-heading-small   (1rem / 16px)
--pkt-font-size-heading-medium  (1.25rem / 20px)
--pkt-font-size-heading-large   (2rem / 32px)

Body tokens:
--pkt-font-size-body-small      (0.875rem / 14px)
--pkt-font-size-body-medium     (1rem / 16px)
--pkt-font-size-body-large      (1.125rem / 18px)
```

**Current Mapping:**
- `text-heading-sm` = 16px (may be too small for card titles)
- `text-heading-md` = 20px (better for prominence)

**✅ Selection for Typography:**
- [ ] Option A: Large & Readable (20px titles, 16px body)
- [ ] Option B: Standard Desktop (18px titles, 14px body)
- [ ] Option C: Bold Headers (18px font-black titles, 14px body)

---

## 5. Status Badge Design

**NEW SECTION** - Status indicators are critical to this app

**Question:** How should the status badge (Godkjent, Under behandling, etc.) look?

### Current Implementation
```tsx
<div className="px-3 py-2 rounded-md bg-success-100 text-success-700">
  <span aria-hidden="true">✓</span>
  <span>Godkjent</span>
</div>
```

**Statuses:**
- `godkjent` → Green with ✓
- `under_behandling` → Yellow/Orange with ⏳
- `avvist` → Red with ✗
- `sendt` → Blue with →
- `utkast` → Gray with ○

---

### Option A: Pill Badge (Current)
```css
rounded-md px-3 py-2
```

**Visual:**
```
┌──────────────────┐
│ ⏳ Under behandling│  Rounded rectangle
└──────────────────┘  Icon + text
```

**Pros:**
- ✅ Icon + text provides redundancy (accessibility)
- ✅ Clear, unambiguous
- ✅ Works in colorblind mode

**Cons:**
- ⚠️ Takes up horizontal space

---

### Option B: Compact Dot Indicator
```css
<span className="inline-flex items-center">
  <span className="w-3 h-3 rounded-full bg-success"></span>
  <span className="ml-2">Godkjent</span>
</span>
```

**Visual:**
```
● Godkjent           Colored dot + text
● Under behandling   More compact
```

**Pros:**
- ✅ Less visual weight
- ✅ Common pattern (GitHub, Slack)

**Cons:**
- ⚠️ Dot may be hard to see for low vision users
- ⚠️ Less distinctive

---

### Option C: Icon Only (Compact)
```css
<span title="Godkjent">✓</span>
```

**Visual:**
```
✓  (hover shows "Godkjent")
```

**Pros:**
- ✅ Extremely compact
- ✅ Good for power users (learn symbols)

**Cons:**
- ❌ **Not accessible** (icon without text)
- ❌ Requires memorization
- ❌ **Not recommended for this app**

---

**Recommendation:** Keep Option A (current pill badge)
- Accessibility compliant (icon + text)
- Clear for infrequent users
- Works in all scenarios

**✅ Selection for Status Badge:**
- [ ] Option A: Pill Badge with Icon + Text (Current) *(Recommended)*
- [ ] Option B: Compact Dot Indicator
- [ ] Option C: Icon Only *(Not recommended - accessibility)*

---

## 6. Action Button Placement & Style

**NEW SECTION** - Contextual actions are now inside cards

**Question:** How should the action buttons look within status cards?

### Current Implementation
```tsx
<div className="pt-3 border-t border-gray-200">
  <div className="flex flex-wrap gap-2">
    <Button variant="primary" size="sm">Send grunnlag</Button>
    <Button variant="secondary" size="sm">Oppdater grunnlag</Button>
  </div>
</div>
```

**Placement:** Below status info with separator border

---

### Option A: Full-Width Buttons (Prominent)
```css
<Button className="w-full">Send grunnlag</Button>
<Button className="w-full mt-2">Oppdater</Button>
```

**Visual:**
```
┌──────────────────┐
│ GRUNNLAG         │
│ Status: Utkast ○ │
├──────────────────┤ ← separator
│ ┌──────────────┐ │
│ │Send grunnlag │ │ ← full width
│ └──────────────┘ │
│ ┌──────────────┐ │
│ │   Oppdater   │ │
│ └──────────────┘ │
└──────────────────┘
```

**Pros:**
- ✅ Buttons are unmissable
- ✅ Great for touch (large targets)
- ✅ Clear call-to-action

**Cons:**
- ⚠️ Takes significant vertical space
- ⚠️ Can feel overwhelming if 3+ actions
- ⚠️ Less space for timeline

---

### Option B: Inline Buttons (Current) ⭐
```css
flex flex-wrap gap-2
<Button size="sm">Send</Button>
<Button size="sm">Oppdater</Button>
```

**Visual:**
```
┌──────────────────┐
│ GRUNNLAG         │
│ Status: Utkast ○ │
├──────────────────┤
│ [Send] [Oppdater]│ ← inline, wrap if needed
└──────────────────┘
```

**Pros:**
- ✅ Compact (saves vertical space)
- ✅ Natural flow (left-to-right)
- ✅ Can show 2-3 buttons comfortably

**Cons:**
- ⚠️ May wrap on narrow screens
- ⚠️ Less emphasis (not always a con)

---

### Option C: Dropdown Menu (Ultra-Compact)
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>Handlinger ▼</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Send grunnlag</DropdownMenuItem>
    <DropdownMenuItem>Oppdater</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Visual:**
```
┌──────────────────┐
│ GRUNNLAG         │
│ Status: Utkast ○ │
├──────────────────┤
│ [Handlinger ▼]   │ ← single button
└──────────────────┘
    ↓ Click opens:
  ┌─────────────┐
  │ Send grunnlag│
  │ Oppdater    │
  └─────────────┘
```

**Pros:**
- ✅ Extremely compact
- ✅ Scales to many actions
- ✅ Common in dashboards

**Cons:**
- ⚠️ Extra click required (discoverability)
- ⚠️ Hidden actions (users may not explore)
- ⚠️ More complex (Radix DropdownMenu component)

**Use When:**
- 5+ actions per card (not the case here)
- Power users (familiar with UI patterns)

---

### Button Size Comparison
```
size="lg"  → px-6 py-4 (large click target, takes space)
size="md"  → px-4 py-3 (default, balanced)
size="sm"  → px-3 py-2 (current choice, compact)
```

**Current:** `size="sm"` - Good balance for in-card placement

---

**✅ Selection for Action Buttons:**
- [ ] Option A: Full-Width Buttons (Prominent)
- [ ] Option B: Inline Buttons with `size="sm"` (Current) *(Recommended)*
- [ ] Option C: Dropdown Menu (Ultra-Compact)

---

## 7. Card Interaction States

**Question:** What visual feedback should users get when interacting with cards?

### Option A: Lift & Shadow ⭐ *Current Recommendation*
```css
hover:-translate-y-1 hover:shadow-lg transition-all
```

**Behavior:**
1. User hovers over card
2. Card moves up 4px
3. Shadow becomes deeper/larger
4. Creates "tactile" feedback

**Pros:**
- ✅ Clear feedback (something is happening)
- ✅ Modern, interactive feel
- ✅ Guides user to clickable areas

**Cons:**
- ⚠️ **Cards are not clickable** (only buttons inside are)
- ⚠️ May confuse users (they expect card to be a link)
- ⚠️ Animation can feel gimmicky in enterprise context

**Verdict for This App:**
- ❓ **Question:** Should cards be interactive at all?
- Cards display status (read-only), buttons are the interactive parts
- Hover on card itself may be misleading

---

### Option B: Border Highlight
```css
hover:border-blue-500 transition-colors
```

**Behavior:**
- Card border changes color on hover
- Subtle color shift (e.g., gray → blue)
- No movement

**Pros:**
- ✅ Subtle feedback
- ✅ Indicates "active zone"
- ✅ Less misleading (doesn't imply entire card is clickable)

**Cons:**
- ⚠️ May not be noticeable enough
- ⚠️ Can conflict with colored accent borders (Option D in section 1)

---

### Option C: Background Tint
```css
hover:bg-gray-50 transition-colors
```

**Behavior:**
- Background changes from white to very light gray
- Highlights the entire card area

**Pros:**
- ✅ Clear visual feedback
- ✅ Doesn't imply clickability
- ✅ Simple implementation

**Cons:**
- ⚠️ Subtle (may not be noticed)

---

### Option D: No Card Hover (Buttons Only) ⭐ *Recommended*
```css
No hover state on card itself
Buttons have their own hover states
```

**Behavior:**
- Card is static (no hover effect)
- Only buttons inside card respond to hover

**Pros:**
- ✅ **Honest interaction model** (cards aren't clickable)
- ✅ Reduces visual noise
- ✅ Buttons stand out as the interactive elements
- ✅ Clearer affordance (buttons look clickable, cards don't)

**Cons:**
- ⚠️ Less "interactive" feel
- ⚠️ Could feel static/boring

**Recommendation:** Option D (no card hover)
- Cards are informational containers, not clickable
- Buttons provide interaction
- Avoids misleading hover states

---

**✅ Selection for Card Interaction:**
- [ ] Option A: Lift & Shadow on Hover
- [ ] Option B: Border Highlight on Hover
- [ ] Option C: Background Tint on Hover
- [ ] Option D: No Card Hover (Buttons Only) *(Recommended)*

---

## 8. Grid Layout & Responsive Behavior

**Question:** How should the three cards arrange themselves on different screen sizes?

### Current Implementation (Baseline)
```css
Desktop (md+): grid-cols-3 (3 cards side-by-side)
Mobile:        grid-cols-1 (1 card stacked)
Gap:           gap-4 (16px between cards)
```

---

### Option A: Regular Grid (Uniform Height) ⭐ *Current*
```css
grid grid-cols-1 md:grid-cols-3 gap-4
Card: h-full (all cards same height)
```

**Visual (Desktop):**
```
┌─────┐ ┌─────┐ ┌─────┐
│  G  │ │  V  │ │  F  │  All same height
│     │ │     │ │     │  (tallest determines height)
│     │ │     │ │     │
└─────┘ └─────┘ └─────┘
```

**Pros:**
- ✅ Clean, orderly appearance
- ✅ Easy to scan horizontally
- ✅ Professional dashboard look

**Cons:**
- ⚠️ Wastes space if one card has more content
- ⚠️ Empty space at bottom of shorter cards

---

### Option B: Masonry / Variable Height
```css
Standard flow (no grid), cards grow as needed
Or: CSS Grid with grid-auto-rows: min-content
```

**Visual:**
```
┌─────┐ ┌─────┐ ┌─────┐
│  G  │ │  V  │ │  F  │  Heights vary based
└─────┘ │     │ │     │  on content
        │     │ │     │
        └─────┘ └─────┘
```

**Pros:**
- ✅ No wasted space
- ✅ More organic feel
- ✅ Better for varying content amounts

**Cons:**
- ⚠️ Harder to scan (uneven rows)
- ⚠️ Less "grid-like" (may feel messy)
- ⚠️ Unusual for dashboard design

**Recommendation for This App:** Keep Option A (uniform height)
- All cards have similar content structure
- Professional dashboard aesthetic
- Easy horizontal scanning

---

### Responsive Breakpoints

**Current:**
```css
Mobile (< 768px):  grid-cols-1 (stack vertically)
Tablet (768-1023): grid-cols-3 (side-by-side may be cramped)
Desktop (1024+):   grid-cols-3 (comfortable)
```

**Alternative: Tablet = 2 columns**
```css
grid-cols-1 md:grid-cols-2 lg:grid-cols-3
```

**Visual (Tablet):**
```
┌─────────┐ ┌─────────┐
│ GRUNNLAG│ │ VEDERLAG│  2 cards wide
└─────────┘ └─────────┘
┌─────────┐
│  FRIST  │             3rd card wraps
└─────────┘
```

**Pros:**
- ✅ More comfortable on tablet (768-1023px)
- ✅ Cards are wider (more room for buttons)

**Cons:**
- ⚠️ Inconsistent layout (sometimes 2, sometimes 3)
- ⚠️ Third card feels orphaned

**Recommendation:** Keep 3-column everywhere except mobile
- Emphasizes three-track system
- Consistent layout

---

**✅ Selection for Grid Layout:**
- [ ] Option A: Regular Grid, Uniform Height (Current)
- [ ] Option B: Masonry / Variable Height

**Responsive:**
- [ ] Keep 3 columns on tablet (768px+)
- [ ] Use 2 columns on tablet, 3 on desktop

---

## 9. Color Semantics & Track Identity

**NEW SECTION** - Should each track have a distinct color?

**Question:** How should users distinguish the three tracks visually?

### Option A: Status Colors Only (Current)
```
All cards use same border/background
Colors only appear in status badges:
- Green = Godkjent
- Yellow = Under behandling
- Red = Avvist
- Blue = Sendt
```

**Pros:**
- ✅ Simple, clean
- ✅ Status is the important information
- ✅ No color overload

**Cons:**
- ⚠️ Tracks not visually distinct (must read labels)
- ⚠️ May need to re-read card titles

---

### Option B: Colored Accent Borders (Per Track)
```
Grunnlag:  border-l-4 border-l-oslo-blue
Vederlag:  border-l-4 border-l-success (green)
Frist:     border-l-4 border-l-warning (orange)
```

**Visual:**
```
┃─────┐  ┃─────┐  ┃─────┐
┃ GRU │  ┃ VED │  ┃ FRI │
┃     │  ┃     │  ┃     │
┗━━━━━┛  ┗━━━━━┛  ┗━━━━━┛
 Blue     Green    Orange
```

**Pros:**
- ✅ **Instant track identification**
- ✅ Helps users managing multiple cases
- ✅ Color + position + label (redundancy)
- ✅ Professional dashboard look

**Cons:**
- ⚠️ May conflict with status badge colors
- ⚠️ Requires choosing 3 WCAG-compliant colors

**Color Suggestions:**
- **GRUNNLAG (Foundation):** `border-l-oslo-blue` - Solid, foundational (blue)
- **VEDERLAG (Money):** `border-l-success` - Financial success (green)
- **FRIST (Time/Urgency):** `border-l-warning` - Deadline urgency (orange)

**Accessibility Check:**
```
Oslo Blue (#004B75):   ✅ 4.5:1 contrast on white
Success Green (#2B7D58): ✅ 4.5:1 contrast on white
Warning Orange (#F7B538): ✅ 3:1 contrast (UI component minimum)
```

---

### Option C: Subtle Header Background Color
```
Grunnlag:  Card header has bg-blue-50
Vederlag:  Card header has bg-green-50
Frist:     Card header has bg-orange-50
```

**Visual:**
```
┌───────────┐
│█████████  │ ← Colored header background
│ GRUNNLAG  │
├───────────┤
│           │   White body
│ Status: ✓ │
└───────────┘
```

**Pros:**
- ✅ Clear track identity
- ✅ More visual weight than border accent
- ✅ Can use very light tints (subtle)

**Cons:**
- ⚠️ Adds visual complexity
- ⚠️ May compete with status badges

---

**Recommendation:** Option B (Colored Accent Borders)
- Balances track identity with simplicity
- Common in enterprise dashboards
- Works with colorblind users (color + label)

**✅ Selection for Track Colors:**
- [ ] Option A: Status Colors Only (Current)
- [ ] Option B: Colored Accent Borders Per Track *(Recommended)*
- [ ] Option C: Subtle Header Background Color

---

## 10. Mobile Optimization

**Question:** How should cards adapt to mobile screens (< 768px)?

### Current Behavior
```css
grid-cols-1 (stack vertically)
Cards span full width
Same padding as desktop (p-6)
```

**Mobile Layout:**
```
┌──────────────────┐
│    GRUNNLAG      │  Full width
│    Status: ✓     │
│  [Send grunnlag] │
└──────────────────┘
       ↓ scroll
┌──────────────────┐
│    VEDERLAG      │
│    Status: ⏳    │
│  [Send vederlag] │
└──────────────────┘
       ↓ scroll
┌──────────────────┐
│      FRIST       │
│    Status: ✓     │
└──────────────────┘
```

---

### Option A: Same Padding (Current)
```css
p-6 (24px) on all screen sizes
```

**Pros:**
- ✅ Consistent across devices
- ✅ Comfortable touch targets

**Cons:**
- ⚠️ Takes up screen real estate

---

### Option B: Reduced Padding on Mobile
```css
p-6 md:p-6 (16px mobile, 24px desktop)
```

**Pros:**
- ✅ More content visible on small screens
- ✅ Less scrolling

**Cons:**
- ⚠️ Touch targets may feel cramped
- ⚠️ Inconsistent feel

---

### Mobile Action Buttons

**Option A: Keep Inline (Current)**
```
[Send grunnlag] [Oppdater]  (side-by-side, wraps if needed)
```

**Option B: Stack Full-Width**
```
┌──────────────┐
│ Send grunnlag│  Full width
└──────────────┘
┌──────────────┐
│   Oppdater   │
└──────────────┘
```

**Pros:**
- ✅ Larger touch targets
- ✅ Easier to tap

**Cons:**
- ⚠️ More vertical scrolling

---

**Recommendation:** Keep current mobile behavior
- Padding is already comfortable
- Buttons wrap naturally if needed
- If user feedback suggests cramping, reduce padding

**✅ Selection for Mobile:**
- [ ] Same padding as desktop (24px)
- [ ] Reduced padding on mobile (16px)
- [ ] Inline buttons (wrap if needed)
- [ ] Stack buttons full-width

---

## 11. Accessibility Features (WCAG 2.1 AA)

**Current Compliance Status:** ✅ 40/40 tests passing

### Required Features (Already Implemented)
- ✅ **Focus indicators:** All buttons have visible focus outlines
- ✅ **Color contrast:** All text meets 4.5:1 minimum (WCAG AA)
- ✅ **Status announcements:** `role="status"` + `aria-live="polite"` on status badges
- ✅ **Keyboard navigation:** All actions accessible via keyboard
- ✅ **Semantic HTML:** Proper heading hierarchy (h1 → h2 → h3)
- ✅ **Screen reader labels:** `aria-label` on timeline, dashboard sections

---

### Optional Enhancements

#### High Contrast Mode Support
**Question:** Should cards have high-contrast mode overrides?

```css
@media (prefers-contrast: high) {
  .card {
    border-width: 2px;
    border-color: black;
  }
}
```

**Impact:** Better for Windows High Contrast users

---

#### Reduced Motion
**Question:** Should animations respect motion preferences?

```css
@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none !important;
  }
}
```

**Current:** ✅ Already implemented in `src/index.css`

---

#### Focus-Visible Polyfill
**Question:** Should we emphasize :focus-visible (keyboard) vs :focus (all)?

```css
/* Only show focus ring for keyboard navigation */
.button:focus-visible {
  outline: 2px solid blue;
}
.button:focus:not(:focus-visible) {
  outline: none; /* Hide for mouse clicks */
}
```

**Current:** Using `:focus-visible` (better UX)

---

**✅ Accessibility Enhancements:**
- [ ] Add high-contrast mode support
- [ ] Already implemented: Reduced motion
- [ ] Already implemented: Focus-visible

---

## 12. Information Priority & Hierarchy

**Question:** What should users see first when scanning the dashboard?

### Current Visual Flow
1. **Track title** (GRUNNLAG) - largest, bold, uppercase
2. **Status badge** (Godkjent ✓) - colored, icon + text
3. **Last updated** (Sist oppdatert: 1. des) - small, gray
4. **Action buttons** (below separator) - primary color

---

### Alternative: Status First
```
Status: Godkjent ✓    ← Largest element
GRUNNLAG              ← Secondary
Sist oppdatert: 1.des ← Tertiary
```

**Use When:**
- Users care more about current status than track identity
- Monitoring multiple cases (status changes are important)

**Cons:**
- ⚠️ Less clear which track you're looking at
- ⚠️ Breaks expected pattern (title usually first)

---

**Recommendation:** Keep current hierarchy (Track → Status → Date)
- Track identity is foundational
- Status is highlighted by color
- Follows standard card patterns

---

## Summary: Selection Sheet

Fill in your choices below, then provide to implementation team.

### 1. Border Style
- [ ] Option A: Subtle & Clean (1px gray border) - *Current*
- [ ] Option B: Bold & High Contrast (2px darker border)
- [ ] Option C: Shadow Only (*Not recommended*)
- [ ] Option D: Colored Accent Border (Blue/Green/Orange per track)

### 2. Spacing & Density
- [ ] Option A: Comfortable (24px padding) - *Current*
- [ ] Option B: Spacious (32px padding)
- [ ] Option C: Compact (16px padding)

### 3. Corner Rounding
- [ ] Option A: Modern Soft - `rounded-xl` (12px) - *Current*
- [ ] Option B: Professional Sharp - `rounded-md` (6px) or `rounded-none` (0px)
- [ ] Option C: Playful - `rounded-2xl` (*Not recommended*)

### 4. Typography
- [ ] Option A: Large & Readable (20px titles, 16px body) - *Current*
- [ ] Option B: Standard Desktop (18px titles, 14px body)
- [ ] Option C: Bold Headers (18px font-black titles, 14px body)

### 5. Status Badge
- [ ] Option A: Pill Badge with Icon + Text - *Current, Recommended*
- [ ] Option B: Compact Dot Indicator
- [ ] Option C: Icon Only (*Not recommended*)

### 6. Action Buttons
- [ ] Option A: Full-Width Buttons
- [ ] Option B: Inline Buttons `size="sm"` - *Current, Recommended*
- [ ] Option C: Dropdown Menu

### 7. Card Interaction
- [ ] Option A: Lift & Shadow on Hover
- [ ] Option B: Border Highlight on Hover
- [ ] Option C: Background Tint on Hover
- [ ] Option D: No Card Hover (Buttons Only) - *Recommended*

### 8. Grid Layout
- [ ] Option A: Regular Grid (Uniform Height) - *Current, Recommended*
- [ ] Option B: Masonry / Variable Height

**Responsive:**
- [ ] 3 columns on tablet (768px+) - *Current*
- [ ] 2 columns on tablet, 3 on desktop

### 9. Track Colors
- [ ] Option A: Status Colors Only - *Current*
- [ ] Option B: Colored Accent Borders Per Track - *Recommended*
- [ ] Option C: Subtle Header Background Color

### 10. Mobile Optimization
- [ ] Same padding as desktop (24px) - *Current*
- [ ] Reduced padding on mobile (16px)

**Action Buttons on Mobile:**
- [ ] Inline (wrap if needed) - *Current*
- [ ] Stack full-width

### 11. Accessibility Enhancements
- [ ] Add high-contrast mode support
- [x] Reduced motion support - *Already implemented*
- [x] Focus-visible patterns - *Already implemented*

---

## Implementation Notes

### CSS Class Mapping

**Current Punkt Design Tokens:**
```css
/* Colors */
--pkt-color-brand-dark-blue-1000: #004B75 (Oslo Blue)
--pkt-color-brand-green-700: #2B7D58 (Success)
--pkt-color-warning-500: #F7B538 (Warning/Orange)

/* Spacing */
--pkt-spacing-04: 1rem (16px)
--pkt-spacing-06: 1.5rem (24px)
--pkt-spacing-08: 2rem (32px)

/* Border Radius */
--pkt-border-radius-small: 4px
--pkt-border-radius-medium: 8px
--pkt-border-radius-large: 12px
```

**Tailwind Mappings:**
```css
/* Already configured in tailwind.config.js */
bg-oslo-blue → var(--pkt-color-brand-dark-blue-1000)
bg-success → var(--pkt-color-success-500)
p-pkt-06 → var(--pkt-spacing-06) /* 24px */
rounded-pkt-lg → var(--pkt-border-radius-large) /* 12px */
```

---

## Design Rationale (Reference)

### Why These Options?

**Border Style:**
- Subtle = Modern, professional
- Bold = Accessibility-first
- Colored = Dashboard pattern (track identification)

**Spacing:**
- Comfortable = Default recommendation (touch + desktop)
- Spacious = Executive/presentation mode
- Compact = Power users, maximize timeline visibility

**Action Buttons:**
- Inline = Best balance (space + clarity)
- Full-width = Emphasis (may overwhelm)
- Dropdown = Many actions (not needed here)

**Track Colors:**
- Accent borders = Best compromise (identity + simplicity)
- Header backgrounds = Too bold
- Status only = Minimalist but less scannable

---

## Testing Recommendations

After selecting options:

1. **Build a prototype** with chosen settings
2. **Test with actual users** (TE and BH roles)
3. **Verify accessibility**:
   - Run `npm run test:a11y` (should pass 40/40 tests)
   - Manual keyboard navigation
   - Screen reader test (NVDA or VoiceOver)
4. **Check on real devices**:
   - Desktop (1920x1080)
   - Laptop (1366x768)
   - Tablet (768x1024)
   - Mobile (375x667)
5. **Gather feedback**:
   - Is status immediately clear?
   - Are actions easy to find?
   - Does it feel professional?
   - Can users scan quickly?

---

## Contact & Questions

If you need clarification on any option:
- Review the implementation in `src/components/views/StatusCard.tsx`
- Check the Accessibility Test Results: `docs/ACCESSIBILITY_TEST_RESULTS.md`
- Review Oslo Punkt Design System: https://punkt.oslo.systems/

---

**Document Version:** 1.0
**Last Updated:** 2025-12-02
**Status:** Ready for Selection
