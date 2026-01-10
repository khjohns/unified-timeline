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
      <Card variant="outlined" padding="md">
        <h3 className="text-body-lg font-semibold mb-4">Aktivitet over tid</h3>
        <div className="h-64 flex items-end gap-1">
          {timeline?.data.map((point, i) => {
            const height = (point.events / maxEvents) * 100;
            const isPeak = point === peakPeriod;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs text-pkt-grays-gray-600">{point.events}</div>
                <div
                  className={`w-full rounded-t transition-colors ${isPeak ? 'bg-badge-warning-bg' : 'bg-oslo-blue'}`}
                  style={{ height: `${height}%`, minHeight: point.events > 0 ? '4px' : '0' }}
                  title={`${new Date(point.date).toLocaleDateString('nb-NO')}: ${point.events} hendelser`}
                />
                <div className="text-xs text-pkt-grays-gray-500 transform -rotate-45 origin-top-left whitespace-nowrap">
                  {new Date(point.date).toLocaleDateString('nb-NO', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
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
