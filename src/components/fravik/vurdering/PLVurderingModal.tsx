/**
 * PLVurderingModal Component
 *
 * Modal for Prosjektleder to submit their vurdering of a fravik-søknad.
 * Same flow as MiljoVurderingModal but with optional per-machine assessment.
 * Shows miljørådgiver's assessment as context.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
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
import { submitPLVurdering, plReturnerSoknad } from '../../../api/fravik';
import type { FravikState, MaskinTilstand } from '../../../types/fravik';
import { MASKIN_TYPE_LABELS } from '../../../types/fravik';
import { formatDateShort } from '../../../utils/formatters';

// ============================================================================
// TYPES & SCHEMA
// ============================================================================

type MaskinBeslutning = 'godkjent' | 'avslatt';

const maskinVurderingSchema = z.object({
  maskin_id: z.string(),
  beslutning: z.enum(['godkjent', 'avslatt'] as const).optional(),
  kommentar: z.string().optional(),
});

const vurderingSchema = z.object({
  maskin_vurderinger: z.array(maskinVurderingSchema),
  kommentar: z.string().optional(),
});

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
  currentBeslutning?: MaskinBeslutning;
}

function MaskinVurderingKort({
  maskin,
  index,
  control,
  register,
  currentBeslutning,
}: MaskinVurderingKortProps) {
  const miljoVurdering = maskin.miljo_vurdering;

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
        <div className="flex items-center gap-1">
          {miljoVurdering?.beslutning && (
            <Badge
              variant={miljoVurdering.beslutning === 'godkjent' ? 'success' : 'danger'}
              size="sm"
            >
              Miljø: {miljoVurdering.beslutning === 'godkjent' ? 'Godkjent' : 'Avslått'}
            </Badge>
          )}
          {currentBeslutning && (
            <Badge
              variant={currentBeslutning === 'godkjent' ? 'success' : 'danger'}
              size="sm"
            >
              {currentBeslutning === 'godkjent' ? 'Godkjent' : 'Avslått'}
            </Badge>
          )}
        </div>
      </div>

      {miljoVurdering?.kommentar && (
        <p className="mb-2 text-xs text-pkt-text-body-muted italic">
          Miljø: &ldquo;{miljoVurdering.kommentar}&rdquo;
        </p>
      )}

      <FormField label="Din vurdering (valgfri)">
        <Controller
          name={`maskin_vurderinger.${index}.beslutning`}
          control={control}
          render={({ field }) => (
            <RadioGroup value={field.value || ''} onValueChange={field.onChange}>
              <div className="flex gap-4">
                {MASKIN_BESLUTNING_OPTIONS.map((opt) => (
                  <RadioItem key={opt.value} value={opt.value} label={opt.label} />
                ))}
              </div>
            </RadioGroup>
          )}
        />
      </FormField>

      <FormField label="Kommentar" className="mt-2">
        <Textarea
          {...register(`maskin_vurderinger.${index}.kommentar`)}
          rows={2}
          fullWidth
          placeholder="Eventuelle merknader..."
        />
      </FormField>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
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
  const [modus, setModus] = useState<'vurdering' | 'send_tilbake'>('vurdering');
  const [showMaskinDetaljer, setShowMaskinDetaljer] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const maskiner = useMemo(() => Object.values(state.maskiner), [state.maskiner]);
  const miljoVurdering = state.godkjenningskjede.miljo_vurdering;

  // Beregn miljørådgivers samlet anbefaling fra per-maskin
  const miljoSamlet = useMemo(() => {
    const beslutninger = maskiner
      .map((m) => m.miljo_vurdering?.beslutning)
      .filter((b): b is MaskinBeslutning => !!b);
    if (beslutninger.length === 0) return undefined;
    const alleGodkjent = beslutninger.every((b) => b === 'godkjent');
    const alleAvslatt = beslutninger.every((b) => b === 'avslatt');
    if (alleGodkjent) return 'godkjent';
    if (alleAvslatt) return 'avslatt';
    return 'delvis_godkjent';
  }, [maskiner]);

  // Vurdering form
  const vurderingDefaultValues = useMemo((): VurderingFormData => ({
    maskin_vurderinger: maskiner.map((m) => ({
      maskin_id: m.maskin_id,
      beslutning: undefined,
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
      sendTilbakeForm.reset({ manglende_info: '' });
      setModus('vurdering');
      setShowMaskinDetaljer(false);
    }
  }, [open, vurderingForm, sendTilbakeForm, vurderingDefaultValues]);

  const isDirty = modus === 'vurdering'
    ? vurderingForm.formState.isDirty
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
    'pl_vurdering',
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
      // Filter out maskin vurderinger without beslutning
      const filtrerteMaskinVurderinger = data.maskin_vurderinger
        .filter((v): v is typeof v & { beslutning: MaskinBeslutning } => !!v.beslutning)
        .map((v) => ({
          maskin_id: v.maskin_id,
          beslutning: v.beslutning,
          kommentar: v.kommentar,
        }));

      // Beregn samlet fra PLs vurderinger, eller bruk miljøs hvis PL ikke vurderte
      const plBeslutninger = data.maskin_vurderinger.map((v) => v.beslutning).filter(Boolean);
      const samlet = plBeslutninger.length > 0
        ? beregnSamlet(data.maskin_vurderinger.map((v) => v.beslutning))
        : miljoSamlet;

      await submitPLVurdering(
        sakId,
        {
          dokumentasjon_tilstrekkelig: true,
          anbefaling: samlet || 'godkjent',
          kommentar: data.kommentar,
          maskin_vurderinger: filtrerteMaskinVurderinger,
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
      await plReturnerSoknad(sakId, data.manglende_info, aktor, currentVersion);
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
  const plBeslutninger = maskinVurderinger.map((v) => v.beslutning).filter(Boolean);
  const samletAnbefaling = plBeslutninger.length > 0
    ? beregnSamlet(maskinVurderinger.map((v) => v.beslutning))
    : miljoSamlet;

  const onSubmitVurdering = (data: VurderingFormData) => {
    vurderingMutation.mutate(data);
  };

  const onSubmitSendTilbake = (data: SendTilbakeFormData) => {
    sendTilbakeMutation.mutate(data);
  };

  const isLoading = vurderingMutation.isPending || sendTilbakeMutation.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Prosjektleder vurdering"
      description={`${state.prosjekt_navn} • ${maskiner.length} maskin${maskiner.length !== 1 ? 'er' : ''}`}
      size="lg"
    >
      {modus === 'vurdering' ? (
        <form onSubmit={vurderingForm.handleSubmit(onSubmitVurdering)} className="space-y-4">
          {/* Veiledning */}
          <Alert variant="info" title="Din rolle">
            Vurder søknaden fra prosjektets perspektiv. Din anbefaling går videre til arbeidsgruppen.
          </Alert>

          {/* Miljørådgivers vurdering som kontekst */}
          {miljoVurdering.fullfort && miljoSamlet && (
            <SectionContainer title="Miljørådgivers vurdering" variant="subtle">
              <div className="flex items-center gap-2">
                <span className="text-sm">Anbefaling:</span>
                <Badge variant={getBeslutningBadge(miljoSamlet).variant}>
                  {getBeslutningBadge(miljoSamlet).label}
                </Badge>
              </div>
              {miljoVurdering.kommentar && (
                <p className="mt-2 text-sm text-pkt-text-body-muted italic">
                  &ldquo;{miljoVurdering.kommentar}&rdquo;
                </p>
              )}
            </SectionContainer>
          )}

          {/* Toggle til send tilbake */}
          <button
            type="button"
            onClick={() => setModus('send_tilbake')}
            className="text-sm text-pkt-text-action hover:text-pkt-text-action-active hover:underline"
          >
            Mangler dokumentasjon? Send tilbake til søker →
          </button>

          {/* Per-maskin vurdering (valgfri, collapsible) */}
          <SectionContainer title="Maskinvurderinger (valgfri)">
            <button
              type="button"
              onClick={() => setShowMaskinDetaljer(!showMaskinDetaljer)}
              className="flex items-center gap-2 text-sm text-pkt-text-action hover:text-pkt-text-action-active transition-colors"
            >
              {showMaskinDetaljer ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
              {showMaskinDetaljer ? 'Skjul detaljer' : 'Vis og vurder per maskin'}
            </button>

            {showMaskinDetaljer && (
              <div className="mt-3 space-y-3">
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
                      currentBeslutning={maskinVurderinger[index]?.beslutning}
                    />
                  );
                })}
              </div>
            )}
          </SectionContainer>

          {/* Samlet anbefaling (beregnet) */}
          {samletAnbefaling && (
            <div className="p-3 bg-pkt-surface-subtle rounded border border-pkt-border-subtle">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Samlet anbefaling:</span>
                <Badge variant={getBeslutningBadge(samletAnbefaling).variant}>
                  {getBeslutningBadge(samletAnbefaling).label}
                </Badge>
                {plBeslutninger.length === 0 && (
                  <span className="text-xs text-pkt-text-body-muted">(basert på miljørådgiver)</span>
                )}
              </div>
            </div>
          )}

          {/* Kommentar */}
          <SectionContainer title="Begrunnelse">
            <FormField label="Kommentar (valgfri)">
              <Textarea
                {...vurderingForm.register('kommentar')}
                rows={3}
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
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-pkt-border-subtle">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
              Avbryt
            </Button>
            <Button
              type="submit"
              variant={samletAnbefaling === 'avslatt' ? 'danger' : 'primary'}
              loading={vurderingMutation.isPending}
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
            Søker må utfylle manglende informasjon før videre behandling.
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
