/**
 * EconomicsChartTile - Layered area chart showing contract economics over time.
 *
 * Uses a layered (non-stacked) area chart with three overlapping areas:
 * - Front (gray): kontraktssum baseline
 * - Middle (green): kontraktssum + godkjent — peeks above gray
 * - Back (yellow): kontraktssum + krevd — peeks above green
 *
 * Below chart: compact KPIs (kontraktssum, krevd, godkjent, godkjenningsgrad)
 */

import { useId, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BentoCard, BentoCtaCard } from './BentoCard';
import type { CaseListItem } from '../../types/api';
import type { ContractSettings } from '../../types/project';
import { formatCurrencyCompact } from '../../utils/formatters';

interface ChartDataPoint {
  date: string;
  label: string;
  kontrakt: number;
  justert_godkjent: number;
  justert_krevd: number;
  // Raw values for tooltip
  _krevd: number;
  _godkjent: number;
}

function buildTimeSeries(cases: CaseListItem[], kontraktssum: number): ChartDataPoint[] {
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
      kontrakt: kontraktssum,
      justert_godkjent: kontraktssum + cumulativeGodkjent,
      justert_krevd: kontraktssum + cumulativeKrevd,
      _krevd: cumulativeKrevd,
      _godkjent: cumulativeGodkjent,
    });
  }

  return points;
}

// Custom tooltip showing meaningful values
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { payload: ChartDataPoint }[];
  label?: string;
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;

  return (
    <div className="bg-pkt-bg-card border border-pkt-border-subtle rounded-lg px-3 py-2 shadow-lg text-[11px]">
      <p className="font-medium text-pkt-text-body-dark mb-1">{label}</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-4">
          <span className="text-pkt-text-body-subtle">Kontrakt</span>
          <span className="font-mono text-pkt-text-body-default">{formatCurrencyCompact(d.kontrakt)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-pkt-brand-yellow-1000">Krevd</span>
          <span className="font-mono text-pkt-brand-yellow-1000">+{formatCurrencyCompact(d._krevd)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-emerald-600">Godkjent</span>
          <span className="font-mono text-emerald-600">+{formatCurrencyCompact(d._godkjent)}</span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-pkt-border-subtle">
          <span className="text-pkt-text-body-subtle">Justert sum</span>
          <span className="font-mono font-semibold text-pkt-text-body-dark">
            {formatCurrencyCompact(d.justert_krevd)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface EconomicsChartTileProps {
  cases: CaseListItem[];
  contract: ContractSettings | null;
  totalKrevd: number;
  totalGodkjent: number;
}

export function EconomicsChartTile({ cases, contract, totalKrevd, totalGodkjent }: EconomicsChartTileProps) {
  const id = useId();
  const kontraktGradId = `kontraktGrad-${id}`;
  const godkjentGradId = `godkjentGrad-${id}`;
  const krevdGradId = `krevdGrad-${id}`;

  const kontraktssum = contract?.kontraktssum ?? 0;
  const data = useMemo(() => buildTimeSeries(cases, kontraktssum), [cases, kontraktssum]);
  const hasChart = data.length >= 2;

  // Zoom Y-axis to make krevd/godkjent visible above kontraktssum baseline
  const yDomain = useMemo<[number, number | 'auto']>(() => {
    if (!hasChart || kontraktssum === 0) return [0, 'auto'];
    const maxDelta = Math.max(totalKrevd, totalGodkjent, kontraktssum * 0.01);
    const yMin = Math.max(0, kontraktssum - maxDelta * 0.5);
    return [yMin, 'auto'];
  }, [hasChart, kontraktssum, totalKrevd, totalGodkjent]);

  // Godkjenningsgrad
  const godkjenningsgrad = totalKrevd > 0
    ? Math.round((totalGodkjent / totalKrevd) * 100)
    : null;

  // Progress percentages (against kontraktssum)
  const krevdPct = kontraktssum > 0
    ? Math.min(Math.round((totalKrevd / kontraktssum) * 100), 200)
    : 0;
  const godkjentPct = kontraktssum > 0
    ? Math.min(Math.round((totalGodkjent / kontraktssum) * 100), 200)
    : 0;

  if (!contract) {
    return (
      <BentoCtaCard
        title="Kontraktsøkonomi"
        description="Legg til kontraktssum for å se økonomi og vederlag over tid"
        colSpan="col-span-12 lg:col-span-5"
        delay={300}
      />
    );
  }

  return (
    <BentoCard colSpan="col-span-12 lg:col-span-5" delay={300}>
      <div className="p-4">
        <p className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-2">
          Kontraktsøkonomi
        </p>

        {/* Layered area chart: later areas paint on top, hiding layers behind */}
        {hasChart ? (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={krevdGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8A317" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#E8A317" stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id={godkjentGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.06} />
                </linearGradient>
                <linearGradient id={kontraktGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-pkt-grays-gray-400, #9ca3af)" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="var(--color-pkt-grays-gray-400, #9ca3af)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-pkt-border-subtle, #e5e7eb)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: 'var(--color-pkt-text-body-subtle, #6b7280)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => formatCurrencyCompact(v)}
                tick={{ fontSize: 9, fill: 'var(--color-pkt-text-body-subtle, #6b7280)' }}
                tickLine={false}
                axisLine={false}
                width={50}
                domain={yDomain}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Layer 1 (back): krevd — yellow, highest values */}
              <Area
                type="monotone"
                dataKey="justert_krevd"
                stroke="#E8A317"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${krevdGradId})`}
              />
              {/* Layer 2 (middle): godkjent — green, covers yellow below */}
              <Area
                type="monotone"
                dataKey="justert_godkjent"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${godkjentGradId})`}
              />
              {/* Layer 3 (front): kontraktssum — gray base, covers green/yellow below */}
              <Area
                type="monotone"
                dataKey="kontrakt"
                stroke="var(--color-pkt-grays-gray-400, #9ca3af)"
                strokeWidth={1}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill={`url(#${kontraktGradId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-24 text-xs text-pkt-text-body-subtle">
            Trenger minst 2 saker for graf
          </div>
        )}

        {/* Compact economics below chart */}
        <div className="mt-3 pt-3 border-t border-pkt-border-subtle">
          {/* KPI row */}
          <div className="flex items-baseline gap-4 mb-2.5">
            <div>
              <span className="text-[10px] text-pkt-text-body-subtle uppercase">Kontrakt</span>
              <p className="text-sm font-semibold font-mono text-pkt-text-body-dark">
                {formatCurrencyCompact(kontraktssum)}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-pkt-text-body-subtle uppercase">Krevd</span>
              <p className="text-sm font-semibold font-mono text-pkt-brand-yellow-1000">
                {formatCurrencyCompact(totalKrevd)}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-pkt-text-body-subtle uppercase">Godkjent</span>
              <p className="text-sm font-semibold font-mono text-emerald-600">
                {formatCurrencyCompact(totalGodkjent)}
              </p>
            </div>
            {godkjenningsgrad !== null && (
              <div className="ml-auto text-right">
                <span className="text-[10px] text-pkt-text-body-subtle uppercase">Godkj.grad</span>
                <p className={`text-sm font-bold font-mono tabular-nums ${
                  godkjenningsgrad >= 70 ? 'text-emerald-600' :
                  godkjenningsgrad >= 40 ? 'text-pkt-brand-yellow-1000' :
                  'text-red-600'
                }`}>
                  {godkjenningsgrad}%
                </p>
              </div>
            )}
          </div>

          {/* Thin progress bars */}
          {kontraktssum > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-pkt-text-body-subtle w-12">Krevd</span>
                <div className="flex-1 h-1.5 bg-pkt-grays-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pkt-brand-yellow-1000 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(krevdPct, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-pkt-text-body-subtle tabular-nums w-8 text-right">{krevdPct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-pkt-text-body-subtle w-12">Godkjent</span>
                <div className="flex-1 h-1.5 bg-pkt-grays-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(godkjentPct, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-pkt-text-body-subtle tabular-nums w-8 text-right">{godkjentPct}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </BentoCard>
  );
}
