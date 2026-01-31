/**
 * OnboardingStep Component
 *
 * Displays a popover-style tooltip for each onboarding step.
 * On desktop: Positioned relative to target element with arrow indicator.
 * On mobile: Bottom sheet with swipe navigation.
 */

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
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

const MOBILE_BREAKPOINT = 640;
const SWIPE_THRESHOLD = 50;

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
  const [popoverPosition, setPopoverPosition] = useState<{
    x: number;
    y: number;
    actualSide: 'top' | 'bottom';
  } | null>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isFirstStep = stepNumber === 1;
  const isLastStep = stepNumber === totalSteps;

  // Track viewport size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate optimal position for popover (desktop only)
  const calculatePosition = useCallback(() => {
    if (isMobile) {
      // On mobile, we use fixed bottom positioning
      setPopoverPosition({ x: 0, y: 0, actualSide: 'bottom' });
      return;
    }

    const element = document.querySelector(targetSelector) as HTMLElement;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const popoverHeight = 280;
    const popoverWidth = Math.min(320, viewportWidth - 32);
    const padding = 16;
    const arrowOffset = 12;

    // Calculate horizontal center
    let x = rect.left + rect.width / 2;
    // Keep within viewport
    x = Math.max(
      popoverWidth / 2 + padding,
      Math.min(viewportWidth - popoverWidth / 2 - padding, x)
    );

    // Determine vertical position
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let y: number;
    let actualSide: 'top' | 'bottom';

    // Prefer showing below the element
    if (spaceBelow >= popoverHeight + arrowOffset + padding) {
      y = rect.bottom + arrowOffset;
      actualSide = 'bottom';
    } else if (spaceAbove >= popoverHeight + arrowOffset + padding) {
      y = rect.top - popoverHeight - arrowOffset;
      actualSide = 'top';
    } else {
      // Not enough space - show at bottom of viewport
      y = viewportHeight - popoverHeight - padding;
      actualSide = 'bottom';
    }

    // Ensure y is not negative
    y = Math.max(padding, y);

    setPopoverPosition({ x, y, actualSide });
  }, [targetSelector, isMobile]);

  // Calculate position when active
  useEffect(() => {
    if (!isActive) {
      setPopoverPosition(null);
      return;
    }

    // Initial calculation with delay (synced with spotlight timing)
    const timer = setTimeout(calculatePosition, 100);

    // Update on scroll/resize
    const handleUpdate = () => {
      requestAnimationFrame(calculatePosition);
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isActive, calculatePosition]);

  // Swipe handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setSwipeOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    // Limit swipe offset for visual feedback
    setSwipeOffset(Math.max(-100, Math.min(100, diff)));
  }, [isMobile]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile) return;

    if (swipeOffset < -SWIPE_THRESHOLD) {
      // Swipe left - next
      if (isLastStep) {
        onComplete();
      } else {
        onNext();
      }
    } else if (swipeOffset > SWIPE_THRESHOLD) {
      // Swipe right - previous
      if (!isFirstStep) {
        onPrevious();
      }
    }

    setSwipeOffset(0);
  }, [isMobile, swipeOffset, isFirstStep, isLastStep, onNext, onPrevious, onComplete]);

  if (!isActive || !popoverPosition) {
    return null;
  }

  const titleId = `onboarding-title-${stepNumber}`;
  const descId = `onboarding-desc-${stepNumber}`;

  // Mobile: Bottom sheet
  if (isMobile) {
    return (
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={clsx(
          'fixed inset-x-0 bottom-0 z-onboarding-popover',
          'bg-pkt-bg-card rounded-t-2xl',
          'shadow-[0_-4px_24px_rgba(0,0,0,0.15)]',
          'border-t-2 border-x-2 border-pkt-border-default',
          'animate-in slide-in-from-bottom duration-300 ease-out',
          'motion-reduce:animate-none',
          'touch-pan-y'
        )}
        style={{
          transform: `translateX(${swipeOffset * 0.3}px)`,
          transition: swipeOffset === 0 ? 'transform 0.2s ease-out' : 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-pkt-grays-gray-300 rounded-full" />
        </div>

        {/* Header with close button */}
        <div className="flex items-center justify-between px-5 py-2">
          <span className="text-xs font-medium text-pkt-text-body-subtle">
            {stepNumber} av {totalSteps}
          </span>
          <button
            onClick={onSkip}
            className="p-2 -mr-2 rounded-full hover:bg-pkt-bg-subtle text-pkt-text-body-subtle"
            aria-label="Lukk veiviser"
          >
            <Cross2Icon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-3">
          <h3
            id={titleId}
            className="text-lg font-semibold text-pkt-text-body-dark mb-2"
          >
            {title}
          </h3>
          <div
            id={descId}
            className="text-sm text-pkt-text-body-default leading-relaxed"
          >
            {description}
          </div>
        </div>

        {/* Progress dots */}
        <div
          className="flex justify-center gap-2 px-5 py-3"
          role="group"
          aria-label={`Steg ${stepNumber} av ${totalSteps}`}
        >
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className={clsx(
                'w-2 h-2 rounded-full transition-colors motion-reduce:transition-none',
                index + 1 === stepNumber
                  ? 'bg-pkt-brand-dark-blue-1000'
                  : index + 1 < stepNumber
                    ? 'bg-pkt-brand-green-1000'
                    : 'bg-pkt-grays-gray-200'
              )}
            />
          ))}
        </div>

        {/* Swipe hint - only on first step */}
        {isFirstStep && (
          <div className="flex items-center justify-center gap-2 px-5 pb-4 text-pkt-text-body-subtle">
            <ArrowLeftIcon className="w-4 h-4 animate-pulse" />
            <span className="text-xs">Sveip for å navigere</span>
            <ArrowRightIcon className="w-4 h-4 animate-pulse" />
          </div>
        )}

        {/* Last step: Show complete button */}
        {isLastStep && (
          <div className="px-5 pb-5">
            <Button
              variant="primary"
              size="md"
              onClick={onComplete}
              className="w-full"
            >
              <CheckIcon className="w-4 h-4 mr-2" />
              Fullfør
            </Button>
          </div>
        )}

        {/* Safe area padding for devices with home indicator */}
        <div className="h-safe-area-inset-bottom pb-2" />
      </div>
    );
  }

  // Desktop: Floating popover
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className={clsx(
        'fixed z-onboarding-popover',
        'w-[320px] max-w-[calc(100vw-2rem)]',
        'bg-pkt-bg-card rounded-lg',
        'shadow-[0_4px_24px_rgba(0,0,0,0.12),0_8px_48px_rgba(0,0,0,0.08)]',
        'border-2 border-pkt-border-default',
        'animate-in fade-in-0 zoom-in-95 duration-200 ease-out',
        'motion-reduce:animate-none',
        popoverPosition.actualSide === 'bottom'
          ? 'slide-in-from-top-2'
          : 'slide-in-from-bottom-2'
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
          popoverPosition.actualSide === 'bottom'
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
        <h3
          id={titleId}
          className="text-base font-semibold text-pkt-text-body-dark mb-2"
        >
          {title}
        </h3>
        <div
          id={descId}
          className="text-sm text-pkt-text-body-default leading-relaxed"
        >
          {description}
        </div>
      </div>

      {/* Progress dots */}
      <div
        className="flex justify-center gap-1.5 px-4 pb-3"
        role="group"
        aria-label={`Steg ${stepNumber} av ${totalSteps}`}
      >
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className={clsx(
              'w-2 h-2 rounded-full transition-colors motion-reduce:transition-none',
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
