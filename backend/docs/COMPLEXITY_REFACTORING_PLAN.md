# Plan: Refaktorering av komplekse funksjoner

Analyse utført 2026-01-29 med `radon cc backend/ -a -s --min C`

## Sammendrag

| Metrikk | Verdi |
|---------|-------|
| Analyserte blokker | 118 |
| Gjennomsnittlig CC | 16.7 (C) |
| Kritiske funksjoner (F) | 3 |
| Veldig høy kompleksitet (E) | 4 |

## Fase 1: Felles hjelpefunksjoner

Trekk ut repetitiv logikk som brukes på tvers av flere funksjoner.

### 1.1 Varsel-validering (validators.py)

**Problem:** Samme mønster gjentas 4+ ganger i `validate_vederlag_event`.

```python
# Nåværende (repetert):
if data.get('krever_regningsarbeid'):
    if not data.get('regningsarbeid_varsel'):
        raise ValidationError("...")
    varsel = data.get('regningsarbeid_varsel')
    if varsel and not varsel.get('dato_sendt'):
        raise ValidationError("...")
```

**Løsning:** Ny hjelpefunksjon i `backend/api/validators.py`:

```python
def _validate_varsel_requirement(
    data: Dict[str, Any],
    flag_key: str,
    varsel_key: str,
    hjemmel: str
) -> None:
    """Validerer at et varsel er sendt når flagg er satt."""
    if not data.get(flag_key):
        return
    if not data.get(varsel_key):
        raise ValidationError(f"{flag_key} krever varsel ({hjemmel})")
    varsel = data.get(varsel_key)
    if varsel and not varsel.get('dato_sendt'):
        raise ValidationError(f"{varsel_key} må ha dato_sendt")
```

**Bruk:**
```python
_validate_varsel_requirement(data, 'krever_regningsarbeid', 'regningsarbeid_varsel', '§30.1')
_validate_varsel_requirement(data, 'inkluderer_rigg_drift', 'rigg_drift_varsel', '§34.1.3')
_validate_varsel_requirement(data, 'krever_justert_ep', 'justert_ep_varsel', '§34.3.3')
_validate_varsel_requirement(data, 'inkluderer_produktivitetstap', 'produktivitetstap_varsel', '§34.1.3')
```

**Estimert CC-reduksjon:** `validate_vederlag_event` 26 → ~14

---

### 1.2 Felt-kopiering fra event til state (timeline_service.py)

**Problem:** `hasattr`-sjekk og kopiering gjentas 15+ ganger per handler.

```python
# Nåværende (repetert):
if hasattr(event.data, 'felt_a'):
    state.spor.felt_a = event.data.felt_a
if hasattr(event.data, 'felt_b'):
    state.spor.felt_b = event.data.felt_b
# ... 15 flere
```

**Løsning:** Ny hjelpefunksjon i `backend/services/timeline_service.py`:

```python
def _copy_fields_if_present(source: Any, target: Any, fields: List[str]) -> None:
    """Kopierer felt fra source til target hvis de eksisterer og ikke er None."""
    for field in fields:
        if hasattr(source, field):
            value = getattr(source, field)
            if value is not None:
                setattr(target, field, value)
```

**Bruk:**
```python
# I _handle_respons_vederlag:
_copy_fields_if_present(event.data, vederlag, [
    'saerskilt_varsel_rigg_drift_ok',
    'varsel_justert_ep_ok',
    'varsel_start_regning_ok',
    'krav_fremmet_i_tide',
    'begrunnelse_varsel',
])
```

**Estimert CC-reduksjon:** `_handle_respons_vederlag` 25 → ~10, `_handle_respons_frist` 26 → ~10

---

### 1.3 Case-normalisering (validators.py)

**Problem:** Uppercase-normalisering gjentas i alle validatorer.

```python
# Nåværende (repetert):
felt = data.get('felt')
if felt and isinstance(felt, str):
    felt = felt.upper()
    data['felt'] = felt
```

**Løsning:**

```python
def _normalize_to_upper(data: Dict[str, Any], *keys: str) -> None:
    """Normaliserer streng-felt til UPPERCASE in-place."""
    for key in keys:
        val = data.get(key)
        if isinstance(val, str):
            data[key] = val.upper()
        elif isinstance(val, list):
            data[key] = [v.upper() if isinstance(v, str) else v for v in val]
```

**Bruk:**
```python
_normalize_to_upper(data, 'hovedkategori', 'underkategori', 'metode', 'varsel_type')
```

---

## Fase 2: Refaktorer individuelle funksjoner

Etter at felles hjelpere er på plass.

### 2.1 `submit_event` (CC=50) → Mål: CC < 15

**Fil:** `backend/routes/event_routes.py:134`

**Oppdeling:**

| Ny funksjon | Ansvar | Linjer |
|-------------|--------|--------|
| `_validate_submit_request()` | Payload-validering, returnerer parsed data | 170-193 |
| `_validate_event_by_type()` | Dispatch til riktig validator | 206-237 |
| `_check_version_conflict()` | Versjonskontroll med brukervennlig melding | 247-286 |
| `_validate_business_rules()` | State-validering | 291-306 |
| `_persist_and_compute_state()` | Lagring + state-beregning | 319-342 |
| `_build_submit_response()` | Bygg JSON-respons | 365-374 |

**Dispatch-tabell for validering:**

```python
EVENT_VALIDATORS = {
    EventType.GRUNNLAG_OPPRETTET.value: lambda d: validate_grunnlag_event(d),
    EventType.GRUNNLAG_OPPDATERT.value: lambda d: validate_grunnlag_event(d, is_update=True),
    EventType.VEDERLAG_KRAV_SENDT.value: validate_vederlag_event,
    EventType.VEDERLAG_KRAV_OPPDATERT.value: validate_vederlag_event,
    EventType.FRIST_KRAV_SENDT.value: validate_frist_event,
    # ...
}

def _validate_event_by_type(event_type: str, data: Dict) -> None:
    validator = EVENT_VALIDATORS.get(event_type)
    if validator:
        validator(data)
```

---

### 2.2 `_post_to_catenda` (CC=37) → Mål: CC < 12

**Fil:** `backend/routes/event_routes.py:741`

**Oppdeling:**

| Ny funksjon | Ansvar |
|-------------|--------|
| `_prepare_catenda_context()` | Hent service, metadata, config, valider IDs |
| `_resolve_pdf()` | Velg klient-PDF eller generer server-PDF |
| `_upload_and_link_pdf()` | Last opp til Catenda, opprett document reference |
| `_post_catenda_comment()` | Generer og post kommentar med magic link |
| `_sync_topic_status()` | Oppdater status hvis endret |

---

### 2.3 `validate_grunnlag_event` (CC=32) → Mål: CC < 12

**Fil:** `backend/api/validators.py:51`

**Oppdeling:**

| Ny funksjon | Ansvar |
|-------------|--------|
| `_validate_kategori_fields()` | Hovedkategori + underkategori validering |
| `_validate_required_text_fields()` | tittel, beskrivelse, dato_oppdaget |

---

## Fase 3: Prioritert rekkefølge

| Prioritet | Oppgave | Begrunnelse |
|-----------|---------|-------------|
| 1 | `_validate_varsel_requirement()` | Enkel, høy gjenbruk, reduserer CC med ~12 |
| 2 | `_copy_fields_if_present()` | Enkel, brukes i 3+ handlers |
| 3 | `_normalize_to_upper()` | Enkel, brukes i alle validatorer |
| 4 | Refaktorer `validate_vederlag_event` | Bruk nye hjelpere |
| 5 | Refaktorer `_handle_respons_*` | Bruk nye hjelpere |
| 6 | Splitt `submit_event` | Størst funksjon, mest kompleks |
| 7 | Splitt `_post_to_catenda` | Orchestrator, naturlig oppdeling |

---

## Testplan

Før refaktorering:
```bash
cd backend && make test  # Bekreft grønn baseline
```

Etter hver endring:
```bash
cd backend && make test
radon cc backend/ -a -s --min C  # Verifiser CC-reduksjon
```

---

## Faktiske resultater (Fase 1 fullført 2026-01-29)

### Implementerte hjelpefunksjoner

| Hjelpefunksjon | Fil | CC |
|----------------|-----|-----|
| `_validate_varsel_requirement()` | `backend/api/validators.py` | A (5) |
| `_normalize_to_upper()` | `backend/api/validators.py` | B (6) |
| `_copy_fields_if_present()` | `backend/services/timeline_service.py` | B (6) |

### CC-forbedringer etter Fase 1

| Funksjon | Før | Etter | Endring |
|----------|-----|-------|---------|
| `validate_vederlag_event` | 26 (D) | **8 (B)** | -18 ✅ |
| `validate_grunnlag_event` | 32 (E) | 25 (D) | -7 |
| `_handle_respons_vederlag` | 25 (D) | 17 (C) | -8 |
| `_handle_respons_frist` | 26 (D) | 12 (C) | -14 ✅ |
| validators.py gjennomsnitt | - | **9.3 (B)** | - |

### Gjenstående arbeid (Fase 2)

| Funksjon | Nåværende | Mål |
|----------|-----------|-----|
| `submit_event` | 50 (F) | < 15 (B/C) |
| `_post_to_catenda` | 37 (E) | < 12 (C) |
| `validate_grunnlag_event` | 25 (D) | < 15 (C) |

### Nye tester lagt til

- `TestValidateVarselRequirement` (7 tester)
- `TestNormalizeToUpper` (10 tester)

---

## Faktiske resultater (Fase 2 fullført 2026-01-29)

### Implementerte hjelpefunksjoner

| Hjelpefunksjon | Fil | CC |
|----------------|-----|-----|
| `_validate_hovedkategori()` | `backend/api/validators.py` | A (4) |
| `_validate_underkategori()` | `backend/api/validators.py` | B (7) |
| `_validate_required_text_fields()` | `backend/api/validators.py` | B (6) |
| `EVENT_VALIDATORS` (dispatch-tabell) | `backend/routes/event_routes.py` | - |
| `_validate_event_by_type()` | `backend/routes/event_routes.py` | A (2) |
| `_derive_spor_from_event()` | `backend/routes/event_routes.py` | B (8) |
| `_build_validation_error_response()` | `backend/routes/event_routes.py` | B (6) |
| `_build_version_conflict_message()` | `backend/routes/event_routes.py` | B (7) |
| `_validate_business_rules_and_compute_state()` | `backend/routes/event_routes.py` | A (4) |
| `_ensure_catenda_auth()` | `backend/routes/event_routes.py` | A (5) |
| `CatendaContext` (dataklasse) | `backend/routes/event_routes.py` | A (2) |
| `_prepare_catenda_context()` | `backend/routes/event_routes.py` | B (7) |
| `_resolve_pdf()` | `backend/routes/event_routes.py` | B (10) |
| `_upload_and_link_pdf()` | `backend/routes/event_routes.py` | B (8) |
| `_post_catenda_comment()` | `backend/routes/event_routes.py` | B (6) |
| `_sync_topic_status()` | `backend/routes/event_routes.py` | A (3) |

### CC-forbedringer etter Fase 2

| Funksjon | Før | Etter | Endring |
|----------|-----|-------|---------|
| `validate_grunnlag_event` | 25 (D) | **4 (A)** | -21 ✅ |
| `submit_event` | 50 (F) | **17 (C)** | -33 ✅ |
| `_post_to_catenda` | 37 (E) | **7 (B)** | -30 ✅ |

### Nye tester lagt til (Fase 2)

- `TestValidateHovedkategori` (5 tester)
- `TestValidateUnderkategori` (7 tester)
- `TestValidateRequiredTextFields` (6 tester)

### Sammendrag

| Metrikk | Før Fase 1 | Etter Fase 1 | Etter Fase 2 |
|---------|------------|--------------|--------------|
| `validators.py` gjennomsnitt | C (16.7) | B (9.3) | **B (6.7)** |
| `event_routes.py` gjennomsnitt | - | - | **B (6.7)** |
| Kritiske funksjoner (F) | 3 | 1 | **0** |
| Veldig høy kompleksitet (E) | 4 | 2 | **0** |

---

## Fase 3: Anbefalinger for videre arbeid (Valgfritt)

Etter Fase 1 og 2 er de mest kritiske funksjonene refaktorert. Gjenstående funksjoner med CC ≥ C er:

| Funksjon | Fil | CC | Anbefaling |
|----------|-----|-----|------------|
| `_handle_eo_utstedt` | `timeline_service.py` | D (24) | **Prioritet 1** - Kan bruke lignende mønster som respons-handlers |
| `validate_frist_event` | `validators.py` | C (20) | Trekk ut `_validate_frist_fields()` og `_validate_specification_fields()` |
| `get_vederlag_historikk` | `timeline_service.py` | C (19) | Kan vente - kun lesing |
| `submit_batch` | `event_routes.py` | C (18) | Bruk eksisterende hjelpere fra submit_event |
| `submit_event` | `event_routes.py` | C (17) | Akseptabel - videre splitting gir lite gevinst |
| `_handle_respons_vederlag` | `timeline_service.py` | C (17) | Allerede forbedret i Fase 1 |

### Vurdering

**Anbefalt for Fase 3:**
- `_handle_eo_utstedt` (CC 24) - Høyeste gjenstående, potensial for -10 CC
- `validate_frist_event` (CC 20) - Kan nå < 12 med 2 hjelpefunksjoner

**Kan vente:**
- `submit_batch` - Følger samme mønster som submit_event, relativt isolert
- Historikk-funksjoner - Read-only, lav risiko, kompleksitet er akseptabel

**Akseptabel som-er:**
- `submit_event` (CC 17) - Videre splitting ville fragmentere flyten for mye
- `enrich_event_with_version` (CC 14) - Tydelig struktur med instanceof-sjekker

### Hovedgevinst oppnådd

De tre mest kritiske funksjonene (CC 50, 37, 25) er redusert til akseptable nivåer.
Ingen funksjoner har lenger CC F eller E. Kodebasen er nå vedlikeholdbar.
