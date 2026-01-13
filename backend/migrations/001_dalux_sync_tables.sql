-- ============================================================
-- Dalux → Catenda Sync Tables
-- Migration: 001_dalux_sync_tables.sql
-- Created: 2026-01-13
--
-- Tables for storing Dalux↔Catenda sync configuration and state.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Table 1: dalux_catenda_sync_mappings
-- Stores per-project sync configuration

CREATE TABLE IF NOT EXISTS dalux_catenda_sync_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Project references
    project_id TEXT NOT NULL,                    -- Internal project ID
    dalux_project_id TEXT NOT NULL,              -- Dalux project ID
    catenda_project_id TEXT NOT NULL,            -- Catenda project ID
    catenda_board_id TEXT NOT NULL,              -- Catenda BCF board ID

    -- Dalux API configuration
    dalux_api_key TEXT NOT NULL,                 -- API key (plaintext for now)
    dalux_base_url TEXT NOT NULL,                -- e.g., https://node1.field.dalux.com/service/api/

    -- Sync settings
    sync_enabled BOOLEAN DEFAULT true,
    sync_interval_minutes INTEGER DEFAULT 15,

    -- Sync status
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT CHECK (last_sync_status IN ('success', 'failed', 'partial')),
    last_sync_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(project_id, dalux_project_id)
);

-- Indexes for dalux_catenda_sync_mappings
CREATE INDEX IF NOT EXISTS idx_sync_mappings_project
    ON dalux_catenda_sync_mappings(project_id);

CREATE INDEX IF NOT EXISTS idx_sync_mappings_dalux_project
    ON dalux_catenda_sync_mappings(dalux_project_id);

CREATE INDEX IF NOT EXISTS idx_sync_mappings_enabled
    ON dalux_catenda_sync_mappings(sync_enabled)
    WHERE sync_enabled = true;

-- Table 2: dalux_task_sync_records
-- Tracks individual task sync state

CREATE TABLE IF NOT EXISTS dalux_task_sync_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    sync_mapping_id UUID NOT NULL REFERENCES dalux_catenda_sync_mappings(id) ON DELETE CASCADE,

    -- Dalux reference
    dalux_task_id TEXT NOT NULL,
    dalux_updated_at TIMESTAMPTZ NOT NULL,

    -- Catenda reference
    catenda_topic_guid TEXT NOT NULL,
    catenda_updated_at TIMESTAMPTZ NOT NULL,

    -- Sync status
    sync_status TEXT NOT NULL CHECK (sync_status IN ('synced', 'pending', 'failed')),
    last_error TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(sync_mapping_id, dalux_task_id)
);

-- Indexes for dalux_task_sync_records
CREATE INDEX IF NOT EXISTS idx_task_sync_mapping
    ON dalux_task_sync_records(sync_mapping_id);

CREATE INDEX IF NOT EXISTS idx_task_sync_dalux_task
    ON dalux_task_sync_records(dalux_task_id);

CREATE INDEX IF NOT EXISTS idx_task_sync_catenda_topic
    ON dalux_task_sync_records(catenda_topic_guid);

CREATE INDEX IF NOT EXISTS idx_task_sync_status
    ON dalux_task_sync_records(sync_status);

CREATE INDEX IF NOT EXISTS idx_task_sync_failed
    ON dalux_task_sync_records(sync_status)
    WHERE sync_status = 'failed';

-- Table 3: dalux_attachment_sync_records (optional - for phase 2)
-- Tracks individual attachment sync state

CREATE TABLE IF NOT EXISTS dalux_attachment_sync_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    task_sync_record_id UUID NOT NULL REFERENCES dalux_task_sync_records(id) ON DELETE CASCADE,

    -- Dalux reference
    dalux_media_file_id TEXT NOT NULL,
    dalux_filename TEXT,

    -- Catenda reference
    catenda_document_guid TEXT NOT NULL,

    -- Sync status
    sync_status TEXT NOT NULL CHECK (sync_status IN ('synced', 'pending', 'failed')),
    last_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(task_sync_record_id, dalux_media_file_id)
);

-- Indexes for dalux_attachment_sync_records
CREATE INDEX IF NOT EXISTS idx_attachment_sync_task
    ON dalux_attachment_sync_records(task_sync_record_id);

CREATE INDEX IF NOT EXISTS idx_attachment_sync_dalux_file
    ON dalux_attachment_sync_records(dalux_media_file_id);

-- Row Level Security (RLS)
-- Enable RLS for security (only backend service role can access)

ALTER TABLE dalux_catenda_sync_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalux_task_sync_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalux_attachment_sync_records ENABLE ROW LEVEL SECURITY;

-- Policy: Backend service role has full access
-- Note: Replace 'service_role' with your actual service role if different

CREATE POLICY "Service role access on dalux_catenda_sync_mappings"
    ON dalux_catenda_sync_mappings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role access on dalux_task_sync_records"
    ON dalux_task_sync_records
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role access on dalux_attachment_sync_records"
    ON dalux_attachment_sync_records
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Views for quick status checks

CREATE OR REPLACE VIEW dalux_sync_status AS
SELECT
    m.id,
    m.project_id,
    m.dalux_project_id,
    m.sync_enabled,
    m.last_sync_at,
    m.last_sync_status,
    COUNT(r.id) as total_tasks,
    COUNT(r.id) FILTER (WHERE r.sync_status = 'synced') as synced_tasks,
    COUNT(r.id) FILTER (WHERE r.sync_status = 'failed') as failed_tasks,
    COUNT(r.id) FILTER (WHERE r.sync_status = 'pending') as pending_tasks
FROM dalux_catenda_sync_mappings m
LEFT JOIN dalux_task_sync_records r ON r.sync_mapping_id = m.id
GROUP BY m.id, m.project_id, m.dalux_project_id, m.sync_enabled, m.last_sync_at, m.last_sync_status;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_sync_mappings_updated_at
    BEFORE UPDATE ON dalux_catenda_sync_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_sync_records_updated_at
    BEFORE UPDATE ON dalux_task_sync_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attachment_sync_records_updated_at
    BEFORE UPDATE ON dalux_attachment_sync_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Migration complete
--
-- Tables created:
--   - dalux_catenda_sync_mappings
--   - dalux_task_sync_records
--   - dalux_attachment_sync_records
--
-- Views created:
--   - dalux_sync_status
--
-- To verify:
--   SELECT * FROM dalux_sync_status;
-- ============================================================
