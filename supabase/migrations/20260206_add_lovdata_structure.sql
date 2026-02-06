-- Add hierarchical structure support for Lovdata documents
-- Stores Del, Kapittel, Avsnitt, Vedlegg structure from XML
-- Enables hierarchical table of contents display

-- =============================================================================
-- Structure table - stores hierarchical elements (Del, Kapittel, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS lovdata_structure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dok_id TEXT NOT NULL REFERENCES lovdata_documents(dok_id) ON DELETE CASCADE,

    -- Structure identification
    structure_type TEXT NOT NULL CHECK (structure_type IN (
        'del',           -- "Del I", "Første del"
        'kapittel',      -- "Kapittel 1", "Kap I"
        'avsnitt',       -- "Avsnitt I", "I." (romertall alene)
        'vedlegg'        -- "Vedlegg", "Vedlegg I"
    )),
    structure_id TEXT NOT NULL,        -- "1", "I", "8a", "Va"

    -- Content
    title TEXT NOT NULL,               -- Full heading: "Del I. Alminnelige bestemmelser"
    sort_order INTEGER NOT NULL,       -- For correct ordering within document

    -- Hierarchy (NULL = top level)
    parent_id UUID REFERENCES lovdata_structure(id) ON DELETE CASCADE,

    -- XML metadata
    address TEXT,                      -- data-absoluteaddress from XML
    heading_level INTEGER,             -- h2=2, h3=3, etc.

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique per document and structure
    UNIQUE(dok_id, structure_type, structure_id)
);

-- =============================================================================
-- Add foreign key from sections to structure
-- =============================================================================

ALTER TABLE lovdata_sections
ADD COLUMN IF NOT EXISTS structure_id UUID REFERENCES lovdata_structure(id) ON DELETE SET NULL;

-- =============================================================================
-- Indexes
-- =============================================================================

-- Index for looking up structures by document
CREATE INDEX IF NOT EXISTS idx_lovdata_structure_dok_id
    ON lovdata_structure(dok_id);

-- Index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_lovdata_structure_parent
    ON lovdata_structure(parent_id);

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_lovdata_structure_type
    ON lovdata_structure(dok_id, structure_type);

-- Index for sections by structure
CREATE INDEX IF NOT EXISTS idx_lovdata_sections_structure
    ON lovdata_sections(structure_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE lovdata_structure ENABLE ROW LEVEL SECURITY;

-- Public read access (NLOD 2.0 license allows this)
CREATE POLICY "Public read access for lovdata_structure"
    ON lovdata_structure FOR SELECT
    TO anon, authenticated
    USING (true);

-- Service role write access (for sync)
CREATE POLICY "Service role can manage lovdata_structure"
    ON lovdata_structure FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE lovdata_structure IS 'Hierarchical structure (Del, Kapittel, Avsnitt, Vedlegg) for laws and regulations';
COMMENT ON COLUMN lovdata_structure.structure_type IS 'Type: del, kapittel, avsnitt, vedlegg';
COMMENT ON COLUMN lovdata_structure.structure_id IS 'ID within type, e.g., "1", "I", "8a"';
COMMENT ON COLUMN lovdata_structure.parent_id IS 'Parent in hierarchy (NULL = top level)';
COMMENT ON COLUMN lovdata_structure.sort_order IS 'Order within document for correct display';
