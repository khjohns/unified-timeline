/**
 * ProjectSelector
 *
 * Dropdown for switching between projects.
 * Uses React Query for automatic cache invalidation after project creation.
 * On project change, invalidates all queries to refetch with new scope.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useProject, type ProjectInfo } from '../context/ProjectContext';
import { useProjects } from '../hooks/useProjects';

export function ProjectSelector() {
  const { activeProject, setActiveProject } = useProject();
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useProjects();

  const projectList: ProjectInfo[] = projects
    ? projects.map(p => ({ id: p.id, name: p.name }))
    : [activeProject];

  // Don't render if loading or only one project
  if (isLoading || projectList.length <= 1) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = projectList.find(p => p.id === e.target.value);
    if (selected && selected.id !== activeProject.id) {
      setActiveProject(selected);
      // Invalidate all queries to refetch with new project scope
      queryClient.invalidateQueries();
    }
  };

  return (
    <select
      value={activeProject.id}
      onChange={handleChange}
      className="rounded-md border border-pkt-border-default bg-pkt-bg-default px-2 py-1 text-sm text-pkt-text-body-default"
      aria-label="Velg prosjekt"
    >
      {projectList.map(p => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
