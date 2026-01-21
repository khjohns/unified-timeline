/**
 * ModeToggle Component
 *
 * Compact toggle switch for testing between Totalentreprenør (TE) and Byggherre (BH) modes.
 * Supports three modes:
 * - TE/BH toggle: Free switching between roles (for testing)
 * - "Min rolle": Lock to user's Supabase group (for production)
 *
 * In "auto" mode (default), user starts with their Supabase role but can override.
 */

import { UserRole, RoleMode } from '../hooks/useUserRole';
import { clsx } from 'clsx';

interface ModeToggleProps {
  userRole: UserRole;
  onToggle: (role: UserRole) => void;
  /** Role mode (override, supabase, auto) */
  roleMode?: RoleMode;
  /** Callback when role mode changes */
  onRoleModeChange?: (mode: RoleMode) => void;
  /** User's Supabase role (if any) */
  supabaseRole?: UserRole | null;
  /** User's Supabase group name */
  supabaseGroupName?: string | null;
  /** Whether user has a Supabase group */
  hasSupabaseGroup?: boolean;
  /** Whether role is locked (cannot be changed) */
  isRoleLocked?: boolean;
  /** Whether Supabase role is loading */
  isLoading?: boolean;
}

const roleOptions = [
  { value: 'TE' as const, label: 'Totalentreprenør' },
  { value: 'BH' as const, label: 'Byggherre' },
];

/**
 * ModeToggle provides a compact visual toggle to switch between TE, BH, and "Min rolle" modes
 */
export function ModeToggle({
  userRole,
  onToggle,
  roleMode = 'auto',
  onRoleModeChange,
  supabaseRole,
  supabaseGroupName,
  hasSupabaseGroup = false,
  isRoleLocked = false,
  isLoading = false,
}: ModeToggleProps) {
  const isSupabaseMode = roleMode === 'supabase';
  const showSupabaseOption = hasSupabaseGroup && onRoleModeChange;

  // Format group name for display
  const formatGroupName = (name: string | null | undefined): string => {
    if (!name) return 'Min rolle';
    // Capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <div
      className="flex items-center gap-1 p-1 bg-pkt-bg-subtle rounded-lg border border-pkt-grays-gray-200"
      role="group"
      aria-label="Velg rolle"
    >
      {/* TE/BH toggle buttons */}
      {roleOptions.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => {
            if (!isRoleLocked) {
              // If in supabase mode, switch to auto mode when manually toggling
              if (isSupabaseMode && onRoleModeChange) {
                onRoleModeChange('auto');
              }
              onToggle(value);
            }
          }}
          disabled={isRoleLocked}
          className={clsx(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            !isSupabaseMode && userRole === value
              ? 'bg-pkt-bg-card text-pkt-text-body-dark shadow-sm'
              : 'text-pkt-grays-gray-500 hover:text-pkt-text-body-dark hover:bg-pkt-bg-card/50',
            isRoleLocked && 'opacity-50 cursor-not-allowed'
          )}
          title={isRoleLocked ? `Låst til ${supabaseGroupName}` : label}
          aria-label={`Bytt til ${label} modus`}
          aria-pressed={!isSupabaseMode && userRole === value}
        >
          {value}
        </button>
      ))}

      {/* "Min rolle" button - only shown if user has a Supabase group */}
      {showSupabaseOption && (
        <>
          <div className="w-px h-4 bg-pkt-grays-gray-300 mx-0.5" />
          <button
            onClick={() => onRoleModeChange('supabase')}
            disabled={isLoading}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
              isSupabaseMode
                ? 'bg-pkt-blue-600 text-white shadow-sm'
                : 'text-pkt-grays-gray-500 hover:text-pkt-text-body-dark hover:bg-pkt-bg-card/50',
              isLoading && 'opacity-50'
            )}
            title={`Bruk din tildelte rolle: ${formatGroupName(supabaseGroupName)} (${supabaseRole})`}
            aria-label="Bruk min tildelte rolle fra Supabase"
            aria-pressed={isSupabaseMode}
          >
            {isLoading ? (
              <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span>{formatGroupName(supabaseGroupName)}</span>
                {supabaseRole && (
                  <span className="text-[10px] opacity-75">({supabaseRole})</span>
                )}
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
