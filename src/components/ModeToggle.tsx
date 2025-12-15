/**
 * ModeToggle Component
 *
 * Compact toggle switch for testing between Totalentreprenør (TE) and Byggherre (BH) modes.
 * Used for development and testing purposes to view different permissions and actions.
 * Styled to match ThemeToggle for visual consistency.
 */

import { UserRole } from '../hooks/useUserRole';
import { clsx } from 'clsx';

interface ModeToggleProps {
  userRole: UserRole;
  onToggle: (role: UserRole) => void;
}

const options = [
  { value: 'TE' as const, label: 'Totalentreprenør' },
  { value: 'BH' as const, label: 'Byggherre' },
];

/**
 * ModeToggle provides a compact visual toggle to switch between TE and BH roles
 */
export function ModeToggle({ userRole, onToggle }: ModeToggleProps) {
  return (
    <div
      className="flex items-center gap-1 p-1 bg-pkt-bg-subtle rounded-lg border border-pkt-grays-gray-200"
      role="group"
      aria-label="Velg rolle"
    >
      {options.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onToggle(value)}
          className={clsx(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            userRole === value
              ? 'bg-pkt-bg-card text-pkt-text-body-dark shadow-sm'
              : 'text-pkt-grays-gray-500 hover:text-pkt-text-body-dark hover:bg-pkt-bg-card/50'
          )}
          title={label}
          aria-label={`Bytt til ${label} modus`}
          aria-pressed={userRole === value}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
