/**
 * RespondGrunnlagModal Component
 *
 * Action modal for BH (client) to respond to a grunnlag claim,
 * or update an existing response (when lastResponseEvent is provided).
 * Uses React Hook Form + Zod for validation.
 *
 * MODES:
 * - Create mode (default): Submit new response with event type 'respons_grunnlag'
 * - Update mode (when lastResponseEvent provided): Update existing response with 'respons_grunnlag_oppdatert'
 *
 * UPDATED (2025-12-05):
 * - Added BH passivity warning (§32.3) for irregular changes
 * - Added Force Majeure recognition option
 * - Added Frafall option (§32.3 c)
 * - Added subsidiary treatment info when rejecting
 * - Added display of grunnlag claim details
 *
 * UPDATED (2025-01-08):
 * - Merged RespondGrunnlagUpdateModal into this component via lastResponseEvent prop
 * - Added snuoperasjon logic for subsidiary responses
 */

import {
  Alert,
  Badge,
  Button,
  DataList,
  DataListItem,
  FormField,
  MarkdownEditor,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  useToast,
} from '../primitives';
import { KontraktsregelInline } from '../shared';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { useState, useEffect, useRef, useMemo } from 'react';
import type { GrunnlagResponsResultat, SakState } from '../../types/timeline';
import {
  BH_GRUNNLAGSVAR_OPTIONS,
  getBhGrunnlagssvarValues,
  BH_GRUNNLAGSVAR_DESCRIPTIONS,
  getHovedkategoriLabel,
  getUnderkategoriLabel,
} from '../../constants';
import { differenceInDays } from 'date-fns';

const respondGrunnlagSchema = z.object({
  resultat: z.enum(getBhGrunnlagssvarValues(), {
    errorMap: () => ({ message: 'Resultat er påkrevd' }),
  }),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
});

type RespondGrunnlagFormData = z.infer<typeof respondGrunnlagSchema>;

// Event data from the grunnlag claim
interface GrunnlagEventInfo {
  hovedkategori?: string;
  underkategori?: string | string[];
  beskrivelse?: string;
  dato_oppdaget?: string;
  dato_varslet?: string;
}

/** Labels for resultat display */
const RESULTAT_LABELS: Record<GrunnlagResponsResultat, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  frafalt: 'Frafalt (§32.3 c)',
  krever_avklaring: 'Krever avklaring',
};

interface RespondGrunnlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the grunnlag event being responded to (required for event sourcing) */
  grunnlagEventId: string;
  /** Optional grunnlag event data for context display and logic */
  grunnlagEvent?: GrunnlagEventInfo;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
  /** When true, show "Lagre utkast" instead of "Send svar" for approval workflow */
  approvalEnabled?: boolean;
  /** Callback when saving as draft (for approval workflow) */
  onSaveDraft?: (draftData: {
    resultat: string;
    begrunnelse: string;
    formData: RespondGrunnlagFormData;
  }) => void;
  /** UPDATE MODE: Previous response event to update. If provided, modal operates in update mode. */
  lastResponseEvent?: {
    event_id: string;
    resultat: GrunnlagResponsResultat;
  };
  /** Required in update mode for snuoperasjon logic */
  sakState?: SakState;
}

export function RespondGrunnlagModal({
  open,
  onOpenChange,
  sakId,
  grunnlagEventId,
  grunnlagEvent,
  onCatendaWarning,
  approvalEnabled = false,
  onSaveDraft,
  lastResponseEvent,
  sakState,
}: RespondGrunnlagModalProps) {
  // UPDATE MODE detection
  const isUpdateMode = !!lastResponseEvent;

  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();

  // Compute default values based on mode
  const computedDefaultValues = useMemo((): Partial<RespondGrunnlagFormData> => {
    if (isUpdateMode && lastResponseEvent) {
      // UPDATE MODE: Pre-fill with previous response (user will change it)
      return {
        resultat: lastResponseEvent.resultat,
        begrunnelse: '',
      };
    }
    // CREATE MODE: Empty defaults
    return {
      resultat: undefined,
      begrunnelse: '',
    };
  }, [isUpdateMode, lastResponseEvent]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
  } = useForm<RespondGrunnlagFormData>({
    resolver: zodResolver(respondGrunnlagSchema),
    defaultValues: computedDefaultValues,
  });

  // Reset form when opening in update mode with new lastResponseEvent
  useEffect(() => {
    if (open && isUpdateMode && lastResponseEvent) {
      reset(computedDefaultValues);
    }
  }, [open, isUpdateMode, lastResponseEvent, reset, computedDefaultValues]);

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    isUpdateMode ? 'respons_grunnlag_oppdatert' : 'respons_grunnlag',
    formData,
    isDirty
  );

  // Auto-restore backup on mount (silent restoration with toast notification)
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && hasBackup && !isDirty && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;
      const backup = getBackup();
      if (backup) {
        reset(backup);
        toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
      }
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, isDirty, getBackup, reset, toast]);

  // Track pending toast for dismissal
  const pendingToastId = useRef<string | null>(null);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: (result) => {
      // Dismiss pending toast and show success
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      clearBackup();
      reset();
      onOpenChange(false);
      toast.success(
        isUpdateMode ? 'Svar oppdatert' : 'Svar sendt',
        isUpdateMode
          ? 'Din endring av svaret på ansvarsgrunnlaget er registrert.'
          : 'Ditt svar på ansvarsgrunnlaget er registrert.'
      );
      if (!result.catenda_synced) {
        onCatendaWarning?.();
      }
    },
    onError: (error) => {
      // Dismiss pending toast
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

  // Determine special cases based on grunnlag data
  const erIrregulaer =
    grunnlagEvent?.hovedkategori === 'ENDRING' &&
    (Array.isArray(grunnlagEvent?.underkategori)
      ? grunnlagEvent.underkategori.includes('IRREG')
      : grunnlagEvent?.underkategori === 'IRREG');

  // Check if this is a Force Majeure case (affects available compensation)
  const erForceMajeure = grunnlagEvent?.hovedkategori === 'FORCE_MAJEURE';

  // Calculate BH passivity (§32.3) - only for irregular changes
  const dagerSidenVarsel = grunnlagEvent?.dato_varslet
    ? differenceInDays(new Date(), new Date(grunnlagEvent.dato_varslet))
    : 0;
  const erPassiv = erIrregulaer && dagerSidenVarsel > 10;

  // Get display labels
  const hovedkategoriLabel = grunnlagEvent?.hovedkategori
    ? getHovedkategoriLabel(grunnlagEvent.hovedkategori)
    : undefined;

  const underkategoriLabels = grunnlagEvent?.underkategori
    ? Array.isArray(grunnlagEvent.underkategori)
      ? grunnlagEvent.underkategori.map(getUnderkategoriLabel).join(', ')
      : getUnderkategoriLabel(grunnlagEvent.underkategori)
    : undefined;

  // UPDATE MODE: Snuoperasjon detection
  const forrigeResultat = lastResponseEvent?.resultat;
  const varAvvist = forrigeResultat === 'avslatt';
  const harSubsidiaereSvar = sakState?.er_subsidiaert_vederlag || sakState?.er_subsidiaert_frist;

  // Check if changing from rejected to approved (snuoperasjon)
  const erSnuoperasjon = useMemo(() => {
    if (!isUpdateMode || !varAvvist) return false;
    return selectedResultat === 'godkjent' || selectedResultat === 'delvis_godkjent';
  }, [isUpdateMode, varAvvist, selectedResultat]);

  // Get previous begrunnelse from sakState (for update mode display)
  const forrigeBegrunnelse = sakState?.grunnlag?.bh_begrunnelse;

  // Handler for saving as draft (approval workflow)
  const handleSaveDraft = (data: RespondGrunnlagFormData) => {
    if (!onSaveDraft) return;

    onSaveDraft({
      resultat: data.resultat,
      begrunnelse: data.begrunnelse,
      formData: data,
    });

    // Clear backup and close modal
    clearBackup();
    reset();
    onOpenChange(false);
    toast.success('Utkast lagret', 'Svaret på ansvarsgrunnlaget er lagret som utkast. Du kan nå sende det til godkjenning.');
  };

  const onSubmit = (data: RespondGrunnlagFormData) => {
    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending(
      isUpdateMode ? 'Lagrer endringer...' : 'Sender svar...',
      'Vennligst vent mens svaret behandles.'
    );

    // ========== UPDATE MODE SUBMIT ==========
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

    // ========== CREATE MODE SUBMIT ==========
    mutation.mutate({
      eventType: 'respons_grunnlag',
      data: {
        grunnlag_event_id: grunnlagEventId,
        // NOTE: spor is auto-derived from event_type in backend parse_event_from_request
        ...data,
        // Include metadata about passive acceptance if relevant
        dager_siden_varsel: dagerSidenVarsel > 0 ? dagerSidenVarsel : undefined,
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isUpdateMode ? "Endre svar på ansvarsgrunnlag" : "Svar på ansvarsgrunnlag"}
      description={isUpdateMode ? "Endre din vurdering av ansvarsgrunnlaget." : undefined}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* UPDATE MODE: Nåværende svar */}
        {isUpdateMode && lastResponseEvent && (
          <SectionContainer title="Nåværende svar" variant="subtle">
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
                Det finnes subsidiære svar på vederlag og/eller frist.
              </p>
            )}
          </SectionContainer>
        )}

        {/* UPDATE MODE: Snuoperasjon alert - CRITICAL */}
        {isUpdateMode && erSnuoperasjon && harSubsidiaereSvar && (
          <Alert variant="success" title="Snuoperasjon: Subsidiære svar blir prinsipale">
            <p>
              Ved å godkjenne grunnlaget nå, vil alle subsidiære svar på vederlag og frist
              automatisk konverteres til <strong>prinsipale</strong> svar.
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm">
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
        )}

        {/* Kontekst: Entreprenørens påstand */}
        {grunnlagEvent && (hovedkategoriLabel || grunnlagEvent.beskrivelse) && (
          <SectionContainer title="Entreprenørens påstand" variant="subtle">
            {hovedkategoriLabel && (
              <p className="text-sm">
                <span className="font-medium">{hovedkategoriLabel}</span>
                {underkategoriLabels && (
                  <span className="text-pkt-text-body-subtle">
                    {' '}
                    - {underkategoriLabels}
                  </span>
                )}
              </p>
            )}
            {grunnlagEvent.beskrivelse && (
              <p className="italic text-pkt-text-body-subtle mt-2 text-sm">
                &ldquo;{grunnlagEvent.beskrivelse}&rdquo;
              </p>
            )}
            {(grunnlagEvent.dato_varslet || grunnlagEvent.dato_oppdaget) && (
              <p className="text-xs text-pkt-text-body-subtle mt-2">
                {grunnlagEvent.dato_varslet && (
                  <span>Varslet: {grunnlagEvent.dato_varslet}</span>
                )}
                {grunnlagEvent.dato_oppdaget && (
                  <span className="ml-3">
                    Oppdaget: {grunnlagEvent.dato_oppdaget}
                  </span>
                )}
              </p>
            )}
            {/* Varslingsregler hint */}
            {grunnlagEvent.hovedkategori && (
              <p className="text-xs text-pkt-text-muted mt-3 pt-2 border-t border-pkt-border-subtle">
                <span className="font-medium">Varslingsregler:</span>{' '}
                {grunnlagEvent.hovedkategori === 'ENDRING' ? (
                  <>Grunnlag (§32.2) · Frist (§33.4) · Vederlag (§34.1.1)</>
                ) : grunnlagEvent.hovedkategori === 'FORCE_MAJEURE' ? (
                  <>Frist (§33.4) – kun fristforlengelse</>
                ) : (
                  <>Grunnlag (§25.1.2) · Frist (§33.4) · Vederlag (§34.1.2)</>
                )}
              </p>
            )}
          </SectionContainer>
        )}

        {/* Force Majeure info */}
        {erForceMajeure && (
          <KontraktsregelInline hjemmel="§33.3" />
        )}

        {/* BH Passivity warning (§32.3) */}
        {erPassiv && (
          <Alert variant="danger" title="Passivitetsrisiko (§32.3)">
            <p className="font-medium">
              Du har brukt <strong>{dagerSidenVarsel} dager</strong> på å svare
              på dette varselet om irregulær endring.
            </p>
            <p className="mt-2">
              Ved irregulær endring kan passivitet medføre at endringen anses
              akseptert. Hvis du avslår, bør du dokumentere hvorfor forsinkelsen
              var begrunnet.
            </p>
          </Alert>
        )}

        {/* Vurdering */}
        <SectionContainer
          title="Vurdering"
          description="Vurder kun ansvarsgrunnlaget. Vederlag og frist behandles separat."
        >
          <div className="space-y-4">
            <FormField
              label="Resultat (ansvarsgrunnlag)"
              required
              error={errors.resultat?.message}
              labelTooltip="Vurder BARE ansvaret. Hvis avvist, kan vederlag/frist fortsatt vurderes subsidiært."
            >
              <Controller
                name="resultat"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    data-testid="respond-grunnlag-resultat"
                  >
                    {BH_GRUNNLAGSVAR_OPTIONS.filter((opt) => {
                      // Filter out empty placeholder
                      if (opt.value === '') return false;

                      // Filter out "frafalt" if NOT irregular change (§32.3 c)
                      if (opt.value === 'frafalt' && !erIrregulaer) return false;
                      return true;
                    }).map((option) => (
                      <RadioItem
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        error={!!errors.resultat}
                      />
                    ))}
                  </RadioGroup>
                )}
              />
            </FormField>

            {/* Show description of selected resultat */}
            {selectedResultat &&
              BH_GRUNNLAGSVAR_DESCRIPTIONS[selectedResultat] && (
                <div className="p-3 bg-pkt-surface-subtle rounded-none border-l-4 border-pkt-border-focus">
                  <p className="text-sm text-pkt-text-body-subtle">
                    {BH_GRUNNLAGSVAR_DESCRIPTIONS[selectedResultat]}
                  </p>
                </div>
              )}

            {/* Frafall info (§32.3 c) */}
            {selectedResultat === 'frafalt' && (
              <Alert variant="info" title="Frafall av pålegget (§32.3 c)">
                Ved å frafalle pålegget bekrefter du at arbeidet <strong>ikke skal
                utføres</strong>. Dette er en endelig beslutning for irregulære
                endringer (§32.2). Entreprenøren trenger ikke å utføre det pålagte
                arbeidet, og saken avsluttes.
              </Alert>
            )}

            {/* Force Majeure approval info (§33.3) */}
            {selectedResultat === 'godkjent' && erForceMajeure && (
              <Alert variant="success" title="Force Majeure - kun fristforlengelse (§33.3)">
                <p>
                  Ved å godkjenne ansvarsgrunnlaget bekrefter du at forholdet ligger utenfor
                  entreprenørens kontroll. Entreprenøren får kun rett til{' '}
                  <strong>fristforlengelse</strong> – ikke vederlagsjustering.
                </p>
                <p className="mt-2">
                  Du vil deretter kunne ta stilling til fristforlengelseskravet
                  (antall kalenderdager).
                </p>
              </Alert>
            )}

            {/* FM rejection info */}
            {selectedResultat === 'avslatt' && erForceMajeure && (
              <Alert variant="warning" title="Konsekvens av avslag">
                <p>
                  Du mener at forholdet <strong>ikke</strong> kvalifiserer som Force Majeure
                  (§33.3). Dette kan være fordi hendelsen var forutsigbar, kunne vært
                  unngått, eller ikke er tilstrekkelig ekstraordinær.
                </p>
                <p className="mt-2">
                  Entreprenøren vil likevel kunne sende inn krav om fristforlengelse.
                  Du må da behandle kravet <strong>subsidiært</strong>.
                </p>
              </Alert>
            )}

            {/* Subsidiary treatment warning when rejecting (non-FM) */}
            {selectedResultat === 'avslatt' && !erForceMajeure && (
              <Alert variant="warning" title="Konsekvens av avslag">
                <p>
                  Saken markeres som <em>omtvistet</em>. Entreprenøren vil likevel
                  kunne sende inn krav om Vederlag og Frist. Du må da behandle disse
                  kravene <strong>subsidiært</strong> (dvs. &ldquo;hva kravet hadde
                  vært verdt <em>hvis</em> du tok feil om ansvaret&rdquo;).
                </p>
                <p className="mt-2">
                  Dette sikrer at dere får avklart uenighet om beregning (utmåling)
                  tidlig, selv om dere er uenige om ansvaret.
                </p>
              </Alert>
            )}

          </div>
        </SectionContainer>

        {/* Begrunnelse */}
        <SectionContainer title="Begrunnelse">
          <FormField
            label="Din begrunnelse"
            required
            error={errors.begrunnelse?.message}
            helpText={
              selectedResultat === 'avslatt'
                ? 'Forklar hvorfor du mener forholdet er en del av kontrakten eller entreprenørens risiko'
                : 'Begrunn din vurdering av ansvarsgrunnlaget'
            }
          >
            <Controller
              name="begrunnelse"
              control={control}
              render={({ field }) => (
                <MarkdownEditor
                  id="begrunnelse"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  rows={8}
                  fullWidth
                  error={!!errors.begrunnelse}
                  placeholder="Begrunn din vurdering..."
                />
              )}
            />
          </FormField>
        </SectionContainer>

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
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
              variant={selectedResultat === 'avslatt' ? 'danger' : 'primary'}
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
      </form>

      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
    </Modal>
  );
}
