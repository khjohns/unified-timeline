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
import { useNavigate } from 'react-router-dom';
import { Card, Button, Tabs } from '../components/primitives';
import { useAuth } from '../context/AuthContext';
import {
  useAnalyticsSummary,
  useCategoryAnalytics,
  useTimelineAnalytics,
  useVederlagAnalytics,
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
  { id: 'portefolje', label: 'Portefølje' },
  { id: 'kategori', label: 'Kategorier' },
  { id: 'trend', label: 'Trender' },
  { id: 'okonomi', label: 'Økonomi' },
  { id: 'ytelse', label: 'Ytelse' },
  { id: 'ressurs', label: 'Ressurser' },
] as const;

type AnalysisTab = typeof ANALYSIS_TABS[number]['id'];

// ============================================================
// Main Component
// ============================================================

export function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { isVerifying } = useAuth();
  const [activeTab, setActiveTab] = useState<AnalysisTab>('portefolje');
  const [timelinePeriod, setTimelinePeriod] = useState<'day' | 'week' | 'month'>('week');

  // Fetch all analytics data
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary({ enabled: !isVerifying });
  const { data: categories, isLoading: categoriesLoading } = useCategoryAnalytics({ enabled: !isVerifying });
  const { data: timeline, isLoading: timelineLoading } = useTimelineAnalytics(timelinePeriod, 90, { enabled: !isVerifying });
  const { data: vederlag, isLoading: vederlagLoading } = useVederlagAnalytics({ enabled: !isVerifying });
  const { data: responseTimes, isLoading: responseTimesLoading } = useResponseTimesAnalytics({ enabled: !isVerifying });
  const { data: actors, isLoading: actorsLoading } = useActorAnalytics({ enabled: !isVerifying });

  const isLoading = summaryLoading || categoriesLoading || timelineLoading || vederlagLoading || responseTimesLoading || actorsLoading || isVerifying;

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
        return <OkonomiskAnalyse vederlag={vederlag} responseTimes={responseTimes} />;
      case 'ytelse':
        return <YtelsesAnalyse responseTimes={responseTimes} />;
      case 'ressurs':
        return <RessursAnalyse actors={actors} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-pkt-bg-default">
      {/* Header */}
      <header className="bg-pkt-bg-card shadow-sm border-b-2 border-oslo-blue">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-heading-lg font-bold text-oslo-blue">Analysedashboard</h1>
              <p className="mt-2 text-body-md text-pkt-grays-gray-600">
                Prosjekt- og porteføljeoversikt basert på hendelsesdata
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <Button variant="secondary" size="sm" onClick={() => navigate('/saker')}>
                Saksoversikt
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Analysis Method Navigation */}
      <div className="bg-pkt-bg-card border-b border-pkt-border-default">
        <div className="max-w-7xl mx-auto px-6">
          <Tabs
            tabs={ANALYSIS_TABS.map(tab => ({ id: tab.id, label: tab.label }))}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as AnalysisTab)}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <Card variant="default" padding="lg">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oslo-blue" />
              <span className="ml-3 text-pkt-grays-gray-600">Laster analysedata...</span>
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Active Analysis Method */}
            {renderAnalysisContent()}

            {/* Info Box */}
            <section>
              <Card variant="default" padding="md" className="bg-blue-50 border border-blue-200">
                <h3 className="text-body-lg font-semibold text-oslo-blue mb-2">Om analysemetodene</h3>
                <p className="text-sm text-pkt-grays-gray-700 mb-3">
                  Dette dashboardet demonstrerer hvordan data lagret i Supabase via event sourcing kan
                  aggregeres og visualiseres for prosjekt- og porteføljeanalyse. Tilsvarende funksjonalitet
                  kan bygges med Power BI mot Dataverse i en produksjonsløsning.
                </p>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong className="text-pkt-grays-gray-800">Analysemetoder:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-pkt-grays-gray-600">
                      <li><strong>Portefølje:</strong> Overordnet KPI-er og statusfordeling</li>
                      <li><strong>Kategorier:</strong> Analyse per grunnlagskategori</li>
                      <li><strong>Trender:</strong> Aktivitet og mønstre over tid</li>
                    </ul>
                  </div>
                  <div>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-pkt-grays-gray-600">
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
