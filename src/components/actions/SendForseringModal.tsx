/**
 * SendForseringModal Component
 *
 * Action modal for TE (contractor) to send a forsering (acceleration) notice
 * when BH has rejected a frist (deadline extension) claim.
 *
 * Based on NS 8407 §33.8:
 * - TE can choose to treat BH's rejection as an order to accelerate
 * - Cost limit: forseringskostnad ≤ (dagmulkt + 30%)
 * - TE must notify BH before acceleration starts with estimated cost
 *
 * TRIGGERS (when this modal should be available):
 * - BH rejected frist claim (avslatt)
 * - BH partially approved frist claim (delvis_godkjent with godkjent < krevd)
 * - BH rejected grunnlag (implies frist rejection) - uses subsidiary days
 */

import { useMemo, useState, useEffect } from 'react';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { getAuthToken } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { FormField } from '../primitives/FormField';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { DatePicker } from '../primitives/DatePicker';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { Checkbox } from '../primitives/Checkbox';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import {
  opprettForseringssak,
  type OpprettForseringRequest,
  type OpprettForseringResponse,
} from '../../api/forsering';
import type { FristBeregningResultat } from '../../types/timeline';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface SendForseringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** Event-ID of the frist claim that was rejected */
  fristKravId: string;
  /** Event-ID of BH's frist response that triggered this */
  responsFristId: string;
  /** Frist data for context */
  fristData: {
    krevde_dager: number;
    godkjent_dager: number;  // 0 if fully rejected, or subsidiary days if grunnlag rejected
    bh_resultat: FristBeregningResultat;
  };
  /** Daily liquidated damages rate in NOK */
  dagmulktsats: number;
  /** True if triggered by grunnlag rejection (not direct frist rejection) */
  grunnlagAvslagTrigger?: boolean;
}

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const sendForseringSchema = z.object({
  estimert_kostnad: z.number()
    .min(1, 'Estimert kostnad må være større enn 0'),
  dagmulktsats: z.number()
    .min(1, 'Dagmulktsats må være større enn 0'),
  dato_iverksettelse: z.string()
    .min(1, 'Du må angi dato for iverksettelse'),
  begrunnelse: z.string()
    .min(10, 'Begrunnelse må være minst 10 tegn'),
  bekreft_30_prosent: z.boolean()
    .refine(val => val === true, 'Du må bekrefte at kostnad er innenfor 30%-grensen'),
});

type SendForseringFormData = z.infer<typeof sendForseringSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('nb-NO')} kr`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SendForseringModal({
  open,
  onOpenChange,
  sakId,
  fristKravId,
  responsFristId,
  fristData,
  dagmulktsats,
  grunnlagAvslagTrigger = false,
}: SendForseringModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  // Calculate rejected days
  const avslatteDager = fristData.krevde_dager - fristData.godkjent_dager;

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    control,
  } = useForm<SendForseringFormData>({
    resolver: zodResolver(sendForseringSchema),
    defaultValues: {
      dagmulktsats: dagmulktsats,
      bekreft_30_prosent: false,
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'forsering_opprett', formData, isDirty);

  useEffect(() => { if (open && hasBackup) setShowRestorePrompt(true); }, [open, hasBackup]);
  const handleRestoreBackup = () => { const backup = getBackup(); if (backup) reset(backup); setShowRestorePrompt(false); };
  const handleDiscardBackup = () => { clearBackup(); setShowRestorePrompt(false); };

  // Token validation helper
  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/magic-link/verify?token=${token}`);
      return response.ok;
    } catch {
      return false;
    }
  };

  // Mutation to create forsering case and navigate to it
  const mutation = useMutation({
    mutationFn: async (data: OpprettForseringRequest) => {
      // Validate token before submission
      const token = getAuthToken();
      if (!token) {
        throw new Error('TOKEN_MISSING');
      }
      const isValid = await verifyToken(token);
      if (!isValid) {
        throw new Error('TOKEN_EXPIRED');
      }
      return opprettForseringssak(data);
    },
    onSuccess: (response) => {
      // Invalidate queries to refetch case data
      clearBackup();
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      reset();
      onOpenChange(false);
      // Navigate to the new forsering case
      navigate(`/forsering/${response.forsering_sak_id}`);
    },
    onError: (error) => {
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING')) {
        setShowTokenExpired(true);
      }
    },
  });

  // Watch form values for live calculation
  const estimertKostnad = watch('estimert_kostnad') || 0;
  const inputDagmulktsats = watch('dagmulktsats') || dagmulktsats;

  // Calculate 30% limit
  const maksKostnad = useMemo(() => {
    return avslatteDager * inputDagmulktsats * 1.3;
  }, [avslatteDager, inputDagmulktsats]);

  const erInnenforGrense = estimertKostnad <= maksKostnad;
  const prosentAvGrense = maksKostnad > 0 ? (estimertKostnad / maksKostnad) * 100 : 0;

  // Submit handler
  const onSubmit = (data: SendForseringFormData) => {
    mutation.mutate({
      avslatte_sak_ids: [sakId],
      estimert_kostnad: data.estimert_kostnad,
      dagmulktsats: data.dagmulktsats,
      begrunnelse: data.begrunnelse,
      avslatte_dager: avslatteDager,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Forseringsvarsel (§33.8)"
      size="lg"
    >
      <div className="space-y-6">
        {/* Info banner about §33.8 */}
        <Alert variant="info" title="Forsering ved uberettiget avslag (§33.8)">
          Når byggherren avslår et berettiget fristkrav, kan du velge å behandle avslaget som
          et pålegg om forsering gitt ved endringsordre (jf. §31.2). Byggherren må da betale
          forseringskostnadene. Du må varsle byggherren før forsering iverksettes.
        </Alert>

        {/* Risk warning */}
        <Alert variant="warning" title="Risiko ved forsering">
          Ved å velge forsering tar du risiko for at fristkravet var berettiget. Hvis det
          senere viser seg at byggherren hadde rett til å avslå fristforlengelsen, må du
          dekke forseringskostnadene selv.
        </Alert>

        {/* Grunnlag rejection trigger info */}
        {grunnlagAvslagTrigger && (
          <Alert variant="info" title="Utløst av grunnlagsavslag">
            Byggherren har avslått ansvarsgrunnlaget. Forseringsvarselet baseres på byggherrens{' '}
            <strong>subsidiære</strong> standpunkt til fristforlengelse.
          </Alert>
        )}

        {/* Context: Rejected days */}
        <div className="p-4 bg-pkt-surface-subtle border-2 border-pkt-border-default rounded-none">
          <h4 className="font-bold text-sm mb-3">Fristkrav - oversikt</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-pkt-bg-subtle rounded-none">
              <span className="text-xs text-pkt-text-body-subtle uppercase font-bold block">
                Krevde dager
              </span>
              <span className="text-2xl font-bold">{fristData.krevde_dager}</span>
            </div>
            <div className="p-3 bg-pkt-bg-subtle rounded-none">
              <span className="text-xs text-pkt-text-body-subtle uppercase font-bold block">
                {grunnlagAvslagTrigger ? 'Subsidiært godkjent' : 'Godkjent'}
              </span>
              <span className="text-2xl font-bold">{fristData.godkjent_dager}</span>
            </div>
            <div className="p-3 bg-alert-danger-bg rounded-none text-alert-danger-text">
              <span className="text-xs uppercase font-bold block">
                Avslåtte dager
              </span>
              <span className="text-2xl font-bold">{avslatteDager}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dagmulktsats input */}
          <FormField
            label="Dagmulktsats (NOK)"
            required
            error={errors.dagmulktsats?.message}
            helpText="Dagmulkt per dag forsinkelse iht. kontrakten"
          >
            <Input
              type="number"
              {...register('dagmulktsats', { valueAsNumber: true })}
              width="sm"
              error={!!errors.dagmulktsats}
            />
          </FormField>

          {/* 30% calculation display */}
          <Alert variant="info" title="30%-grensen (§33.8)">
            Du har kun valgrett til forsering hvis forseringskostnaden er lavere enn
            dagmulkten du ville fått + 30%. Dette sikrer at forsering er økonomisk
            fornuftig sammenlignet med å ta dagmulkt.
          </Alert>

          <div className="p-4 bg-pkt-surface-yellow border-2 border-pkt-border-yellow rounded-none text-alert-warning-text">
            <h4 className="font-bold mb-3">Beregning av kostnadsgrense</h4>
            <div className="space-y-2 text-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span>Avslåtte dager:</span>
                <span className="font-mono font-bold">{avslatteDager} dager</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span>Dagmulktsats:</span>
                <span className="font-mono">{formatCurrency(inputDagmulktsats)}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span>Dagmulkt totalt ({avslatteDager} × {formatCurrency(inputDagmulktsats)}):</span>
                <span className="font-mono">{formatCurrency(avslatteDager * inputDagmulktsats)}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 border-t border-pkt-border-yellow pt-2 font-bold">
                <span>Maks forseringskostnad (+ 30%):</span>
                <span className="font-mono text-lg">{formatCurrency(maksKostnad)}</span>
              </div>
            </div>
          </div>

          {/* Estimated cost input */}
          <FormField
            label="Estimert forseringskostnad (NOK)"
            required
            error={errors.estimert_kostnad?.message}
            helpText="Angi hva forseringen antas å ville koste"
          >
            <Input
              type="number"
              {...register('estimert_kostnad', { valueAsNumber: true })}
              width="md"
              error={!!errors.estimert_kostnad}
            />
          </FormField>

          {/* Cost validation feedback */}
          {estimertKostnad > 0 && (
            erInnenforGrense ? (
              <Alert variant="success" title="Innenfor kostnadsgrensen">
                Estimert kostnad utgjør {prosentAvGrense.toFixed(0)}% av maksgrensen.
                Du har valgrett til å behandle avslaget som et forseringspålegg.
              </Alert>
            ) : (
              <Alert variant="danger" title="Overstiger kostnadsgrensen">
                Estimert kostnad overstiger grensen med {formatCurrency(estimertKostnad - maksKostnad)}.
                Hvis forseringskostnaden overstiger dagmulkt + 30%, har du ikke valgrett
                til å anse avslaget som et forseringspålegg (§33.8).
              </Alert>
            )
          )}

          {/* Date for acceleration start */}
          <FormField
            label="Dato for iverksettelse"
            required
            error={errors.dato_iverksettelse?.message}
            helpText="Når forsering vil iverksettes"
          >
            <Controller
              name="dato_iverksettelse"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="dato_iverksettelse"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>

          {/* Begrunnelse */}
          <FormField
            label="Begrunnelse"
            required
            error={errors.begrunnelse?.message}
            helpText="Begrunn hvorfor du mener fristkravet er berettiget og velger forsering"
          >
            <Textarea
              {...register('begrunnelse')}
              rows={4}
              fullWidth
              error={!!errors.begrunnelse}
            />
          </FormField>

          {/* Confirmation checkbox */}
          <div className="p-4 bg-pkt-surface-subtle border-2 border-pkt-border-default rounded-none">
            <Controller
              name="bekreft_30_prosent"
              control={control}
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label="Jeg bekrefter at estimert forseringskostnad er innenfor dagmulkt + 30%"
                  error={!!errors.bekreft_30_prosent}
                />
              )}
            />
            {errors.bekreft_30_prosent && (
              <p className="text-sm text-pkt-text-danger mt-1">{errors.bekreft_30_prosent.message}</p>
            )}
          </div>

          {/* Error Message */}
          {mutation.isError && (
            <Alert variant="danger" title="Feil ved innsending">
              {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
            </Alert>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t-2 border-pkt-border-subtle">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={mutation.isPending}
              size="lg"
              className="w-full sm:w-auto"
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending || !erInnenforGrense}
              size="lg"
              className="w-full sm:w-auto"
            >
              {mutation.isPending ? 'Oppretter forseringssak...' : 'Opprett forseringssak'}
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
          description="Det finnes data fra en tidligere økt som ikke ble sendt inn. Vil du fortsette der du slapp?"
          confirmLabel="Gjenopprett"
          cancelLabel="Start på nytt"
          onConfirm={handleRestoreBackup}
          variant="info"
        />
        <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
      </div>
    </Modal>
  );
}
