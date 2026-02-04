/**
 * Porteføljeanalyse Component
 *
 * Analysemetode: Overordnet porteføljeoversikt
 * Bruksområde: Ledelsesrapportering, KPI-er og totaloversikt
 */

import { Card } from '../primitives';
import { KPICard, SimpleBarChart, formatCurrency, AnalyticsSection, ProgressBar } from './AnalyticsHelpers';
import { getHovedkategoriLabel, getUnderkategoriLabel } from '../../constants/categories';
import type { AnalyticsSummary } from '../../api/analytics';
import type { CaseListItem } from '../../types/api';

interface PortefoljeAnalyseProps {
  summary: AnalyticsSummary | undefined;
  cases?: CaseListItem[];
}

export function PortefoljeAnalyse({ summary, cases = [] }: PortefoljeAnalyseProps) {
  // Filter to KOE cases only (standard type)
  const koeCases = cases.filter(c => c.sakstype === 'standard');

  // Aggregate cached reporting data from KOE cases
  const cachedTotals = koeCases.reduce(
    (acc, c) => ({
      sumKrevd: acc.sumKrevd + (c.cached_sum_krevd ?? 0),
      sumGodkjent: acc.sumGodkjent + (c.cached_sum_godkjent ?? 0),
      dagerKrevd: acc.dagerKrevd + (c.cached_dager_krevd ?? 0),
      dagerGodkjent: acc.dagerGodkjent + (c.cached_dager_godkjent ?? 0),
    }),
    { sumKrevd: 0, sumGodkjent: 0, dagerKrevd: 0, dagerGodkjent: 0 }
  );

  // Count by hovedkategori
  const byHovedkategori = koeCases.reduce<Record<string, number>>((acc, c) => {
    const kat = c.cached_hovedkategori ?? 'UKJENT';
    acc[kat] = (acc[kat] ?? 0) + 1;
    return acc;
  }, {});

  // Count by underkategori
  const byUnderkategori = koeCases.reduce<Record<string, number>>((acc, c) => {
    const kat = c.cached_underkategori ?? 'UKJENT';
    acc[kat] = (acc[kat] ?? 0) + 1;
    return acc;
  }, {});

  // Calculate approval rate
  const godkjenningsgrad = cachedTotals.sumKrevd > 0
    ? (cachedTotals.sumGodkjent / cachedTotals.sumKrevd) * 100
    : 0;

  return (
    <AnalyticsSection
      title="Porteføljeanalyse"
      description="Overordnet oversikt over porteføljen med nøkkeltall og statusfordeling. Brukes til ledelsesrapportering og strategisk oppfølging."
    >
      {/* KPI Summary Row */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Nøkkeltall</h3>
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
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Statusfordeling</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {/* By Status */}
          <Card variant="outlined" padding="md">
            <h4 className="text-body-md font-semibold mb-4">Etter overordnet status</h4>
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
            <h4 className="text-body-md font-semibold mb-4">Etter sakstype</h4>
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

      {/* KOE Economic Overview (from cached data) */}
      {koeCases.length > 0 && (
        <section>
          <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">
            KOE-saker: Økonomisk oversikt
          </h3>
          <Card variant="outlined" padding="md" className="bg-pkt-surface-subtle-pale-blue">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Vederlag */}
              <div>
                <h4 className="text-body-md font-semibold mb-3">Vederlag</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-pkt-text-body-subtle">Krevd</span>
                    <span className="font-mono font-semibold">{formatCurrency(cachedTotals.sumKrevd)} kr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-pkt-text-body-subtle">Godkjent</span>
                    <span className="font-mono font-semibold text-badge-success-text">{formatCurrency(cachedTotals.sumGodkjent)} kr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-pkt-text-body-subtle">Differanse</span>
                    <span className="font-mono font-semibold text-badge-error-text">{formatCurrency(cachedTotals.sumKrevd - cachedTotals.sumGodkjent)} kr</span>
                  </div>
                  <div className="pt-2">
                    <ProgressBar value={godkjenningsgrad} color="bg-badge-success-bg" />
                    <span className="text-xs text-pkt-text-body-subtle">{godkjenningsgrad.toFixed(1)}% godkjent</span>
                  </div>
                </div>
              </div>

              {/* Frist */}
              <div>
                <h4 className="text-body-md font-semibold mb-3">Fristforlengelse</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-pkt-text-body-subtle">Krevd</span>
                    <span className="font-mono font-semibold">{cachedTotals.dagerKrevd} dager</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-pkt-text-body-subtle">Godkjent</span>
                    <span className="font-mono font-semibold text-badge-success-text">{cachedTotals.dagerGodkjent} dager</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-pkt-text-body-subtle">Differanse</span>
                    <span className="font-mono font-semibold text-badge-error-text">{cachedTotals.dagerKrevd - cachedTotals.dagerGodkjent} dager</span>
                  </div>
                  {cachedTotals.dagerKrevd > 0 && (
                    <div className="pt-2">
                      <ProgressBar value={(cachedTotals.dagerGodkjent / cachedTotals.dagerKrevd) * 100} color="bg-badge-success-bg" />
                      <span className="text-xs text-pkt-text-body-subtle">{((cachedTotals.dagerGodkjent / cachedTotals.dagerKrevd) * 100).toFixed(1)}% godkjent</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* Category Distribution (from cached data) */}
      {koeCases.length > 0 && (
        <section>
          <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">
            KOE-saker: Kategorifordeling
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {/* By Hovedkategori */}
            <Card variant="outlined" padding="md">
              <h4 className="text-body-md font-semibold mb-4">Etter hovedkategori</h4>
              <SimpleBarChart
                data={Object.entries(byHovedkategori)
                  .sort(([, a], [, b]) => b - a)
                  .map(([kat, count]) => ({
                    label: getHovedkategoriLabel(kat),
                    value: count,
                    color: kat === 'ENDRING' ? 'bg-oslo-blue' : kat === 'SVIKT' ? 'bg-badge-warning-bg' : kat === 'FORCE_MAJEURE' ? 'bg-badge-error-bg' : 'bg-pkt-grays-gray-400',
                  }))}
              />
            </Card>

            {/* By Underkategori (top 8) */}
            <Card variant="outlined" padding="md">
              <h4 className="text-body-md font-semibold mb-4">Etter underkategori (topp 8)</h4>
              <SimpleBarChart
                data={Object.entries(byUnderkategori)
                  .filter(([kat]) => kat !== 'UKJENT')
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([kat, count]) => ({
                    label: getUnderkategoriLabel(kat),
                    value: count,
                    color: 'bg-oslo-blue',
                  }))}
              />
            </Card>
          </div>
        </section>
      )}
    </AnalyticsSection>
  );
}
