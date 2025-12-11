/**
 * Helper functions for mock data
 */

import { SakState, TimelineEntry } from '../types/timeline';
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
      inkluderer_rigg_drift: state.vederlag.saerskilt_krav?.rigg_drift ?? false,
      inkluderer_produktivitet: state.vederlag.saerskilt_krav?.produktivitet ?? false,
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
        inkluderer_rigg_drift: state.vederlag.saerskilt_krav?.rigg_drift ?? false,
        inkluderer_produktivitet: state.vederlag.saerskilt_krav?.produktivitet ?? false,
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
          : state.vederlag.bh_resultat === 'avventer' ? 'Avventer dokumentasjon'
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
    vederlag,
    frist,
  };
}
