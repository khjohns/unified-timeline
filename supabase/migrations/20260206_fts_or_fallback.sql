-- Add automatic OR fallback to FTS search when AND returns 0 results
--
-- Problem: sok("oppsigelse nedbemanning") returned 0 results because
-- websearch_to_tsquery uses AND logic (both words must exist in same paragraph).
--
-- Solution: If AND search returns 0 results AND query has no special operators
-- (OR, quotes, -exclude), automatically retry with OR between words.
--
-- The function now returns a search_mode column:
--   - 'and': Normal search, results found with AND logic
--   - 'or_fallback': AND returned 0, used OR fallback
--
-- Special operators are preserved (not converted to OR):
--   - "phrase search" - quotes preserved
--   - word1 OR word2 - explicit OR preserved
--   - word1 -exclude - exclusion preserved

DROP FUNCTION IF EXISTS search_lovdata_fast(TEXT, INT);

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
    rank REAL,
    search_mode TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    has_special_operators BOOLEAN;
    and_count INT;
    or_query TEXT;
BEGIN
    -- Check if query has special operators (OR, quotes, exclusion)
    -- \m and \M are PostgreSQL word boundaries
    has_special_operators := (
        query_text ~* '\mOR\M' OR
        query_text ~ '"' OR
        query_text ~ '-\w'
    );

    -- First try AND search (default websearch behavior)
    RETURN QUERY
    WITH ranked AS (
        SELECT
            s.dok_id,
            s.section_id,
            ts_rank(s.search_vector, websearch_to_tsquery('norwegian', query_text)) as rk
        FROM public.lovdata_sections s
        WHERE s.search_vector @@ websearch_to_tsquery('norwegian', query_text)
        ORDER BY rk DESC
        LIMIT max_results
    )
    SELECT
        r.dok_id,
        r.section_id,
        d.title,
        d.short_title,
        d.doc_type,
        LEFT(s.content, 500) as snippet,
        r.rk as rank,
        'and'::TEXT as search_mode
    FROM ranked r
    JOIN public.lovdata_documents d ON d.dok_id = r.dok_id
    JOIN public.lovdata_sections s ON s.dok_id = r.dok_id AND s.section_id = r.section_id;

    -- Check if AND search returned results
    GET DIAGNOSTICS and_count = ROW_COUNT;

    -- If no results AND no special operators, try OR fallback
    IF and_count = 0 AND NOT has_special_operators THEN
        -- Convert spaces to OR
        or_query := regexp_replace(query_text, '\s+', ' OR ', 'g');

        RETURN QUERY
        WITH ranked AS (
            SELECT
                s.dok_id,
                s.section_id,
                ts_rank(s.search_vector, websearch_to_tsquery('norwegian', or_query)) as rk
            FROM public.lovdata_sections s
            WHERE s.search_vector @@ websearch_to_tsquery('norwegian', or_query)
            ORDER BY rk DESC
            LIMIT max_results
        )
        SELECT
            r.dok_id,
            r.section_id,
            d.title,
            d.short_title,
            d.doc_type,
            LEFT(s.content, 500) as snippet,
            r.rk as rank,
            'or_fallback'::TEXT as search_mode
        FROM ranked r
        JOIN public.lovdata_documents d ON d.dok_id = r.dok_id
        JOIN public.lovdata_sections s ON s.dok_id = r.dok_id AND s.section_id = r.section_id;
    END IF;
END;
$$;

COMMENT ON FUNCTION search_lovdata_fast IS
'FTS search with automatic OR fallback when AND returns 0 results.
Supports websearch syntax: OR, "phrase", -exclude.
Returns search_mode: "and" for normal, "or_fallback" when fallback was used.';
