# Refaktorering av Event Sourcing Datamodeller

**Dato:** 2025-12-03  
**Scope:** Backend models + Frontend types + Constants  
**Status:** ✅ Ferdig - Klar for review

---

## 🎯 Hovedmål

1. **Subsidiær logikk:** Vederlag/Frist-modeller er "rene" - kun beregning, ikke ansvar
2. **Varselstruktur:** Enhetlig `VarselInfo`-modell for formelle/uformelle varsler
3. **Kategori-mapping:** Forretningslogikk flyttes til dedikerte constants
4. **Syntaksrens:** Alle feil fikset, validatorer lagt til

---

## ✅ Gjennomførte endringer

### 1. Kritiske syntaksfeil (events.py)

**Fikset:**
- Line 76: `OVERSLAG = "overslag" SKJONN = "skjonn"` → Fjernet SKJONN, beholdt OVERSLAG
- Line 95: `FORCE_MAJEURE "force_majeure"` → `FORCE_MAJEURE = "force_majeure"`
- Line 103: `AVSLATT_INGEN_HINDRING = "avslått"` → `= "avslatt_ingen_hindring"`
- Line 465+481: Duplikat `begrunnelse` fjernet

### 2. VarselInfo-struktur innført

```python
class VarselInfo(BaseModel):
    dato_sendt: Optional[str]
    metode: Optional[List[str]]  # ['epost', 'byggemote']
```

**Brukes i:**
- `GrunnlagData.grunnlag_varsel`
- `VederlagData.rigg_drift_varsel`
- `VederlagData.justert_ep_varsel`
- `VederlagData.regningsarbeid_varsel`
- `VederlagData.produktivitetstap_varsel`

### 3. ResponsData fjernet

**Før:** Abstrakt `ResponsData` (med udefinert `ResponsResultat`)  
**Etter:** Spesifikk `GrunnlagResponsResultat` enum + `GrunnlagResponsData` BaseModel

### 4. Subsidiær logikk - Omfattende kommentarer

Lagt til i `sak_state.py`:
```python
# VIKTIG FOR FRONTEND:
# Subsidiær logikk = KOMBINASJON av:
#   1. Grunnlag AVVIST
#   2. Vederlag/Frist GODKJENT
# → Vises som "Avslått pga. ansvar (Subsidiært enighet om X)"
```

**Computed fields:**
- `er_subsidiaert_vederlag`
- `er_subsidiaert_frist`
- `visningsstatus_vederlag`
- `visningsstatus_frist`

### 5. Validator for `har_bh_etterlyst`

```python
@field_validator('har_bh_etterlyst')
def validate_etterlyst(cls, v, info):
    if v is not None and info.data.get('spesifisert_krav_ok') is True:
        raise ValueError("Krav som kom i tide trenger ikke etterlyses")
```

### 6. Backend constants opprettet

**`backend/constants/grunnlag_categories.py`:**
- 8 hovedkategorier (endring_initiert_bh, forsinkelse_bh, grunnforhold, etc.)
- ~25 underkategorier med NS 8407-referanser
- Helper functions: `get_hovedkategori()`, `validate_kategori_kombinasjon()`

**`backend/constants/vederlag_methods.py`:**
- 5 vederlagsmetoder (kontrakt_ep, justert_ep, regning, overslag, tilbud)
- 4 varselkrav (rigg_drift, produktivitetstap, justerte_ep, regningsarbeid_oppstart)
- Metadata: indeksregulering, varselfrister, dokumentasjonskrav
- Helper functions: `krever_indeksregulering()`, `krever_forhåndsvarsel()`

### 7. Frontend types synkronisert (timeline.ts)

**Endringer:**
- ✅ `FristVarselType` + `force_majeure`
- ✅ `VederlagsMetode`: Fjernet `skjonn`, lagt til `overslag`
- ✅ `FristBeregningResultat` + `avslatt_ingen_hindring`
- ✅ `ResponsResultat` → `GrunnlagResponsResultat`
- ✅ `VarselInfo` interface
- ✅ Alle event data og tilstands-interfaces oppdatert

---

## 🔍 Kvalitetssikring

```bash
✅ python3 -m py_compile backend/models/events.py
✅ python3 -m py_compile backend/models/sak_state.py
✅ python3 -m py_compile backend/constants/*.py
✅ npx tsc --noEmit src/types/timeline.ts
```

**Resultat:** Ingen syntaksfeil ✅

---

## 📋 Breaking Changes

### Datamigrering påkrevd:

**1. GrunnlagData:**
```python
# Før:                              # Etter:
dato_varsel_sendt: Optional[str]    grunnlag_varsel: Optional[VarselInfo]
varsel_metode: Optional[List[str]]  # → grunnlag_varsel.dato_sendt
                                    # → grunnlag_varsel.metode
```

**2. VederlagData:**
```python
# Før:                                     # Etter:
saerskilt_varsel_rigg_drift_dato: str     rigg_drift_varsel: VarselInfo
varsel_justert_ep_dato: str               justert_ep_varsel: VarselInfo
varsel_start_regning_dato: str            regningsarbeid_varsel: VarselInfo
varsel_justert_prod_dato: str             produktivitetstap_varsel: VarselInfo
```

**3. FristData:**
```python
# Før:                              # Etter:
fremdriftshindring: bool            fremdriftshindring_dokumentasjon: Optional[str]
begrunnelse: str (2x duplikat)      vedlegg_ids: List[str]
```

**4. Enums:**
- `VederlagsMetode.SKJONN` → FJERNET (bruk `OVERSLAG`)
- `FristVarselType` + `FORCE_MAJEURE`
- `FristBeregningResultat` + `AVSLATT_INGEN_HINDRING`
- `ResponsResultat` → `GrunnlagResponsResultat`

---

## 🎯 Neste steg

### Backend:
1. ✅ Datamodeller refaktorert
2. ⏳ Skriv migrasjonsskript for eksisterende events
3. ⏳ Integrer constants i API-validering
4. ⏳ Unit tests for nye validatorer

### Frontend:
1. ✅ Types synkronisert
2. ⏳ Oppdater skjemaer til VarselInfo-struktur
3. ⏳ Implementer visning av subsidiær status
4. ⏳ Test SakState computed fields

---

## 📚 Nye filer

- `backend/constants/grunnlag_categories.py`
- `backend/constants/vederlag_methods.py`
- `backend/constants/__init__.py`
- `REFACTORING_SUMMARY.md`

## 📝 Oppdaterte filer

- `backend/models/events.py`
- `backend/models/sak_state.py`
- `src/types/timeline.ts`

---

**Refaktorert av:** Claude (Senior Systemarkitekt)  
**Godkjent av:** [Arkitekt]  
**Status:** ✅ Klar for review og testing
