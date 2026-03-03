# Designvurdering — KOE-plattformens grensesnitt

**Dato:** 2026-03-02
**Kontekst:** Gjennomgang av forretningslogikk-til-UI mapping og forslag til strukturell forbedring

---

## Domeneutforskning

### Hvem er brukeren?

En norsk kontraktsadministrator — enten hos totalentreprenør (TE) eller byggherre (BH). De sitter på et prosjektkontor, kanskje i en brakke på byggeplass, kanskje i et kontorlandskap. NS 8407 ligger på pulten. De har håndtert titalls endringskrav. De kjenner paragrafene utenat.

De trenger ett svar umiddelbart: **«Hvor står forhandlingen på tvers av alle tre spor, og hva må JEG gjøre neste?»**

### Domenekonsepter

| Konsept | Metafor | Relevans for UI |
|---------|---------|-----------------|
| **Forhandlingsbordet** | To parter som sitter overfor hverandre med dokumenter mellom seg | Dual-perspektiv. Samme data, forskjellige handlinger |
| **Tre-spor-elven** | Tre parallelle strømmer som flyter samtidig, noen ganger uavhengig, noen ganger konvergerende | Visuell parallellitet — man må se alle tre samtidig |
| **Porter/sluser** | BH evaluerer sekvensielt gjennom porter: preklusjon → metode → beløp | Steg-for-steg evaluering, ikke ett stort skjema |
| **Preklusjonsklokken** | En frist som tikker — varsle i tide eller mist retten | Tidspress som visuelt element, urgency |
| **Subsidiær posisjon** | «Vi avslår, men HVIS vi tar feil...» — fallback-tilbudet | To lag av informasjon: prinsipal + subsidiær |
| **Revisjonskjeden** | Frem og tilbake mellom partene, versjon for versjon | Historikk som kontekst for nåværende posisjon |
| **Varslingsmatrisen** | En sjekkliste over alle §-baserte varslingskrav | Alltid synlig påminnelse om forpliktelser |

### Fargeverdenen

Hva ville du sett om du gikk inn i denne verden fysisk?

- **Norsk betong og stål** — det grå i konstruksjonslandskapet (`#f0f0f2`, `#cccccc`)
- **Oslo-blått** — den dype indigo fra kommunens identitet, formelt og autoritativt (`#2a2859`)
- **Byggeplasskilt-gul** — varsling, oppmerksomhet, frister som nærmer seg (`#f9c66b`)
- **Stempel-grønt** — godkjenning, kontrakt-aksept, det offisielle Norges farger (`#034b45`)
- **Tegningsbeige** — arkitekttegninger, papirdokumenter, kontraktsbilag (`#f8f0dd`, `#d0bfae`)
- **Innsigelse-rødt** — avslag, preklusjon, uberettiget krav (`#c9302c`)
- **Kontorsblått** — rolig arbeidsflate, uten distraksjoner (`#f1fdff`)

Disse fargene finnes allerede i Punkt-designsystemet. Det er en styrke — paletten er autentisk for domenet.

### Signaturelement

**«Tre-spor-stillingskortet»** — en alltid-synlig, kompakt representasjon av forhandlingsposisjonen på tvers av alle tre spor. Ikke en generisk status-badge, men en levende scorecard som viser: krevd → godkjent, med subsidiær posisjon synlig når relevant. Dette elementet finnes ikke i noen annen SaaS-app fordi ingen annen app håndterer tre parallelle kontraktuelle forhandlingsspor med subsidiær logikk.

### Defaults å avvise

| Default | Hvorfor det er feil | Erstatning |
|---------|---------------------|------------|
| **Lik vekting av alle kort** — standard dashboard-grid med like store celler | Grunnlag er hierarkisk overordnet. Det styrer om vederlag/frist er aktive | Hierarkisk layout der grunnlag forankrer alt |
| **Konteksttap ved redigering** — form tar hele skjermen, resten forsvinner | Brukeren trenger de andre sporene som referanse mens de jobber | Persistent kontekst ved siden av redigeringsflaten |
| **Flat informasjonsarkitektur** — alt like synlig hele tiden | Subsidiær logikk, versjonshistorikk og §-referanser er viktige men sekundære | Lagdelt informasjon: posisjon → detaljer → kontekst |

---

## Vurdering av nåværende design

### Det som fungerer godt

**1. Bento-griddets hierarkiske layout er riktig arkitektur.**

Å dele inn i CaseMasterCard (venstre) + VederlagCard/FristCard (høyre) reflekterer den reelle avhengighetsstrukturen: grunnlag er fundamentet, vederlag og frist er avledet. Denne venstre-til-høyre flyten er intuitiv og kontraktsmessig korrekt.

**2. Card-anchored editing er en klok beslutning.**

At skjemaer ekspanderer inline i stedet for i modaler er riktig for dette domenet. Brukeren trenger kontekst mens de redigerer — de må se hva TE krevde mens de skriver BH's respons. Modaler stjeler denne konteksten. `useGrunnlagBridge`, `useFristBridge` og `useVederlagBridge`-mønsteret er gjennomtenkt.

**3. VarslingStatusStrip er et unikt verdifullt element.**

Denne stripen som viser alle §-baserte varslingsforpliktelser er domene-spesifikk og verdifull. Ingen template-dashboard ville ha dette. Det er ekte domeneforståelse.

**4. CrossTrackActivity gir umiddelbar kontekst.**

De 5 siste hendelsene på tvers av spor gir «hva har skjedd siden sist»-kontekst uten å ekspandere noe. Fargekodede spor-dots (mørkeblå/blå/gul) er effektive.

**5. Subtle surface washes differensierer sporene.**

`bg-bento-vederlag` (mint) og `bg-bento-frist` (amber) gir hver sportype sin egen tonal identitet uten å overdrive. MasterCard forblir nøytral (hvit) som den overordnede forankringen.

**6. Inline-kontroller i editState er veldesignet.**

Når CaseMasterCard går i edit-modus med `ring-2 ring-pkt-brand-warm-blue-1000/30`, VerdictCards, InlineYesNo — det er stramt og funksjonelt. Bridge-mønsteret som lar kortet vise levende beregningsresultater er gjennomført.

### Det som ikke fungerer — strukturelle problemer

**1. Konteksttap ved redigering (det største problemet)**

Når `expandedTrack` settes, transformeres hele layouten:

- `isFristFormOpen` → hektes ut av sin vanlige posisjon, rendres øverst i en 12-col grid
- `isVederlagFormOpen` → samme
- `!expandedTrack` → VarslingStatusStrip og de ordinære kortene rendres normalt
- `expandedTrack && track !== 'vederlag'` → VederlagCard dyttes til bunnen

**Konsekvensen:** Brukeren mister sin mentale modell. VarslingStatusStrip forsvinner. De andre sporenes posisjoner flyttes. Den stabile «forhandlingsbordet»-opplevelsen brytes.

**Dette er det mest kritiske designproblemet.** I en forhandlingskontekst er kontekst alt. Når BH svarer på vederlagskravet, trenger de å se: grunnlagsresultatet (påvirker subsidiær logikk), fristkravet (for helhetlig vurdering), og varslingsstatusen (for preklusjonsvurdering). Alt dette forsvinner når vederlagsformen ekspanderer.

**2. Ingen persistent posisjonsoversikt**

Det finnes ingen element som alltid viser: «Hvor står vi?»

```
Grunnlag: Avslått    Vederlag: 450k → 280k (62%)    Frist: 14d → 7d (50%)
```

CrossTrackActivity viser hendelser (hva som skjedde), ikke posisjoner (hvor vi står). VarslingStatusStrip viser varslingsforpliktelser, ikke forhandlingsresultater. Sportkortene viser dette individuelt, men de forsvinner eller flyttes under redigering.

**3. Vertikalt sprawl — for mye scrolling**

Med PageHeader → CrossTrackActivity → VarslingStatusStrip → MasterCard + Vederlag/Frist-kort → eventuelt ApprovalAlerts → expander form — dette krever betydelig scrolling. For tre spor som skal sees i parallell, er det for mye.

**4. Inkonsistent form-ekspandering**

| Track | Handling | Layout-endring |
|-------|----------|----------------|
| Grunnlag: respond | col-5 (card) + col-7 (form) | Side-by-side |
| Vederlag: respond | col-5 (card) + col-7 (form) | Side-by-side |
| Frist: respond | col-5 (card) + col-7 (form) | Side-by-side |
| Vederlag: send (TE) | col-12 (card med intern two-column) | Full bredde |
| Frist: send (TE) | col-12 (card med intern two-column) | Full bredde |
| Grunnlag: withdraw | col-12 via TrackFormView | Full bredde |

Tre forskjellige ekspanderingsmønstre. Brukeren må lære tre mentale modeller for «hva skjer når jeg klikker en handling».

**5. Subsidiær logikk er visuelt underkommunisert**

Subsidiære posisjoner er et av de mest kraftfulle forhandlingsgrepene i NS 8407. I UI-et håndteres det via:
- En `isSubsidiary`-prop på track-kortene
- `subsidiaer_godkjent_belop` / `subsidiaer_godkjent_dager` i state
- Et lite `subsidiaer_indicator`-dot

Men det finnes ingen dedikert visuell sone som sier: «Her er prinsipalt resultat: X. Her er subsidiært resultat: Y. Differansen er Z.» Denne informasjonen er kontraktsmessig kritisk.

**6. PageHeader bruker plass uten å gi nok tilbake**

PageHeader viser tittel, saksnummer, rolletoggle og meny. Men den gir ikke den informasjonen brukeren trenger mest: **saksstatus og neste handling**. `neste_handling`-feltet (rolle + handling + spor) er beregnet i backend men synliggjøres ikke prominent nok i header.

---

## Retningsforslag — «Forhandlingsdesken»

### Konsept

Bygg den nåværende bento-layouten ut med et **persistent høyrepanel** som gir kontekst uansett hva brukeren gjør. Panelet adapterer innholdet sitt basert på brukerens fokus.

### Informasjonsarkitektur — tre soner

```
┌──────────────────────────────────────────────────────────────────────┐
│  Compact Header: Sak #123 · ENDRING · IRREG §32.1 · [STATUS]       │
│  TE: Bygge AS → BH: Kommune   Neste: BH svarer på vederlag         │
├────────────────────────────────────────────┬─────────────────────────┤
│                                            │                         │
│  ARBEIDSFLATE (col-8/9)                    │  KONTEKSTPANEL (col-3/4)│
│                                            │                         │
│  Når ingen form er åpen:                   │  ┌─ Stillingskortet ──┐ │
│  ┌────────────┬───────────────┐            │  │ Grunnlag: ■ Avslått │ │
│  │ MasterCard │ VarslingStrip │            │  │ Vederlag: 450k→280k │ │
│  │ (Grunnlag) │ VederlagCard  │            │  │ Frist: 14d → 7d    │ │
│  │            │ FristCard     │            │  │ Subsidiær: Ja (2/3) │ │
│  └────────────┴───────────────┘            │  └─────────────────────┘ │
│                                            │                         │
│  Når form er åpen:                         │  ┌─ Varslingsstatus ──┐ │
│  ┌────────────────────────────┐            │  │ ✓ Grunnlag §32.2   │ │
│  │ Expanded form              │            │  │ ✓ Frist §33.4      │ │
│  │ (respond/send/revise)      │            │  │ ⚠ Hovedkrav §34.1.2│ │
│  │ med kompakt sportkort      │            │  │ ✗ Rigg §34.1.3     │ │
│  │ inline                     │            │  └─────────────────────┘ │
│  └────────────────────────────┘            │                         │
│                                            │  ┌─ Aktivitet ────────┐ │
│                                            │  │ Siste 5 hendelser  │ │
│                                            │  └─────────────────────┘ │
│                                            │                         │
└────────────────────────────────────────────┴─────────────────────────┘
```

### Hvorfor dette løser problemene

| Problem | Løsning |
|---------|---------|
| Konteksttap ved redigering | Høyrepanelet er **alltid synlig** — stillingskortet, varslingsstatus og aktivitet forsvinner aldri |
| Ingen persistent posisjonsoversikt | «Stillingskortet» øverst i høyrepanelet viser alltid alle tre spor |
| Vertikalt sprawl | Arbeidsflaten kan bruke full høyde uten å scrolle forbi kontekst — konteksten er ved siden av |
| Inkonsistent form-ekspandering | Alle forms ekspanderer i arbeidsflaten (col-8/9), alltid samme mønster |
| Subsidiær underinformering | Stillingskortet viser prinsipal + subsidiær side om side |
| PageHeader gir lite tilbake | Kompakter headeren og flytter «neste handling» til stillingskortet |

### Høyrepanelets adaptive innhold

Panelet tilpasser seg konteksten:

**Default (ingen form åpen):**
- Stillingskortet (kompakt oversikt alle tre spor)
- Varslingsstatus (VarslingStatusStrip — vertikal variant)
- Siste aktivitet (CrossTrackActivity — vertikal liste)

**Når BH svarer på grunnlag:**
- Stillingskortet (uthevet grunnlag-raden)
- §-referanse for valgt kategori
- Preklusjonsstatus med beregning
- TE's begrunnelse (for referanse under evaluering)

**Når BH svarer på vederlag:**
- Stillingskortet (uthevet vederlag-raden)
- Grunnlagsresultat (påvirker subsidiær logikk)
- Beregningsmetode-kontekst
- Særskilte krav-oversikt (rigg/produktivitet)

**Når TE sender fristkrav:**
- Stillingskortet
- Preklusjonsberegning (dager siden oppdaget)
- BH's eventuelle forespørsel
- Relaterte fristkrav (for forsering-kontekst)

### Kompakt header — informasjonstett uten sprawl

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Tilbake   KOE-2024-042 · ENDRING / IRREG §32.1              │
│             Bygge AS → Oslo Kommune   [UNDER_BEHANDLING]       │
│             Neste: BH svarer på vederlag (§34)           TE|BH │
└─────────────────────────────────────────────────────────────────┘
```

All identitetsinformasjon på to linjer. Sakstittel flyttes til MasterCard.

### Sportkort-redesign — stillingskortet som signaturelement

Det kompakte stillingskortet er den visuelle signaturen. Tre rader, alltid synlig:

```
┌─────────────────────────────────┐
│ FORHANDLINGSSTILLING            │
├─────────────────────────────────┤
│ ● Grunnlag    Avslått           │
│   §32.1 IRREG                  │
│   Subsidiært: Godkjent          │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│ ● Vederlag    kr 280 000       │
│   Krevd: kr 450 000  (62%)     │
│   Subsidiært: kr 380 000       │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│ ● Frist       7 dager          │
│   Krevd: 14 dager    (50%)     │
│   Subsidiært: 10 dager         │
└─────────────────────────────────┘
```

Hvert spor bruker sin signaturfarge:
- Grunnlag: dypt Oslo-blått (`#2a2859`)
- Vederlag: varmt blått/mint (`#1f42aa` / `bg-bento-vederlag`)
- Frist: amber (`#f9c66b` / `bg-bento-frist`)

### Responsive strategi

| Bredde | Layout |
|--------|--------|
| Desktop ≥1280px | Arbeidsflate (col-8) + Høyrepanel (col-4) |
| Tablet 768-1279px | Arbeidsflate full bredde + Høyrepanel som kollapserbart side-sheet |
| Mobil <768px | Arbeidsflate full bredde + Stillingskortet som sticky header-stripe |

### Hva som IKKE endres

- Punkt-designsystemet og Oslo Sans forblir
- Fargene og semantiske tokens forblir
- Track card-designet forblir (GrunnlagCard, VederlagCard, FristCard)
- Bridge-mønsteret for inline editing forblir
- Event sourcing-arkitekturen forblir

### Hva som endres strukturelt

1. **Ny komponent: `NegotiationSidebar`** — persistent høyrepanel
2. **Ny komponent: `PositionScorecard`** — alltid-synlig stillingskortet
3. **Refaktorert CasePageBento** — stabil arbeidsflate + sidebar, ikke layout-shuffling
4. **Kompaktert PageHeader** — informasjonstett, ikke plass-krevende
5. **VarslingStatusStrip** → vertikal variant i sidebar (i tillegg til horizontal som fallback)
6. **Konsistent form-ekspandering** — alle forms åpner i arbeidsflaten, ingen forskjellige mønstre

---

## Oppsummering

Dagens design har et godt fundament — hierarkisk bento-grid, card-anchored editing, domene-spesifikke elementer som VarslingStatusStrip. Men den har ett overordnet problem: **konteksttap under redigering**.

Løsningen er ikke et nytt design fra bunnen, men en **strukturell utvidelse**: et persistent høyrepanel som beholder forhandlingskonteksten synlig mens brukeren jobber. Dette løser det største brukbarhetsproblemet, forsterker tre-spor-metaforen, og gir plass til subsidiær-informasjonen som i dag er underkommunisert.
