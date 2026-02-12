# Workshop Test-Caser for KOE-appen

Disse casene er designet for parvis testing der én spiller **TE (Totalentreprenør)** og én spiller **BH (Byggherre)**. Hver case har forhåndsutfylte felter som TE bruker for å opprette saken via `/saker/ny`.

---

## SAMARBEIDS-CASER (Legger opp til enighet og EO)

### Case 1: Formell endringsordre fra byggherre

**Kontekst:** Byggherren har bedt om å flytte en innvendig vegg for å få plass til større møterom. Dette er dokumentert i byggemøtereferat.

| Felt | Verdi |
|------|-------|
| **Sak-ID** | `CASE-WS-001` |
| **Tittel** | Flytting av innvendig vegg - etasje 3 |
| **Hovedkategori** | Endringer (33.1 a) |
| **Underkategori** | Formell endringsordre (§31.3) |
| **Beskrivelse** | Byggherre har i byggemøte 15.01.2026 bedt om at skillevegg mellom rom 3.12 og 3.13 flyttes 1,2 meter vestover for å utvide møterommet. Endringen medfører omlegging av elektrisk føringsvei og sprinkler. Ref. byggemøtereferat BM-24. |
| **Dato oppdaget** | 15.01.2026 |

**Forventet dynamikk:** BH bør godkjenne grunnlaget raskt. Diskusjonen vil handle om vederlag og tidskonsekvens.

---

### Case 2: Uforutsette grunnforhold (dokumentert)

**Kontekst:** Under graving for fundamenter støtte man på gammel betongkonstruksjon som ikke var vist i grunnundersøkelsen.

| Felt | Verdi |
|------|-------|
| **Sak-ID** | `CASE-WS-002` |
| **Tittel** | Funnet betongkonstruksjon i byggegrop |
| **Hovedkategori** | Forsinkelse eller svikt ved byggherrens ytelser (33.1 b) |
| **Underkategori** | Uforutsette grunnforhold (§23.1) |
| **Beskrivelse** | Ved graving til kote -3,5 i akse C-D/4-6 ble det avdekket en eldre betongkonstruksjon (antatt kulvert fra 1960-tallet) som ikke fremgår av mottatt grunnundersøkelse datert 2024-03-15. Konstruksjonen må fjernes før fundamentering kan fortsette. Forholdet er dokumentert med bilder og koordinater fra totalstasjon. |
| **Dato oppdaget** | 20.01.2026 |

**Forventet dynamikk:** Faktum er udiskutabelt (fysisk funn). BH vil sannsynligvis godkjenne grunnlaget. Diskusjonen går på omfang av konsekvenser.

---

### Case 3: Forsinket tegningsleveranse

**Kontekst:** Arbeidstegninger for fasadedetaljer ble levert 3 uker etter avtalt frist, noe som stoppet fasadearbeidet.

| Felt | Verdi |
|------|-------|
| **Sak-ID** | `CASE-WS-003` |
| **Tittel** | Forsinket tegningsleveranse fasadedetaljer |
| **Hovedkategori** | Forsinkelse eller svikt ved byggherrens ytelser (33.1 b) |
| **Underkategori** | Manglende medvirkning/leveranser (§22) |
| **Beskrivelse** | Iht. leveranseplan vedlegg D skulle arbeidstegninger for fasadedetaljer (vindusomramminger og beslag) vært levert innen 03.01.2026. Tegningene ble mottatt 24.01.2026. I perioden har fasadearbeider stått stille og mannskap er omdisponert til innvendige arbeider med redusert effektivitet. |
| **Dato oppdaget** | 06.01.2026 |

**Forventet dynamikk:** Dokumentert forsinkelse med henvisning til leveranseplan. BH kan diskutere konsekvensene, men grunnlaget er solid.

---

## TVIST-CASER (Skaper diskusjon og uenighet)

### Case 4: Irregulær endring (pålegg eller ikke?)

**Kontekst:** Byggherrens byggeleder har muntlig bedt om at alle dører skal ha automatisk døråpner, men dette er ikke formalisert i endringsordre.

| Felt | Verdi |
|------|-------|
| **Sak-ID** | `CASE-WS-004` |
| **Tittel** | Krav om automatiske døråpnere |
| **Hovedkategori** | Endringer (33.1 a) |
| **Underkategori** | Irregulær endring (Pålegg) (§32.1) |
| **Beskrivelse** | I befaringsmøte 10.01.2026 uttalte byggherrens byggeleder Ola Nordmann at "alle dører i publikumsområder må ha automatiske døråpnere, dette er jo standard nå". Vi oppfatter dette som et pålegg som avviker fra konkurransegrunnlaget som kun spesifiserte automatikk på hovedinngang. Totalt berører dette 47 dører. Ref. lydopptak fra befaring. |
| **Dato oppdaget** | 10.01.2026 |

**Forventet dynamikk:** BH vil sannsynligvis hevde at dette var en meningsytring, ikke et pålegg. TE mener det var en klar instruks. Diskusjon om hva som utgjør et "pålegg" etter §32.1.

---

### Case 5: Prosjekteringsfeil eller entreprenørens risiko?

**Kontekst:** Spesifisert himlingshøyde gir ikke plass til tekniske føringer. TE mener dette er prosjekteringssvikt, BH mener TE burde oppdaget dette ved kontroll.

| Felt | Verdi |
|------|-------|
| **Sak-ID** | `CASE-WS-005` |
| **Tittel** | Manglende høyde for tekniske føringer |
| **Hovedkategori** | Forsinkelse eller svikt ved byggherrens ytelser (33.1 b) |
| **Underkategori** | Svikt i byggherrens prosjektering (§24.1) |
| **Beskrivelse** | Ved koordinering av tekniske fag fremkommer at spesifisert himlingshøyde på 2,7m i 2. etasje ikke gir tilstrekkelig plass for ventilasjonskanaler (300mm), sprinkler (150mm), og elektro føringsveier (100mm) over himling. Samlet behov er ca 650mm, tilgjengelig høyde er 500mm. Vi mener dette er en prosjekteringsfeil som burde vært avdekket i BHs prosjektering. |
| **Dato oppdaget** | 12.01.2026 |

**Forventet dynamikk:** BH vil argumentere for at TE som totalentreprenør hadde plikt til å kontrollere og varsle om dette tidligere (§24.2). TE mener de stolte på BHs underlag. Kjernekonflikt om risikofordeling i totalentreprise.

---

### Case 6: Force Majeure - grensetilfelle

**Kontekst:** Ekstrem kulde (-25°C) i én uke stoppet betongarbeidene. TE mener dette er force majeure, BH mener det er påregnelig vinterforhold.

| Felt | Verdi |
|------|-------|
| **Sak-ID** | `CASE-WS-006` |
| **Tittel** | Ekstremkulde - stans i betongarbeider |
| **Hovedkategori** | Force Majeure (33.3) |
| **Underkategori** | Force Majeure (Egen) (§33.3 første ledd) |
| **Beskrivelse** | I perioden 13.-20. januar 2026 var temperaturen gjennomgående under -25°C (målt på byggeplass). Dette medførte full stans i alle betongarbeider da herdetiltak ikke kunne sikre tilstrekkelig kvalitet ved så lave temperaturer. Meteorologisk institutt bekrefter at dette er temperaturer som ikke er målt i Oslo-området siden 1987. Vi anser dette som ekstraordinære værforhold utenfor vår kontroll. |
| **Dato oppdaget** | 13.01.2026 |

**Forventet dynamikk:** BH vil hevde at kulde i januar er påregnelig og at TE burde planlagt for dette. TE mener ekstremkulde av dette omfang er utenfor normalt påregnelig risiko. Diskusjon om terskelen for "ekstraordinært".

---

### Case 7: Samordning med sideentreprenør

**Kontekst:** Sideentreprenør (BHs ansvar) har blokkert tilkomst til arbeidsområde i 2 uker.

| Felt | Verdi |
|------|-------|
| **Sak-ID** | `CASE-WS-007` |
| **Tittel** | Blokkert tilkomst av sideentreprenør |
| **Hovedkategori** | Endringer (33.1 a) |
| **Underkategori** | Samordning/Omlegging (§21.4) |
| **Beskrivelse** | Sideentreprenør Elektro AS (engasjert direkte av BH) har i perioden 06.01-20.01.2026 hatt materialer og utstyr lagret i korridor B2 som blokkerer vår tilkomst til arbeidsområdet for innvendige arbeider i fløy B. Tross gjentatte henvendelser til BHs byggeleder er situasjonen ikke løst. Vi krever fristforlengelse tilsvarende blokkeringsperioden. |
| **Dato oppdaget** | 06.01.2026 |

**Forventet dynamikk:** BH kan hevde at TE burde samordnet direkte med sideentreprenør. TE mener samordningsansvaret ligger hos BH. Diskusjon om hvem som har ansvar for koordinering.

---

## TIPS FOR FASILITATOREN

1. **Start med samarbeids-casene** (1-3) for å la deltakerne bli kjent med systemet
2. **Introduser tvist-casene** (4-7) når gruppen er varm
3. **La rollene bytte** - den som var TE blir BH i neste case
4. **Oppmuntre til å bruke systemets funksjoner** - respons, motforslag, vedlegg
5. **Tidsboks hver case** - ca 15-20 min per case er tilstrekkelig

## EVALUERINGSPUNKTER

Etter hver case, spør deltakerne:
- Var skjemaene intuitive å fylle ut?
- Manglet dere noen felter eller valg?
- Var juridiske hjemler og varsler tydelige?
- Hvordan opplevde dere samhandlingen mellom rollene?
