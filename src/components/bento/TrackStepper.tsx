/**
 * TrackStepper - Mini prosessflyt-indikator for hvert spor.
 *
 * Viser hvor i NS 8407-prosessen et spor befinner seg:
 * Grunnlag: Varsel → Sendt → BH svar → Avgjort
 * Vederlag: Krav → Sendt → BH svar → Avgjort
 * Frist:    Varsel → Spesifisert → BH svar → Avgjort
 *
 * Kompakt visuell indikator (dots + linje) som kommuniserer
 * prosesstrinn uten å kreve lesing av status-badges.
 */

import { clsx } from 'clsx';
import type { SporType, SporStatus } from '../../types/timeline';

interface TrackStepperProps {
  spor: SporType;
  status: SporStatus;
  hasBhResponse: boolean;
  /** Whether TE has accepted BH response (partene enige) */
  teAccepted?: boolean;
  className?: string;
}

interface Step {
  label: string;
  /** Whether this step is completed */
  completed: boolean;
  /** Whether this step is the current active one */
  active: boolean;
}

function getSteps(spor: SporType, status: SporStatus, hasBhResponse: boolean, teAccepted?: boolean): Step[] {
  const isSent = status !== 'ikke_relevant' && status !== 'utkast';
  const hasResponse = hasBhResponse;
  const isResolved = status === 'godkjent' || status === 'laast' || status === 'trukket' || teAccepted === true;

  const stepLabels: Record<SporType, [string, string, string, string]> = {
    grunnlag: ['Varsel', 'Sendt', 'Svar', 'Avgjort'],
    vederlag: ['Krav', 'Sendt', 'Svar', 'Avgjort'],
    frist: ['Varsel', 'Sendt', 'Svar', 'Avgjort'],
  };

  const labels = stepLabels[spor];

  return [
    { label: labels[0], completed: isSent, active: !isSent && status === 'utkast' },
    { label: labels[1], completed: isSent && (hasResponse || isResolved), active: isSent && !hasResponse && !isResolved },
    { label: labels[2], completed: hasResponse && (isResolved || status === 'delvis_godkjent' || status === 'avslatt' || status === 'under_forhandling'), active: hasResponse && !isResolved && status !== 'under_forhandling' },
    { label: labels[3], completed: isResolved, active: !isResolved && (status === 'under_forhandling' || status === 'delvis_godkjent' || status === 'avslatt') },
  ];
}

/**
 * Dot color based on step state
 */
function getDotStyle(step: Step, isTerminalNegative: boolean): string {
  if (step.completed) {
    if (isTerminalNegative) return 'bg-badge-danger-text';
    return 'bg-badge-success-text';
  }
  if (step.active) return 'bg-pkt-brand-warm-blue-1000 ring-2 ring-pkt-brand-warm-blue-1000/20';
  return 'bg-pkt-grays-gray-300';
}

function getLineStyle(fromStep: Step): string {
  if (fromStep.completed) return 'bg-badge-success-text/40';
  return 'bg-pkt-grays-gray-200';
}

export function TrackStepper({ spor, status, hasBhResponse, teAccepted, className }: TrackStepperProps) {
  // Don't show for irrelevant tracks
  if (status === 'ikke_relevant') return null;

  const steps = getSteps(spor, status, hasBhResponse, teAccepted);
  const isTerminalNegative = status === 'trukket';

  return (
    <div className={clsx('flex items-center gap-0', className)} role="group" aria-label={`Prosesstrinn for ${spor}`}>
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          {/* Dot */}
          <div className="flex flex-col items-center">
            <div
              className={clsx(
                'w-2 h-2 rounded-full transition-all duration-300',
                getDotStyle(step, isTerminalNegative && i === steps.length - 1),
              )}
              title={step.label}
            />
            <span className={clsx(
              'text-[8px] mt-0.5 leading-none select-none',
              step.completed || step.active
                ? 'text-pkt-text-body-default font-medium'
                : 'text-pkt-text-body-muted',
            )}>
              {step.label}
            </span>
          </div>
          {/* Connecting line */}
          {i < steps.length - 1 && (
            <div
              className={clsx(
                'h-0.5 w-4 sm:w-5 -mt-2.5',
                getLineStyle(step),
                'transition-colors duration-300',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
