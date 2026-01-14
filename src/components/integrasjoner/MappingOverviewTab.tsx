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
import type { SyncMapping } from '../../types/integration';
import { useState } from 'react';

interface MappingOverviewTabProps {
  mapping: SyncMapping;
  onEdit: () => void;
  onTriggerSync: () => void;
}

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

export function MappingOverviewTab({ mapping, onEdit, onTriggerSync }: MappingOverviewTabProps) {
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
      </Card>

      {/* Synk Status */}
      <Card variant="outlined" padding="md">
        <h3 className="text-lg font-semibold text-pkt-text-heading mb-4">Siste synkronisering</h3>
        <DataList variant="list">
          <DataListItem label="Tidspunkt">
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

        {mapping.last_sync_error && (
          <Alert variant="danger" className="mt-4">
            {mapping.last_sync_error}
          </Alert>
        )}
      </Card>

      {/* Handlinger */}
      <Card variant="outlined" padding="md">
        <h3 className="text-lg font-semibold text-pkt-text-heading mb-4">Handlinger</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleTriggerSync(false)}
            disabled={!mapping.sync_enabled || triggerSyncMutation.isPending}
          >
            Synkroniser nå
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleTriggerSync(true)}
            disabled={!mapping.sync_enabled || triggerSyncMutation.isPending}
          >
            Full synkronisering
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            disabled={testConnectionMutation.isPending}
          >
            Test tilkobling
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Rediger
          </Button>
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

      {/* Metadata */}
      <Card variant="outlined" padding="md">
        <h3 className="text-lg font-semibold text-pkt-text-heading mb-4">Metadata</h3>
        <DataList variant="list">
          <DataListItem label="Opprettet">
            {formatDate(mapping.created_at)}
          </DataListItem>
          <DataListItem label="Oppdatert">
            {formatDate(mapping.updated_at)}
          </DataListItem>
        </DataList>
      </Card>
    </div>
  );
}
