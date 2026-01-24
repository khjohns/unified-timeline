# NS 8407 Varslingsregler - Komplett Referanse

**Systematisk oversikt over varslingsplikter, frister, konsekvenser og §5-mekanismen**

*Sist oppdatert: 2026-01-24*

> **Viktig:** Dette dokumentet beskriver varslingsreglene i NS 8407:2011 slik de er implementert i applikasjonen. Ved juridisk tvil, konsulter alltid kontraktsteksten direkte.

> **Dokumentrelasjon:** Dette er **referansedokumentet** som forklarer og visualiserer varslingsreglene. For eksakt kontraktstekst og systematisk kartlegging med alle 5 dimensjoner, se [NS8407_VARSLINGSREGLER_KARTLEGGING.md](./NS8407_VARSLINGSREGLER_KARTLEGGING.md). Kartleggingsdokumentet er primærkilden for presis juridisk tekst.

---

## Innhold

1. [Innledning](#1-innledning)
2. [§5 - Det grunnleggende prinsippet](#2-5---det-grunnleggende-prinsippet)
3. [Varslingsreglenes struktur](#3-varslingsreglenes-struktur)
4. [TEs varslingsplikter](#4-tes-varslingsplikter)
5. [BHs svarplikter](#5-bhs-svarplikter)
6. [Skjæringstidspunkt](#6-skjæringstidspunkt)
7. [Konsekvenstyper](#7-konsekvenstyper)
8. [Sammenheng mellom sporene](#8-sammenheng-mellom-sporene)
9. [Implementasjon i applikasjonen](#9-implementasjon-i-applikasjonen)
10. [Åpne spørsmål og begrensninger](#10-åpne-spørsmål-og-begrensninger)
11. [Læringspunkter for kvalitetssikring](#11-læringspunkter-for-kvalitetssikring-og-kartlegging)

---

## 1. Innledning

### Formål

NS 8407 har et omfattende system av varslingsregler som sikrer:
- Forutsigbarhet for begge parter
- Mulighet til å begrense skadevirkninger
- Klarhet om rettigheter og plikter

### Nøkkelbegreper

| Begrep | Forklaring |
|--------|------------|
| **Varsel** | Skriftlig melding om et forhold som kan gi rett til justering |
| **Krav** | Spesifisert varsel med beløp/antall dager |
| **Innsigelse** | Motpartens skriftlige bestridelse av varsel/krav |
| **Preklusjon** | Tap av rettighet pga. oversittet frist |
| **Reduksjon** | Delvis tap - krav reduseres etter skjønn |
| **Skjæringstidspunkt** | Tidspunktet fristen begynner å løpe fra |

---

## 2. §5 - Det grunnleggende prinsippet

### Kontraktstekst

> **§5 Varsler og krav**
>
> **Første ledd:** Alle varsler og krav og svar på disse, som skal meddeles etter bestemmelsene i kontrakten, skal fremsettes skriftlig til partenes representanter, jf. punkt 9, eller til avtalte adresser. Varsel og krav gitt ved e-post til avtalt adresse regnes som skriftlig dersom ikke annet er avtalt.
>
> **Annet ledd:** Varsel og krav som er innført i referat ført etter 4.2, regnes som skriftlig.
>
> **Tredje ledd:** Hvis en part ønsker å gjøre gjeldende at den andre parten har varslet eller svart for sent, må han gjøre det skriftlig uten ugrunnet opphold etter å ha mottatt varsel eller svar. Gjør han ikke det, skal varselet eller svaret anses for å være gitt i tide. **Dette gjelder ikke for krav, og for forespørsler etter 40.4, som fremsettes for første gang i eller i forbindelse med sluttoppgjøret.**

### VIKTIG: Unntak for sluttoppgjør

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
│  IKKE for nye krav i sluttoppgjøret.                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Skriftlighetskravet

| Metode | Gyldig? | Kilde |
|--------|---------|-------|
| Brev til representant (§9) | ✓ Ja | §5 første ledd |
| E-post til avtalt adresse | ✓ Ja (med mindre annet avtalt) | §5 første ledd |
| Innført i referat (§4.2) | ✓ Ja | §5 annet ledd |
| Muntlig | ✗ Nei | §5 første ledd |

### Prinsipiell betydning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    §5 TREDJE LEDD - ABSOLUTT FORUTSETNING                   │
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

### Flytdiagram - §5 i praksis

```
        TE sender varsel
              │
              ▼
     ┌────────────────────┐
     │   BH mottar varsel │
     └────────┬───────────┘
              │
              ▼
     ┌────────────────────────────────────┐
     │ Mener BH at varselet kom for sent? │
     └────────┬───────────────────────────┘
              │
       ┌──────┴──────┐
       │             │
       ▼             ▼
      JA            NEI
       │             │
       ▼             ▼
  ┌─────────────┐  ┌─────────────────────────────┐
  │ BH MÅ       │  │ Ingen innsigelse nødvendig  │
  │ påberope    │  │ BH tar stilling til         │
  │ skriftlig   │  │ innholdet i varselet        │
  │ "uten       │  └─────────────────────────────┘
  │ ugrunnet    │
  │ opphold"    │
  └──────┬──────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  I TIDE    FOR SENT
    │         │
    ▼         ▼
┌─────────┐ ┌─────────────────────────────────┐
│Konse-   │ │ Varselet ANSES GITT I TIDE      │
│kvens    │ │ (§5 helbredelse)                │
│inntrer  │ │ Konsekvensen inntrer IKKE       │
└─────────┘ └─────────────────────────────────┘
```

### §5 vs. spesialregler

§5 er en **generell regel** som gjelder i tillegg til alle spesialregler:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REGELSTRUKTUR                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NIVÅ 1: SPESIALREGLER                                                      │
│  ─────────────────────                                                      │
│  Definerer:                                                                 │
│  • HVA som skal varsles                                                     │
│  • FRIST for varsling                                                       │
│  • KONSEKVENS ved brudd                                                     │
│                                                                             │
│  Eksempler: §32.2, §25.1.2, §33.4, §34.1.2, §34.1.3                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NIVÅ 2: §5 TREDJE LEDD (ALLTID I TILLEGG)                                  │
│  ─────────────────────────────────────────                                  │
│  Definerer:                                                                 │
│  • HVORDAN konsekvensen aktiveres                                           │
│  • Motparten må PÅBEROPE sen varsling                                       │
│  • Må gjøres SKRIFTLIG og UTEN UGRUNNET OPPHOLD                            │
│                                                                             │
│  Uten §5-innsigelse: Ingen konsekvens (helbredelse)                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Varslingsreglenes struktur

### Oversiktsbilde

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NS 8407 VARSLINGSSTRUKTUR                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌──────────────┐                                    │
│                         │   GRUNNLAG   │                                    │
│                         │   (Ansvar)   │                                    │
│                         └──────┬───────┘                                    │
│                                │                                            │
│               ┌────────────────┼────────────────┐                           │
│               │                │                │                           │
│               ▼                ▼                ▼                           │
│        ┌──────────┐     ┌──────────┐     ┌──────────┐                      │
│        │ ENDRING  │     │  SVIKT   │     │  ANDRE   │                      │
│        │  Kap VII │     │  Kap V   │     │  Div.    │                      │
│        └────┬─────┘     └────┬─────┘     └────┬─────┘                      │
│             │                │                │                            │
│             │                └────────┬───────┘                            │
│             │                         │                                    │
│             ▼                         ▼                                    │
│    ┌─────────────────┐      ┌─────────────────┐                            │
│    │ VEDERLAG §34.1.1│      │ VEDERLAG §34.1.2│                            │
│    │ Ingen preklusjon│      │ Kravet tapes    │                            │
│    └────────┬────────┘      └────────┬────────┘                            │
│             │                        │                                     │
│             └───────────┬────────────┘                                     │
│                         │                                                  │
│                         ▼                                                  │
│              ┌─────────────────────┐                                       │
│              │   VEDERLAG §34.1.3  │                                       │
│              │   Rigg/Produktivitet│                                       │
│              │   (Gjelder begge)   │                                       │
│              └─────────────────────┘                                       │
│                                                                            │
│             ┌─────────────────────────────────────┐                        │
│             │            FRIST §33                │                        │
│             │  (Gjelder alle grunnlagskategorier) │                        │
│             └─────────────────────────────────────┘                        │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tidslinje - typisk saksflyt

```
TID ──────────────────────────────────────────────────────────────────────────►

GRUNNLAG
    │
    ├─ [1] Forhold oppstår
    │      │
    │      ▼
    ├─ [2] TE varsler (§32.2 / §25.1.2)     ◄── BH kan påberope §5 her
    │      │
    │      ▼
    └─ [3] BH svarer (§32.3 / §25.3)        ◄── TE kan påberope §5 her


VEDERLAG
    │
    ├─ [4] TE varsler hovedkrav (§34.1.2)   ◄── BH kan påberope §5 her
    │      │                                     (kun SVIKT/ANDRE)
    │      ▼
    ├─ [5] TE varsler rigg/prod (§34.1.3)   ◄── BH kan påberope §5 her
    │      │
    │      ▼
    └─ [6] BH svarer på vederlag


FRIST
    │
    ├─ [7] TE varsler nøytralt (§33.4)      ◄── BH kan påberope §5 her
    │      │
    │      ▼
    ├─ [8] TE spesifiserer (§33.6.1)        ◄── BH kan påberope §5 her
    │      │
    │      ▼
    └─ [9] BH svarer (§33.7)                ◄── TE kan påberope §5 her
```

---

## 4. TEs varslingsplikter

### Komplett matrise

| Spor | Hjemmel | Hva varsles | Skjæringstidspunkt | Frist | Konsekvens |
|------|---------|-------------|-------------------|-------|------------|
| **Grunnlag** | §24.2.2 | Risikoovergang - uegnet materiale | Kontraktsinngåelse / mottak | **5 uker** | TE overtar risikoen |
| **Grunnlag** | §32.2 | Irregulær endring | Mottar pålegg (§32.1) | Uten ugrunnet opphold | Taper retten til å påberope endring |
| **Grunnlag** | §25.1.2 | Svikt i BHs ytelser | Blir/burde blitt oppmerksom | Uten ugrunnet opphold | BH kan kreve erstatning |
| **Grunnlag** | §25.2 | Uegnet prosjektering | Blir/måtte blitt klar over | Uten ugrunnet opphold | BH kan kreve erstatning |
| **Vederlag** | §34.1.1 | Endringskrav | **Ingen frist** | N/A | **Ingen preklusjon** |
| **Vederlag** | §34.1.2 | Krav (SVIKT/ANDRE) | Blir/burde blitt klar over | Uten ugrunnet opphold | Kravet **TAPES** |
| **Vederlag** | §34.1.3 | Rigg/drift | Blir/burde klar over (vil påløpe) | Uten ugrunnet opphold | Påløpte utgifter **TAPES** |
| **Vederlag** | §34.1.3 | Produktivitetstap | Blir/burde klar over (vil påløpe) | Uten ugrunnet opphold | Påløpte utgifter **TAPES** |
| **Frist** | §33.4 | Nøytralt fristvarsel | Forhold som gir rett oppstår | Uten ugrunnet opphold | Kravet **TAPES** |
| **Frist** | §33.6.1 | Spesifisert krav | Har grunnlag for å beregne | Uten ugrunnet opphold | **REDUKSJON** (skjønn) |
| **Frist** | §33.6.2 | Svar på etterlysning | Mottar BHs etterlysning | Uten ugrunnet opphold | Kravet **TAPES** |
| **Frist** | §33.8 | Varsel før forsering | Velger å anse avslag som forsering | **Før iverksettelse** | **(Uavklart)** |

### Detaljert - Grunnlagssporet

#### §24.2.2 - Risikoovergang (ved avtalt risikoovergang)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ §24.2.2 TOTALENTREPRENØRENS KONTROLL AV BHs MATERIALE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FORUTSETNING: Partene har avtalt risikoovergang (§24.2.1)                 │
│                                                                             │
│  TRIGGER:    TE mener at BHs anvisning ikke vil lede til oppfyllelse       │
│              av krav i §14                                                 │
│                                                                             │
│  FRIST:      5 UKER fra kontraktsinngåelse (kan avtales annerledes)        │
│              Utsettes hvis materialet mottas senere                        │
│                                                                             │
│  VARSELET SKAL:                                                             │
│  - Presisere hvilke forhold det dreier seg om                              │
│  - Begrunne behovet for endringer                                          │
│                                                                             │
│  KONSEKVENS: TE OVERTAR RISIKOEN for den delen av materialet               │
│              (som om TE hadde prosjektert selv)                            │
│                                                                             │
│  Hvis TE varsler i tide: TE overtar IKKE risikoen for denne delen          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### §32.2 - Irregulær endring (ENDRING-kategori)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ §32.2 TOTALENTREPRENØRENS VARSLINGSPLIKT (Irregulær endring)               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRIGGER:    TE mottar pålegg som angitt i §32.1:                          │
│              a) Fra person med fullmakt til endringsordre (§31.3)          │
│              b) Fra person med kontrollfullmakt, under ordinære oppgaver   │
│              c) Fra arbeidstegninger, arbeidsbeskrivelser e.l. fra BH      │
│              + Pålegg fra OFFENTLIG MYNDIGHET (§32.2 annet ledd)           │
│                                                                             │
│  PLIKT:      Varsle BH dersom TE vil påberope dette som en endring         │
│                                                                             │
│  FRIST:      Uten ugrunnet opphold                                         │
│                                                                             │
│  KONSEKVENS: Taper retten til å påberope at pålegget innebærer endring     │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VIKTIG: Dette gjelder kun RETTEN til å påberope endring.           │    │
│  │ Vederlagskravet (§34.1.1) tapes IKKE selv om §32.2 er oversittet.  │    │
│  │ Men uten godkjent grunnlag er det vanskelig å vinne frem.          │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### §25.1.2 / §25.2 - Svikt/kvalitet (SVIKT/ANDRE-kategori)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ §25.1.2 / §25.2 TOTALENTREPRENØRENS VARSLINGSPLIKT (Svikt/kvalitet)        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  §25.1.2 - Svikt i BHs ytelser:                                            │
│  ─────────────────────────────                                             │
│  TRIGGER:    TE blir/burde blitt oppmerksom på forhold i §25.1.1:          │
│              a) Ufullstendigheter/uoverensstemmelser i løsninger           │
│              b) Behov for grunnundersøkelser                               │
│              c) Feil ved materialer fra BH                                 │
│              d) Fysisk arbeidsgrunnlag/grunnforhold avviker                │
│                                                                             │
│  §25.2 - Uegnet prosjektering:                                             │
│  ─────────────────────────────                                             │
│  TRIGGER:    TE blir/MÅTTE blitt klar over at BHs løsninger ikke er        │
│              egnede til å nå kravene i §14 (strengere aktsomhetsnorm)      │
│                                                                             │
│  FELLES:                                                                   │
│  ───────                                                                   │
│  FRIST:      Uten ugrunnet opphold                                         │
│                                                                             │
│  KONSEKVENS: BH kan kreve ERSTATNING for tap som kunne vært unngått        │
│              ved rettidig varsel                                           │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VIKTIG - DOBBEL VARSLING (§25.1.2 tredje ledd):                    │    │
│  │ "Dersom totalentreprenøren vil kreve fristforlengelse eller        │    │
│  │  vederlagsjustering [...] skal kravet varsles og behandles         │    │
│  │  etter bestemmelsene i punkt 33 og 34."                            │    │
│  │                                                                    │    │
│  │ TE må altså varsle SEPARAT for:                                    │    │
│  │ 1. Grunnlag (§25.1.2) - konsekvens: erstatning                    │    │
│  │ 2. Frist (§33) og Vederlag (§34) - konsekvens: PREKLUSJON         │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VIKTIG: Konsekvensen er ERSTATNING, ikke preklusjon av kravet.     │    │
│  │ TE må likevel varsle etter §34.1.2 for vederlag (der kravet tapes).│    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detaljert - Vederlagssporet

#### Asymmetrien mellom ENDRING og SVIKT/ANDRE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              VEDERLAGSPREKLUSJON - KRITISK FORSKJELL                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐        │
│  │        ENDRING              │    │      SVIKT / ANDRE          │        │
│  │        §34.1.1              │    │        §34.1.2              │        │
│  ├─────────────────────────────┤    ├─────────────────────────────┤        │
│  │                             │    │                             │        │
│  │  "Partene har krav på       │    │  "Krav på vederlagsjustering│        │
│  │   justering av vederlaget   │    │   tapes dersom det ikke     │        │
│  │   dersom det foreligger     │    │   varsles innen fristen."   │        │
│  │   en endring"               │    │                             │        │
│  │                             │    │                             │        │
│  │  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │        │
│  │  │ INGEN VARSLINGSPLIKT  │  │    │  │  VARSLINGSPLIKT       │  │        │
│  │  │ INGEN PREKLUSJON      │  │    │  │  PREKLUSJON VED BRUDD │  │        │
│  │  └───────────────────────┘  │    │  └───────────────────────┘  │        │
│  │                             │    │                             │        │
│  │  Kravet består uansett når  │    │  Kravet TAPES hvis ikke     │        │
│  │  det fremsettes             │    │  varslet i tide             │        │
│  │                             │    │                             │        │
│  └─────────────────────────────┘    └─────────────────────────────┘        │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VIKTIG: Selv om vederlagskravet ikke prekluderes ved ENDRING,      │    │
│  │ må TE likevel varsle grunnlaget (§32.2) for å påberope at          │    │
│  │ forholdet ER en endring. Uten godkjent grunnlag er det vanskelig   │    │
│  │ å få medhold i vederlagskravet.                                    │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### §34.1.3 - Særskilte krav (rigg/drift og produktivitet)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ §34.1.3 SÆRSKILT VARSEL OM ØKTE UTGIFTER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GJELDER:    Både ENDRING (§34.1.1) og SVIKT/ANDRE (§34.1.2)               │
│                                                                             │
│  TO TYPER KRAV:                                                            │
│  ──────────────                                                            │
│  1. Rigg/drift:      Kapitalytelser, rigging, drift, nedrigging            │
│  2. Produktivitet:   Nedsatt produktivitet, forstyrrelser på annet arbeid  │
│                                                                             │
│  SKJÆRINGSTIDSPUNKT:                                                       │
│  ───────────────────                                                       │
│  "blir eller burde ha blitt klar over at utgifter VILLE PÅLØPE"            │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ MERK: Fremtidsrettet formulering.                                  │    │
│  │ Fristen løper fra TE forstår at utgiften VIL komme,               │    │
│  │ ikke fra utgiften faktisk påløper.                                 │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  KONSEKVENS:                                                               │
│  ───────────                                                               │
│  "taper han retten til å påberope seg PÅLØPTE utgifter"                    │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VIKTIG: Kun utgifter påløpt FØR varsling tapes.                    │    │
│  │ Utgifter etter varsling kan fortsatt kreves.                       │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detaljert - Fristsporet

#### Grunnlag for fristforlengelse (§33.1-§33.3) ✓

**Kontraktstekst:**

> **§33.1 Partenes krav på fristforlengelse ved endringer**
> Partene har krav på fristforlengelse dersom fremdriften hindres som følge av endringer, jf. punkt 31, 32, 34.1.1 og 36.2.

> **§33.2 Byggherrens krav på fristforlengelse ved svikt hos totalentreprenøren**
> Byggherren har krav på fristforlengelse dersom fremdriften hindres som følge av totalentreprenørens forsinkelse, mangler ved det ferdige byggverket, eller andre forhold totalentreprenøren svarer for.

> **§33.3 Partenes rett til fristforlengelse ved force majeure**
> Partene har rett til fristforlengelse dersom fremdriften hindres av forhold utenfor hans kontroll og som han ikke burde ha forutsatt da kontrakten ble inngått, og heller ikke med rimelighet kunne ventes å unngå eller overvinne følgende av (force majeure).
>
> Fristforlengelse som følge av force majeure gir **ikke rett til vederlagsjustering**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FORCE MAJEURE - INGEN VEDERLAGSRETT                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  §33.3 siste setning: "Fristforlengelse som følge av force majeure gir     │
│  ikke rett til vederlagsjustering."                                        │
│                                                                             │
│  BETYDNING: TE kan kreve forlenget frist, men IKKE vederlag.               │
│  Dette er viktig for FORCE_MAJEURE-kategorien i applikasjonen.             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Varslingskjeden (§33.4-§33.7) ✓

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRISTSPORET - VARSLINGSKJEDE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEG 1: NØYTRALT VARSEL (§33.4)                                           │
│  ────────────────────────────────                                          │
│  Trigger:     Forhold som gir rett til fristforlengelse oppstår            │
│  Innhold:     Varsel om at TE vil kreve fristforlengelse                   │
│               (trenger ikke spesifisere antall dager)                      │
│  Frist:       Uten ugrunnet opphold                                        │
│  Konsekvens:  Kravet TAPES                                                 │
│                           │                                                │
│                           ▼                                                │
│  STEG 2: SPESIFISERT KRAV (§33.6.1)                                        │
│  ──────────────────────────────────                                        │
│  Trigger:     TE har grunnlag for å beregne omfanget                       │
│  Innhold:     Angi og begrunne antall dager                                │
│  Frist:       Uten ugrunnet opphold                                        │
│  Konsekvens:  REDUKSJON - kun krav på det BH "måtte forstå"                │
│                           │                                                │
│                           ▼                                                │
│  STEG 3: BHs SVAR (§33.7)                                                  │
│  ────────────────────────                                                  │
│  Trigger:     BH mottar spesifisert krav                                   │
│  Innhold:     Ta stilling til kravet                                       │
│  Frist:       Uten ugrunnet opphold                                        │
│  Konsekvens:  Innsigelser TAPES                                            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ALTERNATIVT: BHs ETTERLYSNING (§33.6.2)                                   │
│  ───────────────────────────────────────                                   │
│  Hvis TE ikke har spesifisert (§33.6.1), kan BH etterspørre.               │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VIKTIG: Etterlysning må sendes PER BREV - ikke bare e-post!        │    │
│  │ §33.6.2: "ved å sende brev til totalentreprenøren"                 │    │
│  │ Dette er STRENGERE enn §5 som tillater e-post.                     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  BH sender etterlysning (per brev)                                         │
│         │                                                                  │
│         ▼                                                                  │
│  TE må svare "uten ugrunnet opphold" med ENTEN:                            │
│         │                                                                  │
│    ┌────┴────┐                                                             │
│    │         │                                                             │
│    ▼         ▼                                                             │
│   (a)       (b)                                                            │
│  Spesifisert krav    Begrunnelse for hvorfor                               │
│  (antall dager)      grunnlag ikke foreligger                              │
│    │                        │                                              │
│    ▼                        ▼                                              │
│  BH svarer (§33.7)   §33.6.1 gjelder videre                                │
│  BH KAN IKKE påberope                                                      │
│  at §33.6.1 er oversittet                                                  │
│                                                                             │
│  Hvis TE ikke svarer: Kravet TAPES                                         │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VIKTIG: §33.6.2 fjerde ledd gir en "helbredelse" - hvis TE svarer │    │
│  │ på etterlysning med spesifisert krav, kan BH ikke påberope at     │    │
│  │ §33.6.1-fristen er oversittet. Dette overstyrer §5.               │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Forsering ved uberettiget avslag (§33.8) ✓

**Kontraktstekst:**

> **§33.8 Forsering ved uberettiget avslag**
> "Hvis byggherren helt eller delvis avslår et berettiget krav på fristforlengelse, kan totalentreprenøren velge å anse avslaget som et pålegg om forsering gitt ved endringsordre. Totalentreprenøren har ikke en slik valgrett dersom vederlaget for forseringen må antas å ville overstige den dagmulkten som ville ha påløpt hvis byggherrens avslag var berettiget og forsering ikke ble iverksatt, tillagt 30 %.
>
> Før forsering etter første ledd iverksettes, skal byggherren varsles med angivelse av hva forseringen antas å ville koste."

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ §33.8 FORSERING VED UBERETTIGET AVSLAG                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FORUTSETNINGER FOR FORSERINGSRETT:                                        │
│  ──────────────────────────────────                                        │
│  1. BH har avslått (helt eller delvis) TEs fristkrav                       │
│  2. Fristkravet var BERETTIGET (objektivt grunnlag)                        │
│  3. Forseringskostnad ≤ dagmulkt + 30%                                     │
│                                                                             │
│  TRIGGER:      TE velger å anse BHs avslag som forseringspålegg            │
│                                                                             │
│  VARSLINGSPLIKT:                                                           │
│  ───────────────                                                           │
│  Før forsering iverksettes, skal BH varsles med angivelse av               │
│  hva forseringen antas å ville koste.                                      │
│                                                                             │
│  FRIST:        FØR IVERKSETTELSE (ikke "uten ugrunnet opphold")            │
│                                                                             │
│  KONSEKVENS:   IKKE EKSPLISITT ANGITT                                      │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VIKTIG: §33.8 har ingen eksplisitt konsekvens for manglende varsel.│    │
│  │ Mulige tolkninger:                                                 │    │
│  │ 1. TE mister retten til å anse avslaget som forseringspålegg      │    │
│  │ 2. BH kan bestride forseringskostnadene                           │    │
│  │ 3. Kun lojalitetsbrudd                                            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  KOSTNADSBEGRENSNING (30%-REGELEN):                                        │
│  ──────────────────────────────────                                        │
│  TE har IKKE forseringsrett dersom:                                        │
│  forseringskostnad > (dagmulkt × avslåtte dager × 1,3)                     │
│                                                                             │
│  Eksempel: 10 avslåtte dager, dagmulkt 50.000 kr/dag:                      │
│  Maks forseringskostnad = 10 × 50.000 × 1,3 = 650.000 kr                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. BHs svarplikter

### Komplett matrise

| Spor | Hjemmel | Trigger | Frist | Konsekvens ved passivitet |
|------|---------|---------|-------|--------------------------|
| **Grunnlag** | §24.2.2 | Varsel om uegnet materiale (risikoovergang) | Uten ugrunnet opphold | **Ikke eksplisitt** - BH bærer risiko ved fastholdelse |
| **Grunnlag** | §32.3 | Varsel etter §32.2 | Uten ugrunnet opphold | Pålegget **anses som endring** |
| **Grunnlag** | §25.3 | Varsel etter §25.1.2/§25.2 | Uten ugrunnet opphold | **Ikke angitt** |
| **Frist** | §33.7 | Spesifisert krav (§33.6.1/§33.6.2) | Uten ugrunnet opphold | Innsigelser **TAPES** |

### Detaljert - §24.2.2

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ §24.2.2 BYGGHERRENS SVARPLIKT (Risikoovergang)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRIGGER:    BH mottar varsel om at BHs anvisning ikke vil oppfylle §14    │
│                                                                             │
│  BH SKAL:    Besvare varselet og gi beskjed om hvordan TE skal forholde    │
│              seg                                                            │
│                                                                             │
│  FRIST:      Uten ugrunnet opphold                                         │
│                                                                             │
│  BHs ALTERNATIVER:                                                         │
│  1. Fastholder opprinnelig løsning → BH bærer risikoen                     │
│  2. Pålegger ny løsning (ikke iht. TEs forslag) → BH bærer risikoen       │
│  3. Følger TEs forslag → BH utsteder endringsordre (§31.3)                │
│                                                                             │
│  Ved endring: BH skal utstede EO. Hvis ikke: TE varsler etter §32.2        │
│                                                                             │
│  KONSEKVENS VED PASSIVITET: Ikke eksplisitt angitt (se §5)                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detaljert - §32.3

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ §32.3 BYGGHERRENS SVARPLIKT (Irregulær endring)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRIGGER:    BH mottar varsel etter §32.2 (irregulær endring)              │
│                                                                             │
│  BH SKAL:    Svare ved ENTEN å                                             │
│              a) utstede endringsordre (§31.3), eller                       │
│              b) avslå TEs krav på endringsordre, eller                     │
│              c) frafalle pålegget mot EO for utført arbeid                 │
│                                                                             │
│  FRIST:      Uten ugrunnet opphold                                         │
│                                                                             │
│  KONSEKVENS: Pålegget ANSES Å INNEBÆRE EN ENDRING                          │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VIKTIG: Dette er en sterk passivitetsvirkning.                     │    │
│  │ Hvis BH ikke svarer i tide og TE påberoper dette via §5,          │    │
│  │ anses forholdet automatisk som en endring.                         │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Ved avslag: BH skal "uten ugrunnet opphold" BEGRUNNE avslaget.            │
│  Ved uenighet: §35 gjelder (utførelsesplikt, oppmann, søksmål).            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detaljert - §25.3

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ §25.3 BYGGHERRENS SVARPLIKT (Svikt/kvalitet)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRIGGER:    BH mottar varsel etter §25.1.2 eller §25.2                    │
│                                                                             │
│  BH SKAL:    - Besvare varselet                                            │
│              - Gi beskjed om hvordan TE skal forholde seg                  │
│              - Ved endring: Utstede endringsordre (§31.3)                  │
│                                                                             │
│  FRIST:      Uten ugrunnet opphold                                         │
│                                                                             │
│  KONSEKVENS: IKKE ANGITT I BESTEMMELSEN                                    │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ UAVKLART: Hva skjer hvis BH ikke svarer i tide?                    │    │
│  │                                                                    │    │
│  │ Mulige tolkninger:                                                 │    │
│  │ 1. TE må påberope via §5 - men hva er konsekvensen?               │    │
│  │ 2. Implisitt at forholdet anses akseptert?                        │    │
│  │ 3. Kun erstatningsansvar for BH ved skade pga. manglende svar?    │    │
│  │                                                                    │    │
│  │ Applikasjonen noterer BHs passivitet men tar ikke stilling        │    │
│  │ til den juridiske konsekvensen.                                    │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detaljert - §33.7 ✓

**Kontraktstekst:**

> **§33.7 Svarplikt**
> Den parten som mottar krav etter 33.6.1 eller 33.6.2, skal uten ugrunnet opphold ta stilling til kravet. Innsigelser mot kravet tapes dersom de ikke fremsettes innen fristen.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ §33.7 PARTENS SVARPLIKT (Frist)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VIKTIG: Gjelder BEGGE PARTER - "den parten som mottar krav"        │    │
│  │ • BH svarer på TEs fristkrav (vanligste)                           │    │
│  │ • TE svarer på BHs fristkrav (§33.2 - forsinkelse/mangler)        │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  TRIGGER:    Mottar begrunnet krav med angivelse av antall dager           │
│              (jf. §33.6.1 og §33.6.2)                                      │
│                                                                             │
│  PLIKT:      Ta stilling til kravet                                        │
│                                                                             │
│  FRIST:      Uten ugrunnet opphold                                         │
│                                                                             │
│  KONSEKVENS: "Innsigelser mot kravet tapes dersom de ikke fremsettes       │
│               innen fristen"                                               │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VIKTIG: Her er konsekvensen eksplisitt angitt - innsigelser TAPES. │    │
│  │ Men motparten må likevel påberope passiviteten via §5 for at       │    │
│  │ konsekvensen skal inntre.                                          │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Skjæringstidspunkt

### Tre varianter

| Formulering | Betydning | Aktsomhetsnorm |
|-------------|-----------|----------------|
| "blir oppmerksom på" | Faktisk kunnskap | Subjektiv |
| "burde ha blitt oppmerksom på" | Normal aktsomhet | Objektiv |
| "måtte ha blitt klar over" | Grov uaktsomhet å ikke vite | Streng objektiv |

### Illustrasjon

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SKJÆRINGSTIDSPUNKT - AKTSOMHETSSKALA                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAVEST TERSKEL                                         HØYEST TERSKEL      │
│  (strengest for TE)                                     (mildest for TE)    │
│                                                                             │
│       │                                                             │       │
│       ▼                                                             ▼       │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐       │
│  │ "måtte ha   │           │ "burde ha   │           │ "blir       │       │
│  │  blitt klar │           │  blitt      │           │  oppmerksom │       │
│  │  over"      │           │  oppmerksom │           │  på"        │       │
│  │             │           │  på"        │           │             │       │
│  │ Grovt       │           │ Normal      │           │ Faktisk     │       │
│  │ uaktsomt    │           │ aktsomhet   │           │ kunnskap    │       │
│  │ å ikke vite │           │             │           │             │       │
│  └─────────────┘           └─────────────┘           └─────────────┘       │
│                                                                             │
│  Eksempel: §25.2           Eksempel: §34.1.2         (Sjelden brukt)       │
│  Åpenbart uegnede          Forhold som normalt                              │
│  løsninger                 burde oppdages                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Relevans for BHs §5-innsigelse

Når BH påberoper at TE varslet for sent, må BH kunne dokumentere:

1. **Når** forholdet oppstod / ble synlig
2. **Når** TE ble / burde blitt oppmerksom (skjæringstidspunkt)
3. **Når** TE faktisk varslet
4. At tiden mellom (2) og (3) overskrider "uten ugrunnet opphold"

```
TIDSLINJE FOR BHs VURDERING:

Forhold    TE burde      TE varslet    BH mottok
oppstår    oppdaget      faktisk       varsel
   │           │             │            │
   ▼           ▼             ▼            ▼
───●───────────●─────────────●────────────●───────────────►
               │             │
               └─────────────┘
                   Denne tiden
                   vurderes mot
                   "uten ugrunnet
                   opphold"
```

---

## 7. Konsekvenstyper

### Oversikt

| Type | Betydning | Alvorlighet | Eksempel |
|------|-----------|-------------|----------|
| **PREKLUSJON** | Kravet tapes helt | Alvorlig | §33.4, §34.1.2, §34.1.3 |
| **REDUKSJON** | Krav på det motparten "måtte forstå" | Moderat | §33.6.1 |
| **ERSTATNING** | BH kan kreve erstatning for tap | Avledet | §25.1.2, §25.2 |
| **PASSIVITETSVIRKNING** | Forholdet anses godtatt | Automatisk | §32.3, §33.7 |
| **TAP AV RETT** | Mister rett til å påberope | Grunnlag | §32.2 |

### Detaljert forklaring

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KONSEKVENSTYPER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PREKLUSJON                                                                 │
│  ──────────                                                                 │
│  "Kravet tapes"                                                             │
│                                                                             │
│  TE kan ikke lenger kreve fristforlengelse/vederlag for forholdet.          │
│  Gjelder: §33.4, §33.6.2, §34.1.2, §34.1.3                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  REDUKSJON                                                                  │
│  ─────────                                                                  │
│  "har han bare krav på slik fristforlengelse som den andre parten           │
│   måtte forstå at han hadde krav på"                                       │
│                                                                             │
│  TE får ikke fullt krav - kun det som var åpenbart for BH.                 │
│  BH har skjønnsmessig myndighet til å fastsette.                           │
│  Gjelder: §33.6.1                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ERSTATNING                                                                 │
│  ──────────                                                                 │
│  "kan byggherren kreve erstatning for tap som kunne vært unngått            │
│   ved rettidig varsel"                                                     │
│                                                                             │
│  TE beholder kravet, men BH kan ha motkrav på erstatning.                  │
│  BH må dokumentere faktisk tap og årsakssammenheng.                        │
│  Gjelder: §25.1.2, §25.2                                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PASSIVITETSVIRKNING                                                        │
│  ───────────────────                                                        │
│  "anses pålegget å innebære en endring" / "innsigelser tapes"              │
│                                                                             │
│  BHs passivitet fører til automatisk godtakelse.                           │
│  Gjelder: §32.3 (endring), §33.7 (frist)                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TAP AV RETT TIL Å PÅBEROPE                                                │
│  ────────────────────────                                                  │
│  "taper han retten til å påberope seg at pålegget innebærer en endring"    │
│                                                                             │
│  TE mister ikke vederlagskravet direkte, men kan ikke påberope             │
│  at forholdet er en endring. Grunnlaget faller bort.                       │
│  Gjelder: §32.2                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Sammenheng mellom sporene

### Dobbel varsling ved SVIKT/ANDRE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│          SVIKT/ANDRE - TO VARSLINGSPLIKTER MED ULIKE KONSEKVENSER          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Forhold oppstår                                                           │
│        │                                                                   │
│        ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐      │
│  │ VARSEL 1: GRUNNLAG (§25.1.2)                                    │      │
│  │                                                                 │      │
│  │ Frist:      Uten ugrunnet opphold                               │      │
│  │ Konsekvens: BH kan kreve ERSTATNING                             │      │
│  │                                                                 │      │
│  │ ┌─────────────────────────────────────────────────────────┐    │      │
│  │ │ MERK: Kravet TAPES IKKE - kun erstatningsrisiko         │    │      │
│  │ └─────────────────────────────────────────────────────────┘    │      │
│  └─────────────────────────────────────────────────────────────────┘      │
│        │                                                                   │
│        ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐      │
│  │ VARSEL 2: VEDERLAG (§34.1.2)                                    │      │
│  │                                                                 │      │
│  │ Frist:      Uten ugrunnet opphold                               │      │
│  │ Konsekvens: Kravet TAPES                                        │      │
│  │                                                                 │      │
│  │ ┌─────────────────────────────────────────────────────────┐    │      │
│  │ │ KRITISK: Her tapes selve vederlagskravet                │    │      │
│  │ └─────────────────────────────────────────────────────────┘    │      │
│  └─────────────────────────────────────────────────────────────────┘      │
│        │                                                                   │
│        ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐      │
│  │ VARSEL 3: RIGG/PRODUKTIVITET (§34.1.3) - hvis relevant          │      │
│  │                                                                 │      │
│  │ Frist:      Uten ugrunnet opphold (fra "vil påløpe")            │      │
│  │ Konsekvens: Retten til PÅLØPTE utgifter tapes                   │      │
│  └─────────────────────────────────────────────────────────────────┘      │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ENDRING vs SVIKT/ANDRE - fullstendig sammenligning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENDRING vs SVIKT/ANDRE                                   │
├──────────────────────────────────┬──────────────────────────────────────────┤
│            ENDRING               │           SVIKT/ANDRE                    │
├──────────────────────────────────┼──────────────────────────────────────────┤
│                                  │                                          │
│  GRUNNLAG (§32.2)                │  GRUNNLAG (§25.1.2/§25.2)                │
│  ─────────────────               │  ─────────────────────────               │
│  Konsekvens:                     │  Konsekvens:                             │
│  Taper retten til å påberope     │  BH kan kreve erstatning                 │
│  endring                         │                                          │
│                                  │                                          │
├──────────────────────────────────┼──────────────────────────────────────────┤
│                                  │                                          │
│  VEDERLAG (§34.1.1)              │  VEDERLAG (§34.1.2)                      │
│  ──────────────────              │  ──────────────────                      │
│  Frist: INGEN                    │  Frist: Uten ugrunnet opphold            │
│  Konsekvens: INGEN PREKLUSJON    │  Konsekvens: Kravet TAPES                │
│                                  │                                          │
├──────────────────────────────────┼──────────────────────────────────────────┤
│                                  │                                          │
│  RIGG/PRODUKTIVITET (§34.1.3)    │  RIGG/PRODUKTIVITET (§34.1.3)           │
│  ────────────────────────────    │  ────────────────────────────           │
│  Frist: Uten ugrunnet opphold    │  Frist: Uten ugrunnet opphold           │
│  Konsekvens: Påløpte tap tapes   │  Konsekvens: Påløpte tap tapes          │
│                                  │                                          │
├──────────────────────────────────┼──────────────────────────────────────────┤
│                                  │                                          │
│  FRIST (§33.4 etc.)              │  FRIST (§33.4 etc.)                      │
│  ──────────────────              │  ──────────────────                      │
│  Samme regler                    │  Samme regler                            │
│                                  │                                          │
├──────────────────────────────────┴──────────────────────────────────────────┤
│                                                                             │
│  PRAKTISK KONSEKVENS:                                                       │
│                                                                             │
│  Ved ENDRING kan TE "reddes" av at vederlagskravet består selv om           │
│  grunnlagsvarselet kom for sent. Men uten godkjent grunnlag er det          │
│  vanskelig å få medhold i kravet.                                           │
│                                                                             │
│  Ved SVIKT/ANDRE har TE dobbel risiko - både grunnlag (erstatning)         │
│  og vederlag (preklusjon) kan rammes av sen varsling.                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementasjon i applikasjonen

### Eksisterende implementasjon

| Komponent | §5-innsigelse | Status |
|-----------|---------------|--------|
| RespondFristModal | ✅ Implementert | Full støtte for §33.4, §33.6.1, §33.6.2, §33.8 |
| SendFristModal | ✅ Implementert | Advarsler for §33.4 (>7/14 dager), §33.6.2 (etterlysning) |
| SendForseringModal | ✅ Implementert | §33.8 med 30%-regel validering |
| RespondGrunnlagModal | ❌ Mangler | Ingen mulighet for BH å påberope sen varsling |
| RespondVederlagModal | ⚠️ Delvis | Felt for rigg/produktivitet, men mangler §5-påminnelse |

### Fristsporet - Detaljert implementasjonsstatus (2026-01-24)

#### TEs varslingsplikter

| Hjemmel | Varslingsplikt | Impl. | Komponent | Detaljer |
|---------|----------------|-------|-----------|----------|
| §33.4 | Nøytralt fristvarsel | ✅ | SendFristModal | Advarsel >7d, kritisk >14d |
| §33.6.1 | Spesifisert krav | ✅ | SendFristModal | Reduksjonsrisiko-varsel |
| §33.6.2 | Svar på etterlysning | ✅ | SendFristModal | Kritisk alert + bokstav b |
| §33.8 | Varsel før forsering | ✅ | SendForseringModal | 30%-regel backend-validering |

#### BHs svarplikter

| Hjemmel | Svarplikt | Impl. | Komponent | Detaljer |
|---------|-----------|-------|-----------|----------|
| §33.7 | Svar på fristkrav | ✅ | RespondFristModal | Advarsel >5d, passiv aksept |
| §33.6.2 | Kan sende etterlysning | ⚠️ | RespondFristModal | Kun reaktiv (ikke proaktiv) |

#### §5 - Generelle varslingsregler

| Funksjon | Impl. | Komponent | Detaljer |
|----------|-------|-----------|----------|
| BH påberoper sen varsling | ✅ | RespondFristModal | Port 1 (Preklusjon) |
| Helbredelse (BH passiv) | ⚠️ | RespondFristModal | Implisitt, ikke eksplisitt forklart |
| BH for sen = passiv aksept | ✅ | RespondFristModal | Advarsel + auto-begrunnelse |

#### Identifiserte hull

| ID | Beskrivelse | Prioritet |
|----|-------------|-----------|
| H1 | §5 helbredelse ikke eksplisitt forklart til BH | Medium |
| H2 | BH kan ikke sende proaktiv etterlysning (§33.6.2) | Lav |
| H3 | `dato_bh_etterlysning` mangler i datamodellen | Lav |
| H4 | §33.8 konsekvens for manglende varsel er uavklart | Info |

### Manglende funksjonalitet

#### RespondGrunnlagModal

BH bør kunne:
1. Påberope at TEs grunnlagsvarsel kom for sent (§32.2 / §25.1.2)
2. Se §5-påminnelse om at innsigelsen må fremsettes nå
3. Få auto-generert begrunnelse med §5-referanse
4. Ta subsidiært stilling til grunnlaget (hvis §5-innsigelsen ikke holder)

#### RespondVederlagModal

BH bør kunne:
1. Påberope at TEs vederlagsvarsel kom for sent (§34.1.2) - kun SVIKT/ANDRE
2. Se tydelig §5-påminnelse ved alle preklusjonsfelt
3. Få informasjon om at ENDRING ikke har vederlagspreklusjon

### Foreslått komponent: VarslingsregelInfo

En gjenbrukbar komponent for å forklare varslingsregler til brukeren. Brukes i modaler der det allerede finnes alerts eller forklaringstekst, for å gi konsistent og pedagogisk informasjon.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VarslingsregelInfo KOMPONENT                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Props:                                                                     │
│  ──────                                                                     │
│  hjemmel:        '§33.4' | '§33.6.1' | '§33.6.2' | '§33.7' | '§33.8' | etc │
│  rolle:          'TE' | 'BH'                                               │
│  variant:        'info' | 'warning' | 'danger'                             │
│  visKonsekvens:  boolean (default: true)                                   │
│  visFrist:       boolean (default: true)                                   │
│  visParagraf5:   boolean (default: false) - for BH-innsigelser             │
│  dagerSiden?:    number - for tidsbaserte advarsler                        │
│                                                                             │
│  Funksjonalitet:                                                           │
│  ───────────────                                                           │
│  1. Viser paragraf med kort forklaring fra varslingsregler.ts              │
│  2. Viser fristtype (UUO, spesifikk, etc.) med forklaring                  │
│  3. Viser konsekvens ved brudd med fargekoding                             │
│  4. Ved visParagraf5=true: Viser §5-alert med helbredelsesinformasjon      │
│  5. Ved dagerSiden: Viser tidsbasert advarsel                              │
│                                                                             │
│  Bruksområder:                                                             │
│  ─────────────                                                             │
│  • SendFristModal: Forklare §33.4/§33.6.1 for TE                           │
│  • RespondFristModal: Forklare §33.7/§5 for BH                             │
│  • SendForseringModal: Forklare §33.8 for TE                               │
│  • RespondGrunnlagModal: (fremtidig) Forklare §32.2/§25.1.2 for BH         │
│  • RespondVederlagModal: (fremtidig) Forklare §34.1.2/§34.1.3 for BH       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Eksempel på bruk

```tsx
// I SendFristModal - for TE som sender nøytralt varsel
<VarslingsregelInfo
  hjemmel="§33.4"
  rolle="TE"
  variant={dagerSidenGrunnlag > 14 ? 'danger' : dagerSidenGrunnlag > 7 ? 'warning' : 'info'}
  dagerSiden={dagerSidenGrunnlag}
/>

// I RespondFristModal - for BH som vurderer om varsel kom i tide
<VarslingsregelInfo
  hjemmel="§33.4"
  rolle="BH"
  variant="info"
  visParagraf5={true}  // Viser §5-helbredelsesinformasjon
/>
```

#### Implementasjonsplan

| Fase | Oppgave | Prioritet |
|------|---------|-----------|
| 1 | Opprett `VarslingsregelInfo.tsx` med grunnleggende visning | Høy |
| 2 | Integrer i SendFristModal (erstatt eksisterende alerts) | Høy |
| 3 | Integrer i RespondFristModal Port 1 (legg til §5-info) | Høy |
| 4 | Integrer i SendForseringModal | Medium |
| 5 | Utvid til RespondGrunnlagModal og RespondVederlagModal | Lav |

### Relevante filer

| Fil | Innhold |
|-----|---------|
| `src/constants/varslingsregler.ts` | Alle varslingsregler definert |
| `src/components/shared/VarslingsregelInfo.tsx` | **NY** - Gjenbrukbar komponent for regelforklaring |
| `src/utils/begrunnelseGenerator.ts` | Auto-generering av begrunnelser |
| `src/components/actions/SendFristModal.tsx` | TE sender fristkrav |
| `src/components/actions/RespondFristModal.tsx` | BH svarer på fristkrav (§5-implementasjon) |
| `src/components/actions/SendForseringModal.tsx` | TE sender forseringsvarsel (§33.8) |
| `.claude/skills/ns8407/SKILL.md` | Kontraktsreferanser |

---

## Vedlegg: Hurtigreferanse

### BHs §5-innsigelsesmuligheter

Når BH mottar varsel fra TE og mener det kom for sent:

| TEs varsel etter | BH påberoper via §5 | Konsekvens for TE |
|------------------|---------------------|-------------------|
| §32.2 (irregulær endring) | Sen varsling | Ikke rett til å påberope endring |
| §25.1.2/§25.2 (svikt/kvalitet) | Sen varsling | Erstatningsansvar |
| §34.1.2 (vederlag SVIKT/ANDRE) | Sen varsling | Hovedkravet **tapes** |
| §34.1.3 (rigg/drift) | Sen varsling | Rigg/drift-kravet **tapes** |
| §34.1.3 (produktivitet) | Sen varsling | Produktivitetskravet **tapes** |
| §33.4 (nøytralt fristvarsel) | Sen varsling | Fristkravet **tapes** |
| §33.6.1 (spesifisert krav) | Sen spesifisering | **Reduksjon** etter skjønn |

### TEs §5-innsigelsesmuligheter

Når TE mottar svar fra BH og mener det kom for sent:

| BHs svar etter | TE påberoper via §5 | Konsekvens for BH |
|----------------|---------------------|-------------------|
| §32.3 (svar på irregulær endring) | Sen respons | Pålegget **anses som endring** |
| §25.3 (svar på svikt-varsel) | Sen respons | Uavklart |
| §33.7 (svar på fristkrav) | Sen respons | Innsigelser **tapes** |

---

## 10. Åpne spørsmål og begrensninger

> **Viktig:** Dette dokumentet er basert på en gjennomgang av utvalgte paragrafer i NS 8407. Følgende spørsmål og begrensninger bør vurderes før implementering.

### Manglende paragrafer

Følgende paragrafer er referert i dokumentet, men kontraktsteksten er ikke verifisert:

| Paragraf | Relevans | Påvirker | Status |
|----------|----------|----------|--------|
| **§32.1** | Definerer hva som utløser varslingsplikten i §32.2 | Trigger for irregulær endring | ✓ Verifisert |
| **§33.1** | Definerer TEs rett til fristforlengelse ved endringer | Grunnlag for fristkrav | ✓ Verifisert |
| **§33.2** | Definerer BHs rett til fristforlengelse | BHs egne varslingsplikter | ✓ Verifisert |
| **§33.3** | Force majeure - fristforlengelse uten vederlag | FORCE_MAJEURE-kategorien | ✓ Verifisert |
| **§34.1.1** | Vederlagskrav ved endringer - INGEN PREKLUSJON | Vederlagssporet | ✓ Verifisert |
| **§34.1.2** | Vederlagskrav ved svikt/andre - PREKLUSJON | Vederlagssporet | ✓ Verifisert |
| **§34.1.3** | Rigg/drift og produktivitetstap - DELVIS PREKLUSJON | Vederlagssporet | ✓ Verifisert |
| **§34.2.1** | Avtalt vederlagsjustering - BH svar "rimelig tid" | Vederlagssporet | ✓ Verifisert |
| **§34.2.2** | Produktivitetstap ved regningsarbeid | Vederlagssporet | ✓ Verifisert |
| **§34.3.3** | EP-justering - SYMMETRISK regel (begge parter) | Vederlagssporet | ✓ Verifisert |
| **§34.4** | Regningsarbeid - varsel før oppstart | Vederlagssporet | ✓ Verifisert |
| **§30.2** | Kostnadsoverslag - varsle overskridelse (UUO, uavklart konsekvens) | Regningsarbeid | ✓ Verifisert |
| **§30.3.1** | Ukentlige oppgaver - REDUKSJON ved manglende levering | Regningsarbeid | ✓ Verifisert |
| **§30.3.2** | BH kontroll 14 dager - passivitet = aksept (unntak ved forsett/grov uakts.) | Regningsarbeid | ✓ Verifisert |

### Tolkningsspørsmål

#### Spørsmål 1: Skjæringstidspunkt for §33.4

**Problem:** Dokumentet angir "Forhold som gir rett oppstår" som skjæringstidspunkt for §33.4, men kontraktsteksten sier bare "uten ugrunnet opphold" uten å spesifisere eksakt når fristen begynner å løpe.

**Mulige tolkninger:**
1. Fristen løper fra forholdet oppstår (objektiv)
2. Fristen løper fra TE blir klar over forholdet (subjektiv)
3. Fristen løper fra TE burde blitt klar over forholdet (aktsomhetsnorm)

**Status:** Uavklart - bør verifiseres mot juridisk teori/praksis.

#### Spørsmål 2: §33.6.2 fjerde ledd vs §5

**Kontraktstekst:** "Byggherren kan da ikke påberope at fristen i 33.6.1 er oversittet."

**Problem:** Dokumentet beskriver dette som at §33.6.2 fjerde ledd "overstyrer §5". Men er dette korrekt terminologi?

**Mulige tolkninger:**
1. Det er en spesialregel som gjør §5 irrelevant i dette tilfellet
2. Det er en egen helbredelsesmekanisme som virker uavhengig av §5
3. Det bekrefter at §5-innsigelse er påkrevd også her, men BH mister retten til å påberope §33.6.1

**Status:** Uavklart - formulering i dokumentet bør kanskje justeres.

#### Spørsmål 3: Dobbel varsling ved SVIKT/ANDRE

**Kontraktstekst (§25.1.2 siste ledd):** "Dersom totalentreprenøren vil kreve fristforlengelse eller vederlagsjustering som følge av forhold nevnt i 25.1.1, skal kravet varsles og behandles etter bestemmelsene i punkt 33 og 34."

**Problem:** Dokumentet beskriver at TE må sende to separate varsler:
1. §25.1.2 (grunnlagsvarsel) - konsekvens: erstatning
2. §34.1.2 (vederlagsvarsel) - konsekvens: preklusjon

**Spørsmål:**
- Er dette faktisk to separate varsler med ulike frister?
- Kan ett varsel dekke begge formål?
- Løper fristene parallelt eller sekvensielt?

**Status:** Uavklart - praktisk viktig for implementering.

#### Spørsmål 4: §25.3 - Konsekvens ved BHs passivitet

**Kontraktstekst:** "Når byggherren mottar et varsel etter 25.1.2 eller 25.2, skal han uten ugrunnet opphold besvare varselet og gi beskjed om hvordan totalentreprenøren skal forholde seg."

**Problem:** Ingen eksplisitt konsekvens er angitt (i motsetning til §32.3 og §33.7).

**Mulige tolkninger:**
1. TE må påberope via §5, men konsekvensen er uklar
2. Implisitt at forholdet anses akseptert (analogt §32.3)
3. BH kan bli erstatningsansvarlig for tap TE lider pga. manglende svar
4. Ingen konsekvens - bare en oppfordring

**Status:** Uavklart - applikasjonen noterer passivitet men tar ikke stilling.

### Strukturelle begrensninger

#### Begrensning 1: Fokus på TEs varslingsplikter

Dokumentet fokuserer primært på TEs varslingsplikter og BHs svarplikter. Følgende er ikke dekket:

- **BHs egne varslingsplikter** når BH krever fristforlengelse (§33.2)
- **BHs varslingsplikt** ved endringsordre (§31.3)
- **Partenes varslingsplikter** i sluttoppgjørsfasen (§39)

#### Begrensning 2: Vederlagssporet - BHs svarplikt

Dokumentet dekker ikke om det finnes en svarplikt for BH når TE sender vederlagskrav (tilsvarende §33.7 for frist). Dette kan være relevant for:
- Hovedkrav etter §34.1.2
- Særskilte krav etter §34.1.3
- EP-justering etter §34.3

#### Begrensning 3: Regningsarbeid og kontraktsmedhjelpere

Skill-filen nevner varslingsregler for:
- Regningsarbeid (§30.3.1/§30.3.2)
- Kontraktsmedhjelpere (§10.2, §12.1.2)

Disse er ikke dekket i dokumentet.

### Anbefalinger for videre arbeid

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ANBEFALINGER FOR VIDERE ARBEID                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PRIORITET 1 (Kritisk for implementering):                                 │
│  ─────────────────────────────────────────                                 │
│  ☑ Innhent §32.1 for å verifisere trigger for irregulær endring            │
│  ☑ Innhent §33.1, §33.2, §33.3 for fristsporet                             │
│  ☑ Innhent §34.1.1, §34.1.2, §34.1.3 for vederlagssporet                   │
│  ☑ Avklar om det finnes BH svarplikt for vederlagskrav (§34.2.1, §34.3.3) │
│  □ Avklar tolkningsspørsmål 3 (dobbel varsling)                            │
│                                                                             │
│  PRIORITET 2 (Viktig for komplett dekning):                                │
│  ──────────────────────────────────────────                                │
│  □ Avklar tolkningsspørsmål 1 (skjæringstidspunkt §33.4)                   │
│  □ Avklar tolkningsspørsmål 4 (§25.3 konsekvens)                           │
│  ☑ Innhent §30.2, §30.3.1, §30.3.2 for regningsarbeid                      │
│                                                                             │
│  PRIORITET 3 (Nice-to-have):                                               │
│  ────────────────────────────                                              │
│  □ Dekke BHs egne varslingsplikter fullstendig                             │
│  □ Dekke sluttoppgjørsfasen (§39)                                          │
│  □ Dekke regningsarbeid og kontraktsmedhjelpere                            │
│                                                                             │
│  VIKTIGE FUNN FRA §33 VERIFISERING:                                        │
│  ──────────────────────────────────                                        │
│  ☑ §33.3: Force majeure gir IKKE rett til vederlag                         │
│  ☑ §33.6.2: Etterlysning må sendes PER BREV (strengere enn §5)            │
│  ☑ §33.7: Gjelder BEGGE parter ("den parten som mottar krav")             │
│                                                                             │
│  VIKTIGE FUNN FRA §34 VERIFISERING:                                        │
│  ──────────────────────────────────                                        │
│  ☑ §34.1.1: ENDRING har INGEN varslingsplikt/preklusjon (bekreftet)        │
│  ☑ §34.1.2: SVIKT/ANDRE har FULL preklusjon ved sen varsling               │
│  ☑ §34.1.3: DELVIS preklusjon - kun PÅLØPTE utgifter tapes                 │
│  ☑ §34.2.1: BH svar "rimelig tid" (mildere enn UUO), ingen konsekvens     │
│  ☑ §34.3.3: EP-justering er SYMMETRISK - gjelder begge parter             │
│                                                                             │
│  VIKTIGE FUNN FRA §30 VERIFISERING:                                        │
│  ──────────────────────────────────                                        │
│  ☑ §30.2: Varsle overskridelse - UUO, men INGEN eksplisitt konsekvens      │
│  ☑ §30.3.1: Ukentlige oppgaver - REDUKSJON (kun det BH "måtte forstå")    │
│  ☑ §30.3.2: BH 14 dagers kontroll - passivitet = aksept                    │
│  ☑ §30.3.2: Unntak ved forsett/grov uaktsomhet/urasjonell drift            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Læringspunkter for kvalitetssikring og kartlegging

> **Formål:** Denne seksjonen dokumenterer kritiske læringspunkter fra kartleggingsprosessen. Ved fremtidig arbeid med varslingsregler i NS 8407 bør disse punktene vurderes systematisk.

### Presisjonsnivå er kritisk

Ved kartlegging av varslingsregler er det avgjørende å være presis på **fem dimensjoner**:

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

### Læringspunkt 1: §5 er ALLTID påkrevd

**Feil antakelse:** Spesialregler med eksplisitte konsekvenser (som "kravet tapes") virker automatisk.

**Korrekt forståelse:** §5 tredje ledd gjelder ALLTID i tillegg. Ingen konsekvens inntrer uten at motparten påberoper sen varsling skriftlig "uten ugrunnet opphold".

```
FEIL:   §33.4 sier "kravet tapes" → automatisk preklusjon

RIKTIG: §33.4 sier "kravet tapes"
        + §5 krever at BH påberoper dette skriftlig
        + Hvis BH ikke gjør det → varselet anses gitt i tide
```

**Konsekvens for implementering:** Alle respond-modaler må gi motparten mulighet til å påberope sen varsling via §5.

### Læringspunkt 2: Skjæringstidspunkt varierer

**Feil antakelse:** "Uten ugrunnet opphold" har alltid samme skjæringstidspunkt.

**Korrekt forståelse:** Kontrakten bruker ulike formuleringer som gir ulik aktsomhetsnorm:

| Formulering | Norm | Strenghet for TE |
|-------------|------|------------------|
| "blir oppmerksom på" | Faktisk kunnskap | Mildest |
| "burde ha blitt oppmerksom på" | Normal aktsomhet | Moderat |
| "måtte ha blitt klar over" | Åpenbar - grovt uaktsomt å ikke vite | Strengest |

**Konsekvens for implementering:** Ved vurdering av om varsel kom i tide må man identifisere riktig skjæringstidspunkt fra den aktuelle paragrafen.

### Læringspunkt 3: Konsekvenstyper er ikke binære

**Feil antakelse:** Konsekvensen er enten "kravet tapes" eller "ingen konsekvens".

**Korrekt forståelse:** NS 8407 har minst fem ulike konsekvenstyper:

| Type | Beskrivelse | Alvorlighet |
|------|-------------|-------------|
| **Preklusjon** | Kravet tapes helt | Høy |
| **Reduksjon** | Kun krav på det motparten "måtte forstå" | Moderat |
| **Erstatning** | Motparten kan kreve erstatning for tap | Varierer |
| **Passivitetsvirkning** | Forholdet anses godtatt | Høy |
| **Tap av rett** | Mister rett til å påberope (ikke kravet selv) | Moderat |

**Konsekvens for implementering:** Begrunnelsestekster og varsler må reflektere riktig konsekvenstype.

### Læringspunkt 4: Asymmetri mellom kategorier

**Feil antakelse:** Alle grunnlagskategorier behandles likt i vederlagssporet.

**Korrekt forståelse:** Det er fundamental forskjell mellom ENDRING og SVIKT/ANDRE:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KRITISK ASYMMETRI                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ENDRING (§34.1.1):                                                        │
│  ──────────────────                                                        │
│  • INGEN varslingsplikt for vederlag                                       │
│  • INGEN preklusjon av vederlagskravet                                     │
│  • Kravet består uansett når det fremsettes                                │
│                                                                             │
│  SVIKT/ANDRE (§34.1.2):                                                    │
│  ──────────────────────                                                    │
│  • Varslingsplikt "uten ugrunnet opphold"                                  │
│  • Preklusjon - kravet TAPES ved sen varsling                              │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ IMPLIKASJON: En sak kategorisert som SVIKT som egentlig er         │    │
│  │ ENDRING kan føre til uriktig preklusjon av vederlagskravet.        │    │
│  │ Kategorisering i grunnlagssporet er derfor kritisk.                │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Konsekvens for implementering:** Kategorivalg i grunnlagssporet påvirker preklusjonslogikken i vederlagssporet.

### Læringspunkt 5: Spesialregler kan mangle konsekvens

**Feil antakelse:** Alle svarplikter har eksplisitt konsekvens ved passivitet.

**Korrekt forståelse:** Noen svarplikter mangler eksplisitt konsekvens:

| Paragraf | Svarplikt | Konsekvens |
|----------|-----------|------------|
| §32.3 | Ja | Eksplisitt: "anses som endring" |
| §33.7 | Ja | Eksplisitt: "innsigelser tapes" |
| §25.3 | Ja | **Ikke angitt** |

**Konsekvens for implementering:** Når konsekvens ikke er angitt, bør applikasjonen:
1. Notere passiviteten
2. Ikke ta stilling til juridisk konsekvens
3. Overlate tolkning til partene/domstol

### Læringspunkt 6: Helbredelsesmekanismer

**Feil antakelse:** §5 er den eneste helbredelsesmekanismen.

**Korrekt forståelse:** Det finnes flere helbredelsesmekanismer:

| Mekanisme | Hjemmel | Virkning |
|-----------|---------|----------|
| §5 passivitet | §5 tredje ledd | Varselet anses gitt i tide |
| Etterlysning-respons | §33.6.2 fjerde ledd | BH kan ikke påberope §33.6.1 oversittet |

**Konsekvens for implementering:** Helbredelsesmekanismer må identifiseres og implementeres korrekt.

### Læringspunkt 7: Toveis varsling

**Feil antakelse:** Varslingsreglene handler primært om TEs plikter.

**Korrekt forståelse:** §5 gjelder begge veier:
- TE må varsle BH om krav
- BH må svare på TEs varsler
- **Begge parter** må påberope sen varsling/svar via §5

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TOVEIS VARSLING                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TE → BH:                          BH → TE:                                │
│  ────────                          ────────                                │
│  TE varsler om krav                BH svarer på varsel                     │
│         │                                 │                                │
│         ▼                                 ▼                                │
│  BH kan påberope §5                TE kan påberope §5                      │
│  (varsel for sent)                 (svar for sent)                         │
│         │                                 │                                │
│         ▼                                 ▼                                │
│  Konsekvens for TE                 Konsekvens for BH                       │
│  (preklusjon, etc.)                (passivitetsvirkning, etc.)             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Konsekvens for implementering:** Både send- og respond-modaler må håndtere §5-mekanismen.

### Læringspunkt 8: Dobbel varsling

**Feil antakelse:** Ett varsel dekker alle formål.

**Korrekt forståelse:** Ved SVIKT/ANDRE kan det være flere varslingsplikter med ulike konsekvenser:

1. **Grunnlagsvarsel** (§25.1.2) → Konsekvens: Erstatning
2. **Vederlagsvarsel** (§34.1.2) → Konsekvens: Preklusjon
3. **Rigg/produktivitet** (§34.1.3) → Konsekvens: Preklusjon av påløpte

**Åpent spørsmål:** Kan ett varsel dekke flere formål, eller må det sendes separate varsler?

**Konsekvens for implementering:** Applikasjonen bør spore varsling per formål, ikke anta at ett varsel dekker alt.

### Sjekkliste for kvalitetssikring

Ved kartlegging eller kvalitetssikring av varslingsregler, bruk følgende sjekkliste:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SJEKKLISTE FOR VARSLINGSREGLER                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FOR HVER VARSLINGSREGEL:                                                  │
│  ────────────────────────                                                  │
│  □ Er kontraktsteksten verifisert (ikke bare referert)?                    │
│  □ Er alle fem dimensjoner identifisert?                                   │
│    □ Hvem (TE/BH/begge)                                                    │
│    □ Trigger (hva utløser)                                                 │
│    □ Skjæringstidspunkt (når løper fristen fra)                            │
│    □ Frist (hvor lang tid)                                                 │
│    □ Konsekvens (hvilken type)                                             │
│  □ Er §5-mekanismen hensyntatt?                                            │
│  □ Er det helbredelsesmekanismer utover §5?                                │
│                                                                             │
│  FOR KATEGORIER:                                                           │
│  ───────────────                                                           │
│  □ Er asymmetrien mellom ENDRING og SVIKT/ANDRE ivaretatt?                 │
│  □ Påvirker kategorivalg preklusjonslogikk i andre spor?                   │
│                                                                             │
│  FOR SVARPLIKTER:                                                          │
│  ────────────────                                                          │
│  □ Er konsekvensen eksplisitt angitt i kontrakten?                         │
│  □ Hvis ikke - er dette dokumentert som uavklart?                          │
│                                                                             │
│  FOR IMPLEMENTERING:                                                       │
│  ───────────────────                                                       │
│  □ Har motparten mulighet til å påberope §5?                               │
│  □ Genereres korrekt begrunnelsestekst med riktig hjemmel?                 │
│  □ Er subsidiær vurdering tilgjengelig?                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

> **Dokumenthistorikk:**
> - 2026-01-24: Opprettet basert på gjennomgang av NS 8407 kapittel 5, 25, 32, 33, 34, 35
> - 2026-01-24: Lagt til seksjon 10 med åpne spørsmål og begrensninger
> - 2026-01-24: Lagt til seksjon 11 med læringspunkter for kvalitetssikring
> - 2026-01-24: Lagt til §33.8 (forsering ved uberettiget avslag) etter kvalitetssikring
> - 2026-01-24: Lagt til detaljert implementasjonsstatus for fristsporet
> - 2026-01-24: Opprettet VarslingsregelInfo-komponent (`src/components/shared/VarslingsregelInfo.tsx`)
