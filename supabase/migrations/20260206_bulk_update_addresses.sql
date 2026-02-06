-- Function to bulk update section addresses using efficient single UPDATE
-- Called from Python with JSONB array of {dok_id, section_id, address}

CREATE OR REPLACE FUNCTION bulk_update_section_addresses(updates JSONB)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Single UPDATE using JSONB array as source
    WITH update_data AS (
        SELECT
            (elem->>'dok_id') AS dok_id,
            (elem->>'section_id') AS section_id,
            (elem->>'address') AS address
        FROM jsonb_array_elements(updates) AS elem
    )
    UPDATE lovdata_sections s
    SET address = ud.address
    FROM update_data ud
    WHERE s.dok_id = ud.dok_id
      AND s.section_id = ud.section_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;
