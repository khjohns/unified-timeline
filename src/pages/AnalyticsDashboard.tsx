/**
 * AnalyticsDashboard Page
 *
 * Demonstrates how event-sourced data from Supabase can be aggregated
 * and visualized for project and portfolio analysis - similar to
 * Power BI dashboards against Dataverse.
 *
 * The dashboard is organized into logical analysis methods:
 * - Porteføljeanalyse: Overview KPIs and status distribution
 * - Kategorianalyse: Breakdown by ground categories
 * - Trendanalyse: Activity over time
 * - Økonomisk analyse: Vederlag and frist/dagmulkt analysis
 * - Ytelsesanalyse: Response time metrics
 * - Ressursanalyse: Actor and workload analysis
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Button, Tabs, DropdownMenuItem } from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import { InlineLoading } from '../components/PageStateHelpers';
import { useAuth } from '../context/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import {
  useAnalyticsSummary,
  useCategoryAnalytics,
  useTimelineAnalytics,
  useVederlagAnalytics,
  useFristAnalytics,
  useResponseTimesAnalytics,
  useActorAnalytics,
} from '../hooks/useAnalytics';

// Analysis method components
import {
  PortefoljeAnalyse,
  KategoriAnalyse,
  TrendAnalyse,
  OkonomiskAnalyse,
  YtelsesAnalyse,
  RessursAnalyse,
} from '../components/analytics';

// ============================================================
// Analysis Method Tabs Configuration
// ============================================================

const ANALYSIS_TABS = [
  { id: 'portefolje', label: 'Portefølje', shortLabel: 'Portef.' },
  { id: 'kategori', label: 'Kategorier', shortLabel: 'Kateg.' },
  { id: 'trend', label: 'Trender' },
  { id: 'okonomi', label: 'Økonomi', shortLabel: 'Økon.' },
  { id: 'ytelse', label: 'Ytelse' },
  { id: 'ressurs', label: 'Ressurser', shortLabel: 'Ressurs' },
] as const;

type AnalysisTab = typeof ANALYSIS_TABS[number]['id'];

// ============================================================
// Main Component
// ============================================================

export function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { isVerifying } = useAuth();
  const { userRole, setUserRole } = useUserRole();
  const [activeTab, setActiveTab] = useState<AnalysisTab>('portefolje');
  const [timelinePeriod, setTimelinePeriod] = useState<'day' | 'week' | 'month'>('week');

  // Fetch all analytics data
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary({ enabled: !isVerifying });
  const { data: categories, isLoading: categoriesLoading } = useCategoryAnalytics({ enabled: !isVerifying });
  const { data: timeline, isLoading: timelineLoading } = useTimelineAnalytics(timelinePeriod, 90, { enabled: !isVerifying });
  const { data: vederlag, isLoading: vederlagLoading } = useVederlagAnalytics({ enabled: !isVerifying });
  const { data: frist, isLoading: fristLoading } = useFristAnalytics({ enabled: !isVerifying });
  const { data: responseTimes, isLoading: responseTimesLoading } = useResponseTimesAnalytics({ enabled: !isVerifying });
  const { data: actors, isLoading: actorsLoading } = useActorAnalytics({ enabled: !isVerifying });

  const isLoading = summaryLoading || categoriesLoading || timelineLoading || vederlagLoading || fristLoading || responseTimesLoading || actorsLoading || isVerifying;

  // Render active analysis method
  const renderAnalysisContent = () => {
    switch (activeTab) {
      case 'portefolje':
        return <PortefoljeAnalyse summary={summary} />;
      case 'kategori':
        return <KategoriAnalyse categories={categories} />;
      case 'trend':
        return (
          <TrendAnalyse
            timeline={timeline}
            period={timelinePeriod}
            onPeriodChange={setTimelinePeriod}
          />
        );
      case 'okonomi':
        return <OkonomiskAnalyse vederlag={vederlag} frist={frist} />;
      case 'ytelse':
        return <YtelsesAnalyse responseTimes={responseTimes} />;
      case 'ressurs':
        return <RessursAnalyse actors={actors} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      {/* Header - uses shared PageHeader component */}
      <PageHeader
        title="Analysedashboard"
        subtitle="Prosjekt- og porteføljeoversikt basert på hendelsesdata"
        userRole={userRole}
        onToggleRole={setUserRole}
        menuActions={
          <DropdownMenuItem asChild>
            <Link to="/saker">Saksoversikt</Link>
          </DropdownMenuItem>
        }
      />

      {/* Analysis Method Navigation */}
      <div className="bg-pkt-bg-card border-b border-pkt-border-subtle">
        <div className="max-w-3xl mx-auto px-4 sm:px-8">
          <Tabs
            tabs={ANALYSIS_TABS.map(tab => ({ id: tab.id, label: tab.label, shortLabel: 'shortLabel' in tab ? tab.shortLabel : undefined }))}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as AnalysisTab)}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-2 pt-2 pb-4 sm:px-4 sm:pt-3 sm:pb-6 min-h-[calc(100vh-88px)] space-y-4">
        {isLoading ? (
          <Card variant="outlined" padding="lg">
            <InlineLoading message="Laster analysedata..." />
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Active Analysis Method */}
            {renderAnalysisContent()}

            {/* Info Box */}
            <section aria-labelledby="info-heading">
              <Card variant="outlined" padding="md">
                <h3 id="info-heading" className="text-base font-semibold text-pkt-text-body-dark mb-2">Om analysemetodene</h3>
                <p className="text-sm text-pkt-text-body-default mb-3">
                  Dette dashboardet demonstrerer hvordan data lagret i Supabase via event sourcing kan
                  aggregeres og visualiseres for prosjekt- og porteføljeanalyse. Tilsvarende funksjonalitet
                  kan bygges med Power BI mot Dataverse i en produksjonsløsning.
                </p>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong className="text-pkt-text-body-dark">Analysemetoder:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-pkt-text-body-subtle">
                      <li><strong>Portefølje:</strong> Overordnet KPI-er og statusfordeling</li>
                      <li><strong>Kategorier:</strong> Analyse per grunnlagskategori</li>
                      <li><strong>Trender:</strong> Aktivitet og mønstre over tid</li>
                    </ul>
                  </div>
                  <div>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-pkt-text-body-subtle">
                      <li><strong>Økonomi:</strong> Vederlag og frist/dagmulkt</li>
                      <li><strong>Ytelse:</strong> Behandlingstider og effektivitet</li>
                      <li><strong>Ressurser:</strong> Aktører og arbeidsbelastning</li>
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

export default AnalyticsDashboard;
