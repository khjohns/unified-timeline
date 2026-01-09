/**
 * OppdaterKostnaderModal Component
 *
 * Modal for TE to update incurred costs during an active forsering.
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
import { UpdateIcon } from '@radix-ui/react-icons';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useFormBackup } from '../../hooks/useFormBackup';
import type { ForseringData } from '../../types/timeline';

// Schema
const oppdaterKostnaderSchema = z.object({
  paalopte_kostnader: z.number().min(0, 'Kostnader kan ikke være negative'),
  kommentar: z.string().optional(),
});

type OppdaterKostnaderFormData = z.infer<typeof oppdaterKostnaderSchema>;

interface OppdaterKostnaderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  forseringData: ForseringData;
  onOppdater: (data: { paalopte_kostnader: number; kommentar?: string }) => void;
  isLoading?: boolean;
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

export function OppdaterKostnaderModal({
  open,
  onOpenChange,
  sakId,
  forseringData,
  onOppdater,
  isLoading = false,
}: OppdaterKostnaderModalProps) {
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
  } = useForm<OppdaterKostnaderFormData>({
    resolver: zodResolver(oppdaterKostnaderSchema),
    defaultValues: {
      paalopte_kostnader: forseringData.paalopte_kostnader ?? 0,
      kommentar: '',
    },
  });

  // Reset form with fresh data when modal opens
  useEffect(() => {
    if (open) {
      reset({
        paalopte_kostnader: forseringData.paalopte_kostnader ?? 0,
        kommentar: '',
      });
    }
  }, [open, forseringData.paalopte_kostnader, reset]);

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  // Form backup for protection against accidental close
  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'forsering_kostnader_oppdatert',
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

  const onSubmit = (data: OppdaterKostnaderFormData) => {
    onOppdater({
      paalopte_kostnader: data.paalopte_kostnader,
      kommentar: data.kommentar || undefined,
    });
    clearBackup();
  };

  const nyKostnad = formData.paalopte_kostnader ?? 0;
  const overstigerMaks = forseringData.maks_forseringskostnad != null && nyKostnad > forseringData.maks_forseringskostnad;
  const overstigerEstimert = forseringData.estimert_kostnad != null && nyKostnad > forseringData.estimert_kostnad;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Oppdater påløpte kostnader"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Current status */}
        <SectionContainer title="Kostnadsramme" variant="subtle">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-pkt-text-body-subtle">Estimert kostnad:</span>
              <span className="ml-2">{formatCurrency(forseringData.estimert_kostnad)}</span>
            </div>
            <div>
              <span className="text-pkt-text-body-subtle">Maks (30%-regel):</span>
              <span className="ml-2">{formatCurrency(forseringData.maks_forseringskostnad)}</span>
            </div>
            <div>
              <span className="text-pkt-text-body-subtle">Nåværende påløpt:</span>
              <span className="ml-2 font-medium">
                {formatCurrency(forseringData.paalopte_kostnader)}
              </span>
            </div>
          </div>
        </SectionContainer>

        {/* Påløpte kostnader input */}
        <SectionContainer
          title="Nye påløpte kostnader"
          description="Angi totale påløpte forseringskostnader frem til nå"
        >
          <FormField
            label="Beløp"
            required
            error={errors.paalopte_kostnader?.message}
          >
            <Controller
              name="paalopte_kostnader"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  allowNegative={false}
                  error={!!errors.paalopte_kostnader}
                />
              )}
            />
          </FormField>

          {/* Warnings */}
          {overstigerMaks && (
            <Alert variant="danger" title="Overstiger maksgrense">
              Påløpte kostnader overstiger 30%-regelen ({formatCurrency(forseringData.maks_forseringskostnad)}).
              Kostnader utover dette kan være vanskelig å få dekket.
            </Alert>
          )}

          {!overstigerMaks && overstigerEstimert && (
            <Alert variant="warning" title="Overstiger estimat">
              Påløpte kostnader overstiger opprinnelig estimat ({formatCurrency(forseringData.estimert_kostnad)}).
              Sørg for god dokumentasjon av merkostnadene.
            </Alert>
          )}
        </SectionContainer>

        {/* Kommentar */}
        <SectionContainer title="Kommentar">
          <FormField label="Kommentar (valgfritt)">
            <Controller
              name="kommentar"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  value={field.value ?? ''}
                  rows={2}
                  fullWidth
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
            variant="primary"
            type="submit"
            disabled={isLoading}
          >
            <UpdateIcon className="w-4 h-4 mr-2" />
            {isLoading ? 'Oppdaterer...' : 'Oppdater kostnader'}
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
