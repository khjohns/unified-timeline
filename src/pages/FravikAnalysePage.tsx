/**
 * FravikAnalysePage Component
 *
 * Analyseside for fravik-søknader som gir byggherren beslutningsstøtte
 * ved å vise historikk og statistikk over tidligere behandlede søknader.
 *
 * Formål:
 * Digitalisering av fravik-søknader gjør det mulig å sammenligne med
 * tidligere og lignende saker. For eksempel kan man vurdere under hvilke
 * situasjoner man har godkjent fravik for bestemte maskintyper fra kravet
 * om utslippsfri teknologi.
 *
 * Analysemetoder:
 * - Portefølje: Oversikt med KPI-er og godkjenningsrate
 * - Søknadstyper: Fordeling mellom maskin- og infrastruktur-søknader
 * - Grunner: Analyse per fravikgrunn (maskin-søknader)
 * - Maskintyper: Analyse per maskintype
 * - Historikk: Tabell med ferdigbehandlede saker for sammenligning
 */

import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Card, Button, Tabs, Alert, Table, DropdownMenuItem, type Column } from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import { useUserRole } from '../hooks/useUserRole';
import { fetchFravikListe } from '../api/fravik';
import type { FravikListeItem, FravikStatus, FravikGrunn, MaskinType, SoknadType } from '../types/fravik';
import { FRAVIK_STATUS_LABELS, getFravikStatusColor } from '../types/fravik';
import { formatDateShort } from '../utils/formatters';
import { KPICard, SimpleBarChart, AnalyticsSection, ProgressBar } from '../components/analytics/AnalyticsHelpers';

// ============================================================
// Analysis Tabs Configuration
// ============================================================

const ANALYSIS_TABS = [
  { id: 'portefolje', label: 'Portefølje' },
  { id: 'soknadstyper', label: 'Søknadstyper' },
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
  perSoknadstype: Record<SoknadType, { total: number; godkjent: number; avslatt: number; underBehandling: number }>;
  perGrunn: Record<FravikGrunn, { total: number; godkjent: number; avslatt: number }>;
  perMaskintype: Partial<Record<MaskinType, { total: number; godkjent: number; avslatt: number }>>;
  ferdigbehandlede: FravikListeItem[];
  maskinSoknader: FravikListeItem[];
  infrastrukturSoknader: FravikListeItem[];
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

const MASKINTYPE_LABELS: Partial<Record<MaskinType, string>> = {
  Gravemaskin: 'Gravemaskin',
  Hjullaster: 'Hjullaster',
  Lift: 'Lift',
  Annet: 'Annet',
};

const SOKNADSTYPE_LABELS: Record<SoknadType, string> = {
  machine: 'Maskin',
  infrastructure: 'Infrastruktur',
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

  // Per søknadstype
  const maskinSoknader = soknader.filter(s => s.soknad_type === 'machine');
  const infrastrukturSoknader = soknader.filter(s => s.soknad_type === 'infrastructure');

  const perSoknadstype: FravikAnalyticsData['perSoknadstype'] = {
    machine: {
      total: maskinSoknader.length,
      godkjent: maskinSoknader.filter(s => s.status === 'godkjent' || s.status === 'delvis_godkjent').length,
      avslatt: maskinSoknader.filter(s => s.status === 'avslatt').length,
      underBehandling: maskinSoknader.filter(s => !ferdigStatuser.includes(s.status)).length,
    },
    infrastructure: {
      total: infrastrukturSoknader.length,
      godkjent: infrastrukturSoknader.filter(s => s.status === 'godkjent' || s.status === 'delvis_godkjent').length,
      avslatt: infrastrukturSoknader.filter(s => s.status === 'avslatt').length,
      underBehandling: infrastrukturSoknader.filter(s => !ferdigStatuser.includes(s.status)).length,
    },
  };

  // Per-grunn og per-maskintype analyse krever mer detaljert data
  // I en fullstendig implementasjon vil dette hentes fra aggregert backend-data
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
    perSoknadstype,
    perGrunn,
    perMaskintype,
    ferdigbehandlede: ferdigbehandlede.sort((a, b) =>
      new Date(b.siste_oppdatert || b.opprettet || '').getTime() -
      new Date(a.siste_oppdatert || a.opprettet || '').getTime()
    ),
    maskinSoknader,
    infrastrukturSoknader,
  };
}

// ============================================================
// Sub-components
// ============================================================

function PortefoljeAnalyse({ data }: { data: FravikAnalyticsData }) {
  return (
    <AnalyticsSection
      title="Porteføljeanalyse"
      description="Overordnet oversikt over alle fravik-søknader med nøkkeltall og godkjenningsrate. Gir et raskt bilde av status på tvers av prosjekter."
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

function SoknadstypeAnalyse({ data }: { data: FravikAnalyticsData }) {
  const maskin = data.perSoknadstype.machine;
  const infra = data.perSoknadstype.infrastructure;

  const maskinGodkjenningsrate = maskin.total > 0
    ? (maskin.godkjent / (maskin.godkjent + maskin.avslatt || 1)) * 100
    : 0;
  const infraGodkjenningsrate = infra.total > 0
    ? (infra.godkjent / (infra.godkjent + infra.avslatt || 1)) * 100
    : 0;

  return (
    <AnalyticsSection
      title="Fordeling per søknadstype"
      description="Oversikt over søknader fordelt på maskin-fravik og infrastruktur-fravik. Maskin-søknader gjelder enkeltmaskiner som ikke oppfyller utslippskrav, mens infrastruktur-søknader gjelder manglende strøm/ladeinfrastruktur."
    >
      <div className="grid md:grid-cols-2 gap-4">
        {/* Maskin */}
        <Card variant="outlined" padding="md">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-pkt-text-body-dark text-lg">Maskin-søknader</h4>
            <span className="px-3 py-1 text-sm rounded-full bg-oslo-blue-light text-oslo-blue font-medium">
              {maskin.total} søknader
            </span>
          </div>
          <p className="text-sm text-pkt-text-body-subtle mb-4">
            Fravik for enkeltmaskiner som ikke oppfyller krav til utslippsfri teknologi.
          </p>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-pkt-text-body-subtle">Under behandling</span>
              <span className="font-medium">{maskin.underBehandling}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-pkt-text-body-subtle">Godkjent</span>
              <span className="font-medium text-pkt-brand-dark-green-1000">{maskin.godkjent}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-pkt-text-body-subtle">Avslått</span>
              <span className="font-medium text-pkt-brand-red-1000">{maskin.avslatt}</span>
            </div>
            <div className="pt-3 border-t border-pkt-border-subtle">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-pkt-text-body-subtle">Godkjenningsrate</span>
                <span className="font-medium">{maskinGodkjenningsrate.toFixed(0)}%</span>
              </div>
              <ProgressBar
                value={maskinGodkjenningsrate}
                showLabel={false}
                color="bg-badge-success-bg"
              />
            </div>
          </div>
        </Card>

        {/* Infrastruktur */}
        <Card variant="outlined" padding="md">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-pkt-text-body-dark text-lg">Infrastruktur-søknader</h4>
            <span className="px-3 py-1 text-sm rounded-full bg-amber-100 text-amber-800 font-medium">
              {infra.total} søknader
            </span>
          </div>
          <p className="text-sm text-pkt-text-body-subtle mb-4">
            Fravik grunnet manglende strøm- eller ladeinfrastruktur på byggeplassen.
          </p>
          {infra.total > 0 ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-pkt-text-body-subtle">Under behandling</span>
                <span className="font-medium">{infra.underBehandling}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-pkt-text-body-subtle">Godkjent</span>
                <span className="font-medium text-pkt-brand-dark-green-1000">{infra.godkjent}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-pkt-text-body-subtle">Avslått</span>
                <span className="font-medium text-pkt-brand-red-1000">{infra.avslatt}</span>
              </div>
              <div className="pt-3 border-t border-pkt-border-subtle">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-pkt-text-body-subtle">Godkjenningsrate</span>
                  <span className="font-medium">{infraGodkjenningsrate.toFixed(0)}%</span>
                </div>
                <ProgressBar
                  value={infraGodkjenningsrate}
                  showLabel={false}
                  color="bg-badge-success-bg"
                />
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-pkt-text-body-subtle bg-pkt-bg-muted rounded-md">
              <InfoCircledIcon className="w-5 h-5 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Ingen infrastruktur-søknader registrert</p>
            </div>
          )}
        </Card>
      </div>

      {/* Forklaring */}
      <Alert variant="info">
        <strong>Merk:</strong> Detaljert analyse per grunn og maskintype (fanene Grunner og Maskintyper) gjelder kun maskin-søknader. Infrastruktur-søknader har egne vurderingskriterier knyttet til strømtilgang og ladekapasitet.
      </Alert>
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
      title="Analyse per grunn (maskin-søknader)"
      description="Oversikt over hvordan maskin-søknader fordeler seg på ulike fraviksgrunner, og godkjenningsrate for hver grunn. Nyttig for å vurdere om lignende begrunnelser har blitt godkjent tidligere."
    >
      <Alert variant="info" className="mb-4">
        Denne analysen viser statistikk for maskin-søknader fordelt på oppgitte grunner for fravik. Bruk dette som referanse når du vurderer nye søknader med tilsvarende begrunnelse.
      </Alert>

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
                <span className="font-medium text-pkt-brand-dark-green-1000">{item.godkjent}</span>
              </div>
              <div>
                <span className="text-pkt-text-body-subtle">Avslått: </span>
                <span className="font-medium text-pkt-brand-red-1000">{item.avslatt}</span>
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
      description="Oversikt over søknader fordelt på maskintyper. Viser hvilke maskintyper som oftest får innvilget fravik og godkjenningsrate for hver type."
    >
      <Alert variant="info" className="mb-4">
        Sammenlign med tidligere beslutninger for samme maskintype. Høy godkjenningsrate kan indikere at det er vanskelig å finne utslippsfrie alternativer for denne maskintypen i markedet.
      </Alert>

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
                <span className="font-medium text-pkt-brand-dark-green-1000">{item.godkjent}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-pkt-text-body-subtle">Avslått</span>
                <span className="font-medium text-pkt-brand-red-1000">{item.avslatt}</span>
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
  green: 'bg-alert-success-light text-pkt-brand-dark-green-1000',
  red: 'bg-alert-danger-light text-pkt-brand-red-1000',
};

function HistorikkAnalyse({ data, onNavigate }: { data: FravikAnalyticsData; onNavigate: (id: string) => void }) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'godkjent' | 'avslatt'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'machine' | 'infrastructure'>('all');

  const filteredData = useMemo(() => {
    let result = data.ferdigbehandlede;

    // Status filter
    if (statusFilter === 'godkjent') {
      result = result.filter(s => s.status === 'godkjent' || s.status === 'delvis_godkjent');
    } else if (statusFilter === 'avslatt') {
      result = result.filter(s => s.status === 'avslatt');
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(s => s.soknad_type === typeFilter);
    }

    return result;
  }, [data.ferdigbehandlede, statusFilter, typeFilter]);

  const columns: Column<FravikListeItem>[] = [
    {
      key: 'prosjekt',
      label: 'Prosjekt',
      render: (soknad) => (
        <div>
          <div className="font-medium text-pkt-text-heading">{soknad.prosjekt_navn}</div>
          {soknad.prosjekt_nummer && (
            <div className="text-xs text-pkt-text-body-subtle">{soknad.prosjekt_nummer}</div>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (soknad) => (
        <span className="text-xs px-2 py-0.5 rounded bg-pkt-bg-subtle text-pkt-text-body-default">
          {SOKNADSTYPE_LABELS[soknad.soknad_type]}
        </span>
      ),
    },
    {
      key: 'soker',
      label: 'Søker',
      render: (soknad) => soknad.soker_navn,
    },
    {
      key: 'maskiner',
      label: 'Maskiner',
      align: 'center',
      render: (soknad) => soknad.soknad_type === 'machine' ? soknad.antall_maskiner : '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (soknad) => {
        const color = getFravikStatusColor(soknad.status);
        const colorClass = STATUS_COLOR_CLASSES[color] || STATUS_COLOR_CLASSES.gray;
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
            {soknad.visningsstatus || FRAVIK_STATUS_LABELS[soknad.status]}
          </span>
        );
      },
    },
    {
      key: 'behandlet',
      label: 'Behandlet',
      render: (soknad) => (
        <span className="text-pkt-text-body-subtle">
          {soknad.siste_oppdatert ? formatDateShort(soknad.siste_oppdatert) : '-'}
        </span>
      ),
    },
  ];

  return (
    <AnalyticsSection
      title="Historikk over ferdigbehandlede søknader"
      description="Oversikt over alle ferdigbehandlede fravik-søknader. Klikk på en rad for å se detaljene og bruke som referanse ved vurdering av lignende saker."
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-sm text-pkt-text-body-subtle block mb-1">Status</label>
          <div className="flex gap-2">
            {(['all', 'godkjent', 'avslatt'] as const).map(f => (
              <Button
                key={f}
                variant={statusFilter === f ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setStatusFilter(f)}
              >
                {f === 'all' ? 'Alle' : f === 'godkjent' ? 'Godkjent' : 'Avslått'}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm text-pkt-text-body-subtle block mb-1">Søknadstype</label>
          <div className="flex gap-2">
            {(['all', 'machine', 'infrastructure'] as const).map(f => (
              <Button
                key={f}
                variant={typeFilter === f ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setTypeFilter(f)}
              >
                {f === 'all' ? 'Alle' : SOKNADSTYPE_LABELS[f]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <Card variant="outlined" padding="none">
        <Table
          columns={columns}
          data={filteredData}
          keyExtractor={(soknad) => soknad.sak_id}
          onRowClick={(soknad) => onNavigate(soknad.sak_id)}
          emptyMessage="Ingen ferdigbehandlede søknader funnet med valgte filtre"
        />
      </Card>
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
      case 'soknadstyper':
        return <SoknadstypeAnalyse data={analyticsData} />;
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
        subtitle="Beslutningsstøtte for vurdering av fravik-søknader basert på historiske data"
        userRole={userRole}
        onToggleRole={setUserRole}
        menuActions={
          <DropdownMenuItem asChild>
            <Link to="/fravik">Søknadsoversikt</Link>
          </DropdownMenuItem>
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
      <main className="max-w-3xl mx-auto px-2 pt-2 pb-4 sm:px-4 sm:pt-3 sm:pb-6 min-h-[calc(100vh-88px)] space-y-4">
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
                  Digitalisering av fravik-søknader gjør det mulig å enkelt sammenligne med tidligere og lignende saker.
                  For eksempel kan du vurdere under hvilke situasjoner det har blitt godkjent fravik for bestemte
                  maskintyper fra kravet om utslippsfri teknologi.
                </p>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong className="text-pkt-text-body-dark">Analysemetoder:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-pkt-text-body-subtle">
                      <li><strong>Portefølje:</strong> Overordnet KPI-er og statusfordeling</li>
                      <li><strong>Søknadstyper:</strong> Maskin vs infrastruktur</li>
                      <li><strong>Grunner:</strong> Statistikk per fravikgrunn</li>
                    </ul>
                  </div>
                  <div>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-pkt-text-body-subtle">
                      <li><strong>Maskintyper:</strong> Godkjenningsrate per type</li>
                      <li><strong>Historikk:</strong> Søkbare ferdigbehandlede saker</li>
                    </ul>
                    <p className="mt-2 text-xs text-pkt-text-body-subtle italic">
                      Tips: Klikk på saker i Historikk-fanen for å se detaljer.
                    </p>
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
