import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBimLink, deleteBimLink, fetchBimLinks, fetchBimModels, fetchIfcProducts, fetchIfcTypes, fetchRelatedBimObjects } from '../api/bim';
import { getActiveProjectId } from '../api/client';
import { STALE_TIME } from '../constants/queryConfig';

const bimKeys = {
  links: (sakId: string) => ['bim-links', getActiveProjectId(), sakId] as const,
  models: () => ['bim-models', getActiveProjectId()] as const,
  related: (sakId: string, linkId: number) =>
    ['bim-related', getActiveProjectId(), sakId, linkId] as const,
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

export function useRelatedBimObjects(sakId: string, linkId: number | undefined) {
  return useQuery({
    queryKey: bimKeys.related(sakId, linkId!),
    queryFn: () => fetchRelatedBimObjects(sakId, linkId!),
    staleTime: STALE_TIME.EXTENDED,
    enabled: !!sakId && !!linkId,
  });
}

export function useIfcTypeSummary() {
  return useQuery({
    queryKey: ['ifc-types', getActiveProjectId()] as const,
    queryFn: fetchIfcTypes,
    staleTime: 5 * STALE_TIME.EXTENDED,
  });
}

export function useIfcProducts(params: {
  ifcType?: string;
  search?: string;
  page: number;
}) {
  return useQuery({
    queryKey: ['ifc-products', getActiveProjectId(), params.ifcType, params.search, params.page] as const,
    queryFn: () =>
      fetchIfcProducts({
        ifc_type: params.ifcType,
        search: params.search || undefined,
        page: params.page,
        page_size: 20,
      }),
    staleTime: STALE_TIME.EXTENDED,
  });
}

export function useCreateBimLink(sakId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      fag: string;
      model_id?: string;
      model_name?: string;
      object_id?: number;
      object_global_id?: string;
      object_name?: string;
      object_ifc_type?: string;
    }) => createBimLink(sakId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bimKeys.links(sakId) });
      // Invalidate all related queries for this sak (new link changes what's "already linked")
      queryClient.invalidateQueries({
        queryKey: ['bim-related', getActiveProjectId(), sakId],
      });
    },
  });
}

export function useDeleteBimLink(sakId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: number) => deleteBimLink(sakId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bimKeys.links(sakId) });
      queryClient.invalidateQueries({
        queryKey: ['bim-related', getActiveProjectId(), sakId],
      });
    },
  });
}
