# Plan: Ekstraher vederlagDomain.ts

> **Steg 1** av card-anchored vederlag (fase 2 i ADR-003-planen).
> Mål: Flytte ren domenelogikk fra RespondVederlagModal.tsx (2 231 linjer) til `src/domain/vederlagDomain.ts` — ingen React-avhengigheter, fullt testbar.

---

## Bakgrunn

RespondVederlagModal inneholder ~300 linjer med ren beregningslogikk innbakt mellom React-hooks og JSX. Denne logikken må ut i en egen fil for å:

1. Gjenbrukes av `useVederlagBridge` (fase 2)
2. Testes isolert uten React-test-infra
3. Holde modalen som tynn adapter (som grunnlag/frist-mønsteret)

## Referansemønster

`fristDomain.ts` (317 linjer) eksporterer:
- **Types:** `FristFormState`, `FristDomainConfig`, `FristVisibilityFlags`, `FristComputedValues`
- **getDefaults()** — create/update mode defaults
- **beregnVisibility()** — hvilke kontroller som vises
- **beregnPreklusjon()** / **beregnReduksjon()** — NS 8407 varslingsregler
- **beregnPrinsipaltResultat()** / **beregnSubsidiaertResultat()** — automatisk resultatberegning
- **beregnSubsidiaerTriggers()** — samler opp triggers
- **getDynamicPlaceholder()** — kontekstuell placeholder-tekst
- **buildEventData()** — mapper form state → event payload
- **beregnAlt()** — convenience-wrapper som kaller alt

---

## Oppgaver

### 1. Definer typer i vederlagDomain.ts

Ekstraher fra modalen (linje 76–198) og omform til domenetyper:

```typescript
// Form state — flat representasjon av alle BH-valg
export interface VederlagFormState {
  // Port 1: Preklusjon
  hovedkravVarsletITide: boolean;       // §34.1.2 (kun SVIKT/ANDRE)
  riggVarsletITide: boolean;            // §34.1.3
  produktivitetVarsletITide: boolean;   // §34.1.3

  // Port 2: Metode
  akseptererMetode: boolean;
  oensketMetode?: VederlagsMetode;
  epJusteringVarsletITide?: boolean;    // §34.3.3
  epJusteringAkseptert?: boolean;
  holdTilbake: boolean;

  // Port 3: Beløp
  hovedkravVurdering: BelopVurdering;
  hovedkravGodkjentBelop?: number;
  riggVurdering?: BelopVurdering;
  riggGodkjentBelop?: number;
  produktivitetVurdering?: BelopVurdering;
  produktivitetGodkjentBelop?: number;

  // Port 4: Begrunnelse
  begrunnelse: string;
}

// Kontekst fra kravet som config
export interface VederlagDomainConfig {
  metode?: VederlagsMetode;
  hovedkravBelop: number;
  riggBelop?: number;
  produktivitetBelop?: number;
  harRiggKrav: boolean;
  harProduktivitetKrav: boolean;
  kreverJustertEp: boolean;
  hovedkategori?: 'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE';
  grunnlagVarsletForSent: boolean;
  grunnlagStatus?: 'godkjent' | 'avslatt' | 'frafalt';
}

// Computed output
export interface VederlagComputedValues {
  // Preklusjon
  har34_1_2_Preklusjon: boolean;
  erHelVederlagSubsidiaerPgaGrunnlag: boolean;
  erSubsidiaer: boolean;
  hovedkravPrekludert: boolean;
  riggPrekludert: boolean;
  produktivitetPrekludert: boolean;
  harPrekludertKrav: boolean;
  harPreklusjonsSteg: boolean;

  // Metode-avledninger
  kanHoldeTilbake: boolean;
  maSvarePaJustering: boolean;

  // Beløp-totaler
  totalKrevd: number;
  totalKrevdInklPrekludert: number;
  totalGodkjent: number;
  totalGodkjentInklPrekludert: number;
  harMetodeendring: boolean;

  // Resultater
  prinsipaltResultat: VederlagBeregningResultat;
  subsidiaertResultat: VederlagBeregningResultat;
  visSubsidiaertResultat: boolean;
  subsidiaerTriggers: SubsidiaerTrigger[];

  // Placeholder
  dynamicPlaceholder: string;
}
```

**Kilde i modal:** linje 76–198 (typer), 499–663 (computed), 250–311 (resultat-funksjoner)

### 2. Implementer getDefaults()

Flytt fra modal linje 369–400. Signaturen:

```typescript
export interface VederlagDefaultsConfig {
  isUpdateMode: boolean;
  lastResponseEvent?: LastResponseData;  // Subset av modalens interface
}

export function getDefaults(config: VederlagDefaultsConfig): VederlagFormState;
```

### 3. Implementer beregnPreklusjon()-funksjoner

Flytt fra modal linje 347–364, 544–550. Individuelle funksjoner:

```typescript
export function har34_1_2_Preklusjon(config: VederlagDomainConfig): boolean;
export function erHelVederlagSubsidiaerPgaGrunnlag(config: VederlagDomainConfig): boolean;
export function beregnHovedkravPrekludert(state: VederlagFormState, config: VederlagDomainConfig): boolean;
export function beregnRiggPrekludert(state: VederlagFormState, config: VederlagDomainConfig): boolean;
export function beregnProduktivitetPrekludert(state: VederlagFormState, config: VederlagDomainConfig): boolean;
```

### 4. Implementer beregnTotaler()

Flytt fra modal linje 553–643. Denne er den tyngste funksjonen — beregner principal og subsidiary totaler:

```typescript
export function beregnTotaler(
  state: VederlagFormState,
  config: VederlagDomainConfig,
  preklusjon: { hovedkrav: boolean; rigg: boolean; produktivitet: boolean },
): VederlagTotaler;
```

### 5. Flytt beregnPrinsipaltResultat() og beregnSubsidiaertResultat()

Allerede rene funksjoner i modalen (linje 250–311). Kopier direkte, juster typesignaturer til å bruke domain-types.

### 6. Implementer beregnSubsidiaerTriggers()

Flytt fra modal submit-handler (linje 896–904):

```typescript
export function beregnSubsidiaerTriggers(
  state: VederlagFormState,
  config: VederlagDomainConfig,
  preklusjon: { hovedkrav: boolean; rigg: boolean; produktivitet: boolean },
): SubsidiaerTrigger[];
```

### 7. Implementer getVurderingBadge() og beregnGodkjentBelop()

Flytt hjelpefunksjoner fra modal linje 208–244. Disse brukes i oppsummering.

### 8. Implementer getDynamicPlaceholder()

Ny funksjon etter frist-mønsteret:

```typescript
export function getDynamicPlaceholder(resultat: VederlagBeregningResultat | undefined): string;
```

### 9. Implementer buildEventData()

Flytt submit-logikken (modal linje 888–1033) til en ren funksjon som mapper form state → event payload. Håndterer både `respons_vederlag` og `respons_vederlag_oppdatert`:

```typescript
export function buildEventData(
  state: VederlagFormState,
  config: VederlagDomainConfig,
  computed: VederlagComputedValues,
  refs: { vederlagKravId: string; lastResponseEventId?: string },
  autoBegrunnelse: string,
): { eventType: string; data: Record<string, unknown> };
```

### 10. Implementer beregnAlt() convenience-wrapper

Etter frist-mønsteret — kaller alle beregningsfunksjoner og returnerer `VederlagComputedValues`:

```typescript
export function beregnAlt(state: VederlagFormState, config: VederlagDomainConfig): VederlagComputedValues;
```

### 11. Skriv tester i vederlagDomain.test.ts

Etter mønster fra `fristDomain.test.ts`. Testgrupper:

- **getDefaults:** create mode, update mode, fallback-verdier
- **beregnPreklusjon:** §34.1.2 (SVIKT/ANDRE), §34.1.3 (rigg/produktivitet), §32.2 (ENDRING+grunnlag)
- **beregnTotaler:** kun hovedkrav, med særskilte krav, med preklusjon, delvis godkjent
- **beregnPrinsipaltResultat:** godkjent/delvis/avslått/hold_tilbake
- **beregnSubsidiaertResultat:** ignorerer preklusjon, evaluerer alle
- **beregnSubsidiaerTriggers:** alle trigger-varianter
- **buildEventData:** new response, update response, med/uten subsidiært
- **beregnAlt:** integrasjonstest — fullt scenario gjennom alle funksjoner

### 12. Oppdater RespondVederlagModal til å bruke vederlagDomain

Erstatt inline-logikk med importerte funksjoner. Modalen beholder:
- React-hooks (useForm, useMemo, useCallback)
- JSX-rendering
- Toast/mutation/navigation

Fjern fra modalen:
- `getVurderingBadge()` → import fra domain
- `beregnGodkjentBelop()` → import fra domain
- `beregnPrinsipaltResultat()` → import fra domain
- `beregnSubsidiaertResultat()` → import fra domain
- `computed` useMemo-blokken → erstatt med `beregnAlt()` call
- Submit-handler event-data → erstatt med `buildEventData()` call

Forventet reduksjon: ~250–300 linjer ut av modalen.

### 13. Verifiser at eksisterende tester fortsatt passerer

Kjør `npm run test` og `cd backend && make test` for å bekrefte ingen regresjoner.

---

## Avgrensninger

- **Ikke** implementer `useVederlagBridge` — det er fase 2
- **Ikke** endre VederlagCard — det er fase 2
- **Ikke** lag BentoRespondVederlag — det er fase 2
- **Ikke** endre CasePageBento routing — det er fase 2
- **Ikke** endre begrunnelseGenerator.ts — den er allerede ekstrahert og fungerer

## Risiko

| Risiko | Tiltak |
|--------|--------|
| Modalen har subtile avhengigheter til React-state | Skriv tester FØRST for domain-funksjoner, deretter refaktorer modalen |
| Type-inkompatibilitet med eksisterende VederlagResponseInput | Gjenbruk typer fra timeline.ts der mulig, ny VederlagFormState for intern state |
| Submit-handler har sideeffekter (toast, mutation) | buildEventData returnerer kun data — sideeffekter forblir i modalen |

## Forventet resultat

```
src/domain/
├── fristDomain.ts          (317 linjer - eksisterende)
├── grunnlagDomain.ts       (193 linjer - eksisterende)
├── vederlagDomain.ts       (~350-400 linjer - NY)
└── __tests__/
    ├── fristDomain.test.ts     (eksisterende)
    ├── grunnlagDomain.test.ts  (eksisterende)
    └── vederlagDomain.test.ts  (~300-350 linjer - NY)
```
