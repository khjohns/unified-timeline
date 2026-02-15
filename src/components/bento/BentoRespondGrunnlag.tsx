/**
 * BentoRespondGrunnlag Component
 *
 * Judgment Panel redesign of RespondGrunnlagForm.
 * Split-panel layout: ClaimContextPanel (left) + verdict/response (right).
 * Replaces tabbed layout with progressive disclosure and VerdictCards.
 *
 * The original RespondGrunnlagForm is left unchanged.
 */

import {
  Alert,
  Badge,
  Button,
  DataList,
  DataListItem,
  FormField,
  RichTextEditor,
  Tooltip,
  useToast,
} from '../primitives';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { clsx } from 'clsx';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useFormBackup } from '../../hooks/useFormBackup';
import { useCatendaStatusHandler } from '../../hooks/useCatendaStatusHandler';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { useState, useEffect, useRef, useMemo } from 'react';
import { CheckIcon, Cross2Icon, InfoCircledIcon } from '@radix-ui/react-icons';
import type { GrunnlagResponsResultat, SakState } from '../../types/timeline';
import {
  getBhGrunnlagssvarValues,
} from '../../constants';
import { differenceInDays } from 'date-fns';
import { VerdictCards, type VerdictOption } from './VerdictCards';
import { ClaimContextPanel } from './ClaimContextPanel';
import { getConsequence } from './consequenceCallout';
import type { SporHistoryEntry } from '../views/SporHistory';

const respondGrunnlagSchema = z.object({
  grunnlag_varslet_i_tide: z.boolean().optional(),
  resultat: z.enum(getBhGrunnlagssvarValues(), {
    errorMap: () => ({ message: 'Resultat er påkrevd' }),
  }),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
});

type RespondGrunnlagFormData = z.infer<typeof respondGrunnlagSchema>;

interface GrunnlagEventInfo {
  hovedkategori?: string;
  underkategori?: string;
  beskrivelse?: string;
  dato_oppdaget?: string;
  dato_varslet?: string;
}

/** Labels for resultat display */
const RESULTAT_LABELS: Record<GrunnlagResponsResultat, string> = {
  godkjent: 'Godkjent',
  avslatt: 'Avslatt',
  frafalt: 'Frafalt (§32.3 c)',
};

export interface BentoRespondGrunnlagProps {
  sakId: string;
  grunnlagEventId: string;
  grunnlagEvent?: GrunnlagEventInfo;
  onSuccess: () => void;
  onCancel: () => void;
  onCatendaWarning?: () => void;
  approvalEnabled?: boolean;
  onSaveDraft?: (draftData: {
    resultat: string;
    begrunnelse: string;
    formData: RespondGrunnlagFormData;
  }) => void;
  lastResponseEvent?: {
    event_id: string;
    resultat: GrunnlagResponsResultat;
  };
  sakState?: SakState;
  grunnlagEntries?: SporHistoryEntry[];
  /** Hide context panel when rendered alongside MasterCard */
  hideContextPanel?: boolean;
  /** Externally controlled varslet i tide (from MasterCard) */
  externalVarsletITide?: boolean;
  /** Externally controlled resultat (from MasterCard) */
  externalResultat?: string;
}

export function BentoRespondGrunnlag({
  sakId,
  grunnlagEventId,
  grunnlagEvent,
  onSuccess,
  onCancel,
  onCatendaWarning,
  approvalEnabled = false,
  onSaveDraft,
  lastResponseEvent,
  sakState,
  grunnlagEntries,
  hideContextPanel = false,
  externalVarsletITide,
  externalResultat,
}: BentoRespondGrunnlagProps) {
  const isUpdateMode = !!lastResponseEvent;

  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();
  const { handleCatendaStatus } = useCatendaStatusHandler({ onWarning: onCatendaWarning });

  // §32.2 preklusjon applies to all ENDRING except EO
  const erEndringMed32_2 =
    grunnlagEvent?.hovedkategori === 'ENDRING' &&
    grunnlagEvent?.underkategori !== 'EO';

  // Pålegg: only IRREG and VALGRETT (§32.3 c frafall)
  const erPaalegg =
    grunnlagEvent?.hovedkategori === 'ENDRING' &&
    (grunnlagEvent?.underkategori === 'IRREG' || grunnlagEvent?.underkategori === 'VALGRETT');

  const computedDefaultValues = useMemo((): Partial<RespondGrunnlagFormData> => {
    if (isUpdateMode && lastResponseEvent) {
      return {
        grunnlag_varslet_i_tide: true,
        resultat: lastResponseEvent.resultat,
        begrunnelse: '',
      };
    }
    return {
      grunnlag_varslet_i_tide: true,
      resultat: undefined,
      begrunnelse: '',
    };
  }, [isUpdateMode, lastResponseEvent]);

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
    setValue,
  } = useForm<RespondGrunnlagFormData>({
    resolver: zodResolver(respondGrunnlagSchema),
    defaultValues: computedDefaultValues,
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    isUpdateMode ? 'respons_grunnlag_oppdatert' : 'respons_grunnlag',
    formData,
    isDirty
  );

  const freshValues = computedDefaultValues;

  // Auto-restore backup on mount
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (!hasCheckedBackup.current) {
      hasCheckedBackup.current = true;

      if (hasBackup && !isDirty) {
        const backup = getBackup();
        if (backup) {
          reset({ ...freshValues, ...backup });
          toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige okt.');
          return;
        }
      }

      reset(freshValues);
    }
  }, [hasBackup, isDirty, getBackup, reset, toast, freshValues]);

  // Sync externally controlled values from MasterCard
  useEffect(() => {
    if (externalVarsletITide !== undefined) {
      setValue('grunnlag_varslet_i_tide', externalVarsletITide);
    }
  }, [externalVarsletITide, setValue]);

  useEffect(() => {
    if (externalResultat !== undefined) {
      setValue('resultat', externalResultat as RespondGrunnlagFormData['resultat']);
    }
  }, [externalResultat, setValue]);

  const handleReset = () => {
    clearBackup();
    reset(freshValues);
  };

  const pendingToastId = useRef<string | null>(null);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: (result) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      clearBackup();
      reset();
      onSuccess();
      toast.success(
        isUpdateMode ? 'Svar oppdatert' : 'Svar sendt',
        isUpdateMode
          ? 'Din endring av svaret på ansvarsgrunnlaget er registrert.'
          : 'Ditt svar på ansvarsgrunnlaget er registrert.'
      );
      handleCatendaStatus(result);
    },
    onError: (error) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      }
    },
  });

  const selectedResultat = watch('resultat');
  const grunnlagVarsletITide = watch('grunnlag_varslet_i_tide');

  const erGrunnlagPrekludert = erEndringMed32_2 && grunnlagVarsletITide === false;
  const erForceMajeure = grunnlagEvent?.hovedkategori === 'FORCE_MAJEURE';

  // BH passivity (§32.3)
  const dagerSidenVarsel = grunnlagEvent?.dato_varslet
    ? differenceInDays(new Date(), new Date(grunnlagEvent.dato_varslet))
    : 0;
  const erPassiv = erEndringMed32_2 && dagerSidenVarsel > 10;

  // UPDATE MODE: Snuoperasjon detection
  const forrigeResultat = lastResponseEvent?.resultat;
  const varAvvist = forrigeResultat === 'avslatt';
  const harSubsidiaereSvar = sakState?.er_subsidiaert_vederlag || sakState?.er_subsidiaert_frist;

  const erSnuoperasjon = useMemo(() => {
    if (!isUpdateMode || !varAvvist) return false;
    return selectedResultat === 'godkjent';
  }, [isUpdateMode, varAvvist, selectedResultat]);

  const forrigeBegrunnelse = sakState?.grunnlag?.bh_begrunnelse;

  // ---------- NEW: Judgment Panel computed values ----------

  // Verdict card options
  const verdictOptions = useMemo((): VerdictOption[] => {
    const opts: VerdictOption[] = [
      { value: 'godkjent', label: 'Godkjent', description: 'Grunnlag for krav anerkjent', icon: 'check', colorScheme: 'green' },
      { value: 'avslatt', label: 'Avslått', description: 'Grunnlag for krav avvist', icon: 'cross', colorScheme: 'red' },
    ];
    if (erPaalegg) {
      opts.push({ value: 'frafalt', label: 'Frafalt', description: 'Pålegget frafalles', icon: 'undo', colorScheme: 'gray' });
    }
    return opts;
  }, [erPaalegg]);

  // Consequence callout (replaces multiple conditional alerts)
  const consequence = useMemo(() => getConsequence({
    resultat: selectedResultat,
    erEndringMed32_2,
    varsletITide: grunnlagVarsletITide,
    erForceMajeure,
    erSnuoperasjon,
    harSubsidiaereSvar: !!harSubsidiaereSvar,
  }), [selectedResultat, erEndringMed32_2, grunnlagVarsletITide, erForceMajeure, erSnuoperasjon, harSubsidiaereSvar]);

  // Dynamic placeholder for begrunnelse
  const dynamicPlaceholder = useMemo(() => {
    if (!selectedResultat) return 'Velg resultat over for å skrive begrunnelse...';
    if (erGrunnlagPrekludert && selectedResultat === 'godkjent') return 'Begrunn din preklusjonsinnsigelse og din subsidiære godkjenning...';
    if (erGrunnlagPrekludert && selectedResultat === 'avslatt') return 'Begrunn din preklusjonsinnsigelse og ditt subsidiære avslag...';
    if (selectedResultat === 'godkjent') return 'Begrunn din vurdering av ansvarsgrunnlaget...';
    if (selectedResultat === 'avslatt') return 'Forklar hvorfor forholdet ikke gir grunnlag for krav...';
    if (selectedResultat === 'frafalt') return 'Begrunn hvorfor pålegget frafalles...';
    return 'Begrunn din vurdering...';
  }, [selectedResultat, erGrunnlagPrekludert]);

  // ---------- Handlers ----------

  const handleSaveDraft = (data: RespondGrunnlagFormData) => {
    if (!onSaveDraft) return;

    onSaveDraft({
      resultat: data.resultat,
      begrunnelse: data.begrunnelse,
      formData: data,
    });

    clearBackup();
    reset();
    onSuccess();
    toast.success('Utkast lagret', 'Svaret på ansvarsgrunnlaget er lagret som utkast. Du kan nå sende det til godkjenning.');
  };

  const onSubmit = (data: RespondGrunnlagFormData) => {
    pendingToastId.current = toast.pending(
      isUpdateMode ? 'Lagrer endringer...' : 'Sender svar...',
      'Vennligst vent mens svaret behandles.'
    );

    if (isUpdateMode && lastResponseEvent) {
      mutation.mutate({
        eventType: 'respons_grunnlag_oppdatert',
        data: {
          original_respons_id: lastResponseEvent.event_id,
          resultat: data.resultat,
          begrunnelse: data.begrunnelse,
          dato_endret: new Date().toISOString().split('T')[0],
        },
      });
      return;
    }

    mutation.mutate({
      eventType: 'respons_grunnlag',
      data: {
        grunnlag_event_id: grunnlagEventId,
        resultat: data.resultat,
        begrunnelse: data.begrunnelse,
        grunnlag_varslet_i_tide: erEndringMed32_2 ? data.grunnlag_varslet_i_tide : undefined,
        dager_siden_varsel: dagerSidenVarsel > 0 ? dagerSidenVarsel : undefined,
      },
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
        {/* Update mode: current response banner (stays at top, above grid) */}
        {isUpdateMode && lastResponseEvent && (
          <div className="mb-4 rounded-lg border border-pkt-border-subtle bg-pkt-bg-subtle p-4">
            <p className="text-[10px] font-medium text-pkt-text-body-muted uppercase tracking-wide mb-2">Nåværende svar</p>
            <DataList variant="grid">
              <DataListItem label="Resultat">
                <Badge variant={varAvvist ? 'danger' : 'success'}>
                  {forrigeResultat ? RESULTAT_LABELS[forrigeResultat] : 'Ukjent'}
                </Badge>
              </DataListItem>
              {forrigeBegrunnelse && (
                <DataListItem label="Begrunnelse">
                  <span className="italic">&ldquo;{forrigeBegrunnelse}&rdquo;</span>
                </DataListItem>
              )}
            </DataList>
            {harSubsidiaereSvar && varAvvist && (
              <p className="text-xs text-pkt-grays-gray-500 mt-2">
                Det finnes subsidiaere svar på vederlag og/eller frist.
              </p>
            )}
          </div>
        )}

        {/* Update mode: Snuoperasjon alert */}
        {isUpdateMode && erSnuoperasjon && harSubsidiaereSvar && (
          <div className="mb-4">
            <Alert variant="success" title="Snuoperasjon: Subsidiaere svar blir prinsipale">
              <p>
                Ved å godkjenne grunnlaget nå, vil alle subsidiaere svar på vederlag og frist
                automatisk konverteres til <strong>prinsipale</strong> svar.
              </p>
              <ul className="list-disc pl-5 mt-2 text-xs">
                {sakState?.er_subsidiaert_vederlag && (
                  <li>
                    Vederlag: &ldquo;{sakState.visningsstatus_vederlag}&rdquo; blir gjeldende uten forbehold
                  </li>
                )}
                {sakState?.er_subsidiaert_frist && (
                  <li>
                    Frist: &ldquo;{sakState.visningsstatus_frist}&rdquo; blir gjeldende uten forbehold
                  </li>
                )}
              </ul>
            </Alert>
          </div>
        )}

        {/* ===== LAYOUT: split panel or single column ===== */}
        <div className={hideContextPanel ? '' : 'grid grid-cols-1 md:grid-cols-12 gap-0 md:gap-6'}>
          {/* Left: Claim context (col-5) — hidden when MasterCard provides context */}
          {!hideContextPanel && (
            <div className="md:col-span-5">
              <ClaimContextPanel
                grunnlagEvent={grunnlagEvent ?? {}}
                entries={grunnlagEntries ?? []}
              />
            </div>
          )}

          {/* Response panel — scroll container with sticky footer */}
          <div className={hideContextPanel ? 'max-h-[70vh] overflow-y-auto' : 'md:col-span-7 max-h-[70vh] overflow-y-auto'}>
            <div className="space-y-5">
              {/* Inline controls — only when NOT managed by MasterCard */}
              {!hideContextPanel && (
                <>
                  {/* §32.2 Varselvurdering — compact inline toggle */}
                  {erEndringMed32_2 && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-pkt-text-body-default">
                        Varslet i tide?
                      </span>
                      <Tooltip
                        content={
                          <div className="max-w-sm text-xs space-y-2">
                            <p><strong>§32.2</strong> – Entreprenørens varslingsplikt: Mottar totalentreprenøren pålegg uten endringsordre og mener det utgjør en endring, må han varsle byggherren skriftlig uten ugrunnet opphold.</p>
                            <p><strong>§32.3</strong> – Byggherrens svarplikt: Mottar byggherren varsel etter §32.2, skal han besvare det uten ugrunnet opphold ved å (a) utstede endringsordre, (b) avslå kravet, eller (c) frafalle pålegget.</p>
                            <p><strong>§5</strong> – Påberopelse: Byggherren må påberope at varselet er for sent skriftlig uten ugrunnet opphold.</p>
                          </div>
                        }
                        side="right"
                      >
                        <button type="button" className="text-pkt-text-body-muted hover:text-pkt-text-body-default">
                          <InfoCircledIcon className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                      <Controller
                        name="grunnlag_varslet_i_tide"
                        control={control}
                        render={({ field }) => (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => field.onChange(true)}
                              className={clsx(
                                'flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-all cursor-pointer',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pkt-border-focus',
                                field.value === true
                                  ? 'border-pkt-brand-dark-green-1000 bg-pkt-brand-dark-green-1000/5 text-pkt-brand-dark-green-1000'
                                  : 'border-pkt-border-default bg-pkt-bg-subtle text-pkt-text-body-default',
                                field.value !== undefined && field.value !== true && 'opacity-50',
                              )}
                            >
                              <CheckIcon className="w-3.5 h-3.5" />
                              Ja
                            </button>
                            <button
                              type="button"
                              onClick={() => field.onChange(false)}
                              className={clsx(
                                'flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-all cursor-pointer',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pkt-border-focus',
                                field.value === false
                                  ? 'border-pkt-brand-red-1000 bg-pkt-brand-red-1000/5 text-pkt-brand-red-1000'
                                  : 'border-pkt-border-default bg-pkt-bg-subtle text-pkt-text-body-default',
                                field.value !== undefined && field.value !== false && 'opacity-50',
                              )}
                            >
                              <Cross2Icon className="w-3.5 h-3.5" />
                              Nei
                            </button>
                          </div>
                        )}
                      />
                    </div>
                  )}

                  {/* Verdict cards */}
                  <div>
                    <p className="text-xs font-medium text-pkt-text-body-default mb-2">
                      {erGrunnlagPrekludert ? 'Ditt svar (subsidiært)' : 'Ditt svar'}
                    </p>
                    <Controller
                      name="resultat"
                      control={control}
                      render={({ field }) => (
                        <VerdictCards
                          value={field.value}
                          onChange={field.onChange}
                          error={!!errors.resultat}
                          options={verdictOptions}
                        />
                      )}
                    />
                    {errors.resultat && (
                      <p className="text-xs text-pkt-brand-red-1000 mt-1">{errors.resultat.message}</p>
                    )}
                  </div>
                </>
              )}

              {/* Passivitetsvarsel (>10 dager) */}
              {erPassiv && (
                <Alert variant="danger" size="sm" title="Passivitetsrisiko (§32.3)">
                  Du har brukt <strong>{dagerSidenVarsel} dager</strong> på å svare.
                  Passivitet kan medføre at forholdet anses som en endring.
                </Alert>
              )}

              {/* Validation error when resultat is managed by MasterCard */}
              {hideContextPanel && errors.resultat && (
                <Alert variant="danger" size="sm">
                  Velg resultat i kortet til venstre
                </Alert>
              )}

              {/* Consequence callout — single dynamic alert */}
              {consequence && (
                <Alert variant={consequence.variant} size="sm">
                  {consequence.text}
                  {consequence.snuoperasjonText && (
                    <p className="mt-2 font-medium">{consequence.snuoperasjonText}</p>
                  )}
                </Alert>
              )}

              {/* Begrunnelse — always visible, no tab switch */}
              <FormField
                label="Byggherrens begrunnelse"
                required
                error={errors.begrunnelse?.message}
              >
                <Controller
                  name="begrunnelse"
                  control={control}
                  render={({ field }) => (
                    <RichTextEditor
                      id="begrunnelse"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      minHeight={280}
                      fullWidth
                      error={!!errors.begrunnelse}
                      placeholder={dynamicPlaceholder}
                    />
                  )}
                />
              </FormField>

              {/* Error */}
              {mutation.isError && (
                <Alert variant="danger" title="Feil ved innsending">
                  {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
                </Alert>
              )}
            </div>

            {/* Footer — sticky at bottom of scroll container */}
            <div className="sticky bottom-0 bg-pkt-bg-subtle pt-1">
              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4 pb-1 border-t-2 border-pkt-border-subtle">
                {/* Left: Tilbakestill (update mode only) */}
                <div>
                  {isUpdateMode && isDirty && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      disabled={isSubmitting}
                    >
                      Tilbakestill
                    </Button>
                  )}
                </div>

                {/* Right: Avbryt + Submit */}
                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    Avbryt
                  </Button>

                  {approvalEnabled ? (
                    <Button
                      type="button"
                      variant="primary"
                      loading={isSubmitting}
                      className="w-full sm:w-auto"
                      onClick={handleSubmit(handleSaveDraft)}
                      data-testid="respond-grunnlag-submit"
                    >
                      Lagre utkast
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      variant={selectedResultat === 'avslatt' || erGrunnlagPrekludert ? 'danger' : 'primary'}
                      loading={isSubmitting}
                      className="w-full sm:w-auto"
                      data-testid="respond-grunnlag-submit"
                    >
                      {isUpdateMode
                        ? (erSnuoperasjon ? 'Godkjenn ansvarsgrunnlag' : 'Lagre endring')
                        : 'Send svar'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
    </>
  );
}
