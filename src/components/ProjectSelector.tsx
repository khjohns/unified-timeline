/**
 * ProjectSelector
 *
 * Dropdown for switching between projects.
 * Fetches available projects from the API and allows selection.
 * On project change, invalidates all queries to refetch with new scope.
 */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProject, type ProjectInfo } from '../context/ProjectContext';
import { apiFetch } from '../api/client';

interface ProjectListResponse {
  projects: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

export function ProjectSelector() {
  const { activeProject, setActiveProject } = useProject();
  const queryClient = useQueryClient();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchProjects() {
      try {
        const data = await apiFetch<ProjectListResponse>('/api/projects');
        if (!cancelled) {
          setProjects(data.projects.map(p => ({ id: p.id, name: p.name })));
        }
      } catch {
        // Fallback to just current project if fetch fails
        if (!cancelled) {
          setProjects([activeProject]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProjects();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't render if only one project
  if (!loading && projects.length <= 1) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = projects.find(p => p.id === e.target.value);
    if (selected && selected.id !== activeProject.id) {
      setActiveProject(selected);
      // Invalidate all queries to refetch with new project scope
      queryClient.invalidateQueries();
    }
  };

  if (loading) {
    return null;
  }

  return (
    <select
      value={activeProject.id}
      onChange={handleChange}
      className="rounded-md border border-pkt-border-default bg-pkt-bg-default px-2 py-1 text-sm text-pkt-text-body-default"
      aria-label="Velg prosjekt"
    >
      {projects.map(p => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
