import { apiFetch } from './client';
import type { BimLink, CatendaModel, IfcProductsResponse, IfcTypeSummary, RelatedBimGroup } from '../types/timeline';

export async function fetchBimLinks(sakId: string): Promise<BimLink[]> {
  return apiFetch<BimLink[]>(`/api/saker/${sakId}/bim-links`);
}

export async function createBimLink(
  sakId: string,
  data: {
    fag: string;
    model_id?: string;
    model_name?: string;
    object_id?: number;
    object_global_id?: string;
    object_name?: string;
    object_ifc_type?: string;
    kommentar?: string;
  }
): Promise<BimLink> {
  return apiFetch<BimLink>(`/api/saker/${sakId}/bim-links`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteBimLink(sakId: string, linkId: number): Promise<void> {
  await apiFetch(`/api/saker/${sakId}/bim-links/${linkId}`, { method: 'DELETE' });
}

export async function fetchRelatedBimObjects(
  sakId: string,
  linkId: number
): Promise<{ groups: RelatedBimGroup[] }> {
  return apiFetch<{ groups: RelatedBimGroup[] }>(
    `/api/saker/${sakId}/bim-links/${linkId}/related`
  );
}

export async function fetchBimModels(): Promise<CatendaModel[]> {
  return apiFetch<CatendaModel[]>('/api/bim/models');
}

export async function fetchIfcTypes(): Promise<{ types: IfcTypeSummary }> {
  return apiFetch<{ types: IfcTypeSummary }>('/api/bim/ifc-types');
}

export async function fetchIfcProducts(params: {
  ifc_type?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<IfcProductsResponse> {
  const searchParams = new URLSearchParams();
  if (params.ifc_type) searchParams.set('ifc_type', params.ifc_type);
  if (params.search) searchParams.set('search', params.search);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  const qs = searchParams.toString();
  return apiFetch<IfcProductsResponse>(`/api/bim/ifc-products${qs ? `?${qs}` : ''}`);
}
