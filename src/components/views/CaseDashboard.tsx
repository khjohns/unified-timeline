/**
 * CaseDashboard Component
 *
 * Alternative dashboard layout using DashboardCard (same as ForseringPage).
 * Displays status for all three tracks with badges instead of colored borders.
 */

import { ReactNode, useMemo } from 'react';
import { DashboardCard, DataList, DataListItem, Badge } from '../primitives';
import { SakState, SporStatus } from '../../types/timeline';
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

interface CaseDashboardProps {
  state: SakState;
  grunnlagActions?: ReactNode;
  vederlagActions?: ReactNode;
  fristActions?: ReactNode;
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
 * CaseDashboard renders three-track status using DashboardCard components
 * Same visual style as ForseringDashboard for consistency
 */
export function CaseDashboard({
  state,
  grunnlagActions,
  vederlagActions,
  fristActions,
}: CaseDashboardProps) {
  const krevdBelop = useMemo(() => getKrevdBelop(state), [state]);

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
          variant="elevated"
        >
          <DataList>
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
            {state.grunnlag.bh_resultat && (() => {
              const { label, colorClass } = formatBHResultat(state.grunnlag.bh_resultat);
              return (
                <DataListItem label="BH resultat">
                  <span className={`${colorClass} font-medium`}>{label}</span>
                </DataListItem>
              );
            })()}
          </DataList>
        </DashboardCard>

        {/* Vederlag Card */}
        <DashboardCard
          title="Vederlag"
          headerBadge={getStatusBadge(state.vederlag.status, state.er_subsidiaert_vederlag)}
          action={vederlagActions}
          variant="elevated"
        >
          <DataList>
            {state.vederlag.metode && (
              <DataListItem label="Metode">
                {getVederlagsmetodeLabel(state.vederlag.metode)}
              </DataListItem>
            )}
            <DataListItem label="Krevd beløp">
              <span className="font-medium">{formatCurrency(krevdBelop)}</span>
            </DataListItem>
            {state.vederlag.godkjent_belop !== undefined && (
              <DataListItem label="Godkjent beløp">
                <span className="font-medium text-pkt-brand-green-1000">
                  {formatCurrency(state.vederlag.godkjent_belop)}
                </span>
              </DataListItem>
            )}
            {state.vederlag.bh_resultat && (() => {
              const { label, colorClass } = formatBHResultat(state.vederlag.bh_resultat);
              return (
                <DataListItem label="BH resultat">
                  <span className={`${colorClass} font-medium`}>{label}</span>
                </DataListItem>
              );
            })()}
          </DataList>
        </DashboardCard>

        {/* Frist Card */}
        <DashboardCard
          title="Fristforlengelse"
          headerBadge={getStatusBadge(state.frist.status, state.er_subsidiaert_frist)}
          action={fristActions}
          variant="elevated"
        >
          <DataList>
            {state.frist.krevd_dager !== undefined && (
              <DataListItem label="Krevd">
                <span className="font-medium">{formatDays(state.frist.krevd_dager)}</span>
              </DataListItem>
            )}
            {state.frist.godkjent_dager !== undefined && (
              <DataListItem label="Godkjent">
                <span className="font-medium text-pkt-brand-green-1000">
                  {formatDays(state.frist.godkjent_dager)}
                </span>
              </DataListItem>
            )}
            {state.frist.varsel_type && (
              <DataListItem label="Varseltype">
                {formatVarselType(state.frist.varsel_type)}
              </DataListItem>
            )}
            {state.frist.bh_resultat && (() => {
              const { label, colorClass } = formatBHResultat(state.frist.bh_resultat);
              return (
                <DataListItem label="BH resultat">
                  <span className={`${colorClass} font-medium`}>{label}</span>
                </DataListItem>
              );
            })()}
          </DataList>
        </DashboardCard>
      </div>
    </section>
  );
}
