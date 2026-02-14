import { clsx } from 'clsx';
import { CheckIcon } from '@radix-ui/react-icons';
import type { SakState } from '../../../types/timeline';
import type { AvailableActions } from '../../../hooks/useActionPermissions';
import { formatCurrencyCompact } from '../../../utils/formatters';
import { getVederlagsmetodeShortLabel } from '../../../constants/paymentMethods';
import { getAccentBorderClass, getGradColor, isResolved } from './trackCardUtils';
import { StatusDot } from './StatusDot';
import { TrackHistory } from './TrackHistory';
import { TrackCTA } from './TrackCTA';
import type { SporHistoryEntry } from '../../views/SporHistory';

interface VederlagCardProps {
  state: SakState;
  krevdBelop?: number;
  godkjentBelop?: number;
  vederlagGrad?: number;
  isSubsidiary?: boolean;
  isDimmed?: boolean;
  userRole: 'TE' | 'BH';
  actions: AvailableActions;
  entries: SporHistoryEntry[];
  primaryAction?: { label: string; onClick: () => void };
  secondaryActions?: { label: string; onClick: () => void; variant?: 'default' | 'danger' }[];
  className?: string;
  style?: React.CSSProperties;
}

export function VederlagCard({
  state,
  krevdBelop,
  godkjentBelop,
  vederlagGrad,
  isSubsidiary,
  isDimmed,
  userRole,
  actions,
  entries,
  primaryAction,
  secondaryActions,
  className,
  style,
}: VederlagCardProps) {
  const v = state.vederlag;
  const status = v.status;
  const hasBhResponse = !!v.bh_resultat;
  const resolved = isResolved(status) || v.te_akseptert === true;
  const isEmpty = krevdBelop == null && !v.metode;

  // Dimmed state: grunnlag not sent
  if (isDimmed) {
    return (
      <div
        className={clsx(
          'bg-pkt-bg-card rounded-lg border-t-2 p-3 opacity-60',
          'border-t-pkt-grays-gray-300',
          className,
        )}
        style={style}
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Vederlag
          </span>
          <span className="text-[10px] text-pkt-text-body-muted">§34</span>
        </div>
        <p className="text-xs text-pkt-text-body-muted italic mt-2">Krever ansvarsgrunnlag</p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-pkt-bg-card rounded-lg border-t-2 p-3',
        getAccentBorderClass(status),
        className,
      )}
      style={style}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Vederlag
          </span>
          <span className="text-[10px] text-pkt-text-body-muted">§34</span>
          {isSubsidiary && (
            <span className="bg-badge-warning-bg text-badge-warning-text rounded-sm text-[10px] px-1.5 py-0.5 font-medium ml-1">
              Subsidi&aelig;rt
            </span>
          )}
        </div>
        <StatusDot status={status} />
      </div>

      {/* Hero zone */}
      {isEmpty ? (
        <p className="text-xs text-pkt-text-body-muted italic">Ingen data enn&aring;</p>
      ) : hasBhResponse && godkjentBelop != null && !resolved ? (
        /* Stage 4: KPI row (BH has responded, not yet resolved) */
        <div>
          <div className="flex items-baseline gap-4">
            <div>
              <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">Krevd</span>
              <p className="text-sm font-semibold font-mono tabular-nums text-pkt-brand-yellow-1000">
                {formatCurrencyCompact(krevdBelop!)}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">
                {isSubsidiary ? 'Subs.' : 'Godkjent'}
              </span>
              <p className="text-sm font-semibold font-mono tabular-nums text-pkt-brand-dark-green-1000">
                {formatCurrencyCompact(godkjentBelop)}
              </p>
            </div>
            {vederlagGrad != null && (
              <div className="ml-auto text-right">
                <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">Grad</span>
                <p className={clsx('text-sm font-bold font-mono tabular-nums', getGradColor(vederlagGrad))}>
                  {vederlagGrad}%
                </p>
              </div>
            )}
          </div>
          {vederlagGrad != null && (
            <div className="mt-1.5 h-1.5 bg-pkt-grays-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-pkt-brand-dark-green-1000 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(vederlagGrad, 100)}%` }}
              />
            </div>
          )}
        </div>
      ) : resolved && godkjentBelop != null ? (
        /* Stage 5: Resolved — hero is godkjent amount in green */
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-lg font-bold font-mono tabular-nums text-pkt-brand-dark-green-1000">
              {formatCurrencyCompact(godkjentBelop)}
            </p>
            <CheckIcon className="w-4 h-4 text-pkt-brand-dark-green-1000" />
          </div>
          {v.metode && (
            <p className="text-[11px] text-pkt-text-body-subtle mt-0.5">
              {getVederlagsmetodeShortLabel(v.metode)}
            </p>
          )}
        </div>
      ) : (
        /* Stage 2/3: Hero is krevd amount in amber */
        <div>
          {krevdBelop != null && (
            <>
              <p className="text-lg font-bold font-mono tabular-nums text-pkt-brand-yellow-1000">
                {formatCurrencyCompact(krevdBelop)}
              </p>
              {v.metode && (
                <p className="text-[11px] text-pkt-text-body-subtle mt-0.5">
                  {getVederlagsmetodeShortLabel(v.metode)}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Context details below separator */}
      {(() => {
        // Resolved: show krevd + grad in context
        if (resolved && krevdBelop != null) {
          return (
            <div className="mt-2 pt-2 border-t border-pkt-border-subtle space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Krevd</span>
                <span className="text-xs font-mono text-pkt-text-body-default">
                  {formatCurrencyCompact(krevdBelop)}
                </span>
              </div>
              {vederlagGrad != null && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-pkt-text-body-subtle">Godkjenningsgrad</span>
                  <span className={clsx('text-xs font-mono font-semibold', getGradColor(vederlagGrad))}>
                    {vederlagGrad}%
                  </span>
                </div>
              )}
            </div>
          );
        }

        // Non-resolved: show method + rigg/drift + produktivitet
        const hasDetails = v.metode || v.saerskilt_krav?.rigg_drift?.belop || v.saerskilt_krav?.produktivitet?.belop;
        const showMethodInContext = hasBhResponse; // Method moves to context when KPI row is showing
        if (!hasDetails) return null;
        if (!showMethodInContext && !v.saerskilt_krav?.rigg_drift?.belop && !v.saerskilt_krav?.produktivitet?.belop) return null;

        return (
          <div className="mt-2 pt-2 border-t border-pkt-border-subtle space-y-1.5">
            {showMethodInContext && v.metode && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Metode</span>
                <span className="text-xs text-pkt-text-body-default">
                  {getVederlagsmetodeShortLabel(v.metode)}
                </span>
              </div>
            )}
            {v.saerskilt_krav?.rigg_drift?.belop != null && v.saerskilt_krav.rigg_drift.belop > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Rigg/drift</span>
                <span className="text-xs font-mono text-pkt-text-body-default">
                  +{formatCurrencyCompact(v.saerskilt_krav.rigg_drift.belop)}
                </span>
              </div>
            )}
            {v.saerskilt_krav?.produktivitet?.belop != null && v.saerskilt_krav.produktivitet.belop > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Produktivitet</span>
                <span className="text-xs font-mono text-pkt-text-body-default">
                  +{formatCurrencyCompact(v.saerskilt_krav.produktivitet.belop)}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* History */}
      <TrackHistory entries={entries} />

      {/* CTA strip */}
      <TrackCTA
        spor="vederlag"
        status={status}
        state={state}
        userRole={userRole}
        actions={actions}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />
    </div>
  );
}
