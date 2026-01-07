/**
 * CaseDashboard Component
 *
 * Alternative dashboard layout using DashboardCard (same as ForseringPage).
 * Displays status for all three tracks with badges instead of colored borders.
 * Supports approval workflow integration with optional approval status display.
 */

import { ReactNode, useMemo } from 'react';
import { DashboardCard, DataList, DataListItem, Badge } from '../primitives';
import { SakState, SporStatus } from '../../types/timeline';
import type { ApprovalRequest } from '../../types/approval';
import { getHovedkategoriLabel, getUnderkategoriLabel } from '../../constants/categories';
import { getVederlagsmetodeLabel } from '../../constants/paymentMethods';
import { getSporStatusStyle } from '../../constants/statusStyles';
import {
  formatCurrency,
  formatDays,
  formatDateMedium,
  formatBHResultat,
  formatVarselType,
} from '../../utils/formatters';
import { ApprovalChainStatus } from '../approval/ApprovalChainStatus';

interface CaseDashboardProps {
  state: SakState;
  grunnlagActions?: ReactNode;
  vederlagActions?: ReactNode;
  fristActions?: ReactNode;
  /** Pending vederlag approval request (for approval workflow) */
  vederlagApproval?: ApprovalRequest;
  /** Pending frist approval request (for approval workflow) */
  fristApproval?: ApprovalRequest;
}

/**
 * Map SporStatus to Badge component using centralized styles
 */
function getStatusBadge(status: SporStatus, erSubsidiaert?: boolean): ReactNode {
  // Subsidiary status gets special treatment
  if (erSubsidiaert) {
    return <Badge variant="warning" size="sm">Godkjent (subsidiært)</Badge>;
  }

  const { variant, label } = getSporStatusStyle(status);
  return <Badge variant={variant} size="sm">{label}</Badge>;
}

/**
 * Get krevd beløp based on vederlagsmetode
 */
function getKrevdBelop(state: SakState): number | undefined {
  const v = state.vederlag;
  if (v.metode === 'REGNINGSARBEID' && v.kostnads_overslag !== undefined) {
    return v.kostnads_overslag;
  }
  return v.belop_direkte;
}

/**
 * Get status badge for approval workflow
 */
function getApprovalStatusBadge(approval: ApprovalRequest | undefined): ReactNode {
  if (!approval) return null;

  switch (approval.status) {
    case 'pending':
      return <Badge variant="warning" size="sm">Venter på godkjenning</Badge>;
    case 'approved':
      return <Badge variant="success" size="sm">Godkjent</Badge>;
    case 'rejected':
      return <Badge variant="danger" size="sm">Avvist</Badge>;
    case 'draft':
      return <Badge variant="info" size="sm">Utkast</Badge>;
    default:
      return null;
  }
}

/**
 * CaseDashboard renders three-track status using DashboardCard components
 * Same visual style as ForseringDashboard for consistency
 */
export function CaseDashboard({
  state,
  grunnlagActions,
  vederlagActions,
  fristActions,
  vederlagApproval,
  fristApproval,
}: CaseDashboardProps) {
  const krevdBelop = useMemo(() => getKrevdBelop(state), [state]);

  // Determine if we should show approval badge instead of regular status
  const vederlagBadge = vederlagApproval?.status === 'pending'
    ? getApprovalStatusBadge(vederlagApproval)
    : getStatusBadge(state.vederlag.status, state.er_subsidiaert_vederlag);

  const fristBadge = fristApproval?.status === 'pending'
    ? getApprovalStatusBadge(fristApproval)
    : getStatusBadge(state.frist.status, state.er_subsidiaert_frist);

  return (
    <section aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading" className="sr-only">
        Status Dashboard
      </h2>

      <div className="space-y-4">
        {/* Grunnlag Card */}
        <DashboardCard
          title="Ansvarsgrunnlag"
          headerBadge={getStatusBadge(state.grunnlag.status)}
          action={grunnlagActions}
          variant="outlined"
        >
          <DataList variant="grid">
            <DataListItem label="Hovedkategori">
              {state.grunnlag.hovedkategori
                ? getHovedkategoriLabel(state.grunnlag.hovedkategori)
                : '-'}
            </DataListItem>
            {state.grunnlag.underkategori && (
              <DataListItem label="Underkategori">
                {Array.isArray(state.grunnlag.underkategori)
                  ? state.grunnlag.underkategori.map(uk => getUnderkategoriLabel(uk)).join(', ')
                  : getUnderkategoriLabel(state.grunnlag.underkategori)}
              </DataListItem>
            )}
            {state.grunnlag.dato_oppdaget && (
              <DataListItem label="Dato oppdaget">
                {formatDateMedium(state.grunnlag.dato_oppdaget)}
              </DataListItem>
            )}
            {state.grunnlag.grunnlag_varsel?.dato_sendt && (
              <DataListItem label="Varslet">
                {formatDateMedium(state.grunnlag.grunnlag_varsel.dato_sendt)}
              </DataListItem>
            )}
            {state.grunnlag.bh_resultat && (
              <DataListItem label="BH resultat">
                {formatBHResultat(state.grunnlag.bh_resultat).label}
              </DataListItem>
            )}
          </DataList>
        </DashboardCard>

        {/* Vederlag Card */}
        <DashboardCard
          title="Vederlag"
          headerBadge={vederlagBadge}
          action={vederlagActions}
          variant="outlined"
        >
          <DataList variant="grid">
            {state.vederlag.metode && (
              <DataListItem label="Metode">
                {getVederlagsmetodeLabel(state.vederlag.metode)}
              </DataListItem>
            )}
            <DataListItem label="Krevd beløp">
              {formatCurrency(krevdBelop)}
            </DataListItem>
            {state.vederlag.godkjent_belop !== undefined && (
              <DataListItem label="Godkjent beløp">
                {formatCurrency(state.vederlag.godkjent_belop)}
              </DataListItem>
            )}
            {state.vederlag.bh_resultat && (
              <DataListItem label="BH resultat">
                {formatBHResultat(state.vederlag.bh_resultat).label}
              </DataListItem>
            )}
          </DataList>
          {/* Approval Chain Status (when pending approval) */}
          {vederlagApproval?.status === 'pending' && (
            <div className="mt-4 pt-4 border-t border-pkt-border-subtle">
              <ApprovalChainStatus
                steps={vederlagApproval.steps}
                compact={false}
                collapsible={true}
                defaultCollapsed={true}
              />
            </div>
          )}
        </DashboardCard>

        {/* Frist Card */}
        <DashboardCard
          title="Fristforlengelse"
          headerBadge={fristBadge}
          action={fristActions}
          variant="outlined"
        >
          <DataList variant="grid">
            {state.frist.krevd_dager !== undefined && (
              <DataListItem label="Krevd">
                {formatDays(state.frist.krevd_dager)}
              </DataListItem>
            )}
            {state.frist.godkjent_dager !== undefined && (
              <DataListItem label="Godkjent">
                {formatDays(state.frist.godkjent_dager)}
              </DataListItem>
            )}
            {state.frist.varsel_type && (
              <DataListItem label="Varseltype">
                {formatVarselType(state.frist.varsel_type)}
              </DataListItem>
            )}
            {state.frist.bh_resultat && (
              <DataListItem label="BH resultat">
                {formatBHResultat(state.frist.bh_resultat).label}
              </DataListItem>
            )}
          </DataList>
          {/* Approval Chain Status (when pending approval) */}
          {fristApproval?.status === 'pending' && (
            <div className="mt-4 pt-4 border-t border-pkt-border-subtle">
              <ApprovalChainStatus
                steps={fristApproval.steps}
                compact={false}
                collapsible={true}
                defaultCollapsed={true}
              />
            </div>
          )}
        </DashboardCard>
      </div>
    </section>
  );
}
