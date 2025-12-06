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
 *   - kreverJustertEP as checkbox under ENHETSPRISER method
 *   - Bevisbyrde warning for regningsarbeid without prior notice
 *
 * UPDATED (2025-12-06):
 * - Fixed §34.1.3: Separate date fields for rigg/drift and produktivitet
 *   Per standarden: "etter at han blir eller burde ha blitt klar over at utgifter ville påløpe"
 *   TE kan bli klar over disse kostnadene på ulike tidspunkt, så separate frister er korrekt
 * - Separate amount fields for each særskilt krav type
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Textarea } from '../primitives/Textarea';
import { Checkbox } from '../primitives/Checkbox';
import { FormField } from '../primitives/FormField';
import { DatePicker } from '../primitives/DatePicker';
import { Badge } from '../primitives/Badge';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { RadioGroup, RadioItem } from '../primitives/RadioGroup';
import { CurrencyInput } from '../primitives/CurrencyInput';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useMemo } from 'react';
import { sjekkRiggDriftFrist } from '../../utils/preklusjonssjekk';
import type { VederlagsMetode } from '../../types/timeline';

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
  // Per §34.1.3: Separate datoer fordi TE kan bli klar over ulike kostnader på ulike tidspunkt
  har_rigg_krav: z.boolean().optional(),
  har_produktivitet_krav: z.boolean().optional(),
  belop_rigg: z.number().optional(),
  belop_produktivitet: z.number().optional(),
  dato_klar_over_rigg: z.string().optional(),
  dato_klar_over_produktivitet: z.string().optional(),
}).refine(
  (data) => {
    // belop_direkte is required for ENHETSPRISER and FASTPRIS_TILBUD
    if (data.metode === 'ENHETSPRISER' || data.metode === 'FASTPRIS_TILBUD') {
      return data.belop_direkte !== undefined;
    }
    return true;
  },
  {
    message: 'Beløp er påkrevd',
    path: ['belop_direkte'],
  }
);

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
  /** ID of the grunnlag event this vederlag claim is linked to (required for event sourcing) */
  grunnlagEventId: string;
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
  grunnlagEventId,
  grunnlagEvent,
}: SendVederlagModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
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

  // Watch form values for conditional rendering
  const selectedMetode = watch('metode');
  const kreverJustertEp = watch('krever_justert_ep');
  const varsletForOppstart = watch('varslet_for_oppstart');
  const harRiggKrav = watch('har_rigg_krav');
  const harProduktivitetKrav = watch('har_produktivitet_krav');
  const datoKlarOverRigg = watch('dato_klar_over_rigg');
  const datoKlarOverProduktivitet = watch('dato_klar_over_produktivitet');

  // Determine if this is a subsidiary claim (grunnlag was rejected)
  const erSubsidiaer = grunnlagEvent?.status === 'avvist_uenig';

  // Check preclusion for rigg/drift (§34.1.3 første ledd) - 7 days threshold
  const riggPreklusjon = useMemo(() => {
    if (!harRiggKrav || !datoKlarOverRigg) return null;
    return sjekkRiggDriftFrist(datoKlarOverRigg);
  }, [harRiggKrav, datoKlarOverRigg]);

  // Check preclusion for produktivitet (§34.1.3 annet ledd) - 7 days threshold
  const produktivitetPreklusjon = useMemo(() => {
    if (!harProduktivitetKrav || !datoKlarOverProduktivitet) return null;
    return sjekkRiggDriftFrist(datoKlarOverProduktivitet);
  }, [harProduktivitetKrav, datoKlarOverProduktivitet]);

  const onSubmit = (data: VederlagFormData) => {
    // Build særskilt krav structure with separate dates per §34.1.3
    // TE kan bli klar over rigg/drift og produktivitetstap på ulike tidspunkt
    const saerskiltKrav =
      data.har_rigg_krav || data.har_produktivitet_krav
        ? {
            rigg_drift: data.har_rigg_krav
              ? {
                  belop: data.belop_rigg,
                  dato_klar_over: data.dato_klar_over_rigg,
                }
              : undefined,
            produktivitet: data.har_produktivitet_krav
              ? {
                  belop: data.belop_produktivitet,
                  dato_klar_over: data.dato_klar_over_produktivitet,
                }
              : undefined,
          }
        : null;

    mutation.mutate({
      eventType: 'vederlag_krav_sendt',
      data: {
        grunnlag_event_id: grunnlagEventId,
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Grunnlag context display */}
        {grunnlagEvent && grunnlagEvent.tittel && (
          <div className="p-4 bg-pkt-surface-subtle border-2 border-pkt-border-subtle rounded-none">
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
                <Controller
                  name="belop_direkte"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value ?? null}
                      onChange={field.onChange}
                      fullWidth
                      allowNegative
                    />
                  )}
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
                helpText="§30.2: BH kan holde tilbake betaling inntil overslag mottas. Du må varsle ved enhver økning."
              >
                <Controller
                  name="kostnads_overslag"
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
              <Controller
                name="belop_direkte"
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
          )}
        </div>

        {/* 3. Særskilte krav (§34.1.3) - Rigg, Drift, Produktivitet */}
        <div className="border-2 border-orange-200 bg-orange-50 p-4 rounded">
          <h4 className="font-bold text-sm text-orange-900 mb-2">
            Særskilte krav (Rigg, Drift, Produktivitet)
          </h4>
          <p className="text-xs text-orange-800 mb-3">
            NB: Disse postene krever <strong>særskilt varsel</strong>. Kravet tapes totalt ved manglende varsel (§34.1.3).
            Varslingsfristen løper separat for hver kostnadstype fra når TE blir klar over at utgifter vil påløpe.
          </p>

          {/* Rigg/Drift section (§34.1.3 første ledd) */}
          <div className="mb-4">
            <Controller
              name="har_rigg_krav"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="har_rigg_krav"
                  label="Økt Rigg/Drift (§34.1.3 første ledd)"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            {harRiggKrav && (
              <div className="mt-3 ml-6 space-y-4 border-l-2 border-orange-300 pl-4">
                <FormField
                  label="Estimert beløp rigg/drift"
                  error={errors.belop_rigg?.message}
                >
                  <Controller
                    name="belop_rigg"
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

                <FormField
                  label="Når ble du klar over rigg/drift-utgiftene?"
                >
                  <Controller
                    name="dato_klar_over_rigg"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="dato_klar_over_rigg"
                        value={field.value}
                        onChange={field.onChange}
                        fullWidth
                        placeholder="Velg dato"
                      />
                    )}
                  />
                </FormField>

                {/* 7-day preclusion warning for rigg/drift */}
                {riggPreklusjon?.alert && (
                  <Alert
                    variant={riggPreklusjon.alert.variant}
                    title={riggPreklusjon.alert.title}
                  >
                    {riggPreklusjon.alert.message}
                  </Alert>
                )}
              </div>
            )}
          </div>

          {/* Produktivitet section (§34.1.3 annet ledd) */}
          <div>
            <Controller
              name="har_produktivitet_krav"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="har_produktivitet_krav"
                  label="Nedsatt produktivitet (§34.1.3 annet ledd)"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            {harProduktivitetKrav && (
              <div className="mt-3 ml-6 space-y-4 border-l-2 border-orange-300 pl-4">
                <FormField
                  label="Estimert beløp produktivitetstap"
                  error={errors.belop_produktivitet?.message}
                >
                  <Controller
                    name="belop_produktivitet"
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

                <FormField
                  label="Når ble du klar over produktivitetstapet?"
                >
                  <Controller
                    name="dato_klar_over_produktivitet"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="dato_klar_over_produktivitet"
                        value={field.value}
                        onChange={field.onChange}
                        fullWidth
                        placeholder="Velg dato"
                      />
                    )}
                  />
                </FormField>

                {/* 7-day preclusion warning for produktivitet */}
                {produktivitetPreklusjon?.alert && (
                  <Alert
                    variant={produktivitetPreklusjon.alert.variant}
                    title={produktivitetPreklusjon.alert.title}
                  >
                    {produktivitetPreklusjon.alert.message}
                  </Alert>
                )}
              </div>
            )}
          </div>
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
          <Button type="submit" variant="primary" disabled={isSubmitting} size="lg">
            {isSubmitting ? 'Sender...' : 'Send Krav'}
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
