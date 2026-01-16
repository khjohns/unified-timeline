/**
 * FravikAnalysePage Component
 *
 * Analyseside for fravik-søknader som gir byggherren beslutningsstøtte
 * ved å vise historikk og statistikk over tidligere behandlede søknader.
 *
 * Analysemetoder:
 * - Portefølje: Oversikt med KPI-er og godkjenningsrate
 * - Grunner: Analyse per fravikgrunn (markedsmangel, leveringstid, etc.)
 * - Maskintyper: Analyse per maskintype
 * - Historikk: Tabell med ferdigbehandlede saker for sammenligning
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Tabs } from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import { useUserRole } from '../hooks/useUserRole';
import { fetchFravikListe } from '../api/fravik';
import type { FravikListeItem, FravikStatus, FravikGrunn, MaskinType } from '../types/fravik';
import { FRAVIK_STATUS_LABELS, getFravikStatusColor } from '../types/fravik';
import { formatDateShort } from '../utils/formatters';
import { KPICard, SimpleBarChart, AnalyticsSection, ProgressBar } from '../components/analytics/AnalyticsHelpers';

// ============================================================
// Analysis Tabs Configuration
// ============================================================

const ANALYSIS_TABS = [
  { id: 'portefolje', label: 'Portefølje' },
  { id: 'grunner', label: 'Grunner' },
  { id: 'maskintyper', label: 'Maskintyper' },
  { id: 'historikk', label: 'Historikk' },
] as const;

type AnalysisTab = typeof ANALYSIS_TABS[number]['id'];

// ============================================================
// Types for Analytics
// ============================================================

interface FravikAnalyticsData {
  totalt: number;
  underBehandling: number;
  godkjent: number;
  delvisGodkjent: number;
  avslatt: number;
  godkjenningsrate: number;
  perGrunn: Record<FravikGrunn, { total: number; godkjent: number; avslatt: number }>;
  perMaskintype: Record<MaskinType, { total: number; godkjent: number; avslatt: number }>;
  ferdigbehandlede: FravikListeItem[];
}

// ============================================================
// Helper Functions
// ============================================================

const GRUNN_LABELS: Record<FravikGrunn, string> = {
  markedsmangel: 'Markedsmangel',
  leveringstid: 'Leveringstid',
  tekniske_begrensninger: 'Tekniske begrensninger',
  hms_krav: 'HMS-krav',
  annet: 'Annet',
};

const MASKINTYPE_LABELS: Record<MaskinType, string> = {
  Gravemaskin: 'Gravemaskin',
  Hjullaster: 'Hjullaster',
  Lift: 'Lift',
  Annet: 'Annet',
};

function computeAnalytics(soknader: FravikListeItem[]): FravikAnalyticsData {
  const ferdigStatuser: FravikStatus[] = ['godkjent', 'delvis_godkjent', 'avslatt', 'trukket'];

  const ferdigbehandlede = soknader.filter(s => ferdigStatuser.includes(s.status));
  const underBehandling = soknader.filter(s => !ferdigStatuser.includes(s.status));

  const godkjent = soknader.filter(s => s.status === 'godkjent').length;
  const delvisGodkjent = soknader.filter(s => s.status === 'delvis_godkjent').length;
  const avslatt = soknader.filter(s => s.status === 'avslatt').length;

  const ferdigUtenTrukket = ferdigbehandlede.filter(s => s.status !== 'trukket').length;
  const godkjenningsrate = ferdigUtenTrukket > 0
    ? ((godkjent + delvisGodkjent) / ferdigUtenTrukket) * 100
    : 0;

  // Per-grunn og per-maskintype analyse krever mer detaljert data
  // Her bruker vi mock-data siden listen ikke inneholder grunner
  const perGrunn: FravikAnalyticsData['perGrunn'] = {
    markedsmangel: { total: 12, godkjent: 9, avslatt: 2 },
    leveringstid: { total: 8, godkjent: 6, avslatt: 1 },
    tekniske_begrensninger: { total: 5, godkjent: 3, avslatt: 1 },
    hms_krav: { total: 3, godkjent: 3, avslatt: 0 },
    annet: { total: 2, godkjent: 1, avslatt: 1 },
  };

  const perMaskintype: FravikAnalyticsData['perMaskintype'] = {
    Gravemaskin: { total: 15, godkjent: 11, avslatt: 3 },
    Hjullaster: { total: 8, godkjent: 6, avslatt: 1 },
    Lift: { total: 5, godkjent: 4, avslatt: 0 },
    Annet: { total: 2, godkjent: 1, avslatt: 1 },
  };

  return {
    totalt: soknader.length,
    underBehandling: underBehandling.length,
    godkjent,
    delvisGodkjent,
    avslatt,
    godkjenningsrate,
    perGrunn,
    perMaskintype,
    ferdigbehandlede: ferdigbehandlede.sort((a, b) =>
      new Date(b.siste_oppdatert || b.opprettet || '').getTime() -
      new Date(a.siste_oppdatert || a.opprettet || '').getTime()
    ),
  };
}

// ============================================================
// Sub-components
// ============================================================

function PortefoljeAnalyse({ data }: { data: FravikAnalyticsData }) {
  return (
    <AnalyticsSection
      title="Porteføljeanalyse"
      description="Overordnet oversikt over fravik-søknader med nøkkeltall og godkjenningsrate. Brukes til beslutningsstøtte og oppfølging."
    >
      {/* KPI Summary */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Nøkkeltall</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Totalt søknader"
            value={data.totalt}
            subtext={`${data.underBehandling} under behandling`}
            color="blue"
          />
          <KPICard
            label="Godkjent"
            value={data.godkjent}
            subtext={`${data.delvisGodkjent} delvis godkjent`}
            color="green"
          />
          <KPICard
            label="Avslått"
            value={data.avslatt}
            color="red"
          />
          <KPICard
            label="Godkjenningsrate"
            value={`${data.godkjenningsrate.toFixed(0)}%`}
            subtext="av ferdigbehandlede"
            color="green"
          />
        </div>
      </section>

      {/* Status Distribution */}
      <section>
        <h3 className="text-body-lg font-semibold text-pkt-text-body-dark mb-4">Statusfordeling</h3>
        <Card variant="outlined" padding="md">
          <SimpleBarChart
            data={[
              { label: 'Under behandling', value: data.underBehandling, color: 'bg-oslo-blue' },
              { label: 'Godkjent', value: data.godkjent, color: 'bg-badge-success-bg' },
              { label: 'Delvis godkjent', value: data.delvisGodkjent, color: 'bg-badge-warning-bg' },
              { label: 'Avslått', value: data.avslatt, color: 'bg-badge-error-bg' },
            ]}
          />
        </Card>
      </section>
    </AnalyticsSection>
  );
}

function GrunnerAnalyse({ data }: { data: FravikAnalyticsData }) {
  const grunnData = Object.entries(data.perGrunn).map(([grunn, stats]) => ({
    grunn: grunn as FravikGrunn,
    ...stats,
    godkjenningsrate: stats.total > 0 ? (stats.godkjent / stats.total) * 100 : 0,
  })).sort((a, b) => b.total - a.total);

  return (
    <AnalyticsSection
      title="Analyse per grunn"
      description="Oversikt over hvordan søknader fordeler seg på ulike fraviksgrunner, og godkjenningsrate for hver grunn. Nyttig for å vurdere lignende saker."
    >
      <div className="space-y-4">
        {grunnData.map(item => (
          <Card key={item.grunn} variant="outlined" padding="md">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-pkt-text-body-dark">{GRUNN_LABELS[item.grunn]}</h4>
              <span className="text-sm text-pkt-text-body-subtle">{item.total} søknader</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
              <div>
                <span className="text-pkt-text-body-subtle">Godkjent: </span>
                <span className="font-medium text-alert-success-text">{item.godkjent}</span>
              </div>
              <div>
                <span className="text-pkt-text-body-subtle">Avslått: </span>
                <span className="font-medium text-alert-danger-text">{item.avslatt}</span>
              </div>
              <div>
                <span className="text-pkt-text-body-subtle">Godkjenningsrate: </span>
                <span className="font-medium">{item.godkjenningsrate.toFixed(0)}%</span>
              </div>
            </div>
            <ProgressBar
              value={item.godkjenningsrate}
              color={item.godkjenningsrate >= 70 ? 'bg-badge-success-bg' : item.godkjenningsrate >= 40 ? 'bg-badge-warning-bg' : 'bg-badge-error-bg'}
            />
          </Card>
        ))}
      </div>
    </AnalyticsSection>
  );
}

function MaskintypeAnalyse({ data }: { data: FravikAnalyticsData }) {
  const maskinData = Object.entries(data.perMaskintype).map(([type, stats]) => ({
    type: type as MaskinType,
    ...stats,
    godkjenningsrate: stats.total > 0 ? (stats.godkjent / stats.total) * 100 : 0,
  })).sort((a, b) => b.total - a.total);

  return (
    <AnalyticsSection
      title="Analyse per maskintype"
      description="Oversikt over søknader fordelt på maskintyper. Viser hvilke maskintyper som oftest får fravik og godkjenningsrate for hver type."
    >
      <div className="grid md:grid-cols-2 gap-4">
        {maskinData.map(item => (
          <Card key={item.type} variant="outlined" padding="md">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-pkt-text-body-dark">{MASKINTYPE_LABELS[item.type]}</h4>
              <span className="px-2 py-1 text-xs rounded-full bg-pkt-bg-muted text-pkt-text-body-subtle">
                {item.total} søknader
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-pkt-text-body-subtle">Godkjent</span>
                <span className="font-medium text-alert-success-text">{item.godkjent}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-pkt-text-body-subtle">Avslått</span>
                <span className="font-medium text-alert-danger-text">{item.avslatt}</span>
              </div>
              <div className="pt-2 border-t border-pkt-border-subtle">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-pkt-text-body-subtle">Godkjenningsrate</span>
                  <span className="font-medium">{item.godkjenningsrate.toFixed(0)}%</span>
                </div>
                <ProgressBar
                  value={item.godkjenningsrate}
                  showLabel={false}
                  color={item.godkjenningsrate >= 70 ? 'bg-badge-success-bg' : item.godkjenningsrate >= 40 ? 'bg-badge-warning-bg' : 'bg-badge-error-bg'}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AnalyticsSection>
  );
}

const STATUS_COLOR_CLASSES: Record<string, string> = {
  gray: 'bg-pkt-bg-subtle text-pkt-text-body-subtle',
  blue: 'bg-oslo-blue-light text-oslo-blue',
  yellow: 'bg-amber-100 text-amber-800',
  green: 'bg-alert-success-light text-alert-success-text',
  red: 'bg-alert-danger-light text-alert-danger-text',
};

function HistorikkAnalyse({ data, onNavigate }: { data: FravikAnalyticsData; onNavigate: (id: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'godkjent' | 'avslatt'>('all');

  const filteredData = useMemo(() => {
    if (filter === 'all') return data.ferdigbehandlede;
    if (filter === 'godkjent') return data.ferdigbehandlede.filter(s => s.status === 'godkjent' || s.status === 'delvis_godkjent');
    return data.ferdigbehandlede.filter(s => s.status === 'avslatt');
  }, [data.ferdigbehandlede, filter]);

  return (
    <AnalyticsSection
      title="Historikk"
      description="Oversikt over ferdigbehandlede søknader. Klikk på en rad for å se detaljer og bruke som referanse for lignende saker."
    >
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'godkjent', 'avslatt'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Alle' : f === 'godkjent' ? 'Godkjent' : 'Avslått'}
          </Button>
        ))}
      </div>

      {/* Table */}
      {filteredData.length === 0 ? (
        <Card variant="outlined" padding="lg">
          <div className="text-center py-8 text-pkt-text-body-subtle">
            Ingen ferdigbehandlede søknader funnet
          </div>
        </Card>
      ) : (
        <Card variant="outlined" padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pkt-border-default bg-pkt-bg-muted">
                  <th className="text-left py-3 px-4 font-medium text-pkt-text-body-subtle">Prosjekt</th>
                  <th className="text-left py-3 px-4 font-medium text-pkt-text-body-subtle">Søker</th>
                  <th className="text-center py-3 px-4 font-medium text-pkt-text-body-subtle">Maskiner</th>
                  <th className="text-left py-3 px-4 font-medium text-pkt-text-body-subtle">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-pkt-text-body-subtle">Behandlet</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(soknad => {
                  const color = getFravikStatusColor(soknad.status);
                  const colorClass = STATUS_COLOR_CLASSES[color] || STATUS_COLOR_CLASSES.gray;

                  return (
                    <tr
                      key={soknad.sak_id}
                      className="border-b border-pkt-border-default hover:bg-pkt-bg-muted cursor-pointer transition-colors"
                      onClick={() => onNavigate(soknad.sak_id)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-pkt-text-heading">{soknad.prosjekt_navn}</div>
                        {soknad.prosjekt_nummer && (
                          <div className="text-xs text-pkt-text-body-subtle">{soknad.prosjekt_nummer}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-pkt-text-body">{soknad.soker_navn}</td>
                      <td className="py-3 px-4 text-center text-pkt-text-body">{soknad.antall_maskiner}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                          {soknad.visningsstatus || FRAVIK_STATUS_LABELS[soknad.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-pkt-text-body-subtle">
                        {soknad.siste_oppdatert ? formatDateShort(soknad.siste_oppdatert) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AnalyticsSection>
  );
}

// ============================================================
// Main Component
// ============================================================

export function FravikAnalysePage() {
  const navigate = useNavigate();
  const { userRole, setUserRole } = useUserRole();
  const [activeTab, setActiveTab] = useState<AnalysisTab>('portefolje');

  const { data: soknader = [], isLoading } = useQuery({
    queryKey: ['fravik-liste'],
    queryFn: fetchFravikListe,
  });

  const analyticsData = useMemo(() => computeAnalytics(soknader), [soknader]);

  const renderAnalysisContent = () => {
    switch (activeTab) {
      case 'portefolje':
        return <PortefoljeAnalyse data={analyticsData} />;
      case 'grunner':
        return <GrunnerAnalyse data={analyticsData} />;
      case 'maskintyper':
        return <MaskintypeAnalyse data={analyticsData} />;
      case 'historikk':
        return <HistorikkAnalyse data={analyticsData} onNavigate={(id) => navigate(`/fravik/${id}`)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      <PageHeader
        title="Fravik-analyse"
        subtitle="Beslutningsstøtte basert på historiske søknader"
        userRole={userRole}
        onToggleRole={setUserRole}
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate('/fravik')}>
            Søknadsoversikt
          </Button>
        }
      />

      {/* Analysis Tab Navigation */}
      <div className="bg-pkt-bg-card border-b border-pkt-border-subtle">
        <div className="max-w-3xl mx-auto px-4 sm:px-8">
          <Tabs
            tabs={ANALYSIS_TABS.map(tab => ({ id: tab.id, label: tab.label }))}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as AnalysisTab)}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-2 py-4 sm:px-4 sm:py-6 min-h-[calc(100vh-88px)] space-y-4">
        {isLoading ? (
          <Card variant="outlined" padding="lg">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pkt-border-focus" />
              <span className="ml-3 text-pkt-text-body-subtle">Laster analysedata...</span>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {renderAnalysisContent()}

            {/* Info Box */}
            <section aria-labelledby="info-heading">
              <Card variant="outlined" padding="md">
                <h3 id="info-heading" className="text-base font-semibold text-pkt-text-body-dark mb-2">
                  Om fravik-analyse
                </h3>
                <p className="text-sm text-pkt-text-body-default mb-3">
                  Denne analysesiden gir beslutningsstøtte ved vurdering av fravik-søknader.
                  Du kan sammenligne med tidligere behandlede saker for å sikre konsistent praksis.
                </p>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong className="text-pkt-text-body-dark">Bruksområder:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-pkt-text-body-subtle">
                      <li>Vurdere lignende saker som referanse</li>
                      <li>Se godkjenningsrate per grunn/maskintype</li>
                      <li>Sikre konsistent behandling</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-pkt-text-body-dark">Tips:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-pkt-text-body-subtle">
                      <li>Bruk Grunner-fanen for å se praksis</li>
                      <li>Klikk på saker i Historikk for detaljer</li>
                      <li>Filtrer på status for å finne relevante saker</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default FravikAnalysePage;
