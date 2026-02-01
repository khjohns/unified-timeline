/**
 * Fravik API Client
 *
 * API functions for fravik-søknader (exemption applications).
 * Follows the same patterns as other API clients in the project.
 */

import { apiFetch } from './client';
import type {
  FravikState,
  FravikListeItem,
  FravikEvent,
  SoknadOpprettetData,
  SoknadOppdatertData,
  MaskinData,
  InfrastrukturData,
  MiljoVurderingData,
  PLVurderingData,
  ArbeidsgruppeVurderingData,
  EierBeslutningData,
} from '../types/fravik';

// ========== STATE & EVENTS ==========

interface FravikStateResponse {
  sak_id: string;
  state: FravikState;
}

interface FravikEventsResponse {
  sak_id: string;
  events: FravikEvent[];
  total: number;
}

/**
 * Fetch current state for a fravik-søknad.
 */
export async function fetchFravikState(sakId: string): Promise<FravikState> {
  const response = await apiFetch<FravikStateResponse>(`/api/fravik/${sakId}/state`);
  return response.state;
}

/**
 * Fetch events for a fravik-søknad.
 */
export async function fetchFravikEvents(sakId: string): Promise<FravikEvent[]> {
  const response = await apiFetch<FravikEventsResponse>(`/api/fravik/${sakId}/events`);
  return response.events;
}

// ========== LIST ==========

interface FravikListeResponse {
  soknader: FravikListeItem[];
  total: number;
}

/**
 * Fetch list of all fravik-søknader.
 */
export async function fetchFravikListe(): Promise<FravikListeItem[]> {
  const response = await apiFetch<FravikListeResponse>('/api/fravik/liste');
  return response.soknader;
}

// ========== CREATE / UPDATE ==========

interface OpprettResponse {
  sak_id: string;
  message: string;
}

/**
 * Create a new fravik-søknad.
 */
export async function opprettFravikSoknad(
  data: SoknadOpprettetData,
  aktor: string
): Promise<string> {
  // Backend expects flat payload with aktor at top level
  const response = await apiFetch<OpprettResponse>('/api/fravik/opprett', {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor }),
  });
  return response.sak_id;
}

/**
 * Update a fravik-søknad.
 */
export async function oppdaterFravikSoknad(
  sakId: string,
  data: SoknadOppdatertData,
  aktor: string,
  expectedVersion?: number
): Promise<void> {
  // Backend expects flat payload with expected_version for concurrency control
  await apiFetch(`/api/fravik/${sakId}/oppdater`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor, expected_version: expectedVersion ?? 0 }),
  });
}

// ========== MASKIN ==========

/**
 * Add a maskin to søknad.
 */
export async function leggTilMaskin(
  sakId: string,
  maskinData: MaskinData,
  aktor: string,
  expectedVersion?: number
): Promise<string> {
  // Backend expects flat payload - maskin_id is generated server-side
  const response = await apiFetch<{ maskin_id: string }>(`/api/fravik/${sakId}/maskin`, {
    method: 'POST',
    body: JSON.stringify({ ...maskinData, aktor, expected_version: expectedVersion ?? 0 }),
  });
  return response.maskin_id;
}

/**
 * Remove a maskin from søknad.
 */
export async function fjernMaskin(
  sakId: string,
  maskinId: string,
  aktor: string
): Promise<void> {
  await apiFetch(`/api/fravik/${sakId}/maskin/${maskinId}`, {
    method: 'DELETE',
    body: JSON.stringify({ aktor }),
  });
}

// ========== INFRASTRUKTUR ==========

/**
 * Add infrastructure data to søknad.
 */
export async function leggTilInfrastruktur(
  sakId: string,
  data: InfrastrukturData,
  aktor: string,
  expectedVersion?: number
): Promise<void> {
  await apiFetch(`/api/fravik/${sakId}/infrastruktur`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor, expected_version: expectedVersion ?? 0 }),
  });
}

/**
 * Update infrastructure data in søknad.
 */
export async function oppdaterInfrastruktur(
  sakId: string,
  data: InfrastrukturData,
  aktor: string,
  expectedVersion?: number
): Promise<void> {
  await apiFetch(`/api/fravik/${sakId}/infrastruktur`, {
    method: 'PUT',
    body: JSON.stringify({ ...data, aktor, expected_version: expectedVersion ?? 0 }),
  });
}

// ========== SUBMIT ==========

/**
 * Send inn søknad for vurdering.
 */
export async function sendInnSoknad(
  sakId: string,
  aktor: string,
  expectedVersion?: number
): Promise<void> {
  await apiFetch(`/api/fravik/${sakId}/send-inn`, {
    method: 'POST',
    body: JSON.stringify({ aktor, expected_version: expectedVersion ?? 0 }),
  });
}

// ========== VURDERINGER ==========

/**
 * Submit miljørådgiver vurdering.
 */
export async function submitMiljoVurdering(
  sakId: string,
  data: MiljoVurderingData,
  aktor: string,
  expectedVersion?: number
): Promise<void> {
  await apiFetch(`/api/fravik/${sakId}/miljo-vurdering`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor, expected_version: expectedVersion ?? 0 }),
  });
}

/**
 * Returner søknad fra miljørådgiver (manglende dokumentasjon).
 */
export async function miljoReturnerSoknad(
  sakId: string,
  manglendeInfo: string,
  aktor: string,
  expectedVersion?: number
): Promise<void> {
  await apiFetch(`/api/fravik/${sakId}/miljo-returnert`, {
    method: 'POST',
    body: JSON.stringify({ manglende_dokumentasjon: manglendeInfo, aktor, expected_version: expectedVersion ?? 0 }),
  });
}

/**
 * Returner søknad fra prosjektleder (manglende dokumentasjon).
 */
export async function plReturnerSoknad(
  sakId: string,
  manglendeInfo: string,
  aktor: string,
  expectedVersion?: number
): Promise<void> {
  await apiFetch(`/api/fravik/${sakId}/pl-returnert`, {
    method: 'POST',
    body: JSON.stringify({ manglende_dokumentasjon: manglendeInfo, aktor, expected_version: expectedVersion ?? 0 }),
  });
}

/**
 * Submit prosjektleder vurdering.
 */
export async function submitPLVurdering(
  sakId: string,
  data: PLVurderingData,
  aktor: string,
  expectedVersion?: number
): Promise<void> {
  await apiFetch(`/api/fravik/${sakId}/pl-vurdering`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor, expected_version: expectedVersion ?? 0 }),
  });
}

/**
 * Submit arbeidsgruppe vurdering.
 */
export async function submitArbeidsgruppeVurdering(
  sakId: string,
  data: ArbeidsgruppeVurderingData,
  aktor: string,
  expectedVersion?: number
): Promise<void> {
  await apiFetch(`/api/fravik/${sakId}/arbeidsgruppe-vurdering`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor, expected_version: expectedVersion ?? 0 }),
  });
}

/**
 * Submit eier beslutning.
 */
export async function submitEierBeslutning(
  sakId: string,
  data: EierBeslutningData,
  aktor: string,
  expectedVersion?: number
): Promise<void> {
  await apiFetch(`/api/fravik/${sakId}/eier-beslutning`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor, expected_version: expectedVersion ?? 0 }),
  });
}
