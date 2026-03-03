# Metaplan — Greenfield SvelteKit-implementering av KOE CasePage

**Dato:** 2026-03-03
**Status:** Utkast til gjennomgang
**Scope:** Kun CasePage (Forhandlingsbordet + Spordetalj/Arbeidsflaten) med nytt design. Ikke forsering, analytics, integrasjoner, endringsordre.

---

## 1. Beslutninger som må tas først

### 1.1 Repo-strategi (åpent spørsmål)

| Alternativ | Fordeler | Ulemper |
|-----------|----------|---------|
| **A: Nytt repo** | Rent utgangspunkt, ingen legacy-ballast | Duplisering av backend, separat CI/CD |
| **B: Monorepo med workspace** | Delt backend, delt domain-pakke, én CI | Mer config, risiko for lekkasje fra gammelt prosjekt |
| **C: Flytt inn i eksisterende Svelte-prosjekt** | Hvis et slikt finnes allerede — raskere start | Arver eksisterende teknisk gjeld |

**Avhengig av valg må vi avklare:**
- Hvordan backend deles (git submodule? monorepo workspace? API-only?)
- Hvordan domain-pakken (types, constants, domain, utils) pakketeres
- CI/CD-oppsett

### 1.2 SvelteKit vs ren Svelte+Vite

SvelteKit anbefales — gir filbasert routing, server-side rendering (valgfritt), form actions, og `$app/`-utilities. Men dette er en SPA med Flask-backend, så:
- **SvelteKit med `adapter-static`** — genererer SPA, men beholder SvelteKit-routing og load-funksjoner
- **SvelteKit med `ssr: false`** — ren SPA-modus, enklest integrering med eksisterende Flask-backend

---

## 2. Filer som tas med fra unified-timeline

### 2.1 Direkte kopiering (ren TypeScript, ingen React)

```
src/domain/                           # 1 782 linjer — NS 8407 forretningslogikk
├── grunnlagDomain.ts
├── vederlagDomain.ts
├── fristDomain.ts
├── fristSubmissionDomain.ts
├── vederlagSubmissionDomain.ts
└── __tests__/                        # 2 575 linjer — alle domenetester

src/types/                            # 1 441 linjer — alle domenetyper
├── timeline.ts                       # Kilden til sannhet: SporType, SubsidiaerTrigger, etc.
├── api.ts
├── index.ts
├── project.ts
└── membership.ts

src/constants/                        # 1 426 linjer — NS 8407-regler og UI-konstanter
├── categories.ts
├── varslingsregler.ts
├── responseOptions.ts
├── statusStyles.ts                   # Tailwind-basert — fungerer direkte
├── paymentMethods.ts
├── statusLabels.ts
├── eventTypeLabels.ts
├── fristVarselTypes.ts
├── varselMetoder.ts
└── index.ts

src/utils/                            # 2 327 linjer — formattering og domenehjelpere
├── begrunnelseGenerator.ts           # Juridisk korrekt begrunnelsestekst
├── preklusjonssjekk.ts              # Preklsusjonsfrister per kategori
├── formatters.ts                     # Valuta, dager, prosent
├── dateFormatters.ts                # Norsk datoformatering
└── fileUtils.ts                     # (valgfri) filvalidering

src/api/                             # 531 linjer — HTTP-klient
├── client.ts                        # fetch-wrapper med auth/CSRF/retry
├── state.ts                         # fetchCaseState, fetchTimeline
├── events.ts                        # submitEvent
├── projects.ts
└── membership.ts
```

**Plassering i SvelteKit:** `src/lib/` (tilgjengelig via `$lib/`-alias)

```
src/lib/
├── domain/          ← direkte kopi
├── types/           ← direkte kopi
├── constants/       ← direkte kopi
├── utils/           ← direkte kopi
└── api/             ← direkte kopi, minimal tilpasning
```

### 2.2 Designdokumenter (kopieres til docs/)

```
docs/design/
├── system.md                         # Analysebordet-tokensystem (dark theme tokens)
├── DESIGN_WORKSPACE_PANELS.md        # Arbeidsflaten — midtpanel + høyrepanel
├── koe-forhandlingsbord.md           # Forhandlingsbordet — oversiktsside
├── TASK3_DESIGN_PLAN.md              # Manglende TE-skjemaer
├── reviews/                          # Design-reviews per spor
│   ├── HANDOFF.md
│   ├── grunnlag-review.md
│   ├── vederlag-review.md
│   ├── frist-review.md
│   └── forsering-eo-review.md        # (ikke i scope, men referanse)
├── koe-mock.html                     # HTML-mockups
├── te-grunnlag-mock.html
└── spordetalj-mock.html
```

### 2.3 Backend-dokumentasjon (referanse)

```
docs/
├── BUSINESS_LOGIC.md                 # Domenebeskrivelse for grensesnittdesign
├── ARCHITECTURE_AND_DATAMODEL.md     # Event sourcing, state-projeksjoner
└── SECURITY_ARCHITECTURE.md          # Auth-arkitektur
```

### 2.4 Backend (uberørt — samme API)

Backend kjører som før. Ingen endringer. Svelte-appen snakker til samme Flask API.

### 2.5 Tas IKKE med

- `src/components/`, `src/hooks/`, `src/context/`, `src/pages/` — alt React-spesifikt
- `src/pdf/` — flyttes til backend ved behov
- `src/tests/` — React-testene. Nye tester skrives fortløpende i Svelte
- Filer for forsering, endringsordre, analytics, fravik, integrasjoner

---

## 3. Teknologistabel for nytt prosjekt

| Lag | Teknologi | Kommentar |
|-----|-----------|-----------|
| Framework | SvelteKit 2 + Svelte 5 | Runes ($state, $derived, $effect) |
| TypeScript | TypeScript 5.8+ | Streng konfigurasjon |
| Styling | Tailwind CSS v4 | CSS-first, kompatibelt med eksisterende tokens |
| UI-primitiver | Bits UI | Headless, tilgjengelig — erstatter Radix UI |
| Skjemahåndtering | Superforms + Formsnap | SvelteKit-native, Zod-validering |
| Server state | TanStack Query Svelte | Offisiell adapter, samme API som React-versjonen |
| Rich text editor | Tiptap + svelte-tiptap | For begrunnelsespanelet i høyrepanel |
| Overganger | Svelte innebygd | `transition:slide`, `transition:fade` |
| Ikoner | Lucide Svelte | Samme ikonbibliotek som designdokumentene spesifiserer |
| Validering | Zod 3.25+ | Gjenbrukes direkte fra eksisterende kode |
| Datoer | date-fns 4.x | Gjenbrukes direkte |
| Testing | Vitest (unit) + Playwright (e2e) | Tester skrives fortløpende |
| Linting | ESLint + eslint-plugin-svelte | Svelte-spesifikk linting |

### 3.1 Svelte 5 — nye features å utnytte

LLM-er som assisterer med implementering **bør konsultere oppdatert Svelte 5-dokumentasjon** — mye har endret seg fra Svelte 4. Nøkkelkonsepter:

| Feature | Bruk i dette prosjektet | Dokumentasjon å sjekke |
|---------|------------------------|----------------------|
| **Runes** (`$state`, `$derived`, `$effect`) | All reaktiv state | `svelte.dev/docs/svelte/$state` |
| **`$props`** | Komponent-props med destrukturering | `svelte.dev/docs/svelte/$props` |
| **`$bindable`** | Two-way binding i custom komponenter | `svelte.dev/docs/svelte/$bindable` |
| **Snippets** (`{#snippet}`, `{@render}`) | Erstatter slots — brukes i alle primitiver | `svelte.dev/docs/svelte/snippet` |
| **`$state.snapshot()`** | Konvertere Proxy til vanlig objekt for API-kall | `svelte.dev/docs/svelte/$state#$state.snapshot` |
| **`$derived.by()`** | Komplekse beregninger med blokk-syntaks | `svelte.dev/docs/svelte/$derived` |
| **`$effect.pre()`** | Effekter som kjøres før DOM-oppdatering | `svelte.dev/docs/svelte/$effect` |
| **`transition:` direktiver** | slide, fade, fly — innebygde overganger | `svelte.dev/docs/svelte/transition` |
| **`use:` actions** | DOM-interaksjon (click-outside, focus-trap) | `svelte.dev/docs/svelte/use` |
| **`class:` direktiver** | Betinget CSS-klasser | `svelte.dev/docs/svelte/class` |
| **Generics i komponenter** | Typesikre gjenbrukbare komponenter | `<script lang="ts" generics="T">` |

**Viktig:** Svelte 5 bruker IKKE lenger:
- `export let` for props → bruk `$props()`
- `$:` for reaktive statements → bruk `$derived` / `$effect`
- `<slot>` for children → bruk snippets og `{@render}`
- `createEventDispatcher` → bruk callback-props
- `on:click` → bruk `onclick`

### 3.2 SvelteKit-spesifikke mønstre

| Mønster | Bruk |
|---------|------|
| `+page.svelte` / `+page.ts` | Filbasert routing med load-funksjoner |
| `+layout.svelte` | Tre-panel layout (nav + midtpanel + høyrepanel) |
| `$app/environment` → `browser` | Guard for localStorage/window-bruk |
| `$app/navigation` → `goto()` | Programmatisk navigasjon |
| Form actions | Progressiv forbedring for skjemaer (valgfritt) |

---

## 4. Faseinndeling

### Fase 0: Prosjektoppsett
**Mål:** Kjørende SvelteKit-prosjekt med alle overførte filer, Tailwind v4, og grønn testpipeline.

- [ ] Avklar repo-strategi (nytt repo vs. monorepo vs. eksisterende)
- [ ] Initialiser SvelteKit-prosjekt (`npx sv create`)
- [ ] Konfigurer Tailwind CSS v4 med designsystem-tokens fra `system.md`
- [ ] Installer avhengigheter (Bits UI, Superforms, TanStack Query Svelte, Tiptap, Lucide, Zod, date-fns)
- [ ] Kopier `src/lib/` (domain, types, constants, utils, api)
- [ ] Verifiser at domenetester kjører grønt med Vitest
- [ ] Konfigurer ESLint + Svelte-plugin
- [ ] Sett opp Playwright
- [ ] Konfigurer path aliases (`$lib/domain/`, `$lib/types/`, etc.)
- [ ] Sett opp API-proxy til Flask-backend (Vite proxy eller SvelteKit hooks)

**Detaljplan lages ved implementering.**

### Fase 1: Designsystem-primitiver
**Mål:** Gjenbrukbare UI-byggeklosser basert på `system.md` og `DESIGN_WORKSPACE_PANELS.md`.

Primitiver som trengs (fra designdokumentene):

| Komponent | Designreferanse | Bits UI-basis |
|-----------|-----------------|---------------|
| VerdictButtons | Verdict-knapper (horisontal gruppe) | Ingen — custom |
| NumberInput | Tall-input med suffiks og differanse | Ingen — custom |
| KeyValueRow | Key-value-rad med leader dots | Ingen — custom |
| SectionHeading | Seksjonsoverskrift med §-referanse | Ingen — custom |
| Checkbox | Innsigelse-checkbox med primær+sekundær tekst | Bits UI Checkbox |
| SegmentedControl | Beregningsmetode §34 | Bits UI Tabs / custom |
| YesNoButtons | Ja/Nei-valg med semantisk farge | Ingen — custom |
| ConsequenceCallout | Konsekvens-callout med venstrekant | Ingen — custom |
| Modal/Dialog | Bekreftelsesdialoger | Bits UI Dialog |
| DatePicker | Datovelger (custom popover) | Bits UI Popover + kalender |
| Badge | Status-badges | Ingen — custom |
| Alert | Advarsler (preklusjon, passivitet) | Ingen — custom |
| Button | Handlingsknapper | Ingen — custom |
| ProgressBar | Forhandlingsgrad (6px) | Ingen — custom |
| Tooltip | §-kontekst ved hover | Bits UI Tooltip |
| LockedValueToken | Ikke-redigerbare verdier i begrunnelse | Ingen — Tiptap extension |

- Skriv tester for hver primitiv fortløpende (Vitest + Testing Library Svelte)
- Tilgjengelighet (a11y): Test med axe-core fra dag 1

**Detaljplan lages ved implementering.**

### Fase 2: Forhandlingsbordet (oversiktsside)
**Mål:** Landingsside for én KOE-sak med tre sporkort + tidslinje.

Basert på `koe-forhandlingsbord.md`:

```
┌───────────────────────┬──────────────────────────────┐
│  Saksinformasjon      │  Tidslinje                   │
│  ┌─────────────────┐  │  ┌────────────────────────┐  │
│  │ Grunnlag-kort   │  │  │ Hendelse 1             │  │
│  ├─────────────────┤  │  │ Hendelse 2             │  │
│  │ Vederlag-kort   │  │  │ ...                    │  │
│  ├─────────────────┤  │  └────────────────────────┘  │
│  │ Frist-kort      │  │                              │
│  └─────────────────┘  │                              │
└───────────────────────┴──────────────────────────────┘
```

- Sporkort med status, nøkkeltall, varslingsindikatorer
- Tidslinje med hendelseslogg
- Navigasjon til spordetalj
- TanStack Query for datahenting (fetchCaseState, fetchTimeline)

**Detaljplan lages ved implementering.**

### Fase 3: Spordetalj — Grunnlag (enkleste sporet)
**Mål:** Komplett arbeidsflate for grunnlag-sporet — BH-respons og TE-sending.

Basert på `DESIGN_WORKSPACE_PANELS.md`:

```
┌──────────┬─────────────────────────────┬────────────┐
│ Spornav  │ ① Kravhode                  │ Begrunnelse│
│          │ ② Posisjonskort (les/rediger)│ (TipTap)   │
│ Grunnlag │ ③ Beslutningsfelt           │            │
│ Vederlag │    - Verdict-knapper        │            │
│ Frist    │    - Innsigelser            │            │
│          │ ④ Resultatboks              │            │
│          │ ─── Footer ───              │            │
└──────────┴─────────────────────────────┴────────────┘
```

Grunnlag er enklest — færre felt, enklere beslutningslogikk:
- Verdict: Godkjent / Avslått / Frafalt
- Innsigelser: §32.2 preklusjon, §32.3 passivitet
- Subsidiær posisjon trigger i vederlag+frist
- Begrunnelse med auto-generering via `begrunnelseGenerator.ts`
- TE-skjema: Kategori, underkategori, varselinfo

Tester: Enhet + integrasjon + e2e for hele flyten.

**Detaljplan lages ved implementering.**

### Fase 4: Spordetalj — Vederlag (mest komplekse sporet)
**Mål:** Komplett arbeidsflate for vederlag-sporet med full subsidiær logikk.

Det mest komplekse sporet pga.:
- Beregningsmetode (Enhetspriser / Regningsarbeid / Fastpris) med §34
- Per-kravlinje evaluering (hovedkrav + særskilte krav: rigg, produktivitet)
- Preklusjon per kategori (§34.1.2 hovedkrav, §34.1.3 særskilte)
- Subsidiære ledd: Grunnlag avslått → hele vederlag subsidiært
- Tilbakeholdelse (§30.2) for regningsarbeid uten kostnadsoverslag
- EP-justering respons (§34.3.3) med passivitetsregel

All domenelogikk finnes i `vederlagDomain.ts` (654 linjer).

Tester: Grundig testing av subsidiære kombinasjoner.

**Detaljplan lages ved implementering.**

### Fase 5: Spordetalj — Frist
**Mål:** Komplett arbeidsflate for frist-sporet.

- Varsel-/spesifiseringstidslinje
- Innsigelser: §33.4 (varslet for sent), §33.6.1 (spesifisert for sent)
- Subsidiær: Grunnlag avslått → frist subsidiært
- Kaskadert subsidiær: varslet for sent + grunnlag avslått
- Forhandlingsgrad med progress bar
- TE-sending: Varsel, spesifisering, begrunnelse_utsatt

Domenelogikk i `fristDomain.ts` (318 linjer) og `fristSubmissionDomain.ts` (351 linjer).

**Detaljplan lages ved implementering.**

### Fase 6: Auth og prosjekttilgang
**Mål:** Magic link-autentisering og prosjektbasert tilgang.

- Supabase auth-integrasjon
- Login-side
- `X-Project-ID` header i API-klient
- Rollebasert UI (TE ser send-handlinger, BH ser respons-handlinger)
- Token-fornyelse og utløpshåndtering

### Fase 7: Polering og produksjonsklargjøring
- Responsivt design (per designdokument: mobile-degradation, ikke mobile-first)
- Keyboard-navigasjon og screen reader-testing
- Error boundaries og loading states
- Performance-optimalisering (lazy loading, prefetch)
- PWA-vurdering (offline-støtte for pågående redigering)

---

## 5. Testing-strategi

### Prinsipp: tester skrives fortløpende — ikke som egen fase

Ingen av de eksisterende React-testene (`src/tests/`) er brukbare i Svelte-prosjektet. Unntaket er domenetestene (`src/domain/__tests__/`) som kjører direkte.

| Testnivå | Verktøy | Hva testes | Når |
|----------|---------|-----------|-----|
| Domain-logikk | Vitest | Subsidiær beregning, triggers, event-building | Overført fra dag 1 |
| Komponent-enhet | Vitest + @testing-library/svelte | Primitiver, isolert oppførsel | Per primitiv i fase 1 |
| Tilgjengelighet | axe-core + Vitest | WCAG 2.1 AA per komponent | Per komponent |
| Integrasjon | Vitest | Spor-arbeidsflater med mock-data | Per fase (3–5) |
| E2E | Playwright | Full brukerflyt: åpne sak → ta posisjon → send svar | Per fase |
| Visuell regresjon | Playwright screenshots | Layout, farger, spacing | Fase 7 |

### Domenetester som allerede finnes

Disse kopieres direkte og skal kjøre grønt fra dag 1:

```
src/domain/__tests__/
├── grunnlagDomain.test.ts           367 linjer
├── vederlagDomain.test.ts           879 linjer
├── fristDomain.test.ts              489 linjer
├── fristSubmissionDomain.test.ts    335 linjer
└── vederlagSubmissionDomain.test.ts 505 linjer
```

---

## 6. LLM-instruksjoner for implementering

Ved bruk av LLM-assistanse (Claude Code, Copilot) i det nye prosjektet:

### 6.1 Svelte 5-spesifikk veiledning

```
VIKTIG FOR LLM:
- Sjekk ALLTID oppdatert Svelte 5-dokumentasjon før du implementerer.
  Svelte 5 har fundamentalt endret API-et fra Svelte 4.
- Bruk runes ($state, $derived, $effect), IKKE legacy $: syntaks
- Bruk $props(), IKKE export let
- Bruk snippets og {@render}, IKKE <slot>
- Bruk onclick, IKKE on:click
- Bruk callback-props, IKKE createEventDispatcher
- Bruk $state.snapshot() ved sending til API/ekstern kode
- Bruk import { browser } from '$app/environment' for localStorage-guard
- Konsulter: svelte.dev/docs/svelte (for Svelte 5 runes)
- Konsulter: svelte.dev/docs/kit (for SvelteKit routing, load, etc.)
```

### 6.2 Domene-kontekst

```
KONTEKST FOR LLM:
- Les docs/BUSINESS_LOGIC.md for domeneforståelse
- Les docs/design/DESIGN_WORKSPACE_PANELS.md for UI-spesifikasjoner
- Les docs/design/system.md for designsystem-tokens
- Les docs/design/koe-forhandlingsbord.md for oversiktssiden
- Domenelogikk ligger i $lib/domain/ — ren TypeScript, aldri endre uten å forstå NS 8407
- Subsidiær logikk kan kaskadere 1–4 ledd — se begrunnelseGenerator.ts for språklig rendering
- Backend er uendret — bruk $lib/api/client.ts for alle API-kall
```

### 6.3 Design-compliance

```
DESIGN FOR LLM:
- Følg DESIGN_WORKSPACE_PANELS.md komponent-tokens nøyaktig
- Spacing: 4px base (sp-1=4, sp-2=8, sp-3=12, sp-4=16, sp-5=20, sp-6=24)
- Radius: r-sm=2px, r-md=4px, r-lg=6px (skarpere enn standard)
- Typografi: Oslo Sans for UI, font-mono med tabular-nums for tall
- Farger: Bruk Analysebordet-tokens mappet til Punkt (se DESIGN_WORKSPACE_PANELS §Tokensystem)
- INGEN skygger — borders-only + surface shifts
- §-referanser er synlige i sone ③, skjulte bak hover ellers
```

---

## 7. Risiko og mitigeringer

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|-----------|------------|
| Tiptap Svelte-wrapper ustabil | Middels | Begrunnelsespanelet fungerer dårlig | Test tidlig i fase 1. Fallback: vanilla Tiptap med manual Svelte-binding |
| Superforms håndterer ikke all kompleksitet | Lav | Mer manuell skjemalogikk | Domenelogikk er allerede i TS-funksjoner — Superforms er mest for validering/submission |
| Bits UI mangler komponent | Lav | Må bygge fra bunnen | De 16 primitivene er mest custom uansett — Bits UI er kun Dialog, Tooltip, Popover, Checkbox |
| API-klient krever SSR-tilpasning | Lav | localStorage-feil ved server rendering | Bruk `ssr: false` eller guard med `browser` check |
| LLM genererer Svelte 4-syntaks | Høy | Feil kode, tid brukt på debugging | CLAUDE.md med eksplisitte Svelte 5-instruksjoner (se §6.1) |
| Rekruttering av Svelte-utviklere | Middels-Høy | Vanskelig å skalere teamet | Svelte 5 er nærmere React mental modell (runes ≈ hooks) — lettere onboarding |

---

## 8. Suksesskriterier per fase

| Fase | Kriterium |
|------|-----------|
| 0 | Domenetester grønne. Tailwind fungerer med designtokens. Dev server kjører. |
| 1 | Alle 16 primitiver implementert med tester og a11y. Storybook/showcase-side. |
| 2 | Forhandlingsbordet viser reelle data fra API. Navigasjon til spordetalj fungerer. |
| 3 | BH kan ta stilling til grunnlag. TE kan sende grunnlagskrav. Begrunnelse auto-genereres. |
| 4 | Full vederlag-arbeidsflate med subsidiær logikk, per-kravlinje evaluering, alle beregningsmetoder. |
| 5 | Full frist-arbeidsflate med varseltidslinje, innsigelser, kaskadert subsidiær. |
| 6 | Innlogging fungerer. Rollebasert UI. Prosjekttilgang. |
| 7 | WCAG AA. Responsivt. Error handling. Produksjonsklar. |

---

## 9. Åpne spørsmål

1. **Repo-strategi** — nytt repo, monorepo, eller eksisterende Svelte-prosjekt?
2. **Domain-pakke** — npm workspace, git submodule, eller direkte kopi?
3. **Dark mode** — designsystemet (`system.md`) definerer dark theme tokens. Støttes begge temaer fra start, eller kun ett?
4. **Deployment** — Samme infrastruktur som eksisterende? Vercel? Statisk SPA bak Flask?
5. **Saksliste** — Er sakslisten (SaksoversiktPage) i scope, eller kun single-case-visningen?
6. **Tiptap Svelte-wrapper** — Bør testes tidlig. Alternativ: ProseMirror direkte, eller annen rich text editor?
