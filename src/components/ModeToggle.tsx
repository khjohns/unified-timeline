/**
 * ModeToggle Component
 *
 * Toggle switch for testing between Totalentreprenør (TE) and Byggherre (BH) modes.
 * Used for development and testing purposes to view different permissions and actions.
 */

import { UserRole } from '../hooks/useUserRole';
import { clsx } from 'clsx';

interface ModeToggleProps {
  userRole: UserRole;
  onToggle: (role: UserRole) => void;
}

/**
 * ModeToggle provides a visual toggle to switch between TE and BH roles
 */
export function ModeToggle({ userRole, onToggle }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-pkt-03">
      <span className="text-sm font-medium text-gray-700">Testmodus:</span>
      <div className="inline-flex rounded-none border-2 border-pkt-border-default overflow-hidden">
        <button
          onClick={() => onToggle('TE')}
          className={clsx(
            'px-pkt-04 py-pkt-02 text-sm font-medium transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-pkt-border-focus',
            'min-h-[44px]',
            userRole === 'TE'
              ? 'bg-pkt-surface-strong-dark-blue text-pkt-text-body-light'
              : 'bg-white text-pkt-text-body-dark hover:bg-pkt-surface-light-beige'
          )}
          aria-pressed={userRole === 'TE'}
          aria-label="Bytt til Totalentreprenør modus"
        >
          Entreprenør (TE)
        </button>
        <button
          onClick={() => onToggle('BH')}
          className={clsx(
            'px-pkt-04 py-pkt-02 text-sm font-medium transition-colors',
            'border-l-2 border-pkt-border-default',
            'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-pkt-border-focus',
            'min-h-[44px]',
            userRole === 'BH'
              ? 'bg-pkt-surface-strong-dark-blue text-pkt-text-body-light'
              : 'bg-white text-pkt-text-body-dark hover:bg-pkt-surface-light-beige'
          )}
          aria-pressed={userRole === 'BH'}
          aria-label="Bytt til Byggherre modus"
        >
          Byggherre (BH)
        </button>
      </div>
    </div>
  );
}
