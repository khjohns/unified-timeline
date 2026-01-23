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
  const activeIndex = options.findIndex((opt) => opt.value === userRole);

  return (
    <div
      className="relative isolate flex items-center gap-1 p-1 bg-pkt-bg-subtle rounded-lg border border-pkt-grays-gray-200"
      role="group"
      aria-label="Velg rolle"
    >
      {/* Animated pill background */}
      <div
        className="absolute top-1 bottom-1 rounded-md bg-pkt-bg-card shadow-sm transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 0.5rem - 0.25rem) / ${options.length})`,
          transform: `translateX(calc(${activeIndex} * (100% + 0.25rem)))`,
        }}
        aria-hidden="true"
      />
      {options.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onToggle(value)}
          className={clsx(
            'relative z-10 px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-200',
            userRole === value
              ? 'text-pkt-text-body-dark'
              : 'text-pkt-grays-gray-500 hover:text-pkt-text-body-dark'
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
