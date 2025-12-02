# Accessibility Testing Checklist

> **Purpose:** Manual accessibility testing guide for WCAG 2.1 AA compliance
>
> **Target:** Public sector requirement compliance
>
> **Last Updated:** 2025-12-02

---

## Overview

This checklist provides a comprehensive manual testing guide to complement automated accessibility tests. All items must pass to ensure WCAG 2.1 AA compliance for public sector deployment.

---

## 1. Keyboard Navigation Testing

### 1.1 Focus Management

- [ ] **Tab Key Navigation**
  - All interactive elements can be reached with Tab key
  - Tab order follows logical page structure (left-to-right, top-to-bottom)
  - No keyboard traps (can always Tab forward and backward)
  - Custom components (modals, dropdowns) trap focus appropriately

- [ ] **Focus Indicators**
  - All focusable elements have visible focus indicators
  - Focus indicators meet minimum contrast ratio (3:1 against background)
  - Focus indicators are not removed or hidden with CSS
  - Custom components maintain focus indicators

- [ ] **Skip Links**
  - Skip navigation links are present
  - Skip links become visible on focus
  - Skip links function correctly (jump to main content)

### 1.2 Modal/Dialog Focus Trap

- [ ] **Opening Modal**
  - Focus moves to first focusable element in modal on open
  - Opening element's reference is stored for return focus

- [ ] **Modal Focus Cycle**
  - Tab cycles through only modal elements
  - Shift+Tab moves backward through modal elements
  - Cannot Tab to elements behind modal overlay

- [ ] **Closing Modal**
  - Escape key closes modal
  - Focus returns to trigger element after close
  - Close button is keyboard accessible

### 1.3 Form Interactions

- [ ] **Input Fields**
  - All form fields are keyboard accessible
  - Enter key submits forms appropriately
  - Spacebar works on checkboxes and radio buttons

- [ ] **Dropdown Menus**
  - Arrow keys navigate dropdown items
  - Enter/Space selects items
  - Escape closes dropdown
  - First/last item handling works correctly

---

## 2. Screen Reader Testing

### 2.1 Screen Reader Tools

**Recommended Tools:**
- NVDA (Windows) - Free, most popular
- JAWS (Windows) - Industry standard, paid
- VoiceOver (macOS/iOS) - Built-in
- TalkBack (Android) - Built-in

### 2.2 Page Structure

- [ ] **Landmarks**
  - Page has proper landmark regions (`<header>`, `<main>`, `<nav>`, `<footer>`)
  - All content is within a landmark
  - Landmarks are announced correctly
  - Landmark labels are unique where multiple of same type exist

- [ ] **Headings**
  - Heading hierarchy is logical (h1 → h2 → h3, no skipping)
  - Page has exactly one h1
  - Headings accurately describe content sections
  - Screen reader can navigate by headings

- [ ] **Lists**
  - Semantic list markup used (`<ul>`, `<ol>`, `<dl>`)
  - Timeline uses proper list structure
  - Screen reader announces list and item count

### 2.3 Interactive Elements

- [ ] **Buttons**
  - All buttons are announced as "button"
  - Button text/label is meaningful
  - Icon buttons have accessible labels (aria-label or sr-only text)
  - Button state changes are announced

- [ ] **Links**
  - Links are announced as "link"
  - Link text is descriptive (avoid "click here", "read more")
  - External links announced as external (if applicable)

- [ ] **Forms**
  - All form fields have associated labels
  - Labels are announced before field type
  - Required fields are announced as required
  - Field instructions are associated with inputs (aria-describedby)

### 2.4 Dynamic Content

- [ ] **Live Regions**
  - Status changes announced via aria-live
  - Loading states announced
  - Error messages announced
  - Success messages announced

- [ ] **Status Cards**
  - Status changes announced politely (aria-live="polite")
  - Status icons have text alternatives
  - Last updated time is announced

- [ ] **Timeline Updates**
  - New timeline items announced to screen readers
  - Event details are accessible
  - Expand/collapse buttons announce state

### 2.5 Modal/Dialog Announcements

- [ ] **Dialog Opening**
  - Dialog role is announced
  - Dialog title is announced
  - Dialog description is announced (if present)

- [ ] **Form Errors**
  - Error messages announced immediately
  - Error messages associated with fields (aria-describedby)
  - General form errors announced at top

---

## 3. Visual Testing

### 3.1 Color Contrast

**Testing Tools:**
- Chrome DevTools (Lighthouse)
- WebAIM Contrast Checker
- Colour Contrast Analyser (desktop app)

**Requirements (WCAG 2.1 AA):**
- Normal text: minimum 4.5:1 contrast ratio
- Large text (18pt+/14pt+ bold): minimum 3:1 contrast ratio
- UI components: minimum 3:1 contrast ratio
- Focus indicators: minimum 3:1 contrast ratio

**Test Cases:**

- [ ] **Text Contrast**
  - Body text meets 4.5:1 minimum
  - Heading text meets 4.5:1 minimum
  - Link text meets 4.5:1 minimum
  - Placeholder text meets 4.5:1 minimum

- [ ] **UI Component Contrast**
  - Button borders meet 3:1 minimum
  - Input borders meet 3:1 minimum
  - Status badge backgrounds meet 3:1 minimum
  - Icon colors meet 3:1 minimum

- [ ] **Focus Indicators**
  - All focus outlines meet 3:1 minimum
  - Focus indicators on dark backgrounds meet 3:1
  - Focus indicators on light backgrounds meet 3:1

### 3.2 Color Usage

- [ ] **Information Not Conveyed by Color Alone**
  - Status indicators use icons + color
  - Required fields marked with asterisk + red color
  - Form validation uses text + color
  - Charts/graphs have patterns or labels

- [ ] **Color Blindness Testing**
  - Test with color blindness simulator (e.g., Stark plugin)
  - Status colors distinguishable for protanopia
  - Status colors distinguishable for deuteranopia
  - Status colors distinguishable for tritanopia

### 3.3 Text and Spacing

- [ ] **Text Zoom (200%)**
  - Text readable at 200% zoom (browser zoom)
  - No text overflow or cut-off
  - No horizontal scrolling at 200% zoom
  - Interactive elements remain functional

- [ ] **Text Spacing**
  - Line height at least 1.5x font size
  - Paragraph spacing at least 2x font size
  - Letter spacing adjustable (can be increased)
  - Word spacing adjustable (can be increased)

### 3.4 Responsive Design

- [ ] **Mobile (320px - 767px)**
  - All content accessible without horizontal scrolling
  - Touch targets minimum 44x44px
  - Text remains readable
  - Forms usable on mobile

- [ ] **Tablet (768px - 1023px)**
  - Dashboard cards stack properly
  - Modals fit viewport
  - Navigation accessible

- [ ] **Desktop (1024px+)**
  - Content doesn't stretch too wide
  - Optimal line length for reading
  - All features accessible

---

## 4. Form Accessibility

### 4.1 Form Labels

- [ ] **Label Association**
  - Every input has associated `<label>` with `for` attribute
  - Labels are visible (not placeholder-only)
  - Labels are descriptive and unique

- [ ] **Placeholder Text**
  - Placeholders provide examples, not instructions
  - Placeholders do not replace labels
  - Placeholder contrast meets 4.5:1 minimum

### 4.2 Form Validation

- [ ] **Client-Side Validation**
  - Validation messages are clear and specific
  - Error messages appear near relevant field
  - Error messages announced to screen readers
  - Fields with errors have aria-invalid="true"
  - Error summary at top of form (optional but recommended)

- [ ] **Required Fields**
  - Required fields marked with asterisk + "(required)"
  - Required fields have aria-required="true"
  - Legend explains asterisk meaning
  - Screen reader announces required on focus

- [ ] **Error Recovery**
  - Error messages provide solution guidance
  - Invalid input preserved for correction
  - Focus moves to first error field on submit

### 4.3 Form Controls

- [ ] **Input Fields**
  - All inputs have labels
  - Input type matches purpose (email, tel, number, etc.)
  - Autocomplete attributes used where appropriate

- [ ] **Select Dropdowns**
  - First option not used as label
  - Default "Select..." option provided if no default
  - Options are descriptive

- [ ] **Checkboxes and Radio Buttons**
  - Grouped with `<fieldset>` and `<legend>`
  - Each option has unique label
  - Keyboard navigable (Tab to group, Arrow keys within group)

- [ ] **Date Pickers**
  - Accessible via keyboard
  - Date format clearly indicated
  - Manual text entry supported
  - Calendar widget is keyboard navigable

---

## 5. Motion and Animation

### 5.1 Reduced Motion

- [ ] **Prefers Reduced Motion**
  - CSS respects `prefers-reduced-motion` media query
  - Animations disabled when motion reduced
  - Essential motion retained (e.g., loading spinners)
  - Transitions reduced to minimal durations

**Test:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Enable in OS:
- Windows: Settings → Ease of Access → Display → Show animations
- macOS: System Preferences → Accessibility → Display → Reduce motion
- Linux: Varies by desktop environment

### 5.2 Animation Guidelines

- [ ] **No Flashing Content**
  - No content flashes more than 3 times per second
  - No large flashing areas
  - No red flashing content

- [ ] **Parallax and Scrolling**
  - Parallax effects disabled with reduced motion
  - Smooth scrolling disabled with reduced motion
  - Auto-advancing carousels can be paused

---

## 6. Content Accessibility

### 6.1 Alternative Text

- [ ] **Images**
  - All images have alt text
  - Decorative images have empty alt (`alt=""`)
  - Alt text is descriptive but concise
  - Complex images have long descriptions

- [ ] **Icons**
  - Icon-only buttons have aria-label
  - Icons with adjacent text have aria-hidden="true"
  - Status icons have text alternatives

### 6.2 Language

- [ ] **Page Language**
  - `<html lang="nb">` attribute set correctly
  - Mixed language content marked with lang attribute

- [ ] **Readable Text**
  - Reading level appropriate for audience
  - Abbreviations explained on first use
  - Technical terms explained
  - Instructions are clear and specific

### 6.3 Links and Navigation

- [ ] **Link Purpose**
  - Link text describes destination
  - Link text makes sense out of context
  - Adjacent links to same destination combined

- [ ] **Navigation Consistency**
  - Navigation appears in same place on all pages
  - Navigation order is consistent
  - Common actions are consistently labeled

---

## 7. Data Tables

### 7.1 Table Structure

- [ ] **Semantic Markup**
  - Uses `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`
  - Headers use `<th>` with scope attribute
  - Caption provided with `<caption>`
  - Complex tables use headers attribute

- [ ] **Table Headers**
  - Column headers have `scope="col"`
  - Row headers have `scope="row"`
  - Headers are descriptive
  - Multi-level headers properly associated

### 7.2 Responsive Tables

- [ ] **Mobile Display**
  - Tables usable on small screens
  - Horizontal scrolling indicated
  - Alternative views provided for complex tables

---

## 8. Browser and Device Testing

### 8.1 Browser Compatibility

Test in latest versions:

- [ ] **Desktop Browsers**
  - Chrome
  - Firefox
  - Safari
  - Edge

- [ ] **Mobile Browsers**
  - Chrome (Android)
  - Safari (iOS)
  - Samsung Internet (Android)

### 8.2 Assistive Technology Compatibility

- [ ] **Screen Readers**
  - NVDA + Chrome (Windows)
  - JAWS + Chrome (Windows)
  - VoiceOver + Safari (macOS)
  - VoiceOver + Safari (iOS)
  - TalkBack + Chrome (Android)

- [ ] **Voice Control**
  - Voice Control (iOS/macOS)
  - Voice Access (Android)
  - Dragon NaturallySpeaking (Windows)

---

## 9. Specific Component Testing

### 9.1 Status Dashboard

- [ ] Focus order logical (left to right, top to bottom)
- [ ] Status changes announced via aria-live
- [ ] Status icons have text alternatives
- [ ] Cards keyboard navigable
- [ ] Status colors distinguishable for color blindness

### 9.2 Timeline

- [ ] Uses semantic list markup
- [ ] Keyboard navigable
- [ ] Expand/collapse buttons announce state
- [ ] Time elements have proper datetime attribute
- [ ] Event details accessible to screen readers
- [ ] Sufficient color contrast for timeline connector

### 9.3 Action Modals

- [ ] Modal title announced on open
- [ ] Focus trapped within modal
- [ ] Escape closes modal
- [ ] Focus returns to trigger on close
- [ ] Form validation accessible
- [ ] Submit button clearly labeled
- [ ] Loading state announced

---

## 10. Testing Tools Reference

### 10.1 Automated Testing Tools

**Browser Extensions:**
- axe DevTools (Chrome/Firefox) - Free basic scan
- WAVE (Chrome/Firefox) - Visual accessibility testing
- Lighthouse (Chrome DevTools) - Built-in audit

**Command Line:**
- pa11y - Automated testing in CI/CD
- axe-core - JavaScript API for testing

### 10.2 Manual Testing Tools

**Color Contrast:**
- WebAIM Contrast Checker - https://webaim.org/resources/contrastchecker/
- Colour Contrast Analyser - Desktop app

**Screen Readers:**
- NVDA - https://www.nvaccess.org/ (Free, Windows)
- JAWS - https://www.freedomscientific.com/ (Paid, Windows)
- VoiceOver - Built into macOS/iOS

**Keyboard Testing:**
- No special tools needed - just use keyboard!

**Color Blindness Simulation:**
- Stark (Figma/Chrome plugin)
- Color Oracle (Desktop app)

### 10.3 Validation Tools

**HTML Validation:**
- W3C Markup Validation Service - https://validator.w3.org/

**ARIA Validation:**
- Check aria-* attributes match ARIA specification
- Verify role attributes are valid

---

## 11. Testing Process

### 11.1 Pre-Deployment Checklist

Before deploying to production:

1. [ ] Run automated tests (`npm run test:a11y`)
2. [ ] Run ESLint accessibility rules (`npm run lint:a11y`)
3. [ ] Run Lighthouse accessibility audit (score > 95)
4. [ ] Test with keyboard only (no mouse)
5. [ ] Test with screen reader (NVDA or VoiceOver)
6. [ ] Test on mobile device
7. [ ] Verify color contrast with tools
8. [ ] Test with reduced motion enabled
9. [ ] Validate HTML
10. [ ] Review this checklist

### 11.2 Ongoing Monitoring

- [ ] Include accessibility in code review process
- [ ] Test new features with keyboard and screen reader
- [ ] Monitor user feedback for accessibility issues
- [ ] Review accessibility quarterly
- [ ] Keep dependencies updated (Radix, axe-core)

---

## 12. Common Issues and Solutions

### Issue: Modal doesn't trap focus

**Symptoms:**
- Tab key escapes modal to page behind
- Cannot navigate back to modal with keyboard

**Solution:**
- Ensure Radix Dialog wraps entire modal content
- Verify `<Dialog.Content>` contains close button
- Check that Portal is rendering correctly

### Issue: Status changes not announced

**Symptoms:**
- Screen reader doesn't announce status updates
- Live region not working

**Solution:**
- Add `aria-live="polite"` to status container
- Ensure status text changes (not just color)
- Use `role="status"` for status messages
- Check that aria-atomic is set appropriately

### Issue: Low color contrast

**Symptoms:**
- Lighthouse reports contrast failures
- Text hard to read

**Solution:**
- Use Punkt design tokens (guaranteed compliant)
- Test with contrast checker tools
- Avoid light gray text on white backgrounds
- Ensure focus indicators are visible

### Issue: Form validation not accessible

**Symptoms:**
- Errors not announced to screen reader
- Cannot identify which field has error

**Solution:**
- Add `aria-invalid="true"` to invalid fields
- Use `aria-describedby` to link error messages
- Announce errors with `role="alert"`
- Place error message near field

---

## 13. Resources

### WCAG Guidelines
- WCAG 2.1 Quick Reference: https://www.w3.org/WAI/WCAG21/quickref/
- Understanding WCAG 2.1: https://www.w3.org/WAI/WCAG21/Understanding/

### Testing Guides
- WebAIM Testing Guide: https://webaim.org/articles/
- Deque Accessibility Testing: https://www.deque.com/blog/

### ARIA Documentation
- ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- ARIA in HTML: https://www.w3.org/TR/html-aria/

### Norwegian Resources
- UU-tilsynet (Accessibility Authority): https://www.uutilsynet.no/
- Accessibility regulations (Norwegian): https://www.uutilsynet.no/regelverk/

---

## Appendix: Keyboard Shortcuts Reference

### General Navigation
- `Tab` - Move to next focusable element
- `Shift + Tab` - Move to previous focusable element
- `Enter` - Activate button/link
- `Space` - Activate button, toggle checkbox
- `Escape` - Close modal/dropdown

### Screen Reader Navigation (NVDA)
- `H` - Next heading
- `Shift + H` - Previous heading
- `1-6` - Jump to heading level
- `K` - Next link
- `F` - Next form field
- `B` - Next button
- `L` - Next list
- `I` - Next list item

### Screen Reader Navigation (VoiceOver)
- `VO + Right Arrow` - Next element
- `VO + Left Arrow` - Previous element
- `VO + Command + H` - Next heading
- `VO + Command + L` - Next link
- `VO + Command + J` - Next form control

---

**Testing Sign-off:**

- [ ] All automated tests passing
- [ ] Manual keyboard testing completed
- [ ] Screen reader testing completed
- [ ] Color contrast verified
- [ ] Mobile testing completed
- [ ] Cross-browser testing completed

**Tester:** _____________________ **Date:** __________

**Reviewer:** _____________________ **Date:** __________
