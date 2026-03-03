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

## 4. Revurdert: UI-redesign eliminerer nøkkelargumenter for React

Tre faktorer endrer bildet fundamentalt:

### 4.1 Modaler forsvinner — ny panel-basert arkitektur

Designdokumentet `DESIGN_WORKSPACE_PANELS.md` beskriver en tre-panel workspace:

```
┌──────────┬──────────────────────────────┬────────────┐
│ Venstre  │       Midtpanel              │  Høyre-    │
│ nav      │  ① Kravhode                  │  panel     │
│          │  ② Posisjonskort             │            │
│          │  ③ Beslutningsfelt           │  Begrunnelse│
│          │  ④ Resultatboks              │  (TipTap)  │
│          │  ─── Footer ───              │            │
└──────────┴──────────────────────────────┴────────────┘
```

**Konsekvens:** De 2000-linjers wizard-modalene (RespondVederlagModal, RespondFristModal) erstattes av in-place redigering i paneler. Dette var React's sterkeste kort — RHF's Controller/watch-mønster for multi-step modaler. I den nye designen med verdict-knapper, inline tall-inputs, og sonebasert layout er skjema-mønsteret **enklere og mer deklarativt** — noe som spiller til Svelte's styrker.

Nye UI-mønstre som favoriserer Svelte:
- **Verdict-knapper** (Godkjent/Delvis/Avslått) — enkel `bind:group` i Svelte vs Controller + onChange i React
- **Inline tall-inputs med live beregning** — `$derived` gir gratis reaktiv differanse uten `useMemo`
- **Betinget synlighet med overganger** — Svelte har innebygd `transition:slide`, React trenger Framer Motion eller CSS
- **Konsekvens-callouts** som dukker opp basert på valg — `{#if}` med `transition:` er idiomatisk Svelte

### 4.2 PDF flyttes til backend

`@react-pdf/renderer` var den sterkeste React-spesifikke avhengigheten uten Svelte-ekvivalent. Med server-side PDF-generering forsvinner denne bindingen.

### 4.3 Radix UI → Bits UI er overkommelig

De 11 Radix UI-pakkene (Dialog, Select, Radio, Checkbox, Popover, etc.) har direkte ekvivalenter i Bits UI. Begge er headless, tilgjengelige, og Tailwind-kompatible. API-overflaten er forskjellig men konseptuelt identisk.

### 4.4 Hva som faktisk gjenbrukes direkte

Med redesign er «88K linjer»-argumentet misvisende. Her er hva som faktisk har verdi:

| Lag | Linjer (ca.) | Gjenbruk i Svelte |
|-----|-------------|-------------------|
| Domenelogikk (`src/domain/`) | 1 777 | **100% direkte** — rene TS-funksjoner |
| TypeScript-typer (`src/types/`) | 2 520 | **100% direkte** |
| Utilities og formattering | 1 200 | **100% direkte** |
| Konstanter | 800 | **100% direkte** |
| API-klient (`src/api/`) | 1 500 | **~80% direkte** — fetch-wrapper er agnostisk |
| Backend (Python) | ~15 000 | **100% uberørt** |
| **Sum gjenbrukbart** | **~22 000** | |
| **Sum som skrives om** | **~66 000** | Komponenter, hooks, contexts, pages |

Men: 66 000 linjer som skrives om var **allerede planlagt** pga. UI-redesign. Spørsmålet er ikke "skal vi skrive om?" men "skriver vi om til React eller Svelte?"

### 4.5 Subsidiær logikk og forretningsregler

Den subsidiære logikken med 8 triggere og 256 teoretiske kombinasjoner bor i `src/domain/vederlagDomain.ts` som rene funksjoner. **Identisk uansett framework.** Det nye UI-et representerer prinsipalt + subsidiært resultat i sone ④ (Resultatboks) — begge frameworks er like kapable her.

### 4.6 Event Sourcing-mønsteret

Event sourcing (CloudEvents-format, immutable events, state-projeksjoner) er **fundamentalt framework-agnostisk**. TanStack Query fungerer identisk i begge. SvelteKit's `load`-funksjoner er et alternativ til React Query for initial datahenting.

---

## 5. Revidert beslutningsmatrise (med UI-redesign)

| Kriterium | Vekt | React | Svelte 5 | Kommentar |
|-----------|------|-------|----------|-----------|
| Skjema-kompleksitet | Høy | 7/10 | 8/10 | Panel-design favoriserer Svelte's `bind:` og `$derived` |
| Ytelse | Middels | 7/10 | 9/10 | Finkornet reaktivitet i tett panel-layout |
| Kode-volum/DX | Høy | 6/10 | 9/10 | Svelte eliminerer hooks-boilerplate, innebygde overganger |
| Økosystem/biblioteker | Middels | 8/10 | 7/10 | Med PDF backend-side og Bits UI er gapet mindre |
| Talent/rekruttering | Høy | 9/10 | 4/10 | Uendret — stor forskjell |
| TypeScript-støtte | Middels | 9/10 | 8/10 | Begge sterke |
| Migreringsrisiko | Middels | 8/10 | 6/10 | UI skrives om uansett, domain gjenbrukes |
| Langsiktig vedlikehold | Middels | 8/10 | 8/10 | Begge stabile |
| Innebygde overganger | Middels | 5/10 | 9/10 | Svelte: native. React: trenger library |
| Panel-layout med live state | Høy | 7/10 | 9/10 | $derived + $effect uten dependency arrays |

**Revidert vektet vurdering:**
- **React: 7.3/10**
- **Svelte 5: 7.6/10**

**Gapet er nå marginalt — med Svelte i marginal ledelse.**

---

## 6. Anbefaling

### Scenarioene er jevnere enn forventet

Med UI-redesign, PDF på backend, og Bits UI som Radix-erstatning har de tre sterkeste argumentene for React falt bort. To faktorer gjenstår:

#### Argument for React: Rekruttering
Det er enklere å finne React-utviklere i Norge. Svelte-kompetanse er nisje. For et team som skal vokse er dette vesentlig.

#### Argument for Svelte: Kode-kvalitet i den nye designen
Panel-layouten med verdict-knapper, inline inputs, live beregninger, og betingede konsekvens-callouts er *ekstremt* idiomatisk Svelte. Estimert 30–40% mindre kode, uten hooks-boilerplate, med innebygde overganger. For et lite team som vedlikeholder dette selv gir det lavere kognitiv belastning.

### Anbefalte alternativer

**Alternativ A: Fortsett med React (trygt)**
- Reimplementer UI-designen i React med ny komponentarkitektur
- Bruk React 19 features (use(), server components i fremtiden)
- Forenkling mulig: bytt fra RHF-wizards til enklere controlled components tilpasset panel-layout
- Risiko: lav

**Alternativ B: Migrer til Svelte 5/SvelteKit (bedre DX, høyere risiko)**
- Gjenbruk 22 000 linjer domain/types/api/backend direkte
- Skriv ny UI med Svelte 5 + Bits UI + Superforms + TanStack Query Svelte
- `transition:slide` og `$derived` gjør panel-designen mer naturlig
- Risiko: middels — primært rekruttering og Tiptap Svelte-wrapper modning

**Alternativ C: Hybrid — SvelteKit for nye features, React for eksisterende**
- Beholder eksisterende React for saksoversikt, analytics, integrasjoner
- Bygger den nye panel-arbeidsflaten i SvelteKit som egen mikro-frontend
- Domain-logikk deles via npm-pakke
- Risiko: middels — to frameworks å vedlikeholde, men gradvis migrering

### Min reviderte vurdering

Hadde jeg startet dette prosjektet i dag med panel-designen som mål, ville jeg valgt **Svelte 5/SvelteKit**. Domenelogikken er allerede framework-agnostisk. PDF er på backend. Bits UI dekker Radix-behovene. Den nye UI-designen med verdict-knapper, inline beregninger og sonebasert layout er skapt for Svelte's reaktivitetsmodell.

Men: **valget av framework er sekundært til valget av arkitektur.** Den viktigste beslutningen var allerede tatt — å trekke ut NS 8407-logikken i `src/domain/`. Det gjør at framework-valget er reversibelt.

---

## Appendiks: Panel-mønster — React vs Svelte 5

For å gjøre sammenligningen konkret, her er et forenklet eksempel basert på den nye panel-designen (DESIGN_WORKSPACE_PANELS.md). Viser sone ③ (Beslutningsfelt) for vederlag-spor med verdict-knapper, inline beregning, og betingede innsigelser.

### React (ny panel-design)

```tsx
// VederlagBeslutningsfelt.tsx
import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  beregnGodkjentBelop,
  beregnSubsidiaerTriggers,
} from '../../domain/vederlagDomain';

type Verdict = 'godkjent' | 'delvis' | 'avslatt';

export function VederlagBeslutningsfelt({ sakState, onSubmit }) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [godkjentBelop, setGodkjentBelop] = useState<number>(0);
  const [innsigelser, setInnsigelser] = useState<Record<string, boolean>>({});

  const krevdBelop = sakState.vederlag.krevdBelop;

  // Domain logic — useMemo med dependency arrays
  const differanse = useMemo(() =>
    krevdBelop - godkjentBelop, [krevdBelop, godkjentBelop]);
  const forhandlingsgrad = useMemo(() =>
    krevdBelop > 0 ? (godkjentBelop / krevdBelop) * 100 : 0,
    [godkjentBelop, krevdBelop]);
  const triggers = useMemo(() =>
    beregnSubsidiaerTriggers({ verdict, innsigelser }, sakState),
    [verdict, innsigelser, sakState]);

  const handleVerdictChange = useCallback((v: Verdict) => {
    setVerdict(v);
    if (v === 'godkjent') setGodkjentBelop(krevdBelop);
    if (v === 'avslatt') setGodkjentBelop(0);
  }, [krevdBelop]);

  return (
    <section className="space-y-5">
      {/* Verdict-knapper */}
      <div>
        <span className="text-[11px] font-medium uppercase tracking-[0.06em]
          text-pkt-text-body-subtle">Din vurdering</span>
        <div className="mt-3 flex gap-2">
          {(['godkjent', 'delvis', 'avslatt'] as const).map(v => (
            <button key={v} onClick={() => handleVerdictChange(v)}
              className={`flex-1 h-9 text-[13px] font-medium rounded-[2px]
                border transition-all duration-150 ${
                verdict === v
                  ? v === 'godkjent' ? 'bg-pkt-brand-dark-green text-white border-transparent'
                  : v === 'avslatt' ? 'bg-pkt-brand-red text-white border-transparent'
                  : 'bg-pkt-brand-amber text-white border-transparent'
                  : 'bg-pkt-bg-subtle border-pkt-border-subtle hover:border-pkt-border-default'
              }`}>
              {v === 'godkjent' ? 'Godkjent' : v === 'delvis' ? 'Delvis godkjent' : 'Avslått'}
            </button>
          ))}
        </div>
      </div>

      {/* Beløp — betinget synlig */}
      <AnimatePresence>
        {verdict === 'delvis' && (
          <motion.div initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}>
            <label className="text-[13px] text-pkt-text-body-subtle">
              Godkjent beløp
            </label>
            <input type="number" value={godkjentBelop}
              onChange={e => setGodkjentBelop(Number(e.target.value))}
              className="w-full h-9 bg-pkt-bg-subtle border border-pkt-border-subtle
                rounded-[2px] px-3 font-mono text-sm tabular-nums" />
            <span className={`text-[11px] mt-1 ${
              forhandlingsgrad >= 70 ? 'text-pkt-brand-dark-green'
              : forhandlingsgrad >= 40 ? 'text-pkt-brand-amber'
              : 'text-pkt-brand-red'
            }`}>
              Differanse: {differanse.toLocaleString('nb-NO')} kr
              ({forhandlingsgrad.toFixed(0)}% godkjent)
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Konsekvens-callout */}
      <AnimatePresence>
        {triggers.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-3 rounded bg-amber-50 border-l-[3px] border-pkt-brand-amber">
            <p className="text-[13px]">
              Subsidiært standpunkt aktivert — {triggers.length} trigger(e)
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
```

### Svelte 5 (ny panel-design)

```svelte
<!-- VederlagBeslutningsfelt.svelte -->
<script lang="ts">
  import { slide, fade } from 'svelte/transition';
  import { beregnSubsidiaerTriggers } from '$lib/domain/vederlagDomain';
  import type { SakState } from '$lib/types';

  type Verdict = 'godkjent' | 'delvis' | 'avslatt';

  let { sakState, onsubmit }: {
    sakState: SakState;
    onsubmit: (data: any) => void;
  } = $props();

  let verdict = $state<Verdict | null>(null);
  let godkjentBelop = $state(0);
  let innsigelser = $state<Record<string, boolean>>({});

  let krevdBelop = $derived(sakState.vederlag.krevdBelop);
  let differanse = $derived(krevdBelop - godkjentBelop);
  let forhandlingsgrad = $derived(
    krevdBelop > 0 ? (godkjentBelop / krevdBelop) * 100 : 0
  );
  let triggers = $derived(
    beregnSubsidiaerTriggers({ verdict, innsigelser }, sakState)
  );

  function velgVerdict(v: Verdict) {
    verdict = v;
    if (v === 'godkjent') godkjentBelop = krevdBelop;
    if (v === 'avslatt') godkjentBelop = 0;
  }

  const verdictConfig = [
    { key: 'godkjent', label: 'Godkjent', color: 'bg-pkt-brand-dark-green' },
    { key: 'delvis', label: 'Delvis godkjent', color: 'bg-pkt-brand-amber' },
    { key: 'avslatt', label: 'Avslått', color: 'bg-pkt-brand-red' },
  ] as const;
</script>

<section class="space-y-5">
  <!-- Verdict-knapper -->
  <div>
    <span class="text-[11px] font-medium uppercase tracking-[0.06em]
      text-pkt-text-body-subtle">Din vurdering</span>
    <div class="mt-3 flex gap-2">
      {#each verdictConfig as { key, label, color }}
        <button onclick={() => velgVerdict(key)}
          class="flex-1 h-9 text-[13px] font-medium rounded-[2px]
            border transition-all duration-150
            {verdict === key
              ? `${color} text-white border-transparent`
              : 'bg-pkt-bg-subtle border-pkt-border-subtle hover:border-pkt-border-default'}">
          {label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Beløp — betinget synlig med innebygd overgang -->
  {#if verdict === 'delvis'}
    <div transition:slide={{ duration: 200 }}>
      <label class="text-[13px] text-pkt-text-body-subtle">
        Godkjent beløp
      </label>
      <input type="number" bind:value={godkjentBelop}
        class="w-full h-9 bg-pkt-bg-subtle border border-pkt-border-subtle
          rounded-[2px] px-3 font-mono text-sm tabular-nums" />
      <span class="text-[11px] mt-1 {forhandlingsgrad >= 70
        ? 'text-pkt-brand-dark-green'
        : forhandlingsgrad >= 40 ? 'text-pkt-brand-amber'
        : 'text-pkt-brand-red'}">
        Differanse: {differanse.toLocaleString('nb-NO')} kr
        ({forhandlingsgrad.toFixed(0)}% godkjent)
      </span>
    </div>
  {/if}

  <!-- Konsekvens-callout -->
  {#if triggers.length > 0}
    <div transition:fade={{ duration: 150 }}
      class="p-3 rounded bg-amber-50 border-l-[3px] border-pkt-brand-amber">
      <p class="text-[13px]">
        Subsidiært standpunkt aktivert — {triggers.length} trigger(e)
      </p>
    </div>
  {/if}
</section>
```

### Sammenligning

| Aspekt | React | Svelte 5 |
|--------|-------|----------|
| Linjer kode | ~85 | ~55 |
| Overganger | AnimatePresence + motion (ekstern dep) | `transition:slide` (innebygd) |
| Reaktive beregninger | 3x `useMemo` med dep arrays | 3x `$derived` (automatisk) |
| Event handlers | `useCallback` + setter-funksjoner | Vanlige funksjoner |
| Input binding | `value` + `onChange` | `bind:value` |
| Ekstra dependencies | framer-motion (~30kb) | Ingen |
| Domenelogikk | Identisk | Identisk |

Det nye panel-designet med verdict-knapper, inline beregninger, og betingede overganger er **mer naturlig i Svelte**. Forskjellen er ikke dramatisk — men for 50+ slike kontroller i arbeidsflaten akkumuleres 30–40% mindre kode til en merkbar forskjell i vedlikeholdbarhet.

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
