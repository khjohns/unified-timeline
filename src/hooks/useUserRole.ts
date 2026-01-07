/**
 * useUserRole Hook
 *
 * Re-exports from UserRoleContext for backwards compatibility.
 * All role management logic is now in the context.
 *
 * NOTE: This is only needed for mock/testing purposes. In production,
 * user roles would come from Entra ID / Microsoft Graph API.
 */

export {
  useUserRole,
  UserRoleProvider,
  type UserRole,
  type BHApprovalRole,
} from '../context/UserRoleContext';
