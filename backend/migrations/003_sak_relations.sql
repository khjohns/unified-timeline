-- ============================================================
-- Sak Relations - Reverse Index for Case Relationships
--
-- This table provides O(1) lookups for:
-- - Finding all forseringer that reference a KOE
-- - Finding all endringsordrer that reference a KOE
--
-- Architecture: This is a CQRS projection table, derived from
-- events stored in CloudEvents format. Events remain the source
-- of truth; this table enables efficient reverse lookups.
-- ============================================================

CREATE TABLE IF NOT EXISTS sak_relations (
    id SERIAL PRIMARY KEY,

    -- The sak that holds the reference (forsering/EO)
    source_sak_id TEXT NOT NULL,

    -- The sak being referenced (KOE)
    target_sak_id TEXT NOT NULL,

    -- Type of relation
    relation_type TEXT NOT NULL CHECK (relation_type IN ('forsering', 'endringsordre')),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate relations
    UNIQUE(source_sak_id, target_sak_id, relation_type)
);

-- Index for reverse lookup: "find all forseringer for this KOE"
CREATE INDEX IF NOT EXISTS idx_sak_relations_target
    ON sak_relations(target_sak_id, relation_type);

-- Index for forward lookup: "find all KOEs for this forsering"
CREATE INDEX IF NOT EXISTS idx_sak_relations_source
    ON sak_relations(source_sak_id);

-- Combined index for common query pattern
CREATE INDEX IF NOT EXISTS idx_sak_relations_target_type
    ON sak_relations(target_sak_id, relation_type)
    INCLUDE (source_sak_id);

-- Enable Row Level Security (consistent with event tables)
ALTER TABLE sak_relations ENABLE ROW LEVEL SECURITY;
