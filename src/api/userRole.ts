/**
 * User Role API
 *
 * Fetches and updates user role from Supabase user_groups table.
 * Used for role-based access control (RBAC).
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';
import type { UserRole } from '../hooks/useUserRole';
import type { ApprovalRole } from '../types/approval';

export interface UserGroupResponse {
  success: boolean;
  hasGroup: boolean;
  userRole: UserRole | null;
  groupName: 'byggherre' | 'entreprenør' | null;
  approvalRole: ApprovalRole | null;
  displayName: string | null;
  department: string | null;
  message?: string;
  error?: string;
}

export interface UpdateUserRoleRequest {
  groupName: 'byggherre' | 'entreprenør';
  approvalRole?: ApprovalRole | null;
}

/**
 * Fetch current user's role from Supabase user_groups.
 *
 * Requires authenticated Supabase session.
 */
export async function fetchUserRole(): Promise<UserGroupResponse> {
  if (USE_MOCK_API) {
    await mockDelay(200);
    // Mock: Return no group (user can toggle freely)
    return {
      success: true,
      hasGroup: false,
      userRole: null,
      groupName: null,
      approvalRole: null,
      displayName: null,
      department: null,
    };
  }

  return apiFetch<UserGroupResponse>('/api/auth/user-role');
}

/**
 * Update user's role in Supabase user_groups.
 *
 * Used for admin/testing purposes.
 */
export async function updateUserRole(
  request: UpdateUserRoleRequest
): Promise<UserGroupResponse> {
  if (USE_MOCK_API) {
    await mockDelay(300);
    return {
      success: true,
      hasGroup: true,
      userRole: request.groupName === 'byggherre' ? 'BH' : 'TE',
      groupName: request.groupName,
      approvalRole: request.approvalRole ?? null,
      displayName: null,
      department: null,
    };
  }

  return apiFetch<UserGroupResponse>('/api/auth/user-role', {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}
