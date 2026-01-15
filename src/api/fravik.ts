/**
 * Fravik API Client
 *
 * API functions for fravik-søknader (exemption applications).
 * Follows the same patterns as other API clients in the project.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';
import type {
  FravikState,
  FravikListeItem,
  FravikEvent,
  SoknadOpprettetData,
  SoknadOppdatertData,
  MaskinData,
  BOIVurderingData,
  PLVurderingData,
  ArbeidsgruppeVurderingData,
  EierBeslutningData,
  FravikRolle,
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
  if (USE_MOCK_API) {
    await mockDelay();
    return getMockFravikState(sakId);
  }

  const response = await apiFetch<FravikStateResponse>(`/api/fravik/${sakId}/state`);
  return response.state;
}

/**
 * Fetch events for a fravik-søknad.
 */
export async function fetchFravikEvents(sakId: string): Promise<FravikEvent[]> {
  if (USE_MOCK_API) {
    await mockDelay();
    return [];
  }

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
  if (USE_MOCK_API) {
    await mockDelay();
    return getMockFravikListe();
  }

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
  if (USE_MOCK_API) {
    await mockDelay();
    return `FRAVIK-${Date.now()}`;
  }

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
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

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
  if (USE_MOCK_API) {
    await mockDelay();
    return `MASKIN-${Date.now()}`;
  }

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
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  await apiFetch(`/api/fravik/${sakId}/maskin/${maskinId}`, {
    method: 'DELETE',
    body: JSON.stringify({ aktor }),
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
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  await apiFetch(`/api/fravik/${sakId}/send-inn`, {
    method: 'POST',
    body: JSON.stringify({ aktor, expected_version: expectedVersion ?? 0 }),
  });
}

// ========== VURDERINGER ==========

/**
 * Submit BOI-rådgiver vurdering.
 */
export async function submitBOIVurdering(
  sakId: string,
  data: BOIVurderingData,
  aktor: string,
  expectedVersion?: number
): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  await apiFetch(`/api/fravik/${sakId}/boi-vurdering`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor, expected_version: expectedVersion ?? 0 }),
  });
}

/**
 * Return søknad from BOI (missing documentation).
 */
export async function boiReturnerSoknad(
  sakId: string,
  manglendeInfo: string,
  aktor: string,
  expectedVersion?: number
): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  await apiFetch(`/api/fravik/${sakId}/boi-returnert`, {
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
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

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
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

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
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  await apiFetch(`/api/fravik/${sakId}/eier-beslutning`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor, expected_version: expectedVersion ?? 0 }),
  });
}

// ========== MOCK DATA ==========

function getMockFravikState(sakId: string): FravikState {
  return {
    sak_id: sakId,
    sakstype: 'fravik',
    prosjekt_id: 'PROJ-001',
    prosjekt_navn: 'Utslippsfri byggeplass - Testprosjekt',
    prosjekt_nummer: 'P-2025-001',
    rammeavtale: 'Grunnarbeider',
    hovedentreprenor: 'Test Entreprenør AS',
    soker_navn: 'Ola Nordmann',
    soker_epost: 'ola@test.no',
    soknad_type: 'machine',
    frist_for_svar: '2025-02-15',
    er_haste: false,
    status: 'sendt_inn',
    maskiner: {
      'MASKIN-001': {
        maskin_id: 'MASKIN-001',
        maskin_type: 'Gravemaskin',
        start_dato: '2025-02-01',
        slutt_dato: '2025-04-01',
        begrunnelse: 'Ingen elektriske gravemaskiner tilgjengelig i markedet for dette formålet.',
        markedsundersokelse: true,
        undersøkte_leverandorer: 'Firma A, Firma B, Firma C',
        erstatningsmaskin: 'CAT 320 Diesel',
        erstatningsdrivstoff: 'HVO100',
        arbeidsbeskrivelse: 'Graving av fundamenter og grøfter',
        samlet_status: 'ikke_vurdert',
      },
    },
    godkjenningskjede: {
      boi_vurdering: { fullfort: false },
      pl_vurdering: { fullfort: false },
      arbeidsgruppe_vurdering: { fullfort: false },
      eier_beslutning: { fullfort: false },
      gjeldende_steg: 'boi',
      neste_godkjenner_rolle: 'BOI',
    },
    antall_events: 3,
    antall_maskiner: 1,
    antall_godkjente_maskiner: 0,
    antall_avslatte_maskiner: 0,
    alle_maskiner_vurdert: false,
    kan_sendes_inn: false,
    er_ferdigbehandlet: false,
    neste_handling: {
      rolle: 'BOI',
      handling: 'Vurder søknaden',
    },
    visningsstatus: 'Sendt inn',
    opprettet: '2025-01-10T10:00:00Z',
    sendt_inn_tidspunkt: '2025-01-10T12:00:00Z',
    siste_oppdatert: '2025-01-10T12:00:00Z',
  };
}

function getMockFravikListe(): FravikListeItem[] {
  return [
    {
      sak_id: 'FRAVIK-001',
      prosjekt_navn: 'Utslippsfri byggeplass - Testprosjekt',
      prosjekt_nummer: 'P-2025-001',
      soker_navn: 'Ola Nordmann',
      soknad_type: 'machine',
      status: 'sendt_inn',
      antall_maskiner: 2,
      opprettet: '2025-01-10T10:00:00Z',
      sendt_inn_tidspunkt: '2025-01-10T12:00:00Z',
      visningsstatus: 'Sendt inn',
    },
    {
      sak_id: 'FRAVIK-002',
      prosjekt_navn: 'Miljøprosjekt Oslo',
      prosjekt_nummer: 'P-2025-002',
      soker_navn: 'Kari Hansen',
      soknad_type: 'machine',
      status: 'under_boi_vurdering',
      antall_maskiner: 1,
      opprettet: '2025-01-08T09:00:00Z',
      sendt_inn_tidspunkt: '2025-01-08T11:00:00Z',
      visningsstatus: 'Hos BOI',
    },
    {
      sak_id: 'FRAVIK-003',
      prosjekt_navn: 'Grønn konstruksjon',
      prosjekt_nummer: 'P-2024-015',
      soker_navn: 'Per Olsen',
      soknad_type: 'infrastructure',
      status: 'godkjent',
      antall_maskiner: 0,
      opprettet: '2025-01-05T08:00:00Z',
      sendt_inn_tidspunkt: '2025-01-05T10:00:00Z',
      visningsstatus: 'Godkjent',
    },
  ];
}
