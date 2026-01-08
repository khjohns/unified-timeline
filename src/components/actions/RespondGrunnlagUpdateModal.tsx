/**
 * RespondGrunnlagUpdateModal Component
 *
 * Modal for BH to change their response on grunnlag (the "snuoperasjon").
 * CRITICAL: When changing from AVVIST to GODKJENT, all subsidiary
 * vederlag/frist responses become principal.
 */

import {
  Alert,
  AlertDialog,
  Badge,
  Button,
  FormField,
  Modal,
  RadioGroup,
  RadioItem,
  SectionContainer,
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
import { GrunnlagResponsResultat, SakState } from '../../types/timeline';

const updateResponseSchema = z.object({
  nytt_resultat: z.string().min(1, 'Du må velge et svar'),
  begrunnelse: z.string().min(10, 'Begrunnelse er påkrevd'),
});

type UpdateResponseFormData = z.infer<typeof updateResponseSchema>;

interface RespondGrunnlagUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  lastResponseEvent: {
    event_id: string;
    resultat: GrunnlagResponsResultat;
  };
  sakState: SakState;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
}

const RESULTAT_LABELS: Record<GrunnlagResponsResultat | 'frafalt', string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  erkjenn_fm: 'Force Majeure (§33.3)',
  frafalt: 'Frafalt (§32.3 c)',
};

export function RespondGrunnlagUpdateModal({
  open,
  onOpenChange,
  sakId,
  lastResponseEvent,
  sakState,
  onCatendaWarning,
}: RespondGrunnlagUpdateModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const forrigeResultat = lastResponseEvent.resultat;
  const varAvvist = forrigeResultat === 'avslatt';
  const harSubsidiaereSvar = sakState.er_subsidiaert_vederlag || sakState.er_subsidiaert_frist;

  // Check if grunnlag is irregular change (§32.3 c - frafall only for irregular)
  const erIrregulaer = useMemo(() => {
    const grunnlag = sakState.grunnlag;
    if (!grunnlag) return false;
    const underkategorier = Array.isArray(grunnlag.underkategori)
      ? grunnlag.underkategori
      : grunnlag.underkategori ? [grunnlag.underkategori] : [];
    return grunnlag.hovedkategori === 'ENDRING' && underkategorier.includes('IRREG');
  }, [sakState.grunnlag]);

  // Get previous begrunnelse from grunnlag state
  const forrigeBegrunnelse = sakState.grunnlag?.bh_begrunnelse;

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    control,
    watch,
    reset,
  } = useForm<UpdateResponseFormData>({
    resolver: zodResolver(updateResponseSchema),
    defaultValues: {
      nytt_resultat: '',
      begrunnelse: '',
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'respons_grunnlag_oppdatert', formData, isDirty);

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

  const nyttResultat = watch('nytt_resultat') as GrunnlagResponsResultat;

  // Check if changing from rejected to approved
  const erSnuoperasjon = useMemo(() => {
    return varAvvist && (nyttResultat === 'godkjent' || nyttResultat === 'delvis_godkjent');
  }, [varAvvist, nyttResultat]);

  // Asymmetrisk endringsrett: BH kan kun endre til TEs gunst
  // Fra avslått kan BH snu til godkjent/delvis_godkjent
  // Fra delvis_godkjent kan BH kun øke til godkjent
  // Fra godkjent kan BH IKKE endre (allerede maksimalt til TEs gunst)
  const varDelvisGodkjent = forrigeResultat === 'delvis_godkjent';
  const varGodkjent = forrigeResultat === 'godkjent';

  // Check if trying to withdraw an approval (going from godkjent to rejected)
  // Note: This shouldn't be possible due to asymmetric change rights
  const trekkeTilbakeGodkjenning = varGodkjent && nyttResultat === 'avslatt';

  // Get available options based on current state - kun endringer til TEs gunst
  const getOptions = () => {
    const options: { value: GrunnlagResponsResultat | 'frafalt'; label: string; description?: string }[] = [];

    if (varAvvist) {
      // Fra avslått: Kan snu til godkjent eller delvis_godkjent (til TEs gunst)
      options.push({
        value: 'godkjent',
        label: 'Snu til: Godkjent',
        description: harSubsidiaereSvar
          ? 'VIKTIG: Alle subsidiære svar på vederlag/frist blir prinsipale.'
          : 'Ansvar aksepteres fullt ut.',
      });
      options.push({
        value: 'delvis_godkjent',
        label: 'Snu til: Delvis godkjent',
        description: 'Delvis aksept av ansvarsgrunnlaget.',
      });
      // Frafall only for irregular changes (§32.3 c) - dette er til TEs gunst (arbeidet utgår)
      if (erIrregulaer) {
        options.push({
          value: 'frafalt',
          label: 'Frafall pålegget (§32.3 c)',
          description: 'Arbeidet skal IKKE utføres. Endringssaken bortfaller.',
        });
      }
    } else if (varDelvisGodkjent) {
      // Fra delvis_godkjent: Kan kun øke til godkjent (til TEs gunst)
      options.push({
        value: 'godkjent',
        label: 'Øk til: Godkjent fullt',
        description: harSubsidiaereSvar
          ? 'VIKTIG: Alle subsidiære svar på vederlag/frist blir prinsipale.'
          : 'Ansvar aksepteres fullt ut.',
      });
    }
    // Fra godkjent: Ingen alternativer - standpunktet er bindende

    return options;
  };

  const mutation = useSubmitEvent(sakId, {
    onSuccess: (result) => {
      clearBackup();
      reset();
      onOpenChange(false);
      if (!result.catenda_synced) {
        onCatendaWarning?.();
      }
    },
    onError: (error) => {
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      }
    },
  });

  const onSubmit = (data: UpdateResponseFormData) => {
    mutation.mutate({
      eventType: 'respons_grunnlag_oppdatert',
      data: {
        original_respons_id: lastResponseEvent.event_id,
        resultat: data.nytt_resultat,
        begrunnelse: data.begrunnelse,
        dato_endret: new Date().toISOString().split('T')[0],
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Endre svar på grunnlag"
      description="Endre din vurdering av ansvarsgrunnlaget."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Nåværende svar */}
        <SectionContainer title="Nåværende svar" variant="subtle">
          <div className="flex items-center gap-3">
            <span className="text-sm text-pkt-grays-gray-600">Resultat:</span>
            <Badge variant={varAvvist ? 'danger' : 'success'}>
              {RESULTAT_LABELS[forrigeResultat]}
            </Badge>
          </div>
          {forrigeBegrunnelse && (
            <p className="text-sm text-pkt-grays-gray-700 mt-2 italic">
              &ldquo;{forrigeBegrunnelse}&rdquo;
            </p>
          )}
          {harSubsidiaereSvar && varAvvist && (
            <p className="text-xs text-pkt-grays-gray-500 mt-2">
              Det finnes subsidiære svar på vederlag og/eller frist.
            </p>
          )}
        </SectionContainer>

        {/* Snuoperasjon alert - CRITICAL */}
        {erSnuoperasjon && harSubsidiaereSvar && (
          <Alert variant="success" title="Snuoperasjon: Subsidiære svar blir prinsipale">
            <p>
              Ved å godkjenne grunnlaget nå, vil alle subsidiære svar på vederlag og frist
              automatisk konverteres til <strong>prinsipale</strong> svar.
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm">
              {sakState.er_subsidiaert_vederlag && (
                <li>
                  Vederlag: "{sakState.visningsstatus_vederlag}" blir gjeldende uten forbehold
                </li>
              )}
              {sakState.er_subsidiaert_frist && (
                <li>
                  Frist: "{sakState.visningsstatus_frist}" blir gjeldende uten forbehold
                </li>
              )}
            </ul>
          </Alert>
        )}

        {/* Info when already approved - standpoint is binding */}
        {varGodkjent && (
          <Alert variant="info" title="Standpunktet er bindende">
            <p>
              Du har allerede godkjent ansvarsgrunnlaget. Dette standpunktet er bindende
              og kan ikke endres til entreprenørens ugunst.
            </p>
          </Alert>
        )}

        {/* Endring av svar */}
        <SectionContainer
          title="Endring av svar"
          description="Velg nytt resultat. Kun endringer til entreprenørens gunst er tillatt."
        >
          <FormField
            label="Ny avgjørelse"
            required
            error={errors.nytt_resultat?.message}
          >
            <Controller
              name="nytt_resultat"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  {getOptions().map((option) => (
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
        </SectionContainer>

        {/* Begrunnelse */}
        <SectionContainer title="Begrunnelse">
          <FormField
            label="Begrunnelse for endring"
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
                  placeholder={
                    erSnuoperasjon
                      ? 'Begrunn hvorfor du nå aksepterer ansvarsgrunnlaget...'
                      : trekkeTilbakeGodkjenning
                        ? 'Begrunn hvorfor godkjenningen trekkes tilbake...'
                        : 'Begrunn endringen...'
                  }
                />
              )}
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
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !nyttResultat || varGodkjent}
          >
            {isSubmitting ? 'Lagrer...' : erSnuoperasjon ? 'Godkjenn grunnlag' : 'Lagre endring'}
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
