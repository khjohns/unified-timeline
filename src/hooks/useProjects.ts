/**
 * useProjects Hooks
 *
 * React Query hooks for project management.
 * Provides fetching, creating, updating, and deactivating projects.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deactivateProject,
} from '../api/projects';
import type { Project, CreateProjectPayload, UpdateProjectPayload } from '../types/project';
import { STALE_TIME } from '../constants/queryConfig';

// ============================================================
// Query Keys
// ============================================================

export const projectQueryKeys = {
  all: ['projects'] as const,
  list: () => [...projectQueryKeys.all, 'list'] as const,
  detail: (projectId: string) => [...projectQueryKeys.all, 'detail', projectId] as const,
};

// ============================================================
// Queries
// ============================================================

/**
 * Fetch all projects accessible to the current user.
 */
export function useProjects() {
  return useQuery<Project[], Error>({
    queryKey: projectQueryKeys.list(),
    queryFn: () => listProjects(),
    staleTime: STALE_TIME.EXTENDED,
  });
}

/**
 * Fetch a single project by ID.
 *
 * @param projectId - The project to fetch
 */
export function useProjectDetail(projectId: string) {
  return useQuery<Project, Error>({
    queryKey: projectQueryKeys.detail(projectId),
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
    staleTime: STALE_TIME.EXTENDED,
  });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Create a new project.
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => createProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    },
  });
}

/**
 * Update an existing project.
 */
export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateProjectPayload) => updateProject(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    },
  });
}

/**
 * Deactivate a project (soft delete).
 */
export function useDeactivateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deactivateProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    },
  });
}
