/**
 * StepIndicator Component
 *
 * A wizard-style step indicator that shows progress through multiple steps.
 * Used in multi-port modals for NS 8407 workflows.
 *
 * Features:
 * - Shows step numbers with labels and descriptions
 * - Visual feedback for completed, active, and pending steps
 * - Connecting lines between steps
 * - Full-width layout to match content sections
 */

import clsx from 'clsx';

export interface Step {
  label: string;
  description: string;
}

interface StepIndicatorProps {
  currentStep: number;
  steps: Step[];
  className?: string;
}

export function StepIndicator({ currentStep, steps, className }: StepIndicatorProps) {
  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-start justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const isLast = index === steps.length - 1;

          return (
            <div
              key={index}
              className={clsx(
                'flex items-center',
                isLast ? 'flex-shrink-0' : 'flex-1'
              )}
            >
              {/* Step circle and text */}
              <div className="flex flex-col items-center">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2 transition-colors',
                    isActive &&
                      'bg-pkt-surface-strong-dark-blue text-white border-pkt-surface-strong-dark-blue',
                    isCompleted && 'bg-green-600 text-white border-green-600',
                    !isActive &&
                      !isCompleted &&
                      'bg-pkt-surface-gray text-pkt-text-body-subtle border-pkt-border-subtle'
                  )}
                >
                  {isCompleted ? '✓' : stepNumber}
                </div>
                <span
                  className={clsx(
                    'text-xs mt-1 font-medium text-center whitespace-nowrap',
                    isActive && 'text-pkt-text-body-dark',
                    !isActive && 'text-pkt-text-body-subtle'
                  )}
                >
                  {step.label}
                </span>
                <span className="text-xs text-pkt-text-body-subtle text-center whitespace-nowrap">
                  {step.description}
                </span>
              </div>

              {/* Connecting line */}
              {!isLast && (
                <div
                  className={clsx(
                    'flex-1 h-1 mx-3 mt-5 -translate-y-1/2',
                    isCompleted ? 'bg-green-600' : 'bg-pkt-border-subtle'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
