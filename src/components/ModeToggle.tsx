/**
 * ModeToggle Component
 *
 * Compact toggle switch for testing between Totalentreprenør (TE) and Byggherre (BH) modes.
 * Used for development and testing purposes to view different permissions and actions.
 */

import { UserRole } from '../hooks/useUserRole';
import { clsx } from 'clsx';

interface ModeToggleProps {
  userRole: UserRole;
  onToggle: (role: UserRole) => void;
}

/**
 * ModeToggle provides a compact visual toggle to switch between TE and BH roles
 */
export function ModeToggle({ userRole, onToggle }: ModeToggleProps) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-xs text-pkt-grays-gray-600">Test:</span>
      <div className="inline-flex rounded-none border border-pkt-border-default overflow-hidden">
        <button
          onClick={() => onToggle('TE')}
          className={clsx(
            'px-2 py-1 text-xs font-medium transition-colors',
            'focus:outline-none focus:ring-1 focus:ring-inset focus:ring-pkt-border-focus',
            userRole === 'TE'
              ? 'bg-pkt-surface-strong-dark-blue text-pkt-text-body-light'
              : 'bg-pkt-bg-card text-pkt-text-body-dark hover:bg-pkt-bg-subtle'
          )}
          aria-pressed={userRole === 'TE'}
          aria-label="Bytt til Totalentreprenør modus"
        >
          TE
        </button>
        <button
          onClick={() => onToggle('BH')}
          className={clsx(
            'px-2 py-1 text-xs font-medium transition-colors',
            'border-l border-pkt-border-default',
            'focus:outline-none focus:ring-1 focus:ring-inset focus:ring-pkt-border-focus',
            userRole === 'BH'
              ? 'bg-pkt-surface-strong-dark-blue text-pkt-text-body-light'
              : 'bg-pkt-bg-card text-pkt-text-body-dark hover:bg-pkt-bg-subtle'
          )}
          aria-pressed={userRole === 'BH'}
          aria-label="Bytt til Byggherre modus"
        >
          BH
        </button>
      </div>
    </div>
  );
}
