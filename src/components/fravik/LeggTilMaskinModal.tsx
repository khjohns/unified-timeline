/**
 * LeggTilMaskinModal Component
 *
 * Modal for adding a machine to an existing fravik-søknad.
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
  Input,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from '../primitives';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useFormBackup } from '../../hooks/useFormBackup';
import { useFravikSubmit } from '../../hooks/useFravikSubmit';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import {
  maskinSchema,
  type MaskinFormData,
  MASKIN_TYPE_OPTIONS,
  MASKIN_VEKT_OPTIONS,
  ARBEIDSKATEGORI_OPTIONS,
  BRUKSINTENSITET_OPTIONS,
  FRAVIK_GRUNNER,
  DRIVSTOFF_OPTIONS,
  EUROKLASSE_OPTIONS,
} from './schemas';

interface LeggTilMaskinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  currentVersion?: number;
  onSuccess?: () => void;
}

export function LeggTilMaskinModal({
  open,
  onOpenChange,
  sakId,
  currentVersion,
  onSuccess,
}: LeggTilMaskinModalProps) {
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
    setValue,
  } = useForm<MaskinFormData>({
    resolver: zodResolver(maskinSchema),
    defaultValues: {
      maskin_type: undefined,
      annet_type: '',
      vekt: undefined,
      registreringsnummer: '',
      start_dato: '',
      slutt_dato: '',
      grunner: [],
      begrunnelse: '',
      alternativer_vurdert: '',
      markedsundersokelse: false,
      undersøkte_leverandorer: '',
      erstatningsmaskin: '',
      erstatningsdrivstoff: undefined,
      euroklasse: undefined,
      arbeidsbeskrivelse: '',
      arbeidskategori: undefined,
      bruksintensitet: undefined,
      estimert_drivstofforbruk: undefined,
      attachments: [],
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
    sakId,
    'legg_til_maskin',
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
      if (result.type === 'legg_til_maskin') {
        toast.success('Maskin lagt til', 'Maskinen er nå lagt til i søknaden.');
        onSuccess?.();
      }
    },
    onError: (error) => {
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      } else {
        toast.error('Feil ved innsending', error.message);
      }
    },
  });

  // Watch conditional fields
  const maskinType = watch('maskin_type');
  const markedsundersokelse = watch('markedsundersokelse');

  const onSubmit = (data: MaskinFormData) => {
    // Clean up data - let backend generate maskin_id
    const cleanData = {
      maskin_id: '', // Backend will generate a proper UUID
      maskin_type: data.maskin_type,
      annet_type: data.maskin_type === 'Annet' ? data.annet_type : undefined,
      vekt: data.vekt,
      registreringsnummer: data.registreringsnummer || undefined,
      start_dato: data.start_dato,
      slutt_dato: data.slutt_dato,
      grunner: data.grunner,
      begrunnelse: data.begrunnelse,
      alternativer_vurdert: data.alternativer_vurdert,
      markedsundersokelse: data.markedsundersokelse,
      undersøkte_leverandorer: data.markedsundersokelse ? data.undersøkte_leverandorer : undefined,
      erstatningsmaskin: data.erstatningsmaskin,
      erstatningsdrivstoff: data.erstatningsdrivstoff,
      euroklasse: data.euroklasse,
      arbeidsbeskrivelse: data.arbeidsbeskrivelse,
      arbeidskategori: data.arbeidskategori,
      bruksintensitet: data.bruksintensitet,
      estimert_drivstofforbruk: data.estimert_drivstofforbruk || undefined,
      // Note: attachments not yet supported by backend - data.attachments are ignored for now
    };

    mutation.mutate({
      type: 'legg_til_maskin',
      sakId,
      data: cleanData,
      aktor: 'bruker', // TODO: Get from auth context
      expectedVersion: currentVersion,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Legg til maskin"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Kontraktsinformasjon */}
        <Alert variant="info" title="Krav til fravik">
          Fravik innvilges kun dersom det ikke finnes utslippsfrie alternativer på markedet.
          Fravik innvilges ikke for forhold entreprenøren kjente eller burde kjenne til ved tilbudsinnlevering.
          Ved innvilget fravik kreves minimum Euro 6/VI og dokumentert biodrivstoff (ikke palmeoljebasert).
        </Alert>

        {/* Maskintype */}
        <SectionContainer
          title="Maskintype"
          description="Velg type maskin du søker fravik for"
        >
          <div className="space-y-4">
            <FormField
              label="Type maskin"
              required
              error={errors.maskin_type?.message}
            >
              <Controller
                name="maskin_type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger error={!!errors.maskin_type}>
                      <SelectValue placeholder="Velg maskintype" />
                    </SelectTrigger>
                    <SelectContent>
                      {MASKIN_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            {maskinType === 'Annet' && (
              <FormField
                label="Spesifiser maskintype"
                required
                error={errors.annet_type?.message}
              >
                <Input
                  id="annet_type"
                  {...register('annet_type')}
                  placeholder="F.eks. kompressor, aggregat..."
                  error={!!errors.annet_type}
                />
              </FormField>
            )}

            <FormField
              label="Vektkategori"
              required
              error={errors.vekt?.message}
            >
              <Controller
                name="vekt"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    error={!!errors.vekt}
                  >
                    {MASKIN_VEKT_OPTIONS.map((option) => (
                      <RadioItem
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        description={option.description}
                      />
                    ))}
                  </RadioGroup>
                )}
              />
            </FormField>

            <FormField
              label="Registreringsnummer"
              error={errors.registreringsnummer?.message}
              helpText="Valgfritt - oppgi hvis maskinen har registreringsnummer"
            >
              <Input
                id="registreringsnummer"
                {...register('registreringsnummer')}
                error={!!errors.registreringsnummer}
              />
            </FormField>
          </div>
        </SectionContainer>

        {/* Periode */}
        <SectionContainer
          title="Bruksperiode"
          description="Når skal maskinen brukes på byggeplassen?"
        >
          <FormField
            label="Periode"
            required
            error={errors.start_dato?.message || errors.slutt_dato?.message}
          >
            <DateRangePicker
              id="periode"
              value={{
                from: watch('start_dato'),
                to: watch('slutt_dato'),
              }}
              onChange={(range) => {
                setValue('start_dato', range.from || '', { shouldValidate: true });
                setValue('slutt_dato', range.to || '', { shouldValidate: true });
              }}
              error={!!errors.start_dato || !!errors.slutt_dato}
            />
          </FormField>
        </SectionContainer>

        {/* Grunner for fravik */}
        <SectionContainer
          title="Grunner for fravik"
          description="Velg hvilke grunner som gjelder for dette fraviket"
        >
          <FormField
            error={errors.grunner?.message}
          >
            <div className="space-y-2">
              {FRAVIK_GRUNNER.map((grunn) => (
                <Controller
                  key={grunn.value}
                  name="grunner"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id={`grunn_${grunn.value}`}
                      label={grunn.label}
                      checked={field.value?.includes(grunn.value) ?? false}
                      onCheckedChange={(checked) => {
                        const currentValues = field.value ?? [];
                        if (checked) {
                          field.onChange([...currentValues, grunn.value]);
                        } else {
                          field.onChange(currentValues.filter((v: string) => v !== grunn.value));
                        }
                      }}
                    />
                  )}
                />
              ))}
            </div>
          </FormField>
        </SectionContainer>

        {/* Begrunnelse */}
        <SectionContainer
          title="Begrunnelse"
          description="Forklar hvorfor du trenger fravik for denne maskinen"
        >
          <FormField
            label="Detaljert begrunnelse"
            required
            error={errors.begrunnelse?.message}
            helpText="Beskriv hvorfor utslippsfri maskin ikke kan brukes"
          >
            <Textarea
              id="begrunnelse"
              {...register('begrunnelse')}
              rows={4}
              fullWidth
              error={!!errors.begrunnelse}
            />
          </FormField>

          <FormField
            label="Hvilke alternativer er vurdert?"
            required
            error={errors.alternativer_vurdert?.message}
            helpText="Beskriv andre løsninger du har vurdert"
          >
            <Textarea
              id="alternativer_vurdert"
              {...register('alternativer_vurdert')}
              rows={3}
              fullWidth
              error={!!errors.alternativer_vurdert}
            />
          </FormField>
        </SectionContainer>

        {/* Markedsundersøkelse */}
        <SectionContainer
          title="Markedsundersøkelse"
          description="Dokumentasjon på at utslippsfri maskin ikke er tilgjengelig"
        >
          <div className="space-y-4">
            <Controller
              name="markedsundersokelse"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="markedsundersokelse"
                  label="Jeg har gjennomført markedsundersøkelse"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            {markedsundersokelse && (
              <div className="ml-6 border-l-2 border-pkt-border-subtle pl-4">
                <FormField
                  label="Hvilke leverandører er undersøkt?"
                  required
                  error={errors.undersøkte_leverandorer?.message}
                  helpText="List opp leverandørene du har kontaktet"
                >
                  <Textarea
                    id="undersøkte_leverandorer"
                    {...register('undersøkte_leverandorer')}
                    rows={3}
                    fullWidth
                    error={!!errors.undersøkte_leverandorer}
                  />
                </FormField>
              </div>
            )}
          </div>
        </SectionContainer>

        {/* Erstatningsmaskin */}
        <SectionContainer
          title="Erstatningsmaskin"
          description="Oppgi hvilken maskin som vil brukes i stedet"
        >
          <div className="space-y-4">
            <FormField
              label="Maskin/modell"
              required
              error={errors.erstatningsmaskin?.message}
            >
              <Input
                id="erstatningsmaskin"
                {...register('erstatningsmaskin')}
                placeholder="F.eks. CAT 320"
                error={!!errors.erstatningsmaskin}
              />
            </FormField>

            <FormField
              label="Drivstoff"
              required
              error={errors.erstatningsdrivstoff?.message}
            >
              <Controller
                name="erstatningsdrivstoff"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    error={!!errors.erstatningsdrivstoff}
                  >
                    {DRIVSTOFF_OPTIONS.map((option) => (
                      <RadioItem
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        description={option.description}
                      />
                    ))}
                  </RadioGroup>
                )}
              />
            </FormField>

            <Alert variant="warning" title="Viktig om biodrivstoff">
              Palmeoljebasert biodrivstoff er ikke tillatt. Biodrivstoff må dokumenteres
              og skal være ut over omsetningskravet.
            </Alert>

            <FormField
              label="Euroklasse"
              required
              error={errors.euroklasse?.message}
              helpText="Minimum Euro 6/VI kreves ved innvilget fravik"
            >
              <Controller
                name="euroklasse"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    error={!!errors.euroklasse}
                  >
                    {EUROKLASSE_OPTIONS.map((option) => (
                      <RadioItem
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        description={option.description}
                      />
                    ))}
                  </RadioGroup>
                )}
              />
            </FormField>

            <FormField
              label="Arbeidskategori"
              required
              error={errors.arbeidskategori?.message}
            >
              <Controller
                name="arbeidskategori"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    error={!!errors.arbeidskategori}
                  >
                    {ARBEIDSKATEGORI_OPTIONS.map((option) => (
                      <RadioItem
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        description={option.description}
                      />
                    ))}
                  </RadioGroup>
                )}
              />
            </FormField>

            <FormField
              label="Arbeidsbeskrivelse"
              required
              error={errors.arbeidsbeskrivelse?.message}
              helpText="Beskriv hva maskinen skal brukes til"
            >
              <Textarea
                id="arbeidsbeskrivelse"
                {...register('arbeidsbeskrivelse')}
                rows={3}
                fullWidth
                error={!!errors.arbeidsbeskrivelse}
              />
            </FormField>
          </div>
        </SectionContainer>

        {/* Bruk og forbruk */}
        <SectionContainer
          title="Bruk og forbruk"
          description="Informasjon om bruksintensitet og estimert drivstofforbruk"
        >
          <div className="space-y-4">
            <FormField
              label="Bruksintensitet"
              required
              error={errors.bruksintensitet?.message}
            >
              <Controller
                name="bruksintensitet"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    error={!!errors.bruksintensitet}
                  >
                    {BRUKSINTENSITET_OPTIONS.map((option) => (
                      <RadioItem
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        description={option.description}
                      />
                    ))}
                  </RadioGroup>
                )}
              />
            </FormField>

            <FormField
              label="Estimert drivstofforbruk"
              error={errors.estimert_drivstofforbruk?.message}
              helpText="Oppgi forventet forbruk i liter per dag (valgfritt)"
            >
              <Input
                id="estimert_drivstofforbruk"
                type="number"
                min={0}
                step={0.1}
                {...register('estimert_drivstofforbruk', { valueAsNumber: true })}
                placeholder="F.eks. 150"
                error={!!errors.estimert_drivstofforbruk}
              />
            </FormField>
          </div>
        </SectionContainer>

        {/* Vedlegg */}
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

        {/* Sanksjonsinfo */}
        <Alert variant="warning" title="Sanksjoner ved brudd">
          Ved brudd på kravene til utslippsfrie maskiner kan det ilegges sanksjoner
          på inntil 5 % av kontraktsverdien. Sørg for at all dokumentasjon er korrekt og fullstendig.
        </Alert>

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-4 pt-6 border-t border-pkt-border-subtle">
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
            Legg til maskin
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
