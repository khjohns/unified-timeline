/**
 * Membership API
 *
 * Handles CRUD operations for project membership management.
 * Supports listing, adding, removing, and updating member roles.
 */

import { apiFetch } from './client';
import type { ProjectMembership } from '../types/membership';

/**
 * List all members of a project
 *
 * @param projectId - The project to list members for
 * @returns List of project memberships
 */
export async function listMembers(projectId: string): Promise<ProjectMembership[]> {
  const data = await apiFetch<{ members: ProjectMembership[] }>(
    `/api/projects/${projectId}/members`
  );
  return data.members;
}

/**
 * Add a new member to a project
 *
 * @param projectId - The project to add the member to
 * @param email - Email address of the user to add
 * @param role - Role to assign (defaults to 'member')
 * @param displayName - Optional display name for the member
 * @returns The created membership
 */
export async function addMember(
  projectId: string,
  email: string,
  role: string = 'member',
  displayName?: string
): Promise<ProjectMembership> {
  const data = await apiFetch<{ member: ProjectMembership }>(
    `/api/projects/${projectId}/members`,
    {
      method: 'POST',
      body: JSON.stringify({ email, role, display_name: displayName }),
    }
  );
  return data.member;
}

/**
 * Remove a member from a project
 *
 * @param projectId - The project to remove the member from
 * @param userEmail - Email address of the user to remove
 */
export async function removeMember(
  projectId: string,
  userEmail: string
): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/members/${encodeURIComponent(userEmail)}`, {
    method: 'DELETE',
  });
}

/**
 * Update a member's role in a project
 *
 * @param projectId - The project containing the member
 * @param userEmail - Email address of the user to update
 * @param role - New role to assign
 */
export async function updateMemberRole(
  projectId: string,
  userEmail: string,
  role: string
): Promise<void> {
  await apiFetch(
    `/api/projects/${projectId}/members/${encodeURIComponent(userEmail)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }
  );
}
