/**
 * Membership Types
 *
 * Type definitions for project membership management.
 * These types define the contract between frontend and backend
 * for user roles and access control within projects.
 */

export interface ProjectMembership {
  id: string;
  project_id: string;
  user_email: string;
  external_id?: string;
  role: 'admin' | 'member' | 'viewer';
  display_name?: string;
  invited_by?: string;
  created_at: string;
  updated_at: string;
}

export type ProjectRole = ProjectMembership['role'];
