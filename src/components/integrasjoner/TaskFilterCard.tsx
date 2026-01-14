/**
 * TaskFilterCard
 *
 * Card for configuring task type filters in MappingOverviewTab.
 * Shows available types from Dalux and lets user exclude types from sync.
 */

import { useState, useEffect } from 'react';
import { DashboardCard, Badge, Button, Alert, Checkbox } from '../primitives';
import { useFilterOptions, useUpdateTaskFilters } from '../../hooks/useSyncMappings';
import type { TaskFilterConfig } from '../../types/integration';

interface TaskFilterCardProps {
  mappingId: string;
  currentFilters?: TaskFilterConfig;
  onFiltersUpdated: () => void;
}

export function TaskFilterCard({ mappingId, currentFilters, onFiltersUpdated }: TaskFilterCardProps) {
  const { data, isLoading, error } = useFilterOptions(mappingId);
  const updateFiltersMutation = useUpdateTaskFilters();

  const [excludedTypes, setExcludedTypes] = useState<Set<string>>(
    new Set(currentFilters?.exclude_types ?? [])
  );
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state when currentFilters changes (e.g., after save)
  useEffect(() => {
    const newExcluded = new Set(currentFilters?.exclude_types ?? []);
    setExcludedTypes(newExcluded);
    setHasChanges(false);
  }, [currentFilters]);

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
    setHasChanges(true);
  };

  const handleSave = async () => {
    const taskFilters: TaskFilterConfig | null =
      excludedTypes.size > 0 ? { exclude_types: Array.from(excludedTypes) } : null;

    await updateFiltersMutation.mutateAsync({
      id: mappingId,
      taskFilters,
    });
    setHasChanges(false);
    onFiltersUpdated();
  };

  const handleReset = () => {
    setExcludedTypes(new Set(currentFilters?.exclude_types ?? []));
    setHasChanges(false);
  };

  const handleIncludeAll = () => {
    setExcludedTypes(new Set());
    setHasChanges(true);
  };

  const types = data?.types ?? [];
  const excludedCount = excludedTypes.size;

  return (
    <DashboardCard
      title="Oppgavefilter"
      variant="outlined"
      headerBadge={
        excludedCount > 0 ? (
          <Badge variant="warning" size="sm">
            {excludedCount} ekskludert
          </Badge>
        ) : undefined
      }
    >
      <p className="text-sm text-pkt-text-body-subtle mb-4">
        Velg hvilke oppgavetyper som skal ekskluderes fra synkronisering.
      </p>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center gap-2 py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-oslo-blue" />
          <span className="text-sm text-pkt-text-body-subtle">Henter oppgavetyper fra Dalux...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="danger" className="mb-4">
          Kunne ikke hente oppgavetyper: {error.message}
        </Alert>
      )}

      {/* Type List */}
      {!isLoading && !error && types.length > 0 && (
        <div className="space-y-3 mb-4">
          {types.map((typeName) => (
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
      {!isLoading && !error && types.length === 0 && (
        <p className="text-sm text-pkt-text-body-subtle py-4">
          Ingen oppgavetyper funnet i Dalux-prosjektet.
        </p>
      )}

      {/* Stats */}
      {data && (
        <p className="text-xs text-pkt-text-body-subtle mb-4">
          {data.total_tasks} oppgaver i Dalux • {types.length} unike typer
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || updateFiltersMutation.isPending}
        >
          {updateFiltersMutation.isPending ? 'Lagrer...' : 'Lagre filter'}
        </Button>
        {hasChanges && (
          <Button variant="secondary" size="sm" onClick={handleReset}>
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
      {updateFiltersMutation.isSuccess && !hasChanges && (
        <Alert variant="success" className="mt-4">
          Filteret er lagret.
        </Alert>
      )}
    </DashboardCard>
  );
}
