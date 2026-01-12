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
import { STALE_TIME } from '../../constants/queryConfig';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Primitives
import {
  Alert,
  AlertDialog,
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
} from '../primitives';

// Hooks
import { useConfirmClose } from '../../hooks/useConfirmClose';

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
    description: 'Oppgjør etter medgått tid og materialer. Timerater indeksreguleres.',
  },
  {
    value: 'FASTPRIS_TILBUD',
    label: 'Fastpris / Tilbud',
    paragraf: '§34.2.1',
    indeksregulering: 'ingen',
    description: 'Entreprenørens tilbud. Ikke gjenstand for indeksregulering.',
  },
];

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const utstEndringsordreSchema = z.object({
  // Step 1: Basic info
  eo_nummer: z.string().min(1, 'EO-nummer er påkrevd'),
  beskrivelse: z.string().min(1, 'Beskrivelse er påkrevd'),

  // Step 2: KOE selection (managed separately due to array)
  // selectedKoeIds is handled via useState

  // Step 3: Konsekvenser
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
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  // KOE selection state (managed separately from form due to array handling)
  const [selectedKoeIds, setSelectedKoeIds] = useState<string[]>(preselectedKoeIds);

  // Scroll to top of modal content
  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Step configuration for StepIndicator
  const steps = [
    { label: 'Info' },
    { label: 'KOE-saker' },
    { label: 'Konsekvenser' },
    { label: 'Oppgjør' },
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

  // Confirm close hook
  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty: isDirty || selectedKoeIds.length !== preselectedKoeIds.length,
    onReset: () => {
      reset();
      setSelectedKoeIds(preselectedKoeIds);
      setCurrentStep(1);
    },
    onClose: () => onOpenChange(false),
  });

  // Form backup (note: selectedKoeIds is managed separately and won't be backed up)
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'endringsordre_opprett', formValues, isDirty);

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
  const handleRestoreBackup = () => { const backup = getBackup(); if (backup) reset(backup); setShowRestorePrompt(false); };
  const handleDiscardBackup = () => { clearBackup(); setShowRestorePrompt(false); };

  // Token validation hook
  const verifyToken = useVerifyToken();

  // Fetch candidate KOE cases
  const { data: kandidaterData, isLoading: kandidaterLoading } = useQuery({
    queryKey: ['endringsordre', 'kandidater'],
    queryFn: fetchKandidatKOESaker,
    enabled: open,
    staleTime: STALE_TIME.DEFAULT,
  });

  const kandidatSaker = kandidaterData?.kandidat_saker ?? [];

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
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      queryClient.invalidateQueries({ queryKey: ['timeline', sakId] });
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

  // Auto-sett konsekvenser basert på KOE-valg
  useEffect(() => {
    if (totalFromKOE > 0 && !formValues.konsekvenser_pris) {
      setValue('konsekvenser_pris', true);
    }
    if (totalDagerFromKOE > 0 && !formValues.konsekvenser_fremdrift) {
      setValue('konsekvenser_fremdrift', true);
    }
  }, [totalFromKOE, totalDagerFromKOE, formValues.konsekvenser_pris, formValues.konsekvenser_fremdrift, setValue]);

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
      isValid = await trigger(['eo_nummer', 'beskrivelse']);
    } else if (currentStep === 3) {
      isValid = await trigger([
        'konsekvenser_sha',
        'konsekvenser_kvalitet',
        'konsekvenser_fremdrift',
        'konsekvenser_pris',
        'konsekvenser_annet',
        'konsekvens_beskrivelse',
      ]);
    } else if (currentStep === 4) {
      // Validate oppgjørsform if pris consequence
      if (formValues.konsekvenser_pris) {
        isValid = await trigger(['oppgjorsform', 'kompensasjon_belop', 'fradrag_belop']);
        if (!formValues.oppgjorsform) {
          isValid = false;
        }
      }
      if (formValues.konsekvenser_fremdrift) {
        isValid = isValid && (await trigger(['frist_dager']));
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
        <StepIndicator currentStep={currentStep} steps={steps} />

        <form
          onSubmit={handleSubmit(onSubmit)}
          onKeyDown={(e) => {
            // Prevent Enter from submitting form while navigating through wizard steps
            if (e.key === 'Enter' && currentStep < totalSteps) {
              e.preventDefault();
            }
          }}
          className="space-y-6"
        >
          {/* ================================================================
              STEP 1: BASIC INFO
              ================================================================ */}
          {currentStep === 1 && (
            <SectionContainer title="Grunnleggende informasjon">
              <FormField
                label="EO-nummer"
                required
                error={errors.eo_nummer?.message}
              >
                <Input
                  {...register('eo_nummer')}
                  placeholder="EO-001"
                  error={!!errors.eo_nummer}
                  width="md"
                />
              </FormField>

              <FormField
                label="Beskrivelse av endringen"
                required
                error={errors.beskrivelse?.message}
              >
                <Textarea
                  {...register('beskrivelse')}
                  rows={4}
                  fullWidth
                  error={!!errors.beskrivelse}
                />
              </FormField>
            </SectionContainer>
          )}

          {/* ================================================================
              STEP 2: SELECT KOE CASES
              ================================================================ */}
          {currentStep === 2 && (
            <SectionContainer
              title="Velg KOE-saker"
              description="Velg KOE-saker som skal inkluderes, eller fortsett uten for proaktiv EO."
            >
              {kandidaterLoading ? (
                <p className="text-pkt-text-body-subtle text-sm">Laster kandidatsaker...</p>
              ) : kandidatSaker.length === 0 ? (
                <p className="text-pkt-text-body-subtle text-sm">
                  Ingen KOE-saker er klare for endringsordre.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-pkt-border-subtle">
                  <table className="w-full text-sm">
                    <thead className="bg-pkt-surface-subtle sticky top-0">
                      <tr className="border-b border-pkt-border-subtle">
                        <th className="w-10 py-2 px-2"></th>
                        <th className="text-left py-2 px-2 font-medium">Sak</th>
                        <th className="text-right py-2 px-2 font-medium w-28">Vederlag</th>
                        <th className="text-right py-2 px-2 font-medium w-20">Dager</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kandidatSaker.map((koe) => {
                        const isSelected = selectedKoeIds.includes(koe.sak_id);
                        return (
                          <tr
                            key={koe.sak_id}
                            onClick={() => toggleKoeSelection(koe.sak_id)}
                            className={`border-b border-pkt-border-subtle cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-pkt-surface-light-beige'
                                : 'hover:bg-pkt-surface-subtle'
                            }`}
                          >
                            <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleKoeSelection(koe.sak_id)}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <p className="font-medium">{koe.tittel}</p>
                              <p className="text-xs text-pkt-text-body-subtle">
                                {koe.overordnet_status}
                              </p>
                            </td>
                            <td className="text-right py-2 px-2 font-mono text-pkt-brand-dark-green-1000">
                              {koe.sum_godkjent !== undefined
                                ? formatCurrency(koe.sum_godkjent)
                                : '-'}
                            </td>
                            <td className="text-right py-2 px-2 font-mono">
                              {koe.godkjent_dager ?? '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {selectedKoeIds.length > 0 && (
                      <tfoot className="border-t-2 border-pkt-border-default bg-pkt-surface-subtle">
                        <tr>
                          <td className="py-2 px-2"></td>
                          <td className="py-2 px-2 font-bold">
                            Totalt ({selectedKoeIds.length} valgt)
                          </td>
                          <td className="text-right py-2 px-2 font-mono font-bold text-pkt-brand-dark-green-1000">
                            {formatCurrency(totalFromKOE)}
                          </td>
                          <td className="text-right py-2 px-2 font-mono font-bold">
                            {totalDagerFromKOE}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </SectionContainer>
          )}

          {/* ================================================================
              STEP 3: CONSEQUENCES
              ================================================================ */}
          {currentStep === 3 && (
            <SectionContainer
              title="Konsekvenser"
              description="Kryss av for konsekvenser endringen medfører."
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
          )}

          {/* ================================================================
              STEP 4: SETTLEMENT
              ================================================================ */}
          {currentStep === 4 && (
            <SectionContainer title="Oppgjør">
              {/* Priskonsekvens */}
              {formValues.konsekvenser_pris && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Vederlagsjustering</h4>

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

                  {/* Beløp */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Kompensasjon (tillegg)">
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

                  {/* Netto */}
                  <div className="p-3 bg-pkt-surface-subtle border border-pkt-border-subtle rounded-none">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Netto beløp:</span>
                      <span className={`font-bold text-base ${nettoBelop < 0 ? 'text-alert-danger-text' : ''}`}>
                        {formatCurrency(nettoBelop)}
                      </span>
                    </div>
                  </div>

                  {/* Estimat checkbox */}
                  <Controller
                    name="er_estimat"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="er_estimat"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label="Beløpet er et estimat"
                        description="Endelig beløp fastsettes ved sluttoppgjør"
                      />
                    )}
                  />
                </div>
              )}

              {/* Fristforlengelse */}
              {formValues.konsekvenser_fremdrift && (
                <div className="space-y-4 pt-4 border-t-2 border-pkt-border-subtle">
                  <h4 className="font-medium text-sm">Fristforlengelse</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Antall dager">
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

              {/* Info when no pris or fremdrift */}
              {!formValues.konsekvenser_pris && !formValues.konsekvenser_fremdrift && (
                <Alert variant="info" title="Ingen oppgjørsinfo nødvendig">
                  Endringsordren har ingen pris- eller fremdriftskonsekvens.
                </Alert>
              )}
            </SectionContainer>
          )}

          {/* ================================================================
              STEP 5: REVIEW
              ================================================================ */}
          {currentStep === 5 && (
            <SectionContainer
              title="Oppsummering"
              description="Kontroller informasjonen før du utsteder endringsordren."
            >
              {/* Summary cards */}
              <div className="space-y-4">
                {/* Basic info */}
                <div className="p-3 bg-pkt-surface-subtle border border-pkt-border-subtle rounded-none">
                  <h4 className="font-medium text-sm mb-2">Grunnleggende info</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-pkt-text-body-subtle">EO-nummer:</dt>
                      <dd className="font-medium">{formValues.eo_nummer}</dd>
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

                {/* Consequences */}
                <StatusSummary title="Konsekvenser">
                  {!formValues.konsekvenser_sha && <Badge variant="success">Ingen SHA</Badge>}
                  {formValues.konsekvenser_sha && <Badge variant="warning">SHA</Badge>}
                  {!formValues.konsekvenser_kvalitet && <Badge variant="success">Ingen kvalitet</Badge>}
                  {formValues.konsekvenser_kvalitet && <Badge variant="warning">Kvalitet</Badge>}
                  {!formValues.konsekvenser_fremdrift && <Badge variant="success">Ingen fremdrift</Badge>}
                  {formValues.konsekvenser_fremdrift && <Badge variant="warning">Fremdrift</Badge>}
                  {!formValues.konsekvenser_pris && <Badge variant="success">Ingen pris</Badge>}
                  {formValues.konsekvenser_pris && <Badge variant="warning">Pris</Badge>}
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
                onClick={handleClose}
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
        <AlertDialog
          open={showRestorePrompt}
          onOpenChange={(open) => { if (!open) handleDiscardBackup(); }}
          title="Gjenopprette lagrede data?"
          description="Det finnes data fra en tidligere økt som ikke ble sendt inn. Vil du fortsette der du slapp?"
          confirmLabel="Gjenopprett"
          cancelLabel="Start på nytt"
          onConfirm={handleRestoreBackup}
          variant="info"
        />
        <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
      </div>
    </Modal>
  );
}
