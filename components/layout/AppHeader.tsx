import React from 'react';
import { PktHeader } from '@oslokommune/punkt-react';
import { Role } from '../../types';

interface AppHeaderProps {
  rolle: Role;
  onRoleChange: (role: Role) => void;
}

/**
 * Application header component
 *
 * Renders the main header with:
 * - Service name
 * - User role indicator
 * - Role toggle (TE/BH)
 *
 * @param rolle - Current user role (TE or BH)
 * @param onRoleChange - Callback when role is changed
 */
const AppHeader: React.FC<AppHeaderProps> = ({ rolle, onRoleChange }) => {
  return (
    <PktHeader
      serviceName="Skjema for krav om endringsordre (KOE)"
      user={{ name: rolle === 'TE' ? 'Entreprenør' : 'Byggherren', showName: true }}
      fixed={true}
    >
      <div className="flex items-center gap-3 ml-4">
        <span className="text-sm font-medium text-ink-dim hidden sm:inline">Rolle:</span>
        <div className="isolate inline-flex rounded-md shadow-sm">
          <button
            type="button"
            onClick={() => onRoleChange('TE')}
            className={`relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-border-color focus:z-10 ${
              rolle === 'TE'
                ? 'bg-pri text-white'
                : 'bg-white text-ink-dim hover:bg-gray-50'
            }`}
          >
            TE
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('BH')}
            className={`relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-border-color focus:z-10 ${
              rolle === 'BH'
                ? 'bg-pri text-white'
                : 'bg-white text-ink-dim hover:bg-gray-50'
            }`}
          >
            BH
          </button>
        </div>
      </div>
    </PktHeader>
  );
};

export default AppHeader;
