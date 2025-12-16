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
import { RevisionTag } from '../primitives/RevisionTag';
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
    /** Which version of the claim this response was for (0-indexed) */
    respondedToVersion?: number;
  };
  vederlagTilstand: VederlagTilstand;
}

const RESULTAT_LABELS: Record<VederlagBeregningResultat, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  hold_tilbake: 'Holder tilbake (§30.2)',
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

  // Current claim version (0-indexed: 0 = original, 1 = first revision, etc.)
  const currentClaimVersion = Math.max(0, (vederlagTilstand.antall_versjoner ?? 1) - 1);

  // Check if claim has been revised since BH's last response
  const kravRevidertEtterSvar = useMemo(() => {
    const respondedTo = lastResponseEvent.respondedToVersion ?? 0;
    return currentClaimVersion > respondedTo;
  }, [currentClaimVersion, lastResponseEvent.respondedToVersion]);

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

  // Asymmetrisk endringsrett: BH kan kun endre til TEs gunst
  const varAvslatt = forrigeResultat === 'avslatt';
  const varDelvisGodkjent = forrigeResultat === 'delvis_godkjent';
  const varGodkjent = forrigeResultat === 'godkjent';
  const tidligereGodkjentBelop = lastResponseEvent.godkjent_belop ?? 0;

  // Get available options based on current state - kun endringer til TEs gunst
  const getOptions = () => {
    const options: { value: VederlagBeregningResultat; label: string; description?: string }[] = [];

    if (erTilbakehold) {
      // Tilbakeholdelse er ikke en endelig avgjørelse - kan oppheves i alle retninger
      options.push({
        value: 'godkjent',
        label: 'Opphev tilbakeholdelse: Godkjenn fullt',
        description: 'Overslag mottatt og akseptert. Betaling frigis.',
      });
      options.push({
        value: 'delvis_godkjent',
        label: 'Opphev tilbakeholdelse: Godkjenn delvis',
        description: 'Overslag mottatt, men kun deler av beløpet aksepteres.',
      });
      options.push({
        value: 'avslatt',
        label: 'Avslå kravet',
        description: 'Selv med overslag godtas ikke kravet.',
      });
    } else if (varAvslatt) {
      // Fra avslått: Kan snu til godkjent eller delvis_godkjent (til TEs gunst)
      options.push({
        value: 'godkjent',
        label: `Snu til: Godkjent fullt (${krevdBelop.toLocaleString('nb-NO')} kr)`,
        description: 'Kravet aksepteres fullt ut.',
      });
      options.push({
        value: 'delvis_godkjent',
        label: 'Snu til: Delvis godkjent',
        description: 'Deler av kravet aksepteres.',
      });
    } else if (varDelvisGodkjent) {
      // Fra delvis_godkjent: Kan kun øke beløpet (til TEs gunst)
      options.push({
        value: 'godkjent',
        label: `Øk til: Godkjent fullt (${krevdBelop.toLocaleString('nb-NO')} kr)`,
        description: 'Kravet aksepteres fullt ut.',
      });
      options.push({
        value: 'delvis_godkjent',
        label: 'Øk godkjent beløp',
        description: `Nåværende: ${tidligereGodkjentBelop.toLocaleString('nb-NO')} kr. Du kan kun øke beløpet.`,
      });
    }
    // Fra godkjent: Ingen alternativer - standpunktet er bindende

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
        nytt_godkjent_belop:
          data.nytt_resultat === 'godkjent'
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
        {/* Revision warning - claim has been revised since last response */}
        {kravRevidertEtterSvar && (
          <Alert variant="warning" title="Kravet er revidert">
            <p>
              Entreprenøren har revidert vederlagskravet etter ditt forrige svar.
              Gjeldende krav er nå <strong>Rev. {currentClaimVersion}</strong>.
              Sørg for at du vurderer det oppdaterte kravet.
            </p>
          </Alert>
        )}

        {/* Current state */}
        <div className="bg-pkt-bg-subtle p-4 rounded border border-pkt-grays-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-pkt-grays-gray-600">Nåværende svar:</p>
              </div>
              <Badge
                variant={
                  forrigeResultat === 'hold_tilbake' ? 'warning' :
                  forrigeResultat === 'avslatt' ? 'danger' : 'success'
                }
              >
                {RESULTAT_LABELS[forrigeResultat]}
              </Badge>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <p className="text-sm text-pkt-grays-gray-600">
                  {erRegningsarbeid ? 'Kostnadsoverslag:' : 'Krevd beløp:'}
                </p>
                <RevisionTag version={currentClaimVersion} size="sm" />
              </div>
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

        {/* Info when already approved - standpoint is binding */}
        {varGodkjent && (
          <Alert variant="info" title="Standpunktet er bindende">
            <p>
              Du har allerede godkjent vederlagskravet fullt ut. Dette standpunktet er bindende
              og kan ikke endres til entreprenørens ugunst.
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
          <div className="ml-6 p-4 bg-pkt-grays-gray-100 rounded animate-in fade-in duration-200">
            <FormField
              label="Godkjent beløp"
              hint={varDelvisGodkjent
                ? `Må være høyere enn tidligere godkjent (${tidligereGodkjentBelop.toLocaleString('nb-NO')} kr)`
                : undefined
              }
            >
              <Controller
                name="godkjent_belop"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    value={field.value ?? null}
                    onChange={field.onChange}
                    min={varDelvisGodkjent ? tidligereGodkjentBelop + 1 : 0}
                    max={krevdBelop - 1}
                  />
                )}
              />
            </FormField>
            {varDelvisGodkjent && godkjentBelop !== undefined && godkjentBelop <= tidligereGodkjentBelop && (
              <p className="text-sm text-pkt-brand-red-1000 mt-2">
                Beløpet må være høyere enn tidligere godkjent ({tidligereGodkjentBelop.toLocaleString('nb-NO')} kr)
              </p>
            )}
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
              varGodkjent ||
              (nyttResultat === 'delvis_godkjent' && !godkjentBelop) ||
              (nyttResultat === 'delvis_godkjent' && varDelvisGodkjent && (godkjentBelop ?? 0) <= tidligereGodkjentBelop) ||
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
