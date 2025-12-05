/**
 * Alert Component
 *
 * Inline alert for displaying important messages, warnings, and notifications.
 * Different from AlertDialog which is a modal.
 */

import { ReactNode } from 'react';
import clsx from 'clsx';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';
export type AlertSize = 'sm' | 'md' | 'lg';

export interface AlertProps {
  children: ReactNode;
  variant?: AlertVariant;
  size?: AlertSize;
  title?: string;
  className?: string;
  icon?: ReactNode;
}

const variantStyles: Record<AlertVariant, { container: string; title: string; icon: string }> = {
  info: {
    container: 'bg-blue-50 border-blue-500 text-blue-800',
    title: 'text-blue-900',
    icon: 'text-blue-500',
  },
  success: {
    container: 'bg-green-50 border-green-500 text-green-800',
    title: 'text-green-900',
    icon: 'text-green-500',
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-500 text-yellow-800',
    title: 'text-yellow-900',
    icon: 'text-yellow-600',
  },
  danger: {
    container: 'bg-red-50 border-red-500 text-red-800',
    title: 'text-red-900',
    icon: 'text-red-500',
  },
};

const sizeStyles: Record<AlertSize, string> = {
  sm: 'p-2 text-sm',
  md: 'p-3 text-base',
  lg: 'p-4 text-base',
};

// Default icons for each variant
const defaultIcons: Record<AlertVariant, ReactNode> = {
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  danger: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export function Alert({
  children,
  variant = 'info',
  size = 'md',
  title,
  className,
  icon,
}: AlertProps) {
  const styles = variantStyles[variant];
  const displayIcon = icon ?? defaultIcons[variant];

  return (
    <div
      role="alert"
      className={clsx(
        'border-l-4 rounded-none',
        styles.container,
        sizeStyles[size],
        className
      )}
    >
      <div className="flex gap-3">
        {displayIcon && (
          <div className={clsx('flex-shrink-0', styles.icon)}>
            {displayIcon}
          </div>
        )}
        <div className="flex-1">
          {title && (
            <p className={clsx('font-bold mb-1', styles.title)}>{title}</p>
          )}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
