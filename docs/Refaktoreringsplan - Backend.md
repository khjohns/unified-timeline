# Refaktoreringsplan: Backend for Produksjon

**Dato:** November 2025
**Versjon:** 1.0
**Status:** Planlagt

---

## Innholdsfortegnelse

1. [Bakgrunn og formål](#1-bakgrunn-og-formål)
2. [Nåværende struktur](#2-nåværende-struktur)
3. [Problemstillinger](#3-problemstillinger)
4. [Målarkitektur](#4-målarkitektur)
5. [Refaktoreringsstrategi](#5-refaktoreringsstrategi)
6. [Implementeringsplan](#6-implementeringsplan)
7. [Testing](#7-testing)
8. [Azure Functions migrering](#8-azure-functions-migrering)
9. [Vedlegg](#9-vedlegg)

---

## 1. Bakgrunn og formål

### 1.1 Hvorfor refaktorere?

**Nåværende situasjon:**
- `backend/app.py`: 1231 linjer kode i én fil
- Forretningslogikk tett koblet til Flask
- Vanskelig å teste uten Flask-kontekst
- Blokkerer migrering til Azure Functions

**Produksjonskrav:**
- Azure Functions (ikke Flask)
- Testbar forretningslogikk
- Dataverse i stedet for CSV
- Vedlikeholdbarhet og skalerbarhet

### 1.2 Mål med refaktorering

✅ **Separere bekymringer (Separation of Concerns):**
- HTTP-håndtering (routes)
- Forretningslogikk (services)
- Data access (repositories)
- Sikkerhet (allerede separert)

✅ **Gjøre koden testbar:**
- Unit tests uten Flask
- Mocking av dependencies
- Integration tests

✅ **Forberede Azure Functions migrering:**
- Flask-agnostisk forretningslogikk
- Lett å bytte HTTP-rammeverk
- Gjenbrukbar kode

✅ **Forbedre vedlikeholdbarhet:**
- Mindre filer (<300 linjer hver)
- Tydelig ansvar per modul
- Enklere å finne og endre kode

---

## 2. Nåværende struktur

### 2.1 Filstruktur

```
backend/
├── app.py (1231 linjer)              # Alt i én fil
│   ├── DataManager (168 linjer)      # Data persistence
│   ├── KOEAutomationSystem (324 linjer) # Business logic
│   └── 11 Flask routes (~700 linjer) # HTTP endpoints
│
├── Sikkerhet (allerede modulær) ✅
│   ├── csrf_protection.py
│   ├── validation.py
│   ├── webhook_security.py
│   ├── catenda_auth.py
│   └── audit.py
│
└── Utilities
    ├── magic_link.py
    ├── filtering_config.py
    └── catenda_api_tester.py
```

### 2.2 Eksempel: Nåværende kode

```python
# app.py - Alt i én fil
@app.route('/api/varsel-submit', methods=['POST'])
@limiter.limit("10 per minute")
@require_csrf
def submit_varsel():
    """HTTP endpoint, validering, business logic, data access - alt sammen"""
    logger.info("📥 Mottok varsel-submit request")
    sys = get_system()  # Global state
    payload = request.get_json()  # Flask dependency

    # Validering (50+ linjer)
    try:
        sak_id = payload['sakId']
        form_data = payload['formData']
        # ... mer validering ...
    except KeyError as e:
        return jsonify({"error": f"Missing field: {e}"}), 400

    # Business logic (50+ linjer)
    current_data = sys.db.get_form_data(sak_id)
    if not current_data:
        return jsonify({"error": "Sak not found"}), 404

    # ... mer business logic ...

    # Data access
    sys.db.update_form_data(sak_id, updated_data)

    # Catenda integration
    sys.catenda.post_comment(topic_guid, "Varsel mottatt")

    return jsonify({"success": True, "nextMode": "koe"}), 200
```

**Problem:**
- ❌ Kan ikke teste business logic uten Flask
- ❌ Kan ikke gjenbruke i Azure Functions
- ❌ Vanskelig å finne bugs
- ❌ Kan ikke kjøre som CLI-verktøy

---

## 3. Problemstillinger

### 3.1 Testbarhet

**Problem:** Forretningslogikk krever Flask-kontekst

```python
# Nåværende - kan ikke testes isolert
def submit_varsel():
    payload = request.get_json()  # Flask dependency!
    # ... business logic ...
```

**Konsekvens:**
- Må sette opp Flask test client for å teste business logic
- Treg test-kjøring
- Vanskelig å mock dependencies

### 3.2 Azure Functions kompatibilitet

**Azure Functions bruker IKKE Flask:**

```python
# Azure Functions
import azure.functions as func

@app.function_name("SubmitVarsel")
@app.route(route="varsel-submit")
def submit_varsel(req: func.HttpRequest) -> func.HttpResponse:
    # Må refaktorere ALL kode som bruker Flask!
    body = req.get_json()  # Annen API enn Flask
    # ...
```

**Konsekvens:** Koden må refaktoreres uansett ved migrering.

### 3.3 Vedlikeholdbarhet

**Problem:** 1231 linjer i én fil

- Vanskelig å finne spesifikk logikk
- Merge conflicts ved parallelt arbeid
- Ingen klar modul-grense
- Vanskelig å onboarde nye utviklere

### 3.4 Gjenbrukbarhet

**Problem:** Kan ikke bruke forretningslogikk utenfor Flask

Use cases som IKKE fungerer:
- CLI-verktøy for bulk-operasjoner
- Scheduled jobs (batch-prosessering)
- Admin-scripts
- Integration tests uten HTTP

---

## 4. Målarkitektur

### 4.1 Lagdelt arkitektur (Layered Architecture)

```
┌─────────────────────────────────────────────────┐
│  Presentation Layer (HTTP)                      │
│  - Flask routes (prototype)                     │
│  - Azure Functions (production)                 │
│  - CLI commands (admin)                         │
└─────────────────┬───────────────────────────────┘
                  │ Kaller
                  ▼
┌─────────────────────────────────────────────────┐
│  Service Layer (Business Logic)                 │
│  - VarselService                                │
│  - KoeService                                   │
│  - SvarService                                  │
│  - CatendaService                               │
└─────────────────┬───────────────────────────────┘
                  │ Bruker
                  ▼
┌─────────────────────────────────────────────────┐
│  Data Access Layer (Repositories)               │
│  - CSVDataManager (prototype)                   │
│  - DataverseRepository (production)             │
└─────────────────┬───────────────────────────────┘
                  │ Lagrer til
                  ▼
┌─────────────────────────────────────────────────┐
│  Data Storage                                   │
│  - CSV files (prototype)                        │
│  - Dataverse (production)                       │
└─────────────────────────────────────────────────┘
```

### 4.2 Filstruktur (målbilde)

```
backend/
├── app.py                      # Flask entrypoint (minimal)
├── requirements.txt
├── .env.example
│
├── routes/                     # HTTP layer (Flask-specific)
│   ├── __init__.py
│   ├── varsel_routes.py
│   ├── koe_routes.py
│   ├── svar_routes.py
│   ├── webhook_routes.py
│   └── utility_routes.py
│
├── services/                   # Business logic (framework-agnostic)
│   ├── __init__.py
│   ├── varsel_service.py
│   ├── koe_service.py
│   ├── svar_service.py
│   ├── catenda_service.py
│   └── pdf_service.py
│
├── repositories/               # Data access (storage-agnostic)
│   ├── __init__.py
│   ├── base_repository.py      # Interface
│   ├── csv_repository.py       # Prototype implementation
│   └── dataverse_repository.py # Production implementation
│
├── models/                     # Domain models (data structures)
│   ├── __init__.py
│   ├── sak.py
│   ├── varsel.py
│   ├── koe.py
│   └── svar.py
│
├── security/                   # Security modules (already done ✅)
│   ├── __init__.py
│   ├── csrf_protection.py
│   ├── validation.py
│   ├── webhook_security.py
│   ├── catenda_auth.py
│   └── audit.py
│
├── utils/                      # Shared utilities
│   ├── __init__.py
│   ├── magic_link.py
│   ├── filtering_config.py
│   └── guid_converter.py
│
├── tests/                      # Test suite
│   ├── __init__.py
│   ├── test_services/
│   ├── test_repositories/
│   ├── test_routes/
│   └── fixtures/
│
└── azure_functions/            # Azure Functions (future)
    ├── function_app.py
    ├── host.json
    └── requirements.txt
```

### 4.3 Eksempel: Etter refaktorering

**routes/varsel_routes.py** (HTTP layer)
```python
"""HTTP endpoints for Varsel operations"""
from flask import Blueprint, request, jsonify
from services.varsel_service import VarselService
from security.csrf_protection import require_csrf
from security.validation import ValidationError

varsel_bp = Blueprint('varsel', __name__)

@varsel_bp.route('/api/varsel-submit', methods=['POST'])
@limiter.limit("10 per minute")
@require_csrf
def submit_varsel():
    """HTTP endpoint for varsel submission"""
    try:
        payload = request.get_json()
        service = VarselService()

        result = service.submit_varsel(
            sak_id=payload['sakId'],
            form_data=payload['formData']
        )

        return jsonify(result), 200

    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except KeyError as e:
        return jsonify({"error": f"Missing field: {e}"}), 400
```

**services/varsel_service.py** (Business logic)
```python
"""Business logic for Varsel operations"""
from typing import Dict, Any
from repositories.csv_repository import CSVRepository
from services.catenda_service import CatendaService
from security.validation import validate_guid, validate_csv_safe_string, ValidationError
from models.varsel import Varsel

class VarselService:
    """
    Service for handling Varsel (notification) business logic.

    This class is framework-agnostic and can be used from:
    - Flask routes
    - Azure Functions
    - CLI tools
    - Batch jobs
    """

    def __init__(self, repository=None, catenda_service=None):
        """
        Initialize VarselService.

        Args:
            repository: Data repository (defaults to CSVRepository)
            catenda_service: Catenda integration service
        """
        self.repo = repository or CSVRepository()
        self.catenda = catenda_service or CatendaService()

    def submit_varsel(self, sak_id: str, form_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit a varsel (notification) for a case.

        Business rules:
        - Case must exist
        - Case must be in correct status
        - Form data must be valid

        Args:
            sak_id: Case identifier (GUID)
            form_data: Form data from frontend

        Returns:
            Dict with success status and next mode

        Raises:
            ValidationError: If validation fails
            ValueError: If case not found or wrong status
        """
        # 1. Validate input
        validated_sak_id = validate_guid(sak_id, "sakId")

        # 2. Get current case data
        sak_data = self.repo.get_case(validated_sak_id)
        if not sak_data:
            raise ValueError(f"Case not found: {validated_sak_id}")

        # 3. Validate status
        current_status = sak_data.get('status', '')
        if current_status not in ['100000000', '']:  # Under varsling
            raise ValueError(f"Invalid status for varsel submission: {current_status}")

        # 4. Build varsel model
        varsel = Varsel.from_form_data(form_data)

        # 5. Update case data
        updated_data = {
            **sak_data,
            'varsel': varsel.to_dict(),
            'status': '100000001',  # Varslet
            'modus': 'koe'
        }

        self.repo.update_case(validated_sak_id, updated_data)

        # 6. Post to Catenda
        topic_guid = sak_data.get('catenda_topic_id')
        if topic_guid:
            self.catenda.post_comment(
                topic_guid=topic_guid,
                comment="Varsel mottatt"
            )

        return {
            "success": True,
            "nextMode": "koe",
            "sakId": validated_sak_id
        }
```

**repositories/csv_repository.py** (Data access)
```python
"""CSV-based data repository for prototype"""
import csv
import json
from pathlib import Path
from typing import Optional, Dict, Any
from repositories.base_repository import BaseRepository

class CSVRepository(BaseRepository):
    """CSV file-based repository implementation"""

    def __init__(self, data_dir: str = "koe_data"):
        self.data_dir = Path(data_dir)
        self.form_data_dir = self.data_dir / "form_data"
        self._ensure_directories()

    def get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        """Get case data by ID"""
        file_path = self.form_data_dir / f"{case_id}.json"
        if not file_path.exists():
            return None

        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def update_case(self, case_id: str, data: Dict[str, Any]) -> None:
        """Update case data"""
        file_path = self.form_data_dir / f"{case_id}.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
```

**models/varsel.py** (Domain model)
```python
"""Varsel domain model"""
from dataclasses import dataclass
from typing import Dict, Any
from datetime import datetime

@dataclass
class Varsel:
    """
    Varsel (notification) domain model.

    Represents a notification about a discovered issue that may lead to a KOE.
    """
    dato_forhold_oppdaget: str
    hovedkategori: str
    underkategori: str
    varsel_beskrivelse: str
    dato_varsel_sendt: str = ""

    @classmethod
    def from_form_data(cls, form_data: Dict[str, Any]) -> 'Varsel':
        """Create Varsel from frontend form data"""
        return cls(
            dato_forhold_oppdaget=form_data.get('dato_forhold_oppdaget', ''),
            hovedkategori=form_data.get('hovedkategori', ''),
            underkategori=form_data.get('underkategori', ''),
            varsel_beskrivelse=form_data.get('varsel_beskrivelse', ''),
            dato_varsel_sendt=datetime.now().isoformat()
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            'dato_forhold_oppdaget': self.dato_forhold_oppdaget,
            'hovedkategori': self.hovedkategori,
            'underkategori': self.underkategori,
            'varsel_beskrivelse': self.varsel_beskrivelse,
            'dato_varsel_sendt': self.dato_varsel_sendt
        }
```

**Fordeler:**
- ✅ `VarselService` kan testes uten Flask
- ✅ Lett å bytte fra CSV til Dataverse (swap repository)
- ✅ Kan brukes i Azure Functions, CLI, batch jobs
- ✅ Klar separation of concerns
- ✅ Lett å finne og endre kode

---

## 5. Refaktoreringsstrategi

### 5.1 Prinsipper

✅ **Inkrementell refaktorering**
- En modul om gangen
- Test etter hver endring
- Ikke "big bang"-refaktorering

✅ **Bakoverkompatibilitet**
- Flask-appen skal fortsatt fungere
- Kun intern struktur endres
- Ingen endringer i API-kontrakt

✅ **Test-drevet**
- Skriv tester før refaktorering
- Tester skal passere før og etter
- Øk test coverage

### 5.2 Faser

**Fase 1: Grunnlag (uke 1)**
- Opprett mappestruktur
- Flytt ut modeller
- Opprett base repository interface

**Fase 2: Services (uke 2-3)**
- Ekstraher VarselService
- Ekstraher KoeService
- Ekstraher SvarService
- Ekstraher CatendaService

**Fase 3: Routes (uke 3-4)**
- Splitt routes til Blueprints
- Oppdater app.py til å bruke Blueprints
- Minimalisér app.py

**Fase 4: Testing (uke 4-5)**
- Skriv unit tests for services
- Skriv integration tests
- Oppnå >80% code coverage

**Fase 5: Dataverse (uke 6+)**
- Implementer DataverseRepository
- Parallel kjøring (CSV + Dataverse)
- Cutover til Dataverse

---

## 6. Implementeringsplan

### 6.1 Trinn 1: Opprett mappestruktur

**Tid:** 30 minutter

```bash
# Opprett mapper
mkdir -p backend/routes
mkdir -p backend/services
mkdir -p backend/repositories
mkdir -p backend/models
mkdir -p backend/tests/test_services
mkdir -p backend/tests/test_repositories
mkdir -p backend/tests/fixtures

# Opprett __init__.py filer
touch backend/routes/__init__.py
touch backend/services/__init__.py
touch backend/repositories/__init__.py
touch backend/models/__init__.py
touch backend/tests/__init__.py
```

### 6.2 Trinn 2: Ekstraher Base Repository

**Tid:** 1-2 timer

**Opprett:** `repositories/base_repository.py`

```python
"""Base repository interface"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List

class BaseRepository(ABC):
    """
    Abstract base class for data repositories.

    Defines the interface that all repositories must implement.
    This allows us to swap between CSV (prototype) and Dataverse (production).
    """

    @abstractmethod
    def get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        """Get case by ID"""
        pass

    @abstractmethod
    def update_case(self, case_id: str, data: Dict[str, Any]) -> None:
        """Update case data"""
        pass

    @abstractmethod
    def create_case(self, case_data: Dict[str, Any]) -> str:
        """Create new case, returns case_id"""
        pass

    @abstractmethod
    def list_cases(self, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List cases, optionally filtered by project"""
        pass
```

### 6.3 Trinn 3: Flytt DataManager til CSVRepository

**Tid:** 2-3 timer

1. Kopier `DataManager` klassen fra `app.py`
2. Lag `repositories/csv_repository.py`
3. Implementer `BaseRepository` interface
4. Oppdater `app.py` til å bruke `CSVRepository`
5. Test at alt fungerer

**Test:**
```bash
# Sjekk at app starter
python backend/app.py

# Test et endpoint
curl http://localhost:8080/api/health
```

### 6.4 Trinn 4: Ekstraher VarselService

**Tid:** 4-6 timer

**Strategi:**
1. Identifiser all varsel-relatert logikk i `app.py`
2. Lag `services/varsel_service.py`
3. Flytt business logic til `VarselService`
4. Oppdater route til å kalle `VarselService`
5. Skriv unit tests

**Checklist:**
- [ ] Opprett `services/varsel_service.py`
- [ ] Implementer `submit_varsel()` metode
- [ ] Oppdater `@app.route('/api/varsel-submit')` til å bruke service
- [ ] Skriv unit test i `tests/test_services/test_varsel_service.py`
- [ ] Kjør tester: `pytest tests/test_services/test_varsel_service.py`
- [ ] Test manuelt: `curl -X POST http://localhost:8080/api/varsel-submit`

**Unit test eksempel:**
```python
# tests/test_services/test_varsel_service.py
import pytest
from services.varsel_service import VarselService
from repositories.csv_repository import CSVRepository
from unittest.mock import Mock

def test_submit_varsel_success():
    """Test successful varsel submission"""
    # Arrange
    mock_repo = Mock(spec=CSVRepository)
    mock_repo.get_case.return_value = {
        'sak_id': 'TEST-123',
        'status': '100000000',
        'catenda_topic_id': 'topic-guid-123'
    }

    mock_catenda = Mock()
    service = VarselService(repository=mock_repo, catenda_service=mock_catenda)

    form_data = {
        'dato_forhold_oppdaget': '2025-11-20',
        'hovedkategori': 'Risiko',
        'underkategori': 'Grunnforhold',
        'varsel_beskrivelse': 'Test beskrivelse'
    }

    # Act
    result = service.submit_varsel('TEST-123', form_data)

    # Assert
    assert result['success'] is True
    assert result['nextMode'] == 'koe'
    mock_repo.update_case.assert_called_once()
    mock_catenda.post_comment.assert_called_once()

def test_submit_varsel_case_not_found():
    """Test varsel submission when case doesn't exist"""
    # Arrange
    mock_repo = Mock(spec=CSVRepository)
    mock_repo.get_case.return_value = None

    service = VarselService(repository=mock_repo)

    # Act & Assert
    with pytest.raises(ValueError, match="Case not found"):
        service.submit_varsel('NONEXISTENT', {})
```

### 6.5 Trinn 5: Ekstraher KoeService

**Tid:** 6-8 timer

Samme prosess som VarselService, men KOE-logikk er mer kompleks.

**Checklist:**
- [ ] Opprett `services/koe_service.py`
- [ ] Implementer `submit_koe()` metode
- [ ] Håndter KOE-revisjoner
- [ ] Oppdater route til å bruke service
- [ ] Skriv unit tests
- [ ] Test manuelt

### 6.6 Trinn 6: Ekstraher SvarService

**Tid:** 6-8 timer

**Checklist:**
- [ ] Opprett `services/svar_service.py`
- [ ] Implementer `submit_svar()` metode
- [ ] Håndter BH-spesifikk logikk
- [ ] Oppdater route
- [ ] Skriv unit tests
- [ ] Test manuelt

### 6.7 Trinn 7: Ekstraher CatendaService

**Tid:** 4-6 timer

**Ansvar:**
- Catenda API-kall
- Document upload
- Comment posting
- BCF integration

**Checklist:**
- [ ] Opprett `services/catenda_service.py`
- [ ] Flytt Catenda-logikk fra `KOEAutomationSystem`
- [ ] Oppdater alle services til å bruke `CatendaService`
- [ ] Skriv unit tests med mocking
- [ ] Test integration med ekte Catenda API

### 6.8 Trinn 8: Splitt routes til Blueprints

**Tid:** 4-6 timer

**Strategi:**
1. Opprett Blueprint-filer i `routes/`
2. Flytt routes fra `app.py`
3. Registrer Blueprints i `app.py`
4. Test at alle endpoints fungerer

**app.py etter refaktorering:**
```python
# app.py - Minimal entrypoint
from flask import Flask
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Import blueprints
from routes.varsel_routes import varsel_bp
from routes.koe_routes import koe_bp
from routes.svar_routes import svar_bp
from routes.webhook_routes import webhook_bp
from routes.utility_routes import utility_bp

app = Flask(__name__)

# CORS configuration
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000"]}})

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Register blueprints
app.register_blueprint(varsel_bp)
app.register_blueprint(koe_bp)
app.register_blueprint(svar_bp)
app.register_blueprint(webhook_bp)
app.register_blueprint(utility_bp)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080, debug=True)
```

**Resultat:** `app.py` redusert fra 1231 til ~50 linjer! 🎉

### 6.9 Trinn 9: Skriv comprehensive tests

**Tid:** 8-12 timer

**Test-pyramide:**
```
        /\
       /  \  E2E Tests (5%)
      /____\
     /      \  Integration Tests (15%)
    /________\
   /          \  Unit Tests (80%)
  /__________\
```

**Checklist:**
- [ ] Unit tests for alle services (>80% coverage)
- [ ] Unit tests for repositories
- [ ] Integration tests for routes
- [ ] E2E test for critical flows
- [ ] Test fixtures og helpers

**Kjør tester:**
```bash
# Installer pytest
pip install pytest pytest-cov pytest-mock

# Kjør alle tester med coverage
pytest --cov=backend --cov-report=html

# Åpne coverage report
open htmlcov/index.html
```

### 6.10 Trinn 10: Implementer DataverseRepository

**Tid:** 12-16 timer (etter Azure-oppsett)

**Forutsetninger:**
- Azure Dataverse instans opprettet
- Tabeller opprettet i Dataverse
- Managed Identity konfigurert

**Implementering:**
```python
# repositories/dataverse_repository.py
from repositories.base_repository import BaseRepository
from typing import Optional, Dict, Any, List
from azure.identity import DefaultAzureCredential
import requests

class DataverseRepository(BaseRepository):
    """Dataverse-based repository for production"""

    def __init__(self, org_url: str):
        self.org_url = org_url
        self.credential = DefaultAzureCredential()
        self.token = self._get_token()

    def get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        """Get case from Dataverse"""
        url = f"{self.org_url}/api/data/v9.2/oe_prosjektsaks({case_id})"
        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {self.token}"}
        )

        if response.status_code == 404:
            return None

        response.raise_for_status()
        return response.json()

    # ... implementer resten av interface
```

**Migrasjonsstrategi:**
```python
# Parallel kjøring - skriv til begge
class DualRepository(BaseRepository):
    """Write to both CSV and Dataverse during migration"""

    def __init__(self):
        self.csv = CSVRepository()
        self.dataverse = DataverseRepository(os.getenv("DATAVERSE_URL"))

    def update_case(self, case_id: str, data: Dict[str, Any]) -> None:
        # Write to both
        self.csv.update_case(case_id, data)
        self.dataverse.update_case(case_id, data)
```

---

## 7. Testing

### 7.1 Test-strategi

**Unit Tests (80% av tester):**
- Tester isolerte komponenter
- Mocker alle dependencies
- Raske å kjøre (<1 sekund per test)

**Integration Tests (15% av tester):**
- Tester samspill mellom komponenter
- Bruker ekte database (test-data)
- Medium hastighet (~1-5 sekunder per test)

**E2E Tests (5% av tester):**
- Tester hele flyten
- Bruker ekte HTTP-kall
- Trege å kjøre (~10-30 sekunder per test)

### 7.2 Test-eksempler

**Unit test:**
```python
# tests/test_services/test_varsel_service.py
def test_submit_varsel_validates_status():
    """Test that varsel submission validates case status"""
    mock_repo = Mock()
    mock_repo.get_case.return_value = {
        'status': '100000002'  # Wrong status
    }

    service = VarselService(repository=mock_repo)

    with pytest.raises(ValueError, match="Invalid status"):
        service.submit_varsel('TEST-123', {})
```

**Integration test:**
```python
# tests/test_routes/test_varsel_routes.py
def test_varsel_submit_endpoint(client, test_data):
    """Test varsel submit endpoint end-to-end"""
    # Setup
    csrf_token = get_csrf_token(client)

    # Execute
    response = client.post(
        '/api/varsel-submit',
        json={
            'sakId': test_data['sak_id'],
            'formData': test_data['varsel_data']
        },
        headers={'X-CSRF-Token': csrf_token}
    )

    # Verify
    assert response.status_code == 200
    assert response.json['success'] is True
```

### 7.3 Test fixtures

```python
# tests/fixtures.py
import pytest
from repositories.csv_repository import CSVRepository

@pytest.fixture
def test_repository(tmp_path):
    """Create temporary CSV repository for testing"""
    return CSVRepository(data_dir=str(tmp_path))

@pytest.fixture
def test_data():
    """Standard test data"""
    return {
        'sak_id': 'TEST-123',
        'varsel_data': {
            'dato_forhold_oppdaget': '2025-11-20',
            'hovedkategori': 'Risiko',
            'underkategori': 'Grunnforhold',
            'varsel_beskrivelse': 'Test'
        }
    }
```

---

## 8. Azure Functions migrering

### 8.1 Azure Functions struktur

```
azure_functions/
├── function_app.py          # Function app definition
├── host.json                # Runtime config
├── local.settings.json      # Local development settings
├── requirements.txt         # Dependencies
│
├── shared/                  # Shared code (symlink to backend/)
│   ├── services/
│   ├── repositories/
│   ├── models/
│   └── security/
│
└── triggers/                # HTTP triggers
    ├── http_varsel.py
    ├── http_koe.py
    ├── http_svar.py
    └── http_webhook.py
```

### 8.2 Eksempel: Azure Function

```python
# azure_functions/triggers/http_varsel.py
import azure.functions as func
import json
from shared.services.varsel_service import VarselService
from shared.security.validation import ValidationError

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Azure Function for varsel submission.

    Notice: Same business logic (VarselService) works in both Flask and Azure Functions!
    """
    try:
        # Parse request
        req_body = req.get_json()

        # Call service (framework-agnostic!)
        service = VarselService()
        result = service.submit_varsel(
            sak_id=req_body['sakId'],
            form_data=req_body['formData']
        )

        # Return response
        return func.HttpResponse(
            json.dumps(result),
            mimetype="application/json",
            status_code=200
        )

    except ValidationError as e:
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=400
        )
```

**Fordel:** `VarselService` er identisk i Flask og Azure Functions! ✅

### 8.3 Migreringsstrategi

**Fase 1: Parallel kjøring**
- Flask (prototype) kjører på ngrok
- Azure Functions (production) deployes til Azure
- Begge bruker samme Dataverse

**Fase 2: Gradvis cutover**
- Nytt trafikk går til Azure Functions
- Eksisterende saker fullfører i Flask
- Overvåk og sammenlign

**Fase 3: Deaktiver Flask**
- All trafikk til Azure Functions
- Flask-app arkiveres
- Oppdater Catenda webhook URL

---

## 9. Vedlegg

### 9.1 Checklist for refaktorering

**Forberedelse:**
- [ ] Les denne planen
- [ ] Sett opp Git branch: `refactor/backend-services`
- [ ] Installer pytest: `pip install pytest pytest-cov pytest-mock`
- [ ] Backup eksisterende data

**Implementering:**
- [ ] Trinn 1: Opprett mappestruktur (30 min)
- [ ] Trinn 2: Ekstraher Base Repository (1-2 timer)
- [ ] Trinn 3: Flytt DataManager til CSVRepository (2-3 timer)
- [ ] Trinn 4: Ekstraher VarselService (4-6 timer)
- [ ] Trinn 5: Ekstraher KoeService (6-8 timer)
- [ ] Trinn 6: Ekstraher SvarService (6-8 timer)
- [ ] Trinn 7: Ekstraher CatendaService (4-6 timer)
- [ ] Trinn 8: Splitt routes til Blueprints (4-6 timer)
- [ ] Trinn 9: Skriv comprehensive tests (8-12 timer)
- [ ] Trinn 10: Implementer DataverseRepository (12-16 timer)

**Testing:**
- [ ] Unit tests kjører og passerer
- [ ] Integration tests kjører og passerer
- [ ] Manuell testing av alle endpoints
- [ ] Performance testing (ingen regresjon)

**Dokumentasjon:**
- [ ] Oppdater README.md med ny struktur
- [ ] Dokumenter hvordan teste lokalt
- [ ] Dokumenter deployment-prosess

**Godkjenning:**
- [ ] Code review
- [ ] Merge til main branch
- [ ] Deploy til test-miljø
- [ ] Deploy til produksjon

### 9.2 Estimert tidsbruk

| Fase | Tid |
|------|-----|
| Trinn 1-3: Grunnlag | 4-6 timer |
| Trinn 4-7: Services | 20-28 timer |
| Trinn 8: Routes | 4-6 timer |
| Trinn 9: Testing | 8-12 timer |
| **Total (ekskl. Dataverse)** | **36-52 timer (ca. 1-1.5 uke)** |
| Trinn 10: Dataverse | 12-16 timer (etter Azure-oppsett) |
| **Total (inkl. Dataverse)** | **48-68 timer (ca. 1.5-2 uker)** |

### 9.3 Risiko og mitigering

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Breaking changes i API | Lav | Høy | Comprehensive testing, parallel kjøring |
| Data loss ved migrering | Lav | Kritisk | Backup før start, dual-write strategi |
| Performance regresjon | Medium | Medium | Performance testing, profiling |
| Merge conflicts | Høy | Lav | Små commits, hyppig merge fra main |
| Scope creep | Medium | Medium | Strikt følge planen, ikke "forbedre" samtidig |

### 9.4 Suksesskriterier

✅ **Teknisk:**
- [ ] app.py < 100 linjer
- [ ] Alle services < 300 linjer
- [ ] Test coverage > 80%
- [ ] Alle eksisterende tester passerer
- [ ] Ingen performance-regresjon

✅ **Funksjonell:**
- [ ] Alle endpoints fungerer som før
- [ ] Webhook-integrasjon fungerer
- [ ] Catenda-integrasjon fungerer
- [ ] CSV-lagring fungerer

✅ **Kvalitet:**
- [ ] Code review godkjent
- [ ] Dokumentasjon oppdatert
- [ ] Deployment-guide skrevet
- [ ] Ingen kritiske bugs

---

**Vedlikeholdt av:** Claude
**Sist oppdatert:** 2025-11-27
**Status:** Klar for implementering
