/**
 * Økonomisk analyse Component
 *
 * Analysemetode: Økonomisk analyse av vederlag og fristforlengelse
 * Bruksområde: Økonomioppfølging, budsjettanalyse, kontraktsoppgjør
 *
 * Beregningsmodell (jf. SendResponsPakkeModal):
 * - Vederlag: Kroner krevd/godkjent
 * - Frist: Dager × dagmulktsats = fristbeløp
 * - Samlet eksponering: Vederlag + Fristbeløp
 */

import { Card } from '../primitives';
import { SimpleBarChart, ProgressBar, formatCurrency, AnalyticsSection, KPICard } from './AnalyticsHelpers';
import { getVederlagsmetodeLabel } from '../../constants/paymentMethods';
import type { VederlagAnalytics, FristAnalytics } from '../../api/analytics';

interface OkonomiskAnalyseProps {
  vederlag: VederlagAnalytics | undefined;
  frist: FristAnalytics | undefined;
}

export function OkonomiskAnalyse({ vederlag, frist }: OkonomiskAnalyseProps) {
  // Calculate combined economic exposure
  const vederlagKrevd = vederlag?.summary.total_krevd ?? 0;
  const vederlagGodkjent = vederlag?.summary.total_godkjent ?? 0;
  const fristKrevd = frist?.eksponering_krevd ?? 0;
  const fristGodkjent = frist?.eksponering_godkjent ?? 0;

  const samletKrevd = vederlagKrevd + fristKrevd;
  const samletGodkjent = vederlagGodkjent + fristGodkjent;
  const samletGodkjenningsgrad = samletKrevd > 0 ? (samletGodkjent / samletKrevd) * 100 : 0;

  return (
    <AnalyticsSection
      title="Økonomisk analyse"
      description="Analyse av samlet økonomisk eksponering: vederlagskrav og fristforlengelser (dager × dagmulktsats). Brukes til økonomioppfølging og kontraktsoppgjør."
    >
      {/* Combined Economic Exposure - Key insight */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Samlet økonomisk eksponering</h3>
        <Card variant="outlined" padding="md" className="bg-pkt-surface-subtle-pale-blue">
          <div className="space-y-4">
            {/* Calculation breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-pkt-text-body-subtle">Vederlag krevd</span>
                <span className="font-mono">{formatCurrency(vederlagKrevd)} kr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pkt-text-body-subtle">
                  Frist ({frist?.summary.total_dager_krevd ?? 0} dager × {formatCurrency(frist?.dagmulktsats ?? 0)}/dag)
                </span>
                <span className="font-mono">{formatCurrency(fristKrevd)} kr</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-pkt-border-default font-bold text-base">
                <span>Samlet eksponering krevd</span>
                <span className="font-mono text-oslo-blue">{formatCurrency(samletKrevd)} kr</span>
              </div>
            </div>

            {/* Approval status */}
            <div className="pt-2 border-t border-pkt-border-subtle">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-pkt-text-body-subtle">Godkjent av krevd</span>
                <span className="font-semibold text-badge-success-text">{formatCurrency(samletGodkjent)} kr ({samletGodkjenningsgrad.toFixed(1)}%)</span>
              </div>
              <ProgressBar value={samletGodkjenningsgrad} color="bg-badge-success-bg" />
            </div>
          </div>
        </Card>
      </section>

      {/* KPI Summary */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Oversikt per type</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Vederlag krevd"
            value={`${formatCurrency(vederlagKrevd)} kr`}
            subtext={`${vederlag?.summary.antall_krav ?? 0} krav`}
            color="yellow"
          />
          <KPICard
            label="Vederlag godkjent"
            value={`${formatCurrency(vederlagGodkjent)} kr`}
            subtext={`${vederlag?.summary.godkjenningsgrad?.toFixed(1) ?? 0}%`}
            color="green"
          />
          <KPICard
            label="Frist krevd"
            value={`${frist?.summary.total_dager_krevd ?? 0} dager`}
            subtext={`= ${formatCurrency(fristKrevd)} kr`}
            color="yellow"
          />
          <KPICard
            label="Frist godkjent"
            value={`${frist?.summary.total_dager_godkjent ?? 0} dager`}
            subtext={`= ${formatCurrency(fristGodkjent)} kr`}
            color="green"
          />
        </div>
      </section>

      {/* Vederlag details */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Vederlagsanalyse</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {/* By Method */}
          <Card variant="outlined" padding="md">
            <h4 className="text-body-md font-semibold mb-4">Etter betalingsmetode</h4>
            <div className="space-y-4">
              {vederlag?.by_metode.map((m) => (
                <div key={m.metode} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{getVederlagsmetodeLabel(m.metode)}</span>
                    <span className="text-pkt-text-body-subtle">{m.antall} krav</span>
                  </div>
                  <div className="flex gap-2 text-xs text-pkt-text-body-subtle">
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
                <span className="text-pkt-text-body-subtle">Gj.snitt krav:</span>
                <span className="ml-2 font-semibold">{formatCurrency(vederlag?.summary.avg_krav ?? 0)} kr</span>
              </div>
              <div>
                <span className="text-pkt-text-body-subtle">Gj.snitt godkjent:</span>
                <span className="ml-2 font-semibold">{formatCurrency(vederlag?.summary.avg_godkjent ?? 0)} kr</span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Frist/Dagmulkt details */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Fristforlengelse og dagmulkt</h3>
        <Card variant="outlined" padding="md">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Frist statistics */}
            <div>
              <h4 className="text-body-md font-semibold mb-4">Fristforlengelser</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-pkt-border-subtle">
                  <span className="text-pkt-text-body-subtle">Antall krav</span>
                  <span className="font-semibold">{frist?.summary.antall_krav ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-pkt-border-subtle">
                  <span className="text-pkt-text-body-subtle">Dager krevd</span>
                  <span className="font-semibold">{frist?.summary.total_dager_krevd ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-pkt-border-subtle">
                  <span className="text-pkt-text-body-subtle">Dager godkjent</span>
                  <span className="font-semibold text-badge-success-text">{frist?.summary.total_dager_godkjent ?? 0}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-pkt-text-body-subtle">Godkjenningsgrad</span>
                  <span className="font-semibold">{frist?.summary.godkjenningsgrad?.toFixed(1) ?? 0}%</span>
                </div>
              </div>
            </div>

            {/* Economic impact */}
            <div>
              <h4 className="text-body-md font-semibold mb-4">Økonomisk effekt</h4>
              <div className="p-4 bg-pkt-surface-yellow rounded-lg">
                <p className="text-sm text-pkt-text-body-default mb-3">
                  Fristforlengelser påvirker økonomisk eksponering direkte.
                  Hver dag fristforlengelse representerer potensiell dagmulkt.
                </p>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Dagmulktsats:</span>
                    <span className="font-mono font-semibold">{formatCurrency(frist?.dagmulktsats ?? 0)} kr/dag</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Eksponering krevd:</span>
                    <span className="font-mono font-semibold">{formatCurrency(fristKrevd)} kr</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Eksponering godkjent:</span>
                    <span className="font-mono font-semibold text-badge-success-text">{formatCurrency(fristGodkjent)} kr</span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-pkt-text-body-subtle">
                Beregning: Antall dager × dagmulktsats = økonomisk eksponering
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Economic insights */}
      <Card variant="outlined" padding="md" className="bg-pkt-surface-faded-green">
        <h4 className="text-body-md font-semibold text-badge-success-text mb-2">Økonomisk innsikt</h4>
        <div className="text-sm text-pkt-text-body-default space-y-2">
          <p>
            <strong>Samlet godkjenningsgrad:</strong> {samletGodkjenningsgrad.toFixed(1)}% av samlet eksponering er godkjent.
          </p>
          <p>
            <strong>Vederlag vs. frist:</strong>{' '}
            {vederlagKrevd > fristKrevd
              ? `Vederlagskrav utgjør hoveddelen (${((vederlagKrevd / samletKrevd) * 100).toFixed(0)}%) av eksponeringen.`
              : `Fristforlengelser utgjør hoveddelen (${((fristKrevd / samletKrevd) * 100).toFixed(0)}%) av eksponeringen.`}
          </p>
          {vederlag?.by_metode && vederlag.by_metode.length > 0 && (
            <p>
              <strong>Beste vederlagsmetode:</strong> {(() => {
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
