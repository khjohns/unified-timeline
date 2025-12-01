# Frontend-arkitektur

Oversikt over frontend-arkitekturen i Skjema Endringsmeldinger.

**Sist oppdatert:** 2025-12-01

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

1. **Komponentbasert** – Gjenbrukbare UI-komponenter
2. **Hook-basert state** – Custom hooks for logikk-separering
3. **Lazy loading** – Paneler lastes ved behov
4. **Typesikkerhet** – Streng TypeScript-konfigurasjon
5. **Sentraliserte konstanter** – Statuskoder fra `shared/status-codes.json`

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

## Datamodell

Definert i `types.ts`:

```typescript
interface FormDataModel {
  versjon: string;
  rolle: 'TE' | 'BH';           // Totalentreprenør | Byggherre
  sak: Sak;                     // Grunnleggende saksinformasjon
  varsel: Varsel;               // Varsel om endringsforhold
  koe_revisjoner: Koe[];        // Array av KOE-revisjoner
  bh_svar_revisjoner: BhSvar[]; // Array av BH-svar-revisjoner
}
```

### Sak

```typescript
interface Sak {
  sak_id_display: string;     // Lesbar sak-ID
  sakstittel: string;
  opprettet_av: string;
  opprettet_dato: string;
  prosjekt_navn: string;
  kontrakt_referanse: string;
  entreprenor: string;
  byggherre: string;
  status?: SakStatus;
}
```

### Varsel

```typescript
interface Varsel {
  dato_forhold_oppdaget: string;
  dato_varsel_sendt: string;
  for_entreprenor?: string;
  hovedkategori: string;
  underkategori: string[];      // Multivalg
  varsel_beskrivelse: string;
  varsel_metode: string;        // Kommaseparert
  varsel_metode_annet?: string;
  tidligere_varsel_referanse?: string;
  vedlegg?: string[];
}
```

### KOE (Krav om Endringsordre)

```typescript
interface Koe {
  koe_revisjonsnr: string;
  dato_krav_sendt: string;
  for_entreprenor: string;
  vederlag: KoeVederlag;        // Vederlagskrav
  frist: KoeFrist;              // Fristforlengelse
  status?: KoeStatus;
  vedlegg?: string[];
}

interface KoeVederlag {
  krav_vederlag: boolean;
  krav_produktivitetstap: boolean;
  saerskilt_varsel_rigg_drift: boolean;
  krav_vederlag_metode: string;
  krav_vederlag_belop: string;
  krav_vederlag_begrunnelse: string;
}

interface KoeFrist {
  krav_fristforlengelse: boolean;
  krav_frist_type: string;
  krav_frist_antall_dager: string;
  forsinkelse_kritisk_linje: boolean;
  krav_frist_begrunnelse: string;
}
```

### BH Svar (Byggherre-svar)

```typescript
interface BhSvar {
  vederlag: BhSvarVederlag;
  frist: BhSvarFrist;
  mote_dato: string;
  mote_referat: string;
  sign: BhSvarSign;
  status?: BhSvarStatus;
  vedlegg?: string[];
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

### `api.ts` (552 linjer)

API-klient for backend-kommunikasjon.

```typescript
// Modus-typer
type Modus = 'varsel' | 'koe' | 'svar' | 'oversikt' | 'test';

// Hovedfunksjoner
api.getCase(sakId): Promise<CaseResponse>
api.saveDraft(sakId, formData): Promise<void>
api.submitVarsel(sakId, formData, topicGuid): Promise<SubmitResponse>
api.submitKoe(sakId, formData, topicGuid): Promise<SubmitResponse>
api.submitSvar(sakId, formData, topicGuid): Promise<SubmitResponse>
api.uploadPdf(sakId, pdfBase64, filename, topicGuid): Promise<void>
api.verifyMagicLink(token): Promise<{ sakId: string }>
api.validateUser(email, sakId): Promise<UserValidation>
api.getCsrfToken(): Promise<string>
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

## State Management

Frontend bruker **React hooks** for state management (ingen Redux/Zustand).

### State-typer

| State | Hook | Scope |
|-------|------|-------|
| Form data | `useSkjemaData` | Global (App.tsx) |
| Auto-save | `useAutoSave` | localStorage |
| API-data | `useCaseLoader` | Per session |
| UI state | `useState` | Komponent-lokal |
| URL params | `useUrlParams` | Per navigasjon |
| Modal state | `useModal` | Komponent-lokal |

### Data-flyt

```
URL params (magicToken/sakId)
        │
        ▼
    useCaseLoader
        │
        ▼
    formData (useSkjemaData)
        │
        ├──▶ Panel-komponenter (props)
        │
        ├──▶ useAutoSave (localStorage)
        │
        └──▶ api.saveDraft (backend)
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

### Test-status (2025-12-01)

- **95 tester** passerer
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
