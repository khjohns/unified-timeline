-- Create Lovdata cache tables for Norwegian laws and regulations
-- Uses PostgreSQL full-text search for efficient querying
-- Data synced from api.lovdata.no Public Data API

-- =============================================================================
-- Documents table - stores law/regulation metadata
-- =============================================================================

CREATE TABLE IF NOT EXISTS lovdata_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dok_id TEXT UNIQUE NOT NULL,           -- e.g., "lov/1992-07-03-93"
    ref_id TEXT,                           -- FRBR work reference
    title TEXT,                            -- Full title
    short_title TEXT,                      -- e.g., "avhendingslova"
    date_in_force DATE,                    -- When the law took effect
    ministry TEXT,                         -- Responsible ministry
    doc_type TEXT NOT NULL CHECK (doc_type IN ('lov', 'forskrift')),

    -- Full-text search vector
    search_vector TSVECTOR,

    -- Timestamps
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for full-text search
CREATE INDEX IF NOT EXISTS idx_lovdata_documents_search
    ON lovdata_documents USING GIN (search_vector);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_lovdata_documents_dok_id ON lovdata_documents(dok_id);
CREATE INDEX IF NOT EXISTS idx_lovdata_documents_short_title ON lovdata_documents(short_title);
CREATE INDEX IF NOT EXISTS idx_lovdata_documents_doc_type ON lovdata_documents(doc_type);

-- =============================================================================
-- Sections table - stores individual paragraphs/sections
-- =============================================================================

CREATE TABLE IF NOT EXISTS lovdata_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dok_id TEXT NOT NULL REFERENCES lovdata_documents(dok_id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,              -- e.g., "3-9"
    title TEXT,                            -- Section title (optional)
    content TEXT NOT NULL,                 -- The actual law text
    address TEXT,                          -- data-absoluteaddress from XML
    char_count INTEGER GENERATED ALWAYS AS (LENGTH(content)) STORED,

    -- Full-text search vector for section content
    search_vector TSVECTOR,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite unique constraint
    UNIQUE(dok_id, section_id)
);

-- Index for section lookups
CREATE INDEX IF NOT EXISTS idx_lovdata_sections_dok_section
    ON lovdata_sections(dok_id, section_id);

-- Index for full-text search on sections
CREATE INDEX IF NOT EXISTS idx_lovdata_sections_search
    ON lovdata_sections USING GIN (search_vector);

-- =============================================================================
-- Sync metadata table - tracks sync status
-- =============================================================================

CREATE TABLE IF NOT EXISTS lovdata_sync_meta (
    dataset TEXT PRIMARY KEY,              -- 'lover' or 'forskrifter'
    last_modified TIMESTAMPTZ,             -- From HTTP Last-Modified header
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    file_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'error'))
);

-- =============================================================================
-- Functions for full-text search
-- =============================================================================

-- Function to update search vector for documents
CREATE OR REPLACE FUNCTION lovdata_documents_search_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('norwegian', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('norwegian', COALESCE(NEW.short_title, '')), 'B');
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update search vector for sections
CREATE OR REPLACE FUNCTION lovdata_sections_search_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('norwegian', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('norwegian', COALESCE(NEW.content, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic search vector updates
DROP TRIGGER IF EXISTS trigger_lovdata_documents_search ON lovdata_documents;
CREATE TRIGGER trigger_lovdata_documents_search
    BEFORE INSERT OR UPDATE ON lovdata_documents
    FOR EACH ROW
    EXECUTE FUNCTION lovdata_documents_search_trigger();

DROP TRIGGER IF EXISTS trigger_lovdata_sections_search ON lovdata_sections;
CREATE TRIGGER trigger_lovdata_sections_search
    BEFORE INSERT OR UPDATE ON lovdata_sections
    FOR EACH ROW
    EXECUTE FUNCTION lovdata_sections_search_trigger();

-- =============================================================================
-- Search function with ranking
-- =============================================================================

CREATE OR REPLACE FUNCTION search_lovdata(
    query_text TEXT,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    dok_id TEXT,
    title TEXT,
    short_title TEXT,
    doc_type TEXT,
    snippet TEXT,
    rank REAL
) AS $$
DECLARE
    tsquery_val TSQUERY;
BEGIN
    -- Parse query for Norwegian text
    tsquery_val := plainto_tsquery('norwegian', query_text);

    RETURN QUERY
    SELECT DISTINCT ON (d.dok_id)
        d.dok_id,
        d.title,
        d.short_title,
        d.doc_type,
        ts_headline('norwegian', COALESCE(s.content, d.title), tsquery_val,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15') as snippet,
        ts_rank(COALESCE(s.search_vector, d.search_vector), tsquery_val) as rank
    FROM lovdata_documents d
    LEFT JOIN lovdata_sections s ON d.dok_id = s.dok_id
    WHERE d.search_vector @@ tsquery_val
       OR s.search_vector @@ tsquery_val
    ORDER BY d.dok_id, rank DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE lovdata_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lovdata_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE lovdata_sync_meta ENABLE ROW LEVEL SECURITY;

-- Public read access (NLOD 2.0 license allows this)
CREATE POLICY "Public read access for lovdata_documents"
    ON lovdata_documents FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Public read access for lovdata_sections"
    ON lovdata_sections FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Public read access for lovdata_sync_meta"
    ON lovdata_sync_meta FOR SELECT
    TO anon, authenticated
    USING (true);

-- Only service role can write (for sync operations)
CREATE POLICY "Service role can insert lovdata_documents"
    ON lovdata_documents FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can update lovdata_documents"
    ON lovdata_documents FOR UPDATE
    TO service_role
    USING (true);

CREATE POLICY "Service role can delete lovdata_documents"
    ON lovdata_documents FOR DELETE
    TO service_role
    USING (true);

CREATE POLICY "Service role can insert lovdata_sections"
    ON lovdata_sections FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can update lovdata_sections"
    ON lovdata_sections FOR UPDATE
    TO service_role
    USING (true);

CREATE POLICY "Service role can delete lovdata_sections"
    ON lovdata_sections FOR DELETE
    TO service_role
    USING (true);

CREATE POLICY "Service role can manage lovdata_sync_meta"
    ON lovdata_sync_meta FOR ALL
    TO service_role
    USING (true);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE lovdata_documents IS 'Norwegian laws and regulations from Lovdata Public API';
COMMENT ON TABLE lovdata_sections IS 'Individual paragraphs/sections of laws';
COMMENT ON TABLE lovdata_sync_meta IS 'Sync status for Lovdata datasets';
COMMENT ON FUNCTION search_lovdata IS 'Full-text search across all Lovdata documents';
