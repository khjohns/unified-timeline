/**
 * RespondVederlagModal Component
 *
 * Action modal for BH (client) to respond to a vederlag (compensation) claim.
 * Uses a 3-port wizard model matching NS 8407 requirements.
 *
 * UPDATED (2025-12-05):
 * - Added subsidiary badge and info when grunnlag is rejected
 * - Added §30.2 hold_tilbake option for regningsarbeid without kostnadsoverslag
 * - Added §34.1.3 rigg-preklusjon option
 * - Added §34.3.3 EP-justering alert
 * - Added display of vederlagskrav details
 *
 * UPDATED (2025-12-06):
 * - Updated saerskilt_krav interface to handle separate rigg_drift and produktivitet
 *   objects with individual belop and dato_klar_over fields (per §34.1.3)
 * - Enhanced display to show amounts and dates for each særskilt krav type
 *
 * UPDATED (2025-12-08):
 * - Refactored to 3-port wizard model (Preklusjon → Vilkår/Metode → Beregning)
 * - Added StepIndicator for visual progress
 * - Separated preclusion checks to Port 1
 * - Moved method/EP-justering to Port 2
 * - Calculation and amounts in Port 3
 */

import { useState } from 'react';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { FormField } from '../primitives/FormField';
import { CurrencyInput } from '../primitives/CurrencyInput';
import { Textarea } from '../primitives/Textarea';
import { RadioGroup, RadioItem } from '../primitives/RadioGroup';
import { Badge } from '../primitives/Badge';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { StepIndicator } from '../primitives/StepIndicator';
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
import { useConfirmClose } from '../../hooks/useConfirmClose';
import {
  BH_VEDERLAGSSVAR_OPTIONS,
  VEDERLAGSMETODER_OPTIONS,
  getBhVederlagssvarValues,
  BH_VEDERLAGSSVAR_DESCRIPTIONS,
  getVederlagsmetodeLabel,
} from '../../constants';
import { differenceInDays } from 'date-fns';

// Response options for særskilte krav (§34.1.3)
const SAERSKILT_KRAV_RESULTAT_OPTIONS = [
  { value: 'godkjent', label: 'Godkjent' },
  { value: 'delvis_godkjent', label: 'Delvis godkjent' },
  { value: 'avvist_preklusjon', label: 'Avvist - Varslet for sent (preklusjon)' },
  { value: 'avvist_uenig', label: 'Avvist - Uenig i kravet' },
] as const;

// Schema for særskilt krav response
const saerskiltKravResponseSchema = z.object({
  resultat: z.enum(['godkjent', 'delvis_godkjent', 'avvist_preklusjon', 'avvist_uenig']),
  godkjent_belop: z.number().min(0).optional(),
  begrunnelse: z.string().optional(),
});

// Extended schema with port fields
const respondVederlagSchema = z.object({
  // Port 1: Preklusjon
  noytralt_varsel_ok: z.boolean().optional(),
  spesifisert_krav_ok: z.boolean(),
  begrunnelse_varsel: z.string().optional(),

  // Port 2: Vilkår / Metode
  aksepterer_metode: z.boolean(),
  begrunnelse_metode: z.string().optional(),
  ep_justering_akseptert: z.boolean().optional(),
  hold_tilbake: z.boolean().optional(),

  // Port 3: Beregning
  resultat: z.enum(getBhVederlagssvarValues(), {
    errorMap: () => ({ message: 'Resultat er påkrevd' }),
  }),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  godkjent_belop: z.number().min(0, 'Beløp kan ikke være negativt').optional(),
  godkjent_metode: z.string().optional(),
  // Separate responses for særskilte krav (§34.1.3)
  saerskilt_rigg_drift: saerskiltKravResponseSchema.optional(),
  saerskilt_produktivitet: saerskiltKravResponseSchema.optional(),
});

type RespondVederlagFormData = z.infer<typeof respondVederlagSchema>;

// Særskilt krav item structure (§34.1.3)
interface SaerskiltKravItem {
  belop?: number;
  dato_klar_over?: string;
}

// Vederlag event info for context display and conditional logic
// Matches payload from SendVederlagModal (updated 2025-12-06)
interface VederlagEventInfo {
  metode?: 'ENHETSPRISER' | 'REGNINGSARBEID' | 'FASTPRIS_TILBUD';
  belop_direkte?: number;
  kostnads_overslag?: number;
  begrunnelse?: string;
  krever_justert_ep?: boolean;
  saerskilt_krav?: {
    rigg_drift?: SaerskiltKravItem;
    produktivitet?: SaerskiltKravItem;
  };
  /** Date when the specified claim was received (for preclusion calculation) */
  dato_krav_mottatt?: string;
}

interface RespondVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the vederlag claim event being responded to (required for event sourcing) */
  vederlagKravId: string;
  krevdBelop?: number;
  /** Optional vederlag event data for context display and conditional logic */
  vederlagEvent?: VederlagEventInfo;
  /** Status of the grunnlag response (for subsidiary treatment) */
  grunnlagStatus?: 'godkjent' | 'avvist_uenig' | 'delvis_godkjent';
  /** Type of varsel TE sent (nøytralt or spesifisert) - determines which checks to show */
  varselType?: 'noytralt' | 'spesifisert';
}

export function RespondVederlagModal({
  open,
  onOpenChange,
  sakId,
  vederlagKravId,
  krevdBelop,
  vederlagEvent,
  grunnlagStatus,
  varselType,
}: RespondVederlagModalProps) {
  const [currentPort, setCurrentPort] = useState(1);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
    trigger,
  } = useForm<RespondVederlagFormData>({
    resolver: zodResolver(respondVederlagSchema),
    defaultValues: {
      spesifisert_krav_ok: true,
      aksepterer_metode: true,
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: () => {
      reset();
      setCurrentPort(1);
    },
    onClose: () => onOpenChange(false),
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      setCurrentPort(1);
      onOpenChange(false);
    },
  });

  // Watch form values
  const spesifisertKravOk = watch('spesifisert_krav_ok');
  const akseptererMetode = watch('aksepterer_metode');
  const selectedResultat = watch('resultat');
  const godkjentBelop = watch('godkjent_belop');

  // Determine if this is subsidiary treatment (grunnlag was rejected)
  const erSubsidiaer = grunnlagStatus === 'avvist_uenig';

  // §30.2 Logic: Can hold back payment if regningsarbeid without kostnadsoverslag
  const kanHoldeTilbake =
    vederlagEvent?.metode === 'REGNINGSARBEID' && !vederlagEvent?.kostnads_overslag;

  // §34.3.3 Logic: Must respond to EP adjustment request
  const maSvarePaJustering =
    vederlagEvent?.metode === 'ENHETSPRISER' && vederlagEvent?.krever_justert_ep;

  // §34.1.3 Logic: Can reject rigg/drift if sent too late
  const harSaerskiltKrav =
    vederlagEvent?.saerskilt_krav?.rigg_drift !== undefined ||
    vederlagEvent?.saerskilt_krav?.produktivitet !== undefined;

  // Get method label for display
  const metodeLabel = vederlagEvent?.metode
    ? getVederlagsmetodeLabel(vederlagEvent.metode)
    : undefined;

  // Get display amount (belop_direkte for ENHETSPRISER/FASTPRIS, kostnads_overslag for REGNINGSARBEID)
  const visningsbelop =
    vederlagEvent?.metode === 'REGNINGSARBEID'
      ? vederlagEvent?.kostnads_overslag
      : vederlagEvent?.belop_direkte;

  // Calculate BH response time for preclusion warning
  const dagerSidenKrav = vederlagEvent?.dato_krav_mottatt
    ? differenceInDays(new Date(), new Date(vederlagEvent.dato_krav_mottatt))
    : 0;
  const bhPreklusjonsrisiko = dagerSidenKrav > 10;

  const steps = [
    { label: 'Port 1', description: 'Preklusjon' },
    { label: 'Port 2', description: 'Vilkår/Metode' },
    { label: 'Port 3', description: 'Beregning' },
  ];

  const onSubmit = (data: RespondVederlagFormData) => {
    mutation.mutate({
      eventType: 'respons_vederlag',
      data: {
        vederlag_krav_id: vederlagKravId,
        // Port 1
        noytralt_varsel_ok: data.noytralt_varsel_ok,
        spesifisert_krav_ok: data.spesifisert_krav_ok,
        begrunnelse_varsel: data.begrunnelse_varsel,
        // Port 2
        aksepterer_metode: data.aksepterer_metode,
        begrunnelse_metode: data.begrunnelse_metode,
        ep_justering_akseptert: data.ep_justering_akseptert,
        hold_tilbake: data.hold_tilbake,
        // Port 3
        resultat: data.resultat,
        begrunnelse: data.begrunnelse,
        godkjent_belop: data.godkjent_belop,
        godkjent_metode: data.godkjent_metode,
        saerskilt_rigg_drift: data.saerskilt_rigg_drift,
        saerskilt_produktivitet: data.saerskilt_produktivitet,
      },
    });
  };

  const goToNextPort = async () => {
    // Validate current port before proceeding
    let isValid = true;
    if (currentPort === 1) {
      isValid = await trigger([
        'spesifisert_krav_ok',
        'noytralt_varsel_ok',
        'begrunnelse_varsel',
      ]);
    } else if (currentPort === 2) {
      isValid = await trigger([
        'aksepterer_metode',
        'begrunnelse_metode',
        'ep_justering_akseptert',
        'hold_tilbake',
      ]);
    }

    if (isValid && currentPort < 3) {
      setCurrentPort(currentPort + 1);
    }
  };

  const goToPrevPort = () => {
    if (currentPort > 1) {
      setCurrentPort(currentPort - 1);
    }
  };

  // Determine if we should show amount field
  const showAmountField =
    selectedResultat === 'godkjent_fullt' ||
    selectedResultat === 'delvis_godkjent' ||
    selectedResultat === 'godkjent_annen_metode';

  // Determine if we should show method field
  const showMethodField = selectedResultat === 'godkjent_annen_metode';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Svar på vederlagskrav"
      description="Vurder vederlagskravet gjennom tre porter: Preklusjon → Vilkår/Metode → Beregning"
      size="lg"
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <StepIndicator currentStep={currentPort} steps={steps} />

        {/* BH preclusion warning */}
        {bhPreklusjonsrisiko && (
          <div
            className="p-5 bg-pkt-surface-subtle-light-red border-2 border-pkt-border-red rounded-none"
            role="alert"
          >
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="danger">Preklusjonsrisiko</Badge>
            </div>
            <p className="text-base text-pkt-border-red font-medium">
              Du har brukt <strong>{dagerSidenKrav} dager</strong> på å svare på dette
              vederlagskravet.
            </p>
            <p className="text-sm text-pkt-border-red mt-2">
              Du skal svare &ldquo;uten ugrunnet opphold&rdquo;.
              <strong>
                {' '}
                Innsigelser mot kravet tapes dersom de ikke fremsettes innen fristen.
              </strong>
            </p>
          </div>
        )}

        {/* Subsidiary badge and info */}
        {erSubsidiaer && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-none">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="warning">Subsidiær behandling</Badge>
            </div>
            <p className="text-sm text-amber-800">
              Du har avvist ansvarsgrunnlaget. Dine svar gjelder derfor{' '}
              <strong>kun subsidiært</strong>.
            </p>
          </div>
        )}

        {/* Display of vederlagskrav details */}
        {vederlagEvent && (metodeLabel || visningsbelop != null) && (
          <div className="p-4 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
            <h4 className="font-bold text-sm text-pkt-text-body-dark mb-2">
              Entreprenørens krav:
            </h4>
            <div className="flex justify-between items-center">
              {metodeLabel && <span className="font-medium">{metodeLabel}</span>}
              {visningsbelop != null && (
                <span className="text-lg font-mono">
                  {vederlagEvent.metode === 'REGNINGSARBEID'
                    ? `Overslag: kr ${visningsbelop.toLocaleString('nb-NO')},-`
                    : `kr ${visningsbelop.toLocaleString('nb-NO')},-`}
                </span>
              )}
            </div>
            {vederlagEvent.metode === 'REGNINGSARBEID' && (
              <p className="text-sm mt-1 text-pkt-text-body-subtle">
                Endelig beløp fastsettes etter medgått tid
              </p>
            )}
            {vederlagEvent.begrunnelse && (
              <p className="italic text-pkt-text-body-subtle mt-2 text-sm border-t pt-2 border-pkt-border-subtle">
                &ldquo;{vederlagEvent.begrunnelse}&rdquo;
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* PORT 1: Preklusjon */}
          {currentPort === 1 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="info">Port 1</Badge>
                <h3 className="font-bold text-lg">Preklusjon (§34.1, §34.2)</h3>
              </div>
              <p className="text-sm text-pkt-text-body-subtle mb-4">
                Vurder om entreprenøren har varslet i tide. Hvis ikke, kan kravet avvises pga
                preklusjon.
              </p>

              {/* Show what type of varsel TE sent */}
              {varselType && (
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle mb-4">
                  <span className="text-sm text-pkt-text-body-subtle">
                    Entreprenøren har sendt:{' '}
                  </span>
                  <Badge variant="default">
                    {varselType === 'noytralt' && 'Nøytralt varsel (§34.1)'}
                    {varselType === 'spesifisert' && 'Spesifisert krav (§34.2)'}
                  </Badge>
                </div>
              )}

              {/* Nøytralt varsel - only show if TE sent nøytralt varsel */}
              {varselType === 'noytralt' && (
                <FormField
                  label="Nøytralt varsel sendt i tide? (§34.1)"
                  required
                  helpText="Entreprenøren skal varsle 'uten ugrunnet opphold' når han blir klar over at det kan oppstå grunnlag for vederlagsjustering."
                >
                  <Controller
                    name="noytralt_varsel_ok"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup
                        value={field.value === undefined ? undefined : field.value ? 'ja' : 'nei'}
                        onValueChange={(val: string) => field.onChange(val === 'ja')}
                      >
                        <RadioItem value="ja" label="Ja - varslet i tide" />
                        <RadioItem value="nei" label="Nei - varslet for sent (preklusjon)" />
                      </RadioGroup>
                    )}
                  />
                </FormField>
              )}

              {/* Spesifisert krav - show if TE sent spesifisert krav or as fallback */}
              {(varselType === 'spesifisert' || !varselType) && (
                <FormField
                  label="Spesifisert krav sendt i tide? (§34.2)"
                  required
                  helpText="Entreprenøren skal 'uten ugrunnet opphold' spesifisere og begrunne kravet når han har grunnlag."
                >
                  <Controller
                    name="spesifisert_krav_ok"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup
                        value={field.value ? 'ja' : 'nei'}
                        onValueChange={(val: string) => field.onChange(val === 'ja')}
                      >
                        <RadioItem value="ja" label="Ja - kravet kom i tide" />
                        <RadioItem value="nei" label="Nei - kravet kom for sent (preklusjon)" />
                      </RadioGroup>
                    )}
                  />
                </FormField>
              )}

              {/* Særskilte krav preklusjon (§34.1.3) */}
              {harSaerskiltKrav && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-none">
                  <p className="text-sm font-medium text-amber-900 mb-2">
                    Særskilte krav - preklusjonsvurdering (§34.1.3)
                  </p>
                  <p className="text-sm text-amber-800 mb-3">
                    Krav på dekning av rigg/drift og produktivitetstap må varsles uten ugrunnet
                    opphold etter at TE ble klar over grunnlaget.
                  </p>

                  {vederlagEvent?.saerskilt_krav?.rigg_drift && (
                    <div className="mb-3 p-3 bg-white border border-amber-200 rounded-none">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default">Rigg/Drift</Badge>
                        {vederlagEvent.saerskilt_krav.rigg_drift.dato_klar_over && (
                          <span className="text-xs text-gray-500">
                            TE klar over: {vederlagEvent.saerskilt_krav.rigg_drift.dato_klar_over}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        Vurder om dette kravet ble varslet i tide. Du kan svare på beløpet i Port 3.
                      </p>
                    </div>
                  )}

                  {vederlagEvent?.saerskilt_krav?.produktivitet && (
                    <div className="p-3 bg-white border border-amber-200 rounded-none">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default">Produktivitetstap</Badge>
                        {vederlagEvent.saerskilt_krav.produktivitet.dato_klar_over && (
                          <span className="text-xs text-gray-500">
                            TE klar over: {vederlagEvent.saerskilt_krav.produktivitet.dato_klar_over}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        Vurder om dette kravet ble varslet i tide. Du kan svare på beløpet i Port 3.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Begrunnelse varsel */}
              <FormField
                label="Begrunnelse for varselvurdering"
                helpText="Beskriv din vurdering av om varslene kom i tide."
              >
                <Textarea
                  {...register('begrunnelse_varsel')}
                  rows={3}
                  fullWidth
                  placeholder="Begrunn din vurdering av varslingstidspunktet..."
                />
              </FormField>
            </div>
          )}

          {/* PORT 2: Vilkår / Metode */}
          {currentPort === 2 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="info">Port 2</Badge>
                <h3 className="font-bold text-lg">Vilkår / Metode (§34.3)</h3>
              </div>
              <p className="text-sm text-pkt-text-body-subtle mb-4">
                Vurder om vederlagsmetoden er akseptabel, og ta stilling til eventuelle
                justeringskrav.
              </p>

              {/* Vederlagsmetode aksept */}
              <FormField
                label="Aksepterer du den foreslåtte vederlagsmetoden?"
                required
                helpText={
                  metodeLabel
                    ? `Entreprenøren har foreslått: ${metodeLabel}`
                    : 'Vurder om metoden er i samsvar med kontrakten.'
                }
              >
                <Controller
                  name="aksepterer_metode"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value ? 'ja' : 'nei'}
                      onValueChange={(val: string) => field.onChange(val === 'ja')}
                    >
                      <RadioItem value="ja" label="Ja - metoden er akseptabel" />
                      <RadioItem value="nei" label="Nei - krever annen metode" />
                    </RadioGroup>
                  )}
                />
              </FormField>

              {/* Begrunnelse metode - show if not accepting */}
              {!akseptererMetode && (
                <FormField
                  label="Begrunnelse for metodeendring"
                  helpText="Begrunn hvorfor du krever en annen vederlagsmetode."
                >
                  <Textarea
                    {...register('begrunnelse_metode')}
                    rows={3}
                    fullWidth
                    placeholder="Begrunn hvorfor den foreslåtte metoden ikke er akseptabel..."
                  />
                </FormField>
              )}

              {/* §34.3.3 EP-justering */}
              {maSvarePaJustering && (
                <div className="p-4 bg-pkt-surface-subtle-light-red border-2 border-pkt-border-red rounded-none">
                  <p className="text-sm font-medium text-pkt-border-red mb-2">
                    Svarplikt: EP-justering (§34.3.3)
                  </p>
                  <p className="text-sm text-pkt-border-red mb-3">
                    TE krever justerte enhetspriser. Du <strong>må</strong> ta stilling til dette
                    nå. Passivitet kan medføre at kravet anses akseptert.
                  </p>
                  <FormField label="Aksepterer du justering av enhetspriser?" required>
                    <Controller
                      name="ep_justering_akseptert"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={
                            field.value === undefined ? undefined : field.value ? 'ja' : 'nei'
                          }
                          onValueChange={(val: string) => field.onChange(val === 'ja')}
                        >
                          <RadioItem value="ja" label="Ja - aksepterer justering" />
                          <RadioItem value="nei" label="Nei - avviser justering" />
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                </div>
              )}

              {/* §30.2 Tilbakeholdelse */}
              {kanHoldeTilbake && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-none">
                  <p className="text-sm font-medium text-amber-900 mb-2">
                    Tilbakeholdelse (§30.2)
                  </p>
                  <p className="text-sm text-amber-800 mb-3">
                    TE har ikke levert kostnadsoverslag for regningsarbeidet. Du kan velge å holde
                    tilbake betaling inntil overslag mottas.
                  </p>
                  <FormField label="Vil du holde tilbake betaling?">
                    <Controller
                      name="hold_tilbake"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={
                            field.value === undefined ? undefined : field.value ? 'ja' : 'nei'
                          }
                          onValueChange={(val: string) => field.onChange(val === 'ja')}
                        >
                          <RadioItem
                            value="ja"
                            label="Ja - hold tilbake inntil overslag mottas"
                          />
                          <RadioItem value="nei" label="Nei - fortsett behandling" />
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                </div>
              )}
            </div>
          )}

          {/* PORT 3: Beregning */}
          {currentPort === 3 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="info">Port 3</Badge>
                <h3 className="font-bold text-lg">Beregning</h3>
              </div>
              <p className="text-sm text-pkt-text-body-subtle mb-4">
                Beregn vederlagsbeløpet. Dette er ren utmåling - ansvarsvurdering håndteres i
                Grunnlag-sporet.
              </p>

              {/* Resultat - Using NS 8407 response options */}
              <FormField
                label="Beregningsresultat"
                required
                error={errors.resultat?.message}
                labelTooltip="Vurder BARE beregningen/beløpet. Ansvarsvurdering håndteres i Grunnlag-sporet."
              >
                <Controller
                  name="resultat"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange}>
                      {BH_VEDERLAGSSVAR_OPTIONS.filter((opt) => {
                        // Filter out empty placeholder
                        if (opt.value === '') return false;
                        // Filter out "hold_tilbake" if NOT regningsarbeid without overslag (§30.2)
                        if (opt.value === 'hold_tilbake' && !kanHoldeTilbake) return false;
                        // Filter out "avvist_preklusjon_rigg" if NO rigg/drift claims (§34.1.3)
                        if (opt.value === 'avvist_preklusjon_rigg' && !harSaerskiltKrav)
                          return false;
                        return true;
                      }).map((option) => (
                        <RadioItem
                          key={option.value}
                          value={option.value}
                          label={option.label}
                          error={!!errors.resultat}
                        />
                      ))}
                    </RadioGroup>
                  )}
                />
              </FormField>

              {/* Show description of selected resultat */}
              {selectedResultat && BH_VEDERLAGSSVAR_DESCRIPTIONS[selectedResultat] && (
                <div className="p-4 bg-pkt-surface-subtle rounded-none border-l-4 border-pkt-border-focus">
                  <p className="text-sm text-pkt-text-body-subtle">
                    {BH_VEDERLAGSSVAR_DESCRIPTIONS[selectedResultat]}
                  </p>
                </div>
              )}

              {/* Godkjent beløp */}
              {showAmountField && (
                <FormField
                  label="Godkjent beløp"
                  required={selectedResultat === 'godkjent_fullt'}
                  error={errors.godkjent_belop?.message}
                  helpText={
                    krevdBelop !== undefined && godkjentBelop !== undefined
                      ? `Differanse: ${(krevdBelop - godkjentBelop).toLocaleString('nb-NO')} kr (${((godkjentBelop / krevdBelop) * 100).toFixed(1)}% godkjent)`
                      : undefined
                  }
                >
                  <Controller
                    name="godkjent_belop"
                    control={control}
                    render={({ field }) => (
                      <CurrencyInput
                        id="godkjent_belop"
                        value={field.value ?? null}
                        onChange={field.onChange}
                        error={!!errors.godkjent_belop}
                        allowNegative={false}
                      />
                    )}
                  />
                </FormField>
              )}

              {/* Godkjent metode - only show if godkjent_annen_metode */}
              {showMethodField && (
                <FormField
                  label="Godkjent vederlagsmetode"
                  required
                  error={errors.godkjent_metode?.message}
                  helpText="BH endrer beregningsmetode (f.eks. fra 'Regningsarbeid' til 'Fastpris')."
                >
                  <Controller
                    name="godkjent_metode"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger error={!!errors.godkjent_metode}>
                          <SelectValue placeholder="Velg metode" />
                        </SelectTrigger>
                        <SelectContent>
                          {VEDERLAGSMETODER_OPTIONS.filter((opt) => opt.value !== '').map(
                            (option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              )}

              {/* Særskilte krav (§34.1.3) - Separate responses required */}
              {vederlagEvent?.saerskilt_krav?.rigg_drift && (
                <div className="p-4 bg-pkt-bg-subtle border-2 border-pkt-border-default rounded-none">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="default">Særskilt krav: Rigg/Drift</Badge>
                    <span className="text-sm font-mono">
                      kr{' '}
                      {vederlagEvent.saerskilt_krav.rigg_drift.belop?.toLocaleString('nb-NO') || 0}
                      ,-
                    </span>
                  </div>
                  <FormField label="Resultat for rigg/drift-krav" required>
                    <Controller
                      name="saerskilt_rigg_drift.resultat"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup value={field.value} onValueChange={field.onChange}>
                          {SAERSKILT_KRAV_RESULTAT_OPTIONS.map((option) => (
                            <RadioItem
                              key={option.value}
                              value={option.value}
                              label={option.label}
                            />
                          ))}
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                  {watch('saerskilt_rigg_drift.resultat') === 'delvis_godkjent' && (
                    <div className="mt-3">
                      <FormField label="Godkjent beløp for rigg/drift">
                        <Controller
                          name="saerskilt_rigg_drift.godkjent_belop"
                          control={control}
                          render={({ field }) => (
                            <CurrencyInput
                              value={field.value ?? null}
                              onChange={field.onChange}
                              allowNegative={false}
                            />
                          )}
                        />
                      </FormField>
                    </div>
                  )}
                </div>
              )}

              {vederlagEvent?.saerskilt_krav?.produktivitet && (
                <div className="p-4 bg-pkt-bg-subtle border-2 border-pkt-border-default rounded-none">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="default">Særskilt krav: Produktivitetstap</Badge>
                    <span className="text-sm font-mono">
                      kr{' '}
                      {vederlagEvent.saerskilt_krav.produktivitet.belop?.toLocaleString('nb-NO') ||
                        0}
                      ,-
                    </span>
                  </div>
                  <FormField label="Resultat for produktivitetstap-krav" required>
                    <Controller
                      name="saerskilt_produktivitet.resultat"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup value={field.value} onValueChange={field.onChange}>
                          {SAERSKILT_KRAV_RESULTAT_OPTIONS.map((option) => (
                            <RadioItem
                              key={option.value}
                              value={option.value}
                              label={option.label}
                            />
                          ))}
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                  {watch('saerskilt_produktivitet.resultat') === 'delvis_godkjent' && (
                    <div className="mt-3">
                      <FormField label="Godkjent beløp for produktivitetstap">
                        <Controller
                          name="saerskilt_produktivitet.godkjent_belop"
                          control={control}
                          render={({ field }) => (
                            <CurrencyInput
                              value={field.value ?? null}
                              onChange={field.onChange}
                              allowNegative={false}
                            />
                          )}
                        />
                      </FormField>
                    </div>
                  )}
                </div>
              )}

              {/* Begrunnelse */}
              <FormField
                label="Begrunnelse for beregning"
                required
                error={errors.begrunnelse?.message}
              >
                <Textarea
                  id="begrunnelse"
                  {...register('begrunnelse')}
                  rows={4}
                  fullWidth
                  placeholder="Begrunn din vurdering av vederlagsbeløpet..."
                  error={!!errors.begrunnelse}
                />
              </FormField>
            </div>
          )}

          {/* Error Message */}
          {mutation.isError && (
            <Alert variant="danger" title="Feil ved innsending">
              {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
            </Alert>
          )}

          {/* Navigation Actions */}
          <div className="flex justify-between pt-6 border-t-2 border-pkt-border-subtle">
            <div>
              {currentPort > 1 && (
                <Button type="button" variant="ghost" onClick={goToPrevPort} size="lg">
                  ← Forrige
                </Button>
              )}
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
                size="lg"
              >
                Avbryt
              </Button>

              {currentPort < 3 ? (
                <Button type="button" variant="primary" onClick={goToNextPort} size="lg">
                  Neste →
                </Button>
              ) : (
                <Button type="submit" variant="primary" disabled={isSubmitting} size="lg">
                  {isSubmitting ? 'Sender...' : 'Send svar'}
                </Button>
              )}
            </div>
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
