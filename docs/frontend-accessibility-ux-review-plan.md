# Frontend Accessibility & UX Review Plan

**Document Version:** 1.0
**Date:** 2025-12-04
**Scope:** WCAG 2.1 AA Compliance, UX Best Practices, Desktop & Mobile
**Framework:** React + TypeScript + Radix UI + Tailwind CSS

---

## Executive Summary

This document outlines a comprehensive accessibility and UX review plan for the Unified Timeline application. The review focuses on WCAG 2.1 AA compliance, mobile-first design principles, and user experience best practices across all form elements, interactive components, and page layouts.

**Key Areas:**
- Form accessibility and usability (6 modal forms)
- Mobile responsiveness and touch targets
- Screen reader compatibility
- Keyboard navigation
- Error handling and validation
- Visual design and contrast
- Semantic HTML and ARIA implementation

---

## Core Principles

### 1. Form Design & Accessibility

#### 1.1 Label Placement and Structure
**Principle:** Always use labels and place them above form fields.

**Requirements:**
- ✅ Labels must be semantically associated with inputs (`htmlFor` attribute)
- ✅ Labels positioned above fields for better scanning and readability
- ✅ Never place labels to the left of fields (creates scanning difficulty)
- ❌ Never use placeholder text as labels or essential help text

**Good Label Characteristics:**
- Concise and consistent (helps users understand expectations)
- Ideally 1-3 words, under 20 characters including spaces
- No all-caps or all-lowercase text (use sentence case)
- No colons at the end
- Include format/length expectations when helpful (e.g., "Telefonnummer (8 siffer)")

**Review Checklist:**
- [ ] All form inputs have associated `<Label>` components
- [ ] Labels are visually positioned above inputs
- [ ] Label text is concise and clear
- [ ] No placeholder text used as primary instruction
- [ ] Required fields clearly marked with visual indicator

**Components to Review:**
- `src/components/primitives/Label.tsx` - Base label component
- `src/components/primitives/FormField.tsx` - Label integration
- All 6 action modal forms in `src/components/actions/`

---

#### 1.2 Placeholder Text Usage
**Principle:** Avoid using placeholder text for meaningful content.

**Rationale:**
- Not accessible to all screen readers
- Creates confusion (users may think field is pre-filled)
- Low contrast makes it hard to read
- Disappears when user starts typing

**Acceptable Uses:**
- Format examples (e.g., "DD.MM.YYYY" for date fields)
- Non-essential hints that supplement visible help text

**Review Checklist:**
- [ ] Audit all `<Input>` and `<Textarea>` components for placeholder usage
- [ ] Ensure no critical instructions are only in placeholders
- [ ] Consider removing placeholders entirely where not needed
- [ ] If used, ensure format is supplemental to visible help text

---

#### 1.3 Help Text and Instructions
**Principle:** Provide clear, accessible help text to guide users.

**Types of Help Text:**
1. **Inline Help Text:** Short explanation under label (1 line preferred)
2. **Expandable Help Text:** Longer detailed explanations (click to reveal)

**Help Text Guidelines:**
- Keep text short and concrete
- Use simple language everyone can understand
- Avoid jargon and technical terms unless necessary
- If specialized terms required, always provide help text
- Consider incorporating format/length into label text itself

**Implementation:**
- Help text should be programmatically associated (`aria-describedby`)
- Must be visible before user interacts with field
- Should supplement label, never replace it

**Review Checklist:**
- [ ] Complex fields have appropriate help text
- [ ] Help text properly associated with inputs (`aria-describedby`)
- [ ] Help text is visible without user action (for critical info)
- [ ] Expandable help text has accessible toggle button
- [ ] Help text appears before field, not after

**Components to Review:**
- `src/components/primitives/FormField.tsx` - Help text rendering
- `src/components/primitives/InfoLabel.tsx` - Expandable help tooltips
- Complex forms: `SendVederlagModal.tsx`, `RespondVederlagModal.tsx`

---

#### 1.4 Field Grouping and Organization
**Principle:** Group related fields together for better navigation.

**Implementation Strategies:**
1. **Visual Grouping:** Use spacing, borders, or background colors
2. **Semantic Grouping:** Use `<fieldset>` and `<legend>` elements
3. **Multi-Step Forms:** Break long forms into logical steps

**Benefits:**
- Easier to scan and understand form structure
- Helps screen reader users navigate efficiently
- Reduces cognitive load
- Creates clear mental model of form sections

**Review Checklist:**
- [ ] Related fields are visually and semantically grouped
- [ ] Complex forms use `<fieldset>` and `<legend>` where appropriate
- [ ] Groups have clear headings or labels
- [ ] Long forms broken into manageable sections
- [ ] Each section has a clear purpose

**Forms to Review:**
- `SendVederlagModal.tsx` (20+ fields) - Multi-section form
- `RespondVederlagModal.tsx` (15+ fields) - Multi-section form
- All modal forms for logical grouping

---

#### 1.5 Input Width Matches Content
**Principle:** Size input fields to match expected content length.

**Examples:**
- Phone number (8 digits): Narrow field ~120px
- Postal code (4 digits): Narrow field ~100px
- CVC code (3 digits): Very narrow field ~80px
- Email address: Wide field to accommodate addresses
- Names: Medium-wide field

**Benefits:**
- Provides visual hint about expected input length
- Reduces user uncertainty
- Improves form aesthetics and usability
- Helps users understand data format

**Mobile Consideration:**
- On mobile, fields can fill container width for touch friendliness
- Consider max-width constraints for very short inputs
- Balance between touch target size and content indication

**Review Checklist:**
- [ ] Short fixed-length inputs have appropriate widths
- [ ] Long text inputs accommodate reasonable content length
- [ ] Mobile: fields have adequate touch target size (min 44x44px)
- [ ] Width provides clear affordance about expected input

**Components to Review:**
- `src/components/primitives/Input.tsx` - Size variants
- Date fields in all forms
- Phone number, postal code, CVC fields (if present)

---

#### 1.6 Error Handling and Validation
**Principle:** Mark errors clearly in context with actionable messages.

**Validation Timing:**
- ✅ Validate on form submission attempt
- ✅ Clear error immediately when user corrects it
- ❌ Avoid validating before user completes field (unless specific cases)

**Error Display Requirements:**
- Mark field with error styling (red border, background, or indicator)
- Display descriptive error message near field
- Use `role="alert"` for error messages (screen reader announcement)
- Include error icon or visual indicator
- Maintain adequate color contrast (WCAG AA: 4.5:1 for text)

**Error Message Guidelines:**
- Be specific about what's wrong
- Provide clear path to fix the error
- Use plain language, avoid technical jargon
- Examples:
  - ❌ "Invalid input"
  - ✅ "Telefonnummer må være 8 siffer"
  - ❌ "Field required"
  - ✅ "Du må fylle ut navn"

**Error Summary:**
- For forms with multiple errors, provide error summary at top
- Link error summary items to corresponding fields
- Announce error count to screen readers

**Review Checklist:**
- [ ] Errors displayed inline with fields
- [ ] Error messages have `role="alert"` for announcements
- [ ] Error styling meets color contrast requirements
- [ ] Error messages are specific and actionable
- [ ] Errors clear immediately when corrected
- [ ] Focus moved to first error field on submission
- [ ] Error summary provided for multi-error forms

**Components to Review:**
- `src/components/primitives/FormField.tsx` - Error rendering
- All action modal forms for error handling patterns
- Zod validation schemas in each form

---

### 2. Mobile-Specific Considerations

#### 2.1 Responsive Field Width
**Principle:** On mobile, form elements should fill container width while respecting content-based sizing.

**Mobile Layout Requirements:**
- Full-width inputs for easy touch interaction
- Maintain max-width for very short inputs (e.g., CVC, postal code)
- Stack labels vertically above inputs (never side-by-side)
- Adequate spacing between form elements (min 8px, prefer 16px+)

**Breakpoints to Test:**
- Mobile portrait: 320px - 480px
- Mobile landscape: 481px - 768px
- Tablet portrait: 769px - 1024px
- Desktop: 1025px+

**Review Checklist:**
- [ ] All forms tested at 320px width (smallest common viewport)
- [ ] Input fields scale appropriately at each breakpoint
- [ ] No horizontal scrolling required
- [ ] Touch targets meet 44x44px minimum size
- [ ] Adequate spacing between interactive elements

**Components to Review:**
- All modal forms in `src/components/actions/`
- `src/components/primitives/Modal.tsx` - Responsive sizing
- `src/components/primitives/Input.tsx` - Responsive width classes

---

#### 2.2 Touch Target Size
**Principle:** All interactive elements must have minimum 44x44px touch targets (WCAG 2.5.5).

**Requirements:**
- Buttons: min 44px height
- Checkboxes/Radio buttons: min 44px clickable area
- Links in text: min 44px height with adequate line-height
- Form inputs: min 44px height
- Icon buttons: min 44px square

**Spacing Requirements:**
- Minimum 8px spacing between adjacent touch targets
- Prefer 16px+ spacing for better usability

**Review Checklist:**
- [ ] All buttons meet 44x44px minimum
- [ ] Form inputs have adequate height (44px+)
- [ ] Checkboxes and radio buttons have sufficient click area
- [ ] Icon-only buttons meet size requirements
- [ ] Adjacent interactive elements have adequate spacing
- [ ] Modal close buttons are easily tappable

**Components to Review:**
- `src/components/primitives/Button.tsx` - Height variants
- `src/components/primitives/Checkbox.tsx` - Touch target
- `src/components/primitives/RadioGroup.tsx` - Touch target
- `src/components/views/TimelineItem.tsx` - Toggle button

---

#### 2.3 Mobile Input Types
**Principle:** Use appropriate input types to trigger optimal mobile keyboards.

**HTML Input Type Mapping:**
- Email: `type="email"` → Email keyboard with @ key
- Phone: `type="tel"` → Numeric keypad
- Numbers: `type="number"` or `inputmode="numeric"` → Number keyboard
- URLs: `type="url"` → URL keyboard with .com shortcuts
- Dates: `type="date"` → Native date picker
- Search: `type="search"` → Search keyboard with "Go" button

**Autocomplete Attributes:**
- Use `autocomplete` attribute for common fields
- Examples: `autocomplete="name"`, `autocomplete="email"`, `autocomplete="tel"`
- Improves fill speed and reduces errors
- See [WCAG 1.3.5 Identify Input Purpose](https://www.w3.org/WAI/WCAG21/Understanding/identify-input-purpose.html)

**Review Checklist:**
- [ ] Email fields use `type="email"`
- [ ] Phone fields use `type="tel"`
- [ ] Numeric fields use appropriate input type
- [ ] Date fields use accessible date picker or `type="date"`
- [ ] Common fields have `autocomplete` attributes
- [ ] Input types tested on iOS and Android

**Components to Review:**
- `src/components/primitives/Input.tsx` - Type prop handling
- `src/components/primitives/DatePicker.tsx` - Mobile experience
- All forms for appropriate input type usage

---

### 3. Keyboard Navigation & Focus Management

#### 3.1 Keyboard Accessibility
**Principle:** All functionality must be operable through keyboard alone (WCAG 2.1.1).

**Requirements:**
- All interactive elements must be keyboard focusable
- Logical tab order (matches visual order)
- No keyboard traps (user can always escape)
- Focus visible at all times (WCAG 2.4.7)
- Standard keyboard patterns for widgets (Arrows, Space, Enter, Escape)

**Standard Keyboard Shortcuts:**
- `Tab` / `Shift+Tab` - Navigate between elements
- `Enter` / `Space` - Activate buttons, links
- `Escape` - Close modals, cancel actions
- `Arrow keys` - Navigate within components (select, radio group)
- `Home` / `End` - Navigate to first/last item

**Review Checklist:**
- [ ] All interactive elements in tab order
- [ ] Tab order is logical and matches visual layout
- [ ] No keyboard traps in modals or complex widgets
- [ ] Modal focus trapped within modal when open
- [ ] Focus returns to trigger element when modal closes
- [ ] Skip links provided for main content navigation
- [ ] Custom widgets follow ARIA Authoring Practices patterns

**Components to Review:**
- `src/components/primitives/Modal.tsx` - Focus trap and restoration
- `src/components/primitives/Select.tsx` - Keyboard navigation
- `src/components/primitives/DatePicker.tsx` - Calendar keyboard navigation
- `src/components/views/Timeline.tsx` - Keyboard navigation through items
- All forms for tab order

---

#### 3.2 Focus Indicators
**Principle:** Focus must be clearly visible with sufficient contrast (WCAG 2.4.7, 2.4.11).

**Requirements (WCAG 2.4.11 - Focus Appearance):**
- Minimum 2px focus indicator
- Contrast ratio of at least 3:1 against background
- Focus indicator fully visible (not obscured)
- Distinct from non-focused state

**Current Implementation:**
- Punkt design system uses 4px purple ring with offset
- Error states have red focus ring
- Sharp focus indicators (no border radius)

**Review Checklist:**
- [ ] All focusable elements have visible focus indicator
- [ ] Focus indicator contrast meets 3:1 minimum
- [ ] Focus indicator visible on all backgrounds
- [ ] Error state focus distinct from default focus
- [ ] Focus indicator not obscured by other elements
- [ ] Focus indicator size adequate (2px minimum)

**Components to Review:**
- All primitive components in `src/components/primitives/`
- Custom focus ring utilities in `index.css`

---

### 4. Screen Reader Accessibility

#### 4.1 Semantic HTML Structure
**Principle:** Use correct HTML elements for their intended purpose (WCAG 1.3.1).

**Semantic Elements:**
- `<main>` - Primary page content
- `<nav>` - Navigation sections
- `<header>` - Page or section header
- `<footer>` - Page or section footer
- `<article>` - Self-contained content
- `<section>` - Thematic grouping
- `<aside>` - Tangential content
- `<form>` - Form containers
- `<button>` - Interactive buttons (not `<div>` with click handlers)
- `<a>` - Navigational links
- Heading hierarchy: `<h1>` → `<h2>` → `<h3>` (no skips)

**Review Checklist:**
- [ ] Page has single `<main>` landmark
- [ ] Heading hierarchy is logical (no skipped levels)
- [ ] Lists use `<ul>`, `<ol>`, `<li>` elements
- [ ] Tables use proper structure (`<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`)
- [ ] Buttons use `<button>` element (not styled divs)
- [ ] Links use `<a>` element with `href`
- [ ] Forms use `<form>` element
- [ ] No DIV/SPAN abuse for interactive elements

**Components to Review:**
- `src/pages/CasePage.tsx` - Page structure and landmarks
- `src/components/views/Timeline.tsx` - Semantic list structure
- `src/components/views/StatusDashboard.tsx` - Section structure

---

#### 4.2 ARIA Implementation
**Principle:** Use ARIA to enhance semantics where HTML is insufficient (ARIA First Rule: Don't use ARIA if HTML suffices).

**When to Use ARIA:**
- To add semantics where HTML element lacks them
- To provide accessible names/descriptions
- To communicate dynamic changes (live regions)
- To indicate widget states (expanded, selected, invalid)

**Common ARIA Patterns:**
- `aria-label` - Accessible name for elements
- `aria-labelledby` - Reference to label element(s)
- `aria-describedby` - Reference to description element(s)
- `aria-invalid` - Mark invalid form fields
- `aria-required` - Mark required fields
- `aria-expanded` - Collapsible/expandable state
- `aria-live` - Announce dynamic changes
- `aria-atomic` - Announce entire region vs. changes only
- `role="alert"` - Announce important messages immediately

**Current ARIA Usage:**
- StatusDashboard: `aria-labelledby`, `aria-live="polite"`, `aria-atomic="true"`
- TimelineItem: `aria-expanded`, `aria-controls`
- FormField: `role="alert"` for errors
- Input/Textarea: `aria-invalid`, `aria-describedby`

**Review Checklist:**
- [ ] ARIA attributes have valid values
- [ ] Referenced IDs in aria-labelledby/describedby exist
- [ ] Live regions used appropriately (not overused)
- [ ] aria-expanded reflects actual state
- [ ] role="alert" used for critical messages only
- [ ] No redundant ARIA (e.g., role="button" on <button>)
- [ ] Custom widgets follow ARIA Authoring Practices

**Components to Review:**
- `src/components/primitives/FormField.tsx` - ARIA associations
- `src/components/views/StatusDashboard.tsx` - Live regions
- `src/components/views/TimelineItem.tsx` - Expanded state
- `src/components/primitives/InfoLabel.tsx` - Tooltip ARIA

---

#### 4.3 Alternative Text and Labels
**Principle:** All non-text content must have text alternatives (WCAG 1.1.1).

**Requirements:**
- Images: `alt` attribute with descriptive text
- Decorative images: `alt=""` or `aria-hidden="true"`
- Icon buttons: `aria-label` or visible text
- Complex images: Extended description with `aria-describedby`
- SVG icons: `<title>` element or `aria-label`

**Icon Button Patterns:**
- Include visually hidden text: `<span className="sr-only">Close</span>`
- Or use `aria-label="Close"`
- Avoid icon-only buttons without labels

**Review Checklist:**
- [ ] All meaningful images have descriptive alt text
- [ ] Decorative images properly hidden from screen readers
- [ ] Icon buttons have accessible names
- [ ] SVG icons have titles or aria-labels
- [ ] Complex images have extended descriptions if needed
- [ ] Form labels properly associated with inputs

**Components to Review:**
- `src/components/primitives/Button.tsx` - Icon button variants
- `src/components/primitives/Modal.tsx` - Close button
- All modal forms for icon usage

---

### 5. Visual Design & Contrast

#### 5.1 Color Contrast Requirements
**Principle:** Text and interactive elements must have sufficient contrast (WCAG 1.4.3, 1.4.6, 1.4.11).

**WCAG AA Requirements:**
- Normal text: 4.5:1 contrast ratio
- Large text (18pt+ or 14pt+ bold): 3:1 contrast ratio
- UI components (buttons, inputs, focus indicators): 3:1 contrast ratio
- Non-text contrast (icons, state indicators): 3:1 contrast ratio

**Current Implementation:**
- Punkt design system has semantic colors designed for accessibility
- Minimum 2px borders for visibility
- Error states: red (#ff8274)
- Focus states: purple ring with 4px width

**Review Checklist:**
- [ ] All text meets 4.5:1 contrast (or 3:1 for large text)
- [ ] Button text contrast meets requirements
- [ ] Form labels contrast meets requirements
- [ ] Error messages contrast meets requirements
- [ ] Disabled state contrast adequate for identification (not required to meet 4.5:1)
- [ ] Focus indicators meet 3:1 contrast
- [ ] Icons and UI elements meet 3:1 contrast

**Tools:**
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Browser DevTools contrast checker
- axe DevTools browser extension

**Components to Review:**
- All text in `index.css` - Color definitions
- `src/components/primitives/Button.tsx` - All variants
- `src/components/primitives/Input.tsx` - All states
- Error states across all forms

---

#### 5.2 Color as Sole Indicator
**Principle:** Never use color alone to convey information (WCAG 1.4.1).

**Requirements:**
- Errors marked with color AND icon AND text
- Required fields marked with color AND asterisk/text
- Status indicators use color AND icon/shape/text
- Links distinguished from text by underline, not color alone
- Charts/graphs use patterns in addition to color

**Review Checklist:**
- [ ] Error states have text messages, not just red color
- [ ] Required fields marked with asterisk or "(Required)" text
- [ ] Status cards have text labels, not just color coding
- [ ] Links have underline or other non-color distinction
- [ ] All color-coded elements have text/icon alternative

**Components to Review:**
- `src/components/primitives/FormField.tsx` - Error indicators
- `src/components/primitives/Label.tsx` - Required indicators
- `src/components/views/StatusCard.tsx` - Status indicators

---

#### 5.3 Text Sizing and Readability
**Principle:** Text must be readable and resizable up to 200% without loss of functionality (WCAG 1.4.4).

**Requirements:**
- Base font size: 16px minimum (current implementation ✅)
- Use relative units (rem, em) for font sizes
- Support browser zoom up to 200%
- Support text-only zoom up to 200%
- Line height: 1.5 minimum for body text
- Paragraph width: max 80 characters for readability

**Current Implementation:**
- Base font size: 16px (increased from 14px)
- Font sizes: 12px - 36px
- Font family: 'Oslo Sans'

**Review Checklist:**
- [ ] All font sizes use relative units (rem, em)
- [ ] Text readable at 200% zoom
- [ ] No content cut off or overlapping at 200% zoom
- [ ] Line height adequate (1.5+ for body text)
- [ ] Paragraph width not excessive (<80ch)
- [ ] Text reflow works correctly on mobile

**Files to Review:**
- `index.css` - Typography definitions
- All components for font size usage

---

### 6. Form Validation & User Feedback

#### 6.1 Validation Strategy
**Principle:** Provide clear, timely feedback on form input (WCAG 3.3.1, 3.3.3).

**Validation Timing:**
1. **On Submit:** Primary validation point
2. **On Blur:** Optional for individual fields after first submission attempt
3. **On Change:** Clear errors immediately when corrected

**Current Implementation:**
- React Hook Form + Zod validation
- Validation on submit
- Real-time error clearing

**Review Checklist:**
- [ ] Validation runs on form submission
- [ ] Errors cleared when user corrects input
- [ ] First error field receives focus after validation
- [ ] Error summary provided at top of form
- [ ] Success confirmation announced to screen readers
- [ ] Loading states indicated during submission

**Components to Review:**
- All forms in `src/components/actions/`
- Zod schemas for validation rules

---

#### 6.2 Error Prevention and Recovery
**Principle:** Help users avoid errors and make it easy to recover (WCAG 3.3.4, 3.3.6).

**Error Prevention Strategies:**
- Input constraints (min/max length, patterns)
- Input masks for formatted data (phone, date, postal code)
- Clear format instructions in help text
- Confirmation for destructive actions
- Ability to review before final submission

**Error Recovery:**
- Specific error messages with correction guidance
- Maintain user input even when errors occur (don't clear form)
- Allow easy correction without re-entering all data
- Provide examples of correct format

**Review Checklist:**
- [ ] Destructive actions require confirmation (AlertDialog)
- [ ] Form input preserved after validation errors
- [ ] Clear format instructions provided
- [ ] Input constraints prevent invalid data entry where possible
- [ ] Multi-step forms allow navigation back to correct errors

**Components to Review:**
- `src/components/primitives/AlertDialog.tsx` - Confirmations
- All modal forms for error prevention strategies

---

### 7. Mobile UX & Responsive Design

#### 7.1 Responsive Layout
**Principle:** Layout must adapt gracefully across all viewport sizes.

**Breakpoints:**
- Mobile: 320px - 768px
- Tablet: 769px - 1024px
- Desktop: 1025px+

**Mobile Layout Requirements:**
- Single column layout
- Full-width form elements (with max-width for context)
- Stacked navigation
- Collapsible sections for space efficiency
- Bottom-fixed action buttons for reachability

**Review Checklist:**
- [ ] Test all views at 320px, 375px, 768px, 1024px, 1440px
- [ ] No horizontal scrolling required
- [ ] All content accessible without zooming
- [ ] Modals responsive (current: 90vw max, 600px preferred)
- [ ] Tables scroll horizontally or reflow on mobile
- [ ] Navigation usable on small screens

**Components to Review:**
- `src/components/primitives/Modal.tsx` - Responsive sizing
- `src/components/views/StatusDashboard.tsx` - Grid layout
- `src/components/views/Timeline.tsx` - List layout
- `src/pages/CasePage.tsx` - Overall page layout

---

#### 7.2 Touch Interaction Patterns
**Principle:** Optimize for touch input on mobile devices.

**Requirements:**
- Minimum 44x44px touch targets (see section 2.2)
- Adequate spacing between targets (8px minimum)
- Avoid hover-only interactions
- Support both tap and long-press where appropriate
- Swipe gestures with keyboard alternatives

**Touch-Friendly Patterns:**
- Large, easy-to-tap buttons
- Expandable sections instead of tooltips
- Bottom sheets for mobile actions
- Pull-to-refresh where applicable
- Touch-friendly date/time pickers

**Review Checklist:**
- [ ] All interactive elements meet touch target size
- [ ] No functionality requires hover (mouse-only)
- [ ] Tooltips accessible via tap, not just hover
- [ ] Date pickers usable on touch devices
- [ ] Modals closable via backdrop tap or close button
- [ ] Adequate spacing for fat-finger syndrome

**Components to Review:**
- `src/components/primitives/Tooltip.tsx` - Touch activation
- `src/components/primitives/InfoLabel.tsx` - Click toggle
- `src/components/primitives/DatePicker.tsx` - Touch interaction
- All buttons and interactive elements

---

### 8. Performance & Loading States

#### 8.1 Loading Indicators
**Principle:** Provide clear feedback during asynchronous operations.

**Requirements:**
- Loading states for all async operations
- Skeleton screens or spinners
- Disable form during submission
- Loading announced to screen readers
- Timeout handling for failed loads

**Review Checklist:**
- [ ] Forms show loading state during submission
- [ ] Loading states announced with aria-live
- [ ] Buttons disabled during async operations
- [ ] Loading spinners have accessible labels
- [ ] Error states shown if operation fails
- [ ] Skeleton screens for content loading

**Components to Review:**
- `src/components/primitives/Button.tsx` - Loading state
- All forms for submission handling
- `src/pages/CasePage.tsx` - Page loading states

---

#### 8.2 Error States and Fallbacks
**Principle:** Gracefully handle errors and provide recovery options (WCAG 3.3.1).

**Error Handling:**
- Clear error messages in plain language
- Actionable recovery steps
- Option to retry failed operations
- Contact information for help if needed

**Review Checklist:**
- [ ] Network errors displayed clearly
- [ ] API errors shown with user-friendly messages
- [ ] Retry option provided for failed operations
- [ ] Form submission errors show field-level details
- [ ] Error boundaries catch React errors gracefully

---

### 9. Content & Readability

#### 9.1 Plain Language
**Principle:** Use clear, simple language that all users can understand.

**Guidelines:**
- Short sentences and paragraphs
- Active voice preferred
- Common words over jargon
- Explain technical terms when necessary
- Norwegian language: Follow Språkrådet guidelines

**Review Checklist:**
- [ ] All UI text uses plain language
- [ ] Error messages understandable by non-technical users
- [ ] Help text concise and actionable
- [ ] Headings descriptive and clear
- [ ] No unnecessary technical jargon

**Components to Review:**
- All form labels, help text, and error messages
- Page headings and instructions
- Button labels and actions

---

#### 9.2 Consistent Terminology
**Principle:** Use consistent terms throughout the application.

**Consistency Areas:**
- Action names (e.g., "Send" vs "Submit")
- Status labels
- Navigation items
- Field labels
- Error messages

**Review Checklist:**
- [ ] Create terminology glossary
- [ ] Same actions use same button labels
- [ ] Consistent field names across forms
- [ ] Consistent error message patterns
- [ ] Consistent navigation labels

---

## Review Methodology

### Phase 1: Automated Testing

**Tools:**
- ESLint with jsx-a11y plugin (already configured)
- axe-core automated tests (already configured)
- Browser DevTools Lighthouse audits
- axe DevTools browser extension
- WAVE browser extension

**Process:**
1. Run `npm run lint:a11y` - Check for ARIA and accessibility issues
2. Run `npm run test:a11y` - Execute jest-axe tests
3. Run Lighthouse audit on all pages (aim for 90+ accessibility score)
4. Use axe DevTools to scan each page/modal
5. Document all automated findings

**Deliverable:** Automated test results report

---

### Phase 2: Manual Testing - Desktop

**Keyboard Testing:**
1. Disconnect mouse, navigate entire app with keyboard only
2. Verify tab order is logical on all pages
3. Test all forms can be completed without mouse
4. Ensure modals trap focus and restore properly
5. Test all interactive components with keyboard
6. Verify focus indicators always visible

**Screen Reader Testing:**
- Test with NVDA (Windows) or VoiceOver (Mac)
- Navigate through all pages
- Complete form submission flows
- Test error announcement behavior
- Verify ARIA labels and descriptions
- Test dynamic content updates

**Visual Inspection:**
- Check color contrast with tools
- Verify no color-only indicators
- Test at 200% zoom
- Check focus indicators on all elements
- Review error states for clarity

**Deliverable:** Manual desktop testing report

---

### Phase 3: Manual Testing - Mobile/Tablet

**Devices to Test:**
- iPhone (iOS Safari) - 375px, 414px
- Android phone (Chrome) - 360px, 412px
- iPad (Safari) - 768px, 1024px
- Android tablet (Chrome) - 800px

**Test Scenarios:**
1. Navigate through entire app on each device
2. Complete forms on touch devices
3. Test touch target sizes (min 44x44px)
4. Test responsive layout at various sizes
5. Test with mobile screen readers (TalkBack, VoiceOver)
6. Verify input types trigger correct keyboards
7. Test landscape and portrait orientations
8. Test with device zoom at 200%

**Deliverable:** Mobile/tablet testing report

---

### Phase 4: Component-Specific Reviews

**Priority 1: Complex Forms**
1. SendVederlagModal.tsx (20+ fields, multi-section)
2. RespondVederlagModal.tsx (15+ fields, multi-section)

**Review Points:**
- Label placement and association
- Help text adequacy
- Field grouping and organization
- Error handling and messages
- Validation timing
- Keyboard navigation
- Mobile responsiveness
- Input type appropriateness

**Priority 2: Interactive Components**
3. DatePicker.tsx - Calendar keyboard nav, mobile experience
4. Select.tsx - Dropdown accessibility
5. Timeline.tsx & TimelineItem.tsx - Expandable content

**Priority 3: Layout Components**
6. Modal.tsx - Focus trap, restoration, responsive sizing
7. StatusDashboard.tsx - Live region updates
8. CasePage.tsx - Page structure, landmarks

**Deliverable:** Component review checklist with findings

---

### Phase 5: WCAG 2.1 AA Compliance Audit

**Success Criteria to Verify:**

**Perceivable:**
- 1.1.1 Non-text Content (A)
- 1.3.1 Info and Relationships (A)
- 1.3.4 Orientation (AA)
- 1.3.5 Identify Input Purpose (AA)
- 1.4.3 Contrast (Minimum) (AA)
- 1.4.4 Resize Text (AA)
- 1.4.5 Images of Text (AA)
- 1.4.10 Reflow (AA)
- 1.4.11 Non-text Contrast (AA)

**Operable:**
- 2.1.1 Keyboard (A)
- 2.1.2 No Keyboard Trap (A)
- 2.1.4 Character Key Shortcuts (A)
- 2.4.3 Focus Order (A)
- 2.4.5 Multiple Ways (AA)
- 2.4.6 Headings and Labels (AA)
- 2.4.7 Focus Visible (AA)
- 2.5.3 Label in Name (A)
- 2.5.5 Target Size (AA)

**Understandable:**
- 3.1.1 Language of Page (A)
- 3.2.3 Consistent Navigation (AA)
- 3.2.4 Consistent Identification (AA)
- 3.3.1 Error Identification (A)
- 3.3.2 Labels or Instructions (A)
- 3.3.3 Error Suggestion (AA)
- 3.3.4 Error Prevention (Legal, Financial, Data) (AA)

**Robust:**
- 4.1.2 Name, Role, Value (A)
- 4.1.3 Status Messages (AA)

**Deliverable:** WCAG 2.1 AA compliance report with pass/fail for each criterion

---

## Deliverables Summary

1. **Automated Test Results Report**
   - ESLint accessibility violations
   - jest-axe test results
   - Lighthouse audit scores
   - axe DevTools findings

2. **Manual Testing Reports**
   - Desktop keyboard navigation report
   - Desktop screen reader report
   - Mobile/tablet testing report
   - Visual/contrast review report

3. **Component Review Checklists**
   - Each component with detailed findings
   - Priority ranking for fixes
   - Screenshots of issues

4. **WCAG 2.1 AA Compliance Audit**
   - Criterion-by-criterion assessment
   - Pass/fail status
   - Remediation recommendations

5. **Prioritized Remediation Plan**
   - High/Medium/Low severity issues
   - Estimated effort for each fix
   - Implementation sequence
   - Testing plan for fixes

6. **Updated Documentation**
   - Accessibility guidelines for developers
   - Component usage examples
   - Testing procedures
   - Maintenance plan

---

## Quick Win Checklist

Items that can typically be addressed quickly:

- [x] Add missing `autocomplete` attributes to forms (N/A - forms don't use common personal data fields)
- [x] Fix any missing `alt` text on images (N/A - no images in codebase)
- [x] Ensure all buttons have accessible names (✓ All buttons have text or aria-label)
- [x] Fix any color contrast issues (✓ Fixed error color from #ff8274 to #c9302c for 5.33:1 contrast)
- [x] Add `lang` attribute to HTML element (✓ Already present: lang="no")
- [x] Ensure focus indicators visible on all elements (✓ All components have focus:ring-4)
- [x] Add missing form labels (✓ FormField component properly implements labels)
- [x] Fix any heading hierarchy skips (✓ No skips found: h1→h2→h3)
- [x] Add ARIA live regions for dynamic content (✓ StatusDashboard has aria-live="polite")
- [x] Ensure all touch targets meet 44x44px minimum (✓ Updated Button, Input, Select, Checkbox)

---

## Success Metrics

**Quantitative:**
- Lighthouse accessibility score: 95+ target
- Zero critical WCAG AA violations
- 100% of forms completable via keyboard
- 100% of forms completable via screen reader
- 100% touch targets meet 44x44px minimum
- All text contrast ratio: 4.5:1 minimum (7:1 AAA goal)

**Qualitative:**
- Positive feedback from accessibility testing
- Improved user satisfaction scores
- Reduced form abandonment rate
- Reduced support requests related to usability

---

## Maintenance Plan

**Ongoing Practices:**
1. Run automated accessibility tests in CI/CD pipeline
2. Include accessibility in code review checklist
3. Manual accessibility testing for new features
4. Quarterly accessibility audits
5. Monitor WCAG updates and browser changes
6. User testing with people with disabilities
7. Accessibility training for development team

---

## Resources

**WCAG Guidelines:**
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WCAG 2.2 Updates](https://www.w3.org/WAI/WCAG22/quickref/)

**Norwegian Accessibility:**
- [UUtilsynet (Norwegian Accessibility Authority)](https://www.uutilsynet.no/)
- [WCAG på norsk](https://www.uutilsynet.no/wcag-standarden/wcag-20-pa-norsk/87)

**Testing Tools:**
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

**ARIA Patterns:**
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Radix UI Documentation](https://www.radix-ui.com/primitives/docs/overview/accessibility)

**Forms Best Practices:**
- [W3C Form Tutorial](https://www.w3.org/WAI/tutorials/forms/)
- [GOV.UK Design System Forms](https://design-system.service.gov.uk/components/)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-04 | AI Assistant | Initial comprehensive review plan |

---

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1: Automated testing
3. Schedule manual testing sessions
4. Assign component reviews to team members
5. Set timeline for remediation work
