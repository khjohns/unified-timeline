/**
 * CaseDashboard Component
 *
 * Alternative dashboard layout using DashboardCard (same as ForseringPage).
 * Displays status for all three tracks with badges instead of colored borders.
 */

import { ReactNode, useMemo } from 'react';
import { DashboardCard, DataList, DataListItem, Badge } from '../primitives';
import { SakState, SporStatus, TimelineEvent } from '../../types/timeline';
import { VederlagHistorikkEntry, FristHistorikkEntry } from '../../types/api';
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
import {
  SporHistory,
  transformVederlagHistorikk,
  transformFristHistorikk,
  transformGrunnlagEvents,
} from './SporHistory';

interface CaseDashboardProps {
  state: SakState;
  grunnlagActions?: ReactNode;
  vederlagActions?: ReactNode;
  fristActions?: ReactNode;
  /** Timeline events for grunnlag history */
  events?: TimelineEvent[];
  /** Vederlag history entries from backend */
  vederlagHistorikk?: VederlagHistorikkEntry[];
  /** Frist history entries from backend */
  fristHistorikk?: FristHistorikkEntry[];
}

/**
 * Map SporStatus to Badge component using centralized styles
 */
function getStatusBadge(status: SporStatus, erSubsidiaert?: boolean): ReactNode {
  // Subsidiary status gets special treatment
  if (erSubsidiaert) {
    return <Badge variant="warning">Godkjent (subsidiært)</Badge>;
  }

  const { variant, label } = getSporStatusStyle(status);
  return <Badge variant={variant}>{label}</Badge>;
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
  events = [],
  vederlagHistorikk = [],
  fristHistorikk = [],
}: CaseDashboardProps) {
  const krevdBelop = useMemo(() => getKrevdBelop(state), [state]);

  // Transform historikk data for SporHistory
  const grunnlagEntries = useMemo(() => transformGrunnlagEvents(events), [events]);
  const vederlagEntries = useMemo(() => transformVederlagHistorikk(vederlagHistorikk), [vederlagHistorikk]);
  const fristEntries = useMemo(() => transformFristHistorikk(fristHistorikk), [fristHistorikk]);

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
              <DataListItem label="Resultat">
                {formatBHResultat(state.grunnlag.bh_resultat).label}
              </DataListItem>
            )}
          </DataList>
          <SporHistory spor="grunnlag" entries={grunnlagEntries} events={events} />
        </DashboardCard>

        {/* Vederlag Card */}
        <DashboardCard
          title="Vederlag"
          headerBadge={getStatusBadge(state.vederlag.status, state.er_subsidiaert_vederlag)}
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
              <DataListItem label="Resultat">
                {formatBHResultat(state.vederlag.bh_resultat).label}
              </DataListItem>
            )}
          </DataList>
          <SporHistory spor="vederlag" entries={vederlagEntries} events={events} />
        </DashboardCard>

        {/* Frist Card */}
        <DashboardCard
          title="Fristforlengelse"
          headerBadge={getStatusBadge(state.frist.status, state.er_subsidiaert_frist)}
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
              <DataListItem label="Resultat">
                {formatBHResultat(state.frist.bh_resultat).label}
              </DataListItem>
            )}
          </DataList>
          <SporHistory spor="frist" entries={fristEntries} events={events} />
        </DashboardCard>
      </div>
    </section>
  );
}
