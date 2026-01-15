/**
 * EierBeslutningModal Component
 *
 * Modal for Prosjekteier to submit their final beslutning on a fravik-søknad.
 * This is the final step in the approval chain.
 *
 * Fields:
 * - folger_arbeidsgruppen: boolean
 * - beslutning: FravikBeslutning (auto-set if følger arbeidsgruppen)
 * - begrunnelse: string (required if ikke følger arbeidsgruppen)
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
import { submitEierBeslutning } from '../../../api/fravik';
import type { FravikState, FravikBeslutning } from '../../../types/fravik';

// ============================================================================
// SCHEMA
// ============================================================================

const eierBeslutningSchema = z.discriminatedUnion('folger_arbeidsgruppen', [
  // Følger arbeidsgruppen - beslutning auto-set
  z.object({
    folger_arbeidsgruppen: z.literal(true),
    beslutning: z.enum(['godkjent', 'delvis_godkjent', 'avslatt'] as const).optional(),
    begrunnelse: z.string().optional(),
  }),
  // Ikke følger arbeidsgruppen - må velge beslutning og begrunne
  z.object({
    folger_arbeidsgruppen: z.literal(false),
    beslutning: z.enum(['godkjent', 'delvis_godkjent', 'avslatt'] as const, {
      errorMap: () => ({ message: 'Velg din beslutning' }),
    }),
    begrunnelse: z.string().min(10, 'Begrunnelse er påkrevd ved avvik fra arbeidsgruppen (minst 10 tegn)'),
  }),
]);

type EierBeslutningFormData = z.infer<typeof eierBeslutningSchema>;

// ============================================================================
// HELPERS
// ============================================================================

type EierBeslutningType = 'godkjent' | 'delvis_godkjent' | 'avslatt';

function getBeslutningBadge(beslutning: FravikBeslutning | EierBeslutningType): { variant: 'success' | 'warning' | 'danger'; label: string } {
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

const BESLUTNING_OPTIONS: { value: EierBeslutningType; label: string }[] = [
  { value: 'godkjent', label: 'Godkjent' },
  { value: 'delvis_godkjent', label: 'Delvis godkjent' },
  { value: 'avslatt', label: 'Avslått' },
];

// ============================================================================
// COMPONENT
// ============================================================================

interface EierBeslutningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  state: FravikState;
  currentVersion: number;
  aktor: string;
  onSuccess?: () => void;
}

export function EierBeslutningModal({
  open,
  onOpenChange,
  sakId,
  state,
  currentVersion,
  aktor,
  onSuccess,
}: EierBeslutningModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  // Get arbeidsgruppens innstilling
  const arbeidsgruppeVurdering = state.godkjenningskjede.arbeidsgruppe_vurdering;
  const arbeidsgruppeInnstilling = arbeidsgruppeVurdering.beslutning;

  // Get previous vurderinger for context
  const boiVurdering = state.godkjenningskjede.boi_vurdering;
  const plVurdering = state.godkjenningskjede.pl_vurdering;

  const defaultValues: Partial<EierBeslutningFormData> = {
    folger_arbeidsgruppen: undefined as unknown as boolean,
    beslutning: undefined as unknown as EierBeslutningType,
    begrunnelse: '',
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
    setValue,
  } = useForm<EierBeslutningFormData>({
    resolver: zodResolver(eierBeslutningSchema),
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
    'eier_beslutning',
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
    if (backup) reset(backup as EierBeslutningFormData);
    setShowRestorePrompt(false);
  };
  const handleDiscardBackup = () => {
    clearBackup();
    setShowRestorePrompt(false);
  };

  // Mutation
  const beslutningMutation = useMutation({
    mutationFn: async (data: EierBeslutningFormData) => {
      // Determine final beslutning
      const finalBeslutning = data.folger_arbeidsgruppen
        ? arbeidsgruppeInnstilling!
        : data.beslutning!;

      await submitEierBeslutning(
        sakId,
        {
          folger_arbeidsgruppen: data.folger_arbeidsgruppen,
          beslutning: finalBeslutning,
          begrunnelse: data.begrunnelse,
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
      toast.success('Beslutning fattet', 'Din beslutning er registrert. Søknaden er nå ferdigbehandlet.');
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

  const folgerArbeidsgruppen = watch('folger_arbeidsgruppen');
  const valgtBeslutning = watch('beslutning');

  // Calculate final beslutning for preview
  const finalBeslutning = useMemo((): FravikBeslutning | undefined => {
    if (folgerArbeidsgruppen === true && arbeidsgruppeInnstilling) {
      return arbeidsgruppeInnstilling;
    }
    if (folgerArbeidsgruppen === false && valgtBeslutning) {
      return valgtBeslutning;
    }
    return undefined;
  }, [folgerArbeidsgruppen, arbeidsgruppeInnstilling, valgtBeslutning]);

  const onSubmit = (data: EierBeslutningFormData) => {
    beslutningMutation.mutate(data);
  };

  // Check if arbeidsgruppen has given their innstilling
  if (!arbeidsgruppeInnstilling) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Prosjekteiers beslutning"
        size="md"
      >
        <Alert variant="warning" title="Venter på arbeidsgruppen">
          Arbeidsgruppen må gi sin innstilling før prosjekteier kan fatte beslutning.
        </Alert>
        <div className="flex justify-end mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Lukk
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Prosjekteiers beslutning"
      description="Fatt endelig beslutning på fravik-søknaden."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Oppsummering av vurderinger */}
        <SectionContainer title="Oppsummering av anbefalinger" variant="subtle">
          <DataList variant="grid">
            <DataListItem label="BOI-rådgiver">
              {boiVurdering.fullfort && boiVurdering.beslutning ? (
                <Badge variant={getBeslutningBadge(boiVurdering.beslutning).variant}>
                  {getBeslutningBadge(boiVurdering.beslutning).label}
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
            <DataListItem label="Arbeidsgruppe">
              <Badge variant={getBeslutningBadge(arbeidsgruppeInnstilling).variant}>
                {getBeslutningBadge(arbeidsgruppeInnstilling).label}
              </Badge>
            </DataListItem>
          </DataList>
          {arbeidsgruppeVurdering.kommentar && (
            <p className="mt-3 text-sm text-pkt-text-body-muted italic">
              <strong>Arbeidsgruppens begrunnelse:</strong> &ldquo;{arbeidsgruppeVurdering.kommentar}&rdquo;
            </p>
          )}
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
              Søker: {state.soker_navn}
            </p>
          </div>
        </SectionContainer>

        {/* Følger arbeidsgruppen? */}
        <SectionContainer
          title="Din beslutning"
          description="Vurder om du følger arbeidsgruppens innstilling eller fatter en annen beslutning."
        >
          <FormField
            label="Er du enig med arbeidsgruppens innstilling?"
            required
            error={errors.folger_arbeidsgruppen?.message}
          >
            <Controller
              name="folger_arbeidsgruppen"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value === true ? 'true' : field.value === false ? 'false' : ''}
                  onValueChange={(v) => field.onChange(v === 'true')}
                >
                  <RadioItem
                    value="true"
                    label={`Ja, jeg følger arbeidsgruppens innstilling (${getBeslutningBadge(arbeidsgruppeInnstilling).label})`}
                    error={!!errors.folger_arbeidsgruppen}
                  />
                  <RadioItem
                    value="false"
                    label="Nei, jeg fatter en annen beslutning"
                    error={!!errors.folger_arbeidsgruppen}
                  />
                </RadioGroup>
              )}
            />
          </FormField>
        </SectionContainer>

        {/* Når IKKE følger arbeidsgruppen - velg beslutning */}
        {folgerArbeidsgruppen === false && (
          <SectionContainer title="Avvikende beslutning">
            <Alert variant="warning" title="Avvik fra arbeidsgruppens innstilling">
              Du velger å fatte en annen beslutning enn arbeidsgruppens innstilling.
              En begrunnelse er påkrevd.
            </Alert>

            <FormField
              label="Din beslutning"
              required
              error={(errors as any).beslutning?.message}
              className="mt-4"
            >
              <Controller
                name="beslutning"
                control={control}
                render={({ field }) => (
                  <RadioGroup value={field.value || ''} onValueChange={field.onChange}>
                    {BESLUTNING_OPTIONS.map((opt) => (
                      <RadioItem
                        key={opt.value}
                        value={opt.value}
                        label={opt.label}
                        error={!!(errors as any).beslutning}
                      />
                    ))}
                  </RadioGroup>
                )}
              />
            </FormField>

            <FormField
              label="Begrunnelse for avvik"
              required
              error={(errors as any).begrunnelse?.message}
              className="mt-4"
            >
              <Textarea
                {...register('begrunnelse')}
                rows={4}
                fullWidth
                placeholder="Begrunn hvorfor du avviker fra arbeidsgruppens innstilling..."
                error={!!(errors as any).begrunnelse}
              />
            </FormField>
          </SectionContainer>
        )}

        {/* Preview av endelig beslutning */}
        {finalBeslutning && (
          <Alert
            variant={getBeslutningBadge(finalBeslutning).variant}
            title="Endelig beslutning"
          >
            <p className="font-medium">
              {getBeslutningBadge(finalBeslutning).label}
            </p>
            <p className="text-sm mt-1">
              {folgerArbeidsgruppen
                ? 'I samsvar med arbeidsgruppens innstilling'
                : 'Avviker fra arbeidsgruppens innstilling'}
            </p>
          </Alert>
        )}

        {/* Error */}
        {beslutningMutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {beslutningMutation.error instanceof Error
              ? beslutningMutation.error.message
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
            variant={finalBeslutning === 'avslatt' ? 'danger' : 'primary'}
            loading={beslutningMutation.isPending}
          >
            Fatt beslutning
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
