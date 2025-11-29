# Refaktoreringsplan: Frontend

**Dato:** November 2025
**Versjon:** 1.0
**Status:** Klar for implementering
**Estimert tid:** 8-12 timer

---

## Innholdsfortegnelse

1. [Bakgrunn og formål](#1-bakgrunn-og-formål)
2. [Identifisert duplisering](#2-identifisert-duplisering)
3. [Store filer som bør splittes](#3-store-filer-som-bør-splittes)
4. [Implementeringsplan](#4-implementeringsplan)
5. [Testing](#5-testing)
6. [Sjekkliste](#6-sjekkliste)

---

## 1. Bakgrunn og formål

### 1.1 Hvorfor refaktorere?

**Nåværende situasjon:**
- Email-valideringslogikk duplisert i 3 panel-komponenter (~90 linjer x 3)
- `pdfGeneratorReact.tsx`: 1055 linjer - styling, komponenter og logikk blandet
- `App.tsx`: 663 linjer - 7+ ulike ansvar i én fil
- Rolle/tab-mapping definert identisk to steder i App.tsx

**Mål:**
- Eliminere ~250 linjer duplisert kode
- Forbedre vedlikeholdbarhet
- Enklere testing av isolert logikk
- Konsistent kodestruktur

### 1.2 Eksisterende hook-struktur

Prosjektet har allerede god hook-arkitektur i `hooks/`:
- `useApiConnection.ts` - API-tilkoblingsstatus
- `useAutoSave.ts` - Automatisk lagring
- `useCaseLoader.ts` - Lasting av saker
- `useFileUpload.ts` - Filopplasting
- `useFormSubmission.ts` - Skjema-innsending
- `useSkjemaData.ts` - Skjemadata-håndtering
- `useUrlParams.ts` - URL-parameter parsing

**Ny hook som skal opprettes:** `useEmailValidation.ts`

---

## 2. Identifisert duplisering

### 2.1 Email-validering (KRITISK - Prioritet 1)

**Identisk kode i 3 filer:**

| Fil | Linjer | Duplisert kode |
|-----|--------|----------------|
| `components/panels/KravKoePanel.tsx` | 39-127 | 88 linjer |
| `components/panels/BhSvarPanel.tsx` | 36-118 | 82 linjer |
| `components/panels/VarselPanel.tsx` | 40-121 | 81 linjer |

**Dupliserte elementer:**

```typescript
// 1. State-variabler (identisk i alle 3)
const [signerEmail, setSignerEmail] = useState('');
const [signerName, setSignerName] = useState('');
const [isValidating, setIsValidating] = useState(false);
const [validationError, setValidationError] = useState('');
const [validationTimer, setValidationTimer] = useState<NodeJS.Timeout | null>(null);

// 2. Cleanup useEffect (identisk i alle 3)
useEffect(() => {
  return () => {
    if (validationTimer) {
      clearTimeout(validationTimer);
    }
  };
}, [validationTimer]);

// 3. handleEmailValidation (nesten identisk - kun lagringsfelt varierer)
const handleEmailValidation = async (email: string) => { ... }

// 4. handleEmailChange med debounce (identisk i alle 3)
const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }
```

### 2.2 Rolle/Tab-mapping i App.tsx (Prioritet 3)

**Første forekomst (linje 177-183):**
```typescript
const roleMap: Record<Modus, Role> = {
  'varsel': 'TE',
  'koe': 'TE',
  'svar': 'BH',
  'revidering': 'TE',
};
loadedFormData.rolle = roleMap[modus];
```

**Andre forekomst (linje 248-254):** Identisk definisjon.

**Tab-setting (linje 202-208 og 260-266):**
```typescript
if (modus === 'varsel') {
  setActiveTab(0);
} else if (modus === 'koe' || modus === 'revidering') {
  setActiveTab(1);
} else if (modus === 'svar') {
  setActiveTab(2);
}
```

---

## 3. Store filer som bør splittes

### 3.1 Filstørrelser

| Fil | Linjer | Alvorlighet | Anbefaling |
|-----|--------|-------------|------------|
| `utils/pdfGeneratorReact.tsx` | 1055 | Høy | Splitt i 3 filer |
| `App.tsx` | 663 | Middels | Ekstraher utilities |
| `components/panels/TestOversiktPanel.tsx` | 567 | Lav | Vurder senere |
| `components/panels/KravKoePanel.tsx` | 546 | Middels | Ekstraher hook |
| `components/panels/BhSvarPanel.tsx` | 451 | Middels | Ekstraher hook |
| `components/panels/VarselPanel.tsx` | 441 | Middels | Ekstraher hook |

### 3.2 pdfGeneratorReact.tsx struktur

**Nåværende innhold:**
- Linje 1-68: Font-registrering og farger
- Linje 69-342: StyleSheet.create() - all styling
- Linje 343-936: React-komponenter (Header, Footer, StatusBadge, etc.)
- Linje 937-1055: generatePdfReact() og hjelpefunksjoner

**Anbefalt oppdeling:**
1. `utils/pdf/pdfStyles.ts` - Farger og StyleSheet
2. `utils/pdf/pdfComponents.tsx` - Alle React-komponenter
3. `utils/pdf/pdfGenerator.ts` - Export-funksjoner

---

## 4. Implementeringsplan

### Trinn 1: Opprett useEmailValidation hook (1-2 timer)

**Opprett fil:** `hooks/useEmailValidation.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import { showToast } from '../utils/helpers';

interface UseEmailValidationOptions {
  sakId: string;
  onValidated: (name: string) => void;
  setToastMessage: (message: string | null) => void;
  initialName?: string;
}

interface UseEmailValidationReturn {
  signerEmail: string;
  signerName: string;
  isValidating: boolean;
  validationError: string;
  handleEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  resetValidation: () => void;
}

export const useEmailValidation = ({
  sakId,
  onValidated,
  setToastMessage,
  initialName = ''
}: UseEmailValidationOptions): UseEmailValidationReturn => {
  const [signerEmail, setSignerEmail] = useState('');
  const [signerName, setSignerName] = useState(initialName);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [validationTimer, setValidationTimer] = useState<NodeJS.Timeout | null>(null);

  // Initialize signer name from initialName
  useEffect(() => {
    if (initialName) {
      setSignerName(initialName);
    }
  }, [initialName]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (validationTimer) {
        clearTimeout(validationTimer);
      }
    };
  }, [validationTimer]);

  // Validate email against Catenda API
  const handleEmailValidation = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) {
      setValidationError('');
      setSignerName('');
      return;
    }

    setIsValidating(true);
    setValidationError('');

    try {
      const response = await api.validateUser(sakId, email);

      if (response.success && response.data) {
        const validatedName = response.data.name;
        setSignerName(validatedName);
        setValidationError('');
        onValidated(validatedName);
        showToast(setToastMessage, `Bruker validert: ${validatedName}`);
      } else {
        setSignerName('');
        setValidationError(response.error || 'Brukeren er ikke medlem i Catenda-prosjektet');
        showToast(setToastMessage, response.error || 'Brukeren er ikke medlem i Catenda-prosjektet');
      }
    } catch (error) {
      setSignerName('');
      setValidationError('Feil ved validering');
      showToast(setToastMessage, 'Feil ved validering av bruker');
    } finally {
      setIsValidating(false);
    }
  }, [sakId, onValidated, setToastMessage]);

  // Debounced validation (800ms)
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setSignerEmail(email);

    if (validationTimer) {
      clearTimeout(validationTimer);
    }

    if (email && email.includes('@')) {
      const timer = setTimeout(() => {
        handleEmailValidation(email);
      }, 800);
      setValidationTimer(timer);
    } else {
      setSignerName('');
      setValidationError('');
    }
  }, [validationTimer, handleEmailValidation]);

  const resetValidation = useCallback(() => {
    setSignerEmail('');
    setSignerName('');
    setValidationError('');
  }, []);

  return {
    signerEmail,
    signerName,
    isValidating,
    validationError,
    handleEmailChange,
    resetValidation
  };
};
```

**Eksporter fra hooks/index.ts:**
```typescript
export { useEmailValidation } from './useEmailValidation';
```

### Trinn 2: Oppdater KravKoePanel.tsx (30-45 min)

**Fjern linje 39-127** (email-validering state og logikk)

**Legg til import:**
```typescript
import { useEmailValidation } from '../../hooks/useEmailValidation';
```

**Erstatt med:**
```typescript
const {
  signerEmail,
  signerName,
  isValidating,
  validationError,
  handleEmailChange
} = useEmailValidation({
  sakId: sak.sak_id_display || '',
  onValidated: (name) => setFormData('koe_revisjoner', 'for_entreprenor', name, sisteKravIndex),
  setToastMessage,
  initialName: koe_revisjoner[sisteKravIndex]?.for_entreprenor || ''
});
```

**Test:** Verifiser at email-validering fortsatt fungerer i KOE-skjemaet.

### Trinn 3: Oppdater BhSvarPanel.tsx (30-45 min)

**Fjern linje 36-118** (email-validering state og logikk)

**Legg til import:**
```typescript
import { useEmailValidation } from '../../hooks/useEmailValidation';
```

**Erstatt med:**
```typescript
const {
  signerEmail,
  signerName,
  isValidating,
  validationError,
  handleEmailChange
} = useEmailValidation({
  sakId: sak.sak_id_display || '',
  onValidated: (name) => setFormData('bh_svar_revisjoner', 'sign.for_byggherre', name, sisteSvarIndex),
  setToastMessage,
  initialName: bh_svar_revisjoner[sisteSvarIndex]?.sign?.for_byggherre || ''
});
```

**Test:** Verifiser at email-validering fortsatt fungerer i BH Svar-skjemaet.

### Trinn 4: Oppdater VarselPanel.tsx (30-45 min)

**Fjern linje 40-121** (email-validering state og logikk)

**Legg til import:**
```typescript
import { useEmailValidation } from '../../hooks/useEmailValidation';
```

**Erstatt med:**
```typescript
const handleChange = (field: string, value: any) => setFormData('varsel', field, value);

const {
  signerEmail,
  signerName,
  isValidating,
  validationError,
  handleEmailChange
} = useEmailValidation({
  sakId: sak.sak_id_display || '',
  onValidated: (name) => handleChange('for_entreprenor', name),
  setToastMessage,
  initialName: varsel?.for_entreprenor || ''
});
```

**Test:** Verifiser at email-validering fortsatt fungerer i Varsel-skjemaet.

### Trinn 5: Opprett rolle/tab utilities (30 min)

**Opprett fil:** `utils/modusHelpers.ts`

```typescript
import { Modus, Role } from '../types';

/**
 * Map modus to role
 */
export const getRoleFromModus = (modus: Modus): Role => {
  const roleMap: Record<Modus, Role> = {
    'varsel': 'TE',
    'koe': 'TE',
    'svar': 'BH',
    'revidering': 'TE',
  };
  return roleMap[modus];
};

/**
 * Get tab index from modus
 */
export const getTabIndexFromModus = (modus: Modus): number => {
  switch (modus) {
    case 'varsel':
      return 0;
    case 'koe':
    case 'revidering':
      return 1;
    case 'svar':
      return 2;
    default:
      return 0;
  }
};
```

### Trinn 6: Oppdater App.tsx (30 min)

**Legg til import:**
```typescript
import { getRoleFromModus, getTabIndexFromModus } from './utils/modusHelpers';
```

**Erstatt linje 177-183:**
```typescript
// Før:
const roleMap: Record<Modus, Role> = { ... };
loadedFormData.rolle = roleMap[modus];

// Etter:
loadedFormData.rolle = getRoleFromModus(modus);
```

**Erstatt linje 202-208:**
```typescript
// Før:
if (modus === 'varsel') { setActiveTab(0); } ...

// Etter:
setActiveTab(getTabIndexFromModus(modus));
```

**Erstatt linje 248-266:**
```typescript
// Før:
const roleMap: Record<Modus, Role> = { ... };
const newRole = roleMap[modus];
// ... og tab if-else

// Etter:
const newRole = getRoleFromModus(modus);
if (newRole && formData.rolle !== newRole) {
  setFormData(prev => ({ ...prev, rolle: newRole }));
}
setActiveTab(getTabIndexFromModus(modus));
```

### Trinn 7: Splitt pdfGeneratorReact.tsx (2-3 timer) - VALGFRITT

**Denne kan utsettes til senere da den ikke blokkerer annen utvikling.**

**Opprett mappestruktur:**
```
utils/
├── pdf/
│   ├── index.ts           # Re-eksporter
│   ├── pdfStyles.ts       # COLORS og styles
│   ├── pdfComponents.tsx  # React-komponenter
│   └── pdfGenerator.ts    # generatePdfReact()
└── pdfGeneratorReact.tsx  # Behold som facade (import fra pdf/)
```

**utils/pdf/pdfStyles.ts:**
```typescript
import { StyleSheet } from '@react-pdf/renderer';

export const COLORS = {
  primary: '#2A2859',
  // ... resten av fargene
};

export const styles = StyleSheet.create({
  // ... kopier alle styles hit
});
```

**utils/pdf/pdfComponents.tsx:**
```typescript
import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { styles, COLORS } from './pdfStyles';

export const PdfHeader: React.FC<{ ... }> = ({ ... }) => { ... };
export const PdfFooter: React.FC<{ ... }> = ({ ... }) => { ... };
// ... alle andre komponenter
```

**utils/pdf/pdfGenerator.ts:**
```typescript
import { pdf } from '@react-pdf/renderer';
import { KOEDocument } from './pdfComponents';

export const generatePdfReact = async (formData: FormDataModel): Promise<void> => {
  // ... eksisterende logikk
};
```

---

## 5. Testing

### 5.1 Manuell testing etter hvert trinn

**Etter Trinn 1-4 (email-validering):**
- [ ] Åpne Varsel-fanen, skriv inn en gyldig e-post - verifiser at navn vises
- [ ] Skriv inn ugyldig e-post - verifiser feilmelding
- [ ] Åpne KOE-fanen, gjenta test
- [ ] Åpne BH Svar-fanen, gjenta test
- [ ] Verifiser at debounce fungerer (vent 800ms)

**Etter Trinn 5-6 (rolle/tab):**
- [ ] Åpne app med `?modus=varsel` - verifiser Tab 0 aktiv, rolle=TE
- [ ] Åpne app med `?modus=koe` - verifiser Tab 1 aktiv, rolle=TE
- [ ] Åpne app med `?modus=svar` - verifiser Tab 2 aktiv, rolle=BH
- [ ] Åpne app med `?modus=revidering` - verifiser Tab 1 aktiv, rolle=TE

### 5.2 Eksisterende tester

Kjør eksisterende tester for å sikre at refaktoreringen ikke bryter noe:

```bash
npm test
```

Relevante testfiler:
- `__tests__/hooks/useApiConnection.test.ts`
- `__tests__/hooks/useCaseLoader.test.ts`
- `__tests__/hooks/useFormSubmission.test.ts`
- `__tests__/hooks/useUrlParams.test.ts`

### 5.3 Ny test for useEmailValidation (valgfritt)

**Opprett fil:** `__tests__/hooks/useEmailValidation.test.ts`

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEmailValidation } from '../../hooks/useEmailValidation';
import * as api from '../../services/api';

jest.mock('../../services/api');

describe('useEmailValidation', () => {
  const mockSetToastMessage = jest.fn();
  const mockOnValidated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should validate email after debounce', async () => {
    (api.validateUser as jest.Mock).mockResolvedValue({
      success: true,
      data: { name: 'Test User' }
    });

    const { result } = renderHook(() =>
      useEmailValidation({
        sakId: 'test-123',
        onValidated: mockOnValidated,
        setToastMessage: mockSetToastMessage
      })
    );

    act(() => {
      result.current.handleEmailChange({
        target: { value: 'test@example.com' }
      } as React.ChangeEvent<HTMLInputElement>);
    });

    // Fast-forward debounce timer
    act(() => {
      jest.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(result.current.signerName).toBe('Test User');
    });

    expect(mockOnValidated).toHaveBeenCalledWith('Test User');
  });

  it('should show error for invalid user', async () => {
    (api.validateUser as jest.Mock).mockResolvedValue({
      success: false,
      error: 'User not found'
    });

    const { result } = renderHook(() =>
      useEmailValidation({
        sakId: 'test-123',
        onValidated: mockOnValidated,
        setToastMessage: mockSetToastMessage
      })
    );

    act(() => {
      result.current.handleEmailChange({
        target: { value: 'invalid@example.com' }
      } as React.ChangeEvent<HTMLInputElement>);
    });

    act(() => {
      jest.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(result.current.validationError).toBe('User not found');
    });

    expect(mockOnValidated).not.toHaveBeenCalled();
  });
});
```

---

## 6. Sjekkliste

### Forberedelse
- [ ] Les gjennom hele denne planen
- [ ] Opprett Git branch: `refactor/frontend-email-validation`
- [ ] Kjør `npm test` for å bekrefte at alle tester passerer

### Implementering

**Trinn 1: useEmailValidation hook**
- [ ] Opprett `hooks/useEmailValidation.ts`
- [ ] Eksporter fra `hooks/index.ts` (hvis filen finnes)
- [ ] Verifiser TypeScript-kompilering: `npx tsc --noEmit`

**Trinn 2: KravKoePanel.tsx**
- [ ] Fjern linje 39-127
- [ ] Legg til import av useEmailValidation
- [ ] Implementer hook-kall med riktige parametre
- [ ] Test manuelt

**Trinn 3: BhSvarPanel.tsx**
- [ ] Fjern linje 36-118
- [ ] Legg til import av useEmailValidation
- [ ] Implementer hook-kall med riktige parametre
- [ ] Test manuelt

**Trinn 4: VarselPanel.tsx**
- [ ] Fjern linje 40-121
- [ ] Legg til import av useEmailValidation
- [ ] Implementer hook-kall med riktige parametre
- [ ] Test manuelt

**Trinn 5: modusHelpers.ts**
- [ ] Opprett `utils/modusHelpers.ts`
- [ ] Implementer `getRoleFromModus()`
- [ ] Implementer `getTabIndexFromModus()`

**Trinn 6: App.tsx**
- [ ] Importer fra modusHelpers
- [ ] Erstatt roleMap (linje 177-183)
- [ ] Erstatt tab if-else (linje 202-208)
- [ ] Erstatt roleMap og tab if-else (linje 248-266)
- [ ] Test manuelt

**Trinn 7: pdfGeneratorReact.tsx (VALGFRITT)**
- [ ] Opprett `utils/pdf/` mappestruktur
- [ ] Flytt COLORS og styles til `pdfStyles.ts`
- [ ] Flytt komponenter til `pdfComponents.tsx`
- [ ] Flytt generatePdfReact til `pdfGenerator.ts`
- [ ] Test PDF-generering

### Ferdigstilling
- [ ] Kjør `npm test` - alle tester skal passere
- [ ] Kjør `npm run build` - ingen kompileringsfeil
- [ ] Test alle 3 skjemaer manuelt
- [ ] Commit med beskrivende melding
- [ ] Opprett PR

---

## Tidsestimat

| Trinn | Beskrivelse | Tid |
|-------|-------------|-----|
| 1 | Opprett useEmailValidation hook | 1-2 timer |
| 2-4 | Oppdater 3 panel-komponenter | 1.5-2 timer |
| 5-6 | Rolle/tab utilities + App.tsx | 1 time |
| 7 | Splitt pdfGeneratorReact (valgfritt) | 2-3 timer |
| Test | Manuell + automatisk testing | 1 time |
| **Total** | | **6.5-10 timer** |

---

## Forventet resultat

**Før refaktorering:**
- 3 filer med ~90 linjer duplisert kode hver
- App.tsx med 2 identiske roleMap-definisjoner
- Vanskelig å endre valideringslogikk (må endres 3 steder)

**Etter refaktorering:**
- 1 gjenbrukbar hook (`useEmailValidation`)
- 1 utility-fil (`modusHelpers.ts`)
- ~250 færre linjer kode totalt
- Enklere vedlikehold - endringer gjøres 1 sted
- Bedre testbarhet - hook kan testes isolert

---

**Vedlikeholdt av:** Claude (Opus 4)
**Sist oppdatert:** 2025-11-29 (v1.0)
**Status:** Klar for implementering

**For Sonnet 4.5:** Følg trinnene i rekkefølge. Test etter hvert trinn. Commit ofte.
