/**
 * Toast Component
 *
 * A non-blocking notification component that appears temporarily to provide
 * feedback on user actions. Uses Radix UI Toast primitive with Punkt styling.
 *
 * Features:
 * - Auto-dismisses after configurable duration
 * - Supports success, error, warning, and info variants
 * - Animated entrance/exit
 * - Accessible with proper ARIA attributes
 */

import * as ToastPrimitive from '@radix-ui/react-toast';
import { clsx } from 'clsx';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Toast variant types
type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (options: Omit<ToastData, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Hook to access toast functions
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Icon components for each variant
function SuccessIcon() {
  return (
    <svg
      className="w-5 h-5 text-pkt-brand-green-700"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      className="w-5 h-5 text-pkt-brand-red-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      className="w-5 h-5 text-pkt-brand-warm-yellow-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      className="w-5 h-5 text-pkt-brand-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function getIcon(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return <SuccessIcon />;
    case 'error':
      return <ErrorIcon />;
    case 'warning':
      return <WarningIcon />;
    case 'info':
      return <InfoIcon />;
  }
}

interface ToastItemProps {
  toast: ToastData;
  onOpenChange: (open: boolean) => void;
}

function ToastItem({ toast, onOpenChange }: ToastItemProps) {
  return (
    <ToastPrimitive.Root
      className={clsx(
        // Base styles
        'rounded-none border-2 p-4 shadow-lg',
        'grid grid-cols-[auto_1fr_auto] gap-3 items-start',
        // Animation
        'data-[state=open]:animate-slideIn',
        'data-[state=closed]:animate-slideOut',
        'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
        'data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform',
        'data-[swipe=end]:animate-swipeOut',
        // Variant styles
        {
          'bg-pkt-surface-light-green border-pkt-brand-green-700': toast.variant === 'success',
          'bg-pkt-surface-light-red border-pkt-brand-red-600': toast.variant === 'error',
          'bg-pkt-surface-light-yellow border-pkt-brand-warm-yellow-600': toast.variant === 'warning',
          'bg-pkt-surface-light-blue border-pkt-brand-blue-600': toast.variant === 'info',
        }
      )}
      duration={toast.duration ?? 4000}
      onOpenChange={onOpenChange}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">{getIcon(toast.variant)}</div>

      {/* Content */}
      <div className="flex flex-col gap-1">
        <ToastPrimitive.Title className="font-semibold text-pkt-text-body-dark">
          {toast.title}
        </ToastPrimitive.Title>
        {toast.description && (
          <ToastPrimitive.Description className="text-sm text-pkt-text-body-subtle">
            {toast.description}
          </ToastPrimitive.Description>
        )}
      </div>

      {/* Close button */}
      <ToastPrimitive.Close
        className={clsx(
          'flex-shrink-0 p-1 rounded-none',
          'text-pkt-text-body-subtle hover:text-pkt-text-body-dark',
          'focus:outline-none focus:ring-2 focus:ring-pkt-border-focus'
        )}
        aria-label="Lukk"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Toast Provider Component
 *
 * Wraps the application to provide toast functionality via useToast hook.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((options: Omit<ToastData, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...options, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: Omit<ToastData, 'id'>) => {
      addToast(options);
    },
    [addToast]
  );

  const success = useCallback(
    (title: string, description?: string) => {
      addToast({ title, description, variant: 'success' });
    },
    [addToast]
  );

  const error = useCallback(
    (title: string, description?: string) => {
      addToast({ title, description, variant: 'error' });
    },
    [addToast]
  );

  const warning = useCallback(
    (title: string, description?: string) => {
      addToast({ title, description, variant: 'warning' });
    },
    [addToast]
  );

  const info = useCallback(
    (title: string, description?: string) => {
      addToast({ title, description, variant: 'info' });
    },
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}

        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onOpenChange={(open) => !open && removeToast(t.id)} />
        ))}

        <ToastPrimitive.Viewport
          className={clsx(
            'fixed bottom-0 right-0 z-[100] flex flex-col gap-2 p-4',
            'w-full max-w-sm',
            'outline-none'
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
