/**
 * UserRoleContext
 *
 * Context for managing user role selection in mock/testing mode.
 * Provides shared state across all components that need role information.
 *
 * NOTE: This is only needed for mock/testing purposes. In production,
 * user roles would come from Entra ID / Microsoft Graph API and be part
 * of the authentication context.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import type { ApprovalRole } from '../types/approval';
import {
  getCurrentMockUser,
  getManager,
  type MockPerson,
} from '../constants/approvalConfig';

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

interface UserRoleContextType {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  isTE: boolean;
  isBH: boolean;
  bhApprovalRole: BHApprovalRole;
  setBhApprovalRole: (role: BHApprovalRole) => void;
  isApprover: boolean;
  currentMockUser: MockPerson;
  currentMockManager: MockPerson | undefined;
}

const UserRoleContext = createContext<UserRoleContextType | null>(null);

interface UserRoleProviderProps {
  children: ReactNode;
}

export function UserRoleProvider({ children }: UserRoleProviderProps) {
  const [userRole, setUserRole] = useState<UserRole>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'TE' || stored === 'BH') ? stored : 'TE';
  });

  const [bhApprovalRole, setBhApprovalRole] = useState<BHApprovalRole>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_BH_APPROVAL);
    if (stored && VALID_APPROVAL_ROLES.includes(stored as BHApprovalRole)) {
      return stored as BHApprovalRole;
    }
    return 'BH';
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, userRole);
  }, [userRole]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BH_APPROVAL, bhApprovalRole);
  }, [bhApprovalRole]);

  // Mock person info based on selected BH approval role
  const currentMockUser: MockPerson = useMemo(
    () => getCurrentMockUser(bhApprovalRole),
    [bhApprovalRole]
  );

  const currentMockManager: MockPerson | undefined = useMemo(
    () => getManager(currentMockUser),
    [currentMockUser]
  );

  const value: UserRoleContextType = {
    userRole,
    setUserRole,
    isTE: userRole === 'TE',
    isBH: userRole === 'BH',
    bhApprovalRole,
    setBhApprovalRole,
    isApprover: userRole === 'BH' && bhApprovalRole !== 'BH',
    currentMockUser,
    currentMockManager,
  };

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (!context) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}
