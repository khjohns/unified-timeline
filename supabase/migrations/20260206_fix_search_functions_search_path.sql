-- Fix search_path issues in Lovdata search functions
--
-- Problem: Functions had SET search_path = '' which broke table resolution
-- Solution: SET search_path = public and use fully qualified table names
--
-- Applied directly to Supabase on 2026-02-06, documented here for version control

-- =============================================================================
-- 1. Fix search_lovdata_fast (used by sok() MCP tool)
-- =============================================================================

DROP FUNCTION IF EXISTS search_lovdata_fast(text, integer);

CREATE FUNCTION search_lovdata_fast(
    query_text TEXT,
    max_results INT DEFAULT 20
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
SET search_path = public
AS $$
    WITH ranked AS (
        SELECT
            s.dok_id,
            s.section_id,
            ts_rank(s.search_vector, websearch_to_tsquery('norwegian', query_text)) as rank
        FROM public.lovdata_sections s
        WHERE s.search_vector @@ websearch_to_tsquery('norwegian', query_text)
        ORDER BY rank DESC
        LIMIT max_results
    )
    SELECT
        r.dok_id,
        r.section_id,
        d.title,
        d.short_title,
        d.doc_type,
        LEFT(s.content, 500) as snippet,
        r.rank
    FROM ranked r
    JOIN public.lovdata_documents d ON d.dok_id = r.dok_id
    JOIN public.lovdata_sections s ON s.dok_id = r.dok_id AND s.section_id = r.section_id;
$$;

COMMENT ON FUNCTION search_lovdata_fast IS
'Fast FTS search returning section-level results with truncated snippets.
Supports websearch syntax: OR, "phrase", -exclude.';

-- =============================================================================
-- 2. Fix search_lovdata_vector (pure vector search, used by semantisk_sok fallback)
-- =============================================================================

DROP FUNCTION IF EXISTS search_lovdata_vector(vector, integer, integer);

CREATE FUNCTION search_lovdata_vector(
    query_embedding vector(1536),
    match_count INT DEFAULT 10,
    ivfflat_probes INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    dok_id TEXT,
    section_id TEXT,
    title TEXT,
    content TEXT,
    short_title TEXT,
    doc_type TEXT,
    ministry TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    PERFORM set_config('ivfflat.probes', ivfflat_probes::TEXT, true);

    RETURN QUERY
    SELECT
        s.id,
        s.dok_id,
        s.section_id,
        s.title,
        s.content,
        d.short_title,
        d.doc_type,
        d.ministry,
        (1 - (s.embedding <=> query_embedding))::FLOAT AS similarity
    FROM public.lovdata_sections s
    JOIN public.lovdata_documents d ON s.dok_id = d.dok_id
    WHERE s.embedding IS NOT NULL
    ORDER BY s.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_lovdata_vector IS
'Pure vector similarity search using IVFFlat index.
Set ivfflat_probes for recall/speed tradeoff (default 10).';

-- =============================================================================
-- 3. Fix search_lovdata (legacy FTS function)
-- =============================================================================

DROP FUNCTION IF EXISTS search_lovdata(text, integer);

CREATE FUNCTION search_lovdata(
    query_text TEXT,
    max_results INT DEFAULT 10
)
RETURNS TABLE (
    dok_id TEXT,
    title TEXT,
    short_title TEXT,
    doc_type TEXT,
    snippet TEXT,
    rank REAL
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    tsquery_val TSQUERY;
BEGIN
    tsquery_val := websearch_to_tsquery('norwegian', query_text);

    RETURN QUERY
    SELECT DISTINCT ON (d.dok_id)
        d.dok_id,
        d.title,
        d.short_title,
        d.doc_type,
        ts_headline('norwegian', COALESCE(s.content, d.title), tsquery_val,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15') as snippet,
        ts_rank(COALESCE(s.search_vector, d.search_vector), tsquery_val) as rank
    FROM public.lovdata_documents d
    LEFT JOIN public.lovdata_sections s ON d.dok_id = s.dok_id
    WHERE d.search_vector @@ tsquery_val
       OR s.search_vector @@ tsquery_val
    ORDER BY d.dok_id, rank DESC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION search_lovdata IS
'Full-text search across Lovdata documents and sections.
Supports websearch syntax: OR, "phrase", -exclude.
Returns document-level results with highlighted snippets.';

-- =============================================================================
-- 4. Fix search_lovdata_hybrid (parameter rename: ef_search -> ivfflat_probes)
-- =============================================================================

DROP FUNCTION IF EXISTS search_lovdata_hybrid(text, vector, integer, double precision, integer, text, text);

CREATE FUNCTION search_lovdata_hybrid(
    query_text TEXT,
    query_embedding vector(1536),
    match_count INT DEFAULT 10,
    fts_weight FLOAT DEFAULT 0.5,
    ivfflat_probes INT DEFAULT 10,
    doc_type_filter TEXT DEFAULT NULL,
    ministry_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    dok_id TEXT,
    section_id TEXT,
    title TEXT,
    content TEXT,
    short_title TEXT,
    doc_type TEXT,
    ministry TEXT,
    similarity FLOAT,
    fts_rank FLOAT,
    combined_score FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    PERFORM set_config('ivfflat.probes', ivfflat_probes::TEXT, true);

    RETURN QUERY
    WITH
    filtered_docs AS (
        SELECT d.dok_id, d.short_title, d.doc_type, d.ministry
        FROM public.lovdata_documents d
        WHERE (doc_type_filter IS NULL OR d.doc_type = doc_type_filter)
          AND (ministry_filter IS NULL OR d.ministry ILIKE '%' || ministry_filter || '%')
    ),
    vector_search AS (
        SELECT
            s.id,
            s.dok_id,
            s.section_id,
            s.title,
            s.content,
            1 - (s.embedding <=> query_embedding) AS similarity
        FROM public.lovdata_sections s
        WHERE s.embedding IS NOT NULL
          AND (doc_type_filter IS NULL AND ministry_filter IS NULL
               OR EXISTS (SELECT 1 FROM filtered_docs fd WHERE fd.dok_id = s.dok_id))
        ORDER BY s.embedding <=> query_embedding
        LIMIT match_count * 3
    ),
    fts_scores AS (
        SELECT
            s.id,
            ts_rank(s.search_vector, websearch_to_tsquery('norwegian', query_text)) AS fts_rank
        FROM public.lovdata_sections s
        WHERE s.search_vector @@ websearch_to_tsquery('norwegian', query_text)
    )
    SELECT
        v.id,
        v.dok_id,
        v.section_id,
        v.title,
        v.content,
        d.short_title,
        d.doc_type,
        d.ministry,
        v.similarity::FLOAT,
        COALESCE(f.fts_rank, 0)::FLOAT AS fts_rank,
        ((1 - fts_weight) * v.similarity + fts_weight * COALESCE(f.fts_rank, 0))::FLOAT AS combined_score
    FROM vector_search v
    LEFT JOIN fts_scores f ON v.id = f.id
    JOIN public.lovdata_documents d ON v.dok_id = d.dok_id
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_lovdata_hybrid IS
'Hybrid vector + FTS search for best of both worlds.
Parameters:
  - ivfflat_probes: IVFFlat probe count (higher = better recall, slower)
  - fts_weight: 0-1, weight for FTS vs vector (0.5 = equal)
  - doc_type_filter: "lov" or "forskrift"
  - ministry_filter: partial match on ministry name';
