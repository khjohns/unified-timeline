-- Add filter support to hybrid vector search
-- No re-embedding required - filters are applied at query time

CREATE OR REPLACE FUNCTION search_lovdata_hybrid(
    query_text TEXT,
    query_embedding vector(1536),
    match_count INT DEFAULT 10,
    fts_weight FLOAT DEFAULT 0.5,
    ef_search INT DEFAULT 100,
    -- New filter parameters
    doc_type_filter TEXT DEFAULT NULL,      -- 'lov' or 'forskrift'
    ministry_filter TEXT DEFAULT NULL       -- Partial match on ministry name
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
AS $$
BEGIN
    -- Set HNSW search parameter for this query
    PERFORM set_config('hnsw.ef_search', ef_search::TEXT, true);

    RETURN QUERY
    WITH
    -- Pre-filter documents if filters are specified
    filtered_docs AS (
        SELECT d.dok_id, d.short_title, d.doc_type, d.ministry
        FROM lovdata_documents d
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
        FROM lovdata_sections s
        WHERE s.embedding IS NOT NULL
          -- Apply document filter if specified
          AND (doc_type_filter IS NULL AND ministry_filter IS NULL
               OR EXISTS (SELECT 1 FROM filtered_docs fd WHERE fd.dok_id = s.dok_id))
        ORDER BY s.embedding <=> query_embedding
        LIMIT match_count * 3
    ),
    fts_search AS (
        SELECT
            s.id,
            ts_rank(s.search_vector, websearch_to_tsquery('norwegian', query_text)) AS fts_rank
        FROM lovdata_sections s
        WHERE s.search_vector @@ websearch_to_tsquery('norwegian', query_text)
          AND (doc_type_filter IS NULL AND ministry_filter IS NULL
               OR EXISTS (SELECT 1 FROM filtered_docs fd WHERE fd.dok_id = s.dok_id))
        LIMIT match_count * 3
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
    LEFT JOIN fts_search f ON v.id = f.id
    JOIN lovdata_documents d ON v.dok_id = d.dok_id
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_lovdata_hybrid IS
'Hybrid vector + FTS search with optional filters.
Filters:
  - doc_type_filter: "lov" or "forskrift"
  - ministry_filter: Partial match on ministry name (e.g., "Klima" matches "Klima- og miljødepartementet")';
