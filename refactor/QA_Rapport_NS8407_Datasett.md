# QA-rapport: Komplett_Python_Datasett_NS 8407.py

**Dato:** 2025-12-05
**Kildetekst:** NS_8407.md
**Datasett:** Komplett_Python_Datasett_NS 8407.py

---

## Sammendrag

Kvalitetssikringen identifiserte **1 feil** og **3 forbedringsforslag**. Alle er nå rettet (2025-12-06). Hovedstrukturen og hjemmelreferanser er korrekte.

---

## FEIL

### 1. ~~NEKT_TILTRANSPORT - Feil hjemmel/beskrivelse-kombinasjon~~ ✅ RETTET (2025-12-06)

**Lokasjon:** `ANDRE > NEKT_TILTRANSPORT`

**Opprinnelig problem:** Beskrivelsen sa "BH nekter tiltransport" mens §12.1.2 handler om TEs rett til å nekte.

**Rettelse:**
```python
{
    "kode": "NEKT_TILTRANSPORT",
    "label": "Tvungen tiltransport",  # Endret fra "Nektelse av tiltransport"
    "hjemmel_basis": "12.1.2",
    "beskrivelse": "BH gjennomfører tiltransport til tross for TEs saklige innvendinger etter 12.1.2.",
    ...
}
```

Beskrivelsen reflekterer nå korrekt at dette handler om situasjonen der BH gjennomfører tiltransport mot TEs saklige innvendinger, som er BHs risiko.

---

## FORBEDRINGSFORSLAG

### 1. ~~MEDVIRK - Ufullstendig hjemmelreferanse for materialer~~ ✅ RETTET (2025-12-06)

**Lokasjon:** `SVIKT > MEDVIRK`

**Opprinnelig:** Beskrivelsen nevnte "materialer" men refererte kun til 22.3.

**Rettelse:**
```python
"beskrivelse": "Forsinkede tegninger, beslutninger, fysisk arbeidsgrunnlag (22.3) eller materialer (22.4)."
```

---

### 2. ~~FM_EGEN/FM_MH - Beskrivelse bruker eksempler fra annen paragraf~~ ✅ RETTET (2025-12-06)

**Lokasjon:** `FORCE_MAJEURE > FM_EGEN/FM_MH`

**Opprinnelig:** Eksemplene "krig, opprør, naturkatastrofe" var fra §19.1, ikke §33.3.

**Rettelse:**
```python
# FM_EGEN
"beskrivelse": "Ekstraordinære værforhold, offentlige påbud/forbud, streik, lockout etc. som rammer TE direkte."

# FM_MH
"beskrivelse": "Hindring hos kontraktsmedhjelper som skyldes forhold utenfor dennes kontroll."
```

Beskrivelsene bruker nå eksempler direkte fra §33.3.

---

### 3. SVAR_VARSEL - Hjemmelkombinasjon dekker ulike scenarier

**Lokasjon:** `ENDRING > SVAR_VARSEL`

**I datasettet:**
```python
{
    "hjemmel_basis": "25.3 / 32.3",
    "beskrivelse": "BHs svar på varsel om svikt/mangler innebærer en endring (f.eks. nye løsninger)."
}
```

**Observasjon:**
- 25.3: Svar på varsel om svikt/mangler
- 32.3: Svar på varsel om påstått irregulær endring

Beskrivelsen fokuserer kun på svikt-scenariet (25.3), men hjemmelen inkluderer også 32.3.

**Forslag:** Utvid beskrivelsen til å dekke begge scenarier, eller separer i to underkategorier.

---

## VERIFISERTE HJEMLER (Korrekte)

### Hovedkategorier
| Kategori | hjemmel_frist | hjemmel_vederlag | Status |
|----------|---------------|------------------|--------|
| ENDRING | 33.1 a) | 34.1.1 | ✓ |
| SVIKT | 33.1 b) | 34.1.2 | ✓ |
| ANDRE | 33.1 c) | 34.1.2 | ✓ |
| FORCE_MAJEURE | 33.3 | None | ✓ |

### Underkategorier (korrekte)
- **EO** (31.1 / 31.3): ✓
- **IRREG** (32.1 / 32.2): ✓
- **LOV_GJENSTAND** (14.4 / 32.2): ✓
- **LOV_PROSESS** (15.2 / 32.2): ✓
- **GEBYR** (26.3 / 32.2): ✓
- **SAMORD** (21.4 / 32.2): ✓
- **FORSERING** (33.8): ✓
- **ADKOMST** (22.2 / 34.1.2): ✓
- **GRUNN** (23.1 / 34.1.2/25.1.2): ✓
- **KULTURMINNER** (23.3 / 34.1.2/23.3 annet ledd): ✓
- **PROSJ_RISIKO** (24.1 / 34.1.2/25.2): ✓
- **BH_FASTHOLDER** (24.2.2 tredje ledd / 34.1.2): ✓
- **NEKT_MH** (10.2 / 34.1.2): ✓
- **SKADE_BH** (19.1 / 34.1.2/20.5): ✓
- **BRUKSTAKELSE** (38.1 annet ledd / 34.1.2/33.4): ✓
- **STANS_BET** (29.2 / 34.1.2/29.2): ✓
- **STANS_UENIGHET** (35.1 / 34.1.2): ✓
- **FM_EGEN** (33.3 første ledd / 33.4): ✓
- **FM_MH** (33.3 annet ledd / 33.4): ✓

---

## Konklusjon

Datasettet har høy kvalitet med korrekt strukturering av hovedkategorier og alle underkategorier.

**Status (2025-12-06):**
- ~~NEKT_TILTRANSPORT~~ ✅ Rettet
- ~~MEDVIRK~~ ✅ Rettet
- ~~FM_EGEN/FM_MH~~ ✅ Rettet
- SVAR_VARSEL: Valgfri forbedring (ikke kritisk)
