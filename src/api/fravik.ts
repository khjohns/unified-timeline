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
  soknad_id: string;
  state: FravikState;
}

interface FravikEventsResponse {
  soknad_id: string;
  events: FravikEvent[];
  total: number;
}

/**
 * Fetch current state for a fravik-søknad.
 */
export async function fetchFravikState(soknadId: string): Promise<FravikState> {
  if (USE_MOCK_API) {
    await mockDelay();
    return getMockFravikState(soknadId);
  }

  const response = await apiFetch<FravikStateResponse>(`/api/fravik/${soknadId}/state`);
  return response.state;
}

/**
 * Fetch events for a fravik-søknad.
 */
export async function fetchFravikEvents(soknadId: string): Promise<FravikEvent[]> {
  if (USE_MOCK_API) {
    await mockDelay();
    return [];
  }

  const response = await apiFetch<FravikEventsResponse>(`/api/fravik/${soknadId}/events`);
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
  soknad_id: string;
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
  return response.soknad_id;
}

/**
 * Update a fravik-søknad.
 */
export async function oppdaterFravikSoknad(
  soknadId: string,
  data: SoknadOppdatertData,
  aktor: string
): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  // Backend expects flat payload
  await apiFetch(`/api/fravik/${soknadId}/oppdater`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor }),
  });
}

// ========== MASKIN ==========

/**
 * Add a maskin to søknad.
 */
export async function leggTilMaskin(
  soknadId: string,
  maskinData: MaskinData,
  aktor: string
): Promise<string> {
  if (USE_MOCK_API) {
    await mockDelay();
    return `MASKIN-${Date.now()}`;
  }

  // Backend expects flat payload - maskin_id is generated server-side
  const response = await apiFetch<{ maskin_id: string }>(`/api/fravik/${soknadId}/maskin`, {
    method: 'POST',
    body: JSON.stringify({ ...maskinData, aktor }),
  });
  return response.maskin_id;
}

/**
 * Remove a maskin from søknad.
 */
export async function fjernMaskin(
  soknadId: string,
  maskinId: string,
  aktor: string
): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  await apiFetch(`/api/fravik/${soknadId}/maskin/${maskinId}`, {
    method: 'DELETE',
    body: JSON.stringify({ aktor }),
  });
}

// ========== SUBMIT ==========

/**
 * Send inn søknad for vurdering.
 */
export async function sendInnSoknad(soknadId: string, aktor: string): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  await apiFetch(`/api/fravik/${soknadId}/send-inn`, {
    method: 'POST',
    body: JSON.stringify({ aktor }),
  });
}

// ========== VURDERINGER ==========

/**
 * Submit BOI-rådgiver vurdering.
 */
export async function submitBOIVurdering(
  soknadId: string,
  data: BOIVurderingData,
  aktor: string
): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  // Backend expects flat payload
  await apiFetch(`/api/fravik/${soknadId}/boi-vurdering`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor }),
  });
}

/**
 * Return søknad from BOI (missing documentation).
 */
export async function boiReturnerSoknad(
  soknadId: string,
  manglendeInfo: string,
  aktor: string
): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  await apiFetch(`/api/fravik/${soknadId}/boi-returnert`, {
    method: 'POST',
    body: JSON.stringify({ manglende_dokumentasjon: manglendeInfo, aktor }),
  });
}

/**
 * Submit prosjektleder vurdering.
 */
export async function submitPLVurdering(
  soknadId: string,
  data: PLVurderingData,
  aktor: string
): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  // Backend expects flat payload
  await apiFetch(`/api/fravik/${soknadId}/pl-vurdering`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor }),
  });
}

/**
 * Submit arbeidsgruppe vurdering.
 */
export async function submitArbeidsgruppeVurdering(
  soknadId: string,
  data: ArbeidsgruppeVurderingData,
  aktor: string
): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  // Backend expects flat payload
  await apiFetch(`/api/fravik/${soknadId}/arbeidsgruppe-vurdering`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor }),
  });
}

/**
 * Submit eier beslutning.
 */
export async function submitEierBeslutning(
  soknadId: string,
  data: EierBeslutningData,
  aktor: string
): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay();
    return;
  }

  // Backend expects flat payload - data already contains 'beslutning' field
  await apiFetch(`/api/fravik/${soknadId}/eier-beslutning`, {
    method: 'POST',
    body: JSON.stringify({ ...data, aktor }),
  });
}

// ========== MOCK DATA ==========

function getMockFravikState(soknadId: string): FravikState {
  return {
    soknad_id: soknadId,
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
      soknad_id: 'FRAVIK-001',
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
      soknad_id: 'FRAVIK-002',
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
      soknad_id: 'FRAVIK-003',
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
