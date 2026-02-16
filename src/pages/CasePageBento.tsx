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

import { useMemo, useCallback, useRef, useState, Suspense, useEffect } from 'react';
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
import { Alert, Button, AlertDialog, DropdownMenuItem, useToast } from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import { formatCurrency } from '../utils/formatters';
import { downloadApprovedPdf } from '../pdf/generator';
import { ForseringRelasjonBanner } from '../components/forsering';
import { UtstEndringsordreModal, EndringsordreRelasjonBanner } from '../components/endringsordre';
import { MockToolbar } from '../components/MockToolbar';
import { BentoBreadcrumb, CaseMasterCard, BimCard, TrackFormView, CrossTrackActivity, VederlagCard, FristCard, BentoRespondGrunnlag, BentoRespondFrist, BentoRespondVederlag } from '../components/bento';
import { useGrunnlagBridge } from '../hooks/useGrunnlagBridge';
import { useFristBridge } from '../hooks/useFristBridge';
import { useVederlagBridge } from '../hooks/useVederlagBridge';
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
  WithdrawForm,
  AcceptResponseForm,
} from '../components/actions/forms';
import {
  transformGrunnlagHistorikk,
  transformVederlagHistorikk,
  transformFristHistorikk,
} from '../components/views/SporHistory';
import { findForseringerForSak, type FindForseringerResponse } from '../api/forsering';
import { findEOerForSak, type FindEOerResponse } from '../api/endringsordre';
import type { TimelineEvent, EventType } from '../types/timeline';
import type { DraftResponseData } from '../types/approval';
import {
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

// ========== Helpers ==========

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

  // Grunnlag entries needed by BentoRespondGrunnlag inside renderExpandedForm
  const grunnlagEntries = useMemo(() => transformGrunnlagHistorikk(grunnlagHistorikk), [grunnlagHistorikk]);

  // ===== GRUNNLAG CARD-ANCHORED EDITING =====
  const isGrunnlagFormOpen = expandedTrack?.track === 'grunnlag' &&
    (expandedTrack.action === 'respond' || expandedTrack.action === 'updateResponse');

  const ukCode = Array.isArray(state.grunnlag.underkategori)
    ? state.grunnlag.underkategori[0]
    : state.grunnlag.underkategori;

  const grunnlagBridge = useGrunnlagBridge({
    isOpen: isGrunnlagFormOpen,
    sakId,
    grunnlagEventId: `grunnlag-${sakId}`,
    grunnlagEvent: {
      hovedkategori: state.grunnlag.hovedkategori,
      underkategori: ukCode,
      beskrivelse: state.grunnlag.beskrivelse,
      dato_oppdaget: state.grunnlag.dato_oppdaget,
      dato_varslet: state.grunnlag.grunnlag_varsel?.dato_sendt,
    },
    lastResponseEvent: expandedTrack?.action === 'updateResponse' && state.grunnlag.bh_resultat
      ? { event_id: `grunnlag-response-${sakId}`, resultat: state.grunnlag.bh_resultat }
      : undefined,
    sakState: state,
    onSuccess: handleCollapseTrack,
    onCatendaWarning: () => modals.catendaWarning.setOpen(true),
    approvalEnabled: approvalWorkflow.approvalEnabled,
    onSaveDraft: (draftData) => {
      approvalWorkflow.saveDraft({
        sporType: 'grunnlag',
        resultat: draftData.resultat as 'godkjent' | 'avslatt' | 'frafalt',
        begrunnelse: draftData.begrunnelse,
        formData: draftData.formData,
      });
    },
  });

  // ===== FRIST CARD-ANCHORED EDITING =====
  const isFristFormOpen = expandedTrack?.track === 'frist' &&
    (expandedTrack.action === 'respond' || expandedTrack.action === 'updateResponse');

  const fristBridge = useFristBridge({
    isOpen: isFristFormOpen,
    sakId,
    fristKravId: `frist-${sakId}`,
    krevdDager: state.frist.krevd_dager ?? 0,
    varselType: state.frist.varsel_type,
    grunnlagStatus: grunnlagStatus as 'godkjent' | 'avslatt' | 'frafalt' | undefined,
    grunnlagVarsletForSent: state.grunnlag.grunnlag_varslet_i_tide === false,
    fristTilstand: state.frist,
    lastResponseEvent: expandedTrack?.action === 'updateResponse' && state.frist.bh_resultat
      ? { event_id: `frist-response-${sakId}`, resultat: state.frist.bh_resultat, godkjent_dager: state.frist.godkjent_dager }
      : undefined,
    onSuccess: handleCollapseTrack,
    onCatendaWarning: () => modals.catendaWarning.setOpen(true),
    approvalEnabled: approvalWorkflow.approvalEnabled,
    onSaveDraft: (draftData) => {
      approvalWorkflow.saveDraft({
        sporType: 'frist',
        dager: draftData.dager as number,
        resultat: draftData.resultat as 'godkjent' | 'delvis_godkjent' | 'avslatt',
        begrunnelse: draftData.begrunnelse as string,
        formData: draftData,
      });
    },
  });

  // ===== VEDERLAG CARD-ANCHORED EDITING =====
  const isVederlagFormOpen = expandedTrack?.track === 'vederlag' &&
    (expandedTrack.action === 'respond' || expandedTrack.action === 'updateResponse');

  const hovedkravBelopForBridge = useMemo(() => {
    const v = state.vederlag;
    if (v.metode === 'REGNINGSARBEID' && v.kostnads_overslag !== undefined) {
      return v.kostnads_overslag;
    }
    return v.belop_direkte ?? 0;
  }, [state.vederlag]);

  const vederlagBridge = useVederlagBridge({
    isOpen: isVederlagFormOpen,
    sakId,
    vederlagKravId: `vederlag-${sakId}`,
    teMetode: state.vederlag.metode as 'ENHETSPRISER' | 'REGNINGSARBEID' | 'FASTPRIS_TILBUD' | undefined,
    hovedkravBelop: hovedkravBelopForBridge,
    riggBelop: state.vederlag.saerskilt_krav?.rigg_drift?.belop,
    produktivitetBelop: state.vederlag.saerskilt_krav?.produktivitet?.belop,
    harRiggKrav: (state.vederlag.saerskilt_krav?.rigg_drift?.belop ?? 0) > 0,
    harProduktivitetKrav: (state.vederlag.saerskilt_krav?.produktivitet?.belop ?? 0) > 0,
    kreverJustertEp: state.vederlag.krever_justert_ep === true,
    kostnadsOverslag: state.vederlag.kostnads_overslag,
    hovedkategori: state.grunnlag.hovedkategori as 'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE' | undefined,
    riggVarsletDato: state.vederlag.saerskilt_krav?.rigg_drift?.dato_klar_over,
    produktivitetVarsletDato: state.vederlag.saerskilt_krav?.produktivitet?.dato_klar_over,
    hovedkravVarsletDato: state.grunnlag.dato_oppdaget,
    grunnlagStatus: grunnlagStatus as 'godkjent' | 'avslatt' | 'frafalt' | undefined,
    grunnlagVarsletForSent: state.grunnlag.grunnlag_varslet_i_tide === false,
    lastResponseEvent: expandedTrack?.action === 'updateResponse' && state.vederlag.bh_resultat
      ? {
          eventId: `vederlag-response-${sakId}`,
          akseptererMetode: state.vederlag.bh_metode === state.vederlag.metode || state.vederlag.bh_metode === undefined,
          oensketMetode: state.vederlag.bh_metode !== state.vederlag.metode ? state.vederlag.bh_metode as 'ENHETSPRISER' | 'REGNINGSARBEID' | 'FASTPRIS_TILBUD' | undefined : undefined,
          godkjentBelop: state.vederlag.godkjent_belop,
        }
      : undefined,
    onSuccess: handleCollapseTrack,
    onCatendaWarning: () => modals.catendaWarning.setOpen(true),
    approvalEnabled: approvalWorkflow.approvalEnabled,
    onSaveDraft: (draftData) => {
      approvalWorkflow.saveDraft({
        sporType: 'vederlag',
        belop: draftData.belop as number,
        resultat: draftData.resultat as 'godkjent' | 'delvis_godkjent' | 'avslatt',
        begrunnelse: draftData.begrunnelse as string,
        formData: draftData.formData as Record<string, unknown>,
      });
    },
  });

  // ===== AUTO-SCROLL TO CARD ON MOBILE (L15) =====
  const grunnlagCardRef = useRef<HTMLDivElement>(null);
  const fristCardRef = useRef<HTMLDivElement>(null);
  const vederlagCardRef = useRef<HTMLDivElement>(null);

  const cardAnchoredRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ref = isGrunnlagFormOpen ? grunnlagCardRef
      : (isFristFormOpen || isVederlagFormOpen) ? cardAnchoredRef
      : null;
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isGrunnlagFormOpen, isFristFormOpen, isVederlagFormOpen]);

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
      case 'grunnlag:updateResponse':
        return (
          <BentoRespondGrunnlag editorProps={grunnlagBridge.editorProps} />
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
      case 'vederlag:respond':
      case 'vederlag:updateResponse':
        return (
          <BentoRespondVederlag editorProps={vederlagBridge.editorProps} />
        );
      case 'frist:respond':
      case 'frist:updateResponse':
        return (
          <BentoRespondFrist editorProps={fristBridge.editorProps} />
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
  }, [expandedTrack, sakId, state, grunnlagStatus, approvalWorkflow, modals.catendaWarning, handleCollapseTrack, grunnlagBridge, fristBridge, vederlagBridge]);

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

  // Godkjent amounts (respecting subsidiary state)
  const godkjentBelop = vederlagErSubsidiaer
    ? state.vederlag.subsidiaer_godkjent_belop
    : state.vederlag.godkjent_belop;
  const godkjentDager = fristErSubsidiaer
    ? state.frist.subsidiaer_godkjent_dager
    : state.frist.godkjent_dager;

  // Godkjenningsgrad (approval rate) — like EconomicsChartTile
  const vederlagGrad = krevdBelop && krevdBelop > 0 && godkjentBelop != null
    ? Math.round((godkjentBelop / krevdBelop) * 100)
    : null;
  const fristGrad = state.frist.krevd_dager && state.frist.krevd_dager > 0 && godkjentDager != null
    ? Math.round((godkjentDager / state.frist.krevd_dager) * 100)
    : null;

  const vederlagEntries = useMemo(() => transformVederlagHistorikk(vederlagHistorikk), [vederlagHistorikk]);
  const fristEntries = useMemo(() => transformFristHistorikk(fristHistorikk), [fristHistorikk]);

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

  // ===== PRIMARY/SECONDARY ACTIONS FOR TRACK CARDS =====

  const grunnlagPrimaryAction = useMemo(() => {
    const g = state.grunnlag;
    const isUpdatePrimary = g.bh_resultat && g.bh_resultat !== 'godkjent' && g.antall_versjoner - 1 === g.bh_respondert_versjon;
    if (userRole === 'TE') {
      if (actions.canSendGrunnlag) return { label: 'Varsle krav', onClick: () => handleExpandTrack('grunnlag', 'send') };
      if (actions.canUpdateGrunnlag && isUpdatePrimary) return { label: 'Oppdater krav', onClick: () => handleExpandTrack('grunnlag', 'update') };
    }
    if (userRole === 'BH') {
      if (actions.canRespondToGrunnlag) return { label: 'Svar på krav', onClick: () => handleExpandTrack('grunnlag', 'respond') };
      if (actions.canIssueEO) return { label: 'Utsted EO', onClick: () => modals.utstEO.setOpen(true) };
    }
    return undefined;
  }, [userRole, actions, state.grunnlag, handleExpandTrack, modals.utstEO]);

  const grunnlagSecondaryActions = useMemo(() => {
    const items: { label: string; onClick: () => void; variant?: 'default' | 'danger' }[] = [];
    const g = state.grunnlag;
    const isUpdatePrimary = g.bh_resultat && g.bh_resultat !== 'godkjent' && g.antall_versjoner - 1 === g.bh_respondert_versjon;
    if (userRole === 'TE') {
      if (actions.canUpdateGrunnlag && !isUpdatePrimary) items.push({ label: 'Oppdater', onClick: () => handleExpandTrack('grunnlag', 'update') });
      if (actions.canAcceptGrunnlagResponse) items.push({ label: 'Godta svaret', onClick: () => handleExpandTrack('grunnlag', 'accept') });
      if (actions.canWithdrawGrunnlag) items.push({ label: 'Trekk tilbake', onClick: () => handleExpandTrack('grunnlag', 'withdraw'), variant: 'danger' });
    }
    if (userRole === 'BH') {
      if (actions.canUpdateGrunnlagResponse) items.push({ label: 'Endre svar', onClick: () => handleExpandTrack('grunnlag', 'updateResponse') });
    }
    return items;
  }, [userRole, actions, state.grunnlag, handleExpandTrack]);

  const vederlagPrimaryAction = useMemo(() => {
    if (state.grunnlag.hovedkategori === 'FORCE_MAJEURE') return undefined;
    if (userRole === 'TE') {
      if (actions.canSendVederlag) return { label: 'Send krav', onClick: () => handleExpandTrack('vederlag', 'send') };
      if (inlineVederlagRevision?.canRevise && inlineVederlagRevision.showPrimaryVariant) return { label: 'Revider', onClick: () => setInlineReviseOpen(true) };
    }
    if (userRole === 'BH') {
      if (actions.canRespondToVederlag) return { label: 'Svar på krav', onClick: () => handleExpandTrack('vederlag', 'respond') };
    }
    return undefined;
  }, [userRole, actions, state.grunnlag.hovedkategori, inlineVederlagRevision, handleExpandTrack, modals.respondVederlag]);

  const vederlagSecondaryActions = useMemo(() => {
    if (state.grunnlag.hovedkategori === 'FORCE_MAJEURE') return [];
    const items: { label: string; onClick: () => void; variant?: 'default' | 'danger' }[] = [];
    if (userRole === 'TE') {
      if (inlineVederlagRevision?.canRevise && !inlineVederlagRevision.showPrimaryVariant) items.push({ label: 'Revider', onClick: () => setInlineReviseOpen(true) });
      if (actions.canAcceptVederlagResponse) items.push({ label: 'Godta svaret', onClick: () => handleExpandTrack('vederlag', 'accept') });
      if (actions.canWithdrawVederlag) items.push({ label: 'Trekk tilbake', onClick: () => handleExpandTrack('vederlag', 'withdraw'), variant: 'danger' });
    }
    if (userRole === 'BH') {
      if (actions.canUpdateVederlagResponse) items.push({ label: 'Endre svar', onClick: () => handleExpandTrack('vederlag', 'updateResponse') });
    }
    return items;
  }, [userRole, actions, state.grunnlag.hovedkategori, inlineVederlagRevision, handleExpandTrack, modals.updateVederlagResponse]);

  const fristPrimaryAction = useMemo(() => {
    if (userRole === 'TE') {
      if (actions.canSendFrist) return { label: 'Send krav', onClick: () => handleExpandTrack('frist', 'send') };
      if (actions.canUpdateFrist && state.frist.har_bh_foresporsel) return { label: 'Svar forespørsel', onClick: () => modals.reviseFrist.setOpen(true) };
      if (inlineFristRevision?.canRevise && inlineFristRevision.showPrimaryVariant) return { label: 'Revider', onClick: () => setInlineFristReviseOpen(true) };
    }
    if (userRole === 'BH') {
      if (actions.canRespondToFrist) return { label: 'Svar på krav', onClick: () => handleExpandTrack('frist', 'respond') };
    }
    return undefined;
  }, [userRole, actions, state.frist.har_bh_foresporsel, inlineFristRevision, handleExpandTrack, modals.reviseFrist]);

  const fristSecondaryActions = useMemo(() => {
    const items: { label: string; onClick: () => void; variant?: 'default' | 'danger' }[] = [];
    if (userRole === 'TE') {
      if (inlineFristRevision?.canRevise && !inlineFristRevision.showPrimaryVariant) items.push({ label: 'Revider', onClick: () => setInlineFristReviseOpen(true) });
      if (actions.canSendForsering) items.push({ label: 'Forsering (§33.8)', onClick: () => modals.sendForsering.setOpen(true) });
      if (actions.canAcceptFristResponse) items.push({ label: 'Godta svaret', onClick: () => handleExpandTrack('frist', 'accept') });
      if (actions.canWithdrawFrist) items.push({ label: 'Trekk tilbake', onClick: () => handleExpandTrack('frist', 'withdraw'), variant: 'danger' });
    }
    if (userRole === 'BH') {
      if (actions.canUpdateFristResponse) items.push({ label: 'Endre svar', onClick: () => handleExpandTrack('frist', 'updateResponse') });
    }
    return items;
  }, [userRole, actions, inlineFristRevision, handleExpandTrack, modals.sendForsering]);

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

          {/* ===== CARD-ANCHORED FORM (top of page when open) ===== */}
          {isFristFormOpen && (
            <div ref={cardAnchoredRef} className="col-span-12 grid grid-cols-12 gap-2 sm:gap-4 scroll-mt-4">
              <div ref={fristCardRef} className="col-span-12 md:col-span-5 md:order-2">
                <FristCard
                  state={state}
                  godkjentDager={godkjentDager ?? undefined}
                  fristGrad={fristGrad ?? undefined}
                  isSubsidiary={fristErSubsidiaer}
                  userRole={userRole}
                  actions={actions}
                  entries={fristEntries}
                  editState={fristBridge.cardProps}
                />
              </div>
              <div className="col-span-12 md:col-span-7 md:order-1 flex flex-col">
                {renderExpandedForm()}
              </div>
            </div>
          )}

          {isVederlagFormOpen && (
            <div ref={cardAnchoredRef} className="col-span-12 grid grid-cols-12 gap-2 sm:gap-4 scroll-mt-4">
              <div ref={vederlagCardRef} className="col-span-12 md:col-span-5 md:order-2">
                <VederlagCard
                  state={state}
                  krevdBelop={krevdBelop}
                  godkjentBelop={godkjentBelop}
                  vederlagGrad={vederlagGrad ?? undefined}
                  isSubsidiary={vederlagErSubsidiaer}
                  userRole={userRole}
                  actions={actions}
                  entries={vederlagEntries}
                  editState={vederlagBridge.cardProps}
                />
              </div>
              <div className="col-span-12 md:col-span-7 md:order-1 flex flex-col">
                {renderExpandedForm()}
              </div>
            </div>
          )}

          {/* ===== TWO-COLUMN LAYOUT: Master (left) + Claims (right) ===== */}

          {/* Left column: Master card */}
          <div
            ref={grunnlagCardRef}
            className={
              isFristFormOpen || isVederlagFormOpen
                ? 'col-span-12 md:col-span-6'
                : expandedTrack?.track === 'grunnlag'
                  ? 'col-span-12 md:col-span-5'
                  : expandedTrack
                    ? 'col-span-12'
                    : 'col-span-12 md:col-span-6'
            }
            data-onboarding="grunnlag-card"
          >
            <CaseMasterCard
              state={state}
              userRole={userRole}
              actions={actions}
              grunnlagEntries={grunnlagEntries}
              primaryAction={grunnlagPrimaryAction}
              secondaryActions={grunnlagSecondaryActions}
              editState={isGrunnlagFormOpen ? grunnlagBridge.cardProps : null}
              className="animate-fade-in-up"
            />
            {!expandedTrack && (
              <div className="mt-2 sm:mt-3">
                <BimCard sakId={sakId} className="animate-fade-in-up" />
              </div>
            )}
          </div>

          {/* Right column: Vederlag + Frist stacked */}
          {!expandedTrack && (
            <div className="col-span-12 md:col-span-6 flex flex-col gap-2 sm:gap-4">
              <div data-onboarding="vederlag-card">
                <VederlagCard
                  state={state}
                  krevdBelop={krevdBelop}
                  godkjentBelop={godkjentBelop}
                  vederlagGrad={vederlagGrad ?? undefined}
                  isSubsidiary={vederlagErSubsidiaer}
                  isDimmed={grunnlagIkkeSendt}
                  userRole={userRole}
                  actions={actions}
                  entries={vederlagEntries}
                  primaryAction={vederlagPrimaryAction}
                  secondaryActions={vederlagSecondaryActions}
                  className="animate-fade-in-up"
                  style={{ animationDelay: '75ms' }}
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
              </div>
              <div data-onboarding="frist-card">
                <FristCard
                  state={state}
                  godkjentDager={godkjentDager ?? undefined}
                  fristGrad={fristGrad ?? undefined}
                  isSubsidiary={fristErSubsidiaer}
                  isDimmed={grunnlagIkkeSendt}
                  userRole={userRole}
                  actions={actions}
                  entries={fristEntries}
                  primaryAction={fristPrimaryAction}
                  secondaryActions={fristSecondaryActions}
                  className="animate-fade-in-up"
                  style={{ animationDelay: '150ms' }}
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
              </div>
            </div>
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

          {/* Expanded track form — grunnlag opens right (col-7), others full-width */}
          {/* Card-anchored frist/vederlag are rendered above the master card */}
          {expandedTrack && sakId && !isFristFormOpen && !isVederlagFormOpen && (() => {
            const meta = getTrackFormMeta(expandedTrack);
            const isGrunnlagInline = expandedTrack.track === 'grunnlag';

            // Grunnlag: render directly without TrackFormView header (MasterCard provides context)
            if (isGrunnlagInline) {
              return (
                <div className="col-span-12 md:col-span-7">
                  {renderExpandedForm()}
                </div>
              );
            }

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

          {/* Vederlag + Frist full-width when a form is expanded */}
          {expandedTrack && (
            <>
              {expandedTrack.track !== 'vederlag' && (
                <div className="col-span-12 md:col-span-6" data-onboarding="vederlag-card">
                  <VederlagCard
                    state={state}
                    krevdBelop={krevdBelop}
                    godkjentBelop={godkjentBelop}
                    vederlagGrad={vederlagGrad ?? undefined}
                    isSubsidiary={vederlagErSubsidiaer}
                    isDimmed={grunnlagIkkeSendt}
                    userRole={userRole}
                    actions={actions}
                    entries={vederlagEntries}
                    primaryAction={vederlagPrimaryAction}
                    secondaryActions={vederlagSecondaryActions}
                  />
                </div>
              )}
              {expandedTrack.track !== 'frist' && (
                <div className="col-span-12 md:col-span-6" data-onboarding="frist-card">
                  <FristCard
                    state={state}
                    godkjentDager={godkjentDager ?? undefined}
                    fristGrad={fristGrad ?? undefined}
                    isSubsidiary={fristErSubsidiaer}
                    isDimmed={grunnlagIkkeSendt}
                    userRole={userRole}
                    actions={actions}
                    entries={fristEntries}
                    primaryAction={fristPrimaryAction}
                    secondaryActions={fristSecondaryActions}
                  />
                </div>
              )}
            </>
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
