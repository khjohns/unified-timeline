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
  const [virtualAnchor, setVirtualAnchor] = useState<{
    getBoundingClientRect: () => DOMRect;
  } | null>(null);

  const isFirstStep = stepNumber === 1;
  const isLastStep = stepNumber === totalSteps;

  // Find the target element
  const findTarget = useCallback(() => {
    const element = document.querySelector(targetSelector) as HTMLElement;
    if (element) {
      setTargetElement(element);
      // Create virtual anchor for Radix Popover
      setVirtualAnchor({
        getBoundingClientRect: () => element.getBoundingClientRect(),
      });
    }
  }, [targetSelector]);

  useEffect(() => {
    if (isActive) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(findTarget, 100);
      return () => clearTimeout(timer);
    }
  }, [isActive, findTarget]);

  // Scroll target into view and update position
  useEffect(() => {
    if (isActive && targetElement) {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      // Update virtual anchor position after scroll
      const handleScroll = () => {
        setVirtualAnchor({
          getBoundingClientRect: () => targetElement.getBoundingClientRect(),
        });
      };

      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);

      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [isActive, targetElement]);

  if (!isActive || !virtualAnchor) {
    return null;
  }

  return (
    <Popover.Root open={isActive}>
      <Popover.Anchor virtualRef={{ current: virtualAnchor }} />
      <Popover.Portal>
        <Popover.Content
          side={side}
          sideOffset={12}
          align="center"
          collisionPadding={16}
          avoidCollisions
          className={clsx(
            'z-onboarding-popover',
            'w-[320px] max-w-[calc(100vw-2rem)]',
            'bg-pkt-bg-card rounded-lg shadow-xl',
            'border-2 border-pkt-border-default',
            'data-[state=open]:animate-in',
            'data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0',
            'data-[state=open]:fade-in-0',
            'data-[side=bottom]:slide-in-from-top-2',
            'data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2',
            'data-[side=top]:slide-in-from-bottom-2'
          )}
        >
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

          <Popover.Arrow className="fill-pkt-bg-card stroke-pkt-border-default stroke-2" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
