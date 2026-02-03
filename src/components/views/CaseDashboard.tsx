/**
 * CaseDashboard Component
 *
 * Alternative dashboard layout using DashboardCard (same as ForseringPage).
 * Displays status for all three tracks with badges instead of colored borders.
 *
 * Supports inline vederlag revision for quick amount updates.
 */

import { ReactNode, useMemo, useState } from 'react';
import { DashboardCard, InlineDataList, InlineDataListItem, Badge, Button } from '../primitives';
import { CategoryLabel } from '../shared';
import { InlineReviseVederlag } from '../actions/InlineReviseVederlag';
import { InlineReviseFrist } from '../actions/InlineReviseFrist';
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
import { Pencil1Icon } from '@radix-ui/react-icons';
import type { VederlagsMetode } from '../actions/shared';
import type { FristVarselType } from '../../types/timeline';

/** Data needed for inline vederlag revision */
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
    /** BH's foreslåtte metode (hvis ulik TEs metode) - brukes som forhåndsvalg */
    bh_metode?: VederlagsMetode;
  };
  currentVersion?: number;
  /** Callback to open full modal for advanced options */
  onOpenFullModal: () => void;
  /** Whether inline revision is allowed (canUpdateVederlag && userRole === 'TE') */
  canRevise: boolean;
  /** Whether to show primary variant (BH rejected/partial and TE hasn't revised yet) */
  showPrimaryVariant?: boolean;
}

/** Data needed for inline frist revision */
interface InlineFristRevisionProps {
  sakId: string;
  lastFristEvent: {
    event_id: string;
    antall_dager: number;
    begrunnelse?: string;
  };
  /** Original varsel type - determines if this is specification or revision */
  originalVarselType?: FristVarselType;
  /** Callback to open full modal for advanced options */
  onOpenFullModal: () => void;
  /** Whether inline revision is allowed (canUpdateFrist && userRole === 'TE' && !harMottattForesporsel) */
  canRevise: boolean;
  /** Whether to show primary variant (BH rejected/partial and TE hasn't revised yet) */
  showPrimaryVariant?: boolean;
}

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
  /** Props for inline vederlag revision (optional - if not provided, uses vederlagActions) */
  inlineVederlagRevision?: InlineVederlagRevisionProps;
  /** Props for inline frist revision (optional - if not provided, uses fristActions) */
  inlineFristRevision?: InlineFristRevisionProps;
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
 * Includes hovedkrav + særskilte krav (§34.1.3: rigg/drift og produktivitet)
 */
function getKrevdBelop(state: SakState): number | undefined {
  const v = state.vederlag;

  // Hovedkrav
  let hovedkrav: number | undefined;
  if (v.metode === 'REGNINGSARBEID' && v.kostnads_overslag !== undefined) {
    hovedkrav = v.kostnads_overslag;
  } else {
    hovedkrav = v.belop_direkte;
  }

  // Særskilte krav (§34.1.3)
  const riggBelop = v.saerskilt_krav?.rigg_drift?.belop ?? 0;
  const produktivitetBelop = v.saerskilt_krav?.produktivitet?.belop ?? 0;

  // Returner undefined kun hvis ingen beløp finnes
  if (hovedkrav === undefined && riggBelop === 0 && produktivitetBelop === 0) {
    return undefined;
  }

  return (hovedkrav ?? 0) + riggBelop + produktivitetBelop;
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
  inlineVederlagRevision,
  inlineFristRevision,
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

  // Inline vederlag revision state
  const [inlineReviseOpen, setInlineReviseOpen] = useState(false);

  // Inline frist revision state
  const [inlineFristReviseOpen, setInlineFristReviseOpen] = useState(false);

  return (
    <section aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading" className="sr-only">
        Status Dashboard
      </h2>

      <div className="space-y-4">
        {/* Grunnlag Card */}
        <div data-onboarding="grunnlag-card">
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
          {/* Kategori som tekst med info-ikon for kontraktsregel */}
          {state.grunnlag.hovedkategori && (
            <div className="mb-2">
              <CategoryLabel
                hovedkategori={state.grunnlag.hovedkategori}
                underkategori={state.grunnlag.underkategori}
              />
            </div>
          )}
          {/* §32.2 Preklusjon: BH mener varselet kom for sent */}
          {state.grunnlag.grunnlag_varslet_i_tide === false && (
            <div className="mb-2 px-2.5 py-1.5 rounded-md bg-alert-warning-bg border border-alert-warning-border">
              <p className="text-xs font-medium text-alert-warning-text">
                BH påberoper §32.2-preklusjon (varslet for sent)
                {state.grunnlag.bh_resultat && (
                  <span className="font-normal">
                    {' '}– subsidiært{' '}
                    {state.grunnlag.bh_resultat === 'godkjent'
                      ? 'godkjent'
                      : state.grunnlag.bh_resultat === 'avslatt'
                      ? 'avslått'
                      : 'delvis godkjent'}
                  </span>
                )}
              </p>
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
        </div>

        {/* Vederlag Card */}
        <div data-onboarding="vederlag-card">
          <DashboardCard
            title="Vederlag"
            headerBadge={getStatusBadge(state.vederlag.status)}
            action={
              inlineVederlagRevision ? (
                // Use inline revision - show "Revider" button that toggles inline form
                <>
                  {inlineVederlagRevision.canRevise && !inlineReviseOpen && (
                    <Button
                      variant={inlineVederlagRevision.showPrimaryVariant ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setInlineReviseOpen(true)}
                    >
                      <Pencil1Icon className="w-4 h-4 mr-2" />
                      Revider
                    </Button>
                  )}
                  {/* Pass through other vederlagActions if any (like BH response buttons) */}
                  {vederlagActions}
                </>
              ) : (
                vederlagActions
              )
            }
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

          {/* Inline Vederlag Revision Form */}
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
          </DashboardCard>
        </div>

        {/* Frist Card */}
        <div data-onboarding="frist-card">
          <DashboardCard
            title="Fristforlengelse"
            headerBadge={getStatusBadge(state.frist.status)}
            action={
              inlineFristRevision ? (
                // Use inline revision - show "Revider" button that toggles inline form
                <>
                  {inlineFristRevision.canRevise && !inlineFristReviseOpen && (
                    <Button
                      variant={inlineFristRevision.showPrimaryVariant ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setInlineFristReviseOpen(true)}
                    >
                      <Pencil1Icon className="w-4 h-4 mr-2" />
                      Revider
                    </Button>
                  )}
                  {/* Pass through other fristActions if any (like BH response buttons) */}
                  {fristActions}
                </>
              ) : (
                fristActions
              )
            }
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

          {/* Inline Frist Revision Form */}
          {inlineFristRevision && inlineFristReviseOpen && (
            <InlineReviseFrist
              sakId={inlineFristRevision.sakId}
              lastFristEvent={inlineFristRevision.lastFristEvent}
              originalVarselType={inlineFristRevision.originalVarselType}
              onOpenFullModal={() => {
                setInlineFristReviseOpen(false);
                inlineFristRevision.onOpenFullModal();
              }}
              onClose={() => setInlineFristReviseOpen(false)}
              onSuccess={() => setInlineFristReviseOpen(false)}
            />
          )}

          <SporHistory spor="frist" entries={fristEntries} events={events} sakState={state} externalOpen={fristExpanded} />
          </DashboardCard>
        </div>
      </div>
    </section>
  );
}
