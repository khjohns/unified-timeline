/**
 * ModeToggle Component
 *
 * Simple toggle button for switching between Totalentreprenør (TE) and Byggherre (BH) modes.
 * Used for development and testing purposes to view different permissions and actions.
 */

import { UserRole } from '../hooks/useUserRole';

interface ModeToggleProps {
  userRole: UserRole;
  onToggle: (role: UserRole) => void;
}

const roleLabels: Record<UserRole, string> = {
  TE: 'Totalentreprenør',
  BH: 'Byggherre',
};

/**
 * ModeToggle provides a simple button to switch between TE and BH roles
 */
export function ModeToggle({ userRole, onToggle }: ModeToggleProps) {
  const toggle = () => {
    onToggle(userRole === 'TE' ? 'BH' : 'TE');
  };

  return (
    <button
      onClick={toggle}
      className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-pkt-bg-subtle border border-pkt-grays-gray-200
                 hover:bg-pkt-bg-card hover:border-pkt-border-default
                 focus:outline-none focus:ring-2 focus:ring-pkt-brand-warm-blue-1000/30
                 transition-all duration-200 text-pkt-text-body-dark"
      title={`Bytter til ${roleLabels[userRole === 'TE' ? 'BH' : 'TE']}`}
      aria-label={`Aktiv rolle: ${roleLabels[userRole]}. Klikk for å bytte til ${roleLabels[userRole === 'TE' ? 'BH' : 'TE']}`}
    >
      {userRole}
    </button>
  );
}
