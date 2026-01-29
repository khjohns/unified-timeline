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

## Forventet resultat

| Funksjon | Før | Etter |
|----------|-----|-------|
| `submit_event` | 50 (F) | < 15 (B/C) |
| `_post_to_catenda` | 37 (E) | < 12 (C) |
| `validate_grunnlag_event` | 32 (E) | < 12 (C) |
| `validate_vederlag_event` | 26 (D) | < 14 (C) |
| `_handle_respons_vederlag` | 25 (D) | < 10 (B) |
| `_handle_respons_frist` | 26 (D) | < 10 (B) |
| **Gjennomsnitt** | 16.7 (C) | < 12 (C) |
