/**
 * Trendanalyse Component
 *
 * Analysemetode: Aktivitet og trender over tid
 * Bruksområde: Kapasitetsplanlegging, sesongmønstre, prosjektfaser
 */

import { Card, Button } from '../primitives';
import { AnalyticsSection } from './AnalyticsHelpers';
import type { TimelineAnalytics } from '../../api/analytics';

interface TrendAnalyseProps {
  timeline: TimelineAnalytics | undefined;
  period: 'day' | 'week' | 'month';
  onPeriodChange: (period: 'day' | 'week' | 'month') => void;
}

export function TrendAnalyse({ timeline, period, onPeriodChange }: TrendAnalyseProps) {
  const totalEvents = timeline?.data.reduce((sum, d) => sum + d.events, 0) ?? 0;
  const avgEventsPerPeriod = totalEvents / (timeline?.data.length || 1);
  const maxEvents = Math.max(...(timeline?.data.map((d) => d.events) ?? [1]), 1);

  // Find peak period
  const peakPeriod = timeline?.data && timeline.data.length > 0 && timeline.data[0]
    ? timeline.data.reduce((max, d) => d.events > max.events ? d : max, timeline.data[0])
    : undefined;

  return (
    <AnalyticsSection
      title="Trendanalyse"
      description="Visualisering av aktivitet over tid. Brukes til kapasitetsplanlegging og identifisering av travle perioder."
    >
      {/* Period selector and summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-pkt-grays-gray-600">Totalt:</span>
            <span className="ml-1 font-semibold">{totalEvents} hendelser</span>
          </div>
          <div>
            <span className="text-pkt-grays-gray-600">Gj.snitt per {period === 'day' ? 'dag' : period === 'week' ? 'uke' : 'måned'}:</span>
            <span className="ml-1 font-semibold">{avgEventsPerPeriod.toFixed(1)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => onPeriodChange(p)}
            >
              {p === 'day' ? 'Dag' : p === 'week' ? 'Uke' : 'Måned'}
            </Button>
          ))}
        </div>
      </div>

      {/* Timeline chart */}
      <Card variant="outlined" padding="md" className="overflow-hidden">
        <h3 className="text-body-lg font-semibold mb-4">Aktivitet over tid</h3>
        {(() => {
          const dataPoints = timeline?.data.length ?? 0;
          const showEveryNth = dataPoints > 30 ? Math.ceil(dataPoints / 12) : 1;
          const hideLabels = dataPoints > 50;

          return (
            <>
              <div className="flex items-end gap-px overflow-hidden" style={{ height: '200px' }}>
                {timeline?.data.map((point, i) => {
                  const heightPx = Math.max((point.events / maxEvents) * 180, point.events > 0 ? 4 : 0);
                  const isPeak = point === peakPeriod;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                      {!hideLabels && (
                        <div className="text-xs text-pkt-grays-gray-600 mb-1">{point.events}</div>
                      )}
                      <div
                        className={`w-full rounded-t transition-colors ${isPeak ? 'bg-badge-warning-bg' : 'bg-oslo-blue'}`}
                        style={{ height: `${heightPx}px` }}
                        title={`${new Date(point.date).toLocaleDateString('nb-NO')}: ${point.events} hendelser`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-px mt-2 overflow-hidden">
                {timeline?.data.map((point, i) => (
                  <div key={i} className="flex-1 text-center min-w-0">
                    {i % showEveryNth === 0 && (
                      <div className="text-xs text-pkt-grays-gray-500 truncate">
                        {new Date(point.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          );
        })()}
        <div className="mt-4 text-sm text-pkt-grays-gray-600 text-center">
          Viser data for siste {timeline?.days_back ?? 90} dager
        </div>
      </Card>

      {/* Insights */}
      <Card variant="outlined" padding="md">
        <h3 className="text-body-lg font-semibold mb-4">Trendinnsikt</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 bg-pkt-bg-default rounded">
            <div className="text-sm text-pkt-grays-gray-600">Høyeste aktivitet</div>
            <div className="text-lg font-semibold text-oslo-blue">
              {peakPeriod ? new Date(peakPeriod.date).toLocaleDateString('nb-NO', { month: 'long', day: 'numeric' }) : '-'}
            </div>
            <div className="text-sm text-pkt-grays-gray-500">{peakPeriod?.events ?? 0} hendelser</div>
          </div>
          <div className="p-4 bg-pkt-bg-default rounded">
            <div className="text-sm text-pkt-grays-gray-600">Perioder med aktivitet</div>
            <div className="text-lg font-semibold text-oslo-blue">
              {timeline?.data.filter(d => d.events > 0).length ?? 0} av {timeline?.data.length ?? 0}
            </div>
            <div className="text-sm text-pkt-grays-gray-500">
              {((timeline?.data.filter(d => d.events > 0).length ?? 0) / (timeline?.data.length || 1) * 100).toFixed(0)}% aktivitetsdekning
            </div>
          </div>
          <div className="p-4 bg-pkt-bg-default rounded">
            <div className="text-sm text-pkt-grays-gray-600">Analyseperiode</div>
            <div className="text-lg font-semibold text-oslo-blue">
              {timeline?.days_back ?? 90} dager
            </div>
            <div className="text-sm text-pkt-grays-gray-500">
              Gruppering: {period === 'day' ? 'Per dag' : period === 'week' ? 'Per uke' : 'Per måned'}
            </div>
          </div>
        </div>
      </Card>
    </AnalyticsSection>
  );
}
