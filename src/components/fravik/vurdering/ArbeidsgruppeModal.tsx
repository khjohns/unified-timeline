/**
 * ArbeidsgruppeModal Component
 *
 * Modal for Arbeidsgruppen to submit their vurdering of a fravik-søknad.
 * Features per-machine decisions with auto-calculated samlet innstilling.
 *
 * Fields:
 * - maskin_vurderinger[]: per-machine beslutning + vilkår
 * - samlet_innstilling: FravikBeslutning (auto-calculated)
 * - kommentar: string
 * - deltakere: string[]
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  DataList,
  DataListItem,
  FormField,
  Input,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  Textarea,
  useToast,
} from '../../primitives';
import { useFormBackup } from '../../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../../alerts/TokenExpiredAlert';
import { submitArbeidsgruppeVurdering } from '../../../api/fravik';
import type { FravikState, FravikBeslutning, MaskinTilstand } from '../../../types/fravik';
import { MASKIN_TYPE_LABELS } from '../../../types/fravik';
import { formatDateShort } from '../../../utils/formatters';

// ============================================================================
// SCHEMA
// ============================================================================

const maskinVurderingSchema = z.object({
  maskin_id: z.string(),
  beslutning: z.enum(['godkjent', 'avslatt'] as const, {
    errorMap: () => ({ message: 'Velg godkjent eller avslått' }),
  }),
  kommentar: z.string().optional(),
  vilkar: z.array(z.string()).optional(),
});

const arbeidsgruppeSchema = z.object({
  maskin_vurderinger: z.array(maskinVurderingSchema).min(1, 'Vurder alle maskiner'),
  kommentar: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  deltakere_text: z.string().optional(), // Comma-separated list for input convenience
});

// Schema for infrastructure (samlet vurdering - uten per-maskin vurdering)
const infrastrukturArbeidsgruppeSchema = z.object({
  beslutning: z.enum(['godkjent', 'avslatt'] as const, {
    errorMap: () => ({ message: 'Velg godkjent eller avslått' }),
  }),
  kommentar: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  vilkar: z.string().optional(),
  deltakere_text: z.string().optional(),
});

type ArbeidsgruppeFormData = z.infer<typeof arbeidsgruppeSchema>;
type InfrastrukturArbeidsgruppeFormData = z.infer<typeof infrastrukturArbeidsgruppeSchema>;

// ============================================================================
// HELPERS
// ============================================================================

function getBeslutningBadge(beslutning: FravikBeslutning): { variant: 'success' | 'warning' | 'danger'; label: string } {
  switch (beslutning) {
    case 'godkjent':
      return { variant: 'success', label: 'Godkjent' };
    case 'delvis_godkjent':
      return { variant: 'warning', label: 'Delvis godkjent' };
    case 'avslatt':
      return { variant: 'danger', label: 'Avslått' };
    default:
      return { variant: 'warning', label: beslutning };
  }
}

function calculateSamletInnstilling(
  vurderinger: Array<{ beslutning?: 'godkjent' | 'avslatt' }>
): FravikBeslutning | undefined {
  const beslutninger = vurderinger
    .map((v) => v.beslutning)
    .filter((b): b is 'godkjent' | 'avslatt' => !!b);

  if (beslutninger.length === 0) return undefined;
  if (beslutninger.every((b) => b === 'godkjent')) return 'godkjent';
  if (beslutninger.every((b) => b === 'avslatt')) return 'avslatt';
  return 'delvis_godkjent';
}

// ============================================================================
// COMPONENT
// ============================================================================

interface ArbeidsgruppeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  state: FravikState;
  currentVersion: number;
  aktor: string;
  onSuccess?: () => void;
}

export function ArbeidsgruppeModal({
  open,
  onOpenChange,
  sakId,
  state,
  currentVersion,
  aktor,
  onSuccess,
}: ArbeidsgruppeModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  // Get maskiner as array
  const maskiner = useMemo(() => Object.values(state.maskiner), [state.maskiner]);
  const isInfrastruktur = state.soknad_type === 'infrastructure';

  // Get previous vurderinger for context
  const miljoVurdering = state.godkjenningskjede.miljo_vurdering;
  const plVurdering = state.godkjenningskjede.pl_vurdering;

  // Default values with per-maskin entries (for machine type)
  const defaultValues = useMemo((): Partial<ArbeidsgruppeFormData> => ({
    maskin_vurderinger: maskiner.map((m) => ({
      maskin_id: m.maskin_id,
      beslutning: undefined as unknown as 'godkjent' | 'avslatt',
      kommentar: '',
      vilkar: [],
    })),
    kommentar: '',
    deltakere_text: '',
  }), [maskiner]);

  // Form for machine type
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
  } = useForm<ArbeidsgruppeFormData>({
    resolver: zodResolver(arbeidsgruppeSchema),
    defaultValues,
  });

  // Form for infrastructure type (samlet vurdering)
  const infrastrukturForm = useForm<InfrastrukturArbeidsgruppeFormData>({
    resolver: zodResolver(infrastrukturArbeidsgruppeSchema),
    defaultValues: {
      beslutning: undefined as unknown as 'godkjent' | 'avslatt',
      kommentar: '',
      vilkar: '',
      deltakere_text: '',
    },
  });

  const { fields } = useFieldArray({
    control,
    name: 'maskin_vurderinger',
  });

  // Reset when opening
  useEffect(() => {
    if (open) {
      reset(defaultValues);
      infrastrukturForm.reset({
        beslutning: undefined as unknown as 'godkjent' | 'avslatt',
        kommentar: '',
        vilkar: '',
        deltakere_text: '',
      });
    }
  }, [open, reset, infrastrukturForm, defaultValues]);

  const effectiveIsDirty = isInfrastruktur ? infrastrukturForm.formState.isDirty : isDirty;

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'arbeidsgruppe_vurdering',
    formData,
    effectiveIsDirty
  );

  // Auto-restore backup on mount (silent restoration with toast notification)
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && hasBackup && !isDirty && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;
      const backup = getBackup();
      if (backup) {
        reset(backup as ArbeidsgruppeFormData);
        toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
      }
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, isDirty, getBackup, reset, toast]);

  // Mutation
  const vurderingMutation = useMutation({
    mutationFn: async (data: ArbeidsgruppeFormData) => {
      const samletInnstilling = calculateSamletInnstilling(data.maskin_vurderinger);
      if (!samletInnstilling) throw new Error('Alle maskiner må vurderes');

      // Parse deltakere from comma-separated text
      const deltakere = data.deltakere_text
        ?.split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0) || [];

      await submitArbeidsgruppeVurdering(
        sakId,
        {
          maskin_vurderinger: data.maskin_vurderinger.map((v) => ({
            maskin_id: v.maskin_id,
            beslutning: v.beslutning,
            kommentar: v.kommentar,
            vilkar: v.vilkar,
          })),
          samlet_innstilling: samletInnstilling,
          kommentar: data.kommentar,
          deltakere,
        },
        aktor,
        currentVersion
      );
    },
    onSuccess: () => {
      clearBackup();
      reset();
      queryClient.invalidateQueries({ queryKey: ['fravik', sakId] });
      onOpenChange(false);
      toast.success('Innstilling sendt', 'Arbeidsgruppens innstilling er registrert.');
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

  const maskinVurderinger = watch('maskin_vurderinger') || [];
  const infraBeslutning = infrastrukturForm.watch('beslutning');

  // Calculate samlet innstilling from maskin vurderinger (or use infrastruktur beslutning)
  const samletInnstilling = useMemo(
    () => isInfrastruktur ? infraBeslutning : calculateSamletInnstilling(maskinVurderinger),
    [isInfrastruktur, infraBeslutning, maskinVurderinger]
  );

  const alleVurdert = isInfrastruktur
    ? !!infraBeslutning
    : maskinVurderinger.every((v) => v.beslutning);

  const onSubmit = (data: ArbeidsgruppeFormData) => {
    vurderingMutation.mutate(data);
  };

  const onSubmitInfrastruktur = (data: InfrastrukturArbeidsgruppeFormData) => {
    const deltakere = data.deltakere_text
      ?.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0) || [];

    // For infrastructure, we send the samlet innstilling directly
    vurderingMutation.mutate({
      maskin_vurderinger: [],
      kommentar: data.kommentar,
      deltakere_text: data.deltakere_text,
      // Note: Backend needs to handle infrastructure vurdering differently
    } as ArbeidsgruppeFormData);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Arbeidsgruppens vurdering"
      description="Vurder hver maskin og gi en samlet innstilling til prosjekteier."
      size="lg"
    >
      <form
        onSubmit={isInfrastruktur
          ? infrastrukturForm.handleSubmit(onSubmitInfrastruktur)
          : handleSubmit(onSubmit)
        }
        className="space-y-6"
      >
        {/* Tidligere vurderinger kontekst */}
        <SectionContainer title="Tidligere anbefalinger" variant="subtle">
          <DataList variant="grid">
            <DataListItem label="Miljørådgiver">
              {miljoVurdering.fullfort && miljoVurdering.beslutning ? (
                <Badge variant={getBeslutningBadge(miljoVurdering.beslutning).variant}>
                  {getBeslutningBadge(miljoVurdering.beslutning).label}
                </Badge>
              ) : (
                <span className="text-pkt-text-body-muted">-</span>
              )}
            </DataListItem>
            <DataListItem label="Prosjektleder">
              {plVurdering.fullfort && plVurdering.beslutning ? (
                <Badge variant={getBeslutningBadge(plVurdering.beslutning).variant}>
                  {getBeslutningBadge(plVurdering.beslutning).label}
                </Badge>
              ) : (
                <span className="text-pkt-text-body-muted">-</span>
              )}
            </DataListItem>
          </DataList>
        </SectionContainer>

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
              Søker: {state.soker_navn} •{' '}
              {isInfrastruktur ? 'Infrastruktur-søknad' : `${maskiner.length} maskin${maskiner.length !== 1 ? 'er' : ''}`}
            </p>
            {state.er_haste && (
              <Badge variant="danger" size="sm">Hastebehandling</Badge>
            )}
          </div>
        </SectionContainer>

        {/* Vurderingsveiledning */}
        <Alert variant="info" title="Arbeidsgruppens vurdering">
          Arbeidsgruppen gir en samlet innstilling til prosjekteier. Vurder om det er dokumentert at
          utslippsfri maskin <strong>ikke er mulig</strong> å skaffe, og at kontraktskravene er oppfylt
          (Euro 6/VI, palmefritt biodrivstoff). Innstillingen bør vektlegge miljørådgivers og prosjektleders anbefalinger.
        </Alert>

        {/* Per-maskin vurdering (for machine type) */}
        {!isInfrastruktur && (
        <SectionContainer
          title="Maskinvurderinger"
          description="Arbeidsgruppen vurderer hver maskin individuelt. Samlet innstilling beregnes automatisk."
        >
          <div className="space-y-4">
            {fields.map((field, index) => {
              const maskin = maskiner.find((m) => m.maskin_id === field.maskin_id);
              if (!maskin) return null;

              const fieldErrors = errors.maskin_vurderinger?.[index];
              const currentBeslutning = maskinVurderinger[index]?.beslutning;

              // Get miljø recommendation for this machine if available
              const miljoMaskinVurdering = maskin.miljo_vurdering;

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
                        variant={currentBeslutning === 'godkjent' ? 'success' : 'danger'}
                        size="sm"
                      >
                        {currentBeslutning === 'godkjent' ? 'Godkjent' : 'Avslått'}
                      </Badge>
                    )}
                  </div>

                  {/* Miljøanbefaling for denne maskinen */}
                  {miljoMaskinVurdering && (
                    <div className="mb-3 p-2 bg-pkt-surface-subtle rounded text-xs">
                      <span className="text-pkt-text-body-muted">Miljøanbefaling: </span>
                      <Badge
                        variant={getBeslutningBadge(miljoMaskinVurdering.beslutning).variant}
                        size="sm"
                      >
                        {getBeslutningBadge(miljoMaskinVurdering.beslutning).label}
                      </Badge>
                      {miljoMaskinVurdering.kommentar && (
                        <p className="mt-1 text-pkt-text-body-muted italic">
                          &ldquo;{miljoMaskinVurdering.kommentar}&rdquo;
                        </p>
                      )}
                    </div>
                  )}

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
                    label="Beslutning"
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
                          <RadioItem
                            value="godkjent"
                            label="Godkjent"
                            error={!!fieldErrors?.beslutning}
                          />
                          <RadioItem
                            value="avslatt"
                            label="Avslått"
                            error={!!fieldErrors?.beslutning}
                          />
                        </RadioGroup>
                      )}
                    />
                  </FormField>

                  {/* Vilkår/kommentar */}
                  <FormField label="Vilkår eller kommentar (valgfri)" className="mt-3">
                    <Textarea
                      {...register(`maskin_vurderinger.${index}.kommentar`)}
                      rows={2}
                      fullWidth
                      placeholder="F.eks. 'Godkjent under forutsetning av at HVO100 benyttes'"
                    />
                  </FormField>
                </div>
              );
            })}
          </div>

          {/* Samlet innstilling */}
          {samletInnstilling && (
            <div className="mt-4 p-3 bg-pkt-surface-subtle rounded border border-pkt-border-subtle">
              <p className="text-sm">
                <strong>Samlet innstilling:</strong>{' '}
                <Badge variant={getBeslutningBadge(samletInnstilling).variant}>
                  {getBeslutningBadge(samletInnstilling).label}
                </Badge>
              </p>
              <p className="text-xs text-pkt-text-body-muted mt-1">
                Beregnet automatisk fra maskinbeslutninger
              </p>
            </div>
          )}
        </SectionContainer>
        )}

        {/* Samlet vurdering (for infrastructure type) */}
        {isInfrastruktur && (
          <SectionContainer
            title="Vurdering av infrastruktur-søknad"
            description="Arbeidsgruppen gir en samlet vurdering av søknaden."
          >
            <div className="p-4 rounded-lg border border-pkt-border-default bg-pkt-bg-card space-y-4">
              {state.infrastruktur && (
                <div className="mb-3 text-sm space-y-2">
                  <p className="text-pkt-text-body-muted">
                    <strong>Effektbehov:</strong> {state.infrastruktur.effektbehov_kw} kW
                  </p>
                  <p className="text-pkt-text-body-muted">
                    <strong>Erstatningsløsning:</strong> {state.infrastruktur.aggregat_type}
                    {state.infrastruktur.aggregat_modell && ` (${state.infrastruktur.aggregat_modell})`}
                  </p>
                  <p className="text-pkt-text-body-muted">
                    <strong>Merkostnad:</strong>{' '}
                    {state.infrastruktur.kostnad_fossil_nok > 0
                      ? `${(((state.infrastruktur.kostnad_utslippsfri_nok - state.infrastruktur.kostnad_fossil_nok) / state.infrastruktur.kostnad_fossil_nok) * 100).toFixed(1)}%`
                      : 'Ikke beregnet'}
                  </p>
                </div>
              )}

              <FormField
                label="Beslutning"
                required
                error={infrastrukturForm.formState.errors.beslutning?.message}
              >
                <Controller
                  name="beslutning"
                  control={infrastrukturForm.control}
                  render={({ field }) => (
                    <RadioGroup value={field.value || ''} onValueChange={field.onChange}>
                      <RadioItem
                        value="godkjent"
                        label="Godkjent"
                        error={!!infrastrukturForm.formState.errors.beslutning}
                      />
                      <RadioItem
                        value="avslatt"
                        label="Avslått"
                        error={!!infrastrukturForm.formState.errors.beslutning}
                      />
                    </RadioGroup>
                  )}
                />
              </FormField>

              <FormField label="Vilkår" optional>
                <Textarea
                  {...infrastrukturForm.register('vilkar')}
                  rows={2}
                  fullWidth
                  placeholder="Eventuelle vilkår for godkjenning..."
                />
              </FormField>
            </div>

            {/* Samlet innstilling for infrastructure */}
            {samletInnstilling && (
              <div className="mt-4 p-3 bg-pkt-surface-subtle rounded border border-pkt-border-subtle">
                <p className="text-sm">
                  <strong>Samlet innstilling:</strong>{' '}
                  <Badge variant={getBeslutningBadge(samletInnstilling).variant}>
                    {getBeslutningBadge(samletInnstilling).label}
                  </Badge>
                </p>
              </div>
            )}
          </SectionContainer>
        )}

        {/* Deltakere */}
        <SectionContainer title="Deltakere">
          <FormField
            label="Hvem deltok i vurderingen?"
            helpText="Skriv navn separert med komma"
          >
            <Input
              {...(isInfrastruktur ? infrastrukturForm.register('deltakere_text') : register('deltakere_text'))}
              placeholder="Ola Nordmann, Kari Hansen, Per Olsen"
              fullWidth
            />
          </FormField>
        </SectionContainer>

        {/* Begrunnelse */}
        <SectionContainer title="Begrunnelse">
          <FormField
            label="Arbeidsgruppens begrunnelse"
            required
            error={isInfrastruktur ? infrastrukturForm.formState.errors.kommentar?.message : errors.kommentar?.message}
          >
            <Textarea
              {...(isInfrastruktur ? infrastrukturForm.register('kommentar') : register('kommentar'))}
              rows={5}
              fullWidth
              placeholder="Begrunn arbeidsgruppens innstilling..."
              error={isInfrastruktur ? !!infrastrukturForm.formState.errors.kommentar : !!errors.kommentar}
            />
          </FormField>
        </SectionContainer>

        {/* Error */}
        {vurderingMutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {vurderingMutation.error instanceof Error
              ? vurderingMutation.error.message
              : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-6 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant={samletInnstilling === 'avslatt' ? 'danger' : 'primary'}
            loading={vurderingMutation.isPending}
            disabled={!alleVurdert}
          >
            Send innstilling
          </Button>
        </div>
      </form>

      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
    </Modal>
  );
}
