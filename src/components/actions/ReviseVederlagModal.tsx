/**
 * ReviseVederlagModal Component
 *
 * Modal for TE to revise vederlag claim amount or cost estimate.
 * Key logic: For REGNINGSARBEID, ANY increase in overslag triggers varslingsplikt (§30.2)
 *
 * UPDATED (2025-12-05):
 * - Synced interface with SendVederlagModal (uppercase metode, consistent fields)
 * - Changed overslagsøkning to trigger on ANY increase per §30.2 andre ledd
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Textarea } from '../primitives/Textarea';
import { FormField } from '../primitives/FormField';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { Badge } from '../primitives/Badge';
import { CurrencyInput } from '../primitives/CurrencyInput';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useMemo } from 'react';

const reviseVederlagSchema = z.object({
  nytt_belop_direkte: z.number().optional(),
  nytt_kostnads_overslag: z.number().optional(),
  begrunnelse: z.string().min(10, 'Begrunnelse er påkrevd'),
});

type ReviseVederlagFormData = z.infer<typeof reviseVederlagSchema>;

// Metode type synced with SendVederlagModal
type VederlagsMetode = 'ENHETSPRISER' | 'REGNINGSARBEID' | 'FASTPRIS_TILBUD';

// Last vederlag event info - matches SendVederlagModal payload structure
interface LastVederlagEventInfo {
  event_id: string;
  metode: VederlagsMetode;
  belop_direkte?: number;
  kostnads_overslag?: number;
  begrunnelse?: string;
}

interface ReviseVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  lastVederlagEvent: LastVederlagEventInfo;
}

const METODE_LABELS: Record<VederlagsMetode, string> = {
  ENHETSPRISER: 'Enhetspriser (§34.3)',
  REGNINGSARBEID: 'Regningsarbeid (§34.4)',
  FASTPRIS_TILBUD: 'Fastpris/Tilbud (§34.2.1)',
};

export function ReviseVederlagModal({
  open,
  onOpenChange,
  sakId,
  lastVederlagEvent,
}: ReviseVederlagModalProps) {
  // Determine if this is regningsarbeid (uses kostnads_overslag instead of belop_direkte)
  const erRegningsarbeid = lastVederlagEvent.metode === 'REGNINGSARBEID';

  // Get current values based on metode
  const gjeldendeBelop = erRegningsarbeid
    ? lastVederlagEvent.kostnads_overslag
    : lastVederlagEvent.belop_direkte;

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    control,
    watch,
    reset,
  } = useForm<ReviseVederlagFormData>({
    resolver: zodResolver(reviseVederlagSchema),
    defaultValues: {
      nytt_belop_direkte: erRegningsarbeid ? undefined : lastVederlagEvent.belop_direkte,
      nytt_kostnads_overslag: erRegningsarbeid ? lastVederlagEvent.kostnads_overslag : undefined,
      begrunnelse: '',
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const nyttBelopDirekte = watch('nytt_belop_direkte');
  const nyttKostnadsOverslag = watch('nytt_kostnads_overslag');

  // §30.2 andre ledd: ANY increase in overslag triggers varslingsplikt
  // TE must notify "uten ugrunnet opphold" when there is "grunn til å anta" overslag will be exceeded
  const overslagsokningVarselpliktig = useMemo(() => {
    if (!erRegningsarbeid) return false;
    if (!nyttKostnadsOverslag || !lastVederlagEvent.kostnads_overslag) return false;
    // Any increase triggers warning - per §30.2 andre ledd
    return nyttKostnadsOverslag > lastVederlagEvent.kostnads_overslag;
  }, [erRegningsarbeid, nyttKostnadsOverslag, lastVederlagEvent.kostnads_overslag]);

  // Calculate change amounts
  const belopEndring = useMemo(() => {
    if (erRegningsarbeid) {
      if (!nyttKostnadsOverslag || !lastVederlagEvent.kostnads_overslag) return null;
      return nyttKostnadsOverslag - lastVederlagEvent.kostnads_overslag;
    } else {
      if (!nyttBelopDirekte || !lastVederlagEvent.belop_direkte) return null;
      return nyttBelopDirekte - lastVederlagEvent.belop_direkte;
    }
  }, [erRegningsarbeid, nyttBelopDirekte, nyttKostnadsOverslag, lastVederlagEvent]);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: ReviseVederlagFormData) => {
    mutation.mutate({
      eventType: 'vederlag_krav_oppdatert',
      data: {
        original_event_id: lastVederlagEvent.event_id,
        nytt_belop_direkte: erRegningsarbeid ? undefined : data.nytt_belop_direkte,
        nytt_kostnads_overslag: erRegningsarbeid ? data.nytt_kostnads_overslag : undefined,
        begrunnelse: data.begrunnelse,
        dato_revidert: new Date().toISOString().split('T')[0],
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Revider vederlagskrav"
      description="Endre beløp eller prisoverslag for dette kravet."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Current state */}
        <div className="bg-gray-50 p-4 rounded border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">Metode:</p>
              <Badge variant="neutral">{METODE_LABELS[lastVederlagEvent.metode]}</Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">
                {erRegningsarbeid ? 'Nåværende overslag:' : 'Nåværende krav:'}
              </p>
              <p className="text-2xl font-bold">
                kr {gjeldendeBelop?.toLocaleString('nb-NO')},-
              </p>
            </div>
          </div>
        </div>

        {/* Overslag increase warning (§30.2) - ANY increase triggers warning */}
        {overslagsokningVarselpliktig && (
          <Alert variant="danger" title="Varslingsplikt (§30.2 andre ledd)">
            <p>
              Du øker kostnadsoverslaget. I henhold til §30.2 andre ledd <strong>må</strong> du varsle BH
              &ldquo;uten ugrunnet opphold&rdquo; når det er grunn til å anta at overslaget vil bli overskredet.
            </p>
            <p className="mt-2 text-sm">
              Ved å sende denne revisjonen dokumenterer du varselet. Begrunn hvorfor kostnadene øker.
            </p>
          </Alert>
        )}

        {/* New amount/estimate input */}
        <FormField
          label={erRegningsarbeid ? 'Nytt kostnadsoverslag' : 'Nytt beløp'}
          helpText={erRegningsarbeid ? 'Det reviderte overslaget for regningsarbeidet' : undefined}
        >
          <Controller
            name={erRegningsarbeid ? 'nytt_kostnads_overslag' : 'nytt_belop_direkte'}
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

        {/* Change display */}
        {belopEndring !== null && belopEndring !== 0 && gjeldendeBelop && (
          <div className={`p-3 rounded border ${belopEndring > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-sm">
              Endring: <strong className={belopEndring > 0 ? 'text-red-700' : 'text-green-700'}>
                {belopEndring > 0 ? '+' : ''}{belopEndring.toLocaleString('nb-NO')} kr
              </strong>
              {' '}
              ({((belopEndring / gjeldendeBelop) * 100).toFixed(1)}%)
            </p>
          </div>
        )}

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
                  overslagsokningVarselpliktig
                    ? 'Begrunn hvorfor kostnadene øker utover opprinnelig overslag...'
                    : 'Begrunn endringen i beløp...'
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
            variant={overslagsokningVarselpliktig ? 'danger' : 'primary'}
            disabled={isSubmitting}
            size="lg"
          >
            {isSubmitting
              ? 'Sender...'
              : overslagsokningVarselpliktig
                ? 'Send Varsel om Overslagsoverskridelse'
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
