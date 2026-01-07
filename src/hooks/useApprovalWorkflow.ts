/**
 * useApprovalWorkflow Hook
 *
 * Provides approval workflow functionality for a specific case (sak).
 * Wraps ApprovalContext with convenience methods for the current case.
 */

import { useMemo, useCallback } from 'react';
import { useApprovalContext } from '../context/ApprovalContext';
import { useUserRole } from './useUserRole';
import type {
  ApprovalRequest,
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

  // Per-track approval requests (legacy, for backwards compatibility)
  grunnlagApproval: ApprovalRequest | undefined;
  vederlagApproval: ApprovalRequest | undefined;
  fristApproval: ApprovalRequest | undefined;
  submitForApproval: (draft: DraftResponseData, belop: number) => ApprovalRequest;

  // Per-track approval actions (for approvers)
  canApproveGrunnlag: boolean;
  canApproveVederlag: boolean;
  canApproveFrist: boolean;
  approveStep: (sporType: ApprovalSporType, comment?: string) => void;
  rejectStep: (sporType: ApprovalSporType, reason: string) => void;
  cancelApprovalRequest: (sporType: ApprovalSporType) => void;

  // Per-track status helpers
  isPendingGrunnlagApproval: boolean;
  isPendingVederlagApproval: boolean;
  isPendingFristApproval: boolean;
  isGrunnlagApproved: boolean;
  isVederlagApproved: boolean;
  isFristApproved: boolean;
  isGrunnlagRejected: boolean;
  isVederlagRejected: boolean;
  isFristRejected: boolean;

  // Per-track next approver info
  nextGrunnlagApprover: string | undefined;
  nextVederlagApprover: string | undefined;
  nextFristApprover: string | undefined;

  // Combined package (BhResponsPakke) management
  bhResponsPakke: BhResponsPakke | undefined;
  canSubmitPakke: boolean;
  submitPakkeForApproval: (dagmulktsats: number) => BhResponsPakke | undefined;
  approvePakkeStep: (comment?: string) => void;
  rejectPakkeStep: (reason: string) => void;
  cancelPakke: () => void;

  // Package status helpers
  canApprovePakke: boolean;
  isPendingPakkeApproval: boolean;
  isPakkeApproved: boolean;
  isPakkeRejected: boolean;
  nextPakkeApprover: string | undefined;
}

export function useApprovalWorkflow(sakId: string): UseApprovalWorkflowResult {
  const context = useApprovalContext();
  const { bhApprovalRole } = useUserRole();

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

  // Get per-track approval requests for this case
  const grunnlagApproval = useMemo(
    () => context.getApprovalRequest(sakId, 'grunnlag'),
    [context, sakId]
  );

  const vederlagApproval = useMemo(
    () => context.getApprovalRequest(sakId, 'vederlag'),
    [context, sakId]
  );

  const fristApproval = useMemo(
    () => context.getApprovalRequest(sakId, 'frist'),
    [context, sakId]
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

  // Submit for approval wrapper (per-track)
  const submitForApproval = useCallback(
    (draft: DraftResponseData, belop: number): ApprovalRequest => {
      return context.submitForApproval(sakId, draft, belop);
    },
    [context, sakId]
  );

  // Submit package for approval wrapper
  const submitPakkeForApproval = useCallback(
    (dagmulktsats: number): BhResponsPakke | undefined => {
      return context.submitPakkeForApproval(sakId, dagmulktsats);
    },
    [context, sakId]
  );

  // Can approve checks (per-track)
  const canApproveGrunnlag = useMemo(() => {
    if (bhApprovalRole === 'BH') return false;
    return context.canApprove(sakId, 'grunnlag', bhApprovalRole);
  }, [context, sakId, bhApprovalRole]);

  const canApproveVederlag = useMemo(() => {
    if (bhApprovalRole === 'BH') return false;
    return context.canApprove(sakId, 'vederlag', bhApprovalRole);
  }, [context, sakId, bhApprovalRole]);

  const canApproveFrist = useMemo(() => {
    if (bhApprovalRole === 'BH') return false;
    return context.canApprove(sakId, 'frist', bhApprovalRole);
  }, [context, sakId, bhApprovalRole]);

  // Can approve package check
  const canApprovePakke = useMemo(() => {
    if (bhApprovalRole === 'BH') return false;
    return context.canApprovePakke(sakId, bhApprovalRole);
  }, [context, sakId, bhApprovalRole]);

  // Approve/reject wrappers (per-track)
  const approveStep = useCallback(
    (sporType: ApprovalSporType, comment?: string) => {
      context.approveStep(sakId, sporType, comment);
    },
    [context, sakId]
  );

  const rejectStep = useCallback(
    (sporType: ApprovalSporType, reason: string) => {
      context.rejectStep(sakId, sporType, reason);
    },
    [context, sakId]
  );

  const cancelApprovalRequest = useCallback(
    (sporType: ApprovalSporType) => {
      context.cancelApprovalRequest(sakId, sporType);
    },
    [context, sakId]
  );

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

  // Per-track status helpers
  const isPendingGrunnlagApproval = grunnlagApproval?.status === 'pending';
  const isPendingVederlagApproval = vederlagApproval?.status === 'pending';
  const isPendingFristApproval = fristApproval?.status === 'pending';
  const isGrunnlagApproved = grunnlagApproval?.status === 'approved';
  const isVederlagApproved = vederlagApproval?.status === 'approved';
  const isFristApproved = fristApproval?.status === 'approved';
  const isGrunnlagRejected = grunnlagApproval?.status === 'rejected';
  const isVederlagRejected = vederlagApproval?.status === 'rejected';
  const isFristRejected = fristApproval?.status === 'rejected';

  // Package status helpers
  const isPendingPakkeApproval = bhResponsPakke?.status === 'pending';
  const isPakkeApproved = bhResponsPakke?.status === 'approved';
  const isPakkeRejected = bhResponsPakke?.status === 'rejected';

  // Per-track next approver info
  const nextGrunnlagApprover = useMemo(() => {
    if (!grunnlagApproval) return undefined;
    const next = getNextApprover(grunnlagApproval.steps);
    return next?.roleName;
  }, [grunnlagApproval]);

  const nextVederlagApprover = useMemo(() => {
    if (!vederlagApproval) return undefined;
    const next = getNextApprover(vederlagApproval.steps);
    return next?.roleName;
  }, [vederlagApproval]);

  const nextFristApprover = useMemo(() => {
    if (!fristApproval) return undefined;
    const next = getNextApprover(fristApproval.steps);
    return next?.roleName;
  }, [fristApproval]);

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

    // Per-track approvals
    grunnlagApproval,
    vederlagApproval,
    fristApproval,
    submitForApproval,
    canApproveGrunnlag,
    canApproveVederlag,
    canApproveFrist,
    approveStep,
    rejectStep,
    cancelApprovalRequest,
    isPendingGrunnlagApproval,
    isPendingVederlagApproval,
    isPendingFristApproval,
    isGrunnlagApproved,
    isVederlagApproved,
    isFristApproved,
    isGrunnlagRejected,
    isVederlagRejected,
    isFristRejected,
    nextGrunnlagApprover,
    nextVederlagApprover,
    nextFristApprover,

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
  };
}
