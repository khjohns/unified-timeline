import { apiFetch } from './client';
import type { BimLink, CatendaModel } from '../types/timeline';

export async function fetchBimLinks(sakId: string): Promise<BimLink[]> {
  return apiFetch<BimLink[]>(`/api/saker/${sakId}/bim-links`);
}

export async function createBimLink(
  sakId: string,
  data: { fag: string; model_id?: string; model_name?: string; kommentar?: string }
): Promise<BimLink> {
  return apiFetch<BimLink>(`/api/saker/${sakId}/bim-links`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteBimLink(sakId: string, linkId: number): Promise<void> {
  await apiFetch(`/api/saker/${sakId}/bim-links/${linkId}`, { method: 'DELETE' });
}

export async function fetchBimModels(): Promise<CatendaModel[]> {
  return apiFetch<CatendaModel[]>('/api/bim/models');
}
