-- ============================================================
-- Project Memberships - Access Control
-- Migration: 20260211_project_memberships.sql
--
-- Email-based membership model compatible with:
-- - Magic links (current auth)
-- - Entra ID / IDA (future auth)
-- ============================================================

CREATE TABLE IF NOT EXISTS project_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Project reference
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- User identification (email is common across all auth providers)
    user_email TEXT NOT NULL,

    -- Optional: External identity provider ID (for future Entra ID)
    external_id TEXT,

    -- Project role (access level, NOT domain role like BH/TE)
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member', 'viewer')),

    -- Display name (cached from auth provider)
    display_name TEXT,

    -- Invited by
    invited_by TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each user can only be member of a project once
    UNIQUE(project_id, user_email)
);

-- Indexes
CREATE INDEX idx_pm_project ON project_memberships(project_id);
CREATE INDEX idx_pm_email ON project_memberships(user_email);
CREATE INDEX idx_pm_external_id ON project_memberships(external_id)
    WHERE external_id IS NOT NULL;

-- RLS
ALTER TABLE project_memberships ENABLE ROW LEVEL SECURITY;

-- Service role: full access (backend uses service_role key)
CREATE POLICY "Service role full access on project_memberships"
ON project_memberships
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users: read own memberships
CREATE POLICY "Users can read own memberships"
ON project_memberships
FOR SELECT
TO authenticated
USING (
    user_email = (SELECT auth.email())
);

-- Auto-create membership for project creator
-- (project creator becomes admin)
CREATE OR REPLACE FUNCTION auto_create_project_membership()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.created_by IS NOT NULL THEN
        INSERT INTO project_memberships (project_id, user_email, role, invited_by)
        VALUES (NEW.id, NEW.created_by, 'admin', NEW.created_by)
        ON CONFLICT (project_id, user_email) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_membership_on_project_create
    AFTER INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_project_membership();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_pm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_memberships_updated_at
    BEFORE UPDATE ON project_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_pm_updated_at();
