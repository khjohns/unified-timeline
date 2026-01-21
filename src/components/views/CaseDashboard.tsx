/**
 * CaseDashboard Component
 *
 * Alternative dashboard layout using DashboardCard (same as ForseringPage).
 * Displays status for all three tracks with badges instead of colored borders.
 */

import { ReactNode, useMemo } from 'react';
import { DashboardCard, DataList, DataListItem, Badge } from '../primitives';
import { SakState, SporStatus, TimelineEvent } from '../../types/timeline';
import { GrunnlagHistorikkEntry, VederlagHistorikkEntry, FristHistorikkEntry } from '../../types/api';
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
  transformGrunnlagHistorikk,
  transformVederlagHistorikk,
  transformFristHistorikk,
} from './SporHistory';

interface CaseDashboardProps {
  state: SakState;
  grunnlagActions?: ReactNode;
  vederlagActions?: ReactNode;
  fristActions?: ReactNode;
  /** Timeline events for EventDetailModal lookup */
  events?: TimelineEvent[];
  /** Grunnlag history entries from backend */
  grunnlagHistorikk?: GrunnlagHistorikkEntry[];
  /** Vederlag history entries from backend */
  vederlagHistorikk?: VederlagHistorikkEntry[];
  /** Frist history entries from backend */
  fristHistorikk?: FristHistorikkEntry[];
}

/**
 * Map SporStatus to Badge component using centralized styles
 */
function getStatusBadge(status: SporStatus): ReactNode {
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
  grunnlagHistorikk = [],
  vederlagHistorikk = [],
  fristHistorikk = [],
}: CaseDashboardProps) {
  const krevdBelop = useMemo(() => getKrevdBelop(state), [state]);

  // Vis subsidiær hvis det finnes subsidiær-data (uansett årsak: grunnlagsavslag, preklusjon, etc.)
  const vederlagErSubsidiaer = state.vederlag.subsidiaer_godkjent_belop != null;
  const fristErSubsidiaer = state.frist.subsidiaer_godkjent_dager != null;

  // Transform historikk data for SporHistory
  const grunnlagEntries = useMemo(() => transformGrunnlagHistorikk(grunnlagHistorikk), [grunnlagHistorikk]);
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
          variant="default"
          className="animate-fade-in-up"
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
          headerBadge={getStatusBadge(state.vederlag.status)}
          action={vederlagActions}
          variant="default"
          className="animate-fade-in-up"
          style={{ animationDelay: '75ms' }}
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
            {/* Godkjent beløp: Vis subsidiær hvis det finnes subsidiær-data */}
            {vederlagErSubsidiaer ? (
              state.vederlag.subsidiaer_godkjent_belop != null && (
                <DataListItem label="Subs. godkjent">
                  {formatCurrency(state.vederlag.subsidiaer_godkjent_belop)}
                </DataListItem>
              )
            ) : (
              state.vederlag.godkjent_belop !== undefined && (
                <DataListItem label="Godkjent beløp">
                  {formatCurrency(state.vederlag.godkjent_belop)}
                </DataListItem>
              )
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
          headerBadge={getStatusBadge(state.frist.status)}
          action={fristActions}
          variant="default"
          className="animate-fade-in-up"
          style={{ animationDelay: '150ms' }}
        >
          <DataList variant="grid">
            {state.frist.krevd_dager !== undefined && (
              <DataListItem label="Krevd">
                {formatDays(state.frist.krevd_dager)}
              </DataListItem>
            )}
            {/* Godkjent dager: Vis subsidiær hvis det finnes subsidiær-data */}
            {fristErSubsidiaer ? (
              state.frist.subsidiaer_godkjent_dager != null && (
                <DataListItem label="Subs. godkjent">
                  {formatDays(state.frist.subsidiaer_godkjent_dager)}
                </DataListItem>
              )
            ) : (
              state.frist.godkjent_dager !== undefined && (
                <DataListItem label="Godkjent">
                  {formatDays(state.frist.godkjent_dager)}
                </DataListItem>
              )
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
