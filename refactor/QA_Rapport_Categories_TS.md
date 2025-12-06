# QA-rapport: categories.ts

**Dato:** 2025-12-05
**Fil:** src/constants/categories.ts
**Referanser:** Komplett_Python_Datasett_NS 8407.py, NS_8407.md

---

## Sammendrag

**Konklusjon: TypeScript-implementeringen er en korrekt oversettelse av Python-datasettet.**

Alle hovedkategorier, underkategorier, hjemmelreferanser og varselkrav matcher Python-datasettet. De samme feilene/forbedringspunktene som ble identifisert i Python-QA-rapporten gjelder derfor også her.

---

## Verifisering mot Python-datasett

### Hovedkategorier

| Kode | hjemmel_frist | hjemmel_vederlag | standard_vederlagsmetode | Match |
|------|---------------|------------------|--------------------------|-------|
| ENDRING | 33.1 a) | 34.1.1 | Enhetspriser (34.3) | ✓ |
| SVIKT | 33.1 b) | 34.1.2 | Regningsarbeid (34.4) | ✓ |
| ANDRE | 33.1 c) | 34.1.2 | Regningsarbeid (34.4) | ✓ |
| FORCE_MAJEURE | 33.3 | null | Ingen (Kun fristforlengelse) | ✓ |

### Underkategorier ENDRING (8 stk)

| Kode | hjemmel_basis | varselkrav_ref | Match |
|------|---------------|----------------|-------|
| EO | 31.1 | 31.3 (Mottatt ordre) | ✓ |
| IRREG | 32.1 | 32.2 | ✓ |
| SVAR_VARSEL | 25.3 / 32.3 | 32.2 | ✓ |
| LOV_GJENSTAND | 14.4 | 32.2 | ✓ |
| LOV_PROSESS | 15.2 | 32.2 | ✓ |
| GEBYR | 26.3 | 32.2 | ✓ |
| SAMORD | 21.4 | 32.2 | ✓ |
| FORSERING | 33.8 | 33.8 (Før iverksettelse) | ✓ |

### Underkategorier SVIKT (6 stk)

| Kode | hjemmel_basis | varselkrav_ref | Match |
|------|---------------|----------------|-------|
| MEDVIRK | 22 | 34.1.2 / 25.1.2 | ✓ |
| ADKOMST | 22.2 | 34.1.2 | ✓ |
| GRUNN | 23.1 | 34.1.2 / 25.1.2 | ✓ |
| KULTURMINNER | 23.3 | 34.1.2 / 23.3 annet ledd | ✓ |
| PROSJ_RISIKO | 24.1 | 34.1.2 / 25.2 | ✓ |
| BH_FASTHOLDER | 24.2.2 tredje ledd | 34.1.2 | ✓ |

### Underkategorier ANDRE (6 stk)

| Kode | hjemmel_basis | varselkrav_ref | Match |
|------|---------------|----------------|-------|
| NEKT_MH | 10.2 | 34.1.2 | ✓ |
| NEKT_TILTRANSPORT | 12.1.2 | 34.1.2 / 12.1.2 annet ledd | ✓ |
| SKADE_BH | 19.1 | 34.1.2 / 20.5 | ✓ |
| BRUKSTAKELSE | 38.1 annet ledd | 34.1.2 / 33.4 | ✓ |
| STANS_BET | 29.2 | 34.1.2 / 29.2 | ✓ |
| STANS_UENIGHET | 35.1 | 34.1.2 | ✓ |

### Underkategorier FORCE_MAJEURE (2 stk)

| Kode | hjemmel_basis | varselkrav_ref | Match |
|------|---------------|----------------|-------|
| FM_EGEN | 33.3 første ledd | 33.4 | ✓ |
| FM_MH | 33.3 annet ledd | 33.4 | ✓ |

---

## Arvede Feil fra Python-datasett

### 1. ~~NEKT_TILTRANSPORT - Feil hjemmel/beskrivelse~~ ✅ RETTET (2025-12-06)

**Opprinnelig problem:** Beskrivelsen sa "BH nekter tiltransport" mens §12.1.2 handler om TEs rett til å nekte.

**Rettelse:**
```typescript
{
  kode: 'NEKT_TILTRANSPORT',
  label: 'Tvungen tiltransport',  // Endret fra "Nektelse av tiltransport"
  hjemmel_basis: '12.1.2',
  beskrivelse: 'BH gjennomfører tiltransport til tross for TEs saklige innvendinger etter 12.1.2.',
  ...
}
```

Beskrivelsen reflekterer nå korrekt at dette handler om situasjonen der BH gjennomfører tiltransport mot TEs saklige innvendinger.

---

## Forbedringsforslag (arvet fra Python-QA)

### 1. MEDVIRK - Ufullstendig referanse

**Nåværende:**
```typescript
beskrivelse: 'Forsinkede tegninger, beslutninger, materialer eller fysisk arbeidsgrunnlag (22.3).',
```

**Problem:** Beskrivelsen nevner "materialer", men §22.3 handler om fysisk arbeidsgrunnlag. Materialleveranse er dekket av §22.4.

**Forslag:** Endre til `"(22.3/22.4)"` eller fjern "materialer".

---

### 2. FM_EGEN/FM_MH - Eksempler fra feil paragraf

**Nåværende:**
```typescript
beskrivelse: 'Krig, opprør, naturkatastrofe, streik etc. som rammer TE direkte.',
```

**Problem:** Eksemplene "krig, opprør, naturkatastrofe" er fra §19.1, ikke §33.3.

**Fra §33.3:**
> "...ekstraordinære værforhold, offentlige påbud og forbud, streik, lockout og overenskomstbestemmelser."

---

## Verifiserte Hjelpefunksjoner

| Funksjon | Formål | Korrekt |
|----------|--------|---------|
| `getUnderkategorier()` | Hent underkategorier for hovedkategori | ✓ |
| `getHovedkategoriLabel()` | Hent label fra kode | ✓ |
| `getUnderkategoriLabel()` | Hent underkategori label | ✓ |
| `getHovedkategori()` | Hent fullt objekt | ✓ |
| `getUnderkategoriObj()` | Hent fullt underkategori-objekt | ✓ |
| `erLovendring()` | Sjekk LOV_GJENSTAND/LOV_PROSESS/GEBYR | ✓ |
| `erForceMajeure()` | Sjekk FORCE_MAJEURE | ✓ |
| `erIrregulaerEndring()` | Sjekk ENDRING + IRREG | ✓ |
| `getTypeKrav()` | Hent type krav (Tid/Penger/Begge) | ✓ |
| `getHjemmelReferanser()` | Hent alle hjemler for et krav | ✓ |

---

## TypeScript-spesifikke Observasjoner

### Styrker

1. **Type-sikkerhet**: Interfaces `Hovedkategori` og `Underkategori` sikrer konsistent struktur
2. **Null-håndtering**: `hjemmel_vederlag: string | null` håndterer FM korrekt
3. **Legacy-kompatibilitet**: `HOVEDKATEGORI_OPTIONS` og `UNDERKATEGORI_MAP` bevarer bakoverkompatibilitet
4. **Hjelpefunksjoner**: Godt utvalg av utility-funksjoner for oppslag

### Potensielle Forbedringer

1. **Const assertions**: Vurder `as const` på KRAV_STRUKTUR_NS8407 for enda strengere typing
2. **Eksport av typer**: Vurder å eksportere TypeKrav og StandardVederlagsmetode for gjenbruk

---

## Konklusjon

**categories.ts er korrekt implementert** som en TypeScript-versjon av Python-datasettet.

**Status:**
1. ~~Rett NEKT_TILTRANSPORT (feil/beskrivelse mismatch)~~ ✅ RETTET (2025-12-06)
2. Vurder forbedringsforslagene for MEDVIRK og FM-beskrivelser
3. Vurder TypeScript-forbedringene for økt type-sikkerhet
