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

import { useMemo, useState, useEffect, useRef } from 'react';
import { useFormBackup } from '../../hooks/useFormBackup';
import { useVerifyToken } from '../../hooks/useVerifyToken';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { getAuthToken } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertDialog,
  AttachmentUpload,
  Button,
  CurrencyInput,
  DatePicker,
  FormField,
  Modal,
  SectionContainer,
  Textarea,
} from '../primitives';
import type { AttachmentFile } from '../../types';
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
import type { FristBeregningResultat, SubsidiaerTrigger } from '../../types/timeline';

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
  /** Subsidiary triggers from frist response (preklusion, grunnlag avslag, etc.) */
  subsidiaerTriggers?: SubsidiaerTrigger[];
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
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
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
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
  subsidiaerTriggers,
  onCatendaWarning,
}: SendForseringModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  // Derived subsidiary state
  const erSubsidiaer = subsidiaerTriggers && subsidiaerTriggers.length > 0;
  const erGrunnlagAvslatt = subsidiaerTriggers?.includes('grunnlag_avslatt') ?? false;

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
      attachments: [],
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'forsering_opprett', formData, isDirty);

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
  const handleRestoreBackup = () => { const backup = getBackup(); if (backup) reset(backup); setShowRestorePrompt(false); };
  const handleDiscardBackup = () => { clearBackup(); setShowRestorePrompt(false); };

  // Token validation hook
  const verifyToken = useVerifyToken();

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
      // Show warning if Catenda sync failed
      if ('catenda_synced' in response && !response.catenda_synced) {
        onCatendaWarning?.();
      }
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
        {/* Combined info and risk warning */}
        <Alert variant="warning" title="Om forsering ved avslag (§33.8)">
          Ved avslag på fristkrav kan du velge å behandle dette som et forseringspålegg
          (jf. §31.2). Byggherren må da betale forseringskostnadene. Merk at du tar
          risiko for at fristkravet var berettiget — hvis ikke, må du dekke kostnadene selv.
        </Alert>

        {/* Grunnlag rejection trigger info */}
        {erGrunnlagAvslatt && (
          <Alert variant="info" title="Utløst av grunnlagsavslag">
            Byggherren har avslått ansvarsgrunnlaget. Forseringsvarselet baseres på byggherrens{' '}
            <strong>subsidiære</strong> standpunkt til fristforlengelse.
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Seksjon 2: Kostnadsberegning */}
          <SectionContainer
            title="Kostnadsberegning"
            description="Du har valgrett hvis estimert kostnad er innenfor dagmulkt + 30% (§33.8)"
          >
            <div className="space-y-4">
              {/* Inline dag-oversikt */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm pb-2 border-b border-pkt-border-subtle">
                <span>
                  <span className="text-pkt-text-body-subtle">Krevd:</span>{' '}
                  <span className="font-mono font-bold">{fristData.krevde_dager}</span> dager
                </span>
                <span className="text-pkt-border-subtle">|</span>
                {fristData.godkjent_dager === 0 ? (
                  <span className="text-alert-danger-text">
                    <span>{erSubsidiaer ? 'Subs. avslått' : 'Avslått'}:</span>{' '}
                    <span className="font-mono font-bold">{avslatteDager}</span> dager
                  </span>
                ) : (
                  <>
                    <span>
                      <span className="text-pkt-text-body-subtle">{erSubsidiaer ? 'Subs. godkjent:' : 'Godkjent:'}</span>{' '}
                      <span className="font-mono font-bold">{fristData.godkjent_dager}</span>
                    </span>
                    <span className="text-pkt-border-subtle">|</span>
                    <span className="text-alert-danger-text">
                      <span>Avslått:</span>{' '}
                      <span className="font-mono font-bold">{avslatteDager}</span>
                    </span>
                  </>
                )}
              </div>

              <FormField
                label="Dagmulktsats (NOK)"
                required
                error={errors.dagmulktsats?.message}
                helpText="Dagmulkt per dag forsinkelse iht. kontrakten"
              >
                <Controller
                  name="dagmulktsats"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value ?? null}
                      onChange={field.onChange}
                      allowNegative={false}
                      error={!!errors.dagmulktsats}
                    />
                  )}
                />
              </FormField>

              <div className="p-4 bg-pkt-surface-yellow border-2 border-pkt-border-yellow rounded-none text-alert-warning-text">
                <h4 className="font-bold text-sm mb-3">Beregning av kostnadsgrense</h4>
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

              <FormField
                label="Estimert forseringskostnad (NOK)"
                required
                error={errors.estimert_kostnad?.message}
                helpText="Angi hva forseringen antas å ville koste"
              >
                <Controller
                  name="estimert_kostnad"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value ?? null}
                      onChange={field.onChange}
                      allowNegative={false}
                      error={!!errors.estimert_kostnad}
                    />
                  )}
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
            </div>
          </SectionContainer>

          {/* Seksjon 3: Forseringsdetaljer */}
          <SectionContainer
            title="Forseringsdetaljer"
            description="Angi tidspunkt og begrunnelse for forsering"
          >
            <div className="space-y-4">
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

            </div>
          </SectionContainer>

          {/* Seksjon 4: Vedlegg */}
          <SectionContainer
            title="Vedlegg"
            description="Last opp dokumentasjon (valgfritt)"
          >
            <Controller
              name="attachments"
              control={control}
              render={({ field }) => (
                <AttachmentUpload
                  value={field.value ?? []}
                  onChange={field.onChange}
                  multiple
                  acceptedFormatsText="PDF, Word, Excel, bilder (maks 10 MB)"
                />
              )}
            />
          </SectionContainer>

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
              className="w-full sm:w-auto"
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending || !erInnenforGrense}
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
