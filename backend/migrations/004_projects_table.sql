-- ============================================================
-- Projects Table - Multi-Project Support (Fase 1)
--
-- Enables organizations to manage multiple isolated projects.
-- Each project has its own set of cases (sak_metadata).
--
-- Architecture: Projects are top-level entities. All case data
-- is scoped to a project via sak_metadata.prosjekt_id.
-- ============================================================

-- 1. Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active) WHERE is_active = TRUE;

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Service role (backend) has full access
CREATE POLICY "Service role full access on projects"
ON projects FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can read active projects
CREATE POLICY "Authenticated users can read active projects"
ON projects FOR SELECT
USING (auth.role() = 'authenticated' AND is_active = TRUE);

-- 2. Insert default project
INSERT INTO projects (id, name, description, created_by)
VALUES ('oslobygg', 'Oslobygg', 'Standard prosjekt', 'system')
ON CONFLICT (id) DO NOTHING;

-- 3. Backfill: Ensure all existing sak_metadata rows have prosjekt_id
UPDATE sak_metadata
SET prosjekt_id = 'oslobygg'
WHERE prosjekt_id IS NULL;

-- 4. Make prosjekt_id NOT NULL with default
ALTER TABLE sak_metadata
ALTER COLUMN prosjekt_id SET DEFAULT 'oslobygg';

ALTER TABLE sak_metadata
ALTER COLUMN prosjekt_id SET NOT NULL;
