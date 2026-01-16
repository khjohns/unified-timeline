/**
 * InfrastrukturModal Component
 *
 * Modal for editing infrastructure data in an infrastructure-type fravik søknad.
 * Used when soknad_type='infrastructure' (as opposed to 'machine').
 *
 * Uses React Hook Form + Zod for validation.
 */

import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  AlertDialog,
  AttachmentUpload,
  Button,
  Checkbox,
  DateRangePicker,
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
import { infrastrukturSchema, type InfrastrukturFormData } from './schemas';
import type { InfrastrukturTilstand, InfrastrukturData } from '../../types/fravik';

interface InfrastrukturModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  currentVersion?: number;
  initialData?: InfrastrukturTilstand;
  onSuccess?: () => void;
}

export function InfrastrukturModal({
  open,
  onOpenChange,
  sakId,
  currentVersion,
  initialData,
  onSuccess,
}: InfrastrukturModalProps) {
  const toast = useToast();
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const isEditMode = !!initialData;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    control,
    watch,
    setValue,
  } = useForm<InfrastrukturFormData>({
    resolver: zodResolver(infrastrukturSchema),
    defaultValues: {
      start_dato: initialData?.start_dato || '',
      slutt_dato: initialData?.slutt_dato || '',
      stromtilgang_beskrivelse: initialData?.stromtilgang_beskrivelse || '',
      mobil_batteri_vurdert: initialData?.mobil_batteri_vurdert || false,
      midlertidig_nett_vurdert: initialData?.midlertidig_nett_vurdert || false,
      alternative_metoder: initialData?.alternative_metoder || '',
      prosjektspesifikke_forhold: initialData?.prosjektspesifikke_forhold || '',
      kostnadsvurdering: initialData?.kostnadsvurdering || '',
      erstatningslosning: initialData?.erstatningslosning || '',
      attachments: [],
    },
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (open && initialData) {
      reset({
        start_dato: initialData.start_dato || '',
        slutt_dato: initialData.slutt_dato || '',
        stromtilgang_beskrivelse: initialData.stromtilgang_beskrivelse || '',
        mobil_batteri_vurdert: initialData.mobil_batteri_vurdert || false,
        midlertidig_nett_vurdert: initialData.midlertidig_nett_vurdert || false,
        alternative_metoder: initialData.alternative_metoder || '',
        prosjektspesifikke_forhold: initialData.prosjektspesifikke_forhold || '',
        kostnadsvurdering: initialData.kostnadsvurdering || '',
        erstatningslosning: initialData.erstatningslosning || '',
        attachments: [],
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
    'infrastruktur',
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
      const successMessage = isEditMode
        ? 'Infrastruktur-data er oppdatert.'
        : 'Infrastruktur-data er lagt til.';
      toast.success(isEditMode ? 'Oppdatert' : 'Lagt til', successMessage);
      onSuccess?.();
    },
    onError: (error) => {
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      } else {
        toast.error('Feil ved lagring', error.message);
      }
    },
  });

  const onSubmit = (data: InfrastrukturFormData) => {
    // Remove attachments from payload (handled separately) and build InfrastrukturData
    const infrastrukturPayload: InfrastrukturData = {
      start_dato: data.start_dato,
      slutt_dato: data.slutt_dato,
      stromtilgang_beskrivelse: data.stromtilgang_beskrivelse,
      mobil_batteri_vurdert: data.mobil_batteri_vurdert,
      midlertidig_nett_vurdert: data.midlertidig_nett_vurdert,
      alternative_metoder: data.alternative_metoder || undefined,
      prosjektspesifikke_forhold: data.prosjektspesifikke_forhold,
      kostnadsvurdering: data.kostnadsvurdering,
      erstatningslosning: data.erstatningslosning,
    };

    mutation.mutate({
      type: isEditMode ? 'infrastruktur_oppdatert' : 'infrastruktur_lagt_til',
      sakId,
      data: infrastrukturPayload,
      aktor: 'bruker', // TODO: Get from auth context
      expectedVersion: currentVersion,
    });
  };

  // Watch for date range
  const startDato = watch('start_dato');
  const sluttDato = watch('slutt_dato');

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditMode ? 'Rediger infrastruktur-data' : 'Legg til infrastruktur-data'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Periode */}
        <SectionContainer
          title="Bruksperiode"
          description="Angi perioden fraviket gjelder for"
        >
          <FormField
            label="Periode"
            required
            error={errors.start_dato?.message || errors.slutt_dato?.message}
          >
            <DateRangePicker
              value={{ from: startDato, to: sluttDato }}
              onChange={(range) => {
                setValue('start_dato', range.from || '');
                setValue('slutt_dato', range.to || '');
              }}
              error={!!(errors.start_dato || errors.slutt_dato)}
            />
          </FormField>
        </SectionContainer>

        {/* Strømtilgang */}
        <SectionContainer
          title="Strømtilgang på byggeplassen"
          description="Beskriv utfordringer med strømtilgang"
        >
          <FormField
            label="Beskrivelse av strømtilgangutfordringer"
            required
            error={errors.stromtilgang_beskrivelse?.message}
            helpText="Hvor er nærmeste tilkoblingspunkt? Hva er tilgjengelig elektrisk effekt (kW/kVA)?"
          >
            <Textarea
              id="stromtilgang_beskrivelse"
              {...register('stromtilgang_beskrivelse')}
              rows={4}
              fullWidth
              error={!!errors.stromtilgang_beskrivelse}
            />
          </FormField>
        </SectionContainer>

        {/* Vurderte alternativer */}
        <SectionContainer
          title="Vurderte alternativer"
          description="Hvilke alternative løsninger er vurdert?"
        >
          <div className="space-y-4">
            <Controller
              name="mobil_batteri_vurdert"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="mobil_batteri_vurdert"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label="Mobile batteriløsninger er vurdert"
                />
              )}
            />

            <Controller
              name="midlertidig_nett_vurdert"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="midlertidig_nett_vurdert"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label="Midlertidig nett (transformatorstasjon) er vurdert"
                />
              )}
            />

            <FormField
              label="Andre alternative løsninger"
              error={errors.alternative_metoder?.message}
              helpText="F.eks. endret arbeidsmetode, bruk av mindre maskiner som ikke krever like mye effekt"
            >
              <Textarea
                id="alternative_metoder"
                {...register('alternative_metoder')}
                rows={3}
                fullWidth
                error={!!errors.alternative_metoder}
              />
            </FormField>
          </div>
        </SectionContainer>

        {/* Prosjektspesifikke forhold */}
        <SectionContainer
          title="Prosjektspesifikke forhold"
          description="Forhold som påvirker muligheten for utslippsfri drift"
        >
          <FormField
            label="Beskrivelse av prosjektspesifikke forhold"
            required
            error={errors.prosjektspesifikke_forhold?.message}
            helpText="F.eks. plassmangel, HMS, støy, adkomstforhold etc."
          >
            <Textarea
              id="prosjektspesifikke_forhold"
              {...register('prosjektspesifikke_forhold')}
              rows={4}
              fullWidth
              error={!!errors.prosjektspesifikke_forhold}
            />
          </FormField>
        </SectionContainer>

        {/* Kostnadsvurdering */}
        <SectionContainer
          title="Kostnadsvurdering"
          description="Vurdering av kostnader for alternative løsninger"
        >
          <FormField
            label="Kostnadsvurdering"
            required
            error={errors.kostnadsvurdering?.message}
            helpText="Er merkostnaden for utslippsfri drift >10% av prosjektkostnaden? Vær konkret med tall og estimater."
          >
            <Textarea
              id="kostnadsvurdering"
              {...register('kostnadsvurdering')}
              rows={4}
              fullWidth
              error={!!errors.kostnadsvurdering}
            />
          </FormField>
        </SectionContainer>

        {/* Erstatningsløsning */}
        <SectionContainer
          title="Erstatningsløsning"
          description="Hvilken løsning skal brukes i stedet for utslippsfri drift?"
        >
          <FormField
            label="Beskrivelse av erstatningsløsning"
            required
            error={errors.erstatningslosning?.message}
            helpText="F.eks. Dieselaggregat (Euro 6) på HVO100"
          >
            <Textarea
              id="erstatningslosning"
              {...register('erstatningslosning')}
              rows={3}
              fullWidth
              error={!!errors.erstatningslosning}
            />
          </FormField>
        </SectionContainer>

        {/* Vedlegg */}
        <SectionContainer
          title="Vedlegg"
          description="Last opp relevant dokumentasjon (valgfritt)"
        >
          <Controller
            name="attachments"
            control={control}
            render={({ field }) => (
              <AttachmentUpload
                value={field.value || []}
                onChange={field.onChange}
                accept={{
                  'application/pdf': ['.pdf'],
                  'application/msword': ['.doc'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                  'application/vnd.ms-excel': ['.xls'],
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                  'image/*': ['.jpg', '.jpeg', '.png'],
                }}
                maxSize={10 * 1024 * 1024}
                multiple
              />
            )}
          />
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
            {isEditMode ? 'Lagre endringer' : 'Legg til'}
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
