import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBimLink, deleteBimLink, fetchBimLinks, fetchBimModels } from '../api/bim';
import { getActiveProjectId } from '../api/client';
import { STALE_TIME } from '../constants/queryConfig';

const bimKeys = {
  links: (sakId: string) => ['bim-links', getActiveProjectId(), sakId] as const,
  models: () => ['bim-models', getActiveProjectId()] as const,
};

export function useBimLinks(sakId: string) {
  return useQuery({
    queryKey: bimKeys.links(sakId),
    queryFn: () => fetchBimLinks(sakId),
    staleTime: STALE_TIME.EXTENDED,
    enabled: !!sakId,
  });
}

export function useBimModels() {
  return useQuery({
    queryKey: bimKeys.models(),
    queryFn: fetchBimModels,
    staleTime: 5 * STALE_TIME.EXTENDED, // models change rarely
  });
}

export function useCreateBimLink(sakId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { fag: string; model_id?: string; model_name?: string }) =>
      createBimLink(sakId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bimKeys.links(sakId) });
    },
  });
}

export function useDeleteBimLink(sakId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: number) => deleteBimLink(sakId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bimKeys.links(sakId) });
    },
  });
}
