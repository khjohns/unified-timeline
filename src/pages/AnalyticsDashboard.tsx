/**
 * AnalyticsDashboard Page
 *
 * Demonstrates how event-sourced data from Supabase can be aggregated
 * and visualized for project and portfolio analysis - similar to
 * Power BI dashboards against Dataverse.
 *
 * Features:
 * - Summary KPIs (total cases, vederlag, approval rates)
 * - Category breakdown with approval rates
 * - Activity timeline (events over time)
 * - Vederlag analysis (amounts by method)
 * - Response time metrics
 * - Actor activity breakdown
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/primitives';
import { useAuth } from '../context/AuthContext';
import {
  useAnalyticsSummary,
  useCategoryAnalytics,
  useTimelineAnalytics,
  useVederlagAnalytics,
  useResponseTimesAnalytics,
  useActorAnalytics,
} from '../hooks/useAnalytics';
import { getHovedkategoriLabel } from '../constants/categories';
import { getVederlagsmetodeLabel } from '../constants/paymentMethods';

// ============================================================
// Helper Components
// ============================================================

interface KPICardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'yellow' | 'red';
}

function KPICard({ label, value, subtext, color = 'blue' }: KPICardProps) {
  const colorClasses = {
    blue: 'border-l-oslo-blue',
    green: 'border-l-badge-success-bg',
    yellow: 'border-l-badge-warning-bg',
    red: 'border-l-badge-error-bg',
  };

  return (
    <Card variant="default" padding="md" className={`border-l-4 ${colorClasses[color]}`}>
      <div className="text-sm text-pkt-grays-gray-600 mb-1">{label}</div>
      <div className="text-2xl font-bold text-pkt-grays-gray-800">{value}</div>
      {subtext && <div className="text-xs text-pkt-grays-gray-500 mt-1">{subtext}</div>}
    </Card>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
}

function ProgressBar({ value, max = 100, color = 'bg-oslo-blue', showLabel = true }: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-pkt-grays-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && <span className="text-sm text-pkt-grays-gray-600 w-12 text-right">{value.toFixed(1)}%</span>}
    </div>
  );
}

interface SimpleBarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  maxValue?: number;
}

function SimpleBarChart({ data, maxValue }: SimpleBarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 text-sm text-pkt-grays-gray-600 truncate">{item.label}</div>
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

// Format currency (NOK)
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return value.toFixed(0);
}

// ============================================================
// Main Component
// ============================================================

export function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { isVerifying } = useAuth();
  const [timelinePeriod, setTimelinePeriod] = useState<'day' | 'week' | 'month'>('week');

  // Fetch all analytics data
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary({ enabled: !isVerifying });
  const { data: categories, isLoading: categoriesLoading } = useCategoryAnalytics({ enabled: !isVerifying });
  const { data: timeline, isLoading: timelineLoading } = useTimelineAnalytics(timelinePeriod, 90, { enabled: !isVerifying });
  const { data: vederlag, isLoading: vederlagLoading } = useVederlagAnalytics({ enabled: !isVerifying });
  const { data: responseTimes, isLoading: responseTimesLoading } = useResponseTimesAnalytics({ enabled: !isVerifying });
  const { data: actors, isLoading: actorsLoading } = useActorAnalytics({ enabled: !isVerifying });

  const isLoading = summaryLoading || categoriesLoading || timelineLoading || vederlagLoading || responseTimesLoading || actorsLoading || isVerifying;

  return (
    <div className="min-h-screen bg-pkt-bg-default">
      {/* Header */}
      <header className="bg-pkt-bg-card shadow-sm border-b-2 border-oslo-blue">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-heading-lg font-bold text-oslo-blue">Analysedashboard</h1>
              <p className="mt-2 text-body-md text-pkt-grays-gray-600">
                Prosjekt- og porteføljeoversikt basert på hendelsesdata
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <Button variant="secondary" size="sm" onClick={() => navigate('/saker')}>
                Saksoversikt
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <Card variant="default" padding="lg">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oslo-blue" />
              <span className="ml-3 text-pkt-grays-gray-600">Laster analysedata...</span>
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* KPI Summary Row */}
            <section>
              <h2 className="text-heading-md font-semibold text-pkt-grays-gray-800 mb-4">Nøkkeltall</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard
                  label="Totalt antall saker"
                  value={summary?.total_cases ?? 0}
                  subtext={`${summary?.total_events ?? 0} hendelser totalt`}
                  color="blue"
                />
                <KPICard
                  label="Vederlag krevd"
                  value={`${formatCurrency(summary?.total_vederlag_krevd ?? 0)} kr`}
                  subtext={`${summary?.godkjenningsgrad_vederlag?.toFixed(1) ?? 0}% godkjent`}
                  color="yellow"
                />
                <KPICard
                  label="Vederlag godkjent"
                  value={`${formatCurrency(summary?.total_vederlag_godkjent ?? 0)} kr`}
                  color="green"
                />
                <KPICard
                  label="Gj.snitt hendelser/sak"
                  value={summary?.avg_events_per_case?.toFixed(1) ?? '0'}
                  color="blue"
                />
              </div>
            </section>

            {/* Status Distribution */}
            <section>
              <h2 className="text-heading-md font-semibold text-pkt-grays-gray-800 mb-4">Statusfordeling</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* By Status */}
                <Card variant="outlined" padding="md">
                  <h3 className="text-body-lg font-semibold mb-4">Etter overordnet status</h3>
                  <SimpleBarChart
                    data={Object.entries(summary?.by_status ?? {}).map(([status, count]) => ({
                      label: status.replace(/_/g, ' '),
                      value: count as number,
                      color:
                        status.includes('godkjent')
                          ? 'bg-badge-success-bg'
                          : status.includes('avslatt')
                          ? 'bg-badge-error-bg'
                          : status.includes('behandling') || status.includes('respons')
                          ? 'bg-badge-warning-bg'
                          : 'bg-oslo-blue',
                    }))}
                  />
                </Card>

                {/* By Sakstype */}
                <Card variant="outlined" padding="md">
                  <h3 className="text-body-lg font-semibold mb-4">Etter sakstype</h3>
                  <SimpleBarChart
                    data={Object.entries(summary?.by_sakstype ?? {}).map(([type, count]) => ({
                      label: type === 'standard' ? 'KOE' : type === 'forsering' ? 'Forsering' : 'Endringsordre',
                      value: count as number,
                      color: type === 'standard' ? 'bg-oslo-blue' : type === 'forsering' ? 'bg-badge-warning-bg' : 'bg-badge-info-bg',
                    }))}
                  />
                </Card>
              </div>
            </section>

            {/* Category Analysis */}
            <section>
              <h2 className="text-heading-md font-semibold text-pkt-grays-gray-800 mb-4">Grunnlagskategorier</h2>
              <Card variant="outlined" padding="md">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-pkt-border-default">
                        <th className="text-left py-2 px-2 text-sm font-semibold text-pkt-grays-gray-600">Kategori</th>
                        <th className="text-right py-2 px-2 text-sm font-semibold text-pkt-grays-gray-600">Antall</th>
                        <th className="text-right py-2 px-2 text-sm font-semibold text-pkt-grays-gray-600">Godkjent</th>
                        <th className="text-right py-2 px-2 text-sm font-semibold text-pkt-grays-gray-600">Delvis</th>
                        <th className="text-right py-2 px-2 text-sm font-semibold text-pkt-grays-gray-600">Avslått</th>
                        <th className="py-2 px-2 text-sm font-semibold text-pkt-grays-gray-600 w-40">Godkjenningsrate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories?.categories.map((cat) => (
                        <tr key={cat.kategori} className="border-b border-pkt-border-default last:border-0">
                          <td className="py-3 px-2 font-medium">{getHovedkategoriLabel(cat.kategori)}</td>
                          <td className="py-3 px-2 text-right">{cat.antall}</td>
                          <td className="py-3 px-2 text-right text-badge-success-text">{cat.godkjent}</td>
                          <td className="py-3 px-2 text-right text-badge-warning-text">{cat.delvis_godkjent}</td>
                          <td className="py-3 px-2 text-right text-badge-error-text">{cat.avslatt}</td>
                          <td className="py-3 px-2">
                            <ProgressBar
                              value={cat.godkjenningsrate}
                              color={cat.godkjenningsrate >= 70 ? 'bg-badge-success-bg' : cat.godkjenningsrate >= 50 ? 'bg-badge-warning-bg' : 'bg-badge-error-bg'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>

            {/* Timeline */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-heading-md font-semibold text-pkt-grays-gray-800">Aktivitet over tid</h2>
                <div className="flex gap-2">
                  {(['day', 'week', 'month'] as const).map((p) => (
                    <Button
                      key={p}
                      variant={timelinePeriod === p ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setTimelinePeriod(p)}
                    >
                      {p === 'day' ? 'Dag' : p === 'week' ? 'Uke' : 'Måned'}
                    </Button>
                  ))}
                </div>
              </div>
              <Card variant="outlined" padding="md">
                <div className="h-64 flex items-end gap-1">
                  {timeline?.data.map((point, i) => {
                    const maxEvents = Math.max(...(timeline?.data.map((d) => d.events) ?? [1]));
                    const height = (point.events / maxEvents) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-xs text-pkt-grays-gray-600">{point.events}</div>
                        <div
                          className="w-full bg-oslo-blue rounded-t"
                          style={{ height: `${height}%`, minHeight: point.events > 0 ? '4px' : '0' }}
                        />
                        <div className="text-xs text-pkt-grays-gray-500 transform -rotate-45 origin-top-left whitespace-nowrap">
                          {new Date(point.date).toLocaleDateString('nb-NO', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 text-sm text-pkt-grays-gray-600 text-center">
                  Totalt {timeline?.data.reduce((sum, d) => sum + d.events, 0) ?? 0} hendelser siste {timeline?.days_back ?? 90} dager
                </div>
              </Card>
            </section>

            {/* Vederlag Analysis */}
            <section>
              <h2 className="text-heading-md font-semibold text-pkt-grays-gray-800 mb-4">Vederlagsanalyse</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* By Method */}
                <Card variant="outlined" padding="md">
                  <h3 className="text-body-lg font-semibold mb-4">Etter metode</h3>
                  <div className="space-y-4">
                    {vederlag?.by_metode.map((m) => (
                      <div key={m.metode} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{getVederlagsmetodeLabel(m.metode)}</span>
                          <span className="text-pkt-grays-gray-600">{m.antall} krav</span>
                        </div>
                        <div className="flex gap-2 text-xs text-pkt-grays-gray-600">
                          <span>Krevd: {formatCurrency(m.total_krevd)} kr</span>
                          <span>|</span>
                          <span>Godkjent: {formatCurrency(m.total_godkjent)} kr</span>
                        </div>
                        <ProgressBar value={m.godkjenningsgrad} color="bg-badge-success-bg" />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Distribution */}
                <Card variant="outlined" padding="md">
                  <h3 className="text-body-lg font-semibold mb-4">Kravstørrelser</h3>
                  <SimpleBarChart
                    data={(vederlag?.krav_distribution ?? []).map((d) => ({
                      label: d.range,
                      value: d.count,
                      color: 'bg-oslo-blue',
                    }))}
                  />
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-pkt-grays-gray-600">Gj.snitt krav:</span>
                      <span className="ml-2 font-semibold">{formatCurrency(vederlag?.summary.avg_krav ?? 0)} kr</span>
                    </div>
                    <div>
                      <span className="text-pkt-grays-gray-600">Gj.snitt godkjent:</span>
                      <span className="ml-2 font-semibold">{formatCurrency(vederlag?.summary.avg_godkjent ?? 0)} kr</span>
                    </div>
                  </div>
                </Card>
              </div>
            </section>

            {/* Response Times & Actors */}
            <section>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Response Times */}
                <div>
                  <h2 className="text-heading-md font-semibold text-pkt-grays-gray-800 mb-4">Behandlingstider</h2>
                  <Card variant="outlined" padding="md">
                    <div className="space-y-4">
                      {(['grunnlag', 'vederlag', 'frist'] as const).map((track) => {
                        const data = responseTimes?.[track];
                        return (
                          <div key={track} className="flex items-center justify-between py-2 border-b border-pkt-border-default last:border-0">
                            <div>
                              <div className="font-medium capitalize">{track}</div>
                              <div className="text-xs text-pkt-grays-gray-500">
                                {data?.sample_size ?? 0} målinger
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-semibold">
                                {data?.avg_days?.toFixed(1) ?? '-'} dager
                              </div>
                              <div className="text-xs text-pkt-grays-gray-500">
                                median: {data?.median_days ?? '-'} | min: {data?.min_days ?? '-'} | maks: {data?.max_days ?? '-'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>

                {/* Actors */}
                <div>
                  <h2 className="text-heading-md font-semibold text-pkt-grays-gray-800 mb-4">Aktøroversikt</h2>
                  <Card variant="outlined" padding="md">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {Object.entries(actors?.by_role ?? {}).map(([role, data]) => (
                        <div key={role} className="text-center p-3 bg-pkt-bg-default rounded">
                          <div className="text-2xl font-bold">{data.events}</div>
                          <div className="text-sm text-pkt-grays-gray-600">
                            {role} ({data.unique_actors} aktører)
                          </div>
                        </div>
                      ))}
                    </div>
                    <h4 className="text-sm font-semibold text-pkt-grays-gray-600 mb-2">Mest aktive</h4>
                    <div className="space-y-2">
                      {actors?.top_actors.slice(0, 5).map((actor, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span>
                            {actor.name}
                            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                              actor.role === 'TE' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {actor.role}
                            </span>
                          </span>
                          <span className="font-medium">{actor.events}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </section>

            {/* Info Box */}
            <section>
              <Card variant="default" padding="md" className="bg-blue-50 border border-blue-200">
                <h3 className="text-body-lg font-semibold text-oslo-blue mb-2">Om dette dashboardet</h3>
                <p className="text-sm text-pkt-grays-gray-700 mb-3">
                  Dette dashboardet demonstrerer hvordan data lagret i Supabase via event sourcing kan
                  aggregeres og visualiseres for prosjekt- og porteføljeanalyse. Tilsvarende funksjonalitet
                  kan bygges med Power BI mot Dataverse i en produksjonsløsning.
                </p>
                <div className="text-sm text-pkt-grays-gray-600">
                  <strong>Data inkluderer:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Alle hendelser (events) lagret i CloudEvents v1.0-format</li>
                    <li>Beregnet tilstand (state) for hver sak via event replay</li>
                    <li>Aggregerte nøkkeltall på tvers av prosjekter</li>
                    <li>Behandlingstider beregnet fra event-tidsstempler</li>
                  </ul>
                </div>
              </Card>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default AnalyticsDashboard;
