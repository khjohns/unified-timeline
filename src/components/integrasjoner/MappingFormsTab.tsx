/**
 * MappingFormsTab
 *
 * Forms tab showing Dalux forms for a mapping.
 * Read-only view of forms (SJA, Vernemøter, etc.).
 */

import { Card, Badge, Alert, Table, type Column } from '../primitives';
import { useDaluxForms } from '../../hooks/useDaluxData';
import type { DaluxForm } from '../../types/dalux';

interface MappingFormsTabProps {
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
    case 'approved':
      return 'success';
    case 'open':
    case 'draft':
    case 'in progress':
      return 'warning';
    case 'rejected':
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function MappingFormsTab({ mappingId }: MappingFormsTabProps) {
  const { data, isLoading, error } = useDaluxForms(mappingId, 200);

  const forms = data?.forms ?? [];

  const columns: Column<DaluxForm>[] = [
    {
      key: 'number',
      label: 'Nr.',
      width: '80px',
      render: (form) => (
        <span className="font-mono text-xs">{form.data.number || '-'}</span>
      ),
    },
    {
      key: 'template',
      label: 'Skjematype',
      render: (form) => (
        <span className="truncate max-w-[250px] inline-block" title={form.data.template?.name}>
          {form.data.template?.name || form.data.type || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '100px',
      render: (form) => (
        form.data.status ? (
          <Badge variant={getStatusVariant(form.data.status)} size="sm">
            {form.data.status}
          </Badge>
        ) : (
          <span className="text-pkt-text-body-subtle">-</span>
        )
      ),
    },
    {
      key: 'createdBy',
      label: 'Opprettet av',
      width: '150px',
      render: (form) => (
        <span className="text-xs truncate max-w-[140px] inline-block" title={form.data.createdBy?.userId}>
          {form.data.createdBy?.userId || '-'}
        </span>
      ),
    },
    {
      key: 'created',
      label: 'Opprettet',
      width: '140px',
      render: (form) => formatDate(form.data.created),
    },
    {
      key: 'modified',
      label: 'Endret',
      width: '140px',
      render: (form) => formatDate(form.data.modified),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-pkt-text-body-subtle">
          Skjemaer fra Dalux (SJA, Vernemøter, Brannrunder, etc.)
        </p>
        {data && (
          <Badge variant="neutral" size="sm">
            {data.total} skjemaer
          </Badge>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-oslo-blue" />
            <span className="ml-3 text-pkt-text-body-subtle">Laster skjemaer fra Dalux...</span>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="danger">
          Kunne ikke laste skjemaer: {error.message}
        </Alert>
      )}

      {/* Forms Table */}
      {!isLoading && !error && (
        <Card variant="outlined" padding="none">
          <Table
            columns={columns}
            data={forms}
            keyExtractor={(form) => form.data.formId}
            emptyMessage="Ingen skjemaer funnet i Dalux"
          />
        </Card>
      )}
    </div>
  );
}
