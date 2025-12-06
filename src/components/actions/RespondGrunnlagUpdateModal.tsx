/**
 * RespondGrunnlagUpdateModal Component
 *
 * Modal for BH to change their response on grunnlag (the "snuoperasjon").
 * CRITICAL: When changing from AVVIST to GODKJENT, all subsidiary
 * vederlag/frist responses become principal.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Textarea } from '../primitives/Textarea';
import { FormField } from '../primitives/FormField';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { Badge } from '../primitives/Badge';
import { RadioGroup, RadioItem } from '../primitives/RadioGroup';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useMemo } from 'react';
import { GrunnlagResponsResultat, SakState } from '../../types/timeline';

const updateResponseSchema = z.object({
  nytt_resultat: z.string().min(1, 'Du må velge et svar'),
  begrunnelse: z.string().min(10, 'Begrunnelse er påkrevd'),
});

type UpdateResponseFormData = z.infer<typeof updateResponseSchema>;

interface RespondGrunnlagUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  lastResponseEvent: {
    event_id: string;
    resultat: GrunnlagResponsResultat;
  };
  sakState: SakState;
}

const RESULTAT_LABELS: Record<GrunnlagResponsResultat | 'frafalt', string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avvist_uenig: 'Avvist (Uenig i ansvar)',
  avvist_for_sent: 'Avvist (Varslet for sent)',
  krever_avklaring: 'Krever avklaring',
  frafalt: 'Frafalt (§32.3 c)',
};

export function RespondGrunnlagUpdateModal({
  open,
  onOpenChange,
  sakId,
  lastResponseEvent,
  sakState,
}: RespondGrunnlagUpdateModalProps) {
  const forrigeResultat = lastResponseEvent.resultat;
  const varAvvist = forrigeResultat === 'avvist_uenig' || forrigeResultat === 'avvist_for_sent';
  const harSubsidiaereSvar = sakState.er_subsidiaert_vederlag || sakState.er_subsidiaert_frist;

  // Check if grunnlag is irregular change (§32.3 c - frafall only for irregular)
  const erIrregulaer = useMemo(() => {
    const grunnlag = sakState.grunnlag;
    if (!grunnlag) return false;
    const underkategorier = Array.isArray(grunnlag.underkategori)
      ? grunnlag.underkategori
      : grunnlag.underkategori ? [grunnlag.underkategori] : [];
    return grunnlag.hovedkategori === 'ENDRING' && underkategorier.includes('IRREG');
  }, [sakState.grunnlag]);

  // Get previous begrunnelse from grunnlag state
  const forrigeBegrunnelse = sakState.grunnlag?.bh_begrunnelse;

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    control,
    watch,
    reset,
  } = useForm<UpdateResponseFormData>({
    resolver: zodResolver(updateResponseSchema),
    defaultValues: {
      nytt_resultat: '',
      begrunnelse: '',
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const nyttResultat = watch('nytt_resultat') as GrunnlagResponsResultat;

  // Check if changing from rejected to approved
  const erSnuoperasjon = useMemo(() => {
    return varAvvist && (nyttResultat === 'godkjent' || nyttResultat === 'delvis_godkjent');
  }, [varAvvist, nyttResultat]);

  // Check if pulling back approval
  const trekkeTilbakeGodkjenning = useMemo(() => {
    return (forrigeResultat === 'godkjent' || forrigeResultat === 'delvis_godkjent') &&
      (nyttResultat === 'avvist_uenig' || nyttResultat === 'avvist_for_sent');
  }, [forrigeResultat, nyttResultat]);

  // Get available options based on current state
  const getOptions = () => {
    const options: { value: GrunnlagResponsResultat | 'frafalt'; label: string; description?: string }[] = [];

    if (varAvvist) {
      options.push({
        value: 'godkjent',
        label: 'Snu til: Godkjent',
        description: harSubsidiaereSvar
          ? 'VIKTIG: Alle subsidiære svar på vederlag/frist blir prinsipale.'
          : 'Ansvar aksepteres fullt ut.',
      });
      options.push({
        value: 'delvis_godkjent',
        label: 'Snu til: Delvis godkjent',
        description: 'Delvis aksept av ansvarsgrunnlaget.',
      });
      // Frafall only for irregular changes (§32.3 c)
      if (erIrregulaer) {
        options.push({
          value: 'frafalt',
          label: 'Frafall pålegget (§32.3 c)',
          description: 'Arbeidet skal IKKE utføres. Endringssaken bortfaller.',
        });
      }
    } else {
      options.push({
        value: 'avvist_uenig',
        label: 'Trekk tilbake: Avvis (Uenig)',
        description: 'Du mener likevel ikke at dette er BHs ansvar.',
      });
      options.push({
        value: 'avvist_for_sent',
        label: 'Trekk tilbake: Avvis (For sent)',
        description: 'Du mener varselet ble sendt for sent (preklusjon).',
      });
    }

    options.push({
      value: 'krever_avklaring',
      label: 'Krever avklaring',
      description: 'Du trenger mer informasjon før du kan ta stilling.',
    });

    return options;
  };

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: UpdateResponseFormData) => {
    mutation.mutate({
      eventType: 'respons_grunnlag_oppdatert',
      data: {
        original_respons_id: lastResponseEvent.event_id,
        nytt_resultat: data.nytt_resultat,
        begrunnelse: data.begrunnelse,
        dato_endret: new Date().toISOString().split('T')[0],
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Endre svar på grunnlag"
      description="Endre din vurdering av ansvarsgrunnlaget."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-06">
        {/* Current state */}
        <div className="bg-gray-50 p-4 rounded border border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Nåværende svar:</span>
            <Badge variant={varAvvist ? 'danger' : 'success'}>
              {RESULTAT_LABELS[forrigeResultat]}
            </Badge>
          </div>
          {forrigeBegrunnelse && (
            <p className="text-sm text-gray-700 mt-2 italic">
              &ldquo;{forrigeBegrunnelse}&rdquo;
            </p>
          )}
          {harSubsidiaereSvar && varAvvist && (
            <p className="text-xs text-gray-500 mt-2">
              Det finnes subsidiære svar på vederlag og/eller frist.
            </p>
          )}
        </div>

        {/* Snuoperasjon alert - CRITICAL */}
        {erSnuoperasjon && harSubsidiaereSvar && (
          <Alert variant="success" title="Snuoperasjon: Subsidiære svar blir prinsipale">
            <p>
              Ved å godkjenne grunnlaget nå, vil alle subsidiære svar på vederlag og frist
              automatisk konverteres til <strong>prinsipale</strong> svar.
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm">
              {sakState.er_subsidiaert_vederlag && (
                <li>
                  Vederlag: "{sakState.visningsstatus_vederlag}" blir gjeldende uten forbehold
                </li>
              )}
              {sakState.er_subsidiaert_frist && (
                <li>
                  Frist: "{sakState.visningsstatus_frist}" blir gjeldende uten forbehold
                </li>
              )}
            </ul>
          </Alert>
        )}

        {/* Warning about pulling back approval */}
        {trekkeTilbakeGodkjenning && (
          <Alert variant="danger" title="Advarsel: Trekker tilbake godkjenning">
            <p>
              Du trekker tilbake en tidligere godkjenning. Dette kan føre til tvist og
              potensielle konsekvenser i henhold til kontrakten.
            </p>
            <p className="mt-2 text-sm">
              Sørg for at du har god dokumentasjon for hvorfor godkjenningen trekkes tilbake.
            </p>
          </Alert>
        )}

        {/* Response options */}
        <FormField
          label="Ny avgjørelse"
          required
          error={errors.nytt_resultat?.message}
        >
          <Controller
            name="nytt_resultat"
            control={control}
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
              >
                {getOptions().map((option) => (
                  <RadioItem
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    description={option.description}
                  />
                ))}
              </RadioGroup>
            )}
          />
        </FormField>

        {/* Begrunnelse */}
        <FormField
          label="Begrunnelse for endring"
          required
          error={errors.begrunnelse?.message}
        >
          <Controller
            name="begrunnelse"
            control={control}
            render={({ field }) => (
              <Textarea
                id="begrunnelse"
                value={field.value}
                onChange={field.onChange}
                rows={4}
                fullWidth
                error={!!errors.begrunnelse}
                placeholder={
                  erSnuoperasjon
                    ? 'Begrunn hvorfor du nå aksepterer ansvarsgrunnlaget...'
                    : trekkeTilbakeGodkjenning
                      ? 'Begrunn hvorfor godkjenningen trekkes tilbake...'
                      : 'Begrunn endringen...'
                }
              />
            )}
          />
        </FormField>

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-pkt-04 pt-pkt-06 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            size="lg"
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant={erSnuoperasjon ? 'primary' : trekkeTilbakeGodkjenning ? 'danger' : 'primary'}
            disabled={isSubmitting || !nyttResultat}
            size="lg"
          >
            {isSubmitting ? 'Lagrer...' : erSnuoperasjon ? 'Godkjenn grunnlag' : 'Lagre endring'}
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
    </Modal>
  );
}
