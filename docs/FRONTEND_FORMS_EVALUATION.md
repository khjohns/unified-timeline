# Frontend Forms Evaluation

**Dato:** 2025-12-03
**Status:** ⚠️ Kritiske gap funnet - Krever umiddelbar oppdatering
**Vurdert av:** Backend/Frontend Refaktoreringsarbeid

---

## 📋 Sammendrag

Alle 6 forms i `src/components/actions/` er evaluert mot de refaktorerte datamodellene i backend/models/ og frontend types/timeline.ts.

**Hovedfunn:**
- ✅ **3/6 forms** bruker constants korrekt (kategorier, metoder)
- ❌ **4/6 forms** har kritiske gaps mot VarselInfo-struktur
- 🔴 **2/6 forms** har subsidiær logikk-brytende felter
- ⚠️ **6/6 forms** mangler minst ett felt fra datamodellen

---

## 🔴 Kritiske problemer (må fikses ASAP)

### 1. RespondVederlagModal.tsx - Subsidiær logikk-bryter

**Linje 22:** Hardkodet `'avslatt_uenig_grunnlag'` i enum.

```typescript
// FEIL (linje 18-30):
const respondVederlagSchema = z.object({
  resultat: z.enum([
    'godkjent_fullt',
    'delvis_godkjent',
    'avslatt_uenig_grunnlag',  // ❌ SKAL IKKE VÆRE HER!
    'avslatt_for_sent',
    'avventer_spesifikasjon',
    'godkjent_annen_metode',
  ]),
  // ...
});
```

**Konsekvens:**
- Bryter subsidiær logikk: BH kan ikke avslå Vederlag pga. grunnlag-uenighet
- Vederlag-sporet må være "pure" - kun beregning, IKKE ansvar
- Motstrider fiksen i `src/constants/responseOptions.ts` (linje 13-20)

**Løsning:**
```typescript
import { BH_VEDERLAGSSVAR_OPTIONS, getBHVederlagssvarValues } from '../../constants';

const respondVederlagSchema = z.object({
  resultat: z.enum(getBHVederlagssvarValues()),  // Fra constants
  // ...
});

// I return (linje 118):
{BH_VEDERLAGSSVAR_OPTIONS.map((option) => (
  <option key={option.value} value={option.value}>
    {option.label}
  </option>
))}
```

---

### 2. RespondFristModal.tsx - Subsidiær logikk-bryter

**Linje 22:** Hardkodet `'avslatt_uenig_grunnlag'` i enum.

```typescript
// FEIL (linje 18-29):
const respondFristSchema = z.object({
  resultat: z.enum([
    'godkjent_fullt',
    'delvis_godkjent_bestrider_beregning',
    'avslatt_uenig_grunnlag',  // ❌ SKAL IKKE VÆRE HER!
    'avslatt_for_sent',
    'avventer_spesifikasjon',
  ]),
  // ...
});
```

**Ekstra problem:**
- Linje 21: `'delvis_godkjent_bestrider_beregning'` - backend bruker `'delvis_godkjent'`
- Backend har også `'avslatt_ingen_hindring'` som mangler

**Løsning:**
```typescript
import { BH_FRISTSVAR_OPTIONS, getBHFristsvarValues } from '../../constants';

const respondFristSchema = z.object({
  resultat: z.enum(getBHFristsvarValues()),  // Fra constants
  // ...
});

// I return (linje 115):
{BH_FRISTSVAR_OPTIONS.map((option) => (
  <option key={option.value} value={option.value}>
    {option.label}
  </option>
))}
```

---

## ⚠️ Alvorlige gaps (må fikses før produksjon)

### 3. SendGrunnlagModal.tsx - VarselInfo struktur mangler

**Problem:** Bruker flate felter i stedet for VarselInfo-struktur.

**Nåværende struktur (linje 39-40):**
```typescript
dato_varsel_sendt: z.string().optional(),
varsel_metode: z.array(z.string()).optional(),
```

**Submitter (linje 106-107):**
```typescript
dato_varsel_sendt: data.dato_varsel_sendt,
varsel_metode: data.varsel_metode,
```

**Backend forventer (backend/models/events.py linje 220):**
```python
grunnlag_varsel: Optional[VarselInfo] = Field(
    default=None,
    description="Info om når og hvordan grunnlag ble varslet til BH"
)
```

**Løsning:**
```typescript
// Schema:
const grunnlagSchema = z.object({
  // ... andre felter
  grunnlag_varsel_dato: z.string().optional(),  // Rename
  grunnlag_varsel_metoder: z.array(z.string()).optional(),  // Rename
});

// I onSubmit:
const grunnlagVarsel = data.grunnlag_varsel_dato
  ? {
      dato_sendt: data.grunnlag_varsel_dato,
      metode: data.grunnlag_varsel_metoder || [],
    }
  : undefined;

mutation.mutate({
  eventType: 'grunnlag_opprettet',
  data: {
    // ... andre felter
    grunnlag_varsel: grunnlagVarsel,  // Nested VarselInfo
  },
});
```

---

### 4. SendVederlagModal.tsx - Omfattende VarselInfo gaps

**Problem:** Mangler alle VarselInfo-felter for varsler.

**Backend forventer (backend/models/events.py linje 310-382):**
```python
# Rigg/drift
inkluderer_rigg_drift: Optional[bool]
rigg_drift_belop: Optional[int]
rigg_drift_varsel: Optional[VarselInfo]  # ❌ MANGLER I FORM

# Justert EP
justert_ep_varsel: Optional[VarselInfo]  # ❌ MANGLER I FORM

# Regningsarbeid
krever_regningsarbeid: Optional[bool]  # ❌ MANGLER I FORM
regningsarbeid_varsel: Optional[VarselInfo]  # ❌ MANGLER I FORM

# Produktivitetstap
inkluderer_produktivitetstap: Optional[bool]
produktivitetstap_belop: Optional[int]  # ❌ MANGLER I FORM
produktivitetstap_varsel: Optional[VarselInfo]  # ❌ MANGLER I FORM
```

**Nåværende form (linje 32-34):**
```typescript
inkluderer_produktivitetstap: z.boolean().optional(),
inkluderer_rigg_drift: z.boolean().optional(),
saerskilt_varsel_rigg_drift: z.boolean().optional(),  // ❌ FEIL TYPE
```

**Løsning:**

Legg til betingede felter basert på metode og inkluderinger:

```typescript
const vederlagSchema = z.object({
  krav_belop: z.number().min(1),
  metode: z.string().min(1),
  begrunnelse: z.string().min(10),

  // Rigg/drift
  inkluderer_rigg_drift: z.boolean().optional(),
  rigg_drift_belop: z.number().optional(),
  rigg_drift_varsel_dato: z.string().optional(),
  rigg_drift_varsel_metoder: z.array(z.string()).optional(),

  // Produktivitetstap
  inkluderer_produktivitetstap: z.boolean().optional(),
  produktivitetstap_belop: z.number().optional(),
  produktivitetstap_varsel_dato: z.string().optional(),
  produktivitetstap_varsel_metoder: z.array(z.string()).optional(),

  // Regningsarbeid
  krever_regningsarbeid: z.boolean().optional(),
  regningsarbeid_varsel_dato: z.string().optional(),
  regningsarbeid_varsel_metoder: z.array(z.string()).optional(),

  // Justert EP (vis kun hvis metode='justert_ep')
  justert_ep_varsel_dato: z.string().optional(),
  justert_ep_varsel_metoder: z.array(z.string()).optional(),
});

// I form UI:
{/* Vis rigg/drift-felter hvis inkluderer_rigg_drift=true */}
{watch('inkluderer_rigg_drift') && (
  <>
    <FormField label="Rigg/drift beløp">...</FormField>
    <FormField label="Varsel sendt (rigg/drift)">
      <DatePicker {...} />
    </FormField>
    <FormField label="Varselmetoder (rigg/drift)">
      <CheckboxGroup options={VARSEL_METODER_OPTIONS} />
    </FormField>
  </>
)}

{/* Vis regningsarbeid-felter hvis krever_regningsarbeid=true */}
{watch('krever_regningsarbeid') && (
  <FormField label="Varsel før oppstart (§30.1)" required>
    <DatePicker {...} />
  </FormField>
)}
```

**UX-anbefaling:** Bruk conditional rendering som SendGrunnlagModal gjør for underkategorier (linje 155-173).

---

### 5. SendFristModal.tsx - VarselInfo og feil varseltype

**Problem 1:** Bruker `frist_type` i stedet for `varsel_type`

**Nåværende (linje 22-25):**
```typescript
frist_type: z.enum(['uspesifisert_krav', 'spesifisert_krav'], {
  errorMap: () => ({ message: 'Fristtype er påkrevd' }),
}),
```

**Backend forventer (backend/models/events.py linje 489):**
```python
varsel_type: FristVarselType = Field(
    description="Type varsel sendt: noytralt, spesifisert, begge, eller force_majeure"
)
# Enum: noytralt | spesifisert | begge | force_majeure
```

**Problem 2:** Mangler VarselInfo-felter

**Backend forventer (linje 493-501):**
```python
noytralt_varsel: Optional[VarselInfo] = Field(
    default=None,
    description="Info om nøytralt varsel (§33.4) - dato + metode"
)

spesifisert_varsel: Optional[VarselInfo] = Field(
    default=None,
    description="Info om spesifisert krav (§33.6) - dato + metode"
)
```

**Problem 3:** Mangler flere felter

```python
fremdriftshindring_dokumentasjon: Optional[str]  # ❌ MANGLER
ny_sluttdato: Optional[str]  # ❌ MANGLER
vedlegg_ids: Optional[List[str]]  # ❌ MANGLER
```

**Løsning:**

```typescript
const fristSchema = z.object({
  varsel_type: z.enum(['noytralt', 'spesifisert', 'begge', 'force_majeure']),  // FIX

  // VarselInfo for nøytralt
  noytralt_varsel_dato: z.string().optional(),
  noytralt_varsel_metoder: z.array(z.string()).optional(),

  // VarselInfo for spesifisert
  spesifisert_varsel_dato: z.string().optional(),
  spesifisert_varsel_metoder: z.array(z.string()).optional(),

  antall_dager: z.number().min(1),
  begrunnelse: z.string().min(10),
  fremdriftshindring_dokumentasjon: z.string().optional(),  // NEW
  ny_sluttdato: z.string().optional(),  // NEW
  pavirker_kritisk_linje: z.boolean().optional(),
  vedlegg_ids: z.array(z.string()).optional(),  // NEW
});

// UI:
<FormField label="Varseltype" required>
  <RadioGroup>
    <RadioItem value="noytralt" label="Nøytralt varsel (§33.4)" />
    <RadioItem value="spesifisert" label="Spesifisert krav (§33.6)" />
    <RadioItem value="begge" label="Begge varsler sendt" />
    <RadioItem value="force_majeure" label="Force majeure (§33.3)" />
  </RadioGroup>
</FormField>

{/* Vis nøytralt varsel-felter hvis varsel_type='noytralt' eller 'begge' */}
{(watch('varsel_type') === 'noytralt' || watch('varsel_type') === 'begge') && (
  <FormField label="Nøytralt varsel - Dato sendt">
    <DatePicker {...} />
  </FormField>
  <FormField label="Nøytralt varsel - Metoder">
    <CheckboxGroup options={VARSEL_METODER_OPTIONS} />
  </FormField>
)}

{/* Vis spesifisert varsel-felter hvis varsel_type='spesifisert' eller 'begge' */}
{(watch('varsel_type') === 'spesifisert' || watch('varsel_type') === 'begge') && (
  <FormField label="Spesifisert krav - Dato sendt" required>
    <DatePicker {...} />
  </FormField>
  <FormField label="Spesifisert krav - Metoder">
    <CheckboxGroup options={VARSEL_METODER_OPTIONS} />
  </FormField>
)}
```

---

### 6. RespondGrunnlagModal.tsx - Type og constants import

**Problem:**
- Linje 24: Importerer `ResponsResultat` som ikke lenger finnes
- Linje 44: Bruker `ResponsResultat` i type-definisjon
- Linje 27-32, 44-50: Hardkodet enum i stedet for å bruke constants

**Backend (backend/models/events.py linje 138):**
```python
class GrunnlagResponsResultat(str, Enum):
    """Resultat av BHs vurdering av grunnlag"""
    GODKJENT = "godkjent"
    DELVIS_GODKJENT = "delvis_godkjent"
    AVVIST_UENIG = "avvist_uenig"
    AVVIST_FOR_SENT = "avvist_for_sent"
    KREVER_AVKLARING = "krever_avklaring"
```

**Løsning:**
```typescript
// Import:
import { BH_GRUNNLAGSVAR_OPTIONS, getBHGrunnlagsvarValues } from '../../constants';

// Schema:
const respondGrunnlagSchema = z.object({
  resultat: z.enum(getBHGrunnlagsvarValues()),
  begrunnelse: z.string().min(10),
});

// Fjern hardkodet RESULTAT_OPTIONS (linje 44-50)

// I return (linje 111):
{BH_GRUNNLAGSVAR_OPTIONS.map((option) => (
  <SelectItem key={option.value} value={option.value}>
    {option.label}
  </SelectItem>
))}
```

---

## ✅ Ting som fungerer bra

### SendGrunnlagModal.tsx
- ✅ Bruker HOVEDKATEGORI_OPTIONS fra constants (linje 143)
- ✅ Bruker getUnderkategorier() helper (linje 155)
- ✅ Bruker VARSEL_METODER_OPTIONS fra constants (linje 239)
- ✅ God UX: Conditional rendering av underkategorier (linje 155-173)
- ✅ Splitter kontraktsreferanser string til array (linje 95-97)

### SendVederlagModal.tsx
- ✅ Bruker VEDERLAGSMETODER_OPTIONS fra constants (linje 26, 119)
- ✅ Filtrerer bort tom option (linje 119)

### SendFristModal.tsx
- ✅ Har pavirker_kritisk_linje checkbox (linje 141-145)
- ✅ God form layout og validering

---

## 📋 Prioritert oppgaveliste

### Prio 1: Kritiske feil (ASAP)

1. **RespondVederlagModal.tsx**
   - Fjern `'avslatt_uenig_grunnlag'` fra enum (linje 22)
   - Importer og bruk BH_VEDERLAGSSVAR_OPTIONS fra constants
   - Legg til `'avslatt_totalt'` til enum

2. **RespondFristModal.tsx**
   - Fjern `'avslatt_uenig_grunnlag'` fra enum (linje 22)
   - Endre `'delvis_godkjent_bestrider_beregning'` til `'delvis_godkjent'`
   - Legg til `'avslatt_ingen_hindring'` til enum
   - Importer og bruk BH_FRISTSVAR_OPTIONS fra constants

3. **RespondGrunnlagModal.tsx**
   - Endre `ResponsResultat` til bruk av BH_GRUNNLAGSVAR_OPTIONS
   - Fjern hardkodet enum (linje 27-32)
   - Fjern hardkodet RESULTAT_OPTIONS (linje 44-50)

### Prio 2: VarselInfo struktur (før produksjon)

4. **SendGrunnlagModal.tsx**
   - Refaktorer dato_varsel_sendt + varsel_metode til grunnlag_varsel: VarselInfo
   - Test at backend mottar riktig struktur

5. **SendVederlagModal.tsx**
   - Legg til rigg_drift_varsel (VarselInfo) med conditional rendering
   - Legg til produktivitetstap_varsel (VarselInfo) med conditional rendering
   - Legg til regningsarbeid_varsel (VarselInfo) med conditional rendering
   - Legg til justert_ep_varsel (VarselInfo) hvis metode='justert_ep'
   - Legg til manglende beløp-felter (rigg_drift_belop, produktivitetstap_belop)
   - Legg til krever_regningsarbeid checkbox

6. **SendFristModal.tsx**
   - Endre frist_type til varsel_type med 4 verdier
   - Legg til noytralt_varsel (VarselInfo) med conditional rendering
   - Legg til spesifisert_varsel (VarselInfo) med conditional rendering
   - Legg til fremdriftshindring_dokumentasjon felt
   - Legg til ny_sluttdato felt
   - Legg til vedlegg_ids felt

### Prio 3: Constants helpers (forenkler vedlikehold)

7. **Lag helper-funksjoner i constants**
   - `getBHGrunnlagsvarValues()` som returnerer array av enum values
   - `getBHVederlagssvarValues()` som returnerer array av enum values
   - `getBHFristsvarValues()` som returnerer array av enum values
   - `getFristVarseltypeValues()` som returnerer array av enum values

---

## 🧪 Testing-anbefalinger

Etter hver endring:

1. **TypeScript compile check:**
   ```bash
   npm run typecheck
   ```

2. **Runtime validering:**
   - Fyll ut hvert skjema i browser
   - Inspiser network request payload (DevTools > Network)
   - Sammenlign med backend event schema (backend/models/events.py)

3. **Validering mot backend:**
   ```python
   # I backend/tests/test_events.py
   def test_grunnlag_event_with_varsel_info():
       data = {
           "event_type": "grunnlag_opprettet",
           "sak_id": "SAK-001",
           "aktor": "Test",
           "aktor_rolle": "TE",
           "data": {
               "hovedkategori": "forsinkelse_bh",
               "underkategori": ["prosjektering"],
               "beskrivelse": "Test",
               "dato_oppdaget": "2025-01-10",
               "grunnlag_varsel": {
                   "dato_sendt": "2025-01-11",
                   "metode": ["epost", "byggemote"]
               }
           }
       }
       event = parse_event_from_request(data)
       assert event.data.grunnlag_varsel.dato_sendt == "2025-01-11"
       assert event.data.grunnlag_varsel.metode == ["epost", "byggemote"]
   ```

---

## 📊 Gap-analyse oppsummert

| Form | Constants OK | VarselInfo OK | All Fields OK | Subsidiary Logic OK | Status |
|------|--------------|---------------|---------------|---------------------|--------|
| SendGrunnlagModal | ✅ | ❌ | ❌ | N/A | ⚠️ Trenger fix |
| RespondGrunnlagModal | ❌ | N/A | ✅ | ✅ | ⚠️ Trenger fix |
| SendVederlagModal | ✅ | ❌ | ❌ | N/A | 🔴 Omfattende gaps |
| RespondVederlagModal | ❌ | N/A | ⚠️ | ❌ | 🔴 Kritisk feil |
| SendFristModal | ⚠️ | ❌ | ❌ | N/A | 🔴 Omfattende gaps |
| RespondFristModal | ❌ | N/A | ⚠️ | ❌ | 🔴 Kritisk feil |

**Totalt:**
- 🔴 **4 kritiske feil** (subsidiær logikk + omfattende gaps)
- ⚠️ **2 moderate gaps** (mangler noen felter)
- ✅ **0 fullstendig oppdaterte forms**

---

## 🎯 Suksesskriterier for ferdigstillelse

- ✅ Alle forms bruker BH_GRUNNLAGSVAR_OPTIONS, BH_VEDERLAGSSVAR_OPTIONS, BH_FRISTSVAR_OPTIONS
- ✅ Ingen hardkodede enum-verdier i Zod schemas
- ✅ Alle VarselInfo-felter implementert med dato_sendt + metode struktur
- ✅ `avslatt_uenig_grunnlag` fjernet fra Vederlag og Frist-responser
- ✅ SendVederlagModal har alle 4 VarselInfo-felter med conditional rendering
- ✅ SendFristModal bruker varsel_type (ikke frist_type) med 4 verdier
- ✅ Alle forms matcher backend/models/events.py nøyaktig
- ✅ TypeScript kompilerer uten feil
- ✅ Runtime testing bekrefter payload-struktur

---

**Estimat:** 6-8 timer arbeid (spredt over 2-3 dager)
**Ansvarlig:** Frontend-teamet
**Blokkerer:** Produksjonssetting av Event Sourcing-systemet

**Neste steg:** Start med Prio 1 (kritiske feil) for å unngå subsidiær logikk-brudd.
