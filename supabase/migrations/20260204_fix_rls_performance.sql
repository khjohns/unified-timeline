-- Fix RLS performance warnings from Supabase linter
-- Issues addressed:
-- 1. auth_rls_initplan: Wrap auth functions in subqueries for better performance
-- 2. multiple_permissive_policies: Consolidate overlapping policies
-- 3. duplicate_index: Remove duplicate index on endringsordre_events
-- 4. unindexed_foreign_keys: Add missing indexes on foreign key columns

-- ============================================================================
-- 1. FIX: Duplicate index on endringsordre_events
-- ============================================================================
DROP INDEX IF EXISTS idx_eo_events_sak_id;

-- ============================================================================
-- 2. FIX: koe_events RLS policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Service role full access on koe_events" ON koe_events;
DROP POLICY IF EXISTS "Authenticated users can read koe_events" ON koe_events;

-- Create optimized service role policy (ALL operations, uses subquery)
CREATE POLICY "Service role full access on koe_events"
ON koe_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create optimized authenticated users read policy
-- No auth function needed since policy is scoped to 'authenticated' role
CREATE POLICY "Authenticated users can read koe_events"
ON koe_events
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- 3. FIX: forsering_events RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access on forsering_events" ON forsering_events;
DROP POLICY IF EXISTS "Authenticated users can read forsering_events" ON forsering_events;

CREATE POLICY "Service role full access on forsering_events"
ON forsering_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read forsering_events"
ON forsering_events
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- 4. FIX: endringsordre_events RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access on endringsordre_events" ON endringsordre_events;
DROP POLICY IF EXISTS "Authenticated users can read endringsordre_events" ON endringsordre_events;

CREATE POLICY "Service role full access on endringsordre_events"
ON endringsordre_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read endringsordre_events"
ON endringsordre_events
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- 5. FIX: sak_metadata RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access on sak_metadata" ON sak_metadata;
DROP POLICY IF EXISTS "Authenticated users can read sak_metadata" ON sak_metadata;

CREATE POLICY "Service role full access on sak_metadata"
ON sak_metadata
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read sak_metadata"
ON sak_metadata
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- 6. FIX: magic_links RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access on magic_links" ON magic_links;

CREATE POLICY "Service role full access on magic_links"
ON magic_links
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 7. FIX: user_groups RLS policies
-- ============================================================================

-- Drop existing overlapping policies
DROP POLICY IF EXISTS "Users can read own group" ON user_groups;
DROP POLICY IF EXISTS "Users can read active users" ON user_groups;

-- Combine the two SELECT policies into one for authenticated users
-- This fixes:
--   - auth_rls_initplan: Using (select auth.uid()) instead of auth.uid()
--   - multiple_permissive_policies: Single policy instead of two
CREATE POLICY "Authenticated users can read user_groups"
ON user_groups
FOR SELECT
TO authenticated
USING (
  -- Users can read their own group OR read active users
  (select auth.uid()) = user_id
  OR is_active = true
);

-- Note: "Service role access on user_groups" already exists from original migration
-- and doesn't have the initplan issue (uses USING (true))

-- ============================================================================
-- 8. FIX: Unindexed foreign keys
-- ============================================================================

-- Index on magic_links.sak_id for faster lookups when fetching links for a sak
CREATE INDEX IF NOT EXISTS idx_magic_links_sak_id
ON magic_links(sak_id);

-- Index on user_groups.manager_id for approval hierarchy lookups
CREATE INDEX IF NOT EXISTS idx_user_groups_manager_id
ON user_groups(manager_id)
WHERE manager_id IS NOT NULL;
