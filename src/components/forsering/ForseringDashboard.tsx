/**
 * ForseringDashboard Component
 *
 * Status dashboard for forsering cases.
 * Shows forsering status, dates, and BH response.
 * Includes cost tracking with 30% rule warnings.
 */

import { useMemo } from 'react';
import { Card } from '../primitives/Card';
import { Badge } from '../primitives/Badge';
import { DataList, DataListItem } from '../primitives/DataList';
import { ExclamationTriangleIcon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';
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

/**
 * Get cost status based on 30% rule
 */
function getCostStatus(forseringData: ForseringData): {
  status: 'ok' | 'warning' | 'danger';
  label: string;
  icon: React.ReactNode;
} {
  const { paalopte_kostnader, estimert_kostnad, maks_forseringskostnad, er_iverksatt } = forseringData;

  if (!er_iverksatt || paalopte_kostnader === undefined) {
    return {
      status: 'ok',
      label: 'Ikke startet',
      icon: null,
    };
  }

  const prosentAvMaks = (paalopte_kostnader / maks_forseringskostnad) * 100;
  const prosentAvEstimert = (paalopte_kostnader / estimert_kostnad) * 100;

  if (paalopte_kostnader > maks_forseringskostnad) {
    return {
      status: 'danger',
      label: 'Over maksgrense',
      icon: <CrossCircledIcon className="w-3 h-3" />,
    };
  }
  if (prosentAvMaks >= 80) {
    return {
      status: 'warning',
      label: 'Nær maksgrense',
      icon: <ExclamationTriangleIcon className="w-3 h-3" />,
    };
  }
  if (paalopte_kostnader > estimert_kostnad) {
    return {
      status: 'warning',
      label: 'Over estimat',
      icon: <ExclamationTriangleIcon className="w-3 h-3" />,
    };
  }
  if (prosentAvEstimert >= 80) {
    return {
      status: 'warning',
      label: 'Nær estimat',
      icon: <ExclamationTriangleIcon className="w-3 h-3" />,
    };
  }
  return {
    status: 'ok',
    label: 'Innenfor ramme',
    icon: <CheckCircledIcon className="w-3 h-3" />,
  };
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Status card */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle">
          <h3 className="font-bold text-sm">Forseringsstatus</h3>
        </div>
        <div className="p-4">
          <DataList>
            <DataListItem label="Status">
              {getStatusBadge(forseringData)}
            </DataListItem>
            <DataListItem label="Varslet">
              {formatDate(forseringData.dato_varslet)}
            </DataListItem>
            {forseringData.er_iverksatt && (
              <DataListItem label="Iverksatt">
                {formatDate(forseringData.dato_iverksatt)}
              </DataListItem>
            )}
            {forseringData.er_stoppet && (
              <DataListItem label="Stoppet">
                {formatDate(forseringData.dato_stoppet)}
              </DataListItem>
            )}
          </DataList>
        </div>
      </Card>

      {/* Cost card */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle flex items-center justify-between">
          <h3 className="font-bold text-sm">Kostnader</h3>
          {forseringData.er_iverksatt && forseringData.paalopte_kostnader !== undefined && (
            <Badge
              variant={
                getCostStatus(forseringData).status === 'danger' ? 'danger' :
                getCostStatus(forseringData).status === 'warning' ? 'warning' :
                'success'
              }
              size="sm"
            >
              <span className="flex items-center gap-1">
                {getCostStatus(forseringData).icon}
                {getCostStatus(forseringData).label}
              </span>
            </Badge>
          )}
        </div>
        <div className="p-4">
          <DataList>
            <DataListItem label="Estimert kostnad">
              {formatCurrency(forseringData.estimert_kostnad)}
            </DataListItem>
            <DataListItem label="Maks kostnad (30%-regel)">
              {formatCurrency(forseringData.maks_forseringskostnad)}
            </DataListItem>
            {forseringData.paalopte_kostnader !== undefined && (
              <DataListItem label="Påløpte kostnader">
                <span className={`font-medium ${
                  getCostStatus(forseringData).status === 'danger' ? 'text-alert-danger-text' :
                  getCostStatus(forseringData).status === 'warning' ? 'text-badge-warning-text' :
                  ''
                }`}>
                  {formatCurrency(forseringData.paalopte_kostnader)}
                </span>
              </DataListItem>
            )}
          </DataList>
        </div>
      </Card>

      {/* BH Response card (only if BH has responded) */}
      {forseringData.bh_aksepterer_forsering !== undefined && (
        <Card className="p-0 overflow-hidden md:col-span-2">
          <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle">
            <h3 className="font-bold text-sm">Byggherrens standpunkt</h3>
          </div>
          <div className="p-4">
            <DataList>
              <DataListItem label="BH standpunkt">
                {getBHResponseBadge(forseringData)}
              </DataListItem>
              {forseringData.bh_godkjent_kostnad !== undefined && (
                <DataListItem label="Godkjent kostnad">
                  {formatCurrency(forseringData.bh_godkjent_kostnad)}
                </DataListItem>
              )}
              {forseringData.bh_begrunnelse && (
                <DataListItem label="Begrunnelse">
                  {forseringData.bh_begrunnelse}
                </DataListItem>
              )}
            </DataList>
          </div>
        </Card>
      )}
    </div>
  );
}
