/**
 * IntegrasjonerPage
 *
 * Admin page for managing Dalux-Catenda integrations.
 * Route: /integrasjoner
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import {
  Card,
  Button,
  Badge,
  DataList,
  DataListItem,
  DashboardCard,
  Alert,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/primitives';
import {
  useSyncMappings,
  useDeleteSyncMapping,
  useTriggerSync,
  useToggleSyncEnabled,
  useTestConnection,
} from '../hooks/useSyncMappings';
import { CreateSyncMappingModal } from '../components/integrasjoner/CreateSyncMappingModal';
import { EditSyncMappingModal } from '../components/integrasjoner/EditSyncMappingModal';
import { SyncProgressModal } from '../components/integrasjoner/SyncProgressModal';
import { fetchSyncHistory } from '../api/sync';
import { downloadSyncHistoryExcel } from '../utils/syncExcelExport';
import type { SyncMapping } from '../types/integration';

/**
 * Format date for display.
 */
function formatDate(dateString?: string): string {
  if (!dateString) return 'Aldri';
  const date = new Date(dateString);
  return date.toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get badge variant for sync status.
 */
function getStatusVariant(status?: string): 'success' | 'danger' | 'warning' | 'neutral' {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'danger';
    case 'partial':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function IntegrasjonerPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useSyncMappings();
  const deleteMutation = useDeleteSyncMapping();
  const triggerSyncMutation = useTriggerSync();
  const toggleEnabledMutation = useToggleSyncEnabled();
  const testConnectionMutation = useTestConnection();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<SyncMapping | null>(null);
  const [syncingMappingId, setSyncingMappingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; result: { dalux_ok: boolean; catenda_ok: boolean; errors: string[] } } | null>(null);

  const mappings = data?.mappings ?? [];

  const handleDelete = async (mapping: SyncMapping) => {
    if (!confirm(`Er du sikker på at du vil slette synkronisering for prosjekt "${mapping.project_id}"?`)) {
      return;
    }
    await deleteMutation.mutateAsync(mapping.id!);
  };

  const handleTriggerSync = async (mapping: SyncMapping, fullSync: boolean = false) => {
    await triggerSyncMutation.mutateAsync({ id: mapping.id!, fullSync });
    setSyncingMappingId(mapping.id!);
  };

  const handleToggleEnabled = async (mapping: SyncMapping) => {
    await toggleEnabledMutation.mutateAsync({
      id: mapping.id!,
      enabled: !mapping.sync_enabled,
    });
  };

  const handleTestConnection = async (mapping: SyncMapping) => {
    const result = await testConnectionMutation.mutateAsync(mapping.id!);
    setTestResult({ id: mapping.id!, result });
  };

  const handleExportExcel = async (mapping: SyncMapping) => {
    try {
      const historyData = await fetchSyncHistory(mapping.id!, 10000);
      if (historyData.records.length === 0) {
        alert('Ingen synkroniseringshistorikk å eksportere.');
        return;
      }
      downloadSyncHistoryExcel({
        mapping,
        records: historyData.records,
        summary: historyData.summary,
      });
    } catch (error) {
      console.error('Eksport feilet:', error);
      alert('Kunne ikke eksportere synkroniseringshistorikk.');
    }
  };

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      <PageHeader
        title="Integrasjoner"
        subtitle="Administrer Dalux → Catenda synkronisering"
        maxWidth="wide"
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            Ny synkronisering
          </Button>
        }
      />

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Loading State */}
        {isLoading && (
          <Card variant="outlined" padding="lg">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oslo-blue" />
              <span className="ml-3 text-pkt-text-body-subtle">Laster integrasjoner...</span>
            </div>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="danger">
            Kunne ikke laste integrasjoner: {error.message}
          </Alert>
        )}

        {/* Empty State */}
        {!isLoading && !error && mappings.length === 0 && (
          <Card variant="outlined" padding="lg">
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold text-pkt-text-heading mb-2">
                Ingen synkroniseringer konfigurert
              </h3>
              <p className="text-pkt-text-body-subtle mb-6">
                Opprett en synkronisering for å automatisk overføre oppgaver fra Dalux til Catenda.
              </p>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                Opprett første synkronisering
              </Button>
            </div>
          </Card>
        )}

        {/* Mappings Grid */}
        {!isLoading && mappings.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mappings.map((mapping) => (
              <DashboardCard
                key={mapping.id}
                title={mapping.project_id}
                headerBadge={
                  <Badge variant={mapping.sync_enabled ? 'success' : 'neutral'} size="sm">
                    {mapping.sync_enabled ? 'Aktiv' : 'Deaktivert'}
                  </Badge>
                }
                variant="outlined"
                action={
                  <div className="flex gap-2 items-center justify-between w-full">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleTriggerSync(mapping)}
                      disabled={!mapping.sync_enabled || triggerSyncMutation.isPending}
                    >
                      Synkroniser
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" aria-label="Flere handlinger">
                          ⋮
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => navigate(`/integrasjoner/${mapping.id}`)}>
                          Se detaljer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingMapping(mapping)}>
                          Rediger
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleTestConnection(mapping)}
                          disabled={testConnectionMutation.isPending}
                        >
                          Test tilkobling
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleTriggerSync(mapping, true)}
                          disabled={!mapping.sync_enabled}
                        >
                          Full synkronisering
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportExcel(mapping)}>
                          Eksporter til Excel
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleToggleEnabled(mapping)}
                          disabled={toggleEnabledMutation.isPending}
                        >
                          {mapping.sync_enabled ? 'Deaktiver' : 'Aktiver'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="danger"
                          onClick={() => handleDelete(mapping)}
                          disabled={deleteMutation.isPending}
                        >
                          Slett
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                }
              >
                <DataList variant="list">
                  <DataListItem label="Dalux prosjekt">
                    {mapping.dalux_project_id}
                  </DataListItem>
                  <DataListItem label="Catenda board">
                    <span className="text-xs truncate max-w-[180px] inline-block" title={mapping.catenda_board_id}>
                      {mapping.catenda_board_id}
                    </span>
                  </DataListItem>
                  <DataListItem label="Intervall">
                    {mapping.sync_interval_minutes} min
                  </DataListItem>
                  <DataListItem label="Sist synkronisert">
                    {formatDate(mapping.last_sync_at)}
                  </DataListItem>
                  {mapping.last_sync_status && (
                    <DataListItem label="Status">
                      <Badge variant={getStatusVariant(mapping.last_sync_status)} size="sm">
                        {mapping.last_sync_status}
                      </Badge>
                    </DataListItem>
                  )}
                </DataList>

                {/* Error display */}
                {mapping.last_sync_error && (
                  <div className="mt-3 p-2 bg-alert-danger-bg border border-alert-danger-border rounded text-sm">
                    <span className="text-alert-danger-text">{mapping.last_sync_error}</span>
                  </div>
                )}

                {/* Test result */}
                {testResult && testResult.id === mapping.id && (
                  <Alert
                    variant={testResult.result.dalux_ok && testResult.result.catenda_ok ? 'success' : 'danger'}
                    className="mt-3"
                  >
                    <div className="flex gap-4">
                      <span>Dalux: {testResult.result.dalux_ok ? 'OK' : 'Feilet'}</span>
                      <span>Catenda: {testResult.result.catenda_ok ? 'OK' : 'Feilet'}</span>
                    </div>
                    {testResult.result.errors.length > 0 && (
                      <ul className="mt-1 text-xs list-disc list-inside">
                        {testResult.result.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </Alert>
                )}
              </DashboardCard>
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateSyncMappingModal onClose={() => setShowCreateModal(false)} />
      )}

      {editingMapping && (
        <EditSyncMappingModal
          mapping={editingMapping}
          onClose={() => setEditingMapping(null)}
        />
      )}

      {syncingMappingId && (
        <SyncProgressModal
          mappingId={syncingMappingId}
          onClose={() => setSyncingMappingId(null)}
        />
      )}
    </div>
  );
}

export default IntegrasjonerPage;
