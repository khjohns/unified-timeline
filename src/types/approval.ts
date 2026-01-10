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
 * Track type for approval (grunnlag, vederlag, or frist)
 */
export type ApprovalSporType = 'grunnlag' | 'vederlag' | 'frist';

/**
 * Overall status of the approval request
 */
export type ApprovalRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected';

/**
 * Result type for grunnlag responses
 * Matches GrunnlagResponsResultat from timeline types
 */
export type GrunnlagDraftResultat =
  | 'godkjent'
  | 'avslatt'
  | 'frafalt'
  | 'erkjenn_fm';

/**
 * Result type for vederlag/frist responses
 */
export type VederlagFristDraftResultat =
  | 'godkjent'
  | 'delvis_godkjent'
  | 'avslatt';

/**
 * Draft response data before sending to approval
 */
export interface DraftResponseData {
  sporType: ApprovalSporType;
  belop?: number; // For vederlag
  dager?: number; // For frist
  resultat: GrunnlagDraftResultat | VederlagFristDraftResultat;
  begrunnelse?: string;
  // Add other fields as needed from the response forms
  [key: string]: unknown;
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
  // Map of sakId:sporType -> DraftResponseData for drafts not yet submitted
  drafts: Map<string, DraftResponseData>;
  // Map of sakId -> BhResponsPakke for combined approval packages
  bhResponsPakker: Map<string, BhResponsPakke>;
  // Feature toggle
  approvalEnabled: boolean;
}

/**
 * Combined BH response package for approval
 * Groups grunnlag, vederlag, and frist responses together
 * for sequential approval as a single unit
 */
export interface BhResponsPakke {
  id: string;
  sakId: string;

  // Included tracks (at least one must be set)
  grunnlagRespons?: DraftResponseData;
  vederlagRespons?: DraftResponseData;
  fristRespons?: DraftResponseData;

  // Amount calculation
  vederlagBelop: number; // Approved amount from vederlag
  fristDager: number; // Approved days from frist
  dagmulktsats: number; // Daily penalty rate (NOK/day)
  fristBelop: number; // fristDager × dagmulktsats
  samletBelop: number; // vederlagBelop + fristBelop

  // Approval chain
  requiredApprovers: ApprovalRole[];
  steps: ApprovalStep[];
  status: ApprovalRequestStatus;

  // Metadata
  submittedAt?: string; // ISO date when submitted for approval
  submittedBy?: string; // User name who submitted (mock)
  submittedByRole?: ApprovalRole; // Role of the submitter
  submitterComment?: string; // Optional comment from submitter to approvers
  completedAt?: string; // ISO date when fully approved/rejected
}
