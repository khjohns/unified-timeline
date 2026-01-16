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
  info: 'bg-highlight-info-bg border-l-4 border-highlight-info-border',
  success: 'bg-highlight-success-bg border-l-4 border-highlight-success-border',
  warning: 'bg-highlight-warning-bg border-l-4 border-highlight-warning-border',
  danger: 'bg-highlight-danger-bg border-l-4 border-highlight-danger-border',
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
