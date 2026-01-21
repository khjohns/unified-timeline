/**
 * useUserRole Hook
 *
 * Re-exports from UserRoleContext for backwards compatibility.
 * All role management logic is now in the context.
 *
 * Supports three role modes:
 * - 'override': Free toggle between TE/BH (for testing/demo)
 * - 'supabase': Locked to user's Supabase group
 * - 'auto': Default to Supabase role, but allow override
 */

export {
  useUserRole,
  UserRoleProvider,
  type UserRole,
  type BHApprovalRole,
  type RoleMode,
} from '../context/UserRoleContext';
