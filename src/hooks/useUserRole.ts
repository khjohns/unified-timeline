/**
 * useUserRole Hook
 *
 * Manages user role selection for testing purposes.
 * Persists selection in localStorage to maintain state across page reloads.
 *
 * For the approval workflow mock, BH users can also select a specific
 * approval role (PL, SL, AL, DU, AD) to test the sequential approval chain.
 */

import { useState, useEffect } from 'react';
import type { ApprovalRole } from '../types/approval';

export type UserRole = 'TE' | 'BH';

/**
 * BH approval roles for testing the approval workflow.
 * 'BH' means standard BH mode (no approval actions available).
 * The other values correspond to approval hierarchy levels.
 */
export type BHApprovalRole = 'BH' | ApprovalRole;

const STORAGE_KEY = 'unified-timeline-user-role';
const STORAGE_KEY_BH_APPROVAL = 'unified-timeline-bh-approval-role';

const VALID_APPROVAL_ROLES: BHApprovalRole[] = ['BH', 'PL', 'SL', 'AL', 'DU', 'AD'];

/**
 * Hook to manage and persist user role selection
 * Defaults to 'TE' if no stored value exists
 */
export function useUserRole() {
  const [userRole, setUserRole] = useState<UserRole>(() => {
    // Initialize from localStorage if available
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'TE' || stored === 'BH') ? stored : 'TE';
  });

  // BH approval role for approval workflow testing
  const [bhApprovalRole, setBhApprovalRole] = useState<BHApprovalRole>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_BH_APPROVAL);
    if (stored && VALID_APPROVAL_ROLES.includes(stored as BHApprovalRole)) {
      return stored as BHApprovalRole;
    }
    return 'BH'; // Default to standard BH (no approval role)
  });

  // Persist to localStorage whenever role changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, userRole);
  }, [userRole]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BH_APPROVAL, bhApprovalRole);
  }, [bhApprovalRole]);

  return {
    userRole,
    setUserRole,
    isTE: userRole === 'TE',
    isBH: userRole === 'BH',
    // BH approval role (only relevant when userRole === 'BH')
    bhApprovalRole,
    setBhApprovalRole,
    // Helper: is the user in an approval role (not just standard BH)
    isApprover: userRole === 'BH' && bhApprovalRole !== 'BH',
  };
}
