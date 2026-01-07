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
} from '../types/approval';
import { getNextApprover } from '../constants/approvalConfig';

interface UseApprovalWorkflowResult {
  // Feature toggle
  approvalEnabled: boolean;
  setApprovalEnabled: (enabled: boolean) => void;

  // Draft management for this case
  vederlagDraft: DraftResponseData | undefined;
  fristDraft: DraftResponseData | undefined;
  saveDraft: (draft: DraftResponseData) => void;
  deleteDraft: (sporType: ApprovalSporType) => void;
  hasDraft: (sporType: ApprovalSporType) => boolean;

  // Approval request for this case
  vederlagApproval: ApprovalRequest | undefined;
  fristApproval: ApprovalRequest | undefined;
  submitForApproval: (draft: DraftResponseData, belop: number) => ApprovalRequest;

  // Approval actions (for approvers)
  canApproveVederlag: boolean;
  canApproveFrist: boolean;
  approveStep: (sporType: ApprovalSporType, comment?: string) => void;
  rejectStep: (sporType: ApprovalSporType, reason: string) => void;
  cancelApprovalRequest: (sporType: ApprovalSporType) => void;

  // Status helpers
  isPendingVederlagApproval: boolean;
  isPendingFristApproval: boolean;
  isVederlagApproved: boolean;
  isFristApproved: boolean;
  isVederlagRejected: boolean;
  isFristRejected: boolean;

  // Next approver info
  nextVederlagApprover: string | undefined;
  nextFristApprover: string | undefined;
}

export function useApprovalWorkflow(sakId: string): UseApprovalWorkflowResult {
  const context = useApprovalContext();
  const { bhApprovalRole } = useUserRole();

  // Get drafts for this case
  const vederlagDraft = useMemo(
    () => context.getDraft(sakId, 'vederlag'),
    [context, sakId]
  );

  const fristDraft = useMemo(
    () => context.getDraft(sakId, 'frist'),
    [context, sakId]
  );

  // Get approval requests for this case
  const vederlagApproval = useMemo(
    () => context.getApprovalRequest(sakId, 'vederlag'),
    [context, sakId]
  );

  const fristApproval = useMemo(
    () => context.getApprovalRequest(sakId, 'frist'),
    [context, sakId]
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

  // Submit for approval wrapper
  const submitForApproval = useCallback(
    (draft: DraftResponseData, belop: number): ApprovalRequest => {
      return context.submitForApproval(sakId, draft, belop);
    },
    [context, sakId]
  );

  // Can approve checks
  const canApproveVederlag = useMemo(() => {
    if (bhApprovalRole === 'BH') return false;
    return context.canApprove(sakId, 'vederlag', bhApprovalRole);
  }, [context, sakId, bhApprovalRole]);

  const canApproveFrist = useMemo(() => {
    if (bhApprovalRole === 'BH') return false;
    return context.canApprove(sakId, 'frist', bhApprovalRole);
  }, [context, sakId, bhApprovalRole]);

  // Approve/reject wrappers
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

  // Status helpers
  const isPendingVederlagApproval = vederlagApproval?.status === 'pending';
  const isPendingFristApproval = fristApproval?.status === 'pending';
  const isVederlagApproved = vederlagApproval?.status === 'approved';
  const isFristApproved = fristApproval?.status === 'approved';
  const isVederlagRejected = vederlagApproval?.status === 'rejected';
  const isFristRejected = fristApproval?.status === 'rejected';

  // Next approver info
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

  return {
    approvalEnabled: context.approvalEnabled,
    setApprovalEnabled: context.setApprovalEnabled,
    vederlagDraft,
    fristDraft,
    saveDraft,
    deleteDraft,
    hasDraft,
    vederlagApproval,
    fristApproval,
    submitForApproval,
    canApproveVederlag,
    canApproveFrist,
    approveStep,
    rejectStep,
    cancelApprovalRequest,
    isPendingVederlagApproval,
    isPendingFristApproval,
    isVederlagApproved,
    isFristApproved,
    isVederlagRejected,
    isFristRejected,
    nextVederlagApprover,
    nextFristApprover,
  };
}
