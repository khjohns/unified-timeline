/**
 * BOIVurderingModal Component (Miljørådgiver)
 *
 * Modal for miljørådgiver to submit their vurdering of a fravik-søknad.
 * Two modes:
 * 1. Dokumentasjon ikke tilstrekkelig → Return to søker with mangler
 * 2. Dokumentasjon OK → Per-maskin vurdering + samlet anbefaling
 *
 * Follows RespondGrunnlagModal patterns for form handling.
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  AlertDialog,
  Badge,
  Button,
  FormField,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  Textarea,
  useToast,
} from '../../primitives';
import { useConfirmClose } from '../../../hooks/useConfirmClose';
import { useFormBackup } from '../../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../../alerts/TokenExpiredAlert';
import { submitBOIVurdering, boiReturnerSoknad } from '../../../api/fravik';
import type { FravikState, FravikBeslutning, MaskinTilstand } from '../../../types/fravik';
import { MASKIN_TYPE_LABELS } from '../../../types/fravik';
import { formatDateShort } from '../../../utils/formatters';

// ============================================================================
// SCHEMA
// ============================================================================

const maskinVurderingSchema = z.object({
  maskin_id: z.string(),
  beslutning: z.enum(['godkjent', 'delvis_godkjent', 'avslatt', 'krever_avklaring'] as const, {
    errorMap: () => ({ message: 'Velg en beslutning' }),
  }),
  kommentar: z.string().optional(),
  vilkar: z.array(z.string()).optional(),
});

const boiVurderingSchema = z.discriminatedUnion('dokumentasjon_tilstrekkelig', [
  // Dokumentasjon IKKE tilstrekkelig - returner til søker
  z.object({
    dokumentasjon_tilstrekkelig: z.literal(false),
    manglende_dokumentasjon: z.string().min(10, 'Beskriv hva som mangler (minst 10 tegn)'),
    maskin_vurderinger: z.array(maskinVurderingSchema).optional(),
    kommentar: z.string().optional(),
  }),
  // Dokumentasjon tilstrekkelig - gi vurdering
  z.object({
    dokumentasjon_tilstrekkelig: z.literal(true),
    manglende_dokumentasjon: z.string().optional(),
    maskin_vurderinger: z.array(maskinVurderingSchema).min(1, 'Vurder alle maskiner'),
    kommentar: z.string().optional(),
  }),
]);

type BOIVurderingFormData = z.infer<typeof boiVurderingSchema>;

// ============================================================================
// HELPERS
// ============================================================================

const BESLUTNING_OPTIONS: { value: FravikBeslutning; label: string }[] = [
  { value: 'godkjent', label: 'Anbefales godkjent' },
  { value: 'delvis_godkjent', label: 'Anbefales delvis' },
  { value: 'avslatt', label: 'Anbefales avslått' },
  { value: 'krever_avklaring', label: 'Krever avklaring' },
];

function getBeslutningBadge(beslutning: FravikBeslutning): { variant: 'success' | 'warning' | 'danger' | 'info'; label: string } {
  switch (beslutning) {
    case 'godkjent':
      return { variant: 'success', label: 'Godkjent' };
    case 'delvis_godkjent':
      return { variant: 'warning', label: 'Delvis' };
    case 'avslatt':
      return { variant: 'danger', label: 'Avslått' };
    case 'krever_avklaring':
      return { variant: 'info', label: 'Avklaring' };
    default:
      return { variant: 'info', label: beslutning };
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface BOIVurderingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  state: FravikState;
  currentVersion: number;
  aktor: string;
  onSuccess?: () => void;
}

export function BOIVurderingModal({
  open,
  onOpenChange,
  sakId,
  state,
  currentVersion,
  aktor,
  onSuccess,
}: BOIVurderingModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  // Get maskiner as array
  const maskiner = useMemo(() => Object.values(state.maskiner), [state.maskiner]);

  // Default values with per-maskin entries
  const defaultValues = useMemo((): Partial<BOIVurderingFormData> => ({
    dokumentasjon_tilstrekkelig: undefined as unknown as boolean,
    manglende_dokumentasjon: '',
    maskin_vurderinger: maskiner.map((m) => ({
      maskin_id: m.maskin_id,
      beslutning: undefined as unknown as FravikBeslutning,
      kommentar: '',
      vilkar: [],
    })),
    kommentar: '',
  }), [maskiner]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
    setValue,
  } = useForm<BOIVurderingFormData>({
    resolver: zodResolver(boiVurderingSchema),
    defaultValues,
  });

  const { fields } = useFieldArray({
    control,
    name: 'maskin_vurderinger',
  });

  // Reset when opening
  useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [open, reset, defaultValues]);

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'boi_vurdering',
    formData,
    isDirty
  );

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
    if (backup) reset(backup as BOIVurderingFormData);
    setShowRestorePrompt(false);
  };
  const handleDiscardBackup = () => {
    clearBackup();
    setShowRestorePrompt(false);
  };

  // Mutation for BOI vurdering
  const vurderingMutation = useMutation({
    mutationFn: async (data: BOIVurderingFormData) => {
      if (!data.dokumentasjon_tilstrekkelig) {
        // Return to søker
        await boiReturnerSoknad(
          sakId,
          data.manglende_dokumentasjon || '',
          aktor,
          currentVersion
        );
      } else {
        // Submit vurdering
        await submitBOIVurdering(
          sakId,
          {
            dokumentasjon_tilstrekkelig: true,
            maskin_vurderinger: data.maskin_vurderinger?.map((v) => ({
              maskin_id: v.maskin_id,
              beslutning: v.beslutning,
              kommentar: v.kommentar,
              vilkar: v.vilkar,
            })) || [],
            kommentar: data.kommentar,
          },
          aktor,
          currentVersion
        );
      }
    },
    onSuccess: () => {
      clearBackup();
      reset();
      queryClient.invalidateQueries({ queryKey: ['fravik', sakId] });
      onOpenChange(false);
      toast.success(
        formData.dokumentasjon_tilstrekkelig ? 'Vurdering sendt' : 'Søknad returnert',
        formData.dokumentasjon_tilstrekkelig
          ? 'Din vurdering er registrert.'
          : 'Søknaden er returnert til søker.'
      );
      onSuccess?.();
    },
    onError: (error: Error) => {
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      } else {
        toast.error('Feil ved innsending', error.message);
      }
    },
  });

  const dokumentasjonOK = watch('dokumentasjon_tilstrekkelig');
  const maskinVurderinger = watch('maskin_vurderinger') || [];

  // Calculate samlet anbefaling from maskin vurderinger
  const samletAnbefaling = useMemo((): FravikBeslutning | undefined => {
    if (!dokumentasjonOK || maskinVurderinger.length === 0) return undefined;

    const beslutninger = maskinVurderinger
      .map((v) => v.beslutning)
      .filter((b): b is FravikBeslutning => !!b);

    if (beslutninger.length === 0) return undefined;
    if (beslutninger.every((b) => b === 'godkjent')) return 'godkjent';
    if (beslutninger.every((b) => b === 'avslatt')) return 'avslatt';
    if (beslutninger.some((b) => b === 'krever_avklaring')) return 'krever_avklaring';
    return 'delvis_godkjent';
  }, [dokumentasjonOK, maskinVurderinger]);

  const onSubmit = (data: BOIVurderingFormData) => {
    vurderingMutation.mutate(data);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Miljørådgiver vurdering"
      description="Vurder fravik-søknaden og gi din anbefaling."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Søknadsoversikt */}
        <SectionContainer title="Søknad" variant="subtle">
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">{state.prosjekt_navn}</span>
              {state.prosjekt_nummer && (
                <span className="text-pkt-text-body-muted ml-1">({state.prosjekt_nummer})</span>
              )}
            </p>
            <p className="text-pkt-text-body-muted">
              Søker: {state.soker_navn} • {maskiner.length} maskin{maskiner.length !== 1 ? 'er' : ''}
            </p>
            {state.er_haste && (
              <Badge variant="danger" size="sm">Hastebehandling</Badge>
            )}
          </div>
        </SectionContainer>

        {/* Dokumentasjon-sjekk */}
        <SectionContainer
          title="Dokumentasjon"
          description="Vurder om innsendt dokumentasjon er tilstrekkelig for å gi en anbefaling."
        >
          <FormField
            label="Er dokumentasjonen tilstrekkelig?"
            required
            error={errors.dokumentasjon_tilstrekkelig?.message}
          >
            <Controller
              name="dokumentasjon_tilstrekkelig"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value === true ? 'true' : field.value === false ? 'false' : ''}
                  onValueChange={(v) => field.onChange(v === 'true')}
                >
                  <RadioItem
                    value="true"
                    label="Ja - gi vurdering"
                    error={!!errors.dokumentasjon_tilstrekkelig}
                  />
                  <RadioItem
                    value="false"
                    label="Nei - returner til søker"
                    error={!!errors.dokumentasjon_tilstrekkelig}
                  />
                </RadioGroup>
              )}
            />
          </FormField>
        </SectionContainer>

        {/* Manglende dokumentasjon (når IKKE tilstrekkelig) */}
        {dokumentasjonOK === false && (
          <SectionContainer title="Manglende dokumentasjon">
            <Alert variant="warning" title="Søknaden returneres">
              Søknaden returneres til søker for utfylling av manglende dokumentasjon.
            </Alert>
            <FormField
              label="Beskriv hva som mangler"
              required
              error={(errors as any).manglende_dokumentasjon?.message}
              className="mt-4"
            >
              <Textarea
                {...register('manglende_dokumentasjon')}
                rows={4}
                fullWidth
                placeholder="Beskriv hvilken dokumentasjon som mangler..."
                error={!!(errors as any).manglende_dokumentasjon}
              />
            </FormField>
          </SectionContainer>
        )}

        {/* Per-maskin vurdering (når dokumentasjon OK) */}
        {dokumentasjonOK === true && maskiner.length > 0 && (
          <SectionContainer
            title="Maskinvurderinger"
            description="Gi din anbefaling for hver maskin."
          >
            <div className="space-y-4">
              {fields.map((field, index) => {
                const maskin = maskiner.find((m) => m.maskin_id === field.maskin_id);
                if (!maskin) return null;

                const fieldErrors = errors.maskin_vurderinger?.[index];
                const currentBeslutning = maskinVurderinger[index]?.beslutning;

                return (
                  <div
                    key={field.id}
                    className="p-4 rounded-lg border border-pkt-border-default bg-pkt-bg-card"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h4 className="font-medium text-sm">
                          {MASKIN_TYPE_LABELS[maskin.maskin_type] || maskin.maskin_type}
                          {maskin.annet_type && `: ${maskin.annet_type}`}
                        </h4>
                        <p className="text-xs text-pkt-text-body-muted">
                          {formatDateShort(maskin.start_dato)} – {formatDateShort(maskin.slutt_dato)}
                        </p>
                      </div>
                      {currentBeslutning && (
                        <Badge
                          variant={getBeslutningBadge(currentBeslutning).variant}
                          size="sm"
                        >
                          {getBeslutningBadge(currentBeslutning).label}
                        </Badge>
                      )}
                    </div>

                    {/* Maskin-detaljer */}
                    <div className="mb-3 text-xs text-pkt-text-body-muted space-y-1">
                      <p><strong>Begrunnelse:</strong> {maskin.begrunnelse}</p>
                      {maskin.erstatningsmaskin && (
                        <p>
                          <strong>Erstatning:</strong> {maskin.erstatningsmaskin}
                          {maskin.erstatningsdrivstoff && ` (${maskin.erstatningsdrivstoff})`}
                        </p>
                      )}
                    </div>

                    {/* Beslutning */}
                    <FormField
                      label="Din anbefaling"
                      required
                      error={fieldErrors?.beslutning?.message}
                    >
                      <Controller
                        name={`maskin_vurderinger.${index}.beslutning`}
                        control={control}
                        render={({ field: radioField }) => (
                          <RadioGroup
                            value={radioField.value || ''}
                            onValueChange={radioField.onChange}
                          >
                            {BESLUTNING_OPTIONS.map((opt) => (
                              <RadioItem
                                key={opt.value}
                                value={opt.value}
                                label={opt.label}
                                error={!!fieldErrors?.beslutning}
                              />
                            ))}
                          </RadioGroup>
                        )}
                      />
                    </FormField>

                    {/* Kommentar for denne maskinen */}
                    <FormField label="Kommentar (valgfri)" className="mt-3">
                      <Textarea
                        {...register(`maskin_vurderinger.${index}.kommentar`)}
                        rows={2}
                        fullWidth
                        placeholder="Eventuelle vilkår eller merknad..."
                      />
                    </FormField>
                  </div>
                );
              })}
            </div>

            {/* Samlet anbefaling */}
            {samletAnbefaling && (
              <div className="mt-4 p-3 bg-pkt-surface-subtle rounded border border-pkt-border-subtle">
                <p className="text-sm">
                  <strong>Samlet anbefaling:</strong>{' '}
                  <Badge variant={getBeslutningBadge(samletAnbefaling).variant}>
                    {getBeslutningBadge(samletAnbefaling).label}
                  </Badge>
                </p>
              </div>
            )}
          </SectionContainer>
        )}

        {/* Generell kommentar */}
        {dokumentasjonOK === true && (
          <SectionContainer title="Generell kommentar">
            <FormField label="Kommentar til søknaden (valgfri)">
              <Textarea
                {...register('kommentar')}
                rows={3}
                fullWidth
                placeholder="Overordnede vurderinger eller anbefalinger..."
              />
            </FormField>
          </SectionContainer>
        )}

        {/* Error */}
        {vurderingMutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {vurderingMutation.error instanceof Error
              ? vurderingMutation.error.message
              : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant={dokumentasjonOK === false ? 'secondary' : 'primary'}
            loading={vurderingMutation.isPending}
          >
            {dokumentasjonOK === false ? 'Returner søknad' : 'Send vurdering'}
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
      <AlertDialog
        open={showRestorePrompt}
        onOpenChange={(open) => { if (!open) handleDiscardBackup(); }}
        title="Gjenopprette lagrede data?"
        description="Det finnes data fra en tidligere økt. Vil du fortsette der du slapp?"
        confirmLabel="Gjenopprett"
        cancelLabel="Start på nytt"
        onConfirm={handleRestoreBackup}
        variant="info"
      />
      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
    </Modal>
  );
}
