# ADR-002: Reverse-indeks for Sak-relasjoner

**Status:** Akseptert
**Dato:** 2026-02-02
**Beslutningstagere:** Utviklingsteam
**Kontekst:** Ytelsesoptimalisering for relasjonsoppslag

---

## Sammendrag

Dette dokumentet beskriver beslutningen om å innføre en `sak_relations` tabell som CQRS-projeksjon for å muliggjøre O(1) reverse-oppslag av sak-relasjoner, i stedet for O(n) full-scan av alle saker.

---

## Kontekst

### Problemstilling

Funksjonene `finn_forseringer_for_sak()` og `finn_eoer_for_koe()` må finne alle forseringer/endringsordrer som refererer til en gitt KOE-sak. Den eksisterende implementasjonen:

1. Laster alle sak-IDer (60+ saker)
2. Henter events for hver sak
3. Beregner state for hver sak
4. Sjekker om saken refererer til target KOE

**Resultat:** 6+ sekunder per request, O(n) kompleksitet.

### Krav

- KOE-detaljsiden må vise "Forsering-banner" hvis saken er del av en forsering
- Må fungere med både JSON-backend (utvikling) og Supabase (produksjon)
- Events må forbli source of truth (CloudEvents-kompatibilitet)

---

## Alternativer vurdert

| Alternativ | Beskrivelse | Kompleksitet | Ytelse |
|------------|-------------|--------------|--------|
| A: Full scan | Nåværende løsning | Lav | O(n) - 6+ sek |
| B: CloudEvents `link` extension | Bruk standard extension | Middels | Fortsatt O(n) for reverse |
| C: JSONB GIN index | PostgreSQL indeks på `data->'avslatte_fristkrav'` | Høy | O(log n) |
| D: Projection table | Separat tabell for relasjoner | Middels | O(1) |

### Alternativ A: Full scan (nåværende)

```python
for sak_id in get_all_sak_ids():
    state = compute_state(sak_id)
    if target_id in state.forsering_data.avslatte_fristkrav:
        results.append(sak_id)
```

**Fordeler:** Ingen ekstra infrastruktur
**Ulemper:** Uakseptabel ytelse ved 60+ saker

### Alternativ B: CloudEvents `link` extension

CloudEvents v1.0 har en `link` extension for relasjoner mellom events. Kunne lagre relasjoner som:

```json
{
  "specversion": "1.0",
  "type": "no.oslo.koe.forsering_varsel",
  "link": [
    {"rel": "related", "href": "/cases/KOE-123"}
  ]
}
```

**Fordeler:** Standard CloudEvents
**Ulemper:** Krever fortsatt full scan for å finne "hvilke saker peker på meg"

### Alternativ C: JSONB GIN index

PostgreSQL kan indeksere JSONB-arrays:

```sql
CREATE INDEX idx_forsering_relaterte ON forsering_events
USING GIN ((data->'avslatte_fristkrav'));
```

**Fordeler:** Ingen ekstra tabell
**Ulemper:** Kompleks query, vanskelig å vedlikeholde, fungerer ikke med JSON-backend

### Alternativ D: Projection table (valgt)

Separat tabell som speiler relasjoner:

```sql
CREATE TABLE sak_relations (
    source_sak_id TEXT,  -- Forsering/EO
    target_sak_id TEXT,  -- KOE
    relation_type TEXT   -- 'forsering' | 'endringsordre'
);
```

**Fordeler:** O(1) lookup, enkelt, standard CQRS
**Ulemper:** Må holdes synkronisert med events

---

## Beslutning

**Valgt: D - Projection table (`sak_relations`)**

---

## Begrunnelse

### 1. Standard CQRS-mønster

Event Sourcing-arkitekturen bruker allerede projeksjoner (SakState beregnes fra events). En relasjonstabell er bare en annen projeksjon optimalisert for et spesifikt query-mønster.

```
CloudEvents (source of truth)     →     Projections (optimized for queries)
┌─────────────────────────────┐         ┌──────────────────────────┐
│ forsering_events            │         │ sak_relations            │
│ - FORSERING_VARSEL          │  ───►   │ - source: FORS-001       │
│   data.avslatte_fristkrav   │         │ - target: KOE-123        │
│   = ["KOE-123", "KOE-456"]  │         │ - type: forsering        │
└─────────────────────────────┘         └──────────────────────────┘
```

### 2. CloudEvents-kompatibilitet

CloudEvents-spesifikasjonen definerer **format** for events, ikke lagring eller querying. Events lagres uendret i CloudEvents-format. Projection-tabellen er derivert data som kan regenereres fra events ved behov.

### 3. Fallback for JSON-backend

Implementasjonen beholder full-scan som fallback for JSON-backend (lokal utvikling), slik at systemet fungerer uten Supabase.

### 4. Konsistensgaranti

Projeksjonen oppdateres synkront i samme kodeflyt som event lagres. Ved eventuell inkonsistens kan tabellen regenereres via backfill-scriptet.

---

## Konsekvenser

| Type | Konsekvens |
|------|------------|
| Positiv | O(1) oppslag - <100ms vs 6+ sekunder |
| Positiv | Skalerbar til tusenvis av saker |
| Positiv | Enkelt å forstå og vedlikeholde |
| Positiv | Kan regenereres fra events |
| Negativ | Ekstra tabell å vedlikeholde |
| Negativ | Må oppdateres ved nye relasjons-events |
| Risiko | Kan bli ut av synk (mitigert av backfill) |

---

## Implementasjon

### Database-skjema

```sql
CREATE TABLE sak_relations (
    id SERIAL PRIMARY KEY,
    source_sak_id TEXT NOT NULL,
    target_sak_id TEXT NOT NULL,
    relation_type TEXT NOT NULL CHECK (relation_type IN ('forsering', 'endringsordre')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_sak_id, target_sak_id, relation_type)
);

CREATE INDEX idx_sak_relations_target ON sak_relations(target_sak_id, relation_type);
CREATE INDEX idx_sak_relations_source ON sak_relations(source_sak_id);
```

### Repository

```python
class RelationRepository:
    def add_relation(source_sak_id, target_sak_id, relation_type)
    def remove_relation(source_sak_id, target_sak_id, relation_type)
    def get_containers_for_sak(target_sak_id, relation_type)  # reverse lookup
    def get_related_saks(source_sak_id)  # forward lookup
```

### Service-integrasjon

```python
def finn_forseringer_for_sak(self, sak_id):
    # Fast path: Use index if available
    if self.relation_repository:
        return self._finn_forseringer_via_index(sak_id)

    # Slow path: Full scan fallback
    return self._finn_forseringer_via_scan(sak_id)
```

### Backfill

```bash
# Populer tabellen fra eksisterende events
python scripts/backfill_relations.py

# Dry run
python scripts/backfill_relations.py --dry-run

# Rebuild fra scratch
python scripts/backfill_relations.py --rebuild
```

---

## Filer

| Fil | Beskrivelse |
|-----|-------------|
| `backend/migrations/003_sak_relations.sql` | Database-migrasjon |
| `backend/repositories/relation_repository.py` | Repository-klasse |
| `backend/scripts/backfill_relations.py` | Backfill-script |
| `backend/services/forsering_service.py` | Oppdatert med indeks-støtte |
| `backend/services/endringsordre_service.py` | Oppdatert med indeks-støtte |

---

## Relaterte dokumenter

- [ARCHITECTURE_AND_DATAMODEL.md](ARCHITECTURE_AND_DATAMODEL.md) - System-arkitektur
- [CLOUDEVENTS_ADOPTION.md](CLOUDEVENTS_ADOPTION.md) - CloudEvents-format
- `backend/migrations/003_sak_relations.sql` - Database-skjema

---

## Endringslogg

| Dato | Versjon | Endring |
|------|---------|---------|
| 2026-02-02 | 1.0 | Initial versjon |
