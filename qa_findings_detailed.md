# Detaljerte QA-funn - Fase 3-7

## 🔴 CRITICAL - Ny runde

### C1: Pydantic v2 Validator Syntax (KRITISK!)
**Lokasjon:** Linje 476 (models/varsel.py eksempel)

**Problem:**
```python
# ❌ Pydantic v1 syntax
@validator('dato_forhold_oppdaget', 'dato_varsel_sendt')
def validate_date_format(cls, v):
    ...
```

**Korrekt Pydantic v2:**
```python
# ✅ Pydantic v2 syntax
from pydantic import field_validator

@field_validator('dato_forhold_oppdaget', 'dato_varsel_sendt')
@classmethod
def validate_date_format(cls, v):
    ...
```

**Impact:** Koden vil ikke kjøre med Pydantic v2.

---

### C2: Pydantic v2 Config Class (KRITISK!)
**Lokasjon:** Linje 497-512 (models/varsel.py eksempel)

**Problem:**
```python
# ❌ Pydantic v1 syntax
class Config:
    json_encoders = {...}
    schema_extra = {...}
```

**Korrekt Pydantic v2:**
```python
# ✅ Pydantic v2 syntax
from pydantic import ConfigDict

model_config = ConfigDict(
    json_schema_extra={
        "example": {...}
    }
)

# Note: json_encoders er deprecated i v2 - bruk serialization_alias eller custom serializers
```

**Impact:** Koden vil ikke kjøre med Pydantic v2.

---

### C3: Varsel.to_dict() Metode Mangler (KRITISK!)
**Lokasjon:** Linje 397 (services/varsel_service.py)

**Problem:**
```python
updated_data = {
    **sak_data,
    'varsel': varsel.to_dict(),  # ❌ Denne metoden eksisterer ikke!
    ...
}
```

**Korrekt:**
```python
# ✅ Pydantic v2
'varsel': varsel.model_dump()

# eller v1 (hvis det var v1)
'varsel': varsel.dict()
```

**Impact:** Runtime error - AttributeError: 'Varsel' object has no attribute 'to_dict'

---

### C4: Pydantic v2 .dict() og .json() Dokumentasjon Feil
**Lokasjon:** Linje 531 (Seksjon 4.4.1)

**Problem:** Dokumentet sier `.dict()` og `.json()` er robuste, men dette er Pydantic v1 API.

**Korrekt:** I Pydantic v2 er disse deprecated:
- `.dict()` → `.model_dump()`
- `.json()` → `.model_dump_json()`

**Impact:** Misleading dokumentasjon - koden vil kjøre med warnings eller feile.

---

## 🟡 WARNINGS - Arkitektur og Design

### W1: Dependency Injection Pattern Ikke Konsekvent
**Lokasjon:** Linje 312 (routes/varsel_routes.py)

**Problem:**
```python
service = VarselService()  # Oppretter ny instans per request
```

Dette er OK for prototype, men:
- Ingen gjenbruk av connections
- Hver request oppretter nye CSVRepository() og CatendaService()
- Ikke optimalt for ytelse i produksjon

**Anbefaling:** Legg til en seksjon om Service Lifetime Management:
- Request-scoped vs Singleton services
- Dependency Injection Container (f.eks. dependency-injector pakke)

**Impact:** Medium - fungerer, men ikke best practice.

---

### W2: CSVRepository._ensure_directories() Mangler
**Lokasjon:** Linje 434 (repositories/csv_repository.py)

**Problem:**
```python
def __init__(self, data_dir: str = "koe_data"):
    ...
    self._ensure_directories()  # ❌ Metode ikke definert i eksempel
```

**Impact:** Eksempel vil krasje hvis man kopierer det direkte. Bør legges til eller kommenteres.

---

### W3: CSVRepository Mangler Error Handling
**Lokasjon:** Linje 436-449 (repositories/csv_repository.py)

**Problem:** Ingen try/except rundt file operations:
```python
def get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
    file_path = self.form_data_dir / f"{case_id}.json"
    if not file_path.exists():
        return None

    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)  # ❌ Ingen error handling
```

**Hva kan gå galt:**
- JSON parse error
- Permission denied
- Disk full på write
- Corrupted file

**Anbefaling:** Legg til error handling eksempel.

**Impact:** Medium - produksjonskode må håndtere dette.

---

### W4: BaseRepository Ufullstendig Implementert i Eksempel
**Lokasjon:** Linje 428-449

**Problem:** CSVRepository eksempel viser kun:
- get_case() ✅
- update_case() ✅

Men BaseRepository krever også:
- create_case() ❌
- list_cases() ❌

**Impact:** Lav - det er et eksempel, men kan forvirre.

---

### W5: CatendaService Circular Dependency Risk
**Lokasjon:** Linje 356 (services/varsel_service.py)

**Problem:**
```python
self.catenda = catenda_service or CatendaService()
```

Hvis CatendaService også tar andre services som dependencies, kan dette skape sirkulære avhengigheter.

**Anbefaling:** Diskuter Dependency Injection best practices.

**Impact:** Medium - kan bli et problem ved skalering.

---

## 🔵 INFO - Forbedringer

### I1: Service Factory Pattern Mangler
**Anbefaling:** Legg til et eksempel på Service Factory eller Dependency Container:

```python
# services/service_factory.py
class ServiceFactory:
    def __init__(self, repository=None):
        self.repository = repository or CSVRepository()
        self._catenda_service = None

    def get_varsel_service(self) -> VarselService:
        return VarselService(
            repository=self.repository,
            catenda_service=self.get_catenda_service()
        )

    def get_catenda_service(self) -> CatendaService:
        if not self._catenda_service:
            self._catenda_service = CatendaService()
        return self._catenda_service
```

Dette gir:
- Singleton services der det trengs
- Enklere testing
- Konsistent dependency management

---

### I2: Repository Connection/Resource Management
CSVRepository holder filer åpne/lukker dem per operasjon. For Dataverse må connection pooling håndteres.

**Anbefaling:** Diskuter connection management i BaseRepository.

---

### I3: Transactional Operations Mangler
Hva skjer hvis update_case() feiler halvveis? Ingen rollback-mekanisme.

**Anbefaling:** Diskuter transaksjonssikkerhet for Dataverse.

---

## Status Fase 3 (Arkitektur Review)

✅ Lagdeling - Godt designet
⚠️ Dependency Injection - Fungerer, men ikke best practice
❌ Pydantic v2 - Flere kritiske feil
⚠️ Error Handling - Mangler
⚠️ Resource Management - Ikke diskutert

## Neste: Fase 4-7
- Fase 4: Infrastruktur og Azure (validere YAML, pipelines)
- Fase 5: Testing (validere test-eksempler)
- Fase 6: Dokumentasjon (cross-references, formatering)
- Fase 7: Stakeholder review

## Fase 4: Azure og Infrastruktur

### C5: Azure DevOps YAML Ufullstendig (KRITISK!)
**Lokasjon:** Linje 1530-1569

**Mangler:**
1. **UsePythonVersion** mangler inputs:
```yaml
- task: UsePythonVersion@0
  inputs:
    versionSpec: '3.11'  # MANGLER
```

2. **ArchiveFiles** mangler inputs:
```yaml
- task: ArchiveFiles@2
  inputs:
    rootFolderOrFile: '$(System.DefaultWorkingDirectory)/backend'  # MANGLER
    includeRootFolder: false  # MANGLER
    archiveFile: '$(Build.ArtifactStagingDirectory)/$(Build.BuildId).zip'  # MANGLER
```

3. **Publish artifact** mangler helt:
```yaml
- task: PublishBuildArtifacts@1  # HELT MANGLER
  inputs:
    PathtoPublish: '$(Build.ArtifactStagingDirectory)'
    ArtifactName: 'drop'
```

4. **Download artifact** i deploy stage mangler:
```yaml
- task: DownloadBuildArtifacts@1  # HELT MANGLER
```

5. **AzureFunctionApp** mangler package location:
```yaml
inputs:
  azureSubscription: 'Oslobygg-Sub'
  appName: 'oe-koe-test'
  package: '$(Pipeline.Workspace)/drop/*.zip'  # MANGLER
  appType: 'functionAppLinux'  # MANGLER
  runtimeStack: 'PYTHON|3.11'  # MANGLER
```

**Impact:** Pipeline vil feile. Dette er en kritisk feil.

---

### W6: Secrets Management Mangler i Pipeline
**Lokasjon:** Azure DevOps pipeline

**Problem:** Ingen Key Vault integration vist.

**Skal legges til:**
```yaml
- task: AzureKeyVault@2
  inputs:
    azureSubscription: 'Oslobygg-Sub'
    KeyVaultName: 'kv-oe-koe-test'
    SecretsFilter: '*'
  displayName: 'Fetch secrets from Key Vault'
```

---

## Fase 5: Testing

### W7: Test Fixtures Ufullstendige
**Lokasjon:** Linje 1238-1259

**Problem:** Fixture-eksempel mangler viktige elementer:
- Ingen cleanup (yield pattern)
- Ingen parametrize examples
- Ingen mock fixtures

---

### W8: Pytest Configuration Eksempel Mangler Viktige Settings
**Lokasjon:** Ikke i dokumentet

**Bør legges til:**
```ini
[pytest]
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow tests
filterwarnings =
    error
    ignore::DeprecationWarning
```

---

## Fase 6: Dokumentasjon

### W9: Cross-References Ikke Alle Validert
Sjekket stikkprøver - generelt OK, men noen "Seksjon X.Y.Z" referanser ikke verifisert.

### W10: Innholdsfortegnelse Mangler Subseksjoner
**Lokasjon:** Linje 9-20

Innholdsfortegnelsen viser kun nivå 1-2 overskrifter, men dokumentet har mange nivå 3-4 overskrifter som ikke er listet.

---

## Fase 7: Stakeholder Review

### I4: Utvikler-Perspektiv Gaps
**Onboarding:** Dokumentet mangler:
- Hvordan sette opp lokal utviklingsmiljø fra scratch
- Hvilken IDE/editor anbefales
- Hvordan kjøre Flask lokalt første gang
- Debugging guide

### I5: Ops-Perspektiv Gaps  
**Drift:** Dokumentet mangler:
- Monitoring dashboards oppsett
- Alert rules konfigurering
- Incident response playbook
- Backup og restore prosedyrer
- Disaster recovery plan

### I6: Manglende Sikkerhetsvurdering
**Security:** Dokumentet mangler:
- GDPR/personvern vurdering
- Sikkerhetstrussel-modell
- Penetrasjonstesting plan
- Sikkerhetsaudit før produksjon

---

## TOTALE FUNN

### Critical (MÅ fikses):
1. Pydantic v2 @validator syntax
2. Pydantic v2 Config class
3. Varsel.to_dict() mangler
4. Pydantic .dict()/.json() dokumentasjon
5. Azure DevOps YAML ufullstendig

### Warnings (BØR fikses):
1. Dependency Injection ikke konsekvent
2. CSVRepository._ensure_directories() mangler
3. CSVRepository error handling mangler
4. BaseRepository ufullstendig implementert
5. CatendaService circular dependency risk
6. Secrets management mangler i pipeline
7. Test fixtures ufullstendige
8. Pytest config mangler
9. Cross-references ikke alle validert
10. Innholdsfortegnelse mangler subseksjoner

### Info (Nice-to-have):
1. Service Factory pattern mangler
2. Repository connection management
3. Transactional operations mangler
4. Utvikler onboarding mangler
5. Ops/drift dokumentasjon mangler
6. Sikkerhetsvurdering mangler

---

## KONKLUSJON

**Total Issues:** 5 Critical, 10 Warnings, 6 Info = 21 issues

**Status:** IKKE GODKJENT - må fikse alle Critical issues før implementering.

Min første QA-pass var ALT for overfladisk. Jeg fikset kun 2 av 5 critical issues.
