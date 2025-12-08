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

  // Helper: Check if a track is in initial state (not yet sent)
  const isInitialStatus = (status: string | undefined) =>
    status === 'utkast' || status === 'ikke_relevant';

  return {
    // TE Actions: Send initial claims
    canSendGrunnlag: isTE && isInitialStatus(state.grunnlag.status),
    canSendVederlag: isTE && isInitialStatus(state.vederlag.status),
    canSendFrist: isTE && isInitialStatus(state.frist.status),

    // TE Actions: Update existing claims
    canUpdateGrunnlag:
      isTE &&
      (state.grunnlag.status === 'sendt' ||
        state.grunnlag.status === 'under_behandling' ||
        state.grunnlag.status === 'avvist') &&
      !state.grunnlag.laast,
    canUpdateVederlag:
      isTE &&
      (state.vederlag.status === 'sendt' ||
        state.vederlag.status === 'under_behandling' ||
        state.vederlag.status === 'avvist'),
    canUpdateFrist:
      isTE &&
      (state.frist.status === 'sendt' ||
        state.frist.status === 'under_behandling' ||
        state.frist.status === 'avvist'),

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

    // Special: Issue EO (Endringsordre)
    canIssueEO: state.kan_utstede_eo,
  };
}
