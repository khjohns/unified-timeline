-- ============================================================
-- Fravik Events Table
-- Migration: 002_fravik_events_table.sql
-- Created: 2026-01-15
--
-- Event store for fravik-søknader (fravik fra utslippsfrie krav).
-- Uses CloudEvents v1.0 format, same structure as other event tables.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Table: fravik_events
-- Stores all events for fravik-søknader in CloudEvents format

CREATE TABLE IF NOT EXISTS fravik_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- CloudEvents Required Attributes (v1.0)
    specversion TEXT NOT NULL DEFAULT '1.0',
    event_id UUID NOT NULL UNIQUE,  -- 'id' in CloudEvents
    source TEXT NOT NULL,           -- /projects/{prosjekt_id}/cases/{sak_id}
    type TEXT NOT NULL,             -- no.oslo.koe.fravik_{event_type}

    -- CloudEvents Optional Attributes
    time TIMESTAMPTZ NOT NULL,      -- Event timestamp
    subject TEXT,                   -- sak_id
    datacontenttype TEXT DEFAULT 'application/json',

    -- CloudEvents Extension Attributes (custom)
    actor TEXT,                     -- Who triggered the event
    actorrole TEXT,                 -- Role (SOKER, BOI, PL, ARBEIDSGRUPPE, EIER)
    comment TEXT,                   -- Optional comment
    referstoid TEXT,                -- Reference to another event

    -- CloudEvents Data
    data JSONB NOT NULL,            -- Event payload

    -- Internal: For optimistic locking and queries
    sak_id TEXT NOT NULL,           -- Denormalized for efficient queries (soknad_id)
    event_type TEXT NOT NULL,       -- Denormalized for filtering
    versjon INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_fravik_sak_version UNIQUE (sak_id, versjon)
);

-- Indexes for fravik_events
CREATE INDEX IF NOT EXISTS idx_fravik_events_sak_id
    ON fravik_events(sak_id);

CREATE INDEX IF NOT EXISTS idx_fravik_events_type
    ON fravik_events(event_type);

CREATE INDEX IF NOT EXISTS idx_fravik_events_sak_version
    ON fravik_events(sak_id, versjon);

CREATE INDEX IF NOT EXISTS idx_fravik_events_time
    ON fravik_events(time DESC);

CREATE INDEX IF NOT EXISTS idx_fravik_events_actor
    ON fravik_events(actor);

CREATE INDEX IF NOT EXISTS idx_fravik_events_actorrole
    ON fravik_events(actorrole);

-- GIN index for JSONB data queries
CREATE INDEX IF NOT EXISTS idx_fravik_events_data
    ON fravik_events USING GIN (data);

-- View: Current version per fravik-søknad
CREATE OR REPLACE VIEW fravik_sak_versions AS
SELECT sak_id, MAX(versjon) as current_version
FROM fravik_events
GROUP BY sak_id;

-- Row Level Security (RLS)
ALTER TABLE fravik_events ENABLE ROW LEVEL SECURITY;

-- Policy: Backend service role has full access
CREATE POLICY "Service role access on fravik_events"
    ON fravik_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Optional: Read access for authenticated users (if needed for frontend)
-- Uncomment if you want authenticated users to read events directly
-- CREATE POLICY "Authenticated read access on fravik_events"
--     ON fravik_events
--     FOR SELECT
--     TO authenticated
--     USING (true);

-- ============================================================
-- Migration complete
--
-- Table created:
--   - fravik_events (CloudEvents v1.0 format)
--
-- View created:
--   - fravik_sak_versions (current version per søknad)
--
-- To verify:
--   SELECT * FROM fravik_sak_versions;
--   SELECT COUNT(*) FROM fravik_events;
-- ============================================================
