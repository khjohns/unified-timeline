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
  default: 'bg-pkt-surface-gray text-pkt-text-default border-pkt-border-gray',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
  success: 'bg-green-50 text-green-800 border-green-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
  neutral: 'bg-gray-100 text-gray-700 border-gray-300',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium',
        'border rounded-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
