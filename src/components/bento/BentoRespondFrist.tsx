/**
 * BentoRespondFrist Component
 *
 * Form panel for card-anchored frist response.
 * Renders to the right of FristCard in interactive mode.
 * Controls (varsling, vilkår, dager) live in FristCard — this panel
 * shows consequence callout, forsering warning, begrunnelse, and submit.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
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
import { getFristConsequence } from './consequenceCallout';
import { getResultatLabel } from '../../utils/formatters';
import type { SubsidiaerTrigger, FristBeregningResultat } from '../../types/timeline';

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
  visForsering?: boolean;
  avslatteDager?: number;
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
  visForsering,
  avslatteDager = 0,
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

  // Consequence callout
  const consequence = useMemo(() => getFristConsequence({
    resultat: externalResultat,
    godkjentDager: externalGodkjentDager,
    krevdDager,
    erPrekludert,
    erSubsidiaer: erGrunnlagSubsidiaer,
  }), [externalResultat, externalGodkjentDager, krevdDager, erPrekludert, erGrunnlagSubsidiaer]);

  // Dynamic placeholder
  const dynamicPlaceholder = useMemo(() => {
    if (!externalResultat) return 'Gjør valgene i kortet til venstre, deretter skriv begrunnelse...';
    if (externalResultat === 'godkjent') return 'Begrunn din godkjenning av fristforlengelsen...';
    if (externalResultat === 'delvis_godkjent') return 'Forklar hvorfor du kun godkjenner deler av fristforlengelsen...';
    return 'Begrunn ditt avslag på fristforlengelsen...';
  }, [externalResultat]);

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
        begrunnelse: data.begrunnelse,
        auto_begrunnelse: data.begrunnelse,

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
      begrunnelse: data.begrunnelse,
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
        {/* Consequence callout */}
        {consequence && (
          <Alert variant={consequence.variant} size="sm">
            {consequence.text}
          </Alert>
        )}

        {/* §33.8 Forsering warning */}
        {visForsering && avslatteDager > 0 && (
          <Alert variant="warning" size="sm" title="§33.8 Forsering-risiko">
            Du avslår <strong>{avslatteDager} dager</strong> som entreprenøren mener å ha krav på.
            Dersom avslaget er uberettiget, kan entreprenøren velge å anse det som et{' '}
            <strong>pålegg om forsering</strong>.
          </Alert>
        )}

        {/* Subsidiary summary */}
        {visSubsidiaertResultat && subsidiaertResultat && (
          <div className="text-xs text-pkt-text-body-subtle bg-pkt-bg-card rounded-md px-3 py-2 border border-pkt-border-default">
            <span className="text-pkt-text-body-muted">↳ Subsidiært: </span>
            <span className="font-medium">
              {getResultatLabel(subsidiaertResultat as FristBeregningResultat)}
            </span>
            {subsidiaertResultat !== 'avslatt' && externalGodkjentDager != null && (
              <span className="font-mono tabular-nums ml-1">
                ({externalGodkjentDager} av {krevdDager} dager)
              </span>
            )}
            {erPrekludert && (
              <span className="ml-1">dersom kravet hadde vært varslet i tide</span>
            )}
          </div>
        )}

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
                onChange={field.onChange}
                minHeight={200}
                fullWidth
                error={!!errors.begrunnelse}
                placeholder={dynamicPlaceholder}
              />
            )}
          />
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
