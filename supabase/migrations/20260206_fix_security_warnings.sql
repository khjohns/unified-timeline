-- Fix Supabase linter security warnings
-- https://supabase.com/docs/guides/database/database-linter

-- =============================================================================
-- 1. Fix function_search_path_mutable warnings
-- Set search_path to empty string for security
-- =============================================================================

-- Lovdata functions
ALTER FUNCTION public.lovdata_documents_search_trigger() SET search_path = '';
ALTER FUNCTION public.lovdata_sections_search_trigger() SET search_path = '';
ALTER FUNCTION public.search_lovdata(TEXT, INTEGER) SET search_path = '';
ALTER FUNCTION public.search_lovdata_fast(TEXT, INTEGER) SET search_path = '';
ALTER FUNCTION public.search_lovdata_vector(vector(1536), INTEGER, INTEGER) SET search_path = '';
ALTER FUNCTION public.search_lovdata_hybrid(TEXT, vector(1536), INTEGER, FLOAT, INTEGER, TEXT, TEXT) SET search_path = '';
ALTER FUNCTION public.batch_update_embeddings(JSONB) SET search_path = '';
ALTER FUNCTION public.bulk_update_section_addresses(JSONB) SET search_path = '';

-- General functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.update_feedback_updated_at() SET search_path = '';
ALTER FUNCTION public.get_user_role(UUID) SET search_path = '';
ALTER FUNCTION public.get_user_role_by_email(TEXT) SET search_path = '';

-- =============================================================================
-- 2. Move vector extension to extensions schema (recommended by Supabase)
-- Note: This may require dropping and recreating dependent objects
-- =============================================================================

-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move vector extension (if safe - may need manual intervention)
-- ALTER EXTENSION vector SET SCHEMA extensions;
-- Note: Commented out because it may break existing queries.
-- Supabase recommends this but it requires updating all vector operations.

-- =============================================================================
-- 3. Tighten RLS policies on feedback table
-- Feedback is anonymous (no user_id), so we keep INSERT open but restrict UPDATE
-- =============================================================================

-- Drop overly permissive UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update feedback" ON public.feedback;

-- Only service_role can update feedback (for admin status changes)
-- Note: INSERT policy "Anyone can submit feedback" is intentionally permissive
-- for anonymous feedback collection - this is acceptable for a feedback form

-- =============================================================================
-- Notes:
-- - auth_leaked_password_protection: Enable in Supabase Dashboard > Auth > Settings
-- - extension_in_public (vector): Can be moved but requires query updates
-- =============================================================================
