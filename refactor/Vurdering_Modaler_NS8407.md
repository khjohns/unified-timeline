# Vurdering: Modaler for Vederlagsjustering og Fristforlengelse

**Dato:** 2025-12-05
**Analyserte filer:** `src/components/actions/*.tsx`
**Referanse:** NS 8407, Datasett_varslingsregler_8407.py, Komplett_Python_Datasett_NS 8407.py

---

## Overordnet Vurdering

**Konklusjon: Modalene er godt implementert og følger NS 8407-strukturen på en solid måte.**

Tre-spors arkitekturen (Grunnlag → Frist + Vederlag) med event sourcing via `grunnlagEventId` er korrekt implementert og reflekterer standardens logiske struktur.

---

## Styrker

### 1. Korrekt Event Sourcing Arkitektur
- Alle krav (frist/vederlag) kobles til grunnlag via `grunnlagEventId`
- Subsidiær behandling håndteres elegant når grunnlag er avvist
- VarselInfo-struktur med `dato_sendt` og `metode` støtter sporing av varsler

### 2. Preklusjonsvarsler (TE-side)
| Modal | Preklusjonssjekk | Hjemmel |
|-------|------------------|---------|
| SendGrunnlagModal | ✓ Dager siden oppdagelse | §32.2/§34.1.2 |
| SendFristModal | ✓ BH etterlysning kritisk varsel | §33.6.2 |
| SendFristModal | ✓ Reduksjonsvarsel ved sen spesifisering | §33.6.1 |
| SendVederlagModal | ✓ 7-dagers sjekk for rigg/drift | §34.1.3 |
| SendVederlagModal | ✓ Bevisbyrde-varsel ved manglende forhåndsvarsel | §34.4 |

### 3. Metodespesifikk Vederlagshåndtering
```
ENHETSPRISER (§34.3):
  - Direkte beløp (støtter negative for fradrag)
  - Checkbox for justert enhetspris (§34.3.3)

REGNINGSARBEID (§34.4):
  - Kostnadsoverslag i stedet for fast beløp
  - Forhåndsvarsel-checkbox med bevisbyrde-advarsel

FASTPRIS (§34.2.1):
  - Enkelt beløpsfelt
```

### 4. Særskilte Krav (§34.1.3)
- Rigg/drift og produktivitet som separate checkboxer
- Felles dato "klar over" for preklusjonsberegning
- 7-dagers fristsjekk med visuell advarsel

### 5. Force Majeure Spesialhåndtering
- RespondGrunnlagModal filtrerer til kun "erkjenn FM"-alternativ
- Info om at FM kun gir tid, ikke penger (§33.3)
- SendFristModal har force_majeure som varseltype

### 6. BH Respons-logikk
| Modal | Spesialfunksjon | Hjemmel |
|-------|-----------------|---------|
| RespondGrunnlagModal | Passivitetsvarsel >10 dager | §32.3 |
| RespondGrunnlagModal | Frafall-alternativ for irregulære | §32.3 c) |
| RespondVederlagModal | Hold tilbake ved manglende overslag | §30.2 |
| RespondVederlagModal | Svarplikt-varsel ved EP-justering | §34.3.3 |
| RespondVederlagModal | Rigg-preklusjons-alternativ | §34.1.3 |
| RespondFristModal | Forsering-info ved avslag | §33.8 |

---

## Forbedringsområder

### 1. Manglende BH Preklusjonsvarsler (ANBEFALT)

BH-modalene varsler ikke om egen preklusjonsrisiko ved passivitet.

**RespondFristModal:**
```
Mangler: §33.7 - "Den parten som mottar krav på fristforlengelse,
skal svare uten ugrunnet opphold... Innsigelser mot kravet tapes
dersom de ikke fremsettes innen fristen."
```

**RespondVederlagModal:**
```
Mangler: §34.3.3 annet ledd - "Dersom det ikke svares innen fristen,
mister parten sine innsigelser mot kravet."
```

**Forslag:** Legg til tidsberegning og varsel når BH har brukt lang tid på å svare.

---

### 2. Manglende §5 Tredje Ledd Håndtering (VALGFRITT)

Ingen modal håndterer protest mot for sent mottatt varsel:
```
§5 tredje ledd: "Hvis en part ønsker å gjøre gjeldende at den andre
parten har varslet eller svart for sent, må han gjøre det skriftlig
uten ugrunnet opphold etter å ha mottatt varsel eller svar."
```

**Forslag:** Vurder å legge til "Protest mot forsent varsel"-alternativ i BH-responser.

---

### 3. Fristberegningsveiledning (VALGFRITT)

SendFristModal mangler veiledning om §33.5:
```
§33.5: "Fristforlengelsen skal svare til den virkning på fremdriften
som forhold nevnt i 33.1, 33.2 og 33.3 har forårsaket, der det blant
annet tas hensyn til nødvendig avbrudd og eventuell forskyvning..."
```

**Forslag:** Legg til hjelpetekst eller lenke til beregningsprinsippene.

---

### 4. Absolutt Reklamasjonsfrist (VALGFRITT)

Hvis systemet skal håndtere mangler (§42), mangler absolutt 5-årsfrist:
```
§42.2.2: "Reklamasjon kan ikke fremsettes senere enn 5 år etter overtakelsen."
```

---

## Verifisert Dekning av Varslingsregler

| Regel | Dekket | Modal |
|-------|--------|-------|
| VARSEL_IRREGULAER (§32.2) | ✓ | SendGrunnlagModal |
| SVAR_IRREGULAER (§32.3) | ✓ | RespondGrunnlagModal |
| VARSEL_SVIKT_BH (§34.1.2/25.1.2) | ✓ | SendGrunnlagModal |
| VARSEL_RIGG_DRIFT (§34.1.3) | ✓ | SendVederlagModal |
| FRIST_VARSEL_NOEYTRALT (§33.4) | ✓ | SendFristModal |
| FRIST_SPESIFISERING (§33.6.1) | ✓ | SendFristModal |
| SVAR_PA_ETTERLYSNING (§33.6.2) | ✓ | SendFristModal |
| BH_SVAR_KRAV (§33.7) | Delvis* | RespondFristModal |
| VARSEL_EP_JUSTERING (§34.3.3) | ✓ | SendVederlagModal |
| SVAR_EP_JUSTERING (§34.3.3) | Delvis* | RespondVederlagModal |
| VARSEL_OPPSTART_REGNING (§34.4) | ✓ | SendVederlagModal |
| KONTROLL_AV_OPPGAVER (§30.3.2) | N/A | (Krever løpende kontroll-modul) |
| NEKTELSE_VALG_MH (§10.2) | N/A | (Utenfor scope) |

*Delvis: Funksjonalitet finnes, men mangler eksplisitt preklusjonsvarsel for BH.

---

## Dataflyt-diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SendGrunnlagModal                             │
│  - Hovedkategori (ENDRING/SVIKT/ANDRE/FM)                       │
│  - Underkategori med hjemler                                     │
│  - VarselInfo (dato + metode)                                    │
│  - Preklusjonssjekk                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    grunnlag_event_id
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────────┐               ┌───────────────────────┐
│   SendFristModal      │               │  SendVederlagModal    │
│  - Varseltype         │               │  - Metode (EP/REG/FP) │
│  - Nøytralt §33.4     │               │  - Beløp/Overslag     │
│  - Spesifisert §33.6  │               │  - Særskilte §34.1.3  │
│  - Antall dager       │               │  - Justert EP §34.3.3 │
│  - Etterlysning §33.6.2│              │  - Forhåndsvarsel     │
└───────────────────────┘               └───────────────────────┘
        │                                           │
        ▼                                           ▼
┌───────────────────────┐               ┌───────────────────────┐
│  RespondFristModal    │               │ RespondVederlagModal  │
│  - Godkjent/Avslått   │               │  - Godkjent/Avslått   │
│  - Forsering §33.8    │               │  - Hold tilbake §30.2 │
│  - Subsidiær          │               │  - EP-svar §34.3.3    │
└───────────────────────┘               └───────────────────────┘
```

---

## Konklusjon

**Vurdering: 8/10**

Modalene implementerer NS 8407-kravene på en profesjonell måte med:
- Korrekt juridisk struktur og hjemmelreferanser
- God brukeropplevelse med kontekstuelle advarsler
- Solid event sourcing-arkitektur

**Prioriterte forbedringer:**
1. (Høy) Legg til BH preklusjonsvarsler (§33.7, §34.3.3)
2. (Middels) Vurder §5 tredje ledd håndtering
3. (Lav) Utvid veiledning for fristberegning (§33.5)
