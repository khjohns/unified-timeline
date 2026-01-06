# Supabase Analytics Views

SQL views og spørringer som kan brukes for analyse av event-data i Supabase.
Disse kan kjøres direkte i Supabase Studio SQL Editor, eller brukes som grunnlag
for Power BI/Dataverse-rapporter i produksjon.

## Oversikt

Event-sourcing arkitekturen lagrer all data som immutable hendelser i tre tabeller:
- `koe_events` - Standard endringssaker (KOE)
- `forsering_events` - Forseringssaker (§33.8)
- `endringsordre_events` - Endringsordresaker (§31.3)

## Analytics Views

### 1. Sammendrag per sak

```sql
-- View: Sammendrag per sak med siste status
CREATE OR REPLACE VIEW analytics_sak_summary AS
SELECT
    e.sak_id,
    MIN(e.time) as opprettet_dato,
    MAX(e.time) as siste_aktivitet,
    COUNT(*) as antall_events,
    MAX(CASE WHEN e.event_type = 'grunnlag_opprettet' THEN e.data->>'hovedkategori' END) as hovedkategori,
    MAX(CASE WHEN e.event_type = 'grunnlag_opprettet' THEN e.data->>'tittel' END) as tittel,
    MAX(CASE WHEN e.event_type LIKE 'respons_%' THEN e.time END) as siste_respons_dato
FROM koe_events e
GROUP BY e.sak_id
ORDER BY siste_aktivitet DESC;
```

### 2. Statusfordeling

```sql
-- View: Antall saker per status (basert på siste respons)
CREATE OR REPLACE VIEW analytics_status_distribution AS
WITH latest_grunnlag_respons AS (
    SELECT DISTINCT ON (sak_id)
        sak_id,
        data->>'resultat' as grunnlag_resultat
    FROM koe_events
    WHERE event_type = 'respons_grunnlag'
    ORDER BY sak_id, time DESC
)
SELECT
    COALESCE(grunnlag_resultat, 'under_behandling') as status,
    COUNT(*) as antall
FROM (
    SELECT DISTINCT sak_id FROM koe_events
) saker
LEFT JOIN latest_grunnlag_respons lgr USING (sak_id)
GROUP BY 1
ORDER BY antall DESC;
```

### 3. Grunnlagskategorier med godkjenningsrate

```sql
-- View: Godkjenningsrate per grunnlagskategori
CREATE OR REPLACE VIEW analytics_category_approval AS
WITH grunnlag AS (
    SELECT
        sak_id,
        data->>'hovedkategori' as kategori
    FROM koe_events
    WHERE event_type = 'grunnlag_opprettet'
),
respons AS (
    SELECT DISTINCT ON (sak_id)
        sak_id,
        data->>'resultat' as resultat
    FROM koe_events
    WHERE event_type = 'respons_grunnlag'
    ORDER BY sak_id, time DESC
)
SELECT
    g.kategori,
    COUNT(*) as antall,
    COUNT(CASE WHEN r.resultat = 'godkjent' THEN 1 END) as godkjent,
    COUNT(CASE WHEN r.resultat = 'delvis_godkjent' THEN 1 END) as delvis_godkjent,
    COUNT(CASE WHEN r.resultat = 'avslatt' THEN 1 END) as avslatt,
    COUNT(CASE WHEN r.resultat IS NULL THEN 1 END) as under_behandling,
    ROUND(
        (COUNT(CASE WHEN r.resultat IN ('godkjent', 'delvis_godkjent') THEN 1 END)::numeric /
         NULLIF(COUNT(CASE WHEN r.resultat IS NOT NULL THEN 1 END), 0)) * 100,
        1
    ) as godkjenningsrate
FROM grunnlag g
LEFT JOIN respons r ON g.sak_id = r.sak_id
GROUP BY g.kategori
ORDER BY antall DESC;
```

### 4. Vederlagsanalyse

```sql
-- View: Vederlag krevd vs godkjent per metode
CREATE OR REPLACE VIEW analytics_vederlag_by_method AS
WITH krav AS (
    SELECT DISTINCT ON (sak_id)
        sak_id,
        data->>'metode' as metode,
        COALESCE(
            (data->>'belop_direkte')::numeric,
            (data->>'kostnads_overslag')::numeric,
            0
        ) - COALESCE((data->>'fradrag_belop')::numeric, 0) as netto_krevd
    FROM koe_events
    WHERE event_type IN ('vederlag_krav_sendt', 'vederlag_krav_oppdatert')
    ORDER BY sak_id, time DESC
),
respons AS (
    SELECT DISTINCT ON (sak_id)
        sak_id,
        COALESCE((data->>'total_godkjent_belop')::numeric, 0) as godkjent_belop
    FROM koe_events
    WHERE event_type = 'respons_vederlag'
    ORDER BY sak_id, time DESC
)
SELECT
    k.metode,
    COUNT(*) as antall_krav,
    SUM(k.netto_krevd) as total_krevd,
    SUM(r.godkjent_belop) as total_godkjent,
    ROUND(
        SUM(r.godkjent_belop)::numeric / NULLIF(SUM(k.netto_krevd), 0) * 100,
        1
    ) as godkjenningsgrad
FROM krav k
LEFT JOIN respons r ON k.sak_id = r.sak_id
WHERE k.netto_krevd > 0
GROUP BY k.metode
ORDER BY total_krevd DESC;
```

### 5. Aktivitet over tid

```sql
-- View: Hendelser per uke
CREATE OR REPLACE VIEW analytics_weekly_activity AS
SELECT
    DATE_TRUNC('week', time)::date as uke_start,
    COUNT(*) as antall_events,
    COUNT(CASE WHEN event_type = 'sak_opprettet' THEN 1 END) as nye_saker,
    COUNT(DISTINCT sak_id) as aktive_saker
FROM koe_events
WHERE time > NOW() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1;
```

### 6. Behandlingstider

```sql
-- View: Gjennomsnittlig behandlingstid per spor
CREATE OR REPLACE VIEW analytics_response_times AS
WITH krav_og_respons AS (
    SELECT
        krav.sak_id,
        krav.event_type as krav_type,
        krav.time as krav_tid,
        respons.time as respons_tid,
        EXTRACT(DAY FROM respons.time - krav.time) as dager
    FROM (
        SELECT sak_id, event_type, time
        FROM koe_events
        WHERE event_type IN ('grunnlag_opprettet', 'vederlag_krav_sendt', 'frist_krav_sendt')
    ) krav
    JOIN (
        SELECT sak_id, event_type, time
        FROM koe_events
        WHERE event_type IN ('respons_grunnlag', 'respons_vederlag', 'respons_frist')
    ) respons ON krav.sak_id = respons.sak_id
        AND CASE
            WHEN krav.event_type = 'grunnlag_opprettet' THEN respons.event_type = 'respons_grunnlag'
            WHEN krav.event_type = 'vederlag_krav_sendt' THEN respons.event_type = 'respons_vederlag'
            WHEN krav.event_type = 'frist_krav_sendt' THEN respons.event_type = 'respons_frist'
        END
)
SELECT
    CASE krav_type
        WHEN 'grunnlag_opprettet' THEN 'grunnlag'
        WHEN 'vederlag_krav_sendt' THEN 'vederlag'
        WHEN 'frist_krav_sendt' THEN 'frist'
    END as spor,
    COUNT(*) as antall_målinger,
    ROUND(AVG(dager), 1) as gjennomsnitt_dager,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dager) as median_dager,
    MIN(dager) as min_dager,
    MAX(dager) as maks_dager
FROM krav_og_respons
WHERE dager >= 0
GROUP BY krav_type;
```

### 7. Aktøroversikt

```sql
-- View: Hendelser per aktør
CREATE OR REPLACE VIEW analytics_actor_activity AS
SELECT
    actor as aktør,
    actorrole as rolle,
    COUNT(*) as antall_events,
    COUNT(DISTINCT sak_id) as antall_saker,
    MIN(time) as første_aktivitet,
    MAX(time) as siste_aktivitet
FROM koe_events
GROUP BY actor, actorrole
ORDER BY antall_events DESC;
```

### 8. Trender - månedlig vekst

```sql
-- View: Månedlig vekst i saker og vederlag
CREATE OR REPLACE VIEW analytics_monthly_trends AS
WITH monthly AS (
    SELECT
        DATE_TRUNC('month', time)::date as måned,
        COUNT(DISTINCT sak_id) as aktive_saker,
        COUNT(CASE WHEN event_type = 'sak_opprettet' THEN 1 END) as nye_saker,
        SUM(CASE
            WHEN event_type = 'vederlag_krav_sendt'
            THEN COALESCE((data->>'belop_direkte')::numeric, (data->>'kostnads_overslag')::numeric, 0)
        END) as vederlag_krevd
    FROM koe_events
    GROUP BY 1
)
SELECT
    måned,
    aktive_saker,
    nye_saker,
    vederlag_krevd,
    LAG(nye_saker) OVER (ORDER BY måned) as forrige_nye_saker,
    ROUND(
        (nye_saker - LAG(nye_saker) OVER (ORDER BY måned))::numeric /
        NULLIF(LAG(nye_saker) OVER (ORDER BY måned), 0) * 100,
        1
    ) as vekst_prosent
FROM monthly
ORDER BY måned;
```

## Bruk i Supabase Studio

1. Åpne Supabase Dashboard → SQL Editor
2. Kopier ønsket view-definisjon
3. Kjør for å opprette view
4. Views vil være tilgjengelige under "Views" i Table Editor

## Bruk i Power BI

For å koble Power BI til Supabase:

1. Bruk PostgreSQL-connector i Power BI
2. Connection string: `Host=db.{project-ref}.supabase.co;Database=postgres;Username=postgres;Password={password}`
3. Importer views som datakilder
4. Bygg dashboards basert på views

## Eksportmuligheter

Data kan eksporteres til:
- **CSV/Excel**: Via Supabase Dashboard → Table Editor → Export
- **JSON**: Via REST API (`/rest/v1/analytics_*?select=*`)
- **Dataverse**: Via Azure Data Factory eller Logic Apps pipeline

## Real-time Analytics

For real-time oppdateringer, bruk Supabase Realtime:

```javascript
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Subscribe to new events
supabase
  .channel('analytics')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'koe_events'
  }, (payload) => {
    console.log('New event:', payload);
    // Update dashboard metrics
  })
  .subscribe();
```
