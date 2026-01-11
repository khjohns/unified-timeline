/**
 * StepIndicator Component
 *
 * A minimal wizard-style step indicator that shows progress through multiple steps.
 * Used in multi-port modals for NS 8407 workflows.
 *
 * Features:
 * - Shows step numbers with single-line descriptions
 * - Visual feedback for completed, active, and pending steps
 * - Even spacing between steps regardless of text length
 */

import clsx from 'clsx';

export interface Step {
  /** Short description of the step (e.g., "Særskilte krav") */
  label: string;
}

interface StepIndicatorProps {
  currentStep: number;
  steps: Step[];
  className?: string;
}

export function StepIndicator({ currentStep, steps, className }: StepIndicatorProps) {
  const activeStep = steps[currentStep - 1];

  return (
    <div className={clsx('w-full', className)}>
      {/* Grid layout ensures equal spacing regardless of text length */}
      <div
        className="grid items-start"
        style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
      >
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const isLast = index === steps.length - 1;

          return (
            <div key={index} className="relative flex flex-col items-center">
              {/* Connecting line - positioned behind the circle */}
              {!isLast && (
                <div
                  className={clsx(
                    'absolute top-3 sm:top-4 left-1/2 w-full h-0.5',
                    isCompleted ? 'bg-step-completed-bg' : 'bg-pkt-border-subtle'
                  )}
                />
              )}

              {/* Step circle - smaller on mobile */}
              <div
                className={clsx(
                  'relative z-10 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm border-2 transition-colors',
                  isActive &&
                    'bg-pkt-surface-strong-dark-blue text-white border-pkt-surface-strong-dark-blue',
                  isCompleted &&
                    'bg-step-completed-bg text-step-completed-text border-step-completed-border',
                  !isActive &&
                    !isCompleted &&
                    'bg-pkt-surface-gray text-pkt-text-body-subtle border-pkt-border-subtle'
                )}
              >
                {isCompleted ? '✓' : stepNumber}
              </div>

              {/* Step label - hidden on mobile, shown on desktop */}
              <span
                className={clsx(
                  'hidden sm:block text-xs mt-2 text-center px-1',
                  isActive && 'font-medium text-pkt-text-body-dark',
                  !isActive && 'text-pkt-text-body-subtle'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile: Show only active step label centered below */}
      {activeStep && (
        <div className="sm:hidden text-center mt-2">
          <span className="text-sm font-medium text-pkt-text-body-dark">
            {currentStep}. {activeStep.label}
          </span>
        </div>
      )}
    </div>
  );
}
