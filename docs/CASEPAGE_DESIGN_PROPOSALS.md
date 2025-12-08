# Designforslag for CasePage

**Dato:** 2025-12-08

Dette dokumentet presenterer tre ulike designretninger for `CasePage.tsx`. Alle forslag beholder funksjonaliteten, men varierer i visuell stil, layout og stemning.

---

## Nåværende design

Før vi ser på forslagene, her er nåværende karakteristikker:

- **Sidebredde:** `max-w-7xl` (1280px)
- **StatusDashboard:** Horisontal 3-kolonne grid
- **Radius:** `rounded-none` (skarpe kanter)
- **Border:** 2px mørk blå (`border-pkt-border-default`)
- **Bakgrunn:** Hvit (`bg-white`) på kort, hvit på side
- **Skygge:** `shadow-sm` på noen elementer

---

## Forslag A: "Professional Clean" (Evolusjon av nåværende)

En raffinert versjon av dagens design med smalere bredde og vertikal dashboard.

### Karakteristikker

| Element | Verdi |
|---------|-------|
| **Sidebredde** | `max-w-4xl` (896px) |
| **Dashboard** | Vertikal stack, kompakt |
| **Radius** | `rounded-none` (beholdes) |
| **Border** | 2px mørk blå |
| **Bakgrunn** | Side: `bg-pkt-bg-subtle` (#f9f9f9), Kort: hvit |
| **Skygge** | `shadow-md` på hovedkort |
| **Spacing** | Tettere, mer kompakt |

### Layout-struktur

```
┌─────────────────────────────────────────────┐
│  HEADER (sakstittel + handlinger)           │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  STATUS DASHBOARD (vertikal)        │    │
│  │  ┌─────────────────────────────┐    │    │
│  │  │ GRUNNLAG    [Badge] [Btn]   │    │    │
│  │  └─────────────────────────────┘    │    │
│  │  ┌─────────────────────────────┐    │    │
│  │  │ VEDERLAG    Krevd: X  [Btn] │    │    │
│  │  └─────────────────────────────┘    │    │
│  │  ┌─────────────────────────────┐    │    │
│  │  │ FRIST       Krevd: X  [Btn] │    │    │
│  │  └─────────────────────────────┘    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  HENDELSER (timeline)               │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  SAMMENDRAG                         │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

### CSS-endringer (Tailwind)

```tsx
// CasePage.tsx - Hovedcontainer
<div className="min-h-screen bg-pkt-bg-subtle">

  {/* Header */}
  <header className="bg-white border-b-2 border-pkt-border-default">
    <div className="max-w-4xl mx-auto px-6 py-4">
      {/* ... */}
    </div>
  </header>

  {/* Main */}
  <main className="max-w-4xl mx-auto px-6 py-6">
    {/* ... */}
  </main>
</div>

// StatusDashboard.tsx - Vertikal layout
<div className="flex flex-col gap-3">
  <StatusCard ... />
  <StatusCard ... />
  <StatusCard ... />
</div>

// StatusCard.tsx - Kompakt versjon
<div className="bg-white p-4 border-2 border-pkt-border-default shadow-md
                flex items-center justify-between gap-4">
  <div className="flex items-center gap-3">
    <h3 className="text-sm font-bold uppercase">GRUNNLAG</h3>
    <StatusBadge ... />
  </div>
  <div className="flex items-center gap-3">
    {/* Krevd/Godkjent inline */}
    <span className="text-sm">Krevd: 150 000 kr</span>
    <Button size="sm">Send</Button>
  </div>
</div>
```

### Fordeler
- Kjent for brukere av dagens løsning
- Smalere fokusområde gir bedre lesbarhet
- Vertikal dashboard sparer horisontal plass
- Beholder Punkt-identitet

---

## Forslag B: "Minimal Soft" (Minimalistisk)

Mykere, mer moderne estetikk med subtile farger og avrundede hjørner.

### Karakteristikker

| Element | Verdi |
|---------|-------|
| **Sidebredde** | `max-w-3xl` (768px) |
| **Dashboard** | Vertikal, kortfattet |
| **Radius** | `rounded-lg` (8px) |
| **Border** | 1px lys grå (`border-pkt-grays-gray-200`) |
| **Bakgrunn** | Side: hvit, Kort: `bg-pkt-bg-subtle` |
| **Skygge** | Ingen, kun hover-effekter |
| **Spacing** | Generøs whitespace |

### Layout-struktur

```
┌───────────────────────────────────────┐
│  Sakstittel                    [PDF]  │
│  Sak #123                      [TE▾]  │
├───────────────────────────────────────┤
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ ○ Grunnlag        Sendt    [→]  │  │
│  ├─────────────────────────────────┤  │
│  │ ○ Vederlag   150k → 120k   [→]  │  │
│  ├─────────────────────────────────┤  │
│  │ ○ Frist        14 dager    [→]  │  │
│  └─────────────────────────────────┘  │
│                                       │
│  Hendelser                            │
│  ─────────────────────────────────    │
│  │ 08.12 • TE sendte grunnlag         │
│  │ 07.12 • Sak opprettet              │
│                                       │
└───────────────────────────────────────┘
```

### CSS-endringer (Tailwind)

```tsx
// CasePage.tsx
<div className="min-h-screen bg-white">

  {/* Header - Minimalistisk */}
  <header className="border-b border-pkt-grays-gray-200">
    <div className="max-w-3xl mx-auto px-8 py-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-pkt-text-body-dark">
            {state.sakstittel}
          </h1>
          <p className="text-sm text-pkt-grays-gray-500 mt-1">Sak #{sakId}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <DownloadIcon />
          </Button>
          <ModeToggle ... />
        </div>
      </div>
    </div>
  </header>

  {/* Main */}
  <main className="max-w-3xl mx-auto px-8 py-8">
    {/* ... */}
  </main>
</div>

// StatusCard.tsx - List-item style
<div className="group bg-pkt-bg-subtle rounded-lg px-4 py-3
                border border-transparent hover:border-pkt-grays-gray-300
                transition-colors cursor-pointer">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 rounded-full bg-pkt-brand-green-1000" />
      <span className="font-medium">Grunnlag</span>
      <span className="text-sm text-pkt-grays-gray-500">Sendt</span>
    </div>
    <ChevronRightIcon className="w-4 h-4 text-pkt-grays-gray-400
                                  group-hover:text-pkt-text-body-dark" />
  </div>
</div>

// Timeline - Enkel linje
<div className="space-y-0">
  {events.map(event => (
    <div className="flex gap-4 py-3 border-b border-pkt-grays-gray-100">
      <span className="text-sm text-pkt-grays-gray-500 w-16">
        {formatDate(event.tidsstempel)}
      </span>
      <span className="text-sm">{event.sammendrag}</span>
    </div>
  ))}
</div>
```

### Fordeler
- Svært rent og moderne uttrykk
- Fokus på innhold, ikke dekorasjon
- Raskere visuell scanning
- Fungerer godt på mindre skjermer

### Ulemper
- Mindre "offisiell" følelse
- Avviker fra Punkt-retningslinjene (skarpe kanter)

---

## Forslag C: "Compact Dashboard" (Funksjonelt fokus)

Maksimal informasjonstetthet med dashboard som sidebar.

### Karakteristikker

| Element | Verdi |
|---------|-------|
| **Sidebredde** | `max-w-5xl` (1024px) |
| **Dashboard** | Fast sidebar (venstre) |
| **Radius** | `rounded-none` |
| **Border** | 2px, varierende farger per status |
| **Bakgrunn** | Dashboard: mørk blå, Innhold: hvit |
| **Skygge** | Ingen |
| **Spacing** | Kompakt |

### Layout-struktur

```
┌─────────────────────────────────────────────────┐
│  HEADER                                         │
├────────────────┬────────────────────────────────┤
│                │                                │
│  DASHBOARD     │  HENDELSER                     │
│  ┌──────────┐  │  ┌────────────────────────┐    │
│  │GRUNNLAG  │  │  │ Timeline item          │    │
│  │ Sendt    │  │  │ ...                    │    │
│  │ [Btn]    │  │  └────────────────────────┘    │
│  └──────────┘  │                                │
│  ┌──────────┐  │  SAMMENDRAG                    │
│  │VEDERLAG  │  │  ┌────────────────────────┐    │
│  │ 150k     │  │  │ Metadata grid          │    │
│  │ [Btn]    │  │  └────────────────────────┘    │
│  └──────────┘  │                                │
│  ┌──────────┐  │                                │
│  │FRIST     │  │                                │
│  │ 14 dg    │  │                                │
│  │ [Btn]    │  │                                │
│  └──────────┘  │                                │
│                │                                │
└────────────────┴────────────────────────────────┘
```

### CSS-endringer (Tailwind)

```tsx
// CasePage.tsx
<div className="min-h-screen bg-white">
  {/* Header */}
  <header className="bg-pkt-surface-strong-dark-blue text-white">
    <div className="max-w-5xl mx-auto px-6 py-4">
      <h1 className="text-lg font-bold">{state.sakstittel}</h1>
      <p className="text-sm text-pkt-brand-blue-300">Sak #{sakId}</p>
    </div>
  </header>

  {/* Two-column layout */}
  <div className="max-w-5xl mx-auto flex">
    {/* Sidebar Dashboard */}
    <aside className="w-64 shrink-0 bg-pkt-bg-subtle border-r-2
                      border-pkt-border-default p-4 min-h-[calc(100vh-80px)]">
      <h2 className="text-xs font-bold uppercase tracking-wider
                     text-pkt-grays-gray-600 mb-4">Status</h2>
      <div className="space-y-3">
        <StatusCard compact ... />
        <StatusCard compact ... />
        <StatusCard compact ... />
      </div>
    </aside>

    {/* Main content */}
    <main className="flex-1 p-6">
      {/* Timeline og Sammendrag */}
    </main>
  </div>
</div>

// StatusCard.tsx - Sidebar-versjon
<div className={clsx(
  "p-3 border-l-4",
  status === 'godkjent' && "border-l-pkt-brand-green-1000 bg-pkt-surface-faded-green",
  status === 'sendt' && "border-l-pkt-brand-blue-1000 bg-pkt-surface-light-blue",
  status === 'avvist' && "border-l-pkt-brand-red-1000 bg-pkt-surface-faded-red",
  // ... andre statuser
)}>
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-xs font-bold uppercase">{spor}</h3>
    <StatusBadge status={status} size="xs" />
  </div>
  {krevd && (
    <p className="text-lg font-bold">{formatValue(krevd, unit)}</p>
  )}
  {actions && (
    <div className="mt-2">{actions}</div>
  )}
</div>
```

### Fordeler
- Dashboard alltid synlig
- God for hyppig statussjekk
- Tydelig visuell hierarki
- Fargekodet status gir rask oversikt

### Ulemper
- Krever mer horisontal plass
- Kan føles "trangere" på hovedinnhold

---

## Sammenligning

| Aspekt | A: Professional | B: Minimal | C: Compact |
|--------|-----------------|------------|------------|
| **Sidebredde** | 896px | 768px | 1024px |
| **Dashboard** | Vertikal stack | Liste | Sidebar |
| **Radius** | Skarpe | Avrundet | Skarpe |
| **Fargebruk** | Moderat | Dempet | Sterk |
| **Informasjonstetthet** | Medium | Lav | Høy |
| **Punkt-compliance** | Høy | Lav | Høy |
| **Mobilevennlig** | Ja | Ja | Nei (sidebar kollapser) |

---

## Anbefaling

For et prosjekt i Oslo kommunes kontekst, anbefales **Forslag A** med følgende justeringer:

1. **Behold skarpe kanter** (Punkt-identitet)
2. **Smal sidebredde** (`max-w-4xl` eller `max-w-3xl`)
3. **Vertikal dashboard** med kompakte StatusCards
4. **Subtil bakgrunn** på siden (`bg-pkt-bg-subtle`)
5. **Sterkere skygge** på hovedkort for dybde

### Neste steg

1. Velg foretrukket retning
2. Prototype i Figma eller direkte i kode
3. Test med brukere (TE og BH)
4. Iterer basert på tilbakemelding

---

## Vedlegg: Fargepalett (Punkt)

For referanse, her er relevante farger fra designsystemet:

```css
/* Bakgrunn */
--pkt-bg-default: #ffffff;
--pkt-bg-subtle: #f9f9f9;

/* Border */
--pkt-border-default: #2a2859;  /* Mørk blå */
--pkt-border-subtle: #f2f2f2;

/* Status-farger */
--pkt-surface-light-green: #c7fde9;   /* Godkjent */
--pkt-surface-light-blue: #d1f9ff;    /* Sendt */
--pkt-surface-yellow: #ffe7bc;        /* Under behandling */
--pkt-surface-faded-red: #ffdfdc;     /* Avvist */
--pkt-surface-light-beige: #f8f0dd;   /* Utkast */

/* Tekst */
--pkt-text-body-dark: #2a2859;
--pkt-grays-gray-500: #808080;
```
