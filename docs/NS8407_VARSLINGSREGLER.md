# NS 8407 Varslingsregler - Komplett Referanse

**Systematisk oversikt over varslingsplikter, frister, konsekvenser og §5-mekanismen**

*Sist oppdatert: 2026-01-24*

> **Viktig:** Dette dokumentet beskriver varslingsreglene i NS 8407:2011 slik de er implementert i applikasjonen. Ved juridisk tvil, konsulter alltid kontraktsteksten direkte.

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

> **§5 Varsler og krav** (tredje ledd)
>
> Hvis en part ønsker å gjøre gjeldende at den andre parten har varslet eller svart for sent, må han gjøre det skriftlig uten ugrunnet opphold etter å ha mottatt varsel eller svar. Gjør han ikke det, skal varselet eller svaret anses for å være gitt i tide.

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
| **Grunnlag** | §32.2 | Irregulær endring | Mottar pålegg (§32.1) | Uten ugrunnet opphold | Taper retten til å påberope endring |
| **Grunnlag** | §25.1.2 | Svikt i BHs ytelser | Blir/burde blitt oppmerksom på forholdet | Uten ugrunnet opphold | BH kan kreve erstatning |
| **Grunnlag** | §25.2 | Uegnet prosjektering | Blir/måtte blitt klar over at løsningen ikke er egnet | Uten ugrunnet opphold | BH kan kreve erstatning |
| **Vederlag** | §34.1.1 | Endringskrav | **Ingen frist** | N/A | **Ingen preklusjon** |
| **Vederlag** | §34.1.2 | Krav (SVIKT/ANDRE) | Blir/burde blitt klar over forholdet | Uten ugrunnet opphold | Kravet **TAPES** |
| **Vederlag** | §34.1.3 | Rigg/drift | Blir/burde blitt klar over at utgifter ville påløpe | Uten ugrunnet opphold | Retten til påløpte utgifter **TAPES** |
| **Vederlag** | §34.1.3 | Produktivitetstap | Blir/burde blitt klar over at utgifter ville påløpe | Uten ugrunnet opphold | Retten til påløpte utgifter **TAPES** |
| **Frist** | §33.4 | Nøytralt fristvarsel | Forhold som gir rett oppstår | Uten ugrunnet opphold | Kravet **TAPES** |
| **Frist** | §33.6.1 | Spesifisert krav | Har grunnlag for å beregne omfanget | Uten ugrunnet opphold | **REDUKSJON** (skjønn) |
| **Frist** | §33.6.2 | Svar på etterlysning | Mottar BHs etterlysning | Uten ugrunnet opphold | Kravet **TAPES** |

### Detaljert - Grunnlagssporet

#### §32.2 - Irregulær endring (ENDRING-kategori)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ §32.2 TOTALENTREPRENØRENS VARSLINGSPLIKT (Irregulær endring)               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRIGGER:    TE mottar pålegg som angitt i §32.1                           │
│              (instruks som endrer omfang, utførelse, fremdrift)            │
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
│  TRIGGER:    TE blir/burde blitt oppmerksom på forhold i §25.1.1           │
│              (ufullstendigheter, feil, uforutsette grunnforhold, etc.)     │
│                                                                             │
│  §25.2 - Uegnet prosjektering:                                             │
│  ─────────────────────────────                                             │
│  TRIGGER:    TE blir/måtte blitt klar over at BHs løsninger ikke er        │
│              egnede til å nå kravene i §14                                 │
│                                                                             │
│  FELLES:                                                                   │
│  ───────                                                                   │
│  FRIST:      Uten ugrunnet opphold                                         │
│                                                                             │
│  KONSEKVENS: BH kan kreve ERSTATNING for tap som kunne vært unngått        │
│              ved rettidig varsel                                           │
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
│  BH sender etterlysning                                                    │
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

---

## 5. BHs svarplikter

### Komplett matrise

| Spor | Hjemmel | Trigger | Frist | Konsekvens ved passivitet |
|------|---------|---------|-------|--------------------------|
| **Grunnlag** | §32.3 | Varsel etter §32.2 | Uten ugrunnet opphold | Pålegget **anses som endring** |
| **Grunnlag** | §25.3 | Varsel etter §25.1.2/§25.2 | Uten ugrunnet opphold | **Ikke angitt** |
| **Frist** | §33.7 | Spesifisert krav (§33.6.1/§33.6.2) | Uten ugrunnet opphold | Innsigelser **TAPES** |

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

### Detaljert - §33.7

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ §33.7 PARTENS SVARPLIKT (Frist)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRIGGER:    Mottar begrunnet krav med angivelse av antall dager           │
│              (jf. §33.6.1 og §33.6.2)                                      │
│                                                                             │
│  PLIKT:      Svare på kravet                                               │
│                                                                             │
│  FRIST:      Uten ugrunnet opphold                                         │
│                                                                             │
│  KONSEKVENS: "Innsigelser mot kravet tapes dersom de ikke fremsettes       │
│               innen fristen"                                               │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VIKTIG: Her er konsekvensen eksplisitt angitt - innsigelser TAPES. │    │
│  │ Men TE må likevel påberope BHs passivitet via §5 for at           │    │
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
| RespondFristModal | ✅ Implementert | Full støtte for §33.4, §33.6.1, §33.6.2 |
| RespondGrunnlagModal | ❌ Mangler | Ingen mulighet for BH å påberope sen varsling |
| RespondVederlagModal | ⚠️ Delvis | Felt for rigg/produktivitet, men mangler §5-påminnelse |

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

### Foreslått komponent

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LateNoticeInnsigelse KOMPONENT                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Props:                                                                     │
│  ──────                                                                     │
│  spor:           'grunnlag' | 'vederlag' | 'frist'                         │
│  kategori:       'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE'           │
│  hjemmel:        '§32.2' | '§25.1.2' | '§34.1.2' | '§33.4' | etc.          │
│  mottattDato:    Date (for å beregne tid siden mottak)                     │
│  onInnsigelse:   (påberopt: boolean) => void                               │
│                                                                             │
│  Funksjonalitet:                                                           │
│  ───────────────                                                           │
│  1. Spør BH: "Mener du varselet/kravet kom for sent?"                      │
│  2. Ved "Ja": Viser relevant hjemmel og konsekvens                         │
│  3. Viser §5-alert: "Du må gjøre denne innsigelsen skriftlig               │
│     'uten ugrunnet opphold' - ellers anses varselet gitt i tide"           │
│  4. Genererer begrunnelsestekst med §5-referanse                           │
│  5. Anbefaler subsidiær vurdering                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Relevante filer

| Fil | Innhold |
|-----|---------|
| `src/constants/varslingsregler.ts` | Alle varslingsregler definert |
| `src/utils/preklusjonssjekk.ts` | Preklusjonslogikk |
| `src/utils/begrunnelseGenerator.ts` | Auto-generering av begrunnelser |
| `src/components/actions/RespondFristModal.tsx` | Eksempel på §5-implementasjon |
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

| Paragraf | Relevans | Påvirker |
|----------|----------|----------|
| **§32.1** | Definerer hva som utløser varslingsplikten i §32.2 (pålegg som endrer omfang, utførelse, fremdrift) | Trigger for irregulær endring |
| **§33.1** | Definerer TEs rett til fristforlengelse ved endringer | Grunnlag for fristkrav |
| **§33.2** | Definerer BHs rett til fristforlengelse | BHs egne varslingsplikter |
| **§33.3** | Force majeure - fristforlengelse uten vederlag | FORCE_MAJEURE-kategorien |
| **§34.2** | Generelle regler for vederlagskrav | Kan inneholde varslingsregler |
| **§34.3.3** | Svarplikt ved EP-justering (nevnt i skill-filen) | Vederlagssporet |

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
│  □ Avklar tolkningsspørsmål 3 (dobbel varsling)                            │
│  □ Innhent §32.1 for å verifisere trigger for irregulær endring            │
│  □ Avklar om det finnes BH svarplikt for vederlagskrav                     │
│                                                                             │
│  PRIORITET 2 (Viktig for komplett dekning):                                │
│  ──────────────────────────────────────────                                │
│  □ Innhent §33.1, §33.2, §33.3 for fristsporet                             │
│  □ Avklar tolkningsspørsmål 1 (skjæringstidspunkt §33.4)                   │
│  □ Avklar tolkningsspørsmål 4 (§25.3 konsekvens)                           │
│                                                                             │
│  PRIORITET 3 (Nice-to-have):                                               │
│  ────────────────────────────                                              │
│  □ Dekke BHs egne varslingsplikter                                         │
│  □ Dekke sluttoppgjørsfasen (§39)                                          │
│  □ Dekke regningsarbeid og kontraktsmedhjelpere                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

> **Dokumenthistorikk:**
> - 2026-01-24: Opprettet basert på gjennomgang av NS 8407 kapittel 5, 25, 32, 33, 34, 35
> - 2026-01-24: Lagt til seksjon 10 med åpne spørsmål og begrensninger
