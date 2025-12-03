# Backend - Neste steg etter refaktorering

**Dato:** 2025-12-03  
**Status:** ✅ Modeller refaktorert - Klar for implementering

---

## 📋 Prio 1: Validering og Testing

### 1.1 Validering av kategorier (estimat: 1-2 timer)

**Mål:** Integrer `backend/constants` i API-validering

**Oppgaver:**
```python
# backend/api/validators.py (ny fil)

from constants import (
    validate_kategori_kombinasjon,
    get_vederlag_metode,
    krever_forhåndsvarsel,
)

def validate_grunnlag_event(data: GrunnlagEventData):
    """Valider grunnlag-event mot constants"""
    if not validate_kategori_kombinasjon(
        data.hovedkategori, 
        data.underkategori
    ):
        raise ValueError("Ugyldig kategori-kombinasjon")

def validate_vederlag_event(data: VederlagEventData):
    """Valider vederlag-event mot constants"""
    metode_info = get_vederlag_metode(data.metode)
    if not metode_info:
        raise ValueError(f"Ukjent vederlagsmetode: {data.metode}")
    
    # Sjekk varselkrav
    if data.krever_regningsarbeid and not data.regningsarbeid_varsel:
        raise ValueError("Regningsarbeid krever varsel før oppstart (§30.1)")
```

**Integrer i:**
- `backend/api/events.py` - Kall validatorer før `parse_event_from_request()`

---

### 1.2 Unit tests for modeller (estimat: 3-4 timer)

**Mål:** Sikre at alle validatorer fungerer

**Test-fil:** `backend/tests/test_events.py`

```python
import pytest
from models.events import VarselInfo, GrunnlagData, VederlagData, FristData

def test_varselinfo_structure():
    """Test VarselInfo med ulike metoder"""
    varsel = VarselInfo(
        dato_sendt="2025-01-15",
        metode=["epost", "byggemote"]
    )
    assert varsel.dato_sendt == "2025-01-15"
    assert len(varsel.metode) == 2

def test_grunnlag_data_with_varsel():
    """Test GrunnlagData med grunnlag_varsel"""
    data = GrunnlagData(
        hovedkategori="forsinkelse_bh",
        underkategori="prosjektering",
        beskrivelse="Mangler i tegninger",
        dato_oppdaget="2025-01-10",
        grunnlag_varsel=VarselInfo(
            dato_sendt="2025-01-11",
            metode=["epost"]
        )
    )
    assert data.grunnlag_varsel.metode == ["epost"]

def test_vederlag_data_rigg_drift_varsel():
    """Test VederlagData med rigg/drift varsel"""
    data = VederlagData(
        krav_belop=50000,
        metode="regning",
        begrunnelse="Ekstra rigg",
        inkluderer_rigg_drift=True,
        rigg_drift_varsel=VarselInfo(
            dato_sendt="2025-01-12",
            metode=["byggemote", "epost"]
        )
    )
    assert data.rigg_drift_varsel.dato_sendt == "2025-01-12"

def test_frist_data_with_varsler():
    """Test FristData med noytralt + spesifisert varsel"""
    data = FristData(
        varsel_type="begge",
        noytralt_varsel=VarselInfo(
            dato_sendt="2025-01-10",
            metode=["byggemote"]
        ),
        spesifisert_varsel=VarselInfo(
            dato_sendt="2025-01-20",
            metode=["epost", "brev"]
        ),
        antall_dager=14,
        begrunnelse="Forsinkelse pga BH-prosjektering"
    )
    assert data.noytralt_varsel.metode == ["byggemote"]
    assert data.spesifisert_varsel.metode == ["epost", "brev"]

def test_frist_respons_har_bh_etterlyst_validator():
    """Test at validator kaster feil hvis krav er i tide"""
    from models.events import FristResponsData
    
    with pytest.raises(ValueError, match="kom i tide trenger ikke å etterlyses"):
        FristResponsData(
            spesifisert_krav_ok=True,  # Krav er i tide
            har_bh_etterlyst=True,     # Men satt til True - skal gi feil
            vilkar_oppfylt=True,
            beregnings_resultat="godkjent_fullt"
        )

def test_subsidiary_logic_in_sak_state():
    """Test subsidiær logikk i SakState"""
    from models.sak_state import SakState, GrunnlagTilstand, VederlagTilstand
    from models.events import SporStatus, VederlagBeregningResultat
    
    # Setup: Grunnlag AVVIST, men Vederlag GODKJENT
    sak = SakState(
        sak_id="SAK-001",
        sakstittel="Test subsidiær",
        grunnlag=GrunnlagTilstand(
            status=SporStatus.AVVIST,  # BH avviser ansvar
            hovedkategori="forsinkelse_bh"
        ),
        vederlag=VederlagTilstand(
            status=SporStatus.GODKJENT,
            krevd_belop=50000,
            bh_resultat=VederlagBeregningResultat.GODKJENT_FULLT,  # Men enig om beløp
            godkjent_belop=50000
        )
    )
    
    # Test at subsidiær logikk detekteres
    assert sak.er_subsidiaert_vederlag is True
    assert "Subsidiært" in sak.visningsstatus_vederlag
```

**Kjør:**
```bash
pytest backend/tests/test_events.py -v
```

---

## 📋 Prio 2: API-integrasjon (estimat: 2-3 timer)

### 2.1 Event submission endpoint

**Fil:** `backend/api/events.py`

```python
from fastapi import APIRouter, HTTPException
from models.events import parse_event_from_request, AnyEvent
from api.validators import validate_grunnlag_event, validate_vederlag_event

router = APIRouter()

@router.post("/events")
async def submit_event(request_data: dict):
    """
    Submit a new event.
    
    Server adds:
    - event_id (generated)
    - tidsstempel (server time)
    
    Client CANNOT send these fields.
    """
    try:
        # Validate before parsing
        event_type = request_data.get("event_type")
        
        if event_type == "grunnlag_opprettet":
            validate_grunnlag_event(request_data.get("data"))
        elif event_type == "vederlag_krav_sendt":
            validate_vederlag_event(request_data.get("data"))
        
        # Parse and add server fields
        event = parse_event_from_request(request_data)
        
        # Save to database/CSV
        save_event(event)
        
        return {"event_id": event.event_id, "status": "created"}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

---

### 2.2 SakState aggregation service

**Fil:** `backend/services/timeline_service.py`

```python
from typing import List
from models.events import AnyEvent, GrunnlagEvent, VederlagEvent, FristEvent, ResponsEvent
from models.sak_state import SakState, GrunnlagTilstand, VederlagTilstand, FristTilstand
from models.events import SporStatus

def aggregate_sak_state(sak_id: str, events: List[AnyEvent]) -> SakState:
    """
    Aggregate all events into a single SakState.
    
    This is the "view" that frontend uses.
    """
    state = SakState(sak_id=sak_id)
    
    for event in sorted(events, key=lambda e: e.tidsstempel):
        if isinstance(event, GrunnlagEvent):
            apply_grunnlag_event(state.grunnlag, event)
        elif isinstance(event, VederlagEvent):
            apply_vederlag_event(state.vederlag, event)
        elif isinstance(event, FristEvent):
            apply_frist_event(state.frist, event)
        elif isinstance(event, ResponsEvent):
            apply_respons_event(state, event)
    
    return state

def apply_grunnlag_event(tilstand: GrunnlagTilstand, event: GrunnlagEvent):
    """Apply grunnlag event to state"""
    tilstand.hovedkategori = event.data.hovedkategori
    tilstand.underkategori = event.data.underkategori
    tilstand.beskrivelse = event.data.beskrivelse
    tilstand.dato_oppdaget = event.data.dato_oppdaget
    
    # VarselInfo -> Tilstand
    if event.data.grunnlag_varsel:
        tilstand.dato_varsel_sendt = event.data.grunnlag_varsel.dato_sendt
        tilstand.varsel_metode = event.data.grunnlag_varsel.metode
    
    tilstand.status = SporStatus.SENDT
    tilstand.siste_event_id = event.event_id
    tilstand.antall_versjoner += 1

# ... similar for vederlag and frist
```

---

## 📋 Prio 3: Mock data oppdatering (estimat: 1 time)

### 3.1 Oppdater mock data

**Fil:** `backend/mocks/mock_events.py` (ny)

```python
from models.events import (
    SakOpprettetEvent,
    GrunnlagEvent,
    GrunnlagData,
    VederlagEvent,
    VederlagData,
    FristEvent,
    FristData,
    VarselInfo,
)

MOCK_EVENTS = [
    SakOpprettetEvent(
        sak_id="SAK-001",
        sakstittel="Svikt i prosjektering - Fundamentering",
        aktor="Ole Olsen",
        aktor_rolle="TE",
    ),
    
    GrunnlagEvent(
        sak_id="SAK-001",
        aktor="Ole Olsen",
        aktor_rolle="TE",
        data=GrunnlagData(
            hovedkategori="forsinkelse_bh",
            underkategori="prosjektering",
            beskrivelse="Mangler i fundamenttegninger for Akse A",
            dato_oppdaget="2025-01-10",
            grunnlag_varsel=VarselInfo(
                dato_sendt="2025-01-11",
                metode=["epost", "byggemote"]
            ),
            kontraktsreferanser=["NS8407 §24.1"],
        )
    ),
    
    VederlagEvent(
        sak_id="SAK-001",
        aktor="Ole Olsen",
        aktor_rolle="TE",
        data=VederlagData(
            krav_belop=75000,
            metode="regning",
            begrunnelse="Ekstra tid til omprosjektering + rigg",
            inkluderer_rigg_drift=True,
            rigg_drift_belop=15000,
            rigg_drift_varsel=VarselInfo(
                dato_sendt="2025-01-12",
                metode=["epost"]
            ),
            krever_regningsarbeid=True,
            regningsarbeid_varsel=VarselInfo(
                dato_sendt="2025-01-11",
                metode=["byggemote"]
            ),
        )
    ),
    
    FristEvent(
        sak_id="SAK-001",
        aktor="Ole Olsen",
        aktor_rolle="TE",
        data=FristData(
            varsel_type="begge",
            noytralt_varsel=VarselInfo(
                dato_sendt="2025-01-11",
                metode=["byggemote"]
            ),
            spesifisert_varsel=VarselInfo(
                dato_sendt="2025-01-18",
                metode=["epost", "brev"]
            ),
            antall_dager=10,
            begrunnelse="Omprosjektering + ny utstikking tar 10 virkedager",
            fremdriftshindring_dokumentasjon="Se vedlagt fremdriftsplan",
            vedlegg_ids=["DOK-001", "DOK-002"]
        )
    ),
]
```

---

## 📋 Prio 4: Database/CSV storage (estimat: 2-3 timer)

### 4.1 CSV event log

**Fil:** `backend/storage/event_store.py`

```python
import csv
import json
from pathlib import Path
from models.events import AnyEvent, parse_event

EVENT_LOG_PATH = Path("data/event_log.csv")

def save_event(event: AnyEvent):
    """Append event to CSV log"""
    EVENT_LOG_PATH.parent.mkdir(exist_ok=True)
    
    with open(EVENT_LOG_PATH, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            event.event_id,
            event.sak_id,
            event.event_type.value,
            event.tidsstempel.isoformat(),
            event.aktor,
            event.aktor_rolle,
            json.dumps(event.model_dump(), default=str),  # Full event as JSON
        ])

def load_events(sak_id: str) -> list[AnyEvent]:
    """Load all events for a case"""
    events = []
    
    with open(EVENT_LOG_PATH, "r") as f:
        reader = csv.reader(f)
        for row in reader:
            event_sak_id = row[1]
            if event_sak_id == sak_id:
                event_json = json.loads(row[6])
                events.append(parse_event(event_json))
    
    return events
```

---

## 🎯 Samlet implementeringsrekkefølge

1. ✅ **Uke 1:** Validering + Unit tests (Prio 1)
2. ⏳ **Uke 2:** API-integrasjon (Prio 2)
3. ⏳ **Uke 3:** Mock data + Storage (Prio 3-4)
4. ⏳ **Uke 4:** Integrasjonstester + Frontend-integrasjon

---

## 📊 Suksesskriterier

- ✅ Alle unit tests kjører grønt
- ✅ API kan motta events med VarselInfo-struktur
- ✅ SakState beregner subsidiær logikk korrekt
- ✅ Frontend kan lese SakState uten feil
- ✅ Constants brukes for validering (ikke hardkodet i event-modeller)

---

**Ansvarlig:** Backend-teamet  
**Tidsestim at:** 8-12 timer (spredt over 2-3 uker)
