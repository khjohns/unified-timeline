import { clsx } from 'clsx';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import type { SakState, FristVarselType } from '../../../types/timeline';
import type { AvailableActions } from '../../../hooks/useActionPermissions';
import { formatDateShort } from '../../../utils/formatters';
import { Alert, Button, Tooltip, Textarea } from '../../primitives';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { getGradColor, isResolved } from './trackCardUtils';
import { getResultatLabel } from '../../../utils/formatters';
import { StatusDot } from './StatusDot';
import { TrackHistory } from './TrackHistory';
import { TrackCTA } from './TrackCTA';
import { TokenExpiredAlert } from '../../alerts/TokenExpiredAlert';
import type { SporHistoryEntry } from '../../views/SporHistory';
import { InlineYesNo } from '../InlineYesNo';
import { InlineNumberInput } from '../InlineNumberInput';
import { InlineSegmentedControl } from '../InlineSegmentedControl';
import { InlineDatePicker } from '../InlineDatePicker';
import type { FristEditState } from '../../../hooks/useFristBridge';
import type { FristTeEditState } from '../../../hooks/useFristSubmissionBridge';

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
  editState?: FristEditState | null;
  teEditState?: FristTeEditState | null;
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
  editState,
  teEditState,
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
          'bg-pkt-bg-card rounded-lg p-3 opacity-60',
          className,
        )}
        style={style}
      >
        <div className="flex items-baseline gap-1">
          <span className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Fristforlengelse
          </span>
          <span className="text-bento-label text-pkt-text-body-muted">&sect;33</span>
        </div>
        <p className="text-bento-body text-pkt-text-body-muted italic mt-2">Krever ansvarsgrunnlag</p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'rounded-lg p-3',
        editState || teEditState ? 'bg-pkt-bg-card ring-2 ring-pkt-brand-warm-blue-1000/30' : 'bg-bento-frist',
        className,
      )}
      style={style}
    >
      {/* Header */}
      <div className={clsx('flex items-center justify-between mb-2', (editState || teEditState) && 'bg-bento-frist -mx-3 -mt-3 px-3 pt-3 pb-2 rounded-t-lg')}>
        <div className="flex items-baseline gap-1">
          <span className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Fristforlengelse
          </span>
          <span className="text-bento-label text-pkt-text-body-muted">&sect;33</span>
          {isSubsidiary && (
            <span className="bg-badge-warning-bg text-badge-warning-text rounded-sm text-bento-label px-1.5 py-0.5 font-medium ml-1">
              Subsidi&aelig;rt
            </span>
          )}
        </div>
        {editState || teEditState ? (
          <button
            type="button"
            onClick={(editState ?? teEditState)!.onClose}
            className="p-1 rounded-sm text-pkt-text-body-subtle hover:text-pkt-text-body-default hover:bg-pkt-bg-subtle transition-colors"
            aria-label="Lukk"
          >
            <Cross2Icon className="w-4 h-4" />
          </button>
        ) : (
          <StatusDot status={status} />
        )}
      </div>

      {isEmpty && !editState && !teEditState ? (
        <p className="text-bento-body text-pkt-text-body-muted italic">Ingen data enn&aring;</p>
      ) : (
        <>
          {/* Key-value rows */}
          <div className="space-y-1">
            {hasDays && !hasBhResponse && (
              <div className="flex justify-between items-baseline">
                <span className="text-bento-caption text-pkt-text-body-subtle">Krevd</span>
                <span className="text-bento-body font-mono font-medium text-pkt-text-body-default tabular-nums">
                  {f.krevd_dager}d
                </span>
              </div>
            )}
            {(hasVarselOnly || (hasDays && f.frist_varsel?.dato_sendt)) && (
              <div className="flex justify-between items-baseline">
                <span className="text-bento-caption text-pkt-text-body-subtle">Varslet §33.4</span>
                <span className="text-bento-body font-mono text-pkt-text-body-default">
                  {formatDateShort(f.frist_varsel!.dato_sendt)}
                </span>
              </div>
            )}
            {f.spesifisert_varsel?.dato_sendt && (
              <div className="flex justify-between items-baseline">
                <span className="text-bento-caption text-pkt-text-body-subtle">Krav §33.6.1</span>
                <span className="text-bento-body font-mono text-pkt-text-body-default">
                  {formatDateShort(f.spesifisert_varsel.dato_sendt)}
                </span>
              </div>
            )}
            {f.ny_sluttdato && !editState && !teEditState && (
              <div className="flex justify-between items-baseline">
                <span className="text-bento-caption text-pkt-text-body-subtle">Ny sluttdato</span>
                <span className="text-bento-body font-mono font-semibold text-pkt-brand-warm-blue-1000">
                  {formatDateShort(f.ny_sluttdato)}
                </span>
              </div>
            )}
          </div>

          {/* Inline controls when in edit mode */}
          {editState && (() => {
            const krevd = f.krevd_dager ?? 0;
            const diff = krevd - editState.godkjentDager;
            const pct = krevd > 0 ? ((editState.godkjentDager / krevd) * 100).toFixed(1) : '0';
            const subsidiaerBadge = (
              <span className="bg-badge-warning-bg text-badge-warning-text rounded-sm text-bento-micro px-1 py-0.5 font-medium flex-shrink-0">
                Subsidiært
              </span>
            );
            const sectionHeader = (title: string, paragraf: string, tooltip: string, badge?: React.ReactNode) => (
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
                {badge}
              </div>
            );

            return (
              <div className="mt-2 pt-2 space-y-3">
                <hr className="border-pkt-border-subtle mx-1" />
                {/* ── Section: Foreløpig varsel (§33.4) ── */}
                {editState.showFristVarselOk && (
                  <div className="space-y-1.5">
                    {sectionHeader(
                      'Foreløpig varsel', '§33.4',
                      'Oppstår forhold som gir rett til fristforlengelse, må parten varsle uten ugrunnet opphold (§33.4). Varsles det ikke i tide, tapes kravet. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
                    )}
                    <InlineYesNo
                      label="Ble varselet sendt i tide?"
                      value={editState.fristVarselOk}
                      onChange={editState.onFristVarselOkChange}
                      showPrekludert
                    />
                    {editState.fristVarselOk === false && (
                      <div className="text-bento-label text-pkt-brand-red-1000 bg-pkt-brand-red-1000/5 border border-pkt-brand-red-1000/20 rounded-sm px-2 py-1.5">
                        <span className="font-semibold">Preklusjon.</span>{' '}
                        {editState.showSpesifisertKravOk
                          ? 'Prinsipalt tapes kravet. Du tar subsidiært stilling til §33.6.1 under. Husk skriftlig innsigelse (§5).'
                          : 'Kravet tapes. Husk skriftlig innsigelse (§5).'}
                      </div>
                    )}
                    {editState.showSendForesporsel && (
                      <InlineYesNo
                        label="Send forespørsel om spesifisering?"
                        subtitle="§33.6.2"
                        value={editState.sendForesporsel}
                        onChange={editState.onSendForesporselChange}
                      />
                    )}
                  </div>
                )}

                {/* ── Section: Svar på forespørsel (§33.6.2) ── */}
                {editState.showForesporselSvarOk && (
                  <div className="space-y-1.5">
                    {sectionHeader(
                      'Svar på forespørsel', '§33.6.2',
                      'Mottar totalentreprenøren forespørsel om å spesifisere fristkrav (§33.6.2), må han uten ugrunnet opphold angi og begrunne antall dager. Gjøres ikke dette i tide, tapes kravet.',
                    )}
                    <InlineYesNo
                      label="Kom svaret i tide?"
                      value={editState.foresporselSvarOk}
                      onChange={editState.onForesporselSvarOkChange}
                      showPrekludert
                    />
                    {editState.foresporselSvarOk === false && (
                      <div className="text-bento-label text-pkt-brand-red-1000 bg-pkt-brand-red-1000/5 border border-pkt-brand-red-1000/20 rounded-sm px-2 py-1.5">
                        <span className="font-semibold">Preklusjon.</span>{' '}
                        Kravet tapes (§33.6.2 tredje ledd). Husk skriftlig innsigelse (§5).
                      </div>
                    )}
                  </div>
                )}

                {/* ── Section: Krav om fristforlengelse (§33.6.1) ── */}
                {editState.showSpesifisertKravOk && (
                  <div className="space-y-1.5">
                    {sectionHeader(
                      'Krav om fristforlengelse', '§33.6.1',
                      'Når parten har grunnlag for å beregne omfanget, må han angi og begrunne antall dager uten ugrunnet opphold (§33.6.1). Fremsettes ikke kravet i tide, har parten bare krav på slik fristforlengelse som motparten måtte forstå.',
                      editState.erPrekludert ? subsidiaerBadge : undefined,
                    )}
                    <InlineYesNo
                      label="Ble kravet fremsatt i tide?"
                      value={editState.spesifisertKravOk}
                      onChange={editState.onSpesifisertKravOkChange}
                      showRedusert
                    />
                  </div>
                )}

                {/* ── Section: Vilkår for fristforlengelse (§33.1) ── */}
                <div className="space-y-1.5">
                  {sectionHeader(
                    'Vilkår for fristforlengelse', '§33.1',
                    'Dersom fremdriften hindres på grunn av endringer, forsinkelse eller svikt i byggherrens medvirkning, eller andre forhold byggherren bærer risikoen for, har totalentreprenøren krav på fristforlengelse (§33.1).',
                    editState.port2ErSubsidiaer ? subsidiaerBadge : undefined,
                  )}
                  <InlineYesNo
                    label="Har forholdet hindret fremdriften?"
                    value={editState.vilkarOppfylt}
                    onChange={editState.onVilkarOppfyltChange}
                  />
                </div>

                {/* ── Section: Beregning av fristforlengelse (§33.5) ── */}
                {editState.showGodkjentDager && (
                  <div className="space-y-1.5">
                    {sectionHeader(
                      'Beregning', '§33.5',
                      'Fristforlengelsen skal svare til den virkning hindringen har hatt for fremdriften (§33.5). Ved beregningen skal det tas hensyn til nødvendig avbrudd og oppstart, årstidsforskyvning, den samlede virkning av tidligere fristforlengelser, og om entreprenøren har oppfylt sin tapsbegrensningsplikt.',
                      editState.port3ErSubsidiaer ? subsidiaerBadge : undefined,
                    )}
                    {editState.erRedusert && (
                      <div className="text-bento-label text-pkt-brand-yellow-1000 bg-pkt-brand-yellow-1000/5 border border-pkt-brand-yellow-1000/20 rounded-sm px-2 py-1">
                        Begrenset godkjenning (§33.6.1) — kun det du måtte forstå
                      </div>
                    )}
                    <InlineNumberInput
                      label={editState.port3ErSubsidiaer ? 'Maksimalt kalenderdager' : 'Godkjent kalenderdager'}
                      value={editState.godkjentDager}
                      onChange={editState.onGodkjentDagerChange}
                      suffix="d"
                      min={0}
                      helperText={krevd > 0 && editState.godkjentDager !== krevd
                        ? `Differanse: ${diff}d (${pct}% godkjent)`
                        : undefined}
                    />
                  </div>
                )}

                {/* ── Resultat ── */}
                {editState.beregningsResultat && (
                  <div className="bg-pkt-bg-subtle/50 rounded-sm border border-pkt-border-default px-2.5 py-2 text-bento-caption space-y-1">
                    <div>
                      <span className="font-semibold">Resultat: </span>
                      <span className={
                        editState.beregningsResultat === 'godkjent' ? 'text-pkt-brand-dark-green-1000 font-semibold'
                          : editState.beregningsResultat === 'avslatt' ? 'text-pkt-brand-red-1000 font-semibold'
                            : 'text-pkt-brand-yellow-1000 font-semibold'
                      }>
                        {getResultatLabel(editState.beregningsResultat)}
                      </span>
                      {!editState.sendForesporsel && krevd > 0 && (
                        <span className="text-pkt-text-body-muted ml-1">
                          – {editState.godkjentDager} av {krevd} dager ({pct}%)
                        </span>
                      )}
                    </div>
                    {editState.visSubsidiaertResultat && editState.subsidiaertResultat && (
                      <div className="text-pkt-text-body-subtle">
                        <span className="text-pkt-text-body-muted">↳ Subsidiært: </span>
                        <span className="font-medium">
                          {getResultatLabel(editState.subsidiaertResultat)}
                        </span>
                        {editState.subsidiaertResultat !== 'avslatt' && (
                          <span className="font-mono tabular-nums ml-1">
                            ({editState.godkjentDager} av {editState.krevdDager} dager)
                          </span>
                        )}
                        {editState.erPrekludert && (
                          <span className="ml-1">dersom kravet hadde vært varslet i tide</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Forespørsel info alert */}
                {editState.sendForesporselInfo && (
                  <Alert variant="info" size="sm">
                    Du sender forespørsel om spesifisering (&sect;33.6.2). TE m&aring; svare med et spesifisert krav.
                  </Alert>
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
                <div className="pt-3 flex flex-col-reverse sm:flex-row sm:justify-between gap-1">
                  <div>{/* spacer */}</div>
                  <div className="flex gap-1">
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
            );
          })()}

          {/* Inline controls when in TE edit mode — two-column: begrunnelse left, controls right */}
          {teEditState && (() => {
            const tooltipTexts = {
              varsel: 'Oppstår forhold som gir rett til fristforlengelse, må parten varsle uten ugrunnet opphold (§33.4). Varsles det ikke i tide, tapes kravet.',
              krav: 'Når parten har grunnlag for å beregne omfanget, må han angi og begrunne antall dager uten ugrunnet opphold (§33.6.1). Fremsettes ikke kravet i tide, har parten bare krav på slik fristforlengelse som motparten måtte forstå.',
            };
            const sectionHeader = (title: string, tooltip: string) => (
              <div className="flex items-center gap-1">
                <span className="text-bento-label font-semibold text-pkt-text-body-default uppercase tracking-wide">
                  {title}
                </span>
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
                    {teEditState.begrunnelseRequired && (
                      <span className="text-pkt-brand-red-1000">*</span>
                    )}
                    <Tooltip content="Forklar hvordan forholdet har hindret fremdriften (§33.1), og begrunn antall dager ut fra den faktiske virkningen på fremdriften (§33.5). Ta hensyn til nødvendig avbrudd og oppstart, eventuell årstidsforskyvning, samlet virkning av tidligere fristforlengelser, og tiltak for å begrense skadevirkningene." side="right">
                      <button type="button" className="text-pkt-text-placeholder hover:text-pkt-text-body-default cursor-help">
                        <InfoCircledIcon className="w-3 h-3" />
                      </button>
                    </Tooltip>
                  </div>
                  <Textarea
                    id="frist-te-begrunnelse"
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

                {/* Right column: Controls */}
                <div className="space-y-3 md:order-2">
                  {/* Forespørsel alert */}
                  {teEditState.showForesporselAlert && (
                    <div className="bg-alert-warning-bg text-alert-warning-text rounded-sm px-2 py-1 text-bento-caption">
                      Svar på forespørsel fra byggherre (§33.6.2)
                    </div>
                  )}

                  {/* Explainer for varsel vs krav */}
                  {teEditState.showSegmentedControl && (
                    <div>
                      <p className="text-bento-label font-semibold text-pkt-text-body-default mb-0.5">Velg type henvendelse</p>
                      <p className="text-bento-caption text-pkt-text-body-subtle">
                        <span className="font-medium text-pkt-text-body-default">Varsel</span> (§33.4) melder fra om at et forhold kan gi rett til fristforlengelse, selv om omfanget ikke er klart ennå.
                        <br />
                        <span className="font-medium text-pkt-text-body-default">Krav</span> (§33.6.1) angir og begrunner antall dager.
                      </p>
                    </div>
                  )}

                  {/* Segmented control for kravtype */}
                  {teEditState.showSegmentedControl && (
                    <InlineSegmentedControl
                      options={teEditState.segmentOptions}
                      value={teEditState.varselType}
                      onChange={(v) => teEditState.onVarselTypeChange(v as FristVarselType)}
                      disabled={teEditState.isSubmitting}
                    />
                  )}

                  {/* §33.4 Varsel section */}
                  {teEditState.showVarselSection && (
                    <div className="space-y-1">
                      {sectionHeader('§33.4 Varsel', tooltipTexts.varsel)}
                      <InlineYesNo
                        label="Tidligere varslet?"
                        value={teEditState.tidligereVarslet}
                        onChange={teEditState.onTidligereVarsletChange}
                        disabled={teEditState.isSubmitting}
                      />
                      {teEditState.tidligereVarslet && (
                        <InlineDatePicker
                          label="Varseldato"
                          value={teEditState.varselDato}
                          onChange={teEditState.onVarselDatoChange}
                          disabled={teEditState.isSubmitting}
                        />
                      )}
                    </div>
                  )}

                  {/* §33.6.1 Krav section */}
                  {teEditState.showKravSection && (
                    <div className="space-y-1">
                      {sectionHeader('§33.6.1 Krav', tooltipTexts.krav)}
                      <InlineNumberInput
                        label="Kalenderdager"
                        value={teEditState.antallDager}
                        onChange={teEditState.onAntallDagerChange}
                        min={1}
                        suffix="d"
                        disabled={teEditState.isSubmitting}
                      />
                      <InlineDatePicker
                        label="Ny sluttdato"
                        subtitle="valgfritt"
                        value={teEditState.nySluttdato}
                        onChange={(v) => teEditState.onNySluttdatoChange(v)}
                        disabled={teEditState.isSubmitting}
                      />
                    </div>
                  )}

                  {/* Preklusjonsvarsel */}
                  {teEditState.preklusjonsvarsel && (
                    <div className={clsx(
                      'rounded-sm px-2 py-1 text-bento-caption',
                      teEditState.preklusjonsvarsel.variant === 'danger'
                        ? 'bg-alert-danger-bg text-alert-danger-text'
                        : 'bg-alert-warning-bg text-alert-warning-text',
                    )}>
                      ⚠️ {teEditState.preklusjonsvarsel.dager} dager siden oppdaget
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
          {!editState && hasBhResponse && hasDays && godkjentDager != null && (
            <div className="mt-2 pt-2">
              <hr className="border-pkt-border-subtle mx-1 mb-2" />
              <div className="flex items-end gap-4">
                <div>
                  <span className="text-bento-label text-pkt-text-body-subtle uppercase tracking-wide">Krevd</span>
                  <p className="text-bento-kpi font-semibold font-mono tabular-nums text-bento-krevd leading-tight">
                    {f.krevd_dager}d
                  </p>
                </div>
                <div>
                  <span className="text-bento-label text-pkt-text-body-subtle uppercase tracking-wide">
                    {isSubsidiary ? 'Subs.' : 'Godkjent'}
                  </span>
                  <p className="text-bento-kpi font-semibold font-mono tabular-nums text-pkt-brand-dark-green-1000 leading-tight">
                    {godkjentDager}d
                    {resolved && <CheckIcon className="w-3.5 h-3.5 inline ml-1 align-baseline" />}
                  </p>
                </div>
                {fristGrad != null && (
                  <div className="ml-auto text-right">
                    <span className="text-bento-label text-pkt-text-body-subtle uppercase tracking-wide">Godkj.grad</span>
                    <p className={clsx('text-bento-kpi font-bold font-mono tabular-nums leading-tight', getGradColor(fristGrad))}>
                      {fristGrad}%
                    </p>
                  </div>
                )}
              </div>
              {fristGrad != null && (
                <div className="mt-2 h-1.5 bg-pkt-grays-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pkt-brand-dark-green-1000 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(fristGrad, 100)}%` }}
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
          spor="frist"
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
