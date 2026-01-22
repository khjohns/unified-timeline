/**
 * StatusAlert Component
 *
 * Viser en kontekstuell status-alert øverst i saksvisningen.
 * Informerer om nåværende situasjon og foreslår neste steg basert på
 * brukerens rolle (TE/BH) og saksstatus.
 */

import { useMemo } from 'react';
import { Alert } from '../primitives';
import type { SakState } from '../../types/timeline';
import type { AvailableActions } from '../../hooks/useActionPermissions';
import {
  generateStatusAlert,
  type StatusAlertMessage,
  type AlertType,
} from './statusAlertGenerator';
import {
  ArrowRightIcon,
} from '@radix-ui/react-icons';

export interface StatusAlertProps {
  /** Nåværende saksstatus */
  state: SakState;
  /** Brukerens rolle */
  userRole: 'TE' | 'BH';
  /** Tilgjengelige handlinger */
  actions: AvailableActions;
  /** Om det allerede finnes en forseringssak som refererer til denne saken */
  harForseringssak?: boolean;
  /** Om det allerede finnes en endringsordre som refererer til denne saken */
  harEndringsordre?: boolean;
  /** Valgfri className for ekstra styling */
  className?: string;
}

/**
 * Map fra vår AlertType til Alert-komponentens variant
 */
function mapAlertTypeToVariant(type: AlertType): 'info' | 'success' | 'warning' | 'danger' {
  switch (type) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'action':
      return 'info'; // "action" bruker info-styling men med tydeligere oppfordring
    case 'info':
    default:
      return 'info';
  }
}

export function StatusAlert({ state, userRole, actions, harForseringssak, harEndringsordre, className }: StatusAlertProps) {
  const message: StatusAlertMessage | null = useMemo(
    () => generateStatusAlert(state, userRole, actions, { harForseringssak, harEndringsordre }),
    [state, userRole, actions, harForseringssak, harEndringsordre]
  );

  // Ikke vis noe hvis det ikke er noen relevant melding
  if (!message) {
    return null;
  }

  const variant = mapAlertTypeToVariant(message.type);

  return (
    <Alert
      variant={variant}
      title={message.title}
      className={className}
    >
      <p>{message.description}</p>
      {message.nextStep && (
        <p className="mt-1.5 flex items-center gap-1.5 font-medium">
          <ArrowRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{message.nextStep}</span>
        </p>
      )}
    </Alert>
  );
}

export default StatusAlert;
