/**
 * InfrastrukturModal Component
 *
 * Modal for editing infrastructure data in an infrastructure-type fravik søknad.
 * Used when soknad_type='infrastructure' (as opposed to 'machine').
 *
 * Uses React Hook Form + Zod for validation.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  AlertDialog,
  AttachmentUpload,
  Button,
  Checkbox,
  DateRangePicker,
  FormField,
  Input,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from '../primitives';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useFormBackup } from '../../hooks/useFormBackup';
import { useFravikSubmit } from '../../hooks/useFravikSubmit';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import {
  infrastrukturSchema,
  type InfrastrukturFormData,
  STROMTILGANG_STATUS_OPTIONS,
  PROSJEKTFORHOLD_OPTIONS,
  AGGREGAT_TYPE_OPTIONS,
  EUROKLASSE_OPTIONS,
  DRIVSTOFF_OPTIONS,
} from './schemas';
import type { InfrastrukturTilstand, InfrastrukturData } from '../../types/fravik';

interface InfrastrukturModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  currentVersion?: number;
  initialData?: InfrastrukturTilstand;
  onSuccess?: () => void;
}

export function InfrastrukturModal({
  open,
  onOpenChange,
  sakId,
  currentVersion,
  initialData,
  onSuccess,
}: InfrastrukturModalProps) {
  const toast = useToast();
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const isEditMode = !!initialData;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    control,
    watch,
    setValue,
  } = useForm<InfrastrukturFormData>({
    resolver: zodResolver(infrastrukturSchema),
    defaultValues: {
      start_dato: initialData?.start_dato || '',
      slutt_dato: initialData?.slutt_dato || '',
      stromtilgang_status: initialData?.stromtilgang_status || undefined,
      avstand_til_tilkobling_meter: initialData?.avstand_til_tilkobling_meter || undefined,
      tilgjengelig_effekt_kw: initialData?.tilgjengelig_effekt_kw || undefined,
      effektbehov_kw: initialData?.effektbehov_kw || undefined,
      stromtilgang_tilleggsbeskrivelse: initialData?.stromtilgang_tilleggsbeskrivelse || '',
      mobil_batteri_vurdert: initialData?.mobil_batteri_vurdert || false,
      midlertidig_nett_vurdert: initialData?.midlertidig_nett_vurdert || false,
      redusert_effekt_vurdert: initialData?.redusert_effekt_vurdert || false,
      faseinndeling_vurdert: initialData?.faseinndeling_vurdert || false,
      alternative_metoder: initialData?.alternative_metoder || '',
      prosjektforhold: initialData?.prosjektforhold || [],
      prosjektforhold_beskrivelse: initialData?.prosjektforhold_beskrivelse || '',
      kostnad_utslippsfri_nok: initialData?.kostnad_utslippsfri_nok || undefined,
      kostnad_fossil_nok: initialData?.kostnad_fossil_nok || undefined,
      prosjektkostnad_nok: initialData?.prosjektkostnad_nok || undefined,
      kostnad_tilleggsbeskrivelse: initialData?.kostnad_tilleggsbeskrivelse || '',
      aggregat_type: initialData?.aggregat_type || undefined,
      aggregat_type_annet: initialData?.aggregat_type_annet || '',
      euroklasse: initialData?.euroklasse || undefined,
      erstatningsdrivstoff: initialData?.erstatningsdrivstoff || undefined,
      aggregat_modell: initialData?.aggregat_modell || '',
      attachments: [],
    },
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (open && initialData) {
      reset({
        start_dato: initialData.start_dato || '',
        slutt_dato: initialData.slutt_dato || '',
        stromtilgang_status: initialData.stromtilgang_status || undefined,
        avstand_til_tilkobling_meter: initialData.avstand_til_tilkobling_meter || undefined,
        tilgjengelig_effekt_kw: initialData.tilgjengelig_effekt_kw || undefined,
        effektbehov_kw: initialData.effektbehov_kw || undefined,
        stromtilgang_tilleggsbeskrivelse: initialData.stromtilgang_tilleggsbeskrivelse || '',
        mobil_batteri_vurdert: initialData.mobil_batteri_vurdert || false,
        midlertidig_nett_vurdert: initialData.midlertidig_nett_vurdert || false,
        redusert_effekt_vurdert: initialData.redusert_effekt_vurdert || false,
        faseinndeling_vurdert: initialData.faseinndeling_vurdert || false,
        alternative_metoder: initialData.alternative_metoder || '',
        prosjektforhold: initialData.prosjektforhold || [],
        prosjektforhold_beskrivelse: initialData.prosjektforhold_beskrivelse || '',
        kostnad_utslippsfri_nok: initialData.kostnad_utslippsfri_nok || undefined,
        kostnad_fossil_nok: initialData.kostnad_fossil_nok || undefined,
        prosjektkostnad_nok: initialData.prosjektkostnad_nok || undefined,
        kostnad_tilleggsbeskrivelse: initialData.kostnad_tilleggsbeskrivelse || '',
        aggregat_type: initialData.aggregat_type || undefined,
        aggregat_type_annet: initialData.aggregat_type_annet || '',
        euroklasse: initialData.euroklasse || undefined,
        erstatningsdrivstoff: initialData.erstatningsdrivstoff || undefined,
        aggregat_modell: initialData.aggregat_modell || '',
        attachments: [],
      });
    }
  }, [open, initialData, reset]);

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  // Form backup for token expiry protection
  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'infrastruktur',
    formData,
    isDirty
  );

  // Check for backup on mount
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
    }
    setShowRestorePrompt(false);
  };

  const handleDiscardBackup = () => {
    clearBackup();
    setShowRestorePrompt(false);
  };

  const mutation = useFravikSubmit({
    onSuccess: (result) => {
      clearBackup();
      reset();
      onOpenChange(false);
      const successMessage = isEditMode
        ? 'Infrastruktur-data er oppdatert.'
        : 'Infrastruktur-data er lagt til.';
      toast.success(isEditMode ? 'Oppdatert' : 'Lagt til', successMessage);
      onSuccess?.();
    },
    onError: (error) => {
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      } else {
        toast.error('Feil ved lagring', error.message);
      }
    },
  });

  const onSubmit = (data: InfrastrukturFormData) => {
    // Build InfrastrukturData payload
    const infrastrukturPayload: InfrastrukturData = {
      start_dato: data.start_dato,
      slutt_dato: data.slutt_dato,
      stromtilgang_status: data.stromtilgang_status,
      avstand_til_tilkobling_meter: data.avstand_til_tilkobling_meter || undefined,
      tilgjengelig_effekt_kw: data.tilgjengelig_effekt_kw || undefined,
      effektbehov_kw: data.effektbehov_kw,
      stromtilgang_tilleggsbeskrivelse: data.stromtilgang_tilleggsbeskrivelse || undefined,
      mobil_batteri_vurdert: data.mobil_batteri_vurdert,
      midlertidig_nett_vurdert: data.midlertidig_nett_vurdert,
      redusert_effekt_vurdert: data.redusert_effekt_vurdert,
      faseinndeling_vurdert: data.faseinndeling_vurdert,
      alternative_metoder: data.alternative_metoder || undefined,
      prosjektforhold: data.prosjektforhold,
      prosjektforhold_beskrivelse: data.prosjektforhold_beskrivelse || undefined,
      kostnad_utslippsfri_nok: data.kostnad_utslippsfri_nok,
      kostnad_fossil_nok: data.kostnad_fossil_nok,
      prosjektkostnad_nok: data.prosjektkostnad_nok || undefined,
      kostnad_tilleggsbeskrivelse: data.kostnad_tilleggsbeskrivelse || undefined,
      aggregat_type: data.aggregat_type,
      aggregat_type_annet: data.aggregat_type === 'annet' ? data.aggregat_type_annet : undefined,
      euroklasse: data.euroklasse,
      erstatningsdrivstoff: data.erstatningsdrivstoff,
      aggregat_modell: data.aggregat_modell || undefined,
    };

    mutation.mutate({
      type: isEditMode ? 'infrastruktur_oppdatert' : 'infrastruktur_lagt_til',
      sakId,
      data: infrastrukturPayload,
      aktor: 'bruker', // TODO: Get from auth context
      expectedVersion: currentVersion,
    });
  };

  // Watch for conditional fields
  const startDato = watch('start_dato');
  const sluttDato = watch('slutt_dato');
  const aggregatType = watch('aggregat_type');
  const kostnadUtslippsfri = watch('kostnad_utslippsfri_nok');
  const kostnadFossil = watch('kostnad_fossil_nok');
  const prosjektkostnad = watch('prosjektkostnad_nok');

  // Calculate merkostnad percentage
  const merkostnadProsent = useMemo(() => {
    if (!kostnadUtslippsfri || !kostnadFossil || kostnadFossil === 0) return null;
    return ((kostnadUtslippsfri - kostnadFossil) / kostnadFossil) * 100;
  }, [kostnadUtslippsfri, kostnadFossil]);

  const merkostnadAvProsjekt = useMemo(() => {
    if (!kostnadUtslippsfri || !kostnadFossil || !prosjektkostnad || prosjektkostnad === 0) return null;
    const merkostnad = kostnadUtslippsfri - kostnadFossil;
    return (merkostnad / prosjektkostnad) * 100;
  }, [kostnadUtslippsfri, kostnadFossil, prosjektkostnad]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditMode ? 'Rediger infrastruktur-data' : 'Legg til infrastruktur-data'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Info alert */}
        <Alert variant="info" title="Krav til fravik">
          Fravik innvilges kun dersom det <strong>ikke er mulig</strong> å etablere utslippsfri strømforsyning.
          Ved innvilget fravik kreves minimum Euro 6/VI og dokumentert biodrivstoff (ikke palmeoljebasert).
        </Alert>

        {/* Periode */}
        <SectionContainer
          title="Bruksperiode"
          description="Angi perioden fraviket gjelder for"
        >
          <FormField
            label="Periode"
            required
            error={errors.start_dato?.message || errors.slutt_dato?.message}
          >
            <DateRangePicker
              value={{ from: startDato, to: sluttDato }}
              onChange={(range) => {
                setValue('start_dato', range.from || '', { shouldValidate: true });
                setValue('slutt_dato', range.to || '', { shouldValidate: true });
              }}
              error={!!(errors.start_dato || errors.slutt_dato)}
            />
          </FormField>
        </SectionContainer>

        {/* Strømtilgang */}
        <SectionContainer
          title="Strømtilgang på byggeplassen"
          description="Beskriv situasjonen for strømtilgang"
        >
          <div className="space-y-4">
            <FormField
              label="Status for strømtilgang"
              required
              error={errors.stromtilgang_status?.message}
            >
              <Controller
                name="stromtilgang_status"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    error={!!errors.stromtilgang_status}
                  >
                    {STROMTILGANG_STATUS_OPTIONS.map((option) => (
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                label="Avstand til tilkobling"
                error={errors.avstand_til_tilkobling_meter?.message}
                helpText="Meter"
              >
                <Input
                  id="avstand_til_tilkobling_meter"
                  type="number"
                  min={0}
                  {...register('avstand_til_tilkobling_meter', { valueAsNumber: true })}
                  error={!!errors.avstand_til_tilkobling_meter}
                />
              </FormField>

              <FormField
                label="Tilgjengelig effekt"
                error={errors.tilgjengelig_effekt_kw?.message}
                helpText="kW"
              >
                <Input
                  id="tilgjengelig_effekt_kw"
                  type="number"
                  min={0}
                  step={0.1}
                  {...register('tilgjengelig_effekt_kw', { valueAsNumber: true })}
                  error={!!errors.tilgjengelig_effekt_kw}
                />
              </FormField>

              <FormField
                label="Effektbehov"
                required
                error={errors.effektbehov_kw?.message}
                helpText="kW"
              >
                <Input
                  id="effektbehov_kw"
                  type="number"
                  min={0}
                  step={0.1}
                  {...register('effektbehov_kw', { valueAsNumber: true })}
                  error={!!errors.effektbehov_kw}
                />
              </FormField>
            </div>

            <FormField
              label="Tilleggsbeskrivelse"
              error={errors.stromtilgang_tilleggsbeskrivelse?.message}
              helpText="Valgfri utdypning av strømtilgangssituasjonen"
            >
              <Textarea
                id="stromtilgang_tilleggsbeskrivelse"
                {...register('stromtilgang_tilleggsbeskrivelse')}
                rows={2}
                fullWidth
                error={!!errors.stromtilgang_tilleggsbeskrivelse}
              />
            </FormField>
          </div>
        </SectionContainer>

        {/* Vurderte alternativer */}
        <SectionContainer
          title="Vurderte alternativer"
          description="Hvilke alternative løsninger er vurdert?"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Controller
                name="mobil_batteri_vurdert"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="mobil_batteri_vurdert"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label="Mobile batteriløsninger er vurdert"
                  />
                )}
              />

              <Controller
                name="midlertidig_nett_vurdert"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="midlertidig_nett_vurdert"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label="Midlertidig nett (transformatorstasjon) er vurdert"
                  />
                )}
              />

              <Controller
                name="redusert_effekt_vurdert"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="redusert_effekt_vurdert"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label="Redusert effektbehov er vurdert"
                  />
                )}
              />

              <Controller
                name="faseinndeling_vurdert"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="faseinndeling_vurdert"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label="Faseinndeling av arbeid er vurdert"
                  />
                )}
              />
            </div>

            <FormField
              label="Andre alternative løsninger"
              error={errors.alternative_metoder?.message}
              helpText="F.eks. endret arbeidsmetode, bruk av mindre maskiner"
            >
              <Textarea
                id="alternative_metoder"
                {...register('alternative_metoder')}
                rows={2}
                fullWidth
                error={!!errors.alternative_metoder}
              />
            </FormField>
          </div>
        </SectionContainer>

        {/* Prosjektspesifikke forhold */}
        <SectionContainer
          title="Prosjektspesifikke forhold"
          description="Forhold som påvirker muligheten for utslippsfri drift"
        >
          <div className="space-y-4">
            <FormField
              label="Velg relevante forhold"
              error={errors.prosjektforhold?.message}
            >
              <div className="space-y-2">
                {PROSJEKTFORHOLD_OPTIONS.map((option) => (
                  <Controller
                    key={option.value}
                    name="prosjektforhold"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id={`prosjektforhold_${option.value}`}
                        label={option.label}
                        checked={field.value?.includes(option.value) ?? false}
                        onCheckedChange={(checked) => {
                          const currentValues = field.value ?? [];
                          if (checked) {
                            field.onChange([...currentValues, option.value]);
                          } else {
                            field.onChange(currentValues.filter((v) => v !== option.value));
                          }
                        }}
                      />
                    )}
                  />
                ))}
              </div>
            </FormField>

            <FormField
              label="Tilleggsbeskrivelse"
              error={errors.prosjektforhold_beskrivelse?.message}
              helpText="Utdyp de valgte forholdene"
            >
              <Textarea
                id="prosjektforhold_beskrivelse"
                {...register('prosjektforhold_beskrivelse')}
                rows={2}
                fullWidth
                error={!!errors.prosjektforhold_beskrivelse}
              />
            </FormField>
          </div>
        </SectionContainer>

        {/* Kostnadsvurdering */}
        <SectionContainer
          title="Kostnadsvurdering"
          description="Sammenlign kostnader for utslippsfri og fossil løsning"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Kostnad utslippsfri løsning"
                required
                error={errors.kostnad_utslippsfri_nok?.message}
                helpText="NOK"
              >
                <Input
                  id="kostnad_utslippsfri_nok"
                  type="number"
                  min={0}
                  {...register('kostnad_utslippsfri_nok', { valueAsNumber: true })}
                  error={!!errors.kostnad_utslippsfri_nok}
                />
              </FormField>

              <FormField
                label="Kostnad fossil løsning"
                required
                error={errors.kostnad_fossil_nok?.message}
                helpText="NOK"
              >
                <Input
                  id="kostnad_fossil_nok"
                  type="number"
                  min={0}
                  {...register('kostnad_fossil_nok', { valueAsNumber: true })}
                  error={!!errors.kostnad_fossil_nok}
                />
              </FormField>
            </div>

            <FormField
              label="Total prosjektkostnad"
              error={errors.prosjektkostnad_nok?.message}
              helpText="NOK (valgfritt, for beregning av merkostnad i %)"
            >
              <Input
                id="prosjektkostnad_nok"
                type="number"
                min={0}
                {...register('prosjektkostnad_nok', { valueAsNumber: true })}
                error={!!errors.prosjektkostnad_nok}
              />
            </FormField>

            {/* Calculated merkostnad display */}
            {merkostnadProsent !== null && (
              <div className="p-3 bg-pkt-bg-subtle rounded space-y-1">
                <p className="text-sm text-pkt-text-muted">
                  Merkostnad utslippsfri vs. fossil:{' '}
                  <strong className={merkostnadProsent > 10 ? 'text-pkt-status-warning' : 'text-pkt-text-default'}>
                    {merkostnadProsent.toFixed(1)}%
                  </strong>
                </p>
                {merkostnadAvProsjekt !== null && (
                  <p className="text-sm text-pkt-text-muted">
                    Merkostnad av prosjektkostnad:{' '}
                    <strong className={merkostnadAvProsjekt > 10 ? 'text-pkt-status-warning' : 'text-pkt-text-default'}>
                      {merkostnadAvProsjekt.toFixed(1)}%
                    </strong>
                    {merkostnadAvProsjekt > 10 && ' (over 10%-grensen)'}
                  </p>
                )}
              </div>
            )}

            <FormField
              label="Tilleggsbeskrivelse"
              error={errors.kostnad_tilleggsbeskrivelse?.message}
              helpText="Utdyp kostnadsvurderingen ved behov"
            >
              <Textarea
                id="kostnad_tilleggsbeskrivelse"
                {...register('kostnad_tilleggsbeskrivelse')}
                rows={2}
                fullWidth
                error={!!errors.kostnad_tilleggsbeskrivelse}
              />
            </FormField>
          </div>
        </SectionContainer>

        {/* Erstatningsløsning */}
        <SectionContainer
          title="Erstatningsløsning"
          description="Hvilken løsning skal brukes i stedet for utslippsfri drift?"
        >
          <div className="space-y-4">
            <FormField
              label="Type aggregat"
              required
              error={errors.aggregat_type?.message}
            >
              <Controller
                name="aggregat_type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger error={!!errors.aggregat_type}>
                      <SelectValue placeholder="Velg type aggregat" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGGREGAT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            {aggregatType === 'annet' && (
              <div className="ml-6 pl-4 border-l-2 border-pkt-border-subtle">
                <FormField
                  label="Spesifiser type"
                  required
                  error={errors.aggregat_type_annet?.message}
                >
                  <Input
                    id="aggregat_type_annet"
                    {...register('aggregat_type_annet')}
                    placeholder="Beskriv type erstatningsløsning"
                    error={!!errors.aggregat_type_annet}
                  />
                </FormField>
              </div>
            )}

            <FormField
              label="Euroklasse"
              required
              error={errors.euroklasse?.message}
            >
              <Controller
                name="euroklasse"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    error={!!errors.euroklasse}
                  >
                    {EUROKLASSE_OPTIONS.map((option) => (
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

            <FormField
              label="Drivstoff"
              required
              error={errors.erstatningsdrivstoff?.message}
              helpText="Palmeoljebasert biodrivstoff er ikke tillatt. Må dokumenteres og være ut over omsetningskravet."
            >
              <Controller
                name="erstatningsdrivstoff"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    error={!!errors.erstatningsdrivstoff}
                  >
                    {DRIVSTOFF_OPTIONS.map((option) => (
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

            <FormField
              label="Produsent og modell"
              error={errors.aggregat_modell?.message}
              helpText="Valgfritt - oppgi hvis kjent"
            >
              <Input
                id="aggregat_modell"
                {...register('aggregat_modell')}
                error={!!errors.aggregat_modell}
              />
            </FormField>
          </div>
        </SectionContainer>

        {/* Vedlegg */}
        <SectionContainer
          title="Vedlegg"
          description="Last opp relevant dokumentasjon (valgfritt)"
        >
          <Controller
            name="attachments"
            control={control}
            render={({ field }) => (
              <AttachmentUpload
                value={field.value || []}
                onChange={field.onChange}
                accept={{
                  'application/pdf': ['.pdf'],
                  'application/msword': ['.doc'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                  'application/vnd.ms-excel': ['.xls'],
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                  'image/*': ['.jpg', '.jpeg', '.png'],
                }}
                maxSize={10 * 1024 * 1024}
                multiple
              />
            )}
          />
        </SectionContainer>

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved lagring">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-4 pt-6 border-t border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting || mutation.isPending}
            className="w-full sm:w-auto order-1 sm:order-2"
          >
            {isEditMode ? 'Lagre endringer' : 'Legg til'}
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
        onOpenChange={(openState) => {
          if (!openState) handleDiscardBackup();
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
