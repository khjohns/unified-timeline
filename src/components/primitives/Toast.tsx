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
 * - Uses same semantic colors as Alert component for dark/light mode support
 */

import * as ToastPrimitive from '@radix-ui/react-toast';
import { clsx } from 'clsx';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  InfoCircledIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon,
} from '@radix-ui/react-icons';

// Toast variant types - matches Alert variants
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

// Using same semantic alert colors as Alert component for dark/light mode support
// Icons use text color for good contrast against the light background
// Dark mode: border uses text color (visible against alert bg) + shadow for edge definition
const variantStyles: Record<ToastVariant, { container: string; icon: string }> = {
  info: {
    container: 'bg-alert-info-bg border-alert-info-border text-alert-info-text dark:border dark:border-alert-info-text dark:shadow-md',
    icon: 'text-alert-info-text',
  },
  success: {
    container: 'bg-alert-success-bg border-alert-success-border text-alert-success-text dark:border dark:border-alert-success-text dark:shadow-md',
    icon: 'text-alert-success-text',
  },
  warning: {
    container: 'bg-alert-warning-bg border-alert-warning-border text-alert-warning-text dark:border dark:border-alert-warning-text dark:shadow-md',
    icon: 'text-alert-warning-text',
  },
  error: {
    container: 'bg-alert-danger-bg border-alert-danger-border text-alert-danger-text dark:border dark:border-alert-danger-text dark:shadow-md',
    icon: 'text-alert-danger-text',
  },
};

// Default icons for each variant using Radix UI icons (same as Alert)
const variantIcons: Record<ToastVariant, ReactNode> = {
  info: <InfoCircledIcon className="w-5 h-5" />,
  success: <CheckCircledIcon className="w-5 h-5" />,
  warning: <ExclamationTriangleIcon className="w-5 h-5" />,
  error: <CrossCircledIcon className="w-5 h-5" />,
};

interface ToastItemProps {
  toast: ToastData;
  onOpenChange: (open: boolean) => void;
}

function ToastItem({ toast, onOpenChange }: ToastItemProps) {
  const styles = variantStyles[toast.variant];

  return (
    <ToastPrimitive.Root
      className={clsx(
        // Base styles
        'rounded-none border-l-4 p-4 shadow-lg',
        'grid grid-cols-[auto_1fr_auto] gap-3 items-start',
        // Animation
        'data-[state=open]:animate-slideIn',
        'data-[state=closed]:animate-slideOut',
        'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
        'data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform',
        'data-[swipe=end]:animate-swipeOut',
        // Variant styles from semantic colors
        styles.container
      )}
      duration={toast.duration ?? 4000}
      onOpenChange={onOpenChange}
    >
      {/* Icon */}
      <div className={clsx('flex-shrink-0 mt-px', styles.icon)}>
        {variantIcons[toast.variant]}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1">
        <ToastPrimitive.Title className="font-bold">
          {toast.title}
        </ToastPrimitive.Title>
        {toast.description && (
          <ToastPrimitive.Description className="text-sm opacity-90">
            {toast.description}
          </ToastPrimitive.Description>
        )}
      </div>

      {/* Close button */}
      <ToastPrimitive.Close
        className={clsx(
          'flex-shrink-0 p-1 rounded-none opacity-70 hover:opacity-100',
          'focus:outline-none focus:ring-2 focus:ring-pkt-border-focus'
        )}
        aria-label="Lukk"
      >
        <CrossCircledIcon className="w-4 h-4" />
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
