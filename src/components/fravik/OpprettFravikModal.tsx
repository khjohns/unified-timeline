/**
 * OpprettFravikModal Component
 *
 * Modal for creating a new fravik-søknad (exemption application).
 * Uses React Hook Form + Zod for validation.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  AlertDialog,
  Button,
  Checkbox,
  DatePicker,
  FormField,
  Input,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  Textarea,
  useToast,
} from '../primitives';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useFormBackup } from '../../hooks/useFormBackup';
import { useFravikSubmit } from '../../hooks/useFravikSubmit';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import {
  opprettSoknadSchema,
  type OpprettSoknadFormData,
  SOKNAD_TYPE_OPTIONS,
} from './schemas';

interface OpprettFravikModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpprettFravikModal({ open, onOpenChange }: OpprettFravikModalProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    control,
    watch,
  } = useForm<OpprettSoknadFormData>({
    resolver: zodResolver(opprettSoknadSchema),
    defaultValues: {
      prosjekt_id: '',
      prosjekt_navn: '',
      prosjekt_nummer: '',
      rammeavtale: '',
      hovedentreprenor: '',
      soker_navn: '',
      soker_epost: '',
      soknad_type: 'machine',
      er_haste: false,
      haste_begrunnelse: '',
      frist_for_svar: '',
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  // Form backup for token expiry protection
  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    'fravik-new',
    'opprett_soknad',
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
      if (result.type === 'opprett') {
        toast.success('Søknad opprettet', 'Du kan nå legge til maskiner og sende inn søknaden.');
        navigate(`/fravik/${result.sakId}`);
      }
    },
    onError: (error) => {
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      } else {
        toast.error('Feil ved opprettelse', error.message);
      }
    },
  });

  // Watch conditional fields
  const erHaste = watch('er_haste');

  const onSubmit = (data: OpprettSoknadFormData) => {
    // Clean up empty optional fields
    const cleanData = {
      ...data,
      soker_epost: data.soker_epost || undefined,
      prosjekt_nummer: data.prosjekt_nummer || undefined,
      rammeavtale: data.rammeavtale || undefined,
      hovedentreprenor: data.hovedentreprenor || undefined,
      haste_begrunnelse: data.er_haste ? data.haste_begrunnelse : undefined,
      frist_for_svar: data.frist_for_svar || undefined,
    };

    mutation.mutate({
      type: 'opprett',
      data: cleanData,
      aktor: 'bruker', // TODO: Get from auth context
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Opprett fravik-søknad"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Prosjektinformasjon */}
        <SectionContainer
          title="Prosjektinformasjon"
          description="Informasjon om prosjektet søknaden gjelder"
        >
          <div className="space-y-4">
            <FormField
              label="Prosjektnavn"
              required
              error={errors.prosjekt_navn?.message}
            >
              <Input
                id="prosjekt_navn"
                {...register('prosjekt_navn')}
                error={!!errors.prosjekt_navn}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Prosjekt-ID"
                required
                error={errors.prosjekt_id?.message}
              >
                <Input
                  id="prosjekt_id"
                  {...register('prosjekt_id')}
                  error={!!errors.prosjekt_id}
                />
              </FormField>

              <FormField
                label="Prosjektnummer"
                error={errors.prosjekt_nummer?.message}
              >
                <Input
                  id="prosjekt_nummer"
                  {...register('prosjekt_nummer')}
                  error={!!errors.prosjekt_nummer}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Rammeavtale"
                error={errors.rammeavtale?.message}
              >
                <Input
                  id="rammeavtale"
                  {...register('rammeavtale')}
                  error={!!errors.rammeavtale}
                />
              </FormField>

              <FormField
                label="Hovedentreprenør"
                error={errors.hovedentreprenor?.message}
              >
                <Input
                  id="hovedentreprenor"
                  {...register('hovedentreprenor')}
                  error={!!errors.hovedentreprenor}
                />
              </FormField>
            </div>
          </div>
        </SectionContainer>

        {/* Søkerinformasjon */}
        <SectionContainer
          title="Søkerinformasjon"
          description="Hvem søker om fravik?"
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Ditt navn"
              required
              error={errors.soker_navn?.message}
            >
              <Input
                id="soker_navn"
                {...register('soker_navn')}
                error={!!errors.soker_navn}
              />
            </FormField>

            <FormField
              label="E-postadresse"
              error={errors.soker_epost?.message}
            >
              <Input
                id="soker_epost"
                type="email"
                {...register('soker_epost')}
                error={!!errors.soker_epost}
              />
            </FormField>
          </div>
        </SectionContainer>

        {/* Søknadstype */}
        <SectionContainer
          title="Type søknad"
          description="Velg hva søknaden gjelder"
        >
          <FormField error={errors.soknad_type?.message}>
            <Controller
              name="soknad_type"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  error={!!errors.soknad_type}
                >
                  {SOKNAD_TYPE_OPTIONS.map((option) => (
                    <RadioItem key={option.value} value={option.value} label={option.label} />
                  ))}
                </RadioGroup>
              )}
            />
          </FormField>
        </SectionContainer>

        {/* Hastebehandling */}
        <SectionContainer
          title="Hastebehandling"
          description="Marker hvis søknaden haster"
          collapsible
          defaultOpen={false}
        >
          <div className="space-y-4">
            <Controller
              name="er_haste"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="er_haste"
                  label="Dette er en hastesøknad"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            {erHaste && (
              <div className="ml-6 space-y-4 border-l-2 border-pkt-border-subtle pl-4">
                <FormField
                  label="Begrunnelse for hastebehandling"
                  required
                  error={errors.haste_begrunnelse?.message}
                >
                  <Textarea
                    id="haste_begrunnelse"
                    {...register('haste_begrunnelse')}
                    rows={3}
                    fullWidth
                    error={!!errors.haste_begrunnelse}
                  />
                </FormField>

                <FormField
                  label="Ønsket frist for svar"
                  error={errors.frist_for_svar?.message}
                >
                  <Controller
                    name="frist_for_svar"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="frist_for_svar"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </FormField>
              </div>
            )}
          </div>
        </SectionContainer>

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved opprettelse">
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
            Opprett søknad
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
