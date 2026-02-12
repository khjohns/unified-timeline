/**
 * useContractSettings Hook
 *
 * Convenience hook that extracts contract settings from the active project.
 * Returns typed contract data, loading state, and whether contract is configured.
 */

import { useProject } from '../context/ProjectContext';
import { useProjectDetail } from './useProjects';
import type { ContractSettings } from '../types/project';

export function useContractSettings() {
  const { projectId } = useProject();
  const { data: project, isLoading } = useProjectDetail(projectId);

  const contract = (project?.settings?.contract as ContractSettings) ?? null;
  const hasContract = !!(
    contract &&
    contract.byggherre_navn &&
    contract.totalentreprenor_navn &&
    contract.kontraktssum
  );

  return { contract, isLoading, hasContract, project };
}
