/**
 * BentoRespondFrist Component
 *
 * Form panel for card-anchored frist response.
 * Renders to the right of FristCard in interactive mode.
 *
 * This panel is a pure begrunnelse editor + submit surface.
 * All controls (varsling, vilkår, dager) and results live in FristCard.
 * Auto-begrunnelse and event payload are built by useFristBridge.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Button,
  FormField,
  RichTextEditor,
  useToast,
} from '../primitives';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useFormBackup } from '../../hooks/useFormBackup';
import { useCatendaStatusHandler } from '../../hooks/useCatendaStatusHandler';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import type { FristBridgeComputed } from '../../hooks/useFristBridge';

// ============================================================================
// SCHEMA
// ============================================================================

const bentoFristSchema = z.object({
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
});

type BentoFristFormData = z.infer<typeof bentoFristSchema>;

// ============================================================================
// TYPES
// ============================================================================

export interface BentoRespondFristProps {
  sakId: string;
  fristKravId: string;
  // Bridge (readonly computed + event builder)
  computed: FristBridgeComputed;
  buildEventData: (params: { fristKravId: string; begrunnelse: string }) => Record<string, unknown>;
  // Callbacks
  onSuccess: () => void;
  onCancel: () => void;
  onCatendaWarning?: () => void;
  approvalEnabled?: boolean;
  onSaveDraft?: (data: Record<string, unknown>) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BentoRespondFrist({
  sakId,
  fristKravId,
  computed,
  buildEventData,
  onSuccess,
  onCancel,
  onCatendaWarning,
  approvalEnabled = false,
  onSaveDraft,
}: BentoRespondFristProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();
  const { handleCatendaStatus } = useCatendaStatusHandler({ onWarning: onCatendaWarning });

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
    setValue: formSetValue,
  } = useForm<BentoFristFormData>({
    resolver: zodResolver(bentoFristSchema),
    defaultValues: {
      begrunnelse: '',
    },
  });

  const formData = watch();
  const { clearBackup, hasBackup, getBackup } = useFormBackup(
    sakId, 'respons_frist', formData, isDirty
  );

  // Auto-restore backup on mount
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (!hasCheckedBackup.current) {
      hasCheckedBackup.current = true;
      if (hasBackup && !isDirty) {
        const backup = getBackup();
        if (backup) {
          reset({ ...backup, begrunnelse: (backup as { begrunnelse?: string }).begrunnelse ?? '' });
          toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
        }
      }
    }
  }, [hasBackup, isDirty, getBackup, reset, toast]);

  const pendingToastId = useRef<string | null>(null);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: (result) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      clearBackup();
      reset();
      onSuccess();
      toast.success('Svar sendt', 'Ditt svar på fristkravet er registrert.');
      handleCatendaStatus(result);
    },
    onError: (error) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      }
    },
  });

  // Track manual edits to begrunnelse
  const userHasEditedBegrunnelseRef = useRef(false);

  // Auto-populate begrunnelse when auto-begrunnelse changes (if not manually edited)
  useEffect(() => {
    if (computed.autoBegrunnelse && !userHasEditedBegrunnelseRef.current) {
      formSetValue('begrunnelse', computed.autoBegrunnelse);
    }
  }, [computed.autoBegrunnelse, formSetValue]);

  const markBegrunnelseAsEdited = useCallback(() => {
    userHasEditedBegrunnelseRef.current = true;
  }, []);

  const handleRegenerBegrunnelse = useCallback(() => {
    if (computed.autoBegrunnelse) {
      formSetValue('begrunnelse', computed.autoBegrunnelse, { shouldDirty: true });
      userHasEditedBegrunnelseRef.current = false;
    }
  }, [computed.autoBegrunnelse, formSetValue]);

  // Submit handler — bridge builds the full event payload
  const onSubmit = (data: BentoFristFormData) => {
    pendingToastId.current = toast.pending(
      'Sender svar...',
      'Vennligst vent mens svaret behandles.'
    );

    mutation.mutate({
      eventType: 'respons_frist',
      data: buildEventData({ fristKravId, begrunnelse: data.begrunnelse }),
    });
  };

  const handleSaveDraft = (data: BentoFristFormData) => {
    if (!onSaveDraft) return;
    onSaveDraft({
      dager: computed.godkjentDager,
      resultat: computed.prinsipaltResultat,
      begrunnelse: data.begrunnelse || computed.autoBegrunnelse,
    });
    clearBackup();
    reset();
    onSuccess();
    toast.success('Utkast lagret', 'Svaret på fristkravet er lagret som utkast.');
  };

  return (
    <div className="bg-pkt-bg-subtle rounded-lg p-4 max-h-[70vh] overflow-y-auto">
      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Send forespørsel info */}
        {computed.sendForesporsel && (
          <Alert variant="info" size="sm">
            Du sender forespørsel om spesifisering (§33.6.2). TE må svare med et spesifisert krav.
          </Alert>
        )}

        {/* Begrunnelse */}
        <FormField
          label="Byggherrens begrunnelse"
          required
          error={errors.begrunnelse?.message}
        >
          <Controller
            name="begrunnelse"
            control={control}
            render={({ field }) => (
              <RichTextEditor
                id="frist-begrunnelse"
                value={field.value ?? ''}
                onChange={(value) => {
                  field.onChange(value);
                  markBegrunnelseAsEdited();
                }}
                className="text-xs"
                minHeight={200}
                fullWidth
                error={!!errors.begrunnelse}
                placeholder={computed.dynamicPlaceholder}
              />
            )}
          />
          {computed.autoBegrunnelse && (
            <div className="flex justify-end mt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRegenerBegrunnelse}
              >
                Regenerer fra valg
              </Button>
            </div>
          )}
        </FormField>

        {/* Error */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4 border-t border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <div className="flex gap-2">
            {approvalEnabled && onSaveDraft && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSubmit(handleSaveDraft)}
                disabled={isSubmitting}
              >
                Lagre utkast
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || !computed.prinsipaltResultat}
            >
              {isSubmitting ? 'Sender...' : 'Send svar'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
