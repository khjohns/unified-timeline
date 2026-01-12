/**
 * StepIndicator Component
 *
 * A wizard-style step indicator that shows progress through multiple steps.
 * Used in multi-port modals for NS 8407 workflows.
 *
 * Features:
 * - Shows numbered step circles with labels on desktop
 * - Labels hidden on mobile for compact view
 * - Visual feedback for completed, active, and pending steps
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
  return (
    <div className={clsx('w-full', className)}>
      {/* Connecting line - spans full width behind circles */}
      <div className="relative">
        <div className="absolute top-3 sm:top-4 left-0 right-0 h-0.5 bg-pkt-border-subtle" />
        {/* Completed portion of line */}
        {currentStep > 1 && (
          <div
            className="absolute top-3 sm:top-4 left-0 h-0.5 bg-step-completed-bg"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        )}

        {/* Steps with justify-between for edge-to-edge layout */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;

            return (
              <div key={index} className="flex flex-col items-center">
                {/* Step circle - smaller on mobile */}
                <div
                  className={clsx(
                    'relative z-10 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm border-2 transition-colors bg-pkt-bg-card',
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

                {/* Label - hidden on mobile, shown on desktop */}
                <span
                  className={clsx(
                    'hidden sm:block mt-2 text-xs text-center',
                    isActive && 'font-medium text-pkt-text-body-dark',
                    isCompleted && 'text-pkt-text-body-subtle',
                    !isActive && !isCompleted && 'text-pkt-text-body-muted'
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
