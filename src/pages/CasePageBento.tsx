/**
 * CasePageBento - Hierarchical bento layout for case pages.
 *
 * Bento grid layout variant of CasePage for A/B comparison.
 * Route: /saker/:sakId/bento
 *
 * V4 hierarchical layout:
 * - Row 1 (Context): CaseIdentityTile (col-5) + Grunnlag card (col-4) + Activity card (col-3)
 * - Row 2 (Claims): Vederlag card (col-6) + Frist card (col-6)
 * - TrackFormView: Inline expand/collapse forms instead of modals
 * - All track cards rendered directly in page grid (no CaseDashboardBentoV2 wrapper)
 */

import { ReactNode, useMemo, useCallback, useRef, useState, Suspense, useEffect } from 'react';
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
import { useSubmitEvent } from '../hooks/useSubmitEvent';
import { useCasePageModals } from '../hooks/useCasePageModals';
import {
  BentoGrunnlagActionButtons,
  BentoVederlagActionButtons,
  BentoFristActionButtons,
} from '../components/BentoTrackActionButtons';
import { Alert, Button, BentoDashboardCard, InlineDataList, InlineDataListItem, Badge, AlertDialog, DropdownMenuItem, useToast } from '../components/primitives';
import { CategoryLabel } from '../components/shared';
import { PageHeader } from '../components/PageHeader';
import { formatCurrency, formatDays, formatDateMedium } from '../utils/formatters';
import { getVederlagsmetodeLabel } from '../constants/paymentMethods';
import { getSporStatusStyle } from '../constants/statusStyles';
import { downloadApprovedPdf } from '../pdf/generator';
import { ForseringRelasjonBanner } from '../components/forsering';
import { UtstEndringsordreModal, EndringsordreRelasjonBanner } from '../components/endringsordre';
import { MockToolbar } from '../components/MockToolbar';
import { BentoBreadcrumb, CaseIdentityTile, CaseActivityCard, TrackFormView, TrackStepper, TrackNextStep, CrossTrackActivity } from '../components/bento';
import {
  ApprovePakkeModal,
  SendResponsPakkeModal,
  ApprovalDashboardCard,
} from '../components/approval';
import {
  RespondVederlagModal,
  RespondFristModal,
  ReviseVederlagModal,
  ReviseFristModal,
  SendForseringModal,
} from '../components/actions';
import { InlineReviseVederlag } from '../components/actions/InlineReviseVederlag';
import { InlineReviseFrist } from '../components/actions/InlineReviseFrist';
import {
  SendGrunnlagForm,
  SendVederlagForm,
  SendFristForm,
  RespondGrunnlagForm,
  WithdrawForm,
  AcceptResponseForm,
} from '../components/actions/forms';
import {
  SporHistory,
  transformGrunnlagHistorikk,
  transformVederlagHistorikk,
  transformFristHistorikk,
} from '../components/views/SporHistory';
import { findForseringerForSak, type FindForseringerResponse } from '../api/forsering';
import { findEOerForSak, type FindEOerResponse } from '../api/endringsordre';
import type { TimelineEvent, EventType, SporStatus } from '../types/timeline';
import type { DraftResponseData } from '../types/approval';
import {
  PaperPlaneIcon,
  Pencil1Icon,
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

// ========== Helpers (extracted from CaseDashboardBentoV2) ==========

function getStatusBadge(status: SporStatus): ReactNode {
  const { variant, label } = getSporStatusStyle(status);
  return <Badge variant={variant}>{label}</Badge>;
}

function getKrevdBelop(state: { vederlag: { metode?: string; kostnads_overslag?: number; belop_direkte?: number; saerskilt_krav?: { rigg_drift?: { belop?: number }; produktivitet?: { belop?: number } } | null } }): number | undefined {
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

/**
 * CasePageBento - Bento layout test wrapper
 */
export function CasePageBento() {
  return (
    <ApprovalProvider>
      <CasePageBentoContent />
    </ApprovalProvider>
  );
}

function CasePageBentoContent() {
  const { sakId } = useParams<{ sakId: string }>();
  const { token, isVerifying, error: authError } = useAuth();

  if (isVerifying) return <VerifyingState />;
  if (authError || !token) return <AuthErrorState error={authError} />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingState />}>
        <CasePageBentoDataLoader sakId={sakId || ''} />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Data loader - same hooks as CasePage, different layout
 */
function CasePageBentoDataLoader({ sakId }: { sakId: string }) {
  // ===== All hooks identical to CasePage =====
  const { data } = useCaseStateSuspense(sakId);
  const { data: timelineData } = useTimelineSuspense(sakId);
  const { grunnlag: grunnlagHistorikk, vederlag: vederlagHistorikk, frist: fristHistorikk } = useHistorikk(sakId);

  const { data: forseringData } = useQuery<FindForseringerResponse>({
    queryKey: forseringKeys.byRelatert(sakId),
    queryFn: () => findForseringerForSak(sakId),
    staleTime: STALE_TIME.EXTENDED,
  });

  const { data: endringsordreData } = useQuery<FindEOerResponse>({
    queryKey: endringsordreKeys.byRelatert(sakId),
    queryFn: () => findEOerForSak(sakId),
    staleTime: STALE_TIME.EXTENDED,
  });

  const modals = useCasePageModals();
  const { userRole, setUserRole, bhApprovalRole, currentMockUser, currentMockManager } = useUserRole();
  const approvalWorkflow = useApprovalWorkflow(sakId);
  const toast = useToast();

  const prevVersionRef = useRef(data.version);
  useEffect(() => {
    if (data.version > prevVersionRef.current) {
      toast.info('Oppdatert', 'Nye hendelser er registrert.');
      prevVersionRef.current = data.version;
    }
  }, [data.version, toast]);

  const directSendMutation = useSubmitEvent(sakId, {
    onSuccess: () => {},
    onError: (error) => {
      toast.error('Feil ved sending', error.message);
    },
  });

  const onboarding = useOnboarding(casePageSteps.length);
  useEffect(() => {
    if (!onboarding.hasCompletedBefore && !onboarding.isActive) {
      const timer = setTimeout(() => onboarding.start(), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [onboarding.hasCompletedBefore, onboarding.isActive, onboarding.start]);

  const state = data.state;
  const actions = useActionPermissions(state, userRole);

  const timelineEvents: TimelineEvent[] = useMemo(
    () => timelineData?.events ?? [],
    [timelineData]
  );

  const grunnlagStatus = useMemo((): 'godkjent' | 'avslatt' | 'frafalt' | undefined => {
    const result = state.grunnlag.bh_resultat;
    if (result === 'godkjent' || result === 'avslatt' || result === 'frafalt') return result;
    return undefined;
  }, [state.grunnlag.bh_resultat]);

  const grunnlagVarsletForSent = useMemo((): boolean => {
    return state.grunnlag.grunnlag_varslet_i_tide === false;
  }, [state.grunnlag.grunnlag_varslet_i_tide]);

  const handleDirectSend = useCallback(
    async (drafts: {
      grunnlagDraft?: DraftResponseData;
      vederlagDraft?: DraftResponseData;
      fristDraft?: DraftResponseData;
    }) => {
      const events: { eventType: EventType; data: Record<string, unknown> }[] = [];

      if (drafts.grunnlagDraft) {
        const fd = (drafts.grunnlagDraft.formData ?? {}) as Record<string, unknown>;
        events.push({
          eventType: 'respons_grunnlag',
          data: {
            grunnlag_event_id: `grunnlag-${sakId}`,
            resultat: fd.resultat ?? drafts.grunnlagDraft.resultat,
            begrunnelse: fd.begrunnelse ?? drafts.grunnlagDraft.begrunnelse,
            grunnlag_varslet_i_tide: fd.grunnlag_varslet_i_tide,
          },
        });
      }

      if (drafts.vederlagDraft) {
        const fd = (drafts.vederlagDraft.formData ?? {}) as Record<string, unknown>;
        events.push({
          eventType: 'respons_vederlag',
          data: {
            vederlag_krav_id: `vederlag-${sakId}`,
            hovedkrav_varslet_i_tide: fd.hovedkrav_varslet_i_tide,
            rigg_varslet_i_tide: fd.rigg_varslet_i_tide,
            produktivitet_varslet_i_tide: fd.produktivitet_varslet_i_tide,
            aksepterer_metode: fd.aksepterer_metode,
            oensket_metode: fd.oensket_metode,
            ep_justering_varslet_i_tide: fd.ep_justering_varslet_i_tide,
            ep_justering_akseptert: fd.ep_justering_akseptert,
            hold_tilbake: fd.hold_tilbake,
            hovedkrav_vurdering: fd.hovedkrav_vurdering,
            hovedkrav_godkjent_belop: fd.hovedkrav_godkjent_belop,
            rigg_vurdering: fd.rigg_vurdering,
            rigg_godkjent_belop: fd.rigg_godkjent_belop,
            produktivitet_vurdering: fd.produktivitet_vurdering,
            produktivitet_godkjent_belop: fd.produktivitet_godkjent_belop,
            begrunnelse: drafts.vederlagDraft.begrunnelse ?? fd.begrunnelse,
            beregnings_resultat: drafts.vederlagDraft.resultat,
            total_godkjent_belop: drafts.vederlagDraft.belop,
          },
        });
      }

      if (drafts.fristDraft) {
        const fd = (drafts.fristDraft.formData ?? {}) as Record<string, unknown>;
        events.push({
          eventType: 'respons_frist',
          data: {
            frist_krav_id: `frist-${sakId}`,
            frist_varsel_ok: fd.frist_varsel_ok,
            spesifisert_krav_ok: fd.spesifisert_krav_ok,
            foresporsel_svar_ok: fd.foresporsel_svar_ok,
            send_foresporsel: fd.send_foresporsel,
            frist_for_spesifisering: fd.frist_for_spesifisering,
            vilkar_oppfylt: fd.vilkar_oppfylt,
            godkjent_dager: drafts.fristDraft.dager,
            ny_sluttdato: fd.ny_sluttdato,
            begrunnelse: drafts.fristDraft.begrunnelse ?? fd.begrunnelse,
            beregnings_resultat: drafts.fristDraft.resultat,
            krevd_dager: state.frist.krevd_dager,
          },
        });
      }

      try {
        for (const event of events) {
          await directSendMutation.mutateAsync(event);
        }
        approvalWorkflow.clearAllDrafts();
        toast.success('Svar sendt', 'Alle responser er sendt direkte til entreprenør.');
      } catch {
        // Error handled by useSubmitEvent onError
      }
    },
    [sakId, state.frist.krevd_dager, directSendMutation, approvalWorkflow, toast]
  );

  // ===== EXPAND/COLLAPSE STATE =====
  const [expandedTrack, setExpandedTrack] = useState<{
    track: 'grunnlag' | 'vederlag' | 'frist';
    action: string;
  } | null>(null);

  const handleExpandTrack = useCallback((track: 'grunnlag' | 'vederlag' | 'frist', action: string) => {
    setExpandedTrack({ track, action });
  }, []);

  const handleCollapseTrack = useCallback(() => {
    setExpandedTrack(null);
  }, []);

  // ===== EXPANDED FORM RENDERER =====
  const renderExpandedForm = useCallback(() => {
    if (!expandedTrack || !sakId) return null;
    const { track, action } = expandedTrack;
    const onSuccess = handleCollapseTrack;
    const onCancel = handleCollapseTrack;
    const onCatendaWarning = () => modals.catendaWarning.setOpen(true);

    switch (`${track}:${action}`) {
      case 'grunnlag:send':
        return (
          <SendGrunnlagForm
            sakId={sakId}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onCatendaWarning={onCatendaWarning}
          />
        );
      case 'grunnlag:update':
        return (
          <SendGrunnlagForm
            sakId={sakId}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onCatendaWarning={onCatendaWarning}
            originalEvent={{
              event_id: state.grunnlag.siste_event_id || `grunnlag-${sakId}`,
              grunnlag: state.grunnlag,
            }}
          />
        );
      case 'grunnlag:respond':
        return (
          <RespondGrunnlagForm
            sakId={sakId}
            grunnlagEventId={`grunnlag-${sakId}`}
            grunnlagEvent={{
              hovedkategori: state.grunnlag.hovedkategori,
              underkategori: Array.isArray(state.grunnlag.underkategori) ? state.grunnlag.underkategori[0] : state.grunnlag.underkategori,
              beskrivelse: state.grunnlag.beskrivelse,
              dato_oppdaget: state.grunnlag.dato_oppdaget,
              dato_varslet: state.grunnlag.grunnlag_varsel?.dato_sendt,
            }}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onCatendaWarning={onCatendaWarning}
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
        );
      case 'grunnlag:updateResponse':
        return (
          <RespondGrunnlagForm
            sakId={sakId}
            grunnlagEventId={`grunnlag-${sakId}`}
            lastResponseEvent={{
              event_id: `grunnlag-response-${sakId}`,
              resultat: state.grunnlag.bh_resultat || 'godkjent',
            }}
            sakState={state}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onCatendaWarning={onCatendaWarning}
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
        );
      case 'grunnlag:withdraw':
        return (
          <WithdrawForm
            sakId={sakId}
            track="grunnlag"
            sakState={state}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onCatendaWarning={onCatendaWarning}
          />
        );
      case 'grunnlag:accept':
        return (
          <AcceptResponseForm
            sakId={sakId}
            track="grunnlag"
            sakState={state}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onCatendaWarning={onCatendaWarning}
          />
        );
      case 'vederlag:send':
        return (
          <SendVederlagForm
            sakId={sakId}
            grunnlagEventId={`grunnlag-${sakId}`}
            grunnlagEvent={{
              tittel: state.sakstittel,
              status: grunnlagStatus,
              dato_oppdaget: state.grunnlag.dato_oppdaget,
              hovedkategori: state.grunnlag.hovedkategori as 'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE' | undefined,
            }}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onCatendaWarning={onCatendaWarning}
          />
        );
      case 'vederlag:withdraw':
        return (
          <WithdrawForm
            sakId={sakId}
            track="vederlag"
            sakState={state}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onCatendaWarning={onCatendaWarning}
          />
        );
      case 'vederlag:accept':
        return (
          <AcceptResponseForm
            sakId={sakId}
            track="vederlag"
            sakState={state}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onCatendaWarning={onCatendaWarning}
          />
        );
      case 'frist:send':
        return (
          <SendFristForm
            sakId={sakId}
            grunnlagEventId={`grunnlag-${sakId}`}
            grunnlagEvent={{
              tittel: state.sakstittel,
              hovedkategori: state.grunnlag.hovedkategori,
              dato_varslet: state.grunnlag.grunnlag_varsel?.dato_sendt,
            }}
            harMottattForesporsel={state.frist.har_bh_foresporsel}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onCatendaWarning={onCatendaWarning}
          />
        );
      case 'frist:withdraw':
        return (
          <WithdrawForm
            sakId={sakId}
            track="frist"
            sakState={state}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onCatendaWarning={onCatendaWarning}
          />
        );
      case 'frist:accept':
        return (
          <AcceptResponseForm
            sakId={sakId}
            track="frist"
            sakState={state}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onCatendaWarning={onCatendaWarning}
          />
        );
      default:
        return null;
    }
  }, [expandedTrack, sakId, state, grunnlagStatus, approvalWorkflow, modals.catendaWarning, handleCollapseTrack]);

  // ===== TRACK FORM VIEW METADATA =====
  const getTrackFormMeta = useCallback((expanded: { track: string; action: string }) => {
    const trackNames: Record<string, { name: string; hjemmel: string }> = {
      grunnlag: { name: 'Ansvarsgrunnlag', hjemmel: '§25.2' },
      vederlag: { name: 'Vederlag', hjemmel: '§34' },
      frist: { name: 'Fristforlengelse', hjemmel: '§33' },
    };
    const actionTitles: Record<string, string> = {
      send: 'Send krav',
      update: 'Oppdater krav',
      respond: 'Svar på krav',
      updateResponse: 'Oppdater svar',
      withdraw: 'Trekk krav',
      accept: 'Godta svar',
    };
    const meta = trackNames[expanded.track] || { name: expanded.track, hjemmel: '' };
    return {
      trackName: meta.name,
      hjemmel: meta.hjemmel,
      actionTitle: actionTitles[expanded.action] || expanded.action,
    };
  }, []);

  // ===== TRACK CARD STATE (extracted from CaseDashboardBentoV2) =====
  const krevdBelop = useMemo(() => getKrevdBelop(state), [state]);
  const vederlagErSubsidiaer = state.vederlag.subsidiaer_godkjent_belop != null;
  const fristErSubsidiaer = state.frist.subsidiaer_godkjent_dager != null;
  const grunnlagIkkeSendt = state.grunnlag.status === 'ikke_relevant' || state.grunnlag.status === 'utkast';

  const grunnlagEntries = useMemo(() => transformGrunnlagHistorikk(grunnlagHistorikk), [grunnlagHistorikk]);
  const vederlagEntries = useMemo(() => transformVederlagHistorikk(vederlagHistorikk), [vederlagHistorikk]);
  const fristEntries = useMemo(() => transformFristHistorikk(fristHistorikk), [fristHistorikk]);

  const [grunnlagExpanded, setGrunnlagExpanded] = useState(false);
  const [vederlagExpanded, setVederlagExpanded] = useState(false);
  const [fristExpanded, setFristExpanded] = useState(false);
  const [inlineReviseOpen, setInlineReviseOpen] = useState(false);
  const [inlineFristReviseOpen, setInlineFristReviseOpen] = useState(false);

  // Inline vederlag revision props
  const inlineVederlagRevision = useMemo(() => {
    if (!sakId || !state.vederlag.metode) return undefined;
    return {
      sakId,
      lastVederlagEvent: {
        event_id: state.vederlag.siste_event_id || `vederlag-${sakId}`,
        metode: state.vederlag.metode,
        belop_direkte: state.vederlag.belop_direkte,
        kostnads_overslag: state.vederlag.kostnads_overslag,
        begrunnelse: state.vederlag.begrunnelse,
        krever_justert_ep: state.vederlag.krever_justert_ep,
        varslet_for_oppstart: state.vederlag.varslet_for_oppstart,
        saerskilt_krav: state.vederlag.saerskilt_krav,
        bh_metode: state.vederlag.bh_metode,
      },
      currentVersion: Math.max(0, (state.vederlag.antall_versjoner ?? 1) - 1),
      onOpenFullModal: () => modals.reviseVederlag.setOpen(true),
      canRevise: userRole === 'TE' && actions.canUpdateVederlag,
      showPrimaryVariant:
        !!state.vederlag.bh_resultat &&
        state.vederlag.bh_resultat !== 'godkjent' &&
        state.vederlag.antall_versjoner - 1 === state.vederlag.bh_respondert_versjon,
    };
  }, [sakId, state.vederlag, userRole, actions.canUpdateVederlag, modals.reviseVederlag]);

  // Inline frist revision props
  const inlineFristRevision = useMemo(() => {
    if (!sakId || state.frist.krevd_dager === undefined || state.frist.har_bh_foresporsel) return undefined;
    return {
      sakId,
      lastFristEvent: {
        event_id: state.frist.siste_event_id || `frist-${sakId}`,
        antall_dager: state.frist.krevd_dager ?? 0,
        begrunnelse: state.frist.begrunnelse,
      },
      originalVarselType: state.frist.varsel_type,
      onOpenFullModal: () => modals.reviseFrist.setOpen(true),
      canRevise: userRole === 'TE' && actions.canUpdateFrist,
      showPrimaryVariant:
        !!state.frist.bh_resultat &&
        state.frist.bh_resultat !== 'godkjent' &&
        state.frist.antall_versjoner - 1 === state.frist.bh_respondert_versjon,
    };
  }, [sakId, state.frist, userRole, actions.canUpdateFrist, modals.reviseFrist]);

  // Build inline revision actions for vederlag
  const vederlagActionButtons = (
    <BentoVederlagActionButtons
      userRole={userRole}
      actions={actions}
      isForceMajeure={state.grunnlag.hovedkategori === 'FORCE_MAJEURE'}
      onSendVederlag={() => handleExpandTrack('vederlag', 'send')}
      onWithdrawVederlag={() => handleExpandTrack('vederlag', 'withdraw')}
      onRespondVederlag={() => modals.respondVederlag.setOpen(true)}
      onUpdateVederlagResponse={() => modals.updateVederlagResponse.setOpen(true)}
      onAcceptVederlagResponse={() => handleExpandTrack('vederlag', 'accept')}
    />
  );

  const vederlagAction = useMemo(() => {
    if (!inlineVederlagRevision) return vederlagActionButtons;
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
        {vederlagActionButtons}
      </>
    );
  }, [inlineVederlagRevision, inlineReviseOpen, vederlagActionButtons]);

  // Build inline revision actions for frist
  const fristActionButtons = (
    <BentoFristActionButtons
      userRole={userRole}
      actions={actions}
      fristState={state.frist}
      onSendFrist={() => handleExpandTrack('frist', 'send')}
      onReviseFrist={() => modals.reviseFrist.setOpen(true)}
      onWithdrawFrist={() => handleExpandTrack('frist', 'withdraw')}
      onSendForsering={() => modals.sendForsering.setOpen(true)}
      onRespondFrist={() => modals.respondFrist.setOpen(true)}
      onUpdateFristResponse={() => modals.updateFristResponse.setOpen(true)}
      onAcceptFristResponse={() => handleExpandTrack('frist', 'accept')}
    />
  );

  const fristAction = useMemo(() => {
    if (!inlineFristRevision) return fristActionButtons;
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
        {fristActionButtons}
      </>
    );
  }, [inlineFristRevision, inlineFristReviseOpen, fristActionButtons]);

  // ===== BENTO LAYOUT =====
  return (
    <div className="min-h-screen bg-pkt-bg-subtle relative">
      {/* Header - wide variant */}
      <div data-onboarding="page-header">
        <PageHeader
          title={state.sakstittel}
          subtitle={`Sak #${sakId}`}
          userRole={userRole}
          onToggleRole={setUserRole}
          maxWidth="wide"
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

      {/* Mock Toolbar */}
      {userRole === 'BH' && (
        <MockToolbar
          approvalEnabled={approvalWorkflow.approvalEnabled}
          onApprovalEnabledChange={approvalWorkflow.setApprovalEnabled}
        />
      )}

      {/* ===== BENTO MAIN CONTENT ===== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 min-h-[calc(100vh-88px)]">
        <div className="grid grid-cols-12 gap-2 sm:gap-4">

          {/* Banners (full width) */}
          {((forseringData?.forseringer && forseringData.forseringer.length > 0) ||
            (endringsordreData?.endringsordrer && endringsordreData.endringsordrer.length > 0)) && (
            <div className="col-span-12 space-y-2">
              {forseringData?.forseringer && forseringData.forseringer.length > 0 && (
                <ForseringRelasjonBanner forseringer={forseringData.forseringer} />
              )}
              {endringsordreData?.endringsordrer && endringsordreData.endringsordrer.length > 0 && (
                <EndringsordreRelasjonBanner endringsordrer={endringsordreData.endringsordrer} />
              )}
            </div>
          )}

          {/* Breadcrumb */}
          <div className="col-span-12" data-onboarding="status-alert">
            <BentoBreadcrumb prosjektNavn={state.prosjekt_navn} sakId={sakId} />
          </div>

          {/* ===== ROW 1: Context row — Identity + Grunnlag + Activity ===== */}
          <CaseIdentityTile state={state} delay={0} />

          {/* Grunnlag card (master) — in Row 1 next to Identity */}
          {expandedTrack?.track !== 'grunnlag' && (
            <div
              className={
                expandedTrack
                  ? 'col-span-12 md:col-span-6'
                  : 'col-span-12 md:col-span-6 lg:col-span-4'
              }
              data-onboarding="grunnlag-card"
            >
              <BentoDashboardCard
                title="Ansvarsgrunnlag"
                hjemmel="\u00a725.2"
                role="master"
                headerBadge={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getStatusBadge(state.grunnlag.status)}
                    {state.grunnlag.grunnlag_varslet_i_tide === false && state.grunnlag.status !== 'trukket' && (
                      <Badge variant="warning" size="sm">{'\u00a732.2'}</Badge>
                    )}
                  </div>
                }
                action={
                  <BentoGrunnlagActionButtons
                    userRole={userRole}
                    actions={actions}
                    grunnlagState={state.grunnlag}
                    onSendGrunnlag={() => handleExpandTrack('grunnlag', 'send')}
                    onUpdateGrunnlag={() => handleExpandTrack('grunnlag', 'update')}
                    onWithdrawGrunnlag={() => handleExpandTrack('grunnlag', 'withdraw')}
                    onRespondGrunnlag={() => handleExpandTrack('grunnlag', 'respond')}
                    onUpdateGrunnlagResponse={() => handleExpandTrack('grunnlag', 'updateResponse')}
                    onAcceptGrunnlagResponse={() => handleExpandTrack('grunnlag', 'accept')}
                    onUtstEO={() => modals.utstEO.setOpen(true)}
                  />
                }
                className="animate-fade-in-up"
                collapsible
                historyCount={grunnlagEntries.length}
                isExpanded={grunnlagExpanded}
                onExpandedChange={setGrunnlagExpanded}
              >
                <TrackStepper
                  spor="grunnlag"
                  status={state.grunnlag.status}
                  hasBhResponse={!!state.grunnlag.bh_resultat}
                  teAccepted={state.grunnlag.te_akseptert}
                  className="mb-2"
                />

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

                <TrackNextStep
                  spor="grunnlag"
                  state={state}
                  userRole={userRole}
                  actions={actions}
                />

                <SporHistory spor="grunnlag" entries={grunnlagEntries} events={timelineEvents} sakState={state} externalOpen={grunnlagExpanded} />
              </BentoDashboardCard>
            </div>
          )}

          {/* Activity card — in Row 1, hides when Grunnlag is expanded */}
          {expandedTrack?.track !== 'grunnlag' && (
            <CaseActivityCard events={timelineEvents} delay={50} />
          )}

          {/* Approval alerts (full width) */}
          {approvalWorkflow.approvalEnabled && approvalWorkflow.hasAnyDraft && userRole === 'BH' && (
            <div className="col-span-12">
              <Alert
                variant="warning"
                title="Utkast klare for godkjenning"
                action={
                  <Button variant="secondary" size="sm" onClick={() => modals.sendResponsPakke.setOpen(true)}>
                    <PaperPlaneIcon className="w-4 h-4 mr-2" />
                    Send til godkjenning
                  </Button>
                }
              >
                <ul className="text-sm space-y-1 mt-1">
                  {approvalWorkflow.grunnlagDraft && (
                    <li>- Ansvarsgrunnlag: {approvalWorkflow.grunnlagDraft.resultat === 'godkjent' ? 'Godkjent' : approvalWorkflow.grunnlagDraft.resultat === 'avslatt' ? 'Avslatt' : approvalWorkflow.grunnlagDraft.resultat === 'delvis_godkjent' ? 'Delvis godkjent' : approvalWorkflow.grunnlagDraft.resultat}</li>
                  )}
                  {approvalWorkflow.vederlagDraft && (
                    <li>- Vederlag: {formatCurrency(approvalWorkflow.vederlagDraft.belop)} ({approvalWorkflow.vederlagDraft.resultat === 'godkjent' ? 'godkjent' : approvalWorkflow.vederlagDraft.resultat === 'avslatt' ? 'avslatt' : 'delvis godkjent'})</li>
                  )}
                  {approvalWorkflow.fristDraft && (
                    <li>- Frist: {approvalWorkflow.fristDraft.dager} dager ({approvalWorkflow.fristDraft.resultat === 'godkjent' ? 'godkjent' : approvalWorkflow.fristDraft.resultat === 'avslatt' ? 'avslatt' : 'delvis godkjent'})</li>
                  )}
                </ul>
              </Alert>
            </div>
          )}

          {approvalWorkflow.approvalEnabled && approvalWorkflow.bhResponsPakke && (
            <div className="col-span-12">
              <ApprovalDashboardCard
                pakke={approvalWorkflow.bhResponsPakke}
                canApprove={approvalWorkflow.canApprovePakke}
                onOpenDetails={() => modals.approvePakke.setOpen(true)}
                onDownloadPdf={() => downloadApprovedPdf(state, approvalWorkflow.bhResponsPakke!)}
                onRestoreAndEdit={() => approvalWorkflow.restoreDraftsFromPakke()}
                onDiscard={() => modals.discardPakkeConfirm.setOpen(true)}
              />
            </div>
          )}

          {/* Expanded track form (full width) */}
          {expandedTrack && sakId && (() => {
            const meta = getTrackFormMeta(expandedTrack);
            return (
              <div className="col-span-12">
                <TrackFormView
                  trackName={meta.trackName}
                  actionTitle={meta.actionTitle}
                  hjemmel={meta.hjemmel}
                  onCancel={handleCollapseTrack}
                  isDirty={false}
                >
                  {renderExpandedForm()}
                </TrackFormView>
              </div>
            );
          })()}

          {/* ===== ROW 2: Claims row — Vederlag + Frist ===== */}

          {/* Vederlag card (dependent) */}
          {expandedTrack?.track !== 'vederlag' && (
            <div
              className={
                expandedTrack?.track === 'frist'
                  ? 'col-span-12'
                  : 'col-span-12 md:col-span-6'
              }
              data-onboarding="vederlag-card"
            >
              <BentoDashboardCard
                title="Vederlag"
                hjemmel="\u00a734"
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
                <TrackStepper
                  spor="vederlag"
                  status={state.vederlag.status}
                  hasBhResponse={!!state.vederlag.bh_resultat}
                  teAccepted={state.vederlag.te_akseptert}
                  className="mb-2"
                />

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

                <TrackNextStep
                  spor="vederlag"
                  state={state}
                  userRole={userRole}
                  actions={actions}
                />

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

                <SporHistory spor="vederlag" entries={vederlagEntries} events={timelineEvents} sakState={state} externalOpen={vederlagExpanded} />
              </BentoDashboardCard>
            </div>
          )}

          {/* Frist card (dependent) */}
          {expandedTrack?.track !== 'frist' && (
            <div
              className={
                expandedTrack?.track === 'vederlag'
                  ? 'col-span-12'
                  : 'col-span-12 md:col-span-6'
              }
              data-onboarding="frist-card"
            >
              <BentoDashboardCard
                title="Fristforlengelse"
                hjemmel="\u00a733"
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
                <TrackStepper
                  spor="frist"
                  status={state.frist.status}
                  hasBhResponse={!!state.frist.bh_resultat}
                  teAccepted={state.frist.te_akseptert}
                  className="mb-2"
                />

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

                <TrackNextStep
                  spor="frist"
                  state={state}
                  userRole={userRole}
                  actions={actions}
                />

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

                <SporHistory spor="frist" entries={fristEntries} events={timelineEvents} sakState={state} externalOpen={fristExpanded} />
              </BentoDashboardCard>
            </div>
          )}

          {/* Cross-track activity strip */}
          <div className="col-span-12">
            <CrossTrackActivity
              grunnlagHistorikk={grunnlagHistorikk}
              vederlagHistorikk={vederlagHistorikk}
              fristHistorikk={fristHistorikk}
            />
          </div>

        </div>
      </main>

      {/* ===== Remaining Action Modals (complex wizards + special actions) ===== */}
      {sakId && (
        <>
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
              dato_krav_mottatt: vederlagHistorikk.find(e => e.endring_type === 'sendt')?.tidsstempel,
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

          {/* Revise Modals (TE) - kept as modals */}
          <ReviseVederlagModal
            open={modals.reviseVederlag.open}
            onOpenChange={modals.reviseVederlag.setOpen}
            sakId={sakId}
            lastVederlagEvent={{
              event_id: state.vederlag.siste_event_id || `vederlag-${sakId}`,
              metode: state.vederlag.metode || 'ENHETSPRISER',
              belop_direkte: state.vederlag.belop_direkte,
              kostnads_overslag: state.vederlag.kostnads_overslag,
              begrunnelse: state.vederlag.begrunnelse,
              krever_justert_ep: state.vederlag.krever_justert_ep,
              varslet_for_oppstart: state.vederlag.varslet_for_oppstart,
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

          {/* Update Response Modals (BH) - complex wizards kept as modals */}
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
              dato_krav_mottatt: vederlagHistorikk.find(e => e.endring_type === 'sendt')?.tidsstempel,
            }}
            lastResponseEvent={{
              event_id: `vederlag-response-${sakId}`,
              resultat: state.vederlag.bh_resultat || 'godkjent',
              godkjent_belop: state.vederlag.godkjent_belop,
              respondedToVersion: state.vederlag.bh_respondert_versjon,
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
            varselType={state.frist.varsel_type}
            fristEvent={{
              antall_dager: state.frist.krevd_dager,
              begrunnelse: state.frist.begrunnelse,
              dato_krav_mottatt: state.frist.spesifisert_varsel?.dato_sendt,
              dato_oppdaget: state.grunnlag.dato_oppdaget,
              frist_varsel: state.frist.frist_varsel,
              spesifisert_varsel: state.frist.spesifisert_varsel,
            }}
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
                  ? (state.frist.subsidiaer_godkjent_dager ?? 0)
                  : (state.frist.godkjent_dager ?? 0),
              bh_resultat: state.frist.bh_resultat || 'godkjent',
            }}
            dagmulktsats={50000}
            subsidiaerTriggers={state.frist.subsidiaer_triggers}
            onCatendaWarning={() => modals.catendaWarning.setOpen(true)}
          />

          {/* BH Special Action Modals */}
          <UtstEndringsordreModal
            open={modals.utstEO.open}
            onOpenChange={modals.utstEO.setOpen}
            sakId={sakId}
            preselectedKoeIds={[sakId]}
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
            onDirectSend={handleDirectSend}
            currentMockUser={currentMockUser}
            currentMockManager={currentMockManager}
            sakState={state}
          />

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

          <AlertDialog
            open={modals.discardPakkeConfirm.open}
            onOpenChange={modals.discardPakkeConfirm.setOpen}
            title="Forkast avvist svar?"
            description="Dette vil slette det avviste svaret permanent. Du må starte på nytt hvis du vil sende et nytt svar."
            confirmLabel="Forkast svar"
            cancelLabel="Avbryt"
            variant="danger"
            onConfirm={() => approvalWorkflow.cancelPakke()}
          />

          <PdfPreviewModal
            open={modals.pdfPreview.open}
            onOpenChange={modals.pdfPreview.setOpen}
            sakState={state}
          />
        </>
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

export default CasePageBento;
