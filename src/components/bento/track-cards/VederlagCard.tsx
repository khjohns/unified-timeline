import { clsx } from 'clsx';
import { CheckIcon, Cross2Icon, InfoCircledIcon } from '@radix-ui/react-icons';
import type { SakState } from '../../../types/timeline';
import type { AvailableActions } from '../../../hooks/useActionPermissions';
import { formatCurrencyCompact } from '../../../utils/formatters';
import { getVederlagsmetodeShortLabel } from '../../../constants/paymentMethods';
import type { VederlagsMetode } from '../../../constants/paymentMethods';
import { getResultatLabel } from '../../../utils/formatters';
import { getGradColor, isResolved } from './trackCardUtils';
import { StatusDot } from './StatusDot';
import { TrackHistory } from './TrackHistory';
import { TrackCTA } from './TrackCTA';
import { Alert, Button, Tooltip, Textarea } from '../../primitives';
import { TokenExpiredAlert } from '../../alerts/TokenExpiredAlert';
import { MethodCards } from '../MethodCards';
import { KravLinje } from '../KravLinje';
import { InlineYesNo } from '../InlineYesNo';
import { InlineNumberInput } from '../InlineNumberInput';
import { InlineSegmentedControl } from '../InlineSegmentedControl';
import { InlineDatePicker } from '../InlineDatePicker';
import type { SporHistoryEntry } from '../../views/SporHistory';
import type { VederlagEditState } from '../../../hooks/useVederlagBridge';
import type { VederlagTeEditState } from '../../../hooks/useVederlagSubmissionBridge';

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
  teEditState?: VederlagTeEditState | null;
  className?: string;
  style?: React.CSSProperties;
}

const METODE_SEGMENTS = [
  { value: 'ENHETSPRISER', label: 'Enhetspriser' },
  { value: 'REGNINGSARBEID', label: 'Regning' },
  { value: 'FASTPRIS_TILBUD', label: 'Fastpris' },
];

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
  teEditState,
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
        editState || teEditState ? 'bg-pkt-bg-card ring-2 ring-pkt-brand-warm-blue-1000/30' : 'bg-bento-vederlag',
        className,
      )}
      style={style}
    >
      {/* Header — in teEditState the title moves into the right column */}
      {!teEditState && (
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
      )}

      {/* L18: isEmpty guard must check teEditState */}
      {isEmpty && !editState && !teEditState ? (
        <p className="text-bento-body text-pkt-text-body-muted italic">Ingen data enn&aring;</p>
      ) : (
        <>
          {/* Key-value rows (read-only, hidden in edit/teEdit mode) */}
          {!editState && !teEditState && (
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

          {/* Inline controls when in BH edit mode */}
          {editState && (
            <div className="mt-2 pt-2 space-y-3">
              <hr className="border-pkt-border-subtle mx-1" />
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
              <hr className="border-pkt-border-subtle mx-1" />
              <div className="pt-3 flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
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

          {/* Inline controls when in TE edit mode — two-column: begrunnelse left, controls right (L21) */}
          {teEditState && (() => {
            const sectionHeader = (title: string, paragraf: string, tooltip: string) => (
              <div className="flex items-center gap-1">
                <span className="text-bento-label font-semibold text-pkt-text-body-default uppercase tracking-wide">
                  {title}
                </span>
                <span className="text-bento-label text-pkt-text-body-muted">{paragraf}</span>
                <Tooltip content={tooltip} side="right">
                  <button type="button" className="text-pkt-text-placeholder hover:text-pkt-text-body-default cursor-help">
                    <InfoCircledIcon className="w-3 h-3" />
                  </button>
                </Tooltip>
              </div>
            );

            return (
              <div className="mt-2 pt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Left column: Begrunnelse */}
                <div className="flex flex-col gap-1 md:order-1">
                  <div className="flex items-center gap-1">
                    <span className="text-bento-label font-semibold text-pkt-text-body-default uppercase tracking-wide">
                      Begrunnelse
                    </span>
                    <span className="text-pkt-brand-red-1000">*</span>
                    <Tooltip content="Beskriv grunnlaget for beregningen og henvis til vedlegg. Begrunn valgt metode og kravets omfang med referanse til kontraktens bestemmelser (§34.2–§34.4)." side="right">
                      <button type="button" className="text-pkt-text-placeholder hover:text-pkt-text-body-default cursor-help">
                        <InfoCircledIcon className="w-3 h-3" />
                      </button>
                    </Tooltip>
                  </div>
                  <Textarea
                    id="vederlag-te-begrunnelse"
                    value={teEditState.begrunnelse}
                    onChange={(e) => teEditState.onBegrunnelseChange(e.target.value)}
                    rows={10}
                    fullWidth
                    error={!!teEditState.begrunnelseError}
                    placeholder={teEditState.begrunnelsePlaceholder}
                    className="flex-1"
                  />
                  {teEditState.begrunnelseError && (
                    <p className="text-bento-body font-medium text-pkt-brand-red-1000" role="alert">
                      {teEditState.begrunnelseError}
                    </p>
                  )}
                </div>

                {/* Right column: Controls — with vertical divider and card title */}
                <div className="space-y-3 md:order-2 md:border-l md:border-pkt-border-subtle md:pl-3">
                  {/* Card title + close — positioned above controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide">
                        Vederlag
                      </span>
                      <span className="text-bento-label text-pkt-text-body-muted">&sect;34</span>
                      {isSubsidiary && (
                        <span className="bg-badge-warning-bg text-badge-warning-text rounded-sm text-bento-label px-1.5 py-0.5 font-medium ml-1">
                          Subsidi&aelig;rt
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={teEditState.onClose}
                      className="p-1 rounded-sm text-pkt-text-body-subtle hover:text-pkt-text-body-default hover:bg-pkt-bg-subtle transition-colors"
                      aria-label="Lukk"
                    >
                      <Cross2Icon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Contextual status summary */}
                  {teEditState.statusSummary && (
                    <div className="bg-pkt-bg-subtle/80 rounded-sm border border-pkt-border-default px-2.5 py-1.5 text-bento-caption text-pkt-text-body-default font-medium">
                      {teEditState.statusSummary}
                    </div>
                  )}

                  {/* ── Section: Beregningsmetode (§34) ── */}
                  <div className="space-y-1.5">
                    {sectionHeader(
                      'Beregningsmetode', '§34',
                      'Vederlaget kan beregnes etter kontraktens enhetspriser (§34.3), som regningsarbeid (§34.4) eller som fastpris/tilbud (§34.2.1). Valg av metode avgjør hvordan kravet dokumenteres.',
                    )}
                    <InlineSegmentedControl
                      options={METODE_SEGMENTS}
                      value={teEditState.metode}
                      onChange={(v) => teEditState.onMetodeChange(v as VederlagsMetode)}
                      disabled={teEditState.isSubmitting}
                    />
                  </div>

                  {/* ── Section: Kravets omfang ── */}
                  {teEditState.metode && (
                    <div className="space-y-1.5">
                      {teEditState.showBelopDirekte && (
                        <>
                          {sectionHeader(
                            teEditState.metode === 'FASTPRIS_TILBUD' ? 'Tilbudt fastpris' : 'Direkte kostnader',
                            teEditState.metode === 'FASTPRIS_TILBUD' ? '§34.2.1' : '§34.3',
                            teEditState.metode === 'FASTPRIS_TILBUD'
                              ? 'Spesifisert tilbud (§34.2.1). Ved avslag faller oppgjøret tilbake på enhetspriser (§34.3) eller regningsarbeid (§34.4).'
                              : 'Sum direkte kostnader basert på kontraktens enhetspriser, eventuelt justert for endrede forutsetninger (§34.3).',
                          )}
                          <InlineNumberInput
                            label="Beløp (eks. mva)"
                            value={teEditState.belopDirekte ?? 0}
                            onChange={(v) => teEditState.onBelopDirekteChange(v || undefined)}
                            suffix="kr"
                          />
                        </>
                      )}
                      {teEditState.showKostnadsOverslag && (
                        <>
                          {sectionHeader(
                            'Kostnadsoverslag', '§30.2',
                            'Estimert totalkostnad. Byggherren kan holde tilbake betaling inntil overslag mottas (§30.2).',
                          )}
                          <InlineNumberInput
                            label="Estimert beløp"
                            value={teEditState.kostnadsOverslag ?? 0}
                            onChange={(v) => teEditState.onKostnadsOverslagChange(v || undefined)}
                            suffix="kr"
                            min={0}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Section: Justert EP (§34.3.3) — only ENHETSPRISER ── */}
                  {teEditState.showJustertEp && (
                    <div className="space-y-1.5">
                      {sectionHeader(
                        'Justert EP', '§34.3.3',
                        'Krever totalentreprenøren justering av kontraktens enhetspriser på grunn av endrede forutsetninger (§34.3.3)?',
                      )}
                      <InlineYesNo
                        label="Krever justerte enhetspriser?"
                        value={teEditState.kreverJustertEp}
                        onChange={teEditState.onKreverJustertEpChange}
                        disabled={teEditState.isSubmitting}
                      />
                    </div>
                  )}

                  {/* ── Section: Varsling (§34.4) — only REGNINGSARBEID ── */}
                  {teEditState.showVarsletForOppstart && (
                    <div className="space-y-1.5">
                      {sectionHeader(
                        'Varsling', '§34.4',
                        'Ble byggherren varslet om regningsarbeid før arbeidet ble igangsatt (§34.4)?',
                      )}
                      <InlineYesNo
                        label="Varslet før oppstart?"
                        value={teEditState.varsletForOppstart}
                        onChange={teEditState.onVarsletForOppstartChange}
                        disabled={teEditState.isSubmitting}
                      />
                    </div>
                  )}

                  {/* ── Section: Særskilte krav (§34.1.3) ── */}
                  {teEditState.metode && (
                    <div className="space-y-1.5">
                      {sectionHeader(
                        'Særskilte krav', '§34.1.3',
                        'Krav om økte rigg-/driftskostnader og produktivitetstap krever særskilt varsel «uten ugrunnet opphold» etter at TE ble klar over at utgifter ville påløpe (§34.1.3).',
                      )}
                      <InlineYesNo
                        label="Økte rigg-/driftskostnader?"
                        value={teEditState.harRiggKrav}
                        onChange={teEditState.onHarRiggKravChange}
                        disabled={teEditState.isSubmitting}
                      />
                      {teEditState.harRiggKrav && (
                        <div className="ml-2 pl-2 border-l-2 border-pkt-border-subtle space-y-1.5">
                          <InlineNumberInput
                            label="Estimert beløp"
                            value={teEditState.belopRigg ?? 0}
                            onChange={(v) => teEditState.onBelopRiggChange(v || undefined)}
                            suffix="kr"
                            min={0}
                          />
                          <InlineDatePicker
                            label="Dato erkjent"
                            value={teEditState.datoKlarOverRigg}
                            onChange={teEditState.onDatoKlarOverRiggChange}
                            disabled={teEditState.isSubmitting}
                          />
                        </div>
                      )}
                      <InlineYesNo
                        label="Nedsatt produktivitet?"
                        value={teEditState.harProduktivitetKrav}
                        onChange={teEditState.onHarProduktivitetKravChange}
                        disabled={teEditState.isSubmitting}
                      />
                      {teEditState.harProduktivitetKrav && (
                        <div className="ml-2 pl-2 border-l-2 border-pkt-border-subtle space-y-1.5">
                          <InlineNumberInput
                            label="Estimert beløp"
                            value={teEditState.belopProduktivitet ?? 0}
                            onChange={(v) => teEditState.onBelopProduktivitetChange(v || undefined)}
                            suffix="kr"
                            min={0}
                          />
                          <InlineDatePicker
                            label="Dato erkjent"
                            value={teEditState.datoKlarOverProduktivitet}
                            onChange={teEditState.onDatoKlarOverProduktivitetChange}
                            disabled={teEditState.isSubmitting}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Token expired */}
                  <TokenExpiredAlert open={teEditState.showTokenExpired} onClose={teEditState.onTokenExpiredClose} />

                  {/* Submit error */}
                  {teEditState.submitError && (
                    <Alert variant="danger" size="sm" title="Feil ved innsending">
                      {teEditState.submitError}
                    </Alert>
                  )}
                </div>

                {/* Submit footer — spans both columns */}
                <div className="md:col-span-2 md:order-3">
                  <hr className="border-pkt-border-subtle mx-1 mb-3" />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="primary"
                      size="xs"
                      onClick={teEditState.onSubmit}
                      disabled={!teEditState.canSubmit || teEditState.isSubmitting}
                    >
                      {teEditState.submitLabel}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* KPI row + progress bar — when BH has responded (read-only mode only) */}
          {!editState && !teEditState && hasBhResponse && krevdBelop != null && godkjentBelop != null && (
            <div className="mt-2 pt-2">
              <hr className="border-pkt-border-subtle mx-1 mb-2" />
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
      {!editState && !teEditState && (
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
