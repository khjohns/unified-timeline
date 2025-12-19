/**
 * ReviseFristModal Component
 *
 * Modal for TE to revise a frist claim (fristforlengelseskrav).
 *
 * This modal handles revision only - forsering is handled by SendForseringModal.
 * The antall_dager field uses the same name as SendFristModal for consistency
 * with the backend API which expects 'antall_dager' for updates.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { FormField } from '../primitives/FormField';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { Badge } from '../primitives/Badge';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useMemo } from 'react';
import { FristTilstand, FristBeregningResultat } from '../../types/timeline';

const reviseFristSchema = z.object({
  antall_dager: z.number().min(0, 'Antall dager må være minst 0'),
  begrunnelse: z.string().min(10, 'Begrunnelse er påkrevd'),
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
    begrunnelse?: string;
  };
  fristTilstand: FristTilstand;
}

const RESULTAT_LABELS: Record<FristBeregningResultat, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
};

const RESULTAT_VARIANTS: Record<FristBeregningResultat, 'success' | 'warning' | 'danger'> = {
  godkjent: 'success',
  delvis_godkjent: 'warning',
  avslatt: 'danger',
};

export function ReviseFristModal({
  open,
  onOpenChange,
  sakId,
  lastFristEvent,
  lastResponseEvent,
  fristTilstand,
}: ReviseFristModalProps) {
  const harBhSvar = !!lastResponseEvent;

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    control,
    watch,
    reset,
  } = useForm<ReviseFristFormData>({
    resolver: zodResolver(reviseFristSchema),
    defaultValues: {
      antall_dager: lastFristEvent.antall_dager,
      begrunnelse: '',
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const antallDager = watch('antall_dager');

  // Validering: Nytt antall dager må være forskjellig fra originalt
  const erUendretDager = useMemo(() => {
    return antallDager === lastFristEvent.antall_dager;
  }, [antallDager, lastFristEvent.antall_dager]);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: ReviseFristFormData) => {
    mutation.mutate({
      eventType: 'frist_krav_oppdatert',
      data: {
        original_event_id: lastFristEvent.event_id,
        antall_dager: data.antall_dager,
        begrunnelse: data.begrunnelse,
        dato_revidert: new Date().toISOString().split('T')[0],
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Revider fristkrav"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Status box - show original claim */}
        <div className="bg-pkt-bg-subtle p-4 rounded border border-pkt-grays-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-pkt-grays-gray-600">Ditt opprinnelige krav:</p>
              <p className="text-2xl font-bold">{lastFristEvent.antall_dager} dager</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-pkt-grays-gray-600">BHs svar:</p>
              {lastResponseEvent ? (
                <>
                  <Badge variant={RESULTAT_VARIANTS[lastResponseEvent.resultat]}>
                    {RESULTAT_LABELS[lastResponseEvent.resultat]}
                  </Badge>
                  {lastResponseEvent.godkjent_dager !== undefined && (
                    <p className="text-sm mt-1">
                      Godkjent: {lastResponseEvent.godkjent_dager} dager
                    </p>
                  )}
                </>
              ) : (
                <Badge variant="neutral">Avventer svar</Badge>
              )}
            </div>
          </div>
        </div>

        {/* BH begrunnelse - show if available */}
        {harBhSvar && lastResponseEvent?.begrunnelse && (
          <div className="p-4 rounded-none border-2 border-pkt-border-default bg-pkt-surface-subtle">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm">Byggherrens begrunnelse</h4>
              <Badge variant={RESULTAT_VARIANTS[lastResponseEvent.resultat]}>
                {RESULTAT_LABELS[lastResponseEvent.resultat]}
              </Badge>
            </div>
            <div className="pt-2 border-t border-pkt-border-subtle">
              <p className="italic text-pkt-text-body text-sm">
                &ldquo;{lastResponseEvent.begrunnelse}&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* Info when BH hasn't responded - explain revision option */}
        {!lastResponseEvent && (
          <Alert variant="info" title="Revisjon før svar">
            Du kan oppdatere kravet ditt før byggherren har svart. Det reviderte kravet
            erstatter det opprinnelige kravet.
          </Alert>
        )}

        {/* Revision form */}
        <div className="space-y-3">
          <FormField
            label="Antall dager fristforlengelse"
            error={errors.antall_dager?.message}
          >
            <Controller
              name="antall_dager"
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
          {erUendretDager && (
            <p className="text-sm text-pkt-brand-orange-700">
              Nytt antall dager må være forskjellig fra opprinnelig krav for å sende revisjon.
            </p>
          )}
        </div>

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
                placeholder="Hvorfor endres antall dager?"
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
            disabled={isSubmitting || !watch('begrunnelse') || erUendretDager}
            size="lg"
          >
            {isSubmitting ? 'Sender...' : 'Oppdater Krav'}
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
