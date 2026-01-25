---
name: ns8407
description: NS 8407:2011 totalentreprisekontrakt. Bruk ved arbeid med KOE, endringsordrer, vederlag eller fristforlengelse.
allowed-tools: Read, Grep, Glob
---

# NS 8407:2011 - Totalentreprisekontrakt

> **VIKTIG:** Ved enhver tvil om tolkning, les `NS_8407.md` direkte. Denne skill er en strukturert referanse, ikke en erstatning for kontraktsteksten.

## Fulltekst

Komplett kontraktstekst finnes i `NS_8407.md` (prosjektrot).

## Tre-Spor-Modellen

Applikasjonen implementerer NS 8407 gjennom tre parallelle spor:

| Spor | Spørsmål | Hjemmel |
|------|----------|---------|
| **Grunnlag** | Har TE krav på endring? | Kap VII (§31-35) |
| **Vederlag** | Hva koster det? | §34 |
| **Frist** | Hvor lang tid trengs? | §33 |

---

## Grunnlagssporet - Komplett Kategorimapping

Strukturen nedenfor matcher **eksakt** `src/constants/categories.ts`.

### 4 Hovedkategorier

| Kode | Label | Hjemmel Frist | Hjemmel Vederlag | Type Krav |
|------|-------|---------------|------------------|-----------|
| `ENDRING` | Endringer | §33.1 a) | §34.1.1 | Tid og Penger |
| `SVIKT` | Forsinkelse eller svikt ved byggherrens ytelser | §33.1 b) | §34.1.2 | Tid og Penger |
| `ANDRE` | Andre forhold byggherren har risikoen for | §33.1 c) | §34.1.2 | Tid og Penger |
| `FORCE_MAJEURE` | Force Majeure | §33.3 | *null* | Kun Tid |

### Underkategorier

#### ENDRING (8 underkategorier)

| Kode | Label | Hjemmel Basis | Varselkrav |
|------|-------|---------------|------------|
| `EO` | Formell endringsordre | §31.3 | §33.4 / §34.2 |
| `IRREG` | Irregulær endring (Pålegg) | §32.1 | §32.2 |
| `VALGRETT` | Begrensning av valgrett | §14.6 | §32.2 |
| `SVAR_VARSEL` | Endring via svar på varsel | §24.2.2 | §32.2 |
| `LOV_GJENSTAND` | Endring i lover/vedtak (Gjenstand) | §14.4 | §32.2 |
| `LOV_PROSESS` | Endring i lover/vedtak (Prosess) | §15.2 | §32.2 |
| `GEBYR` | Endring i gebyrer/avgifter | §26.3 | §32.2 |
| `SAMORD` | Samordning/Omlegging | §21.4 | §32.2 |

#### SVIKT (5 underkategorier)

| Kode | Label | Hjemmel Basis | Varselkrav |
|------|-------|---------------|------------|
| `MEDVIRK` | Manglende medvirkning/leveranser | §22 | §34.1.2 / §25.1.2 |
| `ADKOMST` | Manglende tilkomst/råderett | §22.2 | §34.1.2 |
| `GRUNN` | Uforutsette grunnforhold | §23.1 | §34.1.2 / §25.1.2 |
| `KULTURMINNER` | Funn av kulturminner | §23.3 | §34.1.2 / §23.3 annet ledd |
| `PROSJ_RISIKO` | Svikt i byggherrens prosjektering | §24.1 | §34.1.2 / §25.1.2 |

#### ANDRE (6 underkategorier)

| Kode | Label | Hjemmel Basis | Varselkrav |
|------|-------|---------------|------------|
| `NEKT_MH` | Nektelse av kontraktsmedhjelper | §10.2 | §34.1.2 |
| `NEKT_TILTRANSPORT` | Tvungen tiltransport | §12.1.2 | §34.1.2 / §12.1.2 annet ledd |
| `SKADE_BH` | Skade forårsaket av byggherren/sideentreprenør | §19.1 | §34.1.2 / §20.5 |
| `BRUKSTAKELSE` | Urettmessig brukstakelse | §38.1 annet ledd | §34.1.2 / §33.4 |
| `STANS_BET` | Stans ved betalingsmislighold | §29.2 | §34.1.2 / §29.2 |
| `STANS_UENIGHET` | Pålagt stans/utsettelse | §35.1 | §34.1.2 |

#### FORCE_MAJEURE (2 underkategorier)

| Kode | Label | Hjemmel Basis | Varselkrav |
|------|-------|---------------|------------|
| `FM_EGEN` | Force Majeure (Egen) | §33.3 første ledd | §33.4 |
| `FM_MH` | Force Majeure (Medhjelper) | §33.3 annet ledd | §33.4 |

**Merk:** Force Majeure gir **kun fristforlengelse**, ikke vederlagsjustering.

---

## Vederlagssporet

| Paragraf | Innhold | Standard metode |
|----------|---------|-----------------|
| §34.1 | Retten til vederlagsjustering | - |
| §34.1.1 | Ved endringer (ENDRING) | Enhetspriser |
| §34.1.2 | Ved svikt/andre forhold (SVIKT, ANDRE) | Regningsarbeid |
| §34.2 | Generelle regler | - |
| §34.2.1 | Avtalt/Tilbud | Avtalt |
| §34.3 | Med anvendelige enhetspriser | Enhetspriser |
| §34.4 | Uten anvendelige enhetspriser | Regningsarbeid (§30) |

### Vederlagsmetoder per hovedkategori

| Hovedkategori | Standard metode |
|---------------|-----------------|
| ENDRING | Enhetspriser (§34.3) |
| SVIKT | Regningsarbeid (§34.4) |
| ANDRE | Regningsarbeid (§34.4) |
| FORCE_MAJEURE | Ingen (kun tid) |

### Vederlagspreklusjon - viktig skille

**§34.1.1 (ENDRING):** Ingen preklusjonsregel for vederlagskravet.
> «Partene har krav på justering av vederlaget dersom det foreligger en endring»

TE taper ikke vederlagskravet selv om varselet kommer sent. Men grunnlagsvarselet (§32.2) må sendes i tide for å påberope at forholdet er en endring.

**§34.1.2 (SVIKT/ANDRE):** Preklusjon - kravet tapes.
> «Krav på vederlagsjustering tapes dersom det ikke varsles innen fristen.»

TE må varsle «uten ugrunnet opphold» etter at han blir eller burde ha blitt klar over forholdet.

**§34.1.3 (Særskilte krav):** Preklusjon for rigg/drift og produktivitetstap - gjelder alle hovedkategorier.
> «Gir han ikke slikt varsel, taper han retten til å påberope seg påløpte utgifter»

| Hovedkategori | Vederlagspreklusjon | Hjemmel |
|---------------|---------------------|---------|
| ENDRING | Nei | §34.1.1 |
| SVIKT | Ja - kravet tapes | §34.1.2 |
| ANDRE | Ja - kravet tapes | §34.1.2 |
| FORCE_MAJEURE | N/A (kun tid) | §33.3 |

**Implementasjon:** `sjekkVederlagspreklusjon()` i `src/utils/preklusjonssjekk.ts`

---

## Fristsporet

| Paragraf | Innhold |
|----------|---------|
| §33.1 | Rett til fristforlengelse (a, b, c) |
| §33.3 | Force majeure |
| §33.4 | Varsel om fristforlengelse |
| §33.5 | Beregning av fristforlengelse |
| §33.6 | Spesifisering av fristkrav |
| §33.7 | Svarplikt for byggherren |
| §33.8 | Forsering ved uberettiget avslag |

---

## Forsering (§33.8)

Spesiell sakstype når BH **avslår** fristkrav og TE mener avslaget er **uberettiget**.

### Flyt

1. BH avslår (helt/delvis) TEs fristkrav
2. TE mener avslaget er uberettiget
3. TE varsler BH om forsering **med kostnadsoverslag** (§33.8 annet ledd)
4. TE gjennomfører forsering
5. TE kan kreve forseringskostnader dekket

> **Merk:** NS 8407 §33.8 spesifiserer ingen responstid for BH eller passivitetsregler. Applikasjonen implementerer en egen flyt - se `backend/models/events.py`.

### Forseringsgrense (§33.8 første ledd)

TE har **ikke valgrett** til forsering dersom:

> Vederlaget for forseringen må antas å ville overstige dagmulkten som ville ha påløpt hvis avslaget var berettiget, **tillagt 30 %**.

**Formel:** Forseringsgrense = (Dagmulkt × Forsinkelsesdager) × 1,30

---

## Endringsordre (§31.3)

BH-initiert formell endring.

### Flyt

1. BH oppretter EO-sak
2. BH legger til KOE-er i EO
3. BH utsteder EO formelt
4. TE aksepterer eller bestrider EO
5. Ved bestridelse: BH kan revidere

---

## Referansetabell - Linjenummer i NS_8407.md

| Paragraf | Linje | Tema |
|----------|-------|------|
| §10 | 254 | Kontraktsmedhjelpere |
| §12 | 280 | Tiltransport av entreprenører |
| §14 | 374 | Kontraktsgjenstanden |
| §15 | 418 | Krav til prosessen |
| §19 | 510 | Skade på kontraktsgjenstanden |
| §21 | 558 | Fremdrift og samordning |
| §22 | 592 | Byggherrens medvirkning |
| §23 | 624 | Risikoen for forhold ved grunnen |
| §24 | 655 | Byggherrens valg av løsninger |
| §25 | 681 | TEs gjennomgang og varslingsplikt |
| §26 | 717 | Fastsettelse av vederlag |
| §29 | 803 | TEs rettigheter ved betalingsmislighold |
| §30 | 815 | Regningsarbeid |
| §31 | 849 | Endringer |
| §32 | 877 | Irregulær endring |
| §33 | 905 | Fristforlengelse |
| §34 | 972 | Vederlagsjustering |
| §35 | 1030 | Uenighet om endringer |
| §38 | 1134 | Brukstakelse og prøvedrift |

---

## Viktige Hjelpefunksjoner i Kodebasen

`src/constants/categories.ts` inneholder:

| Funksjon | Formål |
|----------|--------|
| `getHovedkategori(kode)` | Hent hovedkategori-objekt |
| `getUnderkategoriObj(kode)` | Hent underkategori-objekt |
| `getHjemmelReferanser(hk, uk)` | Hent alle hjemmel-referanser |
| `erForceMajeure(kode)` | Sjekk om kun tid (ingen vederlag) |
| `erIrregulaerEndring(hk, uk)` | Sjekk om spesielle passivitetsregler gjelder |
| `erLovendring(uk)` | Sjekk om lovendring (§14.4) |

---

> **Advarsel:** Denne skill-filen er en strukturert referanse basert på implementasjonen i `src/constants/categories.ts`. Ved juridisk tolkning eller tvil om kontraktsbestemmelser, les alltid `NS_8407.md` direkte.
