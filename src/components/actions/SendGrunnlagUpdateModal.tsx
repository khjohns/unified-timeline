/**
 * SendGrunnlagUpdateModal Component
 *
 * Modal for TE to update a previously sent grunnlag.
 * Important: Date changes can affect preclusion status.
 */

import {
  Alert,
  AlertDialog,
  Button,
  Checkbox,
  DatePicker,
  FormField,
  Input,
  Modal,
  SectionContainer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '../primitives';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { useMemo, useState, useEffect, useRef } from 'react';
import {
  HOVEDKATEGORI_OPTIONS,
  getUnderkategorier,
  getHovedkategoriLabel,
  getUnderkategoriLabel,
} from '../../constants';
import { beregnDagerSiden, getPreklusjonsvarsel } from '../../utils/preklusjonssjekk';
import { GrunnlagTilstand } from '../../types/timeline';

const updateSchema = z.object({
  tittel: z.string().optional(),
  beskrivelse: z.string().optional(),
  dato_oppdaget: z.string().optional(),
  hovedkategori: z.string().optional(),
  underkategori: z.array(z.string()).optional(),
  endrings_begrunnelse: z.string().min(10, 'Begrunnelse for endring er påkrevd'),
});

type UpdateFormData = z.infer<typeof updateSchema>;

interface SendGrunnlagUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  originalEvent: {
    event_id: string;
    grunnlag: GrunnlagTilstand;
  };
}

export function SendGrunnlagUpdateModal({
  open,
  onOpenChange,
  sakId,
  originalEvent,
}: SendGrunnlagUpdateModalProps) {
  const { grunnlag } = originalEvent;
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    control,
    watch,
    reset,
  } = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      tittel: grunnlag.tittel || '',
      beskrivelse: grunnlag.beskrivelse || '',
      dato_oppdaget: grunnlag.dato_oppdaget || '',
      hovedkategori: grunnlag.hovedkategori || '',
      underkategori: Array.isArray(grunnlag.underkategori)
        ? grunnlag.underkategori
        : grunnlag.underkategori
          ? [grunnlag.underkategori]
          : [],
      endrings_begrunnelse: '',
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'grunnlag_oppdatert', formData, isDirty);

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

  const nyDatoOppdaget = watch('dato_oppdaget');
  const nyHovedkategori = watch('hovedkategori');

  // Check if new date makes notice too late
  const varselErTidligere = useMemo(() => {
    if (!nyDatoOppdaget || !grunnlag.grunnlag_varsel?.dato_sendt) return false;
    const oppdagetDato = new Date(nyDatoOppdaget);
    const varselDato = new Date(grunnlag.grunnlag_varsel.dato_sendt);
    return oppdagetDato < varselDato;
  }, [nyDatoOppdaget, grunnlag.grunnlag_varsel?.dato_sendt]);

  // Calculate days between new discovery date and existing notice
  const dagerMellom = useMemo(() => {
    if (!nyDatoOppdaget || !grunnlag.grunnlag_varsel?.dato_sendt) return null;
    const oppdagetDato = new Date(nyDatoOppdaget);
    const varselDato = new Date(grunnlag.grunnlag_varsel.dato_sendt);
    const diffTime = varselDato.getTime() - oppdagetDato.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [nyDatoOppdaget, grunnlag.grunnlag_varsel?.dato_sendt]);

  // Check preclusion risk
  const preklusjonsRisiko = useMemo(() => {
    if (!dagerMellom || dagerMellom <= 0) return null;
    return getPreklusjonsvarsel(dagerMellom);
  }, [dagerMellom]);

  // Check if category is changing
  const kategoriEndres = useMemo(() => {
    return nyHovedkategori && nyHovedkategori !== grunnlag.hovedkategori;
  }, [nyHovedkategori, grunnlag.hovedkategori]);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => { clearBackup(); reset(); onOpenChange(false); },
    onError: (error) => { if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') setShowTokenExpired(true); },
  });

  const onSubmit = (data: UpdateFormData) => {
    mutation.mutate({
      eventType: 'grunnlag_oppdatert',
      data: {
        original_event_id: originalEvent.event_id,
        tittel: data.tittel !== grunnlag.tittel ? data.tittel : undefined,
        beskrivelse: data.beskrivelse !== grunnlag.beskrivelse ? data.beskrivelse : undefined,
        dato_oppdaget: data.dato_oppdaget !== grunnlag.dato_oppdaget ? data.dato_oppdaget : undefined,
        hovedkategori: kategoriEndres ? data.hovedkategori : undefined,
        underkategori: data.underkategori,
        endrings_begrunnelse: data.endrings_begrunnelse,
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Oppdater grunnlag"
      description="Endre informasjon i det innsendte grunnlaget."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Nåværende grunnlag */}
        <SectionContainer
          title="Nåværende grunnlag"
          description={`Varslet ${grunnlag.grunnlag_varsel?.dato_sendt || 'ukjent dato'}. Endringer loggføres i historikken.`}
          variant="subtle"
        >
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-pkt-grays-gray-500">Kategori:</dt>
            <dd className="font-medium">{getHovedkategoriLabel(grunnlag.hovedkategori || '')}</dd>
            <dt className="text-pkt-grays-gray-500">Oppdaget:</dt>
            <dd>{grunnlag.dato_oppdaget}</dd>
            <dt className="text-pkt-grays-gray-500">Varslet:</dt>
            <dd>{grunnlag.grunnlag_varsel?.dato_sendt || 'Ikke varslet'}</dd>
          </dl>
        </SectionContainer>

        {/* Date change warning */}
        {varselErTidligere && dagerMellom && dagerMellom > 0 && (
          <Alert
            variant={preklusjonsRisiko?.status === 'kritisk' ? 'danger' : 'warning'}
            title="Advarsel: Dato kan påvirke preklusjon"
          >
            Hvis du setter oppdaget-dato til <strong>{nyDatoOppdaget}</strong>, betyr det at
            varselet ble sendt {dagerMellom} dager etter oppdagelse.
            {preklusjonsRisiko?.alert && (
              <p className="mt-2 text-sm">{preklusjonsRisiko.alert.message}</p>
            )}
          </Alert>
        )}

        {/* Category change warning */}
        {kategoriEndres && (
          <Alert variant="warning" title="Kategoriendring">
            Du endrer kategorien fra "{getHovedkategoriLabel(grunnlag.hovedkategori || '')}"
            til "{getHovedkategoriLabel(nyHovedkategori || '')}".
            Dette kan påvirke hvilke hjemler og varslingskrav som gjelder.
          </Alert>
        )}

        {/* Redigering */}
        <SectionContainer title="Redigering">
          <div className="space-y-5">
            <FormField
              label="Tittel"
              helpText="Oppdater tittel på varselet"
            >
              <Input
                id="tittel"
                {...register('tittel')}
                fullWidth
              />
            </FormField>

            <FormField
              label="Beskrivelse / Tilleggsinfo"
              helpText="Oppdater beskrivelsen av grunnlaget"
            >
              <Textarea
                id="beskrivelse"
                {...register('beskrivelse')}
                rows={4}
                fullWidth
              />
            </FormField>

            <FormField
              label="Dato oppdaget"
              helpText="Endre kun hvis opprinnelig dato var feil"
            >
              <Controller
                name="dato_oppdaget"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    id="dato_oppdaget"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Velg dato"
                  />
                )}
              />
            </FormField>

            <FormField label="Hovedkategori">
              <Controller
                name="hovedkategori"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Velg hovedkategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOVEDKATEGORI_OPTIONS.filter(opt => opt.value !== '').map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            {nyHovedkategori && getUnderkategorier(nyHovedkategori).length > 0 && (
              <FormField label="Underkategori">
                <div className="space-y-3 max-h-48 overflow-y-auto border-2 border-pkt-border-gray rounded-none p-4 bg-pkt-bg-subtle">
                  {getUnderkategorier(nyHovedkategori).map((option) => (
                    <Checkbox
                      key={option.value}
                      id={`update-underkategori-${option.value}`}
                      label={option.label}
                      value={option.value}
                      {...register('underkategori')}
                    />
                  ))}
                </div>
              </FormField>
            )}
          </div>
        </SectionContainer>

        {/* Begrunnelse for endring */}
        <SectionContainer title="Begrunnelse for endring">
          <FormField
            label="Hvorfor endres grunnlaget?"
            required
            error={errors.endrings_begrunnelse?.message}
          >
            <Textarea
              id="endrings_begrunnelse"
              {...register('endrings_begrunnelse')}
              rows={3}
              fullWidth
              error={!!errors.endrings_begrunnelse}
              placeholder="F.eks. ny informasjon, korrigering av feil, etc."
            />
          </FormField>
        </SectionContainer>

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
            variant="primary"
            disabled={isSubmitting}
            size="lg"
          >
            {isSubmitting ? 'Lagrer...' : 'Lagre endringer'}
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
