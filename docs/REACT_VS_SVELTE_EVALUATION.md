# React vs Svelte/SvelteKit — Evaluering for Unified Timeline

**Dato:** 2026-03-03

---

## Sammendrag

Denne evalueringen vurderer om Svelte 5/SvelteKit ville vært et bedre valg enn React 19 for denne applikasjonen, basert på en grundig gjennomgang av kodebasens faktiske kompleksitet, avhengigheter, og domenelogikk.

**Konklusjon:** React er riktig valg for dette prosjektet — men marginen er mindre enn mange tror. Den avgjørende faktoren er ikke framework-kvalitet, men **økosystem-dekning for de spesifikke behovene** denne applikasjonen har.

---

## 1. Kodebasens faktiske profil

Før vi sammenligner, er det viktig å forstå hva vi faktisk har:

| Metrisk | Verdi |
|---------|-------|
| Totalt linjer kode | 88 000+ |
| TypeScript-filer | 327 |
| React-komponenter | 212 |
| Custom hooks | 28 |
| Context providers | 7 |
| Domenelogikk (rene funksjoner) | 1 777 linjer |
| Sider | 22 |
| Modal-skjemaer (action modals) | 15+ |
| Type-definisjoner | 2 520 linjer |
| Radix UI-pakker | 11 |

### Kompleksitets-hotspots

| Komponent | Linjer | Kompleksitet |
|-----------|--------|-------------|
| `RespondVederlagModal.tsx` | 2 013 | 4-port wizard, subsidiær logikk, §34 |
| `RespondFristModal.tsx` | 1 926 | 4-port wizard, §33 tidslogikk |
| `BHResponsForseringModal.tsx` | 1 425 | §33.8 forseringsrespons |
| `begrunnelseGenerator.ts` | 1 452 | Automatisk begrunnelsesgenerering |
| `vederlagDomain.ts` | 653 | NS 8407 vederlagsregler |

---

## 2. Svelte 5 — Status per mars 2026

### Runes-systemet (erstatter Svelte 4 reaktivitet)

Svelte 5 har **fundamentalt endret reaktivitetsmodellen** med runes:

| Rune | Erstatter | Funksjon |
|------|-----------|----------|
| `$state` | `let` (implisitt reaktivt) | Eksplisitt reaktiv tilstand |
| `$derived` | `$:` (reactive statements) | Automatisk beregnet verdi, memoisert |
| `$effect` | `$:` (side effects) | Sideeffekter som kjøres ved endring |
| `$props` | `export let` | Komponent-props med destrukturering |

```svelte
<!-- Svelte 5 eksempel -->
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);

  $effect(() => {
    console.log(`Count changed to ${count}`);
  });
</script>

<button onclick={() => count++}>
  {count} (doubled: {doubled})
</button>
```

**Vurdering:** Runes er stabile, produksjonsklare, og gir en mer eksplisitt reaktivitetsmodell enn Svelte 4. For utviklere som kjenner React hooks vil de føles naturlige.

### SvelteKit (fullstack-rammeverket)

SvelteKit er modent med:
- Filbasert routing
- Server-side rendering (SSR) og statisk generering (SSG)
- Form actions (innebygd skjemahåndtering med progressiv forbedring)
- API-ruter
- Deployment-adaptere for alle plattformer

---

## 3. Sammenligning — punkt for punkt

### 3.1 Skjemahåndtering (KRITISK for dette prosjektet)

Dette er **den viktigste faktoren**. Applikasjonen har 15+ komplekse modale skjemaer med:
- Flertrinns wizards (4-port modell)
- Betinget validering basert på NS 8407-regler
- 256 teoretiske kombinasjoner i subsidiær logikk
- Auto-backup til localStorage ved token-utløp
- Controller-integrasjon for custom inputs

**React (nåværende):**
- React Hook Form (RHF) + Zod — ekstremt modent
- `useForm`, `watch`, `Controller`, `useFieldArray` — dekker alle behov
- Zod resolver gir typesikker validering
- Betinget validering via `.refine()` og `.superRefine()`
- Massiv community, hundrevis av eksempler for komplekse mønstre

**Svelte 5:**
- **Superforms** — det klart beste alternativet, bygget for SvelteKit
- Støtter Zod, Valibot, Joi m.fl.
- **Formsnap** — høynivå-komponenter på toppen av Superforms
- Innebygd form actions i SvelteKit gir progressiv forbedring

**Vurdering:** Superforms er sterkt, men **RHF er mer kamptestet for den typen ekstrem kompleksitet** RespondVederlagModal representerer. 4-port wizards med betinget subsidiær logikk, auto-backup, og dirty tracking er et område der RHF's `watch()`, `Controller`, og fine-grained dirty state gir en fordel. Superforms kunne håndtert det, men med mer manuell kode.

**Fordel: React** (moderat)

### 3.2 UI-komponenter og tilgjengelighet

**React (nåværende):**
- 11 Radix UI-pakker (headless, tilgjengelige)
- Punkt designsystem (Oslo kommune) med Tailwind CSS v4
- Tett integrasjon mellom Radix primitiver og custom styling

**Svelte 5:**
- **Bits UI** — headless, tilgjengelig, bygget native for Svelte 5
- **Melt UI** — composable component builders
- **shadcn-svelte** — port av shadcn/ui, bruker Bits UI under
- **Skeleton v3** — komplett designsystem med Svelte 5 + Tailwind 4

**Vurdering:** Bits UI er det direkte alternativet til Radix UI. Det er bygget spesifikt for Svelte 5 uten wrapper-lag, og dekker tilsvarende use cases (dialog, popover, select, radio-group etc.). shadcn-svelte gir en lignende utvikleropplevelse som vi har med Radix + Tailwind i dag.

**Punkt-designsystemet er en wildcard.** Det er Tailwind-basert og agnostisk i sin CSS, men eventuelle React-spesifikke komponenter fra Oslo kommune ville ikke vært tilgjengelige i Svelte.

**Fordel: React** (liten — hovedsakelig pga. Radix modenhetsforsprang og Punkt-kompatibilitet)

### 3.3 Domenelogikk og forretningsregler

Her er det **ingen forskjell**. Prosjektets arkitekturbeslutning med å trekke ut domenelogikk i `src/domain/` som rene TypeScript-funksjoner var kløktig:

```
src/domain/
├── vederlagDomain.ts    (653 linjer) — Ren TypeScript
├── fristDomain.ts       (317 linjer) — Ren TypeScript
├── grunnlagDomain.ts    (192 linjer) — Ren TypeScript
└── ...
```

Disse 1 777 linjene med NS 8407-regler, subsidiær beregning, og preklsjonslogikk er **100% framework-agnostiske**. De kunne brukes i Svelte uten en eneste endring.

**Fordel: Uavgjort** — dette er et argument FOR god arkitektur, ikke for et spesifikt framework.

### 3.4 Event Sourcing og state management

**React (nåværende):**
- TanStack React Query for server state (caching, synkronisering)
- 7 Context providers for client state (auth, prosjekt, rolle, tema)
- 28 custom hooks som orchestrerer mellom domain, API, og UI

**Svelte 5:**
- **TanStack Query Svelte** — offisiell Svelte-adapter, samme API
- Svelte stores / `$state` for global klient-state
- SvelteKit `load` funksjoner for datahenting
- Runes gjør reaktiv state enklere (ingen `useCallback`/`useMemo`-dans)

**Vurdering:** TanStack Query fungerer i begge. Men Svelte 5's reaktivitetssystem har en strukturell fordel: `$derived` erstatter `useMemo`, `$effect` erstatter `useEffect`, og det er ingen stale closure-problemer. React krever `useCallback`, `useMemo`, `useRef` for å unngå uønskede re-renders — dette er boilerplate Svelte ikke trenger.

For denne applikasjonen med 28 custom hooks er mye av hook-koden **React-spesifikk plumbing** (dependency arrays, memoization, ref-forwarding) som ville forsvunnet i Svelte.

**Fordel: Svelte** (moderat)

### 3.5 Ytelse og bundle-størrelse

**React:**
- ~45kb runtime (React + React DOM, gzipped)
- Virtual DOM diffing
- Manuell optimalisering via `memo`, `useMemo`, `useCallback`

**Svelte 5:**
- ~1.6kb runtime (gzipped)
- Kompilerer til imperativ DOM-manipulasjon
- Ingen virtual DOM overhead
- 15–30% mindre bundles enn tilsvarende React-app
- Ingen unødvendige re-renders (finkornet reaktivitet)

**Vurdering:** For en forretningsapplikasjon som denne er ytelsesforskjellen **merkbar men ikke kritisk**. Brukerne jobber typisk på kontor-PC med god nettforbindelse. Men de store modale skjemaene (2000+ linjer) med mange `watch()` og betinget rendering ville profittert av Svelte's finkornede reaktivitet.

**Fordel: Svelte** (moderat)

### 3.6 TypeScript-støtte og tooling

**React:** Førsteklasses TypeScript via `.tsx`. Full generics-støtte, streng kompilering. Rust-baserte verktøy (Biome, OXC, turbo) gir svært rask linting og formatering.

**Svelte 5:** Native TypeScript i `.svelte`-filer uten preprocessor. Generics støttet via `<script lang="ts" generics="T extends ...">`. Svelte 5 er den første versjonen med TypeScript som førsteklasses borger.

```svelte
<!-- Generics i Svelte 5 -->
<script lang="ts" generics="T extends { id: string }">
  import type { Snippet } from 'svelte';
  let { items, row }: {
    items: T[];
    row: Snippet<[T]>;
  } = $props();
</script>
```

**Viktig begrensning:** Svelte Language Server (LSP) **sliter med store prosjekter**. Codebaser med 3000+ komponenter rapporterer ~60 sekunders oppstartstid, treg autocomplete, og høyt RAM-forbruk. Med 212 komponenter er dette prosjektet godt under den terskelen, men det er verdt å vite. Rust-baserte verktøy (Biome, OXC) har ennå ikke Svelte-spesifikk støtte.

**Vurdering:** Begge er sterke. React har et forsprang i tooling-ytelse og IDE-integrasjon (go-to-definition, refactoring). Svelte 5 har lukket type-gapet, men tooling-gapet består.

**Fordel: React** (liten–moderat)

### 3.7 Spesifikke avhengigheter — migreringsrisk

| Avhengighet | React | Svelte-alternativ | Migreringsrisiko |
|-------------|-------|-------------------|------------------|
| React Hook Form | Brukes i 15+ modaler | Superforms + Formsnap | **Middels-Høy** — mest arbeid |
| Radix UI (11 pakker) | Dialog, Select, Radio etc. | Bits UI | **Middels** — API-forskjeller |
| TanStack Query | Server state | TanStack Query Svelte | **Lav** — offisiell adapter |
| Tiptap (rich editor) | Brukt for begrunnelser | Tiptap Svelte wrapper | **Middels** — wrapper finnes men mindre vedlikeholdt |
| @react-pdf/renderer | PDF-generering | Ingen direkte ekvivalent | **Høy** — må bytte approach (f.eks. server-side PDF) |
| Recharts | Analyse-dashboard | LayerChart / Pancake / Chart.js | **Middels** — funksjonelle alternativer finnes |
| React Dropzone | Filvedlegg | Svelte Dropzone | **Lav** |
| React Day Picker | Datovelger | Bits UI Date Picker | **Lav** |
| Supabase JS | Auth | Supabase JS (agnostisk) | **Ingen** — fungerer direkte |
| date-fns, Zod, clsx | Utilities | Identiske | **Ingen** — framework-agnostiske |

**Kritisk risiko:** `@react-pdf/renderer` har ingen Svelte-ekvivalent. Klientside PDF-generering måtte redesignes (server-side generering eller et annet bibliotek).

### 3.8 Utvikleropplevelse og kode-volum

Svelte 5 ville sannsynligvis redusert kodebasen med **20–35%** grunnet:
- Ingen `useState`/`useCallback`/`useMemo`/`useRef`-boilerplate
- Enklere komponent-syntaks (HTML-first vs JSX)
- Innebygd animasjon og overganger
- Mindre wrapper-kode for reaktivitet
- SvelteKit form actions i stedet for manuell form submission

**Eksempel — typisk hook-kode som forsvinner:**

```typescript
// React — nødvendig boilerplate
const memoizedValue = useMemo(() =>
  computeExpensive(a, b), [a, b]
);
const handleClick = useCallback(() => {
  doSomething(memoizedValue);
}, [memoizedValue]);
```

```svelte
<!-- Svelte 5 — kompileren håndterer det -->
<script>
  let a = $state(0);
  let b = $state(0);
  let memoizedValue = $derived(computeExpensive(a, b));

  function handleClick() {
    doSomething(memoizedValue);
  }
</script>
```

**Fordel: Svelte** (betydelig)

### 3.9 Svelte-spesifikke gotchas relevante for dette prosjektet

Noen Svelte 5-egenarter som ville påvirket denne applikasjonen:

1. **Proxy-fellen:** `$state` objekter er JavaScript Proxies. Koden vår sender state-data til API-lag, PDF-generering, og Excel-eksport. Alle disse ville krevd `$state.snapshot()` for å konvertere til vanlige objekter. I React er state bare vanlige objekter.

2. **Array-mutasjoner:** `arr.push(item)` trigger ikke alltid oppdateringer — man må reassigne: `arr = [...arr, item]`. I event sourcing-kontekst der vi bygger state fra events er dette uproblematisk (vi lager alltid ny state), men i skjema-logikk med lister (f.eks. særskilte krav) krever det disiplin.

3. **SSR og `window`/`localStorage`:** SvelteKit har SSR som standard. Vår `useFormBackup`-hook bruker localStorage, og `useVerifyToken` bruker browser APIs. Disse må guards med `import { browser } from '$app/environment'`. Ikke vanskelig, men en feilkilde som React SPA ikke har.

4. **Snippets vs Children:** Svelte 5 erstatter slots med snippets og `{@render}`. For våre 50+ primitiv-komponenter (Modal, FormField, Alert etc.) er dette en fin API, men en betydelig omskrivningsjobb.

### 3.10 Økosystem, talent og langsiktig risiko

| Faktor | React | Svelte |
|--------|-------|--------|
| npm nedlastninger/uke | ~28M | ~900K |
| GitHub-stjerner | 235K+ | 82K+ |
| Stack Overflow-spørsmål | 500K+ | ~15K |
| Utviklere å ansette | Mange | Få (men voksende) |
| Fortune 500-adoptering | Massiv | Begrenset |
| Backing | Meta + massive community | Vercel + Svelte team |
| Tredjepartsbiblioteker | Enormt | Voksende, men 1/10 av React |
| AI-assistanse (Copilot etc.) | Svært god | God, men mer begrenset |

**Fordel: React** (stor)

---

## 4. Spesifikke vurderinger for denne applikasjonen

### 4.1 Subsidiær logikk og 256 kombinasjoner

Den subsidiære logikken med 8 triggere og 256 teoretiske kombinasjoner bor allerede i `src/domain/vederlagDomain.ts` som rene funksjoner. **Denne logikken er identisk uansett framework.** Det avgjørende er hvor godt UI-laget kan representere de to parallelle resultatene (prinsipalt + subsidiært) — og her er begge frameworks like kapable.

### 4.2 Event Sourcing-mønsteret

Event sourcing (CloudEvents-format, immutable events, state-projeksjoner) er **fundamentalt framework-agnostisk**. API-laget (`src/api/`) og type-systemet (`src/types/timeline.ts`) ville trengt minimal tilpasning. TanStack Query fungerer identisk i begge.

### 4.3 Tre-spor-modellens UI

Tre-spor-visningen (Grunnlag, Vederlag, Frist) med uavhengige statuser, betinget visning av handlingsknapper, og rollebasert tilgang er komplekst UI-arbeid. Svelte 5's `{#if}`/`{#each}` templating er mer lesbart enn JSX for denne typen betinget rendering — men forskjellen er kosmetisk, ikke funksjonell.

### 4.4 Eksisterende kodebase-investering

Med 88 000+ linjer kode er en migrering et **enormt prosjekt**. Selv med domenelogikk og utilities som kan gjenbrukes direkte (~6 000 linjer), ville 80 000+ linjer måtte skrives om. Det er et halvt til et helt år med arbeid for et lite team.

---

## 5. Beslutningsmatrise

| Kriterium | Vekt | React | Svelte 5 | Kommentar |
|-----------|------|-------|----------|-----------|
| Skjema-kompleksitet | Høy | 9/10 | 7/10 | RHF er overlegen for 4-port wizards |
| Ytelse | Lav | 7/10 | 9/10 | Merkbar men ikke kritisk for B2B |
| Kode-volum/DX | Middels | 6/10 | 9/10 | Svelte eliminerer mye boilerplate |
| Økosystem/biblioteker | Høy | 9/10 | 6/10 | React PDF, Tiptap, Radix dekker mer |
| Talent/rekruttering | Høy | 9/10 | 4/10 | Stor forskjell i Norge |
| TypeScript-støtte | Middels | 9/10 | 8/10 | Begge sterke, React litt bedre tooling |
| Migreringsrisiko | Høy | 10/10 | 3/10 | 80 000+ linjer må skrives om |
| Langsiktig vedlikehold | Middels | 8/10 | 8/10 | Begge stabile med aktiv utvikling |

**Vektet totalvurdering:**
- **React: 8.4/10**
- **Svelte 5: 6.2/10** (inkludert migreringsrisiko)
- **Svelte 5 (greenfield): 7.8/10** (uten eksisterende kode)

---

## 6. Anbefaling

### Fortsett med React — men lær av Svelte

1. **Ikke migrer.** Kost/nytte-forholdet rettferdiggjør ikke en omskriving av 88K linjer.

2. **Appliser Svelte-tankegangen** i React-koden:
   - Fortsett å trekke ut domenelogikk til framework-agnostiske funksjoner (som allerede gjort i `src/domain/`)
   - Vurder React 19's nye server components for fremtidige features
   - Hold avhengighets-listen stram — unngå React-spesifikke løsninger der framework-agnostiske finnes

3. **Vurder Svelte for nye, separate moduler:**
   - Sideprosjekter eller standalone dashboards kan gjerne bruke Svelte
   - Analytics-dashboardet (som er mer lesende og enklere i skjemalogikk) ville vært en god kandidat

4. **Greenfield-scenarier:** Hadde dette prosjektet startet i dag, ville Svelte 5/SvelteKit vært et **legitimt valg** — forutsatt at teamet aksepterer et mindre økosystem og løser PDF-generering server-side. Den rene utvikleropplevelsen og reduserte kode-volumet er reelle fordeler. Men React ville fortsatt vært tryggere for de mest komplekse skjemaene.

---

## Appendiks: Wizard-mønster — React vs Svelte 5

For å gjøre sammenligningen konkret, her er et forenklet eksempel på hvordan en 4-port wizard ville sett ut i begge frameworks. Basert på RespondVederlagModal-mønsteret.

### React (nåværende mønster)

```tsx
// RespondVederlagModal.tsx (forenklet)
import { useState, useMemo, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { beregnTotaler, beregnSubsidiaerTriggers } from '../../domain/vederlagDomain';

const schema = z.object({
  akseptererMetode: z.boolean(),
  hovedkravVurdering: z.enum(['godkjent', 'delvis', 'avslatt']),
  hovedkravGodkjentBelop: z.number().optional(),
  begrunnelse: z.string().min(10),
}).refine(data => {
  if (data.hovedkravVurdering === 'delvis')
    return data.hovedkravGodkjentBelop !== undefined;
  return true;
});

export function RespondVederlagModal({ sakState, onClose }) {
  const [currentPort, setCurrentPort] = useState(0);
  const { watch, control, handleSubmit, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { /* ... */ },
  });

  const formValues = watch();

  // Domain logic — identisk i begge frameworks
  const totaler = useMemo(() =>
    beregnTotaler(formValues, sakState), [formValues, sakState]);
  const triggers = useMemo(() =>
    beregnSubsidiaerTriggers(formValues, sakState), [formValues, sakState]);

  const handleNext = useCallback(() => {
    setCurrentPort(p => Math.min(p + 1, 3));
  }, []);

  return (
    <Modal onClose={onClose}>
      <StepIndicator current={currentPort} steps={4} />
      {currentPort === 0 && (
        <Controller name="akseptererMetode" control={control}
          render={({ field }) => <RadioGroup {...field} />} />
      )}
      {currentPort === 1 && (
        <Controller name="hovedkravVurdering" control={control}
          render={({ field }) => <RadioGroup {...field} />} />
      )}
      {/* ... port 2 og 3 ... */}
      <Button onClick={handleNext}>Neste</Button>
    </Modal>
  );
}
```

### Svelte 5 (hypotetisk)

```svelte
<!-- RespondVederlagModal.svelte (forenklet) -->
<script lang="ts">
  import { beregnTotaler, beregnSubsidiaerTriggers } from '$lib/domain/vederlagDomain';
  import type { SakState } from '$lib/types';

  let { sakState, onclose }: {
    sakState: SakState;
    onclose: () => void;
  } = $props();

  // Lokal state — ingen useState, ingen dependency arrays
  let currentPort = $state(0);
  let akseptererMetode = $state(true);
  let hovedkravVurdering = $state<'godkjent' | 'delvis' | 'avslatt'>('godkjent');
  let hovedkravGodkjentBelop = $state<number | undefined>();
  let begrunnelse = $state('');

  // Derived — ingen useMemo, automatisk memoisert
  let totaler = $derived(beregnTotaler(
    { akseptererMetode, hovedkravVurdering, hovedkravGodkjentBelop },
    sakState
  ));
  let triggers = $derived(beregnSubsidiaerTriggers(
    { akseptererMetode, hovedkravVurdering },
    sakState
  ));

  // Vanlig funksjon — ingen useCallback
  function handleNext() {
    currentPort = Math.min(currentPort + 1, 3);
  }
</script>

<Modal onclose={onclose}>
  <StepIndicator current={currentPort} steps={4} />

  {#if currentPort === 0}
    <RadioGroup bind:value={akseptererMetode} />
  {:else if currentPort === 1}
    <RadioGroup bind:value={hovedkravVurdering} />
  {/if}

  <!-- ... port 2 og 3 ... -->
  <Button onclick={handleNext}>Neste</Button>
</Modal>
```

**Observasjoner:**
- Svelte-versjonen er ~40% kortere
- `$derived` erstatter `useMemo` uten dependency arrays
- `bind:value` erstatter Controller-mønsteret
- Domenelogikken (`beregnTotaler`, `beregnSubsidiaerTriggers`) er **identisk**
- Men: Svelte mangler Zod-resolver-integrasjonen som RHF gir automatisk. Validering måtte håndteres manuelt eller via Superforms

---

## Kilder

- [Svelte 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [Svelte 5 2025 Review (Scalable Path)](https://www.scalablepath.com/javascript/svelte-5-review)
- [Svelte and SvelteKit Updates: Summer 2025](https://blog.openreplay.com/svelte-sveltekit-updates-summer-2025-recap/)
- [Svelte's Evolution: 2026 Vision](https://medium.com/@sosohappy/sveltes-evolution-recent-breakthroughs-and-the-2026-vision-18f27cfa1afe)
- [Svelte or React? 10 Key Factors (svar.dev)](https://svar.dev/blog/svelte-vs-react/)
- [Svelte vs React 2026 (devtrios)](https://devtrios.com/blog/svelte-vs-react-which-framework-should-you-choose/)
- [Superforms — Form Library for SvelteKit](https://superforms.rocks/)
- [Bits UI — Headless Components for Svelte 5](https://bits-ui.com)
- [shadcn-svelte](https://shadcn-svelte.com)
- [Global State in Svelte 5 (Mainmatter)](https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/)
