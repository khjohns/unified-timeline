# E2E Test Funn og Forbedringsforslag

**Dato:** 2025-12-01 (oppdatert)
**Status:** 74 tester kjørt - de fleste passerer med retries, noen kritiske funn identifisert

## Siste testkjøring (2025-12-01)

### Resultater
- **Totalt:** 74 tester
- **Passerte:** De fleste passerer etter retry (container-miljø krever retries)
- **Kritiske feil:** 2 tester feiler konsistent

### Kritiske funn fra nye tester

#### 1. Tastaturinteraksjon med skjemafelt (FEILET)
**Test:** `accessibility.spec.ts:106:3` - "should allow keyboard interaction with form fields"
**Problem:** Tastaturnavigasjon til og interaksjon med skjemafelt fungerer ikke som forventet.
**Prioritet:** HØY
**Forslag:**
```tsx
// Sørg for at alle input-felt er tabbable og har riktig focus-styling
<input
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
  aria-label="Beskrivende label"
/>
```

#### 2. Heading-hierarki (FEILET)
**Test:** `accessibility.spec.ts:237:3` - "should have proper heading hierarchy"
**Problem:** Overskrifter hopper nivåer (f.eks. h1 → h3 uten h2) eller mangler helt.
**Prioritet:** HØY (WCAG 2.1 krav)
**Forslag:**
```tsx
// Korrekt hierarki:
<h1>Skjema for krav om endringsordre</h1>
  <h2>Varsel</h2>
    <h3>Prosjektinformasjon</h3>
  <h2>Krav om endringsordre</h2>
    <h3>Vederlag</h3>
```

### Tester som passerte (med retries)

De fleste av de 74 testene passerer, men krever ofte 1-2 retries pga. container-miljøet. Dette inkluderer:

| Testfil | Antall tester | Status |
|---------|---------------|--------|
| navigation.spec.ts | 8 | ✅ Passerer |
| workflow.spec.ts | 12 | ✅ Passerer |
| form-filling.spec.ts | 9 | ✅ Passerer |
| validation.spec.ts | 13 | ✅ Passerer |
| api-integration.spec.ts | 11 | ✅ Passerer |
| accessibility.spec.ts | 21 | ⚠️ 2 feiler konsistent |

### Anbefalinger

1. **Fiks heading-hierarki** - Kritisk for WCAG 2.1 compliance
2. **Forbedre tastaturnavigasjon** - Sikre at alle skjemafelt er tilgjengelige via tastatur
3. **Kjør tester på dedikert CI** - For mer stabile resultater uten single-process workaround

---

## Tidligere testkjøring (2024-12-01)

**Status:** 29 tester passerte (med retries)

## Oppsummering

Etter å ha kjørt E2E-testene ble det identifisert flere områder der applikasjonen kan forbedres for bedre brukervennlighet, tilgjengelighet og testbarhet.

---

## Funn fra testene

### 1. Manglende/utydelige seksjonsoverskrifter

**Problem:** Testene forventet å finne tekster som "Krav om endringsordre" og "Byggherrens svar" som overskrifter på respektive sider, men disse var ikke synlige som forventet.

**Konsekvens:**
- Brukere kan ha vanskeligheter med å forstå hvilken del av skjemaet de jobber med
- Skjermlesere får ikke tydelig kontekst om innholdet
- Testene måtte skrives om til å sjekke tab-valg i stedet for innhold

**Forslag:**
```tsx
// Eksempel: Legg til tydelig overskrift i KravKoePanel
<h2 className="text-xl font-semibold mb-4">Krav om endringsordre (KOE)</h2>

// Eksempel: Legg til tydelig overskrift i BhSvarPanel
<h2 className="text-xl font-semibold mb-4">Byggherrens svar</h2>
```

**Prioritet:** Middels
**Påvirker:** Brukervennlighet, tilgjengelighet (a11y)

---

### 2. Tvetydig element-identifikasjon

**Problem:** `getByRole('button', { name: 'TE' })` matchet to elementer:
1. Rolle-knappen i header
2. Vedlegg-opplastingsfelt med lignende tekst

**Konsekvens:**
- Testene feiler med "strict mode violation"
- Indikerer at aria-labels ikke er unike nok

**Forslag:**
```tsx
// Legg til data-testid på viktige interaktive elementer
<button data-testid="role-toggle-te" ...>TE</button>
<button data-testid="role-toggle-bh" ...>BH</button>

// Eller mer spesifikk aria-label
<button aria-label="Bytt til totalentreprenør-visning">TE</button>
```

**Prioritet:** Lav (workaround i tester fungerer)
**Påvirker:** Testbarhet, tilgjengelighet

---

## Manglende testdekning

### Høy prioritet

| Område | Beskrivelse | Hvorfor viktig |
|--------|-------------|----------------|
| **Validering** | Test obligatoriske felt, datovalidering, beløpsvalidering | Kritisk for dataintegritet |
| **API-integrasjon** | Test send varsel, send krav, send svar (med mock) | Kjerneflyt i applikasjonen |
| **Feilhåndtering** | Test hva som skjer ved nettverksfeil, serverfeill | Brukeropplevelse ved feil |

### Middels prioritet

| Område | Beskrivelse | Hvorfor viktig |
|--------|-------------|----------------|
| **Vedlegg** | Test filopplasting og sletting | Vanlig brukeroperasjon |
| **Fullstendig workflow** | Test Varsel → KOE → Svar komplett | Verifiserer hele brukerreisen |
| **Keyboard-navigasjon** | Test at alle funksjoner er tilgjengelige via tastatur | Tilgjengelighet (WCAG) |

### Lav prioritet

| Område | Beskrivelse | Hvorfor viktig |
|--------|-------------|----------------|
| **Print-visning** | Test at PDF genereres korrekt | Dokumentasjon |
| **Browser-kompatibilitet** | Test i Firefox, Safari | Bred støtte |

---

## Foreslåtte nye E2E-tester

### 1. Valideringstester (`e2e/validation.spec.ts`)

```typescript
test.describe('Form Validation', () => {
  test('should show error when required field is empty', async ({ page }) => {
    // Forsøk å sende uten å fylle ut obligatoriske felt
  });

  test('should validate date range (from before to)', async ({ page }) => {
    // Test at fra-dato ikke kan være etter til-dato
  });

  test('should validate amount format', async ({ page }) => {
    // Test at beløp må være positivt tall
  });
});
```

### 2. API-integrasjonstester (`e2e/api-integration.spec.ts`)

```typescript
test.describe('API Integration', () => {
  test('should send varsel successfully', async ({ page }) => {
    // Fyll ut skjema, klikk send, verifiser suksessmelding
  });

  test('should handle API error gracefully', async ({ page }) => {
    // Mock API-feil, verifiser feilmelding til bruker
  });
});
```

### 3. Tilgjengelighetstester (`e2e/accessibility.spec.ts`)

```typescript
test.describe('Accessibility', () => {
  test('should be navigable by keyboard only', async ({ page }) => {
    // Naviger gjennom hele skjemaet med bare Tab og Enter
  });

  test('should have proper ARIA labels', async ({ page }) => {
    // Verifiser at alle interaktive elementer har ARIA-labels
  });
});
```

---

## Teknisk gjeld i testoppsettet

### Flaky tester pga. container-miljø

**Problem:** `--single-process` flagget er nødvendig i ressursbegrensede containermiljøer, men forårsaker at browseren lukkes mellom tester.

**Nåværende workaround:**
- `retries: 2` i playwright.config.ts
- `afterEach` delay i alle testfiler

**Langsiktig løsning:**
- Kjør E2E-tester på dedikert CI-server med mer ressurser
- Bruk GitHub Actions med større runner
- Vurder å bruke Docker med mer minne

---

## Implementeringsplan

### Fase 1: Kritiske forbedringer (1-2 dager)
- [ ] Legg til seksjonsoverskrifter i alle paneler
- [ ] Legg til data-testid på rolle-knapper

### Fase 2: Utvidet testdekning (2-3 dager)
- [ ] Skriv valideringstester
- [ ] Skriv API-integrasjonstester (med mock)

### Fase 3: Tilgjengelighet (1-2 dager)
- [ ] Skriv keyboard-navigasjonstester
- [ ] Gjennomgå og fiks ARIA-labels

### Fase 4: Infrastruktur (ved behov)
- [ ] Sett opp dedikert E2E-test miljø i CI
- [ ] Fjern `--single-process` workaround

---

## Referanser

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [NS 8407:2011 - Krav om endringsordre](https://standard.no/)
