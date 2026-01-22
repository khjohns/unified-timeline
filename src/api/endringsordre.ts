/**
 * Endringsordre API
 *
 * Handles API calls for endringsordre (change order) cases.
 * Supports both real API and mock data mode.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';
import { getMockStateById, getMockTimelineById } from '@mocks/helpers';
import type {
  SakState,
  TimelineEvent,
  SakRelasjon,
  EndringsordreData,
  EOKonsekvenser,
  VederlagsMetode,
  TimelineEntry,
} from '../types/timeline';

/**
 * Convert legacy TimelineEntry to CloudEvents format
 * Used for mock data conversion
 */
function convertToCloudEvent(e: TimelineEntry, sakId: string): TimelineEvent {
  return {
    specversion: '1.0' as const,
    id: e.event_id,
    source: `/projects/unknown/cases/${sakId}`,
    type: `no.oslo.koe.${e.event_type || e.type}`,
    time: e.tidsstempel,
    subject: sakId,
    datacontenttype: 'application/json' as const,
    actor: e.aktor,
    actorrole: e.rolle,
    spor: e.spor,
    summary: e.sammendrag,
    data: e.event_data,
  };
}

// ============================================================================
// TYPES
// ============================================================================

export interface EOKontekstResponse {
  success: boolean;
  sak_id: string;
  relaterte_saker: SakRelasjon[];
  sak_states: Record<string, SakState>;
  hendelser: Record<string, TimelineEvent[]>;
  eo_hendelser: TimelineEvent[];  // EO case's own events
  oppsummering: {
    antall_koe_saker: number;
    total_krevd_vederlag: number;
    total_godkjent_vederlag: number;
    total_krevd_dager: number;
    total_godkjent_dager: number;
    koe_oversikt: Array<{
      sak_id: string;
      tittel: string;
      grunnlag_status?: string;
      vederlag_status?: string;
      frist_status?: string;
      krevd_vederlag?: number;
      godkjent_vederlag?: number;
      krevd_dager?: number;
      godkjent_dager?: number;
    }>;
  };
}

export interface OpprettEORequest {
  eo_nummer: string;
  tittel: string;
  beskrivelse: string;
  koe_sak_ids?: string[];
  konsekvenser?: {
    sha?: boolean;
    kvalitet?: boolean;
    fremdrift?: boolean;
    pris?: boolean;
    annet?: boolean;
  };
  konsekvens_beskrivelse?: string;
  oppgjorsform?: VederlagsMetode;
  kompensasjon_belop?: number;
  fradrag_belop?: number;
  er_estimat?: boolean;
  frist_dager?: number;
  ny_sluttdato?: string;
  utstedt_av?: string;
}

export interface OpprettEOResponse {
  success: boolean;
  sak_id: string;
  sakstype: string;
  relaterte_saker: SakRelasjon[];
  endringsordre_data: EndringsordreData;
  message?: string;
}

export interface KandidatKOE {
  sak_id: string;
  tittel: string;
  overordnet_status: string;
  sum_godkjent?: number;
  godkjent_dager?: number;
}

export interface LeggTilKOERequest {
  eo_sak_id: string;
  koe_sak_id: string;
}

export interface LeggTilKOEResponse {
  success: boolean;
  message?: string;
}

export interface FjernKOERequest {
  eo_sak_id: string;
  koe_sak_id: string;
}

export interface FjernKOEResponse {
  success: boolean;
  message?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch the complete context for an endringsordre case
 * Includes related KOE cases, their states, events, and summary
 */
export async function fetchEOKontekst(
  sakId: string
): Promise<EOKontekstResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(400);
    return getMockEOKontekst(sakId);
  }

  // Real API call
  return apiFetch<EOKontekstResponse>(`/api/endringsordre/${sakId}/kontekst`);
}

/**
 * Create a new endringsordre case
 */
export async function opprettEndringsordre(
  data: OpprettEORequest
): Promise<OpprettEOResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(500);
    return getMockOpprettEOResponse(data);
  }

  // Real API call
  return apiFetch<OpprettEOResponse>('/api/endringsordre/opprett', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Fetch related KOE cases for an endringsordre
 */
export async function fetchRelatertKOESaker(
  sakId: string
): Promise<{ success: boolean; relaterte_saker: SakRelasjon[] }> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(200);
    const kontekst = getMockEOKontekst(sakId);
    return {
      success: true,
      relaterte_saker: kontekst.relaterte_saker,
    };
  }

  // Real API call
  return apiFetch<{ success: boolean; relaterte_saker: SakRelasjon[] }>(
    `/api/endringsordre/${sakId}/relaterte`
  );
}

/**
 * Fetch candidate KOE cases that can be added to an endringsordre
 * Returns cases where kan_utstede_eo is true
 */
export async function fetchKandidatKOESaker(): Promise<{
  success: boolean;
  kandidat_saker: KandidatKOE[];
}> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(300);
    return {
      success: true,
      kandidat_saker: getMockKandidatKOESaker(),
    };
  }

  // Real API call
  return apiFetch<{ success: boolean; kandidat_saker: KandidatKOE[] }>(
    '/api/endringsordre/kandidater'
  );
}

/**
 * Add a KOE case to an endringsordre
 */
export async function leggTilKOE(
  data: LeggTilKOERequest
): Promise<LeggTilKOEResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(400);
    return {
      success: true,
      message: 'KOE lagt til endringsordre',
    };
  }

  // Real API call
  return apiFetch<LeggTilKOEResponse>(
    `/api/endringsordre/${data.eo_sak_id}/koe`,
    {
      method: 'POST',
      body: JSON.stringify({ koe_sak_id: data.koe_sak_id }),
    }
  );
}

/**
 * Remove a KOE case from an endringsordre
 */
export async function fjernKOE(
  data: FjernKOERequest
): Promise<FjernKOEResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(300);
    return {
      success: true,
      message: 'KOE fjernet fra endringsordre',
    };
  }

  // Real API call
  return apiFetch<FjernKOEResponse>(
    `/api/endringsordre/${data.eo_sak_id}/koe/${data.koe_sak_id}`,
    {
      method: 'DELETE',
    }
  );
}

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

function getMockEOKontekst(sakId: string): EOKontekstResponse {
  // Return specific data for SAK-EO-001
  if (sakId === 'SAK-EO-001') {
    const relaterteSaker: SakRelasjon[] = [
      {
        relatert_sak_id: 'SAK-2025-010',
        relatert_sak_tittel: 'Revisjonssyklus - Ekstra sprinkleranlegg',
        bimsync_issue_number: 61,
      },
      {
        relatert_sak_id: 'SAK-2024-089',
        relatert_sak_tittel: 'Ekstraarbeid - Fasadeendringer',
        bimsync_issue_number: 89,
      },
    ];

    // Fetch states and timelines for related KOE cases
    const sakStates: Record<string, SakState> = {};
    const hendelser: Record<string, TimelineEvent[]> = {};

    for (const relasjon of relaterteSaker) {
      const relatertState = getMockStateById(relasjon.relatert_sak_id);
      const relatertTimeline = getMockTimelineById(relasjon.relatert_sak_id);

      sakStates[relasjon.relatert_sak_id] = relatertState;
      // Convert legacy mock data to CloudEvents format
      hendelser[relasjon.relatert_sak_id] = relatertTimeline.map(e =>
        convertToCloudEvent(e, relasjon.relatert_sak_id)
      );
    }

    // Define EO's own events in legacy format, then convert
    const legacyEoHendelser: TimelineEntry[] = [
      {
        event_id: 'evt-eo-003',
        tidsstempel: '2025-02-20T14:00:00Z',
        type: 'Endringsordre utstedt',
        event_type: 'eo_utstedt',
        aktor: 'Kari Byggherre',
        rolle: 'BH',
        spor: null,
        sammendrag: 'Endringsordre EO-001 utstedt for signering',
      },
      {
        event_id: 'evt-eo-002',
        tidsstempel: '2025-02-20T11:30:00Z',
        type: 'KOE lagt til',
        event_type: 'eo_koe_lagt_til',
        aktor: 'Kari Byggherre',
        rolle: 'BH',
        spor: null,
        sammendrag: 'SAK-2024-089 lagt til endringsordre',
      },
      {
        event_id: 'evt-eo-001',
        tidsstempel: '2025-02-20T11:00:00Z',
        type: 'Endringsordre opprettet',
        event_type: 'eo_opprettet',
        aktor: 'Kari Byggherre',
        rolle: 'BH',
        spor: null,
        sammendrag: 'Endringsordre EO-001 opprettet med SAK-2025-010',
      },
    ];

    return {
      success: true,
      sak_id: sakId,
      relaterte_saker: relaterteSaker,
      sak_states: sakStates,
      hendelser: hendelser,
      eo_hendelser: legacyEoHendelser.map(e => convertToCloudEvent(e, sakId)),
      oppsummering: {
        antall_koe_saker: 2,
        total_krevd_vederlag: 1035000,
        total_godkjent_vederlag: 1035000,
        total_krevd_dager: 19,
        total_godkjent_dager: 19,
        koe_oversikt: [
          {
            sak_id: 'SAK-2025-010',
            tittel: 'Revisjonssyklus - Ekstra sprinkleranlegg',
            grunnlag_status: 'godkjent',
            vederlag_status: 'godkjent',
            frist_status: 'godkjent',
            krevd_vederlag: 185000,
            godkjent_vederlag: 185000,
            krevd_dager: 5,
            godkjent_dager: 5,
          },
          {
            sak_id: 'SAK-2024-089',
            tittel: 'Ekstraarbeid - Fasadeendringer',
            grunnlag_status: 'godkjent',
            vederlag_status: 'godkjent',
            frist_status: 'godkjent',
            krevd_vederlag: 850000,
            godkjent_vederlag: 850000,
            krevd_dager: 14,
            godkjent_dager: 14,
          },
        ],
      },
    };
  }

  // Generic fallback for other EO cases
  return {
    success: true,
    sak_id: sakId,
    relaterte_saker: [],
    sak_states: {},
    hendelser: {},
    eo_hendelser: [],
    oppsummering: {
      antall_koe_saker: 0,
      total_krevd_vederlag: 0,
      total_godkjent_vederlag: 0,
      total_krevd_dager: 0,
      total_godkjent_dager: 0,
      koe_oversikt: [],
    },
  };
}

function getMockOpprettEOResponse(data: OpprettEORequest): OpprettEOResponse {
  const sakId = `SAK-EO-${String(Math.floor(Math.random() * 900) + 100)}`;
  const netto = (data.kompensasjon_belop || 0) - (data.fradrag_belop || 0);

  return {
    success: true,
    sak_id: sakId,
    sakstype: 'endringsordre',
    relaterte_saker: (data.koe_sak_ids || []).map((id) => ({
      relatert_sak_id: id,
    })),
    endringsordre_data: {
      relaterte_koe_saker: data.koe_sak_ids || [],
      eo_nummer: data.eo_nummer,
      revisjon_nummer: 0,
      beskrivelse: data.beskrivelse,
      konsekvenser: {
        sha: data.konsekvenser?.sha || false,
        kvalitet: data.konsekvenser?.kvalitet || false,
        fremdrift: data.konsekvenser?.fremdrift || false,
        pris: data.konsekvenser?.pris || false,
        annet: data.konsekvenser?.annet || false,
      },
      konsekvens_beskrivelse: data.konsekvens_beskrivelse,
      oppgjorsform: data.oppgjorsform,
      kompensasjon_belop: data.kompensasjon_belop,
      fradrag_belop: data.fradrag_belop,
      er_estimat: data.er_estimat || false,
      frist_dager: data.frist_dager,
      ny_sluttdato: data.ny_sluttdato,
      status: 'utstedt',
      dato_utstedt: new Date().toISOString().split('T')[0],
      utstedt_av: data.utstedt_av,
      netto_belop: netto,
      har_priskonsekvens: data.konsekvenser?.pris || netto !== 0,
      har_fristkonsekvens: data.konsekvenser?.fremdrift || (data.frist_dager !== undefined && data.frist_dager > 0),
    },
    message: 'Endringsordre opprettet (mock)',
  };
}

function getMockKandidatKOESaker(): KandidatKOE[] {
  // Return mock candidate KOE cases (cases where kan_utstede_eo is true)
  // Includes the actual mock cases for realistic demonstration
  return [
    {
      sak_id: 'SAK-2025-010',
      tittel: 'Revisjonssyklus - Ekstra sprinkleranlegg',
      overordnet_status: 'OMFORENT',
      sum_godkjent: 185000,
      godkjent_dager: 5,
    },
    {
      sak_id: 'SAK-2024-089',
      tittel: 'Ekstraarbeid - Fasadeendringer',
      overordnet_status: 'OMFORENT',
      sum_godkjent: 850000,
      godkjent_dager: 14,
    },
    {
      sak_id: 'SAK-2025-001',
      tittel: 'KOE - Fundamentendring',
      overordnet_status: 'OMFORENT',
      sum_godkjent: 180000,
      godkjent_dager: 7,
    },
    {
      sak_id: 'SAK-2025-002',
      tittel: 'KOE - Tilleggsarbeid ventilasjon',
      overordnet_status: 'OMFORENT',
      sum_godkjent: 120000,
      godkjent_dager: 3,
    },
  ];
}

// ============================================================================
// EO LOOKUP (for related cases)
// ============================================================================

export interface EOSomRefererer {
  eo_sak_id: string;
  eo_nummer: string;
  dato_utstedt?: string;
  status: string;
}

export interface FindEOerResponse {
  success: boolean;
  endringsordrer: EOSomRefererer[];
}

/**
 * Find endringsordre cases that reference a given KOE case
 * Used to show back-links from KOE cases to their EO
 */
export async function findEOerForSak(
  sakId: string
): Promise<FindEOerResponse> {
  // Use mock data if enabled
  if (USE_MOCK_API) {
    await mockDelay(200);
    return getMockEOerForSak(sakId);
  }

  // Real API call
  return apiFetch<FindEOerResponse>(`/api/endringsordre/by-relatert/${sakId}`);
}

function getMockEOerForSak(sakId: string): FindEOerResponse {
  // Mock: SAK-2025-001 and SAK-2025-002 are referenced by EO-001
  const eoRelations: Record<string, EOSomRefererer> = {
    'SAK-2025-001': {
      eo_sak_id: 'SAK-EO-001',
      eo_nummer: 'EO-001',
      dato_utstedt: '2025-02-15',
      status: 'utstedt',
    },
    'SAK-2025-002': {
      eo_sak_id: 'SAK-EO-001',
      eo_nummer: 'EO-001',
      dato_utstedt: '2025-02-15',
      status: 'utstedt',
    },
  };

  const eo = eoRelations[sakId];
  return {
    success: true,
    endringsordrer: eo ? [eo] : [],
  };
}
