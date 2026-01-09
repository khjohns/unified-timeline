/**
 * StoppForseringModal Component
 *
 * Modal for stopping an active forsering.
 * Requires TE to provide a reason and confirm.
 * Uses React Hook Form + Zod for validation.
 *
 * UPDATED (2025-01-09):
 * - Refactored to use React Hook Form + Zod
 * - Added useFormBackup for localStorage persistence
 * - Added useConfirmClose for unsaved changes dialog
 */

import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, AlertDialog, Button, CurrencyInput, FormField, Modal, SectionContainer, Textarea } from '../primitives';
import { StopIcon } from '@radix-ui/react-icons';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useFormBackup } from '../../hooks/useFormBackup';
import type { ForseringData } from '../../types/timeline';

// Schema
const stoppForseringSchema = z.object({
  begrunnelse: z.string().min(1, 'Begrunnelse er påkrevd'),
  paalopte_kostnader: z.number().optional(),
});

type StoppForseringFormData = z.infer<typeof stoppForseringSchema>;

interface StoppForseringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  forseringData: ForseringData;
  onStopp: (data: { begrunnelse: string; paalopte_kostnader?: number }) => void;
  isLoading?: boolean;
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function StoppForseringModal({
  open,
  onOpenChange,
  sakId,
  forseringData,
  onStopp,
  isLoading = false,
}: StoppForseringModalProps) {
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
  } = useForm<StoppForseringFormData>({
    resolver: zodResolver(stoppForseringSchema),
    defaultValues: {
      begrunnelse: '',
      paalopte_kostnader: undefined,
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        begrunnelse: '',
        paalopte_kostnader: undefined,
      });
    }
  }, [open, reset]);

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  // Form backup for protection against accidental close
  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'forsering_stoppet',
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
    if (backup) reset(backup);
    setShowRestorePrompt(false);
  };

  const handleDiscardBackup = () => {
    clearBackup();
    setShowRestorePrompt(false);
  };

  const onSubmit = (data: StoppForseringFormData) => {
    onStopp({
      begrunnelse: data.begrunnelse,
      paalopte_kostnader: data.paalopte_kostnader,
    });
    clearBackup();
  };

  // Can only stop if forsering is active (iverksatt but not stopped)
  const canStop = forseringData.er_iverksatt && !forseringData.er_stoppet;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Stopp forsering"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Warning */}
        <Alert variant="warning" title="Du er i ferd med å stoppe forseringen">
          <p>
            Når forseringen stoppes, vil alle forseringskostnader påløpt frem til nå
            kunne kreves dekket. Sørg for å dokumentere påløpte kostnader.
          </p>
        </Alert>

        {/* Current status */}
        <SectionContainer title="Nåværende status" variant="subtle">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-pkt-text-body-subtle">Iverksatt:</span>
              <span className="ml-2">{formatDate(forseringData.dato_iverksatt)}</span>
            </div>
            <div>
              <span className="text-pkt-text-body-subtle">Estimert kostnad:</span>
              <span className="ml-2">{formatCurrency(forseringData.estimert_kostnad)}</span>
            </div>
            <div>
              <span className="text-pkt-text-body-subtle">Avslåtte dager:</span>
              <span className="ml-2">{forseringData.avslatte_dager} dager</span>
            </div>
            {forseringData.paalopte_kostnader !== undefined && (
              <div>
                <span className="text-pkt-text-body-subtle">Påløpt hittil:</span>
                <span className="ml-2">{formatCurrency(forseringData.paalopte_kostnader)}</span>
              </div>
            )}
          </div>
        </SectionContainer>

        {/* Påløpte kostnader input */}
        <SectionContainer
          title="Påløpte kostnader"
          description="Angi faktiske påløpte forseringskostnader frem til nå (valgfritt)"
        >
          <FormField label="Beløp">
            <Controller
              name="paalopte_kostnader"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  value={field.value ?? null}
                  onChange={field.onChange}
                  allowNegative={false}
                />
              )}
            />
          </FormField>
        </SectionContainer>

        {/* Begrunnelse */}
        <SectionContainer title="Begrunnelse">
          <FormField
            label="Begrunnelse for stopp"
            required
            error={errors.begrunnelse?.message}
          >
            <Controller
              name="begrunnelse"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  rows={3}
                  fullWidth
                  error={!!errors.begrunnelse}
                />
              )}
            />
          </FormField>
        </SectionContainer>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t-2 border-pkt-border-subtle">
          <Button variant="ghost" type="button" onClick={handleClose}>
            Avbryt
          </Button>
          <Button
            variant="danger"
            type="submit"
            disabled={!canStop || isLoading}
          >
            <StopIcon className="w-4 h-4 mr-2" />
            {isLoading ? 'Stopper...' : 'Stopp forsering'}
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
        onOpenChange={(openState) => { if (!openState) handleDiscardBackup(); }}
        title="Gjenopprette lagrede data?"
        description="Det finnes data fra en tidligere økt som ikke ble sendt inn. Vil du fortsette der du slapp?"
        confirmLabel="Gjenopprett"
        cancelLabel="Start på nytt"
        onConfirm={handleRestoreBackup}
        variant="info"
      />
    </Modal>
  );
}
