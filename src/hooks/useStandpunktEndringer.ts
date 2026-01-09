/**
 * useStandpunktEndringer Hook
 *
 * Detects when BH has changed their position on related cases during an
 * active forsering. Per NS 8407 §33.8, TE may be entitled to compensation
 * for costs incurred before BH changed their position.
 *
 * Scenarios:
 * 1. BH originally rejected frist, now approves (fully or partially)
 * 2. BH originally rejected grunnlag, now approves
 */

import { useMemo } from 'react';
import type { ForseringData, SakState, SakRelasjon } from '../types/timeline';

export interface StandpunktEndring {
  sakId: string;
  sakTittel: string;
  endringType: 'frist_godkjent' | 'frist_delvis' | 'grunnlag_godkjent' | 'grunnlag_delvis';
  opprinneligAvslatteDager: number;
  naaGodkjenteDager: number;
  datoEndret?: string;
}

export interface KompensasjonsBeregning {
  forseringsDager: number;
  faktiskePaalopte: number;
  estimertKompensasjon: number;
  naaGodkjenteDager: number;
  gjenstaendeAvslatteDager: number;
}

interface UseStandpunktEndringerResult {
  harEndringer: boolean;
  endringer: StandpunktEndring[];
  kompensasjon: KompensasjonsBeregning | null;
}

/**
 * Calculate days between two dates
 */
function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Detect if BH has changed their position on a related case
 */
function detectStandpunktEndringer(
  forseringData: ForseringData,
  relaterteSaker: SakRelasjon[],
  sakStates: Record<string, SakState>
): StandpunktEndring[] {
  const endringer: StandpunktEndring[] = [];

  for (const relasjon of relaterteSaker) {
    const state = sakStates[relasjon.relatert_sak_id];
    if (!state) continue;

    // Check if this case was originally in the forsering (rejected frist)
    const wasInForsering = forseringData.avslatte_fristkrav.includes(relasjon.relatert_sak_id);
    if (!wasInForsering) continue;

    const opprinneligDager = state.frist?.krevd_dager || 0;

    // Scenario 1: Frist is now approved or partially approved
    if (state.frist?.bh_resultat === 'godkjent' || state.frist?.bh_resultat === 'delvis_godkjent') {
      const godkjentDager = state.frist.bh_resultat === 'godkjent'
        ? opprinneligDager
        : (state.frist.godkjent_dager || 0);

      if (godkjentDager > 0) {
        endringer.push({
          sakId: relasjon.relatert_sak_id,
          sakTittel: state.sakstittel,
          endringType: state.frist.bh_resultat === 'godkjent' ? 'frist_godkjent' : 'frist_delvis',
          opprinneligAvslatteDager: opprinneligDager,
          naaGodkjenteDager: godkjentDager,
          datoEndret: state.frist.siste_oppdatert,
        });
        continue;
      }
    }

    // Scenario 2: Grunnlag was rejected but is now approved
    if (state.grunnlag?.bh_resultat === 'godkjent' || state.grunnlag?.bh_resultat === 'delvis_godkjent') {
      if (opprinneligDager > 0 && state.frist?.status !== 'avslatt') {
        const godkjentDager = state.frist?.bh_resultat === 'godkjent'
          ? opprinneligDager
          : (state.frist?.godkjent_dager || opprinneligDager);

        const alreadyAdded = endringer.some(e => e.sakId === relasjon.relatert_sak_id);
        if (!alreadyAdded && godkjentDager > 0) {
          endringer.push({
            sakId: relasjon.relatert_sak_id,
            sakTittel: state.sakstittel,
            endringType: state.grunnlag.bh_resultat === 'godkjent' ? 'grunnlag_godkjent' : 'grunnlag_delvis',
            opprinneligAvslatteDager: opprinneligDager,
            naaGodkjenteDager: godkjentDager,
            datoEndret: state.grunnlag.siste_oppdatert,
          });
        }
      }
    }
  }

  return endringer;
}

/**
 * Hook to detect and calculate compensation for BH position changes
 */
export function useStandpunktEndringer(
  forseringData: ForseringData,
  relaterteSaker: SakRelasjon[],
  sakStates: Record<string, SakState>
): UseStandpunktEndringerResult {
  // Detect position changes
  const endringer = useMemo(
    () => detectStandpunktEndringer(forseringData, relaterteSaker, sakStates),
    [forseringData, relaterteSaker, sakStates]
  );

  // Calculate forsering days before position change
  const forseringsDagerBeforeChange = useMemo(() => {
    if (!forseringData.er_iverksatt || !forseringData.dato_iverksatt) return 0;

    const endringsDatoer = endringer
      .filter(e => e.datoEndret)
      .map(e => new Date(e.datoEndret!).getTime());

    if (endringsDatoer.length === 0) return 0;

    const earliestChange = new Date(Math.min(...endringsDatoer)).toISOString();
    return daysBetween(forseringData.dato_iverksatt, earliestChange);
  }, [forseringData, endringer]);

  // Calculate compensation
  const kompensasjon = useMemo((): KompensasjonsBeregning | null => {
    if (!forseringData.er_iverksatt || forseringsDagerBeforeChange === 0 || endringer.length === 0) {
      return null;
    }

    const faktiskePaalopte = forseringData.paalopte_kostnader || 0;

    const estimertDagskost = forseringData.avslatte_dager > 0
      ? forseringData.estimert_kostnad / forseringData.avslatte_dager
      : 0;

    const estimertKompensasjon = faktiskePaalopte || (forseringsDagerBeforeChange * estimertDagskost);

    const naaGodkjenteDager = endringer.reduce((sum, e) => sum + e.naaGodkjenteDager, 0);

    return {
      forseringsDager: forseringsDagerBeforeChange,
      faktiskePaalopte,
      estimertKompensasjon,
      naaGodkjenteDager,
      gjenstaendeAvslatteDager: forseringData.avslatte_dager - naaGodkjenteDager,
    };
  }, [forseringData, forseringsDagerBeforeChange, endringer]);

  return {
    harEndringer: endringer.length > 0,
    endringer,
    kompensasjon,
  };
}
