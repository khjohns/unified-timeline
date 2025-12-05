# QA-rapport: Komplett_Python_Datasett_NS 8407.py

**Dato:** 2025-12-05
**Kildetekst:** NS_8407.md
**Datasett:** Komplett_Python_Datasett_NS 8407.py

---

## Sammendrag

Kvalitetssikringen identifiserte **1 feil** og **3 forbedringsforslag**. Hovedstrukturen og de fleste hjemmelreferanser er korrekte.

---

## FEIL

### 1. NEKT_TILTRANSPORT - Feil hjemmel/beskrivelse-kombinasjon

**Lokasjon:** `ANDRE > NEKT_TILTRANSPORT`

**I datasettet:**
```python
{
    "kode": "NEKT_TILTRANSPORT",
    "label": "Nektelse av tiltransport",
    "hjemmel_basis": "12.1.2",
    "beskrivelse": "BH nekter tiltransport av sideentreprenør/TE uten saklig grunn.",
    ...
}
```

**Problem:** Hjemmel 12.1.2 handler om *totalentreprenørens* rett til å nekte en tiltransport, ikke byggherrens nektelse. Beskrivelsen antyder at BH nekter, men hjemmelen gir TE rett til å nekte.

**Fra kildetekst (12.1.2):**
> "Totalentreprenøren kan nekte å godta en tiltransport etter 12.2 og 12.3 dersom han godtgjør at det foreligger saklig grunn."

**Forslag til rettelse:**
- Enten endre beskrivelsen til å handle om konsekvenser av TEs nektelse, eller
- Finne alternativ hjemmel dersom intensjonen er å dekke BHs usaklige nektelse

---

## FORBEDRINGSFORSLAG

### 1. MEDVIRK - Ufullstendig hjemmelreferanse for materialer

**Lokasjon:** `SVIKT > MEDVIRK`

**I datasettet:**
```python
"beskrivelse": "Forsinkede tegninger, beslutninger, materialer eller fysisk arbeidsgrunnlag (22.3)."
```

**Observasjon:** Beskrivelsen nevner "materialer", men refererer kun til 22.3. Materialleveranse er dekket av **22.4**.

**Fra kildetekst:**
- 22.3: Fysisk arbeidsgrunnlag
- 22.4: "Byggherren skal levere materialer og produkter..."

**Forslag:** Endre referansen til "(22.3/22.4)" eller fjern "materialer" fra beskrivelsen.

---

### 2. FM_EGEN/FM_MH - Beskrivelse bruker eksempler fra annen paragraf

**Lokasjon:** `FORCE_MAJEURE > FM_EGEN`

**I datasettet:**
```python
"beskrivelse": "Krig, opprør, naturkatastrofe, streik etc. som rammer TE direkte."
```

**Observasjon:** Eksemplene "krig, opprør, naturkatastrofe" er fra 19.1, ikke fra 33.3.

**Fra kildetekst (33.3):**
> "...forhold utenfor deres kontroll, så som ekstraordinære værforhold, offentlige påbud og forbud, streik, lockout og overenskomstbestemmelser."

**Forslag:** Justér beskrivelsen til å bruke eksempler fra 33.3, eller legg til referanse til 19.1.

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

Datasettet har høy kvalitet med korrekt strukturering av hovedkategorier og de fleste underkategorier. Den identifiserte feilen (NEKT_TILTRANSPORT) bør rettes, og forbedringsforslagne kan vurderes for økt presisjon.
