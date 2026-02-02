/**
 * UtstEndringsordreModal Component
 *
 * Multi-step wizard modal for BH to issue an Endringsordre (Change Order).
 * Based on NS 8407 §31.3 and the Endringsordre template.
 *
 * Steps:
 * 1. Basic info (EO-nummer, beskrivelse)
 * 2. Select KOE cases to include
 * 3. Consequences (SHA, kvalitet, fremdrift, pris, annet)
 * 4. Settlement (oppgjørsform, beløp, frist)
 * 5. Review and submit
 *
 * UPDATED: Uses react-hook-form + zod, primitive components, and standard patterns.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useFormBackup } from '../../hooks/useFormBackup';
import { useVerifyToken } from '../../hooks/useVerifyToken';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { getAuthToken } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sakKeys, endringsordreKeys } from '../../queries';
import { STALE_TIME } from '../../constants/queryConfig';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Primitives
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  CurrencyInput,
  DatePicker,
  FormField,
  Input,
  Modal,
  SectionContainer,
  StatusSummary,
  StepIndicator,
  Textarea,
  useToast,
} from '../primitives';

// API
import {
  opprettEndringsordre,
  fetchKandidatKOESaker,
  type OpprettEORequest,
  type KandidatKOE,
} from '../../api/endringsordre';

// Types
import type { VederlagsMetode, EOKonsekvenser } from '../../types/timeline';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface UtstEndringsordreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  preselectedKoeIds?: string[];
}

interface OppgjorsformOption {
  value: VederlagsMetode;
  label: string;
  paragraf: string;
  indeksregulering: 'full' | 'delvis' | 'ingen';
  description: string;
}

const OPPGJORSFORM_OPTIONS: OppgjorsformOption[] = [
  {
    value: 'ENHETSPRISER',
    label: 'Enhetspriser',
    paragraf: '§34.3',
    indeksregulering: 'full',
    description: 'Kontraktens eller justerte enhetspriser. Gjenstand for indeksregulering.',
  },
  {
    value: 'REGNINGSARBEID',
    label: 'Regningsarbeid',
    paragraf: '§30.2, §34.4',
    indeksregulering: 'delvis',
    description: 'Oppgjør etter medgått tid og materialer. Endelig beløp fastsettes ved sluttoppgjør.',
  },
  {
    value: 'FASTPRIS_TILBUD',
    label: 'Fastpris / Tilbud',
    paragraf: '§34.2.1',
    indeksregulering: 'ingen',
    description: 'Entreprenørens tilbud. Fast beløp, ikke gjenstand for indeksregulering.',
  },
];

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const utstEndringsordreSchema = z.object({
  // Step 1: Grunnlag
  eo_nummer: z.string().min(1, 'EO-nummer er påkrevd'),
  tittel: z.string().min(3, 'Tittel må være minst 3 tegn').max(100, 'Tittel kan ikke være lengre enn 100 tegn'),
  beskrivelse: z.string().min(1, 'Beskrivelse er påkrevd'),
  // selectedKoeIds is handled via useState

  // Step 2: Konsekvenser og oppgjør
  konsekvenser_sha: z.boolean(),
  konsekvenser_kvalitet: z.boolean(),
  konsekvenser_fremdrift: z.boolean(),
  konsekvenser_pris: z.boolean(),
  konsekvenser_annet: z.boolean(),
  konsekvens_beskrivelse: z.string().optional(),

  // Step 4: Oppgjør
  oppgjorsform: z.enum(['ENHETSPRISER', 'REGNINGSARBEID', 'FASTPRIS_TILBUD']).optional(),
  kompensasjon_belop: z.number().min(0).optional().nullable(),
  fradrag_belop: z.number().min(0).optional().nullable(),
  er_estimat: z.boolean(),
  frist_dager: z.number().min(0).optional().nullable(),
  ny_sluttdato: z.string().optional(),
});

type UtstEndringsordreFormData = z.infer<typeof utstEndringsordreSchema>;

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function IndeksreguleringsInfo({ indeks }: { indeks: 'full' | 'delvis' | 'ingen' }) {
  const variants: Record<string, 'success' | 'warning' | 'default'> = {
    full: 'success',
    delvis: 'warning',
    ingen: 'default',
  };
  const labels = {
    full: 'Full indeksreg.',
    delvis: 'Delvis indeksreg.',
    ingen: 'Ingen indeksreg.',
  };

  return <Badge variant={variants[indeks]}>{labels[indeks]}</Badge>;
}

function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UtstEndringsordreModal({
  open,
  onOpenChange,
  sakId,
  preselectedKoeIds = [],
}: UtstEndringsordreModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const topRef = useRef<HTMLDivElement>(null);
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // KOE selection state (managed separately from form due to array handling)
  const [selectedKoeIds, setSelectedKoeIds] = useState<string[]>(preselectedKoeIds);

  // Scroll to top of modal content
  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Step configuration for StepIndicator
  const steps = [
    { label: 'Ansvarsgrunnlag' },
    { label: 'Konsekvenser og oppgjør' },
    { label: 'Bekreft' },
  ];

  // Form setup with react-hook-form + zod
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    control,
    trigger,
    clearErrors,
    setValue,
  } = useForm<UtstEndringsordreFormData>({
    resolver: zodResolver(utstEndringsordreSchema),
    mode: 'onTouched',
    defaultValues: {
      eo_nummer: '',
      tittel: '',
      beskrivelse: '',
      konsekvenser_sha: false,
      konsekvenser_kvalitet: false,
      konsekvenser_fremdrift: false,
      konsekvenser_pris: false,
      konsekvenser_annet: false,
      konsekvens_beskrivelse: '',
      er_estimat: false,
      kompensasjon_belop: null,
      fradrag_belop: null,
      frist_dager: null,
    },
  });

  // Watch form values for conditional rendering
  const formValues = watch();

  // Form backup (note: selectedKoeIds is managed separately and won't be backed up)
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'endringsordre_opprett', formValues, isDirty);

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

  // Token validation hook
  const verifyToken = useVerifyToken();

  // Fetch candidate KOE cases
  const { data: kandidaterData, isLoading: kandidaterLoading } = useQuery({
    queryKey: endringsordreKeys.kandidater(),
    queryFn: fetchKandidatKOESaker,
    enabled: open,
    staleTime: STALE_TIME.DEFAULT,
  });

  const kandidatSaker = kandidaterData?.kandidat_saker ?? [];

  // Generate next EO number based on existing EOs
  const generateNextEoNummer = useCallback(() => {
    const existingNumbers = kandidatSaker
      .map((k) => {
        const match = k.tittel?.match(/EO-?(\d+)/i);
        return match?.[1] ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `EO-${String(nextNumber).padStart(3, '0')}`;
  }, [kandidatSaker]);

  // Create EO mutation
  const createEOMutation = useMutation({
    mutationFn: async (data: OpprettEORequest) => {
      // Validate token before submission
      const token = getAuthToken();
      if (!token) {
        throw new Error('TOKEN_MISSING');
      }
      const isValid = await verifyToken(token);
      if (!isValid) {
        throw new Error('TOKEN_EXPIRED');
      }
      return opprettEndringsordre(data);
    },
    onSuccess: (response) => {
      clearBackup();
      queryClient.invalidateQueries({ queryKey: sakKeys.state(sakId) });
      queryClient.invalidateQueries({ queryKey: sakKeys.timeline(sakId) });
      reset();
      setSelectedKoeIds(preselectedKoeIds);
      setCurrentStep(1);
      onOpenChange(false);
      navigate(`/endringsordre/${response.sak_id}`);
    },
    onError: (error) => {
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING')) {
        setShowTokenExpired(true);
      }
    },
  });

  // Computed values
  const nettoBelop = useMemo(() => {
    const komp = formValues.kompensasjon_belop || 0;
    const frad = formValues.fradrag_belop || 0;
    return komp - frad;
  }, [formValues.kompensasjon_belop, formValues.fradrag_belop]);

  const totalFromKOE = useMemo(() => {
    return kandidatSaker
      .filter((k) => selectedKoeIds.includes(k.sak_id))
      .reduce((sum, k) => sum + (k.sum_godkjent || 0), 0);
  }, [kandidatSaker, selectedKoeIds]);

  const totalDagerFromKOE = useMemo(() => {
    return kandidatSaker
      .filter((k) => selectedKoeIds.includes(k.sak_id))
      .reduce((sum, k) => sum + (k.godkjent_dager || 0), 0);
  }, [kandidatSaker, selectedKoeIds]);

  // Auto-sett konsekvenser og beløp basert på KOE-valg
  useEffect(() => {
    // Auto-check priskonsekvens hvis det er godkjent beløp
    if (totalFromKOE > 0 && !formValues.konsekvenser_pris) {
      setValue('konsekvenser_pris', true);
    }
    // Auto-check fremdriftskonsekvens hvis det er godkjente dager
    if (totalDagerFromKOE > 0 && !formValues.konsekvenser_fremdrift) {
      setValue('konsekvenser_fremdrift', true);
    }
    // Auto-fyll kompensasjon hvis tomt og vi har KOE-beløp
    if (totalFromKOE > 0 && !formValues.kompensasjon_belop) {
      setValue('kompensasjon_belop', totalFromKOE);
    }
    // Auto-fyll frist hvis tomt og vi har KOE-dager
    if (totalDagerFromKOE > 0 && !formValues.frist_dager) {
      setValue('frist_dager', totalDagerFromKOE);
    }
  }, [totalFromKOE, totalDagerFromKOE, formValues.konsekvenser_pris, formValues.konsekvenser_fremdrift, formValues.kompensasjon_belop, formValues.frist_dager, setValue]);

  // Auto-sett er_estimat basert på beregningsmetode
  // ENHETSPRISER: Estimat (mengder varierer, derav enhetspriser)
  // REGNINGSARBEID: Estimat (kostnadsoverslag → sluttoppgjør)
  // FASTPRIS_TILBUD: Ikke estimat (fast avtalt pris)
  useEffect(() => {
    if (formValues.oppgjorsform === 'FASTPRIS_TILBUD') {
      setValue('er_estimat', false);
    } else if (formValues.oppgjorsform) {
      setValue('er_estimat', true);
    }
  }, [formValues.oppgjorsform, setValue]);

  const harKonsekvens =
    formValues.konsekvenser_sha ||
    formValues.konsekvenser_kvalitet ||
    formValues.konsekvenser_fremdrift ||
    formValues.konsekvenser_pris ||
    formValues.konsekvenser_annet;

  // Navigation with validation
  const goToNextStep = useCallback(async () => {
    let isValid = true;

    // Validate current step fields
    if (currentStep === 1) {
      // Step 1: Grunnlag - valider info og KOE-valg
      isValid = await trigger(['eo_nummer', 'tittel', 'beskrivelse']);
    } else if (currentStep === 2) {
      // Step 2: Konsekvenser og oppgjør - valider alt
      isValid = await trigger([
        'konsekvenser_sha',
        'konsekvenser_kvalitet',
        'konsekvenser_fremdrift',
        'konsekvenser_pris',
        'konsekvenser_annet',
        'konsekvens_beskrivelse',
      ]);
      // Validate oppgjørsform if pris consequence
      if (isValid && formValues.konsekvenser_pris) {
        isValid = await trigger(['oppgjorsform', 'kompensasjon_belop', 'fradrag_belop']);
        if (!formValues.oppgjorsform) {
          isValid = false;
        }
      }
      if (isValid && formValues.konsekvenser_fremdrift) {
        isValid = await trigger(['frist_dager']);
      }
    }

    if (isValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      clearErrors();
      setTimeout(scrollToTop, 50);
    }
  }, [currentStep, totalSteps, trigger, formValues, scrollToTop, clearErrors]);

  const goToPrevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setTimeout(scrollToTop, 50);
    }
  }, [currentStep, scrollToTop]);

  // Toggle KOE selection
  const toggleKoeSelection = (koeId: string) => {
    setSelectedKoeIds((prev: string[]) =>
      prev.includes(koeId) ? prev.filter((id: string) => id !== koeId) : [...prev, koeId]
    );
  };

  // Submit handler
  const onSubmit = (data: UtstEndringsordreFormData) => {
    const request: OpprettEORequest = {
      eo_nummer: data.eo_nummer,
      tittel: data.tittel,
      beskrivelse: data.beskrivelse,
      koe_sak_ids: selectedKoeIds.length > 0 ? selectedKoeIds : undefined,
      konsekvenser: {
        sha: data.konsekvenser_sha,
        kvalitet: data.konsekvenser_kvalitet,
        fremdrift: data.konsekvenser_fremdrift,
        pris: data.konsekvenser_pris,
        annet: data.konsekvenser_annet,
      },
      konsekvens_beskrivelse: data.konsekvens_beskrivelse || undefined,
      oppgjorsform: data.oppgjorsform || undefined,
      kompensasjon_belop: data.kompensasjon_belop ?? undefined,
      fradrag_belop: data.fradrag_belop ?? undefined,
      er_estimat: data.er_estimat,
      frist_dager: data.frist_dager ?? undefined,
      ny_sluttdato: data.ny_sluttdato || undefined,
    };

    createEOMutation.mutate(request);
  };

  // Reset to step 1 when opening
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setCurrentStep(1);
    }
    onOpenChange(newOpen);
  };

  return (
    <Modal open={open} onOpenChange={handleOpenChange} title="Utsted Endringsordre" size="lg">
      <div className="space-y-6">
        {/* Scroll target marker */}
        <div ref={topRef} />

        {/* Step Indicator */}
        <StepIndicator
          currentStep={currentStep}
          steps={steps}
          onStepClick={(step) => setCurrentStep(step)}
        />

        <form
          onSubmit={handleSubmit(onSubmit)}
          onKeyDown={(e) => {
            // Prevent Enter from submitting form while navigating through wizard steps
            if (e.key === 'Enter' && currentStep < totalSteps) {
              e.preventDefault();
            }
          }}
          className="space-y-4 sm:space-y-6"
        >
          {/* ================================================================
              STEP 1: GRUNNLAG (Info + KOE-saker)
              ================================================================ */}
          {currentStep === 1 && (
            <>
              <SectionContainer
                title="Identifikasjon"
                description="EO-nummer og tittel for enkel identifikasjon"
              >
                <FormField
                  label="EO-nummer"
                  required
                  error={errors.eo_nummer?.message}
                  helpText="Unik identifikator for endringsordren"
                >
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      {...register('eo_nummer')}
                      error={!!errors.eo_nummer}
                      width="md"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setValue('eo_nummer', generateNextEoNummer())}
                      className="w-full sm:w-auto"
                    >
                      Generer neste
                    </Button>
                  </div>
                </FormField>

                <FormField
                  label="Tittel"
                  required
                  error={errors.tittel?.message}
                  helpText="Kort beskrivende tittel for enkel identifikasjon"
                >
                  <Input
                    {...register('tittel')}
                    error={!!errors.tittel}
                    fullWidth
                  />
                </FormField>

                <FormField
                  label="Beskrivelse"
                  required
                  error={errors.beskrivelse?.message}
                  helpText="Beskriv hva endringen innebærer"
                >
                  <Textarea
                    {...register('beskrivelse')}
                    rows={4}
                    fullWidth
                    error={!!errors.beskrivelse}
                  />
                </FormField>
              </SectionContainer>

              <SectionContainer
                title="Relaterte KOE-saker"
                description="Velg KOE-saker som skal inkluderes i endringsordren, eller fortsett uten for proaktiv EO"
              >
                {kandidaterLoading ? (
                  <div className="flex items-center gap-3 py-4 text-pkt-text-body-muted">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm">Henter kandidatsaker...</span>
                  </div>
                ) : kandidatSaker.length === 0 ? (
                  <p className="text-pkt-text-body-subtle text-sm py-2">
                    Ingen KOE-saker er klare for endringsordre. Du kan fortsette med en proaktiv EO.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto border border-pkt-border-subtle">
                    {/* Mobilvennlig liste-layout */}
                    <div className="divide-y divide-pkt-border-subtle">
                      {kandidatSaker.map((koe) => {
                        const isSelected = selectedKoeIds.includes(koe.sak_id);
                        return (
                          <div
                            key={koe.sak_id}
                            onClick={() => toggleKoeSelection(koe.sak_id)}
                            className={`flex items-start gap-2 p-3 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-pkt-surface-light-beige'
                                : 'hover:bg-pkt-surface-subtle'
                            }`}
                          >
                            <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleKoeSelection(koe.sak_id)}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{koe.tittel}</p>
                              <p className="text-xs text-pkt-text-body-subtle">
                                {koe.overordnet_status}
                              </p>
                              <div className="flex gap-3 mt-1 text-xs">
                                <span className="font-mono text-pkt-brand-dark-green-1000">
                                  {koe.sum_godkjent !== undefined
                                    ? formatCurrency(koe.sum_godkjent)
                                    : '-'}
                                </span>
                                {koe.godkjent_dager !== undefined && koe.godkjent_dager > 0 && (
                                  <span className="text-pkt-text-body-subtle">
                                    {koe.godkjent_dager} dager
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Totalsum */}
                    {selectedKoeIds.length > 0 && (
                      <div className="border-t-2 border-pkt-border-default bg-pkt-surface-subtle p-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-bold">Totalt ({selectedKoeIds.length} valgt)</span>
                          <div className="text-right">
                            <span className="font-mono font-bold text-pkt-brand-dark-green-1000">
                              {formatCurrency(totalFromKOE)}
                            </span>
                            {totalDagerFromKOE > 0 && (
                              <span className="text-pkt-text-body-subtle ml-2">
                                / {totalDagerFromKOE} dager
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </SectionContainer>
            </>
          )}

          {/* ================================================================
              STEP 2: KONSEKVENSER OG OPPGJØR
              ================================================================ */}
          {currentStep === 2 && (
            <>
              <SectionContainer
                title="Konsekvenser"
                description="Kryss av for konsekvenser endringen medfører"
              >
                <div className="space-y-3">
                  <Controller
                    name="konsekvenser_sha"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="konsekvenser_sha"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label="SHA-konsekvens"
                        description="Endringen påvirker sikkerhet, helse eller arbeidsmiljø"
                      />
                    )}
                  />

                  <Controller
                    name="konsekvenser_kvalitet"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="konsekvenser_kvalitet"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label="Kvalitetskonsekvens"
                        description="Endringen påvirker kvalitet eller spesifikasjoner"
                      />
                    )}
                  />

                  <Controller
                    name="konsekvenser_fremdrift"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="konsekvenser_fremdrift"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label="Fremdriftskonsekvens"
                        description="Endringen gir rett til fristforlengelse"
                      />
                    )}
                  />

                  <Controller
                    name="konsekvenser_pris"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="konsekvenser_pris"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label="Priskonsekvens"
                        description="Endringen gir rett til vederlagsjustering"
                      />
                    )}
                  />

                  <Controller
                    name="konsekvenser_annet"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="konsekvenser_annet"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label="Andre konsekvenser"
                        description="Endringen har andre konsekvenser som bør dokumenteres"
                      />
                    )}
                  />
                </div>

                {harKonsekvens && (
                  <FormField label="Utdypende beskrivelse">
                    <Textarea
                      {...register('konsekvens_beskrivelse')}
                      rows={3}
                      fullWidth
                    />
                  </FormField>
                )}

                {!harKonsekvens && (
                  <Alert variant="warning" title="Ingen konsekvenser valgt">
                    Er du sikker på at endringen ikke har konsekvenser?
                  </Alert>
                )}
              </SectionContainer>

              {/* Oppgjør - kun hvis pris eller fremdrift */}
              {(formValues.konsekvenser_pris || formValues.konsekvenser_fremdrift) && (
                <SectionContainer
                  title="Oppgjør"
                  description="Spesifiser vederlag og/eller fristforlengelse"
                >
                  {/* Vederlagsjustering */}
                  {formValues.konsekvenser_pris && (
                    <div className="space-y-3 sm:space-y-4">
                      <FormField
                        label="Beregningsmetode"
                        required
                        error={!formValues.oppgjorsform ? 'Velg beregningsmetode' : undefined}
                      >
                        <div className="space-y-2">
                          {OPPGJORSFORM_OPTIONS.map((opt) => (
                            <Controller
                              key={opt.value}
                              name="oppgjorsform"
                              control={control}
                              render={({ field }) => (
                                <button
                                  type="button"
                                  onClick={() => field.onChange(opt.value)}
                                  className={`w-full p-3 border rounded-none text-left transition-colors ${
                                    field.value === opt.value
                                      ? 'border-pkt-brand-purple-1000 bg-pkt-surface-light-beige'
                                      : 'border-pkt-border-default hover:border-pkt-border-focus'
                                  }`}
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div>
                                      <p className="font-medium text-sm">
                                        {opt.label}{' '}
                                        <span className="text-pkt-text-body-subtle">({opt.paragraf})</span>
                                      </p>
                                      <p className="text-xs text-pkt-text-body-subtle mt-0.5">
                                        {opt.description}
                                      </p>
                                    </div>
                                    <IndeksreguleringsInfo indeks={opt.indeksregulering} />
                                  </div>
                                </button>
                              )}
                            />
                          ))}
                        </div>
                      </FormField>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          label="Kompensasjon (tillegg)"
                          helpText={totalFromKOE > 0 ? `Fra valgte KOE: ${formatCurrency(totalFromKOE)}` : undefined}
                        >
                          <Controller
                            name="kompensasjon_belop"
                            control={control}
                            render={({ field }) => (
                              <CurrencyInput
                                value={field.value}
                                onChange={field.onChange}
                                allowNegative={false}
                              />
                            )}
                          />
                        </FormField>

                        <FormField label="Fradrag">
                          <Controller
                            name="fradrag_belop"
                            control={control}
                            render={({ field }) => (
                              <CurrencyInput
                                value={field.value}
                                onChange={field.onChange}
                                allowNegative={false}
                              />
                            )}
                          />
                        </FormField>
                      </div>

                      <div className="p-3 bg-pkt-surface-subtle border border-pkt-border-subtle rounded-none">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Netto beløp:</span>
                          <span className={`font-bold text-base ${nettoBelop < 0 ? 'text-pkt-brand-red-1000' : ''}`}>
                            {formatCurrency(nettoBelop)}
                          </span>
                        </div>
                      </div>

                      {/* Info om oppgjør ved sluttoppgjør (kun regningsarbeid trenger eksplisitt merknad) */}
                      {formValues.oppgjorsform === 'REGNINGSARBEID' && (
                        <Alert variant="info" title="Oppgjør ved sluttoppgjør">
                          Endelig beløp fastsettes basert på dokumenterte kostnader.
                        </Alert>
                      )}
                    </div>
                  )}

                  {/* Fristforlengelse */}
                  {formValues.konsekvenser_fremdrift && (
                    <div className={`space-y-4 ${formValues.konsekvenser_pris ? 'pt-4 border-t-2 border-pkt-border-subtle' : ''}`}>
                      {formValues.konsekvenser_pris && (
                        <h4 className="font-medium text-sm">Fristforlengelse</h4>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          label="Antall dager"
                          helpText={totalDagerFromKOE > 0 ? `Fra valgte KOE: ${totalDagerFromKOE} dager` : undefined}
                        >
                          <Controller
                            name="frist_dager"
                            control={control}
                            render={({ field }) => (
                              <Input
                                type="number"
                                value={field.value ?? ''}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
                                }
                                width="xs"
                              />
                            )}
                          />
                        </FormField>

                        <FormField label="Ny sluttdato">
                          <Controller
                            name="ny_sluttdato"
                            control={control}
                            render={({ field }) => (
                              <DatePicker id="ny_sluttdato" value={field.value} onChange={field.onChange} />
                            )}
                          />
                        </FormField>
                      </div>
                    </div>
                  )}
                </SectionContainer>
              )}
            </>
          )}

          {/* ================================================================
              STEP 3: BEKREFT
              ================================================================ */}
          {currentStep === 3 && (
            <SectionContainer
              title="Oppsummering"
              description="Kontroller informasjonen før du utsteder endringsordren"
            >
              {/* Summary cards */}
              <div className="space-y-3 sm:space-y-4">
                {/* Basic info */}
                <div className="p-3 bg-pkt-surface-subtle border border-pkt-border-subtle rounded-none">
                  <h4 className="font-medium text-sm mb-2">Identifikasjon</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-pkt-text-body-subtle">EO-nummer:</dt>
                      <dd className="font-medium">{formValues.eo_nummer}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-pkt-text-body-subtle">Tittel:</dt>
                      <dd className="font-medium">{formValues.tittel}</dd>
                    </div>
                    <div>
                      <dt className="text-pkt-text-body-subtle">Beskrivelse:</dt>
                      <dd className="font-medium mt-1">{formValues.beskrivelse}</dd>
                    </div>
                  </dl>
                </div>

                {/* KOE cases */}
                {selectedKoeIds.length > 0 && (
                  <div className="p-3 bg-pkt-surface-subtle border border-pkt-border-subtle rounded-none">
                    <h4 className="font-medium text-sm mb-2">Relaterte KOE-saker</h4>
                    <p className="text-sm">{selectedKoeIds.length} sak(er) inkludert</p>
                    <p className="text-xs text-pkt-text-body-subtle mt-1">
                      Totalt godkjent: {formatCurrency(totalFromKOE)} / {totalDagerFromKOE} dager
                    </p>
                  </div>
                )}

                {/* Consequences - kun valgte */}
                <StatusSummary title="Konsekvenser">
                  {formValues.konsekvenser_sha && <Badge variant="warning">SHA</Badge>}
                  {formValues.konsekvenser_kvalitet && <Badge variant="warning">Kvalitet</Badge>}
                  {formValues.konsekvenser_fremdrift && <Badge variant="warning">Fremdrift</Badge>}
                  {formValues.konsekvenser_pris && <Badge variant="warning">Pris</Badge>}
                  {formValues.konsekvenser_annet && <Badge variant="warning">Annet</Badge>}
                  {!harKonsekvens && <Badge variant="default">Ingen konsekvenser</Badge>}
                </StatusSummary>

                {/* Settlement */}
                {(formValues.konsekvenser_pris || formValues.konsekvenser_fremdrift) && (
                  <div className="p-3 bg-pkt-surface-subtle border border-pkt-border-subtle rounded-none">
                    <h4 className="font-medium text-sm mb-2">Oppgjør</h4>
                    <dl className="space-y-1 text-sm">
                      {formValues.konsekvenser_pris && (
                        <>
                          <div className="flex justify-between">
                            <dt className="text-pkt-text-body-subtle">Beregningsmetode:</dt>
                            <dd className="font-medium">
                              {OPPGJORSFORM_OPTIONS.find((o) => o.value === formValues.oppgjorsform)?.label ||
                                '-'}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-pkt-text-body-subtle">Netto beløp:</dt>
                            <dd className="font-medium">
                              {formatCurrency(nettoBelop)}
                              {formValues.er_estimat && ' (estimat)'}
                            </dd>
                          </div>
                        </>
                      )}
                      {formValues.konsekvenser_fremdrift && (
                        <>
                          <div className="flex justify-between">
                            <dt className="text-pkt-text-body-subtle">Fristforlengelse:</dt>
                            <dd className="font-medium">{formValues.frist_dager || '-'} dager</dd>
                          </div>
                          {formValues.ny_sluttdato && (
                            <div className="flex justify-between">
                              <dt className="text-pkt-text-body-subtle">Ny sluttdato:</dt>
                              <dd className="font-medium">{formValues.ny_sluttdato}</dd>
                            </div>
                          )}
                        </>
                      )}
                    </dl>
                  </div>
                )}
              </div>
            </SectionContainer>
          )}

          {/* Error Message */}
          {createEOMutation.isError && (
            <Alert variant="danger" title="Feil ved opprettelse">
              {createEOMutation.error instanceof Error
                ? createEOMutation.error.message
                : 'En uventet feil oppstod'}
            </Alert>
          )}

          {/* Navigation Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-4 pt-6 border-t-2 border-pkt-border-subtle">
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    goToPrevStep();
                  }}
                  className="w-full sm:w-auto"
                >
                  ← Forrige
                </Button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={createEOMutation.isPending}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Avbryt
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={(e) => {
                    e.preventDefault();
                    goToNextStep();
                  }}
                  className="w-full sm:w-auto order-1 sm:order-2"
                >
                  Neste →
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={createEOMutation.isPending}
                  className="w-full sm:w-auto order-1 sm:order-2"
                >
                  {createEOMutation.isPending ? 'Oppretter...' : 'Utsted endringsordre'}
                </Button>
              )}
            </div>
          </div>
        </form>

        <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
      </div>
    </Modal>
  );
}
