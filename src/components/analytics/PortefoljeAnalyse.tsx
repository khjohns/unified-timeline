/**
 * Porteføljeanalyse Component
 *
 * Analysemetode: Overordnet porteføljeoversikt
 * Bruksområde: Ledelsesrapportering, KPI-er og totaloversikt
 */

import { Card } from '../primitives';
import { KPICard, SimpleBarChart, formatCurrency, AnalyticsSection } from './AnalyticsHelpers';
import type { AnalyticsSummary } from '../../api/analytics';

interface PortefoljeAnalyseProps {
  summary: AnalyticsSummary | undefined;
}

export function PortefoljeAnalyse({ summary }: PortefoljeAnalyseProps) {
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
    </AnalyticsSection>
  );
}
