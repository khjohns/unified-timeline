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
  AttachmentUpload,
  Button,
  DatePicker,
  FormField,
  Input,
  Modal,
  SectionContainer,
  Textarea,
  useToast,
} from '../primitives';
import type { AttachmentFile } from '../../types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { KontraktsregelInline } from '../shared';
import { FristTilstand, FristBeregningResultat, FristVarselType, SubsidiaerTrigger } from '../../types/timeline';

// Modal operating modes
type ModalMode = 'revider' | 'spesifiser_frivillig' | 'spesifiser_foresporsel';

const reviseFristSchema = z.object({
  antall_dager: z.number().min(0, 'Antall dager må være minst 0'),
  begrunnelse: z.string().min(10, 'Begrunnelse er påkrevd'),
  // For specification modes
  ny_sluttdato: z.string().optional(),
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
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
  /** Current version number (0 = original, 1+ = revisions). Next revision will be currentVersion + 1. */
  currentVersion?: number;
  /** Original varsel type from the claim - determines if specification is needed */
  originalVarselType?: FristVarselType;
  /** Whether BH has sent an foresporsel (§33.6.2) */
  harMottattForesporsel?: boolean;
  /** BH's deadline for specification (from foresporsel) */
  fristForSpesifisering?: string;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
  /** Subsidiary triggers for displaying "Subs. godkjent" label */
  subsidiaerTriggers?: SubsidiaerTrigger[];
}

export function ReviseFristModal({
  open,
  onOpenChange,
  sakId,
  lastFristEvent,
  lastResponseEvent,
  fristTilstand,
  currentVersion = 0,
  originalVarselType,
  harMottattForesporsel,
  fristForSpesifisering,
  onCatendaWarning,
  subsidiaerTriggers,
}: ReviseFristModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();
  // This revision will become the next version
  const nextVersion = currentVersion + 1;

  // Determine modal mode based on claim type and foresporsel status
  const modalMode: ModalMode = useMemo(() => {
    // If original claim was only neutral notice without days specified
    const erKunVarsel = originalVarselType === 'varsel' &&
      (lastFristEvent.antall_dager === 0 || lastFristEvent.antall_dager === undefined);

    if (erKunVarsel) {
      if (harMottattForesporsel) {
        return 'spesifiser_foresporsel';  // Critical - must respond to BH demand
      }
      return 'spesifiser_frivillig';  // Voluntary upgrade
    }

    return 'revider';  // Standard revision mode
  }, [originalVarselType, lastFristEvent.antall_dager, harMottattForesporsel]);

  // Modal configuration based on mode
  const modalConfig = useMemo(() => {
    switch (modalMode) {
      case 'spesifiser_foresporsel':
        return {
          title: 'Svar på byggherrens forespørsel (§33.6.2)',
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
          title: `Oppdater fristkrav (${currentVersion === 0 ? 'original' : `v${currentVersion}`} → v${nextVersion})`,
          submitLabel: 'Oppdater Krav',
          submitVariant: 'primary' as const,
        };
    }
  }, [modalMode, currentVersion, nextVersion]);

  const {
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
      attachments: [],
    },
  });

  const formData = watch();
  // Use different backup keys for different modes
  const backupEventType = modalMode === 'revider' ? 'frist_krav_oppdatert' : 'frist_krav_spesifisert';
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, backupEventType, formData, isDirty);

  // Fresh values from lastFristEvent (for reset and Tilbakestill)
  const freshValues = useMemo((): ReviseFristFormData => ({
    antall_dager: modalMode === 'revider' ? lastFristEvent.antall_dager : 0,
    begrunnelse: '',
    ny_sluttdato: '',
    attachments: [],
  }), [modalMode, lastFristEvent.antall_dager]);

  // Reset form with latest values when modal opens
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;

      // Check for backup and merge with fresh values (backup takes precedence, but fills gaps)
      if (hasBackup && !isDirty) {
        const backup = getBackup();
        if (backup) {
          reset({ ...freshValues, ...backup });
          toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
          return;
        }
      }

      // No backup - use fresh values
      reset(freshValues);
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, isDirty, getBackup, reset, toast, freshValues]);

  // Handle reset to fresh values (Tilbakestill button)
  const handleReset = () => {
    clearBackup();
    reset(freshValues);
  };

  const antallDager = watch('antall_dager');

  // Validation: Only for specification modes (revider allows same days with updated begrunnelse)
  const erUgyldigDager = useMemo(() => {
    if (modalMode === 'revider') {
      return false;  // Allow same days - user may only update begrunnelse/documentation
    } else {
      // For specification: days must be > 0
      return antallDager === 0 || antallDager === undefined;
    }
  }, [antallDager, modalMode]);

  // Track pending toast for dismissal
  const pendingToastId = useRef<string | null>(null);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: (result) => {
      // Dismiss pending toast and show success
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      clearBackup();
      reset();
      onOpenChange(false);
      toast.success(
        modalMode === 'revider' ? 'Fristkrav revidert' : 'Fristkrav spesifisert',
        modalMode === 'revider'
          ? 'Det reviderte kravet er registrert og sendt til byggherre.'
          : 'Kravet er nå spesifisert og sendt til byggherre.'
      );
      if (!result.catenda_synced) {
        onCatendaWarning?.();
      }
    },
    onError: (error) => {
      // Dismiss pending toast
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      }
    },
  });

  const onSubmit = (data: ReviseFristFormData) => {
    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending(
      modalMode === 'revider' ? 'Sender revidert krav...' : 'Sender spesifisert krav...',
      'Vennligst vent mens kravet behandles.'
    );

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
      // Specification event (voluntary or in response to foresporsel)
      mutation.mutate({
        eventType: 'frist_krav_spesifisert',
        data: {
          original_event_id: lastFristEvent.event_id,
          antall_dager: data.antall_dager,
          begrunnelse: data.begrunnelse,
          er_svar_pa_foresporsel: modalMode === 'spesifiser_foresporsel',
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
        {/* Critical warning for foresporsel mode */}
        {modalMode === 'spesifiser_foresporsel' && (
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
              Sen spesifisering medfører at kravet reduseres til det byggherren «måtte forstå» (§33.6.1).
            </p>
          </Alert>
        )}

        {/* Seksjon 2: Nytt krav */}
        <SectionContainer
          title={modalMode === 'revider' ? 'Revidert krav' : 'Spesifisert krav'}
          description={modalMode === 'revider'
            ? 'Angi nytt antall dager for fristforlengelse'
            : 'Spesifiser antall dager fristforlengelse'}
        >
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
          {erUgyldigDager && modalMode !== 'revider' && (
            <p className="text-sm text-pkt-brand-orange-700">
              Du må angi antall dager (mer enn 0) for å sende spesifisert krav.
            </p>
          )}

          {/* Ny sluttdato - only for specification modes */}
          {modalMode !== 'revider' && (
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
          )}
        </SectionContainer>

        {/* Seksjon 3: Begrunnelse */}
        <SectionContainer
          title="Begrunnelse"
          description={modalMode === 'revider'
            ? 'Forklar hvorfor du endrer kravet'
            : 'Begrunn kravet med henvisning til årsakssammenheng'}
        >
          {/* TODO: Legg til hovedkategori prop for å støtte §33.3 (force majeure) */}
          <KontraktsregelInline hjemmel="§33.1" />

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
                  placeholder={modalMode !== 'revider'
                    ? 'Begrunn kravet om fristforlengelse (årsakssammenheng, dokumentasjon av hindring)'
                    : undefined}
                />
              )}
            />
          </FormField>
        </SectionContainer>

        {/* Seksjon 4: Vedlegg */}
        <SectionContainer
          title="Vedlegg"
          description="Last opp dokumentasjon"
          optional
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
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-3 pt-6 border-t-2 border-pkt-border-subtle">
          {/* Venstre: Tilbakestill (kun synlig når isDirty) */}
          <div>
            {isDirty && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isSubmitting}
              >
                Tilbakestill
              </Button>
            )}
          </div>

          {/* Høyre: Avbryt + Hovedhandling */}
          <div className="flex gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              variant={modalConfig.submitVariant}
              disabled={isSubmitting || !watch('begrunnelse') || erUgyldigDager}
            >
              {isSubmitting ? 'Sender...' : modalConfig.submitLabel}
            </Button>
          </div>
        </div>
      </form>

      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />
    </Modal>
  );
}
