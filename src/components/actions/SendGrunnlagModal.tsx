/**
 * SendGrunnlagModal Component
 *
 * Action modal for submitting a new grunnlag (basis/foundation) claim,
 * or updating an existing one (when originalEvent is provided).
 * Uses React Hook Form + Zod for validation.
 * Enhanced with preclusion checks and legal warnings based on NS 8407.
 *
 * MODES:
 * - Create mode (default): Submit new grunnlag with event type 'grunnlag_opprettet'
 * - Update mode (when originalEvent provided): Update existing grunnlag with 'grunnlag_oppdatert'
 */

import {
  Alert,
  AlertDialog,
  AttachmentUpload,
  Button,
  Checkbox,
  DataList,
  DataListItem,
  DatePicker,
  FormField,
  Input,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  Textarea,
  useToast,
} from '../primitives';
import type { AttachmentFile } from '../../types';
import type { GrunnlagTilstand } from '../../types/timeline';
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
  getHovedkategoriLabel,
  getUnderkategoriObj,
  erLovendring,
  getGrupperteUnderkategorier,
} from '../../constants';
import { getPreklusjonsvarsel, getPreklusjonsvarselMellomDatoer, beregnDagerSiden } from '../../utils/preklusjonssjekk';

// Schema for create mode - all fields required
const createGrunnlagSchema = z.object({
  hovedkategori: z.string().min(1, 'Hovedkategori er påkrevd'),
  underkategori: z.array(z.string()).min(1, 'Minst én underkategori må velges'),
  tittel: z.string().min(3, 'Tittel må være minst 3 tegn').max(100, 'Tittel kan ikke være lengre enn 100 tegn'),
  beskrivelse: z.string().min(10, 'Beskrivelse må være minst 10 tegn'),
  dato_oppdaget: z.string().min(1, 'Dato oppdaget er påkrevd'),
  varsel_sendes_na: z.boolean().optional(),
  dato_varsel_sendt: z.string().optional(),
  varsel_metode: z.array(z.string()).optional(),
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
  er_etter_tilbud: z.boolean().optional(), // For law changes (§14.4)
  endrings_begrunnelse: z.string().optional(), // Only used in update mode
});

// Schema for update mode - fields optional except endrings_begrunnelse
const updateGrunnlagSchema = z.object({
  hovedkategori: z.string().optional(),
  underkategori: z.array(z.string()).optional(),
  tittel: z.string().optional(),
  beskrivelse: z.string().optional(),
  dato_oppdaget: z.string().optional(),
  varsel_sendes_na: z.boolean().optional(),
  dato_varsel_sendt: z.string().optional(),
  varsel_metode: z.array(z.string()).optional(),
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
  er_etter_tilbud: z.boolean().optional(),
  endrings_begrunnelse: z.string().min(10, 'Begrunnelse for endring er påkrevd (minst 10 tegn)'),
});

type GrunnlagFormData = z.infer<typeof createGrunnlagSchema>;

interface SendGrunnlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
  /** UPDATE MODE: When provided, modal operates in update mode */
  originalEvent?: {
    event_id: string;
    grunnlag: GrunnlagTilstand;
  };
}

export function SendGrunnlagModal({
  open,
  onOpenChange,
  sakId,
  onCatendaWarning,
  originalEvent,
}: SendGrunnlagModalProps) {
  // UPDATE MODE detection
  const isUpdateMode = !!originalEvent;
  const grunnlag = originalEvent?.grunnlag;

  const [selectedHovedkategori, setSelectedHovedkategori] = useState<string>('');
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const toast = useToast();

  // Compute default values based on mode
  const computedDefaultValues = useMemo((): Partial<GrunnlagFormData> => {
    if (isUpdateMode && grunnlag) {
      // UPDATE MODE: Pre-fill from existing grunnlag
      return {
        hovedkategori: grunnlag.hovedkategori || '',
        underkategori: Array.isArray(grunnlag.underkategori)
          ? grunnlag.underkategori
          : grunnlag.underkategori
            ? [grunnlag.underkategori]
            : [],
        tittel: grunnlag.tittel || '',
        beskrivelse: grunnlag.beskrivelse || '',
        dato_oppdaget: grunnlag.dato_oppdaget || '',
        varsel_sendes_na: false, // In update mode, varsel was already sent
        dato_varsel_sendt: grunnlag.grunnlag_varsel?.dato_sendt || '',
        varsel_metode: grunnlag.grunnlag_varsel?.metode || [],
        attachments: [],
        er_etter_tilbud: false,
        endrings_begrunnelse: '',
      };
    }
    // CREATE MODE: Default values
    return {
      hovedkategori: '',
      underkategori: [],
      tittel: '',
      beskrivelse: '',
      dato_oppdaget: '',
      varsel_sendes_na: true,  // Forhåndsvalgt: varsel sendes nå
      varsel_metode: [],
      attachments: [],
      er_etter_tilbud: false,
      endrings_begrunnelse: '',
    };
  }, [isUpdateMode, grunnlag]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    setValue,
    control,
    watch,
  } = useForm<GrunnlagFormData>({
    resolver: zodResolver(isUpdateMode ? updateGrunnlagSchema : createGrunnlagSchema),
    defaultValues: computedDefaultValues,
  });

  // Reset form when opening in update mode with new originalEvent
  useEffect(() => {
    if (open && isUpdateMode && originalEvent) {
      reset(computedDefaultValues);
      if (computedDefaultValues.hovedkategori) {
        setSelectedHovedkategori(computedDefaultValues.hovedkategori);
      }
    }
  }, [open, isUpdateMode, originalEvent, reset, computedDefaultValues]);

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
    isUpdateMode ? 'grunnlag_oppdatert' : 'grunnlag_opprettet',
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

  // Track pending toast for dismissal
  const pendingToastId = useRef<string | null>(null);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: (result) => {
      // Dismiss pending toast and show success
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      clearBackup();
      reset();
      setSelectedHovedkategori('');
      onOpenChange(false);
      toast.success(
        isUpdateMode ? 'Grunnlag oppdatert' : 'Varsel sendt',
        isUpdateMode
          ? 'Endringene i grunnlaget er registrert.'
          : 'Endringsforholdet er registrert og varslet til byggherre.'
      );
      // Show warning if Catenda sync failed
      if (!result.catenda_synced) {
        onCatendaWarning?.();
      }
    },
    onError: (error) => {
      // Dismiss pending toast
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
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
    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending(
      isUpdateMode ? 'Lagrer endringer...' : 'Sender varsel...',
      'Vennligst vent mens forespørselen behandles.'
    );

    // ========== UPDATE MODE SUBMIT ==========
    if (isUpdateMode && originalEvent) {
      // Only send changed fields
      const eventData: Record<string, unknown> = {
        original_event_id: originalEvent.event_id,
        endrings_begrunnelse: data.endrings_begrunnelse,
      };

      // Check each field for changes
      if (data.tittel !== grunnlag?.tittel) {
        eventData.tittel = data.tittel;
      }
      if (data.beskrivelse !== grunnlag?.beskrivelse) {
        eventData.beskrivelse = data.beskrivelse;
      }
      if (data.dato_oppdaget !== grunnlag?.dato_oppdaget) {
        eventData.dato_oppdaget = data.dato_oppdaget;
      }
      if (data.hovedkategori !== grunnlag?.hovedkategori) {
        eventData.hovedkategori = data.hovedkategori;
      }
      // Always include underkategori if it might have changed
      eventData.underkategori = data.underkategori;

      mutation.mutate({
        eventType: 'grunnlag_oppdatert',
        data: eventData,
      });
      return;
    }

    // ========== CREATE MODE SUBMIT ==========
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
        meta: harLovendring ? { er_etter_tilbud: data.er_etter_tilbud } : undefined,
      },
    });
  };

  // Calculate warnings for update mode
  const nyDatoOppdaget = watch('dato_oppdaget');
  const nyHovedkategori = watch('hovedkategori');

  // Check if new date makes notice too late (for update mode)
  const varselErTidligere = useMemo(() => {
    if (!isUpdateMode || !nyDatoOppdaget || !grunnlag?.grunnlag_varsel?.dato_sendt) return false;
    const oppdagetDato = new Date(nyDatoOppdaget);
    const varselDato = new Date(grunnlag.grunnlag_varsel.dato_sendt);
    return oppdagetDato < varselDato;
  }, [isUpdateMode, nyDatoOppdaget, grunnlag?.grunnlag_varsel?.dato_sendt]);

  // Calculate days between new discovery date and existing notice (for update mode)
  const dagerMellomOppdagetOgVarsel = useMemo(() => {
    if (!isUpdateMode || !nyDatoOppdaget || !grunnlag?.grunnlag_varsel?.dato_sendt) return null;
    const oppdagetDato = new Date(nyDatoOppdaget);
    const varselDato = new Date(grunnlag.grunnlag_varsel.dato_sendt);
    const diffTime = varselDato.getTime() - oppdagetDato.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [isUpdateMode, nyDatoOppdaget, grunnlag?.grunnlag_varsel?.dato_sendt]);

  // Check preclusion risk for date change (update mode)
  const preklusjonsRisikoVedEndring = useMemo(() => {
    if (!dagerMellomOppdagetOgVarsel || dagerMellomOppdagetOgVarsel <= 0) return null;
    return getPreklusjonsvarsel(dagerMellomOppdagetOgVarsel);
  }, [dagerMellomOppdagetOgVarsel]);

  // Check if category is changing (update mode)
  const kategoriEndres = useMemo(() => {
    if (!isUpdateMode) return false;
    return nyHovedkategori && nyHovedkategori !== grunnlag?.hovedkategori;
  }, [isUpdateMode, nyHovedkategori, grunnlag?.hovedkategori]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isUpdateMode ? "Oppdater grunnlag" : "Varsle endringsforhold"}
      description={isUpdateMode ? "Endre informasjon i det innsendte grunnlaget." : undefined}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* UPDATE MODE: Current grunnlag summary */}
        {isUpdateMode && grunnlag && (
          <SectionContainer
            title="Nåværende grunnlag"
            description={`Varslet ${grunnlag.grunnlag_varsel?.dato_sendt || 'ukjent dato'}. Endringer loggføres i historikken.`}
            variant="subtle"
          >
            <DataList variant="grid">
              <DataListItem label="Kategori">
                <span className="font-medium">{getHovedkategoriLabel(grunnlag.hovedkategori || '')}</span>
              </DataListItem>
              <DataListItem label="Oppdaget">
                {grunnlag.dato_oppdaget}
              </DataListItem>
              <DataListItem label="Varslet">
                {grunnlag.grunnlag_varsel?.dato_sendt || 'Ikke varslet'}
              </DataListItem>
            </DataList>
          </SectionContainer>
        )}

        {/* UPDATE MODE: Date change warning */}
        {isUpdateMode && varselErTidligere && dagerMellomOppdagetOgVarsel && dagerMellomOppdagetOgVarsel > 0 && (
          <Alert
            variant={preklusjonsRisikoVedEndring?.status === 'kritisk' ? 'danger' : 'warning'}
            title="Advarsel: Dato kan påvirke preklusjon"
          >
            Hvis du setter oppdaget-dato til <strong>{nyDatoOppdaget}</strong>, betyr det at
            varselet ble sendt {dagerMellomOppdagetOgVarsel} dager etter oppdagelse.
            {preklusjonsRisikoVedEndring?.alert && (
              <p className="mt-2 text-sm">{preklusjonsRisikoVedEndring.alert.message}</p>
            )}
          </Alert>
        )}

        {/* UPDATE MODE: Category change warning */}
        {isUpdateMode && kategoriEndres && (
          <Alert variant="warning" title="Kategoriendring">
            Du endrer kategorien fra &ldquo;{getHovedkategoriLabel(grunnlag?.hovedkategori || '')}&rdquo;
            til &ldquo;{getHovedkategoriLabel(nyHovedkategori || '')}&rdquo;.
            Dette kan påvirke hvilke hjemler og varslingskrav som gjelder.
          </Alert>
        )}

        {/* Seksjon 1: Juridisk grunnlag */}
        <SectionContainer
          title="Juridisk grunnlag"
          description="Velg kategori og underkategori iht. NS 8407"
        >
          <div className="space-y-4">
            {/* Hovedkategori */}
            <FormField
              label="Hovedkategori"
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
                      <div className="space-y-4" data-testid="grunnlag-underkategori-list">
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
          </div>
        </SectionContainer>

        {/* Seksjon 2: Beskrivelse */}
        <SectionContainer
          title="Beskrivelse"
          description="Beskriv forholdet som varsles"
        >
          <div className="space-y-4">
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
          </div>
        </SectionContainer>

        {/* Seksjon 3: Tidspunkt og varsling */}
        <SectionContainer
          title="Tidspunkt og varsling"
          description="Dokumenter når forholdet ble oppdaget og varslet"
        >
          <div className="space-y-4">
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

            {/* Varsel options - only in create mode (varsel already sent in update mode) */}
            {!isUpdateMode && (
              <>
                <FormField
                  label="Når ble byggherren varslet?"
                  labelTooltip="Dokumenter når byggherren ble varslet. Varselfrist er kritisk for om kravet kan tapes ved preklusjon."
                >
                  <Controller
                    name="varsel_sendes_na"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup
                        value={field.value ? 'na' : 'tidligere'}
                        onValueChange={(v) => field.onChange(v === 'na')}
                        data-testid="grunnlag-varsel-valg"
                      >
                        <RadioItem
                          value="na"
                          label="Varsel sendes nå (sammen med dette skjemaet)"
                        />
                        <RadioItem
                          value="tidligere"
                          label="Varsel ble sendt tidligere"
                        />
                      </RadioGroup>
                    )}
                  />
                </FormField>

                {/* Tidligere varsel-detaljer - kun synlig når "tidligere" er valgt */}
                {!varselSendesNa && (
                  <div className="border-l-2 border-pkt-border-subtle pl-4 space-y-4">
                    <FormField
                      label="Dato varsel sendt"
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

                    <FormField
                      label="Varselmetode"
                      helpText="Hvordan ble byggherren varslet? (Kan velge flere)"
                    >
                      <div className="space-y-3">
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
                  </div>
                )}
              </>
            )}
          </div>
        </SectionContainer>

        {/* UPDATE MODE: Begrunnelse for endring */}
        {isUpdateMode && (
          <SectionContainer title="Begrunnelse for endring">
            <FormField
              label="Hvorfor endres grunnlaget?"
              required
              error={errors.endrings_begrunnelse?.message}
            >
              <Textarea
                id="endrings_begrunnelse"
                {...register('endrings_begrunnelse')}
                rows={3}
                fullWidth
                error={!!errors.endrings_begrunnelse}
                placeholder="F.eks. ny informasjon, korrigering av feil, etc."
              />
            </FormField>
          </SectionContainer>
        )}

        {/* Seksjon 4: Vedlegg */}
        <SectionContainer
          title="Vedlegg"
          description="Last opp dokumentasjon (valgfritt)"
        >
          <Controller
            name="attachments"
            control={control}
            render={({ field }) => (
              <AttachmentUpload
                value={field.value ?? []}
                onChange={field.onChange}
                multiple
                acceptedFormatsText="PDF, Word, Excel, bilder (maks 10 MB)"
              />
            )}
          />
        </SectionContainer>

        {/* Guidance text - only in create mode */}
        {!isUpdateMode && (
          <p className="text-xs text-pkt-text-body-subtle">
            Dette er et nøytralt varsel om grunnlaget. Spesifiserte krav om penger (Vederlag)
            og tid (Frist) legger du til i egne steg etterpå.
          </p>
        )}

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
            className="w-full sm:w-auto"
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            className="w-full sm:w-auto"
            data-testid="grunnlag-submit"
          >
            {isUpdateMode ? 'Lagre endringer' : 'Send varsel'}
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
