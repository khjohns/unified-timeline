/**
 * SendGrunnlagModal Component
 *
 * Action modal for submitting a new grunnlag (basis/foundation) claim.
 * Uses React Hook Form + Zod for validation.
 * Enhanced with preclusion checks and legal warnings based on NS 8407.
 */

import {
  Alert,
  AlertDialog,
  Button,
  Checkbox,
  Collapsible,
  DatePicker,
  FormField,
  Input,
  Modal,
  RadioGroup,
  RadioItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '../primitives';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  HOVEDKATEGORI_OPTIONS,
  getUnderkategorier,
  VARSEL_METODER_OPTIONS,
  getHovedkategori,
  getUnderkategoriObj,
  erLovendring,
  getGrupperteUnderkategorier,
} from '../../constants';
import { getPreklusjonsvarsel, getPreklusjonsvarselMellomDatoer, beregnDagerSiden } from '../../utils/preklusjonssjekk';

const grunnlagSchema = z.object({
  hovedkategori: z.string().min(1, 'Hovedkategori er påkrevd'),
  underkategori: z.array(z.string()).min(1, 'Minst én underkategori må velges'),
  tittel: z.string().min(3, 'Tittel må være minst 3 tegn').max(100, 'Tittel kan ikke være lengre enn 100 tegn'),
  beskrivelse: z.string().min(10, 'Beskrivelse må være minst 10 tegn'),
  dato_oppdaget: z.string().min(1, 'Dato oppdaget er påkrevd'),
  varsel_sendes_na: z.boolean().optional(),
  dato_varsel_sendt: z.string().optional(),
  varsel_metode: z.array(z.string()).optional(),
  kontraktsreferanser: z.string().optional(),
  er_etter_tilbud: z.boolean().optional(), // For law changes (§14.4)
});

type GrunnlagFormData = z.infer<typeof grunnlagSchema>;

interface SendGrunnlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
}

export function SendGrunnlagModal({
  open,
  onOpenChange,
  sakId,
}: SendGrunnlagModalProps) {
  const [selectedHovedkategori, setSelectedHovedkategori] = useState<string>('');
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    setValue,
    control,
    watch,
  } = useForm<GrunnlagFormData>({
    resolver: zodResolver(grunnlagSchema),
    defaultValues: {
      hovedkategori: '',
      underkategori: [],
      varsel_sendes_na: false,
      varsel_metode: [],
      er_etter_tilbud: false,
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: () => {
      reset();
      setSelectedHovedkategori('');
    },
    onClose: () => onOpenChange(false),
  });

  // Form backup for token expiry protection
  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'grunnlag_opprettet',
    formData,
    isDirty
  );

  // Check for backup on mount (only when modal opens and form is not dirty)
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && hasBackup && !isDirty && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;
      setShowRestorePrompt(true);
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, isDirty]);

  const handleRestoreBackup = () => {
    const backup = getBackup();
    if (backup) {
      reset(backup);
      if (backup.hovedkategori) {
        setSelectedHovedkategori(backup.hovedkategori);
      }
    }
    setShowRestorePrompt(false);
  };

  const handleDiscardBackup = () => {
    clearBackup();
    setShowRestorePrompt(false);
  };

  const hovedkategoriValue = watch('hovedkategori');
  const varselSendesNa = watch('varsel_sendes_na');
  const datoOppdaget = watch('dato_oppdaget');
  const datoVarselSendt = watch('dato_varsel_sendt');
  const selectedUnderkategorier = watch('underkategori');
  const erEtterTilbud = watch('er_etter_tilbud');

  // Get selected category info
  const valgtHovedkategori = useMemo(
    () => getHovedkategori(selectedHovedkategori),
    [selectedHovedkategori]
  );

  // Get all selected underkategorier info (not just first one)
  const valgteUnderkategorier = useMemo(() => {
    if (!selectedUnderkategorier?.length) return [];
    return selectedUnderkategorier
      .map((kode) => getUnderkategoriObj(kode))
      .filter((obj): obj is NonNullable<typeof obj> => obj !== undefined);
  }, [selectedUnderkategorier]);

  // Check if any selected underkategori is a law change (§14.4)
  const harLovendring = useMemo(() => {
    return selectedUnderkategorier?.some((kode) => erLovendring(kode)) ?? false;
  }, [selectedUnderkategorier]);

  // Calculate preclusion risk for current moment (when sending now)
  const preklusjonsResultat = useMemo(() => {
    if (!datoOppdaget) return null;
    return getPreklusjonsvarsel(beregnDagerSiden(datoOppdaget));
  }, [datoOppdaget]);

  // Calculate preclusion risk between discovery and earlier notification date
  const preklusjonsResultatVarsel = useMemo(() => {
    if (!datoOppdaget || !datoVarselSendt || varselSendesNa) return null;
    return getPreklusjonsvarselMellomDatoer(datoOppdaget, datoVarselSendt);
  }, [datoOppdaget, datoVarselSendt, varselSendesNa]);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      clearBackup();
      reset();
      setSelectedHovedkategori('');
      onOpenChange(false);
    },
    onError: (error) => {
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      }
    },
  });

  // Reset underkategori when hovedkategori changes
  const handleHovedkategoriChange = (value: string) => {
    setSelectedHovedkategori(value);
    setValue('hovedkategori', value);
    setValue('underkategori', []);
    setValue('er_etter_tilbud', false);
  };

  const onSubmit = (data: GrunnlagFormData) => {
    // Convert comma-separated string to array
    const kontraktsreferanser = data.kontraktsreferanser
      ? data.kontraktsreferanser.split(',').map((ref) => ref.trim())
      : [];

    // Build VarselInfo structure
    const varselDato = data.varsel_sendes_na
      ? new Date().toISOString().split('T')[0]
      : data.dato_varsel_sendt;

    const varselMetode = data.varsel_sendes_na
      ? ['system']
      : (data.varsel_metode || []);

    const grunnlagVarsel = varselDato
      ? {
          dato_sendt: varselDato,
          metode: varselMetode,
        }
      : undefined;

    mutation.mutate({
      eventType: 'grunnlag_opprettet',
      data: {
        hovedkategori: data.hovedkategori,
        underkategori: data.underkategori,
        tittel: data.tittel,
        beskrivelse: data.beskrivelse,
        dato_oppdaget: data.dato_oppdaget,
        grunnlag_varsel: grunnlagVarsel,
        kontraktsreferanser,
        meta: harLovendring ? { er_etter_tilbud: data.er_etter_tilbud } : undefined,
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send grunnlag"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Hovedkategori */}
        <FormField
          label="Hovedkategori (NS 8407)"
          required
          error={errors.hovedkategori?.message}
          labelTooltip="Velg juridisk grunnlag iht. NS 8407. Dette bestemmer hvilke kontraktsbestemmelser som gjelder og hvilke krav som kan fremmes."
        >
          <Controller
            name="hovedkategori"
            control={control}
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleHovedkategoriChange(value);
                }}
                data-testid="grunnlag-hovedkategori"
              >
                {HOVEDKATEGORI_OPTIONS.filter(opt => opt.value !== '').map((option) => (
                  <RadioItem
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    error={!!errors.hovedkategori}
                  />
                ))}
              </RadioGroup>
            )}
          />
        </FormField>

        {/* Category info box */}
        {valgtHovedkategori && (
          <Alert variant="info" title={`Hjemmel: NS 8407 §${valgtHovedkategori.hjemmel_frist}`}>
            {valgtHovedkategori.beskrivelse}
            <div className="mt-2 text-xs">
              <strong>Type krav:</strong> {valgtHovedkategori.type_krav}
              {valgtHovedkategori.hjemmel_vederlag && (
                <> | <strong>Vederlag:</strong> §{valgtHovedkategori.hjemmel_vederlag}</>
              )}
            </div>
          </Alert>
        )}

        {/* Underkategori - Dynamic based on hovedkategori, grouped */}
        {selectedHovedkategori && valgtHovedkategori && valgtHovedkategori.underkategorier.length > 0 && (
          <Controller
            name="underkategori"
            control={control}
            render={({ field }) => {
              const grupperteUnderkategorier = getGrupperteUnderkategorier(valgtHovedkategori.underkategorier);
              return (
                <FormField
                  label="Underkategori"
                  required
                  error={errors.underkategori?.message}
                >
                  <div className="space-y-4 max-h-80 overflow-y-auto border-2 border-pkt-border-gray rounded-none p-4 bg-pkt-bg-subtle" data-testid="grunnlag-underkategori-list">
                    {Array.from(grupperteUnderkategorier.entries()).map(([gruppeNavn, underkategorier]) => (
                      <div key={gruppeNavn ?? 'ungrouped'}>
                        {gruppeNavn && (
                          <p className="text-sm font-semibold text-pkt-text-body mb-2">{gruppeNavn}</p>
                        )}
                        <div className="space-y-2 pl-0">
                          {underkategorier.map((uk) => (
                            <Checkbox
                              key={uk.kode}
                              id={`underkategori-${uk.kode}`}
                              label={`${uk.label} (§${uk.hjemmel_basis})`}
                              checked={field.value?.includes(uk.kode) ?? false}
                              onCheckedChange={(checked) => {
                                const current = field.value ?? [];
                                if (checked) {
                                  field.onChange([...current, uk.kode]);
                                } else {
                                  field.onChange(current.filter((v: string) => v !== uk.kode));
                                }
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </FormField>
              );
            }}
          />
        )}

        {/* Underkategori info - show all selected */}
        {valgteUnderkategorier.length > 0 && (
          <div className="space-y-3">
            {valgteUnderkategorier.map((underkat) => (
              <Alert key={underkat.kode} variant="info" title={underkat.label}>
                {underkat.beskrivelse}
                <p className="text-xs mt-2">
                  <strong>Hjemmel:</strong> §{underkat.hjemmel_basis} | <strong>Varslingskrav:</strong> §{underkat.varselkrav_ref}
                </p>
              </Alert>
            ))}
          </div>
        )}

        {/* Tittel */}
        <FormField
          label="Tittel på varselet"
          required
          error={errors.tittel?.message}
          helpText="Kort beskrivende tittel for enkel identifikasjon av saken"
        >
          <Input
            id="tittel"
            data-testid="grunnlag-tittel"
            {...register('tittel')}
            fullWidth
          />
        </FormField>

        {/* Law change check (§14.4) */}
        {harLovendring && (
          <Alert variant="warning" title="Lovendring (§14.4)">
            <Controller
              name="er_etter_tilbud"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="er_etter_tilbud"
                  label="Bekreft at endringen inntraff ETTER tilbudsfristens utløp"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            {!erEtterTilbud && (
              <p className="text-xs text-pkt-text-danger mt-2">
                Hvis lovendringen var kjent ved tilbudsfrist, ligger risikoen normalt hos deg.
              </p>
            )}
          </Alert>
        )}

        {/* Beskrivelse */}
        <FormField
          label="Beskrivelse"
          required
          error={errors.beskrivelse?.message}
          helpText="Beskriv grunnlaget for endringsmeldingen"
        >
          <Textarea
            id="beskrivelse"
            data-testid="grunnlag-beskrivelse"
            {...register('beskrivelse')}
            rows={5}
            fullWidth
            error={!!errors.beskrivelse}
          />
        </FormField>

        {/* Dato og varsel-seksjon */}
        <div className="bg-pkt-surface-subtle p-4 rounded-none border-2 border-pkt-border-default space-y-4">
          <FormField
            label="Dato forhold oppdaget"
            required
            error={errors.dato_oppdaget?.message}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Controller
                name="dato_oppdaget"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    id="dato_oppdaget"
                    data-testid="grunnlag-dato-oppdaget"
                    value={field.value}
                    onChange={field.onChange}
                    error={!!errors.dato_oppdaget}
                  />
                )}
              />
              {datoOppdaget && (
                <span className="text-sm text-pkt-text-body-subtle whitespace-nowrap">
                  {beregnDagerSiden(datoOppdaget)} dager siden
                </span>
              )}
            </div>
          </FormField>

          {/* Preclusion warnings */}
          {preklusjonsResultat?.alert && (
            <Alert
              variant={preklusjonsResultat.alert.variant}
              title={preklusjonsResultat.alert.title}
            >
              {preklusjonsResultat.alert.message}
            </Alert>
          )}

          {/* Varsel sendes nå checkbox */}
          <Controller
            name="varsel_sendes_na"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="varsel_sendes_na"
                data-testid="grunnlag-varsel-sendes-na"
                label="Varsel sendes nå (sammen med dette skjemaet)"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>

        {/* Dato varsel sendt - only show if NOT sending now */}
        {!varselSendesNa && (
          <FormField
            label="Dato varsel sendt tidligere"
            labelTooltip="Dokumenter når byggherren ble varslet. Varselfrist er kritisk for om kravet kan tapes ved preklusjon."
            helpText="Kan være forskjellig fra oppdaget-dato. Både formelle og uformelle varsler (f.eks. byggemøte) teller."
          >
            <Controller
              name="dato_varsel_sendt"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="dato_varsel_sendt"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {/* Preclusion warning for time between discovery and notification */}
            {preklusjonsResultatVarsel?.alert && (
              <div className="mt-3">
                <Alert
                  variant={preklusjonsResultatVarsel.alert.variant}
                  title={preklusjonsResultatVarsel.alert.title}
                >
                  {preklusjonsResultatVarsel.alert.message}
                </Alert>
              </div>
            )}
          </FormField>
        )}

        {/* Varsel metode - only show if NOT sending now */}
        {!varselSendesNa && (
          <FormField
            label="Varselmetode"
            helpText="Hvordan ble byggherren varslet? (Kan velge flere)"
          >
            <div className="space-y-3 border-2 border-pkt-border-gray rounded-none p-4 bg-pkt-bg-subtle">
              {VARSEL_METODER_OPTIONS.map((option) => (
                <Checkbox
                  key={option.value}
                  id={`varsel-${option.value}`}
                  label={option.label}
                  value={option.value}
                  {...register('varsel_metode')}
                />
              ))}
            </div>
          </FormField>
        )}

        {/* Kontraktsreferanser */}
        <Collapsible title="Kontraktsreferanser (Valgfritt)">
          <Input
            id="kontraktsreferanser"
            type="text"
            {...register('kontraktsreferanser')}
            fullWidth
          />
          <p className="text-xs text-pkt-text-body-subtle mt-2">
            Separer flere referanser med komma
          </p>
        </Collapsible>

        {/* Guidance text */}
        <p className="text-xs text-pkt-text-body-subtle">
          Dette er et nøytralt varsel om grunnlaget. Spesifiserte krav om penger (Vederlag)
          og tid (Frist) legger du til i egne steg etterpå.
        </p>

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            size="lg"
            className="w-full sm:w-auto"
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            size="lg"
            className="w-full sm:w-auto"
            data-testid="grunnlag-submit"
          >
            {isSubmitting ? 'Sender...' : 'Send grunnlag'}
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

      {/* Restore backup dialog */}
      <AlertDialog
        open={showRestorePrompt}
        onOpenChange={(open) => {
          if (!open) {
            // User clicked "Start på nytt" (cancel) - discard backup
            handleDiscardBackup();
          }
        }}
        title="Gjenopprette lagrede data?"
        description="Det finnes data fra en tidligere økt som ikke ble sendt inn. Vil du fortsette der du slapp?"
        confirmLabel="Gjenopprett"
        cancelLabel="Start på nytt"
        onConfirm={handleRestoreBackup}
        variant="info"
      />

      {/* Token expired alert */}
      <TokenExpiredAlert
        open={showTokenExpired}
        onClose={() => setShowTokenExpired(false)}
      />
    </Modal>
  );
}
