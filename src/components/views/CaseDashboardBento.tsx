/**
 * CaseDashboardBento Component
 *
 * Bento grid variant of CaseDashboard with domain-aware card hierarchy:
 *
 * - Grunnlag as "master card" (§25.2): dark-blue top accent, visual weight.
 *   This is the gate — without grunnlag, vederlag and frist are subsidiary.
 *
 * - Vederlag (§34) and Frist (§33) as "dependent cards":
 *   Show subsidiary badge when grunnlag is rejected.
 *   Dimmed when grunnlag hasn't been sent yet.
 *
 * - Compact icon-button actions with hover tooltips.
 *
 * Layout:
 * - Mobile: stacked
 * - md: Grunnlag full-width, Vederlag + Frist side-by-side (6+6)
 * - xl+: All three side-by-side (4+4+4)
 */

import { ReactNode, useMemo, useState } from 'react';
import { BentoDashboardCard, InlineDataList, InlineDataListItem, Badge, Button } from '../primitives';
import { CategoryLabel } from '../shared';
import { InlineReviseVederlag } from '../actions/InlineReviseVederlag';
import { SakState, SporStatus, TimelineEvent } from '../../types/timeline';
import { GrunnlagHistorikkEntry, VederlagHistorikkEntry, FristHistorikkEntry } from '../../types/api';
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
import { Pencil1Icon } from '@radix-ui/react-icons';
import type { VederlagsMetode } from '../actions/shared';
import type { FristVarselType } from '../../types/timeline';

// ========== Types ==========

interface InlineVederlagRevisionProps {
  sakId: string;
  lastVederlagEvent: {
    event_id: string;
    metode: VederlagsMetode;
    belop_direkte?: number;
    kostnads_overslag?: number;
    begrunnelse?: string;
    krever_justert_ep?: boolean;
    varslet_for_oppstart?: boolean;
    saerskilt_krav?: {
      rigg_drift?: { belop?: number; dato_klar_over?: string };
      produktivitet?: { belop?: number; dato_klar_over?: string };
    } | null;
    bh_metode?: VederlagsMetode;
  };
  currentVersion?: number;
  onOpenFullModal: () => void;
  canRevise: boolean;
  showPrimaryVariant?: boolean;
}

interface InlineFristRevisionProps {
  sakId: string;
  lastFristEvent: {
    event_id: string;
    antall_dager: number;
    begrunnelse?: string;
  };
  originalVarselType?: FristVarselType;
  onOpenFullModal: () => void;
  canRevise: boolean;
  showPrimaryVariant?: boolean;
}

interface CaseDashboardBentoProps {
  state: SakState;
  grunnlagActions?: ReactNode;
  vederlagActions?: ReactNode;
  fristActions?: ReactNode;
  events?: TimelineEvent[];
  grunnlagHistorikk?: GrunnlagHistorikkEntry[];
  vederlagHistorikk?: VederlagHistorikkEntry[];
  fristHistorikk?: FristHistorikkEntry[];
  inlineVederlagRevision?: InlineVederlagRevisionProps;
  inlineFristRevision?: InlineFristRevisionProps;
}

// ========== Helpers ==========

function getStatusBadge(status: SporStatus): ReactNode {
  const { variant, label } = getSporStatusStyle(status);
  return <Badge variant={variant}>{label}</Badge>;
}

function getKrevdBelop(state: SakState): number | undefined {
  const v = state.vederlag;
  let hovedkrav: number | undefined;
  if (v.metode === 'REGNINGSARBEID' && v.kostnads_overslag !== undefined) {
    hovedkrav = v.kostnads_overslag;
  } else {
    hovedkrav = v.belop_direkte;
  }
  const riggBelop = v.saerskilt_krav?.rigg_drift?.belop ?? 0;
  const produktivitetBelop = v.saerskilt_krav?.produktivitet?.belop ?? 0;
  if (hovedkrav === undefined && riggBelop === 0 && produktivitetBelop === 0) {
    return undefined;
  }
  return (hovedkrav ?? 0) + riggBelop + produktivitetBelop;
}

// ========== Component ==========

export function CaseDashboardBento({
  state,
  grunnlagActions,
  vederlagActions,
  fristActions,
  events = [],
  grunnlagHistorikk = [],
  vederlagHistorikk = [],
  fristHistorikk = [],
  inlineVederlagRevision,
  inlineFristRevision,
}: CaseDashboardBentoProps) {
  const krevdBelop = useMemo(() => getKrevdBelop(state), [state]);

  // Subsidiary logic: grunnlag rejected → vederlag/frist treated subsidiarily
  const vederlagErSubsidiaer = state.vederlag.subsidiaer_godkjent_belop != null;
  const fristErSubsidiaer = state.frist.subsidiaer_godkjent_dager != null;

  // Grunnlag not yet sent → dependent tracks are dimmed
  const grunnlagIkkeSendt = state.grunnlag.status === 'ikke_relevant' || state.grunnlag.status === 'utkast';

  const grunnlagEntries = useMemo(() => transformGrunnlagHistorikk(grunnlagHistorikk), [grunnlagHistorikk]);
  const vederlagEntries = useMemo(() => transformVederlagHistorikk(vederlagHistorikk), [vederlagHistorikk]);
  const fristEntries = useMemo(() => transformFristHistorikk(fristHistorikk), [fristHistorikk]);

  const [grunnlagExpanded, setGrunnlagExpanded] = useState(false);
  const [vederlagExpanded, setVederlagExpanded] = useState(false);
  const [fristExpanded, setFristExpanded] = useState(false);
  const [inlineReviseOpen, setInlineReviseOpen] = useState(false);
  const [inlineFristReviseOpen, setInlineFristReviseOpen] = useState(false);

  // Build inline revision action for vederlag
  const vederlagAction = useMemo(() => {
    if (!inlineVederlagRevision) return vederlagActions;
    return (
      <>
        {inlineVederlagRevision.canRevise && !inlineReviseOpen && (
          <Button
            variant={inlineVederlagRevision.showPrimaryVariant ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setInlineReviseOpen(true)}
            className="!px-3 !py-1.5 !min-h-[28px] !text-xs"
          >
            <Pencil1Icon className="w-3.5 h-3.5 mr-1.5" />
            Revider
          </Button>
        )}
        {vederlagActions}
      </>
    );
  }, [inlineVederlagRevision, inlineReviseOpen, vederlagActions]);

  // Build inline revision action for frist
  const fristAction = useMemo(() => {
    if (!inlineFristRevision) return fristActions;
    return (
      <>
        {inlineFristRevision.canRevise && !inlineFristReviseOpen && (
          <Button
            variant={inlineFristRevision.showPrimaryVariant ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setInlineFristReviseOpen(true)}
            className="!px-3 !py-1.5 !min-h-[28px] !text-xs"
          >
            <Pencil1Icon className="w-3.5 h-3.5 mr-1.5" />
            Revider
          </Button>
        )}
        {fristActions}
      </>
    );
  }, [inlineFristRevision, inlineFristReviseOpen, fristActions]);

  return (
    <section aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading" className="sr-only">
        Status Dashboard
      </h2>

      <div className="grid grid-cols-12 gap-2 sm:gap-4 items-start">

        {/* ===== Grunnlag: Master Card ===== */}
        <div className="col-span-12 xl:col-span-4" data-onboarding="grunnlag-card">
          <BentoDashboardCard
            title="Ansvarsgrunnlag"
            hjemmel="§25.2"
            role="master"
            headerBadge={
              <div className="flex items-center gap-1.5 flex-wrap">
                {getStatusBadge(state.grunnlag.status)}
                {state.grunnlag.grunnlag_varslet_i_tide === false && state.grunnlag.status !== 'trukket' && (
                  <Badge variant="warning" size="sm">§32.2</Badge>
                )}
              </div>
            }
            action={grunnlagActions}
            className="animate-fade-in-up"
            collapsible
            historyCount={grunnlagEntries.length}
            isExpanded={grunnlagExpanded}
            onExpandedChange={setGrunnlagExpanded}
          >
            {state.grunnlag.hovedkategori && (
              <div className="mb-2">
                <CategoryLabel
                  hovedkategori={state.grunnlag.hovedkategori}
                  underkategori={Array.isArray(state.grunnlag.underkategori) ? state.grunnlag.underkategori[0] : state.grunnlag.underkategori}
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
          </BentoDashboardCard>
        </div>

        {/* ===== Vederlag: Dependent Card ===== */}
        <div className="col-span-12 md:col-span-6 xl:col-span-4" data-onboarding="vederlag-card">
          <BentoDashboardCard
            title="Vederlag"
            hjemmel="§34"
            role="dependent"
            isSubsidiary={vederlagErSubsidiaer}
            isDimmed={grunnlagIkkeSendt}
            headerBadge={getStatusBadge(state.vederlag.status)}
            action={vederlagAction}
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

            {inlineVederlagRevision && inlineReviseOpen && (
              <InlineReviseVederlag
                sakId={inlineVederlagRevision.sakId}
                lastVederlagEvent={inlineVederlagRevision.lastVederlagEvent}
                currentVersion={inlineVederlagRevision.currentVersion}
                onOpenFullModal={() => {
                  setInlineReviseOpen(false);
                  inlineVederlagRevision.onOpenFullModal();
                }}
                onClose={() => setInlineReviseOpen(false)}
                onSuccess={() => setInlineReviseOpen(false)}
              />
            )}

            <SporHistory spor="vederlag" entries={vederlagEntries} events={events} sakState={state} externalOpen={vederlagExpanded} />
          </BentoDashboardCard>
        </div>

        {/* ===== Frist: Dependent Card ===== */}
        <div className="col-span-12 md:col-span-6 xl:col-span-4" data-onboarding="frist-card">
          <BentoDashboardCard
            title="Fristforlengelse"
            hjemmel="§33"
            role="dependent"
            isSubsidiary={fristErSubsidiaer}
            isDimmed={grunnlagIkkeSendt}
            headerBadge={getStatusBadge(state.frist.status)}
            action={fristAction}
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
          </BentoDashboardCard>
        </div>
      </div>
    </section>
  );
}
