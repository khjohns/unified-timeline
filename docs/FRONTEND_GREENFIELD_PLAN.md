# Frontend Greenfield Implementation Plan

> **Status:** READY FOR IMPLEMENTATION
> **Version:** 1.0.0
> **Created:** 2025-12-02
> **Architecture:** Headless UI + Punkt Design Tokens
> **Compliance:** WCAG 2.1 AA (Public Sector Requirement)

---

## Executive Summary

This document specifies the complete frontend rebuild strategy for "Skjema Endringsmeldinger" based on the Unified Timeline (Event Sourcing) architecture.

### The Paradigm Shift

**FROM: Form-Based UI**
```
┌──────────────────────────────────────┐
│ Tab 1: Grunnlag (Long Form)         │
│ Tab 2: Vederlag (Long Form)         │
│ Tab 3: Frist (Long Form)             │
│                                      │
│ [Save Draft] [Submit All]            │
└──────────────────────────────────────┘
Problem: Must submit all tracks together
```

**TO: Timeline + Dashboard UI (Situational Awareness)**
```
┌──────────────────────────────────────┐
│ STATUS DASHBOARD (State Awareness)   │
│ ┌──────┐ ┌──────┐ ┌──────┐          │
│ │ GRUNN│ │VEDER-│ │FRIST │          │
│ │ LAG  │ │ LAG  │ │      │          │
│ │  ✓   │ │  ⚠   │ │  ✓   │          │
│ └──────┘ └──────┘ └──────┘          │
├──────────────────────────────────────┤
│ TIMELINE (Immutable History)         │
│ 🕐 2025-01-15: BH Godkjent Vederlag  │
│ 🕐 2025-01-10: TE Sendt nytt tilbud  │
│ 🕐 2025-01-05: BH Avvist første krav │
├──────────────────────────────────────┤
│ ACTIONS (Contextual)                 │
│ [Send New Vederlag Offer]            │
└──────────────────────────────────────┘
```

### Core Principles

1. **Headless + Tokens Strategy**
   - Logic: Radix UI (WCAG-compliant primitives)
   - Styling: Tailwind CSS + Punkt Design Tokens
   - Result: Oslo brand compliance + Accessibility guarantee

2. **Read vs. Write Separation**
   - View Components: Display state (Dashboard, Timeline)
   - Action Components: Emit events (Modals with forms)

3. **Strict WCAG 2.1 AA**
   - Focus management (Radix handles this)
   - ARIA live regions for status changes
   - Semantic HTML (timeline = `<ul>`, cards = proper headings)

---

## 1. Package Installation Strategy

### 1.1 Current State Analysis

**Already Installed (Keep):**
```json
{
  "@oslokommune/punkt-assets": "^13.11.0",     // Oslo Sans fonts, SVG icons
  "@oslokommune/punkt-css": "^13.13.2",        // Design tokens (CSS vars)
  "@oslokommune/punkt-react": "^13.15.2",      // Keep for reference only
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.9.5",
  "tailwindcss": "^4.1.17"                     // Already v4!
}
```

**To Remove:**
```json
{
  "@react-pdf/renderer": "^4.3.1",    // Backend generates PDFs
  "jspdf": "^3.0.3",                  // Not needed in frontend
  "jspdf-autotable": "^5.0.2",        // Not needed
  "react-pdf": "^10.2.0",             // Only for viewing, keep if needed
  "pdfjs-dist": "^5.4.296"            // Only if viewing PDFs in UI
}
```

**To Add:**
```json
{
  // Headless UI Primitives (WCAG-compliant)
  "@radix-ui/react-dialog": "^1.1.2",
  "@radix-ui/react-dropdown-menu": "^2.1.2",
  "@radix-ui/react-tooltip": "^1.1.4",
  "@radix-ui/react-accordion": "^1.2.1",
  "@radix-ui/react-alert-dialog": "^1.1.2",

  // State Management
  "@tanstack/react-query": "^5.62.0",

  // Form Management (Scoped to Action Modals)
  "react-hook-form": "^7.54.0",
  "@hookform/resolvers": "^3.9.1",
  "zod": "^3.24.1",

  // Date Handling (for timeline)
  "date-fns": "^4.1.0",

  // Icon System (if not using Punkt SVGs)
  "@radix-ui/react-icons": "^1.3.2"
}
```

### 1.2 Installation Commands

```bash
# Step 1: Remove unused PDF libraries (if not viewing PDFs in UI)
npm uninstall @react-pdf/renderer jspdf jspdf-autotable

# Step 2: Install Radix UI primitives
npm install @radix-ui/react-dialog@^1.1.2 \
            @radix-ui/react-dropdown-menu@^2.1.2 \
            @radix-ui/react-tooltip@^1.1.4 \
            @radix-ui/react-accordion@^1.2.1 \
            @radix-ui/react-alert-dialog@^1.1.2 \
            @radix-ui/react-icons@^1.3.2

# Step 3: Install state management
npm install @tanstack/react-query@^5.62.0

# Step 4: Install form management
npm install react-hook-form@^7.54.0 \
            @hookform/resolvers@^3.9.1 \
            zod@^3.24.1

# Step 5: Install utilities
npm install date-fns@^4.1.0

# Step 6: Verify Tailwind CSS v4 config
# (Already installed - see configuration section below)
```

---

## 2. Tailwind Configuration Guide

### 2.1 Understanding Punkt Design Tokens

Punkt CSS provides CSS custom properties (variables) that must be mapped into Tailwind's theme system.

**Key Token Categories:**
```css
/* From @oslokommune/punkt-css */

/* Colors */
--pkt-color-brand-dark-blue-1000: #004B75;
--pkt-color-brand-beige-400: #F0E9E0;
--pkt-color-brand-green-700: #2B7D58;
--pkt-color-brand-green-300: #C2E0D2;

/* Semantic Colors */
--pkt-color-success-500: #2B7D58;
--pkt-color-warning-500: #F7B538;
--pkt-color-error-500: #D92141;
--pkt-color-info-500: #0076C0;

/* Typography */
--pkt-font-family-sans: 'Oslo Sans', system-ui, sans-serif;
--pkt-font-size-body-medium: 1rem;
--pkt-font-size-heading-large: 2rem;

/* Spacing (Grid-based: 4px base) */
--pkt-spacing-01: 0.25rem;  /* 4px */
--pkt-spacing-02: 0.5rem;   /* 8px */
--pkt-spacing-03: 0.75rem;  /* 12px */
--pkt-spacing-04: 1rem;     /* 16px */
--pkt-spacing-05: 1.25rem;  /* 20px */
--pkt-spacing-06: 1.5rem;   /* 24px */
--pkt-spacing-08: 2rem;     /* 32px */
--pkt-spacing-10: 2.5rem;   /* 40px */
```

### 2.2 Tailwind v4 Configuration

Create `tailwind.config.js`:

```javascript
import { defineConfig } from 'tailwindcss';

export default defineConfig({
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Map Punkt colors to Tailwind utilities
      colors: {
        // Oslo Brand Colors
        'oslo-blue': {
          DEFAULT: 'var(--pkt-color-brand-dark-blue-1000)',
          50: 'var(--pkt-color-brand-dark-blue-50)',
          100: 'var(--pkt-color-brand-dark-blue-100)',
          700: 'var(--pkt-color-brand-dark-blue-700)',
          1000: 'var(--pkt-color-brand-dark-blue-1000)',
        },
        'oslo-beige': {
          DEFAULT: 'var(--pkt-color-brand-beige-400)',
          100: 'var(--pkt-color-brand-beige-100)',
          200: 'var(--pkt-color-brand-beige-200)',
          300: 'var(--pkt-color-brand-beige-300)',
          400: 'var(--pkt-color-brand-beige-400)',
        },
        'oslo-green': {
          DEFAULT: 'var(--pkt-color-brand-green-700)',
          300: 'var(--pkt-color-brand-green-300)',
          500: 'var(--pkt-color-brand-green-500)',
          700: 'var(--pkt-color-brand-green-700)',
        },

        // Semantic Colors
        success: {
          DEFAULT: 'var(--pkt-color-success-500)',
          100: 'var(--pkt-color-success-100)',
          500: 'var(--pkt-color-success-500)',
          700: 'var(--pkt-color-success-700)',
        },
        warning: {
          DEFAULT: 'var(--pkt-color-warning-500)',
          100: 'var(--pkt-color-warning-100)',
          500: 'var(--pkt-color-warning-500)',
        },
        error: {
          DEFAULT: 'var(--pkt-color-error-500)',
          100: 'var(--pkt-color-error-100)',
          500: 'var(--pkt-color-error-500)',
        },
        info: {
          DEFAULT: 'var(--pkt-color-info-500)',
          100: 'var(--pkt-color-info-100)',
          500: 'var(--pkt-color-info-500)',
        },
      },

      // Typography
      fontFamily: {
        sans: ['var(--pkt-font-family-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'body-sm': 'var(--pkt-font-size-body-small)',
        'body-md': 'var(--pkt-font-size-body-medium)',
        'body-lg': 'var(--pkt-font-size-body-large)',
        'heading-sm': 'var(--pkt-font-size-heading-small)',
        'heading-md': 'var(--pkt-font-size-heading-medium)',
        'heading-lg': 'var(--pkt-font-size-heading-large)',
      },

      // Spacing (extends default scale)
      spacing: {
        'pkt-01': 'var(--pkt-spacing-01)',
        'pkt-02': 'var(--pkt-spacing-02)',
        'pkt-03': 'var(--pkt-spacing-03)',
        'pkt-04': 'var(--pkt-spacing-04)',
        'pkt-05': 'var(--pkt-spacing-05)',
        'pkt-06': 'var(--pkt-spacing-06)',
        'pkt-08': 'var(--pkt-spacing-08)',
        'pkt-10': 'var(--pkt-spacing-10)',
      },

      // Border Radius
      borderRadius: {
        'pkt-sm': 'var(--pkt-border-radius-small)',
        'pkt-md': 'var(--pkt-border-radius-medium)',
        'pkt-lg': 'var(--pkt-border-radius-large)',
      },
    },
  },
  plugins: [],
});
```

### 2.3 Import Punkt CSS in App

In `src/index.css`:

```css
/* Import Punkt CSS variables */
@import '@oslokommune/punkt-css';

/* Import Tailwind directives */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Oslo Sans Font (from punkt-assets) */
@font-face {
  font-family: 'Oslo Sans';
  src: url('@oslokommune/punkt-assets/fonts/OsloSans-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Oslo Sans';
  src: url('@oslokommune/punkt-assets/fonts/OsloSans-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Oslo Sans';
  src: url('@oslokommune/punkt-assets/fonts/OsloSans-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* Accessibility: Respect user motion preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Base styles */
body {
  font-family: var(--pkt-font-family-sans);
  color: var(--pkt-color-text-primary);
  background-color: var(--pkt-color-background);
}
```

### 2.4 Font Assets Handling (CRITICAL)

> ⚠️ **Common Pitfall:** CSS cannot automatically resolve font files from `node_modules/@oslokommune/punkt-assets/fonts/` in production builds.

**Problem:** The `@font-face` declarations in section 2.3 reference fonts directly from `node_modules`, which works in Vite dev mode but will fail in production builds unless properly configured.

**Solution: Use Vite Static Asset Plugin**

The project already has `vite-plugin-static-copy` installed. Configure it to copy fonts to the build output:

**vite.config.ts**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@oslokommune/punkt-assets/fonts/*.woff2',
          dest: 'fonts'
        },
        {
          src: 'node_modules/@oslokommune/punkt-assets/fonts/*.woff',
          dest: 'fonts'
        }
      ]
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

**Updated `src/index.css`** (change font paths):
```css
/* Import Punkt CSS variables - MUST BE FIRST! */
@import '@oslokommune/punkt-css';

/* Import Tailwind directives */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Oslo Sans Font - Use /fonts/ path for production builds */
@font-face {
  font-family: 'Oslo Sans';
  src: url('/fonts/OsloSans-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Oslo Sans';
  src: url('/fonts/OsloSans-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Oslo Sans';
  src: url('/fonts/OsloSans-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* Rest of styles... */
```

**Verification Steps:**
```bash
# 1. Build for production
npm run build

# 2. Verify fonts were copied
ls dist/fonts/
# Should show: OsloSans-Regular.woff2, OsloSans-Medium.woff2, OsloSans-Bold.woff2

# 3. Test production build
npm run preview
# Open browser DevTools -> Network -> Filter by "font" -> Verify 200 OK status
```

### 2.5 Z-Index Strategy (Radix Portals + Punkt CSS)

> ⚠️ **Common Pitfall:** Radix Dialog/Tooltip portals may appear behind fixed headers or other positioned elements.

**Problem:** Radix UI components that use Portals (Dialog, Tooltip, Dropdown) render at the end of `<body>`, outside your component tree. If your app has fixed headers or other high z-index elements, modals may appear behind them.

**Solution: Establish a Z-Index Scale**

Add explicit z-index values to your Tailwind config that coordinate with Punkt CSS and Radix:

**Updated `tailwind.config.js`:**
```javascript
export default defineConfig({
  theme: {
    extend: {
      // ... existing color/spacing config ...

      // Z-Index scale (coordinated with Punkt CSS)
      zIndex: {
        'dropdown': '1000',        // Dropdowns
        'sticky': '1020',          // Sticky headers
        'fixed': '1030',           // Fixed headers/footers
        'modal-backdrop': '1040',  // Modal overlays
        'modal': '1050',           // Modal content
        'popover': '1060',         // Popovers/tooltips
        'tooltip': '1070',         // Tooltips (highest)
      },
    },
  },
});
```

**Updated `Modal.tsx`** (add explicit z-index):
```tsx
<Dialog.Overlay
  className={clsx(
    'fixed inset-0 bg-black/50 backdrop-blur-sm',
    'z-modal-backdrop', // 👈 Explicit z-index
    // ... animation classes
  )}
/>

<Dialog.Content
  className={clsx(
    'fixed left-[50%] top-[50%]',
    'z-modal', // 👈 Explicit z-index
    // ... other classes
  )}
>
```

**For Fixed Headers:**
```tsx
<header className="sticky top-0 z-fixed bg-white border-b">
  {/* Your header content */}
</header>
```

**Verification:**
1. Open a modal
2. Inspect with DevTools → Check computed `z-index` values
3. Ensure: Modal (1050) > Modal Backdrop (1040) > Fixed Header (1030)

### 2.6 Preventing FOUC (Flash of Unstyled Content)

> ⚠️ **Common Pitfall:** If Tailwind utilities reference Punkt CSS variables before they're loaded, you'll see a brief flash of unstyled content.

**Problem:** CSS import order matters. If `@tailwind base` loads before `@import '@oslokommune/punkt-css'`, Tailwind won't have access to the CSS variables.

**Solution: Strict Import Order**

**✅ CORRECT `src/index.css`:**
```css
/* 1. Load Punkt CSS variables FIRST - before anything else! */
@import '@oslokommune/punkt-css';

/* 2. Then load Tailwind (which may reference Punkt variables) */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 3. Then custom styles (which reference both) */
@font-face { /* ... */ }
```

**❌ WRONG (will cause FOUC):**
```css
/* DON'T DO THIS - Tailwind loads before Punkt variables are defined */
@tailwind base;
@import '@oslokommune/punkt-css'; /* TOO LATE! */
```

**Verification in Browser:**
1. Open DevTools → Elements → `<html>` tag
2. Inspect Computed styles
3. Verify `--pkt-color-brand-dark-blue-1000` is defined
4. If it shows "invalid" or empty, check import order

**Additional FOUC Prevention:**

In `index.html`, add a minimal inline style to prevent layout shift:
```html
<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Skjema Endringsmeldinger</title>

  <!-- Prevent FOUC: Set font immediately -->
  <style>
    html {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Testing FOUC:**
```bash
# Throttle network in DevTools to "Slow 3G"
# Reload page multiple times
# Should NOT see:
#  - Colors changing after page load
#  - Fonts changing after page load
#  - Layout shifting after styles load
```

---

## 3. Component Architecture

### 3.1 Architecture Principles

**Separation of Concerns:**
```
┌─────────────────────────────────────────────────────┐
│ VIEW COMPONENTS (Read-Only)                        │
│ - Render state from backend                        │
│ - No forms, no mutations                           │
│ - Example: StatusCard, TimelineItem                │
└─────────────────────────────────────────────────────┘
                      ↑
                      │ SakState (from TanStack Query)
                      │
┌─────────────────────────────────────────────────────┐
│ ACTION COMPONENTS (Write)                           │
│ - Modals with forms (React Hook Form)              │
│ - Submit events to backend                         │
│ - Example: SendVederlagModal, RespondGrunnlagModal │
└─────────────────────────────────────────────────────┘
```

### 3.2 Component Taxonomy

#### A. Primitives (Radix + Punkt Styling)

Low-level UI building blocks that wrap Radix with Oslo design tokens.

**Button.tsx**
```tsx
import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { clsx } from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          // Base styles
          'inline-flex items-center justify-center rounded-pkt-md',
          'font-medium transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',

          // Variant styles
          {
            'bg-oslo-blue text-white hover:bg-oslo-blue-700 focus-visible:outline-oslo-blue':
              variant === 'primary',
            'bg-oslo-beige text-oslo-blue hover:bg-oslo-beige-300 focus-visible:outline-oslo-blue':
              variant === 'secondary',
            'bg-transparent hover:bg-oslo-beige-100 focus-visible:outline-oslo-blue':
              variant === 'ghost',
            'bg-error text-white hover:bg-error-700 focus-visible:outline-error':
              variant === 'danger',
          },

          // Size styles
          {
            'px-pkt-03 py-pkt-02 text-sm': size === 'sm',
            'px-pkt-04 py-pkt-03 text-base': size === 'md',
            'px-pkt-06 py-pkt-04 text-lg': size === 'lg',
          },

          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

**Modal.tsx** (Wraps Radix Dialog)
```tsx
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';
import { ComponentPropsWithoutRef, ReactNode } from 'react';
import { clsx } from 'clsx';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
          className={clsx(
            'fixed inset-0 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        {/* Content */}
        <Dialog.Content
          className={clsx(
            'fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]',
            'bg-white rounded-pkt-lg shadow-xl',
            'p-pkt-06',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            {
              'w-[90vw] max-w-md': size === 'sm',
              'w-[90vw] max-w-lg': size === 'md',
              'w-[90vw] max-w-2xl': size === 'lg',
              'w-[90vw] max-w-4xl': size === 'xl',
            },
            className
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-pkt-04">
            <div>
              <Dialog.Title className="text-heading-lg font-bold text-oslo-blue">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-pkt-02 text-body-md text-gray-600">
                  {description}
                </Dialog.Description>
              )}
            </div>

            {/* Close button */}
            <Dialog.Close
              className={clsx(
                'rounded-pkt-sm p-pkt-02',
                'text-gray-500 hover:text-gray-700',
                'hover:bg-oslo-beige-100',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-oslo-blue'
              )}
              aria-label="Lukk dialog"
            >
              <Cross2Icon className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**Card.tsx**
```tsx
import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { clsx } from 'clsx';

interface CardProps extends ComponentPropsWithoutRef<'div'> {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'sm' | 'md' | 'lg';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-pkt-md',
          {
            'bg-white': variant === 'default',
            'bg-white shadow-lg': variant === 'elevated',
            'bg-white border-2 border-oslo-beige-300': variant === 'outlined',
          },
          {
            'p-pkt-04': padding === 'sm',
            'p-pkt-06': padding === 'md',
            'p-pkt-08': padding === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
```

#### B. View Components (Read-Only State Display)

**StatusCard.tsx**
```tsx
import { Card } from '@/components/primitives/Card';
import { SporStatus, SporType } from '@/types/timeline';
import { clsx } from 'clsx';

interface StatusCardProps {
  spor: SporType;
  status: SporStatus;
  title: string;
  lastUpdated?: string;
}

const STATUS_CONFIG: Record<SporStatus, { label: string; color: string; icon: string }> = {
  ikke_relevant: { label: 'Ikke relevant', color: 'bg-gray-100 text-gray-700', icon: '○' },
  utkast: { label: 'Utkast', color: 'bg-gray-100 text-gray-700', icon: '○' },
  sendt: { label: 'Sendt', color: 'bg-info-100 text-info-700', icon: '→' },
  under_behandling: { label: 'Under behandling', color: 'bg-warning-100 text-warning-700', icon: '⏳' },
  godkjent: { label: 'Godkjent', color: 'bg-success-100 text-success-700', icon: '✓' },
  delvis_godkjent: { label: 'Delvis godkjent', color: 'bg-warning-100 text-warning-700', icon: '◐' },
  avvist: { label: 'Avvist', color: 'bg-error-100 text-error-700', icon: '✗' },
  under_forhandling: { label: 'Under forhandling', color: 'bg-warning-100 text-warning-700', icon: '⇄' },
  trukket: { label: 'Trukket', color: 'bg-gray-100 text-gray-700', icon: '⌫' },
  laast: { label: 'Låst', color: 'bg-success-100 text-success-700', icon: '🔒' },
};

export function StatusCard({ spor, status, title, lastUpdated }: StatusCardProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Card variant="outlined" padding="md">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-heading-sm font-bold text-oslo-blue uppercase">
            {title}
          </h3>
          <div
            className={clsx(
              'mt-pkt-02 inline-flex items-center gap-pkt-02',
              'px-pkt-03 py-pkt-02 rounded-pkt-sm',
              'text-sm font-medium',
              config.color
            )}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">{config.icon}</span>
            <span>{config.label}</span>
          </div>

          {lastUpdated && (
            <p className="mt-pkt-02 text-sm text-gray-600">
              Sist oppdatert: {new Date(lastUpdated).toLocaleDateString('nb-NO')}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
```

**TimelineItem.tsx**
```tsx
import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface TimelineItemProps {
  timestamp: string;
  actor: string;
  eventType: string;
  description: ReactNode;
  details?: ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function TimelineItem({
  timestamp,
  actor,
  eventType,
  description,
  details,
  isExpanded = false,
  onToggle,
}: TimelineItemProps) {
  return (
    <li className="relative pb-pkt-06">
      {/* Timeline connector line */}
      <div className="absolute left-4 top-6 bottom-0 w-0.5 bg-oslo-beige-300" aria-hidden="true" />

      <div className="flex gap-pkt-04">
        {/* Timeline dot */}
        <div
          className="relative flex-shrink-0 w-8 h-8 rounded-full bg-oslo-blue flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="w-3 h-3 rounded-full bg-white" />
        </div>

        {/* Content */}
        <div className="flex-1 pt-1">
          <div className="flex items-baseline justify-between">
            <time
              className="text-sm font-medium text-oslo-blue"
              dateTime={timestamp}
            >
              {format(new Date(timestamp), 'PPpp', { locale: nb })}
            </time>
            <span className="text-sm text-gray-600">{actor}</span>
          </div>

          <h4 className="mt-pkt-02 text-body-md font-semibold text-gray-900">
            {eventType}
          </h4>

          <div className="mt-pkt-02 text-body-md text-gray-700">
            {description}
          </div>

          {details && onToggle && (
            <button
              onClick={onToggle}
              className={clsx(
                'mt-pkt-03 text-sm font-medium text-oslo-blue',
                'hover:underline focus-visible:underline',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oslo-blue'
              )}
              aria-expanded={isExpanded}
            >
              {isExpanded ? 'Skjul detaljer' : 'Vis detaljer'}
            </button>
          )}

          {isExpanded && details && (
            <div className="mt-pkt-04 p-pkt-04 bg-oslo-beige-100 rounded-pkt-md">
              {details}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
```

**Timeline.tsx**
```tsx
import { TimelineItem } from './TimelineItem';
import { useState } from 'react';

interface Event {
  id: string;
  timestamp: string;
  actor: string;
  eventType: string;
  description: string;
  details?: Record<string, any>;
}

interface TimelineProps {
  events: Event[];
}

export function Timeline({ events }: TimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <div className="p-pkt-08 text-center text-gray-500">
        <p>Ingen hendelser ennå.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-0" role="feed" aria-label="Tidslinje over hendelser">
      {events.map((event) => (
        <TimelineItem
          key={event.id}
          timestamp={event.timestamp}
          actor={event.actor}
          eventType={event.eventType}
          description={event.description}
          details={
            event.details && (
              <dl className="grid grid-cols-2 gap-pkt-03">
                {Object.entries(event.details).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-sm font-medium text-gray-500">{key}</dt>
                    <dd className="mt-1 text-sm text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>
            )
          }
          isExpanded={expandedId === event.id}
          onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
        />
      ))}
    </ul>
  );
}
```

#### C. Action Components (Event Submission via Modals)

**SendVederlagModal.tsx**
```tsx
import { Modal } from '@/components/primitives/Modal';
import { Button } from '@/components/primitives/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitEvent } from '@/api/events';
import { VederlagEventData } from '@/types/timeline';

const vederlagSchema = z.object({
  krav_belop: z.number().min(1, 'Beløp må være større enn 0'),
  metode: z.string().min(1, 'Metode er påkrevd'),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  inkluderer_produktivitetstap: z.boolean().optional(),
  inkluderer_rigg_drift: z.boolean().optional(),
});

type VederlagFormData = z.infer<typeof vederlagSchema>;

interface SendVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
}

export function SendVederlagModal({ open, onOpenChange, sakId }: SendVederlagModalProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<VederlagFormData>({
    resolver: zodResolver(vederlagSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: VederlagEventData) =>
      submitEvent(sakId, 'vederlag_krav_sendt', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sak', sakId] });
      reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: VederlagFormData) => {
    mutation.mutate(data);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send vederlagskrav"
      description="Fyll ut detaljer for det nye vederlagskravet."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-05">
        {/* Amount Field */}
        <div>
          <label htmlFor="krav_belop" className="block text-sm font-medium text-gray-700">
            Krevd beløp (NOK) <span className="text-error">*</span>
          </label>
          <input
            id="krav_belop"
            type="number"
            {...register('krav_belop', { valueAsNumber: true })}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            aria-required="true"
            aria-invalid={!!errors.krav_belop}
            aria-describedby={errors.krav_belop ? 'krav_belop-error' : undefined}
          />
          {errors.krav_belop && (
            <p id="krav_belop-error" className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.krav_belop.message}
            </p>
          )}
        </div>

        {/* Method Field */}
        <div>
          <label htmlFor="metode" className="block text-sm font-medium text-gray-700">
            Beregningsmetode <span className="text-error">*</span>
          </label>
          <select
            id="metode"
            {...register('metode')}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            aria-required="true"
            aria-invalid={!!errors.metode}
          >
            <option value="">Velg metode</option>
            <option value="direkte_kostnader">Direkte kostnader</option>
            <option value="timepriser">Timepriser</option>
            <option value="enhetspriser">Enhetspriser</option>
          </select>
          {errors.metode && (
            <p className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.metode.message}
            </p>
          )}
        </div>

        {/* Justification Field */}
        <div>
          <label htmlFor="begrunnelse" className="block text-sm font-medium text-gray-700">
            Begrunnelse <span className="text-error">*</span>
          </label>
          <textarea
            id="begrunnelse"
            {...register('begrunnelse')}
            rows={4}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            aria-required="true"
            aria-invalid={!!errors.begrunnelse}
          />
          {errors.begrunnelse && (
            <p className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.begrunnelse.message}
            </p>
          )}
        </div>

        {/* Checkboxes */}
        <div className="space-y-pkt-03">
          <div className="flex items-center">
            <input
              id="inkluderer_produktivitetstap"
              type="checkbox"
              {...register('inkluderer_produktivitetstap')}
              className="h-4 w-4 rounded border-gray-300 text-oslo-blue focus:ring-oslo-blue"
            />
            <label htmlFor="inkluderer_produktivitetstap" className="ml-pkt-02 text-sm text-gray-700">
              Inkluderer produktivitetstap
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="inkluderer_rigg_drift"
              type="checkbox"
              {...register('inkluderer_rigg_drift')}
              className="h-4 w-4 rounded border-gray-300 text-oslo-blue focus:ring-oslo-blue"
            />
            <label htmlFor="inkluderer_rigg_drift" className="ml-pkt-02 text-sm text-gray-700">
              Inkluderer rigg/drift
            </label>
          </div>
        </div>

        {/* Error Message */}
        {mutation.isError && (
          <div className="p-pkt-04 bg-error-100 border border-error-500 rounded-pkt-md" role="alert">
            <p className="text-sm text-error-700">
              {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-pkt-03 pt-pkt-04 border-t border-gray-200">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sender...' : 'Send krav'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

---

## 4. Directory Structure

```
src/
├── api/                          # Backend communication
│   ├── client.ts                 # Fetch wrapper with auth
│   ├── events.ts                 # POST /events
│   └── state.ts                  # GET /api/saker/{id}/state
│
├── components/
│   ├── primitives/               # Low-level UI (Radix + Punkt)
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Card.tsx
│   │   ├── Tooltip.tsx
│   │   ├── AlertDialog.tsx
│   │   └── index.ts
│   │
│   ├── views/                    # Read-only components
│   │   ├── StatusCard.tsx
│   │   ├── StatusDashboard.tsx
│   │   ├── TimelineItem.tsx
│   │   ├── Timeline.tsx
│   │   └── index.ts
│   │
│   ├── actions/                  # Write components (modals)
│   │   ├── SendGrunnlagModal.tsx
│   │   ├── SendVederlagModal.tsx
│   │   ├── SendFristModal.tsx
│   │   ├── RespondGrunnlagModal.tsx
│   │   ├── RespondVederlagModal.tsx
│   │   ├── RespondFristModal.tsx
│   │   └── index.ts
│   │
│   └── layout/                   # Layout components
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── MainLayout.tsx
│
├── hooks/                        # Custom hooks
│   ├── useCaseState.ts           # TanStack Query: GET state
│   ├── useSubmitEvent.ts         # TanStack Mutation: POST event
│   └── useActionPermissions.ts   # Compute available actions
│
├── pages/                        # Route pages
│   ├── CasePage.tsx              # Main case view
│   └── NotFoundPage.tsx
│
├── types/                        # TypeScript definitions
│   ├── timeline.ts               # SakState, Event types (from migration plan)
│   └── api.ts                    # API response types
│
├── utils/                        # Utilities
│   ├── formatters.ts             # Date, currency, etc.
│   └── validators.ts             # Zod schemas
│
├── App.tsx                       # Root component
├── index.css                     # Punkt CSS + Tailwind imports
└── main.tsx                      # Entry point
```

---

## 5. Step-by-Step Implementation Guide

### Phase 1: Foundation Setup

#### Step 1.1: Install Dependencies
```bash
# Remove unused packages
npm uninstall @react-pdf/renderer jspdf jspdf-autotable

# Install new packages
npm install @radix-ui/react-dialog@^1.1.2 \
            @radix-ui/react-dropdown-menu@^2.1.2 \
            @radix-ui/react-tooltip@^1.1.4 \
            @radix-ui/react-accordion@^1.2.1 \
            @radix-ui/react-alert-dialog@^1.1.2 \
            @radix-ui/react-icons@^1.3.2 \
            @tanstack/react-query@^5.62.0 \
            react-hook-form@^7.54.0 \
            @hookform/resolvers@^3.9.1 \
            zod@^3.24.1 \
            date-fns@^4.1.0 \
            clsx@^2.1.1
```

#### Step 1.2: Configure Tailwind CSS & Critical Setup
1. Create `tailwind.config.js` with z-index scale (see section 2.2 + 2.5)
2. Configure `vite.config.ts` for font asset copying (see section 2.4) ⚠️ CRITICAL
3. Update `src/index.css` with correct import order (see section 2.6) ⚠️ CRITICAL
4. Update `index.html` with FOUC prevention (see section 2.6)
5. Verify setup:
   ```bash
   # Start dev server
   npm run dev

   # In browser DevTools:
   # 1. Elements tab → <html> → Computed styles
   # 2. Verify --pkt-color-brand-dark-blue-1000 exists
   # 3. Network tab → Filter "font" → Should see Oslo Sans loading

   # Test production build
   npm run build
   ls dist/fonts/  # Verify fonts were copied
   npm run preview
   ```

#### Step 1.3: Create Type Definitions
1. Copy types from `UNIFIED_TIMELINE_MIGRATION_PLAN_V4_1_1.md` Phase 2.2
2. Create `src/types/timeline.ts`
3. Add API client types in `src/types/api.ts`

**Expected Output:**
- Tailwind configured with Oslo brand colors
- Oslo Sans font loading correctly
- TypeScript types matching backend models

---

### Phase 2: Primitive Components

#### Step 2.1: Create Base Primitives

**Files to create:**
1. `src/components/primitives/Button.tsx` (see section 3.2A)
2. `src/components/primitives/Card.tsx` (see section 3.2A)
3. `src/components/primitives/Modal.tsx` (see section 3.2A)
4. `src/components/primitives/Tooltip.tsx`
5. `src/components/primitives/AlertDialog.tsx`
6. `src/components/primitives/index.ts` (barrel export)

**Testing:**
Create `src/pages/ComponentShowcase.tsx` to verify:
- Button variants and sizes
- Modal focus trap (Tab key should cycle within modal)
- Card variants
- WCAG contrast ratios (use browser DevTools)

**Accessibility Checklist:**
- [ ] Modal traps focus (Escape closes, focus returns to trigger)
- [ ] Buttons have visible focus indicators
- [ ] Color contrast meets 4.5:1 minimum (WCAG AA)
- [ ] All interactive elements keyboard accessible

---

### Phase 3: State Management Layer

#### Step 3.1: Create API Client

**src/api/client.ts**
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }

  return response.json();
}
```

**src/api/state.ts**
```typescript
import { apiFetch } from './client';
import { StateResponse } from '@/types/timeline';

export async function fetchCaseState(sakId: string): Promise<StateResponse> {
  return apiFetch<StateResponse>(`/api/saker/${sakId}/state`);
}
```

**src/api/events.ts**
```typescript
import { apiFetch } from './client';
import { EventSubmitResponse, EventType } from '@/types/timeline';

export async function submitEvent(
  sakId: string,
  eventType: EventType,
  data: Record<string, any>
): Promise<EventSubmitResponse> {
  return apiFetch<EventSubmitResponse>(`/api/saker/${sakId}/events`, {
    method: 'POST',
    body: JSON.stringify({ event_type: eventType, data }),
  });
}
```

#### Step 3.2: Create React Query Hooks

**src/hooks/useCaseState.ts**
```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchCaseState } from '@/api/state';
import { SakState } from '@/types/timeline';

export function useCaseState(sakId: string) {
  return useQuery({
    queryKey: ['sak', sakId],
    queryFn: () => fetchCaseState(sakId),
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}
```

**src/hooks/useSubmitEvent.ts**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitEvent } from '@/api/events';
import { EventType } from '@/types/timeline';

export function useSubmitEvent(sakId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventType, data }: { eventType: EventType; data: any }) =>
      submitEvent(sakId, eventType, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sak', sakId] });
    },
  });
}
```

#### Step 3.3: Setup Query Provider

**src/main.tsx**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

### Phase 4: View Components (Dashboard + Timeline)

#### Step 4.1: Create Status Dashboard

**src/components/views/StatusDashboard.tsx**
```typescript
import { StatusCard } from './StatusCard';
import { SakState } from '@/types/timeline';

interface StatusDashboardProps {
  state: SakState;
}

export function StatusDashboard({ state }: StatusDashboardProps) {
  return (
    <section aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading" className="sr-only">
        Status Dashboard
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-pkt-04">
        <StatusCard
          spor="grunnlag"
          status={state.grunnlag.status}
          title="Grunnlag"
          lastUpdated={state.grunnlag.siste_oppdatert}
        />
        <StatusCard
          spor="vederlag"
          status={state.vederlag.status}
          title="Vederlag"
          lastUpdated={state.vederlag.siste_oppdatert}
        />
        <StatusCard
          spor="frist"
          status={state.frist.status}
          title="Frist"
          lastUpdated={state.frist.siste_oppdatert}
        />
      </div>

      {/* Live region for screen readers */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Overordnet status: {state.overordnet_status}
      </div>
    </section>
  );
}
```

#### Step 4.2: Create Timeline View

Use `Timeline.tsx` and `TimelineItem.tsx` from section 3.2B.

#### Step 4.3: Create Main Case Page

**src/pages/CasePage.tsx**
```typescript
import { useParams } from 'react-router-dom';
import { useCaseState } from '@/hooks/useCaseState';
import { StatusDashboard } from '@/components/views/StatusDashboard';
import { Timeline } from '@/components/views/Timeline';
import { Button } from '@/components/primitives/Button';
import { useState } from 'react';

export function CasePage() {
  const { sakId } = useParams<{ sakId: string }>();
  const { data, isLoading, error } = useCaseState(sakId!);

  if (isLoading) {
    return <div className="p-pkt-08">Laster...</div>;
  }

  if (error) {
    return (
      <div className="p-pkt-08 text-error" role="alert">
        <h2>Feil ved lasting av sak</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-oslo-beige-100">
      <header className="bg-white shadow-sm border-b-2 border-oslo-blue">
        <div className="max-w-7xl mx-auto px-pkt-06 py-pkt-05">
          <h1 className="text-heading-lg font-bold text-oslo-blue">
            {data.state.sakstittel}
          </h1>
          <p className="mt-pkt-02 text-body-md text-gray-600">
            Sak #{sakId}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-pkt-06 py-pkt-08">
        {/* Dashboard */}
        <StatusDashboard state={data.state} />

        {/* Actions */}
        <section className="mt-pkt-08" aria-labelledby="actions-heading">
          <h2 id="actions-heading" className="text-heading-md font-bold text-oslo-blue mb-pkt-04">
            Handlinger
          </h2>
          <div className="flex gap-pkt-03">
            <Button variant="primary">Send nytt vederlagskrav</Button>
            <Button variant="secondary">Trekk krav</Button>
          </div>
        </section>

        {/* Timeline */}
        <section className="mt-pkt-08" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="text-heading-md font-bold text-oslo-blue mb-pkt-04">
            Hendelser
          </h2>
          <div className="bg-white rounded-pkt-lg shadow p-pkt-06">
            <Timeline events={[]} />
          </div>
        </section>
      </main>
    </div>
  );
}
```

---

### Phase 5: Action Components (Event Submission)

#### Step 5.1: Create Action Modals

Create modals for all event types:
1. `SendGrunnlagModal.tsx`
2. `SendVederlagModal.tsx` (see section 3.2C for full example)
3. `SendFristModal.tsx`
4. `RespondGrunnlagModal.tsx`
5. `RespondVederlagModal.tsx`
6. `RespondFristModal.tsx`

Each modal should:
- Use React Hook Form + Zod validation
- Use `useSubmitEvent` hook
- Handle loading/error states
- Return focus to trigger button on close
- Display validation errors inline (ARIA)

#### Step 5.2: Integrate Actions with Dashboard

**src/hooks/useActionPermissions.ts**
```typescript
import { SakState, SporType } from '@/types/timeline';

interface AvailableActions {
  canSendGrunnlag: boolean;
  canSendVederlag: boolean;
  canSendFrist: boolean;
  canRespond: boolean;
  canIssueEO: boolean;
}

export function useActionPermissions(
  state: SakState,
  userRole: 'TE' | 'BH'
): AvailableActions {
  return {
    canSendGrunnlag: userRole === 'TE' && state.grunnlag.status === 'utkast',
    canSendVederlag: userRole === 'TE' && state.vederlag.status === 'utkast',
    canSendFrist: userRole === 'TE' && state.frist.status === 'utkast',
    canRespond: userRole === 'BH' && state.overordnet_status === 'VENTER_PAA_SVAR',
    canIssueEO: state.kan_utstede_eo,
  };
}
```

Update `CasePage.tsx` to conditionally render action buttons:
```typescript
const [showVederlagModal, setShowVederlagModal] = useState(false);
const actions = useActionPermissions(data.state, 'TE'); // Get from auth context

{actions.canSendVederlag && (
  <>
    <Button variant="primary" onClick={() => setShowVederlagModal(true)}>
      Send vederlagskrav
    </Button>
    <SendVederlagModal
      open={showVederlagModal}
      onOpenChange={setShowVederlagModal}
      sakId={sakId!}
    />
  </>
)}
```

---

### Phase 6: Accessibility Audit & Testing

#### Step 6.1: Automated Testing
```bash
# Install tools
npm install -D @axe-core/react eslint-plugin-jsx-a11y

# Add to test suite
# src/tests/a11y.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CasePage } from '@/pages/CasePage';

expect.extend(toHaveNoViolations);

test('CasePage has no WCAG violations', async () => {
  const { container } = render(<CasePage />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

#### Step 6.2: Manual Testing Checklist

**Keyboard Navigation:**
- [ ] Tab through all interactive elements
- [ ] Focus visible on all elements
- [ ] Modal trap focus (Tab cycles within modal)
- [ ] Escape closes modal, returns focus to trigger

**Screen Reader Testing (NVDA/JAWS):**
- [ ] Status changes announced via aria-live
- [ ] Timeline semantic structure (`<ul><li>`)
- [ ] Form errors announced
- [ ] Modal title announced on open

**Visual Testing:**
- [ ] Color contrast 4.5:1 minimum (use Chrome DevTools)
- [ ] 200% text zoom (no overflow/overlap)
- [ ] Works without CSS (semantic HTML)

**Responsive Testing:**
- [ ] Mobile: Dashboard stacks vertically
- [ ] Mobile: Modals fill viewport
- [ ] Touch targets minimum 44x44px

---

## 6. Migration from Legacy (@oslokommune/punkt-react)

### 6.1 Component Mapping

| Old Component (punkt-react) | New Implementation | Notes |
|----------------------------|-------------------|-------|
| `<PktButton>` | `<Button>` from primitives | Custom Radix wrapper |
| `<PktModal>` | `<Modal>` from primitives | Radix Dialog |
| `<PktCard>` | `<Card>` from primitives | Custom implementation |
| `<PktTextField>` | Native `<input>` | Use Tailwind + Punkt tokens |
| `<PktSelect>` | Native `<select>` | Use Tailwind + Punkt tokens |

**Strategy:**
1. Keep `@oslokommune/punkt-react` installed (for reference)
2. Gradually replace components as you build new views
3. DO NOT use punkt-react in new code

### 6.2 Styling Migration

**Old (Punkt React):**
```tsx
<PktButton variant="primary" size="medium">
  Send
</PktButton>
```

**New (Headless + Tokens):**
```tsx
<Button variant="primary" size="md">
  Send
</Button>
```

---

## 7. Performance Considerations

### 7.1 Bundle Size Optimization

**Code Splitting:**
```tsx
// Lazy load action modals (only load when opened)
import { lazy, Suspense } from 'react';

const SendVederlagModal = lazy(() => import('./actions/SendVederlagModal'));

<Suspense fallback={<div>Laster...</div>}>
  <SendVederlagModal ... />
</Suspense>
```

**Tree Shaking Radix:**
```typescript
// Import only needed components
import * as Dialog from '@radix-ui/react-dialog'; // Good
// vs
import { Dialog } from '@radix-ui/react-all'; // Bad (imports everything)
```

### 7.2 React Query Optimizations

```typescript
// Prefetch state on link hover
const queryClient = useQueryClient();

<Link
  to={`/saker/${sakId}`}
  onMouseEnter={() => queryClient.prefetchQuery(['sak', sakId])}
>
  Gå til sak
</Link>
```

---

## 8. Developer Experience

### 8.1 Component Documentation

Use Storybook or similar for component showcase:
```bash
npm install -D @storybook/react-vite
npx storybook@latest init
```

Create stories for all primitives to document:
- Variants
- ARIA patterns
- Keyboard interactions

### 8.2 TypeScript Strict Mode

Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

### 8.3 Linting for A11y

Update `.eslintrc.json`:
```json
{
  "extends": [
    "plugin:jsx-a11y/recommended"
  ],
  "plugins": ["jsx-a11y"]
}
```

---

## 9. Deployment Checklist

### Critical Configuration (Must Verify BEFORE First Deploy)
- [ ] ⚠️ Font assets copying configured in `vite.config.ts` (Section 2.4)
- [ ] ⚠️ CSS import order correct: Punkt CSS → Tailwind (Section 2.6)
- [ ] ⚠️ Z-index scale defined in `tailwind.config.js` (Section 2.5)
- [ ] ⚠️ Production build test: `npm run build && ls dist/fonts/`
- [ ] ⚠️ Fonts load in production preview: `npm run preview` → DevTools Network tab

### Functionality Testing
- [ ] All Radix components tested in production build
- [ ] Punkt fonts loading correctly (check Network tab, no 404s)
- [ ] Modals appear above all other content (z-index correct)
- [ ] No FOUC on page load (throttle to Slow 3G and test)
- [ ] Focus management verified in all modals (Tab key cycles correctly)

### Accessibility (WCAG 2.1 AA)
- [ ] WCAG audit passed (Lighthouse accessibility score > 95)
- [ ] Screen reader tested (NVDA or JAWS)
- [ ] Keyboard navigation complete (no mouse required)
- [ ] Color contrast verified (all text meets 4.5:1 ratio)
- [ ] Error states have proper ARIA announcements
- [ ] Loading states announced to screen readers
- [ ] Status changes announced via aria-live

### Responsive & Visual
- [ ] Mobile responsive tested (320px → 1920px)
- [ ] Touch targets minimum 44x44px
- [ ] 200% text zoom tested (no overflow/overlap)
- [ ] Works in: Chrome, Firefox, Safari, Edge (latest 2 versions)

---

## 10. Known Issues & Workarounds

### Issue 1: Font Files Not Loading in Production
**Problem:** Fonts work in dev mode but fail in production (`404 Not Found` for `.woff2` files).
**Root Cause:** CSS cannot resolve `node_modules/` paths after build.
**Solution:** See **Section 2.4: Font Assets Handling** for complete Vite configuration.

### Issue 2: Modals Appearing Behind Fixed Headers
**Problem:** Radix Dialog opens but appears behind sticky/fixed navigation.
**Root Cause:** Z-index conflicts between Radix Portals and app layout.
**Solution:** See **Section 2.5: Z-Index Strategy** for coordinated z-index scale.

### Issue 3: Flash of Unstyled Content (FOUC)
**Problem:** Page briefly shows unstyled content before Punkt colors/fonts load.
**Root Cause:** Incorrect CSS import order causes Tailwind to load before Punkt variables.
**Solution:** See **Section 2.6: Preventing FOUC** for correct import order and verification steps.

### Issue 4: Focus Trap Not Working in Modals
**Problem:** Tab key escapes modal instead of cycling through modal controls.
**Root Cause:** `<Dialog.Content>` doesn't wrap all interactive elements.
**Solution:** Ensure `<Dialog.Content>` wraps the entire modal, including close button:
```tsx
<Dialog.Content>
  <div className="flex justify-between">
    <Dialog.Title>Title</Dialog.Title>
    <Dialog.Close>X</Dialog.Close> {/* Must be inside Content */}
  </div>
  {/* Form fields */}
</Dialog.Content>
```

### Issue 5: Tailwind Classes Not Applied to Radix Components
**Problem:** Custom classes (e.g., `bg-oslo-blue`) don't appear on Radix primitives.
**Root Cause:** Radix renders to Portal outside of parent component scope.
**Solution:** Use `className` prop directly on Radix components (not wrapper divs):
```tsx
// ❌ Wrong - div outside Portal
<div className="bg-oslo-blue">
  <Dialog.Content>...</Dialog.Content>
</div>

// ✅ Correct - className on Content
<Dialog.Content className="bg-oslo-blue">
  ...
</Dialog.Content>
```

---

## 11. Future Enhancements

### 11.1 Offline Support
- Use TanStack Query's cache persistence
- Service Worker for offline viewing

### 11.2 Real-time Updates
- WebSocket subscription for live state updates
- Optimistic UI updates

### 11.3 Advanced Interactions
- Drag-and-drop file attachments (react-dropzone)
- Rich text editor for descriptions (Lexical or Tiptap)

---

## Appendix A: Reference Links

- [Radix UI Documentation](https://www.radix-ui.com/)
- [Tailwind CSS v4 Docs](https://tailwindcss.com/)
- [Punkt Design System](https://punkt.oslo.systems/)
- [WCAG 2.1 AA Guidelines](https://www.w3.org/WAI/WCAG21/quickref/?currentsidebar=%23col_customize&levels=aaa)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [React Hook Form Docs](https://react-hook-form.com/)

---

## Appendix B: Quick Start Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview

# Accessibility audit
npm run test:a11y
```

---

**End of Frontend Greenfield Plan**
