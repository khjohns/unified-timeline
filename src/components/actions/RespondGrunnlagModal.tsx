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

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Textarea } from '../primitives/Textarea';
import { FormField } from '../primitives/FormField';
import { Badge } from '../primitives/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/Select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
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
  /** Optional grunnlag event data for context display and logic */
  grunnlagEvent?: GrunnlagEventInfo;
}

export function RespondGrunnlagModal({
  open,
  onOpenChange,
  sakId,
  grunnlagEvent,
}: RespondGrunnlagModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    control,
  } = useForm<RespondGrunnlagFormData>({
    resolver: zodResolver(respondGrunnlagSchema),
    defaultValues: {
      resultat: undefined,
    },
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
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
      description="Vurder ansvarsgrunnlaget (hvem sin feil). Dette påvirker om vederlag/frist vurderes prinsipalt eller subsidiært."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-06">
        {/* Grunnlag summary - show if event data is available */}
        {grunnlagEvent && (hovedkategoriLabel || grunnlagEvent.beskrivelse) && (
          <div className="p-pkt-04 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
            <h4 className="font-bold text-sm text-pkt-text-body-dark mb-2">
              Entreprenørens påstand:
            </h4>
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
          </div>
        )}

        {/* Force Majeure info */}
        {erForceMajeure && (
          <div className="p-pkt-04 bg-amber-50 border-2 border-amber-300 rounded-none">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="warning">Force Majeure (§33.3)</Badge>
            </div>
            <p className="text-sm text-amber-900">
              Force Majeure gir kun rett til <strong>fristforlengelse</strong>,
              ikke vederlagsjustering. Vurder om hendelsen ligger utenfor begge
              parters kontroll.
            </p>
          </div>
        )}

        {/* BH Passivity warning (§32.3) */}
        {erPassiv && (
          <div
            className="p-pkt-05 bg-pkt-surface-subtle-light-red border-2 border-pkt-border-red rounded-none"
            role="alert"
          >
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="danger">Passivitetsrisiko (§32.3)</Badge>
            </div>
            <p className="text-base text-pkt-border-red font-medium">
              Du har brukt <strong>{dagerSidenVarsel} dager</strong> på å svare
              på dette varselet om irregulær endring.
            </p>
            <p className="text-sm text-pkt-border-red mt-2">
              Ved irregulær endring kan passivitet medføre at endringen anses
              akseptert. Hvis du avslår, bør du dokumentere hvorfor forsinkelsen
              var begrunnet.
            </p>
          </div>
        )}

        {/* Resultat */}
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
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger error={!!errors.resultat}>
                  <SelectValue placeholder="Velg resultat" />
                </SelectTrigger>
                <SelectContent>
                  {BH_GRUNNLAGSVAR_OPTIONS.filter((opt) => {
                    // Filter out empty placeholder
                    if (opt.value === '') return false;
                    // Filter out "frafalt" if NOT irregular change (§32.3 c)
                    if (opt.value === 'frafalt' && !erIrregulaer) return false;
                    return true;
                  }).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        {/* Show description of selected resultat */}
        {selectedResultat &&
          BH_GRUNNLAGSVAR_DESCRIPTIONS[selectedResultat] && (
            <div className="p-pkt-04 bg-pkt-surface-subtle rounded-none border-l-4 border-pkt-border-focus">
              <p className="text-sm text-pkt-text-body-subtle">
                {BH_GRUNNLAGSVAR_DESCRIPTIONS[selectedResultat]}
              </p>
            </div>
          )}

        {/* Frafall info (§32.3 c) */}
        {selectedResultat === 'frafalt' && (
          <div className="p-pkt-04 bg-blue-50 border-2 border-blue-300 rounded-none">
            <p className="text-sm font-medium text-blue-900 mb-2">
              §32.3 c) - Frafall av pålegget:
            </p>
            <p className="text-sm text-blue-800">
              Ved å frafalle pålegget bekrefter du at arbeidet <strong>ikke skal
              utføres</strong>. Dette er en endelig beslutning for irregulære
              endringer (§32.2). Entreprenøren trenger ikke å utføre det pålagte
              arbeidet, og saken avsluttes.
            </p>
          </div>
        )}

        {/* Subsidiary treatment warning when rejecting */}
        {selectedResultat === 'avvist_uenig' && (
          <div className="p-pkt-04 bg-amber-50 border-2 border-amber-300 rounded-none">
            <p className="text-sm font-medium text-amber-900 mb-2">
              Konsekvens av avslag:
            </p>
            <p className="text-sm text-amber-800">
              Saken markeres som <em>omtvistet</em>. Entreprenøren vil likevel
              kunne sende inn krav om Vederlag og Frist. Du må da behandle disse
              kravene <strong>subsidiært</strong> (dvs. &ldquo;hva kravet hadde
              vært verdt <em>hvis</em> du tok feil om ansvaret&rdquo;).
            </p>
            <p className="text-sm text-amber-800 mt-2">
              Dette sikrer at dere får avklart uenighet om beregning (utmåling)
              tidlig, selv om dere er uenige om ansvaret.
            </p>
          </div>
        )}

        {/* EO generation info when approving */}
        {selectedResultat === 'godkjent' && !erForceMajeure && (
          <div className="p-pkt-04 bg-green-50 border-2 border-green-300 rounded-none">
            <p className="text-sm font-medium text-green-900 mb-1">
              Systemhandling:
            </p>
            <p className="text-sm text-green-800">
              Når du sender svaret, vil systemet automatisk registrere at
              grunnlaget er godkjent. Endringsordre (EO) kan utstedes når
              vederlag og frist også er avklart.
            </p>
          </div>
        )}

        {/* Begrunnelse */}
        <FormField
          label="Begrunnelse"
          required
          error={errors.begrunnelse?.message}
        >
          <Textarea
            id="begrunnelse"
            {...register('begrunnelse')}
            rows={5}
            fullWidth
            placeholder={
              selectedResultat === 'avvist_uenig'
                ? 'Forklar hvorfor du mener forholdet er en del av kontrakten eller TE sin risiko...'
                : 'Begrunn din vurdering av grunnlaget...'
            }
            error={!!errors.begrunnelse}
          />
        </FormField>

        {/* Error Message */}
        {mutation.isError && (
          <div
            className="p-pkt-05 bg-pkt-surface-subtle-light-red border-2 border-pkt-border-red rounded-none"
            role="alert"
          >
            <p className="text-base text-pkt-border-red font-medium">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'En feil oppstod'}
            </p>
          </div>
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
            variant={selectedResultat === 'avvist_uenig' ? 'danger' : 'primary'}
            disabled={isSubmitting}
            size="lg"
          >
            {isSubmitting ? 'Sender...' : 'Send svar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
