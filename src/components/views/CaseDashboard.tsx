/**
 * CaseDashboard Component
 *
 * Alternative dashboard layout using DashboardCard (same as ForseringPage).
 * Displays status for all three tracks with badges instead of colored borders.
 */

import { ReactNode, useMemo, useState } from 'react';
import { DashboardCard, InlineDataList, InlineDataListItem, Badge } from '../primitives';
import { CategoryAccordion } from '../shared';
import { SakState, SporStatus, TimelineEvent } from '../../types/timeline';
import { GrunnlagHistorikkEntry, VederlagHistorikkEntry, FristHistorikkEntry } from '../../types/api';
// getHovedkategoriLabel, getUnderkategoriLabel erstattet av CategoryAccordion
import { getVederlagsmetodeLabel } from '../../constants/paymentMethods';
import { getSporStatusStyle } from '../../constants/statusStyles';
import {
  formatCurrency,
  formatDays,
  formatDateMedium,
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

  // Collapsible state for each card's history
  const [grunnlagExpanded, setGrunnlagExpanded] = useState(false);
  const [vederlagExpanded, setVederlagExpanded] = useState(false);
  const [fristExpanded, setFristExpanded] = useState(false);

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
          collapsible
          historyCount={grunnlagEntries.length}
          isExpanded={grunnlagExpanded}
          onExpandedChange={setGrunnlagExpanded}
        >
          {/* Kategori med accordion for kontraktsregel */}
          {state.grunnlag.hovedkategori && (
            <div className="mb-2">
              <CategoryAccordion
                hovedkategori={state.grunnlag.hovedkategori}
                underkategori={state.grunnlag.underkategori}
              />
            </div>
          )}

          <InlineDataList stackOnMobile>
            {state.grunnlag.dato_oppdaget && (
              <InlineDataListItem label="Oppdaget">
                {formatDateMedium(state.grunnlag.dato_oppdaget)}
              </InlineDataListItem>
            )}
            {state.grunnlag.grunnlag_varsel?.dato_sendt && (
              <InlineDataListItem label="Varslet">
                {formatDateMedium(state.grunnlag.grunnlag_varsel.dato_sendt)}
              </InlineDataListItem>
            )}
          </InlineDataList>
          <SporHistory spor="grunnlag" entries={grunnlagEntries} events={events} sakState={state} externalOpen={grunnlagExpanded} />
        </DashboardCard>

        {/* Vederlag Card */}
        <DashboardCard
          title="Vederlag"
          headerBadge={getStatusBadge(state.vederlag.status)}
          action={vederlagActions}
          variant="default"
          className="animate-fade-in-up"
          style={{ animationDelay: '75ms' }}
          collapsible
          historyCount={vederlagEntries.length}
          isExpanded={vederlagExpanded}
          onExpandedChange={setVederlagExpanded}
        >
          <InlineDataList stackOnMobile>
            {state.vederlag.metode && (
              <InlineDataListItem label="Metode">
                {getVederlagsmetodeLabel(state.vederlag.metode)}
              </InlineDataListItem>
            )}
            <InlineDataListItem label="Krevd" mono>
              {formatCurrency(krevdBelop)}
            </InlineDataListItem>
            {vederlagErSubsidiaer ? (
              state.vederlag.subsidiaer_godkjent_belop != null && (
                <InlineDataListItem label="Subs. godkjent" mono>
                  {formatCurrency(state.vederlag.subsidiaer_godkjent_belop)}
                </InlineDataListItem>
              )
            ) : (
              state.vederlag.godkjent_belop !== undefined && (
                <InlineDataListItem label="Godkjent" mono>
                  {formatCurrency(state.vederlag.godkjent_belop)}
                </InlineDataListItem>
              )
            )}
          </InlineDataList>
          <SporHistory spor="vederlag" entries={vederlagEntries} events={events} sakState={state} externalOpen={vederlagExpanded} />
        </DashboardCard>

        {/* Frist Card */}
        <DashboardCard
          title="Fristforlengelse"
          headerBadge={getStatusBadge(state.frist.status)}
          action={fristActions}
          variant="default"
          className="animate-fade-in-up"
          style={{ animationDelay: '150ms' }}
          collapsible
          historyCount={fristEntries.length}
          isExpanded={fristExpanded}
          onExpandedChange={setFristExpanded}
        >
          <InlineDataList stackOnMobile>
            {state.frist.frist_varsel?.dato_sendt && (
              <InlineDataListItem label="Varslet">
                {formatDateMedium(state.frist.frist_varsel.dato_sendt)}
              </InlineDataListItem>
            )}
            {state.frist.spesifisert_varsel?.dato_sendt && (
              <InlineDataListItem label="Spesifisert">
                {formatDateMedium(state.frist.spesifisert_varsel.dato_sendt)}
              </InlineDataListItem>
            )}
            {state.frist.krevd_dager !== undefined && (
              <InlineDataListItem label="Krevd" mono>
                {formatDays(state.frist.krevd_dager)}
              </InlineDataListItem>
            )}
            {fristErSubsidiaer ? (
              state.frist.subsidiaer_godkjent_dager != null && (
                <InlineDataListItem label="Subs. godkjent" mono>
                  {formatDays(state.frist.subsidiaer_godkjent_dager)}
                </InlineDataListItem>
              )
            ) : (
              state.frist.godkjent_dager !== undefined && (
                <InlineDataListItem label="Godkjent" mono>
                  {formatDays(state.frist.godkjent_dager)}
                </InlineDataListItem>
              )
            )}
          </InlineDataList>
          <SporHistory spor="frist" entries={fristEntries} events={events} sakState={state} externalOpen={fristExpanded} />
        </DashboardCard>
      </div>
    </section>
  );
}
