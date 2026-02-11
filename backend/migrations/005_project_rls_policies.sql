-- ============================================================
-- Project-based RLS Policies (Defense Layer)
--
-- These policies add an additional security layer on top of
-- application-level filtering. They ensure data isolation
-- even if application code has bugs.
--
-- Phase 1: Permissive policies (backward compatible).
-- Phase 2 will add JWT-claim-based project scoping.
-- ============================================================

-- sak_metadata: Ensure authenticated users can only read rows
-- where prosjekt_id matches an active project.
-- (Service role always has full access via existing policy.)

-- Drop existing read policy and replace with project-aware one
DROP POLICY IF EXISTS "Authenticated users can read sak_metadata" ON sak_metadata;

CREATE POLICY "Authenticated users can read project sak_metadata"
ON sak_metadata FOR SELECT
USING (
    auth.role() = 'authenticated'
    AND EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = sak_metadata.prosjekt_id
        AND projects.is_active = TRUE
    )
);
