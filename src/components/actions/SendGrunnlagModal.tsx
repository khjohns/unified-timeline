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
  AttachmentUpload,
  Button,
  Checkbox,
  InlineDataList,
  InlineDataListItem,
  FormField,
  Input,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  Textarea,
  useToast,
} from '../primitives';
import { KontraktsregelInline } from '../shared';
import { VarselSeksjon } from './shared/VarselSeksjon';
import type { AttachmentFile } from '../../types';
import type { GrunnlagTilstand } from '../../types/timeline';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  HOVEDKATEGORI_OPTIONS,
  getHovedkategori,
  getHovedkategoriLabel,
  getUnderkategoriObj,
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
});

// Schema for update mode - all fields optional
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
  endrings_begrunnelse: z.string().optional(),
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

  // Form backup for token expiry protection
  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    isUpdateMode ? 'grunnlag_oppdatert' : 'grunnlag_opprettet',
    formData,
    isDirty
  );

  // Auto-restore backup on mount (silent restoration with toast notification)
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && hasBackup && !isDirty && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;
      const backup = getBackup();
      if (backup) {
        reset(backup);
        if (backup.hovedkategori) {
          setSelectedHovedkategori(backup.hovedkategori);
        }
        toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
      }
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, isDirty, getBackup, reset, toast]);

  const hovedkategoriValue = watch('hovedkategori');
  const varselSendesNa = watch('varsel_sendes_na');
  const datoOppdaget = watch('dato_oppdaget');
  const datoVarselSendt = watch('dato_varsel_sendt');
  const selectedUnderkategorier = watch('underkategori');

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

  // Calculate preclusion risk for current moment (when sending now)
  const preklusjonsResultat = useMemo(() => {
    if (!datoOppdaget) return null;
    return getPreklusjonsvarsel(beregnDagerSiden(datoOppdaget), undefined, selectedHovedkategori);
  }, [datoOppdaget, selectedHovedkategori]);

  // Calculate preclusion risk between discovery and earlier notification date
  const preklusjonsResultatVarsel = useMemo(() => {
    if (!datoOppdaget || !datoVarselSendt || varselSendesNa) return null;
    return getPreklusjonsvarselMellomDatoer(datoOppdaget, datoVarselSendt, undefined, selectedHovedkategori);
  }, [datoOppdaget, datoVarselSendt, varselSendesNa, selectedHovedkategori]);

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
        isUpdateMode ? 'Ansvarsgrunnlag oppdatert' : 'Varsel sendt',
        isUpdateMode
          ? 'Endringene i ansvarsgrunnlaget er registrert.'
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
      },
    });
  };

  // Calculate warnings for update mode
  const nyHovedkategori = watch('hovedkategori');

  // Check if category is changing (update mode)
  const kategoriEndres = useMemo(() => {
    if (!isUpdateMode) return false;
    return nyHovedkategori && nyHovedkategori !== grunnlag?.hovedkategori;
  }, [isUpdateMode, nyHovedkategori, grunnlag?.hovedkategori]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isUpdateMode ? "Oppdater ansvarsgrunnlag" : "Varsle ansvarsgrunnlag"}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* UPDATE MODE: Current grunnlag summary */}
        {isUpdateMode && grunnlag && (
          <SectionContainer
            title="Nåværende ansvarsgrunnlag"
            variant="subtle"
          >
            <InlineDataList>
              <InlineDataListItem label="Kategori" bold>
                {getHovedkategoriLabel(grunnlag.hovedkategori || '')}
              </InlineDataListItem>
              <InlineDataListItem label="Oppdaget">
                {grunnlag.dato_oppdaget}
              </InlineDataListItem>
              <InlineDataListItem label="Varslet">
                {grunnlag.grunnlag_varsel?.dato_sendt || 'Ikke varslet'}
              </InlineDataListItem>
            </InlineDataList>
          </SectionContainer>
        )}

        {/* UPDATE MODE: Category change warning */}
        {isUpdateMode && kategoriEndres && (
          <Alert variant="warning" title="Kategoriendring">
            Du endrer kategorien fra &ldquo;{getHovedkategoriLabel(grunnlag?.hovedkategori || '')}&rdquo;
            til &ldquo;{getHovedkategoriLabel(nyHovedkategori || '')}&rdquo;.
            Dette kan påvirke hvilke hjemler og varslingskrav som gjelder.
          </Alert>
        )}

        {/* Seksjon 1: Ansvarsgrunnlag */}
        <SectionContainer
          title="Ansvarsgrunnlag"
        >
          <div className="space-y-4">
            {/* Hovedkategori */}
            <FormField
              label="Hovedkategori"
              required
              error={errors.hovedkategori?.message}
              helpText="Velg rettslig grunnlag iht. NS 8407. Dette bestemmer hvilke kontraktsbestemmelser som gjelder og hvilke krav som kan fremmes."
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
                    {HOVEDKATEGORI_OPTIONS.filter(opt => opt.value !== '').map((option) => {
                      const erValgt = field.value === option.value;
                      const kategoriInfo = erValgt ? getHovedkategori(option.value) : null;
                      return (
                        <div key={option.value}>
                          <RadioItem
                            value={option.value}
                            label={option.label}
                            error={!!errors.hovedkategori}
                          />
                          {erValgt && kategoriInfo && (
                            <div className="mt-2 ml-6">
                              <KontraktsregelInline
                                custom={{
                                  inline: kategoriInfo.beskrivelse,
                                  hjemmel: '',
                                  konsekvens: `Fristforlengelse: §${kategoriInfo.hjemmel_frist}${kategoriInfo.hjemmel_vederlag ? `\nVederlagsjustering: §${kategoriInfo.hjemmel_vederlag}` : ''}`,
                                  accordionLabel: 'Hjemler',
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </RadioGroup>
                )}
              />
            </FormField>

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
                              {underkategorier.map((uk) => {
                                const erValgt = field.value?.includes(uk.kode) ?? false;
                                return (
                                  <div key={uk.kode}>
                                    <Checkbox
                                      id={`underkategori-${uk.kode}`}
                                      label={uk.label}
                                      checked={erValgt}
                                      onCheckedChange={(checked) => {
                                        const current = field.value ?? [];
                                        if (checked) {
                                          field.onChange([...current, uk.kode]);
                                        } else {
                                          field.onChange(current.filter((v: string) => v !== uk.kode));
                                        }
                                      }}
                                    />
                                    {erValgt && (
                                      <div className="mt-2 ml-6">
                                        <KontraktsregelInline
                                          custom={{
                                            inline: uk.beskrivelse,
                                            hjemmel: `§${uk.hjemmel_basis}`,
                                            konsekvens: `§${uk.varselkrav_ref}`,
                                            accordionLabel: 'Varslingskrav',
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </FormField>
                  );
                }}
              />
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

            <FormField
              label="Beskrivelse"
              required
              error={errors.beskrivelse?.message}
              helpText="Beskriv ansvarsgrunnlaget for endringsmeldingen"
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

            {/* Varsel options - only in create mode (varsel already sent in update mode) */}
            {!isUpdateMode && (
              <Controller
                name="varsel_sendes_na"
                control={control}
                render={({ field: sendesNaField }) => (
                  <Controller
                    name="dato_varsel_sendt"
                    control={control}
                    render={({ field: datoField }) => (
                      <VarselSeksjon
                        label="Når ble byggherren varslet?"
                        labelTooltip="Dokumenter når byggherren ble varslet. Varselfrist er kritisk for om kravet kan tapes ved preklusjon."
                        sendesNa={sendesNaField.value ?? true}
                        onSendesNaChange={sendesNaField.onChange}
                        datoSendt={datoField.value}
                        onDatoSendtChange={datoField.onChange}
                        registerMetoder={register('varsel_metode')}
                        idPrefix="grunnlag_varsel"
                        testId="grunnlag-varsel-valg"
                        extraContent={
                          preklusjonsResultatVarsel?.alert && (
                            <div className="mt-3">
                              <Alert
                                variant={preklusjonsResultatVarsel.alert.variant}
                                title={preklusjonsResultatVarsel.alert.title}
                              >
                                {preklusjonsResultatVarsel.alert.message}
                              </Alert>
                            </div>
                          )
                        }
                      />
                    )}
                  />
                )}
              />
            )}
          </div>
        </SectionContainer>

        {/* Seksjon 4: Vedlegg */}
        <SectionContainer
          title="Vedlegg"
          description="Last opp dokumentasjon"
          optional
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
            Dette er et nøytralt varsel om ansvarsgrunnlaget. Spesifiserte krav om penger (Vederlag)
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
            onClick={() => onOpenChange(false)}
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

      {/* Token expired alert */}
      <TokenExpiredAlert
        open={showTokenExpired}
        onClose={() => setShowTokenExpired(false)}
      />
    </Modal>
  );
}
