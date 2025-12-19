# API Routes Vurdering

> Dato: 2025-12-19
> Status: **Implementert** ✅

## Oversikt

Denne dokumentasjonen oppsummerer en gjennomgang av API-routes for KOE-applikasjonen, med fokus på:
- Konsolideringsmuligheter mellom sakstyper
- OpenAPI-spesifikasjon vs faktiske endepunkter
- Anbefalinger for forbedring

## Sakstyper i systemet

| Sakstype | Beskrivelse | NS 8407 |
|----------|-------------|---------|
| **Standard KOE** | Krav om endringsordre (køsak) | §33 |
| **Forsering** | Akselerasjonskrav ved avslått frist | §33.8 |
| **Endringsordre** | Formell bekreftelse av kontraktsendring | §31.3 |

## Endepunktoversikt

### Events API (`event_routes.py`)

| Endepunkt | Metode | Beskrivelse | Auth |
|-----------|--------|-------------|------|
| `/api/events` | POST | Send enkelt event | CSRF + Magic Link |
| `/api/events/batch` | POST | Send flere events atomisk | CSRF + Magic Link |
| `/api/cases/<sak_id>/state` | GET | Hent beregnet tilstand | Magic Link |
| `/api/cases/<sak_id>/timeline` | GET | Hent hendelsestidslinje | Magic Link |
| `/api/cases/<sak_id>/historikk` | GET | Hent revisjonshistorikk | Magic Link |

### Forsering API (`forsering_routes.py`)

| Endepunkt | Metode | Beskrivelse | Auth | I OpenAPI |
|-----------|--------|-------------|------|-----------|
| `/api/forsering/opprett` | POST | Opprett forseringssak | CSRF + Magic Link | ✅ |
| `/api/forsering/kandidater` | GET | Hent kandidat-KOE-saker | Ingen | ✅ |
| `/api/forsering/valider` | POST | Valider 30%-regelen | Magic Link | ✅ |
| `/api/forsering/<sak_id>/kontekst` | GET | Hent komplett kontekst | Magic Link | ✅ |
| `/api/forsering/<sak_id>/relaterte` | GET | Hent relaterte saker | Magic Link | ❌ |
| `/api/forsering/<sak_id>/relatert` | POST | Legg til relatert sak | CSRF + Magic Link | ❌ |
| `/api/forsering/<sak_id>/relatert/<koe_id>` | DELETE | Fjern relatert sak | CSRF + Magic Link | ❌ |
| `/api/forsering/<sak_id>/bh-respons` | POST | Registrer BH-respons | CSRF + Magic Link | ❌ |
| `/api/forsering/<sak_id>/stopp` | POST | Stopp forsering | CSRF + Magic Link | ❌ |
| `/api/forsering/<sak_id>/kostnader` | PUT | Oppdater kostnader | CSRF + Magic Link | ❌ |
| `/api/forsering/by-relatert/<sak_id>` | GET | Finn forseringer for KOE | Magic Link | ❌ |

### Endringsordre API (`endringsordre_routes.py`)

| Endepunkt | Metode | Beskrivelse | Auth | I OpenAPI |
|-----------|--------|-------------|------|-----------|
| `/api/endringsordre/opprett` | POST | Opprett endringsordre | CSRF + Magic Link | ✅ |
| `/api/endringsordre/kandidater` | GET | Hent kandidat-KOE-saker | Ingen | ✅ |
| `/api/endringsordre/<sak_id>/kontekst` | GET | Hent komplett kontekst | Magic Link | ✅ |
| `/api/endringsordre/<sak_id>/relaterte` | GET | Hent relaterte KOE-saker | Magic Link | ❌ |
| `/api/endringsordre/<sak_id>/koe` | POST | Legg til KOE | CSRF + Magic Link | ✅ |
| `/api/endringsordre/<sak_id>/koe/<koe_id>` | DELETE | Fjern KOE | CSRF + Magic Link | ✅ |
| `/api/endringsordre/by-relatert/<sak_id>` | GET | Finn EO-er for KOE | Magic Link | ❌ |

### Utility API (`utility_routes.py`)

| Endepunkt | Metode | Beskrivelse | I OpenAPI |
|-----------|--------|-------------|-----------|
| `/api/csrf-token` | GET | Hent CSRF-token | ✅ |
| `/api/magic-link/verify` | GET | Verifiser magic link | ✅ |
| `/api/health` | GET | Helsesjekk | ✅ |
| `/api/metadata/by-topic/<topic>` | GET | Hent metadata etter topic | ❌ |
| `/api/validate-user` | POST | Valider bruker i Catenda | ❌ |

## Dupliseringsmønstre

### Felles mønstre mellom Forsering og Endringsordre

Begge sakstyper implementerer nesten identisk funksjonalitet:

```
┌─────────────────────────────────────────────────────────────────┐
│                    FELLES MØNSTER                               │
├─────────────────────────────────────────────────────────────────┤
│  /opprett              → Opprett ny sak                         │
│  /<id>/relaterte       → Hent relaterte saker                   │
│  /<id>/kontekst        → Hent komplett kontekst                 │
│  /kandidater           → Hent kandidat-saker                    │
│  /by-relatert/<id>     → Finn saker som refererer til KOE       │
│  /<id>/relatert (POST) → Legg til relatert sak                  │
│  /<id>/relatert (DEL)  → Fjern relatert sak                     │
└─────────────────────────────────────────────────────────────────┘
```

### Unike endepunkter

**Kun Forsering:**
- `/api/forsering/valider` - Validerer 30%-regelen (dagmulkt)
- `/api/forsering/<id>/bh-respons` - BH aksepterer/avslår
- `/api/forsering/<id>/stopp` - Stopp aktiv forsering
- `/api/forsering/<id>/kostnader` - Oppdater påløpte kostnader

**Kun Endringsordre:**
- Konsekvens-felter i opprett (SHA, kvalitet, fremdrift, pris)
- Oppgjørsform og kompensasjon/fradrag

## Kontekst-respons struktur

Begge sakstyper returnerer lignende kontekst-struktur:

```typescript
interface KontekstResponse {
  success: boolean;
  sak_id: string;
  relaterte_saker: SakRelasjon[];
  sak_states: Record<string, SakState>;
  hendelser: Record<string, TimelineEntry[]>;
  oppsummering: {
    // Type-spesifikke felter
  };
}
```

**Forsering-spesifikk oppsummering:**
- `antall_relaterte_saker`
- `total_krevde_dager`
- `total_avslatte_dager`
- `grunnlag_oversikt[]`

**Endringsordre-spesifikk oppsummering:**
- `antall_koe_saker`
- `total_krevd_vederlag` / `total_godkjent_vederlag`
- `total_krevd_dager` / `total_godkjent_dager`
- `koe_oversikt[]`

## Inkonsekvenser i URL-mønstre

| Forsering | Endringsordre | Merknad |
|-----------|---------------|---------|
| `/relatert` (entall) | `/koe` (spesifikt) | Bør standardiseres |
| `koe_sak_id` parameter | `koe_sak_id` parameter | Konsistent ✓ |

## Anbefalinger

### 1. Oppdater OpenAPI-spesifikasjon (Høy prioritet)

**Mangler 9 endepunkter:**
- 7 fra Forsering
- 2 fra Endringsordre

Oppdater `backend/scripts/generate_openapi.py` og regenerer.

### 2. Vurder felles base-mønster (Medium prioritet)

Mulig abstraksjon for relaterte-saker-funksjonalitet:

```python
# Konseptuelt - ikke implementert ennå
class RelatedCasesRouteMixin:
    """Felles routes for sakstyper med relaterte saker."""

    def get_related(self, sak_id): ...
    def get_context(self, sak_id): ...
    def get_candidates(self): ...
    def add_related(self, sak_id, related_id): ...
    def remove_related(self, sak_id, related_id): ...
```

**Gevinst:** ~200 linjer mindre duplisert kode

### 3. Standardiser URL-mønstre (Lav prioritet)

Forslag:
- Bruk `/relaterte` (flertall) konsistent for begge sakstyper
- Alternativt: Behold domenespesifikke navn (`/koe` for EO)

### 4. Frontend API-konsolidering (Lav prioritet)

Felles mock-wrapper:
```typescript
const withMockSupport = <T>(
  mockFn: () => Promise<T>,
  realFn: () => Promise<T>
): Promise<T> => USE_MOCK_API ? mockFn() : realFn();
```

## Statistikk

| Kategori | Antall routes | I OpenAPI | Mangler |
|----------|---------------|-----------|---------|
| Events | 5 | 5 | 0 |
| Forsering | 12 | 5 | 7 |
| Endringsordre | 8 | 6 | 2 |
| Utility | 5 | 3 | 2 |
| Webhooks | 1 | 1 | 0 |
| **Totalt** | **31** | **20** | **11** |

## Implementert konsolidering

Følgende konsolidering ble implementert 2025-12-19:

### 1. OpenAPI oppdatert ✅

Alle 9 manglende endepunkter lagt til i `generate_openapi.py`:
- 7 fra Forsering
- 2 fra Endringsordre

OpenAPI har nå **27 paths** (opp fra 20).

### 2. Backend service-konsolidering ✅

**`backend/services/base_sak_service.py`** utvidet med:
- `legg_til_relatert_sak()` - Felles metode for toveis-relasjoner
- `fjern_relatert_sak()` - Felles metode for å fjerne relasjoner

**Resultat:**
- `ForseringService` arver metodene fra base class
- `EndringsordreService` bruker aliases (`legg_til_koe`, `fjern_koe`)
- ~60 linjer duplisert kode fjernet fra services

### 3. Backend route utilities ✅

**Ny fil:** `backend/routes/related_cases_utils.py`

Felles funksjoner:
- `serialize_sak_relasjon()` / `serialize_relaterte_saker()`
- `serialize_sak_states()`
- `build_relaterte_response()`
- `build_kontekst_response()`
- `build_kandidater_response()`
- `build_success_message()`
- `validate_required_fields()`
- `safe_find_related()`

**Resultat:**
- `forsering_routes.py`: 552 → 336 linjer (-39%)
- `endringsordre_routes.py`: 360 → 185 linjer (-49%)

### 4. Frontend utilities ✅

**Ny fil:** `src/api/utils.ts`

Felles funksjoner:
- `withMockSupport<T>()` - Wrapper for API-kall med mock-støtte
- `apiGet<T>()`, `apiPost<T>()`, `apiPut<T>()`, `apiDelete<T>()`
- Felles respons-typer: `SuccessResponse`, `RelaterteSakerResponse`, `KandidaterResponse`

## Vedlegg: Fil-referanser

### Backend Routes
- `backend/routes/event_routes.py` - 687 linjer
- `backend/routes/forsering_routes.py` - 336 linjer (konsolidert)
- `backend/routes/endringsordre_routes.py` - 185 linjer (konsolidert)
- `backend/routes/related_cases_utils.py` - 170 linjer (ny)
- `backend/routes/utility_routes.py` - 139 linjer
- `backend/routes/webhook_routes.py` - 148 linjer

### Backend Services
- `backend/services/base_sak_service.py` - 290 linjer (utvidet)
- `backend/services/forsering_service.py` - 585 linjer (konsolidert)
- `backend/services/endringsordre_service.py` - 420 linjer (konsolidert)

### OpenAPI
- `backend/scripts/generate_openapi.py` - 1240 linjer (oppdatert)
- `backend/docs/openapi.yaml` - Generert med 27 paths

### Frontend
- `src/api/utils.ts` - 120 linjer (ny)
- `src/api/forsering.ts` - 424 linjer
- `src/api/endringsordre.ts` - 497 linjer
