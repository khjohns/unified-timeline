/**
 * ReviseVederlagModal Component
 *
 * Modal for TE to revise vederlag claim amount or cost estimate.
 * Key logic: For REGNINGSARBEID, increasing overslag triggers varslingsplikt (§30.2)
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Textarea } from '../primitives/Textarea';
import { FormField } from '../primitives/FormField';
import { Alert } from '../primitives/Alert';
import { Badge } from '../primitives/Badge';
import { CurrencyInput } from '../primitives/CurrencyInput';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useMemo } from 'react';
import { VederlagTilstand, VederlagsMetode } from '../../types/timeline';
import { erOverslagsokningVarselpliktig } from '../../utils/preklusjonssjekk';

const reviseVederlagSchema = z.object({
  nytt_belop: z.number().optional(),
  nytt_overslag: z.number().optional(),
  begrunnelse: z.string().min(10, 'Begrunnelse er påkrevd'),
});

type ReviseVederlagFormData = z.infer<typeof reviseVederlagSchema>;

interface ReviseVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  lastVederlagEvent: {
    event_id: string;
    belop: number;
    metode: VederlagsMetode;
    overslag?: number;
  };
  vederlagTilstand: VederlagTilstand;
}

const METODE_LABELS: Record<VederlagsMetode, string> = {
  kontrakt_ep: 'Kontraktens enhetspriser',
  justert_ep: 'Justerte enhetspriser',
  regning: 'Regningsarbeid',
  overslag: 'Regningsarbeid med overslag',
  tilbud: 'Fastpris/Tilbud',
};

export function ReviseVederlagModal({
  open,
  onOpenChange,
  sakId,
  lastVederlagEvent,
  vederlagTilstand,
}: ReviseVederlagModalProps) {
  const erRegningsarbeid = lastVederlagEvent.metode === 'overslag' ||
    lastVederlagEvent.metode === 'regning';
  const harOverslag = lastVederlagEvent.metode === 'overslag';

  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    watch,
    reset,
  } = useForm<ReviseVederlagFormData>({
    resolver: zodResolver(reviseVederlagSchema),
    defaultValues: {
      nytt_belop: harOverslag ? undefined : lastVederlagEvent.belop,
      nytt_overslag: harOverslag ? lastVederlagEvent.overslag : undefined,
      begrunnelse: '',
    },
  });

  const nyttBelop = watch('nytt_belop');
  const nyttOverslag = watch('nytt_overslag');

  // Check if overslag increase triggers varslingsplikt (§30.2)
  const overslagsokningVarselpliktig = useMemo(() => {
    if (!harOverslag || !nyttOverslag || !lastVederlagEvent.overslag) return false;
    return erOverslagsokningVarselpliktig(lastVederlagEvent.overslag, nyttOverslag);
  }, [harOverslag, nyttOverslag, lastVederlagEvent.overslag]);

  // Calculate change amounts
  const belopEndring = useMemo(() => {
    if (harOverslag) {
      if (!nyttOverslag || !lastVederlagEvent.overslag) return null;
      return nyttOverslag - lastVederlagEvent.overslag;
    } else {
      if (!nyttBelop) return null;
      return nyttBelop - lastVederlagEvent.belop;
    }
  }, [harOverslag, nyttBelop, nyttOverslag, lastVederlagEvent]);

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
        nytt_belop: harOverslag ? undefined : data.nytt_belop,
        nytt_overslag: harOverslag ? data.nytt_overslag : undefined,
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-06">
        {/* Current state */}
        <div className="bg-gray-50 p-4 rounded border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">Metode:</p>
              <Badge variant="neutral">{METODE_LABELS[lastVederlagEvent.metode]}</Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">
                {harOverslag ? 'Nåværende overslag:' : 'Nåværende krav:'}
              </p>
              <p className="text-2xl font-bold">
                kr {(harOverslag ? lastVederlagEvent.overslag : lastVederlagEvent.belop)?.toLocaleString('nb-NO')},-
              </p>
            </div>
          </div>
        </div>

        {/* Overslag increase warning (§30.2) */}
        {overslagsokningVarselpliktig && (
          <Alert variant="danger" title="Varslingspikt (§30.2)">
            <p>
              Overslagsøkningen på mer enn 15% utløser varslingspikt. Du må varsle BH
              "uten ugrunnet opphold" om at kostnadene vil overskride opprinnelig overslag.
            </p>
            <p className="mt-2 text-sm">
              Ved å sende denne revisjonen, dokumenterer du at varselet nå sendes.
            </p>
          </Alert>
        )}

        {/* New amount/estimate input */}
        <FormField
          label={harOverslag ? 'Nytt prisoverslag' : 'Nytt beløp'}
          helpText={harOverslag ? 'Det reviderte overslaget for regningsarbeidet' : undefined}
        >
          <Controller
            name={harOverslag ? 'nytt_overslag' : 'nytt_belop'}
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
        {belopEndring !== null && belopEndring !== 0 && (
          <div className={`p-3 rounded border ${belopEndring > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-sm">
              Endring: <strong className={belopEndring > 0 ? 'text-red-700' : 'text-green-700'}>
                {belopEndring > 0 ? '+' : ''}{belopEndring.toLocaleString('nb-NO')} kr
              </strong>
              {' '}
              ({((belopEndring / (harOverslag ? lastVederlagEvent.overslag! : lastVederlagEvent.belop)) * 100).toFixed(1)}%)
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
        <div className="flex justify-end gap-pkt-04 pt-pkt-06 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
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
    </Modal>
  );
}
