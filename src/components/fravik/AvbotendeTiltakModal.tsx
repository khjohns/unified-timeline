/**
 * AvbotendeTiltakModal Component
 *
 * Modal for editing mitigating measures and consequences of rejection.
 * Uses React Hook Form + Zod for validation.
 */

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  AlertDialog,
  Button,
  FormField,
  Modal,
  SectionContainer,
  Textarea,
  useToast,
} from '../primitives';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useFormBackup } from '../../hooks/useFormBackup';
import { useFravikSubmit } from '../../hooks/useFravikSubmit';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';

// Schema for form validation
const avbotendeTiltakSchema = z.object({
  avbotende_tiltak: z
    .string()
    .min(10, 'Beskrivelse av avbøtende tiltak må være minst 10 tegn'),
  konsekvenser_ved_avslag: z
    .string()
    .min(10, 'Beskrivelse av konsekvenser må være minst 10 tegn'),
});

type AvbotendeTiltakFormData = z.infer<typeof avbotendeTiltakSchema>;

interface AvbotendeTiltakModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  initialData?: {
    avbotende_tiltak?: string;
    konsekvenser_ved_avslag?: string;
  };
  onSuccess?: () => void;
}

export function AvbotendeTiltakModal({
  open,
  onOpenChange,
  sakId,
  initialData,
  onSuccess,
}: AvbotendeTiltakModalProps) {
  const toast = useToast();
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
  } = useForm<AvbotendeTiltakFormData>({
    resolver: zodResolver(avbotendeTiltakSchema),
    defaultValues: {
      avbotende_tiltak: initialData?.avbotende_tiltak || '',
      konsekvenser_ved_avslag: initialData?.konsekvenser_ved_avslag || '',
    },
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (open && initialData) {
      reset({
        avbotende_tiltak: initialData.avbotende_tiltak || '',
        konsekvenser_ved_avslag: initialData.konsekvenser_ved_avslag || '',
      });
    }
  }, [open, initialData, reset]);

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  // Form backup for token expiry protection
  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    'avbotende_tiltak',
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
    if (backup) {
      reset(backup);
    }
    setShowRestorePrompt(false);
  };

  const handleDiscardBackup = () => {
    clearBackup();
    setShowRestorePrompt(false);
  };

  const mutation = useFravikSubmit({
    onSuccess: (result) => {
      clearBackup();
      reset();
      onOpenChange(false);
      if (result.type === 'oppdater') {
        toast.success('Lagret', 'Avbøtende tiltak og konsekvenser er oppdatert.');
        onSuccess?.();
      }
    },
    onError: (error) => {
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      } else {
        toast.error('Feil ved lagring', error.message);
      }
    },
  });

  const onSubmit = (data: AvbotendeTiltakFormData) => {
    mutation.mutate({
      type: 'oppdater',
      sakId,
      data: {
        avbotende_tiltak: data.avbotende_tiltak,
        konsekvenser_ved_avslag: data.konsekvenser_ved_avslag,
      },
      aktor: 'bruker', // TODO: Get from auth context
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Avbøtende tiltak og konsekvenser"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Avbøtende tiltak */}
        <SectionContainer
          title="Avbøtende tiltak"
          description="Beskriv hvilke tiltak som gjøres for å redusere miljøpåvirkningen"
        >
          <FormField
            label="Beskrivelse av tiltak"
            required
            error={errors.avbotende_tiltak?.message}
            helpText="Hvilke kompenserende tiltak planlegges for å redusere utslipp eller miljøpåvirkning?"
          >
            <Textarea
              id="avbotende_tiltak"
              {...register('avbotende_tiltak')}
              rows={5}
              fullWidth
              error={!!errors.avbotende_tiltak}
              placeholder="F.eks. bruk av HVO100 drivstoff, redusert kjøretid, elektriske hjelpemaskiner..."
            />
          </FormField>
        </SectionContainer>

        {/* Konsekvenser ved avslag */}
        <SectionContainer
          title="Konsekvenser ved avslag"
          description="Beskriv hva som skjer hvis søknaden ikke innvilges"
        >
          <FormField
            label="Beskrivelse av konsekvenser"
            required
            error={errors.konsekvenser_ved_avslag?.message}
            helpText="Hvilke konsekvenser får det for prosjektet hvis fraviket ikke innvilges?"
          >
            <Textarea
              id="konsekvenser_ved_avslag"
              {...register('konsekvenser_ved_avslag')}
              rows={5}
              fullWidth
              error={!!errors.konsekvenser_ved_avslag}
              placeholder="F.eks. forsinkelse i prosjektet, økte kostnader, alternativ løsning ikke tilgjengelig..."
            />
          </FormField>
        </SectionContainer>

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved lagring">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-4 pt-6 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting || mutation.isPending}
            className="w-full sm:w-auto order-1 sm:order-2"
          >
            Lagre
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
        onOpenChange={(openState) => {
          if (!openState) handleDiscardBackup();
        }}
        title="Gjenopprette lagrede data?"
        description="Det finnes data fra en tidligere økt som ikke ble sendt inn. Vil du fortsette der du slapp?"
        confirmLabel="Gjenopprett"
        cancelLabel="Start på nytt"
        onConfirm={handleRestoreBackup}
        variant="info"
      />

      {/* Token expired alert */}
      <TokenExpiredAlert
        open={showTokenExpired}
        onClose={() => setShowTokenExpired(false)}
      />
    </Modal>
  );
}
