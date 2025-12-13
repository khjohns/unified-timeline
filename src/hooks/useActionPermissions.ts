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

  return {
    // TE Actions: Send initial claims (only from draft, not from ikke_relevant)
    canSendGrunnlag: isTE && isDraftStatus(state.grunnlag.status),
    canSendVederlag: isTE && isDraftStatus(state.vederlag.status),
    canSendFrist: isTE && isDraftStatus(state.frist.status),

    // TE Actions: Update existing claims
    canUpdateGrunnlag:
      isTE &&
      (state.grunnlag.status === 'sendt' ||
        state.grunnlag.status === 'under_behandling' ||
        state.grunnlag.status === 'avslatt') &&
      !state.grunnlag.laast,
    canUpdateVederlag:
      isTE &&
      (state.vederlag.status === 'sendt' ||
        state.vederlag.status === 'under_behandling' ||
        state.vederlag.status === 'avslatt'),
    canUpdateFrist:
      isTE &&
      (state.frist.status === 'sendt' ||
        state.frist.status === 'under_behandling' ||
        state.frist.status === 'avslatt'),

    // TE Actions: Withdraw claims
    canWithdrawGrunnlag:
      isTE &&
      (state.grunnlag.status === 'sendt' ||
        state.grunnlag.status === 'under_behandling') &&
      !state.grunnlag.laast,
    canWithdrawVederlag:
      isTE &&
      (state.vederlag.status === 'sendt' || state.vederlag.status === 'under_behandling'),
    canWithdrawFrist:
      isTE &&
      (state.frist.status === 'sendt' || state.frist.status === 'under_behandling'),

    // BH Actions: Respond to claims
    canRespondToGrunnlag:
      isBH &&
      (state.grunnlag.status === 'sendt' || state.grunnlag.status === 'under_behandling'),
    canRespondToVederlag:
      isBH &&
      (state.vederlag.status === 'sendt' || state.vederlag.status === 'under_behandling'),
    canRespondToFrist:
      isBH && (state.frist.status === 'sendt' || state.frist.status === 'under_behandling'),

    // BH Actions: Update existing responses (snuoperasjon, endre avgjørelse)
    // Must have actually responded (bh_resultat is set, not null/undefined)
    canUpdateGrunnlagResponse:
      isBH &&
      state.grunnlag.bh_resultat != null &&
      !isInitialStatus(state.grunnlag.status),
    canUpdateVederlagResponse:
      isBH &&
      state.vederlag.bh_resultat != null &&
      !isInitialStatus(state.vederlag.status),
    canUpdateFristResponse:
      isBH &&
      state.frist.bh_resultat != null &&
      !isInitialStatus(state.frist.status),

    // TE Actions: Forsering (§33.8)
    // Available when BH has rejected frist (wholly or partially) OR rejected grunnlag
    canSendForsering:
      isTE &&
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
