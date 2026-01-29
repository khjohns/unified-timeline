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
  /** Preferred side for the popover */
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

  const currentStepConfig = steps[currentStep];

  // Update spotlight position
  const updateSpotlight = useCallback(() => {
    if (!currentStepConfig) return;

    const element = document.querySelector(
      currentStepConfig.targetSelector
    ) as HTMLElement;

    if (element) {
      const rect = element.getBoundingClientRect();
      // Add padding around the element
      const padding = 8;
      setSpotlight({
        x: rect.left - padding,
        y: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    }
  }, [currentStepConfig]);

  // Update spotlight when step changes or on scroll/resize
  useEffect(() => {
    if (!isActive) {
      setSpotlight(null);
      return;
    }

    // Initial update with delay to ensure DOM is ready
    const timer = setTimeout(updateSpotlight, 150);

    // Update on scroll and resize
    const handleUpdate = () => {
      requestAnimationFrame(updateSpotlight);
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isActive, currentStep, updateSpotlight]);

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

  // Prevent body scroll when active
  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isActive]);

  if (!isActive || !currentStepConfig) {
    return null;
  }

  const overlayContent = (
    <>
      {/* Spotlight overlay with cutout */}
      <div
        className={clsx(
          'fixed inset-0 z-onboarding-overlay',
          'transition-opacity duration-300',
          isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onSkip}
        aria-hidden="true"
      >
        {/* SVG mask for spotlight cutout */}
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              {/* White = visible, black = hidden */}
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
          {/* Dark overlay with spotlight cutout */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.6)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Spotlight border/highlight */}
        {spotlight && (
          <div
            className="absolute rounded-lg border-2 border-pkt-brand-blue-1000 shadow-[0_0_0_4px_rgba(111,233,255,0.3)] pointer-events-none transition-all duration-300"
            style={{
              left: spotlight.x,
              top: spotlight.y,
              width: spotlight.width,
              height: spotlight.height,
            }}
          />
        )}
      </div>

      {/* Popover for current step */}
      <OnboardingStep
        title={currentStepConfig.title}
        description={currentStepConfig.description}
        targetSelector={currentStepConfig.targetSelector}
        side={currentStepConfig.side}
        stepNumber={currentStep + 1}
        totalSteps={steps.length}
        isActive={isActive}
        onNext={onNext}
        onPrevious={onPrevious}
        onSkip={onSkip}
        onComplete={onComplete}
      />
    </>
  );

  // Render in portal to ensure proper z-index stacking
  return createPortal(overlayContent, document.body);
}
