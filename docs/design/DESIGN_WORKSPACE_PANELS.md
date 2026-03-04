# Designdokument — Arbeidsflaten (midtpanel + høyrepanel)

**Dato:** 2026-03-03
**Revisjon:** 3 — critique-pass: komposisjon, token-konsistens, TE-paritet, responsive, radio→verdict
**Scope:** Midtpanelet og høyrepanelet i tre-panel-layouten (spordetaljvisningen). Ikke venstepanel, ikke Forhandlingsbordet, ikke dashboard.

---

## Intent

**Hvem er dette mennesket?**

En kontraktsadministrator i et norsk byggeprosjekt. Jurist eller ingeniør med NS 8407 på pulten og en Excel-liste med endringskrav åpen ved siden av. Skjermen er 24–27". De har håndtert titalls slike krav. De kjenner paragrafene. De trenger ikke opplæring i kontrakten — de trenger et verktøy som holder tritt med deres ekspertise.

De har nettopp klikket seg inn i et spor fra Forhandlingsbordet. De har et presist spørsmål: «Hva er posisjonen, og hva skal mitt neste trekk være?»

**Hva må de gjøre?**

To ting, i rekkefølge:
1. **Avgjøre** — ta juridisk bindende posisjoner. Godkjent/avslått. 30 av 45 dager. Innsigelse mot §33.6.1. Diskrete, strukturerte valg.
2. **Argumentere** — skrive fritekst som begrunner posisjonene. Referere til kontraktsbestemmelser, vedlegg, fremdriftsplaner. 500–2000 ord.

To fundamentalt forskjellige kognitive moduser. Analytisk og kompakt vs. narrativ og ekspansiv. Tre-panel-arkitekturen separerer disse romlig: midtpanelet for beslutninger, høyrepanelet for argumentasjon.

**Hvordan skal det føles?**

Som et kontraktsdokument du kan redigere — ikke en app du fyller ut. Kjølig, presist, autoritativt. Teksten tilhører en protokoll, ikke et skjema. Tallene står like stødig som i en regnearkkolonne.

Ikke varmt. Ikke vennlig. Profesjonelt, som et verktøy laget av noen som forstår arbeidet.

**Tetthetsprinsipp:** Above the fold (1080p, ~600px i midtpanelet): Sone ① + ② + første beslutning i sone ③ synlig uten scrolling. Brukeren ser posisjonen og den første handlingen innen 3 sekunder. Forhandlingsbordet scanner saker på <3s — Arbeidsflaten scanner posisjonen like raskt, men tillater dypere arbeid under folden.

**§-referanselagdeling per sone:**

| Sone | §-referanser | Begrunnelse |
|------|-------------|-------------|
| ① Kravhode | Sekundær (i metadata, ikke tittel) | Kontekst, ikke arbeid |
| ② Posisjonskort | Ingen (bare tall) | Resultat, ikke juridikk |
| ③ Beslutningsfelt | Primær (i overskrifter, checkboxer) | Juristen jobber her |
| ④ Resultatboks | Sekundær (hover for §-kontekst) | Oppsummering |
| Høyrepanel | I LockedValue-tokens | Begrunnelsen ER juridisk tekst |

---

## Domain Exploration

**Domene:** Kontraktsforhandling i byggeprosjekter. Begreper:

1. **Kontraktsprotokoll** — formelt dokument som loggfører posisjoner og begrunnelser
2. **Preklusjon** — tap av rettighet ved oversittelse av frist
3. **Subsidiært standpunkt** — alternativ posisjon dersom hovedposisjon faller
4. **Forhandlingsgrad** — forholdet mellom krevd og godkjent (prosent)
5. **Passivitet** — unnlatelse som skaper rettsvirkning (§32.3)
6. **Varsling** — kontraktuell notifikasjon med rettsvirkning
7. **Spesifisering** — kvantifisering av et krav etter initialt varsel
8. **Revisjon** — formell oppdatering av et krav med versjonsnummer

**Fargeområde:** Den fysiske verdenen til kontraktsadministrasjon:

1. Oslo-indigo (#2a2859) — kommunens identitetsfarge
2. Godkjenningsstempler — mørk grønn blekk
3. Avvisningsmerker — rødt blekk, røde stempler
4. Blått arkivblekk — formelle underskrifter
5. Grå tabellinjer — regnearkstruktur
6. Amber varseltrekanter — byggeplasskilt, OBS-merking
7. Kontraktspapir — off-white, gulnet papir

**Signatur:** §-referanser som strukturelt element. Paragrafhenvisninger er navigasjon og juridisk forankring — ikke pynt. De dukker opp i seksjonsoverskrifter, knappetekst, checkboxlabeler, inline-tokens og varsler. Fjern dem og grensesnittet kunne vært et generisk sakshåndteringssystem.

**Avviste defaults:**

| Default | Erstatning | Hvorfor |
|---------|------------|---------|
| VerdictCards (klikkbare kort med ikoner) | Horisontale verdict-knapper med semantisk farge | Knapper føles som posisjoner, ikke skjemavalg. Semantisk farge gjør konsekvens synlig |
| Vertikale radios for hovedvurdering | Verdict-knapper (horisontal gruppe) | Radioer sier "velg" — knapper sier "ta posisjon." Konsistent med Ja/Nei-mønsteret |
| InlineYesNo for innsigelser | Checkboxer med menneskelig primærtekst | Menneskelig tekst først ("Krav fremsatt for sent"), §-referanse som sekundær |
| Begrunnelse-textarea i skjema | Dedikert høyrepanel med TipTap | Begrunnelsen er et dokument, ikke et felt |
| Skygger for dybde | Borders + surface shifts | Kontraktsdokumenter har linjer, ikke skygger |
| Flat tab-strip i høyrepanelet | Tab-låsing under redigering | Forhindrer navigasjon vekk fra aktiv begrunnelse |
| 380px høyrepanel | 340px | Midtpanelet trenger mer plass for per-kravlinje-evaluering |
| Progress bar 1.5px | Progress bar 6px | Forhandlingsresultatet fortjener visuell signifikans |

---

## Konsistens med Forhandlingsbordet

Forhandlingsbordet (koe-forhandlingsbord.md) og Arbeidsflaten (dette dokumentet) er to visninger av samme produkt. Alle designbeslutninger som gjelder begge må være eksplisitt avklart.

### Tokensystem

Begge dokumenter bruker Analysebordet-tokensystemet (system.md). Implementasjonen mapper til Punkt-primitiver der plattformen krever det.

| Rolle | Analysebordet-token | Brukt i dette dokumentet som |
|-------|---------------------|------------------------------|
| Hovedoverflate | --felt | bg-pkt-bg-card |
| Innfelt/lavere | --canvas | bg-pkt-bg-subtle |
| Løftet overflate | --felt-raised | bg-pkt-bg-default |
| Hover | --felt-hover | — |
| Standard kant | --wire | border-pkt-border-subtle |
| Sterk kant | --wire-strong | border-pkt-border-default |
| Fokusring | --wire-focus | ring --vekt/30 |
| Primærtekst | --ink | text-pkt-text-body-default |
| Sekundærtekst | --ink-secondary | text-pkt-text-body-subtle |
| Dempet | --ink-muted | — |
| Ghost | --ink-ghost | — |
| Aksent/handling | --vekt | pkt-brand-amber (†) |
| Godkjent | --score-high | pkt-brand-dark-green |
| Avslått/kritisk | --score-low | pkt-brand-red |

**Beslutning:** Designdokumentene bruker Analysebordet-tokennavn. Implementasjonen mapper til Punkt-primitiver der plattformen krever det. Token-referanser i dette dokumentet bruker pkt-*-navn der de allerede er skrevet, men den kanoniske referansen er Analysebordet-kolonnen.

(†) warm-blue-1000 ble brukt i tidlige komponentspecs. Etter aksentfarge-migreringen (se §Aksentfarge) er --vekt (amber) kanonisk. Punkt-primitiv avklares med plattformteamet — warm-blue er ikke amber.

### Typografi

| Rolle | Analysebordet (system.md) | Arbeidsflaten |
|-------|--------------------------|---------------|
| UI-tekst | Inter (--font-ui) | Oslo Sans (Punkt-pålagt) |
| Data/tall | JetBrains Mono (--font-data) | font-mono (system) |

**Beslutning:** Oslo Sans erstatter Inter der Punkt-plattformen krever det. Token-navnene --font-ui og --font-data beholdes. Monospace for tall er ikke-forhandlbart.

### Radius

| Token | system.md | Arbeidsflaten |
|-------|-----------|---------------|
| r-sm | 4px | 2px |
| r-md | 6px | 4px |
| r-lg | 8px | 6px |

**Beslutning:** Arbeidsflaten bruker skarpere radier (2/4/6px). Bevisst avvik — kontraktsdokument-karakter krever nesten-skarpe kanter. Forhandlingsbordet arver Arbeidsflaten sine radier for sporkort og kontroller. system.md bør oppdateres med KOE-spesifikke r-*-verdier.

### Aksentfarge

Forhandlingsbordet bruker --vekt (amber) for handlinger og urgency. Arbeidsflaten har brukt warm-blue for interaktive kontroller.

**Beslutning:** Amber (--vekt) er primæraksenten for begge visninger:

- Handlingsknapper ("→ Svar", "Send svar §33")
- Fokusringer (--wire-focus)
- Aktive faner/segmenter
- Urgency-indikatorer (venstrekant, varsler)
- Checkbox-fill ved avkrysning

Semantiske farger (--score-high / --score-low) brukes for verdict-tilstander (godkjent/avslått) og innsigelsesmarkering, ikke for generelle kontroller. Submit-knapper bruker --vekt-bg med --vekt tekst.

### Delte mønstre

| Mønster | Definert i |
|---------|-----------|
| Sporkort, tidslinje, varslingsstatus | Forhandlingsbordet |
| Hendelseslogg (gjenbrukes i Historikk-fane) | Forhandlingsbordet |
| Forhåndsvisningspanel (hendelsesdetalj) | Forhandlingsbordet |
| Venstepanel i spordetalj (spornavigasjon) | Forhandlingsbordet |
| Key-value-rader, verdict-knapper, tall-input | Arbeidsflaten |
| LockedValue-tokens, konsekvens-callouts | Arbeidsflaten |
| Innsigelse-checkboxer, segmented controls | Arbeidsflaten |
| Sone-struktur (①②③④) | Arbeidsflaten |
| Action footer (lesemodus/redigeringsmodus) | Arbeidsflaten |

### Menneskelig-først-prinsippet

Forhandlingsbordet bruker konsekvent menneskelig språk ("du kan miste retten til å protestere") med §-referanser skjult bak hover. Arbeidsflaten tillater §-referanser som synlig tekst i sone ③ (der juristen jobber), men primærteksten er alltid menneskelig:

| Riktig | Feil |
|--------|------|
| ☑ Krav fremsatt for sent · §33.6.1 | ☑ Preklusjon §33.6.1 — spesifisert for sent |
| ⚠ Du kan miste retten til å protestere | ⚠ Passivitet §32.3 medfører rettighetsforfall |
| [Godkjent] [Delvis] [Avslått] | ○ Godkjent ○ Delvis ○ Avslått |

### Bevisste forskjeller

| Dimensjon | Forhandlingsbordet | Arbeidsflaten |
|-----------|-------------------|---------------|
| §-referanser | Skjult (hover/drill-down) | Synlig sekundær i sone ③ |
| Tetthet | Ekstremt (2–3 linjer) | Romsligere (skjema + editor) |
| Språk | Prosjektleder-først, alltid | Jurist-tilgjengelig i sone ③ |
| Informasjonsretning | Scanning (les, <3s) | Arbeid (skriv, minutter) |
| Layout | 2-kolonne (sidebar + tidslinje) | 3-kolonne (nav + beslutning + begrunnelse) |
| Interaksjon | Klikk → navigasjon | Redigering in-place |

---

## Design Foundation

```
Intent:    Kontraktsadministrator som tar juridiske posisjoner og
           skriver begrunnelser. Presist, autoritativt, dokumentaktig.
Depth:     Borders-only + surface shifts. Ingen skygger. Tynne rgba-linjer
           som strukturerer uten å kreve oppmerksomhet. Løft via lysere
           overflate (bg-default over bg-subtle), aldri via shadow.
           WHY: kontraktsdokumenter har linjer, ikke skygger.
Surfaces:  Tre nivåer:
           - Arbeidsflate: bg-pkt-bg-card (#ffffff) — hovedinnhold
           - Innsatt felt: bg-pkt-bg-subtle — inputs, referansekort
           - Innfelt/dybde: bg-pkt-bg-default — hendelseslogg, innfelte områder
           WHY: Dokumenter har bakgrunn, innsatte felt, og innrammede referanser.
           Surface shift erstatter shadow for dybdekommunikasjon.
Typography: Oslo Sans (pålagt av Punkt). To moduser:
           - UI-tekst: Oslo Sans for labels, titler, brødtekst
           - Data-tekst: font-mono (system monospace) med tabular-nums
             for tall, datoer, beløp
           WHY: Monospace for tall gir tabellkvalitet. Oslo Sans er
           kommunens font — ikke valgfritt.
Spacing:   4px base.
           WHY: 4px gir finere kontroll enn 8px for dense kontrollgrensesnitt.
           Sone ③ har tett vertikal stabling der 8px-steg er for grove.
```

---

## Scales

### Spacing

| Token | Verdi | Bruk |
|-------|-------|------|
| sp-1 | 4px | Ikon-gap, checkbox til label |
| sp-2 | 8px | Element-par, knapp til beskrivelse |
| sp-3 | 12px | Celle-padding, felt-mellomrom |
| sp-4 | 16px | Kort-padding innenfor soner |
| sp-5 | 20px | Seksjon-mellomrom (mellom §-seksjoner) |
| sp-6 | 24px | Sone-mellomrom (mellom ①②③④) |
| sp-8 | 32px | Hovedblokk-separasjon |

### Radius

Teknisk, ikke vennlig:

| Token | Verdi | Bruk |
|-------|-------|------|
| r-sm | 2px | Inputs, checkboxer, badges. Nesten skarpt — kontraktsdokument-karakter. |
| r-md | 4px | Kort, seksjoner, segmented controls |
| r-lg | 6px | Modaler, referansekort |
| r-full | 9999px | Progress bar, status-pills. Kun for indikatorer, ikke kontroller. |

### Typografi

| Nivå | Font | Størrelse | Weight | Tracking | Bruk |
|------|------|-----------|--------|----------|------|
| Seksjonsoverskrift | Oslo Sans | 11px | 500 | 0.06em | UPPERCASE. §-seksjoner i sone ③ |
| Feltlabel | Oslo Sans | 13px | 400 | normal | Radelabels i key-value-rader |
| Verdi | font-mono | 14px | 500 | tabular-nums | Tall, datoer, beløp |
| Brødtekst | Oslo Sans | 14px | 400 | normal | Løpende tekst i begrunnelse |
| Kontroll-tekst | Oslo Sans | 13px | 500 | normal | Verdict-knapper, checkbox-labels |
| Knappetekst | Oslo Sans | 13px | 600 | normal | Footer-knapper |
| Helper | Oslo Sans | 11px | 400 | normal | Differanse-tekst, dynamiske beregninger |
| §-ref inline | font-mono | inherit | 500 | normal | §-referanser i tekst |

### Ikonsystem

Lucide React. 16px standard, 14px i tett kontekst.

| Ikon | Bruk |
|------|------|
| `Info` | §-kontekst tooltip ved seksjonsoverskrifter |
| `Upload` | Filopplasting |
| `Paperclip` | Fil i vedleggsliste |
| `Calendar` | Dato-input trigger (custom popover, ikke native) |
| `AlertTriangle` | Advarsel (preklusjon, passivitet) |
| `Ban` | Kritisk advarsel (>14d uten svar) |
| `ChevronDown` | Ekspander/kollaps |
| `RotateCcw` | Regenerer begrunnelse |
| `X` | Slett vedlegg, lukk |
| `Loader2` | Loading-spinner i submit-knapp |

---

## Tilstandstabell

### Sone-tilstander

| Tilstand | Bakgrunn | Venstre kant | Footer |
|----------|----------|--------------|--------|
| Lesemodus — BH | bg-pkt-bg-card | ingen | Svar på krav · Godta · Revider |
| Lesemodus — TE | bg-pkt-bg-card | ingen | Send krav · Trekk tilbake |
| Redigeringsmodus | bg-pkt-bg-card | ingen | Avbryt · Send svar/krav §XX |
| Lukket — omforent | bg-pkt-bg-card | 2px solid --score-high | Ingen |
| Lukket — trukket | bg-pkt-bg-card | 2px dashed --ink-ghost | Ingen |
| Deaktivert (Force Majeure) | bg-pkt-bg-subtle | ingen | Ingen |

### Kontroll-interaksjonstilstander

| Element | Default | Hover | Focus | Disabled |
|---------|---------|-------|-------|----------|
| Verdict-knapp uvalgt | --canvas, --wire border | --wire-strong border | ring-2 --wire-focus | opacity-50 |
| Verdict-knapp valgt | semantisk bg (grønn/amber/rød), hvit tekst | — | — | opacity-50, cursor-not-allowed |
| Checkbox | border-default | bg-subtle/50 | ring-2 --wire-focus | opacity-50 |
| Tall-input | bg-subtle, border-subtle | border-default | border-2 --vekt, ring-1 | opacity-50 |
| Ja/Nei uvalgt | bg-subtle | border-default | ring-2 --wire-focus | opacity-50 |
| Segmented uvalgt | transparent | bg-subtle/50 | ring-2 --wire-focus | opacity-50 |
| Segmented valgt | bg-default, border-b-2 --vekt | — | — | — |
| Submit | bg --vekt, white | --vekt-dim | ring-2 --wire-focus | opacity-50 |

### Datatilstander

| Tilstand | Visuell behandling |
|----------|-------------------|
| Loading | Skeleton-rader i sone ①-③. Pulserende bg-subtle. |
| Tom (ingen krav) | Sentrert: «Ingen krav mottatt for dette sporet.» + handlingsknapp |
| Feil (lasting) | Rød alert med retry-knapp |
| Tom begrunnelse | Kontekstbasert placeholder (se §Dynamisk begrunnelsestekst) |
| Validering feilet | Input: border --score-low. Helper: --score-low feilmelding. |

### Valideringsfeil

| Felt | Regel | Melding |
|------|-------|---------|
| Godkjent dager | > krevd | «Kan ikke godkjenne mer enn krevd ({N}d)» |
| Godkjent beløp | > krevd | «Kan ikke godkjenne mer enn krevd ({N} kr)» |
| Godkjent ved "Delvis" | = 0 | «Delvis godkjenning krever verdi > 0» |
| Begrunnelse | < 10 tegn | «Begrunnelse er påkrevd (min. 10 tegn)» |
| Dato | ugyldig | «Ugyldig dato — bruk DD.MM.ÅÅÅÅ» |

---

## Komponent-tokens

### Seksjonsoverskrift med §-referanse

```
VARSLING §33.4                                         ⓘ
────────────────────────────────────────────────────────
```

```
container:
  margin-top: sp-5 (20px)
  padding-bottom: sp-2 (8px)
  border-bottom: 1px solid border-pkt-border-subtle

tittel:
  font: Oslo Sans, 11px, weight 500, UPPERCASE, tracking 0.06em
  farge: text-pkt-text-body-subtle

§-ref:
  font: font-mono, 11px, weight 500
  farge: text-pkt-text-body-subtle

info-ikon:
  Lucide Info, 14px, text-pkt-text-body-subtle
  posisjon: høyrestilt
  hover: text-pkt-text-body-default
  tooltip: bg-pkt-bg-card, border-subtle, r-md, max-width 280px
```

### Key-value-rad

```
Oppdaget ···················· 10.01.2026
```

```
rad:
  display: flex, justify-between, align-items baseline
  padding: sp-1 (4px) 0

label:
  Oslo Sans, 13px, weight 400, text-pkt-text-body-subtle

leader:
  flex: 1
  border-bottom: 1px dotted --wire
  margin: 0 sp-2 (8px)

verdi:
  font-mono, 13px, weight 400, tabular-nums
  text-pkt-text-body-default, white-space: nowrap
```

### Verdict-knapper (horisontal gruppe)

```
DIN VURDERING

┌──────────┐ ┌──────────────────┐ ┌──────────┐
│ Godkjent │ │ Delvis godkjent  │ │  Avslått │
└──────────┘ └──────────────────┘ └──────────┘
```

```
gruppe:
  display: flex, gap sp-2 (8px)
  margin-top: sp-3 (12px)

knapp:
  flex: 1
  høyde: 36px
  font: --font-ui, 13px, weight 500
  radius: r-sm (2px)
  border: 1px solid --wire
  transition: all 150ms ease
  text-align: center
  cursor: pointer

  uvalgt: bg --canvas (innfelt), --ink
    hover: --wire-strong border
  valgt — Godkjent: bg --score-high, text white, border transparent
  valgt — Delvis: bg --vekt, text white, border transparent
  valgt — Avslått: bg --score-low, text white, border transparent
  focus-visible: ring-2 --wire-focus
  disabled: opacity-50, cursor-not-allowed

varianter:
  3-valg: Godkjent / Delvis godkjent / Avslått (frist, vederlag)
  3-valg: Godkjent / Avslått / Frafalt (grunnlag)
  2-valg: Anerkjenner / Bestrider (forsering)
  2-valg: Akseptert / Bestridt (endringsordre)

WHY: Knapper føles som posisjoner du tar, ikke alternativer du velger.
     Semantisk farge gjør konsekvensen synlig i det du klikker.
     Samme mønster som Ja/Nei-valget, utvidet til 2–3 alternativer.
```

### Tall-input

```
Godkjent fristforlengelse
┌────────────────────────────────────────┐
│ 30                    │ kalenderdager  │
└────────────────────────────────────────┘
  Differanse: 15d (67% godkjent)
```

```
label:
  Oslo Sans, 13px, weight 400, text-subtle
  margin-bottom: sp-1 (4px)

input:
  bg: bg-pkt-bg-subtle (innsatt — mørkere signaliserer "skriv her")
  border: 1px solid border-pkt-border-subtle
  radius: r-sm (2px)
  padding: sp-2 (8px) sp-3 (12px)
  font: font-mono, 14px, weight 500, tabular-nums
  høyde: 36px

suffiks:
  Oslo Sans, 13px, weight 400, text-subtle
  innenfor input, høyrestilt
  separator: 1px solid border-subtle

helper:
  Oslo Sans, 11px, weight 400, margin-top sp-1
  differanse: text-subtle
  prosent: fargekodes (grønn ≥70%, amber 40–69%, rød <40%)
  oppdateres live (debounce 150ms)
```

### Innsigelse-checkbox

```
INNSIGELSER

  □  Varslet for sent
     §33.4 — frist for varsling oversittet
  ☑  Krav fremsatt for sent
     §33.6.1 — krav fremsatt etter fristen
```

Menneskelig tekst først. §-referanse som sekundær støtte. Arver Forhandlingsbordets "prosjektleder-først"-prinsipp — men i sone ③ der juristen jobber, er §-referansen synlig (ikke skjult bak hover).

```
gruppe:
  layout: vertikal stack, gap sp-2 (8px)
  margin-top: sp-3 (12px)

checkbox-rad:
  display: flex-col, gap sp-1 (4px)
  padding: sp-2 (8px) sp-3 (12px)
  radius: r-sm (2px)
  cursor: pointer

  primærlinje:
    display: flex, align-items center, gap sp-2 (8px)
    checkbox: 16×16px, border 2px, radius r-sm
      avkrysset: bg --vekt, ✓ hvit
    tekst: --font-ui, 13px, weight 500, --ink

  sekundærlinje:
    padding-left: 24px (checkbox + gap)
    §-ref: --font-data, 12px, weight 500, --ink-muted
    beskrivelse: --font-ui, 12px, weight 400, --ink-muted
    format: "§XX.X — forklaring"

  unchecked: --ink
  avkrysset: primærtekst --score-low (innsigelse = rødflagging)
    §-ref forblir --ink-muted
  hover: --felt-hover
  focus-visible: ring-2 --wire-focus
```

### Segmented control

```
BEREGNINGSMETODE §34

  ┌─────────────┬──────────────────┬─────────────┐
  │ Enhetspriser│ Regningsarbeid   │ Fastpris    │
  └─────────────┴──────────────────┴─────────────┘
```

```
container:
  bg: bg-pkt-bg-subtle
  border: 1px solid border-subtle
  radius: r-md (4px)
  padding: 2px
  display: flex

segment:
  font: Oslo Sans, 13px, weight 500
  padding: sp-1 (4px) sp-3 (12px)
  radius: r-sm (2px)
  transition: all 150ms ease

  uvalgt: transparent, text-subtle
    hover: bg-subtle/80
  valgt: bg-pkt-bg-default (surface shift — lysere = løftet)
    border-bottom: 2px solid --vekt (erstatter shadow-sm)
    text-default, weight 600

forklaringstekst:
  under kontroll, 13px, text-subtle
  dynamisk basert på valg
```

### Ja/Nei-valg

```
Har forholdet hindret fremdriften? §33.1
  ┌─────┐ ┌─────┐
  │  Ja │ │ Nei │
  └─────┘ └─────┘
```

```
label:
  Oslo Sans, 13px, weight 400
  §-ref: font-mono, weight 500
  margin-bottom: sp-2 (8px)

knapper:
  display: flex, gap sp-2 (8px)

  knapp:
    høyde: 36px, min-width: 52px (matcher tall-input for visuell konsistens)
    font: Oslo Sans, 13px, weight 500
    radius: r-sm (2px)
    border: 1px solid border-subtle
    transition: all 150ms ease

    uvalgt: bg-subtle, text-default
      hover: border-default
    valgt Ja: bg --score-high, text-white, border-transparent
    valgt Nei: bg --score-low, text-white, border-transparent
    focus-visible: ring-2 --wire-focus
```

### Konsekvens-callout

```
container:
  padding: sp-3 (12px) sp-4 (16px)
  radius: r-md (4px)
  border-left: 3px solid (semantisk farge)
  margin-top: sp-3 (12px)

varianter:
  godkjent: bg --score-high-bg, border-left --score-high
  avslått/advarsel: bg --vekt-bg, border-left --vekt
  kritisk: bg --score-low-bg, border-left --score-low
  info: bg-alert-info-bg, border-left --ink-muted

tekst: Oslo Sans, 13px, weight 400
ikon: Lucide AlertTriangle/Info, 16px, semantisk farge
```

### Betinget synlighet — overganger

```
vis:  opacity 0→1 over 150ms ease-out + max-height 0→auto over 200ms ease-out
skjul: opacity 1→0 over 100ms ease-in + max-height auto→0 over 150ms ease-in

WHY: Raskere enn 300ms (ekspertbruker), men ikke instant (desorienterende
i et langt scrollbart panel). Opacity først gir mykere opplevelse.
```

---

## Midtpanelet — Beslutningsflaten

Redigerbart protokoll-ark med fire soner.

**Above the fold:** Sone ① + ② + første seksjon av ③ synlig uten scrolling på 1080p (~280px). Resten scroller.

```
┌──────────────────────────────────────────────────┐
│  ① KRAVHODE                                     │
│──────────────────────────────────────────────────│
│  ② POSISJONSKORT                                │
│──────────────────────────────────────────────────│
│  ③ BESLUTNINGSFELT                              │
│──────────────────────────────────────────────────│
│  ④ RESULTATBOKS (redigeringsmodus)              │
│──────────────────────────────────────────────────│
│  FOOTER (sticky bottom)                          │
└──────────────────────────────────────────────────┘
```

```
panel:
  bg: bg-pkt-bg-card
  padding: sp-5 (20px)
  scrolling: overflow-y-auto (innhold scroller, footer sticky)
  separator mot venstepanel: ingen (overflateforskjell)
  separator mot høyrepanel:
    lesemodus: 1px solid border-pkt-border-subtle
    redigeringsmodus: 3px solid --vekt
```

### Sone ① — Kravhodet

Referansekort som forankrer svaret i det det svarer på.

**BH svarer (TEs krav som referanse):**

```
╔══════════════════════════════════════════════════╗
║  Krav fra TE — Veidekke                   Rev. 1 ║
║                                                  ║
║  Fremsatt krav                                   ║
║  45 kalenderdager  ·  Ny sluttdato 15.08.2026    ║
║  Varslet 15.01  ·  Krav 28.01                    ║
╚══════════════════════════════════════════════════╝
```

```
container:
  bg: bg-pkt-bg-subtle
  border: 1px solid border-pkt-border-subtle
  radius: r-md (4px)
  padding: sp-3 (12px) sp-4 (16px)

header:
  "Krav fra TE — [Firma]": Oslo Sans, 13px, weight 500, text-subtle
  "Rev. N": font-mono, 11px, weight 500, text-subtle, høyrestilt
  §-ref i kategori: sekundær (text-subtle, ikke uthevet)

data:
  font-mono, 13px, weight 400, tabular-nums, text-subtle
  prikk-separert (·), datoer DD.MM

tilstander:
  flat — ingen hover, ingen interaksjon
  versjonsmismatch: amber border-l-[3px], ⚠-banner under header
    "Du svarte på Rev. N — TE har oppdatert"
    endrede verdier med gjennomstreking på gammel verdi
```

**TE sender:** Kontekstkort med dato oppdaget, gjeldende versjon, ev. BH-forespørsel. Samme spec, tynnere innhold.

**Nulltilstand:** Sone ① tar 0px. Sone ② starter øverst.

### Sone ② — Posisjonskort

Kompakt horisontal stripe. Bare synlig når det finnes respons.

**Vederlag/Frist:**

```
┌──────────┬──────────┬──────────┐
│ KREVD    │ GODKJENT │ GRAD     │
│ kr 450k  │ kr 280k  │ 62%      │
├──────────┴──────────┴──────────┤
│ ████████████████░░░░░░░░░░░░░░ │
└────────────────────────────────┘
```

```
container:
  padding: sp-3 (12px) 0
  margin-bottom: sp-5 (20px)

kolonner (3, lik bredde):
  label: 11px, weight 500, UPPERCASE, tracking 0.06em, text-subtle
  verdi: 16px, font-mono, weight 600, tabular-nums
    krevd: --vekt
    godkjent: --score-high
    grad: ≥70% --score-high, 40–69% --vekt, <40% --score-low

progress bar:
  høyde: 6px (forhandlingsresultatet er hovedinformasjonen)
  radius: r-full
  bg: bg-pkt-bg-subtle
  fill: fargekodes som grad
  animasjon: transition-all 300ms ease-out

subsidiær-indikator:
  synlig når subsidiært finnes
  "Subs."-tag: 9px, uppercase, weight 600, --vekt, bg --vekt-bg
    padding 1px 4px, r-sm, ved GODKJENT-label
  subsidiært tall: 11px, font-mono, text-subtle, under hovedtall
```

**Grunnlag (binær, ikke tall):**

```
badge:
  godkjent: bg --score-high-bg, text --score-high
  avslått: bg --score-low-bg, text --score-low
  frafalt: bg-subtle, text-subtle
  font: 11px, uppercase, weight 600, tracking 0.06em
  padding: 2px 8px, r-full
```

**Nulltilstand:** Sone ② ikke synlig.

### Sone ③ — Beslutningsfelt

Feltene varierer mellom kravtyper og roller. De deler den visuelle grammatikken definert i §Komponent-tokens.

**Betinget synlighet per kravtype:**

Se §Per-kravtype detaljdesign for komplett mapping.

### Sone ④ — Resultatboks

Nederst i midtpanelet, kun i redigeringsmodus.

```
RESULTAT
────────────────────────────────────────────────────
  Prinsipalt     Delvis godkjent · 30 kalenderdager
  Subsidiært     Delvis godkjent · 20 kalenderdager
```

```
container:
  bg: bg-pkt-bg-subtle
  border-top: 1px solid border-subtle
  padding: sp-3 (12px) sp-4 (16px)
  margin-top: sp-5 (20px)

tittel: seksjonsoverskrift-stil (11px uppercase)

prinsipalt:
  Oslo Sans, 13px, weight 500, text-default
  badge: fargekodes (grønn/amber/rød)
  verdi: font-mono, tabular-nums

subsidiært:
  Oslo Sans, 13px, weight 400, text-subtle
  "Subs."-tag: 9px, uppercase, amber
  synlig: kun ved subsidiært standpunkt

oppdateres live (debounce 150ms)
```

---

## Høyrepanelet — Argumentasjonsflaten

```
panel:
  bg: bg-pkt-bg-card
  bredde: w-[340px]
    WHY: 340px gir ~55 tegn/linje — komfortabel skrivebredde for
    norsk kontraktstekst. Smalere enn 380px for å gi midtpanelet plass.
  venstre-kant:
    lesemodus: 1px solid border-subtle
    redigeringsmodus: 3px solid --vekt
  scrolling: overflow-y-auto
```

### Tab-strip

```
container:
  border-bottom: 1px solid border-subtle
  display: flex

tab:
  Oslo Sans, 13px, weight 500
  padding: sp-2 (8px) sp-3 (12px)
  border-bottom: 2px solid transparent
  text-subtle

  aktiv: text --vekt, border-bottom --vekt
  hover: text-default
  dimmet (under redigering): opacity-40, pointer-events-none
```

Tre faner: **Begrunnelse**, **Historikk**, **Filer**.

### Lesemodus — Begrunnelse-fane

Eksisterende begrunnelser som read-only blokker med rolle-badge.

```
┌──────────────────────────────────┐
│ TE  Krav fra Veidekke     Rev. 1 │
│ ┌──────────────────────────────┐ │
│ │ Forsinkelsen skyldes under-  │ │
│ │ leverandør Stålmontasje AS   │ │
│ │              ▾ Vis mer (3/8) │ │
│ └──────────────────────────────┘ │
│                                  │
│ BH  Svar fra Oslobygg    Rev. 1 │
│ ┌──────────────────────────────┐ │
│ │ Byggherren anser varselet    │ │
│ │ mottatt i tide...            │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

```
blokk-header:
  display: flex, justify-between
  margin-bottom: sp-2 (8px)

  rolle-badge:
    TE: bg-role-te-pill-bg, text-role-te-text
    BH: bg-role-bh-pill-bg, text-role-bh-text
    10px, uppercase, weight 600, padding 1px 6px, r-full
  firmanavn: Oslo Sans, 13px, weight 500
  revisjon: font-mono, 11px, text-subtle

tekst-container:
  bg: bg-pkt-bg-subtle
  border: 1px solid border-subtle
  radius: r-md (4px)
  padding: sp-3 (12px)
  font: Oslo Sans, 13px, weight 400, leading-relaxed

  LockedValue-tokens (read-only badges — egne domenefarger, IKKE score-semantikk):
    dager: bg-blue-200, border-blue, text-dark-blue
    beløp: bg-light-green-400, border-green, text-dark-green
    prosent: bg-[#f3e8ff], border-purple, text-dark-blue
    §-ref: bg --canvas, border --wire, text --ink
    alle: font-mono, 12px, weight 500, padding 0 4px, r-sm, border 1px
    WHY: Fargesemantikk per datatype, ikke per vurdering. Blå=tid,
         grønn=penger, lilla=prosent. Uavhengig av score-terskler.

  trunkering: 3 linjer + "Vis mer (N/M avsnitt)"
    "Vis mer": 11px, weight 500, text --vekt
    expand: max-height 200ms ease-out
```

### Lesemodus — Historikk-fane

Gjenbruker hendelseslogg-mønsteret fra Forhandlingsbordet, tilpasset full bredde.

```
hendelseslinje:
  [ikon 16px] [dato 42px mono] [tekst flex] [part 24px]
  padding: sp-2 (8px) sp-3 (12px)
  border-bottom: 1px solid border-subtle

  ikon: Lucide, 14px
    → Send/Clipboard: text-subtle
    ⚑ Flag: text-subtle
    ↻ RotateCcw: --vekt-dim
    ◇ CheckCircle: --score-high
    ✕ X: --score-low
  dato: font-mono, 11px, text-subtle, tabular-nums
  tekst: Oslo Sans, 12px, text-default
  part: font-mono, 11px, text-subtle

nulltilstand: "Ingen hendelser ennå.", sentrert, text-subtle
```

### Lesemodus — Filer-fane

```
fil-rad:
  display: flex, align-items center, gap sp-2 (8px)
  padding: sp-2 (8px) sp-3 (12px)
  border-bottom: 1px solid border-subtle
  hover: bg-subtle/50

  ikon: Lucide Paperclip, 14px, text-subtle
  filnavn: Oslo Sans, 13px, weight 400 (klikk åpner)
  størrelse: font-mono, 11px, text-subtle
  opplaster: 11px, text-subtle (rolle-badge + dato)

nulltilstand: "Ingen vedlegg.", sentrert
```

### Redigeringsmodus — Dual-block

Begrunnelse-fane transformeres. Andre faner dimmes.

**BH svarer:**

```
┌──────────────────────────────────┐
│ TE  Krav fra Veidekke            │
│ ┌──────────────────────────────┐ │
│ │ Forsinkelsen skyldes...      │ │
│ │              ▾ Vis mer (3/8) │ │
│ └──────────────────────────────┘ │
│                                  │
│ ··· TE → BH ···                 │
│                                  │
│ Din vurdering                    │
│ ┌──────────────────────────────┐ │
│ │                              │ │
│ │ [TipTap editor]             │ │
│ │                              │ │
│ │ ──────────────────           │ │
│ │ ¶  B  I                     │ │
│ └──────────────────────────────┘ │
│                                  │
│ VEDLEGG                          │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│   ⇧ Dra filer hit  · PDF, DOCX  │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
└──────────────────────────────────┘
```

**TE-blokk:** Samme spec som lesemodus begrunnelsesblokk. Komprimerbar.

**Separator:**

```
separator:
  "TE → BH" eller "BH → TE"
  Oslo Sans, 11px, --ink-ghost
  linje: border-top 1px dashed --wire
  tekst: bg-pkt-bg-card, padding 0 sp-2, sentrert over linjen
  margin: sp-4 (16px) 0
```

**Editor-blokk:**

```
label:
  "Din vurdering" (ikke "BHs vurdering (deg)")
  Oslo Sans, 13px, weight 500
  margin-bottom: sp-2 (8px)

editor-container:
  border: 2px solid border-focus (aktiv skrivesone)
  radius: r-md (4px)
  bg: bg-pkt-bg-card
  min-height: 200px

  innhold:
    padding: sp-3 (12px)
    Oslo Sans, 14px, weight 400, leading-relaxed

  LockedValue-tokens: ikke-redigerbare inline-badges
    kan flyttes, ikke slettes
    oppdateres live fra midtpanel-verdier

  toolbar (bunn):
    border-top: 1px solid border-subtle
    padding: sp-1 (4px) sp-3 (12px)
    knapper: ¶ B I — 28×28px, text-subtle
      hover: bg-subtle, text-default
      aktiv: bg-subtle, text --vekt

regenerer:
  under editor, "↻ Regenerer"
  Lucide RotateCcw + Oslo Sans 11px, weight 500, text --vekt
  hover: underline
```

**Vedlegg under editor:**

```
drop-sone:
  border: 1px dashed --wire-strong
  radius: r-md (4px)
  padding: sp-4 (16px)
  tekst: 13px, text-subtle, sentrert
  Lucide Upload, 20px, over tekst
  drag-over: border --vekt, bg --vekt-bg

fil-liste:
  margin-top: sp-2 (8px)
  rad: Lucide Paperclip + filnavn + størrelse (mono) + Lucide X (slett)
    slett hover: --score-low
```

**TE sender:** Ingen dual-block. Editor tar full høyde. Label: «Begrunnelse for kravet».

### Auto-begrunnelse

Bridge-hooks genererer begrunnelse automatisk. Teksten inneholder LockedValue-tokens.

```
Auto-generert eksempel (frist, BH delvis godkjent):

"Godkjenner {{dager:30:30 dager}} av {{dager:45:45 dager}}
({{prosent:67:67%}}). TE har varslet etter §33.4 den
{{dato:2026-01-15:15.01.2026}}, men fremsatt krav etter §33.6.1
ble sendt etter fristen. Innsigelse om preklusjon etter
{{paragraf:§33.6.1:§33.6.1}} fastholdes."
```

Første gang i edit-modus: auto-begrunnelse populerer editor. Regenerer-knapp: erstatter innhold med ny generering.

---

## Action Footer

Fast stripe i bunnen av midtpanelet.

```
footer:
  høyde: 52px (36px knapp + 2×8px padding — avledet fra spacing-skala)
  bg: bg-pkt-bg-card
  border-top: 1px solid border-subtle
  padding: 0 sp-5 (20px)
  display: flex, justify-between, align-items center
  position: sticky, bottom 0
```

### Lesemodus

```
┌──────────────────────────────────────────────────┐
│  Svar på krav  │  Revider  │  Godta svaret Rev. 1 │
└──────────────────────────────────────────────────┘
```

```
primær (Svar på krav / Send krav):
  bg --vekt, text white, 13px, weight 600
  padding sp-2 sp-4, radius r-sm, høyde 36px
  hover: --vekt-dim

aksepter:
  bg --score-high, text white (ellers som primær)

sekundær (Revider, Godta):
  transparent, border 1px solid border-subtle, text-default
  hover: bg-subtle

destruktiv (Trekk tilbake):
  transparent, text --score-low
  hover: bg --score-low-bg

revisjonslabel:
  font-mono, 11px, text-subtle, høyrestilt

synlighet: styrt av useActionPermissions per state og rolle
```

### Redigeringsmodus

```
┌──────────────────────────────────────────────────┐
│  Avbryt                           Send svar §33   │
└──────────────────────────────────────────────────┘
```

```
avbryt: ghost-variant, venstrestilt, trigger dirty-check

send:
  primær-variant, høyrestilt
  §-ref i tekst: "Send svar §33", "Send krav §34"
  loading: Lucide Loader2 + "Sender..."
  disabled: opacity-50 når !canSubmit

overgang lese↔redigering: umiddelbar (ingen animasjon)
```

---

## Interaksjonsmønstre

### Modusovergang: lese → redigere

1. Bruker klikker «Svar på krav» i footer.
2. Midtpanelet: kravhode → referansekort, beslutningsfelt vises, footer transformeres.
3. Høyrepanelet: editor aktiveres, faner dimmes, 3px accent-kant.
4. Auto-begrunnelse populerer editor.

Ingen modal, ingen sidenavigasjon, ingen scroll-jump.

### Live-oppdatering mellom paneler

Bruker endrer «Godkjent dager» fra 30 til 25:
1. Grad i posisjonskort: 67% → 56% (umiddelbart)
2. Progress bar: transition 300ms ease-out
3. LockedValue-token i editor: {{dager:30}} → {{dager:25}} (umiddelbart)
4. Resultatboks oppdateres (debounce 150ms)
5. Venstepanel mini-progress oppdateres

### Dirty-check ved avbryt

1. Sjekk begrunnelse endret ELLER felt dirty.
2. Dirty → Radix Dialog: «Du har ulagrede endringer. Forkast? / Fortsett.»
3. Ikke dirty → umiddelbar retur.

### Tastatur

| Tast | Handling |
|------|---------|
| Tab | Mellom feltgrupper |
| Space/Enter | Velg verdict-knapp/checkbox |
| Ctrl+Enter | Submit (fra editor) |
| Esc | Avbryt (med dirty-check) |

### Overgang: Forhandlingsbordet → Spordetalj

```
Forhandlingsbordet (2 kol)    Spordetalj (3 kol)
┌───────┬──────────┐          ┌─────────┬──────────┬──────────┐
│ Sak   │ Tidslinje│   →      │ Nav +   │Beslutning│Begrunnelse│
│ info  │ [kort]   │          │ spor    │ (midten) │ (høyre)  │
└───────┴──────────┘          └─────────┴──────────┴──────────┘
```

← Tilbake → returnerer til Forhandlingsbordet.

**Grensesnitt mot venstepanel (kontrakten):**
- Inn: aktivt spor, rolle, fristdata, sakskontekst
- Ut: endret tilstand, ny handling, dirty-status

---

## Per-kravtype detaljdesign

### Ansvarsgrunnlag — BH svarer

```
MIDTPANEL                                HØYREPANEL

┌───────────────────────────────┐        ┌──────────────────────────┐
│                               │        │ TE  Krav fra Veidekke    │
│  Krav fra TE — Veidekke       │        │ ┌──────────────────────┐ │
│  ╔═══════════════════════════╗│        │ │ Endringen oppstod... │ │
│  ║ Irregulær endring         ║│        │ │         ▾ Vis mer    │ │
│  ║ Oppdaget 10.01 · Varslet ║│        │ └──────────────────────┘ │
│  ║ 15.01.2026                ║│        │                          │
│  ╚═══════════════════════════╝│        │ ··· TE → BH ···         │
│                               │        │                          │
│  VARSLING §32.2           ⓘ  │        │ Din vurdering            │
│  ─────────────────────────── │        │ ┌──────────────────────┐ │
│  Varslet i tide?              │        │ │                      │ │
│  ┌─────┐ ┌─────┐             │        │ │ Byggherren anser     │ │
│  │  Ja │ │ Nei │             │        │ │ varselet mottatt i   │ │
│  └─────┘ └─────┘             │        │ │ tide, men avslår_    │ │
│                               │        │ │                ¶ B I │ │
│  DIN VURDERING                │        │ └──────────────────────┘ │
│  ┌────────┐┌───────┐┌───────┐│        │                          │
│  │Godkjent││Avslått││Frafalt││        │ VEDLEGG                  │
│  └────────┘└───────┘└───────┘│        │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐ │
│                               │        │   ⇧ Dra filer hit       │
│                               │        │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘ │
│  ┌ KONSEKVENS ──────────────┐│        └──────────────────────────┘
│  │ ⚠ Avslått → vederlag og  ││
│  │ frist behandles subsidiært││
│  └──────────────────────────┘│
│                               │
├───────────────────────────────┤
│ Avbryt          ▓ Send svar ▓│
└───────────────────────────────┘
```

> **NB wireframe:** Frafalt-knappen vises kun for ENDRING AND (IRREG eller VALGRETT) — se betinget synlighet.

**Betinget synlighet:**

```
Synlig hvis ENDRING AND underkategori ≠ EO:
  - Varsling §32.2 (Ja/Nei)
  - Preklusjonsadvarsel (hvis Nei)

Alltid synlig:
  - Verdict-knapper (Godkjent/Avslått)
  - Konsekvens-callout (dynamisk)

Synlig hvis ENDRING AND (IRREG eller VALGRETT):
  - Frafalt-alternativ i verdict-knapper

Synlig hvis oppdateringsmodus:
  - Nåværende svar-banner

Synlig hvis snuoperasjon (avslått → godkjent):
  - Snuoperasjon-alert
```

**Spesifikt:**
- Konsekvens-callout: Godkjent → success. Avslått → warning (subsidiær). Frafalt → info.
- Snuoperasjon-alert: success, «Subsidiære svar blir prinsipale.»
- Passivitets-advarsel (ENDRING, underkategori ≠ EO): 5-10d amber, >10d rød.

### Vederlagsjustering — BH svarer

```
MIDTPANEL

┌──────────────────────────────────────┐
│  Krav fra TE — Veidekke       Rev. 2 │
│  ╔══════════════════════════════════╗│
│  ║ Regningsarbeid                   ║│
│  ║ Hovedkrav: kr 1 800 000         ║│
│  ║ Rigg/drift: kr 350 000          ║│
│  ║ Produktivitet: kr 250 000       ║│
│  ║ Totalt krevd: kr 2 400 000      ║│
│  ╚══════════════════════════════════╝│
│                                      │
│  ┌────────┬─────────┬──────────┐    │
│  │ KREVD  │GODKJENT │ GRAD     │    │
│  │ 2,4M   │ 1,6M    │ 67%      │    │
│  ├────────┴─────────┴──────────┤    │
│  │ ███████████████░░░░░░░░░░░░ │    │
│  └─────────────────────────────┘    │
│                                      │
│  METODE §34.2                    ⓘ  │
│  ────────────────────────────────── │
│  TE valgte: Regningsarbeid          │
│                                      │
│  Aksepterer du TEs metodevalg?       │
│  ┌─────┐ ┌─────┐                    │
│  │  Ja │ │ Nei │                    │
│  └─────┘ └─────┘                    │
│                                      │
│  ┌ KRAVLINJER ─────────────────────┐ │
│  │                                  │ │
│  │  HOVEDKRAV §34.1             ⓘ  │ │
│  │  ──────────────────────────────  │ │
│  │  Varslet i tide?                 │ │
│  │  ┌─────┐ ┌─────┐               │ │
│  │  │  Ja │ │ Nei │               │ │
│  │  └─────┘ └─────┘               │ │
│  │                                  │ │
│  │  Krevd ·············· kr 1 800k │ │
│  │  ┌────────────────────────────┐ │ │
│  │  │ 1 200 000            │ kr │ │ │
│  │  └────────────────────────────┘ │ │
│  │  Differanse: -600k (67%)        │ │
│  │                                  │ │
│  │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │ │
│  │                                  │ │
│  │  RIGG OG DRIFT §34.1.3      ⓘ  │ │
│  │  ──────────────────────────────  │ │
│  │  [samme per-kravlinje-mønster]  │ │
│  │                                  │ │
│  │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │ │
│  │                                  │ │
│  │  PRODUKTIVITET §34.1.3       ⓘ  │ │
│  │  ──────────────────────────────  │ │
│  │  [samme per-kravlinje-mønster]  │ │
│  │                                  │ │
│  └──────────────────────────────────┘ │
│                                      │
│  RESULTAT                            │
│  ────────────────────────────────── │
│  Prinsipalt   Delvis · kr 1 600 000 │
│  Subsidiært   Delvis · kr 1 400 000 │
│                                      │
├──────────────────────────────────────┤
│ Avbryt           ▓ Send svar §34 ▓  │
└──────────────────────────────────────┘
```

**Betinget synlighet:**

```
Alltid synlig:
  - Kravhode (TEs krav)
  - Svarplikt-advarsel (>5d siden krav mottatt): danger-alert
    «Svarplikt — {N} dager siden krav mottatt. Risiko for passiv aksept (§30.3.2).»
  - Metode-evaluering:
    · TEs valg som key-value-rad
    · Ja/Nei: "Aksepterer du TEs metodevalg?"
    · Synlig hvis Nei: segmented for BHs alternativ

Synlig for hvert kravlinje (hovedkrav, rigg, produktivitet):
  - Varsling (Ja/Nei) — kun SVIKT/ANDRE, IKKE ENDRING
  - Godkjent beløp (tall-input)
  - Resultat-badge (beregnet)

Synlig hvis grunnlag avslått:
  - Subsidiær-kontekstalert

Synlig hvis ENHETSPRISER + TE krever_justert_ep:
  - EP-justering §34.3.3 (Ja/Nei + konsekvens-alert ved Nei)

Synlig hvis REGNINGSARBEID uten kostnadsoverslag:
  - Tilbakeholdelse §30.2 (checkbox + estimert grense)
```

**Kravlinje-container (squint-test-løsning):**

Vederlag har ~10 seksjoner. Uten gruppering smelter de sammen. Kravlinjene (HOVEDKRAV, RIGG, PRODUKTIVITET) er underposter — visuelt underordnet METODE og DIN VURDERING.

```
kravlinje-container:
  bg: --canvas (innfelt — tydelig underordnet --felt-overflaten)
  border: 1px solid --wire
  radius: r-md (4px)
  padding: sp-4 (16px)
  margin-top: sp-3 (12px)

  label: "KRAVLINJER" i seksjon-label-stil (11px uppercase --ink-ghost)
    posisjon: over container, bakgrunn --felt, padding 0 sp-2

  kravlinje-separator:
    1px dashed --wire (ikke solid — lettere enn seksjonsseparatorer)
    margin: sp-3 (12px) 0

  kravlinje-overskrift:
    11px, weight 500, UPPERCASE, tracking 0.06em, --ink-muted
    innrykk: 0 (starter ved container-kant, ikke sp-4 ekstra)

WHY: Innfelt container gjør kravlinjene til én visuell blokk.
Stipplet separator mellom linjer er lettere enn solid —
signaliserer "samme gruppe, ulik post." Squint-test: METODE (hvit) →
KRAVLINJER (grå boks) → RESULTAT (grå) — tre distinkte toneflater.
```

**Spesifikt:**
- **Metodevalg er vurdering.** BH ser TEs valg, evaluerer, foreslår alternativ bare ved uenighet.
- **Per-kravlinje:** Tre poster i kravlinje-container med egne varsling-toggles og beløp.
- **Tilbakeholdelse §30.2:** Checkbox + beløp-input. Gir separat resultat «HOLDT TILBAKE» (amber).
- **EP-justering §34.3.3:** Ja/Nei. Nei → warning: «Avvist → reduksjon i vederlag.»

### Fristforlengelse — BH svarer

```
MIDTPANEL

┌──────────────────────────────────────┐
│  Krav fra TE — Veidekke       Rev. 1 │
│  ╔══════════════════════════════════╗│
│  ║ Fremsatt krav                    ║│
│  ║ 45 kalenderdager · Ny dato       ║│
│  ║ 15.08.2026                       ║│
│  ║ Varslet 15.01 · Krav 28.01       ║│
│  ╚══════════════════════════════════╝│
│                                      │
│  ┌────────┬─────────┬──────────┐    │
│  │ KREVD  │GODKJENT │ GRAD     │    │
│  │ 45d    │ 30d     │ 67%      │    │
│  ├────────┴─────────┴──────────┤    │
│  │ ██████████████████░░░░░░░░░ │    │
│  └─────────────────────────────┘    │
│                                      │
│  VARSLING §33.4                  ⓘ  │
│  ────────────────────────────────── │
│  Oppdaget ·················· 10.01  │
│  Varslet ··················· 15.01  │
│                                      │
│  FREMSATT KRAV §33.6.1           ⓘ  │
│  ────────────────────────────────── │
│  Fremsatt ·················· 28.01  │
│                                      │
│  INNSIGELSER                         │
│  ────────────────────────────────── │
│  □  Varslet for sent                 │
│     §33.4 — kravet tapes             │
│     (full preklusion)                │
│  ☑  Krav fremsatt for sent          │
│     §33.6.1 — reduseres til det BH  │
│     måtte forstå (ikke preklusion)   │
│                                      │
│  VILKÅR FOR FRISTFORLENGELSE §33.1 ⓘ│
│  ────────────────────────────────── │
│  Har forholdet hindret fremdriften?  │
│  ┌─────┐ ┌─────┐                    │
│  │  Ja │ │ Nei │                    │
│  └─────┘ └─────┘                    │
│                                      │
│  BEREGNING §33.5                 ⓘ  │
│  ────────────────────────────────── │
│  ╌ Begrenset godkjenning (§33.6.1)  │
│    kun det BH måtte forstå          │
│  Godkjent fristforlengelse          │
│  ┌──────────────────────────────┐   │
│  │ 30                │ kaldager │   │
│  └──────────────────────────────┘   │
│  Differanse: 15d (67% godkjent)     │
│                                      │
│  ┌── Auto-beregnet ───────────────┐ │
│  │ Resultat: Delvis godkjent      │ │
│  │   — 30 av 45 dager (67%)      │ │
│  │ ↳ Subsidiært: Delvis godkjent │ │
│  │   (30 av 45 dager)            │ │
│  └───────────────────────────────┘ │
│                                      │
│  RESULTAT                            │
│  ────────────────────────────────── │
│  Prinsipalt   Delvis · 30 kaldager  │
│  ↳ Subsidiært Subs. · 30 kaldager  │
│                                      │
├──────────────────────────────────────┤
│ Avbryt           ▓ Send svar §33 ▓  │
└──────────────────────────────────────┘
```

**Betinget synlighet:**

```
Alltid synlig:
  - Kravhode (TEs krav)
  - Varsling §33.4 (key-value datoer: Oppdaget, Varslet)
  - Innsigelse-checkboxer (§33.4, §33.6.1 — menneskelig tekst, §-ref sekundær)
  - Vilkår for fristforlengelse §33.1 (Ja/Nei — substansiell vurdering, ikke preklusion)

Synlig når spesifisert_varsel finnes (TE har fremsatt krav):
  - Fremsatt krav §33.6.1 (dato-rad)

Synlig når §33.6.1-innsigelse er haket av:
  - Begrensningsnotat i BEREGNING §33.5:
    «Begrenset godkjenning (§33.6.1) — kun det BH måtte forstå»

Synlig når vilkår §33.1 er vurdert (Ja eller Nei):
  - BEREGNING §33.5 (tall-input + auto-beregnet resultat)

Auto-beregnet resultat (ingen manuell DIN VURDERING):
  - Prinsipalt: godkjent/delvis/avslått — avledet fra §33.1 + godkjentDager
  - Subsidiært: vises når minst én av følgende er oppfylt:
      · §33.4 innsigelse er haket av (varslet for sent)
      · §33.6.1 innsigelse er haket av (krav fremsatt for sent)
      · §33.1 = Nei (vilkår ikke oppfylt)
      · Grunnlag vurdert subsidiært (§32.2)
    Samme godkjentDager, systemmerket «Subs.»

Synlig hvis BH har sendt forespørsel:
  - Kontekstalert: «Du etterlyste spesifisering innen [frist].»

Synlig hvis varsel_type = 'varsel' AND frist_varsel_ok = Ja:
  - «Send forespørsel om spesifisering?» (Ja/Nei) — §33.6.2
  - [Synlig hvis Ja:] Frist for svar (dato-input)
  - Resultat settes automatisk til «Avventer fremsatt krav»

Synlig hvis TE svarte på forespørsel (er_svar_pa_foresporsel):
  - «Kom svaret i tide?» (Ja/Nei) — §33.6.2
  - [Nei:] Preklusion (danger): «Kravet tapes (§33.6.2 tredje ledd)»
  - [Ja:] Info-alert: «§33.6.2 fjerde ledd — BH kan ikke påberope §33.6.1»
    (§33.6.1-innsigelsen skjules)

Synlig hvis varsel_type = 'begrunnelse_utsatt':
  - Forenklet BH-visning (ikke 4-port wizard):
    Read-only TEs begrunnelse + valgfri kommentar + «Bekreft mottak»

Synlig hvis resultat = Avslått ELLER Delvis godkjent:
  - §33.8 forsering-advarsel (warning):
    «Avslag/delvis godkjenning kan gi TE rett til å forsere.
     Forseringskostnad begrenset til dagmulkt × 1,3.»
```

**Spesifikt:**
- **Fem seksjoner:** Varsling §33.4 (datoer), Fremsatt krav §33.6.1 (dato), Innsigelser (§33.4/§33.6.1 checkboxer), Vilkår §33.1 (Ja/Nei), Beregning §33.5 (tall-input).
- **Auto-beregnet:** Resultat avledes fra innsigelsestilstand + vilkår + godkjentDager. Ingen manuell «DIN VURDERING»-seksjon med verdict-knapper.
- **Subsidiært:** Auto-vist (ingen separat tallinput) når minst én innsigelse er haket av, §33.1 = Nei, eller grunnlag subsidiært. Samme godkjentDager, systemmerket «Subs.»
- **Forespørsel §33.6.2:** BH kan sende forespørsel når TE kun har sendt nøytralt varsel og det er sendt i tide. TE svarer med fremsatt krav eller begrunnelse_utsatt. Ved begrunnelse_utsatt vises forenklet mottak-skjerm (ingen wizard).

### TE sender — alle kravtyper

**Frist:**

```
MIDTPANEL

┌──────────────────────────────────────┐
│  TYPE KRAV                            │
│  ┌───────────┬──────────────┐        │
│  │  Varsel   │ Spesifisert  │        │
│  └───────────┴──────────────┘        │
│                                      │
│  Allerede varslet?                   │
│  ┌─────┐ ┌─────┐                    │
│  │  Ja │ │ Nei │                    │
│  └─────┘ └─────┘                    │
│  [Synlig hvis Ja:]                   │
│  Varslet dato                        │
│  ┌──────────────────────────────┐   │
│  │ 15.01.2026              📅  │   │
│  └──────────────────────────────┘   │
│                                      │
│  KREV FRISTFORLENGELSE §33.6        │
│  ────────────────────────────────── │
│  Krevd kalenderdager                 │
│  ┌──────────────────────────────┐   │
│  │ 45                │ kaldager │   │
│  └──────────────────────────────┘   │
│  Ny sluttdato (valgfritt)           │
│  ┌──────────────────────────────┐   │
│  │ 15.08.2026              📅  │   │
│  └──────────────────────────────┘   │
│                                      │
│  VEDLEGG                            │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│    ⇧ Dra filer hit  · PDF, DOCX    │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                      │
├──────────────────────────────────────┤
│ Avbryt     ▓ Send krav §33.6 ▓      │
└──────────────────────────────────────┘
```

**Betinget synlighet:**

```
Alltid synlig:
  - Varseltype (segmented)
    · new: Varsel / Spesifisert
    · spesifisering: Spesifisert (låst)
    · foresporsel: Spesifisert / Begrunnelse utsatt
    · edit: Beholder type (låst)

Synlig i new-scenario:
  - tidligereVarslet (Ja/Nei) + dato-input ved Ja

Synlig hvis Spesifisert:
  - Krevd dager + ny sluttdato (valgfritt)

Scenario-kontekstalert:
  · spesifisering: «Du spesifiserer dager for varselet sendt [dato].»
  · foresporsel: «BH etterlyste spesifisering innen [frist].»

Alltid synlig:
  - Vedlegg
```

**Vederlag:**

```
MIDTPANEL

┌──────────────────────────────────────┐
│  BEREGNINGSMETODE §34                │
│  ┌────────────┬──────────┬────────┐ │
│  │Enhetspriser│Regningsarb│Fastpris│ │
│  └────────────┴──────────┴────────┘ │
│  Kjente kostnader basert på medgått │
│  tid og materialforbruk.            │
│                                      │
│  Kostnadsoverslag                    │
│  ┌──────────────────────────────┐   │
│  │ 1 800 000              │ kr │   │
│  └──────────────────────────────┘   │
│                                      │
│  ☑  Varslet før oppstart            │
│     §34.2.2                          │
│                                      │
│  ┌ SÆRSKILTE KRAV §34.1.3 ────────┐ │
│  │                                  │ │
│  │  ☑  Rigg og drift               │ │
│  │  ┌────────────────────────────┐ │ │
│  │  │ 350 000              │ kr │ │ │
│  │  └────────────────────────────┘ │ │
│  │  Fra dato                       │ │
│  │  ┌────────────────────────────┐ │ │
│  │  │ 01.02.2026          📅   │ │ │
│  │  └────────────────────────────┘ │ │
│  │                                  │ │
│  │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │ │
│  │                                  │ │
│  │  ☑  Produktivitetstap           │ │
│  │  ┌────────────────────────────┐ │ │
│  │  │ 250 000              │ kr │ │ │
│  │  └────────────────────────────┘ │ │
│  │                                  │ │
│  └──────────────────────────────────┘ │
│                                      │
│  VEDLEGG                            │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│    ⇧ Dra filer hit  · PDF, DOCX    │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                      │
├──────────────────────────────────────┤
│ Avbryt        ▓ Send krav §34 ▓     │
└──────────────────────────────────────┘
```

**Betinget synlighet:**

```
Alltid synlig:
  - Metode-segmented (Enhetspriser/Regningsarbeid/Fastpris)

Synlig per metode:
  · Enhetspriser: beløp + justerte EP toggle
  · Regningsarbeid: kostnadsoverslag + varslet før oppstart toggle
  · Fastpris: beløp

Alltid synlig:
  - Særskilte krav §34.1.3 (i kravlinje-container)
    · Rigg/drift toggle + beløp + dato
    · Produktivitet toggle + beløp + dato
  - Vedlegg
```

**Spesifikt:**
- **TE-mockup speiler BH-strukturen:** Kravhode er fraværende (TE skriver, ikke svarer). Sone ① tar 0px.
- **Kravlinje-container:** Særskilte krav grupperes i innfelt --canvas-container (samme mønster som BH Vederlag).
- **Segmented starter utfylt:** TEs metodevalg er låst etter første innsending. Redigeringsmodus forhåndsvelger.

**Grunnlag:** TE varsler via Forhandlingsbordet. Spordetaljvisningen viser read-only varsel.

---

## Forsering (§33.8)

### TE varsler forsering

```
┌──────────────────────────────────────┐
│ FORSERING §33.8                      │
│                                      │
│ AVSLÅTTE FRISTKRAV                   │
│ ────────────────────────────────── │
│ Sak #12: Stålmontasje · 15d avslått │
│ Sak #15: Grunnarbeid · 20d avslått   │
│                                      │
│ Sum avslåtte dager ········ 35 dager │
│ Dagmulktssats ··········· kr 50 000 │
│                                      │
│ 30%-REGELEN §33.8                    │
│ ────────────────────────────────── │
│ Maks kostnad ···· kr 2 275 000       │
│ (35d × kr 50k × 1,3)                │
│                                      │
│ ☑  Jeg bekrefter at estimert         │
│    kostnad er under grensen          │
│                                      │
│ Estimert kostnad                     │
│ ┌──────────────────────────────┐    │
│ │ 1 800 000              │ kr │    │
│ └──────────────────────────────┘    │
│ Margin: kr 475 000 (21%)            │
│                                      │
│ Varslet forsering                    │
│ ┌──────────────────────────────┐    │
│ │ 01.03.2026                   │    │
│ └──────────────────────────────┘    │
│                                      │
├──────────────────────────────────────┤
│ Avbryt     ▓ Send forseringsvarsel ▓ │
└──────────────────────────────────────┘
```

**Dato-input:** Custom calendar popover (Lucide Calendar trigger), ikke native `<input type="date">`.

### BH evaluerer forsering

```
VURDERING PER SAK
────────────────────────────────────────
Sak #12: Stålmontasje · 15d
  ┌─────────────┐ ┌───────────┐
  │ Anerkjenner │ │ Bestrider │
  └─────────────┘ └───────────┘

Sak #15: Grunnarbeid · 20d
  ┌─────────────┐ ┌───────────┐
  │ Anerkjenner │ │ Bestrider │
  └─────────────┘ └───────────┘

Dager med forseringsrett ········ 20d

30%-REGELEN                    (auto-beregnet)
────────────────────────────────────────
Maks kostnad ···· kr 2 275 000
Estimert kostnad ···· kr 1 800 000
Overholdt ···· ✓ Ja

SÆRSKILTE KRAV                  (per kravlinje)
────────────────────────────────────────
[Synlig hvis rigg/drift-krav > 0:]
Rigg/drift §34.1.3
  Varslet i tide?
  ┌─────┐ ┌─────┐
  │  Ja │ │ Nei │  → [Nei: evalueres subsidiært]
  └─────┘ └─────┘
  ┌──────────┐ ┌──────────────────┐ ┌──────────┐
  │ Godkjent │ │ Delvis godkjent  │ │  Avslått │
  └──────────┘ └──────────────────┘ └──────────┘
  [Synlig hvis delvis:] Godkjent beløp ···· kr ______

[Synlig hvis produktivitetstap-krav > 0:]
Produktivitetstap §34.1.3
  Varslet i tide?
  ┌─────┐ ┌─────┐
  │  Ja │ │ Nei │  → [Nei: evalueres subsidiært]
  └─────┘ └─────┘
  ┌──────────┐ ┌──────────────────┐ ┌──────────┐
  │ Godkjent │ │ Delvis godkjent  │ │  Avslått │
  └──────────┘ └──────────────────┘ └──────────┘
  [Synlig hvis delvis:] Godkjent beløp ···· kr ______

BELØPSVURDERING (hovedkrav)
────────────────────────────────────────
NB: Gjelder forseringskostnadens godkjenning.
Forseringsretten bruker Anerkjenner/Bestrider per sak (over).

┌──────────┐ ┌──────────────────┐ ┌──────────┐
│ Godkjent │ │ Delvis godkjent  │ │  Avslått │
└──────────┘ └──────────────────┘ └──────────┘

[Synlig hvis godkjent/delvis:]
Godkjent beløp
┌──────────────────────────────────┐
│ 1 200 000                │ kr  │
└──────────────────────────────────┘

Tilleggskommentar (valgfri)
────────────────────────────────────────
Legges til den auto-genererte begrunnelsen i høyrepanelet.
```

---

## Endringsordre (§31.3)

### BH oppretter EO

```
┌──────────────────────────────────────┐
│ ENDRINGSORDRE §31.3                  │
│                                      │
│ EO-nummer                            │
│ ┌────────────────────────────────┐  │
│ │ EO-2026-003                    │  │
│ └────────────────────────────────┘  │
│                                      │
│ RELATERTE KOE-SAKER                  │
│ ────────────────────────────────── │
│ ☑  #12 Stålmontasje     kr 1.8M    │
│ ☑  #15 Grunnarbeid       kr 450k    │
│ □  #18 Prosjektering     —          │
│                                      │
│ KONSEKVENSER                         │
│ ────────────────────────────────── │
│ ☑ SHA  ☑ Fremdrift  □ Kvalitet     │
│ □ Pris  □ Annet                     │
│                                      │
│ OPPGJØR                             │
│ ────────────────────────────────── │
│ ┌────────────┬──────────┬────────┐ │
│ │Enhetspriser│Regningsarb│Fastpris│ │
│ └────────────┴──────────┴────────┘ │
│                                      │
│ Kompensasjon ·········· kr 2 250 000│
│ Fradrag §34.4 ·········· kr 100 000│
│ Netto ·················· kr 2 150 000│
│                                      │
│ Fristforlengelse ·········· 35 dager│
│ Ny sluttdato ···········  05.09.2026│
│                                      │
├──────────────────────────────────────┤
│ Lagre utkast        ▓ Utstede EO ▓  │
└──────────────────────────────────────┘
```

### TE svarer på EO

```
DIN VURDERING
────────────────────────────────────────
┌────────────┐ ┌───────────┐
│ Akseptert  │ │ Bestridt  │
└────────────┘ └───────────┘

[Synlig hvis Bestridt:]
⚠  Du kan sende alternativt KOE-krav
```

---

## Aksept og lukking

TE har tre valg **per spor** (grunnlag, vederlag, frist) i lesemodus-footer:

```
┌──────────────────────────────────────────────────┐
│  Revider krav  │  Trekk tilbake  │  Aksepter svar │
└──────────────────────────────────────────────────┘
```

Aksept og trekk gjelder **ett spor av gangen**, ikke hele saken globalt.

### Aksept (per spor)

Grønn variant. Bekreftelses-dialog som viser BHs posisjon for det aktuelle sporet:

```
AKSEPTER SVAR — Vederlag

BH sin posisjon: Delvis godkjent — kr 1 200 000

┌──────────────────────────────────────┐
│ Kommentar (valgfri)                  │
│                                      │
└──────────────────────────────────────┘

⚠  Denne handlingen kan ikke angres.

         ┌───────────┐ ┌───────────┐
         │  Avbryt   │ │ Aksepter  │
         └───────────┘ └───────────┘
```

Etter aksept: read-only verdier + OMFORENT-badge for det sporet.

### Trekk tilbake (per spor, med kaskadering)

Destruktiv ghost. Bekreftelses-dialog med valgfri begrunnelse.

**Kaskaderegler:**

| Handling | Kaskadering | Alert |
|----------|-------------|-------|
| Trekk grunnlag (vederlag/frist aktiv) | → trekker alle aktive spor | danger: «Dette vil trekke hele saken» |
| Trekk grunnlag (ingen aktive krav) | Ingen | warning: «Er du sikker?» |
| Trekk vederlag (frist inaktiv) | → trekker også grunnlag | danger: «Dette vil også trekke ansvarsgrunnlaget» |
| Trekk frist (vederlag inaktiv) | → trekker også grunnlag | danger: «Dette vil også trekke ansvarsgrunnlaget» |
| Trekk vederlag (frist fortsatt aktiv) | Ingen | warning: «Er du sikker?» |
| Trekk frist (vederlag fortsatt aktiv) | Ingen | warning: «Er du sikker?» |

«Inaktiv» = ikke_relevant, utkast, eller trukket.

### Revider

Ghost. Redigeringsmodus med pre-populerte verdier. Rev-nummer øker.

---

## Force Majeure — vederlag deaktivert

```
Vederlag-visning ved FORCE_MAJEURE:

  Vederlag er ikke relevant for
  Force Majeure-saker.

  Kun fristforlengelse kan kreves (§33.1 c).

tekst: 14px, text-subtle, sentrert
ingen felter, ingen footer-actions
```

---

## Preklusjonsadvarsel for TE (frist)

Beregnet fra dato_oppdaget. Alert i kravhodet:

| Dager | Nivå | Melding |
|-------|------|---------|
| 0–7 | Ingen | — |
| 7–14 | Amber | «Det er {N} dager siden forholdet ble oppdaget. Vurder å sende varsel snart.» |
| >14 | Rød | «Det er {N} dager siden forholdet ble oppdaget. Risiko for preklusjon.» |

---

## Dynamisk begrunnelsestekst

Placeholder i editor endres basert på kontekst:

| Kontekst | Placeholder |
|----------|-------------|
| Grunnlag godkjent | «Begrunn godkjenningen — referér til kontraktsbestemmelsen.» |
| Grunnlag avslått | «Begrunn avslaget — forklár hvorfor forholdet ikke gir TE rett.» |
| Grunnlag frafalt | «Begrunn frafallet — TE har krevet endring, BH trekker pålegget.» |
| Vederlag delvis | «Begrunn godkjenningsgraden — forklár hva som dekkes og avvises.» |
| Vederlag med preklusjon | «Begrunn prinsipalt avslag og subsidiær evaluering.» |
| Frist med innsigelse | «Begrunn godkjente dager og innsigelsene.» |
| TE sender krav | «Begrunn kravet — beskriv forholdet og henvis til kontrakten.» |

---

## Responsive

Tre-panel-layouten krever minimalt 1280px. Under det er ikke sporadministrasjon komfortabelt. Desktop-verktøy — samme filosofi som Forhandlingsbordet.

```
Tre-panel grid: [nav 220px] [midtpanel 1fr] [høyrepanel 340px]
Min midtpanel-bredde: ~500px (under dette kollapser skjemafelt)
Total minimumbredde: 220 + 500 + 340 = 1060px + padding
```

| Bredde | Tilpasning |
|--------|-----------|
| ≥1440px | Full layout. Alle tre paneler. Midtpanelet har komfortabel bredde (~680px+). |
| 1280–1439px | Full layout, men midtpanelet smalner. Kravlinje-containeren stacker felt vertikalt i stedet for horisontal key-value der nødvendig. |
| 1024–1279px | Høyrepanelet kollapser til 48px tab-stripe (vertikal: B/H/F-ikoner). Klikk ekspanderer til 340px overlay med slide-in. Midtpanelet tar full bredde. |
| <1024px | Ikke støttet (desktop-verktøy). |

**Kollapset høyrepanel (1024–1279px):**

```
┌─────────┬──────────────────────────────────┬───┐
│ Nav     │ Midtpanel (full bredde)          │ B │
│ 220px   │                                  │ H │
│         │                                  │ F │
└─────────┴──────────────────────────────────┴───┘
                                              48px
```

- Tab-stripe: 48px bred, --felt bakgrunn, border-left --wire
- Ikoner: Lucide (FileText/Clock/Paperclip), 18px, --ink-muted, aktiv: --vekt
- Klikk: panelet glir ut til 340px over midtpanelet (overlay, ikke push)
- Bakgrunn: --felt-raised, box-shadow: -4px 0 12px rgba(0,0,0,0.15) (unntak fra borders-only — overlay trenger dybde)
- Escape / klikk utenfor: kollapser tilbake

**Konsistens med Forhandlingsbordet:**
Forhandlingsbordet kollapser sidebar ved 1024–1279px, Arbeidsflaten kollapser høyrepanelet i samme intervall. Navpanelet beholder 220px ned til 1024px — det er allerede kompakt.

---

## Dark mode

Arbeidsflaten respekterer `.dark`-klassen. Workspace-spesifikke tilpasninger:

- **Kravhode:** bg-subtle → dark-ekvivalent (mørkere enn canvas)
- **Editor-border:** Økt opacity for focus-border i dark mode
- **LockedValue-tokens:** Lett desaturering (semantiske farger trenger det)
- **Progress bar:** 80% opacity i dark mode
- **Separatorer:** Allerede borders-only — fungerer bedre i dark enn skygger

Detaljerte dark mode-tokens defineres i samarbeid med Anskaffelsesdesignets tema-tabell.

---

## Mandate-sjekker

### Swap-test

**Innhold:** Monospace-tall, UPPERCASE-seksjonsoverskrifter, §-referanser, LockedValue-tokens — fjern noen av disse og karakteren forsvinner. **Bestått.**

**Struktur:** Fire-sone-stackingen er et kjent mønster. Det som redder det: tre-panel-arkitekturen (beslutning | argumentasjon som romlig separasjon av kognitive moduser) er genuint domene-drevet. **Delvis bestått.**

### Squint-test

Fire soner med alternerende overflater: grå referanse → tall → hvite kontroller → grå resultat. Hierarki synlig uten å lese.

Vederlag BH: kravlinjer (HOVEDKRAV, RIGG, PRODUKTIVITET) gruppert i innfelt --canvas-container med stiplede separatorer. Tre toneflater: METODE (--felt) → KRAVLINJER (--canvas boks) → RESULTAT (--canvas). **Bestått.**

### Signatur-test

§-referanser i: seksjonsoverskrifter, knappetekst, checkbox-labels (menneskelig-først), LockedValue-tokens, konsekvens-alerts. Verdict-knapper med semantisk farge er domene-spesifikke (godkjent=grønn, avslått=rød). **Bestått.**

### Token-test

Analysebordet-tokens (--felt, --vekt, --wire, --ink, --score-*) brukes konsistent i alle komponentspecs. warm-blue-remnanter fjernet. pkt-*-mapper i konsistenstabellen oppdatert med (†)-merknad om amber-migrering. LockedValue-tokens dokumentert som separate domenefarger. **Bestått.**
