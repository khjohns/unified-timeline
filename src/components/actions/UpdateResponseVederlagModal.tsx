/**
 * UpdateResponseVederlagModal Component
 *
 * Modal for BH to update their response on vederlag claim.
 * Key logic: Can release HOLD_TILBAKE when TE has provided overslag (§30.2)
 *
 * UPDATED (2025-12-05):
 * - Fixed overslag detection to check vederlagTilstand.kostnads_overslag
 * - Updated to use new field names (belop_direkte/kostnads_overslag)
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Textarea } from '../primitives/Textarea';
import { FormField } from '../primitives/FormField';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { Badge } from '../primitives/Badge';
import { RadioGroup, RadioItem } from '../primitives/RadioGroup';
import { CurrencyInput } from '../primitives/CurrencyInput';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useMemo } from 'react';
import { VederlagTilstand, VederlagBeregningResultat } from '../../types/timeline';

const updateResponseSchema = z.object({
  nytt_resultat: z.string().min(1, 'Du må velge et svar'),
  godkjent_belop: z.number().optional(),
  kommentar: z.string().min(10, 'Begrunnelse er påkrevd'),
});

type UpdateResponseFormData = z.infer<typeof updateResponseSchema>;

interface UpdateResponseVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  lastResponseEvent: {
    event_id: string;
    resultat: VederlagBeregningResultat;
    godkjent_belop?: number;
  };
  vederlagTilstand: VederlagTilstand;
}

const RESULTAT_LABELS: Record<VederlagBeregningResultat, string> = {
  godkjent_fullt: 'Godkjent fullt',
  delvis_godkjent: 'Delvis godkjent',
  godkjent_annen_metode: 'Godkjent (annen metode)',
  avventer_spesifikasjon: 'Avventer spesifikasjon',
  avslatt_totalt: 'Avslått',
  hold_tilbake: 'Holder tilbake (§30.2)',
  avvist_preklusjon_rigg: 'Avvist pga preklusjon rigg/drift',
};

export function UpdateResponseVederlagModal({
  open,
  onOpenChange,
  sakId,
  lastResponseEvent,
  vederlagTilstand,
}: UpdateResponseVederlagModalProps) {
  const forrigeResultat = lastResponseEvent.resultat;
  const erTilbakehold = forrigeResultat === 'hold_tilbake';

  // Determine the relevant amount based on metode
  const erRegningsarbeid = vederlagTilstand.metode === 'REGNINGSARBEID';
  const krevdBelop = erRegningsarbeid
    ? vederlagTilstand.kostnads_overslag ?? 0
    : vederlagTilstand.belop_direkte ?? 0;

  // Check if TE has now provided kostnadsoverslag (§30.2)
  const overslagMottatt = useMemo(() => {
    // For REGNINGSARBEID: check if kostnads_overslag is set
    if (erTilbakehold && erRegningsarbeid) {
      return (vederlagTilstand.kostnads_overslag ?? 0) > 0;
    }
    // For other metoder, overslag is not relevant
    return false;
  }, [erTilbakehold, erRegningsarbeid, vederlagTilstand.kostnads_overslag]);

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
      godkjent_belop: undefined,
      kommentar: '',
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const nyttResultat = watch('nytt_resultat') as VederlagBeregningResultat;
  const godkjentBelop = watch('godkjent_belop');

  // Get available options based on current state
  const getOptions = () => {
    const options: { value: VederlagBeregningResultat; label: string; description?: string }[] = [];

    if (erTilbakehold) {
      options.push({
        value: 'godkjent_fullt',
        label: 'Opphev tilbakeholdelse: Godkjenn fullt',
        description: 'Overslag mottatt og akseptert. Betaling frigis.',
      });
      options.push({
        value: 'delvis_godkjent',
        label: 'Opphev tilbakeholdelse: Godkjenn delvis',
        description: 'Overslag mottatt, men kun deler av beløpet aksepteres.',
      });
      options.push({
        value: 'avslatt_totalt',
        label: 'Avslå kravet',
        description: 'Selv med overslag godtas ikke kravet.',
      });
    } else {
      options.push({
        value: 'godkjent_fullt',
        label: `Endre til: Godkjent fullt (${krevdBelop.toLocaleString('nb-NO')} kr)`,
      });
      options.push({
        value: 'delvis_godkjent',
        label: 'Endre til: Delvis godkjent',
      });
      options.push({
        value: 'hold_tilbake',
        label: 'Endre til: Hold tilbake (§30.2)',
        description: 'Krever overslag før betaling.',
      });
      options.push({
        value: 'avslatt_totalt',
        label: 'Endre til: Avslå kravet',
      });
    }

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
      eventType: 'respons_vederlag_oppdatert',
      data: {
        original_respons_id: lastResponseEvent.event_id,
        nytt_resultat: data.nytt_resultat,
        godkjent_belop:
          data.nytt_resultat === 'godkjent_fullt'
            ? krevdBelop
            : data.godkjent_belop,
        kommentar: data.kommentar,
        dato_endret: new Date().toISOString().split('T')[0],
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Oppdater svar på vederlagskrav"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Current state */}
        <div className="bg-gray-50 p-4 rounded border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">Nåværende svar:</p>
              <Badge
                variant={
                  forrigeResultat === 'hold_tilbake' ? 'warning' :
                  forrigeResultat === 'avslatt_totalt' ? 'danger' : 'success'
                }
              >
                {RESULTAT_LABELS[forrigeResultat]}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">
                {erRegningsarbeid ? 'Kostnadsoverslag:' : 'Krevd beløp:'}
              </p>
              <p className="text-xl font-bold">kr {krevdBelop.toLocaleString('nb-NO')},-</p>
            </div>
          </div>
        </div>

        {/* Overslag received notification */}
        {erTilbakehold && overslagMottatt && (
          <Alert variant="success" title="Kostnadsoverslag mottatt">
            <p>
              Entreprenøren har nå levert kostnadsoverslag på{' '}
              <strong>kr {vederlagTilstand.kostnads_overslag?.toLocaleString('nb-NO')},-</strong>{' '}
              i henhold til §30.2. Du kan nå oppheve tilbakeholdelsen og ta stilling til kravet.
            </p>
          </Alert>
        )}

        {/* Warning if still waiting for overslag */}
        {erTilbakehold && !overslagMottatt && erRegningsarbeid && (
          <Alert variant="warning" title="Venter på kostnadsoverslag">
            <p>
              Tilbakeholdelsen ble satt fordi regningsarbeid mangler kostnadsoverslag (§30.2).
              Entreprenøren har ikke levert overslag ennå. Du kan likevel endre status hvis situasjonen har endret seg.
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

        {/* Partial approval amount */}
        {nyttResultat === 'delvis_godkjent' && (
          <div className="ml-6 p-4 bg-gray-100 rounded animate-in fade-in duration-200">
            <FormField label="Godkjent beløp">
              <Controller
                name="godkjent_belop"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    value={field.value ?? null}
                    onChange={field.onChange}
                    fullWidth
                  />
                )}
              />
            </FormField>
          </div>
        )}

        {/* Kommentar */}
        <FormField
          label="Begrunnelse"
          required
          error={errors.kommentar?.message}
        >
          <Controller
            name="kommentar"
            control={control}
            render={({ field }) => (
              <Textarea
                id="kommentar"
                value={field.value}
                onChange={field.onChange}
                rows={4}
                fullWidth
                error={!!errors.kommentar}
                placeholder={
                  erTilbakehold
                    ? 'Begrunn opphevelse av tilbakeholdelse...'
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
        <div className="flex justify-end gap-4 pt-6 border-t-2 border-pkt-border-subtle">
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
            variant="primary"
            disabled={
              isSubmitting ||
              !nyttResultat ||
              (nyttResultat === 'delvis_godkjent' && !godkjentBelop) ||
              !watch('kommentar')
            }
            size="lg"
          >
            {isSubmitting ? 'Lagrer...' : 'Lagre Svar'}
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
