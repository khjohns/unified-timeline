-- Add vector search capabilities to Lovdata tables
-- Requires pgvector extension (usually pre-installed on Supabase)

-- =============================================================================
-- 1. Enable pgvector extension
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 2. Add embedding column and content hash for incremental sync
-- =============================================================================

ALTER TABLE lovdata_sections
ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE lovdata_sections
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- =============================================================================
-- 3. Create HNSW index for fast vector search
-- HNSW provides better recall than IVFFlat without tuning
-- =============================================================================

CREATE INDEX IF NOT EXISTS lovdata_sections_embedding_idx
ON lovdata_sections
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- 4. Hybrid search function combining vector + FTS
-- =============================================================================

CREATE OR REPLACE FUNCTION search_lovdata_hybrid(
    query_text TEXT,
    query_embedding vector(1536),
    match_count INT DEFAULT 10,
    fts_weight FLOAT DEFAULT 0.5,
    ef_search INT DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    dok_id TEXT,
    section_id TEXT,
    title TEXT,
    content TEXT,
    short_title TEXT,
    doc_type TEXT,
    similarity FLOAT,
    fts_rank FLOAT,
    combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Set HNSW search parameter for this query (higher = better recall, slower)
    PERFORM set_config('hnsw.ef_search', ef_search::TEXT, true);

    RETURN QUERY
    WITH vector_search AS (
        SELECT
            s.id,
            s.dok_id,
            s.section_id,
            s.title,
            s.content,
            1 - (s.embedding <=> query_embedding) AS similarity
        FROM lovdata_sections s
        WHERE s.embedding IS NOT NULL
        ORDER BY s.embedding <=> query_embedding
        LIMIT match_count * 3  -- Fetch more for hybrid merge
    ),
    fts_search AS (
        SELECT
            s.id,
            ts_rank(s.search_vector, plainto_tsquery('norwegian', query_text)) AS fts_rank
        FROM lovdata_sections s
        WHERE s.search_vector @@ plainto_tsquery('norwegian', query_text)
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

-- =============================================================================
-- 5. Pure vector search function (for comparison/testing)
-- =============================================================================

CREATE OR REPLACE FUNCTION search_lovdata_vector(
    query_embedding vector(1536),
    match_count INT DEFAULT 10,
    ef_search INT DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    dok_id TEXT,
    section_id TEXT,
    title TEXT,
    content TEXT,
    short_title TEXT,
    doc_type TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('hnsw.ef_search', ef_search::TEXT, true);

    RETURN QUERY
    SELECT
        s.id,
        s.dok_id,
        s.section_id,
        s.title,
        s.content,
        d.short_title,
        d.doc_type,
        (1 - (s.embedding <=> query_embedding))::FLOAT AS similarity
    FROM lovdata_sections s
    JOIN lovdata_documents d ON s.dok_id = d.dok_id
    WHERE s.embedding IS NOT NULL
    ORDER BY s.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON FUNCTION search_lovdata_hybrid IS
'Hybrid search combining semantic vector similarity with PostgreSQL full-text search.
Parameters:
- query_text: Natural language query for FTS
- query_embedding: 1536-dim vector from Gemini embedding API
- match_count: Number of results to return
- fts_weight: Weight for FTS vs vector (0-1, default 0.5)
- ef_search: HNSW recall parameter (higher = better recall, slower)';

COMMENT ON FUNCTION search_lovdata_vector IS
'Pure vector similarity search using cosine distance.
Use search_lovdata_hybrid for production - this is for testing/comparison.';
