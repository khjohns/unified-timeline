# Designdokument — Arbeidsflaten (midtpanel + høyrepanel)

**Dato:** 2026-03-03
**Scope:** Midtpanelet og høyrepanelet i tre-panel-layouten. Ikke venstepanel, ikke landingsvisning, ikke dashboard. Vi er inne i arbeidet — brukeren har valgt å jobbe med ansvarsgrunnlag, vederlagsjustering eller fristforlengelse.

---

## Intent

**Hvem er dette mennesket?**

En kontraktsadministrator i et norsk byggeprosjekt. Ikke en utvikler, ikke en designer. En jurist eller ingeniør med NS 8407 på pulten og en Excel-liste med endringskrav åpen ved siden av. De sitter i et kontorlandskap — kanskje på Skøyen, kanskje i en brakke på Bjørvika. Skjermen er 24" eller 27". De har håndtert titalls slike krav. De kjenner paragrafene. De trenger ikke opplæring i kontrakten — de trenger et verktøy som holder tritt med deres ekspertise.

De har nettopp åpnet en bestemt sak og klikket seg inn i et av de tre kravene. De har et presist spørsmål: «Hva er posisjonen, og hva skal mitt neste trekk være?» Svaret krever at de leser kravet, evaluerer det mot kontrakten, tar strukturerte beslutninger, og skriver en begrunnelse som kan leses av motparten og eventuelt en rettsinststans.

**Hva må de gjøre?**

To ting, i rekkefølge:
1. **Avgjøre** — ta juridisk bindende posisjoner. Godkjent/avslått. 30 av 45 dager. Innsigelse mot §33.6.1. Disse er diskrete, strukturerte valg.
2. **Argumentere** — skrive fritekst som begrunner posisjonene. Referere til kontraktsbestemmelser, vedlegg, fremdriftsplaner. Denne teksten kan bli 10+ avsnitt.

Disse er to fundamentalt forskjellige kognitive moduser. Den første er analytisk og kompakt — krysser av, taster tall, velger mellom alternativer. Den andre er narrativ og ekspansiv — konstruerer et argument, refererer til fakta, bygger en sak.

**Hvordan skal det føles?**

Som et kontraktsdokument du kan redigere — ikke som en app du fyller ut. Kjølig, presist, autoritativt. Teksten skal føles som den tilhører en protokoll, ikke et skjema. Tallene skal stå like stødig som i en regnearkkolonne. §-referansene skal føles like naturlige som sidetall.

Ikke varmt. Ikke vennlig. Ikke «onboarding-modus» eller «hjelpsom wizard.» Profesjonelt, som et verktøy laget av noen som forstår arbeidet.

---

## Design Foundation

```
Intent:    Kontraktsadministrator som tar juridiske posisjoner og
           skriver begrunnelser. Presist, autoritativt, dokumentaktig.
Palette:   Oslo-indigo (#2a2859) som primærtekst. Instrument-grå (#f0f0f2)
           som arbeidsflate. Stempel-grønn (#034b45) for godkjenning.
           Innsigelse-rødt (#c9302c) for avslag/preklusjon. Beige (#f8f0dd)
           for kontraktsreferanser. WHY: disse fargene finnes i den fysiske
           verdenen til kontraktsadministrasjon — Oslo kommunes identitet,
           godkjenningsstempler, røde avvisningsmerker, kontraktspapir.
Depth:     Borders-only. Ingen skygger. Tynne rgba-linjer (#2a2859/8) som
           strukturerer uten å kreve oppmerksomhet. WHY: kontraktsdokumenter
           har linjer, ikke skygger. Dense, teknisk, profesjonelt.
Surfaces:  Tre nivåer: arbeidsflate (#ffffff), innsatt felt (bg-subtle #f0f0f2),
           referansekort (bg-subtle/50 med border). WHY: dokumenter har
           bakgrunn, innsatte felt, og innrammede referanser.
Typography: Oslo Sans. Fire nivåer:
           - Seksjonstitler: 11px, 500, UPPERCASE, tracking-wide — som
             kapitteltitler i en kontrakt
           - Feltlabeler: 13px, 400, normal — som radelabeler i et skjema
           - Verdier: 14px, 500, monospace for tall — som data i en protokoll
           - Brødtekst: 14px, 400, normal — som løpende tekst i et brev
           WHY: Oslo Sans er kommunens font. Monospace for tall gir
           tabellkvalitet. UPPERCASE-titler refererer til kontraktens
           kapittelnummerering.
Spacing:   8px base. 4px mikro (ikon-gap). 12px mellom felt. 20px mellom
           seksjoner. 32px mellom hovedblokker.
```

---

## Midtpanelet — Beslutningsflaten

Midtpanelet er der brukeren tar posisjoner. Det er et redigerbart protokoll-ark — ikke et skjema med labels over inputs, men et strukturert dokument der verdier kan endres inline.

### Anatomien: fire soner

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  ① KRAVHODE                                     │
│     Hvem krevde hva, med hvilken hjemmel         │
│                                                  │
│──────────────────────────────────────────────────│
│                                                  │
│  ② POSISJONSKORT                                │
│     KPI-tallene: krevd → godkjent → grad         │
│     (bare når BH har svart)                      │
│                                                  │
│──────────────────────────────────────────────────│
│                                                  │
│  ③ BESLUTNINGSFELT                              │
│     De strukturerte valgene brukeren tar          │
│     — betinget synlighet basert på state          │
│                                                  │
│──────────────────────────────────────────────────│
│                                                  │
│  ④ RESULTATBOKS                                 │
│     Beregnet utfall basert på valgene over        │
│     (bare i redigeringsmodus)                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Sone ① — Kravhodet

Når BH svarer, ser de TEs krav som et kompakt, ikke-redigerbart referansekort øverst i panelet. Det forankrer svaret i det det svarer på.

**Designbeslutning:** Kortet bruker en subtil overflate — `bg-pkt-bg-subtle` med en tynn `border-pkt-border-subtle` — for å markere det som referanse, ikke innhold. Tekstfargen er dempet (`text-pkt-text-body-subtle`), ikke full styrke.

```
BH svarer på fristkrav:

╔══════════════════════════════════════════════════╗
║  TEs krav                                 Rev. 1 ║
║                                                  ║
║  Spesifisert krav §33.6                          ║
║  45 kalenderdager  ·  Ny sluttdato 15.08.2026    ║
║  Varslet 15.01  ·  Spesifisert 28.01             ║
╚══════════════════════════════════════════════════╝
```

**Når TE sender krav:** Kravhodet er tomt eller viser et kort kontekstkort med dato oppdaget, gjeldende versjon og eventuell BH-forespørsel. Ingen referansekort — TE er den som skaper innholdet.

**Designprinsipper for kravhodet:**
- Flat. Ingen hover-state, ingen interaksjon. Det er et dokument, ikke en knapp.
- `Rev. 1` vises som monospace-tag i øvre høyre hjørne for å signalisere versjon.
- §-referanser i teksten er i Oslo-indigo (`#2a2859`) med medium weight — de er domeneord, ikke lenker.
- Datoer er `font-mono tabular-nums` — de stiller seg opp som i et register.

### Sone ② — Posisjonskort

En kompakt, horisontal stripe som viser forhandlingsposisjonen. Bare synlig når det finnes BH-respons.

**Tre kolonner: Krevd | Godkjent | Grad**

Hvert tall er en selvstendig verdi, ikke en del av en frase.

```
Vederlag:

┌──────────┬──────────┬──────────┐
│ KREVD    │ GODKJENT │ GRAD     │
│ kr 450k  │ kr 280k  │ 62%      │
├──────────┴──────────┴──────────┤
│ ████████████████░░░░░░░░░░░░░░ │
└────────────────────────────────┘

Frist:

┌──────────┬──────────┬──────────┐
│ KREVD    │ GODKJENT │ GRAD     │
│ 45d      │ 30d      │ 67%      │
├──────────┴──────────┴──────────┤
│ ██████████████████░░░░░░░░░░░░ │
└────────────────────────────────┘
```

**Designbeslutninger:**
- Labels: 11px, UPPERCASE, `text-pkt-text-body-subtle`, tracking-wide. Som kolonnehoder i et regneark.
- Verdier: 16px, monospace, `font-semibold`. Krevd i `text-bento-krevd` (amber-700). Godkjent i `text-pkt-brand-dark-green-1000`. Grad fargekodes: ≥70% grønn, 40–69% amber, <40% rød.
- Progress bar: 6px høy (ikke 1.5px som i access-sidens `MiniProgress`). `rounded-full`. Visuelt signifikant — dette er resultatet av forhandlingen.
- **Subsidiær-indikator:** Når vederlag/frist er subsidiert, vises en liten `Subs.`-tag i amber ved siden av GODKJENT-labelen. Subsidiært beløp/dager vises under hovedtallet i dempet tekst.

**Grunnlag har ikke KPI-tall** — det er godkjent/avslått/frafalt, ikke et tall. Her er posisjonskort enten:
- En horisontal badge: `Godkjent` (grønn), `Avslått` (rød), `Frafalt` (grå)
- Eller ingenting (brukeren ser resultatet i sone ③)

### Sone ③ — Beslutningsfelt

Her skjer arbeidet. Feltene varierer radikalt mellom de tre kravtypene og mellom TE- og BH-modus. Men de deler en felles visuell grammatikk.

#### Visuell grammatikk for felter

**1. Seksjoner med §-referanse**

Hvert logisk steg i evalueringen er en seksjon med kapitteloverskrift:

```
VARSLING §33.4                                         ⓘ
────────────────────────────────────────────────────────
```

- 11px, UPPERCASE, tracking-wide, `font-medium`
- §-referanse i monospace
- Tynn info-ikon (ⓘ) for tooltip med §-kontekst
- Seksjonslinje: 1px `border-pkt-border-subtle`

**2. Key-value-rader**

Data som allerede er satt vises som horisontale rader med prikket leader:

```
Oppdaget ···················· 10.01.2026
Varslet ····················· 15.01.2026
Spesifisert ················· 28.01.2026
```

- Label: 13px, `text-pkt-text-body-subtle`, venstrestilt
- Leader: prikket linje med `border-dotted border-pkt-grays-gray-200`
- Verdi: 13px, `text-pkt-text-body-default`, høyrestilt, `font-mono tabular-nums` for datoer og tall
- Rad-padding: 4px vertikal — tett, som i en kontraktsprotokoll

**3. Beslutningskontroller**

Aktive felter der brukeren gjør valg. Tre typer:

**a) Resultat-valg (radio-gruppe)**

Brukes for: Grunnlag godkjent/avslått/frafalt. Vederlag godkjent/delvis/avslått. Frist godkjent/delvis/avslått.

```
DIN VURDERING

  ○  Godkjent          Alt godkjennes
  ●  Delvis godkjent   Godkjenner deler av kravet
  ○  Avslått           Hele kravet avslås
```

- Radios er vertikale, ikke horisontale kort (VerdictCards). Vertikale radios tar mindre plass og leses raskere i et dokument-grensesnitt.
- Valgt alternativ: `ring-2 ring-pkt-brand-warm-blue-1000/30` bakgrunn, `bg-pkt-bg-subtle` — subtil uthevning.
- Hvert alternativ har: radioknapp + tittel (14px, `font-medium`) + beskrivelse (13px, `text-pkt-text-body-subtle`).
- Hover: `bg-pkt-bg-subtle/50` overgang.

**Hvorfor ikke VerdictCards:** VerdictCards (tre/to klikkbare kort med ikoner) tar ~180px vertikalt og dominerer visuelt. I en beslutningsflate med 5–8 seksjoner må hvert element være kompakt. Vertikale radios tar ~80px for tre alternativer.

**b) Tall-input**

Brukes for: Godkjent dager, godkjent beløp.

```
Godkjent fristforlengelse
┌────────────────────────────────────────┐
│ 30                    │ kalenderdager  │
└────────────────────────────────────────┘
  Differanse: 15d (67% godkjent)
```

- Input: `bg-pkt-bg-subtle` bakgrunn (innsatt), `border-pkt-border-subtle`, `font-mono tabular-nums`.
- Suffiks: «kalenderdager» eller «kr» i dempet tekst innenfor input-feltet.
- Helper under: 11px, `text-pkt-text-body-subtle`. Viser beregnet differanse og prosent. Dynamisk — oppdateres mens brukeren taster.
- Fargekoding av helper: Prosenten farges etter grad (grønn/amber/rød).

**c) Innsigelse-checkboxer**

Brukes for: §33.4 preklusjon, §33.6.1 preklusjon, §33.1 vilkår, §34.1.2 varsling.

```
INNSIGELSER

  □  Preklusjon §33.4 — varslet for sent
  ☑  Preklusjon §33.6.1 — spesifisert for sent
  □  Vilkår §33.1 — fremdrift ikke hindret
```

- Checkboxer, ikke toggles. Checkboxer er eksplisitte — du krysser av for en juridisk posisjon.
- Hver checkbox har: checkbox + §-referanse (monospace) + lang-beskrivelse (13px, normal).
- Avkrysset: label i `text-pkt-brand-red-1000` — innsigelse er en rødflagging.
- Unchecked: label i `text-pkt-text-body-default`.

**Hvorfor ikke InlineYesNo:** InlineYesNo (Ja/Nei-knapper) er binære men visuelt tvetydige — «Varslet i tide?» krever at brukeren mentalt inverterer for å forstå konsekvensen. Eksplisitte checkboxer med §-referanse gjør juridisk posisjon tydelig: «Jeg hevder preklusjon etter §33.6.1.»

**d) Segmented control**

Brukes for: Varseltype (varsel/krav/utsatt). Beregningsmetode (enhetspriser/regningsarbeid/fastpris).

```
BEREGNINGSMETODE §34

  ┌─────────────┬──────────────────┬─────────────┐
  │ Enhetspriser│ Regningsarbeid   │ Fastpris    │
  └─────────────┴──────────────────┴─────────────┘
```

- 13px, `font-medium`. Valgt segment: `bg-pkt-bg-default` (hvit) med `shadow-sm` — løftet over. Uvalgt: transparent.
- Forklaringstekst under kontrollen (13px, `text-pkt-text-body-subtle`) som endrer seg basert på valg — hva konsekvensen er av metodevalget.

**e) Ja/Nei-valg**

Brukes for: «Har forholdet hindret fremdriften?», «Varslet før oppstart?», «Justerte enhetspriser?»

```
Har forholdet hindret fremdriften? §33.1
  ┌─────┐ ┌─────┐
  │  Ja │ │ Nei │
  └─────┘ └─────┘
```

- To knapper. Valgt: `bg-pkt-brand-dark-green-1000 text-white` (Ja) eller `bg-pkt-brand-red-1000 text-white` (Nei). Uvalgt: `bg-pkt-bg-subtle text-pkt-text-body-default`.
- Kompakt: 32px høyde, 48px bredde. Ikke store kort — korte knappepar.

#### Betinget synlighet — hva som vises når

Felter dukker opp og forsvinner basert på tilstand. Dette er kjernen i domenelogikken og det som skiller dette fra et generisk skjema.

**Frist (BH svarer):**

```
Alltid synlig:
  - Kravhode (TEs krav)
  - Resultat-valg (Godkjent/Delvis/Avslått)

Synlig hvis resultat ≠ Godkjent:
  - Godkjent dager (tall-input)

Alltid synlig:
  - Innsigelse-checkboxer (§33.4, §33.6.1, §33.1)

Synlig hvis minst én innsigelse:
  - Subsidiært standpunkt (egen seksjon)

Synlig hvis BH har sendt forespørsel:
  - Forespørsel-seksjon med frist
```

**Frist (TE sender):**

```
Alltid synlig:
  - Varseltype (segmented: Varsel / Krav / Utsatt)

Synlig hvis Krav eller Utsatt:
  - Krevd dager (tall-input)
  - Ny sluttdato (dato-input, valgfritt)

Synlig hvis status har varsel men ikke krav:
  - Spesifiserings-alert

Synlig hvis BH-forespørsel ventende:
  - Forespørsels-alert med frist

Alltid synlig:
  - Vedlegg (drag-drop)
```

**Vederlag (BH svarer):**

```
Alltid synlig:
  - Kravhode (TEs krav)
  - Metodevalg (MethodCards: Enhetspriser/Regningsarbeid/Fastpris)

Synlig for hvert kravlinje (hovedkrav, rigg, produktivitet):
  - Varsling-toggle (hvis ikke ENDRING)
  - Godkjent beløp (tall-input)
  - Resultat-badge (beregnet fra krevd vs godkjent)

Synlig hvis grunnlag avslått:
  - Subsidiær-kontekstalert

Synlig hvis EP-justering:
  - EP-justering toggle (§34.3.3)

Synlig hvis tilbakeholdelse:
  - Tilbakeholdelse-felt (§30.2)
```

**Vederlag (TE sender):**

```
Alltid synlig:
  - Metode-segmented (Enhetspriser/Regningsarbeid/Fastpris)

Synlig hvis Enhetspriser:
  - Beløp direkte (tall-input)
  - Justerte EP toggle

Synlig hvis Regningsarbeid:
  - Kostnadsoverslag (tall-input)
  - Varslet før oppstart toggle

Synlig hvis Fastpris:
  - Beløp direkte (tall-input)

Alltid synlig:
  - Særskilte krav §34.1.3
    - Rigg/drift toggle + beløp + dato
    - Produktivitet toggle + beløp + dato
  - Vedlegg
```

**Grunnlag (BH svarer):**

```
Synlig hvis ENDRING:
  - Varslet i tide toggle (§32.2)

Synlig hvis varslet_i_tide = false:
  - Preklusjons-advarsel

Alltid synlig:
  - Resultat-valg (Godkjent/Avslått/Frafalt)

Synlig etter valg:
  - Konsekvens-callout (hva valget betyr for vederlag/frist)

Synlig hvis oppdateringsmodus:
  - Nåværende svar-banner

Synlig hvis snuoperasjon (avslått → godkjent):
  - Snuoperasjon-alert (subsidiære svar blir prinsipale)
```

### Sone ④ — Resultatboks

Vises nederst i midtpanelet under redigeringsmodus. Oppsummerer det beregnede resultatet av beslutningene tatt over.

```
RESULTAT
────────────────────────────────────────────────────
  Prinsipalt     Delvis godkjent · 30 kalenderdager
  Subsidiært     Delvis godkjent · 20 kalenderdager
```

- Bakgrunn: `bg-pkt-bg-subtle` med `border-t border-pkt-border-subtle`.
- Prinsipalt-linje: full styrke tekst. Badge-fargekoding (grønn/amber/rød).
- Subsidiært-linje: dempet (`text-pkt-text-body-subtle`), med `Subs.`-tag.
- Dynamisk: oppdateres live mens brukeren endrer verdier.

---

## Høyrepanelet — Argumentasjonsflaten

Høyrepanelet er der brukeren skriver. Det er en dedikert skrivesone for begrunnelsen — den juridiske argumentasjonen som forklarer og forsvarer posisjonene tatt i midtpanelet.

### Hvorfor begrunnelse trenger egen kolonne

I byggeprosjekter kan begrunnelser bli 500–2000 ord. De refererer til kontraktsbestemmelser, vedlegg, fremdriftsplaner, korrespondanse. De er juridiske dokumenter som kan bli brukt i voldgift. Å klemme denne teksten inn i en textarea midt i et skjema — slik bento-layouten gjør med `rows={10}` i en halv kortbredde — er å nedprioritere det viktigste brukeren produserer.

Høyrepanelet gir 340–360px dedikert bredde. Det er smalt nok til å ikke overta arbeidsflaten, men bredt nok for en komfortabel skriverutine.

### Modusskifte: referanse → editor

Høyrepanelet har to moduser:

**Lesemodus** (ingen redigering aktiv i midtpanelet):
- Begrunnelse-fanen viser eksisterende begrunnelser (TEs og BHs) som read-only tekst.
- Historikk-fanen viser tidslinje.
- Filer-fanen viser vedlegg.

**Redigeringsmodus** (bruker jobber i midtpanelet):
- Begrunnelse-fanen transformeres til aktiv editor.
- Historikk- og Filer-fanene dimmes/låses — brukeren skal ikke navigere vekk fra begrunnelsen midt i arbeidet.
- En visuell modus-indikator: venstre-kant av panelet får en 3px accent i warm-blue (`#1f42aa`), tilsvarende redigeringsmodus-indikatoren på bento-kort.

### Dual-block-mønsteret

Når BH svarer, inneholder høyrepanelet to blokker: TEs begrunnelse (referanse) over BHs begrunnelse (editor). En visuell separator mellom dem.

```
┌──────────────────────────────────┐
│  TEs krav                        │
│  ┌──────────────────────────────┐│
│  │ Forsinkelsen skyldes under-  ││
│  │ leverandør Stålmontasje AS   ││
│  │ sin sene leveranse av bære-  ││
│  │ konstruksjoner, jf. varsel   ││
│  │ av 15.01.2026.               ││
│  │              ▾ Vis mer (3/8) ││
│  └──────────────────────────────┘│
│                                  │
│  ··· TE → BH ···                │
│                                  │
│  BHs vurdering (deg)             │
│  ┌──────────────────────────────┐│
│  │                              ││
│  │  Godkjenner {{dager:30:30    ││
│  │  dager}} av {{dager:45:45    ││
│  │  dager}}.                    ││
│  │                              ││
│  │  TE har ikke dokumentert     ││
│  │  at forsinkelsen påvirker    ││
│  │  kritisk linje utover        ││
│  │  {{dager:30:30 dager}}.      ││
│  │  Innsigelse mot              ││
│  │  spesifisering               ││
│  │  {{paragraf:§33.6:§33.6}}.   ││
│  │                              ││
│  │  ──────────────────          ││
│  │  ¶  B  I                     ││
│  └──────────────────────────────┘│
│                                  │
│  ┌ Vedlegg ────────────────────┐│
│  │ ⇧ Dra filer hit             ││
│  └──────────────────────────────┘│
└──────────────────────────────────┘
```

**TE-blokken:**
- Read-only. Bakgrunn: `bg-pkt-bg-subtle`. Border: `border-pkt-border-subtle`.
- Teksten er komprimerbar — viser 3 linjer med «Vis mer» for å ekspandere. Brukeren trenger kontekst men ikke hele teksten hele tiden.
- Rolle-badge: `TE` i grønn pill (`bg-role-te-pill-bg text-role-te-text`).
- Tekst: 13px, `leading-relaxed`, `text-pkt-text-body-default`.

**Separator:**
- En sentrert linje med «TE → BH»-tekst i dempet farge. 11px, `text-pkt-grays-gray-400`.
- Visuelt: tynt strek-prikk-mønster med tekst i midten.

**BH-blokken:**
- Aktiv editor. BegrunnelseEditor med TipTap og LockedValue-tokens.
- Border: `border-2 border-pkt-border-focus` — den aktive skrivesonen har tykkere, blå border for å signalisere fokus.
- LockedValue-tokens vises som inline-badges:
  - `{{dager:30:30 dager}}` → cyan badge (`bg-pkt-brand-blue-200 border-pkt-border-blue text-pkt-brand-dark-blue-1000`)
  - `{{belop:150000:kr 150 000,-}}` → grønn badge (`bg-pkt-brand-light-green-400 border-pkt-border-green text-pkt-brand-dark-green-1000`)
  - `{{prosent:67:67%}}` → lilla badge (`bg-[#f3e8ff] border-pkt-brand-purple-1000 text-pkt-brand-dark-blue-1000`)
  - `{{paragraf:§33.6:§33.6}}` → grå badge (`bg-pkt-bg-subtle border-pkt-border-gray text-pkt-text-body-dark`)
- Tokens er ikke-redigerbare inline — de endres automatisk når tallene endres i midtpanelet. Brukeren kan flytte dem men ikke slette dem.
- Toolbar i bunnen: minimal. ¶ (avsnittsformater), **B** (bold), *I* (italic). Ikke full rich text — kontraktsbegrunnelser trenger avsnitt og uthevninger, ikke tabeller og bilder.

**Når TE sender:**
- Ingen TE-blokk øverst (TE skriver selv).
- Editoren tar full høyde.
- Rollen er «skriv begrunnelse for kravet.»

### Auto-begrunnelse og regenerering

Bridge-hookene genererer allerede begrunnelse automatisk basert på de strukturerte valgene i midtpanelet. Denne teksten inneholder LockedValue-tokens.

```
Auto-generert eksempel (frist, BH delvis godkjent):

"Godkjenner {{dager:30:30 dager}} av {{dager:45:45 dager}}
({{prosent:67:67%}}). TE har varslet etter §33.4 den
{{dato:2026-01-15:15.01.2026}}, men spesifisert krav etter §33.6.1
ble sendt etter fristen. Innsigelse om preklusjon etter
{{paragraf:§33.6.1:§33.6.1}} fastholdes."
```

**Regenerer-knapp:** En liten `↻ Regenerer`-lenke under editoren. Klikk: `generateResponseBegrunnelse()` kjøres, ny tekst erstatter innholdet. Brukeren varsles: «Regenerering erstatter din tekst.» `userHasEditedBegrunnelseRef` settes til false.

**Første gang:** Når brukeren åpner edit-modus, auto-begrunnelse genereres og populerer editoren. Brukeren kan redigere fritt — tokens oppdateres live når midtpanelets verdier endres.

### Vedlegg under editoren

Vedlegg lever under editoren, ikke i midtpanelet.

```
VEDLEGG
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  ⇧  Dra filer hit  ·  PDF, DOCX
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

Etter opplasting:
📎  Fremdriftsplan_rev3.pdf      1.2 MB   ✕
📎  Korrespondanse_stål.pdf      340 KB   ✕
```

- Drop-sone: stiplet border (`border-dashed border-pkt-grays-gray-300`), dempet tekst.
- Fil-liste: ikon + filnavn + størrelse + slett-knapp. 13px, monospace for størrelse.

**Hvorfor under editoren:** Vedlegg understøtter begrunnelsen — «jf. vedlagt fremdriftsplan.» De hører fysisk ved siden av teksten de refereres i.

---

## Action Footer — Handlingssonen

Footeren er en fast stripe i bunnen av midtpanelet. Den transformeres mellom to moduser.

### Lesemodus-footer

```
┌──────────────────────────────────────────────────┐
│  Send krav  │  Revider  │  Godta svaret   Rev. 1 │
└──────────────────────────────────────────────────┘
```

- Primær handling (Send krav / Svar på krav) er venstrestilt og visuelt prominent: `bg-pkt-brand-dark-blue-1000 text-white`.
- Sekundære handlinger (Revider, Godta svaret, Trekk tilbake) er `ghost`-variant: transparent bakgrunn, `text-pkt-text-body-default`, border.
- Revisionslabel (`Rev. 1`) er høyrestilt, monospace, dempet.
- Handlingene bygges fra `useActionPermissions`-flaggene — bare de som er gyldige for gjeldende state og rolle vises.

### Redigeringsmodus-footer

```
┌──────────────────────────────────────────────────┐
│  Avbryt                      ▓▓ Send svar §33 ▓▓ │
└──────────────────────────────────────────────────┘
```

- Avbryt: ghost-variant, venstrestilt. Trigger dirty-check dialog ved ulagrede endringer.
- Primær: `bg-pkt-brand-dark-blue-1000 text-white`, høyrestilt. §-referanse i knappeteksten.
- Loading: knappen viser spinner og «Sender...» når `isSubmitting`.
- Disabled: `opacity-50 cursor-not-allowed` når `!canSubmit` (validering feiler).

**§-referanse i knappeteksten:** «Send svar §33» — ikke bare «Send svar.» Det gir juridisk kontekst og trygghet. Brukeren vet nøyaktig hva de sender, under hvilken hjemmel.

### Footer-design

- Høyde: 52px. Fast, sticky bottom.
- Bakgrunn: `bg-pkt-bg-card` med `border-t border-pkt-border-subtle`.
- Padding: `px-5 py-3`.
- Overgang mellom lesemodus og redigeringsmodus: umiddelbar (ingen animasjon). Modusbytte skal føles som å bytte verktøy, ikke som en visuell effekt.

---

## Interaksjonsmønstre

### Modusovergang: lese → redigere

1. Bruker klikker «Svar på krav» i lesemodus-footeren.
2. Midtpanelet transformeres: kravhodet blir referansekort (grå bakgrunn), beslutningsfelt dukker opp under, footer transformeres.
3. Høyrepanelet transformeres: Begrunnelse-fanen aktiverer editoren, andre faner dimmes, venstre-kant-accent vises.
4. Auto-begrunnelse genereres og populerer editoren.

**Ingen modal, ingen sidenavigasjon, ingen scroll-jump.** Tre-panel-strukturen er stabil — bare innholdet innenfor panelene endres.

### Live-oppdatering mellom paneler

Når brukeren endrer «Godkjent dager» fra 30 til 25 i midtpanelet:
1. Grad-% i posisjonskort oppdateres umiddelbart (67% → 56%).
2. Progress bar animeres med `transition-all duration-300`.
3. LockedValue-token `{{dager:30:30 dager}}` i editoren oppdateres til `{{dager:25:25 dager}}`.
4. Resultatboksen oppdateres.
5. Venstepanelets spornavigasjon oppdaterer mini-progress (om synlig).

### Dirty-check ved avbryt

Avbryt-knappen i footer trigger:
1. Sjekk om begrunnelse er endret eller noen felt er dirty.
2. Hvis dirty: Radix Dialog med «Du har ulagrede endringer. Forkast endringer? / Fortsett redigering.»
3. Hvis ikke dirty: umiddelbar retur til lesemodus.

### Tastaturnavigasjon

- `Tab`: navigerer mellom feltgrupper (ikke mellom individuelle radioknapper).
- `Space/Enter`: velger radioknapp eller checkbox.
- `Ctrl+Enter` (fra editoren): submit — sender krav/svar.
- `Esc`: trigger avbryt (med dirty-check).

---

## Per-kravtype detaljdesign

### Ansvarsgrunnlag — BH svarer

Midtpanelet er det enkleste — få felt, men med store konsekvenser.

```
MIDTPANEL                                HØYREPANEL

┌───────────────────────────────┐        ┌──────────────────────────┐
│                               │        │ TE  TEs varsling         │
│  TEs krav                     │        │ ┌──────────────────────┐ │
│  ╔═══════════════════════════╗│        │ │ Endringen oppstod... │ │
│  ║ Irregulær endring §32.1   ║│        │ │         ▾ Vis mer    │ │
│  ║ Oppdaget 10.01 · Varsl   ║│        │ └──────────────────────┘ │
│  ║ 15.01.2026                ║│        │                          │
│  ╚═══════════════════════════╝│        │ ··· TE → BH ···         │
│                               │        │                          │
│  VARSLING §32.2           ⓘ  │        │ BHs vurdering (deg)      │
│  ─────────────────────────── │        │ ┌──────────────────────┐ │
│  Varslet i tide?              │        │ │                      │ │
│  ┌─────┐ ┌─────┐             │        │ │ Byggherren anser     │ │
│  │  Ja │ │ Nei │             │        │ │ varselet mottatt i   │ │
│  └─────┘ └─────┘             │        │ │ tide, men avslår_    │ │
│                               │        │ │                      │ │
│  DIN VURDERING                │        │ │                ¶ B I │ │
│  ─────────────────────────── │        │ └──────────────────────┘ │
│  ○  Godkjent                  │        │                          │
│  ○  Avslått                   │        │ VEDLEGG                  │
│  ○  Frafalt                   │        │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐ │
│                               │        │   ⇧ Dra filer hit       │
│  ┌ KONSEKVENS ──────────────┐│        │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘ │
│  │ ⚠ Avslått betyr at       ││        └──────────────────────────┘
│  │ vederlag og frist         ││
│  │ behandles subsidiært     ││
│  └──────────────────────────┘│
│                               │
├───────────────────────────────┤
│ Avbryt      ▓ Send svar §25 ▓│
└───────────────────────────────┘
```

**Spesielt for grunnlag:**
- Varsling §32.2 (Ja/Nei) vises bare for ENDRING-kategori.
- Konsekvens-callout: dynamisk basert på valg. Godkjent → grønn alert. Avslått → oransje warning (subsidiær-konsekvens). Frafalt → grå info.
- **Snuoperasjon-alert:** Hvis BH endrer fra avslått → godkjent, vises en grønn success-alert: «Subsidiære vederlag- og fristsvar blir prinsipale.»
- **Passivitets-advarsel:** Hvis ENDRING og >10 dager uten svar, vises en rød danger-alert: «§32.3 — risiko for passiv godkjennelse.»

### Vederlagsjustering — BH svarer

Det mest komplekse kravtype. Flere seksjoner, betingede felt, per-kravlinje-evaluering.

```
MIDTPANEL

┌──────────────────────────────────────┐
│  TEs krav                     Rev. 2 │
│  ╔══════════════════════════════════╗│
│  ║ Regningsarbeid §34.4             ║│
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
│  ┌────────────┬──────────┬────────┐ │
│  │Enhetspriser│Regningsarb│Fastpris│ │
│  └────────────┴──────────┴────────┘ │
│  TE valgte: Regningsarbeid          │
│                                      │
│  HOVEDKRAV §34.1                 ⓘ  │
│  ────────────────────────────────── │
│  Varslet i tide?                     │
│  ┌─────┐ ┌─────┐                    │
│  │  Ja │ │ Nei │    ☑ PREKLUDERT    │
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
│  Varslet i tide?                     │
│  ┌─────┐ ┌─────┐                    │
│  │  Ja │ │ Nei │                    │
│  └─────┘ └─────┘                    │
│                                      │
│  Krevd ···················· kr 350k  │
│  ┌──────────────────────────────┐   │
│  │ 280 000                │ kr │   │
│  └──────────────────────────────┘   │
│  Differanse: -70k (80% godkjent)    │
│                                      │
│  PRODUKTIVITET §34.1.3           ⓘ  │
│  ────────────────────────────────── │
│  Varslet i tide?                     │
│  ┌─────┐ ┌─────┐                    │
│  │  Ja │ │ Nei │                    │
│  └─────┘ └─────┘                    │
│                                      │
│  Krevd ···················· kr 250k  │
│  ┌──────────────────────────────┐   │
│  │ 120 000                │ kr │   │
│  └──────────────────────────────┘   │
│  Differanse: -130k (48% godkjent)   │
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

**Spesielt for vederlag:**
- **Per-kravlinje-evaluering:** Hovedkrav, Rigg/drift, Produktivitet er tre separate seksjoner med egne varsling-toggles og beløp-inputs. Hver har sin egen preklusjonsstatus.
- **§34.1.2 preklusjon:** Varsling-toggle vises IKKE for ENDRING-kategori (§34.1.1 har ingen preklusjonsregel). Kun for SVIKT/ANDRE.
- **Metodevalg:** TE vs BH. Hvis BH velger annen metode enn TE, vises «TE valgte: X» under segmented control.
- **EP-justering §34.3.3:** Ekstra toggle-seksjon, kun synlig ved ENHETSPRISER.
- **Tilbakeholdelse §30.2:** Ekstra felt, kun synlig ved REGNINGSARBEID.
- **Resultatboks:** Viser prinsipalt + subsidiært. Subsidiært vises bare når grunnlag er avslått.

### Fristforlengelse — detaljer er allerede dekket

Se mockupene og den generelle beslutningsfelt-grammatikken over.

---

## Overflate- og fargebeslutninger for panelene

### Midtpanel

- Bakgrunn: `bg-pkt-bg-card` (hvit). Ren arbeidsflate.
- Padding: `p-5` (20px) rundt innhold.
- Intern scrolling: `overflow-y-auto scrollbar-auto`. Innholdet scroller innenfor panelet — footeren er sticky.
- Ingen kanter mot venstepanel/høyrepanel — overflatefargeforskjell gjør jobben (venstepanel er `bg-pkt-bg-subtle`).

### Høyrepanel

- Bakgrunn: `bg-pkt-bg-card` (hvit). Samme som midten — de er ett sammenhengende arbeidsrom.
- Bredde: `w-[340px]`. Smalere enn access-sidens 380px — vi trenger mer plass for midtpanelet.
- Venstre-kant: `border-l border-pkt-border-subtle` i lesemodus. `border-l-[3px] border-l-pkt-brand-warm-blue-1000` i redigeringsmodus.
- Intern scrolling: `overflow-y-auto scrollbar-auto`.

### Delt linje mellom midtpanel og høyrepanel

I lesemodus: 1px vertikal border (`border-pkt-border-subtle`).
I redigeringsmodus: 3px accent-linje i warm-blue — signaliserer at panelene jobber sammen.

---

## Hva som er avvist

| Default | Erstatning | Hvorfor |
|---------|------------|---------|
| VerdictCards (klikkbare kort med ikoner) | Vertikale radios med beskrivelse | Kompaktere, skanner raskere, tar 50% av plassen |
| InlineYesNo for innsigelser | Eksplisitte checkboxer med §-referanse | Juridisk tydeligere — du hevder en posisjon, ikke svarer et spørsmål |
| Begrunnelse-textarea i midtpanelet | Dedikert høyrepanel med TipTap | Begrunnelsen er et dokument, ikke et skjemafelt |
| Flat tab-strip i høyrepanelet | Tab-låsing under redigering | Forhindrer navigasjon vekk fra aktiv begrunnelse |
| 380px høyrepanel | 340px | Midtpanelet trenger mer plass for per-kravlinje-evaluering |
| Progress bar 1.5px | Progress bar 6px | Forhandlingsresultatet fortjener visuell signifikans |
| Skygger for separasjon | Kun borders | Kontraktsdokumenter har linjer, ikke skygger |
| Monolittisk 1555-linjers fil | Komponentbasert arkitektur | Gjenbruk, vedlikehold, testbarhet |

---

## Manglende felt og edge cases (fra BUSINESS_LOGIC.md)

### Force Majeure — vederlag deaktivert

Når TE velger hovedkategori FORCE_MAJEURE, deaktiveres vederlagssporet helt. Bare frist er relevant.

**Konsekvens for arbeidsflaten:**
- Hvis brukeren navigerer til vederlag (via venstepanelet), vises en tom seksjon med forklaring: «Vederlag er ikke relevant for Force Majeure-saker (§33.1 c). Kun fristforlengelse kan kreves.»
- Tekst: 14px, `text-pkt-text-body-subtle`, sentrert vertikalt med §-ikon.
- Ingen felter, ingen footer-actions.

### BH: Metodevalg er vurdering, ikke valg

BUSINESS_LOGIC.md spesifiserer at BH evaluerer TEs metodevalg (`akseptererMetode`), eventuelt foreslår alternativ (`oensketMetode`). Designet i vederlag-midtpanelet viser en segmented control der BH velger metode — men korrekt UX er:

```
METODE §34.2                                          ⓘ
────────────────────────────────────────────────────────
TE valgte: Regningsarbeid

Aksepterer du TEs metodevalg?
┌─────┐ ┌─────┐
│  Ja │ │ Nei │
└─────┘ └─────┘

[Synlig hvis Nei:]
Foreslått metode:
┌─────────────┬──────────────────┬─────────────┐
│ Enhetspriser│ Regningsarbeid   │ Fastpris    │
└─────────────┴──────────────────┴─────────────┘
```

BH ser alltid hva TE valgte (som key-value-rad). Deretter Ja/Nei for aksept. Bare ved «Nei» vises metode-segmented for BHs alternativ. Dette matcher domenelogikken: BH vurderer TEs valg, velger ikke uavhengig.

### Hold-tilbake (§30.2)

Vederlag-resultater inkluderer `hold_tilbake` som egen resultattype. Når BH aktiverer `holdTilbake` i evaluering av regningsarbeid:

```
TILBAKEHOLDELSE §30.2                                  ⓘ
────────────────────────────────────────────────────────
TE sendte ikke kostnadsoverslag.

☑  Hold tilbake betaling for arbeid utover estimat

[Synlig hvis avkrysset:]
Estimert grense ···················· kr 800 000
```

- Vises kun ved REGNINGSARBEID uten kostnadsoverslag.
- Checkbox med §-referanse, som innsigelse-checkboxer.
- Gir separat resultat-badge i posisjonskort: `HOLDT TILBAKE` i amber.

### EP-justeringsvarsling (§34.3.3)

```
EP-JUSTERING §34.3.3                                   ⓘ
────────────────────────────────────────────────────────
TE krever justerte enhetspriser.

Aksepterer du EP-justeringsvarselet?
┌─────┐ ┌─────┐
│  Ja │ │ Nei │
└─────┘ └─────┘

[Synlig hvis Nei:]
⚠  Avvist EP-justeringsvarsel → reduksjon i vederlag
```

Kun synlig ved ENHETSPRISER og TE har flagget `krever_justert_ep`.

### Frist TE: tidligereVarslet og scenario-håndtering

TE-innsending for frist har forskjellige scenarier som påvirker tilgjengelige varseltyper:

| Scenario | Kontekst | Tilgjengelige varseltyper |
|----------|----------|--------------------------|
| `new` | Nytt krav | Varsel eller Spesifisert |
| `spesifisering` | Spesifiserer etter tidligere varsel | Spesifisert (låst) |
| `foresporsel` | Svarer på BHs etterlysning | Spesifisert eller Begrunnelse utsatt |
| `edit` | Oppdaterer eksisterende krav | Beholder opprinnelig type |

**Designkonsekvenser:**
- I `new`-scenario: Segmented control med Varsel / Spesifisert. Ikke «Begrunnelse utsatt» — det er kun et svar-alternativ.
- I `spesifisering`: Varseltype-segmented er disabled/låst til «Spesifisert». Kontekstalert: «Du spesifiserer dager for varselet sendt [dato].»
- I `foresporsel`: Segmented med Spesifisert / Begrunnelse utsatt. Kontekstalert: «BH etterlyste spesifisering innen [frist]. Du svarer nå.»
- I `edit`: Varseltype-segmented er disabled/låst.

**`tidligereVarslet`-felt** (kun i `new`-scenario):

```
Har du varslet tidligere?
┌─────┐ ┌─────┐
│  Ja │ │ Nei │
└─────┘ └─────┘

[Synlig hvis Ja:]
Varseldato
┌────────────────────────────────────────┐
│ 15.01.2026                │ 📅       │
└────────────────────────────────────────┘
```

### Preklusjonsadvarsel for TE (frist)

Beregnes fra `dato_oppdaget`. Vises som alert i kravhodet:

- 0–7 dager: ingen advarsel
- 7–14 dager: `⚠ Det er [N] dager siden forholdet ble oppdaget. Vurder å sende varsel snart.` — amber warning
- >14 dager: `⛔ Det er [N] dager siden forholdet ble oppdaget. Risiko for preklusjon.` — rød danger

### Versjons-mismatch

Når TE reviderer kravet etter at BH har svart, gjelder BHs eksisterende svar den gamle versjonen.

**Kravhodet ved mismatch:**

```
╔══════════════════════════════════════════════════╗
║  TEs krav                                 Rev. 2 ║
║  ⚠  Du svarte på Rev. 1 — TE har oppdatert      ║
║                                                  ║
║  Spesifisert krav §33.6                          ║
║  55 kalenderdager (var: 45d)  ·  Ny sluttdato    ║
╚══════════════════════════════════════════════════╝
```

- Amber warning-banner under kravtittel.
- Endrede verdier viser forskjell: `55 kalenderdager (var: 45d)`.
- BH kan velge å oppdatere svaret basert på ny versjon eller beholde eksisterende.

---

## Aksept og lukking

Etter BH har svart, har TE tre valg. Disse vises som action footer-knapper i TEs lesemodus:

```
┌──────────────────────────────────────────────────┐
│  Revider krav  │  Trekk tilbake  │  Aksepter svar │
└──────────────────────────────────────────────────┘
```

**Aksepter svar:**
- Primær knapp (grønn variant): `bg-pkt-brand-dark-green-1000 text-white`.
- Klikk → bekreftelses-dialog: «Du aksepterer BHs svar. Sporet lukkes og enighet registreres. Aksepter / Avbryt.»
- Etter aksept: midtpanelet viser fullført-tilstand med alle verdier som read-only og en grønn `OMFORENT`-badge.

**Trekk tilbake:**
- Destruktiv handling: ghost-variant med `text-pkt-brand-red-1000`.
- Klikk → bekreftelses-dialog med advarsel: «Kravet trekkes tilbake og bortfaller. Handlingen kan ikke angres.»
- Krever begrunnelse (min 10 tegn) i dialogen.

**Revider krav:**
- Ghost-variant. Åpner redigeringsmodus med eksisterende verdier pre-populert.
- Revisjonsnummer øker ved innsending.

---

## Forsering (§33.8) — spesialkravtype

Forsering oppstår når BH avslår TEs fristkrav og TE akselererer arbeidet. Arbeidsflaten for forsering har en annen struktur enn standard tre-spor.

### TE varsler forsering

Midtpanelet:

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
│ ┌────────────────────────────────┐  │
│ │ 01.03.2026              │ 📅 │  │
│ └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│ Avbryt     ▓ Send forseringsvarsel ▓ │
└──────────────────────────────────────┘
```

### BH evaluerer forsering

Midtpanelet viser TEs varsling som referansekort, deretter:

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
Overholdt? ┌─────┐ ┌─────┐
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

## Dynamisk begrunnelsestekst

Veiledningsteksten (placeholder) i BegrunnelseEditor endrer seg basert på kontekst. Dette gir BH/TE retning uten å predefinere innholdet.

| Kontekst | Placeholder-tekst |
|----------|-------------------|
| Grunnlag godkjent | «Begrunn godkjenningen — referér til kontraktsbestemmelsen som gir TE rett.» |
| Grunnlag avslått | «Begrunn avslaget — forklár hvorfor forholdet ikke gir TE rett etter kontrakten.» |
| Grunnlag frafalt | «Begrunn frafallet — TE har krevet endring, BH trekker pålegget.» |
| Vederlag delvis | «Begrunn godkjenningsgraden — forklár hva som dekkes og hva som avvises.» |
| Vederlag med preklusjon | «Begrunn prinsipalt avslag og subsidiær evaluering.» |
| Frist med innsigelse | «Begrunn godkjente dager og innsigelsene — referér til §-bestemmelsene.» |
| TE sender krav | «Begrunn kravet — beskriv forholdet og henvis til kontrakten.» |

Placeholder forsvinner når brukeren begynner å skrive. Auto-begrunnelse erstatter placeholder direkte.

---

## Endringsordre (§31.3) — BH-initiert

Endringsordre er en annen sakstype som samler en eller flere KOE-saker under én formell endringsordre. Arbeidsflaten for EO har en dokumentlignende karakter — mer protokoll enn evaluering.

### BH oppretter EO

Midtpanelet:

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

## Mandate-sjekker (SKILL.md)

### Swap-test

> «Hvis du byttet typeface til din vanlige, ville noen merke det?»

Oslo Sans er pålagt av Punkt-designsystemet — det er ikke et valg vi kan swappe. Men: monospace for tall og tabular-nums for datoer er bevisste valg. Bytt monospace-tallene til proportional default-font → tabellkvaliteten i key-value-rader forsvinner. Bytt UPPERCASE-seksjonshodene til sentence-case → kontrakts-referanse-følelsen forsvinner. Bytt §-ikoner til generiske labels → juridisk tyngde forsvinner.

Disse valgene er ikke swappbare uten at det føles annerledes. **Bestått.**

### Squint-test

> «Blur øynene. Kan du fortsatt se hierarki?»

Midtpanelet har fire tydelige soner: kravhode (grå bakgrunn, compact), posisjonskort (horisontal stripe med tall), beslutningsfelt (vertikale seksjoner med seksjonslinje + innrykk), resultatboks (grå bakgrunn, border-top). Selv uten å lese teksten: referanse → tall → kontroller → resultat. Høyrepanelet: to blokker (grå referanse → hvit editor) med separator. Footer: to knapper, én prominent.

Ingenting skriker. Seksjonslinjene er `border-pkt-border-subtle`. Posisjonskortets 6px progress bar er den sterkeste fargen — korrekt prioritert (forhandlingsresultatet er viktigst). **Bestått.**

### Signatur-test

> «Kan du peke på fem spesifikke elementer der signaturen din dukker opp?»

Signaturen for dette produktet er **§-referanser som strukturelt element** — paragrafhenvisninger er ikke pynt, de er navigasjon og juridisk forankring.

1. **Seksjonshoder**: `VARSLING §33.4` — §-ref i kapitteloverskriften, monospace.
2. **Knappetekst**: `Send svar §33` — juridisk kontekst i handlingsknappen.
3. **Innsigelse-checkboxer**: `☑ Preklusjon §33.6.1 — spesifisert for sent` — §-ref i selve checkbox-labelen.
4. **LockedValue-tokens**: `{{paragraf:§33.6:§33.6}}` — §-referanser som inline-badges i begrunnelsetekst.
5. **Konsekvens-callout**: `§32.3 — risiko for passiv godkjennelse` — §-ref i warning-alerts.

Fjern §-referansene, og grensesnittet kunne vært et generisk sakshåndteringssystem. Med dem er det umiskjennelig kontraktsadministrasjon. **Bestått.**

### Token-test

> «Les CSS-variablene dine høyt. Høres de ut som de tilhører dette produktets verden?»

Brukte tokens: `bg-pkt-bg-subtle`, `text-pkt-text-body-subtle`, `border-pkt-border-subtle`, `bg-pkt-brand-dark-green-1000`, `text-bento-krevd`, `bg-role-te-pill-bg`, `border-pkt-border-focus`.

`pkt` = Punkt (Oslo kommunes designsystem) — domenespesifikt.
`bento-krevd` = bento-layoutens krevd-farge — prosjektspesifikt.
`role-te-pill-bg` = totalentreprenør-rollefarge — kontraktsspesifikt.

Disse kunne ikke tilhøre et annet prosjekt. De er forankret i Punkt-identiteten og kontraktsdomenet. **Bestått.**
