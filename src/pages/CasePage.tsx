/**
 * CasePage Component
 *
 * Main page for viewing a case in the unified timeline architecture.
 * Displays status dashboard, available actions, and event timeline.
 * Shows a banner if the case is part of a forsering case or an endringsordre.
 */

import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCaseState } from '../hooks/useCaseState';
import { useTimeline } from '../hooks/useTimeline';
import { useActionPermissions } from '../hooks/useActionPermissions';
import { useUserRole } from '../hooks/useUserRole';
import { StatusDashboard } from '../components/views/StatusDashboard';
import { Timeline } from '../components/views/Timeline';
import { ComprehensiveMetadata } from '../components/views/ComprehensiveMetadata';
import { RevisionHistory } from '../components/views/RevisionHistory';
import { Button } from '../components/primitives/Button';
import { PageHeader } from '../components/PageHeader';
import { ForseringRelasjonBanner } from '../components/forsering';
import { UtstEndringsordreModal, EndringsordreRelasjonBanner } from '../components/endringsordre';
import {
  SendGrunnlagModal,
  SendVederlagModal,
  SendFristModal,
  RespondGrunnlagModal,
  RespondVederlagModal,
  RespondFristModal,
  // Update modals (TE)
  SendGrunnlagUpdateModal,
  ReviseVederlagModal,
  ReviseFristModal,
  // Update response modals (BH)
  RespondGrunnlagUpdateModal,
  UpdateResponseVederlagModal,
  UpdateResponseFristModal,
  // Special action modals (TE)
  SendForseringModal,
} from '../components/actions';
import { findForseringerForSak, type FindForseringerResponse } from '../api/forsering';
import { findEOerForSak, type FindEOerResponse } from '../api/endringsordre';
import type { SakState, GrunnlagResponsResultat, TimelineEntry } from '../types/timeline';
import {
  ReloadIcon,
  ExclamationTriangleIcon,
  DownloadIcon,
  PaperPlaneIcon,
  Pencil1Icon,
  ChatBubbleIcon,
  Pencil2Icon,
  RocketIcon,
  FileTextIcon,
} from '@radix-ui/react-icons';
import { downloadContractorClaimPdf } from '../pdf';

// Default empty state for when data is not yet loaded
const EMPTY_STATE: SakState = {
  sak_id: '',
  sakstittel: '',
  grunnlag: {
    status: 'utkast',
    kontraktsreferanser: [],
    laast: false,
    antall_versjoner: 0,
  },
  vederlag: {
    status: 'utkast',
    antall_versjoner: 0,
  },
  frist: {
    status: 'utkast',
    antall_versjoner: 0,
  },
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: '',
  visningsstatus_frist: '',
  overordnet_status: 'UTKAST',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: null,
    handling: '',
    spor: null,
  },
  sum_krevd: 0,
  sum_godkjent: 0,
  antall_events: 0,
};

/**
 * CasePage renders the complete case view with dashboard and timeline
 */
export function CasePage() {
  const { sakId } = useParams<{ sakId: string }>();
  const { data, isLoading, error } = useCaseState(sakId || '');
  const { data: timelineData } = useTimeline(sakId || '');

  // Fetch forsering relations (check if this case is part of any forsering)
  const { data: forseringData } = useQuery<FindForseringerResponse>({
    queryKey: ['forsering', 'by-relatert', sakId],
    queryFn: () => findForseringerForSak(sakId || ''),
    staleTime: 60_000,
    enabled: !!sakId,
  });

  // Fetch endringsordre relations (check if this case is part of any endringsordre)
  const { data: endringsordreData } = useQuery<FindEOerResponse>({
    queryKey: ['endringsordre', 'by-relatert', sakId],
    queryFn: () => findEOerForSak(sakId || ''),
    staleTime: 60_000,
    enabled: !!sakId,
  });

  // Modal state management - Initial submissions
  const [sendGrunnlagOpen, setSendGrunnlagOpen] = useState(false);
  const [sendVederlagOpen, setSendVederlagOpen] = useState(false);
  const [sendFristOpen, setSendFristOpen] = useState(false);
  const [respondGrunnlagOpen, setRespondGrunnlagOpen] = useState(false);
  const [respondVederlagOpen, setRespondVederlagOpen] = useState(false);
  const [respondFristOpen, setRespondFristOpen] = useState(false);

  // Modal state management - Updates (TE)
  const [updateGrunnlagOpen, setUpdateGrunnlagOpen] = useState(false);
  const [reviseVederlagOpen, setReviseVederlagOpen] = useState(false);
  const [reviseFristOpen, setReviseFristOpen] = useState(false);

  // Modal state management - Update responses (BH)
  const [updateGrunnlagResponseOpen, setUpdateGrunnlagResponseOpen] = useState(false);
  const [updateVederlagResponseOpen, setUpdateVederlagResponseOpen] = useState(false);
  const [updateFristResponseOpen, setUpdateFristResponseOpen] = useState(false);

  // Modal state management - Special actions (TE)
  const [sendForseringOpen, setSendForseringOpen] = useState(false);

  // Modal state management - Special actions (BH)
  const [utstEOOpen, setUtstEOOpen] = useState(false);

  // User role management for testing different modes
  const { userRole, setUserRole } = useUserRole();

  // Use state from data or empty state - hooks must be called unconditionally
  const state = data?.state ?? EMPTY_STATE;

  // Compute actions based on state - hooks must be called unconditionally
  const actions = useActionPermissions(state, userRole);

  // Convert API timeline events to TimelineEntry format
  const timelineEvents: TimelineEntry[] = useMemo(
    () => timelineData?.events.map(e => ({
      event_id: e.event_id,
      tidsstempel: e.tidsstempel,
      type: e.type,
      event_type: e.event_type,
      aktor: e.aktor,
      rolle: e.rolle,
      spor: e.spor,
      sammendrag: e.sammendrag,
      event_data: e.event_data,
    })) ?? [],
    [timelineData]
  );

  // Compute grunnlag status for subsidiary logic in response modals
  const grunnlagStatus = useMemo((): 'godkjent' | 'avslatt' | 'delvis_godkjent' | undefined => {
    const result = state.grunnlag.bh_resultat;
    if (result === 'godkjent' || result === 'avslatt' || result === 'delvis_godkjent') {
      return result;
    }
    return undefined;
  }, [state.grunnlag.bh_resultat]);

  // Compute krevd beløp for vederlag (from belop_direkte or kostnads_overslag)
  const krevdBelop = useMemo(() => {
    const v = state.vederlag;
    if (v.metode === 'REGNINGSARBEID' && v.kostnads_overslag !== undefined) {
      return v.kostnads_overslag;
    }
    return v.belop_direkte;
  }, [state.vederlag]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle flex items-center justify-center px-4">
        <div className="text-center">
          <ReloadIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-pkt-grays-gray-400 animate-spin" />
          <p className="text-sm sm:text-base text-pkt-grays-gray-500">Laster sak...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle flex items-center justify-center px-4">
        <div className="max-w-md w-full p-4 sm:p-8 bg-pkt-bg-card rounded-lg border border-pkt-grays-gray-200" role="alert">
          <ExclamationTriangleIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-pkt-brand-red-1000" />
          <h2 className="text-lg sm:text-xl font-semibold text-pkt-brand-red-1000 mb-3 sm:mb-4 text-center">
            Feil ved lasting av sak
          </h2>
          <p className="text-sm sm:text-base text-pkt-text-body-default mb-4 text-center">{error.message}</p>
          <div className="text-center">
            <Button variant="primary" onClick={() => window.location.reload()}>
              Prøv igjen
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No data state (should not happen if no error)
  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      {/* Header */}
      <PageHeader
        title={state.sakstittel}
        subtitle={`Sak #${sakId}`}
        userRole={userRole}
        onToggleRole={setUserRole}
        actions={
          <div className="flex items-center gap-2">
            {/* Utsted EO - only for BH when kan_utstede_eo is true */}
            {userRole === 'BH' && actions.canIssueEO && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setUtstEOOpen(true)}
              >
                <FileTextIcon className="w-4 h-4 mr-2" />
                Utsted EO
              </Button>
            )}
            <button
              onClick={() => downloadContractorClaimPdf(state)}
              className="flex items-center gap-2 p-2 rounded-lg border border-pkt-grays-gray-200 bg-pkt-bg-subtle text-pkt-grays-gray-500 hover:text-pkt-text-body-dark hover:bg-pkt-bg-card transition-colors"
              title="Last ned PDF"
              aria-label="Last ned PDF"
            >
              <DownloadIcon className="w-4 h-4" />
              <span className="text-xs font-medium sm:hidden">PDF</span>
            </button>
          </div>
        }
      />

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:px-8 sm:py-8 bg-pkt-bg-card min-h-[calc(100vh-88px)]">
        {/* Forsering relation banner (if this case is part of a forsering) */}
        {forseringData?.forseringer && forseringData.forseringer.length > 0 && (
          <section className="mb-6">
            <ForseringRelasjonBanner forseringer={forseringData.forseringer} />
          </section>
        )}

        {/* Endringsordre relation banner (if this case is part of an endringsordre) */}
        {endringsordreData?.endringsordrer && endringsordreData.endringsordrer.length > 0 && (
          <section className="mb-6">
            <EndringsordreRelasjonBanner endringsordrer={endringsordreData.endringsordrer} />
          </section>
        )}

        {/* Status Dashboard with Contextual Actions */}
        <section aria-labelledby="krav-respons-heading">
          <h2
            id="krav-respons-heading"
            className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4"
          >
            Krav og respons
          </h2>
          <StatusDashboard
          state={state}
          grunnlagActions={
            <>
              {/* TE Actions: "Send" and "Oppdater" are mutually exclusive */}
              {/* - Send: Only available when status is 'utkast' (not yet sent) */}
              {/* - Oppdater: Only available after sent (sendt/under_behandling/avvist) */}
              {userRole === 'TE' && actions.canSendGrunnlag && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSendGrunnlagOpen(true)}
                >
                  <PaperPlaneIcon className="w-4 h-4 mr-2" />
                  Send grunnlag
                </Button>
              )}
              {userRole === 'TE' && actions.canUpdateGrunnlag && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setUpdateGrunnlagOpen(true)}
                >
                  <Pencil1Icon className="w-4 h-4 mr-2" />
                  Oppdater
                </Button>
              )}
              {/* BH Actions: Respond to TE's submission */}
              {userRole === 'BH' && actions.canRespondToGrunnlag && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setRespondGrunnlagOpen(true)}
                >
                  <ChatBubbleIcon className="w-4 h-4 mr-2" />
                  Svar
                </Button>
              )}
              {/* BH Actions: Update existing response (snuoperasjon) */}
              {userRole === 'BH' && actions.canUpdateGrunnlagResponse && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setUpdateGrunnlagResponseOpen(true)}
                >
                  <Pencil2Icon className="w-4 h-4 mr-2" />
                  Endre svar
                </Button>
              )}
            </>
          }
          vederlagActions={
            <>
              {/* TE Actions: "Send" and "Oppdater" are mutually exclusive */}
              {userRole === 'TE' && actions.canSendVederlag && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSendVederlagOpen(true)}
                >
                  <PaperPlaneIcon className="w-4 h-4 mr-2" />
                  Send krav
                </Button>
              )}
              {userRole === 'TE' && actions.canUpdateVederlag && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setReviseVederlagOpen(true)}
                >
                  <Pencil1Icon className="w-4 h-4 mr-2" />
                  Oppdater
                </Button>
              )}
              {/* BH Actions: Respond to TE's submission */}
              {userRole === 'BH' && actions.canRespondToVederlag && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setRespondVederlagOpen(true)}
                >
                  <ChatBubbleIcon className="w-4 h-4 mr-2" />
                  Svar
                </Button>
              )}
              {/* BH Actions: Update existing response */}
              {userRole === 'BH' && actions.canUpdateVederlagResponse && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setUpdateVederlagResponseOpen(true)}
                >
                  <Pencil2Icon className="w-4 h-4 mr-2" />
                  Endre svar
                </Button>
              )}
            </>
          }
          fristActions={
            <>
              {/* TE Actions: "Send" and "Oppdater" are mutually exclusive */}
              {userRole === 'TE' && actions.canSendFrist && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSendFristOpen(true)}
                >
                  <PaperPlaneIcon className="w-4 h-4 mr-2" />
                  Send krav
                </Button>
              )}
              {userRole === 'TE' && actions.canUpdateFrist && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setReviseFristOpen(true)}
                >
                  <Pencil1Icon className="w-4 h-4 mr-2" />
                  Oppdater
                </Button>
              )}
              {/* TE Actions: Forsering (§33.8) - available when BH has rejected */}
              {userRole === 'TE' && actions.canSendForsering && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSendForseringOpen(true)}
                  className="border-action-danger-border text-action-danger-text hover:bg-action-danger-hover-bg"
                >
                  <RocketIcon className="w-4 h-4 mr-2" />
                  Forsering (§33.8)
                </Button>
              )}
              {/* BH Actions: Respond to TE's submission */}
              {userRole === 'BH' && actions.canRespondToFrist && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setRespondFristOpen(true)}
                >
                  <ChatBubbleIcon className="w-4 h-4 mr-2" />
                  Svar
                </Button>
              )}
              {/* BH Actions: Update existing response */}
              {userRole === 'BH' && actions.canUpdateFristResponse && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setUpdateFristResponseOpen(true)}
                >
                  <Pencil2Icon className="w-4 h-4 mr-2" />
                  Endre svar
                </Button>
              )}
            </>
          }
          />
        </section>

        {/* Timeline Section */}
        <section className="mt-6 sm:mt-8" aria-labelledby="timeline-heading">
          <h2
            id="timeline-heading"
            className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4"
          >
            Hendelser
          </h2>
          <Timeline events={timelineEvents} />
        </section>

        {/* Summary Section - Enhanced with Comprehensive Metadata and Revision History */}
        <section className="mt-6 sm:mt-8" aria-labelledby="summary-heading">
          <h2
            id="summary-heading"
            className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4"
          >
            Sammendrag
          </h2>

          {/* Comprehensive Metadata */}
          <ComprehensiveMetadata state={state} sakId={sakId || ''} />

          {/* Revision History */}
          <div className="mt-4 sm:mt-6">
            <h3 className="text-sm font-semibold text-pkt-text-body-dark mb-2 sm:mb-3">
              Revisjonshistorikk
            </h3>
            <RevisionHistory state={state} />
          </div>
        </section>
      </main>

      {/* Action Modals */}
      {sakId && (
        <>
          <SendGrunnlagModal
            open={sendGrunnlagOpen}
            onOpenChange={setSendGrunnlagOpen}
            sakId={sakId}
          />
          <SendVederlagModal
            open={sendVederlagOpen}
            onOpenChange={setSendVederlagOpen}
            sakId={sakId}
            grunnlagEventId={`grunnlag-${sakId}`}
            grunnlagEvent={{
              tittel: state.sakstittel,
              status: grunnlagStatus,
              dato_oppdaget: state.grunnlag.dato_oppdaget,
            }}
          />
          <SendFristModal
            open={sendFristOpen}
            onOpenChange={setSendFristOpen}
            sakId={sakId}
            grunnlagEventId={`grunnlag-${sakId}`}
            grunnlagEvent={{
              tittel: state.sakstittel,
              hovedkategori: state.grunnlag.hovedkategori,
              dato_varslet: state.grunnlag.grunnlag_varsel?.dato_sendt,
            }}
            harMottattEtterlysning={state.frist.har_bh_etterlyst}
          />
          <RespondGrunnlagModal
            open={respondGrunnlagOpen}
            onOpenChange={setRespondGrunnlagOpen}
            sakId={sakId}
            grunnlagEventId={`grunnlag-${sakId}`}
            grunnlagEvent={{
              hovedkategori: state.grunnlag.hovedkategori,
              underkategori: state.grunnlag.underkategori,
              beskrivelse: state.grunnlag.beskrivelse,
              dato_oppdaget: state.grunnlag.dato_oppdaget,
              dato_varslet: state.grunnlag.grunnlag_varsel?.dato_sendt,
            }}
          />
          <RespondVederlagModal
            open={respondVederlagOpen}
            onOpenChange={setRespondVederlagOpen}
            sakId={sakId}
            vederlagKravId={`vederlag-${sakId}`}
            krevdBelop={krevdBelop}
            grunnlagStatus={grunnlagStatus}
            vederlagEvent={{
              metode: state.vederlag.metode,
              belop_direkte: state.vederlag.belop_direkte,
              kostnads_overslag: state.vederlag.kostnads_overslag,
              begrunnelse: state.vederlag.begrunnelse,
              krever_justert_ep: state.vederlag.krever_justert_ep,
              saerskilt_krav: state.vederlag.saerskilt_krav,
            }}
          />
          <RespondFristModal
            open={respondFristOpen}
            onOpenChange={setRespondFristOpen}
            sakId={sakId}
            fristKravId={`frist-${sakId}`}
            krevdDager={state.frist.krevd_dager}
            grunnlagStatus={grunnlagStatus}
            varselType={state.frist.varsel_type}
            fristEvent={{
              antall_dager: state.frist.krevd_dager,
              begrunnelse: state.frist.begrunnelse,
              dato_krav_mottatt: state.frist.spesifisert_varsel?.dato_sendt,
            }}
          />

          {/* Update Modals (TE) */}
          <SendGrunnlagUpdateModal
            open={updateGrunnlagOpen}
            onOpenChange={setUpdateGrunnlagOpen}
            sakId={sakId}
            originalEvent={{
              event_id: `grunnlag-${sakId}`,
              grunnlag: state.grunnlag,
            }}
          />
          <ReviseVederlagModal
            open={reviseVederlagOpen}
            onOpenChange={setReviseVederlagOpen}
            sakId={sakId}
            lastVederlagEvent={{
              event_id: `vederlag-${sakId}`,
              metode: state.vederlag.metode || 'ENHETSPRISER',
              belop_direkte: state.vederlag.belop_direkte,
              kostnads_overslag: state.vederlag.kostnads_overslag,
              begrunnelse: state.vederlag.begrunnelse,
            }}
            currentVersion={Math.max(0, (state.vederlag.antall_versjoner ?? 1) - 1)}
          />
          <ReviseFristModal
            open={reviseFristOpen}
            onOpenChange={setReviseFristOpen}
            sakId={sakId}
            lastFristEvent={{
              event_id: `frist-${sakId}`,
              antall_dager: state.frist.krevd_dager || 0,
              begrunnelse: state.frist.begrunnelse,
            }}
            lastResponseEvent={state.frist.bh_resultat ? {
              event_id: `frist-response-${sakId}`,
              resultat: state.frist.bh_resultat,
              godkjent_dager: state.frist.godkjent_dager,
            } : undefined}
            fristTilstand={state.frist}
          />

          {/* Update Response Modals (BH) */}
          <RespondGrunnlagUpdateModal
            open={updateGrunnlagResponseOpen}
            onOpenChange={setUpdateGrunnlagResponseOpen}
            sakId={sakId}
            lastResponseEvent={{
              event_id: `grunnlag-response-${sakId}`,
              resultat: state.grunnlag.bh_resultat || 'godkjent',
            }}
            sakState={state}
          />
          <UpdateResponseVederlagModal
            open={updateVederlagResponseOpen}
            onOpenChange={setUpdateVederlagResponseOpen}
            sakId={sakId}
            lastResponseEvent={{
              event_id: `vederlag-response-${sakId}`,
              resultat: state.vederlag.bh_resultat || 'godkjent',
              godkjent_belop: state.vederlag.godkjent_belop,
              respondedToVersion: state.vederlag.bh_respondert_versjon,
            }}
            vederlagTilstand={state.vederlag}
          />
          <UpdateResponseFristModal
            open={updateFristResponseOpen}
            onOpenChange={setUpdateFristResponseOpen}
            sakId={sakId}
            lastResponseEvent={{
              event_id: `frist-response-${sakId}`,
              resultat: state.frist.bh_resultat || 'godkjent',
              godkjent_dager: state.frist.godkjent_dager,
            }}
            fristTilstand={state.frist}
          />

          {/* Special Action Modals (TE) */}
          <SendForseringModal
            open={sendForseringOpen}
            onOpenChange={setSendForseringOpen}
            sakId={sakId}
            fristKravId={`frist-${sakId}`}
            responsFristId={`frist-response-${sakId}`}
            fristData={{
              krevde_dager: state.frist.krevd_dager || 0,
              godkjent_dager: state.grunnlag.bh_resultat === 'avslatt'
                  ? (state.frist.subsidiaer_godkjent_dager ?? 0)  // Use subsidiary days when grunnlag rejected
                  : (state.frist.godkjent_dager ?? 0),
              bh_resultat: state.frist.bh_resultat || 'godkjent',
            }}
            dagmulktsats={50000}  // TODO: Get from contract config
            grunnlagAvslagTrigger={state.grunnlag.bh_resultat === 'avslatt'}
          />

          {/* BH Special Action Modals */}
          <UtstEndringsordreModal
            open={utstEOOpen}
            onOpenChange={setUtstEOOpen}
            sakId={sakId}
            preselectedKoeIds={[sakId]}  // Pre-select current case if it's a valid KOE
          />
        </>
      )}
    </div>
  );
}
