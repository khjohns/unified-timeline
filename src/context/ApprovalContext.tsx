/**
 * ApprovalContext
 *
 * Manages mock approval workflow state.
 * Stores drafts, approval requests, and provides methods for the approval flow.
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
  ApprovalRequest,
  ApprovalRole,
  DraftResponseData,
  ApprovalStep,
  ApprovalSporType,
} from '../types/approval';
import {
  createApprovalSteps,
  getNextApprover,
  isFullyApproved,
  isRejected,
  APPROVAL_ROLE_LABELS,
  MOCK_APPROVERS,
} from '../constants/approvalConfig';

const STORAGE_KEY_DRAFTS = 'koe-approval-drafts';
const STORAGE_KEY_REQUESTS = 'koe-approval-requests';
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

  // Approval request management
  getApprovalRequest: (sakId: string, sporType: ApprovalSporType) => ApprovalRequest | undefined;
  submitForApproval: (sakId: string, draft: DraftResponseData, belop: number) => ApprovalRequest;
  approveStep: (sakId: string, sporType: ApprovalSporType, comment?: string) => void;
  rejectStep: (sakId: string, sporType: ApprovalSporType, reason: string) => void;
  cancelApprovalRequest: (sakId: string, sporType: ApprovalSporType) => void;

  // Query helpers
  getPendingApprovalForRole: (role: ApprovalRole) => ApprovalRequest[];
  canApprove: (sakId: string, sporType: ApprovalSporType, role: ApprovalRole) => boolean;
}

const ApprovalContext = createContext<ApprovalContextType | null>(null);

export function useApprovalContext() {
  const context = useContext(ApprovalContext);
  if (!context) {
    throw new Error('useApprovalContext must be used within an ApprovalProvider');
  }
  return context;
}

// Helper to create a composite key for drafts/requests
function makeKey(sakId: string, sporType: ApprovalSporType): string {
  return `${sakId}:${sporType}`;
}

// Parse key back to components
function parseKey(key: string): { sakId: string; sporType: ApprovalSporType } {
  const parts = key.split(':');
  const sakId = parts[0] ?? '';
  const sporType = (parts[1] ?? 'vederlag') as ApprovalSporType;
  return { sakId, sporType };
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

  // Approval requests: Map of "sakId:sporType" -> ApprovalRequest
  const [approvalRequests, setApprovalRequests] = useState<Map<string, ApprovalRequest>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_REQUESTS);
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
    const obj: Record<string, ApprovalRequest> = {};
    approvalRequests.forEach((value, key) => {
      obj[key] = value;
    });
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(obj));
  }, [approvalRequests]);

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

  // Approval request management
  const getApprovalRequest = useCallback(
    (sakId: string, sporType: ApprovalSporType): ApprovalRequest | undefined => {
      return approvalRequests.get(makeKey(sakId, sporType));
    },
    [approvalRequests]
  );

  const submitForApproval = useCallback(
    (sakId: string, draft: DraftResponseData, belop: number): ApprovalRequest => {
      const key = makeKey(sakId, draft.sporType);
      const steps = createApprovalSteps(belop);

      const request: ApprovalRequest = {
        id: `approval-${Date.now()}`,
        sakId,
        sporType: draft.sporType,
        belop,
        requiredApprovers: steps.map((s) => s.role),
        steps,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        submittedBy: 'Prosjektleder (mock)', // Mock user
        responseData: draft,
      };

      setApprovalRequests((prev) => {
        const next = new Map(prev);
        next.set(key, request);
        return next;
      });

      // Remove the draft since it's now a pending request
      deleteDraft(sakId, draft.sporType);

      return request;
    },
    [deleteDraft]
  );

  const approveStep = useCallback(
    (sakId: string, sporType: ApprovalSporType, comment?: string) => {
      setApprovalRequests((prev) => {
        const key = makeKey(sakId, sporType);
        const request = prev.get(key);
        if (!request) return prev;

        const nextApprover = getNextApprover(request.steps);
        if (!nextApprover) return prev;

        // Update the step to approved
        const updatedSteps: ApprovalStep[] = request.steps.map((step) => {
          if (step.role === nextApprover.role) {
            // Pick a random mock approver for this role
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
          const currentIndex = request.steps.findIndex((s) => s.role === nextApprover.role);
          if (request.steps.indexOf(step) === currentIndex + 1) {
            return { ...step, status: 'in_progress' as const };
          }
          return step;
        });

        const updatedRequest: ApprovalRequest = {
          ...request,
          steps: updatedSteps,
          status: isFullyApproved(updatedSteps) ? 'approved' : 'pending',
          completedAt: isFullyApproved(updatedSteps)
            ? new Date().toISOString()
            : undefined,
        };

        const next = new Map(prev);
        next.set(key, updatedRequest);
        return next;
      });
    },
    []
  );

  const rejectStep = useCallback(
    (sakId: string, sporType: ApprovalSporType, reason: string) => {
      setApprovalRequests((prev) => {
        const key = makeKey(sakId, sporType);
        const request = prev.get(key);
        if (!request) return prev;

        const nextApprover = getNextApprover(request.steps);
        if (!nextApprover) return prev;

        // Update the step to rejected
        const updatedSteps: ApprovalStep[] = request.steps.map((step) => {
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

        const updatedRequest: ApprovalRequest = {
          ...request,
          steps: updatedSteps,
          status: 'rejected',
          completedAt: new Date().toISOString(),
        };

        const next = new Map(prev);
        next.set(key, updatedRequest);
        return next;
      });
    },
    []
  );

  const cancelApprovalRequest = useCallback(
    (sakId: string, sporType: ApprovalSporType) => {
      setApprovalRequests((prev) => {
        const next = new Map(prev);
        next.delete(makeKey(sakId, sporType));
        return next;
      });
    },
    []
  );

  // Query helpers
  const getPendingApprovalForRole = useCallback(
    (role: ApprovalRole): ApprovalRequest[] => {
      const results: ApprovalRequest[] = [];
      approvalRequests.forEach((request) => {
        if (request.status !== 'pending') return;
        const nextApprover = getNextApprover(request.steps);
        if (nextApprover?.role === role) {
          results.push(request);
        }
      });
      return results;
    },
    [approvalRequests]
  );

  const canApprove = useCallback(
    (sakId: string, sporType: ApprovalSporType, role: ApprovalRole): boolean => {
      const request = approvalRequests.get(makeKey(sakId, sporType));
      if (!request || request.status !== 'pending') return false;
      const nextApprover = getNextApprover(request.steps);
      return nextApprover?.role === role;
    },
    [approvalRequests]
  );

  const value: ApprovalContextType = {
    approvalEnabled,
    setApprovalEnabled,
    getDraft,
    saveDraft,
    deleteDraft,
    hasDraft,
    getApprovalRequest,
    submitForApproval,
    approveStep,
    rejectStep,
    cancelApprovalRequest,
    getPendingApprovalForRole,
    canApprove,
  };

  return (
    <ApprovalContext.Provider value={value}>{children}</ApprovalContext.Provider>
  );
}
