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
  info: 'bg-pkt-bg-subtle border-l-4 border-pkt-brand-dark-blue-1000',
  danger: 'bg-pkt-surface-faded-red border-b border-pkt-brand-red-1000',
  success: 'bg-pkt-surface-faded-green border-l-4 border-pkt-brand-green-1000',
  warning: 'bg-pkt-surface-yellow border-l-4 border-pkt-brand-yellow-1000',
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
