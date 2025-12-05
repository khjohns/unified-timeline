# QA-rapport: Datasett_varslingsregler_8407.py

**Dato:** 2025-12-05
**Kildetekst:** NS_8407.md
**Datasett:** Datasett_varslingsregler_8407.py

---

## Sammendrag

Kvalitetssikringen identifiserte **2 feil** (type-inkonsistens) og **4 forbedringsforslag** (manglende regler). Hovedstrukturen og de fleste varslingsregler er korrekte.

---

## FEIL

### 1. VARSEL_OPPSTART_REGNING - Ugyldig FristType

**Lokasjon:** `5. Regningsarbeid > VARSEL_OPPSTART_REGNING`

**I datasettet:**
```python
"frist_type": "INNEN_OPPSTART",
```

**Problem:** Verdien `"INNEN_OPPSTART"` er ikke definert i FristType-enum:
```python
FristType = Literal[
    "UTEN_UGRUNNET_OPPHOLD",
    "RIMELIG_TID",
    "SPESIFIKK_DAGER",
    "LOPENDE",
    "INNEN_FRIST_UTLOP"
]
```

**Forslag til rettelse:**
- Legg til `"INNEN_OPPSTART"` i FristType-definisjonen, eller
- Bruk eksisterende type som `"UTEN_UGRUNNET_OPPHOLD"` med trigger "Før arbeidet starter"

---

### 2. INNSENDING_SLUTTOPPSTILLING - Ugyldig KonsekvensType

**Lokasjon:** `7. Sluttoppgjør > INNSENDING_SLUTTOPPSTILLING`

**I datasettet:**
```python
"konsekvens_type": "INGEN_DIREKTE",
```

**Problem:** Verdien `"INGEN_DIREKTE"` er ikke definert i KonsekvensType-enum:
```python
KonsekvensType = Literal[
    "PREKLUSJON_KRAV",
    "PREKLUSJON_INNSIGELSE",
    "REDUKSJON_SKJONN",
    "ANSVAR_SKADE",
    "BEVISBYRDE_TAP"
]
```

**Forslag til rettelse:**
- Legg til `"INGEN_DIREKTE"` eller `"MULIGHET_PREKLUSJON"` i KonsekvensType-definisjonen

---

## FORBEDRINGSFORSLAG

### 1. Manglende regel: Varsel om for sent mottatt varsel (5 tredje ledd)

**Kildetekst (5 tredje ledd):**
> "Hvis en part ønsker å gjøre gjeldende at den andre parten har varslet eller svart for sent, må han gjøre det skriftlig uten ugrunnet opphold etter å ha mottatt varsel eller svar. Gjør han ikke det, skal varselet eller svaret anses for å være gitt i tide."

**Forslag:**
```python
{
    "kode": "PROTEST_FOR_SENT_VARSEL",
    "paragraf": "5 tredje ledd",
    "beskrivelse": "Protest mot for sent mottatt varsel/svar.",
    "aktor": "TE",  # eller "BH" - gjelder begge
    "trigger_beskrivelse": "Mottak av for sent varsel/svar",
    "frist_type": "UTEN_UGRUNNET_OPPHOLD",
    "konsekvens_type": "PREKLUSJON_INNSIGELSE",
    "konsekvens_beskrivelse": "Varselet/svaret anses som rettidig."
}
```

---

### 2. Manglende regel: Absolutt reklamasjonsfrist (42.2.2)

**Kildetekst (42.2.2 annet ledd):**
> "Reklamasjon kan ikke fremsettes senere enn 5 år etter overtakelsen."

**Observasjon:** Datasettet har kun den relative fristen ("rimelig tid"), men mangler den absolutte 5-årsfristen.

**Forslag:** Legg til ny regel eller utvid REKLAMASJON_SENERE med informasjon om absolutt frist.

---

### 3. Manglende regel: Varsel om forsering (33.8)

**Kildetekst (33.8 annet ledd):**
> "Før forsering etter første ledd iverksettes, skal byggherren varsles med angivelse av hva forseringen antas å ville koste."

**Forslag:**
```python
{
    "kode": "VARSEL_FORSERING",
    "paragraf": "33.8",
    "beskrivelse": "Varsel før iverksettelse av forsering ved uberettiget avslag.",
    "aktor": "TE",
    "trigger_beskrivelse": "Beslutning om forsering",
    "frist_type": "INNEN_OPPSTART",  # Før iverksettelse
    "konsekvens_type": "PREKLUSJON_KRAV",
    "konsekvens_beskrivelse": "Tap av rett til forseringsvederlag."
}
```

---

### 4. Manglende regel: BHs varslingsplikt ved oppdaget feil (20.3)

**Kildetekst (20.3 annet ledd):**
> "Blir byggherren oppmerksom på at prosjekteringen eller utførelsen ikke er i samsvar med kontrakten, skal han uten ugrunnet opphold varsle totalentreprenøren. Dersom byggherren ikke varsler, blir han ansvarlig for de virkninger som ville vært unngått ved rettidig varsel."

**Forslag:**
```python
{
    "kode": "BH_VARSEL_FEIL",
    "paragraf": "20.3",
    "beskrivelse": "BH må varsle TE ved oppdagelse av kontraktsstridig utførelse.",
    "aktor": "BH",
    "trigger_beskrivelse": "Oppdagelse av feil ved kontroll",
    "frist_type": "UTEN_UGRUNNET_OPPHOLD",
    "konsekvens_type": "ANSVAR_SKADE",
    "konsekvens_beskrivelse": "BH blir ansvarlig for virkninger som kunne vært unngått."
}
```

---

## VERIFISERTE REGLER (Korrekte)

### 1. Endringshåndtering (Irregulær)
| Kode | Paragraf | Frist | Konsekvens | Status |
|------|----------|-------|------------|--------|
| VARSEL_IRREGULAER | 32.2 | UUO | PREKLUSJON_KRAV | ✓ |
| SVAR_IRREGULAER | 32.3 | UUO | PREKLUSJON_INNSIGELSE | ✓ |

### 2. Varsel om svikt/avvik
| Kode | Paragraf | Frist | Konsekvens | Status |
|------|----------|-------|------------|--------|
| VARSEL_SVIKT_BH | 34.1.2/25.1.2 | UUO | PREKLUSJON_KRAV | ✓ |
| VARSEL_RIGG_DRIFT | 34.1.3 | UUO | PREKLUSJON_KRAV | ✓ |

### 3. Fristforlengelse
| Kode | Paragraf | Frist | Konsekvens | Status |
|------|----------|-------|------------|--------|
| FRIST_VARSEL_NOEYTRALT | 33.4 | UUO | PREKLUSJON_KRAV | ✓ |
| FRIST_SPESIFISERING | 33.6.1 | UUO | REDUKSJON_SKJONN | ✓ |
| SVAR_PA_ETTERLYSNING | 33.6.2 | UUO | PREKLUSJON_KRAV | ✓ |
| BH_SVAR_KRAV | 33.7 | UUO | PREKLUSJON_INNSIGELSE | ✓ |

### 4. Prisjustering (Enhetspriser)
| Kode | Paragraf | Frist | Konsekvens | Status |
|------|----------|-------|------------|--------|
| VARSEL_EP_JUSTERING | 34.3.3 første ledd | UUO | REDUKSJON_SKJONN | ✓ |
| SVAR_EP_JUSTERING | 34.3.3 annet ledd | UUO | PREKLUSJON_INNSIGELSE | ✓ |

### 5. Regningsarbeid
| Kode | Paragraf | Frist | Konsekvens | Status |
|------|----------|-------|------------|--------|
| INNSENDING_OPPGAVER | 30.3.1 | 7 dager (ukentlig) | REDUKSJON_SKJONN | ✓ |
| KONTROLL_AV_OPPGAVER | 30.3.2 | 14 dager | PREKLUSJON_INNSIGELSE | ✓ |

### 6. Aktører og Kontraktsmedhjelpere
| Kode | Paragraf | Frist | Konsekvens | Status |
|------|----------|-------|------------|--------|
| NEKTELSE_VALG_MH | 10.2 | 14 dager | PREKLUSJON_INNSIGELSE | ✓ |
| NEKTELSE_TILTRANSPORT | 12.1.2 | 14 dager | PREKLUSJON_INNSIGELSE | ✓ |

### 7. Sluttoppgjør
| Kode | Paragraf | Frist | Konsekvens | Status |
|------|----------|-------|------------|--------|
| INNSIGELSER_SLUTTOPPSTILLING | 39.2 | Betalingsfrist | PREKLUSJON_INNSIGELSE | ✓ |

### 8. Mangel/Reklamasjon
| Kode | Paragraf | Frist | Konsekvens | Status |
|------|----------|-------|------------|--------|
| REKLAMASJON_OVERTAK | 42.2.1 | Ved avslutning | PREKLUSJON_KRAV | ✓ |
| REKLAMASJON_SENERE | 42.2.2 | Rimelig tid | PREKLUSJON_KRAV | ✓ |

---

## Konklusjon

Datasettet har god struktur og korrekt innhold for de fleste varslingsregler. De to typefeilene (INNEN_OPPSTART og INGEN_DIREKTE) bør rettes ved å utvide enum-definisjonene. De fire manglende reglene dekker viktige varslingsscenarier og bør vurderes for tillegg.

**Prioritert handlingsliste:**
1. Legg til `"INNEN_OPPSTART"` i FristType
2. Legg til `"INGEN_DIREKTE"` eller `"MULIGHET_PREKLUSJON"` i KonsekvensType
3. Vurder å legge til de 4 foreslåtte reglene
