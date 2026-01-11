/**
 * Alert Component
 *
 * Inline alert for displaying important messages, warnings, and notifications.
 * Different from AlertDialog which is a modal.
 */

import { ReactNode } from 'react';
import clsx from 'clsx';
import {
  InfoCircledIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon,
} from '@radix-ui/react-icons';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';
export type AlertSize = 'sm' | 'md' | 'lg';

export interface AlertProps {
  children?: ReactNode;
  variant?: AlertVariant;
  size?: AlertSize;
  title?: ReactNode;
  className?: string;
  icon?: ReactNode;
  /** Optional action (button/link) displayed on the right side */
  action?: ReactNode;
  /** Optional footer with responsive layout (stacks vertically on mobile, horizontal on desktop) */
  footer?: ReactNode;
}

// Using semantic alert colors for consistent dark/light mode support
const variantStyles: Record<AlertVariant, { container: string; title: string; icon: string }> = {
  info: {
    container: 'bg-alert-info-bg border-alert-info-border text-alert-info-text',
    title: 'text-alert-info-text',
    icon: 'text-alert-info-border',
  },
  success: {
    container: 'bg-alert-success-bg border-alert-success-border text-alert-success-text',
    title: 'text-alert-success-text',
    icon: 'text-alert-success-border',
  },
  warning: {
    container: 'bg-alert-warning-bg border-alert-warning-border text-alert-warning-text',
    title: 'text-alert-warning-text',
    icon: 'text-alert-warning-border',
  },
  danger: {
    container: 'bg-alert-danger-bg border-alert-danger-border text-alert-danger-text',
    title: 'text-alert-danger-text',
    icon: 'text-alert-danger-border',
  },
};

const sizeStyles: Record<AlertSize, string> = {
  sm: 'p-2 text-sm',
  md: 'p-3 text-base',
  lg: 'p-4 text-base',
};

// Default icons for each variant using Radix UI icons
const defaultIcons: Record<AlertVariant, ReactNode> = {
  info: <InfoCircledIcon className="w-5 h-5" />,
  success: <CheckCircledIcon className="w-5 h-5" />,
  warning: <ExclamationTriangleIcon className="w-5 h-5" />,
  danger: <CrossCircledIcon className="w-5 h-5" />,
};

export function Alert({
  children,
  variant = 'info',
  size = 'md',
  title,
  className,
  icon,
  action,
  footer,
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
      <div className={clsx('flex gap-3', action && 'flex-col sm:flex-row sm:items-center sm:justify-between')}>
        <div className="flex gap-3 flex-1">
          {displayIcon && (
            <div className={clsx('flex-shrink-0', styles.icon)}>
              {displayIcon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <p className={clsx('font-bold mb-1', styles.title)}>{title}</p>
            )}
            {children && <div className="text-sm">{children}</div>}
            {footer && (
              <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm">
                {footer}
              </div>
            )}
          </div>
        </div>
        {action && (
          <div className="flex-shrink-0 ml-8 sm:ml-0">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
