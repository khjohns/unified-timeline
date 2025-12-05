/**
 * SendVederlagModal Component
 *
 * Action modal for submitting a new vederlag (compensation) claim.
 * Uses React Hook Form + Zod for validation.
 *
 * UPDATED (2025-12-05):
 * - Added subsidiary treatment alert when grunnlag is rejected
 * - Restructured to match NS 8407 spec:
 *   - belopDirekte with support for negative values (fradrag)
 *   - RadioGroup for method selection (vertical)
 *   - Combined rigg/drift + produktivitet with shared datoKlarOver and 7-day check
 *   - kreverJustertEP as checkbox under ENHETSPRISER method
 *   - Bevisbyrde warning for regningsarbeid without prior notice
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { Checkbox } from '../primitives/Checkbox';
import { FormField } from '../primitives/FormField';
import { DatePicker } from '../primitives/DatePicker';
import { Badge } from '../primitives/Badge';
import { Alert } from '../primitives/Alert';
import { RadioGroup, RadioItem } from '../primitives/RadioGroup';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import { sjekkRiggDriftFrist } from '../../utils/preklusjonssjekk';

const vederlagSchema = z.object({
  // Direkte kostnader - tillater negative for fradrag (§34.4)
  belop_direkte: z.number().optional(),
  metode: z.enum(['ENHETSPRISER', 'REGNINGSARBEID', 'FASTPRIS_TILBUD'], {
    errorMap: () => ({ message: 'Beregningsmetode er påkrevd' }),
  }),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),

  // Kostnadsoverslag for regningsarbeid (§30.2)
  kostnads_overslag: z.number().optional(),

  // Justerte enhetspriser (§34.3.3) - kun for ENHETSPRISER metode
  krever_justert_ep: z.boolean().optional(),

  // Regningsarbeid (§34.4)
  varslet_for_oppstart: z.boolean().optional(),

  // Særskilte krav (§34.1.3) - Rigg/Drift og Produktivitet
  har_rigg_krav: z.boolean().optional(),
  har_produktivitet_krav: z.boolean().optional(),
  belop_saerskilt: z.number().optional(),
  dato_klar_over: z.string().optional(),
});

type VederlagFormData = z.infer<typeof vederlagSchema>;

// Grunnlag event info for context display
interface GrunnlagEventInfo {
  tittel?: string;
  status?: 'godkjent' | 'avvist_uenig' | 'delvis_godkjent';
  dato_varslet?: string;
}

interface SendVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** Optional grunnlag event data for context display and subsidiary logic */
  grunnlagEvent?: GrunnlagEventInfo;
}

// Method options for RadioGroup
const METODE_OPTIONS = [
  {
    value: 'ENHETSPRISER',
    label: 'Enhetspriser (§34.3)',
    description: 'Beregning basert på kontraktens enhetspriser',
  },
  {
    value: 'REGNINGSARBEID',
    label: 'Regningsarbeid (§34.4)',
    description: 'Kostnader faktureres løpende etter medgått tid og materialer',
  },
  {
    value: 'FASTPRIS_TILBUD',
    label: 'Fastpris/Tilbud (§34.2.1)',
    description: 'Avtalt fastpris for endringsarbeidet',
  },
] as const;

export function SendVederlagModal({
  open,
  onOpenChange,
  sakId,
  grunnlagEvent,
}: SendVederlagModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
    watch,
  } = useForm<VederlagFormData>({
    resolver: zodResolver(vederlagSchema),
    defaultValues: {
      metode: undefined,
      krever_justert_ep: false,
      varslet_for_oppstart: true,
      har_rigg_krav: false,
      har_produktivitet_krav: false,
    },
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  // Watch form values for conditional rendering
  const selectedMetode = watch('metode');
  const kreverJustertEp = watch('krever_justert_ep');
  const varsletForOppstart = watch('varslet_for_oppstart');
  const harRiggKrav = watch('har_rigg_krav');
  const harProduktivitetKrav = watch('har_produktivitet_krav');
  const datoKlarOver = watch('dato_klar_over');

  // Determine if this is a subsidiary claim (grunnlag was rejected)
  const erSubsidiaer = grunnlagEvent?.status === 'avvist_uenig';

  // Check preclusion for særskilte krav (§34.1.3) - 7 days threshold
  const saerskiltPreklusjon = useMemo(() => {
    if ((!harRiggKrav && !harProduktivitetKrav) || !datoKlarOver) return null;
    return sjekkRiggDriftFrist(datoKlarOver);
  }, [harRiggKrav, harProduktivitetKrav, datoKlarOver]);

  const onSubmit = (data: VederlagFormData) => {
    // Build særskilt krav structure
    const saerskiltKrav =
      data.har_rigg_krav || data.har_produktivitet_krav
        ? {
            rigg_drift: data.har_rigg_krav,
            produktivitet: data.har_produktivitet_krav,
            belop: data.belop_saerskilt,
            dato_klar_over: data.dato_klar_over,
          }
        : null;

    mutation.mutate({
      eventType: 'vederlag_krav_sendt',
      data: {
        belop_direkte: data.metode === 'REGNINGSARBEID' ? undefined : data.belop_direkte,
        kostnads_overslag: data.metode === 'REGNINGSARBEID' ? data.kostnads_overslag : undefined,
        metode: data.metode,
        begrunnelse: data.begrunnelse,
        krever_justert_ep: data.metode === 'ENHETSPRISER' ? data.krever_justert_ep : undefined,
        varslet_for_oppstart: data.metode === 'REGNINGSARBEID' ? data.varslet_for_oppstart : undefined,
        saerskilt_krav: saerskiltKrav,
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Krav om Vederlagsjustering"
      description="Fyll ut detaljer for kravet om vederlagsjustering."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-06">
        {/* Grunnlag context display */}
        {grunnlagEvent && grunnlagEvent.tittel && (
          <div className="p-pkt-04 bg-pkt-surface-subtle border-2 border-pkt-border-subtle rounded-none">
            <div className="flex items-center justify-between">
              <span className="text-sm text-pkt-text-body-subtle">
                Knyttet til:
              </span>
              {erSubsidiaer && (
                <Badge variant="warning">Subsidiær behandling</Badge>
              )}
            </div>
            <p className="font-medium text-pkt-text-body-dark mt-1">
              {grunnlagEvent.tittel}
            </p>
          </div>
        )}

        {/* Subsidiary treatment alert */}
        {erSubsidiaer && (
          <Alert variant="info">
            <strong>Merk:</strong> Ansvarsgrunnlaget er avvist av Byggherre.
            Du sender nå inn dette kravet for <strong>subsidiær behandling</strong>.
            Dette sikrer at kravet ditt er registrert og beregnet iht. fristene i NS 8407.
          </Alert>
        )}

        {/* 1. Beregningsmetode (§34.2) - RadioGroup vertical */}
        <FormField
          label="Beregningsmetode (§34.2)"
          required
          error={errors.metode?.message}
        >
          <Controller
            name="metode"
            control={control}
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
              >
                {METODE_OPTIONS.map((option) => (
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

        {/* 2. Direkte kostnader - Metodespesifikk */}
        <div className="bg-gray-50 p-4 rounded border border-gray-200">
          <h4 className="font-bold text-sm mb-3">Direkte kostnader (Materialer/Arbeid)</h4>

          {selectedMetode === 'ENHETSPRISER' && (
            <>
              <FormField
                label="Sum direkte kostnader (Bruk minus for fradrag)"
                required
                error={errors.belop_direkte?.message}
                helpText="Fradrag skal gjøres med reduksjon for fortjeneste (§34.4)"
              >
                <Input
                  id="belop_direkte"
                  type="number"
                  step="0.01"
                  {...register('belop_direkte', { valueAsNumber: true })}
                  fullWidth
                  placeholder="0.00"
                  error={!!errors.belop_direkte}
                />
              </FormField>

              <div className="mt-4">
                <Controller
                  name="krever_justert_ep"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="krever_justert_ep"
                      label="Krever JUSTERING av enhetsprisene (§34.3.3)?"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                {kreverJustertEp && (
                  <Alert variant="warning" className="mt-2">
                    <strong>OBS:</strong> Krav om justert enhetspris må varsles &ldquo;uten ugrunnet opphold&rdquo;
                    etter at forholdet oppsto. Hvis ikke, får du kun det BH &ldquo;måtte forstå&rdquo;.
                  </Alert>
                )}
              </div>
            </>
          )}

          {selectedMetode === 'REGNINGSARBEID' && (
            <>
              <Alert variant="info" className="mb-3">
                Ved regningsarbeid faktureres kostnadene løpende. Oppgi et kostnadsoverslag (estimat).
              </Alert>

              <FormField
                label="Kostnadsoverslag (estimat)"
                error={errors.kostnads_overslag?.message}
                helpText="§30.2: BH kan holde tilbake betaling inntil overslag mottas. Du må varsle ved vesentlig økning."
              >
                <Input
                  id="kostnads_overslag"
                  type="number"
                  step="0.01"
                  {...register('kostnads_overslag', { valueAsNumber: true })}
                  fullWidth
                  placeholder="0.00"
                  error={!!errors.kostnads_overslag}
                />
              </FormField>

              <div className="mt-4">
                <Controller
                  name="varslet_for_oppstart"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="varslet_for_oppstart"
                      label="Er Byggherren varslet FØR arbeidet startet? (§34.4)"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />

                {!varsletForOppstart && (
                  <Alert variant="danger" className="mt-2">
                    <strong>Advarsel:</strong> Når du ikke varsler før oppstart, får du en strengere bevisbyrde
                    for at kostnadene var nødvendige (§30 / §34.4).
                  </Alert>
                )}
              </div>
            </>
          )}

          {selectedMetode === 'FASTPRIS_TILBUD' && (
            <FormField
              label="Tilbudt fastpris (eks. mva)"
              required
              error={errors.belop_direkte?.message}
            >
              <Input
                id="belop_direkte"
                type="number"
                step="0.01"
                {...register('belop_direkte', { valueAsNumber: true })}
                fullWidth
                placeholder="0.00"
                error={!!errors.belop_direkte}
              />
            </FormField>
          )}
        </div>

        {/* 3. Særskilte krav (§34.1.3) - Rigg, Drift, Produktivitet */}
        <div className="border-2 border-orange-200 bg-orange-50 p-4 rounded">
          <h4 className="font-bold text-sm text-orange-900 mb-2">
            Særskilte krav (Rigg, Drift, Produktivitet)
          </h4>
          <p className="text-xs text-orange-800 mb-3">
            NB: Disse postene krever <strong>særskilt varsel</strong>. Kravet tapes totalt ved manglende varsel (§34.1.3).
          </p>

          <div className="flex gap-4 mb-3">
            <Controller
              name="har_rigg_krav"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="har_rigg_krav"
                  label="Økt Rigg/Drift"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Controller
              name="har_produktivitet_krav"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="har_produktivitet_krav"
                  label="Nedsatt produktivitet"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          {(harRiggKrav || harProduktivitetKrav) && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <FormField
                label="Estimert beløp særskilte krav"
                error={errors.belop_saerskilt?.message}
              >
                <Input
                  id="belop_saerskilt"
                  type="number"
                  step="0.01"
                  {...register('belop_saerskilt', { valueAsNumber: true })}
                  fullWidth
                  placeholder="0.00"
                />
              </FormField>

              <FormField
                label="Når ble du klar over disse utgiftene?"
              >
                <Controller
                  name="dato_klar_over"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      id="dato_klar_over"
                      value={field.value}
                      onChange={field.onChange}
                      fullWidth
                      placeholder="Velg dato"
                    />
                  )}
                />
              </FormField>
            </div>
          )}

          {/* 7-day preclusion warning for særskilte krav */}
          {saerskiltPreklusjon?.alert && (
            <Alert
              variant={saerskiltPreklusjon.alert.variant}
              title={saerskiltPreklusjon.alert.title}
              className="mt-3"
            >
              {saerskiltPreklusjon.alert.message}
            </Alert>
          )}
        </div>

        {/* 4. Begrunnelse/Dokumentasjon */}
        <FormField
          label="Begrunnelse/Dokumentasjon"
          required
          error={errors.begrunnelse?.message}
        >
          <Textarea
            id="begrunnelse"
            {...register('begrunnelse')}
            rows={3}
            fullWidth
            placeholder="Henvis til vedlegg, beskriv beregningsgrunnlag..."
            error={!!errors.begrunnelse}
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
          <Button type="submit" variant="primary" disabled={isSubmitting} size="lg">
            {isSubmitting ? 'Sender...' : 'Send Krav'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
