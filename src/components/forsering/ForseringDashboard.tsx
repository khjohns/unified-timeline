/**
 * ForseringDashboard Component
 *
 * Status dashboard for forsering cases.
 * Shows forsering status, dates, and BH response.
 */

import { Card } from '../primitives/Card';
import { Badge } from '../primitives/Badge';
import { DataList, DataListItem } from '../primitives/DataList';
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
        <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle">
          <h3 className="font-bold text-sm">Kostnader</h3>
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
                {formatCurrency(forseringData.paalopte_kostnader)}
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
