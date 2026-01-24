# NS 8407 Varslingsregler - Systematisk Kartlegging

**Komplett kartlegging av alle varslingsplikter med 5 dimensjoner**

*Opprettet: 2026-01-24*
*Status: Under arbeid - verifiseres mot kontraktstekst*

> **Formål:** Dette dokumentet kartlegger systematisk alle varslingsplikter i NS 8407 med fokus på de fem dimensjonene som må være klare for hver regel. Dokumentet identifiserer også uavklarte spørsmål og hull som må adresseres før implementering.

> **Kilde:** Basert på NS 8407:2011 kontraktstekst. Paragrafer merket ✓ er verifisert mot originaltekst.

---

## Innhold

1. [De fem dimensjonene](#1-de-fem-dimensjonene)
2. [TEs varslingsplikter](#2-tes-varslingsplikter)
3. [BHs svarplikter](#3-bhs-svarplikter)
4. [BHs egne varslingsplikter](#4-bhs-egne-varslingsplikter)
5. [§5-mekanismen](#5-5-mekanismen)
6. [Uavklarte spørsmål](#6-uavklarte-spørsmål)
7. [Implikasjoner for datamodell](#7-implikasjoner-for-datamodell)

---

## 1. De fem dimensjonene

For hver varslingsregel må følgende være avklart:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FEM DIMENSJONER FOR HVER VARSLINGSREGEL                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. HVEM har varslingsplikten?                                             │
│     TE, BH, eller begge ("en part")?                                       │
│                                                                             │
│  2. HVA utløser varslingsplikten (trigger)?                                │
│     Pålegg, forhold, mottak av varsel, etc.?                               │
│                                                                             │
│  3. NÅR begynner fristen å løpe (skjæringstidspunkt)?                      │
│     "blir oppmerksom", "burde blitt", "måtte blitt"?                       │
│                                                                             │
│  4. HVOR LANG er fristen?                                                  │
│     "uten ugrunnet opphold", konkret antall dager, etc.?                   │
│                                                                             │
│  5. HVA er konsekvensen ved brudd?                                         │
│     Preklusjon, reduksjon, erstatning, passivitet, tap av rett?            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Aktsomhetsnormer (skjæringstidspunkt)

| Formulering | Norm | Terskel |
|-------------|------|---------|
| "blir oppmerksom på" | Faktisk kunnskap | Subjektiv |
| "burde ha blitt oppmerksom på" | Normal aktsomhet | Objektiv |
| "måtte ha blitt klar over" | Grov uaktsomhet å ikke vite | Streng objektiv |

### Konsekvenstyper

| Type | Kode | Alvorlighet |
|------|------|-------------|
| Preklusjon av krav | `PREKLUSJON_KRAV` | Alvorlig |
| Preklusjon av innsigelse | `PREKLUSJON_INNSIGELSE` | Alvorlig |
| Reduksjon etter skjønn | `REDUKSJON_SKJONN` | Moderat |
| Erstatningsansvar | `ERSTATNING` | Varierer |
| Tap av rett til å påberope | `TAP_AV_RETT` | Moderat |
| Ingen direkte konsekvens | `INGEN_DIREKTE` | Lav |

---

## 2. TEs varslingsplikter

### 2.1 Grunnlagssporet

#### 2.1.0 Risikoovergang - kontroll av BHs materiale (§24.2.2) ✓

> **Kontraktstekst §24.2.2:**
> "Totalentreprenøren har en frist til å gjennomgå materialet. Er ikke annet avtalt, skal fristen være fem uker regnet fra kontraktsinngåelsen. Dersom totalentreprenøren først får materialet på et senere tidspunkt, utsettes fristen tilsvarende.
>
> Dersom totalentreprenøren mener at det byggherren har gitt anvisning på ikke vil lede til oppfyllelse av de krav til kontraktsgjenstanden som følger av punkt 14, må han varsle byggherren innen fristens utløp. Varselet skal presisere hvilke forhold det dreier seg om og begrunne behovet for endringer. Varsler totalentreprenøren innen fristen, overtar han ikke risikoen for denne delen av byggherrens materiale."

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §24.2.2 annet ledd |
| **TRIGGER** | TE mener BHs anvisning ikke vil oppfylle krav i §14 | §24.2.2 annet ledd |
| **SKJÆRINGSTIDSPUNKT** | Kontraktsinngåelse (eller mottak av materiale) | §24.2.2 første ledd |
| **FRIST** | **5 uker** (kan avtales annerledes) | §24.2.2 første ledd |
| **KONSEKVENS** | TE overtar risikoen for denne delen av BHs materiale | §24.2.2 annet ledd |

```
VIKTIG PRESISERING:
┌────────────────────────────────────────────────────────────────────────────┐
│ Dette gjelder kun ved AVTALT RISIKOOVERGANG (§24.2).                       │
│                                                                            │
│ Varselet skal:                                                             │
│ - Presisere hvilke forhold det dreier seg om                              │
│ - Begrunne behovet for endringer                                          │
│                                                                            │
│ Hvis TE varsler i tide: TE overtar IKKE risikoen for den delen.           │
│ Hvis TE IKKE varsler: TE overtar risikoen som om han prosjekterte selv.   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

#### 2.1.1 Irregulær endring (§32.2) ✓

> **Kontraktstekst §32.1 (definisjon av pålegg):**
> "Mottar totalentreprenøren pålegg uten at dette skjer i form av en endringsordre, skal han iverksette dette selv om han mener at pålegget innebærer en endring, dersom
> a) det er gitt av en person som har fullmakt til å gi endringsordre etter 31.3 første ledd, eller
> b) det er gitt av en person som har fullmakt til å kontrollere totalentreprenørens utførelse og pålegget er gitt under gjennomføring av personens ordinære oppgaver i prosjektet, eller
> c) det fremgår av arbeidstegninger, arbeidsbeskrivelser eller lignende utarbeidet av byggherren."

> **Kontraktstekst §32.2:**
> "Mottar totalentreprenøren pålegg som angitt i 32.1, skal han uten ugrunnet opphold varsle byggherren dersom han vil påberope seg dette som en endring. Gjør han ikke det, taper han retten til å påberope seg at pålegget innebærer en endring.
>
> Bestemmelsen i første ledd gjelder også hvis totalentreprenøren mottar pålegg fra offentlig myndighet om en ytelse som innebærer en endring."

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §32.2 første ledd |
| **TRIGGER** | Mottar pålegg som angitt i §32.1 (a, b eller c) ELLER pålegg fra offentlig myndighet | §32.2 første og annet ledd |
| **SKJÆRINGSTIDSPUNKT** | Mottak av pålegget | §32.2 første ledd (implisitt) |
| **FRIST** | Uten ugrunnet opphold | §32.2 første ledd |
| **KONSEKVENS** | Taper retten til å påberope at pålegget innebærer endring | §32.2 første ledd |

```
HVA ER ET "PÅLEGG" (§32.1)?
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│ a) Pålegg fra person med fullmakt til å gi endringsordre (§31.3)          │
│                                                                            │
│ b) Pålegg fra person med kontroll-/påleggsfullmakt, gitt under            │
│    ordinære oppgaver i prosjektet                                          │
│                                                                            │
│ c) Arbeidstegninger, arbeidsbeskrivelser eller lignende fra BH            │
│                                                                            │
│ + Pålegg fra OFFENTLIG MYNDIGHET (§32.2 annet ledd)                       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

```
VIKTIG PRESISERING:
┌────────────────────────────────────────────────────────────────────────────┐
│ Konsekvensen er TAP AV RETT til å påberope endring, IKKE tap av           │
│ vederlagskravet. Vederlagskravet (§34.1.1) består uavhengig av §32.2.     │
│ Men uten godkjent grunnlag er det vanskelig å få medhold i kravet.        │
└────────────────────────────────────────────────────────────────────────────┘
```

---

#### 2.1.2 Svikt i BHs ytelser (§25.1.2) ✓

> **Kontraktstekst §25.1.1 (undersøkelsesplikten - definerer "forhold"):**
> "Totalentreprenøren skal som en del av sin produksjonsplanlegging undersøke byggherrens ytelser og andre forhold byggherren har risikoen for.
>
> Undersøkelsen har som mål å avdekke forhold som vil kunne forstyrre totalentreprenørens gjennomføring av arbeidet under kontrakten, og skal særlig legge vekt på:
> a) om løsninger eller annen prosjektering byggherren har risikoen for er ufullstendige, inneholder uoverensstemmelser eller andre svakheter,
> b) om det er nødvendig med grunnundersøkelser, eller om de foretatte undersøkelser er utilstrekkelige,
> c) om det er feil ved materialer eller andre ytelser byggherren har levert, og
> d) om det fysiske arbeidsgrunnlaget eller forhold ved grunnen er slik totalentreprenøren kunne forvente etter kontrakten."

> **Kontraktstekst §25.1.2:**
> "Totalentreprenøren skal varsle byggherren uten ugrunnet opphold etter at han blir eller burde ha blitt oppmerksom på at det forelå forhold som nevnt i 25.1.1.
>
> Varsler han ikke innen fristen, kan byggherren kreve erstatning for tap som kunne vært unngått ved rettidig varsel.
>
> **Dersom totalentreprenøren vil kreve fristforlengelse eller vederlagsjustering som følge av forhold nevnt i 25.1.1, skal kravet varsles og behandles etter bestemmelsene i punkt 33 og 34.**"

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §25.1.2 første ledd |
| **TRIGGER** | Oppdager forhold nevnt i §25.1.1 (a, b, c eller d) | §25.1.2 første ledd |
| **SKJÆRINGSTIDSPUNKT** | "blir eller burde ha blitt oppmerksom på" | §25.1.2 første ledd |
| **FRIST** | Uten ugrunnet opphold | §25.1.2 første ledd |
| **KONSEKVENS** | BH kan kreve erstatning for tap som kunne vært unngått | §25.1.2 annet ledd |

```
VIKTIG: DOBBEL VARSLING ER BEKREFTET
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│ §25.1.2 tredje ledd bekrefter at TE må varsle SEPARAT for:                │
│                                                                            │
│ 1. GRUNNLAG (§25.1.2)                                                      │
│    Konsekvens: BH kan kreve ERSTATNING                                    │
│                                                                            │
│ 2. FRIST (§33) og VEDERLAG (§34)                                          │
│    Konsekvens: PREKLUSJON (kravet tapes)                                  │
│                                                                            │
│ Dette er TO SEPARATE VARSLINGSPLIKTER med ULIKE KONSEKVENSER.             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

```
HVA ER "FORHOLD" (§25.1.1)?
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│ a) Ufullstendigheter, uoverensstemmelser eller svakheter i                │
│    løsninger/prosjektering BH har risikoen for                            │
│                                                                            │
│ b) Behov for grunnundersøkelser / utilstrekkelige undersøkelser           │
│                                                                            │
│ c) Feil ved materialer eller andre ytelser fra BH                         │
│                                                                            │
│ d) Fysisk arbeidsgrunnlag eller grunnforhold avviker fra forventning      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

#### 2.1.3 Uegnet prosjektering (§25.2) ✓

> **Kontraktstekst §25.2:**
> "Totalentreprenøren skal i rimelig utstrekning vurdere om løsninger og annen prosjektering foreskrevet av byggherren er egnede til å nå de krav til kontraktsgjenstanden som fremgår av punkt 14. Dette gjelder uavhengig av om disse fremgår av kontraktsdokumentene eller foreskrives senere.
>
> Totalentreprenøren skal varsle byggherren uten ugrunnet opphold etter at han blir eller **måtte ha blitt** klar over at løsninger eller annen prosjektering foreskrevet av byggherren ikke er egnede til å nå de krav til kontraktsgjenstanden som fremgår av punkt 14. Varsler han ikke innen fristen, kan byggherren kreve erstatning for tap som kunne vært unngått ved rettidig varsel."

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §25.2 annet ledd |
| **TRIGGER** | BHs løsninger/prosjektering er uegnet til å oppfylle krav i §14 | §25.2 annet ledd |
| **SKJÆRINGSTIDSPUNKT** | "blir eller **måtte ha blitt** klar over" | §25.2 annet ledd |
| **FRIST** | Uten ugrunnet opphold | §25.2 annet ledd |
| **KONSEKVENS** | BH kan kreve erstatning for tap som kunne vært unngått | §25.2 annet ledd |

```
STRENGERE AKTSOMHETSNORM
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│ §25.1.2: "blir eller BURDE ha blitt oppmerksom på"                        │
│          = Normal aktsomhet                                                │
│                                                                            │
│ §25.2:   "blir eller MÅTTE ha blitt klar over"                            │
│          = Grov uaktsomhet å ikke vite (strengere)                        │
│                                                                            │
│ Forskjellen: §25.2 gjelder når løsningen er ÅPENBART uegnet.              │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Vederlagssporet

#### 2.2.1 Vederlag ved endring (§34.1.1)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE (og BH) | §34.1.1 |
| **TRIGGER** | Det foreligger en endring | §34.1.1 |
| **SKJÆRINGSTIDSPUNKT** | N/A | N/A |
| **FRIST** | **INGEN FRIST** | §34.1.1 (ingen varslingskrav) |
| **KONSEKVENS** | **INGEN PREKLUSJON** | §34.1.1 |

```
KRITISK ASYMMETRI:
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  §34.1.1 (ENDRING):     "Partene har krav på justering av vederlaget      │
│                          dersom det foreligger en endring"                 │
│                                                                            │
│  §34.1.2 (SVIKT/ANDRE): "Krav på vederlagsjustering tapes dersom det      │
│                          ikke varsles uten ugrunnet opphold"               │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Ved ENDRING: Vederlagskravet består uansett når det fremsettes.     │  │
│  │ Ved SVIKT/ANDRE: Vederlagskravet TAPES ved sen varsling.            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

#### 2.2.2 Vederlag ved svikt/andre (§34.1.2)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §34.1.2 |
| **TRIGGER** | Forhold som gir grunnlag for vederlagsjustering (SVIKT/ANDRE) | §34.1.2 |
| **SKJÆRINGSTIDSPUNKT** | "blir eller burde ha blitt klar over grunnlaget for kravet" | §34.1.2 |
| **FRIST** | Uten ugrunnet opphold | §34.1.2 |
| **KONSEKVENS** | Kravet **TAPES** | §34.1.2 |

---

#### 2.2.3 Særskilte krav - Rigg/drift (§34.1.3)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §34.1.3 |
| **TRIGGER** | TE vil kreve dekning for rigg, drift, nedrigging | §34.1.3 første ledd |
| **SKJÆRINGSTIDSPUNKT** | "blir eller burde ha blitt klar over at slike utgifter ville påløpe" | §34.1.3 første ledd |
| **FRIST** | Uten ugrunnet opphold | §34.1.3 første ledd |
| **KONSEKVENS** | Retten til **PÅLØPTE** utgifter tapes | §34.1.3 annet ledd |

```
VIKTIG PRESISERING:
┌────────────────────────────────────────────────────────────────────────────┐
│ Gjelder ALLE hovedkategorier (inkl. ENDRING).                              │
│                                                                            │
│ "ville påløpe" = fremtidsrettet. Fristen løper fra TE forstår at          │
│ utgiften VIL komme, ikke fra utgiften faktisk påløper.                    │
│                                                                            │
│ Kun utgifter påløpt FØR varsling tapes. Utgifter ETTER varsling kan       │
│ fortsatt kreves.                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

---

#### 2.2.4 Særskilte krav - Produktivitetstap (§34.1.3)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §34.1.3 |
| **TRIGGER** | TE vil kreve dekning for nedsatt produktivitet, forstyrrelser på annet arbeid | §34.1.3 første ledd |
| **SKJÆRINGSTIDSPUNKT** | "blir eller burde ha blitt klar over at slike utgifter ville påløpe" | §34.1.3 første ledd |
| **FRIST** | Uten ugrunnet opphold | §34.1.3 første ledd |
| **KONSEKVENS** | Retten til **PÅLØPTE** utgifter tapes | §34.1.3 annet ledd |

---

#### 2.2.5 Enhetsprisjustering (§34.3.3)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §34.3.3 første ledd |
| **TRIGGER** | Forhold som gir grunnlag for justering av enhetspris | §34.3.3 |
| **SKJÆRINGSTIDSPUNKT** | "blir eller burde ha blitt klar over grunnlaget" | §34.3.3 |
| **FRIST** | Uten ugrunnet opphold | §34.3.3 første ledd |
| **KONSEKVENS** | **REDUKSJON** - kun krav på justering BH "måtte forstå" | §34.3.3 første ledd |

---

### 2.3 Fristsporet

#### 2.3.1 Nøytralt fristvarsel (§33.4)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §33.4 |
| **TRIGGER** | Det oppstår forhold som vil gi rett til fristforlengelse | §33.4 første ledd |
| **SKJÆRINGSTIDSPUNKT** | Forholdet oppstår / TE blir klar over det | §33.4 (implisitt) |
| **FRIST** | Uten ugrunnet opphold | §33.4 første ledd |
| **KONSEKVENS** | Kravet **TAPES** | §33.4 annet ledd |

**Uavklart:** Eksakt skjæringstidspunkt. "Forholdet oppstår" vs "TE blir klar over". Se seksjon 6.

---

#### 2.3.2 Spesifisert fristkrav (§33.6.1)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §33.6.1 |
| **TRIGGER** | TE har grunnlag for å beregne omfanget av kravet | §33.6.1 første ledd |
| **SKJÆRINGSTIDSPUNKT** | "har grunnlag for å beregne" | §33.6.1 første ledd |
| **FRIST** | Uten ugrunnet opphold | §33.6.1 første ledd |
| **KONSEKVENS** | **REDUKSJON** - kun krav på det BH "måtte forstå" | §33.6.1 annet ledd |

```
VIKTIG PRESISERING:
┌────────────────────────────────────────────────────────────────────────────┐
│ Forutsetter at nøytralt varsel (§33.4) ble sendt i tide.                   │
│ Hvis ikke: §33.4 preklusjon (kravet tapes helt).                          │
│                                                                            │
│ §33.6.1 gir altså REDUKSJON, ikke preklusjon - en mildere konsekvens.     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

#### 2.3.3 Svar på etterlysning (§33.6.2)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §33.6.2 annet ledd |
| **TRIGGER** | Mottar brev fra BH med etterlysning av spesifisert krav | §33.6.2 første ledd |
| **SKJÆRINGSTIDSPUNKT** | Mottak av etterlysning | §33.6.2 annet ledd |
| **FRIST** | Uten ugrunnet opphold | §33.6.2 annet ledd |
| **KONSEKVENS** | Kravet **TAPES** | §33.6.2 tredje ledd |

```
VIKTIG PRESISERING:
┌────────────────────────────────────────────────────────────────────────────┐
│ TE må svare med ENTEN:                                                     │
│ a) Spesifisert krav (antall dager), ELLER                                 │
│ b) Begrunnelse for hvorfor grunnlag for beregning ikke foreligger         │
│                                                                            │
│ Ved (b): §33.6.1 gjelder videre (§33.6.2 femte ledd)                      │
│                                                                            │
│ HELBREDELSE: Hvis TE svarer med spesifisert krav, kan BH IKKE påberope   │
│ at §33.6.1 er oversittet (§33.6.2 fjerde ledd).                           │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.4 Regningsarbeid

#### 2.4.1 Varsel før regningsarbeid (§34.4)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §34.4 |
| **TRIGGER** | Før regningsarbeid igangsettes | §34.4 |
| **SKJÆRINGSTIDSPUNKT** | Før arbeidet starter | §34.4 |
| **FRIST** | Før oppstart | §34.4 |
| **KONSEKVENS** | Skjerpet bevisbyrde for at arbeidet var nødvendig | §34.4 (implisitt) |

---

#### 2.4.2 Innsending av oppgaver (§30.3.1)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §30.3.1 |
| **TRIGGER** | Løpende under regningsarbeid | §30.3.1 |
| **SKJÆRINGSTIDSPUNKT** | Ukentlig (evt. månedlig hvis avtalt) | §30.3.1 |
| **FRIST** | 7 dager (eller som avtalt) | §30.3.1 |
| **KONSEKVENS** | **REDUKSJON** - kun krav på det BH "måtte forstå" + påslag | §30.3.1 |

---

### 2.5 Andre varslingsplikter

#### 2.5.1 Vesentlig økning av kostnadsoverslag (§30.2)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §30.2 |
| **TRIGGER** | TE ser at kostnadsoverslaget vil overskrides vesentlig | §30.2 |
| **SKJÆRINGSTIDSPUNKT** | Når TE forstår overskridelsen | §30.2 |
| **FRIST** | Uten ugrunnet opphold | §30.2 |
| **KONSEKVENS** | BH kan instruere stans / reduksjon | §30.2 (ikke preklusjon) |

---

#### 2.5.2 Nektelse av tiltransport (§12.1.2)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §12.1.2 annet ledd |
| **TRIGGER** | Mottar melding om tiltransport av sideentreprenør | §12.1.2 |
| **SKJÆRINGSTIDSPUNKT** | Mottak av melding | §12.1.2 annet ledd |
| **FRIST** | 14 dager | §12.1.2 annet ledd |
| **KONSEKVENS** | Tiltransporten anses iverksatt (passiv aksept) | §12.1.2 annet ledd |

---

## 3. BHs svarplikter

### 3.0 Svar på risikoovergang-varsel (§24.2.2) ✓

> **Kontraktstekst §24.2.2 tredje ledd:**
> "Når byggherren mottar et varsel i samsvar med annet ledd, må han uten ugrunnet opphold besvare varselet og gi beskjed om hvordan totalentreprenøren skal forholde seg. Fastholder byggherren sin opprinnelige løsning eller prosjektering, bærer byggherren risikoen for sitt valg. Det samme gjelder dersom han pålegger en ny løsning eller prosjektering som ikke er i samsvar med eventuelt forslag fra totalentreprenøren."

> **Kontraktstekst §24.2.2 fjerde ledd:**
> "Innebærer byggherrens svar en endring, skal han utstede endringsordre etter 31.3. Dersom totalentreprenøren mener at byggherrens svar innebærer en endring uten at det er utstedt en endringsordre, skal han varsle etter 32.2."

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | BH | §24.2.2 tredje ledd |
| **TRIGGER** | Mottar varsel om at BHs anvisning ikke oppfyller §14 | §24.2.2 tredje ledd |
| **SKJÆRINGSTIDSPUNKT** | Mottak av varsel | §24.2.2 tredje ledd |
| **FRIST** | Uten ugrunnet opphold | §24.2.2 tredje ledd |
| **KONSEKVENS** | **IKKE EKSPLISITT ANGITT** - men BH bærer risiko ved fastholdelse | §24.2.2 tredje ledd |

```
BHs SVARALTERNATIVER (§24.2.2):
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│ 1. Fastholder opprinnelig løsning                                          │
│    → BH bærer risikoen for sitt valg                                      │
│                                                                            │
│ 2. Pålegger ny løsning (ikke iht. TEs forslag)                            │
│    → BH bærer risikoen                                                    │
│                                                                            │
│ 3. Følger TEs forslag                                                      │
│    → BH utsteder endringsordre (§31.3)                                    │
│                                                                            │
│ Hvis BH ikke svarer i tide: Uklar konsekvens (se §5)                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.1 Svar på irregulær endring (§32.3) ✓

> **Kontraktstekst §32.3:**
> "Når byggherren mottar varsel i henhold til 32.2, skal han besvare det ved enten å
> a) utstede endringsordre i henhold til 31.3, eller
> b) avslå totalentreprenørens krav på endringsordre, eller
> c) frafalle pålegget mot å utstede endringsordre for allerede utført arbeid.
>
> **Dersom byggherren ikke uten ugrunnet opphold svarer i henhold til første ledd, anses pålegget å innebære en endring.**
>
> Byggherren skal uten ugrunnet opphold etter at han har avslått kravet begrunne sitt avslag.
>
> Ved uenighet mellom partene gjelder bestemmelsene i punkt 35."

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | BH | §32.3 første ledd |
| **TRIGGER** | Mottar varsel etter §32.2 (irregulær endring) | §32.3 første ledd |
| **SKJÆRINGSTIDSPUNKT** | Mottak av varsel | §32.3 første ledd (implisitt) |
| **FRIST** | Uten ugrunnet opphold | §32.3 annet ledd |
| **KONSEKVENS** | Pålegget **ANSES Å INNEBÆRE EN ENDRING** | §32.3 annet ledd |

```
BHs SVARALTERNATIVER (§32.3):
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│ a) Utstede endringsordre (§31.3)                                           │
│                                                                            │
│ b) Avslå TEs krav på endringsordre                                         │
│    → Skal begrunne avslaget "uten ugrunnet opphold"                       │
│    → Ved uenighet: §35 (utførelsesplikt, oppmann, søksmål)                │
│                                                                            │
│ c) Frafalle pålegget mot EO for allerede utført arbeid                     │
│                                                                            │
│ PASSIVITET: Pålegget ANSES SOM ENDRING (sterk virkning!)                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Svar på svikt-varsel (§25.3) ✓

> **Kontraktstekst §25.3:**
> "Når byggherren mottar et varsel etter 25.1.2 eller 25.2, skal han uten ugrunnet opphold besvare varselet og gi beskjed om hvordan totalentreprenøren skal forholde seg. Er det nødvendig med tiltak som innebærer en endring, skal byggherren utstede en endringsordre i samsvar med 31.3."

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | BH | §25.3 |
| **TRIGGER** | Mottar varsel etter §25.1.2 eller §25.2 | §25.3 |
| **SKJÆRINGSTIDSPUNKT** | Mottak av varsel | §25.3 (implisitt) |
| **FRIST** | Uten ugrunnet opphold | §25.3 |
| **KONSEKVENS** | **IKKE EKSPLISITT ANGITT** | §25.3 |

```
UAVKLART KONSEKVENS - SAMMENLIGNING:
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│ §32.3 (irregulær endring):                                                 │
│ "Dersom byggherren ikke uten ugrunnet opphold svarer [...],               │
│  anses pålegget å innebære en endring."                                   │
│ → EKSPLISITT passivitetsvirkning                                          │
│                                                                            │
│ §25.3 (svikt-varsel):                                                      │
│ "...skal han uten ugrunnet opphold besvare varselet..."                   │
│ → INGEN eksplisitt konsekvens ved passivitet                              │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ MULIGE TOLKNINGER:                                                         │
│ 1. Analogt §32.3: Forholdet anses akseptert?                              │
│ 2. TE må varsle BHs passivitet via §5?                                    │
│ 3. BH erstatningsansvarlig for TEs tap pga. manglende instruksjon?        │
│ 4. Kun oppfordring - ingen juridisk konsekvens?                           │
│                                                                            │
│ ANBEFALING: Applikasjonen noterer passivitet, tar ikke stilling.          │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Svar på fristkrav (§33.7)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | BH | §33.7 |
| **TRIGGER** | Mottar begrunnet krav med angivelse av antall dager (§33.6.1/§33.6.2) | §33.7 |
| **SKJÆRINGSTIDSPUNKT** | Mottak av spesifisert krav | §33.7 |
| **FRIST** | Uten ugrunnet opphold | §33.7 |
| **KONSEKVENS** | Innsigelser **TAPES** | §33.7 |

---

### 3.4 Svar på EP-justeringskrav (§34.3.3)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | BH | §34.3.3 annet ledd |
| **TRIGGER** | Mottar krav om justering av enhetspris | §34.3.3 annet ledd |
| **SKJÆRINGSTIDSPUNKT** | Mottak av krav | §34.3.3 annet ledd |
| **FRIST** | Uten ugrunnet opphold | §34.3.3 annet ledd |
| **KONSEKVENS** | Innsigelser **TAPES** | §34.3.3 annet ledd |

---

### 3.5 Kontroll av regningsoppgaver (§30.3.2)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | BH | §30.3.2 |
| **TRIGGER** | Mottar oppgaver over timer/materialer | §30.3.2 |
| **SKJÆRINGSTIDSPUNKT** | Mottak av oppgaver | §30.3.2 |
| **FRIST** | 14 dager | §30.3.2 |
| **KONSEKVENS** | Oppgavene legges til grunn (passiv aksept) | §30.3.2 |

---

### 3.6 Nektelse av kontraktsmedhjelper (§10.2)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | BH | §10.2 annet ledd |
| **TRIGGER** | Mottar underretning om valg av kontraktsmedhjelper | §10.2 |
| **SKJÆRINGSTIDSPUNKT** | Mottak av underretning | §10.2 annet ledd |
| **FRIST** | 14 dager | §10.2 annet ledd |
| **KONSEKVENS** | Valget anses godkjent (passiv aksept) | §10.2 annet ledd |

---

## 4. BHs egne varslingsplikter

### 4.1 Fristforlengelse for BH (§33.2)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | BH | §33.2 |
| **TRIGGER** | Forhold som gir BH rett til fristforlengelse | §33.2 jf. §33.4 |
| **SKJÆRINGSTIDSPUNKT** | Som §33.4 | §33.2 |
| **FRIST** | Uten ugrunnet opphold | §33.2 jf. §33.4 |
| **KONSEKVENS** | Som §33.4-§33.7 | §33.2 |

**Merk:** §33.2 henviser til §33.4-§33.7 og gir tilsvarende regler for BH.

---

### 4.2 Endringsordre (§31.3)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | BH | §31.3 |
| **TRIGGER** | BH ønsker å gi pålegg om endring | §31.3 |
| **SKJÆRINGSTIDSPUNKT** | N/A (initiativ fra BH) | N/A |
| **FRIST** | N/A | N/A |
| **KONSEKVENS** | N/A (BH velger selv når) | N/A |

**Merk:** Endringsordre er BHs initiativ, ikke en svarplikt.

---

## 5. §5-mekanismen ✓

### 5.1 Kontraktstekst (§5 Varsler og krav)

> **§5 første ledd:**
> "Alle varsler og krav og svar på disse, som skal meddeles etter bestemmelsene i kontrakten, skal fremsettes skriftlig til partenes representanter, jf. punkt 9, eller til avtalte adresser. Varsel og krav gitt ved e-post til avtalt adresse regnes som skriftlig dersom ikke annet er avtalt."

> **§5 annet ledd:**
> "Varsel og krav som er innført i referat ført etter 4.2, regnes som skriftlig."

> **§5 tredje ledd:**
> "Hvis en part ønsker å gjøre gjeldende at den andre parten har varslet eller svart for sent, må han gjøre det skriftlig uten ugrunnet opphold etter å ha mottatt varsel eller svar. Gjør han ikke det, skal varselet eller svaret anses for å være gitt i tide. **Dette gjelder ikke for krav, og for forespørsler etter 40.4, som fremsettes for første gang i eller i forbindelse med sluttoppgjøret.**"

### 5.2 Fem dimensjoner for §5

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | Begge parter ("en part") | §5 tredje ledd |
| **TRIGGER** | Mottar varsel/svar som parten mener kom for sent | §5 tredje ledd |
| **SKJÆRINGSTIDSPUNKT** | Mottak av varselet/svaret | §5 tredje ledd |
| **FRIST** | Uten ugrunnet opphold | §5 tredje ledd |
| **KONSEKVENS** | Varselet/svaret **ANSES GITT I TIDE** (helbredelse) | §5 tredje ledd |

### 5.3 VIKTIG UNNTAK: Sluttoppgjør

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    §5 GJELDER IKKE FOR SLUTTOPPGJØR                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  §5 tredje ledd siste setning:                                             │
│  "Dette gjelder ikke for krav, og for forespørsler etter 40.4, som         │
│   fremsettes for første gang i eller i forbindelse med sluttoppgjøret."    │
│                                                                             │
│  BETYDNING:                                                                │
│  Ved sluttoppgjør kan en part påberope sen varsling UTEN å ha gjort det    │
│  "uten ugrunnet opphold" etter mottak. Helbredelsesmekanismen gjelder      │
│  ikke her.                                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Skriftlighetskravet

| Metode | Gyldig? | Kilde |
|--------|---------|-------|
| Brev til representant (§9) | ✓ Ja | §5 første ledd |
| E-post til avtalt adresse | ✓ Ja (med mindre annet avtalt) | §5 første ledd |
| Innført i referat (§4.2) | ✓ Ja | §5 annet ledd |
| Muntlig | ✗ Nei | §5 første ledd |

### 5.5 §5-mekanismens rolle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    §5 - ABSOLUTT FORUTSETNING                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   INGEN konsekvens av sen varsling inntrer AUTOMATISK.                      │
│                                                                             │
│   For at preklusjon, reduksjon eller andre konsekvenser skal inntre,        │
│   MÅ motparten:                                                             │
│                                                                             │
│   1. Påberope sen varsling SKRIFTLIG                                        │
│   2. Gjøre det UTEN UGRUNNET OPPHOLD etter mottak                           │
│                                                                             │
│   Hvis ikke: Varselet/svaret ANSES GITT I TIDE (helbredelse)                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Toveis anvendelse

| Situasjon | Part som påberoper §5 | Konsekvens ved passivitet |
|-----------|----------------------|---------------------------|
| TE varsler for sent | BH må påberope §5 | Varselet anses i tide - konsekvens inntrer IKKE |
| BH svarer for sent | TE må påberope §5 | Svaret anses i tide - konsekvens inntrer IKKE |

---

## 6. Uavklarte spørsmål

### 6.1 Skjæringstidspunkt for §33.4

**Problem:** Kontraktsteksten sier "uten ugrunnet opphold" uten å spesifisere eksakt skjæringstidspunkt.

| Tolkning | Innhold | Strenghet |
|----------|---------|-----------|
| A | Forholdet oppstår (objektiv) | Streng |
| B | TE blir klar over forholdet (subjektiv) | Mild |
| C | TE burde blitt klar over forholdet (aktsomhet) | Moderat |

**Status:** Uavklart - påvirker beregning av preklusjon.

---

### 6.2 Dobbel varsling ved SVIKT/ANDRE

**Problem:** Er §25.1.2 (grunnlag) og §34.1.2 (vederlag) to separate varsler?

| Spørsmål | Usikkerhet |
|----------|------------|
| Kan ett varsel dekke begge formål? | Uklart |
| Løper fristene parallelt eller sekvensielt? | Uklart |
| Har de samme skjæringstidspunkt? | Sannsynligvis ja |

**Status:** Uavklart - viktig for implementering.

---

### 6.3 §25.3 - Konsekvens ved passivitet

**Problem:** Ingen eksplisitt konsekvens angitt.

| Mulig tolkning | Konsekvens |
|----------------|------------|
| Analogt §32.3 | Forholdet anses akseptert |
| Erstatning | BH ansvarlig for TEs tap |
| Ingen | Bare oppfordring |

**Status:** Uavklart - applikasjonen noterer men tar ikke stilling.

---

### 6.4 §33.6.2 fjerde ledd vs §5

**Problem:** Er §33.6.2 fjerde ledd en egen helbredelsesmekanisme?

> "Byggherren kan da ikke påberope at fristen i 33.6.1 er oversittet."

**Status:** Uavklart - terminologi i dokumentasjon bør verifiseres.

---

## 7. Implikasjoner for datamodell

### 7.1 Nødvendige felt per varslingsregel

```typescript
interface VarslingsEvent {
  // Identifikasjon
  event_id: string;
  sak_id: string;
  event_type: EventType;

  // Fem dimensjoner
  aktor_rolle: 'TE' | 'BH';           // HVEM
  trigger_beskrivelse: string;         // HVA utløste
  dato_trigger: string;                // NÅR trigger (skjæringstidspunkt)
  dato_varslet: string;                // NÅR faktisk varslet
  hjemmel: string;                     // Paragraf-referanse

  // §5-mekanismen
  motpart_har_paberopt_5?: boolean;    // Motpart har påberopt sen varsling
  dato_5_paberopt?: string;            // Når §5 ble påberopt

  // Beregnet
  dager_til_varsling?: number;         // dato_varslet - dato_trigger
  preklusjons_status?: 'ok' | 'varsel' | 'kritisk';
}
```

### 7.2 Nødvendige felt for respons

```typescript
interface ResponsEvent extends VarslingsEvent {
  // Respons på varsel
  refererer_til_event_id: string;      // Hvilket varsel dette svarer på

  // §5-innsigelse
  paberoper_sen_varsling: boolean;     // BH/TE påberoper §5
  hjemmel_for_innsigelse?: string;     // §32.2, §34.1.2, §33.4, etc.

  // Subsidiært standpunkt
  subsidiaer_vurdering?: {
    resultat: 'godkjent' | 'delvis_godkjent' | 'avslatt';
    begrunnelse: string;
  };
}
```

### 7.3 State-beregning må spore

| Felt | Formål |
|------|--------|
| `har_paberopt_5_grunnlag` | BH har påberopt §5 for grunnlagsvarsel |
| `har_paberopt_5_vederlag` | BH har påberopt §5 for vederlagsvarsel |
| `har_paberopt_5_frist` | BH har påberopt §5 for fristvarsel |
| `er_helbredet_5` | Motpart påberopte ikke §5 i tide |

---

## Vedlegg: Komplett matrise

### TEs varslingsplikter

| # | Hjemmel | Spor | Trigger | Skjæringstidspunkt | Frist | Konsekvens |
|---|---------|------|---------|-------------------|-------|------------|
| 1 | §32.2 | Grunnlag | Mottar pålegg (§32.1) | Mottak | UUO | Tap av rett |
| 2 | §25.1.2 | Grunnlag | Oppdager svikt | Blir/burde oppmerksom | UUO | Erstatning |
| 3 | §25.2 | Grunnlag | Uegnet prosjektering | Blir/måtte klar over | UUO | Erstatning |
| 4 | §34.1.2 | Vederlag | Svikt/andre forhold | Blir/burde klar over | UUO | Preklusjon |
| 5 | §34.1.3 | Vederlag | Rigg/drift | Blir/burde klar over (vil påløpe) | UUO | Preklusjon (påløpte) |
| 6 | §34.1.3 | Vederlag | Produktivitet | Blir/burde klar over (vil påløpe) | UUO | Preklusjon (påløpte) |
| 7 | §34.3.3 | Vederlag | EP-justering | Blir/burde klar over | UUO | Reduksjon |
| 8 | §33.4 | Frist | Forhold oppstår | Forholdet oppstår | UUO | Preklusjon |
| 9 | §33.6.1 | Frist | Grunnlag for beregning | Har grunnlag | UUO | Reduksjon |
| 10 | §33.6.2 | Frist | Mottar etterlysning | Mottak | UUO | Preklusjon |
| 11 | §30.3.1 | Regning | Løpende | Ukentlig | 7 dager | Reduksjon |

### BHs svarplikter

| # | Hjemmel | Spor | Trigger | Skjæringstidspunkt | Frist | Konsekvens |
|---|---------|------|---------|-------------------|-------|------------|
| 1 | §32.3 | Grunnlag | Varsel §32.2 | Mottak | UUO | Passivitet (anses endring) |
| 2 | §25.3 | Grunnlag | Varsel §25.1.2/§25.2 | Mottak | UUO | **Uavklart** |
| 3 | §33.7 | Frist | Spesifisert krav | Mottak | UUO | Preklusjon innsigelser |
| 4 | §34.3.3 | Vederlag | EP-justeringskrav | Mottak | UUO | Preklusjon innsigelser |
| 5 | §30.3.2 | Regning | Oppgaver | Mottak | 14 dager | Passivitet (aksept) |
| 6 | §10.2 | Aktører | Valg av medhjelper | Mottak | 14 dager | Passivitet (aksept) |

*UUO = Uten ugrunnet opphold*

---

> **Dokumenthistorikk:**
> - 2026-01-24: Opprettet med systematisk kartlegging av alle varslingsregler
