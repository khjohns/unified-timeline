/**
 * TrackNextStep - Kontekstuell neste-steg-indikator per spor.
 *
 * I stedet for en separat StatusAlert-banner viser denne komponenten
 * "neste steg" direkte på det relevante sporkortet. Kun synlig når
 * det er en handling brukeren bør gjøre på dette sporet.
 *
 * Bruker samme regelmotor som StatusAlert (generateStatusAlert)
 * men filtrerer til kun det aktuelle sporet.
 */

import { useMemo } from 'react';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import type { SakState, SporType } from '../../types/timeline';
import type { AvailableActions } from '../../hooks/useActionPermissions';
import { generateStatusAlert, type StatusAlertMessage } from '../StatusAlert/statusAlertGenerator';

interface TrackNextStepProps {
  spor: SporType;
  state: SakState;
  userRole: 'TE' | 'BH';
  actions: AvailableActions;
  className?: string;
}

/**
 * Generate a track-specific micro-hint based on the status alert system.
 * Returns a short action-oriented message for the specific track.
 */
function getTrackHint(
  spor: SporType,
  state: SakState,
  userRole: 'TE' | 'BH',
  actions: AvailableActions,
): StatusAlertMessage | null {
  const alert = generateStatusAlert(state, userRole, actions);
  if (!alert) return null;

  // Only show if this alert relates to this specific track
  if (alert.relatedSpor !== spor) return null;

  // Only show action-type alerts (not info/success which are informational)
  if (alert.type !== 'action' && alert.type !== 'warning') return null;

  return alert;
}

export function TrackNextStep({ spor, state, userRole, actions, className }: TrackNextStepProps) {
  const hint = useMemo(
    () => getTrackHint(spor, state, userRole, actions),
    [spor, state, userRole, actions],
  );

  if (!hint) return null;

  const isWarning = hint.type === 'warning';

  return (
    <div
      className={clsx(
        'mt-2 px-2.5 py-2 rounded-md text-xs',
        'border-l-2 transition-all duration-300',
        isWarning
          ? 'bg-alert-warning-bg/40 border-l-badge-warning-text text-alert-warning-text'
          : 'bg-pkt-brand-warm-blue-1000/5 border-l-pkt-brand-warm-blue-1000 text-pkt-brand-dark-blue-1000',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-1">
        <ArrowRightIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
        <div className="min-w-0">
          <p className="font-medium leading-tight">{hint.title}</p>
          {hint.nextStep && (
            <p className="mt-0.5 opacity-80">{hint.nextStep}</p>
          )}
        </div>
      </div>
    </div>
  );
}
