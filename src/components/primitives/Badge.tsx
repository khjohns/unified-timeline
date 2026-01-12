/**
 * Badge Component
 *
 * Small status indicator for labels, tags, and status displays.
 * Used for "Subsidiær behandling", "Forsering varslet", etc.
 */

import { ReactNode } from 'react';
import clsx from 'clsx';

export type BadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-pkt-surface-gray text-pkt-text-body-default border-pkt-border-gray',
  info: 'bg-badge-info-bg text-badge-info-text border-badge-info-border',
  success: 'bg-badge-success-bg text-badge-success-text border-badge-success-border',
  warning: 'bg-badge-warning-bg text-badge-warning-text border-badge-warning-border',
  danger: 'bg-badge-danger-bg text-badge-danger-text border-badge-danger-border',
  neutral: 'bg-pkt-grays-gray-100 text-pkt-grays-gray-700 border-pkt-grays-gray-300',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium',
        'border rounded-sm',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
