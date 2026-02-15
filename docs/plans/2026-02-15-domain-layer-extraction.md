# Domenelag-ekstraksjon: Frist og Grunnlag

## Prompt for ny Claude Code-instans

Kopier prompten under og bruk den i en ny Claude Code-sesjon.

---

```
## Oppgave

Trekk ut ren NS 8407-domenelogikk fra bridge-hookene til egne
domenefiler. Bridge-hookene skal bli tynne React-adaptere som
importerer domene-funksjoner.

Les ADR-003 (docs/ADR-003-card-anchored-contextual-editing.md),
spesielt L14 og L15, for den fulle arkitektur-beslutningen.

## Bakgrunn

Bridge-hookene (`src/hooks/useFristBridge.ts` og
`src/hooks/useGrunnlagBridge.ts`) blander fire ansvarsområder:
- NS 8407 forretningsregler (~120-200 linjer ren logikk)
- React state management (useState, useCallback)
- Infrastruktur (useSubmitEvent, useFormBackup, useToast)
- Presentasjonslogikk (placeholder, labels)

Domenelogikken skal ut i egne filer for testbarhet og lesbarhet.
Eksisterende filer som allerede følger mønsteret:
- `src/utils/begrunnelseGenerator.ts` (1453 linjer, 0 React)
- `src/components/bento/consequenceCallout.ts` (197 linjer, 0 React)

## Steg

### 1. Opprett `src/domain/fristDomain.ts`

Flytt følgende ren logikk ut fra `src/hooks/useFristBridge.ts`:

| Funksjon | Nåværende lokasjon i hook | Ny signatur |
|----------|---------------------------|-------------|
| `beregnPrinsipaltResultat` | Linje ~119 (allerede ren funksjon) | `(state, config) → FristBeregningResultat` |
| `beregnSubsidiaertResultat` | Linje ~138 (allerede ren funksjon) | `(state) → FristBeregningResultat` |
| Preklusjonslogikk | useMemo linje ~348 | `beregnPreklusjon(state, config) → boolean` |
| Reduksjonslogikk | useMemo linje ~355 | `beregnReduksjon(state, config) → boolean` |
| Visibility flags | 4x useMemo linje ~321-343 | `beregnVisibility(config) → FristVisibilityFlags` |
| Subsidiary triggers | useMemo linje ~392 | `beregnSubsidiaerTriggers(computed) → SubsidiaerTrigger[]` |
| buildEventData | useCallback linje ~453 | `buildEventData(state, config, computed) → Record<string, unknown>` |
| getDefaults | useCallback linje ~193 | `getDefaults(config) → FristFormState` |
| Dynamic placeholder | useMemo linje ~431 | `getDynamicPlaceholder(resultat) → string` |

Eksporter også typene:
- `FristFormState` (de 8 feltene fra useState)
- `FristDomainConfig` (varselType, krevdDager, tilstand, etc.)
- `FristVisibilityFlags` (showFristVarselOk, showSpesifisertKravOk, etc.)
- `FristComputedValues` (erPrekludert, resultat, subsidiaert, etc.)

Bruk `beregnAlt(state, config) → FristComputedValues` som
convenience-funksjon som kaller alle beregningene.

### 2. Opprett `src/domain/grunnlagDomain.ts`

Flytt fra `src/hooks/useGrunnlagBridge.ts`:

| Funksjon | Nåværende lokasjon | Ny signatur |
|----------|---------------------|-------------|
| Kategori-sjekker | Linje ~265-275 | `erEndringMed32_2(event) → boolean`, `erPaalegg(event) → boolean` |
| Preklusjon | Linje ~277 | `erPrekludert(state, config) → boolean` |
| Passivitet | Linje ~280-284 | `beregnPassivitet(event) → { erPassiv, dagerSidenVarsel }` |
| Snuoperasjon | Linje ~294 | `erSnuoperasjon(state, config) → boolean` |
| Verdict options | Linje ~301 | `getVerdictOptions(config) → VerdictOption[]` |
| buildEventData | Linje ~359 | `buildEventData(state, config) → Record<string, unknown>` |
| getDefaults | Linje ~150 | `getDefaults(config) → GrunnlagFormState` |
| Dynamic placeholder | Linje ~325 | `getDynamicPlaceholder(resultat, erPrekludert) → string` |

NB: `getConsequence()` ligger allerede i `consequenceCallout.ts` —
den skal IKKE flyttes, bare importeres fra domenet.

### 3. Skriv domene-tester FØRST

`src/domain/__tests__/fristDomain.test.ts`:
- Ingen React, ingen renderHook, ingen wrappers
- Test hver ren funksjon med describe/it
- Dekk alle NS 8407-grenseverdier:
  - Preklusjon: varsel/spesifisert/begrunnelse_utsatt × fristVarselOk
  - Resultat: godkjent/delvis_godkjent/avslatt
  - Subsidiært: ignorerer preklusjon
  - Visibility: alle varselType-kombinasjoner
  - buildEventData: subsidiaer_triggers inkludert

`src/domain/__tests__/grunnlagDomain.test.ts`:
- Kategori-sjekker: ENDRING/EO/IRREG/VALGRETT/FORCE_MAJEURE
- Preklusjon: kun ENDRING uten EO
- Passivitet: > 10 dager siden varsel
- Verdict options: inkl. frafalt for pålegg
- buildEventData: update mode vs create mode

### 4. Refaktorer `useFristBridge.ts`

Erstatt interne beregninger med import fra domain:

```ts
import * as fristDomain from '../domain/fristDomain';

export function useFristBridge(config: UseFristBridgeConfig): FristBridgeReturn {
  // State
  const [formState, setFormState] = useState<fristDomain.FristFormState>(
    () => fristDomain.getDefaults(domainConfig)
  );

  // Domain computations (ren TypeScript, memoized)
  const computed = useMemo(
    () => fristDomain.beregnAlt(formState, domainConfig),
    [formState, domainConfig]
  );

  // Infrastructure (React-specific)
  const mutation = useSubmitEvent(sakId, { ... });
  const { clearBackup, getBackup } = useFormBackup(...);
  const toast = useToast();

  // Handlers (useCallback wrapping domain functions)
  const handleSubmit = useCallback(() => {
    const eventData = fristDomain.buildEventData(formState, domainConfig, computed);
    mutation.mutate({ eventType: 'respons_frist', data: eventData });
  }, [formState, domainConfig, computed, mutation]);

  // ... rest av hookens React-logikk ...
}
```

### 5. Refaktorer `useGrunnlagBridge.ts`

Samme mønster som steg 4.

### 6. Oppdater eksisterende tester

- `src/hooks/__tests__/useFristBridge.test.ts` — fjern tester som
  nå dekkes av domene-testene. Behold tester for React-wiring:
  - Reset ved isOpen-endring
  - Backup restore + toast
  - Submit-flow (mutation kalles)
  - editorProps oppdateres ved begrunnelse-endring
- Eksisterende FristCard- og CaseMasterCard-tester skal IKKE endres
  (de tester komponent-laget, ikke domene)

### 7. Verifiser

```bash
npm run test          # Alle tester passerer
npx tsc --noEmit      # TypeScript kompilerer
```

## Regler

- Ingen endring i komponent-filer (FristCard, CaseMasterCard, BentoRespond*)
- Ingen endring i CasePageBento
- Bridge-hookenes RETURTYPE (cardProps/editorProps) skal være IDENTISK
- Bare intern refaktorering — null endring i ekstern kontrakt
- Ikke flytt auto-begrunnelse-generering (den er allerede i
  begrunnelseGenerator.ts)
- Ikke flytt consequenceCallout.ts (den er allerede ren)
- Commit med beskrivende melding som refererer til ADR-003 L14
```

---

## Forventet resultat

```
src/domain/
├── fristDomain.ts              (~150 linjer, 0 React)
├── grunnlagDomain.ts           (~100 linjer, 0 React)
└── __tests__/
    ├── fristDomain.test.ts     (~200 linjer, ingen wrappers)
    └── grunnlagDomain.test.ts  (~150 linjer, ingen wrappers)

src/hooks/
├── useFristBridge.ts           (~250 linjer, ned fra ~587)
└── useGrunnlagBridge.ts        (~200 linjer, ned fra ~500)
```
