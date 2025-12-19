/**
 * ReviseFristModal Component
 *
 * Modal for TE to revise frist claim OR declare forsering (§33.8).
 * Key logic:
 * - If BH rejected/partially approved: TE can choose to escalate to forsering
 * - 30% rule: Forsering cost must be < (Dagmulkt + 30%)
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { FormField } from '../primitives/FormField';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { Badge } from '../primitives/Badge';
import { Checkbox } from '../primitives/Checkbox';
import { CurrencyInput } from '../primitives/CurrencyInput';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useMemo } from 'react';
import { FristTilstand, FristBeregningResultat } from '../../types/timeline';

const reviseFristSchema = z.object({
  nytt_antall_dager: z.number().min(0, 'Antall dager må være minst 0'),
  begrunnelse: z.string().min(10, 'Begrunnelse er påkrevd'),
  iverksett_forsering: z.boolean().optional(),
  forserings_kostnad: z.number().optional(),
  bekreft_30_prosent: z.boolean().optional(),
});

type ReviseFristFormData = z.infer<typeof reviseFristSchema>;

interface ReviseFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  lastFristEvent: {
    event_id: string;
    antall_dager: number;
    begrunnelse?: string;
  };
  lastResponseEvent?: {
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
};

export function ReviseFristModal({
  open,
  onOpenChange,
  sakId,
  lastFristEvent,
  lastResponseEvent,
  fristTilstand,
}: ReviseFristModalProps) {
  const erAvslag = lastResponseEvent?.resultat === 'avslatt' ||
    lastResponseEvent?.resultat === 'delvis_godkjent';

  const avslatteDager = useMemo(() => {
    if (!lastResponseEvent) return 0;
    const godkjent = lastResponseEvent.godkjent_dager || 0;
    return lastFristEvent.antall_dager - godkjent;
  }, [lastFristEvent.antall_dager, lastResponseEvent?.godkjent_dager]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    control,
    watch,
    reset,
    setValue,
  } = useForm<ReviseFristFormData>({
    resolver: zodResolver(reviseFristSchema),
    defaultValues: {
      nytt_antall_dager: lastFristEvent.antall_dager,
      begrunnelse: '',
      iverksett_forsering: false,
      forserings_kostnad: undefined,
      bekreft_30_prosent: false,
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const iverksettForsering = watch('iverksett_forsering');
  const forseringsKostnad = watch('forserings_kostnad');
  const bekreft30Prosent = watch('bekreft_30_prosent');
  const nyttAntallDager = watch('nytt_antall_dager');

  // Validering: For normal revisjon må nytt antall dager være forskjellig fra originalt
  const erUendretDager = useMemo(() => {
    if (iverksettForsering) return false; // Ikke relevant for forsering
    return nyttAntallDager === lastFristEvent.antall_dager;
  }, [iverksettForsering, nyttAntallDager, lastFristEvent.antall_dager]);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: ReviseFristFormData) => {
    const eventType = data.iverksett_forsering ? 'forsering_varsel' : 'frist_krav_oppdatert';

    if (data.iverksett_forsering) {
      mutation.mutate({
        eventType: 'forsering_varsel',
        data: {
          frist_krav_id: lastFristEvent.event_id,
          estimert_kostnad: data.forserings_kostnad,
          begrunnelse: data.begrunnelse,
          bekreft_30_prosent: data.bekreft_30_prosent,
          dato_iverksettelse: new Date().toISOString().split('T')[0],
        },
      });
    } else {
      mutation.mutate({
        eventType: 'frist_krav_oppdatert',
        data: {
          original_event_id: lastFristEvent.event_id,
          // Use same field name as initial claim for consistency
          antall_dager: data.nytt_antall_dager,
          begrunnelse: data.begrunnelse,
          dato_revidert: new Date().toISOString().split('T')[0],
        },
      });
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={iverksettForsering ? 'Varsel om Forsering (§33.8)' : 'Revider fristkrav'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header with escalation badge if forsering */}
        {iverksettForsering && (
          <div className="flex justify-center mb-2">
            <Badge variant="danger" size="lg">Eskalering</Badge>
          </div>
        )}

        {/* Status box */}
        <div className="bg-pkt-bg-subtle p-4 rounded border border-pkt-grays-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-pkt-grays-gray-600">Ditt opprinnelige krav:</p>
              <p className="text-2xl font-bold">{lastFristEvent.antall_dager} dager</p>
            </div>
            {lastResponseEvent ? (
              <div className="text-right">
                <p className="text-sm text-pkt-grays-gray-600">BHs svar:</p>
                <Badge variant={erAvslag ? 'danger' : 'success'}>
                  {RESULTAT_LABELS[lastResponseEvent.resultat]}
                </Badge>
                {lastResponseEvent.godkjent_dager !== undefined && (
                  <p className="text-sm mt-1">
                    Godkjent: {lastResponseEvent.godkjent_dager} dager
                  </p>
                )}
              </div>
            ) : (
              <div className="text-right">
                <p className="text-sm text-pkt-grays-gray-600">BHs svar:</p>
                <Badge variant="neutral">Avventer svar</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Info when BH hasn't responded - explain revision option */}
        {!lastResponseEvent && (
          <Alert variant="info" title="Revisjon før svar">
            Du kan oppdatere kravet ditt før byggherren har svart. Det reviderte kravet
            erstatter det opprinnelige kravet.
          </Alert>
        )}

        {/* Forsering option - only show if BH rejected/partially approved */}
        {erAvslag && (
          <div className="border-l-4 border-pkt-border-red pl-4 py-3 bg-pkt-surface-faded-red rounded">
            <Controller
              name="iverksett_forsering"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="iverksett_forsering"
                  label="Svar på avslag: Iverksett forsering (§33.8)"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <p className="text-sm text-pkt-grays-gray-600 mt-2 ml-6">
              Du velger å anse avslaget som et pålegg om forsering. Du opprettholder
              fristkravet, men setter inn tiltak for å nå opprinnelig frist.
            </p>
          </div>
        )}

        {/* Scenario A: Normal revision */}
        {!iverksettForsering && (
          <div className="space-y-3">
            <div className="flex gap-4 items-end">
              <FormField label="Opprinnelig krav (dager)">
                <Input
                  type="number"
                  value={lastFristEvent.antall_dager}
                  disabled
                  width="xs"
                />
              </FormField>
              <FormField
                label="Nytt krav (dager)"
                error={errors.nytt_antall_dager?.message}
              >
                <Controller
                  name="nytt_antall_dager"
                  control={control}
                  render={({ field }) => (
                    <Input
                      type="number"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      width="xs"
                      min={0}
                    />
                  )}
                />
              </FormField>
            </div>
            {erUendretDager && (
              <p className="text-sm text-pkt-brand-orange-700">
                Nytt antall dager må være forskjellig fra opprinnelig krav for å sende revisjon.
              </p>
            )}
          </div>
        )}

        {/* Scenario B: Forsering (§33.8) */}
        {iverksettForsering && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <Alert variant="info" title="Vilkår for valgrett (§33.8)">
              Du kan kun velge forsering dersom kostnaden antas å være mindre enn
              <strong> Dagmulkt + 30%</strong>.
            </Alert>

            <FormField
              label="Estimert kostnad for forsering"
              helpText="Dette blir ditt vederlagskrav hvis BHs avslag var uberettiget."
            >
              <Controller
                name="forserings_kostnad"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    value={field.value ?? null}
                    onChange={field.onChange}
                    
                    placeholder="0"
                  />
                )}
              />
            </FormField>

            <div className="bg-pkt-surface-yellow p-4 rounded border border-pkt-border-yellow">
              <Controller
                name="bekreft_30_prosent"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="bekreft_30_prosent"
                    label="Jeg bekrefter at kostnaden antas å ligge innenfor 30%-regelen (§33.8)"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              {!bekreft30Prosent && (
                <p className="text-xs text-pkt-brand-red-1000 mt-2 ml-6">
                  Hvis kostnaden er høyere, har du ikke valgrett og må avvente instruks.
                </p>
              )}
            </div>

            <Alert variant="warning" title="Viktig om forsering">
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Du overtar fremdriftsrisikoen for de avslåtte dagene</li>
                <li>Hvis avslaget var berettiget, bærer du kostnadene selv</li>
                <li>BH kan når som helst godkjenne fristkravet og stoppe forseringen</li>
                <li>Da begrenses erstatningen til påløpte kostnader</li>
              </ul>
            </Alert>
          </div>
        )}

        {/* Begrunnelse */}
        <FormField
          label="Begrunnelse"
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
                  iverksettForsering
                    ? 'Beskriv tiltakene (skift, overtid, flere ressurser)...'
                    : 'Hvorfor endres antall dager?'
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
            variant={iverksettForsering ? 'danger' : 'primary'}
            disabled={
              isSubmitting ||
              !watch('begrunnelse') ||
              (iverksettForsering && (!forseringsKostnad || !bekreft30Prosent)) ||
              (!iverksettForsering && erUendretDager)
            }
            size="lg"
          >
            {isSubmitting
              ? 'Sender...'
              : iverksettForsering
                ? 'Send Varsel om Forsering'
                : 'Oppdater Krav'}
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
