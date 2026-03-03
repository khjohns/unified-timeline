# Forhandlingsbordet — Oversiktsside for KOE-sak

## Intent

**Hvem:** En kontraktsansvarlig (BH eller TE) med 15–25 aktive KOE-saker. Skjerm 24–27". Klikket inn fra sakslisten. Spørsmålet: «Trenger denne saken meg nå?»

**Oppgave:** Scanning, ikke arbeid. Tre beslutninger per sak: (1) kreves det handling? (2) fra hvem? (3) hva haster mest? Alt innen 3 sekunder, uten å klikke inn i et spor.

**Følelse:** Kontrollrom. Tett, nøkternt, ingenting dekorativt. Data-panelet på en trading desk — ikke dashboardet i en SaaS-app. Rose-tonet urgency som bryter monotonien.

---

## Konsept

Forhandlingsbordet er landingssiden for en KOE-sak. Når du åpner KOE-2024-047, lander du ikke på et spesifikt spor — du lander *her*.

Tre funksjoner:
1. **Oversikt** — hele forhandlingslandskapet i ett blikk
2. **Fokus** — hva som krever din oppmerksomhet *nå* (det kan være flere)
3. **Inngang** — klikk for å grave dypere via spordetaljvisningen

### Tetthetsfilosofi

Analysebordet er "dense, number-forward." Forhandlingsbordet arver dette. En kontraktsansvarlig med 20 saker trenger <3 sekunder per sak. Hvert sporkort er 2–3 linjer — nøkkeldata, frist, handling. Alle spor synlige uten scrolling.

---

## Navigasjonsflyt

```
Saksliste          Forhandlingsbordet         Spordetalj
(alle KOE-saker)   (oversikt, én sak)         (arbeidsflate, ett spor)
                                               ┌─────────┬──────┬──────┐
┌──────────┐       ┌───────┬──────────┐        │ Nav     │ Form │ Begr │
│ Liste    │  →    │ Sak   │ Tidslinje│   →    │         │      │      │
│          │       │ info  │          │        │         │      │      │
└──────────┘       └───────┴──────────┘        └─────────┴──────┴──────┘
                   2 kolonner = scanning        3 kolonner = arbeid
```

Layoutskiftet kommuniserer modusbytte: oversikt → arbeid. Høyrepanelet (begrunnelse-editoren) eksisterer bare i spordetalj.

---

## Layout

```
┌──────────────────────┬──────────────────────────────────────────────────────────────────┐
│ Sakskontekst (260px) │ Tidslinje (flex)                                                 │
│                      │                                                                  │
│ Fast: partene,       │ Kompakte sporkort langs vertikal kronologisk spine.               │
│ frister, varsling    │ Sist oppdaterte spor øverst. Handlinger fremhevet.               │
└──────────────────────┴──────────────────────────────────────────────────────────────────┘
```

Ingen høyrepanel. Det reserveres for spordetalj.

### Venstre panel — Sakskontekst

```
KOE-2024-047
Forsinket leveranse
stålkonstruksjon

─────────────────
Veidekke (TE)
Oslobygg (BH)

─────────────────
FRISTER
⚠ Grunnlag  passivitet
  Frist     13d igjen
  Vederlag  14d igjen

─────────────────
VARSLING
✓ Endring varslet
⚠ Frist: varslet sent
– Frist: ikke spesifisert
– Vederlag: ikke varslet
```

To seksjoner utover saksidentitet:

**FRISTER** — urgency-sortert. Mest presserende øverst. Fargekodet: normal (--ink-secondary), advarsel (--vekt), kritisk (--score-low). "Passivitet" er et juridisk vendepunkt — sterkere enn en vanlig frist.

**VARSLING** — kontraktuell status i menneskelig språk. ✓ overholdt, ⚠ mulig brudd, ✕ brudd, – ikke relevant ennå. Hover avslører §-referanse for juristen.

Ikke SPOR-seksjon her — den ville duplisert sporkortene i tidslinjen.

---

## Urgency vs. kronologi

**Spenningen:** Kronologisk sortering (sist redigerte øverst) kan begrave det mest urgente. Grunnlag varslet for 19 dager siden havner nederst, men passiviteten gjør det mest presserende.

**Løsningen — to komplementære virkemidler:**

1. **Tidslinjen sorterer kronologisk** — sist redigerte spor øverst. Arbeidsstøtte: det du nettopp jobbet med er lett å finne.

2. **Visuell vekt overvinner romlig posisjon** — kritiske kort (passivitet, preklusion) har rose-tonet bakgrunn, sterkere kant, konsekvenstekst. De *roper* uavhengig av posisjon. Sidepanelet viser FRISTER urgency-sortert.

Effekten: øynene faller naturlig på det nyeste (posisjon), men trekkes mot det mest urgente (visuell vekt). To signaler som samvirker.

---

## Signaturelement: Varslingsstatus

Unik for dette produktet. Kompakte kontraktuelle statusflagg vevd inn i hvert nivå av grensesnittet:

**I sidebar** (aggregert):
```
✓ Endring varslet
⚠ Frist: varslet sent
– Frist: ikke spesifisert
– Vederlag: ikke varslet
```

**I sporkort** (inline): `FRISTFORLENGELSE · Spesifisert krav · ⚠ Varslet sent`

**I spordetalj** (utvidet): Full forklaring med dato, begrunnelse, konsekvens — og §-referanse for juristen.

### To lag: prosjektleder-først, jurist-sekundært

En prosjektleder vet ikke hva "⚠§33.4" betyr. Bare en jurist leser paragrafnumre. Grensesnittet bruker **menneskelig språk** som primærtekst:

| Primært (alltid synlig) | Sekundært (hover / drill-down) |
|---|---|
| Varslet sent | §33.4 — foreløpig varsel sendt etter rimelig tid |
| Spesifisert i tide | §33.6 — spesifisert krav innen fristen |
| Passivitet | §32.3 — manglende svar medfører rettighetsforfall |
| Vilkår ikke oppfylt | §33.1 — årsakssammenheng ikke påvist |

§-referansene finnes i systemet — de vises som sekundærtekst, i tooltips, og i spordetaljen der juristen jobber. Men oversikten snakker prosjektlederens språk.

En trading-terminal har tickers. En code editor har lint-markører. Et KOE-verktøy har varslingsstatus — kontraktuelle compliance-signaler i hvert lag, i menneskelig språk. Ingenting annet ser slik ut.

---

## Sporkort — kompakt format

Hvert spor som et tett kort: 2–3 linjer. Nøkkeldata, ikke prosa.

### Anatomi

```
┌─ SPORNAVN ─ Status ─ varslingsflagg ───── → Handling ─┐
│ [Nøkkeldata: tall, beløp, dager, metode · Frist Xd]   │
│ [Mini-historikk: dato hendelse · dato hendelse · ...]  │
└────────────────────────────────────────────────────────┘
```

- **Linje 0 (header):** Spornavn (menneskelig), statusbadge, varslingsflagg (menneskelig), handlingsknapp
- **Linje 1:** Nøkkeldata med prikk-separatorer. Tall i --font-data.
- **Linje 2 (valgfri):** Mini-historikk — siste 2–3 hendelser kronologisk, --ink-muted

Kun 2 linjer når sporet har én hendelse. 3 linjer når det er historikk. §-referanser vises på hover/i spordetalj.

### Eksempler per tilstand

**Handling kreves (din tur):**
```
┌─ FRISTFORLENGELSE ─ Spesifisert krav ─ ⚠ Varslet sent ─── → Svar ──┐
│ 45d krevd · Ny dato 15.08.26 · Frist 13d (16.02)                     │
│ i går TE spesifiserte · 20.01 forespurt · 15.01 varslet              │
└───────────────────────────────────────────────────────────────────────┘
```
Amber venstre-kant (3px). "⚠ Varslet sent" forteller prosjektlederen at det er et tidsproblem. Hover → "§33.4 — foreløpig varsel sendt etter rimelig tid."

**Handling kreves — kritisk (passivitet):**
```
┌─ ⚠ ANSVARSGRUNNLAG ─ Ubesvart ─────────────────── → Svar nå ───┐
│ TE varslet irregulær endring · Stålmontasje AS                    │
│ ⚠ 19d uten svar — du kan miste retten til å protestere           │
└───────────────────────────────────────────────────────────────────┘
```
Rose-tonet bakgrunn (--score-low-bg) på HELE kortet. Konsekvenstekst i klartekst — "du kan miste retten til å protestere" er umiddelbart forståelig. Hover → "§32.3 passivitet."

**Venter på motpart:**
```
┌─ FRISTFORLENGELSE ─ Delvis godkjent ─ Venter på TE ─────────────┐
│ 30 av 45d godkjent (67%) · Innsigelse: spesifisert for sent      │
│ 28.01 TE spesifiserte · 20.01 forespurt · 15.01 varslet          │
└───────────────────────────────────────────────────────────────────┘
```
Nøytral kant (--wire-strong, 1px). "Spesifisert for sent" i stedet for "§33.6.1."

**Godkjent / løst:**
```
┌─ ANSVARSGRUNNLAG ─ Godkjent ✓ ───────────────────────────┐
│ Irregulær endring · Godkjent 03.02                        │
└───────────────────────────────────────────────────────────┘
```
Dempet kontrast (--ink-secondary). Grønn venstre-kant (2px). To linjer.

**TE etter delvis godkjenning — valg:**
```
┌─ FRISTFORLENGELSE ─ Delvis godkjent ──────────── → Velg ───┐
│ 30 av 45d (67%) · Innsigelse: spesifisert for sent          │
│ Godta · Revidere · Trekke                                    │
└──────────────────────────────────────────────────────────────┘
```
Linje 2 viser TEs mulige handlinger direkte i kortet.

### Visuell differensiering

| Tilstand | Bakgrunn | Venstre kant | Handling |
|---|---|---|---|
| Handling — normal | --felt | 3px --vekt | → Svar |
| Handling — kritisk | --score-low-bg | 3px --score-low | → Svar nå |
| Venter | --felt | 1px --wire-strong | Ingen |
| Godkjent | --felt | 2px --score-high | Ingen, ✓ badge |
| Avslått | --felt | 2px --score-low | → Forsering? |
| Bortfalt | --felt | 1px stiplet --ink-ghost | → Se sak |

---

## Hendelseslogg — revisjonshistorikk i sporkort

### Terskelregel

- **≤3 hendelser:** Mini-historikk-linjen dekker alt. Ingen ekspandering nødvendig. Eksempel: "i dag revidert · 01.03 krevd · 28.02 varslet" — tre hendelser, fullt synlige.
- **4+ hendelser:** Mini-historikk viser 2–3 nøkkelhendelser. En innfelt **toggle-bar** med "N hendelser" vises under historikk-linjen. Klikk ekspanderer full hendelseslogg.

Designbeslutningen: historikk er viktig men sekundært. ≤3 hendelser er allerede kompakt. 4+ krever et nivå til — men det nivået skal være synlig og tilgjengelig, ikke gjemt i headeren.

### Toggle-bar (innfelt)

Under mini-historikk-linjen, som del av en innfelt --canvas area:

```
┌─ FRISTFORLENGELSE ─ Spesifisert krav ─ ⚠ Varslet sent ────── → Svar ──┐
│ 45d krevd · Rev. 2 · Ny dato 15.08.26 · Frist 13d                       │
│ i går spesifisert · 15.02 revidert · 15.01 varslet                      │
│ ┌──── 5 hendelser                                                  ▸ ┐  │
│ └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Plassering:** Under historikk-linjen, i innfelt area (--canvas bakgrunn)
- **Format:** "N hendelser" (--font-data, 10px, --ink-muted) + chevron (▸) høyrejustert
- **Bakgrunn:** --canvas (innfelt) — del av samme overflate som eventlisten
- **Border-top:** 1px solid --wire (separator fra kortinnhold)
- **Margin:** sp-2 negativ sp-3 (strekker til kortkant), negativ sp-2 bunn
- **Radius:** 0 0 r-md r-md (avrundet bunn)
- **Hover:** rgba(255,255,255,0.03) bakgrunn
- **Chevron:** roterer 90° ved expand (▸ → ▾)

### Hendelseslogg (ekspandert)

Klikk toggle-bar → hendelseslisten åpnes under baren i samme innfelte area:

```
┌─ FRISTFORLENGELSE ─ Spesifisert krav ─ ⚠ Varslet sent ────── → Svar ──┐
│ 45d krevd · Rev. 2 · Ny dato 15.08.26 · Frist 13d                       │
│ i dag spesifisert · 15.02 revidert · 15.01 varslet                      │
│ ┌──── 5 hendelser                                                  ▾ ┐  │
│ │ ─────────────────────────────────────────────────────────────────── │  │
│ │  ↻  02.03  Spesifiserte krav (45d) Rev. 2                     TE  │  │
│ │  →  25.02  La til dokumentasjon for forsinkelse                TE  │  │
│ │  ↻  15.02  Reviderte forespørsel (30d → 45d) Rev. 1           TE  │  │
│ │  →  20.01  Forespurte fristforlengelse (30d)                  TE  │  │
│ │  ⚑  15.01  Varslet mulig fristforlengelse                     TE  │  │
│ └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Ekspandert korttilstand:**
- Bakgrunn: --felt-raised (subtilt løft)
- Border: --wire-strong
- Toggle-bar: border-bottom 1px --wire (separator mot hendelsene)

**Hendelseslinje-anatomi:**

```
[ikon 14px] [dato 38px mono] [tekst flex] [rev 9px ghost] [part 20px mono]
```

| Kolonne | Font | Størrelse | Farge |
|---|---|---|---|
| Ikon | — | 11px | --ink-muted (→ ⚑), --vekt-dim (↻), --score-high (◇), --score-low (✕) |
| Dato | --font-data | 10px | --ink-muted |
| Tekst | --font-ui | 11px | --ink-secondary |
| Rev. | --font-data | 9px | --ink-ghost |
| Part | --font-data | 10px | --ink-ghost |

**Hendelsesikoner:**

| Ikon | Betydning | Farge |
|---|---|---|
| → | Sendt/krevd (initial handling) | --ink-muted |
| ⚑ | Varslet | --ink-muted |
| ↻ | Revidert | --vekt-dim |
| ◇ | Svar fra motpart | --score-high |
| ✓ | Godkjent/oppdatert | --score-high |
| ✕ | Trukket/avslått | --score-low |

### Revisjonsinformasjon i data-linjen

Spor med revisjoner viser `Rev. N` i data-linjen:

```
45d krevd · Rev. 2 · Ny dato 15.08.26 · Frist 13d
```

Og i mini-historikken:
```
i går spesifisert · 15.02 revidert · 15.01 varslet
```

"Revidert" erstatter den fulle hendelsesteksten i mini-historikken — kortere, tettere.

### Interaksjon

- **Klikk toggle-bar:** Ekspanderer/kollapser hendelseslisten (stopPropagation på hele area)
- **Klikk kortoverflate:** Navigerer til spordetalj (uendret)
- **Accordion:** Kun ett kort ekspandert om gangen
- **Escape:** Kollapser åpen hendelseslogg før tilbake-navigasjon
- **Animasjon:** max-height 200ms ease-out
- **Terskel:** ≤3 hendelser → ingen toggle-bar. 4+ → toggle-bar + ekspanderbar logg

### Spordetalj: Krav-tidslinje med revisjoner

I spordetalj-visningen vises full historikk i `krav-tidslinje` under det read-only kravet:

```
  02.03   TE spesifiserte krav (45d) · Rev. 2
  25.02   TE la til dokumentasjon
  15.02   TE reviderte forespørsel (30d → 45d) · Rev. 1
  20.01   TE forespurte fristforlengelse (30d)
  15.01   TE varslet mulig fristforlengelse
```

Krav-headeren viser revisjonsmerke: `Krav fra TE — Veidekke · Rev. 2`

---

## Forhåndsvisningspanel — hendelsesdetalj på høyresiden

### Problemet

Forhandlingsbordet har `260px sidebar | 1fr tidslinje (max-width 820px)`. På en 1440px skjerm etterlater dette ~400px død plass til høyre. Sporkortene er riktig tette, men plassen rundt dem er ubrukt.

### Løsningen: tre-trinns progressiv avsløring

| Nivå | Hva | Bredde | Formål |
|---|---|---|---|
| 1. Sporkort | 2–3 linjer, scanning | flex | <3s per sak: "trenger jeg å gjøre noe?" |
| 2. Hendelseslogg + forhåndsvisning | Event-by-event detalj | tidslinje + 360px panel | "Hva skjedde, og hva betyr det?" |
| 3. Spordetalj | Full arbeidsflate | 3-kolonne | "Nå svarer jeg" |

Nivå 2 er nytt. Det fyller gapet mellom scanning og arbeid — BH kan utforske historikken uten å forlate oversikten.

### Layoutskifte

**Default (ingen hendelseslogg åpen):**
```
┌──────────────────────┬──────────────────────────────────────────────────────┐
│ Sakskontekst (260px) │ Tidslinje (1fr)                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```
Tidslinjen fyller tilgjengelig plass. `max-width` fjernes.

**Hendelseslogg ekspandert:**
```
┌──────────────────────┬──────────────────────────────┬───────────────────────┐
│ Sakskontekst (260px) │ Tidslinje (1fr)               │ Forhåndsvisning      │
│                      │                               │ (360px)              │
│                      │  [kort med åpen logg]         │ ┌─────────────────┐  │
│                      │    ↻ 02.03 ← fokusert         │ │ Hendelsesdetalj │  │
│                      │    → 25.02                     │ │ for fokusert    │  │
│                      │    ...                         │ │ hendelse        │  │
│                      │                               │ └─────────────────┘  │
└──────────────────────┴──────────────────────────────┴───────────────────────┘
```

Grid endres dynamisk: `260px 1fr` → `260px 1fr 360px` når hendelseslogg er ekspandert. Panelet glir inn fra høyre (slide-in, 200ms ease-out).

### Forhåndsvisningspanel-anatomi

Panelet viser detalj for den **fokuserte hendelsen** i den åpne hendelsesloggen.

```
┌─────────────────────────────────────┐
│ HENDELSESDETALJ                      │
│                                     │
│ ↻ Reviderte forespørsel             │
│ 15.02.2026 · TE                     │
│                                     │
│ ───────────────────────────         │
│                                     │
│ Endring                             │
│ Krevd forlengelse økt fra           │
│ 30 til 45 dager. Begrunnelse:       │
│ ytterligere forsinkelse fra         │
│ underleverandør bekreftet.          │
│                                     │
│ ───────────────────────────         │
│                                     │
│ VEDLEGG                             │
│ ┌─ Forsinkelsesbekreftelse.pdf ───┐ │
│ └─────────────────────────────────┘ │
│                                     │
│ ───────────────────────────         │
│                                     │
│ BESTEMMELSE                         │
│ ┌─ NS 8407 §33.6 ────────────────┐ │
│ │ Spesifisering av fristkrav:     │ │
│ │ Krav skal spesifiseres innen    │ │
│ │ rimelig tid etter varsling.     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ──────────────── Åpne i spordetalj →│
└─────────────────────────────────────┘
```

### Panelet: seksjoner

**Header:**
- Ikon (hendelsestype) + handling i klartekst
- Dato (full dato, --font-data) + part (TE/BH)
- Bakgrunn: --felt, border-left 1px --wire

**Endring (hva skjedde):**
- Fritekstbeskrivelse av hendelsen
- For revisjoner: hva ble endret og hvorfor
- For krav: oppsummering av beløp/dager
- Font: --font-ui, 12px, --ink-secondary, line-height 1.5

**Vedlegg:**
- Liste over tilknyttede dokumenter
- Kort-format: filnavn + ikon (pdf/xlsx)
- Klikk åpner dokument (i reell app)

**Bestemmelse (§-referanse):**
- Relevant kontraktsbestemmelse
- Kort-format: paragrafnummer + utdrag
- Dypere enn tooltip — full kontekst for juristen

**Bunnen:**
- "Åpne i spordetalj →" lenke
- Navigerer til spordetalj for det aktuelle sporet

### Fokus og navigasjon

- **Hover:** Hendelse i loggen highlightes, panelet oppdateres (150ms debounce)
- **Piltaster (↑↓):** Navigerer mellom hendelser i åpen hendelseslogg
- **Enter:** Navigerer til spordetalj for hendelsens spor
- **Escape:** Lukker hendelseslogg + panel (tilbake til 2-kolonne)
- **Tab:** Flytter fokus til panelet (for tastaturbrukere)

Fokusert hendelse i loggen markeres med:
- Bakgrunn: --felt-hover (subtilt highlight)
- Venstre kant: 2px solid --vekt (amber accent)

### Tokens

```
Forhåndsvisningspanel:
  bakgrunn: --felt
  border-left: 1px solid --wire
  padding: sp-5
  bredde: 360px
  posisjon: sticky, top 0, height 100vh
  overgang: slide-in 200ms ease-out

Panelheader:
  ikon-farge: per hendelsestype (se hendelsesikoner)
  handling: --font-ui, 14px, weight 600, --ink
  dato: --font-data, 11px, --ink-muted
  part: --font-data, 10px, weight 600, --ink-ghost

Innholdsseksjoner:
  label: seksjon-label-mønster (11px, uppercase, --ink-ghost)
  tekst: --font-ui, 12px, --ink-secondary
  separator: 1px solid --wire

Vedlegg-kort:
  bakgrunn: --canvas (innfelt)
  border: 1px solid --wire
  radius: --r-sm
  padding: sp-2 sp-3
  hover: --felt-hover

Bestemmelse-kort:
  bakgrunn: --canvas (innfelt)
  border: 1px solid --wire
  border-left: 2px solid --ink-ghost
  radius: --r-sm
  paragraf: --font-data, 10px, --ink-muted
  tekst: 11px, --ink-secondary

Fokusert hendelse i loggen:
  bakgrunn: --felt-hover
  border-left: 2px solid --vekt
```

---

## Tidslinjespinen

Vertikal linje som binder sporkortene kronologisk:

```
│
├── i dag ──────────────────────────────────
│
│  [Sporkort]
│
├── i går ──────────────────────────────────
│
│  [Sporkort]
│
├── 15. januar ─────────────────────────────
│
│  [Sporkort]
│
├── 10. januar ─────────────────────────────
│  ○ Sak opprettet av TE
│
```

Hvert sporkort plasseres ved sin **siste hendelse**. Sporet med siste aktivitet havner naturlig øverst. BH svarer på grunnlag i dag → grunnlagskortet flytter til "i dag."

Enkelthendelser uten spor (sakopprettelse, dokumentopplasting) vises som punkter på spinen.

---

## Handlingsbanner

Øverst i tidslinjen. Sticky ved scrolling. Én linje:

```
⚠ 3 handlinger venter på deg
```

Fargekodet etter mest urgent handling. Forsvinner når alt er besvart.

---

## Tastatur og tilgjengelighet

| Tast | Kontekst | Handling |
|------|----------|---------|
| Tab | Tidslinje | Mellom sporkort (fokuserer hele kortet) |
| Enter | Sporkort fokusert | Navigerer til spordetalj |
| Space | Sporkort fokusert | Ekspanderer hendelseslogg (hvis 4+) |
| ↑↓ | Hendelseslogg åpen | Mellom hendelser |
| Enter | Hendelse fokusert | Navigerer til spordetalj |
| Escape | Hendelseslogg åpen | Lukker hendelseslogg + forhåndsvisning |
| Tab | Hendelseslogg åpen | Flytter fokus til forhåndsvisningspanel |

Fokusert sporkort: 2px solid --wire-focus, offset -2px. Fokusert hendelse: --felt-hover bakgrunn + 2px --vekt venstrekant.

---

## Layout-constraints

**Sidebar:** sticky, top 0, height 100vh, overflow-y auto. FRISTER og VARSLING er alltid synlige — sidebar scroller uavhengig av tidslinjen.

**Responsive:**

| Bredde | Tilpasning |
|--------|-----------|
| ≥1440px | Full layout. Forhåndsvisningspanel ved hendelseslogg. |
| 1280–1439px | Forhåndsvisningspanel skjules. Hendelseslogg ekspanderer uten panel. |
| 1024–1279px | Sidebar kollapser til 48px ikon-modus (saks-ID + urgency-ikon). Klikk ekspanderer. |
| <1024px | Ikke støttet (desktop-verktøy). |

Tidslinje har ingen max-width — fyller tilgjengelig plass. Sporkort har max-width 820px og sentreres i tidslinjekolonnen.

---

## Konsistens med Arbeidsflaten

Spordetaljvisningen er spesifisert i DESIGN_WORKSPACE_PANELS.md. Delte beslutninger:

- **Tokensystem:** Analysebordet-tokens (system.md). Se DESIGN_WORKSPACE_PANELS §Konsistens.
- **Radius:** 2/4/6px (skarpere enn Analysebordet). Gjelder begge visninger.
- **Aksentfarge:** --vekt (amber) for handlinger og fokus.
- **Venstepanel i spordetalj:** Definert her (§Venstre panel i spordetalj). Arbeidsflaten eier midtpanel + høyrepanel.

---

## Mockup: BH med tre aktive spor

Alle tre spor har mottatte krav. Grunnlag er kritisk (passivitet).

```
┌──────────────────────┬──────────────────────────────────────────────────────────────────────────┐
│                      │                                                                          │
│ KOE-2024-047         │  ⚠ 3 handlinger venter på deg                                           │
│ Forsinket leveranse  │                                                                          │
│ stålkonstruksjon     │  │                                                                       │
│                      │  ├── i dag ──────────────────────────────────────────────────────         │
│ ─────────────────    │  │                                                                       │
│ Veidekke (TE)        │  │  ┌─ VEDERLAG ─ Nytt krav ────────────────────────── → Svar ──┐        │
│ Oslobygg (BH)        │  │  │ Regningsarbeid · 2,4M · Rigg 340k · Prod.tap 180k         │        │
│                      │  │  │ i dag TE sendte krav · Frist 14d (17.02)                   │        │
│ ─────────────────    │  │  └────────────────────────────────────────────────────────────┘        │
│ FRISTER              │  │                                                                       │
│ ⚠ Grunnlag           │  ├── i går ──────────────────────────────────────────────────────         │
│   passivitet!        │  │                                                                       │
│   Frist  13d         │  │  ┌─ FRISTFORLENGELSE ─ Spesifisert krav ─ ⚠ Varslet sent ── → Svar ─┐│
│   Vederlag  14d      │  │  │ 45d krevd · Ny dato 15.08.26 · Frist 13d (16.02)                  ││
│                      │  │  │ i går spesifisert · 20.01 forespurt · 15.01 varslet                ││
│ ─────────────────    │  │  └────────────────────────────────────────────────────────────────────┘│
│ VARSLING             │  │                                                                       │
│ ✓ Endring varslet    │  ├── 15. januar ─────────────────────────────────────────────────         │
│ ⚠ Frist: varslet sent│  │                                                                       │
│ – Frist: ikke spesif.│  │  ┌─ ⚠ ANSVARSGRUNNLAG ─ Ubesvart ──────────────── → Svar nå ┐        │
│ – Vederlag: ikke vars│  │  │ TE varslet irregulær endring · Stålmontasje AS              │        │
│                      │  │  │ ⚠ 19d uten svar — du kan miste retten til å protestere     │        │
│                      │  │  └─────────────────────────────────────────────────────────────┘        │
│                      │  │                       ░░░░░░ rose-tonet bakgrunn ░░░░░░░               │
│                      │  ├── 10. januar ─────────────────────────────────────────────────         │
│                      │  │  ○ Sak opprettet av TE                                                │
│                      │  │                                                                       │
└──────────────────────┴──────────────────────────────────────────────────────────────────────────┘
```

**Leseretning:** Øverste kort (Vederlag) = sist mottatt. Nederste kort (Ansvarsgrunnlag) = eldst, men *visuelt sterkest*: rose bakgrunn, ⚠-prefiks, konsekvenstekst. Rose overvinner posisjon.

**Språket:** "Varslet sent" og "du kan miste retten til å protestere" — prosjektlederen forstår umiddelbart. Ingen §-nummer i oversikten. Hover/drill-down gir den juridiske referansen for juristen.

**Tetthet:** Tre sporkort = ~9 linjer. Alt over folden. BH ser umiddelbart: "tre handlinger, grunnlaget er mest presserende."

**Sidebar:** FRISTER sorterer etter urgency ("passivitet!" øverst). VARSLING bruker klartekst — prosjektlederen leser "Frist: varslet sent" og vet det er et problem uten å kjenne §33.4.

---

## Mockup: Blandet tilstand

BH har godkjent grunnlaget (nettopp). Frist delvis godkjent (venter TE). Vederlag nytt.

```
┌──────────────────────┬──────────────────────────────────────────────────────────────────────┐
│                      │                                                                      │
│ KOE-2024-047         │  ⚠ 1 handling venter på deg                                         │
│ Forsinket leveranse  │                                                                      │
│ stålkonstruksjon     │  │                                                                   │
│                      │  ├── i dag ──────────────────────────────────────────────────         │
│ ─────────────────    │  │                                                                   │
│ FRISTER              │  │  ┌─ ANSVARSGRUNNLAG ─ Godkjent ✓ ──────────────────────┐          │
│   Vederlag  14d      │  │  │ Irregulær endring · Godkjent 03.03                  │          │
│   (Ingen urgente)    │  │  └──────────────────────────────────────────────────────┘          │
│                      │  │                                                                   │
│ ─────────────────    │  │  ┌─ VEDERLAG ─ Nytt krav ──────────────────── → Svar ──┐          │
│ VARSLING             │  │  │ Regningsarbeid · 2,4M · Frist 14d (17.03)            │          │
│ ✓ Endring varslet    │  │  │ i dag TE sendte krav                                 │          │
│ ⚠ Frist: varslet sent│  │  └─────────────────────────────────────────────────────┘          │
│ ✓ Frist: spesifisert │  │                                                                   │
│ – Vederlag: ikke vars│  ├── 12. februar ────────────────────────────────────────────         │
│                      │  │                                                                   │
│                      │  │  ┌─ FRISTFORLENGELSE ─ Delvis godkjent ─ Venter på TE ─┐          │
│                      │  │  │ 30 av 45d godkjent (67%) · Innsigelse: spesif. sent  │          │
│                      │  │  │ 28.01 spesifisert · 20.01 forespurt · 15.01 varslet  │          │
│                      │  │  └──────────────────────────────────────────────────────┘          │
│                      │  │                                                                   │
│                      │  ├── 10. januar ─────────────────────────────────────────────         │
│                      │  │  ○ Sak opprettet av TE                                            │
│                      │  │                                                                   │
└──────────────────────┴──────────────────────────────────────────────────────────────────────┘
```

- **Ansvarsgrunnlag** godkjent → dempet, 2 linjer, grønn kant, ingen handling
- **Vederlag** nytt → amber kant, handlingsknapp, 3 linjer
- **Fristforlengelse** venter TE → nøytral kant, "Innsigelse: spesif. sent" (ikke §33.6.1)
- **Banner** sier "1 handling" — bare Vederlag er BHs tur

---

## Rolleperspektiv

TE og BH ser samme hendelser, men handling og ordlyd er forskjellig.

**BH ser:** `→ Svar på krav` (amber knapp, frist synlig)
**TE ser:** `Sendt i går · Venter på BHs svar` (ingen knapp, nøytral kant)

TE etter BH delvis godkjente:
```
┌─ FRISTFORLENGELSE ─ Delvis godkjent ─────────── → Velg ───┐
│ 30 av 45d (67%) · Innsigelse: spesifisert for sent         │
│ Godta · Revidere · Trekke                                   │
└─────────────────────────────────────────────────────────────┘
```

"Du" brukes i stedet for rollenavn: "Du sendte spesifisert krav" (ikke "TE sendte").

---

## Overgang: Forhandlingsbordet → Spordetalj

Klikk sporkort (eller handlingsknapp) → tre-kolonne spordetaljvisning.

```
Forhandlingsbordet                    Spordetalj (Vederlag)
┌───────┬──────────┐                  ┌─────────┬──────────────┬──────────┐
│ Sak   │ Tidslinje│  ───→            │ Nav     │ Skjema       │ Begr.    │
│ info  │ [kort]   │                  │ + spor  │ BHs respons  │ editor   │
│       │ [kort]   │                  │ status  │ på TEs krav  │          │
└───────┴──────────┘                  └─────────┴──────────────┴──────────┘
```

- Tidslinjen → midtpanelet (sporarbeidsflate)
- Høyrepanelet dukker opp (begrunnelse-editor)
- Venstre panel transformerer til spor-navigasjon med mini-status

**← Tilbake** → tilbake til Forhandlingsbordet.

### Venstre panel i spordetalj

Kondensert versjon av oversikten — spor-navigasjon med amber accent på aktivt spor:

```
← Forhandlingsbordet

─────────────────
NESTE HANDLING
┌────────────────┐
│ BH  Svar på    │
│ vederlag       │
└────────────────┘

─────────────────

● ANSVARSGRUNNLAG
  Godkjent ✓

█ VEDERLAG
▌ Nytt krav · 2,4M

● FRISTFORLENGELSE
  Delvis godkjent

─────────────────
FRISTER
  Vederlag  14d
```

---

## Avhengigheter mellom spor

Grunnlag styrer om frist og vederlag er gyldige. Avslått grunnlag → avhengige spor vises som "bortfalt":

```
┌─ ANSVARSGRUNNLAG ─ Avslått ✕ ────────────────────────────────┐
│ Vilkår ikke oppfylt · ⚠ Påvirker: Fristforlengelse, Vederlag │
└──────────────────────────────────────────────────────────────┘

┌─ FRISTFORLENGELSE ─ Bortfalt ────────────────── → Se sak ───┐
│ Bortfalt — ansvarsgrunnlag avslått                            │
└──────────────────────────────────────────────────────────────┘
```

Bortfalte kort: dempet, stiplet venstre-kant (--ink-ghost), lenke tilbake til grunnlaget.

---

## Spesialtilfeller

### Forsering

BH avslår fristkrav → TE kan forsere:
```
┌─ FRISTFORLENGELSE ─ Avslått ─────────── → Krev forsering ─┐
│ BH avviste fristkrav · 15.02 · TE kan kreve forsering       │
└─────────────────────────────────────────────────────────────┘
```

### Endringsordre

```
Del av endringsordre EO-2024-012 · 3 av 5 saker behandlet
```

### Tom sak

```
│
├── i dag ──────────────────────────────────────
│
│   Ingen spor startet ennå.
│   Start med å varsle ansvarsgrunnlag.
│
│                              → Opprett varsel
│
├── ○ Sak opprettet av TE                08:00
│
```

### Ingen handlinger (BH scanner raskt)

```
┌──────────────────────┬─────────────────────────────────────────┐
│ KOE-2024-047         │  Ingen handlinger. Venter på TE.        │
│ Forsinket leveranse  │                                         │
│ ...                  │  [kompakte sporkort i ventemodus]        │
└──────────────────────┴─────────────────────────────────────────┘
```

Null-tilstand for saker der ingenting krever BHs handling. <3 sekunder å vurdere og gå videre.

---

## Visuell språk

### Mapping til Analysebordet

| Analysebordet | Forhandlingsbordet | Prinsipp |
|---|---|---|
| --vekt = vekting | --vekt = handling kreves | Amber = "viktig" |
| --score-high = god score | --score-high = godkjent | Grønn = "bra" |
| --score-low = dårlig score | --score-low = kritisk | Rose = "problem" |
| Vektlinjen | Handlingskant | Kant-accent = anker |

Overflater, typografi, dybde: identisk med Analysebordet. --canvas, --felt, --wire, borders-only.

### Sporkort-tokens

```
Sporkort:
  bakgrunn: --felt (normal), --score-low-bg (kritisk)
  kant: 1px solid --wire
  kant-venstre: se differensieringstabell
  hover: --felt-hover
  radius: --r-md
  padding: sp-3 (12px) sp-4 (16px)
  gap mellom linjer: sp-1 (4px)
  cursor: pointer (hele kortet er klikkbart)
  focus-visible: 2px solid --wire-focus, offset -2px
  transition: background 150ms ease

Header-linje:
  display: flex, align-items center, gap sp-2 (8px)
  spornavn: --font-ui, 12px, weight 600, --ink
  statusbadge: 10px, uppercase, weight 600, tracking 0.06em, --ink-secondary
    pill: padding 1px 6px, radius --r-sm, bg --felt-active
  varslingsflagg: --font-ui, 10px, --ink-muted (✓ = --score-high, ⚠ = --vekt, ✕ = --score-low)
  varslingsflagg-tekst: menneskelig label, §-referanse på hover (title-attr)
  handlingsknapp (høyrestilt, ml auto):
    --font-ui, 11px, weight 600, --vekt tekst
    bg --vekt-bg, radius --r-sm, padding sp-1 (4px) sp-3 (12px)
    hover: --vekt-bg-strong
    kritisk variant: --score-low tekst, --score-low-bg bakgrunn

Data-linje:
  --font-data, 12px, --ink · prikk-separert (· med sp-1 mellomrom)
  Revisjonsmerke: "Rev. N" i vanlig tekst
  frist: --ink-muted, "(DD.MM)" etter dager

Historikk-linje:
  --font-ui, 10px, --ink-muted · prikk-separert · tracking 0.01em

Hendelseslogg (innfelt area, 4+ hendelser):
  bakgrunn: --canvas (innfelt)
  border-top: 1px solid --wire
  toggle-bar: "N hendelser" --font-data 10px --ink-muted, chevron 8px --ink-ghost
  toggle-bar hover: rgba(255,255,255,0.03)
  expanded: border-bottom 1px --wire mellom bar og events
  events: [ikon 14px] [dato 38px mono] [tekst flex] [rev 9px] [part 20px]
  ikoner: → ⚑ (muted), ↻ (vekt-dim), ◇ ✓ (high), ✕ (low)

Tidslinjespine:
  linje: 1px solid --wire-strong
  dato-merke: --ink-muted, 11px, uppercase, tracking 0.06em
  dato-punkt: 6px, --ink-muted
```

---

## Oppsummering

| Beslutning | Begrunnelse |
|---|---|
| Tidslinjen er oversiktssiden | Dynamisk, prioriterbar oversikt over hele saken |
| 2–3 linjers sporkort | Analysebordet-tetthet: alt over folden, <3s scanning |
| Kronologisk sort + visuell urgency-vekt | Posisjon gir kontekst, visuell vekt gir prioritet |
| Varslingsstatus som signatur | Kontraktuelle compliance-signaler i menneskelig språk — unikt for domenet |
| Prosjektleder-først, jurist-sekundært | §-referanser på hover/drill-down, aldri som primærtekst |
| Rose bakgrunn på hele kortet ved passivitet | Overvinner romlig posisjon — kritisk synlig uansett |
| Sidebar: FRISTER + VARSLING, ikke SPOR | SPOR ville duplisert tidslinjen |
| Handlingsknapp bare på "din tur" | Ingen støy fra motpartens handlinger |
| Hendelseslogg i sporkort, ikke separat visning | Revisjonshistorikk tilgjengelig in-place uten kontekstbytte |
| ≤3 hendelser alltid synlig, 4+ med toggle-bar | Mini-historikk dekker ≤3; toggle-bar synlig i innfelt area for 4+ |
| Rev. N i data-linje | Revisjonsstatus synlig ved scanning uten å åpne logg |
| "Ingen handlinger" null-tilstand | Rask avfeiing for saker som ikke krever oppmerksomhet |
| "Du" i stedet for rollenavn | Personlig perspektiv |
