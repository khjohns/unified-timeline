import { clsx } from 'clsx';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import type { SakState } from '../../../types/timeline';
import type { AvailableActions } from '../../../hooks/useActionPermissions';
import { formatCurrencyCompact } from '../../../utils/formatters';
import { getVederlagsmetodeShortLabel } from '../../../constants/paymentMethods';
import { getResultatLabel } from '../../../utils/formatters';
import { getGradColor, isResolved } from './trackCardUtils';
import { StatusDot } from './StatusDot';
import { TrackHistory } from './TrackHistory';
import { TrackCTA } from './TrackCTA';
import { Alert, Button } from '../../primitives';
import { TokenExpiredAlert } from '../../alerts/TokenExpiredAlert';
import { MethodCards } from '../MethodCards';
import { KravLinje } from '../KravLinje';
import { InlineYesNo } from '../InlineYesNo';
import type { SporHistoryEntry } from '../../views/SporHistory';
import type { VederlagEditState } from '../../../hooks/useVederlagBridge';

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
  editState?: VederlagEditState | null;
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
  editState,
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
        <div className="flex items-baseline gap-1">
          <span className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Vederlag
          </span>
          <span className="text-bento-label text-pkt-text-body-muted">&sect;34</span>
        </div>
        <p className="text-bento-body text-pkt-text-body-muted italic mt-2">Krever ansvarsgrunnlag</p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'rounded-lg p-3',
        editState ? 'bg-pkt-bg-card ring-2 ring-pkt-brand-warm-blue-1000/30' : 'bg-bento-vederlag',
        className,
      )}
      style={style}
    >
      {/* Header */}
      <div className={clsx('flex items-center justify-between mb-2', editState && 'bg-bento-vederlag -mx-3 -mt-3 px-3 pt-3 pb-2 rounded-t-lg')}>
        <div className="flex items-baseline gap-1">
          <span className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Vederlag
          </span>
          <span className="text-bento-label text-pkt-text-body-muted">&sect;34</span>
          {(isSubsidiary || editState?.erSubsidiaer) && (
            <span className="bg-badge-warning-bg text-badge-warning-text rounded-sm text-bento-label px-1.5 py-0.5 font-medium ml-1">
              Subsidi&aelig;rt
            </span>
          )}
        </div>
        {editState ? (
          <button
            type="button"
            onClick={editState.onClose}
            className="p-1 rounded-sm text-pkt-text-body-subtle hover:text-pkt-text-body-default hover:bg-pkt-bg-subtle transition-colors"
            aria-label="Lukk"
          >
            <Cross2Icon className="w-4 h-4" />
          </button>
        ) : (
          <StatusDot status={status} />
        )}
      </div>

      {isEmpty && !editState ? (
        <p className="text-bento-body text-pkt-text-body-muted italic">Ingen data enn&aring;</p>
      ) : (
        <>
          {/* Key-value rows (read-only, hidden in edit mode) */}
          {!editState && (
            <div className="space-y-1">
              {krevdBelop != null && !hasBhResponse && (
                <div className="flex justify-between items-baseline">
                  <span className="text-bento-caption text-pkt-text-body-subtle">Krevd</span>
                  <span className="text-bento-body font-mono font-medium text-pkt-text-body-default tabular-nums">
                    {formatCurrencyCompact(krevdBelop)}
                  </span>
                </div>
              )}
              {v.metode && (
                <div className="flex justify-between items-baseline">
                  <span className="text-bento-caption text-pkt-text-body-subtle">Metode</span>
                  <span className="text-bento-body text-pkt-text-body-default">
                    {getVederlagsmetodeShortLabel(v.metode)}
                  </span>
                </div>
              )}
              {v.saerskilt_krav?.rigg_drift?.belop != null && v.saerskilt_krav.rigg_drift.belop > 0 && (
                <div className="flex justify-between items-baseline">
                  <span className="text-bento-caption text-pkt-text-body-subtle">Rigg/drift</span>
                  <span className="text-bento-body font-mono text-pkt-text-body-default tabular-nums">
                    +{formatCurrencyCompact(v.saerskilt_krav.rigg_drift.belop)}
                  </span>
                </div>
              )}
              {v.saerskilt_krav?.produktivitet?.belop != null && v.saerskilt_krav.produktivitet.belop > 0 && (
                <div className="flex justify-between items-baseline">
                  <span className="text-bento-caption text-pkt-text-body-subtle">Produktivitet</span>
                  <span className="text-bento-body font-mono text-pkt-text-body-default tabular-nums">
                    +{formatCurrencyCompact(v.saerskilt_krav.produktivitet.belop)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Inline controls when in edit mode */}
          {editState && (
            <div className="mt-2 pt-2 border-t border-pkt-border-subtle space-y-3">
              {/* Subsidiær context alert */}
              {editState.erSubsidiaer && (
                <div className="text-bento-label text-pkt-brand-yellow-1000 bg-pkt-brand-yellow-1000/5 border border-pkt-brand-yellow-1000/20 rounded-sm px-2 py-1.5">
                  Grunnlagskravet er avsl&aring;tt. Vederlagsvurderingen er subsidi&aelig;r.
                </div>
              )}

              {/* Metode section */}
              <div className="space-y-1.5">
                <span className="text-bento-label font-semibold text-pkt-text-body-default uppercase tracking-wide">
                  Beregningsmetode
                </span>
                <MethodCards
                  teMetode={editState.teMetode}
                  bhMetode={editState.bhMetode}
                  onChange={editState.onBhMetodeChange}
                />
              </div>

              {/* EP-justering (conditional) */}
              {editState.showEpJustering && (
                <div className="space-y-1.5">
                  <span className="text-bento-label font-semibold text-pkt-text-body-default uppercase tracking-wide">
                    EP-justering &sect;34.3.3
                  </span>
                  <InlineYesNo
                    label="Varslet i tide?"
                    value={editState.epJusteringVarsletITide}
                    onChange={editState.onEpJusteringVarsletITideChange}
                  />
                  <InlineYesNo
                    label="Aksepteres?"
                    value={editState.epJusteringAkseptert}
                    onChange={editState.onEpJusteringAkseptertChange}
                  />
                </div>
              )}

              {/* Tilbakeholdelse (conditional) */}
              {editState.showTilbakeholdelse && (
                <div className="space-y-1.5">
                  <span className="text-bento-label font-semibold text-pkt-text-body-default uppercase tracking-wide">
                    Tilbakeholdelse &sect;30.2
                  </span>
                  <InlineYesNo
                    label="Hold tilbake betaling?"
                    value={editState.holdTilbake}
                    onChange={editState.onHoldTilbakeChange}
                  />
                </div>
              )}

              {/* Krav-linjer */}
              <KravLinje editState={editState.hovedkrav} />
              {editState.rigg && <KravLinje editState={editState.rigg} />}
              {editState.produktivitet && <KravLinje editState={editState.produktivitet} />}

              {/* Resultat box */}
              {editState.prinsipaltResultat && (
                <div className="bg-pkt-bg-subtle/50 rounded-sm border border-pkt-border-default px-2.5 py-2 text-bento-caption space-y-1">
                  <div>
                    <span className="font-semibold">Resultat: </span>
                    <span className={
                      editState.prinsipaltResultat === 'godkjent' ? 'text-pkt-brand-dark-green-1000 font-semibold'
                        : editState.prinsipaltResultat === 'avslatt' ? 'text-pkt-brand-red-1000 font-semibold'
                          : 'text-pkt-brand-yellow-1000 font-semibold'
                    }>
                      {getResultatLabel(editState.prinsipaltResultat)}
                    </span>
                    <span className="text-pkt-text-body-muted ml-1">
                      &ndash; kr {formatCurrencyCompact(editState.totalGodkjent)} av kr {formatCurrencyCompact(editState.totalKrevd)}
                      {editState.godkjenningsgradProsent > 0 && ` (${editState.godkjenningsgradProsent}%)`}
                    </span>
                  </div>
                  {editState.visSubsidiaertResultat && (
                    <div className="text-pkt-text-body-subtle">
                      <span className="text-pkt-text-body-muted">&cularr; Subsidi&aelig;rt: </span>
                      <span className="font-medium">
                        {getResultatLabel(editState.subsidiaertResultat)}
                      </span>
                      <span className="font-mono tabular-nums ml-1">
                        &ndash; kr {formatCurrencyCompact(editState.totalGodkjentInklPrekludert)} av kr {formatCurrencyCompact(editState.totalKrevd)}
                      </span>
                      <span className="ml-1">dersom kravet hadde v&aelig;rt varslet i tide</span>
                    </div>
                  )}
                </div>
              )}

              {/* Token expired */}
              <TokenExpiredAlert open={editState.showTokenExpired} onClose={editState.onTokenExpiredClose} />

              {/* Submit error */}
              {editState.submitError && (
                <Alert variant="danger" size="sm" title="Feil ved innsending">
                  {editState.submitError}
                </Alert>
              )}

              {/* Submit footer */}
              <div className="border-t border-pkt-border-subtle pt-3 flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
                <div>{/* spacer */}</div>
                <div className="flex gap-2">
                  {editState.onSaveDraft && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={editState.onSaveDraft}
                      disabled={editState.isSubmitting}
                    >
                      Lagre utkast
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    size="xs"
                    onClick={editState.onSubmit}
                    disabled={!editState.canSubmit}
                  >
                    {editState.submitLabel}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* KPI row + progress bar — when BH has responded (read-only mode only) */}
          {!editState && hasBhResponse && krevdBelop != null && godkjentBelop != null && (
            <div className="mt-2 pt-2 border-t border-pkt-border-subtle">
              <div className="flex items-end gap-4">
                <div>
                  <span className="text-bento-label text-pkt-text-body-subtle uppercase tracking-wide">Krevd</span>
                  <p className="text-bento-kpi font-semibold font-mono tabular-nums text-bento-krevd leading-tight">
                    {formatCurrencyCompact(krevdBelop)}
                  </p>
                </div>
                <div>
                  <span className="text-bento-label text-pkt-text-body-subtle uppercase tracking-wide">
                    {isSubsidiary ? 'Subs.' : 'Godkjent'}
                  </span>
                  <p className="text-bento-kpi font-semibold font-mono tabular-nums text-pkt-brand-dark-green-1000 leading-tight">
                    {formatCurrencyCompact(godkjentBelop)}
                    {resolved && <CheckIcon className="w-3.5 h-3.5 inline ml-1 align-baseline" />}
                  </p>
                </div>
                {vederlagGrad != null && (
                  <div className="ml-auto text-right">
                    <span className="text-bento-label text-pkt-text-body-subtle uppercase tracking-wide">Godkj.grad</span>
                    <p className={clsx('text-bento-kpi font-bold font-mono tabular-nums leading-tight', getGradColor(vederlagGrad))}>
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

      {/* CTA strip — hidden when in edit mode */}
      {!editState && (
        <TrackCTA
          spor="vederlag"
          status={status}
          state={state}
          userRole={userRole}
          actions={actions}
          primaryAction={primaryAction}
          secondaryActions={secondaryActions}
        />
      )}
    </div>
  );
}
