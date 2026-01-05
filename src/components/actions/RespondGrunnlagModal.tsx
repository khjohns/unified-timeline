/**
 * RespondGrunnlagModal Component
 *
 * Action modal for BH (client) to respond to a grunnlag claim.
 * Uses React Hook Form + Zod for validation.
 *
 * UPDATED (2025-12-05):
 * - Added BH passivity warning (§32.3) for irregular changes
 * - Added Force Majeure recognition option
 * - Added Frafall option (§32.3 c)
 * - Added subsidiary treatment info when rejecting
 * - Added display of grunnlag claim details
 */

import {
  Alert,
  AlertDialog,
  Button,
  FormField,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  Textarea,
  useToast,
} from '../primitives';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { useState, useEffect, useRef } from 'react';
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

interface RespondGrunnlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the grunnlag event being responded to (required for event sourcing) */
  grunnlagEventId: string;
  /** Optional grunnlag event data for context display and logic */
  grunnlagEvent?: GrunnlagEventInfo;
}

export function RespondGrunnlagModal({
  open,
  onOpenChange,
  sakId,
  grunnlagEventId,
  grunnlagEvent,
}: RespondGrunnlagModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
  } = useForm<RespondGrunnlagFormData>({
    resolver: zodResolver(respondGrunnlagSchema),
    defaultValues: {
      resultat: undefined,
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'respons_grunnlag', formData, isDirty);

  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && hasBackup && !isDirty && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;
      setShowRestorePrompt(true);
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, isDirty]);
  const handleRestoreBackup = () => { const backup = getBackup(); if (backup) reset(backup); setShowRestorePrompt(false); };
  const handleDiscardBackup = () => { clearBackup(); setShowRestorePrompt(false); };

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => { clearBackup(); reset(); onOpenChange(false); toast.success('Svar sendt', 'Ditt svar på grunnlagsvarselet er registrert.'); },
    onError: (error) => { if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') setShowTokenExpired(true); },
  });

  const selectedResultat = watch('resultat');

  // Determine special cases based on grunnlag data
  const erIrregulaer =
    grunnlagEvent?.hovedkategori === 'ENDRING' &&
    (Array.isArray(grunnlagEvent?.underkategori)
      ? grunnlagEvent.underkategori.includes('IRREG')
      : grunnlagEvent?.underkategori === 'IRREG');

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

  const onSubmit = (data: RespondGrunnlagFormData) => {
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
      title="Svar på grunnlag"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
          </SectionContainer>
        )}

        {/* Force Majeure info */}
        {erForceMajeure && (
          <Alert variant="warning" title="Force Majeure (§33.3)">
            Force Majeure gir kun rett til <strong>fristforlengelse</strong>,
            ikke vederlagsjustering. Vurder om hendelsen ligger utenfor
            entreprenørens kontroll.
          </Alert>
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

                      // Force Majeure: Can recognize or reject
                      // FM is binary - either it qualifies as FM or it doesn't
                      if (erForceMajeure) {
                        return ['erkjenn_fm', 'avslatt'].includes(opt.value);
                      }

                      // Non-FM cases: filter out FM option and conditional options
                      if (opt.value === 'erkjenn_fm') return false;
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

            {/* Force Majeure recognition info (§33.3) */}
            {selectedResultat === 'erkjenn_fm' && (
              <Alert variant="success" title="Konsekvens av å erkjenne Force Majeure">
                <p>
                  Ved å erkjenne Force Majeure godtar du at forholdet ligger utenfor
                  entreprenørens kontroll. Entreprenøren får kun rett til{' '}
                  <strong>fristforlengelse</strong> – ikke vederlagsjustering.
                </p>
                <p className="mt-2">
                  Du vil deretter kunne ta stilling til fristforlengelseskravet
                  (antall kalenderdager).
                </p>
              </Alert>
            )}

            {/* Subsidiary treatment warning when rejecting */}
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

            {/* EO generation info when approving */}
            {selectedResultat === 'godkjent' && !erForceMajeure && (
              <Alert variant="success" title="Systemhandling">
                Når du sender svaret, vil systemet automatisk registrere at
                grunnlaget er godkjent. Endringsordre (EO) kan utstedes når
                vederlag og frist også er avklart.
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
                : 'Begrunn din vurdering av grunnlaget'
            }
          >
            <Textarea
              id="begrunnelse"
              {...register('begrunnelse')}
              rows={5}
              fullWidth
              error={!!errors.begrunnelse}
              data-testid="respond-grunnlag-begrunnelse"
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
            onClick={handleClose}
            disabled={isSubmitting}
            size="lg"
            className="w-full sm:w-auto"
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant={selectedResultat === 'avslatt' ? 'danger' : 'primary'}
            loading={isSubmitting}
            size="lg"
            className="w-full sm:w-auto"
            data-testid="respond-grunnlag-submit"
          >
            Send svar
          </Button>
        </div>
      </form>

      {/* Confirm close dialog */}
      <AlertDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Forkast endringer?"
        description="Du har ulagrede endringer som vil gå tapt hvis du lukker skjemaet."
        confirmLabel="Forkast"
        cancelLabel="Fortsett redigering"
        onConfirm={confirmClose}
        variant="warning"
      />
      <AlertDialog
        open={showRestorePrompt}
        onOpenChange={(open) => { if (!open) handleDiscardBackup(); }}
        title="Gjenopprette lagrede data?"
        description="Det finnes data fra en tidligere økt som ikke ble sendt inn. Vil du fortsette der du slapp?"
        confirmLabel="Gjenopprett"
        cancelLabel="Start på nytt"
        onConfirm={handleRestoreBackup}
        variant="info"
      />
      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
    </Modal>
  );
}
