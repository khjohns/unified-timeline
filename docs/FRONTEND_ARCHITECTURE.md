# Frontend Arkitektur

**Dokumentasjon av frontend-arkitektur, komponentstruktur og tekniske beslutninger**

*Sist oppdatert: 2025-12-20 (CloudEvents-format)*

---

## Innhold

1. [Innledning](#1-innledning)
2. [Teknologistabel](#2-teknologistabel)
3. [Mappestruktur](#3-mappestruktur)
4. [Komponentarkitektur](#4-komponentarkitektur)
5. [State Management](#5-state-management)
6. [Routing](#6-routing)
7. [API-integrasjon](#7-api-integrasjon)
8. [Styling og Designsystem](#8-styling-og-designsystem)
9. [TypeScript-konfigurasjon](#9-typescript-konfigurasjon)
10. [Build og Utviklingsmiljø](#10-build-og-utviklingsmiljø)
11. [Testing](#11-testing)
12. [Tilgjengelighet (a11y)](#12-tilgjengelighet-a11y)
13. [Best Practices](#13-best-practices)

---

## 1. Innledning

### Formål

Dette dokumentet gir en detaljert oversikt over frontend-arkitekturen i Unified Timeline-applikasjonen. Det dekker:

- **Komponentstruktur** - Organisering av React-komponenter i lag
- **State management** - Håndtering av tilstand med Context API og React Query
- **API-integrasjon** - Mønster for kommunikasjon med backend
- **Styling** - Tailwind CSS v4 og Punkt designsystem
- **Build-konfigurasjon** - Vite, TypeScript og andre verktøy

For generell systemarkitektur og datamodeller, se [ARCHITECTURE_AND_DATAMODEL.md](./ARCHITECTURE_AND_DATAMODEL.md).

### Arkitekturmål

| Mål | Beskrivelse |
|-----|-------------|
| **Type-sikkerhet** | Streng TypeScript-konfigurasjon gjennom hele applikasjonen |
| **Tilgjengelighet** | WCAG 2.1 Level AA-kompatibilitet |
| **Ytelse** | Effektiv caching og kode-splitting |
| **Vedlikeholdbarhet** | Tydelig separasjon av ansvar mellom lag |
| **Utvikleropplevelse** | Rask feedback med HMR og god tooling |

---

## 2. Teknologistabel

### Kjerneteknologier

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND STACK                            │
├─────────────────────────────────────────────────────────────────┤
│  Framework:       React 19.2.0 + TypeScript 5.8                 │
│  Routing:         React Router 7.9.5                            │
│  State:           React Query 5.90.11 + Context API             │
│  Forms:           React Hook Form 7.67.0 + Zod 3.25             │
│  Styling:         Tailwind CSS 4.1 + Punkt Design System        │
│  Build:           Vite 6.2.0                                    │
│  Testing:         Vitest 4.0 + Playwright 1.57                  │
│  PDF:             @react-pdf/renderer 4.3.1                     │
└─────────────────────────────────────────────────────────────────┘
```

### Hovedavhengigheter

| Kategori | Pakke | Versjon | Formål |
|----------|-------|---------|--------|
| **UI Framework** | `react` | 19.2.0 | React-rammeverk med concurrent features |
| **Routing** | `react-router-dom` | 7.9.5 | Klientsidenavigasjon |
| **Server State** | `@tanstack/react-query` | 5.90.11 | Datahenting, caching og synkronisering |
| **Forms** | `react-hook-form` | 7.67.0 | Performant skjemahåndtering |
| **Validering** | `zod` | 3.25.76 | TypeScript-first skjemavalidering |
| **UI Primitiver** | `@radix-ui/react-*` | Latest | Tilgjengelige headless komponenter |
| **Designsystem** | `@oslokommune/punkt-assets` | 13.11.0 | Oslo kommunes designtokens |
| **Datoer** | `date-fns` | 4.1.0 | Datomanipulasjon og formatering |
| **CSS Utilities** | `clsx` | 2.1.1 | Kondisjonelle klassenavn |
| **PDF Generering** | `@react-pdf/renderer` | 4.3.1 | Klientside PDF-generering |

### Dev-avhengigheter

| Pakke | Versjon | Formål |
|-------|---------|--------|
| `vite` | 6.2.0 | Bygge- og utviklingsverktøy |
| `typescript` | 5.8.2 | TypeScript-kompilator |
| `vitest` | 4.0.14 | Enhetstesting |
| `@playwright/test` | 1.57.0 | Ende-til-ende-testing |
| `@tailwindcss/postcss` | 4.1.17 | Tailwind CSS v4 (CSS-first) |
| `eslint` | 9.39.1 | Kode-linting |
| `eslint-plugin-jsx-a11y` | 6.10.2 | Tilgjengelighetslinting |
| `@testing-library/react` | 16.3.0 | React testverktøy |
| `axe-core` | 4.11.0 | Automatisert tilgjengelighetstesting |

---

## 3. Mappestruktur

### Overordnet Struktur

```
src/
├── api/                    # API-klient og datahenting (8 stk)
│   ├── client.ts          # Sentralisert HTTP-klient med auth & CSRF
│   ├── state.ts           # Leseoperasjoner (case state, timeline)
│   ├── events.ts          # Skriveoperasjoner (event submission)
│   ├── endringsordre.ts   # Endringsordre-spesifikke API-kall
│   ├── forsering.ts       # Forsering-spesifikke API-kall
│   ├── analytics.ts       # Analyse-API
│   ├── cases.ts           # Sakshåndtering-API
│   └── utils.ts           # API-hjelpefunksjoner
│
├── components/            # React-komponenter (view layer)
│   ├── actions/           # Modale skjemaer for event-submission (9 stk)
│   ├── alerts/            # Alert-komponenter (TokenExpiredAlert)
│   ├── approval/          # Godkjenningsflyt-komponenter (6 stk)
│   ├── endringsordre/     # Endringsordre-spesifikke komponenter
│   ├── forsering/         # Forsering-spesifikke komponenter
│   ├── pdf/               # PDF-visning (2 stk)
│   ├── primitives/        # Gjenbrukbare UI-byggeklosser (26 stk)
│   ├── views/             # Side-nivå view-komponenter (6 stk)
│   ├── PageHeader.tsx     # Page header-komponent
│   ├── ModeToggle.tsx     # Utviklingsmodus-toggle
│   ├── ThemeToggle.tsx    # Lys/mørk tema-toggle
│   ├── ErrorBoundary.tsx  # Feilhåndtering (fanger React-feil)
│   ├── PageLoadingFallback.tsx  # Loading-fallback for lazy-loading
│   ├── ApprovalRoleSelector.tsx # Rollevalg for godkjenning
│   ├── LoginForm.tsx      # Innloggingsskjema
│   ├── MockToolbar.tsx    # Utviklerverktøy
│   ├── PageStateHelpers.tsx     # Side-state hjelpere
│   └── ProtectedRoute.tsx # Beskyttet rute-wrapper
│
├── context/               # React Context providers (5 stk)
│   ├── AuthContext.tsx    # Magic link-autentisering
│   ├── ThemeContext.tsx   # Lys/mørk tema-håndtering
│   ├── ApprovalContext.tsx     # Godkjenningsflyt state (mock)
│   ├── UserRoleContext.tsx     # Brukerrolle-håndtering
│   └── SupabaseAuthContext.tsx # Supabase auth-integrasjon
│
├── hooks/                 # Egendefinerte React hooks (12 stk)
│   ├── useCaseState.ts    # React Query hook for case state
│   ├── useTimeline.ts     # React Query hook for timeline events
│   ├── useSubmitEvent.ts  # React Query mutation for event submission
│   ├── useActionPermissions.ts  # Beregn tillatte handlinger
│   ├── useUserRole.ts     # Hent brukerrolle (TE/BH)
│   ├── useFormBackup.ts   # Auto-backup skjemadata ved token-utløp
│   ├── useRevisionHistory.ts    # Revisjonshistorikk for vederlag/frist
│   ├── useConfirmClose.ts # Forhindre datatap ved lukking av modaler
│   ├── useApprovalWorkflow.ts  # Godkjenningsflyt-hook
│   ├── useAnalytics.ts    # Analysehook
│   ├── useCaseList.ts     # Saksliste-hook
│   └── useVerifyToken.ts  # Token-verifisering
│
├── pages/                 # Sidekomponenter (9 stk)
│   ├── AuthLanding.tsx    # Auth/innloggingsside
│   ├── ExampleCasesPage.tsx     # Demo-saker for testing
│   ├── CasePage.tsx       # Hovedsakvisning
│   ├── ForseringPage.tsx  # Forsering-sakvisning
│   ├── EndringsordePage.tsx     # Endringsordre-sakvisning
│   ├── ComponentShowcase.tsx    # Designsystem-dokumentasjon
│   ├── SaksoversiktPage.tsx     # Saksliste/oversikt
│   ├── OpprettSakPage.tsx       # Opprett ny sak
│   └── AnalyticsDashboard.tsx   # Analyse-dashboard
│
├── mocks/                 # Mock-data for utvikling
│   ├── cases/             # Mock-saker
│   └── timelines/         # Mock-tidslinjer
│
├── pdf/                   # PDF-generering (klientside)
│   ├── ContractorClaimPdf.tsx   # PDF-maler
│   ├── generator.ts       # PDF-genereringslogikk
│   ├── styles.ts          # PDF-stiler
│   └── index.ts           # Eksporter
│
├── types/                 # TypeScript-typedefinisjoner
│   ├── index.ts           # Sentral eksport
│   ├── api.ts             # API request/response-typer
│   ├── timeline.ts        # State og domenetyper (CloudEvents-format)
│   └── approval.ts        # Godkjenningsflyt-typer
│
├── constants/             # Applikasjonskonstanter (12 stk)
│   ├── categories.ts      # Kategoridefinisjoner
│   ├── statusLabels.ts    # Status-etiketter
│   ├── responseOptions.ts # Svaralternativer
│   ├── varselMetoder.ts   # Varslingsmetoder
│   ├── queryConfig.ts     # React Query-konfigurasjon (STALE_TIME)
│   ├── approvalConfig.ts  # Godkjenningsflyt-konfig (beløpsgrenser, roller)
│   ├── eventTypeLabels.ts # Event-type etiketter
│   ├── fristVarselTypes.ts    # Fristvarsel-typer
│   ├── paymentMethods.ts  # Betalingsmetoder
│   ├── statusStyles.ts    # Status-styling
│   └── varslingsregler.ts # Varslingsregler
│
├── utils/                 # Hjelpefunksjoner (6 stk)
│   ├── preklusjonssjekk.ts      # Fritsberegninger
│   ├── begrunnelseGenerator.ts  # Generer begrunnelser
│   ├── formatters.ts      # Generell formatering
│   ├── dateFormatters.ts  # Datoformatering
│   ├── fileUtils.ts       # Filhåndtering
│   └── mergeDraftsIntoState.ts  # Flette utkast inn i state
│
├── lib/                   # Tredjepartsintegrasjoner
│   └── supabase.ts        # Supabase-klient
│
├── tests/                 # Testfiler (speiler src-struktur)
│   ├── a11y/              # Tilgjengelighetstester
│   ├── api/               # API-klienttester
│   ├── components/        # Komponenttester
│   ├── hooks/             # Hook-tester
│   └── constants/         # Konstanttester
│
├── main.tsx               # React entry point
├── App.tsx                # Hovedrutingkomponent
└── index.css              # Globale stiler (Tailwind v4 CSS-first)
```

### Katalogansvar

| Katalog | Ansvar | Retningslinjer |
|---------|--------|----------------|
| `api/` | HTTP-kommunikasjon | All API-logikk samlet, ingen direkte fetch i komponenter |
| `components/` | UI-rendering | Ren presentasjon, minimal logikk |
| `context/` | Global tilstand | Kun for app-vid tilstand (auth, tema) |
| `hooks/` | Gjenbrukbar logikk | Abstraherer kompleksitet fra komponenter |
| `pages/` | Rute-håndtering | Kobler sammen komponenter og data |
| `types/` | TypeScript-typer | Delt typebibliotek for hele appen |
| `constants/` | Statiske verdier | Enums, labels, konfigurasjoner |
| `utils/` | Rene funksjoner | Ingen side-effekter, lett testbare |

---

## 4. Komponentarkitektur

### Lagdelt Komponenthierarki

```
┌─────────────────────────────────────────────────────────────────┐
│                          PAGES (9 stk)                          │
│        Rute-håndtering, datahenting, sidekomposisjon           │
│   CasePage, ForseringPage, SaksoversiktPage, AnalyticsDash...  │
├─────────────────────────────────────────────────────────────────┤
│                         VIEWS (6 stk)                           │
│          Side-nivå komponenter, business-logikk                │
│   Timeline, CaseDashboard, ComprehensiveMetadata...            │
├─────────────────────────────────────────────────────────────────┤
│                        ACTIONS (9 stk)                          │
│        Modale skjemaer for event-submission                    │
│   SendGrunnlagModal, RespondVederlagModal, ReviseFristModal... │
├─────────────────────────────────────────────────────────────────┤
│                       APPROVAL (6 stk)                          │
│        Godkjenningsflyt for BH-responser                       │
│   ApprovePakkeModal, SendResponsPakkeModal, ApprovalChain...   │
├─────────────────────────────────────────────────────────────────┤
│                      PRIMITIVES (26 stk)                        │
│          Gjenbrukbare UI-byggeklosser, type-sikre              │
│   Button, Input, Modal, Select, DatePicker, Card, Badge...    │
└─────────────────────────────────────────────────────────────────┘
```

### Primitive-komponenter

Plassering: `src/components/primitives/`

| Komponent | Formål | Props |
|-----------|--------|-------|
| `Button` | Primærknapp med varianter | `variant`, `size`, `disabled` |
| `Input` | Tekstinput med validering | `error`, `label`, `required` |
| `Textarea` | Flerlinjet tekstinput | `rows`, `maxLength`, `error` |
| `Select` | Dropdown-valg | `options`, `placeholder`, `error` |
| `DatePicker` | Datovelger | `selected`, `onChange`, `minDate` |
| `RadioGroup` | Radioknapper | `options`, `value`, `onChange` |
| `Checkbox` | Avkrysningsboks | `checked`, `label`, `disabled` |
| `Modal` | Modalt vindu | `open`, `onClose`, `title` |
| `Alert` | Varselmeldinger | `type`, `message`, `dismissible` |
| `Card` | Innholdskort | `title`, `children`, `className` |
| `Badge` | Statusmerke | `variant`, `size`, `children` |
| `Label` | Skjema-label | `htmlFor`, `required`, `children` |
| `FormField` | Wrapper for skjemafelt | `label`, `error`, `children` |
| `Tooltip` | Hover-tooltip | `content`, `side`, `children` |
| `Collapsible` | Sammenleggbar seksjon | `open`, `onToggle`, `title` |
| `AlertDialog` | Bekreftelsesdialog | `open`, `onConfirm`, `onCancel` |
| `StepIndicator` | Stegindikator | `steps`, `currentStep` |
| `DataList` | Definisjonsliste | `items`, `columns` |
| `CurrencyInput` | Beløpinput med formatering | `value`, `onChange`, `currency` |
| `RevisionTag` | Revisjonsmerke | `revision`, `isLatest` |
| `InfoLabel` | Informasjonsetikett | `icon`, `text`, `variant` |
| `DashboardCard` | Dashboard-kort | `title`, `value`, `trend` |
| `Tabs` | Fanenavigasjon | `tabs`, `activeTab`, `onChange` |
| `Toast` | Varslingstoast | `message`, `type`, `duration` |
| `AttachmentUpload` | Filopplasting | `onUpload`, `accept`, `multiple` |
| `SectionContainer` | Seksjonswrapper | `title`, `children`, `collapsible` |

### Komponentmønster

**Eksempel: Button-komponent**

```tsx
// src/components/primitives/Button.tsx
import { forwardRef, ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          // Base-stiler
          'inline-flex items-center justify-center rounded-none',
          'font-medium transition-colors duration-200',
          'border-2',
          // Fokus-stiler
          'focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30',
          // Variant-stiler
          {
            'bg-pkt-surface-strong-dark-blue text-pkt-text-body-light':
              variant === 'primary',
            'bg-transparent text-pkt-text-body-dark border-pkt-border-default':
              variant === 'secondary',
            'bg-transparent border-transparent hover:bg-gray-100':
              variant === 'ghost',
            'bg-pkt-brand-red-1000 text-white border-pkt-brand-red-1000':
              variant === 'danger',
          },
          // Størrelse-stiler
          {
            'px-4 py-2 text-sm min-h-[36px]': size === 'sm',
            'px-6 py-3 text-base min-h-[40px]': size === 'md',
            'px-8 py-4 text-lg min-h-[44px]': size === 'lg',
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

**Nøkkelmønstre:**

- `forwardRef` for DOM-element-tilgang
- Utvider native HTML-attributter (`ComponentPropsWithoutRef`)
- `clsx` for kondisjonelle klassenavn
- Punkt designtokens for farger
- Streng typing av props

### View-komponenter

Plassering: `src/components/views/`

| Komponent | Formål |
|-----------|--------|
| `Timeline` | Viser hendelsestidslinje |
| `TimelineItem` | Enkelt tidslinjeelement |
| `ComprehensiveMetadata` | Detaljert metadata-visning |
| `RevisionHistory` | Revisjonshistorikk for vederlag/frist |
| `EventDetailModal` | Detaljer for enkelt event |

### Action-modaler

Plassering: `src/components/actions/`

**Innsending (TE - Totalentreprenør):**

| Modal | Event-type |
|-------|------------|
| `SendGrunnlagModal` | `grunnlag_opprettet` (create mode) / `grunnlag_oppdatert` (update mode via `originalEvent` prop) |
| `SendVederlagModal` | `vederlag_submit` |
| `SendFristModal` | `frist_submit` |
| `ReviseVederlagModal` | `vederlag_revision` |
| `ReviseFristModal` | `frist_revision` |

**Respons (BH - Byggherre):**

| Modal | Event-type |
|-------|------------|
| `RespondGrunnlagModal` | `respons_grunnlag` (respond mode) / `respons_grunnlag_oppdatert` (update mode via `lastResponseEvent` prop) |
| `RespondVederlagModal` | `vederlag_response` (respond mode) / `respons_vederlag_oppdatert` (update mode via `lastResponseEvent` prop) |
| `RespondFristModal` | `frist_response` (respond mode) / `respons_frist_oppdatert` (update mode via `lastResponseEvent` prop) |

### Approval-komponenter (Godkjenningsflyt)

Plassering: `src/components/approval/`

**Merk:** Per nå kun mock-implementasjon med localStorage.

| Komponent | Formål |
|-----------|--------|
| `ApprovalChainStatus` | Visuell visning av godkjenningskjede |
| `ApprovalHistory` | Tidslinjevisning av godkjenningshandlinger |
| `ApprovalDashboardCard` | Dashboard-kort for pakke-status |
| `ApprovePakkeModal` | Modal for godkjenning/avvisning |
| `SendResponsPakkeModal` | Modal for å sende pakke til godkjenning |
| `PendingApprovalBanner` | Banner for ventende godkjenninger |

**Flyt:** BH samler responser (grunnlag/vederlag/frist) → sender pakke til godkjenning →
hierarkisk godkjenning basert på beløpsgrenser (PL→SL→AL→DU→AD) → godkjent eller avvist.

Se `src/constants/approvalConfig.ts` for beløpsgrenser og `src/context/ApprovalContext.tsx` for state management.

### PDF-komponenter

Plassering: `src/components/pdf/`

| Komponent | Formål |
|-----------|--------|
| `PdfPreview` | Forhåndsvisning av PDF-dokument |
| `PdfPreviewModal` | Modal wrapper for PDF-visning |

---

## 5. State Management

### Arkitekturoversikt

```
┌─────────────────────────────────────────────────────────────────┐
│                      STATE MANAGEMENT                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   CONTEXT API                             │   │
│  │            (Global, synkron tilstand)                     │   │
│  │                                                           │   │
│  │  ┌─────────────────┐    ┌─────────────────┐             │   │
│  │  │  AuthContext    │    │  ThemeContext   │             │   │
│  │  │                 │    │                 │             │   │
│  │  │  • token        │    │  • theme        │             │   │
│  │  │  • sakId        │    │  • resolvedTheme│             │   │
│  │  │  • isVerifying  │    │  • setTheme     │             │   │
│  │  │  • error        │    │                 │             │   │
│  │  └─────────────────┘    └─────────────────┘             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 REACT QUERY (TanStack)                    │   │
│  │            (Server state, asynkron data)                  │   │
│  │                                                           │   │
│  │  ┌─────────────────┐    ┌─────────────────┐             │   │
│  │  │  useCaseState   │    │  useTimeline    │             │   │
│  │  │                 │    │                 │             │   │
│  │  │  GET /state     │    │  GET /timeline  │             │   │
│  │  │  Caching: 30s   │    │  Caching: 30s   │             │   │
│  │  └─────────────────┘    └─────────────────┘             │   │
│  │                                                           │   │
│  │  ┌─────────────────┐    ┌─────────────────┐             │   │
│  │  │ useSubmitEvent  │    │ useHistorikk    │             │   │
│  │  │                 │    │                 │             │   │
│  │  │  POST /events   │    │  GET /historikk │             │   │
│  │  │  Mutation       │    │  Caching: 30s   │             │   │
│  │  └─────────────────┘    └─────────────────┘             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### AuthContext

Plassering: `src/context/AuthContext.tsx`

```tsx
interface AuthContextType {
  token: string | null;      // Magic link JWT-token
  sakId: string | null;      // Aktiv saks-ID
  isVerifying: boolean;      // Token-verifisering pågår
  error: string | null;      // Feilmelding ved auth-feil
}

// Hook for å bruke auth-context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Funksjoner:**

- Magic link-verifisering via URL-parametere
- `sessionStorage`-persistens (XSS-beskyttelse)
- Automatisk token-validering ved app-oppstart
- Mock token-støtte for GitHub Pages-preview

### ThemeContext

Plassering: `src/context/ThemeContext.tsx`

```tsx
type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;              // Brukervalgt tema
  resolvedTheme: 'light' | 'dark';  // Faktisk anvendt tema
  setTheme: (theme: Theme) => void;  // Oppdater tema
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
```

**Funksjoner:**

- Systempreferanse-deteksjon
- `localStorage`-persistens
- Sanntids media query-lytter

### React Query Hooks

**useCaseState** - Hent sakstilstand

```tsx
// src/hooks/useCaseState.ts
export function useCaseState(sakId: string, options?: UseCaseStateOptions) {
  return useQuery<StateResponse, Error>({
    queryKey: ['sak', sakId, 'state'],
    queryFn: () => fetchCaseState(sakId),
    staleTime: 30_000,           // Data er ferskt i 30 sekunder
    refetchOnWindowFocus: true,  // Oppdater ved fokus
    enabled: !!sakId,            // Kun kjør når sakId finnes
  });
}
```

**useTimeline** - Hent hendelseshistorikk

```tsx
// src/hooks/useTimeline.ts
export function useTimeline(sakId: string) {
  return useQuery<TimelineResponse, Error>({
    queryKey: ['sak', sakId, 'timeline'],
    queryFn: () => fetchTimeline(sakId),
    staleTime: 30_000,
  });
}
```

**useSubmitEvent** - Send hendelse

```tsx
// src/hooks/useSubmitEvent.ts
export function useSubmitEvent(sakId: string, options?: UseSubmitEventOptions) {
  const queryClient = useQueryClient();

  return useMutation<EventSubmitResponse, Error, SubmitEventPayload>({
    mutationFn: async ({ eventType, data, catendaTopicId }) => {
      // 1. Valider magic link-token
      // 2. Generer klientside PDF
      // 3. Send event til backend
      return submitEvent(sakId, eventType, data, { ... });
    },
    onSuccess: () => {
      // Invalider cache for å trigge refetch
      queryClient.invalidateQueries({ queryKey: ['sak', sakId, 'state'] });
      queryClient.invalidateQueries({ queryKey: ['sak', sakId, 'timeline'] });
    },
  });
}
```

### React Query-konfigurasjon

Konfigurasjon er sentralisert i `src/constants/queryConfig.ts`:

```tsx
// src/constants/queryConfig.ts
export const STALE_TIME = {
  DEFAULT: 30_000,   // 30 sekunder (standard)
  EXTENDED: 60_000,  // 60 sekunder (relasjonelle queries)
  SHORT: 10_000,     // 10 sekunder (hyppig oppdatering)
} as const;

export const defaultQueryOptions = {
  staleTime: STALE_TIME.DEFAULT,
  refetchOnWindowFocus: false,
  retry: 1,
} as const;
```

```tsx
// src/main.tsx
import { STALE_TIME } from './constants/queryConfig';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: STALE_TIME.DEFAULT,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

Bruk `STALE_TIME.EXTENDED` for relasjonelle queries (forsering/endringsordre) som endres sjeldnere.

---

## 6. Routing

### Ruteoversikt

Alle sider er lazy-loadet med `React.lazy()` for bedre initial lastytelse:

```tsx
// src/App.tsx
import React, { Suspense, lazy } from 'react';
import { PageLoadingFallback } from './components/PageLoadingFallback';

// Lazy-loadede sider (code splitting)
const AuthLanding = lazy(() => import('./pages/AuthLanding'));
const CasePage = lazy(() => import('./pages/CasePage'));
const ForseringPage = lazy(() => import('./pages/ForseringPage'));
const EndringsordePage = lazy(() => import('./pages/EndringsordePage'));
const ExampleCasesPage = lazy(() => import('./pages/ExampleCasesPage'));
const ComponentShowcase = lazy(() => import('./pages/ComponentShowcase'));

const App: React.FC = () => {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        <Route path="/" element={<AuthLanding />} />
        <Route path="/demo" element={<ExampleCasesPage />} />
        <Route path="/saker" element={<SaksoversiktPage />} />
        <Route path="/saker/ny" element={<OpprettSakPage />} />
        <Route path="/saker/:sakId" element={<CasePage />} />
        <Route path="/forsering/:sakId" element={<ForseringPage />} />
        <Route path="/endringsordre/:sakId" element={<EndringsordePage />} />
        <Route path="/analyse" element={<AnalyticsDashboard />} />
        <Route path="/showcase" element={<ComponentShowcase />} />
      </Routes>
    </Suspense>
  );
};
```

### Rutebeskrivelser

| Rute | Komponent | Formål |
|------|-----------|--------|
| `/` | `AuthLanding` | Magic link-verifisering og redirect |
| `/demo` | `ExampleCasesPage` | Demo-saker for testing/utvikling |
| `/saker` | `SaksoversiktPage` | Saksliste/oversikt |
| `/saker/ny` | `OpprettSakPage` | Opprett ny sak |
| `/saker/:sakId` | `CasePage` | Hovedsakvisning med tidslinje |
| `/forsering/:sakId` | `ForseringPage` | Forsering-sakvisning (§33.8) |
| `/endringsordre/:sakId` | `EndringsordePage` | Endringsordre-visning (§31.3) |
| `/analyse` | `AnalyticsDashboard` | Analyse-dashboard |
| `/showcase` | `ComponentShowcase` | Designsystem-dokumentasjon |

### Router-oppsett

```tsx
// src/main.tsx
<BrowserRouter basename={import.meta.env.BASE_URL}>
  <ThemeProvider>
    <AuthProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ErrorBoundary>
    </AuthProvider>
  </ThemeProvider>
</BrowserRouter>
```

`ErrorBoundary` fanger ubehandlede React-feil og viser en brukervennlig feilside med mulighet for å prøve på nytt.

**Base URL-konfigurasjon:**

| Miljø | Base URL | Beskrivelse |
|-------|----------|-------------|
| Utvikling | `/` | Lokal port 3000 |
| Produksjon | `/unified-timeline/` | GitHub Pages subdirectory |

---

## 7. API-integrasjon

### Sentralisert API-klient

Plassering: `src/api/client.ts`

```tsx
// Generisk fetch-wrapper med feilhåndtering
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const headers = new Headers(options?.headers);

  // Legg til auth-token
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Legg til CSRF-token for skriveoperasjoner
  if (options?.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
    const csrfToken = await getCsrfToken();
    headers.set('X-CSRF-Token', csrfToken);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }

  return response.json();
}
```

### API-moduler

| Modul | Fil | Operasjoner |
|-------|-----|-------------|
| **Client** | `api/client.ts` | `apiFetch`, `setAuthToken`, `getAuthToken` |
| **State** | `api/state.ts` | `fetchCaseState`, `fetchTimeline` (CloudEvents-format) |
| **Events** | `api/events.ts` | `submitEvent` |
| **Forsering** | `api/forsering.ts` | `findForseringerForSak` |
| **Endringsordre** | `api/endringsordre.ts` | `findEOerForSak` |

### API-flyt

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Komponent   │────▶│  React Query  │────▶│   API-modul   │
│               │     │  Hook         │     │               │
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │  apiFetch()   │
                                            │  • Auth token │
                                            │  • CSRF token │
                                            │  • Feilhånd.  │
                                            └───────┬───────┘
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │    Backend    │
                                            │  Flask API    │
                                            └───────────────┘
```

### Mock API-støtte

```tsx
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

if (USE_MOCK_API) {
  await mockDelay(300);  // Simuler nettverksforsinkelse
  return getMockStateById(sakId);
} else {
  return apiFetch<StateResponse>(`/api/cases/${sakId}/state`);
}
```

### Miljøvariabler

| Variabel | Standard | Beskrivelse |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8080` | Backend API-endepunkt |
| `VITE_USE_MOCK_API` | `false` | Aktiver mock-data |

---

## 8. Styling og Designsystem

### Tailwind CSS v4 (CSS-first)

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  /* PUNKT MERKEFARER - organisert etter kategori */
  --color-pkt-brand-blue-1000: #6fe9ff;
  --color-pkt-brand-dark-blue-1000: #2a2859;
  --color-pkt-brand-warm-blue-1000: #1f42aa;
  --color-pkt-brand-green-1000: #43f8b6;
  --color-pkt-brand-red-1000: #c9302c;
  --color-pkt-brand-purple-1000: #e0adff;

  /* SEMANTISKE FARGER */
  --color-pkt-bg-card: #ffffff;
  --color-pkt-bg-default: #ffffff;
  --color-pkt-border-default: #2a2859;
  --color-pkt-border-focus: #1f42aa;
  --color-pkt-text-body-dark: #2a2859;
  --color-pkt-text-body-light: #ffffff;

  /* OVERFLATEFARGER */
  --color-pkt-surface-strong-dark-blue: #2a2859;
  --color-pkt-surface-medium-blue: #d4dff7;
  --color-pkt-surface-light-blue: #e9eff9;

  /* STATUSFARGER */
  --color-pkt-status-success: #43f8b6;
  --color-pkt-status-warning: #ffb020;
  --color-pkt-status-error: #c9302c;
  --color-pkt-status-info: #1f42aa;
}
```

### Designprinsipper

| Prinsipp | Implementasjon | Eksempel |
|----------|----------------|----------|
| **Skarpe hjørner** | `rounded-none` | Punkt designsystem-krav |
| **2px kanter** | `border-2` | Tydelig visuell vekt |
| **Semantiske farger** | `pkt-border-focus` | Tokens fremfor hex-verdier |
| **Tilgjengelighet** | WCAG AA | 5.33:1+ kontrast |
| **Lys/mørk tema** | CSS custom properties | Via ThemeContext |

### PostCSS-konfigurasjon

```js
// postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

### Klassenavnbruk

```tsx
import clsx from 'clsx';

className={clsx(
  // Base layout
  'inline-flex items-center justify-center',
  'font-medium transition-colors duration-200',

  // Punkt-stiler
  'rounded-none border-2 border-pkt-border-default',

  // Fokus-stiler (tilgjengelighet)
  'focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30',

  // Kondisjonelle stiler
  {
    'bg-pkt-surface-strong-dark-blue text-pkt-text-body-light': isPrimary,
    'bg-transparent text-pkt-text-body-dark': isSecondary,
  },

  // Ekstern className
  className
)}
```

---

## 9. TypeScript-konfigurasjon

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],

    // Streng modus for sikkerhet
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,

    // React 19 automatisk JSX
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "isolatedModules": true,

    // Sti-alias
    "paths": {
      "@/*": ["./*"]
    },
  }
}
```

### Strenge Regler

| Regel | Beskrivelse |
|-------|-------------|
| `strict: true` | Aktiverer alle strenge sjekker |
| `noUncheckedIndexedAccess` | Krever undefined-sjekk for array/objekt-tilgang |
| `noImplicitReturns` | Alle kodestier må returnere verdi |
| `noFallthroughCasesInSwitch` | Krever break i switch-cases |

### Type-organisering

```
src/types/
├── index.ts           # Re-eksporterer alle typer
├── api.ts             # API request/response-typer
└── timeline.ts        # Domenetyper (CloudEvent, SakState, etc.)
```

---

## 10. Build og Utviklingsmiljø

### Vite-konfigurasjon

```tsx
// vite.config.ts
export default defineConfig(({ mode }) => {
  return {
    base: mode === 'production' ? '/unified-timeline/' : '/',

    server: {
      port: 3000,
      host: '0.0.0.0',
      watch: {
        ignored: ['**/backend/**', '**/koe_data/**', '**/.git/**'],
      },
    },

    plugins: [
      react(),                    // React Fast Refresh
      viteStaticCopy({            // Kopier Punkt-fonter
        targets: [
          {
            src: 'node_modules/@oslokommune/punkt-assets/dist/fonts/*.woff2',
            dest: 'fonts'
          },
        ]
      }),
      license({...}),             // Tredjepartslisenser
    ],

    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-pdf': ['react-pdf', 'pdfjs-dist', '@react-pdf/renderer'],
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
  };
});
```

### Kode-splitting

| Chunk | Innhold | Størrelse |
|-------|---------|-----------|
| `vendor-react` | React, ReactDOM, Router | ~150KB |
| `vendor-pdf` | PDF-biblioteker (lazy-loadet) | ~500KB |
| `main` | Applikasjonskode | ~200KB |
| Side-chunks | Lazy-loadede sider | ~10-50KB hver |

**Lazy loading av PDF:**

PDF-biblioteker lastes dynamisk kun når de trengs:

```tsx
// Dynamisk import i useSubmitEvent.ts og CasePage.tsx
const { generateContractorClaimPdf, blobToBase64 } = await import('../pdf/generator');

// PDF-download
const { downloadContractorClaimPdf } = await import('../pdf/generator');
downloadContractorClaimPdf(state);
```

Dette reduserer initial bundle fra ~985KB til ~443KB (55% reduksjon).

### NPM-scripts

```json
{
  "dev": "vite",                      // Utviklingsserver
  "build": "vite build",              // Produksjonsbygg
  "preview": "vite preview",          // Forhåndsvis bygg lokalt
  "test": "vitest",                   // Enhetstester
  "test:ui": "vitest --ui",           // Test UI-dashboard
  "test:coverage": "vitest --coverage", // Dekningsrapport
  "test:a11y": "vitest --run src/tests/a11y", // Tilgjengelighetstester
  "test:e2e": "playwright test",      // E2E-tester
  "lint": "eslint . --ext .ts,.tsx",  // Linting
  "lint:fix": "eslint . --ext .ts,.tsx --fix" // Auto-fiks
}
```

---

## 11. Testing

### Testverktøy

| Verktøy | Formål |
|---------|--------|
| **Vitest** | Enhetstesting og integrasjonstesting |
| **Testing Library** | React-komponenttesting |
| **Playwright** | Ende-til-ende-testing |
| **axe-core** | Automatisert tilgjengelighetstesting |

### Vitest-konfigurasjon

```tsx
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,                     // Globale testfunksjoner
    environment: 'jsdom',              // Nettleser-lignende miljø
    setupFiles: './__tests__/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    testTimeout: 10000,
  },
});
```

### Teststruktur

```
src/tests/
├── a11y/                  # Tilgjengelighetstester
│   └── primitives.test.tsx
├── api/                   # API-klienttester
│   └── client.test.ts
├── components/            # Komponenttester
│   ├── primitives/
│   └── views/
├── hooks/                 # Hook-tester
│   └── useCaseState.test.ts
└── constants/             # Konstanttester
    └── categories.test.ts
```

### Eksempel: Komponenttest

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/src/components/primitives/Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

---

## 12. Tilgjengelighet (a11y)

### WCAG 2.1 Level AA

Applikasjonen følger WCAG 2.1 Level AA-standarden gjennom:

| Kategori | Implementasjon |
|----------|----------------|
| **Semantisk HTML** | `<label>`, `<form>`, `<nav>`, `<main>` |
| **ARIA-attributter** | `role`, `aria-label`, `aria-live` |
| **Tastaturnavigasjon** | Alle interaktive elementer er tilgjengelige via tastatur |
| **Fargekontrast** | Minimum 4.5:1 for normal tekst |
| **Fokusindikatorer** | Synlige fokusringer på alle interaktive elementer |

### ESLint A11y-regler

```js
// eslint.config.js
rules: {
  'jsx-a11y/alt-text': 'error',
  'jsx-a11y/anchor-has-content': 'error',
  'jsx-a11y/aria-props': 'error',
  'jsx-a11y/aria-role': 'error',
  'jsx-a11y/aria-unsupported-elements': 'error',
  'jsx-a11y/click-events-have-key-events': 'error',
  'jsx-a11y/heading-has-content': 'error',
  'jsx-a11y/label-has-associated-control': 'error',
  'jsx-a11y/no-autofocus': 'warn',
  'jsx-a11y/no-noninteractive-element-interactions': 'error',
  'jsx-a11y/role-has-required-aria-props': 'error',
  // ... 30+ tilgjengelighetsregler
}
```

### Tilgjengelighetsbiblioteker

| Bibliotek | Formål |
|-----------|--------|
| `@radix-ui/react-*` | Tilgjengelige headless UI-komponenter |
| `eslint-plugin-jsx-a11y` | Statisk tilgjengelighetslinting |
| `axe-core` | Kjøretids-tilgjengelighetstesting |

---

## 13. Best Practices

### Komponent-retningslinjer

| Retningslinje | Beskrivelse |
|---------------|-------------|
| **Enkelt ansvar** | Hver komponent har én hovedoppgave |
| **Props over state** | Foretrekk props for konfigurerbarhet |
| **Komposisjon** | Bygg opp fra primitiver til views |
| **Type-sikkerhet** | Alle props skal ha TypeScript-typer |
| **Testbarhet** | Komponenter skal være enkle å teste |

### Tilstandshåndtering

| Regel | Beskrivelse |
|-------|-------------|
| **Server state i React Query** | All API-data håndteres via React Query |
| **Global state i Context** | Kun for app-vid tilstand (auth, tema) |
| **Lokal state i useState** | For komponent-spesifikk tilstand |
| **Form state i React Hook Form** | All skjemahåndtering |

### API-integrasjon

| Regel | Beskrivelse |
|-------|-------------|
| **Sentralisert klient** | All API-kommunikasjon via `apiFetch` |
| **Feilhåndtering** | Konsekvent feilhåndtering med `ApiError` |
| **Type-sikkerhet** | Zod-validering av API-responser |
| **Caching** | React Query for automatisk caching |

### Styling

| Regel | Beskrivelse |
|-------|-------------|
| **Tailwind-klasser** | Bruk utility-klasser fremfor custom CSS |
| **Punkt-tokens** | Bruk designtokens fremfor hardkodede verdier |
| **clsx** | Bruk `clsx` for kondisjonelle klasser |
| **Konsistens** | Følg eksisterende mønstre i kodebasen |

---

## Filreferanser

| Aspekt | Nøkkelfiler |
|--------|-------------|
| **Entry Point** | `src/main.tsx` |
| **Routing** | `src/App.tsx` |
| **API-klient** | `src/api/client.ts` |
| **Auth** | `src/context/AuthContext.tsx` |
| **Tema** | `src/context/ThemeContext.tsx` |
| **ErrorBoundary** | `src/components/ErrorBoundary.tsx` |
| **PageLoadingFallback** | `src/components/PageLoadingFallback.tsx` |
| **Query Config** | `src/constants/queryConfig.ts` |
| **Primitiver** | `src/components/primitives/` (23 komponenter) |
| **Views** | `src/components/views/` (8 komponenter) |
| **Actions** | `src/components/actions/` (12 modaler) |
| **Hooks** | `src/hooks/` (8 egendefinerte hooks) |
| **Typer** | `src/types/` |
| **Styling** | `src/index.css` |
| **Vite-konfig** | `vite.config.ts` |
| **ESLint** | `eslint.config.js` |
| **TypeScript** | `tsconfig.json` |
| **Tester** | `src/tests/` |

---

## Oppsummering

Frontend-arkitekturen i Unified Timeline er bygget på moderne prinsipper:

1. **Event Sourcing-integrasjon** - Frontend konsumerer state beregnet fra events
2. **Type-sikkerhet** - Streng TypeScript + Zod-validering
3. **Tilgjengelighet** - WCAG 2.1 AA-kompatibilitet
4. **Separasjon av ansvar** - Klare lag (API, state, komponenter, sider)
5. **Utvikleropplevelse** - Rask feedback, god tooling, tydelige mønstre
6. **Ytelse** - React Query-caching, lazy loading av sider og PDF (~55% bundle-reduksjon)
7. **Robusthet** - ErrorBoundary for graceful feilhåndtering
8. **Konsistent styling** - Tailwind v4 + Punkt designtokens
9. **Testklart** - Vitest + Playwright for enhets- og E2E-tester
