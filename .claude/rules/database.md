---
paths:
  - "backend/migrations/**"
  - "supabase/migrations/**"
  - "backend/repositories/**"
  - "backend/models/**"
  - "**/*supabase*"
  - "**/*migration*"
---

# Database: Supabase PostgreSQL

## Tabellskjema (KOE-applikasjonen)

### Event-tabeller (Event Sourcing)

Tre event-tabeller med identisk struktur (CloudEvents-format):

| Tabell | Innhold | Rader |
|--------|---------|-------|
| `koe_events` | Standard KOE-saker | ~250 |
| `forsering_events` | Forseringssaker (SS33.8) | ~35 |
| `endringsordre_events` | Endringsordresaker (SS31.3) | ~210 |

**Felles kolonner (alle event-tabeller):**
```
id              SERIAL PK
event_id        UUID UNIQUE          -- CloudEvents ID
sak_id          TEXT NOT NULL         -- FK -> sak_metadata.sak_id
event_type      TEXT NOT NULL
versjon         INTEGER NOT NULL      -- Optimistisk locking
actor           TEXT NOT NULL
actorrole       TEXT CHECK ('TE','BH')
data            JSONB NOT NULL
time            TIMESTAMPTZ DEFAULT NOW()
comment         TEXT
referstoid      UUID                  -- Referanse til forrige event
```

### sak_metadata

Sentral metadatatabell som alle events peker til. Fungerer som indeks over alle saker.

```
sak_id          TEXT PK
prosjekt_id     TEXT NOT NULL DEFAULT 'oslobygg'  -- Prosjekt-scoping
sakstype        TEXT DEFAULT 'standard'           -- standard|forsering|endringsordre
created_at      TIMESTAMPTZ
created_by      TEXT
cached_title    TEXT                              -- Denormalisert for ytelse
cached_status   TEXT
cached_sum_krevd      NUMERIC
cached_sum_godkjent   NUMERIC
cached_dager_krevd    INTEGER
cached_dager_godkjent INTEGER
cached_hovedkategori  TEXT
cached_underkategori  TEXT
last_event_at   TIMESTAMPTZ
catenda_topic_id      TEXT                        -- Catenda-integrasjon
catenda_board_id      TEXT
catenda_project_id    TEXT
```

### projects

Multi-prosjekt (Fase 1). Alle saker scopes via `sak_metadata.prosjekt_id`.

```
id          TEXT PK           -- f.eks. 'oslobygg'
name        TEXT NOT NULL
description TEXT
settings    JSONB DEFAULT '{}'
created_by  TEXT
is_active   BOOLEAN DEFAULT TRUE
created_at  TIMESTAMPTZ
```

### project_memberships

Tilgangsstyring (Fase 2). Email-basert for Entra ID-kompatibilitet.

```
id          UUID PK DEFAULT gen_random_uuid()
project_id  TEXT NOT NULL FK -> projects(id) ON DELETE CASCADE
user_email  TEXT NOT NULL
external_id TEXT              -- Reservert for Entra ID oid
role        TEXT DEFAULT 'member' CHECK ('admin','member','viewer')
display_name TEXT
invited_by  TEXT
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
UNIQUE(project_id, user_email)
```

**Trigger:** `trg_auto_membership_on_project_create` - Oppretter automatisk admin-medlemskap for prosjekt-oppretteren.

### magic_links

Autentisering via epost-lenker.

```
token       UUID PK DEFAULT gen_random_uuid()
sak_id      TEXT FK -> sak_metadata.sak_id
email       TEXT
expires_at  TIMESTAMPTZ
used        BOOLEAN DEFAULT FALSE
revoked     BOOLEAN DEFAULT FALSE
```

### user_groups

Domeneroller og godkjenningshierarki.

```
id          UUID PK
user_id     UUID FK -> auth.users(id) UNIQUE
group_name  TEXT CHECK ('byggherre','entreprenor')
user_role   TEXT GENERATED ('BH' eller 'TE')
approval_role TEXT CHECK ('PL','SL','AL','DU','AD')
display_name TEXT
department  TEXT
manager_id  UUID FK -> user_groups(id)  -- Hierarki
is_active   BOOLEAN DEFAULT TRUE
```

### sak_relations

Kobling mellom standard-saker og forsering/endringsordre.

```
id              SERIAL PK
source_sak_id   TEXT     -- KOE-saken
target_sak_id   TEXT     -- Forsering eller EO
relation_type   TEXT CHECK ('forsering','endringsordre')
```

### Dalux-Catenda sync-tabeller

| Tabell | Formaal |
|--------|---------|
| `dalux_catenda_sync_mappings` | Sync-konfigurasjon per prosjekt |
| `dalux_task_sync_records` | Synkroniserte oppgaver |
| `dalux_attachment_sync_records` | Synkroniserte vedlegg |

### Andre tabeller (ikke direkte KOE)

`lovdata_*` og `kofa_*` tabellene brukes av MCP-servere (Paragraf og KOFA) og er ikke direkte relevante for KOE-applikasjonen.

## RLS-monster

Alle tabeller har RLS aktivert. Standard policy-monster:

```sql
-- Backend (service_role) har full tilgang - bypasser RLS
CREATE POLICY "Service role full access on <tabell>"
ON <tabell> FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Autentiserte brukere kan lese
CREATE POLICY "Authenticated users can read <tabell>"
ON <tabell> FOR SELECT
TO authenticated
USING (true);
```

**Viktig:** Backend bruker `service_role` key og trenger ikke RLS. RLS er et forsvarslag, ikke primaer tilgangskontroll. Tilgangskontroll haandteres av `@require_project_access`-dekoratoren i applikasjonslageet.

## SQL-konvensjoner

- **Navngiving:** `snake_case` for tabeller og kolonner
- **Primaernokler:** `id` (UUID med `gen_random_uuid()`) eller `sak_id` (TEXT) for domene-IDer
- **Timestamps:** Alltid `TIMESTAMPTZ`, aldri `TIMESTAMP`
- **Defaults:** `DEFAULT NOW()` for `created_at`, `DEFAULT gen_random_uuid()` for UUIDs
- **CHECK constraints:** Bruk `CHECK (col = ANY (ARRAY['a','b']))` for enums
- **Nye migrasjoner:** Kun i `supabase/migrations/YYYYMMDD_beskrivelse.sql`
- **Legacy migrasjoner:** `backend/migrations/` er historisk (allerede kjort) - ikke legg til nye der
- **Idempotens:** Bruk `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DROP POLICY IF EXISTS`

## Gotchas

1. **prosjekt_id er TEXT, ikke UUID** - Bruker lesbare IDer som 'oslobygg'
2. **Event-tabeller mangler FK til projects** - Scoping gaar via `sak_metadata.prosjekt_id`
3. **user_email i memberships er case-insensitive** - Normaliser alltid til lowercase for du lagrer
4. **auth.uid() i RLS** - Bruk `(select auth.uid())` i subquery for ytelse (unngaa initplan-warning)
5. **Cached felter i sak_metadata** - Denormalisert for rapportering, oppdateres fra backend
6. **versjon-feltet** - Brukes for optimistisk concurrency control i event sourcing
7. **OPEN_ACCESS_PROJECTS** - 'oslobygg' har aapen tilgang, sjekkes i applikasjonslaget, ikke i RLS
8. **Supabase MCP** - Bruk `mcp__supabase__execute_sql` for aa kjore migrasjoner, `mcp__supabase__list_tables` for aa sjekke skjema
