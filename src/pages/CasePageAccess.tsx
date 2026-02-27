/**
 * CasePageAccess — Three-panel layout for case management.
 *
 * Inspired by Haven-style case management interfaces:
 * - Left panel (280px): Case identity + track navigation + varsling + activity
 * - Middle panel (flex): Selected track detail + form fields
 * - Right panel (flex): Tabbed reference (Begrunnelse / Historikk / Filer)
 *
 * Route: /saker/:sakId/access
 */

import { useState, useMemo, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useCaseContext } from '../hooks/useCaseContext';
import { useUserRole } from '../hooks/useUserRole';
import { useActionPermissions, type AvailableActions } from '../hooks/useActionPermissions';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/primitives';
import { getHovedkategoriLabel, getUnderkategoriLabel } from '../constants/categories';
import { getVederlagsmetodeShortLabel } from '../constants/paymentMethods';
import { getSporStatusStyle, getOverordnetStatusStyle, getSakstypeStyle } from '../constants/statusStyles';
import { getStatusDotClass, getGradColor } from '../components/bento/track-cards/trackCardUtils';
import { formatCurrencyCompact, formatDateShort } from '../utils/formatters';
import {
  transformGrunnlagHistorikk,
  transformVederlagHistorikk,
  transformFristHistorikk,
} from '../components/views/SporHistory';
import type { SporType, SakState } from '../types/timeline';
import type { SporHistoryEntry } from '../components/views/SporHistory';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
  MinusCircledIcon,
  FileTextIcon,
  CounterClockwiseClockIcon,
  Pencil1Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  PaperPlaneIcon,
  ChatBubbleIcon,
  ReloadIcon,
  UploadIcon,
} from '@radix-ui/react-icons';
import {
  LoadingState,
  VerifyingState,
  AuthErrorState,
} from '../components/PageStateHelpers';

// ========== Types ==========

type ActiveTrack = SporType | null;
type RightTab = 'begrunnelse' | 'historikk' | 'filer';

// ========== Main Component ==========

export function CasePageAccess() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CasePageAccessInner />
    </Suspense>
  );
}

function CasePageAccessInner() {
  const { sakId } = useParams<{ sakId: string }>();
  const { token, isVerifying, error: authError } = useAuth();
  const { userRole } = useUserRole();

  if (isVerifying) return <VerifyingState />;
  if (authError || !token) return <AuthErrorState error={authError} />;
  if (!sakId) return <div className="p-8 text-pkt-text-body-subtle">Ingen sak valgt.</div>;

  return <CasePageAccessContent sakId={sakId} userRole={userRole} />;
}

function CasePageAccessContent({ sakId, userRole }: { sakId: string; userRole: 'TE' | 'BH' }) {
  const { data, grunnlagHistorikk, vederlagHistorikk, fristHistorikk } = useCaseContext(sakId);
  const state = data.state;
  const actions = useActionPermissions(state, userRole);

  const [activeTrack, setActiveTrack] = useState<ActiveTrack>(null);
  const [rightTab, setRightTab] = useState<RightTab>('historikk');

  // Transform historikk for display
  const grunnlagEntries = useMemo(() => transformGrunnlagHistorikk(grunnlagHistorikk), [grunnlagHistorikk]);
  const vederlagEntries = useMemo(() => transformVederlagHistorikk(vederlagHistorikk), [vederlagHistorikk]);
  const fristEntries = useMemo(() => transformFristHistorikk(fristHistorikk), [fristHistorikk]);

  // Compute vederlag KPIs
  const krevdBelop = useMemo(() => getKrevdBelop(state), [state]);
  const godkjentBelop = state.vederlag.godkjent_belop;
  const vederlagGrad = state.vederlag.godkjenningsgrad_prosent;
  const fristGrad = state.frist.krevd_dager && state.frist.godkjent_dager
    ? Math.round((state.frist.godkjent_dager / state.frist.krevd_dager) * 100)
    : undefined;

  // Active track entries for the right panel
  const activeEntries = useMemo(() => {
    if (activeTrack === 'grunnlag') return grunnlagEntries;
    if (activeTrack === 'vederlag') return vederlagEntries;
    if (activeTrack === 'frist') return fristEntries;
    return [...grunnlagEntries, ...vederlagEntries, ...fristEntries]
      .sort((a, b) => (b.tidsstempel || '').localeCompare(a.tidsstempel || ''));
  }, [activeTrack, grunnlagEntries, vederlagEntries, fristEntries]);

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col">
      {/* Top bar */}
      <TopBar state={state} sakId={sakId} userRole={userRole} />

      {/* Three-panel layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel: Case overview + track navigation */}
        <LeftPanel
          state={state}
          userRole={userRole}
          activeTrack={activeTrack}
          onTrackSelect={setActiveTrack}
          krevdBelop={krevdBelop}
          godkjentBelop={godkjentBelop}
          vederlagGrad={vederlagGrad}
          fristGrad={fristGrad}
          grunnlagEntries={grunnlagEntries}
          vederlagEntries={vederlagEntries}
          fristEntries={fristEntries}
        />

        {/* Vertical divider */}
        <div className="w-px bg-pkt-border-subtle shrink-0" />

        {/* Middle panel: Track detail */}
        <MiddlePanel
          state={state}
          userRole={userRole}
          activeTrack={activeTrack}
          onTrackSelect={setActiveTrack}
          actions={actions}
          krevdBelop={krevdBelop}
          godkjentBelop={godkjentBelop}
          vederlagGrad={vederlagGrad}
          fristGrad={fristGrad}
        />

        {/* Vertical divider */}
        <div className="w-px bg-pkt-border-subtle shrink-0" />

        {/* Right panel: Tabbed reference */}
        <RightPanel
          state={state}
          activeTrack={activeTrack}
          rightTab={rightTab}
          onTabChange={setRightTab}
          entries={activeEntries}
          userRole={userRole}
        />
      </div>
    </div>
  );
}

// ========== Top Bar ==========

function TopBar({ state, sakId, userRole }: { state: SakState; sakId: string; userRole: 'TE' | 'BH' }) {
  const statusStyle = getOverordnetStatusStyle(state.overordnet_status);
  const sakstypeStyle = getSakstypeStyle(state.sakstype || 'standard');

  return (
    <div className="h-11 border-b border-pkt-border-subtle bg-pkt-bg-card flex items-center px-4 gap-3 shrink-0">
      <Link
        to="/saker"
        className="flex items-center gap-1 text-bento-caption text-pkt-text-body-subtle hover:text-pkt-text-body-default transition-colors"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        <span>Tilbake</span>
      </Link>

      <div className="w-px h-5 bg-pkt-border-subtle" />

      <span className="font-mono text-bento-caption font-medium text-pkt-text-body-default">
        {state.sak_id}
      </span>
      <span className="text-bento-caption text-pkt-text-body-subtle truncate max-w-[300px]">
        {state.sakstittel}
      </span>

      <span className={clsx('px-1.5 py-0.5 rounded-sm text-bento-micro font-medium', sakstypeStyle.className)}>
        {sakstypeStyle.label}
      </span>
      <span className={clsx('px-1.5 py-0.5 rounded-sm text-bento-micro font-medium', statusStyle.className)}>
        {statusStyle.label}
      </span>

      <div className="flex-1" />

      <span className="text-bento-caption text-pkt-text-body-subtle">
        {state.entreprenor || 'TE'} &harr; {state.byggherre || 'BH'}
      </span>

      <div className="w-px h-5 bg-pkt-border-subtle" />

      <Link
        to={`/saker/${sakId}`}
        className="text-bento-caption text-pkt-text-body-subtle hover:text-pkt-text-action-active transition-colors"
      >
        Tidslinje
      </Link>
      <Link
        to={`/saker/${sakId}/bento`}
        className="text-bento-caption text-pkt-text-body-subtle hover:text-pkt-text-action-active transition-colors"
      >
        Bento
      </Link>
    </div>
  );
}

// ========== Left Panel ==========

interface LeftPanelProps {
  state: SakState;
  userRole: 'TE' | 'BH';
  activeTrack: ActiveTrack;
  onTrackSelect: (track: ActiveTrack) => void;
  krevdBelop?: number;
  godkjentBelop?: number;
  vederlagGrad?: number;
  fristGrad?: number;
  grunnlagEntries: SporHistoryEntry[];
  vederlagEntries: SporHistoryEntry[];
  fristEntries: SporHistoryEntry[];
}

function LeftPanel({
  state,
  userRole,
  activeTrack,
  onTrackSelect,
  krevdBelop,
  godkjentBelop,
  vederlagGrad,
  fristGrad,
  grunnlagEntries,
  vederlagEntries,
  fristEntries,
}: LeftPanelProps) {
  const g = state.grunnlag;
  const v = state.vederlag;
  const f = state.frist;

  // Neste handling
  const nh = state.neste_handling;

  return (
    <div className="w-[280px] shrink-0 bg-pkt-bg-card overflow-y-auto scrollbar-auto">
      {/* Neste handling */}
      {nh.handling && (
        <div className="px-4 pt-3 pb-2">
          <div className="text-bento-micro uppercase tracking-wider font-medium text-pkt-text-body-subtle mb-1">
            Neste handling
          </div>
          <button
            onClick={() => nh.spor && onTrackSelect(nh.spor)}
            className="w-full text-left rounded-sm bg-pkt-bg-subtle px-2.5 py-2 hover:bg-pkt-grays-gray-200/50 transition-colors group"
          >
            <div className="flex items-center gap-1.5">
              {nh.rolle && (
                <span className={clsx(
                  'text-bento-micro font-bold',
                  nh.rolle === 'TE' ? 'text-role-te-text' : 'text-role-bh-text',
                )}>
                  {nh.rolle}
                </span>
              )}
              <span className="text-bento-caption font-medium text-pkt-text-body-default group-hover:text-pkt-text-action-active transition-colors">
                {nh.handling}
              </span>
            </div>
            {nh.spor && (
              <span className="text-bento-micro text-pkt-text-body-subtle capitalize">
                {nh.spor}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 border-b border-pkt-border-subtle" />

      {/* Track navigation */}
      <div className="py-2">
        {/* Grunnlag */}
        <TrackNavItem
          label="Ansvarsgrunnlag"
          hjemmel="§25.2"
          isActive={activeTrack === 'grunnlag'}
          onClick={() => onTrackSelect(activeTrack === 'grunnlag' ? null : 'grunnlag')}
          status={g.status}
          accentColor="bg-pkt-brand-dark-blue-1000"
        >
          {g.hovedkategori && (
            <span className="text-bento-micro text-pkt-text-body-subtle truncate">
              {getHovedkategoriLabel(g.hovedkategori)}
              {g.underkategori && <> &middot; {getUnderkategoriLabel(g.underkategori)}</>}
            </span>
          )}
          {g.grunnlag_varsel?.dato_sendt && (
            <span className="text-bento-micro text-pkt-text-body-subtle">
              Varslet {formatDateShort(g.grunnlag_varsel.dato_sendt)}
            </span>
          )}
        </TrackNavItem>

        {/* Vederlag */}
        <TrackNavItem
          label="Vederlag"
          hjemmel="§34"
          isActive={activeTrack === 'vederlag'}
          onClick={() => onTrackSelect(activeTrack === 'vederlag' ? null : 'vederlag')}
          status={v.status}
          accentColor="bg-pkt-brand-warm-blue-1000"
          isSubsidiary={state.er_subsidiaert_vederlag}
        >
          {v.metode && (
            <span className="text-bento-micro text-pkt-text-body-subtle">
              {getVederlagsmetodeShortLabel(v.metode)}
              {krevdBelop != null && <> &middot; {formatCurrencyCompact(krevdBelop)}</>}
            </span>
          )}
          {vederlagGrad != null && (
            <MiniProgress value={vederlagGrad} label={`${vederlagGrad}%`} />
          )}
        </TrackNavItem>

        {/* Frist */}
        <TrackNavItem
          label="Fristforlengelse"
          hjemmel="§33"
          isActive={activeTrack === 'frist'}
          onClick={() => onTrackSelect(activeTrack === 'frist' ? null : 'frist')}
          status={f.status}
          accentColor="bg-pkt-brand-yellow-1000"
          isSubsidiary={state.er_subsidiaert_frist}
        >
          {f.krevd_dager != null && (
            <span className="text-bento-micro text-pkt-text-body-subtle">
              {f.krevd_dager}d krevd
              {f.godkjent_dager != null && <> &middot; {f.godkjent_dager}d godkjent</>}
            </span>
          )}
          {fristGrad != null && (
            <MiniProgress value={fristGrad} label={`${fristGrad}%`} />
          )}
        </TrackNavItem>
      </div>

      {/* Divider */}
      <div className="mx-4 border-b border-pkt-border-subtle" />

      {/* Varslingsstatus */}
      <VarslingSection state={state} />

      {/* Divider */}
      <div className="mx-4 border-b border-pkt-border-subtle" />

      {/* Recent activity */}
      <ActivitySection
        grunnlagEntries={grunnlagEntries}
        vederlagEntries={vederlagEntries}
        fristEntries={fristEntries}
      />
    </div>
  );
}

// ========== Track Navigation Item ==========

interface TrackNavItemProps {
  label: string;
  hjemmel: string;
  isActive: boolean;
  onClick: () => void;
  status: string;
  accentColor: string;
  isSubsidiary?: boolean;
  children?: React.ReactNode;
}

function TrackNavItem({ label, hjemmel, isActive, onClick, status, accentColor, isSubsidiary, children }: TrackNavItemProps) {
  const statusStyle = getSporStatusStyle(status as any);
  const dotClass = getStatusDotClass(status as any);
  const isOpen = status === 'utkast' || status === 'ikke_relevant';

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left px-4 py-2.5 transition-colors relative',
        isActive
          ? 'bg-pkt-bg-subtle'
          : 'hover:bg-pkt-bg-subtle/50',
      )}
    >
      {/* Active indicator — thin left accent bar */}
      {isActive && (
        <div className={clsx('absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full', accentColor)} />
      )}

      {/* Header row: dot + label + hjemmel */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <div
          className={clsx(
            'w-2 h-2 rounded-full shrink-0',
            isOpen ? 'border border-pkt-grays-gray-400' : dotClass,
          )}
        />
        <span className="text-bento-caption font-semibold text-pkt-text-body-default tracking-wide uppercase">
          {label}
        </span>
        <span className="text-bento-micro text-pkt-text-body-subtle font-mono">
          {hjemmel}
        </span>
        {isSubsidiary && (
          <span className="text-bento-micro px-1 py-0 rounded-sm bg-pkt-brand-yellow-500 text-pkt-text-body-default font-medium">
            Sub.
          </span>
        )}
      </div>

      {/* Status label */}
      <div className="pl-3.5 mb-0.5">
        <span className={clsx('text-bento-micro font-medium', statusStyle.className, 'bg-transparent px-0 py-0')}>
          {statusStyle.label}
        </span>
      </div>

      {/* Detail lines (children) */}
      <div className="pl-3.5 flex flex-col gap-0.5">
        {children}
      </div>
    </button>
  );
}

// ========== Mini Progress Bar ==========

function MiniProgress({ value, label }: { value: number; label: string }) {
  const capped = Math.min(value, 100);
  const color = value >= 70
    ? 'bg-pkt-brand-dark-green-1000'
    : value >= 40
      ? 'bg-pkt-brand-yellow-1000'
      : 'bg-pkt-brand-red-1000';

  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <div className="flex-1 h-1 rounded-full bg-pkt-grays-gray-200 overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span className={clsx('text-bento-micro font-medium tabular-nums', getGradColor(value))}>
        {label}
      </span>
    </div>
  );
}

// ========== Varsling Section ==========

function VarslingSection({ state }: { state: SakState }) {
  const g = state.grunnlag;
  const v = state.vederlag;
  const f = state.frist;

  // Build notification points
  const points: { label: string; ref: string; status: 'ok' | 'mangler' | 'innsigelse' | 'na' }[] = [];

  // §32.2 / §25.1 Grunnlag varslet
  if (g.status !== 'utkast' && g.status !== 'ikke_relevant') {
    const hasInnsigelse = g.grunnlag_varslet_i_tide === false;
    points.push({
      label: 'Grunnlag',
      ref: '§32.2',
      status: hasInnsigelse ? 'innsigelse' : g.grunnlag_varsel?.dato_sendt ? 'ok' : 'mangler',
    });
  } else {
    points.push({ label: 'Grunnlag', ref: '§32.2', status: 'na' });
  }

  // §33.4 Frist varsel
  if (g.status !== 'utkast' && g.status !== 'ikke_relevant') {
    points.push({
      label: 'Frist varsel',
      ref: '§33.4',
      status: f.frist_varsel_ok === false ? 'innsigelse' : f.frist_varsel?.dato_sendt ? 'ok' : 'mangler',
    });
  } else {
    points.push({ label: 'Frist varsel', ref: '§33.4', status: 'na' });
  }

  // §33.6.1 Frist krav
  if (g.status !== 'utkast' && g.status !== 'ikke_relevant') {
    points.push({
      label: 'Frist krav',
      ref: '§33.6',
      status: f.spesifisert_krav_ok === false ? 'innsigelse' : f.spesifisert_varsel?.dato_sendt ? 'ok' : 'mangler',
    });
  } else {
    points.push({ label: 'Frist krav', ref: '§33.6', status: 'na' });
  }

  // §34.1.2 Hovedkrav
  const isEndring = g.hovedkategori === 'ENDRING';
  if (!isEndring && g.status !== 'utkast' && g.status !== 'ikke_relevant') {
    points.push({
      label: 'Hovedkrav',
      ref: '§34.1.2',
      status: v.status !== 'utkast' && v.status !== 'ikke_relevant' ? 'ok' : 'mangler',
    });
  } else {
    points.push({ label: 'Hovedkrav', ref: '§34.1.2', status: 'na' });
  }

  return (
    <div className="px-4 py-3">
      <div className="text-bento-micro uppercase tracking-wider font-medium text-pkt-text-body-subtle mb-2">
        Varsling
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {points.map((p) => (
          <div key={p.ref} className="flex items-center gap-1.5">
            {p.status === 'ok' && <CheckCircledIcon className="w-3 h-3 text-pkt-brand-dark-green-1000 shrink-0" />}
            {p.status === 'mangler' && <ExclamationTriangleIcon className="w-3 h-3 text-pkt-brand-yellow-1000 shrink-0" />}
            {p.status === 'innsigelse' && <CrossCircledIcon className="w-3 h-3 text-pkt-brand-red-1000 shrink-0" />}
            {p.status === 'na' && <MinusCircledIcon className="w-3 h-3 text-pkt-grays-gray-400 shrink-0" />}
            <span className={clsx(
              'text-bento-micro truncate',
              p.status === 'na' ? 'text-pkt-grays-gray-400' : 'text-pkt-text-body-default',
            )}>
              {p.ref}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== Activity Section ==========

function ActivitySection({
  grunnlagEntries,
  vederlagEntries,
  fristEntries,
}: {
  grunnlagEntries: SporHistoryEntry[];
  vederlagEntries: SporHistoryEntry[];
  fristEntries: SporHistoryEntry[];
}) {
  const combined = useMemo(() => {
    const all = [
      ...grunnlagEntries.map(e => ({ ...e, spor: 'grunnlag' as const })),
      ...vederlagEntries.map(e => ({ ...e, spor: 'vederlag' as const })),
      ...fristEntries.map(e => ({ ...e, spor: 'frist' as const })),
    ];
    return all
      .sort((a, b) => (b.tidsstempel || '').localeCompare(a.tidsstempel || ''))
      .slice(0, 5);
  }, [grunnlagEntries, vederlagEntries, fristEntries]);

  const SPOR_DOT: Record<string, string> = {
    grunnlag: 'bg-pkt-brand-dark-blue-1000',
    vederlag: 'bg-pkt-brand-warm-blue-1000',
    frist: 'bg-pkt-brand-yellow-1000',
  };

  if (combined.length === 0) {
    return (
      <div className="px-4 py-3">
        <div className="text-bento-micro uppercase tracking-wider font-medium text-pkt-text-body-subtle mb-2">
          Aktivitet
        </div>
        <div className="text-bento-micro text-pkt-grays-gray-400">Ingen hendelser ennå</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="text-bento-micro uppercase tracking-wider font-medium text-pkt-text-body-subtle mb-2">
        Aktivitet
      </div>
      <div className="flex flex-col gap-1">
        {combined.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={clsx('w-1.5 h-1.5 rounded-full shrink-0', SPOR_DOT[entry.spor])} />
            <span className="text-bento-micro text-pkt-text-body-default truncate flex-1">
              {entry.sammendrag}
            </span>
            {entry.aktorRolle && (
              <span className={clsx(
                'text-bento-micro font-bold shrink-0',
                entry.aktorRolle === 'TE' ? 'text-role-te-text' : 'text-role-bh-text',
              )}>
                {entry.aktorRolle}
              </span>
            )}
            {entry.tidsstempel && (
              <span className="text-bento-micro text-pkt-grays-gray-400 font-mono shrink-0">
                {formatDateCompact(entry.tidsstempel)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== Middle Panel ==========

interface MiddlePanelProps {
  state: SakState;
  userRole: 'TE' | 'BH';
  activeTrack: ActiveTrack;
  onTrackSelect: (track: ActiveTrack) => void;
  actions: AvailableActions;
  krevdBelop?: number;
  godkjentBelop?: number;
  vederlagGrad?: number;
  fristGrad?: number;
}

function MiddlePanel({ state, userRole, activeTrack, onTrackSelect, actions, krevdBelop, godkjentBelop, vederlagGrad, fristGrad }: MiddlePanelProps) {
  return (
    <div className="flex-1 min-w-0 bg-pkt-bg-card overflow-y-auto scrollbar-auto flex flex-col">
      <div className="flex-1">
        {activeTrack === null && <OverviewPanel state={state} userRole={userRole} onTrackSelect={onTrackSelect} krevdBelop={krevdBelop} />}
        {activeTrack === 'grunnlag' && <GrunnlagDetail state={state} userRole={userRole} />}
        {activeTrack === 'vederlag' && (
          <VederlagDetail state={state} userRole={userRole} krevdBelop={krevdBelop} godkjentBelop={godkjentBelop} vederlagGrad={vederlagGrad} />
        )}
        {activeTrack === 'frist' && (
          <FristDetail state={state} userRole={userRole} fristGrad={fristGrad} />
        )}
      </div>

      {/* Action footer — sticky at bottom when a track is selected */}
      {activeTrack && (
        <ActionFooter state={state} userRole={userRole} actions={actions} activeTrack={activeTrack} />
      )}
    </div>
  );
}

// ========== Overview Panel (no track selected) ==========

function OverviewPanel({ state, userRole, onTrackSelect, krevdBelop }: { state: SakState; userRole: 'TE' | 'BH'; onTrackSelect: (track: ActiveTrack) => void; krevdBelop?: number }) {
  const g = state.grunnlag;
  const nh = state.neste_handling;

  return (
    <div className="p-5">
      {/* Case identity */}
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-pkt-text-body-dark leading-tight mb-1">
          {state.sakstittel}
        </h2>
        <div className="flex items-center gap-2 text-bento-caption text-pkt-text-body-subtle">
          <span className="font-mono">{state.sak_id}</span>
          {state.opprettet && (
            <>
              <span>&middot;</span>
              <span>Opprettet {formatDateShort(state.opprettet)}</span>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="space-y-3">
        {/* Neste handling */}
        {nh.handling && (
          <div className="rounded-sm border border-pkt-border-subtle p-3">
            <div className="text-bento-micro uppercase tracking-wider font-medium text-pkt-text-body-subtle mb-1.5">
              Neste handling
            </div>
            <div className="flex items-center gap-2">
              {nh.rolle && (
                <span className={clsx(
                  'px-1.5 py-0.5 rounded-sm text-bento-micro font-bold',
                  nh.rolle === 'TE' ? 'bg-role-te-pill-bg text-role-te-text' : 'bg-role-bh-pill-bg text-role-bh-text',
                )}>
                  {nh.rolle}
                </span>
              )}
              <span className="text-bento-body font-medium text-pkt-text-body-default">
                {nh.handling}
              </span>
            </div>
          </div>
        )}

        {/* Three-track summary grid — clickable to navigate */}
        <div className="grid grid-cols-3 gap-3">
          <TrackSummaryCard
            label="Grunnlag"
            hjemmel="§25.2"
            status={g.status}
            accentColor="border-l-pkt-brand-dark-blue-1000"
            onClick={() => onTrackSelect('grunnlag')}
          >
            {g.bh_resultat
              ? <span className="text-bento-body font-medium">{getSporStatusStyle(g.status).label}</span>
              : <span className="text-bento-caption text-pkt-text-body-subtle">{g.hovedkategori ? getHovedkategoriLabel(g.hovedkategori) : 'Ikke sendt'}</span>
            }
          </TrackSummaryCard>

          <TrackSummaryCard
            label="Vederlag"
            hjemmel="§34"
            status={state.vederlag.status}
            accentColor="border-l-pkt-brand-warm-blue-1000"
            onClick={() => onTrackSelect('vederlag')}
          >
            {krevdBelop != null
              ? <span className="text-bento-body font-medium font-mono">{formatCurrencyCompact(krevdBelop)}</span>
              : <span className="text-bento-caption text-pkt-text-body-subtle">Ikke sendt</span>
            }
          </TrackSummaryCard>

          <TrackSummaryCard
            label="Frist"
            hjemmel="§33"
            status={state.frist.status}
            accentColor="border-l-pkt-brand-yellow-1000"
            onClick={() => onTrackSelect('frist')}
          >
            {state.frist.krevd_dager != null
              ? <span className="text-bento-body font-medium font-mono">{state.frist.krevd_dager}d</span>
              : <span className="text-bento-caption text-pkt-text-body-subtle">Ikke sendt</span>
            }
          </TrackSummaryCard>
        </div>

        {/* Description */}
        {g.beskrivelse && (
          <div className="rounded-sm border border-pkt-border-subtle p-3">
            <div className="text-bento-micro uppercase tracking-wider font-medium text-pkt-text-body-subtle mb-1.5">
              Beskrivelse
            </div>
            <p className="text-bento-caption text-pkt-text-body-default leading-relaxed line-clamp-6">
              {g.beskrivelse}
            </p>
          </div>
        )}

        {/* Aggregates */}
        {(state.sum_krevd > 0 || state.sum_godkjent > 0) && (
          <div className="rounded-sm border border-pkt-border-subtle p-3">
            <div className="text-bento-micro uppercase tracking-wider font-medium text-pkt-text-body-subtle mb-2">
              Totalt
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-bento-micro text-pkt-text-body-subtle">Krevd</div>
                <div className="text-bento-kpi font-semibold font-mono text-bento-krevd">
                  {formatCurrencyCompact(state.sum_krevd)}
                </div>
              </div>
              <div>
                <div className="text-bento-micro text-pkt-text-body-subtle">Godkjent</div>
                <div className="text-bento-kpi font-semibold font-mono text-pkt-brand-dark-green-1000">
                  {formatCurrencyCompact(state.sum_godkjent)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========== Track Summary Card (for overview) ==========

function TrackSummaryCard({
  label,
  hjemmel,
  status,
  accentColor,
  onClick,
  children,
}: {
  label: string;
  hjemmel: string;
  status: string;
  accentColor: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const dotClass = getStatusDotClass(status as any);
  const isOpen = status === 'utkast' || status === 'ikke_relevant';

  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-sm border border-pkt-border-subtle border-l-[3px] p-2.5 text-left transition-colors w-full',
        'hover:bg-pkt-bg-subtle/50',
        accentColor,
      )}
    >
      <div className="flex items-center gap-1 mb-1">
        <div className={clsx('w-1.5 h-1.5 rounded-full shrink-0', isOpen ? 'border border-pkt-grays-gray-400' : dotClass)} />
        <span className="text-bento-micro uppercase tracking-wider font-medium text-pkt-text-body-subtle">
          {label}
        </span>
        <span className="text-bento-micro text-pkt-grays-gray-400 font-mono">{hjemmel}</span>
      </div>
      {children}
    </button>
  );
}

// ========== Grunnlag Detail ==========

function GrunnlagDetail({ state, userRole }: { state: SakState; userRole: 'TE' | 'BH' }) {
  const g = state.grunnlag;

  return (
    <div className="p-5">
      <DetailHeader
        label="Ansvarsgrunnlag"
        hjemmel="§25.2"
        status={g.status}
        accentColor="bg-pkt-brand-dark-blue-1000"
      />

      <div className="space-y-4 mt-4">
        {/* Category */}
        {g.hovedkategori && (
          <DetailSection title="Kategori">
            <div className="text-bento-body font-medium text-pkt-text-body-default">
              {getHovedkategoriLabel(g.hovedkategori)}
            </div>
            {g.underkategori && (
              <div className="text-bento-caption text-pkt-text-body-subtle">
                {getUnderkategoriLabel(g.underkategori)}
              </div>
            )}
          </DetailSection>
        )}

        {/* Title */}
        {g.tittel && (
          <DetailSection title="Tittel">
            <div className="text-bento-body text-pkt-text-body-default">{g.tittel}</div>
          </DetailSection>
        )}

        {/* Description */}
        {g.beskrivelse && (
          <DetailSection title="Beskrivelse">
            <p className="text-bento-caption text-pkt-text-body-default leading-relaxed">
              {g.beskrivelse}
            </p>
          </DetailSection>
        )}

        {/* Key dates */}
        <DetailSection title="Datoer">
          <KeyValueRow label="Oppdaget" value={formatDateShort(g.dato_oppdaget)} />
          <KeyValueRow label="Varslet" value={formatDateShort(g.grunnlag_varsel?.dato_sendt)} />
          <KeyValueRow label="Siste oppdatering" value={formatDateShort(g.siste_oppdatert)} />
        </DetailSection>

        {/* BH Response */}
        {g.bh_resultat && (
          <DetailSection title="Byggherrens vurdering">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={g.bh_resultat === 'godkjent' ? 'success' : g.bh_resultat === 'avslatt' ? 'danger' : 'warning'} size="sm">
                {g.bh_resultat === 'godkjent' ? 'Godkjent' : g.bh_resultat === 'avslatt' ? 'Avslått' : 'Frafalt'}
              </Badge>
              {g.grunnlag_varslet_i_tide === false && (
                <Badge variant="danger" size="sm">Innsigelse §32.2</Badge>
              )}
            </div>
            {g.bh_begrunnelse && (
              <p className="text-bento-caption text-pkt-text-body-default leading-relaxed italic mt-1">
                &laquo;{g.bh_begrunnelse}&raquo;
              </p>
            )}
          </DetailSection>
        )}

        {/* TE acceptance */}
        {g.te_akseptert && (
          <div className="flex items-center gap-1.5 rounded-sm bg-pkt-surface-faded-green px-3 py-2">
            <CheckCircledIcon className="w-3.5 h-3.5 text-pkt-brand-dark-green-1000" />
            <span className="text-bento-caption font-medium text-pkt-brand-dark-green-1000">
              Partene er enige
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ========== Vederlag Detail ==========

function VederlagDetail({
  state,
  userRole,
  krevdBelop,
  godkjentBelop,
  vederlagGrad,
}: {
  state: SakState;
  userRole: 'TE' | 'BH';
  krevdBelop?: number;
  godkjentBelop?: number;
  vederlagGrad?: number;
}) {
  const v = state.vederlag;

  return (
    <div className="p-5">
      <DetailHeader
        label="Vederlag"
        hjemmel="§34"
        status={v.status}
        accentColor="bg-pkt-brand-warm-blue-1000"
        isSubsidiary={state.er_subsidiaert_vederlag}
      />

      <div className="space-y-4 mt-4">
        {/* KPI */}
        {krevdBelop != null && (
          <div className="rounded-sm bg-pkt-bg-subtle p-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-bento-micro text-pkt-text-body-subtle">Krevd</div>
                <div className="text-bento-kpi font-semibold font-mono text-bento-krevd">
                  {formatCurrencyCompact(krevdBelop)}
                </div>
              </div>
              {godkjentBelop != null && (
                <div>
                  <div className="text-bento-micro text-pkt-text-body-subtle">Godkjent</div>
                  <div className="text-bento-kpi font-semibold font-mono text-pkt-brand-dark-green-1000">
                    {formatCurrencyCompact(godkjentBelop)}
                  </div>
                </div>
              )}
              {vederlagGrad != null && (
                <div>
                  <div className="text-bento-micro text-pkt-text-body-subtle">Grad</div>
                  <div className={clsx('text-bento-kpi font-semibold font-mono', getGradColor(vederlagGrad))}>
                    {vederlagGrad}%
                  </div>
                </div>
              )}
            </div>
            {vederlagGrad != null && (
              <div className="mt-2 h-1.5 rounded-full bg-pkt-grays-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-pkt-brand-dark-green-1000 transition-all duration-500"
                  style={{ width: `${Math.min(vederlagGrad, 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Method & amounts */}
        <DetailSection title="Krav">
          <KeyValueRow label="Metode" value={getVederlagsmetodeShortLabel(v.metode) || '-'} />
          {v.belop_direkte != null && (
            <KeyValueRow label="Beløp direkte" value={formatCurrencyCompact(v.belop_direkte)} mono />
          )}
          {v.kostnads_overslag != null && (
            <KeyValueRow label="Kostnadsoverslag" value={formatCurrencyCompact(v.kostnads_overslag)} mono />
          )}
          {v.fradrag_belop != null && v.fradrag_belop > 0 && (
            <KeyValueRow label="Fradrag §34.4" value={`-${formatCurrencyCompact(v.fradrag_belop)}`} mono />
          )}
          {v.er_estimat && (
            <KeyValueRow label="Estimat" value="Ja" />
          )}
          {v.krever_justert_ep && (
            <KeyValueRow label="Justerte EP" value="Ja (§34.3.3)" />
          )}
        </DetailSection>

        {/* Særskilte krav */}
        {v.saerskilt_krav && (v.saerskilt_krav.rigg_drift?.belop || v.saerskilt_krav.produktivitet?.belop) && (
          <DetailSection title="Særskilte krav §34.1.3">
            {v.saerskilt_krav.rigg_drift?.belop != null && v.saerskilt_krav.rigg_drift.belop > 0 && (
              <KeyValueRow label="Rigg/drift" value={formatCurrencyCompact(v.saerskilt_krav.rigg_drift.belop)} mono />
            )}
            {v.saerskilt_krav.produktivitet?.belop != null && v.saerskilt_krav.produktivitet.belop > 0 && (
              <KeyValueRow label="Produktivitet" value={formatCurrencyCompact(v.saerskilt_krav.produktivitet.belop)} mono />
            )}
          </DetailSection>
        )}

        {/* BH Response */}
        {v.bh_resultat && (
          <DetailSection title="Byggherrens vurdering">
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant={v.bh_resultat === 'godkjent' ? 'success' : v.bh_resultat === 'avslatt' ? 'danger' : 'warning'}
                size="sm"
              >
                {v.bh_resultat === 'godkjent' ? 'Godkjent' :
                 v.bh_resultat === 'delvis_godkjent' ? 'Delvis godkjent' :
                 v.bh_resultat === 'avslatt' ? 'Avslått' : v.bh_resultat}
              </Badge>
              {v.bh_metode && (
                <span className="text-bento-micro text-pkt-text-body-subtle">
                  {getVederlagsmetodeShortLabel(v.bh_metode)}
                </span>
              )}
            </div>
            {godkjentBelop != null && (
              <KeyValueRow label="Godkjent beløp" value={formatCurrencyCompact(godkjentBelop)} mono />
            )}
          </DetailSection>
        )}

        {/* Subsidiary */}
        {v.har_subsidiaert_standpunkt && v.subsidiaer_resultat && (
          <DetailSection title="Subsidiært standpunkt">
            <Badge variant="warning" size="sm">
              {v.subsidiaer_resultat === 'godkjent' ? 'Godkjent' :
               v.subsidiaer_resultat === 'delvis_godkjent' ? 'Delvis godkjent' : 'Avslått'}
            </Badge>
            {v.subsidiaer_godkjent_belop != null && (
              <KeyValueRow label="Subsidiært beløp" value={formatCurrencyCompact(v.subsidiaer_godkjent_belop)} mono />
            )}
          </DetailSection>
        )}

        {/* TE acceptance */}
        {v.te_akseptert && (
          <div className="flex items-center gap-1.5 rounded-sm bg-pkt-surface-faded-green px-3 py-2">
            <CheckCircledIcon className="w-3.5 h-3.5 text-pkt-brand-dark-green-1000" />
            <span className="text-bento-caption font-medium text-pkt-brand-dark-green-1000">
              Partene er enige
            </span>
          </div>
        )}

        {/* Dates */}
        <DetailSection title="Tidspunkter">
          <KeyValueRow label="Siste oppdatering" value={formatDateShort(v.siste_oppdatert)} />
          <KeyValueRow label="Versjoner" value={`${v.antall_versjoner}`} />
        </DetailSection>
      </div>
    </div>
  );
}

// ========== Frist Detail ==========

function FristDetail({
  state,
  userRole,
  fristGrad,
}: {
  state: SakState;
  userRole: 'TE' | 'BH';
  fristGrad?: number;
}) {
  const f = state.frist;

  return (
    <div className="p-5">
      <DetailHeader
        label="Fristforlengelse"
        hjemmel="§33"
        status={f.status}
        accentColor="bg-pkt-brand-yellow-1000"
        isSubsidiary={state.er_subsidiaert_frist}
      />

      <div className="space-y-4 mt-4">
        {/* KPI */}
        {f.krevd_dager != null && (
          <div className="rounded-sm bg-pkt-bg-subtle p-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-bento-micro text-pkt-text-body-subtle">Krevd</div>
                <div className="text-bento-kpi font-semibold font-mono text-bento-krevd">
                  {f.krevd_dager}d
                </div>
              </div>
              {f.godkjent_dager != null && (
                <div>
                  <div className="text-bento-micro text-pkt-text-body-subtle">Godkjent</div>
                  <div className="text-bento-kpi font-semibold font-mono text-pkt-brand-dark-green-1000">
                    {f.godkjent_dager}d
                  </div>
                </div>
              )}
              {fristGrad != null && (
                <div>
                  <div className="text-bento-micro text-pkt-text-body-subtle">Grad</div>
                  <div className={clsx('text-bento-kpi font-semibold font-mono', getGradColor(fristGrad))}>
                    {fristGrad}%
                  </div>
                </div>
              )}
            </div>
            {fristGrad != null && (
              <div className="mt-2 h-1.5 rounded-full bg-pkt-grays-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-pkt-brand-dark-green-1000 transition-all duration-500"
                  style={{ width: `${Math.min(fristGrad, 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Krav details */}
        <DetailSection title="Krav">
          {f.krevd_dager != null && (
            <KeyValueRow label="Krevd dager" value={`${f.krevd_dager} kalenderdager`} />
          )}
          {f.varsel_type && (
            <KeyValueRow label="Type" value={f.varsel_type === 'varsel' ? 'Foreløpig varsel' : f.varsel_type === 'spesifisert' ? 'Spesifisert krav' : 'Begrunnelse utsatt'} />
          )}
          {f.ny_sluttdato && (
            <KeyValueRow label="Ny sluttdato" value={formatDateShort(f.ny_sluttdato)} />
          )}
        </DetailSection>

        {/* Varseldatoer */}
        <DetailSection title="Varseldatoer">
          <KeyValueRow label="Varsel §33.4" value={formatDateShort(f.frist_varsel?.dato_sendt)} />
          <KeyValueRow label="Krav §33.6.1" value={formatDateShort(f.spesifisert_varsel?.dato_sendt)} />
        </DetailSection>

        {/* BH Response */}
        {f.bh_resultat && (
          <DetailSection title="Byggherrens vurdering">
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant={f.bh_resultat === 'godkjent' ? 'success' : f.bh_resultat === 'avslatt' ? 'danger' : 'warning'}
                size="sm"
              >
                {f.bh_resultat === 'godkjent' ? 'Godkjent' :
                 f.bh_resultat === 'delvis_godkjent' ? 'Delvis godkjent' : 'Avslått'}
              </Badge>
            </div>
            {f.godkjent_dager != null && (
              <KeyValueRow label="Godkjent dager" value={`${f.godkjent_dager} kalenderdager`} />
            )}

            {/* Preclusion flags */}
            {f.frist_varsel_ok === false && (
              <div className="flex items-center gap-1.5 mt-1">
                <CrossCircledIcon className="w-3 h-3 text-pkt-brand-red-1000" />
                <span className="text-bento-micro text-pkt-brand-red-1000">Preklusjon §33.4</span>
              </div>
            )}
            {f.spesifisert_krav_ok === false && (
              <div className="flex items-center gap-1.5 mt-1">
                <CrossCircledIcon className="w-3 h-3 text-pkt-brand-red-1000" />
                <span className="text-bento-micro text-pkt-brand-red-1000">Preklusjon §33.6.1</span>
              </div>
            )}
            {f.vilkar_oppfylt === false && (
              <div className="flex items-center gap-1.5 mt-1">
                <CrossCircledIcon className="w-3 h-3 text-pkt-brand-red-1000" />
                <span className="text-bento-micro text-pkt-brand-red-1000">Vilkår ikke oppfylt §33.1</span>
              </div>
            )}
          </DetailSection>
        )}

        {/* Subsidiary */}
        {f.har_subsidiaert_standpunkt && f.subsidiaer_resultat && (
          <DetailSection title="Subsidiært standpunkt">
            <Badge variant="warning" size="sm">
              {f.subsidiaer_resultat === 'godkjent' ? 'Godkjent' :
               f.subsidiaer_resultat === 'delvis_godkjent' ? 'Delvis godkjent' : 'Avslått'}
            </Badge>
            {f.subsidiaer_godkjent_dager != null && (
              <KeyValueRow label="Subsidiært dager" value={`${f.subsidiaer_godkjent_dager} kalenderdager`} />
            )}
          </DetailSection>
        )}

        {/* Forespørsel */}
        {f.har_bh_foresporsel && (
          <DetailSection title="Forespørsel §33.6.2">
            <KeyValueRow label="Sendt" value={formatDateShort(f.dato_bh_foresporsel)} />
            {f.frist_for_spesifisering && (
              <KeyValueRow label="Frist for svar" value={formatDateShort(f.frist_for_spesifisering)} />
            )}
            {f.foresporsel_svar_ok === false && (
              <div className="flex items-center gap-1.5 mt-1">
                <CrossCircledIcon className="w-3 h-3 text-pkt-brand-red-1000" />
                <span className="text-bento-micro text-pkt-brand-red-1000">Svar for sent</span>
              </div>
            )}
          </DetailSection>
        )}

        {/* TE acceptance */}
        {f.te_akseptert && (
          <div className="flex items-center gap-1.5 rounded-sm bg-pkt-surface-faded-green px-3 py-2">
            <CheckCircledIcon className="w-3.5 h-3.5 text-pkt-brand-dark-green-1000" />
            <span className="text-bento-caption font-medium text-pkt-brand-dark-green-1000">
              Partene er enige
            </span>
          </div>
        )}

        {/* Dates */}
        <DetailSection title="Tidspunkter">
          <KeyValueRow label="Siste oppdatering" value={formatDateShort(f.siste_oppdatert)} />
          <KeyValueRow label="Versjoner" value={`${f.antall_versjoner}`} />
        </DetailSection>
      </div>
    </div>
  );
}

// ========== Right Panel ==========

interface RightPanelProps {
  state: SakState;
  activeTrack: ActiveTrack;
  rightTab: RightTab;
  onTabChange: (tab: RightTab) => void;
  entries: SporHistoryEntry[];
  userRole: 'TE' | 'BH';
}

function RightPanel({ state, activeTrack, rightTab, onTabChange, entries, userRole }: RightPanelProps) {
  const trackLabel = activeTrack === 'grunnlag' ? 'Grunnlag'
    : activeTrack === 'vederlag' ? 'Vederlag'
    : activeTrack === 'frist' ? 'Frist'
    : 'Alle spor';

  // Count entries for the badge
  const entryCount = entries.length;

  return (
    <div className="w-[380px] shrink-0 bg-pkt-bg-card flex flex-col min-h-0">
      {/* Tab strip */}
      <div className="h-10 border-b border-pkt-border-subtle flex items-end px-4 gap-0 shrink-0">
        <TabButton
          label="Begrunnelse"
          icon={<Pencil1Icon className="w-3 h-3" />}
          isActive={rightTab === 'begrunnelse'}
          onClick={() => onTabChange('begrunnelse')}
        />
        <TabButton
          label="Historikk"
          icon={<CounterClockwiseClockIcon className="w-3 h-3" />}
          isActive={rightTab === 'historikk'}
          onClick={() => onTabChange('historikk')}
          count={entryCount > 0 ? entryCount : undefined}
        />
        <TabButton
          label="Filer"
          icon={<FileTextIcon className="w-3 h-3" />}
          isActive={rightTab === 'filer'}
          onClick={() => onTabChange('filer')}
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto scrollbar-auto">
        {rightTab === 'begrunnelse' && (
          <BegrunnelseTab
            activeTrack={activeTrack}
            state={state}
            userRole={userRole}
          />
        )}
        {rightTab === 'historikk' && (
          <HistorikkTab
            entries={entries}
            trackLabel={trackLabel}
          />
        )}
        {rightTab === 'filer' && (
          <FilerTab activeTrack={activeTrack} />
        )}
      </div>
    </div>
  );
}

// ========== Tab Button ==========

function TabButton({ label, icon, isActive, onClick, count }: {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1 px-3 pb-2 pt-1 text-bento-caption font-medium transition-colors relative',
        isActive
          ? 'text-pkt-text-body-default'
          : 'text-pkt-text-body-subtle hover:text-pkt-text-body-default',
      )}
    >
      {icon}
      {label}
      {count != null && (
        <span className="ml-0.5 text-bento-micro font-mono text-pkt-grays-gray-400">
          {count}
        </span>
      )}
      {isActive && (
        <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-pkt-brand-dark-blue-1000 rounded-t-full" />
      )}
    </button>
  );
}

// ========== Begrunnelse Tab ==========

function BegrunnelseTab({ activeTrack, state, userRole }: {
  activeTrack: ActiveTrack;
  state: SakState;
  userRole: 'TE' | 'BH';
}) {
  if (!activeTrack) {
    return (
      <div className="p-4">
        <div className="text-bento-caption text-pkt-text-body-subtle text-center py-8">
          Velg et spor i venstepanelet for å se eller redigere begrunnelse.
        </div>
      </div>
    );
  }

  const trackLabels: Record<SporType, string> = {
    grunnlag: 'Ansvarsgrunnlag §25.2',
    vederlag: 'Vederlag §34',
    frist: 'Fristforlengelse §33',
  };

  // Extract TE and BH begrunnelse for the active track
  let teBegrunnelse: string | undefined;
  let bhBegrunnelse: string | undefined;
  let teLabel = 'TEs begrunnelse';
  let bhLabel = 'BHs vurdering';

  if (activeTrack === 'grunnlag') {
    teBegrunnelse = state.grunnlag.beskrivelse || undefined;
    bhBegrunnelse = state.grunnlag.bh_begrunnelse;
    teLabel = 'TEs grunnlag';
    bhLabel = 'BHs vurdering';
  } else if (activeTrack === 'vederlag') {
    teBegrunnelse = state.vederlag.begrunnelse;
    bhBegrunnelse = state.vederlag.bh_begrunnelse;
    teLabel = 'TEs krav';
    bhLabel = 'BHs vurdering';
  } else if (activeTrack === 'frist') {
    teBegrunnelse = state.frist.begrunnelse;
    bhBegrunnelse = state.frist.bh_begrunnelse;
    teLabel = 'TEs krav';
    bhLabel = 'BHs vurdering';
  }

  const hasBegrunnelse = teBegrunnelse || bhBegrunnelse;

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="text-bento-micro uppercase tracking-wider font-medium text-pkt-text-body-subtle">
        {trackLabels[activeTrack]}
      </div>

      {hasBegrunnelse ? (
        <>
          {/* TE begrunnelse */}
          <BegrunnelseBlock
            label={teLabel}
            role="TE"
            text={teBegrunnelse}
            isCurrentUser={userRole === 'TE'}
          />

          {/* Exchange arrow */}
          {(teBegrunnelse && bhBegrunnelse) && (
            <div className="flex items-center gap-2 px-2">
              <div className="flex-1 border-t border-dashed border-pkt-grays-gray-300" />
              <ArrowRightIcon className="w-3 h-3 text-pkt-grays-gray-400 rotate-90" />
              <div className="flex-1 border-t border-dashed border-pkt-grays-gray-300" />
            </div>
          )}

          {/* BH begrunnelse */}
          <BegrunnelseBlock
            label={bhLabel}
            role="BH"
            text={bhBegrunnelse}
            isCurrentUser={userRole === 'BH'}
          />
        </>
      ) : (
        <div className="rounded-sm border border-dashed border-pkt-grays-gray-300 p-4 flex items-center justify-center">
          <div className="text-center">
            <Pencil1Icon className="w-5 h-5 text-pkt-grays-gray-400 mx-auto mb-2" />
            <div className="text-bento-caption text-pkt-text-body-subtle">
              Ingen begrunnelse ennå
            </div>
            <div className="text-bento-micro text-pkt-grays-gray-400 mt-1">
              Begrunnelse legges til når kravet sendes
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BegrunnelseBlock({ label, role, text, isCurrentUser }: {
  label: string;
  role: 'TE' | 'BH';
  text?: string;
  isCurrentUser: boolean;
}) {
  if (!text) {
    return (
      <div className="rounded-sm border border-dashed border-pkt-grays-gray-200 px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={clsx(
            'text-bento-micro font-bold',
            role === 'TE' ? 'text-role-te-text' : 'text-role-bh-text',
          )}>
            {role}
          </span>
          <span className="text-bento-micro text-pkt-grays-gray-400">{label}</span>
        </div>
        <div className="text-bento-micro text-pkt-grays-gray-400 italic">
          Ikke avgitt ennå
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(
      'rounded-sm border px-3 py-2.5',
      isCurrentUser ? 'border-pkt-border-default bg-pkt-bg-subtle/30' : 'border-pkt-border-subtle',
    )}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={clsx(
          'text-bento-micro font-bold',
          role === 'TE' ? 'text-role-te-text' : 'text-role-bh-text',
        )}>
          {role}
        </span>
        <span className="text-bento-micro text-pkt-text-body-subtle">{label}</span>
        {isCurrentUser && (
          <span className="text-bento-micro text-pkt-grays-gray-400">(deg)</span>
        )}
      </div>
      <div className="text-bento-caption text-pkt-text-body-default leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

// ========== Historikk Tab ==========

function HistorikkTab({ entries, trackLabel }: { entries: SporHistoryEntry[]; trackLabel: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const SPOR_DOT: Record<string, string> = {
    grunnlag: 'bg-pkt-brand-dark-blue-1000',
    vederlag: 'bg-pkt-brand-warm-blue-1000',
    frist: 'bg-pkt-brand-yellow-1000',
  };

  if (entries.length === 0) {
    return (
      <div className="p-4">
        <div className="text-bento-caption text-pkt-text-body-subtle text-center py-8">
          <CounterClockwiseClockIcon className="w-5 h-5 text-pkt-grays-gray-400 mx-auto mb-2" />
          Ingen historikk for {trackLabel.toLowerCase()}.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-bento-micro uppercase tracking-wider font-medium text-pkt-text-body-subtle">
          {trackLabel}
        </div>
        <span className="text-bento-micro text-pkt-grays-gray-400 font-mono">
          {entries.length} {entries.length === 1 ? 'hendelse' : 'hendelser'}
        </span>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[5px] top-2 bottom-2 w-px bg-pkt-border-subtle" />

        <div className="flex flex-col gap-0">
          {entries.map((entry, i) => {
            const sporKey = (entry as any).spor as string | undefined;
            const entryId = entry.id || `entry-${i}`;
            const isExpanded = expandedId === entryId;
            const hasDetails = entry.begrunnelse || entry.belop != null || entry.dager != null || entry.resultat;

            return (
              <div key={entryId} className="relative">
                <button
                  onClick={() => hasDetails ? setExpandedId(isExpanded ? null : entryId) : undefined}
                  className={clsx(
                    'flex gap-3 py-2 w-full text-left transition-colors rounded-sm px-0.5',
                    hasDetails && 'hover:bg-pkt-bg-subtle/50 cursor-pointer',
                    !hasDetails && 'cursor-default',
                    isExpanded && 'bg-pkt-bg-subtle/30',
                  )}
                >
                  {/* Dot on the line */}
                  <div className={clsx(
                    'w-[11px] h-[11px] rounded-full border-2 border-pkt-bg-card shrink-0 mt-0.5 z-10',
                    sporKey ? SPOR_DOT[sporKey] || 'bg-pkt-grays-gray-400' : 'bg-pkt-grays-gray-400',
                  )} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-bento-caption font-medium text-pkt-text-body-default truncate flex-1">
                        {entry.sammendrag}
                      </span>
                      {entry.aktorRolle && (
                        <span className={clsx(
                          'text-bento-micro font-bold shrink-0',
                          entry.aktorRolle === 'TE' ? 'text-role-te-text' : 'text-role-bh-text',
                        )}>
                          {entry.aktorRolle}
                        </span>
                      )}
                      {hasDetails && (
                        isExpanded
                          ? <ChevronUpIcon className="w-3 h-3 text-pkt-grays-gray-400 shrink-0" />
                          : <ChevronDownIcon className="w-3 h-3 text-pkt-grays-gray-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.tidsstempel && (
                        <span className="text-bento-micro text-pkt-grays-gray-400 font-mono">
                          {formatDateShort(entry.tidsstempel)}
                        </span>
                      )}
                      {entry.versjon > 0 && (
                        <span className="text-bento-micro text-pkt-grays-gray-400">
                          v{entry.versjon}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expandable detail area */}
                {isExpanded && hasDetails && (
                  <div className="ml-[23px] pl-3 pb-2 border-l border-dashed border-pkt-grays-gray-300">
                    <div className="rounded-sm bg-pkt-bg-subtle p-2.5 space-y-1.5">
                      {/* Resultat badge */}
                      {entry.resultat && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-bento-micro text-pkt-text-body-subtle">Resultat:</span>
                          <Badge
                            variant={entry.resultat === 'godkjent' ? 'success' : entry.resultat === 'avslatt' ? 'danger' : 'warning'}
                            size="sm"
                          >
                            {entry.resultat === 'godkjent' ? 'Godkjent'
                              : entry.resultat === 'avslatt' ? 'Avslått'
                              : entry.resultat === 'delvis_godkjent' ? 'Delvis godkjent'
                              : entry.resultat}
                          </Badge>
                        </div>
                      )}

                      {/* Amount */}
                      {entry.belop != null && (
                        <div className="flex items-baseline justify-between">
                          <span className="text-bento-micro text-pkt-text-body-subtle">Beløp:</span>
                          <span className="text-bento-caption font-mono font-medium text-pkt-text-body-default">
                            {formatCurrencyCompact(entry.belop)}
                          </span>
                        </div>
                      )}

                      {/* Days */}
                      {entry.dager != null && (
                        <div className="flex items-baseline justify-between">
                          <span className="text-bento-micro text-pkt-text-body-subtle">Dager:</span>
                          <span className="text-bento-caption font-mono font-medium text-pkt-text-body-default">
                            {entry.dager} kalenderdager
                          </span>
                        </div>
                      )}

                      {/* Begrunnelse */}
                      {entry.begrunnelse && (
                        <div>
                          <span className="text-bento-micro text-pkt-text-body-subtle block mb-0.5">Begrunnelse:</span>
                          <p className="text-bento-caption text-pkt-text-body-default leading-relaxed whitespace-pre-wrap line-clamp-4">
                            {entry.begrunnelse}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ========== Filer Tab ==========

function FilerTab({ activeTrack }: { activeTrack: ActiveTrack }) {
  const trackLabel = activeTrack
    ? { grunnlag: 'grunnlag', vederlag: 'vederlag', frist: 'frist' }[activeTrack]
    : 'saken';

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="text-bento-micro uppercase tracking-wider font-medium text-pkt-text-body-subtle">
        Dokumenter
      </div>

      {/* Upload area */}
      <div className="rounded-sm border-2 border-dashed border-pkt-grays-gray-300 p-5 text-center hover:border-pkt-brand-warm-blue-1000 hover:bg-pkt-bg-subtle/30 transition-colors cursor-pointer group">
        <UploadIcon className="w-5 h-5 text-pkt-grays-gray-400 group-hover:text-pkt-brand-warm-blue-1000 mx-auto mb-2 transition-colors" />
        <div className="text-bento-caption text-pkt-text-body-subtle group-hover:text-pkt-text-body-default transition-colors">
          Dra og slipp filer hit
        </div>
        <div className="text-bento-micro text-pkt-grays-gray-400 mt-1">
          eller klikk for å velge fra disk
        </div>
        <div className="text-bento-micro text-pkt-grays-gray-400 mt-2">
          PDF, DOCX, XLSX, bilder (maks 25 MB)
        </div>
      </div>

      {/* Empty state */}
      <div className="rounded-sm border border-pkt-border-subtle p-3">
        <div className="flex items-center gap-2 text-bento-caption text-pkt-text-body-subtle">
          <FileTextIcon className="w-3.5 h-3.5 text-pkt-grays-gray-400 shrink-0" />
          <span>Ingen vedlegg knyttet til {trackLabel}</span>
        </div>
      </div>

      {/* File categories hint */}
      <div className="text-bento-micro text-pkt-grays-gray-400 leading-relaxed">
        Dokumenter lastes opp per spor og vises i kontekst av begrunnelsen de er knyttet til.
      </div>
    </div>
  );
}

// ========== Action Footer ==========

function ActionFooter({ state, userRole, actions, activeTrack }: {
  state: SakState;
  userRole: 'TE' | 'BH';
  actions: AvailableActions;
  activeTrack: SporType;
}) {
  // Determine available actions for this track
  const trackActions: { label: string; icon: React.ReactNode; variant: 'primary' | 'secondary' | 'ghost'; key: string }[] = [];

  if (activeTrack === 'grunnlag') {
    if (userRole === 'TE') {
      if (actions.canSendGrunnlag) trackActions.push({ label: 'Varsle krav', icon: <PaperPlaneIcon className="w-3.5 h-3.5" />, variant: 'primary', key: 'send' });
      if (actions.canUpdateGrunnlag) trackActions.push({ label: 'Oppdater', icon: <ReloadIcon className="w-3.5 h-3.5" />, variant: 'secondary', key: 'update' });
      if (actions.canAcceptGrunnlagResponse) trackActions.push({ label: 'Godta svaret', icon: <CheckCircledIcon className="w-3.5 h-3.5" />, variant: 'secondary', key: 'accept' });
      if (actions.canWithdrawGrunnlag) trackActions.push({ label: 'Trekk tilbake', icon: <CrossCircledIcon className="w-3.5 h-3.5" />, variant: 'ghost', key: 'withdraw' });
    } else {
      if (actions.canRespondToGrunnlag) trackActions.push({ label: 'Svar på krav', icon: <ChatBubbleIcon className="w-3.5 h-3.5" />, variant: 'primary', key: 'respond' });
      if (actions.canUpdateGrunnlagResponse) trackActions.push({ label: 'Endre svar', icon: <ReloadIcon className="w-3.5 h-3.5" />, variant: 'secondary', key: 'update-response' });
    }
  } else if (activeTrack === 'vederlag') {
    if (userRole === 'TE') {
      if (actions.canSendVederlag) trackActions.push({ label: 'Send krav', icon: <PaperPlaneIcon className="w-3.5 h-3.5" />, variant: 'primary', key: 'send' });
      if (actions.canUpdateVederlag) trackActions.push({ label: 'Revider', icon: <ReloadIcon className="w-3.5 h-3.5" />, variant: 'secondary', key: 'update' });
      if (actions.canAcceptVederlagResponse) trackActions.push({ label: 'Godta svaret', icon: <CheckCircledIcon className="w-3.5 h-3.5" />, variant: 'secondary', key: 'accept' });
      if (actions.canWithdrawVederlag) trackActions.push({ label: 'Trekk tilbake', icon: <CrossCircledIcon className="w-3.5 h-3.5" />, variant: 'ghost', key: 'withdraw' });
    } else {
      if (actions.canRespondToVederlag) trackActions.push({ label: 'Svar på krav', icon: <ChatBubbleIcon className="w-3.5 h-3.5" />, variant: 'primary', key: 'respond' });
      if (actions.canUpdateVederlagResponse) trackActions.push({ label: 'Endre svar', icon: <ReloadIcon className="w-3.5 h-3.5" />, variant: 'secondary', key: 'update-response' });
    }
  } else if (activeTrack === 'frist') {
    if (userRole === 'TE') {
      if (actions.canSendFrist) trackActions.push({ label: 'Send krav', icon: <PaperPlaneIcon className="w-3.5 h-3.5" />, variant: 'primary', key: 'send' });
      if (actions.canUpdateFrist) trackActions.push({ label: 'Revider', icon: <ReloadIcon className="w-3.5 h-3.5" />, variant: 'secondary', key: 'update' });
      if (actions.canAcceptFristResponse) trackActions.push({ label: 'Godta svaret', icon: <CheckCircledIcon className="w-3.5 h-3.5" />, variant: 'secondary', key: 'accept' });
      if (actions.canSendForsering) trackActions.push({ label: 'Forsering §33.8', icon: <ArrowRightIcon className="w-3.5 h-3.5" />, variant: 'ghost', key: 'forsering' });
      if (actions.canWithdrawFrist) trackActions.push({ label: 'Trekk tilbake', icon: <CrossCircledIcon className="w-3.5 h-3.5" />, variant: 'ghost', key: 'withdraw' });
    } else {
      if (actions.canRespondToFrist) trackActions.push({ label: 'Svar på krav', icon: <ChatBubbleIcon className="w-3.5 h-3.5" />, variant: 'primary', key: 'respond' });
      if (actions.canUpdateFristResponse) trackActions.push({ label: 'Endre svar', icon: <ReloadIcon className="w-3.5 h-3.5" />, variant: 'secondary', key: 'update-response' });
    }
  }

  if (trackActions.length === 0) return null;

  const BUTTON_STYLES = {
    primary: 'bg-pkt-brand-dark-blue-1000 text-white hover:bg-pkt-brand-warm-blue-1000 hover:text-white',
    secondary: 'border border-pkt-border-default text-pkt-text-body-default hover:bg-pkt-bg-subtle',
    ghost: 'text-pkt-text-body-subtle hover:text-pkt-text-body-default hover:bg-pkt-bg-subtle',
  };

  return (
    <div className="border-t border-pkt-border-subtle px-5 py-3 flex items-center gap-2 shrink-0 bg-pkt-bg-card">
      {trackActions.map((action) => (
        <button
          key={action.key}
          className={clsx(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-bento-caption font-medium transition-colors',
            BUTTON_STYLES[action.variant],
          )}
          title={`${action.label} (ikke tilkoblet ennå)`}
        >
          {action.icon}
          {action.label}
        </button>
      ))}

      <div className="flex-1" />

      {/* Version indicator */}
      {activeTrack === 'grunnlag' && state.grunnlag.antall_versjoner > 1 && (
        <span className="text-bento-micro text-pkt-grays-gray-400">
          Rev. {state.grunnlag.antall_versjoner - 1}
        </span>
      )}
      {activeTrack === 'vederlag' && state.vederlag.antall_versjoner > 1 && (
        <span className="text-bento-micro text-pkt-grays-gray-400">
          Rev. {state.vederlag.antall_versjoner - 1}
        </span>
      )}
      {activeTrack === 'frist' && state.frist.antall_versjoner > 1 && (
        <span className="text-bento-micro text-pkt-grays-gray-400">
          Rev. {state.frist.antall_versjoner - 1}
        </span>
      )}
    </div>
  );
}

// ========== Shared Detail Components ==========

function DetailHeader({
  label,
  hjemmel,
  status,
  accentColor,
  isSubsidiary,
}: {
  label: string;
  hjemmel: string;
  status: string;
  accentColor: string;
  isSubsidiary?: boolean;
}) {
  const statusStyle = getSporStatusStyle(status as any);

  return (
    <div className="flex items-center gap-2">
      <div className={clsx('w-2.5 h-2.5 rounded-full', accentColor)} />
      <h3 className="text-sm font-semibold text-pkt-text-body-dark uppercase tracking-wide">
        {label}
      </h3>
      <span className="text-bento-caption text-pkt-text-body-subtle font-mono">{hjemmel}</span>
      <Badge variant={statusStyle.variant as any} size="sm">{statusStyle.label}</Badge>
      {isSubsidiary && (
        <Badge variant="warning" size="sm">Subsidiært</Badge>
      )}
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-bento-micro uppercase tracking-wider font-medium text-pkt-text-body-subtle mb-1.5">
        {title}
      </div>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

function KeyValueRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-bento-caption text-pkt-text-body-subtle shrink-0">{label}</span>
      <span className={clsx('text-bento-caption text-pkt-text-body-default text-right', mono && 'font-mono')}>
        {value}
      </span>
    </div>
  );
}

// ========== Helpers ==========

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

function formatDateCompact(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Nå';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}t`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'I går';
    if (diffD < 7) return `${diffD}d`;
    return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' });
  } catch {
    return '-';
  }
}

// Default export for lazy loading
export default CasePageAccess;
