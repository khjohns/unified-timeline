/**
 * BentoRespondFrist Component
 *
 * Form panel for card-anchored frist response.
 * Renders to the right of FristCard in interactive mode.
 * Controls (varsling, vilkår, dager) live in FristCard — this panel
 * shows consequence callout, forsering warning, begrunnelse, and submit.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Button,
  FormField,
  RichTextEditor,
  useToast,
} from '../primitives';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useFormBackup } from '../../hooks/useFormBackup';
import { useCatendaStatusHandler } from '../../hooks/useCatendaStatusHandler';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import {
  generateFristResponseBegrunnelse,
  type FristResponseInput,
} from '../../utils/begrunnelseGenerator';
import type { SubsidiaerTrigger } from '../../types/timeline';

// ============================================================================
// SCHEMA
// ============================================================================

const bentoFristSchema = z.object({
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
});

type BentoFristFormData = z.infer<typeof bentoFristSchema>;

// ============================================================================
// TYPES
// ============================================================================

export interface BentoRespondFristProps {
  sakId: string;
  fristKravId: string;
  krevdDager?: number;
  varselType?: 'varsel' | 'spesifisert' | 'begrunnelse_utsatt';
  // External state from bridge hook
  externalFristVarselOk?: boolean;
  externalSpesifisertKravOk?: boolean;
  externalForesporselSvarOk?: boolean;
  externalVilkarOppfylt?: boolean;
  externalGodkjentDager?: number;
  externalResultat?: string;
  externalSendForesporsel?: boolean;
  // Computed from bridge
  erPrekludert?: boolean;
  erRedusert?: boolean;
  erGrunnlagSubsidiaer?: boolean;
  erGrunnlagPrekludert?: boolean;
  erForesporselSvarForSent?: boolean;
  harTidligereVarselITide?: boolean;
  subsidiaerTriggers?: SubsidiaerTrigger[];
  subsidiaertResultat?: string;
  visSubsidiaertResultat?: boolean;
  sendForesporsel?: boolean;
  // Callbacks
  onSuccess: () => void;
  onCancel: () => void;
  onCatendaWarning?: () => void;
  approvalEnabled?: boolean;
  onSaveDraft?: (data: Record<string, unknown>) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BentoRespondFrist({
  sakId,
  fristKravId,
  krevdDager = 0,
  varselType,
  externalFristVarselOk,
  externalSpesifisertKravOk,
  externalForesporselSvarOk,
  externalVilkarOppfylt,
  externalGodkjentDager,
  externalResultat,
  externalSendForesporsel,
  erPrekludert,
  erRedusert,
  erGrunnlagSubsidiaer,
  erGrunnlagPrekludert,
  erForesporselSvarForSent,
  harTidligereVarselITide,
  subsidiaerTriggers = [],
  subsidiaertResultat,
  visSubsidiaertResultat,
  sendForesporsel,
  onSuccess,
  onCancel,
  onCatendaWarning,
  approvalEnabled = false,
  onSaveDraft,
}: BentoRespondFristProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();
  const { handleCatendaStatus } = useCatendaStatusHandler({ onWarning: onCatendaWarning });

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
    setValue: formSetValue,
  } = useForm<BentoFristFormData>({
    resolver: zodResolver(bentoFristSchema),
    defaultValues: {
      begrunnelse: '',
    },
  });

  const formData = watch();
  const { clearBackup, hasBackup, getBackup } = useFormBackup(
    sakId, 'respons_frist', formData, isDirty
  );

  // Auto-restore backup on mount
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (!hasCheckedBackup.current) {
      hasCheckedBackup.current = true;
      if (hasBackup && !isDirty) {
        const backup = getBackup();
        if (backup) {
          reset({ ...backup, begrunnelse: (backup as { begrunnelse?: string }).begrunnelse ?? '' });
          toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
        }
      }
    }
  }, [hasBackup, isDirty, getBackup, reset, toast]);

  const pendingToastId = useRef<string | null>(null);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: (result) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      clearBackup();
      reset();
      onSuccess();
      toast.success('Svar sendt', 'Ditt svar på fristkravet er registrert.');
      handleCatendaStatus(result);
    },
    onError: (error) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      }
    },
  });

  // Dynamic placeholder
  const dynamicPlaceholder = useMemo(() => {
    if (!externalResultat) return 'Gjør valgene i kortet til venstre, deretter skriv begrunnelse...';
    if (externalResultat === 'godkjent') return 'Begrunn din godkjenning av fristforlengelsen...';
    if (externalResultat === 'delvis_godkjent') return 'Forklar hvorfor du kun godkjenner deler av fristforlengelsen...';
    return 'Begrunn ditt avslag på fristforlengelsen...';
  }, [externalResultat]);

  // Auto-begrunnelse from card selections
  const autoBegrunnelse = useMemo(() => {
    if (!externalResultat) return '';
    const input: FristResponseInput = {
      varselType,
      krevdDager,
      fristVarselOk: externalFristVarselOk,
      spesifisertKravOk: externalSpesifisertKravOk,
      foresporselSvarOk: externalForesporselSvarOk,
      sendForesporsel: externalSendForesporsel,
      vilkarOppfylt: externalVilkarOppfylt ?? true,
      godkjentDager: externalGodkjentDager ?? 0,
      erPrekludert: erPrekludert ?? false,
      erForesporselSvarForSent,
      erRedusert_33_6_1: erRedusert,
      harTidligereVarselITide,
      erGrunnlagSubsidiaer,
      erGrunnlagPrekludert,
      prinsipaltResultat: externalResultat,
      subsidiaertResultat,
      visSubsidiaertResultat: visSubsidiaertResultat ?? false,
    };
    return generateFristResponseBegrunnelse(input, { useTokens: true });
  }, [
    varselType, krevdDager, externalFristVarselOk, externalSpesifisertKravOk,
    externalForesporselSvarOk, externalSendForesporsel, externalVilkarOppfylt,
    externalGodkjentDager, externalResultat, erPrekludert, erForesporselSvarForSent,
    erRedusert, harTidligereVarselITide, erGrunnlagSubsidiaer, erGrunnlagPrekludert,
    subsidiaertResultat, visSubsidiaertResultat,
  ]);

  // Track manual edits to begrunnelse
  const userHasEditedBegrunnelseRef = useRef(false);

  // Auto-populate begrunnelse when auto-begrunnelse changes (if not manually edited)
  useEffect(() => {
    if (autoBegrunnelse && !userHasEditedBegrunnelseRef.current) {
      formSetValue('begrunnelse', autoBegrunnelse);
    }
  }, [autoBegrunnelse, formSetValue]);

  const markBegrunnelseAsEdited = useCallback(() => {
    userHasEditedBegrunnelseRef.current = true;
  }, []);

  const handleRegenerBegrunnelse = useCallback(() => {
    if (autoBegrunnelse) {
      formSetValue('begrunnelse', autoBegrunnelse, { shouldDirty: true });
      userHasEditedBegrunnelseRef.current = false;
    }
  }, [autoBegrunnelse, formSetValue]);

  // Submit handler
  const onSubmit = (data: BentoFristFormData) => {
    pendingToastId.current = toast.pending(
      'Sender svar...',
      'Vennligst vent mens svaret behandles.'
    );

    const godkjentDager = externalResultat !== 'avslatt' ? (externalGodkjentDager ?? 0) : 0;

    mutation.mutate({
      eventType: 'respons_frist',
      data: {
        frist_krav_id: fristKravId,

        // Port 1: Preklusjon
        frist_varsel_ok: externalFristVarselOk,
        spesifisert_krav_ok: externalSpesifisertKravOk,
        foresporsel_svar_ok: externalForesporselSvarOk,
        send_foresporsel: externalSendForesporsel,

        // Port 2: Vilkår
        vilkar_oppfylt: externalVilkarOppfylt,

        // Port 3: Beregning
        godkjent_dager: godkjentDager,

        // Port 4: Oppsummering
        begrunnelse: data.begrunnelse || autoBegrunnelse,
        auto_begrunnelse: autoBegrunnelse,

        // Automatisk beregnet
        beregnings_resultat: externalResultat,
        krevd_dager: krevdDager,

        // Subsidiært standpunkt
        subsidiaer_triggers: subsidiaerTriggers.length > 0 ? subsidiaerTriggers : undefined,
        subsidiaer_resultat: visSubsidiaertResultat ? subsidiaertResultat : undefined,
        subsidiaer_godkjent_dager: visSubsidiaertResultat && subsidiaertResultat !== 'avslatt' ? (externalGodkjentDager ?? 0) : undefined,
        subsidiaer_begrunnelse: visSubsidiaertResultat ? data.begrunnelse : undefined,
      },
    });
  };

  const handleSaveDraft = (data: BentoFristFormData) => {
    if (!onSaveDraft) return;
    onSaveDraft({
      dager: externalGodkjentDager ?? 0,
      resultat: externalResultat,
      begrunnelse: data.begrunnelse || autoBegrunnelse,
    });
    clearBackup();
    reset();
    onSuccess();
    toast.success('Utkast lagret', 'Svaret på fristkravet er lagret som utkast.');
  };

  return (
    <div className="bg-pkt-bg-subtle rounded-lg p-4 max-h-[70vh] overflow-y-auto">
      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Send forespørsel info */}
        {sendForesporsel && (
          <Alert variant="info" size="sm">
            Du sender forespørsel om spesifisering (§33.6.2). TE må svare med et spesifisert krav.
          </Alert>
        )}

        {/* Begrunnelse */}
        <FormField
          label="Byggherrens begrunnelse"
          required
          error={errors.begrunnelse?.message}
        >
          <Controller
            name="begrunnelse"
            control={control}
            render={({ field }) => (
              <RichTextEditor
                id="frist-begrunnelse"
                value={field.value ?? ''}
                onChange={(value) => {
                  field.onChange(value);
                  markBegrunnelseAsEdited();
                }}
                className="text-xs"
                minHeight={200}
                fullWidth
                error={!!errors.begrunnelse}
                placeholder={dynamicPlaceholder}
              />
            )}
          />
          {autoBegrunnelse && (
            <div className="flex justify-end mt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRegenerBegrunnelse}
              >
                Regenerer fra valg
              </Button>
            </div>
          )}
        </FormField>

        {/* Error */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4 border-t border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <div className="flex gap-2">
            {approvalEnabled && onSaveDraft && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSubmit(handleSaveDraft)}
                disabled={isSubmitting}
              >
                Lagre utkast
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || !externalResultat}
            >
              {isSubmitting ? 'Sender...' : 'Send svar'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
