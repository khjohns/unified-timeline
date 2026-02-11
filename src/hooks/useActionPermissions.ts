/**
 * useActionPermissions Hook
 *
 * Computes which actions are available based on current state and user role.
 * Used to conditionally render action buttons.
 */

import { SakState } from '../types/timeline';

export type UserRole = 'TE' | 'BH';

export interface AvailableActions {
  canSendGrunnlag: boolean;
  canSendVederlag: boolean;
  canSendFrist: boolean;
  canUpdateGrunnlag: boolean;
  canUpdateVederlag: boolean;
  canUpdateFrist: boolean;
  canWithdrawGrunnlag: boolean;
  canWithdrawVederlag: boolean;
  canWithdrawFrist: boolean;
  canRespondToGrunnlag: boolean;
  canRespondToVederlag: boolean;
  canRespondToFrist: boolean;
  // BH Actions: Update existing responses
  canUpdateGrunnlagResponse: boolean;
  canUpdateVederlagResponse: boolean;
  canUpdateFristResponse: boolean;
  // TE Actions: Accept BH's response (per track)
  canAcceptGrunnlagResponse: boolean;
  canAcceptVederlagResponse: boolean;
  canAcceptFristResponse: boolean;
  // TE Actions: Forsering (§33.8)
  canSendForsering: boolean;
  canIssueEO: boolean;
}

/**
 * Compute available actions based on state and role
 *
 * @param state - Current case state
 * @param userRole - Current user's role (TE or BH)
 * @returns Object indicating which actions are available
 *
 * @example
 * ```tsx
 * const actions = useActionPermissions(data.state, 'TE');
 *
 * return (
 *   <div>
 *     {actions.canSendVederlag && (
 *       <Button onClick={openVederlagModal}>
 *         Send Vederlag
 *       </Button>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useActionPermissions(
  state: SakState,
  userRole: UserRole
): AvailableActions {
  const isTE = userRole === 'TE';
  const isBH = userRole === 'BH';

  // Helper: Check if a track is in draft state (can send initial claim)
  const isDraftStatus = (status: string | undefined) => status === 'utkast';

  // Helper: Check if a track is in initial state (not yet actively processed)
  const isInitialStatus = (status: string | undefined) =>
    status === 'utkast' || status === 'ikke_relevant';

  // Helper: Check if BH has responded to the current version of a claim
  // Returns true if BH's response is to the latest version
  const harSvartPaaGjeldendeVersjon = (
    bhResultat: unknown,
    bhRespondertVersjon: number | undefined,
    antallVersjoner: number
  ): boolean => {
    if (bhResultat == null) return false;
    if (bhRespondertVersjon === undefined) return false;
    // Version 0 = original, so current version = antall_versjoner - 1
    const gjeldendeVersjon = Math.max(0, antallVersjoner - 1);
    return bhRespondertVersjon === gjeldendeVersjon;
  };

  // Force Majeure (§33.3) gir kun rett til fristforlengelse, ikke vederlagsjustering
  const erForceMajeure = state.grunnlag.hovedkategori === 'FORCE_MAJEURE';

  return {
    // TE Actions: Send initial claims (only from draft, not from ikke_relevant)
    canSendGrunnlag: isTE && isDraftStatus(state.grunnlag.status),
    canSendVederlag: isTE && isDraftStatus(state.vederlag.status) && !erForceMajeure,
    canSendFrist: isTE && isDraftStatus(state.frist.status),

    // TE Actions: Update existing claims (including after partial approval)
    canUpdateGrunnlag:
      isTE &&
      (state.grunnlag.status === 'sendt' ||
        state.grunnlag.status === 'under_behandling' ||
        state.grunnlag.status === 'avslatt' ||
        state.grunnlag.status === 'delvis_godkjent') &&
      !state.grunnlag.laast,
    canUpdateVederlag:
      isTE &&
      (state.vederlag.status === 'sendt' ||
        state.vederlag.status === 'under_behandling' ||
        state.vederlag.status === 'avslatt' ||
        state.vederlag.status === 'delvis_godkjent'),
    canUpdateFrist:
      isTE &&
      (state.frist.status === 'sendt' ||
        state.frist.status === 'under_behandling' ||
        state.frist.status === 'avslatt' ||
        state.frist.status === 'delvis_godkjent'),

    // TE Actions: Withdraw claims
    // TE kan ALLTID trekke tilbake, unntatt når fullt godkjent, ikke sendt, allerede trukket, eller låst
    canWithdrawGrunnlag:
      isTE &&
      !['ikke_relevant', 'utkast', 'godkjent', 'trukket', 'laast'].includes(state.grunnlag.status) &&
      !state.grunnlag.laast,
    canWithdrawVederlag:
      isTE &&
      !['ikke_relevant', 'utkast', 'godkjent', 'trukket'].includes(state.vederlag.status),
    canWithdrawFrist:
      isTE &&
      !['ikke_relevant', 'utkast', 'godkjent', 'trukket'].includes(state.frist.status),

    // BH Actions: Respond to claims
    // Show "Svar" when: status is sendt/under_behandling AND BH has NOT responded to current version
    canRespondToGrunnlag:
      isBH &&
      (state.grunnlag.status === 'sendt' || state.grunnlag.status === 'under_behandling') &&
      !harSvartPaaGjeldendeVersjon(
        state.grunnlag.bh_resultat,
        state.grunnlag.bh_respondert_versjon,
        state.grunnlag.antall_versjoner
      ),
    canRespondToVederlag:
      isBH &&
      (state.vederlag.status === 'sendt' || state.vederlag.status === 'under_behandling') &&
      !harSvartPaaGjeldendeVersjon(
        state.vederlag.bh_resultat,
        state.vederlag.bh_respondert_versjon,
        state.vederlag.antall_versjoner
      ),
    canRespondToFrist:
      isBH &&
      (state.frist.status === 'sendt' || state.frist.status === 'under_behandling') &&
      !harSvartPaaGjeldendeVersjon(
        state.frist.bh_resultat,
        state.frist.bh_respondert_versjon,
        state.frist.antall_versjoner
      ),

    // BH Actions: Update existing responses (snuoperasjon, endre avgjørelse)
    // Show "Endre svar" ONLY when: BH has responded to the current version (not an older revision)
    canUpdateGrunnlagResponse:
      isBH &&
      state.grunnlag.bh_resultat != null &&
      !isInitialStatus(state.grunnlag.status) &&
      harSvartPaaGjeldendeVersjon(
        state.grunnlag.bh_resultat,
        state.grunnlag.bh_respondert_versjon,
        state.grunnlag.antall_versjoner
      ),
    canUpdateVederlagResponse:
      isBH &&
      state.vederlag.bh_resultat != null &&
      !isInitialStatus(state.vederlag.status) &&
      harSvartPaaGjeldendeVersjon(
        state.vederlag.bh_resultat,
        state.vederlag.bh_respondert_versjon,
        state.vederlag.antall_versjoner
      ),
    canUpdateFristResponse:
      isBH &&
      state.frist.bh_resultat != null &&
      !isInitialStatus(state.frist.status) &&
      harSvartPaaGjeldendeVersjon(
        state.frist.bh_resultat,
        state.frist.bh_respondert_versjon,
        state.frist.antall_versjoner
      ),

    // TE Actions: Accept BH's response ("Godta svaret")
    // Available when: TE, BH has responded, result is not GODKJENT, and not already accepted/settled
    canAcceptGrunnlagResponse:
      isTE &&
      state.grunnlag.bh_resultat != null &&
      state.grunnlag.bh_resultat !== 'godkjent' &&
      !state.grunnlag.te_akseptert &&
      !['godkjent', 'laast', 'trukket'].includes(state.grunnlag.status),
    canAcceptVederlagResponse:
      isTE &&
      state.vederlag.bh_resultat != null &&
      state.vederlag.bh_resultat !== 'godkjent' &&
      !state.vederlag.te_akseptert &&
      !['godkjent', 'trukket'].includes(state.vederlag.status),
    canAcceptFristResponse:
      isTE &&
      state.frist.bh_resultat != null &&
      state.frist.bh_resultat !== 'godkjent' &&
      !state.frist.te_akseptert &&
      !['godkjent', 'trukket'].includes(state.frist.status),

    // TE Actions: Forsering (§33.8)
    // Available when BH has rejected frist (wholly or partially) OR rejected grunnlag
    // NOT available if frist or grunnlag has been withdrawn (no basis for forsering)
    canSendForsering:
      isTE &&
      state.frist.status !== 'trukket' &&
      state.grunnlag.status !== 'trukket' &&
      state.frist.bh_resultat != null &&
      (
        // Direct frist rejection (avslatt or delvis_godkjent)
        ['avslatt', 'delvis_godkjent'].includes(state.frist.bh_resultat) ||
        // Grunnlag rejection (implies frist rejection)
        (state.grunnlag.bh_resultat != null &&
          state.grunnlag.bh_resultat === 'avslatt')
      ),

    // Special: Issue EO (Endringsordre)
    canIssueEO: state.kan_utstede_eo,
  };
}
