/**
 * Helper functions for mock data
 */

import { SakState, TimelineEntry } from '@/types/timeline';
import {
  mockSakState1,
  mockSakState2,
  mockSakState3,
  mockSakState4,
  mockSakState5,
  mockSakState6,
  mockSakState7,
  mockSakState8,
  mockSakState9,
  mockSakState10,
  mockSakState11,
  mockSakState12,
  mockSakState13,
  mockSakStateEO001,
} from './cases';
import {
  mockTimelineEvents1,
  mockTimelineEvents2,
  mockTimelineEvents3,
  mockTimelineEvents4,
  mockTimelineEvents5,
  mockTimelineEvents6,
  mockTimelineEvents7,
  mockTimelineEvents8,
  mockTimelineEvents9,
  mockTimelineEvents10,
  mockTimelineEvents11,
  mockTimelineEvents12,
  mockTimelineEvents13,
  mockTimelineEventsEO001,
} from './timelines';

/**
 * Get mock state by case ID
 */
export function getMockStateById(sakId: string): SakState {
  switch (sakId) {
    case 'SAK-2025-001':
      return mockSakState1;
    case 'SAK-2025-002':
      return mockSakState2;
    case 'SAK-2024-089':
      return mockSakState3;
    case 'SAK-2025-003':
      return mockSakState4;
    case 'SAK-2025-005':
      return mockSakState5;
    case 'SAK-2025-006':
      return mockSakState6;
    case 'SAK-2025-007':
      return mockSakState7;
    case 'SAK-2025-008':
      return mockSakState8;
    case 'SAK-2025-009':
      return mockSakState9;
    case 'SAK-2025-010':
      return mockSakState10;
    case 'SAK-2025-011':
      return mockSakState11;
    case 'SAK-2025-012':
      return mockSakState12;
    case 'SAK-2025-013':
      return mockSakState13;
    case 'SAK-EO-001':
      return mockSakStateEO001;
    default:
      return mockSakState1;
  }
}

/**
 * Get mock timeline events by case ID
 */
export function getMockTimelineById(sakId: string): TimelineEntry[] {
  switch (sakId) {
    case 'SAK-2025-001':
      return mockTimelineEvents1;
    case 'SAK-2025-002':
      return mockTimelineEvents2;
    case 'SAK-2024-089':
      return mockTimelineEvents3;
    case 'SAK-2025-003':
      return mockTimelineEvents4;
    case 'SAK-2025-005':
      return mockTimelineEvents5;
    case 'SAK-2025-006':
      return mockTimelineEvents6;
    case 'SAK-2025-007':
      return mockTimelineEvents7;
    case 'SAK-2025-008':
      return mockTimelineEvents8;
    case 'SAK-2025-009':
      return mockTimelineEvents9;
    case 'SAK-2025-010':
      return mockTimelineEvents10;
    case 'SAK-2025-011':
      return mockTimelineEvents11;
    case 'SAK-2025-012':
      return mockTimelineEvents12;
    case 'SAK-2025-013':
      return mockTimelineEvents13;
    case 'SAK-EO-001':
      return mockTimelineEventsEO001;
    default:
      return mockTimelineEvents1;
  }
}

/**
 * Mock historikk (revision history) generator
 * Creates realistic historikk data from timeline events
 */
export function getMockHistorikkById(sakId: string): {
  version: number;
  grunnlag: Array<{
    versjon: number;
    tidsstempel: string;
    aktor: { navn: string; rolle: 'TE' | 'BH'; tidsstempel: string };
    endring_type: 'opprettet' | 'oppdatert' | 'trukket' | 'respons' | 'respons_oppdatert';
    event_id: string;
    hovedkategori?: string | null;
    underkategori?: string | string[] | null;
    beskrivelse?: string | null;
    kontraktsreferanser?: string[] | null;
    bh_resultat?: string | null;
    bh_resultat_label?: string | null;
    bh_begrunnelse?: string | null;
  }>;
  vederlag: Array<{
    versjon: number;
    tidsstempel: string;
    aktor: { navn: string; rolle: 'TE' | 'BH'; tidsstempel: string };
    endring_type: 'sendt' | 'oppdatert' | 'trukket' | 'respons' | 'respons_oppdatert';
    event_id: string;
    krav_belop?: number | null;
    metode?: string | null;
    metode_label?: string | null;
    begrunnelse?: string | null;
    inkluderer_rigg_drift?: boolean | null;
    inkluderer_produktivitet?: boolean | null;
    bh_resultat?: string | null;
    bh_resultat_label?: string | null;
    godkjent_belop?: number | null;
    bh_begrunnelse?: string | null;
  }>;
  frist: Array<{
    versjon: number;
    tidsstempel: string;
    aktor: { navn: string; rolle: 'TE' | 'BH'; tidsstempel: string };
    endring_type: 'sendt' | 'oppdatert' | 'trukket' | 'respons' | 'respons_oppdatert';
    event_id: string;
    krav_dager?: number | null;
    varsel_type?: string | null;
    varsel_type_label?: string | null;
    begrunnelse?: string | null;
    ny_sluttdato?: string | null;
    bh_resultat?: string | null;
    bh_resultat_label?: string | null;
    godkjent_dager?: number | null;
    bh_begrunnelse?: string | null;
  }>;
} {
  const state = getMockStateById(sakId);

  // Generate mock historikk based on state
  const grunnlag: Array<{
    versjon: number;
    tidsstempel: string;
    aktor: { navn: string; rolle: 'TE' | 'BH'; tidsstempel: string };
    endring_type: 'opprettet' | 'oppdatert' | 'trukket' | 'respons' | 'respons_oppdatert';
    event_id: string;
    hovedkategori?: string | null;
    underkategori?: string | string[] | null;
    beskrivelse?: string | null;
    kontraktsreferanser?: string[] | null;
    bh_resultat?: string | null;
    bh_resultat_label?: string | null;
    bh_begrunnelse?: string | null;
  }> = [];

  const vederlag: Array<{
    versjon: number;
    tidsstempel: string;
    aktor: { navn: string; rolle: 'TE' | 'BH'; tidsstempel: string };
    endring_type: 'sendt' | 'oppdatert' | 'trukket' | 'respons' | 'respons_oppdatert';
    event_id: string;
    krav_belop?: number | null;
    metode?: string | null;
    metode_label?: string | null;
    begrunnelse?: string | null;
    inkluderer_rigg_drift?: boolean | null;
    inkluderer_produktivitet?: boolean | null;
    bh_resultat?: string | null;
    bh_resultat_label?: string | null;
    godkjent_belop?: number | null;
    bh_begrunnelse?: string | null;
  }> = [];

  const frist: Array<{
    versjon: number;
    tidsstempel: string;
    aktor: { navn: string; rolle: 'TE' | 'BH'; tidsstempel: string };
    endring_type: 'sendt' | 'oppdatert' | 'trukket' | 'respons' | 'respons_oppdatert';
    event_id: string;
    krav_dager?: number | null;
    varsel_type?: string | null;
    varsel_type_label?: string | null;
    begrunnelse?: string | null;
    ny_sluttdato?: string | null;
    bh_resultat?: string | null;
    bh_resultat_label?: string | null;
    godkjent_dager?: number | null;
    bh_begrunnelse?: string | null;
  }> = [];

  // If grunnlag is active, generate grunnlag historikk
  if (state.grunnlag.status !== 'utkast') {
    const teNavn = state.entreprenor || 'Entreprenør AS';
    const bhNavn = state.byggherre || 'Byggherre Kommune';

    // Version 1: Initial submission
    grunnlag.push({
      versjon: 1,
      tidsstempel: state.grunnlag.siste_oppdatert || '2025-01-15T09:00:00Z',
      aktor: { navn: teNavn, rolle: 'TE', tidsstempel: state.grunnlag.siste_oppdatert || '2025-01-15T09:00:00Z' },
      endring_type: 'opprettet',
      event_id: `${sakId}-grunnlag-1`,
      hovedkategori: state.grunnlag.hovedkategori,
      underkategori: state.grunnlag.underkategori,
      beskrivelse: state.grunnlag.beskrivelse || 'Se dokumentasjon',
      kontraktsreferanser: state.grunnlag.kontraktsreferanser || [],
    });

    // Add BH response if they have responded
    if (state.grunnlag.bh_resultat) {
      grunnlag.push({
        versjon: 1,
        tidsstempel: '2025-01-20T09:00:00Z',
        aktor: { navn: bhNavn, rolle: 'BH', tidsstempel: '2025-01-20T09:00:00Z' },
        endring_type: 'respons',
        event_id: `${sakId}-grunnlag-bh-1`,
        bh_resultat: state.grunnlag.bh_resultat,
        bh_resultat_label: state.grunnlag.bh_resultat === 'godkjent' ? 'Godkjent'
          : state.grunnlag.bh_resultat === 'delvis_godkjent' ? 'Delvis godkjent'
          : state.grunnlag.bh_resultat === 'avslatt' ? 'Avslått'
          : state.grunnlag.bh_resultat === 'frafalt' ? 'Frafalt'
          : 'Krever avklaring',
        bh_begrunnelse: state.grunnlag.bh_begrunnelse || 'Se vurdering',
      });
    }
  }

  // If vederlag is active, generate vederlag historikk
  if (state.vederlag.status !== 'ikke_relevant') {
    const teNavn = state.entreprenor || 'Entreprenør AS';
    const bhNavn = state.byggherre || 'Byggherre Kommune';
    const kravBelop = state.vederlag.metode === 'REGNINGSARBEID'
      ? state.vederlag.kostnads_overslag
      : state.vederlag.belop_direkte;

    // Version 1: Initial submission
    vederlag.push({
      versjon: 1,
      tidsstempel: state.vederlag.siste_oppdatert || '2025-01-15T10:00:00Z',
      aktor: { navn: teNavn, rolle: 'TE', tidsstempel: state.vederlag.siste_oppdatert || '2025-01-15T10:00:00Z' },
      endring_type: 'sendt',
      event_id: `${sakId}-vederlag-1`,
      krav_belop: kravBelop,
      metode: state.vederlag.metode,
      metode_label: state.vederlag.metode === 'ENHETSPRISER' ? 'Enhetspriser (§34.3)'
        : state.vederlag.metode === 'REGNINGSARBEID' ? 'Regningsarbeid (§30.2/§34.4)'
        : 'Fastpris/Tilbud (§34.2.1)',
      begrunnelse: state.vederlag.begrunnelse || 'Se dokumentasjon',
      inkluderer_rigg_drift: !!state.vederlag.saerskilt_krav?.rigg_drift,
      inkluderer_produktivitet: !!state.vederlag.saerskilt_krav?.produktivitet,
    });

    // Add more revisions if state indicates updates
    if (state.vederlag.antall_versjoner > 1) {
      vederlag.push({
        versjon: 2,
        tidsstempel: '2025-01-20T14:30:00Z',
        aktor: { navn: teNavn, rolle: 'TE', tidsstempel: '2025-01-20T14:30:00Z' },
        endring_type: 'oppdatert',
        event_id: `${sakId}-vederlag-2`,
        krav_belop: kravBelop ? kravBelop * 1.1 : null, // 10% increase
        metode: state.vederlag.metode,
        metode_label: state.vederlag.metode === 'ENHETSPRISER' ? 'Enhetspriser (§34.3)'
          : state.vederlag.metode === 'REGNINGSARBEID' ? 'Regningsarbeid (§30.2/§34.4)'
          : 'Fastpris/Tilbud (§34.2.1)',
        begrunnelse: 'Oppdatert beløp basert på ytterligere dokumentasjon',
        inkluderer_rigg_drift: !!state.vederlag.saerskilt_krav?.rigg_drift,
        inkluderer_produktivitet: !!state.vederlag.saerskilt_krav?.produktivitet,
      });
    }

    // Add BH response if they have responded
    if (state.vederlag.bh_resultat) {
      vederlag.push({
        versjon: state.vederlag.antall_versjoner,
        tidsstempel: '2025-01-25T09:00:00Z',
        aktor: { navn: bhNavn, rolle: 'BH', tidsstempel: '2025-01-25T09:00:00Z' },
        endring_type: 'respons',
        event_id: `${sakId}-vederlag-bh-1`,
        bh_resultat: state.vederlag.bh_resultat,
        bh_resultat_label: state.vederlag.bh_resultat === 'godkjent' ? 'Godkjent'
          : state.vederlag.bh_resultat === 'delvis_godkjent' ? 'Delvis godkjent'
          : state.vederlag.bh_resultat === 'avslatt' ? 'Avslått'
          : 'Holdes tilbake (§30.2)',
        godkjent_belop: state.vederlag.godkjent_belop,
        bh_begrunnelse: state.vederlag.bh_begrunnelse || 'Se vurdering',
      });
    }
  }

  // If frist is active, generate frist historikk
  if (state.frist.status !== 'ikke_relevant') {
    const teNavn = state.entreprenor || 'Entreprenør AS';
    const bhNavn = state.byggherre || 'Byggherre Kommune';

    // Version 1: Initial submission
    frist.push({
      versjon: 1,
      tidsstempel: state.frist.siste_oppdatert || '2025-01-15T10:30:00Z',
      aktor: { navn: teNavn, rolle: 'TE', tidsstempel: state.frist.siste_oppdatert || '2025-01-15T10:30:00Z' },
      endring_type: 'sendt',
      event_id: `${sakId}-frist-1`,
      krav_dager: state.frist.krevd_dager,
      varsel_type: state.frist.varsel_type,
      varsel_type_label: state.frist.varsel_type === 'noytralt' ? 'Nøytralt varsel (§33.4)'
        : state.frist.varsel_type === 'spesifisert' ? 'Spesifisert krav (§33.6)'
        : state.frist.varsel_type === 'begge' ? 'Nøytralt + Spesifisert'
        : 'Force Majeure (§33.3)',
      begrunnelse: state.frist.begrunnelse || 'Se dokumentasjon',
      ny_sluttdato: state.frist.ny_sluttdato,
    });

    // Add more revisions if state indicates updates
    if (state.frist.antall_versjoner > 1) {
      frist.push({
        versjon: 2,
        tidsstempel: '2025-01-20T15:00:00Z',
        aktor: { navn: teNavn, rolle: 'TE', tidsstempel: '2025-01-20T15:00:00Z' },
        endring_type: 'oppdatert',
        event_id: `${sakId}-frist-2`,
        krav_dager: state.frist.krevd_dager ? state.frist.krevd_dager + 5 : null,
        varsel_type: state.frist.varsel_type,
        varsel_type_label: state.frist.varsel_type === 'noytralt' ? 'Nøytralt varsel (§33.4)'
          : state.frist.varsel_type === 'spesifisert' ? 'Spesifisert krav (§33.6)'
          : state.frist.varsel_type === 'begge' ? 'Nøytralt + Spesifisert'
          : 'Force Majeure (§33.3)',
        begrunnelse: 'Oppdatert krav basert på ytterligere forsinkelser',
        ny_sluttdato: state.frist.ny_sluttdato,
      });
    }

    // Add BH response if they have responded
    if (state.frist.bh_resultat) {
      frist.push({
        versjon: state.frist.antall_versjoner,
        tidsstempel: '2025-01-25T09:30:00Z',
        aktor: { navn: bhNavn, rolle: 'BH', tidsstempel: '2025-01-25T09:30:00Z' },
        endring_type: 'respons',
        event_id: `${sakId}-frist-bh-1`,
        bh_resultat: state.frist.bh_resultat,
        bh_resultat_label: state.frist.bh_resultat === 'godkjent' ? 'Godkjent'
          : state.frist.bh_resultat === 'delvis_godkjent' ? 'Delvis godkjent'
          : state.frist.bh_resultat === 'avslatt' ? 'Avslått'
          : 'Avventer dokumentasjon',
        godkjent_dager: state.frist.godkjent_dager,
        bh_begrunnelse: state.frist.bh_begrunnelse || 'Se vurdering',
      });
    }
  }

  return {
    version: 1,
    grunnlag,
    vederlag,
    frist,
  };
}

/**
 * Get mock forsering kontekst data
 * Returns related cases, their states, events, and summary for a forsering case
 */
export function getMockForseringKontekstById(sakId: string): {
  success: boolean;
  sak_id: string;
  relaterte_saker: Array<{
    relatert_sak_id: string;
    relatert_sak_tittel?: string;
    bimsync_issue_number?: number;
  }>;
  sak_states: Record<string, SakState>;
  hendelser: Record<string, TimelineEntry[]>;
  forsering_hendelser: TimelineEntry[];  // Forsering case's own events
  oppsummering: {
    antall_relaterte_saker: number;
    total_krevde_dager: number;
    total_avslatte_dager: number;
    grunnlag_oversikt: Array<{
      sak_id: string;
      tittel: string;
      hovedkategori: string;
      bh_resultat: string;
    }>;
  };
} {
  const state = getMockStateById(sakId);

  // If not a forsering case, return empty context
  if (state.sakstype !== 'forsering' || !state.relaterte_saker) {
    return {
      success: true,
      sak_id: sakId,
      relaterte_saker: [],
      sak_states: {},
      hendelser: {},
      forsering_hendelser: [],
      oppsummering: {
        antall_relaterte_saker: 0,
        total_krevde_dager: 0,
        total_avslatte_dager: 0,
        grunnlag_oversikt: [],
      },
    };
  }

  // Get the forsering case's own events
  const forseringHendelser = getMockTimelineById(sakId);

  // Gather related case data
  const sakStates: Record<string, SakState> = {};
  const hendelser: Record<string, TimelineEntry[]> = {};
  const grunnlagOversikt: Array<{
    sak_id: string;
    tittel: string;
    hovedkategori: string;
    bh_resultat: string;
  }> = [];

  let totalKrevdeDager = 0;
  let totalAvslatteDager = 0;

  for (const relasjon of state.relaterte_saker) {
    const relatertState = getMockStateById(relasjon.relatert_sak_id);
    const relatertTimeline = getMockTimelineById(relasjon.relatert_sak_id);

    sakStates[relasjon.relatert_sak_id] = relatertState;
    hendelser[relasjon.relatert_sak_id] = relatertTimeline;

    // Gather grunnlag info
    if (relatertState.grunnlag?.hovedkategori) {
      grunnlagOversikt.push({
        sak_id: relasjon.relatert_sak_id,
        tittel: relatertState.sakstittel,
        hovedkategori: relatertState.grunnlag.hovedkategori,
        bh_resultat: relatertState.grunnlag.bh_resultat || 'under_behandling',
      });
    }

    // Sum up days
    if (relatertState.frist?.krevd_dager) {
      totalKrevdeDager += relatertState.frist.krevd_dager;
    }
    if (relatertState.frist?.bh_resultat === 'avslatt') {
      totalAvslatteDager += relatertState.frist.krevd_dager || 0;
    } else if (relatertState.frist?.bh_resultat === 'delvis_godkjent') {
      totalAvslatteDager +=
        (relatertState.frist.krevd_dager || 0) - (relatertState.frist.godkjent_dager || 0);
    }
  }

  return {
    success: true,
    sak_id: sakId,
    relaterte_saker: state.relaterte_saker,
    sak_states: sakStates,
    hendelser,
    forsering_hendelser: forseringHendelser,
    oppsummering: {
      antall_relaterte_saker: state.relaterte_saker.length,
      total_krevde_dager: totalKrevdeDager,
      total_avslatte_dager: totalAvslatteDager,
      grunnlag_oversikt: grunnlagOversikt,
    },
  };
}

/**
 * Get candidate cases for forsering
 * Returns cases with rejected or partially approved frist that can be added to a forsering case
 *
 * Per NS 8407 §33.8: Forsering is relevant when:
 * - BH has rejected a frist claim (avslatt)
 * - BH has partially approved a frist claim (delvis_godkjent)
 * - BH has rejected grunnlag but subsidiarily agrees with frist (avslått grunnlag med akseptert frist)
 */
export function getMockKandidatSaker(): Array<{
  sak_id: string;
  sakstittel: string;
  frist_krevd_dager?: number;
  frist_godkjent_dager?: number;
  frist_bh_resultat?: string;
  grunnlag_hovedkategori?: string;
  grunnlag_bh_resultat?: string;
}> {
  const allStates = [
    mockSakState1,
    mockSakState2,
    mockSakState3,
    mockSakState4,
    mockSakState5,
    mockSakState6,
    mockSakState7,
    mockSakState8,
    mockSakState9,
    mockSakState10,
    mockSakState11,
    mockSakState13, // Skip 12 as it's the forsering case itself
  ];

  return allStates
    .filter((state) => {
      // Skip forsering cases
      if (state.sakstype === 'forsering') return false;

      // Include cases where:
      // 1. Frist was rejected (avslatt)
      // 2. Frist was partially approved (delvis_godkjent)
      // 3. Grunnlag was rejected but frist was claimed (relevant per NS 8407)
      const fristRejected = state.frist?.bh_resultat === 'avslatt';
      const fristPartial = state.frist?.bh_resultat === 'delvis_godkjent';
      const grunnlagRejectedWithFrist =
        state.grunnlag?.bh_resultat === 'avslatt' &&
        state.frist?.status !== 'ikke_relevant' &&
        state.frist?.krevd_dager;

      return fristRejected || fristPartial || grunnlagRejectedWithFrist;
    })
    .map((state) => ({
      sak_id: state.sak_id,
      sakstittel: state.sakstittel,
      frist_krevd_dager: state.frist?.krevd_dager,
      frist_godkjent_dager: state.frist?.godkjent_dager,
      frist_bh_resultat: state.frist?.bh_resultat,
      grunnlag_hovedkategori: state.grunnlag?.hovedkategori,
      grunnlag_bh_resultat: state.grunnlag?.bh_resultat,
    }));
}
