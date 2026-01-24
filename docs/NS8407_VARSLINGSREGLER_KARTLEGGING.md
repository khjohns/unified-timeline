# NS 8407 Varslingsregler - Systematisk Kartlegging

**Komplett kartlegging av alle varslingsplikter med 5 dimensjoner**

*Opprettet: 2026-01-24*
*Status: Under arbeid*

> **Formål:** Dette dokumentet kartlegger systematisk alle varslingsplikter i NS 8407 med fokus på de fem dimensjonene som må være klare for hver regel. Dokumentet identifiserer også uavklarte spørsmål og hull som må adresseres før implementering.

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

#### 2.1.1 Irregulær endring (§32.2)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §32.2 første ledd |
| **TRIGGER** | Mottar pålegg som angitt i §32.1 (instruks som endrer omfang, utførelse, fremdrift) | §32.2 jf. §32.1 |
| **SKJÆRINGSTIDSPUNKT** | Mottak av pålegget | Objektiv - mottak |
| **FRIST** | Uten ugrunnet opphold | §32.2 første ledd |
| **KONSEKVENS** | Taper retten til å påberope at pålegget innebærer endring | §32.2 annet ledd |

```
VIKTIG PRESISERING:
┌────────────────────────────────────────────────────────────────────────────┐
│ Konsekvensen er TAP AV RETT til å påberope endring, IKKE tap av           │
│ vederlagskravet. Vederlagskravet (§34.1.1) består uavhengig av §32.2.     │
│ Men uten godkjent grunnlag er det vanskelig å få medhold i kravet.        │
└────────────────────────────────────────────────────────────────────────────┘
```

**Uavklart:** Hva omfattes av "pålegg"? Se §32.1 for definisjon.

---

#### 2.1.2 Svikt i BHs ytelser (§25.1.2)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §25.1.2 |
| **TRIGGER** | Oppdager forhold nevnt i §25.1.1 (ufullstendigheter, feil, uforutsette grunnforhold, etc.) | §25.1.2 første ledd |
| **SKJÆRINGSTIDSPUNKT** | "blir eller burde ha blitt oppmerksom på forholdet" | §25.1.2 første ledd |
| **FRIST** | Uten ugrunnet opphold | §25.1.2 første ledd |
| **KONSEKVENS** | BH kan kreve erstatning for tap som kunne vært unngått | §25.1.2 annet ledd |

```
VIKTIG PRESISERING:
┌────────────────────────────────────────────────────────────────────────────┐
│ Konsekvensen er ERSTATNING, ikke preklusjon. TE mister ikke kravet,       │
│ men BH kan ha motkrav. BH må dokumentere faktisk tap og årsakssammenheng. │
│                                                                            │
│ I tillegg må TE varsle etter §34.1.2 for vederlag (der kravet TAPES).     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

#### 2.1.3 Uegnet prosjektering (§25.2)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | TE | §25.2 |
| **TRIGGER** | TE mener BHs løsninger ikke er egnet til å oppfylle krav i §14 | §25.2 første ledd |
| **SKJÆRINGSTIDSPUNKT** | "blir eller måtte ha blitt klar over" | §25.2 første ledd |
| **FRIST** | Uten ugrunnet opphold | §25.2 første ledd |
| **KONSEKVENS** | BH kan kreve erstatning for tap som kunne vært unngått | §25.2 annet ledd |

**Merk:** "måtte ha blitt" er strengere enn "burde ha blitt" - grovt uaktsomt å ikke vite.

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

### 3.1 Svar på irregulær endring (§32.3)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | BH | §32.3 første ledd |
| **TRIGGER** | Mottar varsel etter §32.2 (irregulær endring) | §32.3 første ledd |
| **SKJÆRINGSTIDSPUNKT** | Mottak av varsel | §32.3 første ledd |
| **FRIST** | Uten ugrunnet opphold | §32.3 første ledd |
| **KONSEKVENS** | Pålegget **ANSES SOM ENDRING** (passivitetsvirkning) | §32.3 annet ledd |

```
BHs SVARALTERNATIVER (§32.3):
┌────────────────────────────────────────────────────────────────────────────┐
│ a) Utstede endringsordre (§31.3)                                           │
│ b) Avslå TEs krav på endringsordre                                         │
│ c) Frafalle pålegget mot EO for utført arbeid                              │
│                                                                            │
│ Ved avslag: BH skal "uten ugrunnet opphold" BEGRUNNE avslaget.            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Svar på svikt-varsel (§25.3)

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | BH | §25.3 |
| **TRIGGER** | Mottar varsel etter §25.1.2 eller §25.2 | §25.3 |
| **SKJÆRINGSTIDSPUNKT** | Mottak av varsel | §25.3 |
| **FRIST** | Uten ugrunnet opphold | §25.3 |
| **KONSEKVENS** | **IKKE ANGITT** | §25.3 |

```
UAVKLART KONSEKVENS:
┌────────────────────────────────────────────────────────────────────────────┐
│ §25.3 angir ingen eksplisitt konsekvens ved passivitet.                    │
│                                                                            │
│ Mulige tolkninger:                                                         │
│ 1. Implisitt at forholdet anses akseptert (analogt §32.3)?                │
│ 2. BH kan bli erstatningsansvarlig for TE's tap pga. manglende svar?      │
│ 3. Kun oppfordring - ingen juridisk konsekvens?                           │
│                                                                            │
│ Applikasjonen noterer passivitet men tar ikke stilling til konsekvens.    │
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

## 5. §5-mekanismen

### 5.1 Generell regel (§5 tredje ledd)

> **§5 tredje ledd:**
> "Hvis en part ønsker å gjøre gjeldende at den andre parten har varslet eller svart for sent, må han gjøre det skriftlig uten ugrunnet opphold etter å ha mottatt varsel eller svar. Gjør han ikke det, skal varselet eller svaret anses for å være gitt i tide."

### 5.2 Fem dimensjoner for §5

| Dimensjon | Verdi | Kilde |
|-----------|-------|-------|
| **HVEM** | Begge parter | §5 tredje ledd |
| **TRIGGER** | Mottar varsel/svar som parten mener kom for sent | §5 tredje ledd |
| **SKJÆRINGSTIDSPUNKT** | Mottak av varselet/svaret | §5 tredje ledd |
| **FRIST** | Uten ugrunnet opphold | §5 tredje ledd |
| **KONSEKVENS** | Varselet/svaret **ANSES GITT I TIDE** (helbredelse) | §5 tredje ledd |

### 5.3 §5-mekanismens rolle

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
