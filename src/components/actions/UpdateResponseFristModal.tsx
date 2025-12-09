/**
 * UpdateResponseFristModal Component
 *
 * Modal for BH to update their response on frist claim.
 * Critical: If forsering is in progress, BH can stop it by approving the frist claim.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
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
import { FristTilstand, FristBeregningResultat, ForseringTilstand } from '../../types/timeline';

const updateResponseSchema = z.object({
  nytt_resultat: z.string().min(1, 'Du må velge et svar'),
  ny_godkjent_dager: z.number().optional(),
  kommentar: z.string().min(10, 'Begrunnelse er påkrevd'),
});

type UpdateResponseFormData = z.infer<typeof updateResponseSchema>;

interface UpdateResponseFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  lastResponseEvent: {
    event_id: string;
    resultat: FristBeregningResultat;
    godkjent_dager?: number;
  };
  fristTilstand: FristTilstand;
}

const RESULTAT_LABELS: Record<FristBeregningResultat, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  avventer: 'Avventer dokumentasjon',
};

export function UpdateResponseFristModal({
  open,
  onOpenChange,
  sakId,
  lastResponseEvent,
  fristTilstand,
}: UpdateResponseFristModalProps) {
  const forsering = fristTilstand.forsering;
  const erForseringVarslet = forsering?.er_varslet ?? false;
  const forseringsKostnad = forsering?.estimert_kostnad ?? 0;
  const krevdDager = fristTilstand.krevd_dager ?? 0;

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
      ny_godkjent_dager: undefined,
      kommentar: '',
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const nyttResultat = watch('nytt_resultat') as FristBeregningResultat;
  const nyGodkjentDager = watch('ny_godkjent_dager');

  // Check if this will stop forsering
  const stopperForsering = useMemo(() => {
    return erForseringVarslet &&
      (nyttResultat === 'godkjent' || nyttResultat === 'delvis_godkjent');
  }, [erForseringVarslet, nyttResultat]);

  // Get available options based on forsering status
  const getOptions = () => {
    const options: { value: FristBeregningResultat; label: string; description?: string }[] = [];

    options.push({
      value: 'godkjent',
      label: erForseringVarslet
        ? 'Snu i saken: Godkjenn fristforlengelsen'
        : `Godkjenn ${krevdDager} dager`,
      description: erForseringVarslet
        ? 'STOPPER FORSERINGEN. TE får dagene, og du slipper å betale forseringskostnaden.'
        : 'Fristen forlenges tilsvarende.',
    });

    options.push({
      value: 'delvis_godkjent',
      label: 'Snu i saken: Godkjenn delvis',
      description: erForseringVarslet
        ? 'Delvis godkjenning kan også stoppe forsering.'
        : 'Godkjenn færre dager enn kravet.',
    });

    if (erForseringVarslet) {
      options.push({
        value: 'avslatt',
        label: 'Oppretthold avslag (Bestrid forsering)',
        description: 'Du mener fortsatt TE ikke har krav på frist. Du tar risikoen for forseringskostnaden.',
      });
    } else {
      options.push({
        value: 'avslatt',
        label: 'Oppretthold avslag',
        description: 'Det er ikke grunnlag for fristforlengelse.',
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
      eventType: 'respons_frist_oppdatert',
      data: {
        original_respons_id: lastResponseEvent.event_id,
        nytt_resultat: data.nytt_resultat,
        ny_godkjent_dager:
          data.nytt_resultat === 'godkjent'
            ? krevdDager
            : data.ny_godkjent_dager,
        kommentar: data.kommentar,
        stopper_forsering: stopperForsering,
        dato_endret: new Date().toISOString().split('T')[0],
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Oppdater svar på frist/forsering"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* DRAMATIC FORSERING WARNING */}
        {erForseringVarslet && (
          <div className="bg-red-50 p-4 border-l-4 border-red-600 rounded">
            <h4 className="text-red-800 font-bold flex items-center gap-2">
              <span className="text-xl">!</span>
              FORSERING VARSLET
            </h4>
            <p className="text-sm text-red-700 mt-2">
              Entreprenøren har iverksatt forsering med en estimert kostnad på:
            </p>
            <div className="text-3xl font-mono font-bold text-red-800 my-3">
              kr {forseringsKostnad.toLocaleString('nb-NO')},-
            </div>
            <p className="text-sm text-red-700">
              Hvis du godkjenner fristforlengelsen nå, <strong>faller plikten til å forsere bort</strong>.
              Du betaler da kun evt. påløpt kostnad frem til nå, men slipper resten.
            </p>
          </div>
        )}

        {/* Normal state display */}
        {!erForseringVarslet && (
          <div className="bg-gray-50 p-4 rounded border border-gray-200">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Nåværende svar:</span>
              <Badge variant={lastResponseEvent.resultat === 'avslatt' ? 'danger' : 'success'}>
                {RESULTAT_LABELS[lastResponseEvent.resultat]}
              </Badge>
            </div>
            {lastResponseEvent.godkjent_dager !== undefined && (
              <p className="text-sm text-gray-600 mt-2">
                Godkjent: {lastResponseEvent.godkjent_dager} dager av {krevdDager}
              </p>
            )}
          </div>
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

        {/* Partial approval input */}
        {nyttResultat === 'delvis_godkjent' && (
          <div className="ml-6 p-4 bg-gray-100 rounded animate-in fade-in duration-200">
            <FormField label="Antall dager du godkjenner">
              <Controller
                name="ny_godkjent_dager"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    max={krevdDager - 1}
                    min={0}
                    width="xs"
                  />
                )}
              />
            </FormField>
          </div>
        )}

        {/* Confirmation alert when stopping forsering */}
        {stopperForsering && (
          <Alert variant="success" title="Forsering stoppes">
            <p>
              Ved å godkjenne fristforlengelsen vil forseringen stoppes.
              Du vil kun måtte betale for påløpte forseringskostnader frem til i dag.
            </p>
          </Alert>
        )}

        {/* Begrunnelse */}
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
                  erForseringVarslet && nyttResultat === 'godkjent'
                    ? 'Vi aksepterer fristkravet for å begrense kostnadene...'
                    : 'Begrunnelse...'
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
            variant={stopperForsering ? 'primary' : nyttResultat === 'avslatt' && erForseringVarslet ? 'danger' : 'primary'}
            disabled={
              isSubmitting ||
              !nyttResultat ||
              (nyttResultat === 'delvis_godkjent' && !nyGodkjentDager) ||
              !watch('kommentar')
            }
            size="lg"
          >
            {isSubmitting
              ? 'Lagrer...'
              : stopperForsering
                ? 'Stopp Forsering & Godkjenn'
                : 'Lagre Svar'}
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
