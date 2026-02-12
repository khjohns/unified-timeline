/**
 * Project Types
 *
 * Type definitions for project management.
 * These types define the contract between frontend and backend
 * for creating, updating, and displaying projects.
 */

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  created_by?: string | null;
  is_active: boolean;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
}
