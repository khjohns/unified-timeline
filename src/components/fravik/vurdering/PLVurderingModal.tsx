/**
 * PLVurderingModal Component
 *
 * Modal for Prosjektleder to submit their vurdering of a fravik-søknad.
 * Simpler than BOI - no per-machine assessment, just overall anbefaling.
 *
 * Fields:
 * - dokumentasjon_tilstrekkelig: boolean
 * - anbefaling: FravikBeslutning
 * - kommentar: string
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  AlertDialog,
  Badge,
  Button,
  DataList,
  DataListItem,
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
import { submitPLVurdering } from '../../../api/fravik';
import type { FravikState, FravikBeslutning } from '../../../types/fravik';
import { MASKIN_TYPE_LABELS } from '../../../types/fravik';

// ============================================================================
// SCHEMA
// ============================================================================

const plVurderingSchema = z.object({
  dokumentasjon_tilstrekkelig: z.boolean({
    required_error: 'Velg om dokumentasjonen er tilstrekkelig',
  }),
  anbefaling: z.enum(['godkjent', 'delvis_godkjent', 'avslatt'] as const, {
    errorMap: () => ({ message: 'Velg en anbefaling' }),
  }),
  kommentar: z.string().optional(),
  manglende_dokumentasjon: z.string().optional(),
}).refine(
  (data) => data.dokumentasjon_tilstrekkelig || (data.manglende_dokumentasjon && data.manglende_dokumentasjon.length >= 10),
  {
    message: 'Beskriv hva som mangler (minst 10 tegn)',
    path: ['manglende_dokumentasjon'],
  }
);

type PLVurderingFormData = z.infer<typeof plVurderingSchema>;

// ============================================================================
// HELPERS
// ============================================================================

const ANBEFALING_OPTIONS: { value: FravikBeslutning; label: string; description: string }[] = [
  { value: 'godkjent', label: 'Anbefaler godkjenning', description: 'Fraviket anbefales godkjent' },
  { value: 'delvis_godkjent', label: 'Anbefaler delvis', description: 'Fraviket anbefales delvis godkjent med vilkår' },
  { value: 'avslatt', label: 'Anbefaler avslag', description: 'Fraviket anbefales avslått' },
];

type PLBeslutning = 'godkjent' | 'delvis_godkjent' | 'avslatt';

function getAnbefalingBadge(anbefaling: FravikBeslutning | PLBeslutning): { variant: 'success' | 'warning' | 'danger'; label: string } {
  switch (anbefaling) {
    case 'godkjent':
      return { variant: 'success', label: 'Godkjent' };
    case 'delvis_godkjent':
      return { variant: 'warning', label: 'Delvis' };
    case 'avslatt':
      return { variant: 'danger', label: 'Avslått' };
    default:
      return { variant: 'warning', label: anbefaling };
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface PLVurderingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  state: FravikState;
  currentVersion: number;
  aktor: string;
  onSuccess?: () => void;
}

export function PLVurderingModal({
  open,
  onOpenChange,
  sakId,
  state,
  currentVersion,
  aktor,
  onSuccess,
}: PLVurderingModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  // Get maskiner as array
  const maskiner = useMemo(() => Object.values(state.maskiner), [state.maskiner]);

  // Get BOI vurdering for context
  const boiVurdering = state.godkjenningskjede.boi_vurdering;

  const defaultValues: Partial<PLVurderingFormData> = {
    dokumentasjon_tilstrekkelig: undefined as unknown as boolean,
    anbefaling: undefined as unknown as PLBeslutning,
    kommentar: '',
    manglende_dokumentasjon: '',
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
  } = useForm<PLVurderingFormData>({
    resolver: zodResolver(plVurderingSchema),
    defaultValues,
  });

  // Reset when opening
  useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [open, reset]);

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'pl_vurdering',
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
    if (backup) reset(backup as PLVurderingFormData);
    setShowRestorePrompt(false);
  };
  const handleDiscardBackup = () => {
    clearBackup();
    setShowRestorePrompt(false);
  };

  // Mutation
  const vurderingMutation = useMutation({
    mutationFn: async (data: PLVurderingFormData) => {
      await submitPLVurdering(
        sakId,
        {
          dokumentasjon_tilstrekkelig: data.dokumentasjon_tilstrekkelig,
          anbefaling: data.anbefaling,
          kommentar: data.kommentar,
          manglende_dokumentasjon: data.manglende_dokumentasjon,
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
      toast.success('Vurdering sendt', 'Din vurdering er registrert.');
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
  const valgtAnbefaling = watch('anbefaling');

  const onSubmit = (data: PLVurderingFormData) => {
    vurderingMutation.mutate(data);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Prosjektleder vurdering"
      description="Vurder fravik-søknaden og gi din anbefaling til arbeidsgruppen."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Miljørådgiver-vurdering kontekst */}
        {boiVurdering.fullfort && (
          <SectionContainer title="Miljørådgivers vurdering" variant="subtle">
            <DataList variant="list">
              <DataListItem label="Anbefaling">
                {boiVurdering.beslutning ? (
                  <Badge variant={getAnbefalingBadge(boiVurdering.beslutning).variant}>
                    {getAnbefalingBadge(boiVurdering.beslutning).label}
                  </Badge>
                ) : (
                  '-'
                )}
              </DataListItem>
              {boiVurdering.vurdert_av && (
                <DataListItem label="Vurdert av">{boiVurdering.vurdert_av}</DataListItem>
              )}
            </DataList>
            {boiVurdering.kommentar && (
              <p className="mt-2 text-sm text-pkt-text-body-muted italic">
                &ldquo;{boiVurdering.kommentar}&rdquo;
              </p>
            )}
          </SectionContainer>
        )}

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

        {/* Dokumentasjons-sjekk */}
        <SectionContainer
          title="Dokumentasjon"
          description="Bekreft at dokumentasjonen er tilstrekkelig for din vurdering."
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
                    label="Ja"
                    error={!!errors.dokumentasjon_tilstrekkelig}
                  />
                  <RadioItem
                    value="false"
                    label="Nei - mangler informasjon"
                    error={!!errors.dokumentasjon_tilstrekkelig}
                  />
                </RadioGroup>
              )}
            />
          </FormField>

          {dokumentasjonOK === false && (
            <FormField
              label="Beskriv hva som mangler"
              required
              error={errors.manglende_dokumentasjon?.message}
              className="mt-4"
            >
              <Textarea
                {...register('manglende_dokumentasjon')}
                rows={3}
                fullWidth
                placeholder="Beskriv hvilken informasjon som mangler..."
                error={!!errors.manglende_dokumentasjon}
              />
            </FormField>
          )}
        </SectionContainer>

        {/* Anbefaling */}
        <SectionContainer
          title="Din anbefaling"
          description="Gi din anbefaling til arbeidsgruppen."
        >
          <FormField
            label="Anbefaling"
            required
            error={errors.anbefaling?.message}
          >
            <Controller
              name="anbefaling"
              control={control}
              render={({ field }) => (
                <RadioGroup value={field.value || ''} onValueChange={field.onChange}>
                  {ANBEFALING_OPTIONS.map((opt) => (
                    <RadioItem
                      key={opt.value}
                      value={opt.value}
                      label={opt.label}
                      error={!!errors.anbefaling}
                    />
                  ))}
                </RadioGroup>
              )}
            />
          </FormField>

          {valgtAnbefaling && (
            <div className="mt-3 p-3 bg-pkt-surface-subtle rounded border-l-4 border-pkt-border-focus">
              <p className="text-sm text-pkt-text-body-muted">
                {ANBEFALING_OPTIONS.find((o) => o.value === valgtAnbefaling)?.description}
              </p>
            </div>
          )}
        </SectionContainer>

        {/* Kommentar */}
        <SectionContainer title="Begrunnelse">
          <FormField label="Kommentar (valgfri)">
            <Textarea
              {...register('kommentar')}
              rows={4}
              fullWidth
              placeholder="Begrunn din anbefaling..."
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
            variant={valgtAnbefaling === 'avslatt' ? 'danger' : 'primary'}
            loading={vurderingMutation.isPending}
          >
            Send vurdering
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
