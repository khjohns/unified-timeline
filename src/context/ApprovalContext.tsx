/**
 * ApprovalContext
 *
 * Manages mock approval workflow state.
 * Stores drafts and combined BH response packages for approval.
 * Persists to localStorage for demo continuity.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import type {
  ApprovalRole,
  DraftResponseData,
  ApprovalStep,
  ApprovalSporType,
  BhResponsPakke,
} from '../types/approval';
import {
  createApprovalStepsExcludingSubmitter,
  getNextApprover,
  isFullyApproved,
  APPROVAL_ROLE_LABELS,
  MOCK_APPROVERS,
} from '../constants/approvalConfig';

const STORAGE_KEY_DRAFTS = 'koe-approval-drafts';
const STORAGE_KEY_PAKKER = 'koe-approval-pakker';
const STORAGE_KEY_ENABLED = 'koe-approval-enabled';

interface ApprovalContextType {
  // Feature toggle
  approvalEnabled: boolean;
  setApprovalEnabled: (enabled: boolean) => void;

  // Draft management
  getDraft: (sakId: string, sporType: ApprovalSporType) => DraftResponseData | undefined;
  saveDraft: (sakId: string, draft: DraftResponseData) => void;
  deleteDraft: (sakId: string, sporType: ApprovalSporType) => void;
  hasDraft: (sakId: string, sporType: ApprovalSporType) => boolean;

  // Combined package management (BhResponsPakke)
  getBhResponsPakke: (sakId: string) => BhResponsPakke | undefined;
  submitPakkeForApproval: (
    sakId: string,
    dagmulktsats: number,
    submitterRole: ApprovalRole
  ) => BhResponsPakke | undefined;
  approvePakkeStep: (sakId: string, comment?: string) => void;
  rejectPakkeStep: (sakId: string, reason: string) => void;
  cancelPakke: (sakId: string) => void;
  canApprovePakke: (sakId: string, role: ApprovalRole) => boolean;
}

const ApprovalContext = createContext<ApprovalContextType | null>(null);

export function useApprovalContext() {
  const context = useContext(ApprovalContext);
  if (!context) {
    throw new Error('useApprovalContext must be used within an ApprovalProvider');
  }
  return context;
}

// Helper to create a composite key for drafts
function makeKey(sakId: string, sporType: ApprovalSporType): string {
  return `${sakId}:${sporType}`;
}

interface ApprovalProviderProps {
  children: ReactNode;
}

export function ApprovalProvider({ children }: ApprovalProviderProps) {
  // Feature toggle state
  const [approvalEnabled, setApprovalEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_ENABLED);
    return stored !== null ? stored === 'true' : true; // Default to enabled
  });

  // Drafts: Map of "sakId:sporType" -> DraftResponseData
  const [drafts, setDrafts] = useState<Map<string, DraftResponseData>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_DRAFTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
      }
    } catch {
      // Ignore parse errors
    }
    return new Map();
  });

  // Combined packages: Map of sakId -> BhResponsPakke
  const [bhResponsPakker, setBhResponsPakker] = useState<Map<string, BhResponsPakke>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PAKKER);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
      }
    } catch {
      // Ignore parse errors
    }
    return new Map();
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ENABLED, String(approvalEnabled));
  }, [approvalEnabled]);

  useEffect(() => {
    const obj: Record<string, DraftResponseData> = {};
    drafts.forEach((value, key) => {
      obj[key] = value;
    });
    localStorage.setItem(STORAGE_KEY_DRAFTS, JSON.stringify(obj));
  }, [drafts]);

  useEffect(() => {
    const obj: Record<string, BhResponsPakke> = {};
    bhResponsPakker.forEach((value, key) => {
      obj[key] = value;
    });
    localStorage.setItem(STORAGE_KEY_PAKKER, JSON.stringify(obj));
  }, [bhResponsPakker]);

  // Feature toggle setter
  const setApprovalEnabled = useCallback((enabled: boolean) => {
    setApprovalEnabledState(enabled);
  }, []);

  // Draft management
  const getDraft = useCallback(
    (sakId: string, sporType: ApprovalSporType): DraftResponseData | undefined => {
      return drafts.get(makeKey(sakId, sporType));
    },
    [drafts]
  );

  const saveDraft = useCallback((sakId: string, draft: DraftResponseData) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(makeKey(sakId, draft.sporType), draft);
      return next;
    });
  }, []);

  const deleteDraft = useCallback((sakId: string, sporType: ApprovalSporType) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.delete(makeKey(sakId, sporType));
      return next;
    });
  }, []);

  const hasDraft = useCallback(
    (sakId: string, sporType: ApprovalSporType): boolean => {
      return drafts.has(makeKey(sakId, sporType));
    },
    [drafts]
  );

  // Combined package management
  const getBhResponsPakke = useCallback(
    (sakId: string): BhResponsPakke | undefined => {
      return bhResponsPakker.get(sakId);
    },
    [bhResponsPakker]
  );

  const submitPakkeForApproval = useCallback(
    (sakId: string, dagmulktsats: number, submitterRole: ApprovalRole): BhResponsPakke | undefined => {
      // Collect all drafts for this case
      const grunnlagDraft = drafts.get(makeKey(sakId, 'grunnlag'));
      const vederlagDraft = drafts.get(makeKey(sakId, 'vederlag'));
      const fristDraft = drafts.get(makeKey(sakId, 'frist'));

      // Must have at least one draft
      if (!grunnlagDraft && !vederlagDraft && !fristDraft) {
        return undefined;
      }

      // Calculate amounts
      const vederlagBelop = vederlagDraft?.belop ?? 0;
      const fristDager = fristDraft?.dager ?? 0;
      const fristBelop = fristDager * dagmulktsats;
      const samletBelop = vederlagBelop + fristBelop;

      // Create approval steps based on combined amount, excluding submitter's role
      // This ensures the submitter cannot approve their own submission
      const steps = createApprovalStepsExcludingSubmitter(samletBelop, submitterRole);

      const pakke: BhResponsPakke = {
        id: `pakke-${Date.now()}`,
        sakId,
        grunnlagRespons: grunnlagDraft,
        vederlagRespons: vederlagDraft,
        fristRespons: fristDraft,
        vederlagBelop,
        fristDager,
        dagmulktsats,
        fristBelop,
        samletBelop,
        requiredApprovers: steps.map((s) => s.role),
        steps,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        submittedBy: `${APPROVAL_ROLE_LABELS[submitterRole]} (mock)`,
      };

      // Save the package
      setBhResponsPakker((prev) => {
        const next = new Map(prev);
        next.set(sakId, pakke);
        return next;
      });

      // Remove the individual drafts
      if (grunnlagDraft) deleteDraft(sakId, 'grunnlag');
      if (vederlagDraft) deleteDraft(sakId, 'vederlag');
      if (fristDraft) deleteDraft(sakId, 'frist');

      return pakke;
    },
    [drafts, deleteDraft]
  );

  const approvePakkeStep = useCallback(
    (sakId: string, comment?: string) => {
      setBhResponsPakker((prev) => {
        const pakke = prev.get(sakId);
        if (!pakke || pakke.status !== 'pending') return prev;

        const nextApprover = getNextApprover(pakke.steps);
        if (!nextApprover) return prev;

        // Update the step to approved
        const updatedSteps: ApprovalStep[] = pakke.steps.map((step) => {
          if (step.role === nextApprover.role) {
            const mockNames = MOCK_APPROVERS[step.role];
            const approverName = mockNames[Math.floor(Math.random() * mockNames.length)];
            return {
              ...step,
              status: 'approved' as const,
              approvedAt: new Date().toISOString(),
              approvedBy: approverName,
              comment,
            };
          }
          // Advance the next step to in_progress
          const currentIndex = pakke.steps.findIndex((s) => s.role === nextApprover.role);
          if (pakke.steps.indexOf(step) === currentIndex + 1) {
            return { ...step, status: 'in_progress' as const };
          }
          return step;
        });

        const updatedPakke: BhResponsPakke = {
          ...pakke,
          steps: updatedSteps,
          status: isFullyApproved(updatedSteps) ? 'approved' : 'pending',
          completedAt: isFullyApproved(updatedSteps)
            ? new Date().toISOString()
            : undefined,
        };

        const next = new Map(prev);
        next.set(sakId, updatedPakke);
        return next;
      });
    },
    []
  );

  const rejectPakkeStep = useCallback(
    (sakId: string, reason: string) => {
      setBhResponsPakker((prev) => {
        const pakke = prev.get(sakId);
        if (!pakke || pakke.status !== 'pending') return prev;

        const nextApprover = getNextApprover(pakke.steps);
        if (!nextApprover) return prev;

        // Update the step to rejected
        const updatedSteps: ApprovalStep[] = pakke.steps.map((step) => {
          if (step.role === nextApprover.role) {
            const mockNames = MOCK_APPROVERS[step.role];
            const approverName = mockNames[Math.floor(Math.random() * mockNames.length)];
            return {
              ...step,
              status: 'rejected' as const,
              approvedAt: new Date().toISOString(),
              approvedBy: approverName,
              comment: reason,
            };
          }
          return step;
        });

        const updatedPakke: BhResponsPakke = {
          ...pakke,
          steps: updatedSteps,
          status: 'rejected',
          completedAt: new Date().toISOString(),
        };

        const next = new Map(prev);
        next.set(sakId, updatedPakke);
        return next;
      });
    },
    []
  );

  const cancelPakke = useCallback((sakId: string) => {
    setBhResponsPakker((prev) => {
      const next = new Map(prev);
      next.delete(sakId);
      return next;
    });
  }, []);

  const canApprovePakke = useCallback(
    (sakId: string, role: ApprovalRole): boolean => {
      const pakke = bhResponsPakker.get(sakId);
      if (!pakke || pakke.status !== 'pending') return false;
      const nextApprover = getNextApprover(pakke.steps);
      return nextApprover?.role === role;
    },
    [bhResponsPakker]
  );

  const value: ApprovalContextType = {
    approvalEnabled,
    setApprovalEnabled,
    getDraft,
    saveDraft,
    deleteDraft,
    hasDraft,
    // Combined package methods
    getBhResponsPakke,
    submitPakkeForApproval,
    approvePakkeStep,
    rejectPakkeStep,
    cancelPakke,
    canApprovePakke,
  };

  return (
    <ApprovalContext.Provider value={value}>{children}</ApprovalContext.Provider>
  );
}
