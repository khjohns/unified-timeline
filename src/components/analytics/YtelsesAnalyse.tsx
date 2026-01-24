/**
 * Ytelsesanalyse Component
 *
 * Analysemetode: Analyse av behandlingstider og prosesseffektivitet
 * Bruksområde: Prosessoptimalisering, SLA-oppfølging, flaskehalsidentifisering
 */

import { Card } from '../primitives';
import { AnalyticsSection, KPICard } from './AnalyticsHelpers';
import type { ResponseTimesAnalytics } from '../../api/analytics';

interface YtelsesAnalyseProps {
  responseTimes: ResponseTimesAnalytics | undefined;
}

export function YtelsesAnalyse({ responseTimes }: YtelsesAnalyseProps) {
  const tracks = ['grunnlag', 'vederlag', 'frist'] as const;

  // Calculate overall average - only include tracks with actual data
  const tracksWithData = tracks.filter((track) => responseTimes?.[track]?.avg_days != null);
  const overallAvg = tracksWithData.length > 0
    ? tracksWithData.reduce((sum, track) => sum + (responseTimes?.[track]?.avg_days ?? 0), 0) / tracksWithData.length
    : null;
  const totalSampleSize = tracks.reduce((sum, track) => sum + (responseTimes?.[track]?.sample_size ?? 0), 0);

  // Find slowest track
  const slowestTrack = tracks.reduce((slowest, track) => {
    const current = responseTimes?.[track]?.avg_days ?? 0;
    const slowestVal = responseTimes?.[slowest]?.avg_days ?? 0;
    return current > slowestVal ? track : slowest;
  }, tracks[0]);

  return (
    <AnalyticsSection
      title="Ytelsesanalyse"
      description="Analyse av behandlingstider for grunnlag og vederlag. Brukes til prosessoptimalisering og identifisering av flaskehalser."
    >
      {/* Summary KPIs */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Behandlingstider - oversikt</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Gj.snitt behandlingstid"
            value={overallAvg != null ? `${overallAvg.toFixed(1)} dager` : 'Ingen data'}
            subtext={totalSampleSize > 0 ? `${totalSampleSize} målinger totalt` : 'Ingen fullførte saker'}
            color={totalSampleSize > 0 ? 'blue' : 'gray'}
          />
          <KPICard
            label="Ansvarsgrunnlag"
            value={`${responseTimes?.grunnlag?.avg_days?.toFixed(1) ?? '-'} dager`}
            subtext={`${responseTimes?.grunnlag?.sample_size ?? 0} målinger`}
            color={responseTimes?.grunnlag?.avg_days && responseTimes.grunnlag.avg_days <= 7 ? 'green' : 'yellow'}
          />
          <KPICard
            label="Vederlag"
            value={`${responseTimes?.vederlag?.avg_days?.toFixed(1) ?? '-'} dager`}
            subtext={`${responseTimes?.vederlag?.sample_size ?? 0} målinger`}
            color={responseTimes?.vederlag?.avg_days && responseTimes.vederlag.avg_days <= 7 ? 'green' : 'yellow'}
          />
          <KPICard
            label="Tregeste spor"
            value={slowestTrack.charAt(0).toUpperCase() + slowestTrack.slice(1)}
            subtext={`${responseTimes?.[slowestTrack]?.avg_days?.toFixed(1) ?? '-'} dager`}
            color="red"
          />
        </div>
      </section>

      {/* Detailed breakdown */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Detaljert analyse</h3>
        <Card variant="outlined" padding="md">
          <div className="space-y-6">
            {tracks.map((track) => {
              const data = responseTimes?.[track];
              const progressWidth = data?.avg_days ? Math.min((data.avg_days / 30) * 100, 100) : 0;
              const isGood = (data?.avg_days ?? 999) <= 7;
              const isOk = (data?.avg_days ?? 999) <= 14;

              return (
                <div key={track} className="pb-6 border-b border-pkt-border-default last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-pkt-text-body-dark capitalize">{track}</h4>
                      <p className="text-sm text-pkt-text-body-subtle">
                        {track === 'grunnlag' && 'Tid fra varsling til grunnlagsvedtak'}
                        {track === 'vederlag' && 'Tid fra krav til vederlagsvedtak'}
                        {track === 'frist' && 'Tid fra krav til fristvedtak'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${isGood ? 'text-badge-success-text' : isOk ? 'text-badge-warning-text' : 'text-badge-error-text'}`}>
                        {data?.avg_days?.toFixed(1) ?? '-'}
                      </div>
                      <div className="text-sm text-pkt-grays-gray-500">dager gj.snitt</div>
                    </div>
                  </div>

                  {/* Visual progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-pkt-grays-gray-500 mb-1">
                      <span>0</span>
                      <span>7 dager</span>
                      <span>14 dager</span>
                      <span>30+ dager</span>
                    </div>
                    <div className="h-3 bg-pkt-grays-gray-200 rounded-full relative overflow-hidden">
                      {/* Target zones */}
                      <div className="absolute inset-y-0 left-0 w-[23%] bg-badge-success-bg/30" />
                      <div className="absolute inset-y-0 left-[23%] w-[24%] bg-badge-warning-bg/30" />
                      <div className="absolute inset-y-0 left-[47%] w-[53%] bg-badge-error-bg/30" />
                      {/* Current value */}
                      <div
                        className={`absolute inset-y-0 left-0 ${isGood ? 'bg-badge-success-bg' : isOk ? 'bg-badge-warning-bg' : 'bg-badge-error-bg'} rounded-full`}
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="p-2 bg-pkt-bg-default rounded">
                      <div className="text-sm font-semibold">{data?.sample_size ?? 0}</div>
                      <div className="text-xs text-pkt-grays-gray-500">Målinger</div>
                    </div>
                    <div className="p-2 bg-pkt-bg-default rounded">
                      <div className="text-sm font-semibold">{data?.median_days ?? '-'}</div>
                      <div className="text-xs text-pkt-grays-gray-500">Median</div>
                    </div>
                    <div className="p-2 bg-pkt-bg-default rounded">
                      <div className="text-sm font-semibold">{data?.min_days ?? '-'}</div>
                      <div className="text-xs text-pkt-grays-gray-500">Minimum</div>
                    </div>
                    <div className="p-2 bg-pkt-bg-default rounded">
                      <div className="text-sm font-semibold">{data?.max_days ?? '-'}</div>
                      <div className="text-xs text-pkt-grays-gray-500">Maksimum</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Performance insights */}
      <Card variant="outlined" padding="md" className="bg-pkt-surface-subtle-pale-blue">
        <h4 className="text-body-md font-semibold text-oslo-blue mb-2">Ytelsesinnsikt</h4>
        <div className="text-sm text-pkt-text-body-default space-y-2">
          <p>
            <strong>Målsetning:</strong> Ideelt bør behandlingstid være under 7 dager for rask saksflyt.
            Saker over 14 dager indikerer potensielle flaskehalser.
          </p>
          {responseTimes && overallAvg != null && (
            <p>
              <strong>Status:</strong>{' '}
              {overallAvg <= 7
                ? 'Behandlingstidene er gode og ligger under målsetningen.'
                : overallAvg <= 14
                ? 'Behandlingstidene er akseptable, men det er rom for forbedring.'
                : 'Behandlingstidene er høye. Vurder tiltak for å redusere ventetid.'}
            </p>
          )}
          {responseTimes && overallAvg == null && (
            <p>
              <strong>Status:</strong>{' '}
              Ingen fullførte saker ennå. Behandlingstid beregnes når byggherre har respondert på minst ett krav.
            </p>
          )}
          {overallAvg != null && (
            <p>
              <strong>Flaskehals:</strong> {slowestTrack.charAt(0).toUpperCase() + slowestTrack.slice(1)}-sporet
              har lengst behandlingstid og bør prioriteres for optimalisering.
            </p>
          )}
        </div>
      </Card>
    </AnalyticsSection>
  );
}
