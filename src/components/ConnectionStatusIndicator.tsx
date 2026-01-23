/**
 * ConnectionStatusIndicator Component
 *
 * Displays connection status for backend and Catenda services.
 * Shows colored dots with tooltips indicating connection state.
 */

import { clsx } from 'clsx';
import { Tooltip } from './primitives';
import { useConnectionStatus, type ConnectionState } from '../hooks/useConnectionStatus';

interface StatusDotProps {
  state: ConnectionState;
  label: string;
  description: string;
}

function StatusDot({ state, label, description }: StatusDotProps) {
  const dotStyles: Record<ConnectionState, string> = {
    connected: 'bg-pkt-status-connected',
    disconnected: 'bg-pkt-status-disconnected',
    checking: 'bg-pkt-status-neutral animate-pulse',
    unconfigured: 'bg-pkt-status-neutral',
  };

  const stateLabels: Record<ConnectionState, string> = {
    connected: 'Tilkoblet',
    disconnected: 'Frakoblet',
    checking: 'Sjekker...',
    unconfigured: 'Ikke konfigurert',
  };

  return (
    <Tooltip
      content={
        <div className="text-center">
          <div className="font-medium">{label}</div>
          <div className="text-white/80">{stateLabels[state]}</div>
          {description && (
            <div className="text-xs text-white/60 mt-1">{description}</div>
          )}
        </div>
      }
      side="bottom"
    >
      <button
        type="button"
        className={clsx(
          'w-2.5 h-2.5 rounded-full transition-colors',
          dotStyles[state]
        )}
        aria-label={`${label}: ${stateLabels[state]}`}
      />
    </Tooltip>
  );
}

export function ConnectionStatusIndicator() {
  const { backend, catenda } = useConnectionStatus();

  const getBackendDescription = () => {
    if (backend === 'connected') return 'API-serveren svarer normalt';
    if (backend === 'disconnected') return 'Kan ikke nå API-serveren';
    return '';
  };

  const getCatendaDescription = () => {
    if (catenda === 'connected') return 'Prosjekthotellet er tilkoblet';
    if (catenda === 'disconnected') return 'Kan ikke koble til prosjekthotellet';
    if (catenda === 'unconfigured') return 'Catenda er ikke satt opp';
    return '';
  };

  return (
    <div className="flex items-center gap-1.5" role="status" aria-label="Tilkoblingsstatus">
      <StatusDot
        state={backend}
        label="Backend"
        description={getBackendDescription()}
      />
      <StatusDot
        state={catenda}
        label="Catenda"
        description={getCatendaDescription()}
      />
    </div>
  );
}
