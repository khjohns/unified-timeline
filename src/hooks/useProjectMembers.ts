/**
 * useProjectMembers Hooks
 *
 * React Query hooks for project membership management.
 * Provides fetching, adding, removing, and updating member roles.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listMembers,
  addMember,
  removeMember,
  updateMemberRole,
} from '../api/membership';
import type { ProjectMembership } from '../types/membership';
import { STALE_TIME } from '../constants/queryConfig';

// ============================================================
// Query Keys
// ============================================================

export const memberQueryKeys = {
  all: ['project-members'] as const,
  list: (projectId: string) => [...memberQueryKeys.all, projectId] as const,
};

// ============================================================
// Queries
// ============================================================

/**
 * Fetch all members of a project.
 *
 * @param projectId - The project to list members for
 */
export function useProjectMembers(projectId: string) {
  return useQuery<ProjectMembership[], Error>({
    queryKey: memberQueryKeys.list(projectId),
    queryFn: () => listMembers(projectId),
    enabled: !!projectId,
    staleTime: STALE_TIME.DEFAULT,
  });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Add a new member to a project.
 */
export function useAddMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      email,
      role,
      displayName,
    }: {
      email: string;
      role: string;
      displayName?: string;
    }) => addMember(projectId, email, role, displayName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberQueryKeys.list(projectId) });
    },
  });
}

/**
 * Remove a member from a project.
 */
export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userEmail: string) => removeMember(projectId, userEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberQueryKeys.list(projectId) });
    },
  });
}

/**
 * Update a member's role in a project.
 */
export function useUpdateMemberRole(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userEmail, role }: { userEmail: string; role: string }) =>
      updateMemberRole(projectId, userEmail, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberQueryKeys.list(projectId) });
    },
  });
}
