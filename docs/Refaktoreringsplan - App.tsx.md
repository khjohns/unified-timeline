# Refaktoreringsplan: App.tsx

**Dato:** November 2025
**Versjon:** 1.0
**Status:** Planlagt

---

## Innholdsfortegnelse

1. [Bakgrunn og formål](#1-bakgrunn-og-formål)
2. [Nåværende struktur](#2-nåværende-struktur)
3. [Problemstillinger](#3-problemstillinger)
4. [Målarkitektur](#4-målarkitektur)
5. [Refaktoreringsstrategi](#5-refaktoreringsstrategi)
6. [Implementeringsplan](#6-implementeringsplan)
7. [Testing](#7-testing)
8. [Vedlegg](#8-vedlegg)

---

## 1. Bakgrunn og formål

### 1.1 Hvorfor refaktorere?

**Nåværende situasjon:**
- `App.tsx`: **874 linjer** kode i én komponent
- **15+ useState hooks** i samme komponent
- **5+ useEffect hooks** med komplekse dependencies
- Business logic tett koblet til UI
- Vanskelig å teste isolert
- Vanskelig å finne og endre funksjonalitet

**Problemer:**
- Komponent er for stor og gjør for mye
- Bryter "Single Responsibility Principle"
- useEffect-kjedet er vanskelig å følge
- URL parameter håndtering er kompleks
- Blandet presentasjon og forretningslogikk

### 1.2 Mål med refaktorering

✅ **Separere bekymringer (Separation of Concerns):**
- UI rendering (komponenter)
- State management (hooks)
- Business logic (services)
- URL routing (custom hook)

✅ **Gjøre koden testbar:**
- Isolerte hooks kan testes separat
- Services kan mockes
- Komponenter kan testes med mock data

✅ **Forbedre vedlikeholdbarhet:**
- Mindre komponenter (<200 linjer hver)
- Tydelig ansvar per modul
- Enklere å finne og endre kode

✅ **Forbedre gjenbrukbarhet:**
- Custom hooks kan brukes i andre komponenter
- Services kan brukes i hele applikasjonen

---

## 2. Nåværende struktur

### 2.1 App.tsx analyse (874 linjer)

```tsx
App.tsx (874 linjer)
├── Imports (25 linjer)
├── State Management (55 linjer)
│   ├── activeTab, toastMessage
│   ├── URL params (magicToken, sakId, modus, topicGuid)
│   ├── isFromMagicLinkRef (sessionStorage tracking)
│   ├── internalSakId, topicGuid
│   ├── isLoading, isSubmitting, apiError, isApiConnected
│   └── pdfPreviewModal state
│
├── Custom Hooks (2 stk, 11 linjer)
│   ├── useSkjemaData (form state + validation)
│   └── useAutoSave (localStorage persistence)
│
├── useEffect Hooks (4 stk, ~130 linjer)
│   ├── API connectivity check (10 linjer)
│   ├── Magic token verification (30 linjer)
│   ├── Load data from API (80 linjer)
│   ├── Set role from modus (30 linjer)
│   └── Body class management (10 linjer)
│
├── Event Handlers (10 stk, ~300 linjer)
│   ├── handleRoleChange (3 linjer)
│   ├── handleReset (6 linjer)
│   ├── handleDemo (5 linjer)
│   ├── validateCurrentTab (93 linjer) ⚠️
│   ├── handleDownloadPdf (10 linjer)
│   ├── handleSubmitToApi (17 linjer)
│   ├── handleConfirmSubmit (100 linjer) ⚠️
│   ├── getSubmitButtonText (43 linjer)
│   ├── addBhSvarRevisjon (32 linjer)
│   └── addKoeRevisjon (28 linjer)
│
├── Render Helpers (3 stk, ~100 linjer)
│   ├── renderTabs (20 linjer)
│   ├── renderPanel (25 linjer)
│   └── renderBottomBar (45 linjer)
│
└── Main Render (130 linjer)
    ├── Loading state (10 linjer)
    ├── ErrorBoundary wrapper
    ├── PktHeader
    ├── API Error banner (30 linjer)
    ├── Mode/SakId info banner (30 linjer)
    ├── Main layout (tabs + panel + bottom bar)
    ├── SidePanel
    ├── Toast
    └── PDFPreviewModal
```

### 2.2 Kritiske problemområder

**1. URL Parameter Håndtering (linje 38-68)**
```tsx
// Complex URL parameter management spread across component
const [searchParams, setSearchParams] = useSearchParams();
const magicToken = searchParams.get('magicToken');
const directSakId = searchParams.get('sakId');
const modus = searchParams.get('modus') as Modus | null;
const initialTopicGuid = searchParams.get('topicGuid');

// sessionStorage tracking for HMR persistence
const sessionValue = sessionStorage.getItem('isFromMagicLink');
const isFromMagicLinkRef = useRef(
    sessionValue === 'true' || sessionValue === 'consumed' || !!magicToken
);
// ... 30 more lines of URL/session logic
```

**Problem:**
- ❌ URL state logic spredt over 30+ linjer
- ❌ Kompleks sessionStorage logikk for HMR
- ❌ Vanskelig å teste
- ❌ Vanskelig å gjenbruke

**2. useEffect Kjeding (linje 102-228)**
```tsx
// Effect 1: Check API connection
useEffect(() => { ... }, []);

// Effect 2: Verify magic token (depends on Effect 1)
useEffect(() => {
    if (!magicToken || isApiConnected === false) return;
    // ... 20 lines
}, [magicToken, isApiConnected, ...]);

// Effect 3: Load data from API (depends on Effect 2)
useEffect(() => {
    if (!internalSakId) return;
    // ... 80 lines
}, [internalSakId, isApiConnected]);

// Effect 4: Set role from modus (depends on Effect 3)
useEffect(() => {
    if (isLoading || internalSakId || isFromMagicLinkRef.current) return;
    // ... 25 lines
}, [modus]);
```

**Problem:**
- ❌ 4 useEffects med komplekse dependencies
- ❌ Kjede-avhengigheter vanskelig å følge
- ❌ Race conditions mulig
- ❌ Vanskelig å debug

**3. Validering i komponent (linje 289-381)**
```tsx
const validateCurrentTab = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let firstInvalidFieldId: string | null = null;

    if (activeTab === 0) {
        // Varsel validation (15 lines)
    } else if (activeTab === 1) {
        // KOE validation (70 lines!)
    }
    // ... error handling, focus, toast
}, [activeTab, formData.varsel, formData.koe_revisjoner]);
```

**Problem:**
- ❌ 93 linjer validering i komponent
- ❌ Blandet UI-logikk (focus, toast) og business logic
- ❌ Kan ikke testes isolert
- ❌ Vanskelig å gjenbruke

**4. Submit Logic (linje 418-516)**
```tsx
const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setApiError(null);

    try {
        let response;
        const updatedFormData = { ...formData };

        if (modus === 'varsel') {
            // 10 lines of varsel-specific logic
        } else if (modus === 'svar' && internalSakId) {
            // 25 lines of svar-specific logic with complex conditions
        } else if (modus === 'revidering' && internalSakId) {
            // 5 lines of revidering logic
        } else {
            // 5 lines of KOE logic
        }

        // 20 lines of PDF generation and upload
        // ... error handling
    } catch (error) {
        // ... error handling
    } finally {
        setIsSubmitting(false);
    }
};
```

**Problem:**
- ❌ 100 linjer submit logic i komponent
- ❌ Kompleks if/else basert på modus
- ❌ PDF generering og API kall blandet
- ❌ Vanskelig å teste

---

## 3. Problemstillinger

### 3.1 Testbarhet

**Problem:** Business logic kan ikke testes uten å montere hele komponenten

```tsx
// Kan ikke teste isolert
const validateCurrentTab = useCallback((): boolean => {
    // 93 linjer validering
    // Krever: activeTab, formData, setErrors, showToast, focusOnField
}, [activeTab, formData.varsel, formData.koe_revisjoner]);
```

**Konsekvens:**
- Må sette opp hele React-komponenten for å teste validering
- Trege tester
- Vanskelig å teste edge cases

### 3.2 Vedlikeholdbarhet

**Problem:** 874 linjer i én fil

- Vanskelig å finne spesifikk funksjonalitet
- Merge conflicts ved parallelt arbeid
- Ingen klar modul-grense
- Vanskelig å onboarde nye utviklere

### 3.3 Gjenbrukbarhet

**Problem:** Logikk er låst inne i App-komponenten

Use cases som IKKE fungerer:
- Kan ikke gjenbruke validering i andre skjemaer
- Kan ikke gjenbruke URL-håndtering i andre sider
- Kan ikke gjenbruke submit-logikk i andre komponenter

### 3.4 Performance

**Problem:** En stor komponent re-rendres for hver state-endring

- 15+ state-variabler i samme komponent
- Hver state-endring trigger re-render av hele komponenten
- useCallback/useMemo brukes, men ikke nok

### 3.5 Kompleksitet

**Problem:** Kognitiv belastning

- Må holde 15+ state-variabler i hodet
- Må forstå 5+ useEffect dependencies
- Må forstå URL/sessionStorage logikk
- Må forstå modus-basert conditional logic

---

## 4. Målarkitektur

### 4.1 Lagdelt arkitektur

```
┌─────────────────────────────────────────────────┐
│  Presentation Layer (Components)                │
│  - App.tsx (orchestrator, ~150 linjer)         │
│  - BottomBar.tsx                                │
│  - InfoBanner.tsx                               │
│  - TabNavigation.tsx                            │
└─────────────────┬───────────────────────────────┘
                  │ Bruker
                  ▼
┌─────────────────────────────────────────────────┐
│  State Management Layer (Custom Hooks)          │
│  - useUrlParams (URL state)                     │
│  - useCaseLoader (auth + loading)               │
│  - useFormSubmission (submit logic)             │
│  - useTabs (tab navigation)                     │
│  - useModal (modal state)                       │
└─────────────────┬───────────────────────────────┘
                  │ Bruker
                  ▼
┌─────────────────────────────────────────────────┐
│  Business Logic Layer (Services)                │
│  - validationService (form validation)          │
│  - submissionService (submit workflows)         │
│  - pdfService (PDF generation)                  │
└─────────────────┬───────────────────────────────┘
                  │ Bruker
                  ▼
┌─────────────────────────────────────────────────┐
│  Data Layer (API + Hooks)                       │
│  - api.ts (HTTP calls)                          │
│  - useSkjemaData (form state)                   │
│  - useAutoSave (persistence)                    │
└─────────────────────────────────────────────────┘
```

### 4.2 Filstruktur (målbilde)

```
src/
├── App.tsx                      # Main component (~150 linjer) ⬇️
│
├── components/
│   ├── layout/
│   │   ├── AppHeader.tsx        # PktHeader wrapper
│   │   ├── AppLayout.tsx        # Main layout structure
│   │   ├── BottomBar.tsx        # Extracted from App
│   │   ├── InfoBanner.tsx       # API error + mode/sakId banner
│   │   └── TabNavigation.tsx    # Tab rendering
│   │
│   ├── panels/                  # Already exists ✅
│   │   ├── VarselPanel.tsx
│   │   ├── KravKoePanel.tsx
│   │   └── BhSvarPanel.tsx
│   │
│   └── ui/                      # Already exists ✅
│       ├── Toast.tsx
│       ├── SidePanel.tsx
│       └── PDFPreviewModal.tsx
│
├── hooks/
│   ├── useSkjemaData.ts         # Exists ✅
│   ├── useAutoSave.ts           # Exists ✅
│   │
│   ├── useUrlParams.ts          # NEW - URL parameter management
│   ├── useCaseLoader.ts         # NEW - Auth + data loading
│   ├── useFormSubmission.ts     # NEW - Submit logic
│   ├── useTabs.ts               # NEW - Tab state
│   ├── useModal.ts              # NEW - Modal state
│   └── useApiConnection.ts      # NEW - API health check
│
├── services/
│   ├── api.ts                   # Exists ✅
│   │
│   ├── validationService.ts     # NEW - Form validation
│   ├── submissionService.ts     # NEW - Submit workflows
│   └── revisionService.ts       # NEW - Revision management
│
├── utils/
│   ├── pdfGeneratorReact.tsx    # Exists ✅
│   ├── toastHelpers.ts          # Exists ✅
│   ├── statusHelpers.ts         # Exists ✅
│   └── urlHelpers.ts            # NEW - URL/sessionStorage helpers
│
└── context/
    └── AppContext.tsx           # NEW - Shared app state
```

### 4.3 Eksempel: Etter refaktorering

#### App.tsx (hovedkomponent, ~150 linjer)

```tsx
// App.tsx - Orchestrator component
import React from 'react';
import { useUrlParams } from './hooks/useUrlParams';
import { useCaseLoader } from './hooks/useCaseLoader';
import { useFormSubmission } from './hooks/useFormSubmission';
import { useTabs } from './hooks/useTabs';
import { useModal } from './hooks/useModal';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

const App: React.FC = () => {
  // 1. URL parameter management (extracted)
  const { magicToken, sakId, modus, topicGuid } = useUrlParams();

  // 2. Authentication + data loading (extracted)
  const {
    formData,
    setFormData,
    handleInputChange,
    errors,
    setErrors,
    isLoading,
    apiError,
    isApiConnected,
  } = useCaseLoader({ magicToken, sakId, modus, topicGuid });

  // 3. Tab navigation (extracted)
  const { activeTab, setActiveTab } = useTabs(modus);

  // 4. PDF preview modal (extracted)
  const { modal, openModal, closeModal } = useModal();

  // 5. Form submission (extracted)
  const {
    isSubmitting,
    handleSubmit,
    handleConfirm,
  } = useFormSubmission({
    formData,
    setFormData,
    modus,
    sakId,
    topicGuid,
    activeTab,
    errors,
    setErrors,
    onPreview: openModal,
  });

  // Loading state
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Main render
  return (
    <ErrorBoundary>
      <AppLayout
        formData={formData}
        setFormData={handleInputChange}
        errors={errors}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isApiConnected={isApiConnected}
        apiError={apiError}
        modus={modus}
        sakId={sakId}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        modal={modal}
        onModalClose={closeModal}
        onModalConfirm={handleConfirm}
      />
    </ErrorBoundary>
  );
};

export default App;
```

**Fordeler:**
- ✅ App.tsx redusert fra 874 til ~150 linjer
- ✅ Hver bekymring er separert i egen hook
- ✅ Lett å forstå dataflyt
- ✅ Lett å teste hver hook isolert

#### hooks/useUrlParams.ts (~80 linjer)

```tsx
// hooks/useUrlParams.ts
import { useSearchParams } from 'react-router-dom';
import { useRef, useEffect } from 'react';
import { Modus } from '../services/api';

interface UrlParams {
  magicToken: string | null;
  sakId: string | null;
  modus: Modus | null;
  topicGuid: string | null;
  isFromMagicLink: boolean;
  clearMagicToken: () => void;
}

/**
 * Custom hook for URL parameter management
 *
 * Handles:
 * - Reading URL parameters (magicToken, sakId, modus, topicGuid)
 * - Tracking magic link usage via sessionStorage (HMR-safe)
 * - Clearing magic token after verification
 *
 * @returns URL parameters and helper functions
 */
export const useUrlParams = (): UrlParams => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract URL parameters
  const magicToken = searchParams.get('magicToken');
  const sakId = searchParams.get('sakId');
  const modus = searchParams.get('modus') as Modus | null;
  const topicGuid = searchParams.get('topicGuid');

  // Track if user came from magic link (survive HMR reloads)
  const sessionValue = sessionStorage.getItem('isFromMagicLink');
  const isFromMagicLinkRef = useRef(
    sessionValue === 'true' || sessionValue === 'consumed' || !!magicToken
  );

  // Store magic link flag in sessionStorage
  useEffect(() => {
    if (magicToken && sessionValue !== 'true' && sessionValue !== 'consumed') {
      sessionStorage.setItem('isFromMagicLink', 'true');
      isFromMagicLinkRef.current = true;
    }
  }, [magicToken, sessionValue]);

  // Helper to clear magic token from URL
  const clearMagicToken = () => {
    searchParams.delete('magicToken');
    setSearchParams(searchParams, { replace: true });
    sessionStorage.setItem('isFromMagicLink', 'consumed');
  };

  return {
    magicToken,
    sakId,
    modus,
    topicGuid,
    isFromMagicLink: isFromMagicLinkRef.current,
    clearMagicToken,
  };
};
```

**Fordeler:**
- ✅ All URL-logikk isolert i én fil
- ✅ Kan testes uten å montere App
- ✅ Gjenbrukbar i andre komponenter
- ✅ Klar API (input/output)

#### services/validationService.ts (~150 linjer)

```tsx
// services/validationService.ts
import { FormDataModel } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  firstInvalidFieldId: string | null;
}

/**
 * Validation service for form data
 *
 * Pure functions - no React dependencies
 * Can be unit tested easily
 */
export const validationService = {
  /**
   * Validate Varsel tab
   */
  validateVarsel(varsel: FormDataModel['varsel']): ValidationResult {
    const errors: Record<string, string> = {};
    let firstInvalidFieldId: string | null = null;

    if (!varsel.dato_forhold_oppdaget.trim()) {
      errors['varsel.dato_forhold_oppdaget'] = 'Dato forhold oppdaget er påkrevd';
      if (!firstInvalidFieldId) firstInvalidFieldId = 'varsel.dato_forhold_oppdaget';
    }

    if (!varsel.hovedkategori.trim()) {
      errors['varsel.hovedkategori'] = 'Hovedkategori er påkrevd';
      if (!firstInvalidFieldId) firstInvalidFieldId = 'varsel.hovedkategori';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      firstInvalidFieldId,
    };
  },

  /**
   * Validate KOE tab (latest revision)
   */
  validateKoe(koeRevisjoner: FormDataModel['koe_revisjoner']): ValidationResult {
    const errors: Record<string, string> = {};
    let firstInvalidFieldId: string | null = null;

    const sisteKrav = koeRevisjoner[koeRevisjoner.length - 1];

    // Validate revision number
    if (!sisteKrav.koe_revisjonsnr.toString().trim()) {
      errors['koe_revisjoner.koe_revisjonsnr'] = 'Revisjonsnummer er påkrevd';
      if (!firstInvalidFieldId) firstInvalidFieldId = 'koe_revisjoner.koe_revisjonsnr';
    }

    // At least one claim type must be selected
    if (!sisteKrav.vederlag.krav_vederlag && !sisteKrav.frist.krav_fristforlengelse) {
      errors['krav_type'] = 'Du må velge minst ett krav (vederlag eller fristforlengelse)';
      if (!firstInvalidFieldId) firstInvalidFieldId = 'kravstype-vederlag-' + (koeRevisjoner.length - 1);
    }

    // Validate vederlag if selected
    if (sisteKrav.vederlag.krav_vederlag) {
      if (!sisteKrav.vederlag.krav_vederlag_metode) {
        errors['koe.vederlag.krav_vederlag_metode'] = 'Oppgjørsmetode er påkrevd';
        if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.vederlag.krav_vederlag_metode.' + (koeRevisjoner.length - 1);
      }

      if (!sisteKrav.vederlag.krav_vederlag_belop || sisteKrav.vederlag.krav_vederlag_belop <= 0) {
        errors['koe.vederlag.krav_vederlag_belop'] = 'Krevd beløp er påkrevd';
        if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.vederlag.krav_vederlag_belop.' + (koeRevisjoner.length - 1);
      }

      if (!sisteKrav.vederlag.krav_vederlag_begrunnelse?.trim()) {
        errors['koe.vederlag.krav_vederlag_begrunnelse'] = 'Begrunnelse for vederlagskrav er påkrevd';
        if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.vederlag.krav_vederlag_begrunnelse.' + (koeRevisjoner.length - 1);
      }
    }

    // Validate frist if selected
    if (sisteKrav.frist.krav_fristforlengelse) {
      if (!sisteKrav.frist.krav_frist_type) {
        errors['koe.frist.krav_frist_type'] = 'Type fristkrav er påkrevd';
        if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.frist.krav_frist_type.' + (koeRevisjoner.length - 1);
      }

      if (!sisteKrav.frist.krav_frist_antall_dager || sisteKrav.frist.krav_frist_antall_dager <= 0) {
        errors['koe.frist.krav_frist_antall_dager'] = 'Antall dager fristforlengelse er påkrevd';
        if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.frist.krav_frist_antall_dager.' + (koeRevisjoner.length - 1);
      }

      if (!sisteKrav.frist.krav_frist_begrunnelse?.trim()) {
        errors['koe.frist.krav_frist_begrunnelse'] = 'Begrunnelse for fristforlengelse er påkrevd';
        if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.frist.krav_frist_begrunnelse.' + (koeRevisjoner.length - 1);
      }
    }

    // Validate email/signature
    if (!sisteKrav.for_entreprenor?.trim()) {
      errors['koe.signerende_epost'] = 'E-post for signering må valideres';
      if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.signerende_epost.' + (koeRevisjoner.length - 1);
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      firstInvalidFieldId,
    };
  },

  /**
   * Validate tab based on activeTab index
   */
  validateTab(formData: FormDataModel, activeTab: number): ValidationResult {
    switch (activeTab) {
      case 0:
        return validationService.validateVarsel(formData.varsel);
      case 1:
        return validationService.validateKoe(formData.koe_revisjoner);
      default:
        return { isValid: true, errors: {}, firstInvalidFieldId: null };
    }
  },
};
```

**Fordeler:**
- ✅ Pure functions - ingen React dependencies
- ✅ Lett å unit teste (ingen mocking nødvendig)
- ✅ Gjenbrukbar i andre skjemaer
- ✅ Klar separasjon fra UI

---

## 5. Refaktoreringsstrategi

### 5.1 Prinsipper

✅ **Inkrementell refaktorering**
- En hook/service om gangen
- Test etter hver endring
- Ikke "big bang"-refaktorering

✅ **Bakoverkompatibilitet**
- App skal fortsatt fungere
- Kun intern struktur endres
- Ingen endringer i UI

✅ **Test-drevet**
- Skriv tester før refaktorering
- Tester skal passere før og etter
- Øk test coverage

### 5.2 Faser

**Fase 1: Forberedelse (dag 1)**
- Opprett mappestruktur
- Sett opp testing environment
- Skriv baseline tests for App.tsx

**Fase 2: Services (dag 2-3)**
- Ekstraher validationService
- Ekstraher submissionService
- Ekstraher revisionService

**Fase 3: Hooks (dag 4-7)**
- Ekstraher useUrlParams
- Ekstraher useApiConnection
- Ekstraher useCaseLoader
- Ekstraher useFormSubmission
- Ekstraher useTabs
- Ekstraher useModal

**Fase 4: Komponenter (dag 8-9)**
- Ekstraher AppHeader
- Ekstraher TabNavigation
- Ekstraher InfoBanner
- Ekstraher BottomBar
- Oppdater App.tsx til å bruke nye komponenter

**Fase 5: Testing (dag 10-11)**
- Skriv unit tests for services
- Skriv unit tests for hooks
- Skriv integration tests
- Oppnå >80% code coverage

**Fase 6: Cleanup (dag 12)**
- Fjern dead code
- Oppdater dokumentasjon
- Code review
- Merge til main

---

## 6. Implementeringsplan

### 6.1 Trinn 1: Opprett mappestruktur og testing

**Tid:** 1-2 timer

```bash
# Opprett mapper
mkdir -p src/components/layout
mkdir -p src/services
mkdir -p src/context
mkdir -p src/utils
mkdir -p src/__tests__/hooks
mkdir -p src/__tests__/services
mkdir -p src/__tests__/components

# Installer testing dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install --save-dev vitest @vitest/ui jsdom
```

**Opprett vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/__tests__/'],
    },
  },
});
```

### 6.2 Trinn 2: Ekstraher validationService

**Tid:** 3-4 timer

**Checklist:**
- [ ] Opprett `src/services/validationService.ts`
- [ ] Flytt `validateCurrentTab` logikk
- [ ] Lag pure functions (ingen React dependencies)
- [ ] Skriv unit tests i `src/__tests__/services/validationService.test.ts`
- [ ] Oppdater App.tsx til å bruke service
- [ ] Test at App fungerer som før

**Unit test eksempel:**
```typescript
// src/__tests__/services/validationService.test.ts
import { describe, it, expect } from 'vitest';
import { validationService } from '../../services/validationService';
import { INITIAL_FORM_DATA } from '../../constants';

describe('validationService', () => {
  describe('validateVarsel', () => {
    it('should return errors if dato_forhold_oppdaget is missing', () => {
      const varsel = {
        ...INITIAL_FORM_DATA.varsel,
        dato_forhold_oppdaget: '',
      };

      const result = validationService.validateVarsel(varsel);

      expect(result.isValid).toBe(false);
      expect(result.errors['varsel.dato_forhold_oppdaget']).toBeDefined();
      expect(result.firstInvalidFieldId).toBe('varsel.dato_forhold_oppdaget');
    });

    it('should return valid if all fields are filled', () => {
      const varsel = {
        ...INITIAL_FORM_DATA.varsel,
        dato_forhold_oppdaget: '2025-11-20',
        hovedkategori: 'Risiko',
      };

      const result = validationService.validateVarsel(varsel);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
      expect(result.firstInvalidFieldId).toBeNull();
    });
  });

  describe('validateKoe', () => {
    it('should require at least one claim type', () => {
      const koeRevisjoner = [
        {
          ...INITIAL_FORM_DATA.koe_revisjoner[0],
          vederlag: { ...INITIAL_FORM_DATA.koe_revisjoner[0].vederlag, krav_vederlag: false },
          frist: { ...INITIAL_FORM_DATA.koe_revisjoner[0].frist, krav_fristforlengelse: false },
        },
      ];

      const result = validationService.validateKoe(koeRevisjoner);

      expect(result.isValid).toBe(false);
      expect(result.errors['krav_type']).toBeDefined();
    });

    it('should validate vederlag fields if krav_vederlag is true', () => {
      const koeRevisjoner = [
        {
          ...INITIAL_FORM_DATA.koe_revisjoner[0],
          vederlag: {
            krav_vederlag: true,
            krav_vederlag_metode: '',
            krav_vederlag_belop: '',
            krav_vederlag_begrunnelse: '',
          },
        },
      ];

      const result = validationService.validateKoe(koeRevisjoner);

      expect(result.isValid).toBe(false);
      expect(result.errors['koe.vederlag.krav_vederlag_metode']).toBeDefined();
      expect(result.errors['koe.vederlag.krav_vederlag_belop']).toBeDefined();
      expect(result.errors['koe.vederlag.krav_vederlag_begrunnelse']).toBeDefined();
    });
  });
});
```

### 6.3 Trinn 3: Ekstraher submissionService

**Tid:** 4-5 timer

**Ansvar:**
- Determine status/modus transitions
- Build payload for API
- Handle PDF generation workflow

**Checklist:**
- [ ] Opprett `src/services/submissionService.ts`
- [ ] Flytt status/modus logikk fra `handleConfirmSubmit`
- [ ] Lag pure functions for status transitions
- [ ] Skriv unit tests
- [ ] Oppdater App.tsx til å bruke service

**Eksempel:**
```typescript
// src/services/submissionService.ts
import { FormDataModel, BhSvar } from '../types';
import { Modus } from './api';
import { SAK_STATUS } from '../utils/statusHelpers';

interface StatusTransition {
  nextStatus: string;
  nextModus: string;
  requiresRevision?: boolean;
}

export const submissionService = {
  /**
   * Determine next status and modus after Varsel submission
   */
  getVarselTransition(): StatusTransition {
    return {
      nextStatus: SAK_STATUS.VARSLET,
      nextModus: 'koe',
    };
  },

  /**
   * Determine next status and modus after Svar submission
   */
  getSvarTransition(formData: FormDataModel): StatusTransition {
    const sisteBhSvar = formData.bh_svar_revisjoner[formData.bh_svar_revisjoner.length - 1];
    const vederlagSvar = sisteBhSvar?.vederlag?.bh_svar_vederlag || '';
    const fristSvar = sisteBhSvar?.frist?.bh_svar_frist || '';

    // Check if revision is needed
    const trengerRevidering = (
      vederlagSvar === '100000001' || vederlagSvar === '100000002' ||
      vederlagSvar === '100000003' || vederlagSvar === '100000004' ||
      fristSvar === '100000001' || fristSvar === '100000002' ||
      fristSvar === '100000003' || fristSvar === '100000004'
    );

    if (trengerRevidering) {
      return {
        nextStatus: SAK_STATUS.VURDERES_AV_TE,
        nextModus: 'revidering',
        requiresRevision: true,
      };
    } else {
      return {
        nextStatus: SAK_STATUS.OMFORENT,
        nextModus: 'ferdig',
        requiresRevision: false,
      };
    }
  },

  /**
   * Determine next status and modus after Revidering submission
   */
  getRevideringTransition(): StatusTransition {
    return {
      nextStatus: SAK_STATUS.VENTER_PAA_SVAR,
      nextModus: 'svar',
    };
  },

  /**
   * Determine next status and modus after KOE submission
   */
  getKoeTransition(): StatusTransition {
    return {
      nextStatus: SAK_STATUS.VENTER_PAA_SVAR,
      nextModus: 'svar',
    };
  },

  /**
   * Get transition based on current modus
   */
  getTransition(modus: Modus | null, formData: FormDataModel): StatusTransition {
    switch (modus) {
      case 'varsel':
        return submissionService.getVarselTransition();
      case 'svar':
        return submissionService.getSvarTransition(formData);
      case 'revidering':
        return submissionService.getRevideringTransition();
      case 'koe':
      default:
        return submissionService.getKoeTransition();
    }
  },
};
```

### 6.4 Trinn 4: Ekstraher useUrlParams

**Tid:** 2-3 timer

**Checklist:**
- [ ] Opprett `src/hooks/useUrlParams.ts`
- [ ] Opprett `src/utils/urlHelpers.ts` for sessionStorage
- [ ] Flytt URL parameter logikk
- [ ] Skriv unit tests (mock useSearchParams)
- [ ] Oppdater App.tsx til å bruke hook

**Hook test eksempel:**
```typescript
// src/__tests__/hooks/useUrlParams.test.ts
import { renderHook } from '@testing-library/react';
import { useUrlParams } from '../../hooks/useUrlParams';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock react-router-dom
const mockSetSearchParams = vi.fn();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => {
    const params = new URLSearchParams('?magicToken=test123&sakId=SAK-001&modus=varsel');
    return [params, mockSetSearchParams];
  },
}));

describe('useUrlParams', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockSetSearchParams.mockClear();
  });

  it('should extract URL parameters correctly', () => {
    const { result } = renderHook(() => useUrlParams());

    expect(result.current.magicToken).toBe('test123');
    expect(result.current.sakId).toBe('SAK-001');
    expect(result.current.modus).toBe('varsel');
  });

  it('should track magic link usage in sessionStorage', () => {
    const { result } = renderHook(() => useUrlParams());

    expect(result.current.isFromMagicLink).toBe(true);
    expect(sessionStorage.getItem('isFromMagicLink')).toBe('true');
  });

  it('should clear magic token from URL', () => {
    const { result } = renderHook(() => useUrlParams());

    result.current.clearMagicToken();

    expect(mockSetSearchParams).toHaveBeenCalled();
    expect(sessionStorage.getItem('isFromMagicLink')).toBe('consumed');
  });
});
```

### 6.5 Trinn 5: Ekstraher useApiConnection

**Tid:** 1-2 timer

**Ansvar:**
- API health check on mount
- Track connection status

**Checklist:**
- [ ] Opprett `src/hooks/useApiConnection.ts`
- [ ] Flytt API health check useEffect
- [ ] Skriv unit tests
- [ ] Oppdater App.tsx

**Hook:**
```typescript
// src/hooks/useApiConnection.ts
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { logger } from '../utils/logger';

interface UseApiConnectionReturn {
  isApiConnected: boolean | null;
}

/**
 * Custom hook for checking API connectivity
 *
 * Performs health check on mount to determine if backend is available
 *
 * @returns Object with API connection status
 */
export const useApiConnection = (): UseApiConnectionReturn => {
  const [isApiConnected, setIsApiConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const checkApiConnection = async () => {
      const connected = await api.healthCheck();
      setIsApiConnected(connected);
      if (!connected) {
        logger.warn('API server not available - running in offline mode');
      }
    };
    checkApiConnection();
  }, []);

  return { isApiConnected };
};
```

### 6.6 Trinn 6: Ekstraher useCaseLoader

**Tid:** 6-8 timer

**Ansvar:**
- Magic token verification
- Load case data from API
- Set initial tab based on modus
- Integrate with useSkjemaData and useAutoSave

**Dette er den mest komplekse hooken** - inneholder de 3 store useEffect-ene.

**Checklist:**
- [ ] Opprett `src/hooks/useCaseLoader.ts`
- [ ] Flytt magic token verification useEffect
- [ ] Flytt load from API useEffect
- [ ] Flytt set role from modus useEffect
- [ ] Skriv integration tests (med mock API)
- [ ] Oppdater App.tsx

**Hook struktur:**
```typescript
// src/hooks/useCaseLoader.ts
import { useState, useEffect } from 'react';
import { FormDataModel } from '../types';
import { Modus } from '../services/api';
import { useSkjemaData } from './useSkjemaData';
import { useAutoSave } from './useAutoSave';

interface UseCaseLoaderParams {
  magicToken: string | null;
  sakId: string | null;
  modus: Modus | null;
  topicGuid: string | null;
  isFromMagicLink: boolean;
  clearMagicToken: () => void;
}

interface UseCaseLoaderReturn {
  formData: FormDataModel;
  setFormData: (data: FormDataModel) => void;
  handleInputChange: (...args: any[]) => void;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
  isLoading: boolean;
  apiError: string | null;
  isApiConnected: boolean | null;
}

export const useCaseLoader = (params: UseCaseLoaderParams): UseCaseLoaderReturn => {
  // ... implementation
  // Combines magic token verification + data loading + role setting
};
```

### 6.7 Trinn 7: Ekstraher useFormSubmission

**Tid:** 5-6 timer

**Ansvar:**
- Form validation
- PDF generation
- API submission
- Modal preview logic

**Checklist:**
- [ ] Opprett `src/hooks/useFormSubmission.ts`
- [ ] Flytt `handleSubmitToApi` og `handleConfirmSubmit`
- [ ] Bruk validationService og submissionService
- [ ] Skriv integration tests
- [ ] Oppdater App.tsx

**Hook:**
```typescript
// src/hooks/useFormSubmission.ts
import { useState } from 'react';
import { FormDataModel } from '../types';
import { Modus, api } from '../services/api';
import { validationService } from '../services/validationService';
import { submissionService } from '../services/submissionService';
import { generatePdfBlob } from '../utils/pdfGeneratorReact';
import { showToast } from '../utils/toastHelpers';
import { focusOnField } from '../utils/focusHelpers';

interface UseFormSubmissionParams {
  formData: FormDataModel;
  setFormData: (data: FormDataModel) => void;
  modus: Modus | null;
  sakId: string | null;
  topicGuid: string | null;
  activeTab: number;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
  onPreview: (blob: Blob, type: Modus) => void;
}

interface UseFormSubmissionReturn {
  isSubmitting: boolean;
  handleSubmit: () => Promise<void>;
  handleConfirm: () => Promise<void>;
}

export const useFormSubmission = (params: UseFormSubmissionParams): UseFormSubmissionReturn => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    // 1. Validate
    const validationResult = validationService.validateTab(params.formData, params.activeTab);
    if (!validationResult.isValid) {
      params.setErrors(validationResult.errors);
      showToast(params.setToastMessage, Object.values(validationResult.errors)[0]);
      if (validationResult.firstInvalidFieldId) {
        focusOnField(validationResult.firstInvalidFieldId);
      }
      return;
    }

    // 2. Generate PDF
    try {
      const { blob } = await generatePdfBlob(params.formData);
      params.onPreview(blob, params.modus || 'koe');
    } catch (error) {
      // ... error handling
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);

    try {
      // 1. Get status transition
      const transition = submissionService.getTransition(params.modus, params.formData);

      // 2. Update formData with new status/modus
      const updatedFormData = {
        ...params.formData,
        sak: {
          ...params.formData.sak,
          status: transition.nextStatus,
          modus: transition.nextModus,
        },
      };
      params.setFormData(updatedFormData);

      // 3. Submit to API
      let response;
      if (params.modus === 'varsel') {
        response = await api.submitVarsel(updatedFormData, params.topicGuid || undefined, params.sakId || undefined);
      } else if (params.modus === 'svar' && params.sakId) {
        response = await api.submitSvar(updatedFormData, params.sakId, params.topicGuid || undefined);
      } else if (params.modus === 'revidering' && params.sakId) {
        response = await api.submitRevidering(updatedFormData, params.sakId);
      } else {
        response = await api.submitKoe(updatedFormData, params.sakId || undefined, params.topicGuid || undefined);
      }

      // 4. Handle response
      if (response.success) {
        // Upload PDF, clear localStorage, show success
        // ...
      } else {
        // Show error
        // ...
      }
    } catch (error) {
      // ... error handling
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    handleSubmit,
    handleConfirm,
  };
};
```

### 6.8 Trinn 8: Ekstraher komponenter

**Tid:** 4-5 timer

**Checklist:**
- [ ] Opprett `src/components/layout/TabNavigation.tsx` (renderTabs)
- [ ] Opprett `src/components/layout/BottomBar.tsx` (renderBottomBar)
- [ ] Opprett `src/components/layout/InfoBanner.tsx` (API error + mode/sakId)
- [ ] Opprett `src/components/layout/AppHeader.tsx` (PktHeader wrapper)
- [ ] Opprett `src/components/layout/AppLayout.tsx` (main layout)
- [ ] Skriv component tests
- [ ] Oppdater App.tsx til å bruke nye komponenter

**Eksempel: BottomBar.tsx**
```tsx
// src/components/layout/BottomBar.tsx
import React from 'react';
import { PktButton } from '@oslokommune/punkt-react';

interface BottomBarProps {
  onReset: () => void;
  onDownloadPdf: () => void;
  onDemo: () => void;
  onSubmit: () => void;
  isApiConnected: boolean | null;
  isSubmitting: boolean;
  submitButtonText: React.ReactNode;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  onReset,
  onDownloadPdf,
  onDemo,
  onSubmit,
  isApiConnected,
  isSubmitting,
  submitButtonText,
}) => {
  return (
    <div className="px-4 sm:px-0" role="navigation" aria-label="Steg navigasjon">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <button
          onClick={onReset}
          className="text-sm text-red-600 hover:text-red-700 hover:underline"
        >
          Nullstill
        </button>
        <div className="flex gap-3 flex-wrap items-center">
          <PktButton
            skin="secondary"
            size="small"
            onClick={onDownloadPdf}
            iconName="document-pdf"
            variant="icon-left"
          >
            Last ned PDF
          </PktButton>
          <PktButton
            skin="secondary"
            size="small"
            onClick={onDemo}
            iconName="plus-circle"
            variant="icon-left"
          >
            Eksempel
          </PktButton>
          {isApiConnected && (
            <PktButton
              skin="primary"
              size="small"
              onClick={onSubmit}
              iconName="arrow-right"
              variant="icon-right"
              disabled={isSubmitting}
            >
              {submitButtonText}
            </PktButton>
          )}
        </div>
      </div>
    </div>
  );
};
```

### 6.9 Trinn 9: Oppdater App.tsx

**Tid:** 2-3 timer

**Checklist:**
- [ ] Importer alle nye hooks og komponenter
- [ ] Fjern gammel kode (erstattet av hooks/komponenter)
- [ ] Verifiser at App.tsx er <200 linjer
- [ ] Test at applikasjonen fungerer som før
- [ ] Kjør alle tester

**Resultat:** App.tsx redusert fra 874 til ~150 linjer! 🎉

### 6.10 Trinn 10: Testing og dokumentasjon

**Tid:** 4-6 timer

**Checklist:**
- [ ] Skriv unit tests for alle services (>90% coverage)
- [ ] Skriv unit tests for alle hooks (>80% coverage)
- [ ] Skriv component tests for layout komponenter
- [ ] Skriv integration test for hele submit-flyten
- [ ] Oppdater README med ny arkitektur
- [ ] Lag arkitektur-diagram
- [ ] Code review

**Kjør tester:**
```bash
# Kjør alle tester
npm run test

# Kjør med coverage
npm run test -- --coverage

# Watch mode for utvikling
npm run test -- --watch
```

---

## 7. Testing

### 7.1 Test-strategi

**Unit Tests (70% av tester):**
- Services (validationService, submissionService)
- Pure functions
- Raske å kjøre (<1 sekund per test)

**Hook Tests (20% av tester):**
- Custom hooks med renderHook
- Mock dependencies (API, router)
- Medium hastighet (~1-2 sekunder per test)

**Component Tests (10% av tester):**
- Layout komponenter
- Bruker user-event for interaksjoner
- Integration-level testing

### 7.2 Test-eksempler

**Service test (pure function):**
```typescript
// src/__tests__/services/submissionService.test.ts
import { describe, it, expect } from 'vitest';
import { submissionService } from '../../services/submissionService';
import { INITIAL_FORM_DATA } from '../../constants';
import { SAK_STATUS } from '../../utils/statusHelpers';

describe('submissionService', () => {
  describe('getVarselTransition', () => {
    it('should transition to VARSLET status and koe modus', () => {
      const transition = submissionService.getVarselTransition();

      expect(transition.nextStatus).toBe(SAK_STATUS.VARSLET);
      expect(transition.nextModus).toBe('koe');
    });
  });

  describe('getSvarTransition', () => {
    it('should require revision if BH partially approves', () => {
      const formData = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '100000001', // Delvis godkjent
            },
          },
        ],
      };

      const transition = submissionService.getSvarTransition(formData);

      expect(transition.nextStatus).toBe(SAK_STATUS.VURDERES_AV_TE);
      expect(transition.nextModus).toBe('revidering');
      expect(transition.requiresRevision).toBe(true);
    });

    it('should finalize if BH fully approves', () => {
      const formData = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '100000004', // Godkjent
            },
            frist: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].frist,
              bh_svar_frist: '100000004', // Godkjent
            },
          },
        ],
      };

      const transition = submissionService.getSvarTransition(formData);

      expect(transition.nextStatus).toBe(SAK_STATUS.OMFORENT);
      expect(transition.nextModus).toBe('ferdig');
      expect(transition.requiresRevision).toBe(false);
    });
  });
});
```

**Hook test:**
```typescript
// src/__tests__/hooks/useCaseLoader.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useCaseLoader } from '../../hooks/useCaseLoader';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    healthCheck: vi.fn(),
    verifyMagicToken: vi.fn(),
    getCase: vi.fn(),
  },
}));

describe('useCaseLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify magic token and load case data', async () => {
    // Mock API responses
    (api.healthCheck as any).mockResolvedValue(true);
    (api.verifyMagicToken as any).mockResolvedValue({
      success: true,
      data: { sakId: 'SAK-001' },
    });
    (api.getCase as any).mockResolvedValue({
      success: true,
      data: {
        sakId: 'SAK-001',
        formData: { /* ... */ },
        topicGuid: 'TOPIC-001',
      },
    });

    const { result } = renderHook(() =>
      useCaseLoader({
        magicToken: 'test-token',
        sakId: null,
        modus: 'varsel',
        topicGuid: null,
        isFromMagicLink: true,
        clearMagicToken: vi.fn(),
      })
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify API calls
    expect(api.verifyMagicToken).toHaveBeenCalledWith('test-token');
    expect(api.getCase).toHaveBeenCalledWith('SAK-001', 'varsel');

    // Verify loaded data
    expect(result.current.formData).toBeDefined();
    expect(result.current.apiError).toBeNull();
  });

  it('should handle magic token verification failure', async () => {
    (api.healthCheck as any).mockResolvedValue(true);
    (api.verifyMagicToken as any).mockResolvedValue({
      success: false,
      error: 'Invalid token',
    });

    const { result } = renderHook(() =>
      useCaseLoader({
        magicToken: 'invalid-token',
        sakId: null,
        modus: null,
        topicGuid: null,
        isFromMagicLink: true,
        clearMagicToken: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.apiError).toBe('Invalid token');
  });
});
```

**Component test:**
```typescript
// src/__tests__/components/BottomBar.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomBar } from '../../components/layout/BottomBar';
import { describe, it, expect, vi } from 'vitest';

describe('BottomBar', () => {
  it('should render all buttons when API is connected', () => {
    render(
      <BottomBar
        onReset={vi.fn()}
        onDownloadPdf={vi.fn()}
        onDemo={vi.fn()}
        onSubmit={vi.fn()}
        isApiConnected={true}
        isSubmitting={false}
        submitButtonText="Send"
      />
    );

    expect(screen.getByText('Nullstill')).toBeInTheDocument();
    expect(screen.getByText('Last ned PDF')).toBeInTheDocument();
    expect(screen.getByText('Eksempel')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('should hide submit button when API is not connected', () => {
    render(
      <BottomBar
        onReset={vi.fn()}
        onDownloadPdf={vi.fn()}
        onDemo={vi.fn()}
        onSubmit={vi.fn()}
        isApiConnected={false}
        isSubmitting={false}
        submitButtonText="Send"
      />
    );

    expect(screen.queryByText('Send')).not.toBeInTheDocument();
  });

  it('should call onReset when Nullstill is clicked', async () => {
    const onReset = vi.fn();
    render(
      <BottomBar
        onReset={onReset}
        onDownloadPdf={vi.fn()}
        onDemo={vi.fn()}
        onSubmit={vi.fn()}
        isApiConnected={true}
        isSubmitting={false}
        submitButtonText="Send"
      />
    );

    await userEvent.click(screen.getByText('Nullstill'));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('should disable submit button when submitting', () => {
    render(
      <BottomBar
        onReset={vi.fn()}
        onDownloadPdf={vi.fn()}
        onDemo={vi.fn()}
        onSubmit={vi.fn()}
        isApiConnected={true}
        isSubmitting={true}
        submitButtonText="Sender..."
      />
    );

    const submitButton = screen.getByText('Sender...').closest('button');
    expect(submitButton).toBeDisabled();
  });
});
```

---

## 8. Vedlegg

### 8.1 Checklist for refaktorering

**Forberedelse:**
- [ ] Les denne planen
- [ ] Sett opp Git branch: `refactor/app-tsx`
- [ ] Installer vitest: `npm install --save-dev vitest @vitest/ui jsdom`
- [ ] Installer testing-library: `npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event`
- [ ] Backup eksisterende App.tsx

**Implementering:**
- [ ] Trinn 1: Opprett mappestruktur og testing (1-2 timer)
- [ ] Trinn 2: Ekstraher validationService (3-4 timer)
- [ ] Trinn 3: Ekstraher submissionService (4-5 timer)
- [ ] Trinn 4: Ekstraher useUrlParams (2-3 timer)
- [ ] Trinn 5: Ekstraher useApiConnection (1-2 timer)
- [ ] Trinn 6: Ekstraher useCaseLoader (6-8 timer)
- [ ] Trinn 7: Ekstraher useFormSubmission (5-6 timer)
- [ ] Trinn 8: Ekstraher komponenter (4-5 timer)
- [ ] Trinn 9: Oppdater App.tsx (2-3 timer)
- [ ] Trinn 10: Testing og dokumentasjon (4-6 timer)

**Testing:**
- [ ] Unit tests kjører og passerer (>80% coverage)
- [ ] Hook tests kjører og passerer
- [ ] Component tests kjører og passerer
- [ ] Manuell testing av alle flows
- [ ] Performance testing (ingen regresjon)

**Cleanup:**
- [ ] Fjern dead code
- [ ] Oppdater README
- [ ] Code review
- [ ] Merge til main

### 8.2 Estimert tidsbruk

| Trinn | Aktivitet | Tid |
|-------|-----------|-----|
| 1 | Forberedelse + testing setup | 1-2 timer |
| 2 | validationService | 3-4 timer |
| 3 | submissionService | 4-5 timer |
| 4 | useUrlParams | 2-3 timer |
| 5 | useApiConnection | 1-2 timer |
| 6 | useCaseLoader | 6-8 timer |
| 7 | useFormSubmission | 5-6 timer |
| 8 | Komponenter | 4-5 timer |
| 9 | Oppdater App.tsx | 2-3 timer |
| 10 | Testing + dokumentasjon | 4-6 timer |
| **Totalt** | | **32-44 timer** |

**Kalendertid:** 5-7 virkedager (avhengig av ressurser)

### 8.3 Risiko og mitigering

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Breaking changes i UI | Lav | Høy | Comprehensive testing, visual regression testing |
| useEffect dependencies feil | Medium | Høy | Nøye testing av loading flows, logging |
| Test setup kompleksitet | Medium | Lav | Start med enkle tester, bygg opp gradvis |
| Merge conflicts | Høy | Lav | Små commits, hyppig merge fra main |
| Scope creep | Medium | Medium | Strikt følge planen, ikke "forbedre" samtidig |
| Hook dependencies bugs | Høy | Høy | ESLint exhaustive-deps, testing |

### 8.4 Suksesskriterier

✅ **Teknisk:**
- [ ] App.tsx < 200 linjer (fra 874)
- [ ] Alle hooks < 150 linjer
- [ ] Alle services < 150 linjer
- [ ] Test coverage > 80%
- [ ] Ingen performance-regresjon

✅ **Funksjonell:**
- [ ] Alle flows fungerer som før
- [ ] Magic link verification fungerer
- [ ] Data loading fungerer
- [ ] Form submission fungerer
- [ ] PDF generation fungerer

✅ **Kvalitet:**
- [ ] Code review godkjent
- [ ] Dokumentasjon oppdatert
- [ ] Arkitektur-diagram laget
- [ ] Ingen kritiske bugs

### 8.5 Før og etter sammenligning

**Før refaktorering:**
```
App.tsx: 874 linjer
├── 15+ useState hooks
├── 5+ useEffect hooks
├── 10+ event handlers (300 linjer)
├── 3+ render helpers (100 linjer)
└── Complex conditional rendering

Problemer:
❌ Vanskelig å teste
❌ Vanskelig å vedlikeholde
❌ Vanskelig å forstå dataflyt
❌ Vanskelig å gjenbruke logikk
```

**Etter refaktorering:**
```
App.tsx: ~150 linjer (orchestrator)
├── 5-6 custom hooks (import only)
├── 5-6 layout komponenter (import only)
├── Minimal state management
└── Clear dataflyt

Fordeler:
✅ Isolerte, testbare moduler
✅ Klar separasjon av bekymringer
✅ Gjenbrukbar business logic
✅ Lett å forstå og vedlikeholde

Ny struktur:
hooks/ (6 files, ~500 linjer total)
services/ (3 files, ~400 linjer total)
components/layout/ (5 files, ~300 linjer total)
```

**Resultat:** Same functionality, bedre arkitektur!

---

**Vedlikeholdt av:** Claude
**Sist oppdatert:** 2025-11-29
**Status:** Klar for implementering

**Endringslogg:**
- **v1.0 (2025-11-29):** Første versjon av refaktoreringsplan for App.tsx
  - Identifisert 874 linjer kode med 15+ state hooks og 5+ useEffects
  - Foreslått lagdelt arkitektur med hooks, services og komponenter
  - Detaljert 10-trinns implementeringsplan (32-44 timer)
  - Komplett testing-strategi med eksempler
  - Estimat: 5-7 virkedager
