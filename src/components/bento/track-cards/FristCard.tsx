import { clsx } from 'clsx';
import { CheckIcon } from '@radix-ui/react-icons';
import type { SakState } from '../../../types/timeline';
import type { AvailableActions } from '../../../hooks/useActionPermissions';
import { formatDateShort } from '../../../utils/formatters';
import { getAccentBorderClass, getGradColor, isResolved } from './trackCardUtils';
import { StatusDot } from './StatusDot';
import { TrackHistory } from './TrackHistory';
import { TrackCTA } from './TrackCTA';
import type { SporHistoryEntry } from '../../views/SporHistory';

interface FristCardProps {
  state: SakState;
  godkjentDager?: number;
  fristGrad?: number;
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

export function FristCard({
  state,
  godkjentDager,
  fristGrad,
  isSubsidiary,
  isDimmed,
  userRole,
  actions,
  entries,
  primaryAction,
  secondaryActions,
  className,
  style,
}: FristCardProps) {
  const f = state.frist;
  const status = f.status;
  const hasBhResponse = !!f.bh_resultat;
  const resolved = isResolved(status) || f.te_akseptert === true;
  const hasDays = f.krevd_dager != null;
  const hasVarselOnly = !hasDays && f.frist_varsel?.dato_sendt;
  const isEmpty = !hasDays && !hasVarselOnly && status === 'utkast';

  // Dimmed state
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
            Fristforlengelse
          </span>
          <span className="text-[10px] text-pkt-text-body-muted">§33</span>
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
            Fristforlengelse
          </span>
          <span className="text-[10px] text-pkt-text-body-muted">§33</span>
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
      ) : hasVarselOnly && !hasDays ? (
        /* Stage 2: Varslet only, no days yet */
        <div>
          <p className="text-sm font-semibold text-pkt-text-body-dark">Varslet</p>
          <p className="text-[11px] text-pkt-text-body-subtle mt-0.5">
            {formatDateShort(f.frist_varsel!.dato_sendt)}
          </p>
        </div>
      ) : hasBhResponse && godkjentDager != null && !resolved ? (
        /* Stage 4: KPI row */
        <div>
          <div className="flex items-baseline gap-4">
            <div>
              <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">Krevd</span>
              <p className="text-sm font-semibold font-mono tabular-nums text-pkt-brand-yellow-1000">
                {f.krevd_dager}d
              </p>
            </div>
            <div>
              <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">
                {isSubsidiary ? 'Subs.' : 'Godkjent'}
              </span>
              <p className="text-sm font-semibold font-mono tabular-nums text-pkt-brand-dark-green-1000">
                {godkjentDager}d
              </p>
            </div>
            {fristGrad != null && (
              <div className="ml-auto text-right">
                <span className="text-[10px] text-pkt-text-body-subtle uppercase tracking-wide">Grad</span>
                <p className={clsx('text-sm font-bold font-mono tabular-nums', getGradColor(fristGrad))}>
                  {fristGrad}%
                </p>
              </div>
            )}
          </div>
          {fristGrad != null && (
            <div className="mt-1.5 h-1.5 bg-pkt-grays-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-pkt-brand-dark-green-1000 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(fristGrad, 100)}%` }}
              />
            </div>
          )}
        </div>
      ) : resolved && godkjentDager != null ? (
        /* Stage 5: Resolved hero */
        <div className="flex items-baseline justify-between">
          <p className="text-lg font-bold font-mono tabular-nums text-pkt-brand-dark-green-1000">
            {godkjentDager}d
          </p>
          <CheckIcon className="w-4 h-4 text-pkt-brand-dark-green-1000" />
        </div>
      ) : hasDays ? (
        /* Stage 3: Hero days in amber */
        <p className="text-lg font-bold font-mono tabular-nums text-pkt-brand-yellow-1000">
          {f.krevd_dager}d
        </p>
      ) : null}

      {/* Context details */}
      {(() => {
        if (resolved && hasDays) {
          return (
            <div className="mt-2 pt-2 border-t border-pkt-border-subtle space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Krevd</span>
                <span className="text-xs font-mono text-pkt-text-body-default">{f.krevd_dager}d</span>
              </div>
              {f.ny_sluttdato && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-pkt-text-body-subtle">Ny sluttdato</span>
                  <span className="text-xs font-mono font-semibold text-pkt-brand-warm-blue-1000">
                    {formatDateShort(f.ny_sluttdato)}
                  </span>
                </div>
              )}
            </div>
          );
        }

        // Non-resolved: show varsel date (when hero is days) + ny sluttdato
        const hasContext = (hasDays && f.frist_varsel?.dato_sendt) || f.ny_sluttdato;
        if (!hasContext) return null;

        return (
          <div className="mt-2 pt-2 border-t border-pkt-border-subtle space-y-1.5">
            {hasDays && f.frist_varsel?.dato_sendt && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Varslet</span>
                <span className="text-xs font-mono text-pkt-text-body-default">
                  {formatDateShort(f.frist_varsel.dato_sendt)}
                </span>
              </div>
            )}
            {f.ny_sluttdato && (
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">Ny sluttdato</span>
                <span className="text-xs font-mono font-semibold text-pkt-brand-warm-blue-1000">
                  {formatDateShort(f.ny_sluttdato)}
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
        spor="frist"
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
