/**
 * Økonomisk analyse Component
 *
 * Analysemetode: Økonomisk analyse av vederlag og frist/dagmulkt
 * Bruksområde: Økonomioppfølging, budsjettanalyse, kontraktsoppgjør
 */

import { Card } from '../primitives';
import { SimpleBarChart, ProgressBar, formatCurrency, AnalyticsSection, KPICard } from './AnalyticsHelpers';
import { getVederlagsmetodeLabel } from '../../constants/paymentMethods';
import type { VederlagAnalytics, ResponseTimesAnalytics } from '../../api/analytics';

interface OkonomiskAnalyseProps {
  vederlag: VederlagAnalytics | undefined;
  responseTimes: ResponseTimesAnalytics | undefined;
}

export function OkonomiskAnalyse({ vederlag, responseTimes }: OkonomiskAnalyseProps) {
  // Calculate frist/dagmulkt economics
  const fristData = responseTimes?.frist;

  return (
    <AnalyticsSection
      title="Økonomisk analyse"
      description="Analyse av vederlagskrav, godkjenningsgrader per metode, og fristforlengelser. Brukes til økonomioppfølging og kontraktsoppgjør."
    >
      {/* Summary KPIs */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-grays-gray-800 mb-4">Økonomisk oversikt</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Vederlag krevd"
            value={`${formatCurrency(vederlag?.summary.total_krevd ?? 0)} kr`}
            subtext={`${vederlag?.summary.antall_krav ?? 0} krav totalt`}
            color="yellow"
          />
          <KPICard
            label="Vederlag godkjent"
            value={`${formatCurrency(vederlag?.summary.total_godkjent ?? 0)} kr`}
            subtext={`${vederlag?.summary.godkjenningsgrad?.toFixed(1) ?? 0}% av krevd`}
            color="green"
          />
          <KPICard
            label="Gj.snitt per krav"
            value={`${formatCurrency(vederlag?.summary.avg_krav ?? 0)} kr`}
            subtext="Krevd beløp"
            color="blue"
          />
          <KPICard
            label="Fristsaker behandlet"
            value={fristData?.sample_size ?? 0}
            subtext={`${fristData?.avg_days?.toFixed(1) ?? '-'} dager gj.snitt`}
            color="blue"
          />
        </div>
      </section>

      {/* Vederlag by method and distribution */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-grays-gray-800 mb-4">Vederlagsanalyse</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {/* By Method */}
          <Card variant="outlined" padding="md">
            <h4 className="text-body-md font-semibold mb-4">Etter betalingsmetode</h4>
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
            <h4 className="text-body-md font-semibold mb-4">Kravstørrelser</h4>
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

      {/* Frist/Dagmulkt analysis */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-grays-gray-800 mb-4">Fristforlengelse og dagmulkt</h3>
        <Card variant="outlined" padding="md">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Frist statistics */}
            <div>
              <h4 className="text-body-md font-semibold mb-4">Fristforlengelser</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-pkt-border-default">
                  <div>
                    <div className="font-medium">Gjennomsnittlig behandlingstid</div>
                    <div className="text-xs text-pkt-grays-gray-500">Fra krav til vedtak</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{fristData?.avg_days?.toFixed(1) ?? '-'} dager</div>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-pkt-border-default">
                  <div>
                    <div className="font-medium">Median behandlingstid</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{fristData?.median_days ?? '-'} dager</div>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">Spredning</div>
                    <div className="text-xs text-pkt-grays-gray-500">Min - Maks</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{fristData?.min_days ?? '-'} - {fristData?.max_days ?? '-'} dager</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dagmulkt impact info */}
            <div>
              <h4 className="text-body-md font-semibold mb-4">Dagmulkt-eksponering</h4>
              <div className="p-4 bg-badge-warning-bg/20 rounded-lg">
                <p className="text-sm text-pkt-grays-gray-700 mb-3">
                  Fristforlengelser påvirker dagmulkteksponering direkte. For hver dag frist ikke godkjennes,
                  akkumuleres potensiell dagmulkt.
                </p>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Fristsaker i analyse:</span>
                    <span className="font-semibold">{fristData?.sample_size ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Potensielle dagmulktdager:</span>
                    <span className="font-semibold text-badge-warning-text">
                      {fristData?.sample_size && fristData?.avg_days
                        ? Math.round(fristData.sample_size * fristData.avg_days)
                        : '-'
                      }
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-pkt-grays-gray-500">
                Beregning: Antall saker × gjennomsnittlig behandlingstid.
                Faktisk dagmulkt avhenger av kontraktens dagmulktsats.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Economic insights */}
      <Card variant="outlined" padding="md" className="bg-green-50">
        <h4 className="text-body-md font-semibold text-badge-success-text mb-2">Økonomisk innsikt</h4>
        <div className="text-sm text-pkt-grays-gray-700 space-y-2">
          <p>
            <strong>Godkjenningsgrad:</strong> {vederlag?.summary.godkjenningsgrad?.toFixed(1) ?? 0}% av krevd vederlag er godkjent.
            {vederlag?.summary.godkjenningsgrad && vederlag.summary.godkjenningsgrad >= 70
              ? ' Dette er en god rate som indikerer kvalitet i kravene.'
              : ' Vurder kvaliteten på kravsdokumentasjon for å øke godkjenningsgraden.'}
          </p>
          {vederlag?.by_metode && vederlag.by_metode.length > 0 && (
            <p>
              <strong>Beste metode:</strong> {(() => {
                const best = [...vederlag.by_metode].sort((a, b) => b.godkjenningsgrad - a.godkjenningsgrad)[0];
                if (!best) return 'Ingen data';
                return `${getVederlagsmetodeLabel(best.metode)} har høyest godkjenningsgrad (${best.godkjenningsgrad.toFixed(1)}%)`;
              })()}
            </p>
          )}
        </div>
      </Card>
    </AnalyticsSection>
  );
}
