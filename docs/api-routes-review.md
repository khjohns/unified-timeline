# API Routes Vurdering

> Dato: 2025-12-19
> Status: Dokumentert

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

## Vedlegg: Fil-referanser

- `backend/routes/event_routes.py` - 687 linjer
- `backend/routes/forsering_routes.py` - 552 linjer
- `backend/routes/endringsordre_routes.py` - 360 linjer
- `backend/routes/utility_routes.py` - 139 linjer
- `backend/routes/webhook_routes.py` - 148 linjer
- `backend/scripts/generate_openapi.py` - 1044 linjer
- `backend/docs/openapi.yaml` - Generert spesifikasjon
