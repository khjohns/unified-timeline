# Saksoversikt Dashboard - Design

**Dato:** 2026-02-12
**Status:** Klar for implementering

## Mål

Gjøre `/saker` til et kontekstuelt arbeidsbord som gir brukeren overblikk OG arbeidsverktøy. I dag er siden en flat saksliste. Den nye versjonen utnytter data som allerede finnes i `CaseListItem` men ikke vises (beløp, dager, kategorier).

## Designbeslutninger

| Valg | Beslutning |
|------|------------|
| KPI-seksjon | Minimal inline-linje (ikke kort) |
| Saksliste | Rikere rader med beløp, dager, kategori + søk/sortering/gruppering |
| Tom tilstand | Forbedret med ikon + forklaring + CTA |
| Analyse-side | Forblir separat, ingen overlapp |
| Nye API-endepunkter | Ingen. All data finnes i `GET /api/cases` |

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ PageHeader: "Saksoversikt"                      [⋮ Meny] │
├──────────────────────────────────────────────────────────┤
│ ⚠ 3 saker venter på ditt svar som BH           [Vis →]  │  ← Handlingsbar
├──────────────────────────────────────────────────────────┤
│ 12 saker · 4 åpne · kr 2,4M krevd · kr 800k godkjent   │  ← KPI-linje
├──────────────────────────────────────────────────────────┤
│ [🔍 Søk...]       Gruppér: [Status ▾]  Sorter: [Dato ▾]  │  ← Verktøylinje
│ [Alle 12] [KOE 8] [Forsering 1] [EO 3]                  │  ← Filter-tabs
├──────────────────────────────────────────────────────────┤
│ ── Sendt (4) ──────────────────────────────────────────  │  ← Grupperte
│   SAK-001  Endring fundament   450k/—   30d/—    12.feb │    seksjoner
│            Byggherres disp.                    ● Sendt   │
│                                                          │
│ ── Godkjent (3) ───────────────────────────────────────  │
│   SAK-002  Tilleggsarbeid      120k/120k 10d/10d  8.feb │
│            Prosjektering                       ● Godk.   │
└──────────────────────────────────────────────────────────┘
```

## Seksjon 1: Handlingsbar

Kontekstuell alert som vet hvem brukeren er (TE/BH).

**Logikk:**
- Hent `userRole` fra `useUserRole()`
- Tell saker der motpartens handling gjenstår:
  - BH: saker med `cached_status` = "Sendt" eller "Under behandling"
  - TE: saker med `cached_status` = "Godkjent" (trenger aksept/lukking) eller "Avslått" (trenger respons)
- Vis `Alert` med `variant="warning"` og `action`-knapp
- Klikk "Vis" setter et filter som viser kun relevante saker
- Skjules når antall = 0

**Komponent:** Eksisterende `Alert` med `action`-prop.

## Seksjon 2: KPI-linje

En enkelt linje med inline-statistikk, ikke kort.

```tsx
<p className="text-sm text-pkt-text-body-subtle">
  <span className="font-semibold text-pkt-text-body-default">{total}</span> saker ·
  <span className="font-semibold text-pkt-text-body-default">{open}</span> åpne ·
  <span className="font-mono">kr {formatCompact(totalKrevd)}</span> krevd ·
  <span className="font-mono">kr {formatCompact(totalGodkjent)}</span> godkjent
</p>
```

**Data:** Beregnet klient-side fra `cases`-arrayet:
- `total` = `cases.length`
- `open` = saker med status != Godkjent/Avslått/Trukket/Lukket
- `totalKrevd` = `sum(cached_sum_krevd)`
- `totalGodkjent` = `sum(cached_sum_godkjent)`

**Ny utility:** `formatCompact(value)` - formaterer `450000` → `450k`, `2400000` → `2,4M`. Legges til i `formatters.ts`.

## Seksjon 3: Verktøylinje

### Søk
- `<Input>` med søkeikon og placeholder "Søk saker..."
- Filtrerer klient-side på `sak_id` og `cached_title`
- Debounced (200ms)

### Gruppér-dropdown
- `<Select>` med tre valg:
  - **Status** (default): Grupperer etter `cached_status` → seksjonshoder
  - **Kategori**: Grupperer etter `cached_hovedkategori`
  - **Ingen**: Flat liste som i dag
- State: `groupBy: 'status' | 'kategori' | 'ingen'`

### Sorter-dropdown
- `<Select>` med valg:
  - **Dato** (default): `last_event_at` descending
  - **Beløp**: `cached_sum_krevd` descending
  - **Saksnummer**: `sak_id` ascending
- State: `sortBy: 'dato' | 'belop' | 'saksnummer'`

### Filter-tabs med antall
- Som i dag, men viser antall i parentes/badge
- Antall beregnes fra hele datasettet (ikke filtrert av søk)
- Bruker fortsatt `useCaseListSuspense` med sakstype-parameter

## Seksjon 4: Saksliste med rikere rader

### To-linjers rader

**Linje 1 (desktop grid):**
| Kolonne | Data | Bredde | Stil |
|---------|------|--------|------|
| Sak-ID | `sak_id` | 2 cols | `font-mono font-semibold text-pkt-text-action-active` |
| Type | Badge med sakstype | 1 col | Eksisterende `getSakstypeBadgeClass` |
| Tittel | `cached_title` | 3 cols | `line-clamp-1` |
| Vederlag | `krevd / godkjent` | 2 cols | `font-mono text-sm` |
| Frist | `dager_krevd / dager_godkjent` | 2 cols | `font-mono text-sm` |
| Dato | `last_event_at` | 2 cols | `text-sm text-pkt-text-body-subtle` |

**Linje 2 (undertekst):**
- Kategori: `cached_hovedkategori` i `text-xs text-pkt-text-body-subtle`
- Status: Farget dot (●) + statusnavn, høyrejustert

**Beløp-format:**
- `formatCompact(cached_sum_krevd)` / `formatCompact(cached_sum_godkjent)`
- Dash (—) når null
- Eksempel: `450k / 200k` eller `1,2M / —`

**Dager-format:**
- `cached_dager_krevd` + "d" / `cached_dager_godkjent` + "d"
- Dash (—) når null
- Eksempel: `30d / 10d` eller `14d / —`

### Seksjonshoder (gruppering)

Når `groupBy !== 'ingen'`:
```tsx
<div className="flex items-center gap-2 px-4 py-2 bg-pkt-bg-subtle border-b border-pkt-border-subtle">
  <span className="text-xs font-semibold text-pkt-text-body-subtle uppercase tracking-wide">
    {gruppeNavn}
  </span>
  <span className="text-xs text-pkt-text-body-subtle">({antall})</span>
</div>
```

### Responsivt (mobil)
- Skjul kolonnene Vederlag, Frist, Dato
- Vis: Sak-ID + Tittel + Status-dot
- Kategori flyttes til under tittel

### Interaksjon
- Hele raden klikkbar (navigerer til sak)
- `hover:bg-pkt-surface-subtle transition-colors`
- `cursor-pointer`
- Keyboard: Enter/Space for navigasjon
- Staggered `animate-fade-in-up` per rad ved første load

## Seksjon 5: Forbedret tom tilstand

### Helt tomt prosjekt (0 saker totalt)
```tsx
<Card variant="outlined" padding="lg">
  <div className="text-center py-12 max-w-sm mx-auto">
    <ClipboardListIcon className="w-12 h-12 text-pkt-text-body-subtle mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-pkt-text-body-dark mb-2">
      Ingen saker ennå
    </h3>
    <p className="text-sm text-pkt-text-body-subtle mb-6">
      Opprett en KOE-sak for å starte håndtering av endringsordrer i dette prosjektet.
    </p>
    <Button variant="primary" onClick={() => navigate('/saker/ny')}>
      Opprett første sak
    </Button>
  </div>
</Card>
```

### Tomt filter-resultat (saker finnes, men filter gir 0)
```tsx
<div className="text-center py-8">
  <p className="text-sm text-pkt-text-body-subtle mb-2">
    Ingen saker matcher søket
  </p>
  <Button variant="ghost" size="sm" onClick={clearFilters}>
    Vis alle saker
  </Button>
</div>
```

## Implementeringsplan

### Steg 1: Ny utility `formatCompact`
- Legg til i `src/utils/formatters.ts`
- `formatCompact(450000)` → `"450k"`, `formatCompact(2400000)` → `"2,4M"`
- Dash for null/undefined

### Steg 2: Refaktorer SaksoversiktPage
- Behold wrapper-strukturen (`SaksoversiktPage` → `SaksoversiktContent`)
- Legg til nye state-variabler: `searchQuery`, `groupBy`, `sortBy`
- Behold eksisterende `filter` (sakstype)

### Steg 3: Handlingsbar
- Importer `useUserRole()`
- Beregn ventende saker basert på rolle + status
- Legg til `Alert` med action-knapp

### Steg 4: KPI-linje
- Beregn aggregater fra `cases`-array med `useMemo`
- Render inline tekst-linje

### Steg 5: Verktøylinje
- Søkefelt med `Input`-komponent
- Gruppér og Sorter med `Select`-komponenter
- Filter-tabs med antall

### Steg 6: Rikere saksliste
- Ny rad-layout med to linjer
- Grupperings-logikk med seksjonshoder
- Sortering med `useMemo`
- Responsiv layout (mobil vs desktop)

### Steg 7: Tom tilstand
- Forbedret tom tilstand for 0 saker
- Tomt filter-resultat

## Eksisterende komponenter som gjenbrukes

- `Alert` (handlingsbar)
- `Card` (saksliste-container)
- `Button` (filter-tabs, CTA)
- `Input` (søk) - sjekk at denne finnes, ellers bruk rå `<input>`
- `Select` (gruppér, sortér)
- `Badge` (filter-tabs med antall)
- `PageHeader` (uendret)
- Ikoner fra `@radix-ui/react-icons`

## Nye ting som må lages

| Hva | Hvor | Beskrivelse |
|-----|------|-------------|
| `formatCompact()` | `src/utils/formatters.ts` | Kompakt tallformatering (450k, 2.4M) |
| `formatDaysCompact()` | `src/utils/formatters.ts` | Kompakt dager (30d, —) |
| Grupperingslogikk | Inline i SaksoversiktPage | `groupCases()` funksjon |
| Sorteringslogikk | Inline i SaksoversiktPage | `sortCases()` funksjon |
| Søkelogikk | Inline i SaksoversiktPage | Filtrering på tittel/ID |

## Hva endres IKKE

- Backend API
- Routing
- Andre sider
- Komponentbiblioteket (ingen nye primitiver)
- PageHeader-komponent
