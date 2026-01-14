/**
 * MappingHistoryTab
 *
 * History tab showing sync records for a mapping.
 * Displays TaskSyncRecords with status filtering.
 */

import { useState } from 'react';
import { Card, Badge, Button, Alert, Table, type Column } from '../primitives';
import { useSyncHistory } from '../../hooks/useSyncMappings';
import { formatDateTimeCompact } from '../../utils/dateFormatters';
import type { TaskSyncRecord } from '../../types/integration';

interface MappingHistoryTabProps {
  mappingId: string;
}

type StatusFilter = 'all' | 'synced' | 'pending' | 'failed';

function getStatusVariant(status: string): 'success' | 'danger' | 'warning' | 'neutral' {
  switch (status) {
    case 'synced':
      return 'success';
    case 'failed':
      return 'danger';
    case 'pending':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function MappingHistoryTab({ mappingId }: MappingHistoryTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading, error } = useSyncHistory(
    mappingId,
    50,
    statusFilter === 'all' ? undefined : statusFilter
  );

  const records = data?.records ?? [];
  const summary = data?.summary;

  const columns: Column<TaskSyncRecord>[] = [
    {
      key: 'dalux_task_id',
      label: 'Dalux Task',
      width: '120px',
      render: (record) => (
        <span className="font-mono text-xs">{record.dalux_task_id}</span>
      ),
    },
    {
      key: 'catenda_topic_guid',
      label: 'Catenda Topic',
      width: '200px',
      render: (record) => (
        <span className="font-mono text-xs truncate max-w-[180px] inline-block" title={record.catenda_topic_guid}>
          {record.catenda_topic_guid}
        </span>
      ),
    },
    {
      key: 'sync_status',
      label: 'Status',
      width: '100px',
      render: (record) => (
        <Badge variant={getStatusVariant(record.sync_status)} size="sm">
          {record.sync_status}
        </Badge>
      ),
    },
    {
      key: 'updated_at',
      label: 'Oppdatert',
      width: '140px',
      render: (record) => formatDateTimeCompact(record.updated_at),
    },
    {
      key: 'last_error',
      label: 'Feil',
      render: (record) => (
        record.last_error ? (
          <span className="text-alert-danger-text text-xs truncate max-w-[200px] inline-block" title={record.last_error}>
            {record.last_error}
          </span>
        ) : (
          <span className="text-pkt-text-body-subtle">-</span>
        )
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card variant="outlined" padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-pkt-text-heading">{summary.total}</div>
              <div className="text-sm text-pkt-text-body-subtle">Totalt</div>
            </div>
          </Card>
          <Card variant="outlined" padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-status-success">{summary.synced}</div>
              <div className="text-sm text-pkt-text-body-subtle">Synkronisert</div>
            </div>
          </Card>
          <Card variant="outlined" padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-status-warning">{summary.pending}</div>
              <div className="text-sm text-pkt-text-body-subtle">Venter</div>
            </div>
          </Card>
          <Card variant="outlined" padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-status-danger">{summary.failed}</div>
              <div className="text-sm text-pkt-text-body-subtle">Feilet</div>
            </div>
          </Card>
        </div>
      )}

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={statusFilter === 'all' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          Alle
        </Button>
        <Button
          variant={statusFilter === 'synced' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setStatusFilter('synced')}
        >
          Synkronisert
        </Button>
        <Button
          variant={statusFilter === 'pending' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setStatusFilter('pending')}
        >
          Venter
        </Button>
        <Button
          variant={statusFilter === 'failed' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setStatusFilter('failed')}
        >
          Feilet
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-oslo-blue" />
            <span className="ml-3 text-pkt-text-body-subtle">Laster historikk...</span>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="danger">
          Kunne ikke laste historikk: {error.message}
        </Alert>
      )}

      {/* Records Table */}
      {!isLoading && !error && (
        <Card variant="outlined" padding="none">
          <Table
            columns={columns}
            data={records}
            keyExtractor={(record) => record.id}
            emptyMessage="Ingen synkroniseringshistorikk"
          />
        </Card>
      )}
    </div>
  );
}
