/**
 * useOnboarding Hook
 *
 * Manages the state for the onboarding guide, including:
 * - Current step tracking
 * - localStorage persistence for "don't show again"
 * - Navigation between steps
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'koe-onboarding-completed';
const DISMISSED_KEY = 'koe-onboarding-dismissed';

export interface OnboardingState {
  /** Whether the onboarding guide is currently active */
  isActive: boolean;
  /** Current step index (0-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Whether the user has completed or dismissed the guide before */
  hasCompletedBefore: boolean;
}

export interface OnboardingActions {
  /** Start the onboarding guide */
  start: () => void;
  /** Move to the next step */
  next: () => void;
  /** Move to the previous step */
  previous: () => void;
  /** Skip/close the guide - won't auto-start again */
  skip: () => void;
  /** Complete the guide and optionally save preference */
  complete: (dontShowAgain?: boolean) => void;
  /** Go to a specific step */
  goToStep: (step: number) => void;
  /** Reset the completed/dismissed state (for testing) */
  reset: () => void;
}

export interface UseOnboardingReturn extends OnboardingState, OnboardingActions {}

export function useOnboarding(totalSteps: number): UseOnboardingReturn {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedBefore, setHasCompletedBefore] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    // Treat both completed and dismissed as "don't auto-start"
    setHasCompletedBefore(completed === 'true' || dismissed === 'true');
  }, []);

  const start = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const next = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const previous = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // Skip/close - mark as dismissed so it won't auto-start again
  const skip = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem(DISMISSED_KEY, 'true');
    setHasCompletedBefore(true);
  }, []);

  const complete = useCallback((dontShowAgain = true) => {
    setIsActive(false);
    setCurrentStep(0);
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setHasCompletedBefore(true);
    }
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < totalSteps) {
        setCurrentStep(step);
      }
    },
    [totalSteps]
  );

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DISMISSED_KEY);
    setHasCompletedBefore(false);
    setIsActive(false);
    setCurrentStep(0);
  }, []);

  return {
    // State
    isActive,
    currentStep,
    totalSteps,
    hasCompletedBefore,
    // Actions
    start,
    next,
    previous,
    skip,
    complete,
    goToStep,
    reset,
  };
}
