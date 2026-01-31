/**
 * SendFristModal Component
 *
 * Action modal for submitting a new frist (deadline extension) claim.
 * Uses React Hook Form + Zod for validation.
 * Now uses Radix UI primitives with Punkt design system styling.
 *
 * UPDATED (2025-12-05):
 * - Added BH forespørsel warning (§33.6.2) - critical
 * - Added §33.6.1 reduction warning when late
 * - Added grunnlag context display
 *
 * UPDATED (2026-01-24):
 * - Corrected terminology to match NS 8407 contract text
 * - Added VarslingsregelInline component for rule display with accordion
 * - Added dager-beregning fra dato_oppdaget
 *
 * UPDATED (2026-01-29):
 * - Removed "Årsakssammenheng" section for neutral notice (§33.4) - not required
 * - Merged "Årsakssammenheng" + "Beregning" into single "Krav og begrunnelse" section
 * - Made begrunnelse optional for neutral notice, required only for specified claim
 */

import {
  Alert,
  AttachmentUpload,
  Button,
  Checkbox,
  DatePicker,
  ExpandableText,
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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { useState, useEffect, useRef } from 'react';
import {
  FRIST_VARSELTYPE_OPTIONS,
  getFristVarseltypeValues,
  FRIST_VARSELTYPE_DESCRIPTIONS,
  getHovedkategoriLabel,
  erForceMajeure,
} from '../../constants';
import { VarselSeksjon } from './shared/VarselSeksjon';
import { differenceInDays, format, parseISO } from 'date-fns';
import { nb } from 'date-fns/locale';

const fristSchema = z.object({
  varsel_type: z.enum(getFristVarseltypeValues(), {
    errorMap: () => ({ message: 'Varseltype er påkrevd' }),
  }),

  // VarselInfo for varsel om fristforlengelse (§33.4)
  frist_varsel_sendes_na: z.boolean().optional(),
  frist_varsel_dato: z.string().optional(),
  frist_varsel_metoder: z.array(z.string()).optional(),

  // For spesifisert krav: har bruker tidligere varslet (§33.4)?
  har_tidligere_varslet: z.boolean().optional(),

  // VarselInfo for spesifisert krav (§33.6)
  spesifisert_varsel_sendes_na: z.boolean().optional(),
  spesifisert_varsel_dato: z.string().optional(),
  spesifisert_varsel_metoder: z.array(z.string()).optional(),

  antall_dager: z.number().min(0, 'Antall dager kan ikke være negativt').optional(),
  begrunnelse: z.string().optional(),
  ny_sluttdato: z.string().optional(),
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
}).refine(
  (data) => {
    // antall_dager is required for spesifisert krav
    if (data.varsel_type === 'spesifisert') {
      return data.antall_dager !== undefined && data.antall_dager >= 0;
    }
    return true;
  },
  {
    message: 'Antall dager er påkrevd for spesifisert krav',
    path: ['antall_dager'],
  }
).refine(
  (data) => {
    // begrunnelse is required for spesifisert krav (§33.6.1 requires justification)
    if (data.varsel_type === 'spesifisert') {
      return data.begrunnelse && data.begrunnelse.length >= 10;
    }
    return true;
  },
  {
    message: 'Begrunnelse må være minst 10 tegn',
    path: ['begrunnelse'],
  }
);

type FristFormData = z.infer<typeof fristSchema>;

// Grunnlag event info for context display
interface GrunnlagEventInfo {
  tittel?: string;
  hovedkategori?: string;
  /** Dato når forholdet ble oppdaget av TE - brukes for §33.4-beregning */
  dato_oppdaget?: string;
  dato_varslet?: string;
  status?: 'godkjent' | 'avslatt' | 'delvis_godkjent' | 'ubesvart';
}

interface SendFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the grunnlag event this frist claim is linked to (required for event sourcing) */
  grunnlagEventId: string;
  /** Optional grunnlag event data for context display */
  grunnlagEvent?: GrunnlagEventInfo;
  /** Whether BH has sent a forespørsel (§33.6.2) - triggers critical warning */
  harMottattForesporsel?: boolean;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
}

export function SendFristModal({
  open,
  onOpenChange,
  sakId,
  grunnlagEventId,
  grunnlagEvent,
  harMottattForesporsel,
  onCatendaWarning,
}: SendFristModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    control,
    watch,
  } = useForm<FristFormData>({
    resolver: zodResolver(fristSchema),
    defaultValues: {
      frist_varsel_sendes_na: true,
      frist_varsel_metoder: [],
      har_tidligere_varslet: false,
      spesifisert_varsel_sendes_na: true,
      spesifisert_varsel_metoder: [],
      attachments: [],
    },
  });

  // Form backup for token expiry protection
  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'frist_krav_sendt',
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
        toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
      }
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, isDirty, getBackup, reset, toast]);

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
      onOpenChange(false);
      toast.success('Fristkrav sendt', 'Kravet ditt er registrert og sendt til byggherre.');
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

  // Watch for conditional rendering
  const selectedVarselType = watch('varsel_type');
  const harTidligereVarslet = watch('har_tidligere_varslet');

  // Calculate days since the issue was discovered (for §33.4 preclusion warning)
  // §33.4: TE skal varsle "uten ugrunnet opphold" etter at forholdet oppstår
  const dagerSidenOppdaget = grunnlagEvent?.dato_oppdaget
    ? differenceInDays(new Date(), new Date(grunnlagEvent.dato_oppdaget))
    : null;

  // Fallback to dato_varslet if dato_oppdaget not available
  const dagerSidenGrunnlag = dagerSidenOppdaget ?? (grunnlagEvent?.dato_varslet
    ? differenceInDays(new Date(), new Date(grunnlagEvent.dato_varslet))
    : 0);

  // §33.4: Nøytralt varsel skal sendes "uten ugrunnet opphold" - typisk 7-14 dager
  // Over 7 dager: advarsel. Over 14 dager: kritisk.
  const erNoytraltVarselSent = dagerSidenGrunnlag > 7;
  const erNoytraltVarselKritisk = dagerSidenGrunnlag > 14;

  // Get category label for display
  const kategoriLabel = grunnlagEvent?.hovedkategori
    ? getHovedkategoriLabel(grunnlagEvent.hovedkategori)
    : undefined;

  // Determine if this is a subsidiary claim (grunnlag was rejected)
  const erSubsidiaer = grunnlagEvent?.status === 'avslatt';


  const onSubmit = (data: FristFormData) => {
    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending('Sender fristkrav...', 'Vennligst vent mens kravet behandles.');

    // Build VarselInfo structures
    // For spesifisert varsel: use today's date and 'digital_oversendelse' method if "sendes nå" is checked
    const spesifisertDato = data.spesifisert_varsel_sendes_na
      ? new Date().toISOString().split('T')[0]
      : data.spesifisert_varsel_dato;

    const spesifisertMetode = data.spesifisert_varsel_sendes_na
      ? ['digital_oversendelse']
      : (data.spesifisert_varsel_metoder || []);

    const spesifisertVarsel = spesifisertDato
      ? {
          dato_sendt: spesifisertDato,
          metode: spesifisertMetode,
        }
      : undefined;

    // For varsel om fristforlengelse (§33.4):
    // - If varsel_type is 'varsel': use frist_varsel_* fields
    // - If varsel_type is 'spesifisert' AND har_tidligere_varslet: use frist_varsel_* fields
    // - If varsel_type is 'spesifisert' AND NOT har_tidligere_varslet: use spesifisert_varsel as frist_varsel
    //   (because the specified claim also counts as the §33.4 notice)
    let fristVarsel: { dato_sendt: string; metode: string[] } | undefined;

    if (data.varsel_type === 'spesifisert' && !data.har_tidligere_varslet) {
      // Specified claim without prior notice: use spesifisert date as frist_varsel
      fristVarsel = spesifisertVarsel;
    } else {
      // Neutral notice OR specified with prior notice: use frist_varsel_* fields
      const fristVarselDato = data.frist_varsel_sendes_na
        ? new Date().toISOString().split('T')[0]
        : data.frist_varsel_dato;

      const fristVarselMetode = data.frist_varsel_sendes_na
        ? ['digital_oversendelse']
        : (data.frist_varsel_metoder || []);

      fristVarsel = fristVarselDato
        ? {
            dato_sendt: fristVarselDato,
            metode: fristVarselMetode,
          }
        : undefined;
    }

    mutation.mutate({
      eventType: 'frist_krav_sendt',
      data: {
        grunnlag_event_id: grunnlagEventId,
        varsel_type: data.varsel_type,
        frist_varsel: fristVarsel,
        spesifisert_varsel: spesifisertVarsel,
        antall_dager: data.antall_dager,
        begrunnelse: data.begrunnelse,
        ny_sluttdato: data.ny_sluttdato,
        // Metadata for tracking if this was response to BH forespørsel (§33.6.2)
        er_svar_pa_foresporsel: harMottattForesporsel,
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Krev fristforlengelse"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
        {/* BH forespørsel warning (§33.6.2) - CRITICAL */}
        {harMottattForesporsel && (
          <Alert variant="danger" title="Svar på byggherrens forespørsel (§33.6.2)">
            <p>
              Byggherren har bedt om at du angir og begrunner antall dager. Du skal svare «uten ugrunnet opphold».
              Hvis du ikke svarer, <strong>tapes kravet på fristforlengelse</strong>.
            </p>
            <p className="mt-2 text-sm">
              Du kan enten <strong>(a)</strong> angi og begrunne antall dager, eller{' '}
              <strong>(b)</strong> begrunne hvorfor grunnlaget for å beregne kravet ikke foreligger.
            </p>
          </Alert>
        )}

        {/* Subsidiary treatment info */}
        {erSubsidiaer && (
          <Alert variant="info" title="Subsidiær behandling">
            Grunnlaget er avvist – kravet behandles subsidiært for å sikre fristene i NS 8407.
          </Alert>
        )}

        {/* Kravtype */}
        <SectionContainer
          title="Kravtype"
          description={selectedVarselType && FRIST_VARSELTYPE_DESCRIPTIONS[selectedVarselType] ? FRIST_VARSELTYPE_DESCRIPTIONS[selectedVarselType] : undefined}
        >
          <FormField
            error={errors.varsel_type?.message}
          >
            <Controller
              name="varsel_type"
              control={control}
              render={({ field }) => (
                <>
                  <RadioGroup value={field.value} onValueChange={field.onChange} data-testid="frist-varsel-type">
                    {FRIST_VARSELTYPE_OPTIONS
                      .filter(opt => opt.value !== '')
                      // §33.6.2 bokstav b er kun tilgjengelig som svar på forespørsel
                      .filter(opt => opt.value !== 'begrunnelse_utsatt' || harMottattForesporsel)
                      .map((option) => (
                        <RadioItem
                          key={option.value}
                          id={`varsel_type_${option.value}`}
                          value={option.value}
                          label={option.label}
                        />
                      ))}
                  </RadioGroup>
                  {/* Varslingsregel-komponenter for valgt type */}
                  {field.value && (
                    <div className="mt-4 space-y-3 sm:space-y-4">
                      {/* Dager siden forholdet oppstod - kun når dato_oppdaget er tilgjengelig */}
                      {grunnlagEvent?.dato_oppdaget && (field.value === 'varsel' || field.value === 'spesifisert') && (
                        <div className="flex items-center gap-3 p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
                          <span className="text-sm text-pkt-text-body">
                            Forholdet oppstod{' '}
                            <span className="font-medium">
                              {format(parseISO(grunnlagEvent.dato_oppdaget), 'd. MMMM yyyy', { locale: nb })}
                            </span>
                            {' '}—{' '}
                            <span className={`font-mono font-medium ${
                              dagerSidenGrunnlag > 14 ? 'text-pkt-text-danger' :
                              dagerSidenGrunnlag > 7 ? 'text-pkt-text-warning' :
                              'text-pkt-text-body'
                            }`}>
                              {dagerSidenGrunnlag} {dagerSidenGrunnlag === 1 ? 'dag' : 'dager'} siden
                            </span>
                          </span>
                        </div>
                      )}
                      {/* Kontraktsregel for §33.6.2 */}
                      {field.value === 'begrunnelse_utsatt' && (
                        <p className="text-sm text-pkt-text-body-subtle mb-3">
                          <ExpandableText preview="Byggherren kan etterspørre spesifisert krav.">
                            Mottar totalentreprenøren forespørsel om å spesifisere fristkrav (§33.6.2), må han uten
                            ugrunnet opphold enten angi og begrunne antall dager, eller begrunne hvorfor
                            beregningsgrunnlag ikke foreligger. Gjør han ingen av delene i tide, tapes kravet.
                          </ExpandableText>
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            />
          </FormField>
        </SectionContainer>

        {/* Varsel om fristforlengelse (§33.4) - for både varsel og spesifisert */}
        {(selectedVarselType === 'varsel' || selectedVarselType === 'spesifisert') && (
          <SectionContainer title="Varsel om fristforlengelse (§33.4)">
            <div className="space-y-3 sm:space-y-4">
              <p className="text-sm text-pkt-text-body-subtle">
                <ExpandableText preview="Krav om fristforlengelse må varsles «uten ugrunnet opphold».">
                  Oppstår forhold som gir rett til fristforlengelse etter §33.1, §33.2 eller §33.3,
                  må parten varsle krav om fristforlengelse uten ugrunnet opphold (§33.4).
                  Varsles det ikke i tide, tapes kravet på fristforlengelse.
                </ExpandableText>
              </p>

              {/* §33.4 Preklusjonsvarsel - kun for nøytralt varsel */}
              {selectedVarselType === 'varsel' && erNoytraltVarselSent && (
                <Alert
                  variant={erNoytraltVarselKritisk ? 'danger' : 'warning'}
                  title={erNoytraltVarselKritisk ? 'Preklusjonsrisiko (§33.4)' : 'Sen varsling (§33.4)'}
                >
                  Det er gått <strong>{dagerSidenGrunnlag} dager</strong> siden forholdet oppstod.
                  {erNoytraltVarselKritisk
                    ? ' Du skal varsle «uten ugrunnet opphold». Hvis varselet ikke allerede er sendt, risikerer du at kravet tapes.'
                    : ' Du bør varsle snarest for å bevare retten til fristforlengelse.'}
                </Alert>
              )}

              {selectedVarselType === 'varsel' ? (
                <Controller
                  name="frist_varsel_sendes_na"
                  control={control}
                  render={({ field: sendesNaField }) => (
                    <Controller
                      name="frist_varsel_dato"
                      control={control}
                      render={({ field: datoField }) => (
                        <VarselSeksjon
                          checkboxLabel="Varselet ble sendt tidligere"
                          harTidligere={!sendesNaField.value}
                          onHarTidligereChange={(v) => sendesNaField.onChange(!v)}
                          datoSendt={datoField.value}
                          onDatoSendtChange={datoField.onChange}
                          datoError={errors.frist_varsel_dato?.message}
                          registerMetoder={register('frist_varsel_metoder')}
                          idPrefix="frist_varsel"
                          testId="frist-varsel-valg"
                        />
                      )}
                    />
                  )}
                />
              ) : (
                <>
                  <Controller
                    name="har_tidligere_varslet"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="har_tidligere_varslet"
                        label="Jeg har tidligere varslet om dette kravet"
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />

                  {harTidligereVarslet ? (
                    <>
                      <FormField
                        label="Dato varsel ble sendt"
                        helpText="Skriftlig varsel, e-post til avtalt adresse, eller innført i referat (§5)."
                        error={errors.frist_varsel_dato?.message}
                      >
                        <Controller
                          name="frist_varsel_dato"
                          control={control}
                          render={({ field }) => (
                            <DatePicker
                              id="frist_varsel_dato"
                              value={field.value}
                              onChange={field.onChange}
                              error={!!errors.frist_varsel_dato}
                            />
                          )}
                        />
                      </FormField>

                      <FormField
                        label="Varselmetode"
                        helpText="Kun skriftlige varsler er gyldige iht. §5."
                      >
                        <div className="space-y-2">
                          <Checkbox
                            id="frist_varsel-epost"
                            label="E-post"
                            value="epost"
                            {...register('frist_varsel_metoder')}
                          />
                          <Checkbox
                            id="frist_varsel-brev"
                            label="Brev"
                            value="brev"
                            {...register('frist_varsel_metoder')}
                          />
                          <Checkbox
                            id="frist_varsel-byggemoete"
                            label="Byggemøte (innført i referat)"
                            value="byggemoete"
                            {...register('frist_varsel_metoder')}
                          />
                        </div>
                      </FormField>
                    </>
                  ) : (
                    <p className="text-sm text-pkt-text-body-subtle">
                      Sendes i dag sammen med dette skjemaet.
                    </p>
                  )}
                </>
              )}
            </div>
          </SectionContainer>
        )}

        {/* Varseldetaljer for krav om fristforlengelse */}
        {selectedVarselType === 'spesifisert' && (
          <SectionContainer
            title="Krav om fristforlengelse (§33.6.1)"
          >
            <div className="space-y-3 sm:space-y-4">
              <p className="text-sm text-pkt-text-body-subtle">
                <ExpandableText preview="Antall dager må angis «uten ugrunnet opphold» når beregningsgrunnlag foreligger.">
                  Når parten har grunnlag for å beregne omfanget av fristforlengelse, må han angi og
                  begrunne antall dager uten ugrunnet opphold (§33.6.1). Fremsettes ikke kravet i tide,
                  har parten bare krav på slik fristforlengelse som motparten måtte forstå at han hadde krav på.
                </ExpandableText>
              </p>

              {/* §33.4/§33.6.1 Preklusjonsvarsel når spesifisert krav sendes */}
              {erNoytraltVarselSent && !harTidligereVarslet && (
                <Alert
                  variant={erNoytraltVarselKritisk ? 'danger' : 'warning'}
                  title={erNoytraltVarselKritisk ? 'Preklusjonsrisiko (§33.4)' : 'Sen innsending'}
                >
                  Det er gått <strong>{dagerSidenGrunnlag} dager</strong> siden forholdet oppstod.
                  {erNoytraltVarselKritisk
                    ? ' Hvis kravet ikke er varslet i tide (§33.4), risikerer du at det tapes.'
                    : ' Husk at varslingskravene i §33.4 og §33.6.1 gjelder.'}
                </Alert>
              )}

              {/* Når ble kravet fremsatt */}
              <Controller
                name="spesifisert_varsel_sendes_na"
                control={control}
                render={({ field: sendesNaField }) => (
                  <Controller
                    name="spesifisert_varsel_dato"
                    control={control}
                    render={({ field: datoField }) => (
                      <VarselSeksjon
                        checkboxLabel="Kravet ble fremsatt tidligere"
                        harTidligere={!sendesNaField.value}
                        onHarTidligereChange={(v) => sendesNaField.onChange(!v)}
                        datoSendt={datoField.value}
                        onDatoSendtChange={datoField.onChange}
                        datoError={errors.spesifisert_varsel_dato?.message}
                        registerMetoder={register('spesifisert_varsel_metoder')}
                        idPrefix="spesifisert_varsel"
                        testId="spesifisert-varsel-valg"
                        datoLabel="Dato kravet ble fremsatt"
                      />
                    )}
                  />
                )}
              />
            </div>
          </SectionContainer>
        )}

        {/* §33.6.2 bokstav b - Begrunnelse for manglende beregningsgrunnlag */}
        {selectedVarselType === 'begrunnelse_utsatt' && (
          <SectionContainer
            title="Begrunnelse for manglende beregningsgrunnlag (§33.6.2 b)"
            description="Forklar hvorfor grunnlaget for å beregne kravet ikke foreligger"
          >
            <Alert variant="info" title="Konsekvens av §33.6.2 bokstav b">
              Når du begrunner hvorfor grunnlaget for å beregne kravet ikke foreligger,
              gjelder bestemmelsen i §33.6.1 videre. Du skal angi og begrunne antall dager
              «uten ugrunnet opphold» når grunnlaget foreligger. Byggherren kan sende ny forespørsel senere.
            </Alert>
          </SectionContainer>
        )}

        {/* Krav og begrunnelse - kun for spesifisert krav */}
        {selectedVarselType === 'spesifisert' && (
          <SectionContainer title="Krav og begrunnelse">
            <div className="space-y-3 sm:space-y-4">
              {/* Vilkår: §33.3 for force majeure, §33.1 for andre forhold */}
              {grunnlagEvent?.hovedkategori && erForceMajeure(grunnlagEvent.hovedkategori) ? (
                <p className="text-sm text-pkt-text-body-subtle">
                  <ExpandableText preview="Totalentreprenøren har krav på fristforlengelse ved force majeure.">
                    Dersom fremdriften hindres av ekstraordinære og upåregnelige forhold utenfor partens
                    kontroll (force majeure), har totalentreprenøren krav på fristforlengelse (§33.3).
                  </ExpandableText>
                </p>
              ) : (
                <p className="text-sm text-pkt-text-body-subtle">
                  <ExpandableText preview="Totalentreprenøren har krav på fristforlengelse når fremdriften hindres av byggherrens forhold.">
                    Dersom fremdriften hindres på grunn av endringer, forsinkelse eller svikt i byggherrens
                    medvirkning, eller andre forhold byggherren bærer risikoen for, har totalentreprenøren
                    krav på fristforlengelse (§33.1).
                  </ExpandableText>
                </p>
              )}

              {/* Beregning §33.5 */}
              <p className="text-sm text-pkt-text-body-subtle">
                <ExpandableText preview="Fristforlengelsen skal svare til den virkning hindringen har hatt for fremdriften.">
                  Fristforlengelsen skal svare til den virkning hindringen har hatt for fremdriften (§33.5).
                  Ved beregningen skal det tas hensyn til nødvendig avbrudd og oppstart, årstidsforskyvning,
                  den samlede virkning av tidligere fristforlengelser, og om entreprenøren har oppfylt sin
                  tapsbegrensningsplikt. Forlengelsen skal ikke overstige det som er nødvendig for å kompensere
                  den reelle forsinkelsen.
                </ExpandableText>
              </p>

              {/* Antall kalenderdager og ny sluttdato */}
              <div className="flex flex-col min-[420px]:flex-row gap-3 min-[420px]:gap-6">
                <FormField
                  label="Antall kalenderdager"
                  required
                  error={errors.antall_dager?.message}
                >
                  <Input
                    id="antall_dager"
                    type="number"
                    {...register('antall_dager', {
                      setValueAs: (v) => (v === '' ? undefined : Number(v)),
                    })}
                    width="xs"
                    min={0}
                    error={!!errors.antall_dager}
                  />
                </FormField>

                <FormField
                  label="Ny sluttdato"
                  error={errors.ny_sluttdato?.message}
                >
                  <Controller
                    name="ny_sluttdato"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="ny_sluttdato"
                        value={field.value}
                        onChange={field.onChange}
                        error={!!errors.ny_sluttdato}
                      />
                    )}
                  />
                </FormField>
              </div>

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
                  error={!!errors.begrunnelse}
                  data-testid="frist-begrunnelse"
                />
              </FormField>
            </div>
          </SectionContainer>
        )}

        {/* Vedlegg */}
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

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-6 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting} className="w-full sm:w-auto order-1 sm:order-2" data-testid="frist-submit">
            Send fristkrav
          </Button>
        </div>
      </form>

      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
    </Modal>
  );
}
