/**
 * ForseringDashboard Component
 *
 * Status dashboard for forsering cases.
 * Shows forsering status, dates, and BH response.
 */

import { Card } from '../primitives/Card';
import { Badge } from '../primitives/Badge';
import { DataList } from '../primitives/DataList';
import type { ForseringData } from '../../types/timeline';

interface ForseringDashboardProps {
  forseringData: ForseringData;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

function getStatusBadge(forseringData: ForseringData) {
  if (forseringData.er_stoppet) {
    return <Badge variant="warning" size="lg">Stoppet</Badge>;
  }
  if (forseringData.er_iverksatt) {
    return <Badge variant="success" size="lg">Iverksatt</Badge>;
  }
  return <Badge variant="default" size="lg">Varslet</Badge>;
}

function getBHResponseBadge(forseringData: ForseringData) {
  if (forseringData.bh_aksepterer_forsering === undefined) {
    return <Badge variant="default">Venter på BH</Badge>;
  }
  if (forseringData.bh_aksepterer_forsering) {
    return <Badge variant="success">BH aksepterer</Badge>;
  }
  return <Badge variant="danger">BH avslår</Badge>;
}

export function ForseringDashboard({ forseringData }: ForseringDashboardProps) {
  const statusItems = [
    {
      label: 'Status',
      value: getStatusBadge(forseringData),
    },
    {
      label: 'Varslet',
      value: formatDate(forseringData.dato_varslet),
    },
    ...(forseringData.er_iverksatt ? [{
      label: 'Iverksatt',
      value: formatDate(forseringData.dato_iverksatt),
    }] : []),
    ...(forseringData.er_stoppet ? [{
      label: 'Stoppet',
      value: formatDate(forseringData.dato_stoppet),
    }] : []),
  ];

  const kostnadItems = [
    {
      label: 'Estimert kostnad',
      value: formatCurrency(forseringData.estimert_kostnad),
    },
    {
      label: 'Maks kostnad (30%-regel)',
      value: formatCurrency(forseringData.maks_forseringskostnad),
    },
    ...(forseringData.paalopte_kostnader !== undefined ? [{
      label: 'Påløpte kostnader',
      value: formatCurrency(forseringData.paalopte_kostnader),
    }] : []),
  ];

  const bhResponseItems = forseringData.bh_aksepterer_forsering !== undefined ? [
    {
      label: 'BH standpunkt',
      value: getBHResponseBadge(forseringData),
    },
    ...(forseringData.bh_godkjent_kostnad !== undefined ? [{
      label: 'Godkjent kostnad',
      value: formatCurrency(forseringData.bh_godkjent_kostnad),
    }] : []),
    ...(forseringData.bh_begrunnelse ? [{
      label: 'Begrunnelse',
      value: forseringData.bh_begrunnelse,
    }] : []),
  ] : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Status card */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle">
          <h3 className="font-bold text-sm">Forseringsstatus</h3>
        </div>
        <div className="p-4">
          <DataList items={statusItems} />
        </div>
      </Card>

      {/* Cost card */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle">
          <h3 className="font-bold text-sm">Kostnader</h3>
        </div>
        <div className="p-4">
          <DataList items={kostnadItems} />
        </div>
      </Card>

      {/* BH Response card (only if BH has responded) */}
      {bhResponseItems.length > 0 && (
        <Card className="p-0 overflow-hidden md:col-span-2">
          <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle">
            <h3 className="font-bold text-sm">Byggherrens standpunkt</h3>
          </div>
          <div className="p-4">
            <DataList items={bhResponseItems} />
          </div>
        </Card>
      )}
    </div>
  );
}
