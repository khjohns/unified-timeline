/**
 * RespondFristModal Component
 *
 * Action modal for BH (client) to respond to a frist (deadline extension) claim.
 * Uses a 3-port wizard model matching NS 8407 requirements.
 *
 * UPDATED (2025-12-05):
 * - Added §33.8 forsering warning when rejecting/partial approval
 * - Added subsidiary badge and info when grunnlag is rejected
 * - Added display of fristkrav details
 *
 * UPDATED (2025-12-08):
 * - Added §33.7 BH preclusion warning for late response
 * - Added §33.8 30% cost limit info in forsering warning
 * - Refactored to 3-port wizard model (Preklusjon → Vilkår → Beregning)
 */

import { useState } from 'react';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { FormField } from '../primitives/FormField';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { DatePicker } from '../primitives/DatePicker';
import { Badge } from '../primitives/Badge';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { RadioGroup, RadioItem } from '../primitives/RadioGroup';
import { StepIndicator } from '../primitives/StepIndicator';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import {
  BH_FRISTSVAR_OPTIONS,
  getBhFristsvarValues,
  BH_FRISTSVAR_DESCRIPTIONS,
} from '../../constants';
import { differenceInDays } from 'date-fns';

// Extended schema with port fields
const respondFristSchema = z.object({
  // Port 1: Preklusjon
  noytralt_varsel_ok: z.boolean().optional(),
  spesifisert_krav_ok: z.boolean(),
  har_bh_etterlyst: z.boolean().optional(),
  begrunnelse_varsel: z.string().optional(),

  // Port 2: Vilkår
  vilkar_oppfylt: z.boolean(),
  begrunnelse_vilkar: z.string().optional(),

  // Port 3: Beregning
  beregnings_resultat: z.enum(getBhFristsvarValues(), {
    errorMap: () => ({ message: 'Resultat er påkrevd' }),
  }),
  godkjent_dager: z.number().min(0, 'Antall dager kan ikke være negativt').optional(),
  ny_sluttdato: z.string().optional(),
  begrunnelse_beregning: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  frist_for_spesifisering: z.string().optional(),
});

type RespondFristFormData = z.infer<typeof respondFristSchema>;

// Frist event info for context display
interface FristEventInfo {
  antall_dager?: number;
  ny_sluttfrist?: string;
  begrunnelse?: string;
  /** Date when the specified claim was received (for §33.7 preclusion calculation) */
  dato_krav_mottatt?: string;
}

interface RespondFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the frist claim event being responded to (required for event sourcing) */
  fristKravId: string;
  krevdDager?: number;
  fristType?: 'kalenderdager' | 'arbeidsdager';
  /** Optional frist event data for context display */
  fristEvent?: FristEventInfo;
  /** Status of the grunnlag response (for subsidiary treatment) */
  grunnlagStatus?: 'godkjent' | 'avvist_uenig' | 'delvis_godkjent';
  /** Type of varsel TE sent (nøytralt or spesifisert) - determines which checks to show */
  varselType?: 'noytralt' | 'spesifisert' | 'force_majeure';
}

export function RespondFristModal({
  open,
  onOpenChange,
  sakId,
  fristKravId,
  krevdDager,
  fristType,
  fristEvent,
  grunnlagStatus,
  varselType,
}: RespondFristModalProps) {
  const [currentPort, setCurrentPort] = useState(1);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
    trigger,
  } = useForm<RespondFristFormData>({
    resolver: zodResolver(respondFristSchema),
    defaultValues: {
      spesifisert_krav_ok: true,
      vilkar_oppfylt: true,
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
  const vilkarOppfylt = watch('vilkar_oppfylt');
  const selectedResultat = watch('beregnings_resultat');
  const godkjentDager = watch('godkjent_dager');

  // Determine if this is subsidiary treatment (grunnlag was rejected)
  const erSubsidiaer = grunnlagStatus === 'avvist_uenig';

  // Effective days to compare (from fristEvent or krevdDager prop)
  const effektivKrevdDager = fristEvent?.antall_dager ?? krevdDager ?? 0;

  // §33.8: Show forsering warning when rejecting or partial approval
  const visForsering =
    selectedResultat === 'avslatt_ingen_hindring' ||
    (selectedResultat === 'delvis_godkjent' &&
      godkjentDager !== undefined &&
      godkjentDager < effektivKrevdDager);

  // §33.7: Calculate BH response time for preclusion warning
  const dagerSidenKrav = fristEvent?.dato_krav_mottatt
    ? differenceInDays(new Date(), new Date(fristEvent.dato_krav_mottatt))
    : 0;
  const bhPreklusjonsrisiko = dagerSidenKrav > 10;

  const steps = [
    { label: 'Port 1', description: 'Preklusjon' },
    { label: 'Port 2', description: 'Vilkår' },
    { label: 'Port 3', description: 'Beregning' },
  ];

  const onSubmit = (data: RespondFristFormData) => {
    mutation.mutate({
      eventType: 'respons_frist',
      data: {
        frist_krav_id: fristKravId,
        // Port 1
        noytralt_varsel_ok: data.noytralt_varsel_ok,
        spesifisert_krav_ok: data.spesifisert_krav_ok,
        har_bh_etterlyst: data.har_bh_etterlyst,
        begrunnelse_varsel: data.begrunnelse_varsel,
        // Port 2
        vilkar_oppfylt: data.vilkar_oppfylt,
        begrunnelse_vilkar: data.begrunnelse_vilkar,
        // Port 3
        beregnings_resultat: data.beregnings_resultat,
        godkjent_dager: data.godkjent_dager,
        ny_sluttdato: data.ny_sluttdato,
        begrunnelse_beregning: data.begrunnelse_beregning,
        frist_for_spesifisering: data.frist_for_spesifisering,
        // Legacy field mapping for backwards compatibility
        resultat: data.beregnings_resultat,
        begrunnelse: data.begrunnelse_beregning,
      },
    });
  };

  const goToNextPort = async () => {
    // Validate current port before proceeding
    let isValid = true;
    if (currentPort === 1) {
      isValid = await trigger(['spesifisert_krav_ok', 'noytralt_varsel_ok', 'har_bh_etterlyst', 'begrunnelse_varsel']);
    } else if (currentPort === 2) {
      isValid = await trigger(['vilkar_oppfylt', 'begrunnelse_vilkar']);
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

  // Show days field for full or partial approval
  const showDaysField =
    selectedResultat === 'godkjent_fullt' ||
    selectedResultat === 'delvis_godkjent';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Svar på fristkrav"
      description="Vurder fristkravet gjennom tre porter: Preklusjon → Vilkår → Beregning"
      size="lg"
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <StepIndicator currentStep={currentPort} steps={steps} />

        {/* §33.7 BH preclusion warning */}
        {bhPreklusjonsrisiko && (
          <div
            className="p-5 bg-pkt-surface-subtle-light-red border-2 border-pkt-border-red rounded-none"
            role="alert"
          >
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="danger">Preklusjonsrisiko (§33.7)</Badge>
            </div>
            <p className="text-base text-pkt-border-red font-medium">
              Du har brukt <strong>{dagerSidenKrav} dager</strong> på å svare
              på dette fristkravet.
            </p>
            <p className="text-sm text-pkt-border-red mt-2">
              Etter §33.7 skal du svare &ldquo;uten ugrunnet opphold&rdquo;.
              <strong> Innsigelser mot kravet tapes dersom de ikke fremsettes
              innen fristen.</strong>
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
              Du har avvist ansvarsgrunnlaget. Dine svar gjelder derfor <strong>kun subsidiært</strong>.
            </p>
          </div>
        )}

        {/* Display of fristkrav details - only for spesifisert krav with actual days */}
        {varselType === 'spesifisert' && fristEvent?.antall_dager !== undefined && (
          <div className="p-4 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
            <div className="flex justify-between items-center">
              <span className="text-xs text-pkt-text-body-subtle uppercase font-bold">
                Spesifisert krav fra Entreprenør
              </span>
              <span className="text-2xl font-bold">
                {fristEvent.antall_dager} dager
              </span>
            </div>
            {fristEvent.begrunnelse && (
              <p className="italic text-pkt-text-body-subtle mt-2 text-sm border-t pt-2 border-pkt-border-subtle">
                &ldquo;{fristEvent.begrunnelse}&rdquo;
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
                <h3 className="font-bold text-lg">Preklusjon (§33.4, §33.6)</h3>
              </div>
              <p className="text-sm text-pkt-text-body-subtle mb-4">
                Vurder om entreprenøren har varslet i tide. Hvis ikke, kan kravet avvises pga preklusjon.
              </p>

              {/* Show what type of varsel TE sent */}
              {varselType && (
                <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle mb-4">
                  <span className="text-sm text-pkt-text-body-subtle">Entreprenøren har sendt: </span>
                  <Badge variant="default">
                    {varselType === 'noytralt' && 'Nøytralt varsel (§33.4)'}
                    {varselType === 'spesifisert' && 'Spesifisert krav (§33.6)'}
                    {varselType === 'force_majeure' && 'Force majeure (§33.3)'}
                  </Badge>
                </div>
              )}

              {/* Nøytralt varsel - only show if TE sent nøytralt varsel */}
              {varselType === 'noytralt' && (
                <>
                  <FormField
                    label="Nøytralt varsel sendt i tide? (§33.4)"
                    required
                    helpText="Entreprenøren skal varsle 'uten ugrunnet opphold' når han blir klar over at det kan oppstå forsinkelse."
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

                  {/* Option to send etterlysning when TE only sent nøytralt varsel */}
                  <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-none">
                    <p className="text-sm font-medium text-amber-900 mb-2">
                      Etterlys spesifisert krav (§33.6.2)
                    </p>
                    <p className="text-sm text-amber-800 mb-3">
                      Entreprenøren har kun sendt nøytralt varsel. Du kan etterspørre et spesifisert krav
                      med antall dager. Hvis TE ikke svarer &ldquo;uten ugrunnet opphold&rdquo;, tapes kravet.
                    </p>
                    <Controller
                      name="har_bh_etterlyst"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value === undefined ? undefined : field.value ? 'ja' : 'nei'}
                          onValueChange={(val: string) => field.onChange(val === 'ja')}
                        >
                          <RadioItem value="ja" label="Ja - send etterlysning nå" />
                          <RadioItem value="nei" label="Nei - avvent spesifisert krav" />
                        </RadioGroup>
                      )}
                    />
                  </div>
                </>
              )}

              {/* Spesifisert krav - only show if TE sent spesifisert krav */}
              {varselType === 'spesifisert' && (
                <FormField
                  label="Spesifisert krav sendt i tide? (§33.6)"
                  required
                  helpText="Entreprenøren skal 'uten ugrunnet opphold' angi og begrunne antall dager når han har grunnlag."
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

              {/* Force majeure - simplified check */}
              {varselType === 'force_majeure' && (
                <FormField
                  label="Force majeure varslet i tide? (§33.3)"
                  required
                  helpText="Force majeure skal varsles 'uten ugrunnet opphold' etter at forholdet inntrådte."
                >
                  <Controller
                    name="spesifisert_krav_ok"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup
                        value={field.value ? 'ja' : 'nei'}
                        onValueChange={(val: string) => field.onChange(val === 'ja')}
                      >
                        <RadioItem value="ja" label="Ja - varslet i tide" />
                        <RadioItem value="nei" label="Nei - varslet for sent" />
                      </RadioGroup>
                    )}
                  />
                </FormField>
              )}

              {/* Fallback if varselType not set - show both options */}
              {!varselType && (
                <>
                  <FormField
                    label="Varsel/krav sendt i tide?"
                    required
                    helpText="Vurder om entreprenøren har varslet innen fristen."
                  >
                    <Controller
                      name="spesifisert_krav_ok"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value ? 'ja' : 'nei'}
                          onValueChange={(val: string) => field.onChange(val === 'ja')}
                        >
                          <RadioItem value="ja" label="Ja - varslet i tide" />
                          <RadioItem value="nei" label="Nei - varslet for sent" />
                        </RadioGroup>
                      )}
                    />
                  </FormField>
                </>
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

          {/* PORT 2: Vilkår */}
          {currentPort === 2 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="info">Port 2</Badge>
                <h3 className="font-bold text-lg">Vilkår (§33.5)</h3>
              </div>
              <p className="text-sm text-pkt-text-body-subtle mb-4">
                Vurder om forholdet faktisk har medført en fremdriftshindring. Dette er uavhengig av ansvarsvurderingen.
              </p>

              {/* Vilkår oppfylt */}
              <FormField
                label="Har forholdet medført faktisk fremdriftshindring?"
                required
                helpText="Selv om grunnlaget (ansvaret) er erkjent, kan du vurdere at det ikke medførte reell forsinkelse."
              >
                <Controller
                  name="vilkar_oppfylt"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value ? 'ja' : 'nei'}
                      onValueChange={(val: string) => field.onChange(val === 'ja')}
                    >
                      <RadioItem value="ja" label="Ja - forholdet forårsaket forsinkelse" />
                      <RadioItem value="nei" label="Nei - ingen reell hindring (f.eks. TE hadde slakk)" />
                    </RadioGroup>
                  )}
                />
              </FormField>

              {/* Begrunnelse vilkår */}
              <FormField
                label="Begrunnelse for vilkårsvurdering"
                helpText="Beskriv hvorfor forholdet medførte/ikke medførte forsinkelse."
              >
                <Textarea
                  {...register('begrunnelse_vilkar')}
                  rows={3}
                  fullWidth
                  placeholder={
                    vilkarOppfylt
                      ? "Beskriv hvordan forholdet påvirket fremdriften..."
                      : "Beskriv hvorfor forholdet ikke medførte forsinkelse (f.eks. slakk i planen)..."
                  }
                />
              </FormField>

              {/* Warning if no hindrance */}
              {!vilkarOppfylt && (
                <Alert variant="info" title="Konsekvens">
                  Hvis du velger &ldquo;Nei - ingen reell hindring&rdquo;, vil beregningen i Port 3
                  automatisk resultere i 0 dager godkjent, uavhengig av hva entreprenøren har krevd.
                </Alert>
              )}
            </div>
          )}

          {/* PORT 3: Beregning */}
          {currentPort === 3 && (
            <div className="space-y-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="info">Port 3</Badge>
                <h3 className="font-bold text-lg">Beregning (§33.5)</h3>
              </div>
              <p className="text-sm text-pkt-text-body-subtle mb-4">
                Beregn antall dager fristforlengelse. Dette er ren utmåling - ansvarsvurdering håndteres i Grunnlag-sporet.
              </p>

              {/* Beregningsresultat */}
              <FormField
                label="Beregningsresultat"
                required
                error={errors.beregnings_resultat?.message}
              >
                <Controller
                  name="beregnings_resultat"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      {BH_FRISTSVAR_OPTIONS.filter(opt => opt.value !== '').map((option) => (
                        <RadioItem
                          key={option.value}
                          value={option.value}
                          label={option.label}
                          error={!!errors.beregnings_resultat}
                        />
                      ))}
                    </RadioGroup>
                  )}
                />
              </FormField>

              {/* Show description of selected resultat */}
              {selectedResultat && BH_FRISTSVAR_DESCRIPTIONS[selectedResultat] && (
                <div className="p-4 bg-pkt-surface-subtle rounded-none border-l-4 border-pkt-border-focus">
                  <p className="text-sm text-pkt-text-body-subtle">
                    {BH_FRISTSVAR_DESCRIPTIONS[selectedResultat]}
                  </p>
                </div>
              )}

              {/* Godkjent dager */}
              {showDaysField && (
                <FormField
                  label="Godkjent antall dager"
                  required={selectedResultat === 'godkjent_fullt'}
                  error={errors.godkjent_dager?.message}
                  helpText={
                    effektivKrevdDager > 0 && godkjentDager !== undefined
                      ? `Differanse: ${effektivKrevdDager - godkjentDager} dager (${((godkjentDager / effektivKrevdDager) * 100).toFixed(1)}% godkjent)`
                      : undefined
                  }
                >
                  <Input
                    id="godkjent_dager"
                    type="number"
                    {...register('godkjent_dager', { valueAsNumber: true })}
                    width="xs"
                    placeholder="0"
                    error={!!errors.godkjent_dager}
                  />
                </FormField>
              )}

              {/* Ny sluttdato */}
              {showDaysField && (
                <FormField
                  label="Ny sluttdato"
                  helpText="Beregnet ny sluttdato basert på godkjent forlengelse."
                >
                  <Controller
                    name="ny_sluttdato"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="ny_sluttdato"
                        value={field.value}
                        onChange={field.onChange}
                        
                        placeholder="Velg dato"
                      />
                    )}
                  />
                </FormField>
              )}

              {/* Frist for spesifisering - only show when avventer_spesifikasjon */}
              {selectedResultat === 'avventer_spesifikasjon' && (
                <FormField
                  label="Frist for spesifisering"
                  helpText="Angi fristen innen hvilken entreprenøren må levere ytterligere spesifikasjon av kravet."
                >
                  <Controller
                    name="frist_for_spesifisering"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="frist_for_spesifisering"
                        value={field.value}
                        onChange={field.onChange}
                        
                        placeholder="Velg dato"
                      />
                    )}
                  />
                </FormField>
              )}

              {/* §33.8 Forsering warning */}
              {visForsering && (
                <div className="p-4 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
                  <p className="text-sm font-medium text-pkt-text-body-default mb-2">
                    Informasjon om risiko (§33.8)
                  </p>
                  <p className="text-sm text-pkt-text-body-subtle">
                    Du avslår nå dager som TE mener å ha krav på.
                  </p>
                  <ul className="list-disc pl-5 mt-2 text-sm text-pkt-text-body-subtle">
                    <li>
                      Dersom avslaget ditt er uberettiget, kan TE velge å anse avslaget
                      som et <strong>pålegg om forsering</strong>.
                    </li>
                    <li>
                      <strong>Begrensning:</strong> TE har ikke denne valgretten dersom
                      forseringskostnaden overstiger <strong>dagmulkten + 30%</strong>.
                    </li>
                    <li>
                      TE må i så fall sende et nytt varsel med kostnadsoverslag for
                      forseringen før de setter i gang.
                    </li>
                  </ul>
                </div>
              )}

              {/* Begrunnelse beregning */}
              <FormField
                label="Begrunnelse for beregning"
                required
                error={errors.begrunnelse_beregning?.message}
              >
                <Textarea
                  {...register('begrunnelse_beregning')}
                  rows={4}
                  fullWidth
                  placeholder="Begrunn din vurdering av antall dager..."
                  error={!!errors.begrunnelse_beregning}
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goToPrevPort}
                  size="lg"
                >
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
                <Button
                  type="button"
                  variant="primary"
                  onClick={goToNextPort}
                  size="lg"
                >
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
