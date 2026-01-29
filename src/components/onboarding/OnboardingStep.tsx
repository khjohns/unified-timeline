/**
 * OnboardingStep Component
 *
 * Displays a popover-style tooltip for each onboarding step.
 * Positioned relative to a target element with arrow indicator.
 */

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { clsx } from 'clsx';
import { Button } from '../primitives';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Cross2Icon,
  CheckIcon,
} from '@radix-ui/react-icons';

export interface OnboardingStepProps {
  /** Title of the step */
  title: string;
  /** Description/content of the step */
  description: ReactNode;
  /** CSS selector for the target element to highlight */
  targetSelector: string;
  /** Preferred side for the popover */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Current step number (1-based for display) */
  stepNumber: number;
  /** Total number of steps */
  totalSteps: number;
  /** Whether this step is active */
  isActive: boolean;
  /** Callback for next button */
  onNext: () => void;
  /** Callback for previous button */
  onPrevious: () => void;
  /** Callback for skip button */
  onSkip: () => void;
  /** Callback for complete button (last step) */
  onComplete: () => void;
}

export function OnboardingStep({
  title,
  description,
  targetSelector,
  side = 'bottom',
  stepNumber,
  totalSteps,
  isActive,
  onNext,
  onPrevious,
  onSkip,
  onComplete,
}: OnboardingStepProps) {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);

  const isFirstStep = stepNumber === 1;
  const isLastStep = stepNumber === totalSteps;

  // Find the target element and calculate position
  const findTargetAndPosition = useCallback(() => {
    const element = document.querySelector(targetSelector) as HTMLElement;
    if (!element) return;

    setTargetElement(element);

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const popoverHeight = 280; // Approximate popover height
    const popoverWidth = 320;
    const padding = 16;

    // Calculate optimal position for popover
    let x = rect.left + rect.width / 2;
    let y: number;

    // Determine if we should show above or below
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (side === 'bottom' || (side !== 'top' && spaceBelow >= popoverHeight + padding)) {
      // Position below the element
      y = rect.bottom + padding;
    } else if (side === 'top' || spaceAbove >= popoverHeight + padding) {
      // Position above the element
      y = rect.top - popoverHeight - padding;
    } else {
      // Not enough space above or below - position in the visible area
      y = Math.max(padding, Math.min(viewportHeight - popoverHeight - padding, rect.top));
    }

    // Keep popover horizontally within viewport
    x = Math.max(popoverWidth / 2 + padding, Math.min(viewportWidth - popoverWidth / 2 - padding, x));

    setPopoverPosition({ x, y });
  }, [targetSelector, side]);

  // Find target when step becomes active
  useEffect(() => {
    if (isActive) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(findTargetAndPosition, 100);
      return () => clearTimeout(timer);
    }
  }, [isActive, findTargetAndPosition]);

  // Update position on resize
  useEffect(() => {
    if (!isActive) return;

    const handleResize = () => {
      requestAnimationFrame(findTargetAndPosition);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isActive, findTargetAndPosition]);

  if (!isActive || !targetElement || !popoverPosition) {
    return null;
  }

  // Calculate actual side based on position relative to target
  const targetRect = targetElement.getBoundingClientRect();
  const actualSide = popoverPosition.y > targetRect.bottom ? 'bottom' : 'top';

  return (
    <div
      className={clsx(
        'fixed z-onboarding-popover',
        'w-[320px] max-w-[calc(100vw-2rem)]',
        'bg-pkt-bg-card rounded-lg shadow-xl',
        'border-2 border-pkt-border-default',
        'animate-in fade-in-0 duration-200',
        actualSide === 'bottom' ? 'slide-in-from-top-2' : 'slide-in-from-bottom-2'
      )}
      style={{
        left: popoverPosition.x,
        top: popoverPosition.y,
        transform: 'translateX(-50%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Arrow pointing to target */}
      <div
        className={clsx(
          'absolute w-3 h-3 bg-pkt-bg-card border-pkt-border-default rotate-45',
          actualSide === 'bottom'
            ? '-top-1.5 left-1/2 -translate-x-1/2 border-l-2 border-t-2'
            : '-bottom-1.5 left-1/2 -translate-x-1/2 border-r-2 border-b-2'
        )}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pkt-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-pkt-text-body-subtle">
            {stepNumber} av {totalSteps}
          </span>
        </div>
        <button
          onClick={onSkip}
          className="p-1 rounded hover:bg-pkt-bg-subtle text-pkt-text-body-subtle hover:text-pkt-text-body-default transition-colors"
          aria-label="Lukk veiviser"
        >
          <Cross2Icon className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <h3 className="text-base font-semibold text-pkt-text-body-dark mb-2">
          {title}
        </h3>
        <div className="text-sm text-pkt-text-body-default leading-relaxed">
          {description}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 px-4 pb-3">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={clsx(
              'w-2 h-2 rounded-full transition-colors',
              index + 1 === stepNumber
                ? 'bg-pkt-brand-dark-blue-1000'
                : index + 1 < stepNumber
                  ? 'bg-pkt-brand-green-1000'
                  : 'bg-pkt-grays-gray-200'
            )}
          />
        ))}
      </div>

      {/* Footer with navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-pkt-border-subtle bg-pkt-bg-subtle rounded-b-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrevious}
          disabled={isFirstStep}
          className={clsx(isFirstStep && 'invisible')}
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          Forrige
        </Button>

        {isLastStep ? (
          <Button variant="primary" size="sm" onClick={onComplete}>
            <CheckIcon className="w-4 h-4 mr-1" />
            Fullfør
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onNext}>
            Neste
            <ArrowRightIcon className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
