import { clsx } from 'clsx';
import { CheckIcon } from '@radix-ui/react-icons';
import type { SakState } from '../../../types/timeline';
import type { AvailableActions } from '../../../hooks/useActionPermissions';
import { formatCurrencyCompact } from '../../../utils/formatters';
import { getVederlagsmetodeShortLabel } from '../../../constants/paymentMethods';
import { getGradColor, isResolved } from './trackCardUtils';
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
          'bg-pkt-bg-card rounded-lg p-3 opacity-60',
          className,
        )}
        style={style}
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Vederlag
          </span>
          <span className="text-[10px] text-pkt-text-body-muted">&sect;34</span>
        </div>
        <p className="text-xs text-pkt-text-body-muted italic mt-2">Krever ansvarsgrunnlag</p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-pkt-bg-card rounded-lg p-3',
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
          <span className="text-[10px] text-pkt-text-body-muted">&sect;34</span>
          {isSubsidiary && (
            <span className="bg-badge-warning-bg text-badge-warning-text rounded-sm text-[10px] px-1.5 py-0.5 font-medium ml-1">
              Subsidi&aelig;rt
            </span>
          )}
        </div>
        <StatusDot status={status} />
      </div>

      {isEmpty ? (
        <p className="text-xs text-pkt-text-body-muted italic">Ingen data enn&aring;</p>
      ) : (
        <>
          {/* Key-value rows */}
          <div className="space-y-1">
            {krevdBelop != null && !hasBhResponse && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Krevd</span>
                <span className="text-xs font-mono font-medium text-pkt-text-body-default tabular-nums">
                  {formatCurrencyCompact(krevdBelop)}
                </span>
              </div>
            )}
            {v.metode && (
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
                <span className="text-xs font-mono text-pkt-text-body-default tabular-nums">
                  +{formatCurrencyCompact(v.saerskilt_krav.rigg_drift.belop)}
                </span>
              </div>
            )}
            {v.saerskilt_krav?.produktivitet?.belop != null && v.saerskilt_krav.produktivitet.belop > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Produktivitet</span>
                <span className="text-xs font-mono text-pkt-text-body-default tabular-nums">
                  +{formatCurrencyCompact(v.saerskilt_krav.produktivitet.belop)}
                </span>
              </div>
            )}
          </div>

          {/* KPI row + progress bar — when BH has responded */}
          {hasBhResponse && krevdBelop != null && godkjentBelop != null && (
            <div className="mt-2 pt-2 border-t border-pkt-border-subtle">
              <div className="flex items-end gap-4">
                <div>
                  <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">Krevd</span>
                  <p className="text-sm font-semibold font-mono tabular-nums text-pkt-brand-yellow-1000 leading-tight">
                    {formatCurrencyCompact(krevdBelop)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">
                    {isSubsidiary ? 'Subs.' : 'Godkjent'}
                  </span>
                  <p className="text-sm font-semibold font-mono tabular-nums text-pkt-brand-dark-green-1000 leading-tight">
                    {formatCurrencyCompact(godkjentBelop)}
                    {resolved && <CheckIcon className="w-3.5 h-3.5 inline ml-1 align-baseline" />}
                  </p>
                </div>
                {vederlagGrad != null && (
                  <div className="ml-auto text-right">
                    <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">Godkj.grad</span>
                    <p className={clsx('text-sm font-bold font-mono tabular-nums leading-tight', getGradColor(vederlagGrad))}>
                      {vederlagGrad}%
                    </p>
                  </div>
                )}
              </div>
              {vederlagGrad != null && (
                <div className="mt-2 h-1.5 bg-pkt-grays-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pkt-brand-dark-green-1000 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(vederlagGrad, 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

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
