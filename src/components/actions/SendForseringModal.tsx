/**
 * SendForseringModal Component
 *
 * Action modal for TE (contractor) to send a forsering (acceleration) notice
 * when BH has rejected a frist (deadline extension) claim.
 *
 * Based on NS 8407 §33.8:
 * - TE can choose to treat BH's rejection as an order to accelerate
 * - Cost limit: forseringskostnad ≤ (dagmulkt + 30%)
 * - TE must notify BH before acceleration starts with estimated cost
 *
 * TRIGGERS (when this modal should be available):
 * - BH rejected frist claim (avslatt_ingen_hindring, avvist_preklusjon)
 * - BH partially approved frist claim (delvis_godkjent with godkjent < krevd)
 * - BH rejected grunnlag (implies frist rejection) - uses subsidiary days
 */

import { useMemo } from 'react';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { FormField } from '../primitives/FormField';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { DatePicker } from '../primitives/DatePicker';
import { Badge } from '../primitives/Badge';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { Checkbox } from '../primitives/Checkbox';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import type { FristBeregningResultat } from '../../types/timeline';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface SendForseringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** Event-ID of the frist claim that was rejected */
  fristKravId: string;
  /** Event-ID of BH's frist response that triggered this */
  responsFristId: string;
  /** Frist data for context */
  fristData: {
    krevde_dager: number;
    godkjent_dager: number;  // 0 if fully rejected, or subsidiary days if grunnlag rejected
    bh_resultat: FristBeregningResultat;
  };
  /** Daily liquidated damages rate in NOK */
  dagmulktsats: number;
  /** True if triggered by grunnlag rejection (not direct frist rejection) */
  grunnlagAvslagTrigger?: boolean;
}

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const sendForseringSchema = z.object({
  estimert_kostnad: z.number()
    .min(1, 'Estimert kostnad må være større enn 0'),
  dagmulktsats: z.number()
    .min(1, 'Dagmulktsats må være større enn 0'),
  dato_iverksettelse: z.string()
    .min(1, 'Du må angi dato for iverksettelse'),
  begrunnelse: z.string()
    .min(10, 'Begrunnelse må være minst 10 tegn'),
  bekreft_30_prosent: z.boolean()
    .refine(val => val === true, 'Du må bekrefte at kostnad er innenfor 30%-grensen'),
});

type SendForseringFormData = z.infer<typeof sendForseringSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('nb-NO')} kr`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SendForseringModal({
  open,
  onOpenChange,
  sakId,
  fristKravId,
  responsFristId,
  fristData,
  dagmulktsats,
  grunnlagAvslagTrigger = false,
}: SendForseringModalProps) {
  // Calculate rejected days
  const avslatteDager = fristData.krevde_dager - fristData.godkjent_dager;

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
  } = useForm<SendForseringFormData>({
    resolver: zodResolver(sendForseringSchema),
    defaultValues: {
      dagmulktsats: dagmulktsats,
      bekreft_30_prosent: false,
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  // Watch form values for live calculation
  const estimertKostnad = watch('estimert_kostnad') || 0;
  const inputDagmulktsats = watch('dagmulktsats') || dagmulktsats;

  // Calculate 30% limit
  const maksKostnad = useMemo(() => {
    return avslatteDager * inputDagmulktsats * 1.3;
  }, [avslatteDager, inputDagmulktsats]);

  const erInnenforGrense = estimertKostnad <= maksKostnad;
  const prosentAvGrense = maksKostnad > 0 ? (estimertKostnad / maksKostnad) * 100 : 0;

  // Submit handler
  const onSubmit = (data: SendForseringFormData) => {
    mutation.mutate({
      eventType: 'forsering_varsel',
      data: {
        frist_krav_id: fristKravId,
        respons_frist_id: responsFristId,
        estimert_kostnad: data.estimert_kostnad,
        begrunnelse: data.begrunnelse,
        bekreft_30_prosent: data.bekreft_30_prosent,
        dato_iverksettelse: data.dato_iverksettelse,
        avslatte_dager: avslatteDager,
        dagmulktsats: data.dagmulktsats,
        grunnlag_avslag_trigger: grunnlagAvslagTrigger,
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send forseringsvarsel (§33.8)"
      description="Varsle BH om at du vil behandle avslaget som et pålegg om forsering"
      size="lg"
    >
      <div className="space-y-6">
        {/* Info banner about §33.8 */}
        <Alert variant="info" title="§33.8 Forsering ved uberettiget avslag">
          Hvis du mener fristkravet er berettiget, kan du velge å anse BH&apos;s avslag som et
          pålegg om forsering. Du må varsle BH før forsering iverksettes.
        </Alert>

        {/* Grunnlag rejection trigger info */}
        {grunnlagAvslagTrigger && (
          <Alert variant="warning" title="Utløst av grunnlagsavslag">
            BH har avslått ansvarsgrunnlaget. Forseringsvarselet baseres på BH&apos;s{' '}
            <strong>subsidiære</strong> standpunkt til fristforlengelse.
          </Alert>
        )}

        {/* Context: Rejected days */}
        <div className="p-4 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <span className="text-xs text-pkt-text-body-subtle uppercase font-bold block">
                Krevde dager
              </span>
              <span className="text-2xl font-bold">{fristData.krevde_dager}</span>
            </div>
            <div>
              <span className="text-xs text-pkt-text-body-subtle uppercase font-bold block">
                {grunnlagAvslagTrigger ? 'Subsidiært godkjent' : 'Godkjent'}
              </span>
              <span className="text-2xl font-bold">{fristData.godkjent_dager}</span>
            </div>
            <div>
              <span className="text-xs text-pkt-text-body-subtle uppercase font-bold block">
                Avslåtte dager
              </span>
              <span className="text-2xl font-bold text-red-600">{avslatteDager}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dagmulktsats input */}
          <FormField
            label="Dagmulktsats"
            required
            error={errors.dagmulktsats?.message}
            helpText="Dagmulkt per dag forsinkelse iht. kontrakten (NOK)"
          >
            <Input
              type="number"
              {...register('dagmulktsats', { valueAsNumber: true })}
              width="sm"
              placeholder="50000"
              error={!!errors.dagmulktsats}
            />
          </FormField>

          {/* 30% calculation display */}
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-none">
            <h4 className="font-bold text-amber-900 mb-3">30%-beregning (§33.8)</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Avslåtte dager:</span>
                <span className="font-mono">{avslatteDager} dager</span>
              </div>
              <div className="flex justify-between">
                <span>Dagmulktsats:</span>
                <span className="font-mono">{formatCurrency(inputDagmulktsats)}</span>
              </div>
              <div className="flex justify-between">
                <span>Dagmulkt totalt:</span>
                <span className="font-mono">{formatCurrency(avslatteDager * inputDagmulktsats)}</span>
              </div>
              <div className="flex justify-between border-t border-amber-400 pt-2 font-bold">
                <span>Maks forseringskostnad (dagmulkt + 30%):</span>
                <span className="font-mono">{formatCurrency(maksKostnad)}</span>
              </div>
            </div>
          </div>

          {/* Estimated cost input */}
          <FormField
            label="Estimert forseringskostnad"
            required
            error={errors.estimert_kostnad?.message}
            helpText="Angi hva forseringen antas å ville koste"
          >
            <Input
              type="number"
              {...register('estimert_kostnad', { valueAsNumber: true })}
              width="md"
              placeholder="0"
              error={!!errors.estimert_kostnad}
            />
          </FormField>

          {/* Cost validation feedback */}
          {estimertKostnad > 0 && (
            <div className={`p-3 rounded-none border-2 ${
              erInnenforGrense
                ? 'bg-green-50 border-green-400'
                : 'bg-red-50 border-red-400'
            }`}>
              <div className="flex items-center justify-between">
                <span className={erInnenforGrense ? 'text-green-800' : 'text-red-800'}>
                  {erInnenforGrense ? (
                    <>Innenfor grensen ({prosentAvGrense.toFixed(0)}% av maks)</>
                  ) : (
                    <>Overstiger grensen med {formatCurrency(estimertKostnad - maksKostnad)}</>
                  )}
                </span>
                <Badge variant={erInnenforGrense ? 'success' : 'danger'}>
                  {erInnenforGrense ? 'OK' : 'For høy'}
                </Badge>
              </div>
              {!erInnenforGrense && (
                <p className="text-sm text-red-700 mt-2">
                  Hvis forseringskostnaden overstiger dagmulkt + 30%, har du ikke valgrett
                  til å anse avslaget som et forseringspålegg.
                </p>
              )}
            </div>
          )}

          {/* Date for acceleration start */}
          <FormField
            label="Dato for iverksettelse"
            required
            error={errors.dato_iverksettelse?.message}
            helpText="Når forsering vil iverksettes"
          >
            <Controller
              name="dato_iverksettelse"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="dato_iverksettelse"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Velg dato"
                />
              )}
            />
          </FormField>

          {/* Begrunnelse */}
          <FormField
            label="Begrunnelse"
            required
            error={errors.begrunnelse?.message}
            helpText="Begrunn hvorfor du mener fristkravet er berettiget og velger forsering"
          >
            <Textarea
              {...register('begrunnelse')}
              rows={4}
              fullWidth
              placeholder="TE mener at fristkravet er berettiget og velger derfor å anse BH's avslag som et pålegg om forsering iht. NS 8407 §33.8..."
              error={!!errors.begrunnelse}
            />
          </FormField>

          {/* Confirmation checkbox */}
          <div className="p-4 bg-pkt-surface-subtle border-2 border-pkt-border-default rounded-none">
            <Controller
              name="bekreft_30_prosent"
              control={control}
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label="Jeg bekrefter at estimert forseringskostnad er innenfor dagmulkt + 30%"
                  error={!!errors.bekreft_30_prosent}
                />
              )}
            />
            {errors.bekreft_30_prosent && (
              <p className="text-sm text-red-600 mt-1">{errors.bekreft_30_prosent.message}</p>
            )}
          </div>

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
              disabled={isSubmitting || !erInnenforGrense}
              size="lg"
            >
              {isSubmitting ? 'Sender...' : 'Send forseringsvarsel'}
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
      </div>
    </Modal>
  );
}
