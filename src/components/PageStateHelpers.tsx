/**
 * PageStateHelpers
 *
 * Reusable components for common page states:
 * - LoadingState: Full-page loading spinner
 * - ErrorState: Full-page error with retry button
 * - VerifyingState: Auth verification in progress
 * - AuthErrorState: Auth error (invalid/expired token)
 *
 * These replace the duplicated loading/error patterns across pages.
 */

import { ReactNode } from 'react';
import { ReloadIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Button } from './primitives';

interface LoadingStateProps {
  /** Message to display below the spinner */
  message?: string;
  /** Whether to use full viewport height (default: true) */
  fullHeight?: boolean;
}

/**
 * Full-page loading state with spinner
 */
export function LoadingState({
  message = 'Laster...',
  fullHeight = true,
}: LoadingStateProps) {
  return (
    <div
      className={`${
        fullHeight ? 'min-h-screen' : 'min-h-[200px]'
      } bg-pkt-bg-subtle flex items-center justify-center px-4`}
    >
      <div className="text-center">
        <ReloadIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-pkt-grays-gray-400 animate-spin" />
        <p className="text-sm sm:text-base text-pkt-grays-gray-500">{message}</p>
      </div>
    </div>
  );
}

interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message or Error object */
  error: string | Error;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Whether to use full viewport height (default: true) */
  fullHeight?: boolean;
}

/**
 * Full-page error state with optional retry button
 */
export function ErrorState({
  title = 'Feil ved lasting',
  error,
  onRetry,
  fullHeight = true,
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div
      className={`${
        fullHeight ? 'min-h-screen' : 'min-h-[200px]'
      } bg-pkt-bg-subtle flex items-center justify-center px-4`}
    >
      <div
        className="max-w-md w-full p-4 sm:p-8 bg-pkt-bg-card rounded-lg border border-pkt-grays-gray-200"
        role="alert"
      >
        <ExclamationTriangleIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-pkt-brand-red-1000" />
        <h2 className="text-lg sm:text-xl font-semibold text-pkt-brand-red-1000 mb-3 sm:mb-4 text-center">
          {title}
        </h2>
        <p className="text-sm sm:text-base text-pkt-text-body-default mb-4 text-center">
          {errorMessage}
        </p>
        {onRetry && (
          <div className="text-center">
            <Button variant="primary" onClick={onRetry}>
              Prøv igjen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Auth verification in progress state
 */
export function VerifyingState() {
  return (
    <LoadingState message="Verifiserer tilgang..." />
  );
}

interface AuthErrorStateProps {
  /** Custom error message (optional) */
  error?: string | null;
}

/**
 * Auth error state (invalid or expired token)
 */
export function AuthErrorState({ error }: AuthErrorStateProps) {
  return (
    <div className="min-h-screen bg-pkt-bg-subtle flex items-center justify-center px-4">
      <div
        className="max-w-md w-full p-4 sm:p-8 bg-pkt-bg-card rounded-lg border border-pkt-grays-gray-200"
        role="alert"
      >
        <ExclamationTriangleIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-pkt-brand-red-1000" />
        <h2 className="text-lg sm:text-xl font-semibold text-pkt-brand-red-1000 mb-3 sm:mb-4 text-center">
          Tilgang nektet
        </h2>
        <p className="text-sm sm:text-base text-pkt-text-body-default mb-4 text-center">
          {error || 'Ugyldig eller utløpt lenke. Vennligst bruk lenken du mottok på nytt.'}
        </p>
      </div>
    </div>
  );
}

interface InlineLoadingProps {
  /** Message to display */
  message?: string;
}

/**
 * Inline loading state (for sections within a page)
 */
export function InlineLoading({ message = 'Laster...' }: InlineLoadingProps) {
  return (
    <div className="py-4 text-center text-pkt-grays-gray-500">
      <ReloadIcon className="w-6 h-6 animate-spin mx-auto mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

interface InlineErrorProps {
  /** Error message */
  message: string;
}

/**
 * Inline error state (for sections within a page)
 */
export function InlineError({ message }: InlineErrorProps) {
  return (
    <div className="py-4 text-center text-badge-error-text bg-badge-error-bg rounded-lg">
      <p className="text-sm">{message}</p>
    </div>
  );
}

interface EmptyStateProps {
  /** Message to display */
  message: string;
  /** Optional action button */
  action?: ReactNode;
}

/**
 * Empty state for when there's no data to display
 */
export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <p className="text-pkt-grays-gray-600 mb-4">{message}</p>
      {action}
    </div>
  );
}
