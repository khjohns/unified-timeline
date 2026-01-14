/**
 * MappingDetailPage
 *
 * Detail page for a sync mapping with tabs:
 * - Oversikt: Configuration and sync actions
 * - Historikk: Sync history with TaskSyncRecords
 * - Tasks: Dalux tasks preview
 * - Forms: Dalux forms browser
 *
 * Route: /integrasjoner/:id
 */

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Card, Tabs, Alert, Button } from '../components/primitives';
import { useSyncMapping } from '../hooks/useSyncMappings';
import { MappingOverviewTab } from '../components/integrasjoner/MappingOverviewTab';
import { MappingHistoryTab } from '../components/integrasjoner/MappingHistoryTab';
import { MappingTasksTab } from '../components/integrasjoner/MappingTasksTab';
import { MappingFormsTab } from '../components/integrasjoner/MappingFormsTab';
import { EditSyncMappingModal } from '../components/integrasjoner/EditSyncMappingModal';
import { SyncProgressModal } from '../components/integrasjoner/SyncProgressModal';

const TABS = [
  { id: 'oversikt', label: 'Oversikt' },
  { id: 'historikk', label: 'Historikk' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'forms', label: 'Forms' },
];

export function MappingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: mapping, isLoading, error, refetch } = useSyncMapping(id || '');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showSyncProgressModal, setShowSyncProgressModal] = useState(false);

  // Get active tab from URL or default to 'oversikt'
  const activeTab = searchParams.get('tab') || 'oversikt';

  // Validate tab param
  useEffect(() => {
    const validTabs = TABS.map((t) => t.id);
    if (!validTabs.includes(activeTab)) {
      setSearchParams({ tab: 'oversikt' }, { replace: true });
    }
  }, [activeTab, setSearchParams]);

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  const handleTriggerSync = () => {
    setShowSyncProgressModal(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle">
        <PageHeader
          title="Laster..."
          subtitle=""
          maxWidth="wide"
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate('/integrasjoner')}>
              Tilbake
            </Button>
          }
        />
        <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <Card variant="outlined" padding="lg">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oslo-blue" />
              <span className="ml-3 text-pkt-text-body-subtle">Laster mapping...</span>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Error state
  if (error || !mapping) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle">
        <PageHeader
          title="Feil"
          subtitle=""
          maxWidth="wide"
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate('/integrasjoner')}>
              Tilbake
            </Button>
          }
        />
        <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <Alert variant="danger">
            {error ? `Kunne ikke laste mapping: ${error.message}` : 'Mapping ikke funnet'}
          </Alert>
          <div className="mt-4">
            <Link to="/integrasjoner" className="text-sm text-oslo-blue hover:underline">
              Tilbake til integrasjoner
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      <PageHeader
        title={mapping.project_id}
        subtitle={`Dalux ${mapping.dalux_project_id} → Catenda`}
        maxWidth="wide"
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate('/integrasjoner')}>
            Tilbake
          </Button>
        }
      />

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* Tabs */}
        <Tabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          className="mb-6"
        />

        {/* Tab Content */}
        {activeTab === 'oversikt' && (
          <MappingOverviewTab
            mapping={mapping}
            onEdit={() => setShowEditModal(true)}
            onTriggerSync={handleTriggerSync}
            onFiltersUpdated={() => refetch()}
          />
        )}

        {activeTab === 'historikk' && mapping.id && (
          <MappingHistoryTab mappingId={mapping.id} />
        )}

        {activeTab === 'tasks' && mapping.id && (
          <MappingTasksTab mappingId={mapping.id} />
        )}

        {activeTab === 'forms' && mapping.id && (
          <MappingFormsTab mappingId={mapping.id} />
        )}
      </main>

      {/* Modals */}
      {showEditModal && (
        <EditSyncMappingModal
          mapping={mapping}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showSyncProgressModal && mapping.id && (
        <SyncProgressModal
          mappingId={mapping.id}
          onClose={() => setShowSyncProgressModal(false)}
        />
      )}
    </div>
  );
}

export default MappingDetailPage;
