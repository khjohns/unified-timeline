-- ============================================================
-- BIM Link Tables
-- Links KOE cases to Catenda BIM models and objects
-- ============================================================

-- Cache of Catenda models per project (refreshed periodically)
CREATE TABLE IF NOT EXISTS catenda_models_cache (
    id SERIAL PRIMARY KEY,
    prosjekt_id TEXT NOT NULL,
    catenda_project_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    fag TEXT,  -- ARK, RIB, VVS, LARK, etc.
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(catenda_project_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_catenda_models_prosjekt ON catenda_models_cache(prosjekt_id);

-- BIM links: many-to-many between sak and Catenda models/objects
CREATE TABLE IF NOT EXISTS sak_bim_links (
    id SERIAL PRIMARY KEY,
    sak_id TEXT NOT NULL REFERENCES sak_metadata(sak_id) ON DELETE CASCADE,

    -- What is linked (hierarchical: fag required, model optional, object optional)
    fag TEXT NOT NULL,           -- ARK, RIB, VVS, LARK, etc.
    model_id TEXT,               -- Catenda model ID (null = whole discipline)
    model_name TEXT,             -- Cached name for display
    object_id BIGINT,            -- Catenda objectId (null = whole model)
    object_global_id TEXT,       -- IFC GlobalId for cross-system reference
    object_name TEXT,            -- Cached object name for display
    object_ifc_type TEXT,        -- e.g. IfcWall, IfcDoor

    -- Metadata
    linked_by TEXT NOT NULL,     -- Who created the link
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kommentar TEXT               -- Optional context
);

-- Prevent duplicate links (expression-based unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sak_bim_links_unique
ON sak_bim_links(sak_id, fag, COALESCE(model_id, ''), COALESCE(object_global_id, ''));

CREATE INDEX IF NOT EXISTS idx_sak_bim_links_sak ON sak_bim_links(sak_id);
CREATE INDEX IF NOT EXISTS idx_sak_bim_links_fag ON sak_bim_links(fag);
CREATE INDEX IF NOT EXISTS idx_sak_bim_links_model ON sak_bim_links(model_id);

-- RLS
ALTER TABLE sak_bim_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE catenda_models_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sak_bim_links"
ON sak_bim_links FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read sak_bim_links"
ON sak_bim_links FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Service role full access on catenda_models_cache"
ON catenda_models_cache FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read catenda_models_cache"
ON catenda_models_cache FOR SELECT
USING (auth.role() = 'authenticated');
