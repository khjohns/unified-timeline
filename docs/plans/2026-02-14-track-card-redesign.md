# Track Card Redesign (Grunnlag, Vederlag, Frist)

## Problem

De tre sporkortene (Grunnlag, Vederlag, Frist) på CasePageBento bruker en 4-stegs dot-stepper
(Varsel -> Sendt -> Svar -> Avgjort) som tar visuell plass uten verdi, ser generisk ut, og
ikke matcher designspraaket fra saksoversikt-tilene. I tillegg mangler semantiske farger paa tall,
progress bar for godkjenningsgrad, og synlig neste-handling.

## Designbeslutninger

### Tilnaerming: KPI-First (Approach A)

Hver kort er en mini dashboard-tile der det viktigste tallet/faktumet dominerer visuelt.
Ingen stepper. Status kommuniseres gjennom farge og en tynn top-border accent.

### CTA-pattern: Hybrid

En prominent CTA-stripe nederst (f.eks. "Send krav ->") som primaerhandling, med
overflow-meny (tre prikker) for sekundaerhandlinger.

## Kjerneprinsipper

### 1. Growing Card

Hvert kort starter minimalt og vokser naturlig etter hvert som data ankommer.
Tomme seksjoner vises aldri. Kortet er bare saa hoyt som dataene tilsier.

### 2. Unik identitet per kort

| Kort | Identitet | Hero-element | Hvorfor |
|------|-----------|-------------|---------|
| Grunnlag | "Hjemmelen" | Kategori + hjemmel | Brukeren trenger aa se *hva slags krav* |
| Vederlag | "Pengene" | Krevd belop (hero-tall) | Brukeren skanner for finansiell eksponering |
| Frist | "Tiden" | Krevd dager (hero-tall) | Brukeren skanner for tidspavirkning |

### 3. Top Accent Border = Status

2px top-border erstatter stepperen som primaer statusindikator:

| Status | Farge | Token |
|--------|-------|-------|
| ikke_relevant | Graa | `border-t-pkt-grays-gray-300` |
| utkast | Graa | `border-t-pkt-grays-gray-400` |
| sendt / under_behandling | Blaa | `border-t-pkt-brand-warm-blue-1000` |
| godkjent | Gronn | `border-t-pkt-brand-dark-green-1000` |
| delvis_godkjent | Amber | `border-t-pkt-brand-yellow-1000` |
| avslatt | Rod | `border-t-pkt-brand-red-1000` |
| under_forhandling | Amber | `border-t-pkt-brand-yellow-1000` |
| trukket | Graa | `border-t-pkt-grays-gray-400` |

### 4. Status Dot

En liten farget prikk ved siden av statustekst erstatter 4-dot stepper:

```
* Under behandling     <-- dot + text
```

Prikken bruker samme farge som top accent. Tekst: `text-[11px] font-medium`.

## Felles kortanatomi

```
+------------------------------------------+
| ====== top accent (2px, status-farge) === |
|                                          |
|  MICRO-LABEL . Xnn          STATUS-DOT   |  track-navn + hjemmel + status
|                                          |
|  +-- Hero zone ---+                      |  unikt per kort
|  |  (kort-spesifikt innhold)  |          |
|  +-----------------------------+         |
|                                          |
|  -- separator -------------------------  |
|                                          |
|  kontekst-detaljer (label-value par)     |
|                                          |
|  v N hendelser                           |  collapsible historikk
|                                          |
|  -- CTA strip -------------------------  |
|  -> Neste: Send krav                  :  |  primaer + overflow
|                                          |
+------------------------------------------+
```

## 1. Grunnlag-kortet

### Vekststadier

**Stage 1: Utkast (tom)**
```
+------------------------------------------+
| ======================================== |  gray
|  ANSVARSGRUNNLAG . X25.2    o Utkast     |
|                                          |
|  Ingen data ennaa                        |  muted placeholder
|                                          |
|  -- -> Opprett utkast               : --|
+------------------------------------------+
```

**Stage 2: Utkast (med data)**
```
+------------------------------------------+
| ======================================== |  gray
|  ANSVARSGRUNNLAG . X25.2    o Utkast     |
|                                          |
|  Endringer -> Irregulaer endring (X32.1) |  <- kategori dukker opp
|                                          |
|  Oppdaget             12. feb 2026       |  <- dato dukker opp
|                                          |
|  -- -> Send varsel om krav           : --|
+------------------------------------------+
```

**Stage 3: Sendt**
```
+------------------------------------------+
| ======================================== |  blue
|  ANSVARSGRUNNLAG . X25.2    * Sendt      |
|                                          |
|  Endringer -> Irregulaer endring (X32.1) |
|                                          |
|  Oppdaget             12. feb 2026       |
|  Varslet              14. feb 2026       |  <- ny rad dukker opp
|                                          |
|  v 1 hendelse                            |  <- historikk dukker opp
|                                          |
|  -- -> Venter paa svar fra BH        : --|
+------------------------------------------+
```

**Stage 4: BH har svart**
```
+------------------------------------------+
| ======================================== |  green / red / amber
|  ANSVARSGRUNNLAG . X25.2    * Godkjent   |
|                                          |
|  Endringer -> Irregulaer endring (X32.1) |
|                                          |
|  Oppdaget             12. feb 2026       |
|  Varslet              14. feb 2026       |
|  -----------------------------------------
|  BH resultat          Godkjent     V     |  <- ny seksjon vokser inn
|                                          |
|  v 2 hendelser                           |
|                                          |
|  -- -> Aksepter BH-svar             : --|
+------------------------------------------+
```

### BH avslaat-variant

```
|  BH resultat          Avslaat      X     |  rod
|  Begrunnelse     <<Ikke endring>>        |  trunkert, tooltip for full
```

### Preemption-advarsel (X32.2)

Naar `grunnlag_varslet_i_tide === false`:

```
|  Varslet        14. feb 2026  ! X32.2    |  rod tekst + advarsel
```

### Semantiske farger

| Element | Farge | Naar |
|---------|-------|------|
| Kategoritekst | `text-pkt-text-body-dark font-medium` | Alltid |
| BH resultat: godkjent | `text-pkt-brand-dark-green-1000` | BH aksepterte |
| BH resultat: avslaat | `text-pkt-brand-red-1000` | BH avviste |
| Varslet dato (for sent) | `text-pkt-brand-red-1000` | `varslet_i_tide === false` |

## 2. Vederlag-kortet

### Vekststadier

**Stage 1: Utkast (tom)**
```
+------------------------------------------+
| ======================================== |  gray
|  VEDERLAG . X34             o Utkast     |
|                                          |
|  Ingen data ennaa                        |
|                                          |
|  -- -> Opprett utkast               : --|
+------------------------------------------+
```

**Stage 2: Sendt (bare belop)**
```
+------------------------------------------+
| ======================================== |  blue
|  VEDERLAG . X34         * Under beh.     |
|                                          |
|  1 200 000 kr                            |  <- hero dukker opp, amber
|  Enhetspriser (X34.3)                    |  <- metode dukker opp
|                                          |
|  v 1 hendelse                            |
|                                          |
|  -- -> Venter paa svar fra BH        : --|
+------------------------------------------+
```

**Stage 3: Sendt (med saerskilte krav)**
```
+------------------------------------------+
| ======================================== |  blue
|  VEDERLAG . X34         * Under beh.     |
|                                          |
|  1 200 000 kr                            |  hero, amber
|  Enhetspriser (X34.3)                    |
|  -----------------------------------------
|  Rigg/drift               +150 000 kr    |  <- detaljer vokser inn
|  Produktivitet              +50 000 kr    |
|                                          |
|  v 1 hendelse                            |
|                                          |
|  -- -> Venter paa svar fra BH        : --|
+------------------------------------------+
```

**Stage 4: BH har svart**
```
+------------------------------------------+
| ======================================== |  amber/green/red
|  VEDERLAG . X34    * Delvis godkjent     |
|                                          |
|  KREVD             GODKJENT       GRAD   |  <- hero transformeres til KPI-rad
|  1,2M              900k           75%    |
|  =====================-----------  75%   |  <- progress bar dukker opp
|  -----------------------------------------
|  Metode            Enhetspriser (X34.3)  |
|  Rigg/drift              +150 000 kr     |
|                                          |
|  v 3 hendelser                           |
|                                          |
|  -- -> Aksepter eller revider        : --|
+------------------------------------------+
```

**Stage 5: Avgjort (godkjent)**
```
+------------------------------------------+
| ======================================== |  green
|  VEDERLAG . X34         * Godkjent       |
|                                          |
|  900 000 kr                        V     |  hero i gronn
|  Enhetspriser (X34.3)                    |
|  -----------------------------------------
|  Krevd                 1 200 000 kr      |  krevd flyttet til kontekst
|  Godkjenningsgrad                 75%    |
|                                          |
|  v 4 hendelser                           |
|                                          |
|  -- Avgjort                          : --|
+------------------------------------------+
```

### Subsidiaert badge

Naar grunnlag er avvist men vederlag har subsidiaert belop:

```
|  VEDERLAG . X34  . Subsidiaert  * Avslaat |
```

Badge: `bg-badge-warning-bg text-badge-warning-text rounded-sm text-[10px] px-1.5 py-0.5`

### Semantiske farger

| Element | Farge | Naar |
|---------|-------|------|
| Krevd belop | `text-pkt-brand-yellow-1000` | Uavklart krav |
| Godkjent belop | `text-pkt-brand-dark-green-1000` | BH godkjente (uansett belop) |
| Grad >=70% | `text-pkt-brand-dark-green-1000` | Hoy godkjenning |
| Grad 40-69% | `text-pkt-brand-yellow-1000` | Middels godkjenning |
| Grad <40% | `text-pkt-brand-red-1000` | Lav godkjenning / fare |
| Progress bar fill | `bg-pkt-brand-dark-green-1000` | Alltid gronn (godkjent andel) |

## 3. Frist-kortet

### Vekststadier

**Stage 1: Utkast (tom)**
```
+------------------------------------------+
| ======================================== |  gray
|  FRISTFORLENGELSE . X33    o Utkast      |
|                                          |
|  Ingen data ennaa                        |
|                                          |
|  -- -> Opprett utkast               : --|
+------------------------------------------+
```

**Stage 2: Varslet (forelopig, ingen dager ennaa)**
```
+------------------------------------------+
| ======================================== |  blue
|  FRISTFORLENGELSE . X33     * Sendt      |
|                                          |
|  Varslet                                 |  <- bare faktumet, ingen tall
|  14. feb 2026                            |  <- dato som subtitle
|                                          |
|  v 1 hendelse                            |
|                                          |
|  -- -> Spesifiser krav               : --|
+------------------------------------------+
```

**Stage 3: Krevd (dager spesifisert)**
```
+------------------------------------------+
| ======================================== |  blue
|  FRISTFORLENGELSE . X33   * Under beh.   |
|                                          |
|  45d                                     |  <- hero dukker opp, amber
|                                          |
|  -----------------------------------------
|  Varslet              14. feb 2026       |
|                                          |
|  v 1 hendelse                            |
|                                          |
|  -- -> Venter paa svar fra BH        : --|
+------------------------------------------+
```

**Stage 4: BH har svart**
```
+------------------------------------------+
| ======================================== |  amber
|  FRISTFORLENGELSE . X33  * Delvis godkj  |
|                                          |
|  KREVD             GODKJENT       GRAD   |
|  45d               30d            67%    |
|  =================--------------- 67%   |
|  -----------------------------------------
|  Ny sluttdato          22. aug 2026      |  blaa (som ProgressTile "Justert")
|                                          |
|  v 3 hendelser                           |
|                                          |
|  -- -> Aksepter eller revider        : --|
+------------------------------------------+
```

**Stage 5: Avgjort (godkjent)**
```
+------------------------------------------+
| ======================================== |  green
|  FRISTFORLENGELSE . X33    * Godkjent    |
|                                          |
|  30d                               V     |  hero i gronn
|                                          |
|  -----------------------------------------
|  Krevd                           45d     |  kontekst
|  Ny sluttdato          22. aug 2026      |
|                                          |
|  v 4 hendelser                           |
|                                          |
|  -- Avgjort                          : --|
+------------------------------------------+
```

### Semantiske farger

| Element | Farge | Naar |
|---------|-------|------|
| Krevd dager | `text-pkt-brand-yellow-1000` | Uavklart |
| Godkjent dager | `text-pkt-brand-dark-green-1000` | BH godkjente |
| Ny sluttdato | `text-pkt-brand-warm-blue-1000 font-semibold` | Naar satt (speiler ProgressTile) |
| Grad-farger | Samme terskler som Vederlag | Konsistens |

## CTA-stripe

### Struktur

- Border-top separator: `border-t border-pkt-border-subtle`
- Lett forhoynet bakgrunn: `bg-pkt-bg-subtle/50`
- Venstre: pil-ikon + primaer handlingstekst, klikkbar
- Hoyre: overflow-meny (tre prikker) for sekundaerhandlinger

### Tilstander

| Tilstand | CTA-tekst | Stil |
|----------|-----------|------|
| TE maa handle | `-> Send krav` | Blaa tekst, bold, klikkbar |
| Venter paa motpart | `Venter paa svar fra BH` | Muted tekst, ingen pil, ikke klikkbar |
| BH maa svare | `-> Besvar krav` | Blaa tekst, bold (BH ser dette) |
| TE maa akseptere/avvise | `-> Aksepter eller revider` | Blaa tekst |
| Avgjort | `Avgjort` | Muted, liten hake |
| Ikke startet | `-> Opprett utkast` | Blaa tekst |
| Dimmed (grunnlag ikke sendt) | -- | CTA-stripe skjult |

### Overflow-meny (tre prikker)

- Revider (update)
- Trekk tilbake (withdraw)
- Utsett EO (kun grunnlag)

## Historikk-seksjon

Kollapsbar mikro-tidslinje inne i hvert kort. Kollapset som standard, viser antall hendelser.

### Kollapset

```
|  v 3 hendelser                           |
```

`text-[11px] text-pkt-text-body-subtle` med chevron. Plassert mellom innhold og CTA-stripe.

### Utvidet

```
|  ^ 3 hendelser                           |
|  +-----------------------------------+   |
|  |  14.02  Varsel sendt          TE   |   |
|  |  18.02  Krav revidert (v2)    TE   |   |
|  |  22.02  Delvis godkjent       BH   |   |
|  +-----------------------------------+   |
```

- Hver rad: dato, hendelse, rolle-badge
- Dato: `text-[10px] font-mono text-pkt-text-body-muted` kompakt, tabular
- Beskrivelse: `text-[11px] text-pkt-text-body-default`
- Rolle: `text-[9px] font-medium uppercase` med subtil bakgrunn
- Container: `bg-pkt-bg-subtle/30 rounded-sm p-2 mt-1 space-y-1`
- Maks 5 innslag synlige, deretter "Vis alle ->" lenke
- Animasjon: `animate-in slide-in-from-top-1 duration-200`

## Dimmed-tilstand

Naar `grunnlagIkkeSendt`, viser Vederlag og Frist:

```
+------------------------------------------+
| ======================================== |  gray
|  VEDERLAG . X34                          |  ingen status-dot
|                                          |
|  Krever ansvarsgrunnlag                  |  muted italic tekst
|                                          |
+------------------------------------------+
```

`opacity-60` paa hele kortet, ingen CTA-stripe, plassholder-tekst.

## Tailwind-moenstre (gjenbruk fra referansetiles)

| Monster | Klasser |
|---------|---------|
| Micro-label | `text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide` |
| Hero-tall | `text-lg font-bold font-mono tabular-nums` |
| KPI-verdi | `text-sm font-semibold font-mono tabular-nums` |
| Label-value par | `flex justify-between items-baseline` |
| Separator | `mt-2 pt-2 border-t border-pkt-border-subtle` |
| Progress bar | `h-1.5 bg-pkt-grays-gray-100 rounded-full overflow-hidden` |
| Status-dot | `w-2 h-2 rounded-full` + statusfarge |
