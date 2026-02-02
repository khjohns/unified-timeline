/**
 * CasePage Component
 *
 * Main page for viewing a case in the unified timeline architecture.
 * Displays status dashboard with integrated history for each track.
 * Shows a banner if the case is part of a forsering case or an endringsordre.
 */

import { useMemo, Suspense, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { forseringKeys, endringsordreKeys } from '../queries';
import { STALE_TIME } from '../constants/queryConfig';
import { useAuth } from '../context/AuthContext';
import { ApprovalProvider } from '../context/ApprovalContext';
import { useCaseStateSuspense } from '../hooks/useCaseState';
import { useTimelineSuspense } from '../hooks/useTimeline';
import { useHistorikk } from '../hooks/useRevisionHistory';
import { useActionPermissions } from '../hooks/useActionPermissions';
import { useUserRole } from '../hooks/useUserRole';
import { useApprovalWorkflow } from '../hooks/useApprovalWorkflow';
import { useCasePageModals } from '../hooks/useCasePageModals';
import { CaseDashboard } from '../components/views/CaseDashboard';
import {
  GrunnlagActionButtons,
  VederlagActionButtons,
  FristActionButtons,
} from '../components/TrackActionButtons';
import { ComprehensiveMetadata } from '../components/views/ComprehensiveMetadata';
import { Alert, Button, AlertDialog, Card, DropdownMenuItem } from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import { formatCurrency } from '../utils/formatters';
import { downloadApprovedPdf } from '../pdf/generator';
import { ForseringRelasjonBanner } from '../components/forsering';
import { UtstEndringsordreModal, EndringsordreRelasjonBanner } from '../components/endringsordre';
import { StatusAlert } from '../components/StatusAlert';
import { MockToolbar } from '../components/MockToolbar';
import {
  ApprovePakkeModal,
  SendResponsPakkeModal,
  ApprovalDashboardCard,
} from '../components/approval';
import {
  SendGrunnlagModal,
  SendVederlagModal,
  SendFristModal,
  RespondGrunnlagModal,
  RespondVederlagModal,
  RespondFristModal,
  // Update modals (TE)
  // Note: SendGrunnlagUpdateModal is now handled by SendGrunnlagModal with originalEvent prop
  ReviseVederlagModal,
  ReviseFristModal,
  // Update response modals (BH)
  // Note: RespondGrunnlagUpdateModal is now handled by RespondGrunnlagModal with lastResponseEvent prop
  // Note: UpdateResponseVederlagModal is now handled by RespondVederlagModal with lastResponseEvent prop
  // Note: UpdateResponseFristModal is now handled by RespondFristModal with lastResponseEvent prop
  // Special action modals (TE)
  SendForseringModal,
} from '../components/actions';
import { findForseringerForSak, type FindForseringerResponse } from '../api/forsering';
import { findEOerForSak, type FindEOerResponse } from '../api/endringsordre';
import type { SakState, TimelineEvent } from '../types/timeline';
import {
  DownloadIcon,
  PaperPlaneIcon,
  QuestionMarkCircledIcon,
} from '@radix-ui/react-icons';
import { OnboardingGuide, useOnboarding, casePageSteps } from '../components/onboarding';
import { PdfPreviewModal } from '../components/pdf';
import {
  LoadingState,
  VerifyingState,
  AuthErrorState,
} from '../components/PageStateHelpers';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { downloadRevisionHistoryCsv } from '../utils/csvExport';
import { downloadCaseExcel } from '../utils/excelExport';

/**
 * CasePage renders the complete case view with dashboard and timeline
 * Wrapped with ApprovalProvider for approval workflow mock
 */
export function CasePage() {
  return (
    <ApprovalProvider>
      <CasePageContent />
    </ApprovalProvider>
  );
}

/**
 * Inner component that handles auth verification and wraps data loader in Suspense
 */
function CasePageContent() {
  const { sakId } = useParams<{ sakId: string }>();
  const { token, isVerifying, error: authError } = useAuth();

  // Auth verification in progress
  if (isVerifying) {
    return <VerifyingState />;
  }

  // Auth error - invalid or expired token
  if (authError || !token) {
    return <AuthErrorState error={authError} />;
  }

  // Auth OK - render data loader with Suspense
  // Suspense catches both lazy-loading and data fetching
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingState />}>
        <CasePageDataLoader sakId={sakId || ''} />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Data loader component that uses Suspense-enabled hooks
 * This component will suspend until all data is loaded
 */
function CasePageDataLoader({ sakId }: { sakId: string }) {
  // These hooks suspend until data is available - no isLoading needed
  const { data } = useCaseStateSuspense(sakId);
  const { data: timelineData } = useTimelineSuspense(sakId);
  const { grunnlag: grunnlagHistorikk, vederlag: vederlagHistorikk, frist: fristHistorikk } = useHistorikk(sakId);

  // Fetch forsering relations (check if this case is part of any forsering)
  const { data: forseringData } = useQuery<FindForseringerResponse>({
    queryKey: forseringKeys.byRelatert(sakId),
    queryFn: () => findForseringerForSak(sakId),
    staleTime: STALE_TIME.EXTENDED,
  });

  // Fetch endringsordre relations (check if this case is part of any endringsordre)
  const { data: endringsordreData } = useQuery<FindEOerResponse>({
    queryKey: endringsordreKeys.byRelatert(sakId),
    queryFn: () => findEOerForSak(sakId),
    staleTime: STALE_TIME.EXTENDED,
  });

  // All modal states managed by dedicated hook
  const modals = useCasePageModals();

  // User role management for testing different modes
  const { userRole, setUserRole, bhApprovalRole, currentMockUser, currentMockManager } = useUserRole();

  // Approval workflow (mock) - must be called unconditionally
  const approvalWorkflow = useApprovalWorkflow(sakId);


  // Onboarding guide state
  const onboarding = useOnboarding(casePageSteps.length);

  // Auto-start onboarding for first-time users (after a short delay)
  useEffect(() => {
    if (!onboarding.hasCompletedBefore && !onboarding.isActive) {
      const timer = setTimeout(() => {
        onboarding.start();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [onboarding.hasCompletedBefore, onboarding.isActive, onboarding.start]);

  // Data is guaranteed to exist when using Suspense hooks
  const state = data.state;

  // Compute actions based on state
  const actions = useActionPermissions(state, userRole);

  // API now returns CloudEvents format directly
  const timelineEvents: TimelineEvent[] = useMemo(
    () => timelineData?.events ?? [],
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

  // §32.2: Har BH påberopt at grunnlagsvarselet kom for sent? (kun IRREG)
  // Feltet settes kun for irregulære endringer (IRREG underkategori).
  // Brukes for å vise §34.1.2 spørsmål subsidiært i RespondVederlagModal.
  const grunnlagVarsletForSent = useMemo((): boolean => {
    return state.grunnlag.grunnlag_varslet_i_tide === false;
  }, [state.grunnlag.grunnlag_varslet_i_tide]);

  return (
    <div className="min-h-screen bg-pkt-bg-subtle relative">
      {/* Background grid - only visible on xl+ screens outside main content */}
      <div
        className="fixed inset-0 top-[104px] pointer-events-none hidden xl:block"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--color-pkt-brand-dark-blue-1000) 1px, transparent 1px),
            linear-gradient(to bottom, var(--color-pkt-brand-dark-blue-1000) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          opacity: 0.025,
          maskImage: 'linear-gradient(to right, black 0%, black calc(50% - 400px), transparent calc(50% - 384px), transparent calc(50% + 384px), black calc(50% + 400px), black 100%)',
          WebkitMaskImage: 'linear-gradient(to right, black 0%, black calc(50% - 400px), transparent calc(50% - 384px), transparent calc(50% + 384px), black calc(50% + 400px), black 100%)',
        }}
      />
      {/* Header */}
      <div data-onboarding="page-header">
        <PageHeader
          title={state.sakstittel}
          subtitle={`Sak #${sakId}`}
          userRole={userRole}
          onToggleRole={setUserRole}
          menuActions={
          <>
            <DropdownMenuItem onClick={() => onboarding.start()}>
              <QuestionMarkCircledIcon className="w-4 h-4 mr-2" />
              Vis veiviser
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => modals.pdfPreview.setOpen(true)}>
              Forhåndsvis PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                const { downloadContractorClaimPdf } = await import('../pdf/generator');
                downloadContractorClaimPdf(state);
              }}
            >
              Last ned PDF
            </DropdownMenuItem>
          </>
        }
        />
      </div>

      {/* Mock Toolbar - only visible in BH mode */}
      {userRole === 'BH' && (
        <MockToolbar
          approvalEnabled={approvalWorkflow.approvalEnabled}
          onApprovalEnabledChange={approvalWorkflow.setApprovalEnabled}
        />
      )}

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-3 pt-2 pb-4 sm:px-4 sm:pt-3 sm:pb-6 bg-pkt-bg-subtle min-h-[calc(100vh-88px)] space-y-4">
        {/* Forsering relation banner (if this case is part of a forsering) */}
        {forseringData?.forseringer && forseringData.forseringer.length > 0 && (
          <section>
            <ForseringRelasjonBanner forseringer={forseringData.forseringer} />
          </section>
        )}

        {/* Endringsordre relation banner (if this case is part of an endringsordre) */}
        {endringsordreData?.endringsordrer && endringsordreData.endringsordrer.length > 0 && (
          <section>
            <EndringsordreRelasjonBanner endringsordrer={endringsordreData.endringsordrer} />
          </section>
        )}

        {/* Status Alert - kontekstuell veiledning basert på rolle og saksstatus */}
        <section aria-label="Saksstatus" data-onboarding="status-alert">
          <StatusAlert
            state={state}
            userRole={userRole}
            actions={actions}
            harForseringssak={forseringData?.forseringer && forseringData.forseringer.length > 0}
            harEndringsordre={endringsordreData?.endringsordrer && endringsordreData.endringsordrer.length > 0}
          />
        </section>

        {/* Combined Package Banner - show when approval enabled and drafts exist */}
        {approvalWorkflow.approvalEnabled && approvalWorkflow.hasAnyDraft && userRole === 'BH' && (
          <section>
            <Alert
              variant="warning"
              title="Utkast klare for godkjenning"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => modals.sendResponsPakke.setOpen(true)}
                >
                  <PaperPlaneIcon className="w-4 h-4 mr-2" />
                  Send til godkjenning
                </Button>
              }
            >
              <ul className="text-sm space-y-1 mt-1">
                {approvalWorkflow.grunnlagDraft && (
                  <li>• Ansvarsgrunnlag: {approvalWorkflow.grunnlagDraft.resultat === 'godkjent' ? 'Godkjent' : approvalWorkflow.grunnlagDraft.resultat === 'avslatt' ? 'Avslått' : approvalWorkflow.grunnlagDraft.resultat === 'delvis_godkjent' ? 'Delvis godkjent' : approvalWorkflow.grunnlagDraft.resultat}</li>
                )}
                {approvalWorkflow.vederlagDraft && (
                  <li>• Vederlag: {formatCurrency(approvalWorkflow.vederlagDraft.belop)} ({approvalWorkflow.vederlagDraft.resultat === 'godkjent' ? 'godkjent' : approvalWorkflow.vederlagDraft.resultat === 'avslatt' ? 'avslått' : 'delvis godkjent'})</li>
                )}
                {approvalWorkflow.fristDraft && (
                  <li>• Frist: {approvalWorkflow.fristDraft.dager} dager ({approvalWorkflow.fristDraft.resultat === 'godkjent' ? 'godkjent' : approvalWorkflow.fristDraft.resultat === 'avslatt' ? 'avslått' : 'delvis godkjent'})</li>
                )}
              </ul>
            </Alert>
          </section>
        )}

        {/* BH Response Package Dashboard Card */}
        {approvalWorkflow.approvalEnabled && approvalWorkflow.bhResponsPakke && (
          <section>
            <ApprovalDashboardCard
              pakke={approvalWorkflow.bhResponsPakke}
              canApprove={approvalWorkflow.canApprovePakke}
              onOpenDetails={() => modals.approvePakke.setOpen(true)}
              onDownloadPdf={() => downloadApprovedPdf(state, approvalWorkflow.bhResponsPakke!)}
              onRestoreAndEdit={() => {
                approvalWorkflow.restoreDraftsFromPakke();
              }}
              onDiscard={() => {
                modals.discardPakkeConfirm.setOpen(true);
              }}
            />
          </section>
        )}

        {/* Status Dashboard with Contextual Actions */}
        <section aria-labelledby="krav-respons-heading" data-onboarding="case-dashboard">
          <Card variant="outlined" padding="sm">
            <h2
              id="krav-respons-heading"
              className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4"
            >
              Krav om endringsordre
            </h2>
            <CaseDashboard
          state={state}
          events={timelineEvents}
          grunnlagHistorikk={grunnlagHistorikk}
          vederlagHistorikk={vederlagHistorikk}
          fristHistorikk={fristHistorikk}
          grunnlagActions={
            <GrunnlagActionButtons
              userRole={userRole}
              actions={actions}
              grunnlagState={state.grunnlag}
              onSendGrunnlag={() => modals.sendGrunnlag.setOpen(true)}
              onUpdateGrunnlag={() => modals.updateGrunnlag.setOpen(true)}
              onRespondGrunnlag={() => modals.respondGrunnlag.setOpen(true)}
              onUpdateGrunnlagResponse={() => modals.updateGrunnlagResponse.setOpen(true)}
              onUtstEO={() => modals.utstEO.setOpen(true)}
            />
          }
          vederlagActions={
            <VederlagActionButtons
              userRole={userRole}
              actions={actions}
              isForceMajeure={state.grunnlag.hovedkategori === 'FORCE_MAJEURE'}
              onSendVederlag={() => modals.sendVederlag.setOpen(true)}
              onRespondVederlag={() => modals.respondVederlag.setOpen(true)}
              onUpdateVederlagResponse={() => modals.updateVederlagResponse.setOpen(true)}
            />
          }
          inlineVederlagRevision={
            sakId && state.vederlag.metode
              ? {
                  sakId,
                  lastVederlagEvent: {
                    // Use actual CloudEvents ID from state (populated by backend)
                    event_id: state.vederlag.siste_event_id || `vederlag-${sakId}`,
                    metode: state.vederlag.metode,
                    belop_direkte: state.vederlag.belop_direkte,
                    kostnads_overslag: state.vederlag.kostnads_overslag,
                    begrunnelse: state.vederlag.begrunnelse,
                    krever_justert_ep: state.vederlag.krever_justert_ep,
                    varslet_for_oppstart: state.vederlag.regningsarbeid_varsel !== undefined,
                    saerskilt_krav: state.vederlag.saerskilt_krav,
                    // BH's foreslåtte metode - forhåndsvalgt hvis TE reviderer inline
                    bh_metode: state.vederlag.bh_metode,
                  },
                  currentVersion: Math.max(0, (state.vederlag.antall_versjoner ?? 1) - 1),
                  onOpenFullModal: () => modals.reviseVederlag.setOpen(true),
                  canRevise: userRole === 'TE' && actions.canUpdateVederlag,
                  // Primary: BH har avvist/delvis godkjent OG TE har ikke sendt ny versjon etter
                  // bh_respondert_versjon er 0-indeksert, antall_versjoner teller fra 1
                  showPrimaryVariant:
                    !!state.vederlag.bh_resultat &&
                    state.vederlag.bh_resultat !== 'godkjent' &&
                    state.vederlag.antall_versjoner - 1 === state.vederlag.bh_respondert_versjon,
                }
              : undefined
          }
          fristActions={
            <FristActionButtons
              userRole={userRole}
              actions={actions}
              fristState={state.frist}
              onSendFrist={() => modals.sendFrist.setOpen(true)}
              onReviseFrist={() => modals.reviseFrist.setOpen(true)}
              onSendForsering={() => modals.sendForsering.setOpen(true)}
              onRespondFrist={() => modals.respondFrist.setOpen(true)}
              onUpdateFristResponse={() => modals.updateFristResponse.setOpen(true)}
            />
          }
          inlineFristRevision={
            // Only use inline revision when NOT in forespørsel situation
            // Forespørsel requires full modal for critical §33.6.2 warnings
            sakId && state.frist.krevd_dager !== undefined && !state.frist.har_bh_foresporsel
              ? {
                  sakId,
                  lastFristEvent: {
                    event_id: state.frist.siste_event_id || `frist-${sakId}`,
                    antall_dager: state.frist.krevd_dager ?? 0,
                    begrunnelse: state.frist.begrunnelse,
                  },
                  originalVarselType: state.frist.varsel_type,
                  onOpenFullModal: () => modals.reviseFrist.setOpen(true),
                  canRevise: userRole === 'TE' && actions.canUpdateFrist,
                  // Primary: BH har avvist/delvis godkjent OG TE har ikke sendt ny versjon etter
                  // bh_respondert_versjon er 0-indeksert, antall_versjoner teller fra 1
                  showPrimaryVariant:
                    !!state.frist.bh_resultat &&
                    state.frist.bh_resultat !== 'godkjent' &&
                    state.frist.antall_versjoner - 1 === state.frist.bh_respondert_versjon,
                }
              : undefined
          }
        />
          </Card>
        </section>

        {/* Metadata Section */}
        <section aria-labelledby="metadata-heading" data-onboarding="metadata-section">
          <Card variant="outlined" padding="sm">
            <h2
              id="metadata-heading"
              className="text-base font-semibold text-pkt-text-body-dark mb-3 sm:mb-4"
            >
              Metadata
            </h2>
            <ComprehensiveMetadata state={state} sakId={sakId || ''} />

            {/* Export Options */}
            {(grunnlagHistorikk.length > 0 || vederlagHistorikk.length > 0 || fristHistorikk.length > 0) && (
              <div className="mt-4 pt-3 border-t border-pkt-border-subtle">
                <p className="text-xs font-medium text-pkt-text-body-muted mb-2">Eksporter data</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => downloadCaseExcel({
                      sakId: sakId || '',
                      state,
                      grunnlag: grunnlagHistorikk,
                      vederlag: vederlagHistorikk,
                      frist: fristHistorikk,
                    })}
                    className="flex items-center gap-2 text-sm text-pkt-text-action-normal hover:text-pkt-text-action-hover transition-colors"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => downloadRevisionHistoryCsv(sakId || '', vederlagHistorikk, fristHistorikk)}
                    className="flex items-center gap-2 text-sm text-pkt-text-action-normal hover:text-pkt-text-action-hover transition-colors"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    CSV
                  </button>
                </div>
              </div>
            )}
          </Card>
        </section>
      </main>

      {/* Action Modals */}
      {sakId && (
        <>
          <SendGrunnlagModal
            open={modals.sendGrunnlag.open}
            onOpenChange={modals.sendGrunnlag.setOpen}
            sakId={sakId}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
          />
          <SendVederlagModal
            open={modals.sendVederlag.open}
            onOpenChange={modals.sendVederlag.setOpen}
            sakId={sakId}
            grunnlagEventId={`grunnlag-${sakId}`}
            grunnlagEvent={{
              tittel: state.sakstittel,
              status: grunnlagStatus,
              dato_oppdaget: state.grunnlag.dato_oppdaget,
              hovedkategori: state.grunnlag.hovedkategori as 'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE' | undefined,
            }}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
          />
          <SendFristModal
            open={modals.sendFrist.open}
            onOpenChange={modals.sendFrist.setOpen}
            sakId={sakId}
            grunnlagEventId={`grunnlag-${sakId}`}
            grunnlagEvent={{
              tittel: state.sakstittel,
              hovedkategori: state.grunnlag.hovedkategori,
              dato_varslet: state.grunnlag.grunnlag_varsel?.dato_sendt,
            }}
            harMottattForesporsel={state.frist.har_bh_foresporsel}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
          />
          <RespondGrunnlagModal
            open={modals.respondGrunnlag.open}
            onOpenChange={modals.respondGrunnlag.setOpen}
            sakId={sakId}
            grunnlagEventId={`grunnlag-${sakId}`}
            grunnlagEvent={{
              hovedkategori: state.grunnlag.hovedkategori,
              underkategori: state.grunnlag.underkategori,
              beskrivelse: state.grunnlag.beskrivelse,
              dato_oppdaget: state.grunnlag.dato_oppdaget,
              dato_varslet: state.grunnlag.grunnlag_varsel?.dato_sendt,
            }}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
            approvalEnabled={approvalWorkflow.approvalEnabled}
            onSaveDraft={(draftData) => {
              approvalWorkflow.saveDraft({
                sporType: 'grunnlag',
                resultat: draftData.resultat as 'godkjent' | 'avslatt' | 'frafalt',
                begrunnelse: draftData.begrunnelse,
                formData: draftData.formData,
              });
            }}
          />
          <RespondVederlagModal
            open={modals.respondVederlag.open}
            onOpenChange={modals.respondVederlag.setOpen}
            sakId={sakId}
            vederlagKravId={`vederlag-${sakId}`}
            grunnlagStatus={grunnlagStatus}
            hovedkategori={state.grunnlag.hovedkategori as 'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE' | undefined}
            grunnlagVarsletForSent={grunnlagVarsletForSent}
            vederlagEvent={{
              metode: state.vederlag.metode,
              belop_direkte: state.vederlag.belop_direkte,
              kostnads_overslag: state.vederlag.kostnads_overslag,
              begrunnelse: state.vederlag.begrunnelse,
              krever_justert_ep: state.vederlag.krever_justert_ep,
              saerskilt_krav: state.vederlag.saerskilt_krav,
              dato_oppdaget: state.grunnlag.dato_oppdaget,
              dato_krav_mottatt: state.vederlag.krav_fremmet_dato,
            }}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
            approvalEnabled={approvalWorkflow.approvalEnabled}
            onSaveDraft={(draftData) => {
              approvalWorkflow.saveDraft({
                sporType: 'vederlag',
                belop: draftData.belop,
                resultat: draftData.resultat,
                begrunnelse: draftData.begrunnelse,
                formData: draftData.formData,
              });
            }}
          />
          <RespondFristModal
            open={modals.respondFrist.open}
            onOpenChange={modals.respondFrist.setOpen}
            sakId={sakId}
            fristKravId={`frist-${sakId}`}
            krevdDager={state.frist.krevd_dager}
            grunnlagStatus={grunnlagStatus}
            grunnlagVarsletForSent={grunnlagVarsletForSent}
            varselType={state.frist.varsel_type}
            fristEvent={{
              antall_dager: state.frist.krevd_dager,
              begrunnelse: state.frist.begrunnelse,
              dato_krav_mottatt: state.frist.spesifisert_varsel?.dato_sendt,
              dato_oppdaget: state.grunnlag.dato_oppdaget,
              frist_varsel: state.frist.frist_varsel,
              spesifisert_varsel: state.frist.spesifisert_varsel,
            }}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
            approvalEnabled={approvalWorkflow.approvalEnabled}
            onSaveDraft={(draftData) => {
              approvalWorkflow.saveDraft({
                sporType: 'frist',
                dager: draftData.dager,
                resultat: draftData.resultat,
                begrunnelse: draftData.begrunnelse,
                formData: draftData.formData,
              });
            }}
          />

          {/* Update Modals (TE) */}
          <SendGrunnlagModal
            open={modals.updateGrunnlag.open}
            onOpenChange={modals.updateGrunnlag.setOpen}
            sakId={sakId}
            originalEvent={{
              // Use actual CloudEvents ID from state (populated by backend)
              event_id: state.grunnlag.siste_event_id || `grunnlag-${sakId}`,
              grunnlag: state.grunnlag,
            }}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
          />
          <ReviseVederlagModal
            open={modals.reviseVederlag.open}
            onOpenChange={modals.reviseVederlag.setOpen}
            sakId={sakId}
            lastVederlagEvent={{
              // Use actual CloudEvents ID from state (populated by backend)
              event_id: state.vederlag.siste_event_id || `vederlag-${sakId}`,
              metode: state.vederlag.metode || 'ENHETSPRISER',
              belop_direkte: state.vederlag.belop_direkte,
              kostnads_overslag: state.vederlag.kostnads_overslag,
              begrunnelse: state.vederlag.begrunnelse,
              krever_justert_ep: state.vederlag.krever_justert_ep,
              varslet_for_oppstart: state.vederlag.regningsarbeid_varsel !== undefined,
              saerskilt_krav: state.vederlag.saerskilt_krav,
            }}
            currentVersion={Math.max(0, (state.vederlag.antall_versjoner ?? 1) - 1)}
            bhResponse={
              state.vederlag.bh_resultat
                ? {
                    resultat: state.vederlag.bh_resultat,
                    godkjent_belop: state.vederlag.godkjent_belop,
                    aksepterer_metode: state.vederlag.bh_metode === state.vederlag.metode || state.vederlag.bh_metode === undefined,
                    oensket_metode: state.vederlag.bh_metode !== state.vederlag.metode ? state.vederlag.bh_metode : undefined,
                    ep_justering_akseptert: state.vederlag.varsel_justert_ep_ok,
                    begrunnelse: state.vederlag.bh_begrunnelse,
                  }
                : undefined
            }
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
          />
          <ReviseFristModal
            open={modals.reviseFrist.open}
            onOpenChange={modals.reviseFrist.setOpen}
            sakId={sakId}
            lastFristEvent={{
              // Use actual CloudEvents ID from state (populated by backend)
              event_id: state.frist.siste_event_id || `frist-${sakId}`,
              antall_dager: state.frist.krevd_dager || 0,
              begrunnelse: state.frist.begrunnelse,
            }}
            lastResponseEvent={state.frist.bh_resultat ? {
              event_id: `frist-response-${sakId}`,
              resultat: state.frist.bh_resultat,
              godkjent_dager: state.frist.godkjent_dager,
              begrunnelse: state.frist.bh_begrunnelse,
            } : undefined}
            fristTilstand={state.frist}
            currentVersion={Math.max(0, (state.frist.antall_versjoner ?? 1) - 1)}
            originalVarselType={state.frist.varsel_type}
            harMottattForesporsel={state.frist.har_bh_foresporsel}
            fristForSpesifisering={state.frist.frist_for_spesifisering}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
            subsidiaerTriggers={state.frist.subsidiaer_triggers}
          />

          {/* Update Response Modals (BH) */}
          <RespondGrunnlagModal
            open={modals.updateGrunnlagResponse.open}
            onOpenChange={modals.updateGrunnlagResponse.setOpen}
            sakId={sakId}
            grunnlagEventId={`grunnlag-${sakId}`}
            lastResponseEvent={{
              event_id: `grunnlag-response-${sakId}`,
              resultat: state.grunnlag.bh_resultat || 'godkjent',
            }}
            sakState={state}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
            approvalEnabled={approvalWorkflow.approvalEnabled}
            onSaveDraft={(draftData) => {
              approvalWorkflow.saveDraft({
                sporType: 'grunnlag',
                resultat: draftData.resultat as 'godkjent' | 'avslatt' | 'frafalt',
                begrunnelse: draftData.begrunnelse,
                formData: draftData.formData,
              });
            }}
          />
          {/* Update mode: RespondVederlagModal with lastResponseEvent */}
          <RespondVederlagModal
            open={modals.updateVederlagResponse.open}
            onOpenChange={modals.updateVederlagResponse.setOpen}
            sakId={sakId}
            vederlagKravId={`vederlag-${sakId}`}
            grunnlagStatus={grunnlagStatus}
            hovedkategori={state.grunnlag.hovedkategori as 'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE' | undefined}
            grunnlagVarsletForSent={grunnlagVarsletForSent}
            vederlagEvent={{
              metode: state.vederlag.metode,
              belop_direkte: state.vederlag.belop_direkte,
              kostnads_overslag: state.vederlag.kostnads_overslag,
              begrunnelse: state.vederlag.begrunnelse,
              krever_justert_ep: state.vederlag.krever_justert_ep,
              saerskilt_krav: state.vederlag.saerskilt_krav,
              dato_oppdaget: state.grunnlag.dato_oppdaget,
              dato_krav_mottatt: state.vederlag.krav_fremmet_dato,
            }}
            lastResponseEvent={{
              event_id: `vederlag-response-${sakId}`,
              resultat: state.vederlag.bh_resultat || 'godkjent',
              godkjent_belop: state.vederlag.godkjent_belop,
              respondedToVersion: state.vederlag.bh_respondert_versjon,
              // Note: Detailed evaluation fields (hovedkrav_vurdering, rigg_varslet_i_tide, etc.)
              // are not stored in VederlagTilstand - would need to come from event data.
              // Modal will use default values for missing fields.
              aksepterer_metode: state.vederlag.bh_metode === state.vederlag.metode,
            }}
            vederlagTilstand={state.vederlag}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
            approvalEnabled={approvalWorkflow.approvalEnabled}
            onSaveDraft={(draftData) => {
              approvalWorkflow.saveDraft({
                sporType: 'vederlag',
                belop: draftData.belop,
                resultat: draftData.resultat,
                begrunnelse: draftData.begrunnelse,
                formData: draftData.formData,
              });
            }}
          />
          <RespondFristModal
            open={modals.updateFristResponse.open}
            onOpenChange={modals.updateFristResponse.setOpen}
            sakId={sakId}
            grunnlagStatus={grunnlagStatus}
            grunnlagVarsletForSent={grunnlagVarsletForSent}
            lastResponseEvent={{
              event_id: `frist-response-${sakId}`,
              resultat: state.frist.bh_resultat || 'godkjent',
              godkjent_dager: state.frist.godkjent_dager,
            }}
            fristTilstand={state.frist}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
            approvalEnabled={approvalWorkflow.approvalEnabled}
            onSaveDraft={(draftData) => {
              approvalWorkflow.saveDraft({
                sporType: 'frist',
                dager: draftData.dager,
                resultat: draftData.resultat,
                begrunnelse: draftData.begrunnelse,
                formData: draftData.formData,
              });
            }}
          />

          {/* Special Action Modals (TE) */}
          <SendForseringModal
            open={modals.sendForsering.open}
            onOpenChange={modals.sendForsering.setOpen}
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
            subsidiaerTriggers={state.frist.subsidiaer_triggers}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
          />

          {/* BH Special Action Modals */}
          <UtstEndringsordreModal
            open={modals.utstEO.open}
            onOpenChange={modals.utstEO.setOpen}
            sakId={sakId}
            preselectedKoeIds={[sakId]}  // Pre-select current case if it's a valid KOE
          />

          {/* Combined Package Modal */}
          <SendResponsPakkeModal
            open={modals.sendResponsPakke.open}
            onOpenChange={modals.sendResponsPakke.setOpen}
            grunnlagDraft={approvalWorkflow.grunnlagDraft}
            vederlagDraft={approvalWorkflow.vederlagDraft}
            fristDraft={approvalWorkflow.fristDraft}
            onSubmit={(dagmulktsats, comment) => {
              approvalWorkflow.submitPakkeForApproval(dagmulktsats, comment);
            }}
            currentMockUser={currentMockUser}
            currentMockManager={currentMockManager}
            sakState={state}
          />

          {/* Approve Package Modal */}
          {approvalWorkflow.bhResponsPakke && (
            <ApprovePakkeModal
              open={modals.approvePakke.open}
              onOpenChange={modals.approvePakke.setOpen}
              pakke={approvalWorkflow.bhResponsPakke}
              currentMockUser={currentMockUser}
              onApprove={(comment) => approvalWorkflow.approvePakkeStep(comment)}
              onReject={(reason) => approvalWorkflow.rejectPakkeStep(reason)}
              onCancel={approvalWorkflow.cancelPakke}
              sakState={state}
            />
          )}

          {/* Discard Package Confirmation Dialog */}
          <AlertDialog
            open={modals.discardPakkeConfirm.open}
            onOpenChange={modals.discardPakkeConfirm.setOpen}
            title="Forkast avvist svar?"
            description="Dette vil slette det avviste svaret permanent. Du må starte på nytt hvis du vil sende et nytt svar."
            confirmLabel="Forkast svar"
            cancelLabel="Avbryt"
            variant="danger"
            onConfirm={() => {
              approvalWorkflow.cancelPakke();
            }}
          />

          {/* PDF Preview Modal (standalone - for testing outside modal-in-modal) */}
          <PdfPreviewModal
            open={modals.pdfPreview.open}
            onOpenChange={modals.pdfPreview.setOpen}
            sakState={state}
          />
        </>
      )}

      {/* Catenda sync warning */}
      {modals.catendaWarning.open && (
        <div className="fixed bottom-4 right-4 max-w-md z-50">
          <Alert variant="info" title="Ikke synkronisert til Catenda">
            Endringen er lagret lokalt, men ble ikke synkronisert til Catenda.
            Saken mangler muligens Catenda-kobling.
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => modals.catendaWarning.setOpen(false)}
            >
              Lukk
            </Button>
          </Alert>
        </div>
      )}

      {/* Onboarding Guide */}
      <OnboardingGuide
        steps={casePageSteps}
        isActive={onboarding.isActive}
        currentStep={onboarding.currentStep}
        onNext={onboarding.next}
        onPrevious={onboarding.previous}
        onSkip={onboarding.skip}
        onComplete={onboarding.complete}
      />
    </div>
  );
}

export default CasePage;
