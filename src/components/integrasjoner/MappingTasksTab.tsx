/**
 * MappingTasksTab
 *
 * Tasks tab showing Dalux tasks for a mapping.
 * Preview of tasks that will be synced.
 */

import { Card, Badge, Alert, Table, type Column } from '../primitives';
import { useDaluxTasks } from '../../hooks/useDaluxData';
import type { DaluxTask } from '../../types/dalux';

interface MappingTasksTabProps {
  mappingId: string;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '-';
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
  switch (status?.toLowerCase()) {
    case 'closed':
    case 'completed':
    case 'done':
      return 'success';
    case 'open':
    case 'active':
    case 'in progress':
      return 'warning';
    case 'rejected':
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function MappingTasksTab({ mappingId }: MappingTasksTabProps) {
  const { data, isLoading, error } = useDaluxTasks(mappingId, 200);

  const tasks = data?.tasks ?? [];

  const columns: Column<DaluxTask>[] = [
    {
      key: 'number',
      label: 'Nr.',
      width: '80px',
      render: (task) => (
        <span className="font-mono text-xs">{task.data.number || '-'}</span>
      ),
    },
    {
      key: 'subject',
      label: 'Tittel',
      render: (task) => (
        <span className="truncate max-w-[300px] inline-block" title={task.data.subject}>
          {task.data.subject || '-'}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: '120px',
      render: (task) => (
        task.data.type?.name ? (
          <Badge variant="neutral" size="sm">
            {task.data.type.name}
          </Badge>
        ) : (
          <span className="text-pkt-text-body-subtle">-</span>
        )
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '100px',
      render: (task) => (
        task.data.status ? (
          <Badge variant={getStatusVariant(task.data.status)} size="sm">
            {task.data.status}
          </Badge>
        ) : (
          <span className="text-pkt-text-body-subtle">-</span>
        )
      ),
    },
    {
      key: 'assignedTo',
      label: 'Tildelt',
      width: '150px',
      render: (task) => (
        <span className="text-xs truncate max-w-[140px] inline-block" title={task.data.assignedTo?.email}>
          {task.data.assignedTo?.email || '-'}
        </span>
      ),
    },
    {
      key: 'modified',
      label: 'Endret',
      width: '140px',
      render: (task) => formatDate(task.data.modified),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-pkt-text-body-subtle">
          Viser Dalux-oppgaver som kan synkroniseres til Catenda.
        </p>
        {data && (
          <Badge variant="neutral" size="sm">
            {data.total} oppgaver
          </Badge>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-oslo-blue" />
            <span className="ml-3 text-pkt-text-body-subtle">Laster oppgaver fra Dalux...</span>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="danger">
          Kunne ikke laste oppgaver: {error.message}
        </Alert>
      )}

      {/* Tasks Table */}
      {!isLoading && !error && (
        <Card variant="outlined" padding="none">
          <Table
            columns={columns}
            data={tasks}
            keyExtractor={(task) => task.data.taskId}
            emptyMessage="Ingen oppgaver funnet i Dalux"
          />
        </Card>
      )}
    </div>
  );
}
