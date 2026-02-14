import { clsx } from 'clsx';
import { CheckIcon, Cross2Icon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import type { SakState } from '../../../types/timeline';
import type { AvailableActions } from '../../../hooks/useActionPermissions';
import { CategoryLabel } from '../../shared/CategoryLabel';
import { formatDateShort } from '../../../utils/formatters';
import { getAccentBorderClass } from './trackCardUtils';
import { StatusDot } from './StatusDot';
import { TrackHistory } from './TrackHistory';
import { TrackCTA } from './TrackCTA';
import type { SporHistoryEntry } from '../../views/SporHistory';

interface GrunnlagCardProps {
  state: SakState;
  userRole: 'TE' | 'BH';
  actions: AvailableActions;
  entries: SporHistoryEntry[];
  primaryAction?: { label: string; onClick: () => void };
  secondaryActions?: { label: string; onClick: () => void; variant?: 'default' | 'danger' }[];
  className?: string;
  style?: React.CSSProperties;
}

export function GrunnlagCard({
  state,
  userRole,
  actions,
  entries,
  primaryAction,
  secondaryActions,
  className,
  style,
}: GrunnlagCardProps) {
  const g = state.grunnlag;
  const status = g.status;
  const hasCategory = !!g.hovedkategori;
  const hasDates = !!(g.dato_oppdaget || g.grunnlag_varsel?.dato_sendt);
  const hasBhResponse = !!g.bh_resultat;
  const isEmpty = !hasCategory && !hasDates && status === 'utkast';

  return (
    <div
      className={clsx(
        'bg-pkt-bg-card rounded-lg border-t-2 p-3',
        getAccentBorderClass(status),
        className,
      )}
      style={style}
    >
      {/* Header: label + hjemmel + status dot */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Ansvarsgrunnlag
          </span>
          <span className="text-[10px] text-pkt-text-body-muted">
            §25.2
          </span>
        </div>
        <StatusDot status={status} />
      </div>

      {/* Hero zone: category */}
      {isEmpty ? (
        <p className="text-xs text-pkt-text-body-muted italic">Ingen data enn&aring;</p>
      ) : (
        <>
          {hasCategory && (
            <CategoryLabel
              hovedkategori={g.hovedkategori!}
              underkategori={
                Array.isArray(g.underkategori) ? g.underkategori[0] : g.underkategori
              }
            />
          )}

          {/* Dates (label-value pairs) */}
          {hasDates && (
            <div className="mt-2 space-y-1.5">
              {g.dato_oppdaget && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-pkt-text-body-subtle">Oppdaget</span>
                  <span className="text-xs font-mono text-pkt-text-body-default">
                    {formatDateShort(g.dato_oppdaget)}
                  </span>
                </div>
              )}
              {g.grunnlag_varsel?.dato_sendt && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-pkt-text-body-subtle">Varslet</span>
                  <span
                    className={clsx(
                      'text-xs font-mono',
                      g.grunnlag_varslet_i_tide === false
                        ? 'font-semibold text-pkt-brand-red-1000'
                        : 'text-pkt-text-body-default',
                    )}
                  >
                    {formatDateShort(g.grunnlag_varsel.dato_sendt)}
                    {g.grunnlag_varslet_i_tide === false && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-pkt-brand-red-1000">
                        <ExclamationTriangleIcon className="w-3 h-3" />
                        <span className="text-[10px]">§32.2</span>
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* BH response section (grows in when BH responds) */}
          {hasBhResponse && (
            <div className="mt-2 pt-2 border-t border-pkt-border-subtle">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">BH resultat</span>
                <span
                  className={clsx(
                    'text-xs font-semibold flex items-center gap-1',
                    g.bh_resultat === 'godkjent' && 'text-pkt-brand-dark-green-1000',
                    g.bh_resultat === 'avslatt' && 'text-pkt-brand-red-1000',
                    g.bh_resultat === 'frafalt' && 'text-pkt-text-body-muted',
                  )}
                >
                  {g.bh_resultat === 'godkjent' ? 'Godkjent' : g.bh_resultat === 'avslatt' ? 'Avsl\u00e5tt' : 'Frafalt'}
                  {g.bh_resultat === 'godkjent' && <CheckIcon className="w-3.5 h-3.5" />}
                  {g.bh_resultat === 'avslatt' && <Cross2Icon className="w-3.5 h-3.5" />}
                </span>
              </div>
              {g.bh_resultat === 'avslatt' && g.bh_begrunnelse && (
                <p className="text-[11px] text-pkt-text-body-muted mt-1 truncate" title={g.bh_begrunnelse}>
                  {g.bh_begrunnelse}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* History */}
      <TrackHistory entries={entries} />

      {/* CTA strip */}
      <TrackCTA
        spor="grunnlag"
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
