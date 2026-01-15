/**
 * MappingOverviewTab
 *
 * Overview tab for sync mapping details.
 * Shows configuration, status, and sync actions.
 */

import { useState, useEffect } from 'react';
import {
  DashboardCard,
  DataList,
  DataListItem,
  Badge,
  Button,
  Alert,
  AccordionItem,
  Checkbox,
} from '../primitives';
import { useTriggerSync, useTestConnection, useFilterOptions, useUpdateTaskFilters } from '../../hooks/useSyncMappings';
import { formatDateTimeCompact } from '../../utils/dateFormatters';
import type { SyncMapping, TaskFilterConfig } from '../../types/integration';

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

  // Filter state and hooks
  const { data: filterData, isLoading: filterLoading, error: filterError } = useFilterOptions(mapping.id!);
  const updateFiltersMutation = useUpdateTaskFilters();
  const [excludedTypes, setExcludedTypes] = useState<Set<string>>(
    new Set(mapping.task_filters?.exclude_types ?? [])
  );
  const [hasFilterChanges, setHasFilterChanges] = useState(false);

  // Sync filter state when mapping changes
  useEffect(() => {
    const newExcluded = new Set(mapping.task_filters?.exclude_types ?? []);
    setExcludedTypes(newExcluded);
    setHasFilterChanges(false);
  }, [mapping.task_filters]);

  const handleTestConnection = async () => {
    const result = await testConnectionMutation.mutateAsync(mapping.id!);
    setTestResult(result);
  };

  const handleTriggerSync = async (fullSync: boolean = false) => {
    await triggerSyncMutation.mutateAsync({ id: mapping.id!, fullSync });
    onTriggerSync();
  };

  // Filter handlers
  const handleToggleType = (typeName: string) => {
    setExcludedTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(typeName)) {
        newSet.delete(typeName);
      } else {
        newSet.add(typeName);
      }
      return newSet;
    });
    setHasFilterChanges(true);
  };

  const handleSaveFilters = async () => {
    const taskFilters: TaskFilterConfig | null =
      excludedTypes.size > 0 ? { exclude_types: Array.from(excludedTypes) } : null;
    await updateFiltersMutation.mutateAsync({ id: mapping.id!, taskFilters });
    setHasFilterChanges(false);
    onFiltersUpdated?.();
  };

  const handleResetFilters = () => {
    setExcludedTypes(new Set(mapping.task_filters?.exclude_types ?? []));
    setHasFilterChanges(false);
  };

  const handleIncludeAll = () => {
    setExcludedTypes(new Set());
    setHasFilterChanges(true);
  };

  const filterTypes = filterData?.types ?? [];
  const excludedCount = excludedTypes.size;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Venstre kolonne */}
      <div className="space-y-6">
        {/* Konfigurasjon */}
        <DashboardCard
          title="Konfigurasjon"
          variant="outlined"
          headerBadge={
            <Badge variant={mapping.sync_enabled ? 'success' : 'neutral'} size="sm">
              {mapping.sync_enabled ? 'Aktiv' : 'Deaktivert'}
            </Badge>
          }
        >
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
            <DataListItem label="Opprettet">
              {formatDateTimeCompact(mapping.created_at)}
            </DataListItem>
            <DataListItem label="Oppdatert">
              {formatDateTimeCompact(mapping.updated_at)}
            </DataListItem>
          </DataList>
        </DashboardCard>
      </div>

      {/* Høyre kolonne */}
      <div className="space-y-6">
        {/* Synkronisering (status + handlinger) */}
        <DashboardCard
          title="Synkronisering"
          variant="outlined"
          headerBadge={
            mapping.last_sync_status && (
              <Badge variant={getStatusVariant(mapping.last_sync_status)} size="sm">
                {mapping.last_sync_status}
              </Badge>
            )
          }
          action={
            <>
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
            </>
          }
        >
          <DataList variant="list">
            <DataListItem label="Siste synk">
              {formatDateTimeCompact(mapping.last_sync_at, 'Aldri')}
            </DataListItem>
          </DataList>

          {mapping.last_sync_error && (
            <Alert variant="danger" className="mt-4">
              {mapping.last_sync_error}
            </Alert>
          )}

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

          {/* Task Filter Accordion */}
          <div className="mt-4 -mx-4 border-t border-pkt-border-subtle">
            <AccordionItem
              title="Oppgavefilter"
              badge={
                excludedCount > 0 ? (
                  <Badge variant="warning" size="sm">
                    {excludedCount} ekskludert
                  </Badge>
                ) : undefined
              }
              size="sm"
              bordered={false}
            >
              <div className="space-y-4">
                <p className="text-sm text-pkt-text-body-subtle">
                  Velg hvilke oppgavetyper som skal ekskluderes fra synkronisering.
                </p>

                {/* Loading State */}
                {filterLoading && (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-oslo-blue" />
                    <span className="text-sm text-pkt-text-body-subtle">Henter oppgavetyper...</span>
                  </div>
                )}

                {/* Error State */}
                {filterError && (
                  <Alert variant="danger">
                    Kunne ikke hente oppgavetyper: {filterError.message}
                  </Alert>
                )}

                {/* Type List */}
                {!filterLoading && !filterError && filterTypes.length > 0 && (
                  <div className="space-y-2">
                    {filterTypes.map((typeName) => (
                      <Checkbox
                        key={typeName}
                        id={`filter-${typeName}`}
                        label={typeName}
                        checked={excludedTypes.has(typeName)}
                        onCheckedChange={() => handleToggleType(typeName)}
                        description={excludedTypes.has(typeName) ? 'Ekskluderes fra synk' : undefined}
                      />
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {!filterLoading && !filterError && filterTypes.length === 0 && (
                  <p className="text-sm text-pkt-text-body-subtle">
                    Ingen oppgavetyper funnet i Dalux-prosjektet.
                  </p>
                )}

                {/* Stats */}
                {filterData && (
                  <p className="text-xs text-pkt-text-body-subtle">
                    {filterData.total_tasks} oppgaver i Dalux • {filterTypes.length} unike typer
                  </p>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveFilters}
                    disabled={!hasFilterChanges || updateFiltersMutation.isPending}
                  >
                    {updateFiltersMutation.isPending ? 'Lagrer...' : 'Lagre filter'}
                  </Button>
                  {hasFilterChanges && (
                    <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                      Angre
                    </Button>
                  )}
                  {excludedCount > 0 && (
                    <Button variant="secondary" size="sm" onClick={handleIncludeAll}>
                      Inkluder alle
                    </Button>
                  )}
                </div>

                {/* Success Message */}
                {updateFiltersMutation.isSuccess && !hasFilterChanges && (
                  <Alert variant="success">
                    Filteret er lagret.
                  </Alert>
                )}
              </div>
            </AccordionItem>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}
