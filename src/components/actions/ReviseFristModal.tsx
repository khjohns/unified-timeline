/**
 * ReviseFristModal Component
 *
 * Modal for TE to revise a frist claim (fristforlengelseskrav) or specify days
 * for a previously neutral notice.
 *
 * This modal handles three modes:
 * 1. REVIDER: Standard revision of already-specified claim
 * 2. SPESIFISER_FRIVILLIG: TE voluntarily upgrades from neutral to specified (§33.6.1)
 * 3. SPESIFISER_ETTERLYSNING: TE responds to BH's demand for specification (§33.6.2)
 *
 * The antall_dager field uses the same name as SendFristModal for consistency
 * with the backend API which expects 'antall_dager' for updates.
 */

import {
  Alert,
  AlertDialog,
  Badge,
  Button,
  DatePicker,
  FormField,
  Input,
  Modal,
  Textarea,
} from '../primitives';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { FristTilstand, FristBeregningResultat, FristVarselType } from '../../types/timeline';

// Modal operating modes
type ModalMode = 'revider' | 'spesifiser_frivillig' | 'spesifiser_etterlysning';

const reviseFristSchema = z.object({
  antall_dager: z.number().min(0, 'Antall dager må være minst 0'),
  begrunnelse: z.string().min(10, 'Begrunnelse er påkrevd'),
  // For specification modes
  ny_sluttdato: z.string().optional(),
});

type ReviseFristFormData = z.infer<typeof reviseFristSchema>;

interface ReviseFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  lastFristEvent: {
    event_id: string;
    antall_dager: number;
    begrunnelse?: string;
  };
  lastResponseEvent?: {
    event_id: string;
    resultat: FristBeregningResultat;
    godkjent_dager?: number;
    begrunnelse?: string;
  };
  fristTilstand: FristTilstand;
  /** Original varsel type from the claim - determines if specification is needed */
  originalVarselType?: FristVarselType;
  /** Whether BH has sent an etterlysning (§33.6.2) */
  harMottattEtterlysning?: boolean;
  /** BH's deadline for specification (from etterlysning) */
  fristForSpesifisering?: string;
}

const RESULTAT_LABELS: Record<FristBeregningResultat, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
};

const RESULTAT_VARIANTS: Record<FristBeregningResultat, 'success' | 'warning' | 'danger'> = {
  godkjent: 'success',
  delvis_godkjent: 'warning',
  avslatt: 'danger',
};

export function ReviseFristModal({
  open,
  onOpenChange,
  sakId,
  lastFristEvent,
  lastResponseEvent,
  fristTilstand,
  originalVarselType,
  harMottattEtterlysning,
  fristForSpesifisering,
}: ReviseFristModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const harBhSvar = !!lastResponseEvent;

  // Determine modal mode based on claim type and etterlysning status
  const modalMode: ModalMode = useMemo(() => {
    // If original claim was only neutral notice without days specified
    const erKunNoytralt = originalVarselType === 'noytralt' &&
      (lastFristEvent.antall_dager === 0 || lastFristEvent.antall_dager === undefined);

    if (erKunNoytralt) {
      if (harMottattEtterlysning) {
        return 'spesifiser_etterlysning';  // Critical - must respond to BH demand
      }
      return 'spesifiser_frivillig';  // Voluntary upgrade
    }

    return 'revider';  // Standard revision mode
  }, [originalVarselType, lastFristEvent.antall_dager, harMottattEtterlysning]);

  // Modal configuration based on mode
  const modalConfig = useMemo(() => {
    switch (modalMode) {
      case 'spesifiser_etterlysning':
        return {
          title: 'Svar på byggherrens etterlysning (§33.6.2)',
          submitLabel: 'Send spesifisert krav',
          submitVariant: 'danger' as const,
        };
      case 'spesifiser_frivillig':
        return {
          title: 'Spesifiser fristkrav (§33.6.1)',
          submitLabel: 'Send spesifisert krav',
          submitVariant: 'primary' as const,
        };
      default:
        return {
          title: 'Revider fristkrav',
          submitLabel: 'Oppdater Krav',
          submitVariant: 'primary' as const,
        };
    }
  }, [modalMode]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    control,
    watch,
    reset,
  } = useForm<ReviseFristFormData>({
    resolver: zodResolver(reviseFristSchema),
    defaultValues: {
      antall_dager: modalMode === 'revider' ? lastFristEvent.antall_dager : 0,
      begrunnelse: '',
      ny_sluttdato: '',
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const formData = watch();
  // Use different backup keys for different modes
  const backupEventType = modalMode === 'revider' ? 'frist_krav_oppdatert' : 'frist_krav_spesifisert';
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, backupEventType, formData, isDirty);

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

  const antallDager = watch('antall_dager');

  // Validation: Different rules for different modes
  const erUgyldigDager = useMemo(() => {
    if (modalMode === 'revider') {
      // For revision: days must differ from original
      return antallDager === lastFristEvent.antall_dager;
    } else {
      // For specification: days must be > 0
      return antallDager === 0 || antallDager === undefined;
    }
  }, [antallDager, lastFristEvent.antall_dager, modalMode]);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      clearBackup();
      reset();
      onOpenChange(false);
    },
    onError: (error) => {
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      }
    },
  });

  const onSubmit = (data: ReviseFristFormData) => {
    if (modalMode === 'revider') {
      // Standard revision event
      mutation.mutate({
        eventType: 'frist_krav_oppdatert',
        data: {
          original_event_id: lastFristEvent.event_id,
          antall_dager: data.antall_dager,
          begrunnelse: data.begrunnelse,
          dato_revidert: new Date().toISOString().split('T')[0],
        },
      });
    } else {
      // Specification event (voluntary or in response to etterlysning)
      mutation.mutate({
        eventType: 'frist_krav_spesifisert',
        data: {
          original_event_id: lastFristEvent.event_id,
          antall_dager: data.antall_dager,
          begrunnelse: data.begrunnelse,
          er_svar_pa_etterlysning: modalMode === 'spesifiser_etterlysning',
          ny_sluttdato: data.ny_sluttdato || undefined,
          dato_spesifisert: new Date().toISOString().split('T')[0],
        },
      });
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={modalConfig.title}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Critical warning for etterlysning mode */}
        {modalMode === 'spesifiser_etterlysning' && (
          <Alert variant="danger" title="Svarplikt (§33.6.2)">
            Byggherren har etterlyst dette kravet. Du må svare «uten ugrunnet opphold».
            Hvis du ikke sender spesifisert krav nå, <strong>tapes hele retten til fristforlengelse</strong> i denne saken.
            {fristForSpesifisering && (
              <p className="mt-2">
                <strong>Frist:</strong> {fristForSpesifisering}
              </p>
            )}
          </Alert>
        )}

        {/* Info for voluntary specification mode */}
        {modalMode === 'spesifiser_frivillig' && (
          <Alert variant="info" title="Frivillig spesifisering (§33.6.1)">
            Du har tidligere sendt et nøytralt varsel (§33.4).
            Nå har du grunnlag for å spesifisere antall dager fristforlengelse.
            <p className="mt-2 text-sm">
              Du skal sende spesifisert krav «uten ugrunnet opphold» når du har grunnlag for beregning.
              Sen spesifisering medfører at kravet reduseres til det BH «måtte forstå» (§33.6.1).
            </p>
          </Alert>
        )}

        {/* Status box - adapts to mode */}
        <div className="bg-pkt-bg-subtle p-4 rounded border border-pkt-grays-gray-200">
          {modalMode === 'revider' ? (
            /* Revision mode: Show original claim with days */
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-pkt-grays-gray-600">Ditt opprinnelige krav:</p>
                <p className="text-2xl font-bold">{lastFristEvent.antall_dager} dager</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-pkt-grays-gray-600">BHs svar:</p>
                {lastResponseEvent ? (
                  <>
                    <Badge variant={RESULTAT_VARIANTS[lastResponseEvent.resultat]}>
                      {RESULTAT_LABELS[lastResponseEvent.resultat]}
                    </Badge>
                    {lastResponseEvent.godkjent_dager !== undefined && (
                      <p className="text-sm mt-1">
                        Godkjent: {lastResponseEvent.godkjent_dager} dager
                      </p>
                    )}
                  </>
                ) : (
                  <Badge variant="neutral">Avventer svar</Badge>
                )}
              </div>
            </div>
          ) : (
            /* Specification mode: Show neutral notice status */
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="warning">Nøytralt varsel</Badge>
                {fristTilstand.noytralt_varsel?.dato_sendt && (
                  <span className="text-sm text-pkt-grays-gray-600">
                    Sendt: {fristTilstand.noytralt_varsel.dato_sendt}
                  </span>
                )}
              </div>
              <p className="text-sm">
                Du varslet om behov for fristforlengelse, men har ikke spesifisert antall dager.
                Angi nå det konkrete kravet.
              </p>
            </div>
          )}
        </div>

        {/* BH begrunnelse - show if available */}
        {harBhSvar && lastResponseEvent?.begrunnelse && (
          <div className="p-4 rounded-none border-2 border-pkt-border-default bg-pkt-surface-subtle">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm">Byggherrens begrunnelse</h4>
              <Badge variant={RESULTAT_VARIANTS[lastResponseEvent.resultat]}>
                {RESULTAT_LABELS[lastResponseEvent.resultat]}
              </Badge>
            </div>
            <div className="pt-2 border-t border-pkt-border-subtle">
              <p className="italic text-pkt-text-body text-sm">
                &ldquo;{lastResponseEvent.begrunnelse}&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* Info when BH hasn't responded - only for revision mode */}
        {modalMode === 'revider' && !lastResponseEvent && (
          <Alert variant="info" title="Revisjon før svar">
            Du kan oppdatere kravet ditt før byggherren har svart. Det reviderte kravet
            erstatter det opprinnelige kravet.
          </Alert>
        )}

        {/* Form fields */}
        <div className="space-y-3">
          <FormField
            label="Antall dager fristforlengelse"
            required
            error={errors.antall_dager?.message}
          >
            <Controller
              name="antall_dager"
              control={control}
              render={({ field }) => (
                <Input
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  width="xs"
                  min={0}
                />
              )}
            />
          </FormField>
          {erUgyldigDager && (
            <p className="text-sm text-pkt-brand-orange-700">
              {modalMode === 'revider'
                ? 'Nytt antall dager må være forskjellig fra opprinnelig krav for å sende revisjon.'
                : 'Du må angi antall dager (mer enn 0) for å sende spesifisert krav.'}
            </p>
          )}
        </div>

        {/* Additional fields for specification modes */}
        {modalMode !== 'revider' && (
          <>
            {/* Ny sluttdato */}
            <FormField
              label="Ny forventet sluttdato"
              helpText="Forventet ny sluttdato etter fristforlengelsen"
            >
              <Controller
                name="ny_sluttdato"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    id="ny_sluttdato"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>

          </>
        )}

        {/* Vilkår-info for begrunnelse */}
        <Alert variant="info" title="Vilkår for fristforlengelse (§33.1, §33.5)">
          For å ha krav på fristforlengelse må du vise at: (1) fremdriften har vært hindret, og
          (2) hindringen skyldes det påberopte forholdet (årsakssammenheng). Begrunn hvordan
          forholdet konkret har forårsaket forsinkelse i prosjektet.
        </Alert>

        {/* Begrunnelse */}
        <FormField
          label={modalMode === 'revider' ? 'Begrunnelse for endring' : 'Begrunnelse for kravet'}
          required
          error={errors.begrunnelse?.message}
        >
          <Controller
            name="begrunnelse"
            control={control}
            render={({ field }) => (
              <Textarea
                id="begrunnelse"
                value={field.value}
                onChange={field.onChange}
                rows={4}
                fullWidth
                error={!!errors.begrunnelse}
                placeholder={modalMode === 'revider'
                  ? 'Hvorfor endres antall dager?'
                  : 'Begrunn kravet om fristforlengelse (årsakssammenheng, dokumentasjon av hindring)'}
              />
            )}
          />
        </FormField>

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-6 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            size="lg"
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant={modalConfig.submitVariant}
            disabled={isSubmitting || !watch('begrunnelse') || erUgyldigDager}
            size="lg"
          >
            {isSubmitting ? 'Sender...' : modalConfig.submitLabel}
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
    </Modal>
  );
}
