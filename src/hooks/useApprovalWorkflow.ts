/**
 * useApprovalWorkflow Hook
 *
 * Provides approval workflow functionality for a specific case (sak).
 * Wraps ApprovalContext with convenience methods for the current case.
 * Uses combined package (BhResponsPakke) for approval - individual track approval is not supported.
 */

import { useMemo, useCallback } from 'react';
import { useApprovalContext } from '../context/ApprovalContext';
import { useUserRole } from './useUserRole';
import type {
  ApprovalSporType,
  DraftResponseData,
  BhResponsPakke,
} from '../types/approval';
import { getNextApprover } from '../constants/approvalConfig';

interface UseApprovalWorkflowResult {
  // Feature toggle
  approvalEnabled: boolean;
  setApprovalEnabled: (enabled: boolean) => void;

  // Draft management for this case
  grunnlagDraft: DraftResponseData | undefined;
  vederlagDraft: DraftResponseData | undefined;
  fristDraft: DraftResponseData | undefined;
  saveDraft: (draft: DraftResponseData) => void;
  deleteDraft: (sporType: ApprovalSporType) => void;
  hasDraft: (sporType: ApprovalSporType) => boolean;
  hasAnyDraft: boolean;

  // Combined package (BhResponsPakke) management
  bhResponsPakke: BhResponsPakke | undefined;
  canSubmitPakke: boolean;
  submitPakkeForApproval: (dagmulktsats: number, comment?: string) => BhResponsPakke | undefined;
  approvePakkeStep: (comment?: string) => void;
  rejectPakkeStep: (reason: string) => void;
  cancelPakke: () => void;

  // Package status helpers
  canApprovePakke: boolean;
  isPendingPakkeApproval: boolean;
  isPakkeApproved: boolean;
  isPakkeRejected: boolean;
  nextPakkeApprover: string | undefined;

  // Re-submission after rejection
  restoreDraftsFromPakke: () => boolean;
}

export function useApprovalWorkflow(sakId: string): UseApprovalWorkflowResult {
  const context = useApprovalContext();
  const { bhApprovalRole, currentMockUser } = useUserRole();

  // Get drafts for this case
  const grunnlagDraft = useMemo(
    () => context.getDraft(sakId, 'grunnlag'),
    [context, sakId]
  );

  const vederlagDraft = useMemo(
    () => context.getDraft(sakId, 'vederlag'),
    [context, sakId]
  );

  const fristDraft = useMemo(
    () => context.getDraft(sakId, 'frist'),
    [context, sakId]
  );

  // Check if any draft exists (for package submission)
  const hasAnyDraft = useMemo(
    () => !!(grunnlagDraft || vederlagDraft || fristDraft),
    [grunnlagDraft, vederlagDraft, fristDraft]
  );

  // Get combined package for this case
  const bhResponsPakke = useMemo(
    () => context.getBhResponsPakke(sakId),
    [context, sakId]
  );

  // Can submit package if at least one draft exists and no pending package
  const canSubmitPakke = useMemo(
    () => hasAnyDraft && (!bhResponsPakke || bhResponsPakke.status !== 'pending'),
    [hasAnyDraft, bhResponsPakke]
  );

  // Save draft wrapper
  const saveDraft = useCallback(
    (draft: DraftResponseData) => {
      context.saveDraft(sakId, draft);
    },
    [context, sakId]
  );

  // Delete draft wrapper
  const deleteDraft = useCallback(
    (sporType: ApprovalSporType) => {
      context.deleteDraft(sakId, sporType);
    },
    [context, sakId]
  );

  // Has draft wrapper
  const hasDraft = useCallback(
    (sporType: ApprovalSporType): boolean => {
      return context.hasDraft(sakId, sporType);
    },
    [context, sakId]
  );

  // Submit package for approval wrapper
  // Uses the current mock user's role to ensure the submitter can't approve their own submission
  const submitPakkeForApproval = useCallback(
    (dagmulktsats: number, comment?: string): BhResponsPakke | undefined => {
      return context.submitPakkeForApproval(sakId, dagmulktsats, currentMockUser.rolle, currentMockUser.navn, comment);
    },
    [context, sakId, currentMockUser.rolle, currentMockUser.navn]
  );

  // Can approve package check
  const canApprovePakke = useMemo(() => {
    if (bhApprovalRole === 'BH') return false;
    return context.canApprovePakke(sakId, bhApprovalRole);
  }, [context, sakId, bhApprovalRole]);

  // Package approve/reject/cancel wrappers
  const approvePakkeStep = useCallback(
    (comment?: string) => {
      context.approvePakkeStep(sakId, comment);
    },
    [context, sakId]
  );

  const rejectPakkeStep = useCallback(
    (reason: string) => {
      context.rejectPakkeStep(sakId, reason);
    },
    [context, sakId]
  );

  const cancelPakke = useCallback(() => {
    context.cancelPakke(sakId);
  }, [context, sakId]);

  // Restore drafts from rejected package for re-submission
  const restoreDraftsFromPakke = useCallback(() => {
    return context.restoreDraftsFromPakke(sakId);
  }, [context, sakId]);

  // Package status helpers
  const isPendingPakkeApproval = bhResponsPakke?.status === 'pending';
  const isPakkeApproved = bhResponsPakke?.status === 'approved';
  const isPakkeRejected = bhResponsPakke?.status === 'rejected';

  // Package next approver info
  const nextPakkeApprover = useMemo(() => {
    if (!bhResponsPakke) return undefined;
    const next = getNextApprover(bhResponsPakke.steps);
    return next?.roleName;
  }, [bhResponsPakke]);

  return {
    // Feature toggle
    approvalEnabled: context.approvalEnabled,
    setApprovalEnabled: context.setApprovalEnabled,

    // Drafts
    grunnlagDraft,
    vederlagDraft,
    fristDraft,
    saveDraft,
    deleteDraft,
    hasDraft,
    hasAnyDraft,

    // Combined package
    bhResponsPakke,
    canSubmitPakke,
    submitPakkeForApproval,
    approvePakkeStep,
    rejectPakkeStep,
    cancelPakke,
    canApprovePakke,
    isPendingPakkeApproval,
    isPakkeApproved,
    isPakkeRejected,
    nextPakkeApprover,
    restoreDraftsFromPakke,
  };
}
