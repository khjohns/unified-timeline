/**
 * ProjectContext
 *
 * Manages active project selection for multi-project support.
 * Persists selection in localStorage and syncs with API client.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { setActiveProjectId } from '../api/client';

export interface ProjectInfo {
  id: string;
  name: string;
}

const STORAGE_KEY = 'koe-active-project';

export const DEFAULT_PROJECT: ProjectInfo = {
  id: 'oslobygg',
  name: 'Oslobygg',
};

interface ProjectContextType {
  activeProject: ProjectInfo;
  setActiveProject: (project: ProjectInfo) => void;
  projectId: string;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [activeProject, setActiveProjectState] = useState<ProjectInfo>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id && parsed.name) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_PROJECT;
  });

  // Sync with API client and localStorage
  useEffect(() => {
    setActiveProjectId(activeProject.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activeProject));
  }, [activeProject]);

  // Initialize API client on mount
  useEffect(() => {
    setActiveProjectId(activeProject.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveProject = (project: ProjectInfo) => {
    setActiveProjectState(project);
  };

  return (
    <ProjectContext.Provider
      value={{
        activeProject,
        setActiveProject,
        projectId: activeProject.id,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
