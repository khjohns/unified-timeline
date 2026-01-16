/**
 * MiljoVurderingModal Component
 *
 * Modal for miljørådgiver to submit their vurdering of a fravik-søknad.
 * Simplified flow:
 * - Per-maskin: Godkjent / Avslått (med vilkår i kommentar)
 * - Samlet anbefaling beregnes automatisk
 * - "Send tilbake" som toggle-tilstand
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
import { submitMiljoVurdering, miljoReturnerSoknad } from '../../../api/fravik';
import type { FravikState, MaskinTilstand } from '../../../types/fravik';
import { MASKIN_TYPE_LABELS } from '../../../types/fravik';
import { formatDateShort } from '../../../utils/formatters';

// ============================================================================
// TYPES & SCHEMA
// ============================================================================

type MaskinBeslutning = 'godkjent' | 'avslatt';

const maskinVurderingSchema = z.object({
  maskin_id: z.string(),
  beslutning: z.enum(['godkjent', 'avslatt'] as const, {
    errorMap: () => ({ message: 'Velg vurdering' }),
  }),
  kommentar: z.string().optional(),
});

const vurderingSchema = z.object({
  maskin_vurderinger: z.array(maskinVurderingSchema),
  kommentar: z.string().optional(),
});

// Schema for infrastructure (samlet vurdering)
const infrastrukturVurderingSchema = z.object({
  beslutning: z.enum(['godkjent', 'avslatt'] as const, {
    errorMap: () => ({ message: 'Velg vurdering' }),
  }),
  kommentar: z.string().optional(),
  vilkar: z.string().optional(),
});

type InfrastrukturVurderingFormData = z.infer<typeof infrastrukturVurderingSchema>;

const sendTilbakeSchema = z.object({
  manglende_info: z.string().min(10, 'Beskriv hva som mangler (minst 10 tegn)'),
});

type VurderingFormData = z.infer<typeof vurderingSchema>;
type SendTilbakeFormData = z.infer<typeof sendTilbakeSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

const MASKIN_BESLUTNING_OPTIONS: { value: MaskinBeslutning; label: string }[] = [
  { value: 'godkjent', label: 'Godkjent' },
  { value: 'avslatt', label: 'Avslått' },
];

// ============================================================================
// HELPERS
// ============================================================================

function getBeslutningBadge(beslutning: string): { variant: 'success' | 'warning' | 'danger'; label: string } {
  switch (beslutning) {
    case 'godkjent':
      return { variant: 'success', label: 'Anbefaler godkjenning' };
    case 'delvis_godkjent':
      return { variant: 'warning', label: 'Anbefaler delvis' };
    case 'avslatt':
      return { variant: 'danger', label: 'Anbefaler avslag' };
    default:
      return { variant: 'warning', label: beslutning };
  }
}

function beregnSamlet(beslutninger: (MaskinBeslutning | undefined)[]): 'godkjent' | 'delvis_godkjent' | 'avslatt' | undefined {
  const validBeslutninger = beslutninger.filter((b): b is MaskinBeslutning => !!b);
  if (validBeslutninger.length === 0) return undefined;

  const alleGodkjent = validBeslutninger.every((b) => b === 'godkjent');
  const alleAvslatt = validBeslutninger.every((b) => b === 'avslatt');

  if (alleGodkjent) return 'godkjent';
  if (alleAvslatt) return 'avslatt';
  return 'delvis_godkjent';
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface MaskinVurderingKortProps {
  maskin: MaskinTilstand;
  index: number;
  control: any;
  register: any;
  errors: any;
  currentBeslutning?: MaskinBeslutning;
}

function MaskinVurderingKort({
  maskin,
  index,
  control,
  register,
  errors,
  currentBeslutning,
}: MaskinVurderingKortProps) {
  const fieldErrors = errors.maskin_vurderinger?.[index];

  return (
    <div className="p-3 rounded-lg border border-pkt-border-default bg-pkt-bg-card">
      <div className="flex items-start justify-between gap-2 mb-2">
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

      <p className="mb-3 text-xs text-pkt-text-body-muted line-clamp-2">
        {maskin.begrunnelse}
      </p>

      <FormField
        label="Vurdering"
        required
        error={fieldErrors?.beslutning?.message}
      >
        <Controller
          name={`maskin_vurderinger.${index}.beslutning`}
          control={control}
          render={({ field }) => (
            <RadioGroup value={field.value || ''} onValueChange={field.onChange}>
              <div className="flex gap-4">
                {MASKIN_BESLUTNING_OPTIONS.map((opt) => (
                  <RadioItem
                    key={opt.value}
                    value={opt.value}
                    label={opt.label}
                    error={!!fieldErrors?.beslutning}
                  />
                ))}
              </div>
            </RadioGroup>
          )}
        />
      </FormField>

      <FormField label="Vilkår/kommentar" className="mt-2">
        <Textarea
          {...register(`maskin_vurderinger.${index}.kommentar`)}
          rows={2}
          fullWidth
          placeholder="Eventuelle vilkår..."
        />
      </FormField>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface MiljoVurderingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  state: FravikState;
  currentVersion: number;
  aktor: string;
  onSuccess?: () => void;
}

export function MiljoVurderingModal({
  open,
  onOpenChange,
  sakId,
  state,
  currentVersion,
  aktor,
  onSuccess,
}: MiljoVurderingModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [modus, setModus] = useState<'vurdering' | 'send_tilbake'>('vurdering');
  const toast = useToast();
  const queryClient = useQueryClient();

  const maskiner = useMemo(() => Object.values(state.maskiner), [state.maskiner]);
  const isInfrastruktur = state.soknad_type === 'infrastructure';

  // Infrastructure vurdering form
  const infrastrukturForm = useForm<InfrastrukturVurderingFormData>({
    resolver: zodResolver(infrastrukturVurderingSchema),
    defaultValues: {
      beslutning: undefined as unknown as 'godkjent' | 'avslatt',
      kommentar: '',
      vilkar: '',
    },
  });

  // Vurdering form
  const vurderingDefaultValues = useMemo((): VurderingFormData => ({
    maskin_vurderinger: maskiner.map((m) => ({
      maskin_id: m.maskin_id,
      beslutning: undefined as unknown as MaskinBeslutning,
      kommentar: '',
    })),
    kommentar: '',
  }), [maskiner]);

  const vurderingForm = useForm<VurderingFormData>({
    resolver: zodResolver(vurderingSchema),
    defaultValues: vurderingDefaultValues,
  });

  const { fields } = useFieldArray({
    control: vurderingForm.control,
    name: 'maskin_vurderinger',
  });

  // Send tilbake form
  const sendTilbakeForm = useForm<SendTilbakeFormData>({
    resolver: zodResolver(sendTilbakeSchema),
    defaultValues: { manglende_info: '' },
  });

  // Reset when opening
  useEffect(() => {
    if (open) {
      vurderingForm.reset(vurderingDefaultValues);
      infrastrukturForm.reset({ beslutning: undefined as unknown as 'godkjent' | 'avslatt', kommentar: '', vilkar: '' });
      sendTilbakeForm.reset({ manglende_info: '' });
      setModus('vurdering');
    }
  }, [open, vurderingForm, infrastrukturForm, sendTilbakeForm, vurderingDefaultValues]);

  const isDirty = modus === 'vurdering'
    ? (isInfrastruktur ? infrastrukturForm.formState.isDirty : vurderingForm.formState.isDirty)
    : sendTilbakeForm.formState.isDirty;

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: () => {
      vurderingForm.reset();
      sendTilbakeForm.reset();
    },
    onClose: () => onOpenChange(false),
  });

  // Form backup
  const vurderingData = vurderingForm.watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'miljo_vurdering',
    vurderingData,
    vurderingForm.formState.isDirty
  );

  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && hasBackup && !vurderingForm.formState.isDirty && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;
      setShowRestorePrompt(true);
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, vurderingForm.formState.isDirty]);

  const handleRestoreBackup = () => {
    const backup = getBackup();
    if (backup) vurderingForm.reset(backup as VurderingFormData);
    setShowRestorePrompt(false);
  };

  const handleDiscardBackup = () => {
    clearBackup();
    setShowRestorePrompt(false);
  };

  // Mutations
  const vurderingMutation = useMutation({
    mutationFn: async (data: VurderingFormData) => {
      await submitMiljoVurdering(
        sakId,
        {
          dokumentasjon_tilstrekkelig: true,
          maskin_vurderinger: data.maskin_vurderinger.map((v) => ({
            maskin_id: v.maskin_id,
            beslutning: v.beslutning,
            kommentar: v.kommentar,
          })),
          kommentar: data.kommentar,
        },
        aktor,
        currentVersion
      );
    },
    onSuccess: () => {
      clearBackup();
      vurderingForm.reset();
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

  const sendTilbakeMutation = useMutation({
    mutationFn: async (data: SendTilbakeFormData) => {
      await miljoReturnerSoknad(sakId, data.manglende_info, aktor, currentVersion);
    },
    onSuccess: () => {
      clearBackup();
      sendTilbakeForm.reset();
      queryClient.invalidateQueries({ queryKey: ['fravik', sakId] });
      onOpenChange(false);
      toast.success('Søknad returnert', 'Søknaden er returnert til søker.');
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

  // Beregn samlet anbefaling
  const maskinVurderinger = vurderingForm.watch('maskin_vurderinger') || [];
  const infraBeslutning = infrastrukturForm.watch('beslutning');

  const samletAnbefaling = isInfrastruktur
    ? infraBeslutning
    : beregnSamlet(maskinVurderinger.map((v) => v.beslutning));

  const alleVurdert = isInfrastruktur
    ? !!infraBeslutning
    : maskinVurderinger.every((v) => v.beslutning);

  const onSubmitVurdering = (data: VurderingFormData) => {
    vurderingMutation.mutate(data);
  };

  const onSubmitInfrastrukturVurdering = (data: InfrastrukturVurderingFormData) => {
    // For infrastructure, we send a simplified payload with samlet vurdering
    vurderingMutation.mutate({
      maskin_vurderinger: [], // No per-machine vurdering for infrastructure
      kommentar: data.kommentar,
      // The samlet_anbefaling will be set on backend based on beslutning
    } as VurderingFormData);
  };

  const onSubmitSendTilbake = (data: SendTilbakeFormData) => {
    sendTilbakeMutation.mutate(data);
  };

  const isLoading = vurderingMutation.isPending || sendTilbakeMutation.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Miljørådgiver vurdering"
      description={`${state.prosjekt_navn} • ${isInfrastruktur ? 'Infrastruktur-søknad' : `${maskiner.length} maskin${maskiner.length !== 1 ? 'er' : ''}`}`}
      size="lg"
    >
      {modus === 'vurdering' ? (
        <form
          onSubmit={isInfrastruktur
            ? infrastrukturForm.handleSubmit(onSubmitInfrastrukturVurdering)
            : vurderingForm.handleSubmit(onSubmitVurdering)
          }
          className="space-y-4"
        >
          {/* Veiledning */}
          <Alert variant="info" title="Din rolle">
            Vurder søknaden fra et miljøperspektiv. Din anbefaling går videre til prosjektleder.
          </Alert>

          {/* Kontraktskrav sjekkliste */}
          <SectionContainer title="Kontraktskrav å vurdere" variant="subtle">
            <ul className="text-sm space-y-1 list-disc pl-4 text-pkt-text-body-muted">
              <li>Er det dokumentert at utslippsfri maskin <strong>ikke er mulig</strong> å skaffe?</li>
              <li>Erstatningsmaskin har <strong>minimum Euro 6/VI</strong></li>
              <li>Biodrivstoff er <strong>dokumentert palmefritt</strong> og ut over omsetningskrav</li>
              <li>Fravik skyldes <strong>ikke forhold kjent ved tilbudsinnlevering</strong></li>
            </ul>
          </SectionContainer>

          {/* Toggle til send tilbake */}
          <button
            type="button"
            onClick={() => setModus('send_tilbake')}
            className="text-sm text-pkt-text-action hover:text-pkt-text-action-active hover:underline"
          >
            Mangler dokumentasjon? Send tilbake til søker →
          </button>

          {/* Per-maskin vurdering (for machine type) */}
          {!isInfrastruktur && (
            <SectionContainer
              title="Maskinvurderinger"
              description="Vurder hver maskin."
            >
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const maskin = maskiner.find((m) => m.maskin_id === field.maskin_id);
                  if (!maskin) return null;

                  return (
                    <MaskinVurderingKort
                      key={field.id}
                      maskin={maskin}
                      index={index}
                      control={vurderingForm.control}
                      register={vurderingForm.register}
                      errors={vurderingForm.formState.errors}
                      currentBeslutning={maskinVurderinger[index]?.beslutning}
                    />
                  );
                })}
              </div>
            </SectionContainer>
          )}

          {/* Samlet vurdering (for infrastructure type) */}
          {isInfrastruktur && (
            <SectionContainer
              title="Vurdering av infrastruktur-søknad"
              description="Vurder søknaden samlet."
            >
              <div className="p-3 rounded-lg border border-pkt-border-default bg-pkt-bg-card space-y-4">
                {state.infrastruktur && (
                  <div className="mb-3">
                    <p className="text-sm text-pkt-text-body-muted">
                      <strong>Strømtilgang:</strong> {state.infrastruktur.stromtilgang_beskrivelse}
                    </p>
                    <p className="text-sm text-pkt-text-body-muted mt-1">
                      <strong>Erstatningsløsning:</strong> {state.infrastruktur.erstatningslosning}
                    </p>
                  </div>
                )}

                <FormField
                  label="Vurdering"
                  required
                  error={infrastrukturForm.formState.errors.beslutning?.message}
                >
                  <Controller
                    name="beslutning"
                    control={infrastrukturForm.control}
                    render={({ field }) => (
                      <RadioGroup value={field.value || ''} onValueChange={field.onChange}>
                        <div className="flex gap-4">
                          {MASKIN_BESLUTNING_OPTIONS.map((opt) => (
                            <RadioItem
                              key={opt.value}
                              value={opt.value}
                              label={opt.label}
                              error={!!infrastrukturForm.formState.errors.beslutning}
                            />
                          ))}
                        </div>
                      </RadioGroup>
                    )}
                  />
                </FormField>

                <FormField label="Vilkår/kommentar">
                  <Textarea
                    {...infrastrukturForm.register('vilkar')}
                    rows={3}
                    fullWidth
                    placeholder="Eventuelle vilkår for godkjenning..."
                  />
                </FormField>
              </div>
            </SectionContainer>
          )}

          {/* Samlet anbefaling (beregnet) */}
          {samletAnbefaling && alleVurdert && (
            <div className="p-3 bg-pkt-surface-subtle rounded border border-pkt-border-subtle">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Samlet anbefaling:</span>
                <Badge variant={getBeslutningBadge(samletAnbefaling).variant}>
                  {getBeslutningBadge(samletAnbefaling).label}
                </Badge>
              </div>
            </div>
          )}

          {/* Kommentar */}
          <SectionContainer title="Kommentar">
            <FormField label="Overordnet kommentar (valgfri)">
              <Textarea
                {...vurderingForm.register('kommentar')}
                rows={3}
                fullWidth
                placeholder="Eventuelle overordnede vurderinger..."
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
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-pkt-border-subtle">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
              Avbryt
            </Button>
            <Button
              type="submit"
              variant={samletAnbefaling === 'avslatt' ? 'danger' : 'primary'}
              loading={vurderingMutation.isPending}
              disabled={!alleVurdert}
            >
              Send vurdering
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={sendTilbakeForm.handleSubmit(onSubmitSendTilbake)} className="space-y-4">
          {/* Toggle tilbake til vurdering */}
          <button
            type="button"
            onClick={() => setModus('vurdering')}
            className="text-sm text-pkt-text-action hover:text-pkt-text-action-active hover:underline"
          >
            ← Tilbake til vurdering
          </button>

          {/* Warning */}
          <Alert variant="warning" title="Søknaden returneres">
            Søker må utfylle manglende informasjon før du kan vurdere søknaden.
          </Alert>

          {/* Hva mangler */}
          <SectionContainer title="Hva mangler?">
            <FormField
              label="Beskriv manglende informasjon"
              required
              error={sendTilbakeForm.formState.errors.manglende_info?.message}
            >
              <Textarea
                {...sendTilbakeForm.register('manglende_info')}
                rows={4}
                fullWidth
                placeholder="Beskriv tydelig hva som må rettes opp..."
                error={!!sendTilbakeForm.formState.errors.manglende_info}
              />
            </FormField>
          </SectionContainer>

          {/* Error */}
          {sendTilbakeMutation.isError && (
            <Alert variant="danger" title="Feil ved innsending">
              {sendTilbakeMutation.error instanceof Error
                ? sendTilbakeMutation.error.message
                : 'En feil oppstod'}
            </Alert>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-pkt-border-subtle">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
              Avbryt
            </Button>
            <Button type="submit" variant="secondary" loading={sendTilbakeMutation.isPending}>
              Returner søknad
            </Button>
          </div>
        </form>
      )}

      {/* Dialogs */}
      <AlertDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Forkast endringer?"
        description="Du har ulagrede endringer som vil gå tapt."
        confirmLabel="Forkast"
        cancelLabel="Fortsett"
        onConfirm={confirmClose}
        variant="warning"
      />
      <AlertDialog
        open={showRestorePrompt}
        onOpenChange={(o) => { if (!o) handleDiscardBackup(); }}
        title="Gjenopprette lagrede data?"
        description="Det finnes data fra en tidligere økt."
        confirmLabel="Gjenopprett"
        cancelLabel="Start på nytt"
        onConfirm={handleRestoreBackup}
        variant="info"
      />
      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
    </Modal>
  );
}
