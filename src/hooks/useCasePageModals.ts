/**
 * useCasePageModals Hook
 *
 * Manages all modal states for CasePage to reduce complexity.
 * Organizes modals by category: TE submissions, BH responses, updates, and special actions.
 */

import { useState, useCallback, useMemo } from 'react';

interface ModalState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface CasePageModals {
  // TE Initial Submissions
  sendGrunnlag: ModalState;
  sendVederlag: ModalState;
  sendFrist: ModalState;

  // BH Responses
  respondGrunnlag: ModalState;
  respondVederlag: ModalState;
  respondFrist: ModalState;

  // TE Updates
  updateGrunnlag: ModalState;
  reviseVederlag: ModalState;
  reviseFrist: ModalState;

  // BH Response Updates
  updateGrunnlagResponse: ModalState;
  updateVederlagResponse: ModalState;
  updateFristResponse: ModalState;

  // Special Actions - TE
  sendForsering: ModalState;

  // TE Withdrawals
  withdrawGrunnlag: ModalState;
  withdrawVederlag: ModalState;
  withdrawFrist: ModalState;

  // Special Actions - BH
  utstEO: ModalState;

  // Approval Workflow
  sendResponsPakke: ModalState;
  approvePakke: ModalState;
  discardPakkeConfirm: ModalState;

  // Other
  pdfPreview: ModalState;
  catendaWarning: ModalState;
}

/**
 * Creates a modal state object with open state and setter
 */
function useModalState(initialState = false): ModalState {
  const [open, setOpen] = useState(initialState);
  return { open, setOpen };
}

/**
 * Hook that manages all CasePage modal states
 *
 * @returns Object with all modal states organized by category
 *
 * @example
 * const modals = useCasePageModals();
 *
 * // Opening a modal
 * modals.sendGrunnlag.setOpen(true);
 *
 * // Passing to component
 * <SendGrunnlagModal
 *   open={modals.sendGrunnlag.open}
 *   onOpenChange={modals.sendGrunnlag.setOpen}
 * />
 */
export function useCasePageModals(): CasePageModals {
  // TE Initial Submissions
  const sendGrunnlag = useModalState();
  const sendVederlag = useModalState();
  const sendFrist = useModalState();

  // BH Responses
  const respondGrunnlag = useModalState();
  const respondVederlag = useModalState();
  const respondFrist = useModalState();

  // TE Updates
  const updateGrunnlag = useModalState();
  const reviseVederlag = useModalState();
  const reviseFrist = useModalState();

  // BH Response Updates
  const updateGrunnlagResponse = useModalState();
  const updateVederlagResponse = useModalState();
  const updateFristResponse = useModalState();

  // Special Actions - TE
  const sendForsering = useModalState();

  // TE Withdrawals
  const withdrawGrunnlag = useModalState();
  const withdrawVederlag = useModalState();
  const withdrawFrist = useModalState();

  // Special Actions - BH
  const utstEO = useModalState();

  // Approval Workflow
  const sendResponsPakke = useModalState();
  const approvePakke = useModalState();
  const discardPakkeConfirm = useModalState();

  // Other
  const pdfPreview = useModalState();
  const catendaWarning = useModalState();

  return useMemo(
    () => ({
      // TE Initial Submissions
      sendGrunnlag,
      sendVederlag,
      sendFrist,

      // BH Responses
      respondGrunnlag,
      respondVederlag,
      respondFrist,

      // TE Updates
      updateGrunnlag,
      reviseVederlag,
      reviseFrist,

      // BH Response Updates
      updateGrunnlagResponse,
      updateVederlagResponse,
      updateFristResponse,

      // Special Actions - TE
      sendForsering,

      // TE Withdrawals
      withdrawGrunnlag,
      withdrawVederlag,
      withdrawFrist,

      // Special Actions - BH
      utstEO,

      // Approval Workflow
      sendResponsPakke,
      approvePakke,
      discardPakkeConfirm,

      // Other
      pdfPreview,
      catendaWarning,
    }),
    [
      sendGrunnlag,
      sendVederlag,
      sendFrist,
      respondGrunnlag,
      respondVederlag,
      respondFrist,
      updateGrunnlag,
      reviseVederlag,
      reviseFrist,
      updateGrunnlagResponse,
      updateVederlagResponse,
      updateFristResponse,
      sendForsering,
      withdrawGrunnlag,
      withdrawVederlag,
      withdrawFrist,
      utstEO,
      sendResponsPakke,
      approvePakke,
      discardPakkeConfirm,
      pdfPreview,
      catendaWarning,
    ]
  );
}
