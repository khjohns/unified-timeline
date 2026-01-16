/**
 * HighlightCard Component
 *
 * A visually distinct card for highlighting important information.
 * Used for summaries, alerts, and key data displays.
 *
 * Variants:
 * - 'info': Blue left border (default) - for neutral highlights
 * - 'danger': Red background with bottom border - for warnings/alerts
 * - 'success': Green left border - for positive highlights
 * - 'warning': Yellow left border - for caution
 */

import { ReactNode } from 'react';

type HighlightCardVariant = 'info' | 'danger' | 'success' | 'warning';

interface HighlightCardProps {
  children: ReactNode;
  variant?: HighlightCardVariant;
  className?: string;
}

const variantStyles: Record<HighlightCardVariant, string> = {
  // Light: alert colors (light bg, dark border) | Dark: pkt-surface-strong + pkt-brand (dark bg, light border)
  info: 'bg-alert-info-bg dark:bg-pkt-bg-subtle border-l-4 border-alert-info-border dark:border-pkt-brand-dark-blue-1000',
  success: 'bg-alert-success-bg dark:bg-pkt-surface-strong-dark-green border-l-4 border-alert-success-border dark:border-pkt-brand-dark-green-1000',
  warning: 'bg-alert-warning-bg dark:bg-pkt-surface-strong-yellow border-l-4 border-alert-warning-border dark:border-pkt-brand-yellow-1000',
  danger: 'bg-alert-danger-bg dark:bg-pkt-surface-strong-red border-l-4 border-alert-danger-border dark:border-pkt-brand-red-1000',
};

export function HighlightCard({
  children,
  variant = 'info',
  className = '',
}: HighlightCardProps) {
  return (
    <div className={`p-3 ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
}
