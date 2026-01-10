/**
 * Analytics Helper Components
 *
 * Shared components and utilities for analytics visualizations.
 */

import { Card } from '../primitives';

// ============================================================
// KPI Card
// ============================================================

interface KPICardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'yellow' | 'red';
}

export function KPICard({ label, value, subtext, color = 'blue' }: KPICardProps) {
  const colorClasses = {
    blue: 'border-l-oslo-blue',
    green: 'border-l-badge-success-bg',
    yellow: 'border-l-badge-warning-bg',
    red: 'border-l-badge-error-bg',
  };

  return (
    <Card variant="default" padding="md" className={`border-l-4 ${colorClasses[color]}`}>
      <div className="text-sm text-pkt-text-body-subtle mb-1">{label}</div>
      <div className="text-2xl font-bold text-pkt-text-body-dark">{value}</div>
      {subtext && <div className="text-xs text-pkt-text-body-subtle mt-1">{subtext}</div>}
    </Card>
  );
}

// ============================================================
// Progress Bar
// ============================================================

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, max = 100, color = 'bg-oslo-blue', showLabel = true }: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-pkt-grays-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && <span className="text-sm text-pkt-text-body-subtle w-12 text-right">{value.toFixed(1)}%</span>}
    </div>
  );
}

// ============================================================
// Simple Bar Chart
// ============================================================

interface SimpleBarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  maxValue?: number;
}

export function SimpleBarChart({ data, maxValue }: SimpleBarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 text-sm text-pkt-text-body-subtle truncate">{item.label}</div>
          <div className="flex-1 bg-pkt-grays-gray-200 rounded h-6">
            <div
              className={`h-6 rounded ${item.color || 'bg-oslo-blue'} flex items-center justify-end pr-2`}
              style={{ width: `${(item.value / max) * 100}%`, minWidth: item.value > 0 ? '2rem' : '0' }}
            >
              {item.value > 0 && <span className="text-xs text-white font-medium">{item.value}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Utilities
// ============================================================

export function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return value.toFixed(0);
}

// ============================================================
// Analytics Section Wrapper
// ============================================================

interface AnalyticsSectionProps {
  title: string;
  description: string;
  icon?: string;
  children: React.ReactNode;
}

export function AnalyticsSection({ title, description, icon, children }: AnalyticsSectionProps) {
  return (
    <div className="space-y-6">
      <div className="border-b border-pkt-border-subtle pb-4">
        <h2 className="text-heading-md font-semibold text-pkt-text-body-dark flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title}
        </h2>
        <p className="mt-1 text-body-sm text-pkt-text-body-subtle">{description}</p>
      </div>
      {children}
    </div>
  );
}
