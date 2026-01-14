/**
 * MappingOverviewTab
 *
 * Overview tab for sync mapping details.
 * Shows configuration, status, and sync actions.
 */

import {
  Card,
  DataList,
  DataListItem,
  Badge,
  Button,
  Alert,
} from '../primitives';
import { useTriggerSync, useTestConnection } from '../../hooks/useSyncMappings';
import { formatDateTimeCompact } from '../../utils/dateFormatters';
import { TaskFilterCard } from './TaskFilterCard';
import type { SyncMapping } from '../../types/integration';
import { useState } from 'react';

interface MappingOverviewTabProps {
  mapping: SyncMapping;
  onEdit: () => void;
  onTriggerSync: () => void;
  onFiltersUpdated?: () => void;
}

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

export function MappingOverviewTab({ mapping, onEdit, onTriggerSync, onFiltersUpdated }: MappingOverviewTabProps) {
  const triggerSyncMutation = useTriggerSync();
  const testConnectionMutation = useTestConnection();
  const [testResult, setTestResult] = useState<{
    dalux_ok: boolean;
    catenda_ok: boolean;
    errors: string[];
  } | null>(null);

  const handleTestConnection = async () => {
    const result = await testConnectionMutation.mutateAsync(mapping.id!);
    setTestResult(result);
  };

  const handleTriggerSync = async (fullSync: boolean = false) => {
    await triggerSyncMutation.mutateAsync({ id: mapping.id!, fullSync });
    onTriggerSync();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Venstre kolonne */}
      <div className="space-y-6">
        {/* Konfigurasjon */}
        <Card variant="outlined" padding="md">
          <h3 className="text-lg font-semibold text-pkt-text-heading mb-4">Konfigurasjon</h3>
          <DataList variant="list">
            <DataListItem label="Prosjekt ID">
              {mapping.project_id}
            </DataListItem>
            <DataListItem label="Dalux prosjekt">
              {mapping.dalux_project_id}
            </DataListItem>
            <DataListItem label="Dalux base URL">
              <span className="text-xs font-mono break-all">{mapping.dalux_base_url}</span>
            </DataListItem>
            <DataListItem label="Catenda prosjekt">
              <span className="text-xs font-mono">{mapping.catenda_project_id}</span>
            </DataListItem>
            <DataListItem label="Catenda board">
              <span className="text-xs font-mono break-all">{mapping.catenda_board_id}</span>
            </DataListItem>
            <DataListItem label="Synk intervall">
              {mapping.sync_interval_minutes} minutter
            </DataListItem>
            <DataListItem label="Status">
              <Badge variant={mapping.sync_enabled ? 'success' : 'neutral'} size="sm">
                {mapping.sync_enabled ? 'Aktiv' : 'Deaktivert'}
              </Badge>
            </DataListItem>
          </DataList>

          {/* Metadata */}
          <div className="mt-4 pt-4 border-t border-pkt-border-default">
            <DataList variant="list">
              <DataListItem label="Opprettet">
                {formatDateTimeCompact(mapping.created_at)}
              </DataListItem>
              <DataListItem label="Oppdatert">
                {formatDateTimeCompact(mapping.updated_at)}
              </DataListItem>
            </DataList>
          </div>
        </Card>

        {/* Task Filters */}
        <TaskFilterCard
          mappingId={mapping.id!}
          currentFilters={mapping.task_filters}
          onFiltersUpdated={onFiltersUpdated ?? (() => {})}
        />
      </div>

      {/* Høyre kolonne */}
      <div className="space-y-6">
        {/* Synkronisering (status + handlinger) */}
        <Card variant="outlined" padding="md">
          <h3 className="text-lg font-semibold text-pkt-text-heading mb-4">Synkronisering</h3>

          {/* Status */}
          <DataList variant="list">
            <DataListItem label="Siste synk">
              {formatDateTimeCompact(mapping.last_sync_at, 'Aldri')}
            </DataListItem>
            {mapping.last_sync_status && (
              <DataListItem label="Status">
                <Badge variant={getStatusVariant(mapping.last_sync_status)} size="sm">
                  {mapping.last_sync_status}
                </Badge>
              </DataListItem>
            )}
          </DataList>

          {mapping.last_sync_error && (
            <Alert variant="danger" className="mt-4">
              {mapping.last_sync_error}
            </Alert>
          )}

          {/* Handlinger */}
          <div className="mt-4 pt-4 border-t border-pkt-border-default">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleTriggerSync(false)}
                disabled={!mapping.sync_enabled || triggerSyncMutation.isPending}
              >
                Synkroniser
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleTriggerSync(true)}
                disabled={!mapping.sync_enabled || triggerSyncMutation.isPending}
              >
                Full synk
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTestConnection}
                disabled={testConnectionMutation.isPending}
              >
                Test
              </Button>
              <Button variant="secondary" size="sm" onClick={onEdit}>
                Rediger
              </Button>
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <Alert
              variant={testResult.dalux_ok && testResult.catenda_ok ? 'success' : 'danger'}
              className="mt-4"
            >
              <div className="flex gap-4">
                <span>Dalux: {testResult.dalux_ok ? 'OK' : 'Feilet'}</span>
                <span>Catenda: {testResult.catenda_ok ? 'OK' : 'Feilet'}</span>
              </div>
              {testResult.errors.length > 0 && (
                <ul className="mt-2 text-xs list-disc list-inside">
                  {testResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}
        </Card>
      </div>
    </div>
  );
}
