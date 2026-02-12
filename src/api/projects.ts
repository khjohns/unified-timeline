/**
 * Projects API
 *
 * Handles CRUD operations for project management.
 * Supports listing, creating, updating, and deactivating projects.
 */

import { apiFetch } from './client';
import type { Project, CreateProjectPayload, UpdateProjectPayload } from '../types/project';

/**
 * List all projects accessible to the current user.
 *
 * @returns List of projects
 */
export async function listProjects(): Promise<Project[]> {
  const data = await apiFetch<{ projects: Project[] }>('/api/projects');
  return data.projects;
}

/**
 * Get a single project by ID.
 *
 * @param projectId - The project to fetch
 * @returns The project
 */
export async function getProject(projectId: string): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${projectId}`);
}

/**
 * Create a new project.
 *
 * @param payload - Project creation data (name, optional description)
 * @returns The created project
 */
export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const data = await apiFetch<{ success: boolean; project: Project }>(
    '/api/projects',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return data.project;
}

/**
 * Update an existing project.
 *
 * @param projectId - The project to update
 * @param payload - Fields to update (name, description)
 * @returns The updated project
 */
export async function updateProject(
  projectId: string,
  payload: UpdateProjectPayload
): Promise<Project> {
  const data = await apiFetch<{ success: boolean; project: Project }>(
    `/api/projects/${projectId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
  return data.project;
}

/**
 * Deactivate a project (soft delete).
 *
 * @param projectId - The project to deactivate
 */
export async function deactivateProject(projectId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/deactivate`, {
    method: 'PATCH',
  });
}
