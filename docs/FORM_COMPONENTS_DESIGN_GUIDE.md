# Form Components Design Guide

> **Companion to:** Design Selection Guide (Cards & Dashboard)
>
> **Purpose:** Select form input styles for modal dialogs and data entry
>
> **Consistency:** All choices should align with card component selections
>
> **Components:** Text inputs, textareas, checkboxes, radio buttons, dropdowns, date pickers, number inputs

---

## Design Consistency Matrix

Form components should inherit styling from your card selections:

| Aspect | Card Selection | Form Inheritance |
|--------|----------------|------------------|
| **Border Style** | Subtle/Bold/Colored | Same border weight & color |
| **Corner Rounding** | 12px/6px/0px | Same border-radius |
| **Font Size** | 20px/18px/16px | Input text matches body text |
| **Spacing** | 24px/32px/16px | Label margins match card spacing |
| **Interaction** | Hover effects | Focus states use same pattern |

**Example:** If you chose "Bold borders (2px)" for cards → inputs should use `border-2`
**Example:** If you chose "12px rounding" for cards → inputs should use `rounded-xl`

---

## 1. Text Input Fields (Short)

**Use:** Sakstittel, Dokumentnummer, Beløp, Antall dager

**Current Oslo Punkt Pattern:**
```tsx
<input
  type="text"
  className="block w-full rounded-md border-gray-300 shadow-sm
             focus:border-oslo-blue focus:ring-oslo-blue"
/>
```

---

### Option A: Standard Input (Recommended)
```css
Border: border border-gray-300
Padding: px-3 py-2 (12px/8px)
Focus: ring-2 ring-oslo-blue border-oslo-blue
```

**Visual:**
```
┌─────────────────────────────┐
│ Type here...                │  Standard height (~40px)
└─────────────────────────────┘

On focus:
┌═════════════════════════════┐
│ Type here...                │  Blue ring (2px)
└═════════════════════════════┘
```

**Pros:**
- ✅ Familiar pattern (matches standard web forms)
- ✅ Touch-friendly height (40px minimum)
- ✅ Clear focus state

---

### Option B: Large Comfortable Input
```css
Padding: px-4 py-3 (16px/12px)
Height: ~48px
```

**Pros:**
- ✅ Extra comfortable for accessibility
- ✅ Matches "Spacious" card padding
- ✅ Better for construction sites (gloves, touch screens)

**Cons:**
- ⚠️ Takes more vertical space in modals

---

### Option C: Compact Input
```css
Padding: px-2.5 py-1.5 (10px/6px)
Height: ~32px
```

**Pros:**
- ✅ Data-dense forms (many fields)
- ✅ Matches "Compact" card padding

**Cons:**
- ⚠️ Less touch-friendly
- ⚠️ May feel cramped

---

**Selection:**
- [ ] A: Standard (40px height, px-3 py-2)
- [ ] B: Large Comfortable (48px height, px-4 py-3)
- [ ] C: Compact (32px height, px-2.5 py-1.5)

---

## 2. Text Input Fields (Long) - Textarea

**Use:** Begrunnelse, Kommentarer, Beskrivelse

---

### Option A: Auto-Growing Textarea
```tsx
<textarea
  rows={4}
  className="block w-full resize-y"
/>
```

**Visual:**
```
┌─────────────────────────────┐
│ Line 1                      │
│ Line 2                      │
│ Line 3                      │
│ Line 4                      │  User can resize vertically
└─────────────────────────────┘
  ═ (drag handle)
```

**Pros:**
- ✅ User controls height
- ✅ Default 4 rows (comfortable start)

**Cons:**
- ⚠️ User may resize too small/large

---

### Option B: Fixed Height
```tsx
<textarea
  rows={6}
  className="block w-full resize-none"
/>
```

**Pros:**
- ✅ Consistent layout
- ✅ No unexpected size changes

**Cons:**
- ⚠️ Less flexible

---

### Option C: Expandable on Focus
```tsx
<textarea
  rows={3}
  onFocus={() => setRows(6)}
  className="transition-all"
/>
```

**Pros:**
- ✅ Compact when empty
- ✅ Expands when user starts typing

**Cons:**
- ⚠️ Layout shift (can be jarring)

---

**Selection:**
- [ ] A: Auto-Growing (resize-y, 4 rows default)
- [ ] B: Fixed Height (resize-none, 6 rows)
- [ ] C: Expandable on Focus (3→6 rows)

---

## 3. Border & Focus States (All Inputs)

**Question:** How should inputs look when focused vs. idle?

---

### Option A: Ring + Border Change (Recommended)
```css
Idle:  border-gray-300
Focus: border-oslo-blue ring-2 ring-oslo-blue/20
```

**Visual:**
```
Idle:
┌─────────────┐  Gray border (1px or 2px)
│ Input       │
└─────────────┘

Focus:
╔═════════════╗  Blue border + light blue ring
║ Input       ║  Very clear focus state
╚═════════════╝
```

**Pros:**
- ✅ Extremely visible (WCAG AAA for focus)
- ✅ Standard pattern (Tailwind default)
- ✅ Works with keyboard navigation

---

### Option B: Border Change Only
```css
Idle:  border-gray-300
Focus: border-oslo-blue (no ring)
```

**Pros:**
- ✅ Subtle, professional
- ✅ No extra visual weight

**Cons:**
- ⚠️ Less visible (may not meet WCAG AAA)

---

### Option C: Shadow + Border
```css
Idle:  border-gray-300
Focus: border-oslo-blue shadow-md
```

**Pros:**
- ✅ Clear depth change
- ✅ Modern aesthetic

**Cons:**
- ⚠️ Shadow may not print or show in high-contrast mode

---

**Selection:**
- [ ] A: Ring + Border Change (ring-2 ring-oslo-blue/20)
- [ ] B: Border Change Only
- [ ] C: Shadow + Border

---

## 4. Labels & Required Fields

**Question:** How should labels and required fields be displayed?

---

### Option A: Label Above, Asterisk for Required
```tsx
<label className="block text-sm font-medium text-gray-700">
  Beløp <span className="text-error">*</span>
</label>
<input type="number" required />
```

**Visual:**
```
Beløp *          ← Label (14px, medium weight)
┌─────────────┐
│ 500000      │  ← Input
└─────────────┘
```

**Pros:**
- ✅ Standard pattern (universally understood)
- ✅ Asterisk + color (redundant encoding)
- ✅ Screen reader announces "required"

---

### Option B: Label Above, "(påkrevd)" Text
```tsx
<label className="block text-sm font-medium text-gray-700">
  Beløp <span className="text-gray-500 font-normal">(påkrevd)</span>
</label>
```

**Visual:**
```
Beløp (påkrevd)  ← More explicit in Norwegian
┌─────────────┐
│ 500000      │
└─────────────┘
```

**Pros:**
- ✅ Language-appropriate (Norwegian)
- ✅ More explicit than asterisk
- ✅ Accessible (text-based)

**Cons:**
- ⚠️ Takes more space

---

### Option C: Inline Label (Side-by-Side)
```tsx
<div className="flex items-center gap-4">
  <label className="w-32 text-sm font-medium">Beløp</label>
  <input className="flex-1" />
</div>
```

**Visual:**
```
Beløp    ┌──────────────────┐
         │ 500000           │  ← Input takes remaining space
         └──────────────────┘
```

**Pros:**
- ✅ Compact (good for many fields)
- ✅ Traditional form layout

**Cons:**
- ⚠️ Less accessible (harder to associate on mobile)
- ⚠️ Fixed label width can be awkward

---

**Selection:**
- [ ] A: Label Above, Asterisk * (Recommended)
- [ ] B: Label Above, "(påkrevd)" Text
- [ ] C: Inline Label (Side-by-Side)

---

## 5. Helper Text & Error Messages

**Question:** How should validation errors and hints be displayed?

---

### Option A: Error Below Input (Red Text + Icon)
```tsx
<input aria-invalid="true" aria-describedby="error-msg" />
<p id="error-msg" className="mt-2 text-sm text-error">
  <span>⚠</span> Beløp må være større enn 0
</p>
```

**Visual:**
```
Beløp *
┌─────────────┐
│ -500        │  ← Red border (error state)
└─────────────┘
⚠ Beløp må være større enn 0  ← Error message
```

**Pros:**
- ✅ Clear error association
- ✅ Icon + text (redundant encoding)
- ✅ Announced by screen readers

---

### Option B: Error Inside Input (Background Tint)
```tsx
<input className="bg-error-50 border-error" />
<p className="text-error">Error message</p>
```

**Pros:**
- ✅ Very visible (entire field changes color)

**Cons:**
- ⚠️ Background tint may hide text in some browsers
- ⚠️ Less common pattern

---

### Option C: Inline Validation (Checkmark/Cross)
```tsx
<div className="relative">
  <input />
  <span className="absolute right-3 top-3">
    ✓ (green) or ✗ (red)
  </span>
</div>
```

**Visual:**
```
┌─────────────────────┐
│ 500000            ✓ │  ← Checkmark inside input
└─────────────────────┘
```

**Pros:**
- ✅ Immediate feedback (as you type)
- ✅ Compact

**Cons:**
- ⚠️ May interfere with input text
- ⚠️ Not standard pattern

---

**Selection:**
- [ ] A: Error Below Input (text-error, with icon)
- [ ] B: Error Inside Input (bg-error-50 tint)
- [ ] C: Inline Validation Icons

---

## 6. Number Inputs

**Use:** Vederlag (beløp), Antall dager, Prosent

**Question:** Should number inputs use native spinners or custom formatting?

---

### Option A: Native Number Input
```tsx
<input
  type="number"
  min="0"
  step="1000"
  className="..."
/>
```

**Visual:**
```
┌─────────────────┐
│ 500000      ▲▼ │  ← Browser spinners
└─────────────────┘
```

**Pros:**
- ✅ Simple implementation
- ✅ Built-in validation
- ✅ Mobile keyboard (numeric)

**Cons:**
- ⚠️ No thousand separators (500000 vs 500 000)
- ⚠️ Spinners look different per browser

---

### Option B: Text Input + Formatting
```tsx
<input
  type="text"
  inputMode="numeric"
  value={formatNumber(value)} // "500 000"
  onChange={handleChange}
/>
```

**Visual:**
```
┌─────────────────┐
│ 500 000 NOK     │  ← Formatted with spaces
└─────────────────┘
```

**Pros:**
- ✅ Norwegian number format (space separator)
- ✅ Can add currency suffix (NOK)
- ✅ More readable

**Cons:**
- ⚠️ Requires custom parsing logic
- ⚠️ No native validation

---

### Option C: Hybrid (Text with Number Validation)
```tsx
<input
  type="text"
  inputMode="numeric"
  pattern="[0-9 ]+"
/>
```

**Pros:**
- ✅ Numeric keyboard on mobile
- ✅ Custom formatting
- ✅ HTML5 pattern validation

---

**Recommendation for Norwegian App:** Option B or C (formatted numbers)
- Construction contracts use large numbers (millions)
- "500 000 NOK" more readable than "500000"

**Selection:**
- [ ] A: Native Number Input (type="number")
- [ ] B: Text Input + Formatting ("500 000 NOK")
- [ ] C: Hybrid (text + numeric pattern)

---

## 7. Checkboxes

**Use:** "Inkluderer produktivitetstap", "Godta vilkår"

---

### Option A: Standard Checkbox
```tsx
<div className="flex items-center">
  <input
    type="checkbox"
    className="h-4 w-4 rounded border-gray-300
               text-oslo-blue focus:ring-oslo-blue"
  />
  <label className="ml-2 text-sm">
    Inkluderer produktivitetstap
  </label>
</div>
```

**Visual:**
```
☑ Inkluderer produktivitetstap  (16x16px checkbox)
```

**Pros:**
- ✅ Native, accessible
- ✅ Simple implementation

**Cons:**
- ⚠️ Small (16px may be hard to tap on mobile)

---

### Option B: Large Checkbox
```tsx
<input
  type="checkbox"
  className="h-5 w-5"  // 20x20px
/>
```

**Pros:**
- ✅ Better touch target
- ✅ More visible

---

### Option C: Custom Styled Checkbox
```tsx
// Radix UI Checkbox with custom styling
<Checkbox
  className="h-6 w-6 rounded-md border-2"
>
  <CheckIcon />
</Checkbox>
```

**Visual:**
```
┌──┐
│✓ │ Inkluderer produktivitetstap  (24x24px)
└──┘
```

**Pros:**
- ✅ Full design control
- ✅ Large touch target (24x24px)
- ✅ Consistent across browsers

**Cons:**
- ⚠️ Requires Radix UI component
- ⚠️ More complex implementation

---

**Selection:**
- [ ] A: Standard Checkbox (16x16px, h-4 w-4)
- [ ] B: Large Checkbox (20x20px, h-5 w-5)
- [ ] C: Custom Styled Checkbox (24x24px, Radix)

---

## 8. Radio Buttons

**Use:** "Godkjenne / Avvise / Delvis godkjenne"

---

### Option A: Standard Radio Buttons
```tsx
<fieldset>
  <legend className="text-sm font-medium">Svar</legend>
  <div className="space-y-2 mt-2">
    <label className="flex items-center">
      <input type="radio" name="svar" value="godkjent"
             className="h-4 w-4 text-oslo-blue" />
      <span className="ml-2">Godkjenne</span>
    </label>
    <label className="flex items-center">
      <input type="radio" name="svar" value="avvist" />
      <span className="ml-2">Avvise</span>
    </label>
  </div>
</fieldset>
```

**Visual:**
```
Svar
◉ Godkjenne       (16x16px circles)
○ Avvise
○ Delvis godkjenne
```

**Pros:**
- ✅ Native, accessible
- ✅ Screen readers handle fieldset/legend correctly

---

### Option B: Card-Based Radio (Large Touch Targets)
```tsx
<label className="block p-4 border-2 rounded-lg cursor-pointer
                  hover:border-oslo-blue
                  has-[:checked]:border-oslo-blue
                  has-[:checked]:bg-oslo-blue/5">
  <input type="radio" className="sr-only" />
  <span className="font-medium">Godkjenne</span>
</label>
```

**Visual:**
```
┌────────────────────┐
│ ◉ Godkjenne        │  ← Selected (blue border)
└────────────────────┘
┌────────────────────┐
│ ○ Avvise           │  ← Unselected
└────────────────────┘
```

**Pros:**
- ✅ Very large touch target (entire card clickable)
- ✅ Modern, mobile-friendly
- ✅ Clear visual feedback

**Cons:**
- ⚠️ Takes more space (vertical)

---

**Selection:**
- [ ] A: Standard Radio Buttons (16x16px, stacked)
- [ ] B: Card-Based Radio (large touch targets)

---

## 9. Dropdown Menus (Select)

**Use:** Metode (Direkte kostnader, Timepriser, Enhetspriser)

---

### Option A: Native Select
```tsx
<select className="block w-full rounded-md border-gray-300">
  <option value="">Velg metode</option>
  <option value="direkte">Direkte kostnader</option>
  <option value="time">Timepriser</option>
  <option value="enhet">Enhetspriser</option>
</select>
```

**Visual:**
```
┌──────────────────────┐
│ Velg metode        ▼ │  ← Browser-styled dropdown
└──────────────────────┘
```

**Pros:**
- ✅ Native, accessible
- ✅ Works on all devices
- ✅ Mobile shows optimized picker

**Cons:**
- ⚠️ Limited styling (looks different per OS)
- ⚠️ Dropdown icon varies by browser

---

### Option B: Radix Select (Custom Styled)
```tsx
<Select.Root>
  <Select.Trigger className="...">
    <Select.Value placeholder="Velg metode" />
    <Select.Icon><ChevronDown /></Select.Icon>
  </Select.Trigger>
  <Select.Content>
    <Select.Item value="direkte">Direkte kostnader</Select.Item>
    {/* ... */}
  </Select.Content>
</Select.Root>
```

**Visual:**
```
┌──────────────────────┐
│ Velg metode        ▼ │  ← Custom styled
└──────────────────────┘
       ↓ Opens custom dropdown
┌──────────────────────┐
│ Direkte kostnader    │  ← Custom list
│ Timepriser          │
│ Enhetspriser        │
└──────────────────────┘
```

**Pros:**
- ✅ Full control over styling
- ✅ Consistent across browsers
- ✅ Can add icons, badges, etc.

**Cons:**
- ⚠️ More complex implementation
- ⚠️ Requires Radix UI
- ⚠️ Mobile may not use native picker

---

**Recommendation:** Option A (native) unless design requires custom styling
- Native selects work better on mobile
- Accessible by default
- Familiar to all users

**Selection:**
- [ ] A: Native Select (browser-styled)
- [ ] B: Radix Select (custom-styled)

---

## 10. Date Picker

**Use:** Frist dato, Svarfrist

---

### Option A: Native Date Input
```tsx
<input
  type="date"
  className="block w-full rounded-md border-gray-300"
/>
```

**Visual:**
```
┌──────────────────────┐
│ dd.mm.åååå       📅 │  ← Browser date picker
└──────────────────────┘
```

**Pros:**
- ✅ Native, accessible
- ✅ Mobile shows calendar widget
- ✅ Built-in validation

**Cons:**
- ⚠️ Format varies by locale (may show mm/dd/yyyy)
- ⚠️ Styling limited

---

### Option B: Text Input with Format Hint
```tsx
<input
  type="text"
  placeholder="DD.MM.ÅÅÅÅ"
  pattern="\d{2}\.\d{2}\.\d{4}"
/>
<p className="text-xs text-gray-500">Format: DD.MM.ÅÅÅÅ</p>
```

**Pros:**
- ✅ Norwegian format guaranteed
- ✅ Simple implementation

**Cons:**
- ⚠️ No calendar widget
- ⚠️ User must type manually

---

### Option C: date-fns + Radix Popover (Custom Calendar)
```tsx
<Popover>
  <PopoverTrigger>
    <input value={format(date, 'dd.MM.yyyy')} readOnly />
    <CalendarIcon />
  </PopoverTrigger>
  <PopoverContent>
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      locale={nb}
    />
  </PopoverContent>
</Popover>
```

**Visual:**
```
┌──────────────────────┐
│ 15.12.2025       📅 │  ← Click opens calendar
└──────────────────────┘
       ↓ Opens
┌─────────────────────┐
│   Desember 2025     │
│ Ma Ti On To Fr Lø Sø│
│ 1  2  3  4  5  6  7 │
│ 8  9 10 11 12 13 14 │
│[15]16 17 18 19 20 21│  ← 15 selected
└─────────────────────┘
```

**Pros:**
- ✅ Norwegian format (dd.MM.yyyy)
- ✅ Norwegian locale (month names, first day)
- ✅ Full control over styling
- ✅ Best UX (visual calendar)

**Cons:**
- ⚠️ Requires date-fns (already installed ✅)
- ⚠️ Requires Radix Popover
- ⚠️ More complex

---

**Recommendation:** Option C (custom calendar) for best UX
- Already have date-fns installed
- Norwegian format guaranteed
- Best user experience

**Selection:**
- [ ] A: Native Date Input (type="date")
- [ ] B: Text Input with Format Hint
- [ ] C: Custom Calendar (date-fns + Radix)

---

## 11. Input Grouping & Layout

**Question:** How should multiple related inputs be grouped in modals?

---

### Option A: Stacked (Vertical)
```tsx
<div className="space-y-4">
  <div>
    <label>Beløp</label>
    <input />
  </div>
  <div>
    <label>Metode</label>
    <select />
  </div>
  <div>
    <label>Begrunnelse</label>
    <textarea />
  </div>
</div>
```

**Visual:**
```
Beløp
┌──────────┐
│ 500000   │
└──────────┘

Metode
┌──────────┐
│ Velg   ▼ │
└──────────┘

Begrunnelse
┌──────────┐
│          │
│          │
└──────────┘
```

**Pros:**
- ✅ Mobile-friendly
- ✅ Easy to scan
- ✅ Each field gets full width

**Cons:**
- ⚠️ Long modals (requires scrolling)

---

### Option B: Two-Column Layout (Desktop)
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
    <label>Beløp</label>
    <input />
  </div>
  <div>
    <label>Metode</label>
    <select />
  </div>
  <div className="md:col-span-2">
    <label>Begrunnelse</label>
    <textarea />
  </div>
</div>
```

**Visual (Desktop):**
```
Beløp               Metode
┌──────────┐        ┌──────────┐
│ 500000   │        │ Velg   ▼ │
└──────────┘        └──────────┘

Begrunnelse (spans 2 columns)
┌──────────────────────────────┐
│                              │
└──────────────────────────────┘
```

**Pros:**
- ✅ Compact (less scrolling on desktop)
- ✅ Groups related fields visually

**Cons:**
- ⚠️ Labels may vary in width (alignment issues)

---

**Selection:**
- [ ] A: Stacked (Vertical, space-y-4)
- [ ] B: Two-Column on Desktop (grid-cols-2)

---

## 12. Disabled State

**Question:** How should disabled/read-only fields look?

---

### Option A: Gray Background
```tsx
<input
  disabled
  className="bg-gray-100 text-gray-500 cursor-not-allowed"
/>
```

**Visual:**
```
┌─────────────┐
│ 500000      │  ← Gray background, gray text
└─────────────┘
    (disabled)
```

**Pros:**
- ✅ Very clear (different background)
- ✅ Standard pattern

---

### Option B: Dashed Border
```tsx
<input
  disabled
  className="border-dashed border-gray-300 text-gray-600"
/>
```

**Visual:**
```
┌╌╌╌╌╌╌╌╌╌╌╌┐
│ 500000     │  ← Dashed border
└╌╌╌╌╌╌╌╌╌╌╌┘
```

**Pros:**
- ✅ Clear indicator (pattern change)
- ✅ Text remains readable

---

### Option C: Opacity Reduction
```tsx
<input
  disabled
  className="opacity-50 cursor-not-allowed"
/>
```

**Cons:**
- ⚠️ Text may not meet contrast requirements (WCAG)
- ❌ Not recommended

---

**Selection:**
- [ ] A: Gray Background (bg-gray-100)
- [ ] B: Dashed Border (border-dashed)
- [ ] C: Opacity Reduction (*Not recommended*)

---

## Component Summary Table

Quick reference for all form components:

| Component | Height | Border | Focus State | Notes |
|-----------|--------|--------|-------------|-------|
| Text Input | 40px (standard) | border or border-2 | ring-2 ring-oslo-blue | Match card border weight |
| Textarea | 4-6 rows | Same as input | Same as input | Resizable or fixed |
| Checkbox | 16-24px | border | ring-2 ring-oslo-blue | Larger = better touch |
| Radio | 16px | border | ring-2 ring-oslo-blue | Group with fieldset |
| Select | 40px | Same as input | Same as input | Native recommended |
| Date | 40px | Same as input | Same as input | Custom calendar best UX |
| Number | 40px | Same as input | Same as input | Format with spaces |

---

## Consistency Rules

### Border Weight
- **If cards use `border`** → inputs use `border`
- **If cards use `border-2`** → inputs use `border-2`

### Corner Radius
- **If cards use `rounded-xl` (12px)** → inputs use `rounded-xl`
- **If cards use `rounded-md` (6px)** → inputs use `rounded-md`
- **If cards use `rounded-none` (0px)** → inputs use `rounded-none`

### Font Size
- **Input text = Card body text**
  - If cards use 16px → inputs use 16px
  - If cards use 14px → inputs use 14px
- **Label text = One step smaller**
  - If body is 16px → labels are 14px (`text-sm`)
  - If body is 14px → labels are 12px (`text-xs`)

### Spacing
- **Vertical spacing between fields:**
  - If cards use `p-6` (24px) → fields use `space-y-4` (16px) or `space-y-6` (24px)
  - If cards use `p-4` (16px) → fields use `space-y-3` (12px)
  - If cards use `p-8` (32px) → fields use `space-y-6` (24px)

### Colors
- **Focus ring:** `ring-oslo-blue` (always)
- **Error state:** `border-error text-error` (always)
- **Success/valid:** `border-success` (optional)

---

## Implementation Example: Send Vederlag Modal

Based on consistent selections:

```tsx
// Assuming: Card border=border-2, radius=rounded-xl, padding=p-6

<Modal title="Send vederlagskrav">
  <form className="space-y-6"> {/* Match card padding */}

    {/* Number Input - Formatted */}
    <div>
      <label className="block text-sm font-medium text-gray-700">
        Krevd beløp (NOK) <span className="text-error">*</span>
      </label>
      <input
        type="text"
        inputMode="numeric"
        value="500 000"
        className="mt-2 block w-full px-4 py-3
                   border-2 border-gray-300 rounded-xl
                   focus:border-oslo-blue focus:ring-2 focus:ring-oslo-blue/20
                   text-base"
      />
    </div>

    {/* Dropdown */}
    <div>
      <label className="block text-sm font-medium text-gray-700">
        Beregningsmetode <span className="text-error">*</span>
      </label>
      <select
        className="mt-2 block w-full px-4 py-3
                   border-2 border-gray-300 rounded-xl
                   focus:border-oslo-blue focus:ring-2 focus:ring-oslo-blue/20
                   text-base"
      >
        <option value="">Velg metode</option>
        <option value="direkte">Direkte kostnader</option>
        <option value="time">Timepriser</option>
        <option value="enhet">Enhetspriser</option>
      </select>
    </div>

    {/* Textarea */}
    <div>
      <label className="block text-sm font-medium text-gray-700">
        Begrunnelse <span className="text-error">*</span>
      </label>
      <textarea
        rows={4}
        className="mt-2 block w-full px-4 py-3
                   border-2 border-gray-300 rounded-xl resize-y
                   focus:border-oslo-blue focus:ring-2 focus:ring-oslo-blue/20
                   text-base"
      />
    </div>

    {/* Checkboxes */}
    <div className="space-y-3">
      <label className="flex items-center">
        <input
          type="checkbox"
          className="h-5 w-5 rounded-md border-2 border-gray-300
                     text-oslo-blue focus:ring-2 focus:ring-oslo-blue"
        />
        <span className="ml-2 text-sm">Inkluderer produktivitetstap</span>
      </label>
      <label className="flex items-center">
        <input
          type="checkbox"
          className="h-5 w-5 rounded-md border-2 border-gray-300
                     text-oslo-blue focus:ring-2 focus:ring-oslo-blue"
        />
        <span className="ml-2 text-sm">Inkluderer rigg/drift</span>
      </label>
    </div>

    {/* Buttons */}
    <div className="flex justify-end gap-3 pt-6 border-t">
      <Button variant="ghost">Avbryt</Button>
      <Button variant="primary">Send krav</Button>
    </div>

  </form>
</Modal>
```

---

## Selection Summary Sheet

### Text Inputs
- [ ] Standard (40px, px-3 py-2)
- [ ] Large (48px, px-4 py-3)
- [ ] Compact (32px, px-2.5 py-1.5)

### Textarea
- [ ] Auto-Growing (resize-y, 4 rows)
- [ ] Fixed Height (resize-none, 6 rows)
- [ ] Expandable on Focus

### Focus State
- [ ] Ring + Border Change (Recommended)
- [ ] Border Change Only
- [ ] Shadow + Border

### Labels
- [ ] Above with Asterisk *
- [ ] Above with "(påkrevd)"
- [ ] Inline (Side-by-Side)

### Error Messages
- [ ] Below Input with Icon
- [ ] Inside Input (background tint)
- [ ] Inline Validation Icons

### Number Inputs
- [ ] Native (type="number")
- [ ] Formatted Text ("500 000 NOK")
- [ ] Hybrid (text + numeric pattern)

### Checkboxes
- [ ] Standard (16px, h-4 w-4)
- [ ] Large (20px, h-5 w-5)
- [ ] Custom Styled (24px, Radix)

### Radio Buttons
- [ ] Standard Stacked (16px)
- [ ] Card-Based (large touch targets)

### Dropdown
- [ ] Native Select
- [ ] Radix Select (custom)

### Date Picker
- [ ] Native (type="date")
- [ ] Text Input with Hint
- [ ] Custom Calendar (Recommended)

### Input Layout
- [ ] Stacked Vertical (space-y-4)
- [ ] Two-Column on Desktop

### Disabled State
- [ ] Gray Background (bg-gray-100)
- [ ] Dashed Border

---

## Next Steps

1. **Review card selections** from main design guide
2. **Mark your preferences** above (match card style)
3. **Test in a modal** (SendVederlagModal is good example)
4. **Verify accessibility:**
   - All inputs have labels
   - Focus states are visible
   - Error messages are announced
   - Color contrast meets WCAG AA (4.5:1)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-02
**Companion to:** `DESIGN_SELECTION_GUIDE.md` (Cards)
