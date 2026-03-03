# Designdokument — Arbeidsflaten (midtpanel + høyrepanel)

**Dato:** 2026-03-03
**Revisjon:** 2 — revidert etter interface-design::init-kritikk
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
| VerdictCards (klikkbare kort med ikoner) | Vertikale radios med beskrivelse | Kompaktere, skanner raskere, tar 50% av plassen |
| InlineYesNo for innsigelser | Eksplisitte checkboxer med §-referanse | Juridisk tydeligere — du hevder en posisjon |
| Begrunnelse-textarea i skjema | Dedikert høyrepanel med TipTap | Begrunnelsen er et dokument, ikke et felt |
| Skygger for dybde | Borders + surface shifts | Kontraktsdokumenter har linjer, ikke skygger |
| Flat tab-strip i høyrepanelet | Tab-låsing under redigering | Forhindrer navigasjon vekk fra aktiv begrunnelse |
| 380px høyrepanel | 340px | Midtpanelet trenger mer plass for per-kravlinje-evaluering |
| Progress bar 1.5px | Progress bar 6px | Forhandlingsresultatet fortjener visuell signifikans |

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
| sp-2 | 8px | Element-par, radio til beskrivelse |
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
| Kontroll-tekst | Oslo Sans | 13px | 500 | normal | Radio-labels, checkbox-labels |
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
| Lukket — omforent | bg-pkt-bg-card | 2px solid green-1000 | Ingen |
| Lukket — trukket | bg-pkt-bg-card | 2px dashed gray-400 | Ingen |
| Deaktivert (Force Majeure) | bg-pkt-bg-subtle | ingen | Ingen |

### Kontroll-interaksjonstilstander

| Element | Default | Hover | Focus | Disabled |
|---------|---------|-------|-------|----------|
| Radio | border-subtle, transparent bg | bg-subtle/50 | ring-2 warm-blue/30 | opacity-50 |
| Checkbox | border-default | bg-subtle/50 | ring-2 warm-blue/30 | opacity-50 |
| Tall-input | bg-subtle, border-subtle | border-default | border-2 warm-blue, ring-1 | opacity-50 |
| Ja/Nei uvalgt | bg-subtle | border-default | ring-2 warm-blue/30 | opacity-50 |
| Segmented uvalgt | transparent | bg-subtle/50 | ring-2 warm-blue/30 | opacity-50 |
| Segmented valgt | bg-default, border-b-2 warm-blue | — | — | — |
| Submit | bg-dark-blue-1000, white | opacity-90 | ring-2 warm-blue/30 | opacity-50 |

### Datatilstander

| Tilstand | Visuell behandling |
|----------|-------------------|
| Loading | Skeleton-rader i sone ①-③. Pulserende bg-subtle. |
| Tom (ingen krav) | Sentrert: «Ingen krav mottatt for dette sporet.» + handlingsknapp |
| Feil (lasting) | Rød alert med retry-knapp |
| Tom begrunnelse | Kontekstbasert placeholder (se §Dynamisk begrunnelsestekst) |
| Validering feilet | Input: border-red-1000. Helper: rød feilmelding. |

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
  border-bottom: 1px dotted border-pkt-grays-gray-200
  margin: 0 sp-2 (8px)

verdi:
  font-mono, 13px, weight 400, tabular-nums
  text-pkt-text-body-default, white-space: nowrap
```

### Resultat-valg (radio-gruppe)

```
DIN VURDERING

  ○  Godkjent          Alt godkjennes
  ●  Delvis godkjent   Godkjenner deler av kravet
  ○  Avslått           Hele kravet avslås
```

```
gruppe:
  layout: vertikal stack, gap sp-2 (8px)
  margin-top: sp-3 (12px)

alternativ:
  display: flex, align-items start, gap sp-2 (8px)
  padding: sp-2 (8px) sp-3 (12px)
  radius: r-md (4px)
  border: 1px solid transparent
  transition: background 150ms ease

  radio-sirkel: 16px, border 2px solid border-pkt-border-default
    valgt: fill warm-blue-1000, inset 3px
  tittel: Oslo Sans, 14px, weight 500
  beskrivelse: Oslo Sans, 13px, weight 400, text-subtle

  hover: bg-pkt-bg-subtle/50
  valgt: bg-pkt-bg-subtle, ring-2 warm-blue/20
  focus-visible: ring-2 warm-blue/30
  disabled: opacity-50, cursor-not-allowed
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

  □  Preklusjon §33.4 — varslet for sent
  ☑  Preklusjon §33.6.1 — spesifisert for sent
```

```
gruppe:
  layout: vertikal stack, gap sp-2 (8px)
  margin-top: sp-3 (12px)

checkbox-rad:
  display: flex, align-items start, gap sp-2 (8px)
  padding: sp-1 (4px) sp-2 (8px)
  radius: r-sm (2px)
  cursor: pointer

  checkbox: 16×16px, border 2px, radius r-sm
    avkrysset: bg warm-blue-1000, ✓ hvit
  §-ref: font-mono, 13px, weight 500
  beskrivelse: Oslo Sans, 13px, weight 400

  unchecked: text-pkt-text-body-default
  avkrysset: text-pkt-brand-red-1000 (innsigelse = rødflagging)
  hover: bg-subtle/50
  focus-visible: ring-2 warm-blue/30
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
    border-bottom: 2px solid warm-blue-1000 (erstatter shadow-sm)
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
    valgt Ja: bg-dark-green-1000, text-white, border-transparent
    valgt Nei: bg-red-1000, text-white, border-transparent
    focus-visible: ring-2 warm-blue/30
```

### Konsekvens-callout

```
container:
  padding: sp-3 (12px) sp-4 (16px)
  radius: r-md (4px)
  border-left: 3px solid (semantisk farge)
  margin-top: sp-3 (12px)

varianter:
  godkjent: bg-alert-success-bg, border-left green-1000
  avslått/advarsel: bg-alert-warning-bg, border-left amber
  kritisk: bg-alert-danger-bg, border-left red-1000
  info: bg-alert-info-bg, border-left blue

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
    redigeringsmodus: 3px solid border-pkt-brand-warm-blue-1000
```

### Sone ① — Kravhodet

Referansekort som forankrer svaret i det det svarer på.

**BH svarer (TEs krav som referanse):**

```
╔══════════════════════════════════════════════════╗
║  Krav fra TE — Veidekke                   Rev. 1 ║
║                                                  ║
║  Spesifisert krav                                ║
║  45 kalenderdager  ·  Ny sluttdato 15.08.2026    ║
║  Varslet 15.01  ·  Spesifisert 28.01             ║
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
    krevd: text-amber-700
    godkjent: text-pkt-brand-dark-green-1000
    grad: ≥70% grønn, 40–69% amber, <40% rød

progress bar:
  høyde: 6px (forhandlingsresultatet er hovedinformasjonen)
  radius: r-full
  bg: bg-pkt-bg-subtle
  fill: fargekodes som grad
  animasjon: transition-all 300ms ease-out

subsidiær-indikator:
  synlig når subsidiært finnes
  "Subs."-tag: 9px, uppercase, weight 600, amber-700, bg-amber-50
    padding 1px 4px, r-sm, ved GODKJENT-label
  subsidiært tall: 11px, font-mono, text-subtle, under hovedtall
```

**Grunnlag (binær, ikke tall):**

```
badge:
  godkjent: bg-green-1000/10, text-green-1000
  avslått: bg-red-1000/10, text-red-1000
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
    redigeringsmodus: 3px solid warm-blue-1000
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

  aktiv: text-warm-blue-1000, border-bottom warm-blue-1000
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

  LockedValue-tokens (read-only badges):
    dager: bg-blue-200, border-blue, text-dark-blue-1000
    beløp: bg-light-green-400, border-green, text-dark-green-1000
    prosent: bg-[#f3e8ff], border-purple-1000, text-dark-blue-1000
    §-ref: bg-subtle, border-gray, text-dark
    alle: font-mono, 12px, weight 500, padding 0 4px, r-sm, border 1px

  trunkering: 3 linjer + "Vis mer (N/M avsnitt)"
    "Vis mer": 11px, weight 500, text-warm-blue-1000
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
    ↻ RotateCcw: text-amber-700
    ◇ CheckCircle: text-green-1000
    ✕ X: text-red-1000
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
  Oslo Sans, 11px, text-pkt-grays-gray-400
  linje: border-top 1px dashed gray-200
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
      aktiv: bg-subtle, text-warm-blue-1000

regenerer:
  under editor, "↻ Regenerer"
  Lucide RotateCcw + Oslo Sans 11px, weight 500, text-warm-blue-1000
  hover: underline
```

**Vedlegg under editor:**

```
drop-sone:
  border: 1px dashed gray-300
  radius: r-md (4px)
  padding: sp-4 (16px)
  tekst: 13px, text-subtle, sentrert
  Lucide Upload, 20px, over tekst
  drag-over: border-warm-blue-1000, bg-warm-blue/5

fil-liste:
  margin-top: sp-2 (8px)
  rad: Lucide Paperclip + filnavn + størrelse (mono) + Lucide X (slett)
    slett hover: text-red-1000
```

**TE sender:** Ingen dual-block. Editor tar full høyde. Label: «Begrunnelse for kravet».

### Auto-begrunnelse

Bridge-hooks genererer begrunnelse automatisk. Teksten inneholder LockedValue-tokens.

```
Auto-generert eksempel (frist, BH delvis godkjent):

"Godkjenner {{dager:30:30 dager}} av {{dager:45:45 dager}}
({{prosent:67:67%}}). TE har varslet etter §33.4 den
{{dato:2026-01-15:15.01.2026}}, men spesifisert krav etter §33.6.1
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
  bg-dark-blue-1000, text-white, 13px, weight 600
  padding sp-2 sp-4, radius r-sm, høyde 36px

aksepter:
  bg-dark-green-1000, text-white (ellers som primær)

sekundær (Revider, Godta):
  transparent, border 1px solid border-subtle, text-default
  hover: bg-subtle

destruktiv (Trekk tilbake):
  transparent, text-red-1000
  hover: bg-red-1000/5

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
| Space/Enter | Velg radio/checkbox |
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
│  ─────────────────────────── │        │                          │
│  ○  Godkjent                  │        │ VEDLEGG                  │
│  ○  Avslått                   │        │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐ │
│  ○  Frafalt                   │        │   ⇧ Dra filer hit       │
│                               │        │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘ │
│  ┌ KONSEKVENS ──────────────┐│        └──────────────────────────┘
│  │ ⚠ Avslått → vederlag og  ││
│  │ frist behandles subsidiært││
│  └──────────────────────────┘│
│                               │
├───────────────────────────────┤
│ Avbryt      ▓ Send svar §25 ▓│
└───────────────────────────────┘
```

**Betinget synlighet:**

```
Synlig hvis ENDRING:
  - Varsling §32.2 (Ja/Nei)
  - Preklusjonsadvarsel (hvis Nei)

Alltid synlig:
  - Resultat-valg (Godkjent/Avslått/Frafalt)
  - Konsekvens-callout (dynamisk)

Synlig hvis oppdateringsmodus:
  - Nåværende svar-banner

Synlig hvis snuoperasjon (avslått → godkjent):
  - Snuoperasjon-alert
```

**Spesifikt:**
- Konsekvens-callout: Godkjent → success. Avslått → warning (subsidiær). Frafalt → info.
- Snuoperasjon-alert: success, «Subsidiære svar blir prinsipale.»
- Passivitets-advarsel (ENDRING, >10d): 7-14d amber, >14d rød.

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
│  HOVEDKRAV §34.1                 ⓘ  │
│  ────────────────────────────────── │
│  Varslet i tide?                     │
│  ┌─────┐ ┌─────┐                    │
│  │  Ja │ │ Nei │                    │
│  └─────┘ └─────┘                    │
│                                      │
│  Krevd ·················· kr 1 800k  │
│  ┌──────────────────────────────┐   │
│  │ 1 200 000              │ kr │   │
│  └──────────────────────────────┘   │
│  Differanse: -600k (67% godkjent)   │
│                                      │
│  RIGG OG DRIFT §34.1.3          ⓘ  │
│  ────────────────────────────────── │
│  [samme per-kravlinje-mønster]      │
│                                      │
│  PRODUKTIVITET §34.1.3           ⓘ  │
│  ────────────────────────────────── │
│  [samme per-kravlinje-mønster]      │
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

**Spesifikt:**
- **Metodevalg er vurdering.** BH ser TEs valg, evaluerer, foreslår alternativ bare ved uenighet.
- **Per-kravlinje:** Tre separate seksjoner med egne varsling-toggles og beløp.
- **Tilbakeholdelse §30.2:** Checkbox + beløp-input. Gir separat resultat «HOLDT TILBAKE» (amber).
- **EP-justering §34.3.3:** Ja/Nei. Nei → warning: «Avvist → reduksjon i vederlag.»

### Fristforlengelse — BH svarer

```
MIDTPANEL

┌──────────────────────────────────────┐
│  Krav fra TE — Veidekke       Rev. 1 │
│  ╔══════════════════════════════════╗│
│  ║ Spesifisert krav                 ║│
│  ║ 45 kalenderdager · Ny dato       ║│
│  ║ 15.08.2026                       ║│
│  ║ Varslet 15.01 · Spesifisert 28.01║│
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
│  Spesifisert ··············· 28.01  │
│                                      │
│  INNSIGELSER                         │
│  ────────────────────────────────── │
│  □  Preklusjon §33.4                 │
│     Varslet for sent                 │
│  ☑  Preklusjon §33.6.1              │
│     Spesifisert for sent             │
│  □  Vilkår §33.1                     │
│     Fremdrift ikke hindret           │
│                                      │
│  DIN VURDERING                       │
│  ────────────────────────────────── │
│  ○  Godkjent                         │
│  ●  Delvis godkjent                  │
│  ○  Avslått                          │
│                                      │
│  Godkjent fristforlengelse           │
│  ┌──────────────────────────────┐   │
│  │ 30                │ kaldager │   │
│  └──────────────────────────────┘   │
│  Differanse: 15d (67% godkjent)     │
│                                      │
│  SUBSIDIÆRT STANDPUNKT               │
│  ────────────────────────────────── │
│  Subsidiært godkjent                 │
│  ┌──────────────────────────────┐   │
│  │ 20                │ kaldager │   │
│  └──────────────────────────────┘   │
│                                      │
│  RESULTAT                            │
│  ────────────────────────────────── │
│  Prinsipalt   Delvis · 30 kaldager  │
│  Subsidiært   Delvis · 20 kaldager  │
│                                      │
├──────────────────────────────────────┤
│ Avbryt           ▓ Send svar §33 ▓  │
└──────────────────────────────────────┘
```

**Betinget synlighet:**

```
Alltid synlig:
  - Kravhode (TEs krav)
  - Varsling §33.4 (key-value datoer)
  - Innsigelse-checkboxer (§33.4, §33.6.1, §33.1)
  - Resultat-valg (Godkjent/Delvis/Avslått)

Synlig hvis resultat ≠ Godkjent:
  - Godkjent dager (tall-input)

Synlig hvis minst én innsigelse:
  - Subsidiært standpunkt (egen seksjon med eget tall-input)

Synlig hvis BH har sendt forespørsel:
  - Kontekstalert: «Du etterlyste spesifisering innen [frist].»
```

**Spesifikt:**
- **Tre porter:** Varsling (datoer), Innsigelser (checkboxer), Vurdering (radio + tall).
- **Subsidiært:** Separat seksjon med eget tall-input. Bare synlig ved innsigelse.

### TE sender — alle kravtyper

**Frist:**

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
Alltid synlig:
  - Metode-segmented (Enhetspriser/Regningsarbeid/Fastpris)

Synlig per metode:
  · Enhetspriser: beløp + justerte EP toggle
  · Regningsarbeid: kostnadsoverslag + varslet før oppstart toggle
  · Fastpris: beløp

Alltid synlig:
  - Særskilte krav §34.1.3
    · Rigg/drift toggle + beløp + dato
    · Produktivitet toggle + beløp + dato
  - Vedlegg
```

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
  ○  Anerkjenner forseringsrett
  ●  Bestrider forseringsrett

Sak #15: Grunnarbeid · 20d
  ●  Anerkjenner forseringsrett
  ○  Bestrider forseringsrett

Dager med forseringsrett ········ 20d

30%-REGELEN
────────────────────────────────────────
Overholdt?
┌─────┐ ┌─────┐
│  Ja │ │ Nei │
└─────┘ └─────┘

DIN VURDERING
────────────────────────────────────────
  ○  Godkjent
  ○  Delvis godkjent
  ○  Avslått

[Synlig hvis godkjent/delvis:]
Godkjent beløp
┌──────────────────────────────────┐
│ 1 200 000                │ kr  │
└──────────────────────────────────┘
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
  ○  Akseptert
  ○  Bestridt

[Synlig hvis Bestridt:]
⚠  Du kan sende alternativt KOE-krav
```

---

## Aksept og lukking

Etter BH har svart, har TE tre valg i lesemodus-footer:

```
┌──────────────────────────────────────────────────┐
│  Revider krav  │  Trekk tilbake  │  Aksepter svar │
└──────────────────────────────────────────────────┘
```

**Aksepter:** Grønn variant. Bekreftelses-dialog. Etter aksept: read-only verdier + OMFORENT-badge.

**Trekk tilbake:** Destruktiv ghost. Bekreftelses-dialog med begrunnelseskrav (min 10 tegn).

**Revider:** Ghost. Redigeringsmodus med pre-populerte verdier. Rev-nummer øker.

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

**Svakhet:** Vederlag BH har ~10 seksjoner med identisk visuell vekt. Vurder visuell differensiering mellom kravlinjeseksjoner. **Delvis bestått.**

### Signatur-test

§-referanser i: seksjonsoverskrifter, knappetekst, checkbox-labels, LockedValue-tokens, konsekvens-alerts. **Bestått.**

### Token-test

`pkt-*` tokens er prosjektspesifikke men evoserer designsystem, ikke domene. Domene-navnene i Domain Exploration (instrument-grå, stempel-grønn) er mer evokative men ikke brukt som tokens. **Delvis bestått.**
