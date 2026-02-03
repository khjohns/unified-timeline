-- ============================================================
-- User Groups and Role-Based Access Control
-- Migration: 003_user_groups_table.sql
-- Created: 2026-01-21
--
-- Tables for managing user group membership (byggherre/entreprenør)
-- and role-based access control in the application.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Table: user_groups
-- Stores user group membership and optional approval role

CREATE TABLE IF NOT EXISTS user_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User reference (from Supabase Auth)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Group membership
    group_name TEXT NOT NULL CHECK (group_name IN ('byggherre', 'entreprenør')),

    -- Derived role (BH for byggherre, TE for entreprenør)
    -- Stored for quick access, computed from group_name
    user_role TEXT GENERATED ALWAYS AS (
        CASE group_name
            WHEN 'byggherre' THEN 'BH'
            WHEN 'entreprenør' THEN 'TE'
        END
    ) STORED,

    -- Optional: Approval role for byggherre users
    -- NULL for entreprenør users or byggherre without approval rights
    approval_role TEXT CHECK (
        approval_role IS NULL OR
        approval_role IN ('PL', 'SL', 'AL', 'DU', 'AD')
    ),

    -- User display name (cached from auth or Entra ID)
    display_name TEXT,

    -- Department/unit (for approval hierarchy)
    department TEXT,

    -- Manager reference (for approval workflow)
    manager_id UUID REFERENCES user_groups(id) ON DELETE SET NULL,

    -- Active status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each user can only belong to one group
    UNIQUE(user_id)
);

-- Indexes for user_groups
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id
    ON user_groups(user_id);

CREATE INDEX IF NOT EXISTS idx_user_groups_group_name
    ON user_groups(group_name);

CREATE INDEX IF NOT EXISTS idx_user_groups_user_role
    ON user_groups(user_role);

CREATE INDEX IF NOT EXISTS idx_user_groups_approval_role
    ON user_groups(approval_role)
    WHERE approval_role IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_groups_active
    ON user_groups(is_active)
    WHERE is_active = true;

-- Row Level Security (RLS)
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access (backend)
CREATE POLICY "Service role access on user_groups"
    ON user_groups
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Authenticated users can read their own group membership
CREATE POLICY "Users can read own group"
    ON user_groups
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy: Authenticated users can read all active users (for approval workflow)
CREATE POLICY "Users can read active users"
    ON user_groups
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Function to get user role by user_id
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TABLE (
    user_role TEXT,
    group_name TEXT,
    approval_role TEXT,
    display_name TEXT,
    department TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ug.user_role,
        ug.group_name,
        ug.approval_role,
        ug.display_name,
        ug.department
    FROM user_groups ug
    WHERE ug.user_id = p_user_id
      AND ug.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_role TO authenticated;

-- Function to get user role by email (requires service role)
CREATE OR REPLACE FUNCTION get_user_role_by_email(p_email TEXT)
RETURNS TABLE (
    user_role TEXT,
    group_name TEXT,
    approval_role TEXT,
    display_name TEXT,
    department TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ug.user_role,
        ug.group_name,
        ug.approval_role,
        ug.display_name,
        ug.department
    FROM user_groups ug
    JOIN auth.users u ON u.id = ug.user_id
    WHERE u.email = p_email
      AND ug.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only service role can call this (accesses auth.users)
GRANT EXECUTE ON FUNCTION get_user_role_by_email TO service_role;

-- Trigger for updated_at
CREATE TRIGGER update_user_groups_updated_at
    BEFORE UPDATE ON user_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Migration complete
--
-- Table created:
--   - user_groups
--
-- Function created:
--   - get_user_role(user_id)
--
-- To verify:
--   SELECT * FROM user_groups;
--
-- To add a user to a group:
--   INSERT INTO user_groups (user_id, group_name, approval_role, display_name)
--   VALUES ('uuid-here', 'byggherre', 'PL', 'Kari Nordmann');
--
-- To get user role:
--   SELECT * FROM get_user_role('uuid-here');
-- ============================================================
