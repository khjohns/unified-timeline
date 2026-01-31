/**
 * OnboardingGuide Component
 *
 * Main component for the user onboarding experience.
 * Displays a spotlight overlay highlighting the current element
 * with a popover explaining each step.
 */

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { OnboardingStep } from './OnboardingStep';

export interface OnboardingStepConfig {
  /** Unique identifier for the step */
  id: string;
  /** Title of the step */
  title: string;
  /** Description/content of the step */
  description: ReactNode;
  /** CSS selector for the target element */
  targetSelector: string;
  /** Preferred side for the popover (will be overridden on mobile) */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export interface OnboardingGuideProps {
  /** Array of step configurations */
  steps: OnboardingStepConfig[];
  /** Whether the guide is currently active */
  isActive: boolean;
  /** Current step index (0-based) */
  currentStep: number;
  /** Callback for next button */
  onNext: () => void;
  /** Callback for previous button */
  onPrevious: () => void;
  /** Callback for skip button */
  onSkip: () => void;
  /** Callback for complete button */
  onComplete: () => void;
}

interface SpotlightPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function OnboardingGuide({
  steps,
  isActive,
  currentStep,
  onNext,
  onPrevious,
  onSkip,
  onComplete,
}: OnboardingGuideProps) {
  const [spotlight, setSpotlight] = useState<SpotlightPosition | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const currentStepConfig = steps[currentStep];

  // Update spotlight position based on element's current position
  const updateSpotlight = useCallback(() => {
    if (!currentStepConfig) return;

    const element = document.querySelector(
      currentStepConfig.targetSelector
    ) as HTMLElement;

    if (element) {
      const rect = element.getBoundingClientRect();
      const padding = 8;
      setSpotlight({
        x: rect.left - padding,
        y: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    }
  }, [currentStepConfig]);

  // Scroll to element and update spotlight when step changes
  useEffect(() => {
    if (!isActive || !currentStepConfig) return;

    const element = document.querySelector(
      currentStepConfig.targetSelector
    ) as HTMLElement;

    if (element) {
      setIsScrolling(true);

      // Calculate where to scroll so element is visible with room for popover
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const popoverHeight = 300; // Approximate height of popover
      const padding = 32;

      // Target: element at top third of screen, leaving room for popover below
      const targetScrollTop =
        window.scrollY + rect.top - padding;

      // If element is taller than viewport, just scroll to top of element
      const elementFitsWithPopover = rect.height + popoverHeight < viewportHeight - padding * 2;

      if (elementFitsWithPopover) {
        // Scroll so element is in upper portion with room for popover
        window.scrollTo({
          top: Math.max(0, targetScrollTop - viewportHeight * 0.2),
          behavior: 'smooth',
        });
      } else {
        // Large element - scroll to show top portion
        window.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      }

      // Update spotlight after scroll completes
      const scrollTimer = setTimeout(() => {
        setIsScrolling(false);
        updateSpotlight();
      }, 400);

      return () => clearTimeout(scrollTimer);
    }
  }, [isActive, currentStep, currentStepConfig, updateSpotlight]);

  // Keep spotlight updated on scroll/resize
  useEffect(() => {
    if (!isActive) {
      setSpotlight(null);
      return;
    }

    const handleUpdate = () => {
      requestAnimationFrame(updateSpotlight);
    };

    // Initial update
    const timer = setTimeout(updateSpotlight, 100);

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isActive, updateSpotlight]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onSkip();
          break;
        case 'ArrowRight':
        case 'Enter':
          if (currentStep === steps.length - 1) {
            onComplete();
          } else {
            onNext();
          }
          break;
        case 'ArrowLeft':
          if (currentStep > 0) {
            onPrevious();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStep, steps.length, onNext, onPrevious, onSkip, onComplete]);

  if (!isActive || !currentStepConfig) {
    return null;
  }

  // Determine side based on screen size - always use bottom/top on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const effectiveSide = isMobile ? 'bottom' : currentStepConfig.side;

  const overlayContent = (
    <>
      {/* Spotlight overlay with cutout */}
      <div
        className={clsx(
          'fixed inset-0 z-onboarding-overlay',
          'transition-opacity duration-300 motion-reduce:duration-0',
          isActive && !isScrolling && spotlight ? 'opacity-100' : 'opacity-0',
          'pointer-events-auto'
        )}
        onClick={onSkip}
        aria-hidden="true"
      >
        {/* SVG mask for spotlight cutout */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlight && (
                <rect
                  x={spotlight.x}
                  y={spotlight.y}
                  width={spotlight.width}
                  height={spotlight.height}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.6)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Spotlight border/highlight - hidden during step transitions */}
        {spotlight && !isScrolling && (
          <div
            className="absolute rounded-lg border-2 border-pkt-brand-blue-1000 shadow-[0_0_0_4px_rgba(111,233,255,0.25),0_0_20px_rgba(111,233,255,0.15)] pointer-events-none animate-in fade-in-0 duration-200 motion-reduce:animate-none"
            style={{
              left: spotlight.x,
              top: spotlight.y,
              width: spotlight.width,
              height: spotlight.height,
            }}
          />
        )}
      </div>

      {/* Popover for current step - only show when not scrolling */}
      {!isScrolling && (
        <OnboardingStep
          title={currentStepConfig.title}
          description={currentStepConfig.description}
          targetSelector={currentStepConfig.targetSelector}
          side={effectiveSide}
          stepNumber={currentStep + 1}
          totalSteps={steps.length}
          isActive={isActive}
          onNext={onNext}
          onPrevious={onPrevious}
          onSkip={onSkip}
          onComplete={onComplete}
        />
      )}
    </>
  );

  return createPortal(overlayContent, document.body);
}
