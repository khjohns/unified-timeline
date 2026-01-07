/**
 * Approval Workflow Configuration
 *
 * Defines the approval chain thresholds and role labels
 * for the sequential approval workflow.
 */

import type { ApprovalRole, ApprovalThreshold, ApprovalStep } from '../types/approval';

/**
 * Norwegian display names for approval roles
 */
export const APPROVAL_ROLE_LABELS: Record<ApprovalRole, string> = {
  PL: 'Prosjektleder',
  SL: 'Seksjonsleder',
  AL: 'Avdelingsleder',
  DU: 'Direktør utbygging',
  AD: 'Administrerende direktør',
};

/**
 * Short labels for compact display
 */
export const APPROVAL_ROLE_SHORT_LABELS: Record<ApprovalRole, string> = {
  PL: 'PL',
  SL: 'SL',
  AL: 'AL',
  DU: 'DU',
  AD: 'AD',
};

/**
 * Approval thresholds based on amount
 * Each threshold defines which approvers are required for amounts up to maxAmount
 */
export const APPROVAL_THRESHOLDS: ApprovalThreshold[] = [
  {
    maxAmount: 500_000,
    requiredRoles: ['PL'],
    label: '0 – 500.000 kr',
  },
  {
    maxAmount: 2_000_000,
    requiredRoles: ['PL', 'SL'],
    label: '500.001 – 2.000.000 kr',
  },
  {
    maxAmount: 5_000_000,
    requiredRoles: ['PL', 'SL', 'AL'],
    label: '2.000.001 – 5.000.000 kr',
  },
  {
    maxAmount: 10_000_000,
    requiredRoles: ['PL', 'SL', 'AL', 'DU'],
    label: '5.000.001 – 10.000.000 kr',
  },
  {
    maxAmount: Infinity,
    requiredRoles: ['PL', 'SL', 'AL', 'DU', 'AD'],
    label: 'Over 10.000.000 kr',
  },
];

/**
 * Get required approvers based on the amount
 * Returns the list of roles that must approve in sequence
 */
export function getRequiredApprovers(amount: number): ApprovalRole[] {
  const threshold = APPROVAL_THRESHOLDS.find((t) => amount <= t.maxAmount);
  return threshold?.requiredRoles ?? ['PL'];
}

/**
 * Get the threshold info for a given amount
 */
export function getThresholdForAmount(amount: number): ApprovalThreshold | undefined {
  return APPROVAL_THRESHOLDS.find((t) => amount <= t.maxAmount);
}

/**
 * Create initial approval steps based on amount
 */
export function createApprovalSteps(amount: number): ApprovalStep[] {
  const requiredRoles = getRequiredApprovers(amount);
  return requiredRoles.map((role, index) => ({
    role,
    roleName: APPROVAL_ROLE_LABELS[role],
    status: index === 0 ? 'in_progress' : 'pending',
  }));
}

/**
 * Get the next approver in the chain
 */
export function getNextApprover(steps: ApprovalStep[]): ApprovalStep | undefined {
  return steps.find((step) => step.status === 'in_progress');
}

/**
 * Check if all steps are approved
 */
export function isFullyApproved(steps: ApprovalStep[]): boolean {
  return steps.every((step) => step.status === 'approved');
}

/**
 * Check if any step is rejected
 */
export function isRejected(steps: ApprovalStep[]): boolean {
  return steps.some((step) => step.status === 'rejected');
}

/**
 * Mock approver names for demo purposes
 */
export const MOCK_APPROVERS: Record<ApprovalRole, string[]> = {
  PL: ['Ola Nordmann', 'Kari Hansen'],
  SL: ['Per Olsen', 'Anne Johansen'],
  AL: ['Erik Larsen', 'Ingrid Berg'],
  DU: ['Bjørn Haugen', 'Liv Andersen'],
  AD: ['Magnus Pedersen'],
};
