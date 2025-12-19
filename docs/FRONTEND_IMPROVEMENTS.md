# Frontend Forbedringer

**Forslag til arkitekturforbedringer basert på gjennomgang av kodebasen**

*Opprettet: 2025-12-19*

---

## Innhold

1. [Oppsummering](#1-oppsummering)
2. [Høy Prioritet](#2-høy-prioritet)
3. [Medium Prioritet](#3-medium-prioritet)
4. [Lav Prioritet](#4-lav-prioritet)
5. [Implementeringsrekkefølge](#5-implementeringsrekkefølge)

---

## 1. Oppsummering

### Nåværende styrker

Arkitekturen er generelt solid med:
- Tydelig lagdeling (API → Hooks → Komponenter → Pages)
- Streng TypeScript + Zod runtime-validering
- React Query for server-state (unngår over-engineering)
- God tilgjengelighetsfokus (30+ ESLint a11y-regler, Radix UI)
- Logisk komponenthierarki (Primitives → Views → Actions)

### Identifiserte forbedringspunkter

| Prioritet | Antall | Beskrivelse |
|-----------|--------|-------------|
| 🔴 Høy | 2 | Kritisk for stabilitet og ytelse |
| 🟡 Medium | 2 | Forbedrer utvikleropplevelse og vedlikeholdbarhet |
| 🟢 Lav | 2 | Finpuss og konvensjoner |

---

## 2. Høy Prioritet

### 2.1 Legg til ErrorBoundary

**Problem:**
Ingen `ErrorBoundary`-komponent finnes i kodebasen. Hvis en komponent krasjer, tar den ned hele applikasjonen uten noen fallback UI.

**Konsekvens:**
- Brukere ser blank side ved feil
- Ingen mulighet til å gjenopprette uten full refresh
- Vanskelig å debugge i produksjon

**Løsning:**

Opprett `src/components/ErrorBoundary.tsx`:

```tsx
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './primitives/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log til feilrapporteringstjeneste (f.eks. Sentry)
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-pkt-bg-default p-8">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-pkt-text-body-dark mb-4">
              Noe gikk galt
            </h1>
            <p className="text-pkt-text-body-dark/70 mb-6">
              En uventet feil oppstod. Prøv å laste siden på nytt.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={this.handleReset} variant="secondary">
                Prøv igjen
              </Button>
              <Button onClick={() => window.location.reload()}>
                Last siden på nytt
              </Button>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-8 p-4 bg-gray-100 text-left text-sm overflow-auto rounded">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

Wrap applikasjonen i `src/main.tsx`:

```tsx
<ErrorBoundary>
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
</ErrorBoundary>
```

**Innsats:** Lav (1-2 timer)

---

### 2.2 Lazy Load PDF-biblioteker

**Problem:**
PDF-bibliotekene (`@react-pdf/renderer`, `react-pdf`, `pdfjs-dist`) utgjør ~500KB og lastes ved oppstart, selv om de sjelden brukes.

**Nåværende konfigurasjon:**
```ts
// vite.config.ts
manualChunks: {
  'vendor-pdf': ['react-pdf', 'pdfjs-dist', '@react-pdf/renderer'],
}
```

Dette separerer PDF i egen chunk, men chunken lastes fortsatt synkront.

**Løsning:**

**Steg 1:** Opprett lazy wrapper `src/pdf/LazyPdfGenerator.tsx`:

```tsx
import { lazy, Suspense } from 'react';
import type { ContractorClaimPdfProps } from './ContractorClaimPdf';

// Lazy load PDF-komponenten
const ContractorClaimPdf = lazy(() =>
  import('./ContractorClaimPdf').then(module => ({
    default: module.ContractorClaimPdf
  }))
);

// Loading-komponent
function PdfLoading() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-pulse text-pkt-text-body-dark">
        Forbereder PDF...
      </div>
    </div>
  );
}

// Eksporter lazy-wrapped versjon
export function LazyContractorClaimPdf(props: ContractorClaimPdfProps) {
  return (
    <Suspense fallback={<PdfLoading />}>
      <ContractorClaimPdf {...props} />
    </Suspense>
  );
}
```

**Steg 2:** Opprett lazy generator `src/pdf/lazyGenerator.ts`:

```tsx
// Dynamisk import av PDF-generering
export async function generatePdfLazy(data: PdfData): Promise<Blob> {
  const { generatePdf } = await import('./generator');
  return generatePdf(data);
}
```

**Steg 3:** Oppdater `useSubmitEvent.ts`:

```tsx
// Før
import { generatePdf } from '@/src/pdf/generator';

// Etter
const generatePdfLazy = async (data: PdfData) => {
  const { generatePdf } = await import('@/src/pdf/generator');
  return generatePdf(data);
};
```

**Forventet gevinst:**
- ~500KB mindre initial bundle
- Raskere First Contentful Paint
- PDF lastes kun når bruker faktisk trenger det

**Innsats:** Medium (3-4 timer)

---

## 3. Medium Prioritet

### 3.1 Barrel Exports for Primitives

**Problem:**
Hver primitiv-komponent må importeres individuelt:

```tsx
// Nåværende - verbose
import { Button } from '@/src/components/primitives/Button';
import { Input } from '@/src/components/primitives/Input';
import { Modal } from '@/src/components/primitives/Modal';
import { Select } from '@/src/components/primitives/Select';
import { DatePicker } from '@/src/components/primitives/DatePicker';
```

**Løsning:**

Opprett `src/components/primitives/index.ts`:

```tsx
// Layout & Container
export { Card } from './Card';
export { Modal } from './Modal';
export { Collapsible } from './Collapsible';

// Form Controls
export { Button } from './Button';
export { Input } from './Input';
export { Textarea } from './Textarea';
export { Select } from './Select';
export { Checkbox } from './Checkbox';
export { RadioGroup } from './RadioGroup';
export { DatePicker } from './DatePicker';
export { CurrencyInput } from './CurrencyInput';

// Form Helpers
export { Label } from './Label';
export { FormField } from './FormField';

// Feedback
export { Alert } from './Alert';
export { AlertDialog } from './AlertDialog';
export { Badge } from './Badge';
export { Tooltip } from './Tooltip';

// Data Display
export { DataList } from './DataList';
export { MetadataGrid } from './MetadataGrid';
export { DashboardCard } from './DashboardCard';

// Status & Progress
export { StepIndicator } from './StepIndicator';
export { RevisionTag } from './RevisionTag';
export { InfoLabel } from './InfoLabel';
```

**Etter:**

```tsx
// Renere imports
import {
  Button,
  Input,
  Modal,
  Select,
  DatePicker
} from '@/src/components/primitives';
```

**Innsats:** Lav (1 time)

---

### 3.2 Lazy Load Sider med React.lazy

**Problem:**
Alle sider importeres synkront i `App.tsx`:

```tsx
// Nåværende
import { AuthLanding } from './pages/AuthLanding';
import { CasePage } from './pages/CasePage';
import { ForseringPage } from './pages/ForseringPage';
import { EndringsordePage } from './pages/EndringsordePage';
import { ExampleCasesPage } from './pages/ExampleCasesPage';
import { ComponentShowcase } from './pages/ComponentShowcase';
```

**Løsning:**

Oppdater `src/App.tsx`:

```tsx
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy load alle sider
const AuthLanding = lazy(() => import('./pages/AuthLanding'));
const CasePage = lazy(() => import('./pages/CasePage'));
const ForseringPage = lazy(() => import('./pages/ForseringPage'));
const EndringsordePage = lazy(() => import('./pages/EndringsordePage'));
const ExampleCasesPage = lazy(() => import('./pages/ExampleCasesPage'));
const ComponentShowcase = lazy(() => import('./pages/ComponentShowcase'));

// Loading-komponent for sider
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-pkt-text-body-dark">
        Laster...
      </div>
    </div>
  );
}

const App: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<AuthLanding />} />
        <Route path="/demo" element={<ExampleCasesPage />} />
        <Route path="/saker/:sakId" element={<CasePage />} />
        <Route path="/forsering/:sakId" element={<ForseringPage />} />
        <Route path="/endringsordre/:sakId" element={<EndringsordePage />} />
        <Route path="/showcase" element={<ComponentShowcase />} />
      </Routes>
    </Suspense>
  );
};

export default App;
```

**Merk:** Sidene må eksportere som default export:

```tsx
// pages/CasePage.tsx
export default function CasePage() { ... }
// eller
export { CasePage as default };
```

**Forventet gevinst:**
- Mindre initial bundle
- Kun aktiv side lastes
- Bedre cache-utnyttelse

**Innsats:** Lav (1-2 timer)

---

## 4. Lav Prioritet

### 4.1 Flytt Mock-data ut av src/

**Problem:**
Mock-data ligger i `src/mocks/`, som er produksjonskode-territorium:

```
src/
├── mocks/           # ← Bør ikke være her
│   ├── cases/
│   └── timelines/
```

**Løsning:**

Flytt til `__mocks__/` eller `tests/fixtures/`:

```
__mocks__/           # Jest/Vitest standard
├── cases/
└── timelines/

# eller

src/tests/fixtures/  # Alternativ
├── cases/
└── timelines/
```

Oppdater imports:

```tsx
// Før
import { mockCases } from '@/src/mocks/cases';

// Etter
import { mockCases } from '@/__mocks__/cases';
```

**Innsats:** Lav (30 min)

---

### 4.2 Sentraliser React Query-konfigurasjon

**Problem:**
`staleTime` og andre React Query-verdier er spredt i flere hooks:

```tsx
// useCaseState.ts
staleTime: 30_000,

// useTimeline.ts
staleTime: 30_000,

// useHistorikk.ts
staleTime: 30_000,
```

**Løsning:**

Opprett `src/constants/queryConfig.ts`:

```tsx
export const QUERY_CONFIG = {
  // Cache-tider
  STALE_TIME: 30_000,           // 30 sekunder
  STALE_TIME_LONG: 5 * 60_000,  // 5 minutter (for sjelden-endret data)

  // Retry-konfigurasjon
  RETRY_COUNT: 1,
  RETRY_DELAY: 1000,

  // Refetch-konfigurasjon
  REFETCH_ON_WINDOW_FOCUS: true,
  REFETCH_ON_RECONNECT: true,
} as const;
```

Oppdater hooks:

```tsx
// useCaseState.ts
import { QUERY_CONFIG } from '@/src/constants/queryConfig';

export function useCaseState(sakId: string) {
  return useQuery({
    queryKey: ['sak', sakId, 'state'],
    queryFn: () => fetchCaseState(sakId),
    staleTime: QUERY_CONFIG.STALE_TIME,
    refetchOnWindowFocus: QUERY_CONFIG.REFETCH_ON_WINDOW_FOCUS,
  });
}
```

Oppdater også `main.tsx`:

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: QUERY_CONFIG.RETRY_COUNT,
      staleTime: QUERY_CONFIG.STALE_TIME,
      refetchOnWindowFocus: false,
    },
  },
});
```

**Innsats:** Lav (30 min)

---

## 5. Implementeringsrekkefølge

### Anbefalt rekkefølge

```
Fase 1: Stabilitet (1-2 dager)
├── 2.1 ErrorBoundary         [🔴 Høy]
└── 3.1 Barrel exports        [🟡 Medium]

Fase 2: Ytelse (2-3 dager)
├── 2.2 Lazy load PDF         [🔴 Høy]
└── 3.2 Lazy load sider       [🟡 Medium]

Fase 3: Opprydding (1 dag)
├── 4.1 Flytt mocks           [🟢 Lav]
└── 4.2 Sentraliser config    [🟢 Lav]
```

### Estimert total innsats

| Fase | Estimat | Beskrivelse |
|------|---------|-------------|
| Fase 1 | 2-3 timer | ErrorBoundary + barrel exports |
| Fase 2 | 4-6 timer | Lazy loading av PDF og sider |
| Fase 3 | 1 time | Opprydding og konfigurasjon |
| **Total** | **7-10 timer** | Full implementering |

---

## Oppsummering

Disse forbedringene vil:

1. **Øke stabilitet** - ErrorBoundary forhindrer hvit skjerm ved feil
2. **Forbedre ytelse** - Lazy loading reduserer initial bundle med ~500KB+
3. **Forenkle utvikling** - Barrel exports og sentralisert config
4. **Rydde opp** - Bedre separasjon av test/prod-kode

Arkitekturen er allerede solid - disse er inkrementelle forbedringer, ikke kritiske mangler.
