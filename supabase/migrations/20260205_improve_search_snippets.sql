-- Improve search snippets: increase from 200 to 500 characters
-- This gives better context for evaluating search result relevance

-- Drop and recreate the fast search function with longer snippets
CREATE OR REPLACE FUNCTION search_lovdata_fast(
    query_text TEXT,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    dok_id TEXT,
    section_id TEXT,
    title TEXT,
    short_title TEXT,
    doc_type TEXT,
    snippet TEXT,
    rank REAL
)
LANGUAGE sql
STABLE
AS $$
    -- CTE: Find only IDs and rank first (without reading content)
    WITH ranked AS (
        SELECT
            s.dok_id,
            s.section_id,
            ts_rank(s.search_vector, plainto_tsquery('norwegian', query_text)) as rank
        FROM lovdata_sections s
        WHERE s.search_vector @@ plainto_tsquery('norwegian', query_text)
        ORDER BY rank DESC
        LIMIT max_results
    )
    -- Then: fetch content and document info only for top matches
    SELECT
        r.dok_id,
        r.section_id,
        d.title,
        d.short_title,
        d.doc_type,
        LEFT(s.content, 500) as snippet,  -- Increased from 200 to 500 chars
        r.rank
    FROM ranked r
    JOIN lovdata_documents d ON d.dok_id = r.dok_id
    JOIN lovdata_sections s ON s.dok_id = r.dok_id AND s.section_id = r.section_id;
$$;

COMMENT ON FUNCTION search_lovdata_fast IS 'Fast full-text search with 500-char snippets (no ts_headline)';
