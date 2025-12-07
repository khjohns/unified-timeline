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
  children: ReactNode;
  variant?: AlertVariant;
  size?: AlertSize;
  title?: string;
  className?: string;
  icon?: ReactNode;
}

// Using Punkt design system colors for consistency
const variantStyles: Record<AlertVariant, { container: string; title: string; icon: string }> = {
  info: {
    container: 'bg-pkt-brand-blue-100 border-pkt-brand-warm-blue-1000 text-pkt-brand-dark-blue-1000',
    title: 'text-pkt-brand-dark-blue-1000',
    icon: 'text-pkt-brand-warm-blue-1000',
  },
  success: {
    container: 'bg-pkt-brand-light-green-400 border-pkt-brand-dark-green-1000 text-pkt-brand-dark-green-1000',
    title: 'text-pkt-brand-dark-green-1000',
    icon: 'text-pkt-brand-dark-green-1000',
  },
  warning: {
    container: 'bg-pkt-brand-yellow-500 border-pkt-brand-yellow-1000 text-pkt-brand-dark-blue-1000',
    title: 'text-pkt-brand-dark-blue-1000',
    icon: 'text-pkt-brand-dark-blue-1000',
  },
  danger: {
    container: 'bg-pkt-brand-red-100 border-pkt-brand-red-1000 text-pkt-brand-red-1000',
    title: 'text-pkt-brand-red-1000',
    icon: 'text-pkt-brand-red-1000',
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
