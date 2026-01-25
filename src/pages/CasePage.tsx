/**
 * CasePage Component
 *
 * Main page for viewing a case in the unified timeline architecture.
 * Displays status dashboard with integrated history for each track.
 * Shows a banner if the case is part of a forsering case or an endringsordre.
 */

import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '../constants/queryConfig';
import { useAuth } from '../context/AuthContext';
import { ApprovalProvider } from '../context/ApprovalContext';
import { useCaseState } from '../hooks/useCaseState';
import { useTimeline } from '../hooks/useTimeline';
import { useHistorikk } from '../hooks/useRevisionHistory';
import { useActionPermissions } from '../hooks/useActionPermissions';
import { useUserRole } from '../hooks/useUserRole';
import { useApprovalWorkflow } from '../hooks/useApprovalWorkflow';
import { CaseDashboard } from '../components/views/CaseDashboard';
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
  EyeOpenIcon,
  PaperPlaneIcon,
  Pencil1Icon,
  ChatBubbleIcon,
  Pencil2Icon,
  RocketIcon,
  FileTextIcon,
} from '@radix-ui/react-icons';
import { PdfPreviewModal } from '../components/pdf';
import {
  VerifyingState,
  AuthErrorState,
  LoadingState,
  ErrorState,
} from '../components/PageStateHelpers';
import { downloadRevisionHistoryCsv } from '../utils/csvExport';
import { downloadCaseExcel } from '../utils/excelExport';

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
 * Inner component that uses the approval context
 */
function CasePageContent() {
  const { sakId } = useParams<{ sakId: string }>();
  const { token, isVerifying, error: authError } = useAuth();

  // Wait for auth verification before loading data
  const { data, isLoading, error } = useCaseState(sakId || '', { enabled: !!token && !isVerifying });
  const { data: timelineData } = useTimeline(sakId || '', { enabled: !!token && !isVerifying });
  const { grunnlag: grunnlagHistorikk, vederlag: vederlagHistorikk, frist: fristHistorikk } = useHistorikk(sakId || '');

  // Fetch forsering relations (check if this case is part of any forsering)
  const { data: forseringData } = useQuery<FindForseringerResponse>({
    queryKey: ['forsering', 'by-relatert', sakId],
    queryFn: () => findForseringerForSak(sakId || ''),
    staleTime: STALE_TIME.EXTENDED,
    enabled: !!sakId && !!token && !isVerifying,
  });

  // Fetch endringsordre relations (check if this case is part of any endringsordre)
  const { data: endringsordreData } = useQuery<FindEOerResponse>({
    queryKey: ['endringsordre', 'by-relatert', sakId],
    queryFn: () => findEOerForSak(sakId || ''),
    staleTime: STALE_TIME.EXTENDED,
    enabled: !!sakId && !!token && !isVerifying,
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

  // Catenda sync warning state
  const [showCatendaWarning, setShowCatendaWarning] = useState(false);

  // User role management for testing different modes
  const { userRole, setUserRole, bhApprovalRole, currentMockUser, currentMockManager } = useUserRole();

  // Approval workflow (mock) - must be called unconditionally
  const approvalWorkflow = useApprovalWorkflow(sakId || '');

  // Approval modal states (combined package only)
  const [sendResponsPakkeOpen, setSendResponsPakkeOpen] = useState(false);
  const [approvePakkeOpen, setApprovePakkeOpen] = useState(false);
  const [discardPakkeConfirmOpen, setDiscardPakkeConfirmOpen] = useState(false);

  // PDF preview modal state (for testing - opened from header)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  // Use state from data or empty state - hooks must be called unconditionally
  const state = data?.state ?? EMPTY_STATE;

  // Compute actions based on state - hooks must be called unconditionally
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

  // Compute krevd beløp for vederlag (from belop_direkte or kostnads_overslag)
  const krevdBelop = useMemo(() => {
    const v = state.vederlag;
    if (v.metode === 'REGNINGSARBEID' && v.kostnads_overslag !== undefined) {
      return v.kostnads_overslag;
    }
    return v.belop_direkte;
  }, [state.vederlag]);

  // Auth verification in progress
  if (isVerifying) {
    return <VerifyingState />;
  }

  // Auth error - invalid or expired token
  if (authError || !token) {
    return <AuthErrorState error={authError} />;
  }

  // Loading state
  if (isLoading) {
    return <LoadingState message="Laster sak..." />;
  }

  // Error state
  if (error) {
    return (
      <ErrorState
        title="Feil ved lasting av sak"
        error={error}
        onRetry={() => window.location.reload()}
      />
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
        menuActions={
          <>
            <DropdownMenuItem onClick={() => setPdfPreviewOpen(true)}>
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
        <section aria-label="Saksstatus">
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
                  onClick={() => setSendResponsPakkeOpen(true)}
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
              onOpenDetails={() => setApprovePakkeOpen(true)}
              onDownloadPdf={() => downloadApprovedPdf(state, approvalWorkflow.bhResponsPakke!)}
              onRestoreAndEdit={() => {
                approvalWorkflow.restoreDraftsFromPakke();
              }}
              onDiscard={() => {
                setDiscardPakkeConfirmOpen(true);
              }}
            />
          </section>
        )}

        {/* Status Dashboard with Contextual Actions */}
        <section aria-labelledby="krav-respons-heading">
          <Card variant="outlined" padding="md">
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
                  Varsle endringsforhold
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
              {/* BH Actions: Issue endringsordre when grunnlag is approved */}
              {userRole === 'BH' && actions.canIssueEO && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setUtstEOOpen(true)}
                >
                  <FileTextIcon className="w-4 h-4 mr-2" />
                  Utsted endringsordre
                </Button>
              )}
            </>
          }
          vederlagActions={
            <>
              {/* Force Majeure info - vederlag ikke aktuelt */}
              {state.grunnlag.hovedkategori === 'FORCE_MAJEURE' && (
                <Alert variant="info" size="sm">
                  Force majeure (§33.3) gir kun rett til fristforlengelse, ikke vederlagsjustering.
                </Alert>
              )}
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
          </Card>
        </section>

        {/* Metadata Section */}
        <section aria-labelledby="metadata-heading">
          <Card variant="outlined" padding="md">
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
            open={sendGrunnlagOpen}
            onOpenChange={setSendGrunnlagOpen}
            sakId={sakId}
            onCatendaWarning={() => setShowCatendaWarning(true)}
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
              hovedkategori: state.grunnlag.hovedkategori as 'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE' | undefined,
            }}
            onCatendaWarning={() => setShowCatendaWarning(true)}
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
            harMottattForesporsel={state.frist.har_bh_foresporsel}
            onCatendaWarning={() => setShowCatendaWarning(true)}
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
            onCatendaWarning={() => setShowCatendaWarning(true)}
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
            open={respondVederlagOpen}
            onOpenChange={setRespondVederlagOpen}
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
              dato_krav_mottatt: state.vederlag.dato_krav_sendt,
            }}
            onCatendaWarning={() => setShowCatendaWarning(true)}
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
              dato_oppdaget: state.grunnlag.dato_oppdaget,
              frist_varsel: state.frist.frist_varsel,
              spesifisert_varsel: state.frist.spesifisert_varsel,
            }}
            onCatendaWarning={() => setShowCatendaWarning(true)}
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
            open={updateGrunnlagOpen}
            onOpenChange={setUpdateGrunnlagOpen}
            sakId={sakId}
            originalEvent={{
              event_id: `grunnlag-${sakId}`,
              grunnlag: state.grunnlag,
            }}
            onCatendaWarning={() => setShowCatendaWarning(true)}
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
              krever_justert_ep: state.vederlag.krever_justert_ep,
              varslet_for_oppstart: state.vederlag.regningsarbeid_varsel !== undefined,
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
            onCatendaWarning={() => setShowCatendaWarning(true)}
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
              begrunnelse: state.frist.bh_begrunnelse,
            } : undefined}
            fristTilstand={state.frist}
            originalVarselType={state.frist.varsel_type}
            harMottattForesporsel={state.frist.har_bh_foresporsel}
            fristForSpesifisering={state.frist.frist_for_spesifisering}
            onCatendaWarning={() => setShowCatendaWarning(true)}
            subsidiaerTriggers={state.frist.subsidiaer_triggers}
          />

          {/* Update Response Modals (BH) */}
          <RespondGrunnlagModal
            open={updateGrunnlagResponseOpen}
            onOpenChange={setUpdateGrunnlagResponseOpen}
            sakId={sakId}
            grunnlagEventId={`grunnlag-${sakId}`}
            lastResponseEvent={{
              event_id: `grunnlag-response-${sakId}`,
              resultat: state.grunnlag.bh_resultat || 'godkjent',
            }}
            sakState={state}
            onCatendaWarning={() => setShowCatendaWarning(true)}
          />
          {/* Update mode: RespondVederlagModal with lastResponseEvent */}
          <RespondVederlagModal
            open={updateVederlagResponseOpen}
            onOpenChange={setUpdateVederlagResponseOpen}
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
              dato_krav_mottatt: state.vederlag.dato_krav_sendt,
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
            onCatendaWarning={() => setShowCatendaWarning(true)}
          />
          <RespondFristModal
            open={updateFristResponseOpen}
            onOpenChange={setUpdateFristResponseOpen}
            sakId={sakId}
            lastResponseEvent={{
              event_id: `frist-response-${sakId}`,
              resultat: state.frist.bh_resultat || 'godkjent',
              godkjent_dager: state.frist.godkjent_dager,
            }}
            fristTilstand={state.frist}
            onCatendaWarning={() => setShowCatendaWarning(true)}
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
            subsidiaerTriggers={state.frist.subsidiaer_triggers}
            onCatendaWarning={() => setShowCatendaWarning(true)}
          />

          {/* BH Special Action Modals */}
          <UtstEndringsordreModal
            open={utstEOOpen}
            onOpenChange={setUtstEOOpen}
            sakId={sakId}
            preselectedKoeIds={[sakId]}  // Pre-select current case if it's a valid KOE
          />

          {/* Combined Package Modal */}
          <SendResponsPakkeModal
            open={sendResponsPakkeOpen}
            onOpenChange={setSendResponsPakkeOpen}
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
              open={approvePakkeOpen}
              onOpenChange={setApprovePakkeOpen}
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
            open={discardPakkeConfirmOpen}
            onOpenChange={setDiscardPakkeConfirmOpen}
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
            open={pdfPreviewOpen}
            onOpenChange={setPdfPreviewOpen}
            sakState={state}
          />
        </>
      )}

      {/* Catenda sync warning */}
      {showCatendaWarning && (
        <div className="fixed bottom-4 right-4 max-w-md z-50">
          <Alert variant="info" title="Ikke synkronisert til Catenda">
            Endringen er lagret lokalt, men ble ikke synkronisert til Catenda.
            Saken mangler muligens Catenda-kobling.
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setShowCatendaWarning(false)}
            >
              Lukk
            </Button>
          </Alert>
        </div>
      )}

    </div>
  );
}

export default CasePage;
