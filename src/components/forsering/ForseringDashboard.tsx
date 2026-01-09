/**
 * ForseringDashboard Component
 *
 * Status dashboard for forsering cases.
 * Shows forsering status, dates, and BH response.
 * Includes cost tracking with 30% rule warnings.
 * Integrates action buttons for TE and BH.
 */

import type { ReactNode } from 'react';
import { Badge, Button, DashboardCard, DataList, DataListItem } from '../primitives';
import {
  ExclamationTriangleIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  StopIcon,
  Pencil1Icon,
  ChatBubbleIcon
} from '@radix-ui/react-icons';
import type { ForseringData } from '../../types/timeline';

interface ForseringDashboardProps {
  forseringData: ForseringData;
  userRole: 'TE' | 'BH';
  onStoppForsering?: () => void;
  onOppdaterKostnader?: () => void;
  onGiStandpunkt?: () => void;
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
  icon: ReactNode;
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
    return <Badge variant="warning" size="sm">Stoppet</Badge>;
  }
  if (forseringData.er_iverksatt) {
    return <Badge variant="success" size="sm">Iverksatt</Badge>;
  }
  return <Badge variant="default" size="sm">Varslet</Badge>;
}

/**
 * Get BH response badge based on new bh_respons structure
 */
function getBHResponseBadge(forseringData: ForseringData) {
  const bhRespons = forseringData.bh_respons;

  // Check new bh_respons first, then fall back to legacy fields
  if (bhRespons) {
    const erSubsidiaert = bhRespons.subsidiaer_triggers && bhRespons.subsidiaer_triggers.length > 0;

    if (bhRespons.aksepterer) {
      // Check if it's partial (godkjent_belop < estimert_kostnad)
      const isPartial = bhRespons.total_godkjent !== undefined &&
        bhRespons.total_godkjent < forseringData.estimert_kostnad;

      if (erSubsidiaert) {
        return (
          <div className="flex gap-1">
            <Badge variant={isPartial ? 'warning' : 'success'} size="sm">
              {isPartial ? 'Delvis godkjent' : 'Godkjent'}
            </Badge>
            <Badge variant="warning" size="sm">Subsidiært</Badge>
          </div>
        );
      }
      return (
        <Badge variant={isPartial ? 'warning' : 'success'} size="sm">
          {isPartial ? 'Delvis godkjent' : 'Godkjent'}
        </Badge>
      );
    }
    return <Badge variant="danger" size="sm">Avslått</Badge>;
  }

  // Legacy fallback
  if (forseringData.bh_aksepterer_forsering === undefined) {
    return <Badge variant="default" size="sm">Venter på BH</Badge>;
  }
  if (forseringData.bh_aksepterer_forsering) {
    return <Badge variant="success" size="sm">Godkjent</Badge>;
  }
  return <Badge variant="danger" size="sm">Avslått</Badge>;
}

export function ForseringDashboard({
  forseringData,
  userRole,
  onStoppForsering,
  onOppdaterKostnader,
  onGiStandpunkt,
}: ForseringDashboardProps) {
  const canStoppForsering = userRole === 'TE' && forseringData.er_iverksatt && !forseringData.er_stoppet;
  const canOppdaterKostnader = userRole === 'TE' && forseringData.er_iverksatt && !forseringData.er_stoppet;
  const canGiStandpunkt = userRole === 'BH' && forseringData.dato_varslet;

  // Check for BH response - prefer new structure, fallback to legacy
  const bhRespons = forseringData.bh_respons;
  const hasGittStandpunkt = bhRespons !== undefined || forseringData.bh_aksepterer_forsering !== undefined;

  // Computed values from bh_respons
  const godkjentBelop = bhRespons?.total_godkjent ?? bhRespons?.godkjent_belop ?? forseringData.bh_godkjent_kostnad;
  const erSubsidiaert = bhRespons?.subsidiaer_triggers && bhRespons.subsidiaer_triggers.length > 0;
  const subsidiaerBelop = bhRespons?.subsidiaer_godkjent_belop;

  return (
    <div className="space-y-4">
      {/* Status and Cost cards side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Status card */}
        <DashboardCard
          title="Forseringsstatus"
          headerBadge={getStatusBadge(forseringData)}
          action={canStoppForsering && onStoppForsering && (
            <Button variant="danger" size="sm" onClick={onStoppForsering}>
              <StopIcon className="w-4 h-4 mr-2" />
              Stopp forsering
            </Button>
          )}
        >
          <DataList>
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
            <DataListItem label="Avslåtte dager">
              <span className="font-bold">{forseringData.avslatte_dager} dager</span>
            </DataListItem>
          </DataList>
        </DashboardCard>

        {/* Cost card */}
        <DashboardCard
          title="Kostnader"
          headerBadge={forseringData.er_iverksatt && forseringData.paalopte_kostnader !== undefined && (
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
          action={canOppdaterKostnader && onOppdaterKostnader && (
            <Button variant="secondary" size="sm" onClick={onOppdaterKostnader}>
              <Pencil1Icon className="w-4 h-4 mr-2" />
              Oppdater kostnader
            </Button>
          )}
        >
          <DataList>
            <DataListItem label="Estimert kostnad">
              {formatCurrency(forseringData.estimert_kostnad)}
            </DataListItem>
            <DataListItem label="Maks (30%-regel)">
              {formatCurrency(forseringData.maks_forseringskostnad)}
            </DataListItem>
            {forseringData.paalopte_kostnader !== undefined && (
              <DataListItem label="Påløpt">
                <span className={`font-bold ${
                  getCostStatus(forseringData).status === 'danger' ? 'text-pkt-brand-red-1000' :
                  getCostStatus(forseringData).status === 'warning' ? 'text-pkt-brand-yellow-1000' :
                  'text-pkt-brand-dark-green-1000'
                }`}>
                  {formatCurrency(forseringData.paalopte_kostnader)}
                </span>
              </DataListItem>
            )}
          </DataList>
        </DashboardCard>
      </div>

      {/* BH Response card - full width */}
      <DashboardCard
        title="Byggherrens standpunkt"
        headerBadge={hasGittStandpunkt ? getBHResponseBadge(forseringData) : undefined}
        action={canGiStandpunkt && onGiStandpunkt && (
          <Button
            variant={hasGittStandpunkt ? 'secondary' : 'primary'}
            size="sm"
            onClick={onGiStandpunkt}
          >
            <ChatBubbleIcon className="w-4 h-4 mr-2" />
            {hasGittStandpunkt ? 'Endre standpunkt' : 'Gi standpunkt'}
          </Button>
        )}
      >
        {hasGittStandpunkt ? (
          <DataList>
            <DataListItem label={erSubsidiaert ? 'Godkjent (prinsipal)' : 'Godkjent'}>
              <span className="font-bold">{formatCurrency(godkjentBelop)}</span>
            </DataListItem>
            {erSubsidiaert && subsidiaerBelop !== undefined && (
              <DataListItem label="Subsidiært godkjent">
                <span className="text-pkt-text-body-subtle">
                  {formatCurrency(subsidiaerBelop)}
                </span>
              </DataListItem>
            )}
          </DataList>
        ) : (
          <p className="text-sm text-pkt-text-body-subtle">
            Byggherre har ikke gitt standpunkt til forseringen ennå.
          </p>
        )}
      </DashboardCard>
    </div>
  );
}
