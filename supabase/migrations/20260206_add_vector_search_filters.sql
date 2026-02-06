-- Add filter support to hybrid vector search
-- No re-embedding required - filters are applied at query time
--
-- Note: This function uses IVFFlat index (not HNSW) for vector search.
-- IVFFlat was chosen because HNSW index creation timed out on 90k vectors.
-- Set ivfflat.probes for quality/speed tradeoff (default 10).

CREATE OR REPLACE FUNCTION search_lovdata_hybrid(
    query_text TEXT,
    query_embedding vector(1536),
    match_count INT DEFAULT 10,
    fts_weight FLOAT DEFAULT 0.5,
    ivfflat_probes INT DEFAULT 10,           -- IVFFlat probe count (higher = better recall, slower)
    doc_type_filter TEXT DEFAULT NULL,       -- 'lov' or 'forskrift'
    ministry_filter TEXT DEFAULT NULL        -- Partial match on ministry name
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
    -- Set IVFFlat probe count for this query
    PERFORM set_config('ivfflat.probes', ivfflat_probes::TEXT, true);

    RETURN QUERY
    WITH
    -- Pre-filter documents if filters are specified
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
          -- Apply document filter if specified
          AND (doc_type_filter IS NULL AND ministry_filter IS NULL
               OR EXISTS (SELECT 1 FROM filtered_docs fd WHERE fd.dok_id = s.dok_id))
        ORDER BY s.embedding <=> query_embedding
        LIMIT match_count * 3
    ),
    -- FTS scores for vector candidates (no LIMIT - LEFT JOIN filters)
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

-- Create IVFFlat index (if not exists)
-- Note: HNSW timed out on 90k vectors, IVFFlat is faster to build
CREATE INDEX IF NOT EXISTS lovdata_sections_embedding_ivfflat_idx
ON lovdata_sections
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

COMMENT ON FUNCTION search_lovdata_hybrid IS
'Hybrid vector + FTS search with optional filters.

Parameters:
  - query_text: FTS search query (supports websearch syntax: OR, "phrase", -exclude)
  - query_embedding: 1536-dim vector from embedding model
  - match_count: Number of results (default 10)
  - fts_weight: Weight for FTS vs vector (0.0-1.0, default 0.5)
  - ivfflat_probes: IVFFlat probe count (default 10, higher = better recall)
  - doc_type_filter: "lov" or "forskrift"
  - ministry_filter: Partial match on ministry name

Returns combined_score = (1-fts_weight)*similarity + fts_weight*fts_rank';
