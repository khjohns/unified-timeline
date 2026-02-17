/**
 * VederlagTimeSeriesChart - Recharts AreaChart showing cumulative claimed vs approved over time.
 * Computed client-side from case list data.
 */

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { BentoCard } from './BentoCard';
import type { CaseListItem } from '../../types/api';
import { formatCurrencyCompact } from '../../utils/formatters';

interface ChartDataPoint {
  date: string;
  label: string;
  krevd: number;
  godkjent: number;
}

function buildTimeSeries(cases: CaseListItem[]): ChartDataPoint[] {
  // Sort cases by created_at
  const sorted = [...cases]
    .filter(c => c.created_at)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));

  if (sorted.length === 0) return [];

  let cumulativeKrevd = 0;
  let cumulativeGodkjent = 0;
  const points: ChartDataPoint[] = [];

  for (const c of sorted) {
    cumulativeKrevd += c.cached_sum_krevd ?? 0;
    cumulativeGodkjent += c.cached_sum_godkjent ?? 0;

    const date = c.created_at!.split('T')[0]!;
    const label = new Date(date).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
    });

    points.push({
      date,
      label,
      krevd: cumulativeKrevd,
      godkjent: cumulativeGodkjent,
    });
  }

  return points;
}

interface VederlagTimeSeriesChartProps {
  cases: CaseListItem[];
  kontraktssum?: number;
}

export function VederlagTimeSeriesChart({ cases, kontraktssum }: VederlagTimeSeriesChartProps) {
  const data = useMemo(() => buildTimeSeries(cases), [cases]);

  if (data.length < 2) {
    return (
      <BentoCard colSpan="col-span-12 lg:col-span-5" delay={300}>
        <div className="p-5 flex items-center justify-center min-h-[200px]">
          <p className="text-bento-body text-pkt-text-body-subtle">
            Trenger minst 2 saker for å vise tidsserie
          </p>
        </div>
      </BentoCard>
    );
  }

  return (
    <BentoCard colSpan="col-span-12 lg:col-span-5" delay={300}>
      <div className="p-5">
        <p className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-3">
          Vederlag over tid
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="krevdGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E8A317" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#E8A317" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="godkjentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-pkt-border-subtle, #e5e7eb)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--color-pkt-text-body-subtle, #6b7280)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => formatCurrencyCompact(v)}
              tick={{ fontSize: 10, fill: 'var(--color-pkt-text-body-subtle, #6b7280)' }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCurrencyCompact(value as number),
                name === 'krevd' ? 'Krevd' : 'Godkjent',
              ]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid var(--color-pkt-border-subtle, #e5e7eb)',
              }}
            />
            {kontraktssum && kontraktssum > 0 && (
              <ReferenceLine
                y={kontraktssum}
                stroke="var(--color-pkt-grays-gray-400, #9ca3af)"
                strokeDasharray="4 4"
                label={{
                  value: 'Kontraktssum',
                  fontSize: 10,
                  fill: 'var(--color-pkt-text-body-subtle, #6b7280)',
                  position: 'right',
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="krevd"
              stroke="#E8A317"
              fillOpacity={1}
              fill="url(#krevdGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="godkjent"
              stroke="#10B981"
              fillOpacity={1}
              fill="url(#godkjentGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </BentoCard>
  );
}
