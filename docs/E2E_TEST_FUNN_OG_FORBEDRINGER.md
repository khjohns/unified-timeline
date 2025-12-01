# E2E Test Funn og Forbedringsforslag

**Dato:** 2024-12-01
**Status:** Alle 29 tester passerer (med retries)

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
