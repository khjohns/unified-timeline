/**
 * Shared Vederlag Constants
 *
 * Delte konstanter for vederlagsmodaler (SendVederlagModal, ReviseVederlagModal).
 * Beskrivelsene er identiske med de som brukes i modalene i dag.
 */

import type { VederlagBeregningResultat } from '../../../types/timeline';

// ============================================================================
// TYPES
// ============================================================================

export type VederlagsMetode = 'ENHETSPRISER' | 'REGNINGSARBEID' | 'FASTPRIS_TILBUD';

// ============================================================================
// METHOD OPTIONS
// ============================================================================

/**
 * Beregningsmetode-valg med eksakt ordlyd fra dagens modaler.
 * VIKTIG: Ikke endre beskrivelsene uten å koordinere med produkteier.
 */
export const VEDERLAG_METODER = [
  {
    value: 'ENHETSPRISER' as const,
    label: 'Enhetspriser (§34.3)',
    description: 'Beregning basert på kontraktens enhetspriser',
  },
  {
    value: 'REGNINGSARBEID' as const,
    label: 'Regningsarbeid (§34.4)',
    description: 'Kostnader faktureres løpende etter medgått tid og materialer',
  },
  {
    value: 'FASTPRIS_TILBUD' as const,
    label: 'Fastpris/Tilbud (§34.2.1)',
    description: 'Avtalt fastpris for endringsarbeidet',
  },
] as const;

// ============================================================================
// LABEL LOOKUPS
// ============================================================================

export const METODE_LABELS: Record<VederlagsMetode, string> = {
  ENHETSPRISER: 'Enhetspriser (§34.3)',
  REGNINGSARBEID: 'Regningsarbeid (§34.4)',
  FASTPRIS_TILBUD: 'Fastpris/Tilbud (§34.2.1)',
};

export const METODE_DESCRIPTIONS: Record<VederlagsMetode, string> = {
  ENHETSPRISER: 'Beregning basert på kontraktens enhetspriser',
  REGNINGSARBEID: 'Kostnader faktureres løpende etter medgått tid og materialer',
  FASTPRIS_TILBUD: 'Avtalt fastpris for endringsarbeidet',
};

// ============================================================================
// RESULTAT LABELS & VARIANTS (for BH response display)
// ============================================================================

export const RESULTAT_LABELS: Record<VederlagBeregningResultat, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  hold_tilbake: 'Holder tilbake (§30.2)',
};

export const RESULTAT_VARIANTS: Record<VederlagBeregningResultat, 'success' | 'warning' | 'danger'> = {
  godkjent: 'success',
  delvis_godkjent: 'warning',
  avslatt: 'danger',
  hold_tilbake: 'warning',
};
