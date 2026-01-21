/**
 * UserRoleContext
 *
 * Context for managing user role selection with Supabase integration.
 * Provides shared state across all components that need role information.
 *
 * Role Mode:
 * - 'override': Free toggle between TE/BH (for testing/demo)
 * - 'supabase': Locked to user's Supabase group
 * - 'auto': Default to Supabase role, but allow override
 *
 * In production, if user has a Supabase group assigned, 'auto' mode will
 * initialize with the Supabase role. Users can still toggle for testing.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import type { ApprovalRole } from '../types/approval';
import {
  getCurrentMockUser,
  getManager,
  type MockPerson,
} from '../constants/approvalConfig';
import { fetchUserRole, type UserGroupResponse } from '../api/userRole';
import { useSupabaseAuth } from './SupabaseAuthContext';

export type UserRole = 'TE' | 'BH';

/**
 * Role mode determines how the user role is managed.
 * - 'override': Free toggle (ignores Supabase)
 * - 'supabase': Locked to Supabase group (no toggle)
 * - 'auto': Use Supabase as default, allow override
 */
export type RoleMode = 'override' | 'supabase' | 'auto';

/**
 * BH approval roles for testing the approval workflow.
 * 'BH' means standard BH mode (no approval actions available).
 * The other values correspond to approval hierarchy levels.
 */
export type BHApprovalRole = 'BH' | ApprovalRole;

const STORAGE_KEY = 'koe-user-role';
const STORAGE_KEY_BH_APPROVAL = 'koe-bh-approval-role';
const STORAGE_KEY_ROLE_MODE = 'koe-role-mode';

const VALID_APPROVAL_ROLES: BHApprovalRole[] = ['BH', 'PL', 'SL', 'AL', 'DU', 'AD'];

interface UserRoleContextType {
  // Current active role
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  isTE: boolean;
  isBH: boolean;

  // BH approval role
  bhApprovalRole: BHApprovalRole;
  setBhApprovalRole: (role: BHApprovalRole) => void;
  isApprover: boolean;

  // Mock user info
  currentMockUser: MockPerson;
  currentMockManager: MockPerson | undefined;

  // Supabase group info
  supabaseRole: UserRole | null;
  supabaseGroupName: string | null;
  supabaseApprovalRole: ApprovalRole | null;
  supabaseDisplayName: string | null;
  hasSupabaseGroup: boolean;
  isLoadingSupabaseRole: boolean;

  // Role mode management
  roleMode: RoleMode;
  setRoleMode: (mode: RoleMode) => void;
  isRoleLocked: boolean;

  // Refresh Supabase role
  refreshSupabaseRole: () => Promise<void>;
}

const UserRoleContext = createContext<UserRoleContextType | null>(null);

interface UserRoleProviderProps {
  children: ReactNode;
}

export function UserRoleProvider({ children }: UserRoleProviderProps) {
  const { user, isConfigured: isSupabaseConfigured } = useSupabaseAuth();

  // Override role (from localStorage or toggle)
  const [overrideRole, setOverrideRole] = useState<UserRole>(() => {
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

  // Role mode
  const [roleMode, setRoleModeState] = useState<RoleMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_ROLE_MODE);
    if (stored === 'override' || stored === 'supabase' || stored === 'auto') {
      return stored;
    }
    return 'auto'; // Default: Use Supabase if available, allow override
  });

  // Supabase group data
  const [supabaseData, setSupabaseData] = useState<UserGroupResponse | null>(null);
  const [isLoadingSupabaseRole, setIsLoadingSupabaseRole] = useState(false);

  // Fetch Supabase role when user changes
  const refreshSupabaseRole = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setSupabaseData(null);
      return;
    }

    setIsLoadingSupabaseRole(true);
    try {
      const response = await fetchUserRole();
      setSupabaseData(response);

      // If in auto mode and user has a group, use it as initial role
      if (response.success && response.hasGroup && response.userRole) {
        // Only set if user hasn't explicitly overridden
        const hasOverridden = localStorage.getItem(STORAGE_KEY) !== null;
        if (!hasOverridden || roleMode === 'supabase') {
          setOverrideRole(response.userRole);
          if (response.approvalRole) {
            setBhApprovalRole(response.approvalRole);
          }
        }
      }
    } catch (error) {
      console.warn('Could not fetch Supabase role:', error);
      setSupabaseData(null);
    } finally {
      setIsLoadingSupabaseRole(false);
    }
  }, [user, isSupabaseConfigured, roleMode]);

  // Fetch on mount and when user changes
  useEffect(() => {
    refreshSupabaseRole();
  }, [refreshSupabaseRole]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, overrideRole);
  }, [overrideRole]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BH_APPROVAL, bhApprovalRole);
  }, [bhApprovalRole]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ROLE_MODE, roleMode);
  }, [roleMode]);

  // Compute effective user role based on mode
  const userRole = useMemo<UserRole>(() => {
    if (roleMode === 'supabase' && supabaseData?.hasGroup && supabaseData.userRole) {
      return supabaseData.userRole;
    }
    return overrideRole;
  }, [roleMode, supabaseData, overrideRole]);

  // Check if role is locked (cannot be changed)
  const isRoleLocked = roleMode === 'supabase' && (supabaseData?.hasGroup ?? false);

  // Set role (respects lock)
  const setUserRole = useCallback((role: UserRole) => {
    if (!isRoleLocked) {
      setOverrideRole(role);
    }
  }, [isRoleLocked]);

  // Set role mode
  const setRoleMode = useCallback((mode: RoleMode) => {
    setRoleModeState(mode);

    // If switching to supabase mode with a group, update role
    if (mode === 'supabase' && supabaseData?.hasGroup && supabaseData.userRole) {
      setOverrideRole(supabaseData.userRole);
      if (supabaseData.approvalRole) {
        setBhApprovalRole(supabaseData.approvalRole);
      }
    }
  }, [supabaseData]);

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

    // Supabase data
    supabaseRole: supabaseData?.userRole ?? null,
    supabaseGroupName: supabaseData?.groupName ?? null,
    supabaseApprovalRole: supabaseData?.approvalRole ?? null,
    supabaseDisplayName: supabaseData?.displayName ?? null,
    hasSupabaseGroup: supabaseData?.hasGroup ?? false,
    isLoadingSupabaseRole,

    // Role mode
    roleMode,
    setRoleMode,
    isRoleLocked,
    refreshSupabaseRole,
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
