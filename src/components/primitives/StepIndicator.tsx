/**
 * StepIndicator Component
 *
 * A wizard-style step indicator that shows progress through multiple steps.
 * Used in multi-port modals for NS 8407 workflows.
 *
 * Features:
 * - Shows numbered step circles with labels on desktop
 * - Labels hidden on mobile for compact view
 * - Visual feedback for completed, active, pending, and error steps
 * - Accessible with ARIA attributes for screen readers
 * - Clickable steps for navigation to completed steps
 */

import { CheckIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import clsx from 'clsx';

export interface Step {
  /** Short description of the step (e.g., "Særskilte krav") */
  label: string;
  /** Whether this step has a validation error */
  hasError?: boolean;
}

interface StepIndicatorProps {
  currentStep: number;
  steps: Step[];
  className?: string;
  /** Accessible label for the stepper navigation */
  ariaLabel?: string;
  /** Callback when a completed step is clicked. Receives 1-indexed step number. */
  onStepClick?: (stepNumber: number) => void;
}

export function StepIndicator({
  currentStep,
  steps,
  className,
  ariaLabel = 'Fremdrift',
  onStepClick,
}: StepIndicatorProps) {
  return (
    <nav aria-label={ariaLabel} className={clsx('w-full', className)}>
      {/* Connecting line - spans full width behind circles */}
      <div className="relative">
        <div className="absolute top-[13px] sm:top-[17px] left-0 right-0 h-0.5 bg-pkt-border-subtle" />
        {/* Completed portion of line */}
        {currentStep > 1 && (
          <div
            className="absolute top-[13px] sm:top-[17px] left-0 h-0.5 bg-step-completed-bg transition-[width] duration-200 ease-out"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        )}

        {/* Steps with justify-between for edge-to-edge layout */}
        <ol role="list" className="relative flex justify-between list-none m-0 p-0">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;
            const isClickable = isCompleted && onStepClick;
            const hasError = step.hasError && !isActive;

            const circleContent = (
              <span
                className={clsx(
                  'relative z-10 w-[26px] h-[26px] sm:w-[34px] sm:h-[34px] rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm border-2 transition-colors bg-pkt-bg-card',
                  isActive &&
                    'bg-pkt-surface-strong-dark-blue text-white border-pkt-surface-strong-dark-blue',
                  isCompleted &&
                    !hasError &&
                    'bg-step-completed-bg text-step-completed-text border-step-completed-border',
                  hasError && 'bg-red-50 text-red-600 border-red-400',
                  !isActive &&
                    !isCompleted &&
                    !hasError &&
                    'bg-pkt-surface-gray text-pkt-text-body-subtle border-pkt-border-subtle',
                  isClickable && 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-pkt-surface-strong-dark-blue/50'
                )}
              >
                {hasError ? (
                  <ExclamationTriangleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                ) : isCompleted ? (
                  <CheckIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                ) : (
                  stepNumber
                )}
              </span>
            );

            return (
              <li
                key={index}
                className="flex flex-col items-center"
                aria-current={isActive ? 'step' : undefined}
              >
                {/* Step circle - clickable if completed with onClick handler */}
                {isClickable ? (
                  <button
                    type="button"
                    onClick={() => onStepClick(stepNumber)}
                    aria-label={`Gå til steg ${stepNumber}: ${step.label}`}
                    className="p-0 bg-transparent border-none"
                  >
                    {circleContent}
                  </button>
                ) : (
                  circleContent
                )}

                {/* Label - hidden on mobile, shown on desktop */}
                <span
                  className={clsx(
                    'hidden sm:block mt-2 text-xs text-center max-w-[100px]',
                    isActive && 'font-medium text-pkt-text-body-dark',
                    isCompleted && !hasError && 'text-pkt-text-body-subtle',
                    hasError && 'text-red-600 font-medium',
                    !isActive && !isCompleted && !hasError && 'text-pkt-text-body-muted'
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
