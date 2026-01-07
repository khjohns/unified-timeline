/**
 * Type definitions for the approval workflow mock
 *
 * These types support a sequential approval chain where BH responses
 * must be approved by various levels of the organization hierarchy
 * before being formally sent.
 */

/**
 * Approval roles in hierarchy order (lowest to highest authority)
 * - PL: Prosjektleder (Project Leader)
 * - SL: Seksjonsleder (Section Leader)
 * - AL: Avdelingsleder (Department Leader)
 * - DU: Direktør utbygging (Director of Construction)
 * - AD: Administrerende direktør (CEO)
 */
export type ApprovalRole = 'PL' | 'SL' | 'AL' | 'DU' | 'AD';

/**
 * Status for each step in the approval chain
 */
export type ApprovalStepStatus =
  | 'pending' // Not yet reached in chain
  | 'in_progress' // Awaiting this approver's decision
  | 'approved' // Approved by this approver
  | 'rejected'; // Rejected by this approver

/**
 * Individual step in the approval chain
 */
export interface ApprovalStep {
  role: ApprovalRole;
  roleName: string; // Norwegian display name
  status: ApprovalStepStatus;
  approvedAt?: string; // ISO date string
  approvedBy?: string; // User name (mock)
  comment?: string; // Optional comment from approver
}

/**
 * Track type for approval (vederlag or frist)
 */
export type ApprovalSporType = 'vederlag' | 'frist';

/**
 * Overall status of the approval request
 */
export type ApprovalRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected';

/**
 * Draft response data before sending to approval
 */
export interface DraftResponseData {
  sporType: ApprovalSporType;
  belop?: number; // For vederlag
  dager?: number; // For frist
  resultat: 'godkjent' | 'delvis_godkjent' | 'avslatt';
  begrunnelse?: string;
  // Add other fields as needed from the response forms
  [key: string]: unknown;
}

/**
 * Complete approval request including chain status
 */
export interface ApprovalRequest {
  id: string;
  sakId: string;
  sporType: ApprovalSporType;
  belop: number; // Amount (for threshold calculation)
  requiredApprovers: ApprovalRole[];
  steps: ApprovalStep[];
  status: ApprovalRequestStatus;
  submittedAt?: string; // ISO date when submitted for approval
  submittedBy?: string; // User who submitted (mock)
  completedAt?: string; // ISO date when fully approved/rejected
  responseData: DraftResponseData;
}

/**
 * Threshold configuration for determining required approvers
 */
export interface ApprovalThreshold {
  maxAmount: number; // Upper limit (Infinity for last tier)
  requiredRoles: ApprovalRole[];
  label: string; // Display label for the threshold range
}

/**
 * State stored in ApprovalContext
 */
export interface ApprovalState {
  // Map of sakId -> ApprovalRequest for pending approvals
  approvalRequests: Map<string, ApprovalRequest>;
  // Map of sakId -> DraftResponseData for drafts not yet submitted
  drafts: Map<string, DraftResponseData>;
  // Feature toggle
  approvalEnabled: boolean;
}
