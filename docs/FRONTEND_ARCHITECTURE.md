# Frontend-arkitektur

Oversikt over frontend-arkitekturen i Skjema Endringsmeldinger.

**Sist oppdatert:** 2025-12-06

---

## Innhold

- [Oversikt](#oversikt)
- [Mappestruktur](#mappestruktur)
- [Datamodell](#datamodell)
- [Komponenthierarki](#komponenthierarki)
- [Custom Hooks](#custom-hooks)
- [Services](#services)
- [State Management](#state-management)
- [Arbeidsflyt](#arbeidsflyt)
- [PDF-generering](#pdf-generering)
- [Testing](#testing)

---

## Oversikt

Frontend er bygget med:

| Teknologi | Formål |
|-----------|--------|
| React 19 | UI-rammeverk |
| TypeScript | Typesikkerhet |
| Vite | Bygging og utviklingsserver |
| Oslo kommunes Punkt | Designsystem (UI-komponenter) |
| Tailwind CSS | Utility-first styling |
| Vitest | Testing |

### Arkitekturprinsipper

1. **Event Sourcing-integrasjon** – Frontend sender events, mottar projisert state
2. **Optimistisk låsing** – Versjonsnummer for samtidighetskontroll
3. **Tre-spor modell** – Grunnlag, Vederlag, Frist som uavhengige komponenter
4. **Komponentbasert** – Gjenbrukbare UI-komponenter
5. **Hook-basert state** – Custom hooks for logikk-separering
6. **Typesikkerhet** – Streng TypeScript med typer som speiler backend

### Refaktoreringsresultat

| Før | Etter | Reduksjon |
|-----|-------|-----------|
| App.tsx: 528 linjer | App.tsx: 344 linjer | **35%** |
| Monolittisk | Modulær med layout-komponenter | Vedlikeholdbar |

---

## Mappestruktur

```
/
├── App.tsx                         # Hovedkomponent (344 linjer)
├── index.tsx                       # Entry point
├── types.ts                        # TypeScript-definisjoner
├── index.css                       # Global CSS
│
├── components/
│   ├── layout/                     # Layout-komponenter (NY)
│   │   ├── AppLayout.tsx           # Hovedlayout wrapper
│   │   ├── AppHeader.tsx           # Header med Oslo kommune logo
│   │   ├── TabNavigation.tsx       # Fane-navigasjon
│   │   ├── BottomBar.tsx           # Bunnseksjon med handlinger
│   │   └── InfoBanner.tsx          # Informasjonsbanner
│   │
│   ├── panels/                     # Hovedpaneler (steg i arbeidsflyten)
│   │   ├── VarselPanel.tsx         # Steg 1: Varsel om endringsforhold (14446 linjer)
│   │   ├── KravKoePanel.tsx        # Steg 2: Krav om endringsordre (21306 linjer)
│   │   ├── BhSvarPanel.tsx         # Steg 3: Byggherre-svar (18057 linjer)
│   │   └── TestOversiktPanel.tsx   # Saksoversikt for sluttbrukere
│   │
│   └── ui/                         # Gjenbrukbare UI-komponenter
│       ├── Field.tsx               # Skjema-felt wrapper
│       ├── FieldsetCard.tsx        # Gruppering av felt
│       ├── DatePicker.tsx          # Datovelger
│       ├── FileUploadField.tsx     # Filopplasting
│       ├── Toast.tsx               # Notifikasjoner
│       ├── ConfirmDialog.tsx       # Bekreftelsesdialog
│       ├── ErrorBoundary.tsx       # Feilhåndtering
│       ├── PDFPreviewModal.tsx     # PDF-forhåndsvisning
│       ├── BegrunnelseModal.tsx    # Begrunnelse for beslutning
│       ├── SidePanel.tsx           # Sidepanel for saksinfo
│       ├── PanelLayout.tsx         # Layout for paneler
│       └── icons.tsx               # SVG-ikoner
│
├── hooks/                          # Custom React hooks (10 stk)
│   ├── useApiConnection.ts         # API-tilkoblingsstatus
│   ├── useAutoSave.ts              # Auto-lagring til localStorage
│   ├── useCaseLoader.ts            # Laste sak fra API
│   ├── useEmailValidation.ts       # E-postvalidering mot Catenda
│   ├── useFileUpload.ts            # Filopplastingslogikk
│   ├── useFormSubmission.ts        # Håndtere innsending
│   ├── useHandleInputChange.ts     # Input-håndtering helper
│   ├── useModal.ts                 # Modal state management (NY)
│   ├── useSkjemaData.ts            # Form data state management
│   └── useUrlParams.ts             # URL-parameter parsing
│
├── services/                       # API og forretningslogikk
│   ├── api.ts                      # API-klient (552 linjer)
│   ├── validationService.ts        # Skjemavalidering (5560 bytes)
│   ├── submissionService.ts        # Innsendingslogikk (4100 bytes)
│   └── revisionService.ts          # Revisjonshåndtering (NY)
│
├── utils/                          # Hjelpefunksjoner
│   ├── pdf/                        # PDF-generering
│   │   └── pdfComponents.tsx       # PDF-komponenter (697 linjer)
│   ├── pdfGeneratorReact.tsx       # PDF generator wrapper (23 linjer)
│   ├── pdfLabels.ts                # PDF-etiketter
│   ├── generatedConstants.ts       # Auto-genererte statuskoder
│   ├── statusHelpers.ts            # Status-hjelpefunksjoner
│   ├── modusHelpers.ts             # Modus/rolle-hjelpere
│   ├── compareRevisions.ts         # Sammenligning av revisjoner
│   ├── logger.ts                   # Logging
│   ├── toastHelpers.ts             # Toast-hjelpere
│   └── focusHelpers.ts             # Fokus-håndtering
│
├── config/                         # Konfigurasjon
│   └── index.ts                    # Tabs, initial data, demo data
│
├── context/                        # React Context (hvis brukt)
│
└── __tests__/                      # Tester (95 tester)
    ├── setup.ts                    # Test-konfigurasjon
    ├── setup.test.ts               # Setup-tester
    ├── services/
    │   ├── validationService.test.ts
    │   └── submissionService.test.ts
    ├── hooks/
    │   ├── useApiConnection.test.ts
    │   ├── useCaseLoader.test.ts
    │   ├── useEmailValidation.test.ts
    │   ├── useFormSubmission.test.ts
    │   └── useUrlParams.test.ts
    └── components/
```

---

## Datamodell (Event Sourcing)

Frontend-typene er definert i `src/types/timeline.ts` og speiler backend-modellene nøyaktig.

### Event-typer

```typescript
// Event-typer som kan sendes til backend (lowercase verdier)
enum EventType {
  // Grunnlag (TE)
  GRUNNLAG_OPPRETTET = "grunnlag_opprettet",
  GRUNNLAG_OPPDATERT = "grunnlag_oppdatert",
  GRUNNLAG_TRUKKET = "grunnlag_trukket",

  // Vederlag (TE)
  VEDERLAG_KRAV_SENDT = "vederlag_krav_sendt",
  VEDERLAG_KRAV_OPPDATERT = "vederlag_krav_oppdatert",
  VEDERLAG_KRAV_TRUKKET = "vederlag_krav_trukket",

  // Frist (TE)
  FRIST_KRAV_SENDT = "frist_krav_sendt",
  FRIST_KRAV_OPPDATERT = "frist_krav_oppdatert",
  FRIST_KRAV_TRUKKET = "frist_krav_trukket",

  // Respons (BH)
  RESPONS_GRUNNLAG = "respons_grunnlag",
  RESPONS_VEDERLAG = "respons_vederlag",
  RESPONS_FRIST = "respons_frist",

  // Sak-hendelser
  SAK_OPPRETTET = "sak_opprettet",
  SAK_LUKKET = "sak_lukket",
  EO_UTSTEDT = "eo_utstedt"
}
```

### SakState (Read Model)

```typescript
// Projisert tilstand fra events - aldri direkte mutert
interface SakState {
  sak_id: string;
  sakstittel: string;

  // Tre uavhengige spor
  grunnlag: GrunnlagTilstand;
  vederlag: VederlagTilstand;
  frist: FristTilstand;

  // Beregnede felter
  overordnet_status: OverordnetStatus;
  kan_utstede_eo: boolean;
  neste_handling: NesteHandling | null;
}

interface GrunnlagTilstand {
  status: SporStatus;
  hovedkategori: string | null;
  underkategori: string[] | null;
  beskrivelse: string | null;
  bh_resultat: GrunnlagResponsResultat | null;
  laast: boolean;
}

interface VederlagTilstand {
  status: SporStatus;
  krevd_belop: number | null;
  metode: VederlagMetode | null;
  // Port 1: Varsel-vurdering
  saerskilt_varsel_rigg_drift_ok: boolean | null;
  varsel_justert_ep_ok: boolean | null;
  // Port 2: Beregning
  bh_resultat: VederlagBeregningResultat | null;
  godkjent_belop: number | null;
}

interface FristTilstand {
  status: SporStatus;
  krevd_dager: number | null;
  // Port 1: Varsel
  noytralt_varsel_ok: boolean | null;
  // Port 2: Vilkår
  vilkar_oppfylt: boolean | null;
  // Port 3: Utmåling
  bh_resultat: FristBeregningResultat | null;
  godkjent_dager: number | null;
}
```

### Spor-status

```typescript
enum SporStatus {
  IKKE_PAABEGYNT = "IKKE_PAABEGYNT",
  UTKAST = "UTKAST",
  SENDT = "SENDT",
  UNDER_BEHANDLING = "UNDER_BEHANDLING",
  GODKJENT = "GODKJENT",
  DELVIS_GODKJENT = "DELVIS_GODKJENT",
  AVVIST = "AVVIST",
  TRUKKET = "TRUKKET",
  LAAST = "LAAST"
}
```

---

## Komponenthierarki

```
App.tsx (344 linjer)
│
├── AppLayout                       # Layout wrapper (NY)
│   ├── AppHeader                   # Oslo kommune header (NY)
│   ├── TabNavigation               # Fane-navigasjon (NY)
│   │   ├── Varsel                  # Tab 0
│   │   ├── Krav (KOE)              # Tab 1
│   │   ├── Svar                    # Tab 2
│   │   └── Saksoversikt            # Tab 3
│   │
│   └── BottomBar                   # Handlingsknapper (NY)
│
├── <Suspense>                      # Lazy loading wrapper
│   ├── VarselPanel                 # Steg 1: Varsel
│   ├── KravKoePanel                # Steg 2: Krav (KOE)
│   ├── BhSvarPanel                 # Steg 3: BH Svar
│   └── TestOversiktPanel           # Steg 4: Saksoversikt
│
├── SidePanel                       # Saksinfo sidebar
├── ConfirmDialog                   # Bekreftelser
├── PDFPreviewModal                 # PDF-forhåndsvisning
└── Toast                           # Notifikasjoner
```

### Layout-komponenter (NY)

| Komponent | Fil | Ansvar |
|-----------|-----|--------|
| `AppLayout` | AppLayout.tsx | Hovedlayout med header, tabs, content, footer |
| `AppHeader` | AppHeader.tsx | Oslo kommune logo og tittel |
| `TabNavigation` | TabNavigation.tsx | Fane-bytte mellom steg |
| `BottomBar` | BottomBar.tsx | Handlingsknapper (Send, Lagre, etc.) |
| `InfoBanner` | InfoBanner.tsx | Informasjonsbanner øverst |

### Panel-komponenter

Hvert panel følger samme mønster:

```typescript
interface PanelProps {
  formData: FormDataModel;
  handleInputChange: (section, field, value, index?) => void;
  onSubmit: () => void;
  errors: Record<string, string>;
  isDisabled?: boolean;
}
```

| Panel | Ansvar | Linjer |
|-------|--------|--------|
| `VarselPanel` | Varsel om endringsforhold (entreprenør) | 14446 |
| `KravKoePanel` | Krav om vederlag/frist (entreprenør) | 21306 |
| `BhSvarPanel` | Svar på krav (byggherre) | 18057 |
| `TestOversiktPanel` | Saksoversikt - viser hele sakens data i strukturert format | 22541 |

### UI-komponenter

| Komponent | Formål |
|-----------|--------|
| `Field` | Wrapper for skjemafelt med label og feil |
| `FieldsetCard` | Gruppering av relaterte felt |
| `DatePicker` | Datovelger med kalender |
| `FileUploadField` | Filopplasting med forhåndsvisning |
| `Toast` | Midlertidig melding (auto-skjuler) |
| `ConfirmDialog` | Modal for bekreftelse |
| `ErrorBoundary` | Fanger og viser feil |
| `PDFPreviewModal` | Forhåndsvisning av PDF før innsending |

---

## Custom Hooks

### Oversikt (10 hooks)

| Hook | Fil | Bytes | Ansvar |
|------|-----|-------|--------|
| `useApiConnection` | useApiConnection.ts | 1596 | API-tilkoblingsstatus |
| `useAutoSave` | useAutoSave.ts | 4456 | Auto-lagring til localStorage |
| `useCaseLoader` | useCaseLoader.ts | 7736 | Laste sak fra API |
| `useEmailValidation` | useEmailValidation.ts | 4355 | E-postvalidering mot Catenda |
| `useFileUpload` | useFileUpload.ts | 1558 | Filopplastingslogikk |
| `useFormSubmission` | useFormSubmission.ts | 6306 | Håndtere innsending |
| `useHandleInputChange` | useHandleInputChange.ts | 3236 | Input-håndtering helper |
| `useModal` | useModal.ts | 1601 | Modal state management |
| `useSkjemaData` | useSkjemaData.ts | 3553 | Form data state |
| `useUrlParams` | useUrlParams.ts | 2663 | URL-parameter parsing |

### `useSkjemaData`

Håndterer kompleks nestede oppdateringer i form data.

```typescript
const { formData, setFormData, handleInputChange, errors, setErrors } = useSkjemaData(initialData);

// Oppdater enkel verdi
handleInputChange('varsel', 'beskrivelse', 'Ny beskrivelse');

// Oppdater nestet verdi
handleInputChange('koe_revisjoner', 'vederlag.krav_vederlag_belop', '150000', 0);
```

**Funksjonalitet:**
- Håndterer enkle felt (`sak.prosjekt_navn`)
- Håndterer nestede felt (`vederlag.krav_vederlag_belop`)
- Håndterer array-revisjoner med indeks
- Automatisk fjerning av feil når felt oppdateres

### `useAutoSave`

Auto-lagrer form data til localStorage med debouncing.

```typescript
const loadedData = useAutoSave({
  data: formData,
  storageKey: 'koe_v5_0_draft',
  debounceMs: 1500,
  onSave: () => showToast('Utkast lagret')
});
```

### `useCaseLoader`

Laster saksdata fra API basert på sakId eller magicToken.

```typescript
const { isLoading, error, loadCase } = useCaseLoader({
  onSuccess: (data) => setFormData(data.formData),
  onError: (err) => setApiError(err.message)
});
```

### `useFormSubmission`

Håndterer innsendingslogikk med validering og API-kall.

```typescript
const { submitVarsel, submitKoe, submitSvar } = useFormSubmission({
  formData,
  sakId,
  topicGuid,
  onSuccess: (nextMode) => setActiveTab(getTabIndex(nextMode)),
  onError: (err) => setErrors(err.validationErrors)
});
```

### `useModal` (NY)

Modal state management for dialogs.

```typescript
const { isOpen, openModal, closeModal, modalData } = useModal();
```

### `useHandleInputChange`

Helper hook for input-håndtering med validering.

```typescript
const handleChange = useHandleInputChange({
  setFormData,
  clearErrors: true
});
```

### `useApiConnection`

Sjekker API-tilkobling via helsesjekk.

```typescript
const { isApiConnected } = useApiConnection();
```

### `useUrlParams`

Parser URL-parametre for magic links og direkte tilgang.

```typescript
const {
  magicToken,
  sakId,
  modus,
  topicGuid,
  isFromMagicLink
} = useUrlParams();
```

### `useEmailValidation`

Validerer e-postadresse mot Catenda-prosjekt.

```typescript
const { validateEmail, isValidating, validationResult } = useEmailValidation();

await validateEmail('bruker@firma.no', sakId);
// → { success: true, name: 'Ola Nordmann' }
```

### `useFileUpload`

Håndterer filopplasting med preview.

```typescript
const { uploadFile, uploadProgress, uploadedFiles } = useFileUpload({
  maxSize: 10 * 1024 * 1024, // 10 MB
  allowedTypes: ['pdf', 'jpg', 'png']
});
```

---

## Services

### `api/events.ts` (Event Submission)

API-klient for event sourcing-basert backend-kommunikasjon.

```typescript
// Event submission med optimistisk låsing
submitEvent(
  sakId: string,
  eventType: EventType,
  data: Record<string, any>,
  options?: {
    expectedVersion?: number;      // For optimistisk låsing
    catendaTopicId?: string;       // For Catenda-integrasjon
    pdfBase64?: string;            // PDF-vedlegg
    pdfFilename?: string;
  }
): Promise<EventSubmitResponse>

interface EventSubmitResponse {
  success: boolean;
  event_id: string;
  new_version: number;            // Ny versjon etter event
  state: SakState;                // Oppdatert projisert tilstand
}

// Hent beregnet tilstand
getState(sakId: string): Promise<StateResponse>

interface StateResponse {
  state: SakState;
  version: number;
  events_count: number;
}

// Hent tidslinje for visning
getTimeline(sakId: string): Promise<TimelineEvent[]>
```

### Optimistisk låsing-flyt

```typescript
// 1. Hent nåværende state og versjon
const { state, version } = await getState(sakId);

// 2. Bruker fyller ut skjema basert på state

// 3. Send event med forventet versjon
try {
  const response = await submitEvent(sakId, EventType.GRUNNLAG_OPPRETTET, data, {
    expectedVersion: version
  });
  // Oppdater lokal state med response.state
} catch (error) {
  if (error.status === 409) {
    // Konflikt: Noen andre har oppdatert saken
    const newState = await getState(sakId);
    // Vis bruker endringene og la dem bekrefte
  }
}
```

### `validationService.ts`

Skjemavalidering før innsending.

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

validationService.validateVarsel(formData): ValidationResult
validationService.validateKoe(formData): ValidationResult
validationService.validateSvar(formData): ValidationResult
```

### `submissionService.ts`

Orkestrerer innsendingsprosessen.

```typescript
// Koordinerer validering → PDF-generering → API-kall → Catenda-oppdatering
submissionService.submitVarselWithPdf(params): Promise<SubmissionResult>
submissionService.submitKoeWithPdf(params): Promise<SubmissionResult>
submissionService.submitSvarWithPdf(params): Promise<SubmissionResult>
```

### `revisionService.ts` (NY)

Håndterer revisjonslogikk for KOE og BH-svar.

```typescript
revisionService.createNewRevision(formData): KoeRevisjon
revisionService.getLatestRevision(revisions): KoeRevisjon | null
revisionService.compareRevisions(rev1, rev2): RevisionDiff
```

---

## State Management (Event Sourcing)

Frontend bruker **React hooks** for state management, med state som kommer fra backend-projeksjon.

### State-prinsipper

1. **SakState er read-only** – Aldri direkte mutert, alltid projisert fra events
2. **Versjonssporing** – Hver state har et versjonsnummer for optimistisk låsing
3. **Tre-spor uavhengighet** – Grunnlag, Vederlag, Frist kan oppdateres uavhengig

### State-typer

| State | Kilde | Beskrivelse |
|-------|-------|-------------|
| `SakState` | Backend (projeksjon) | Beregnet tilstand fra events |
| `version` | Backend | Versjonsnummer for optimistisk låsing |
| Form draft | `useState` / localStorage | Lokalt utkast før event sendes |
| UI state | `useState` | Komponent-lokal (dialogs, loading, etc.) |

### Data-flyt

```
URL params (magicToken/sakId)
        │
        ▼
    getState(sakId)  ◄─────────────────────┐
        │                                  │
        ▼                                  │
    SakState + version                     │
        │                                  │
        ├──▶ Panel-komponenter (props)     │
        │                                  │
        └──▶ Bruker fyller ut skjema       │
                    │                      │
                    ▼                      │
            submitEvent(eventType, data,   │
                       expectedVersion)    │
                    │                      │
                    ▼                      │
            Backend validerer + persisterer│
                    │                      │
                    └──────────────────────┘
                    (ny state returneres)
```

### Props drilling

FormData og handleInputChange sendes nedover via props:

```typescript
<VarselPanel
  formData={formData}
  handleInputChange={handleInputChange}
  onSubmit={handleVarselSubmit}
  errors={errors}
/>
```

---

## Arbeidsflyt

### 1. Oppstart

```
URL med magicToken
      │
      ▼
useUrlParams() → token
      │
      ▼
api.verifyMagicLink(token) → sakId
      │
      ▼
api.getCase(sakId) → formData
      │
      ▼
setFormData(formData)
      │
      ▼
Vis panel basert på modus/status
```

### 2. Utfylling

```
Bruker fyller ut felt
      │
      ▼
handleInputChange(section, field, value)
      │
      ▼
setFormData (immutable update)
      │
      ▼
useAutoSave → localStorage (1.5s debounce)
      │
      ▼
api.saveDraft → backend (ved behov)
```

### 3. Innsending

```
Klikk "Send"
      │
      ▼
validationService.validate(formData)
      │
      ├── Feil? → setErrors() → vis feilmeldinger
      │
      └── OK? → fortsett
              │
              ▼
      generatePdfBlob(formData)
              │
              ▼
      Vis PDFPreviewModal
              │
              ▼
      Bekreft → api.submit + api.uploadPdf
              │
              ▼
      Catenda kommentar + magicLink generert
              │
              ▼
      Neste steg (endre activeTab)
```

---

## PDF-generering

PDF genereres med `@react-pdf/renderer` i `utils/pdf/`.

### Filstruktur

```
utils/
├── pdf/
│   └── pdfComponents.tsx     # PDF React-komponenter (697 linjer)
├── pdfGeneratorReact.tsx     # Entry point / wrapper (23 linjer)
└── pdfLabels.ts              # Tekst-etiketter for PDF
```

### Hovedfunksjoner

```typescript
// Generer PDF som React-komponent (for preview)
generatePdfReact(formData, options): JSX.Element

// Generer PDF som Blob (for opplasting)
generatePdfBlob(formData, options): Promise<Blob>
```

### PDF-innhold

- **Header** – Oslo kommune logo, dokumenttittel
- **Saksinformasjon** – ID, prosjekt, parter
- **Varsel** – Dato, kategori, beskrivelse
- **KOE** – Vederlagskrav, fristforlengelse, revisjoner
- **BH Svar** – Beslutning, begrunnelse
- **Footer** – Sidetall, dato

### Styling

PDF bruker Oslo kommunes designprofil:
- Primærfarge: `#2A2859` (mørkeblå)
- Font: Oslo Sans (fallback: Helvetica)
- Layout: A4-format

---

## Testing

### Test-status (2025-12-08)

- **95 tester** passerer (frontend)
- **8 testfiler**
- Kjøretid: ~14.5 sekunder

### Testrammeverk

- **Vitest** – Testrunner
- **React Testing Library** – Komponenttesting
- **jsdom** – DOM-simulering

### Kjøre tester

```bash
npm test                 # Kjør alle tester
npm run test:ui          # Vitest UI
npm run test:coverage    # Coverage-rapport
```

### Teststruktur

```
__tests__/
├── setup.ts                        # Test-konfigurasjon
├── setup.test.ts                   # Setup-verifisering
├── services/
│   ├── validationService.test.ts   # Validering
│   └── submissionService.test.ts   # Innsending
├── hooks/
│   ├── useApiConnection.test.ts
│   ├── useCaseLoader.test.ts
│   ├── useEmailValidation.test.ts
│   ├── useFormSubmission.test.ts
│   └── useUrlParams.test.ts
└── components/
    └── (UI-komponent tester)
```

### Eksempel: Test custom hook

```typescript
import { renderHook, act } from '@testing-library/react';
import { useSkjemaData } from '../hooks/useSkjemaData';

describe('useSkjemaData', () => {
  it('should update nested field correctly', () => {
    const { result } = renderHook(() =>
      useSkjemaData(INITIAL_FORM_DATA)
    );

    act(() => {
      result.current.handleInputChange(
        'koe_revisjoner',
        'vederlag.krav_vederlag_belop',
        '150000',
        0
      );
    });

    expect(result.current.formData.koe_revisjoner[0].vederlag.krav_vederlag_belop)
      .toBe('150000');
  });
});
```

---

## Konfigurasjon

### Miljøvariabler

Fil: `.env.local`

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

### Tabs-konfigurasjon

Fil: `config/index.ts`

```typescript
export const TABS = [
  { label: 'Varsel', modus: 'varsel' },
  { label: 'Krav', modus: 'koe' },
  { label: 'Svar', modus: 'svar' },
  { label: 'Test-oversikt', modus: 'test', devOnly: true }
];
```

### Initial Form Data

```typescript
export const INITIAL_FORM_DATA: FormDataModel = {
  versjon: '5.0',
  rolle: 'TE',
  sak: { ... },
  varsel: { ... },
  koe_revisjoner: [],
  bh_svar_revisjoner: []
};
```

---

## Se også

- [README.md](../README.md) – Prosjektoversikt
- [API.md](API.md) – Backend API-referanse
- [GETTING_STARTED.md](GETTING_STARTED.md) – Oppsett
- [backend/STRUCTURE.md](../backend/STRUCTURE.md) – Backend-arkitektur
- [types.ts](../types.ts) – TypeScript-definisjoner
