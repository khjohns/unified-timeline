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
import { Alert, Button, CurrencyInput, DataList, DataListItem, FormField, Modal, SectionContainer, Textarea, useToast } from '../primitives';
import { StopIcon } from '@radix-ui/react-icons';
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
  const toast = useToast();

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

  // Form backup for protection against accidental close
  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'forsering_stoppet',
    formData,
    isDirty
  );

  // Auto-restore backup on mount (silent restoration with toast notification)
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && hasBackup && !isDirty && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;
      const backup = getBackup();
      if (backup) {
        reset(backup);
        toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
      }
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, isDirty, getBackup, reset, toast]);

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
          <DataList variant="grid">
            <DataListItem label="Iverksatt">
              {formatDate(forseringData.dato_iverksatt)}
            </DataListItem>
            <DataListItem label="Estimert kostnad">
              {formatCurrency(forseringData.estimert_kostnad)}
            </DataListItem>
            <DataListItem label="Avslåtte dager">
              {forseringData.avslatte_dager} dager
            </DataListItem>
            {forseringData.paalopte_kostnader !== undefined && (
              <DataListItem label="Påløpt hittil">
                {formatCurrency(forseringData.paalopte_kostnader)}
              </DataListItem>
            )}
          </DataList>
        </SectionContainer>

        {/* Påløpte kostnader input */}
        <SectionContainer
          title="Påløpte kostnader"
          description="Angi faktiske påløpte forseringskostnader frem til nå"
          optional
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
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
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
    </Modal>
  );
}
