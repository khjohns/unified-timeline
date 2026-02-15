/**
 * BentoRespondGrunnlag Component
 *
 * Form panel for card-anchored grunnlag response.
 * Renders to the right of CaseMasterCard in interactive mode.
 *
 * This panel is a pure begrunnelse editor + submit surface.
 * All controls (varslet-i-tide, verdict) and consequences live in CaseMasterCard.
 * Event payload is built by useGrunnlagBridge.
 *
 * Follows ADR-003 pattern — identical structure to BentoRespondFrist.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Badge,
  Button,
  DataList,
  DataListItem,
  FormField,
  RichTextEditor,
  useToast,
} from '../primitives';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useFormBackup } from '../../hooks/useFormBackup';
import { useCatendaStatusHandler } from '../../hooks/useCatendaStatusHandler';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import type { GrunnlagBridgeComputed } from '../../hooks/useGrunnlagBridge';
import type { GrunnlagResponsResultat, SakState } from '../../types/timeline';

// ============================================================================
// SCHEMA
// ============================================================================

const bentoGrunnlagSchema = z.object({
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
});

type BentoGrunnlagFormData = z.infer<typeof bentoGrunnlagSchema>;

// ============================================================================
// LABELS
// ============================================================================

const RESULTAT_LABELS: Record<GrunnlagResponsResultat, string> = {
  godkjent: 'Godkjent',
  avslatt: 'Avslatt',
  frafalt: 'Frafalt (§32.3 c)',
};

// ============================================================================
// TYPES
// ============================================================================

export interface BentoRespondGrunnlagProps {
  sakId: string;
  grunnlagEventId: string;
  // Bridge (readonly computed + event builder)
  computed: GrunnlagBridgeComputed;
  buildEventData: (params: { grunnlagEventId: string; begrunnelse: string }) => Record<string, unknown>;
  validate: () => boolean;
  // Callbacks
  onSuccess: () => void;
  onCancel: () => void;
  onCatendaWarning?: () => void;
  approvalEnabled?: boolean;
  onSaveDraft?: (draftData: {
    resultat: string;
    begrunnelse: string;
    formData: Record<string, unknown>;
  }) => void;
  // Update mode context
  lastResponseEvent?: {
    event_id: string;
    resultat: GrunnlagResponsResultat;
  };
  sakState?: SakState;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BentoRespondGrunnlag({
  sakId,
  grunnlagEventId,
  computed,
  buildEventData,
  validate,
  onSuccess,
  onCancel,
  onCatendaWarning,
  approvalEnabled = false,
  onSaveDraft,
  lastResponseEvent,
  sakState,
}: BentoRespondGrunnlagProps) {
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
  } = useForm<BentoGrunnlagFormData>({
    resolver: zodResolver(bentoGrunnlagSchema),
    defaultValues: {
      begrunnelse: '',
    },
  });

  const formData = watch();
  const eventType = computed.isUpdateMode ? 'respons_grunnlag_oppdatert' : 'respons_grunnlag';
  const { clearBackup, hasBackup, getBackup } = useFormBackup(
    sakId, eventType, formData, isDirty
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
      toast.success(
        computed.isUpdateMode ? 'Svar oppdatert' : 'Svar sendt',
        computed.isUpdateMode
          ? 'Din endring av svaret på ansvarsgrunnlaget er registrert.'
          : 'Ditt svar på ansvarsgrunnlaget er registrert.'
      );
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

  // Track manual edits to begrunnelse (L5 — ready for auto-begrunnelse)
  const userHasEditedBegrunnelseRef = useRef(false);

  // Auto-populate begrunnelse when auto-begrunnelse changes (if not manually edited)
  useEffect(() => {
    if (computed.autoBegrunnelse && !userHasEditedBegrunnelseRef.current) {
      formSetValue('begrunnelse', computed.autoBegrunnelse);
    }
  }, [computed.autoBegrunnelse, formSetValue]);

  const markBegrunnelseAsEdited = useCallback(() => {
    userHasEditedBegrunnelseRef.current = true;
  }, []);

  const handleRegenerBegrunnelse = useCallback(() => {
    if (computed.autoBegrunnelse) {
      formSetValue('begrunnelse', computed.autoBegrunnelse, { shouldDirty: true });
      userHasEditedBegrunnelseRef.current = false;
    }
  }, [computed.autoBegrunnelse, formSetValue]);

  // Submit handler — bridge builds the full event payload (L12)
  const onSubmit = (data: BentoGrunnlagFormData) => {
    if (!validate()) return;

    pendingToastId.current = toast.pending(
      computed.isUpdateMode ? 'Lagrer endringer...' : 'Sender svar...',
      'Vennligst vent mens svaret behandles.'
    );

    mutation.mutate({
      eventType,
      data: buildEventData({ grunnlagEventId, begrunnelse: data.begrunnelse }),
    });
  };

  const handleSaveDraft = (data: BentoGrunnlagFormData) => {
    if (!onSaveDraft) return;
    if (!validate()) return;

    onSaveDraft({
      resultat: computed.prinsipaltResultat || '',
      begrunnelse: data.begrunnelse,
      formData: buildEventData({ grunnlagEventId, begrunnelse: data.begrunnelse }),
    });

    clearBackup();
    reset();
    onSuccess();
    toast.success('Utkast lagret', 'Svaret på ansvarsgrunnlaget er lagret som utkast.');
  };

  // Update mode context
  const forrigeResultat = lastResponseEvent?.resultat;
  const varAvvist = forrigeResultat === 'avslatt';
  const harSubsidiaereSvar = sakState?.er_subsidiaert_vederlag || sakState?.er_subsidiaert_frist;
  const forrigeBegrunnelse = sakState?.grunnlag?.bh_begrunnelse;

  return (
    <div className="bg-pkt-bg-subtle rounded-lg p-4 max-h-[70vh] overflow-y-auto">
      <TokenExpiredAlert open={showTokenExpired} onClose={() => setShowTokenExpired(false)} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Update mode: current response banner */}
        {computed.isUpdateMode && lastResponseEvent && (
          <div className="rounded-lg border border-pkt-border-subtle bg-pkt-bg-subtle p-4">
            <p className="text-[10px] font-medium text-pkt-text-body-muted uppercase tracking-wide mb-2">Nåværende svar</p>
            <DataList variant="grid">
              <DataListItem label="Resultat">
                <Badge variant={varAvvist ? 'danger' : 'success'}>
                  {forrigeResultat ? RESULTAT_LABELS[forrigeResultat] : 'Ukjent'}
                </Badge>
              </DataListItem>
              {forrigeBegrunnelse && (
                <DataListItem label="Begrunnelse">
                  <span className="italic">&ldquo;{forrigeBegrunnelse}&rdquo;</span>
                </DataListItem>
              )}
            </DataList>
            {harSubsidiaereSvar && varAvvist && (
              <p className="text-xs text-pkt-grays-gray-500 mt-2">
                Det finnes subsidiaere svar på vederlag og/eller frist.
              </p>
            )}
          </div>
        )}

        {/* Update mode: Snuoperasjon alert */}
        {computed.isUpdateMode && computed.erSnuoperasjon && harSubsidiaereSvar && (
          <Alert variant="success" title="Snuoperasjon: Subsidiaere svar blir prinsipale">
            <p>
              Ved å godkjenne grunnlaget nå, vil alle subsidiaere svar på vederlag og frist
              automatisk konverteres til <strong>prinsipale</strong> svar.
            </p>
            <ul className="list-disc pl-5 mt-2 text-xs">
              {sakState?.er_subsidiaert_vederlag && (
                <li>
                  Vederlag: &ldquo;{sakState.visningsstatus_vederlag}&rdquo; blir gjeldende uten forbehold
                </li>
              )}
              {sakState?.er_subsidiaert_frist && (
                <li>
                  Frist: &ldquo;{sakState.visningsstatus_frist}&rdquo; blir gjeldende uten forbehold
                </li>
              )}
            </ul>
          </Alert>
        )}

        {/* Passivitetsvarsel (>10 dager) */}
        {computed.erPassiv && (
          <Alert variant="danger" size="sm" title="Passivitetsrisiko (§32.3)">
            Du har brukt <strong>{computed.dagerSidenVarsel} dager</strong> på å svare.
            Passivitet kan medføre at forholdet anses som en endring.
          </Alert>
        )}

        {/* Validation error when resultat is not selected in card */}
        {!computed.prinsipaltResultat && (
          <Alert variant="danger" size="sm">
            Velg resultat i kortet til venstre
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
                id="grunnlag-begrunnelse"
                value={field.value ?? ''}
                onChange={(value) => {
                  field.onChange(value);
                  markBegrunnelseAsEdited();
                }}
                className="text-xs"
                minHeight={280}
                fullWidth
                error={!!errors.begrunnelse}
                placeholder={computed.dynamicPlaceholder}
              />
            )}
          />
          {computed.autoBegrunnelse && (
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
        <div className="sticky bottom-0 bg-pkt-bg-subtle pt-1">
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4 pb-1 border-t-2 border-pkt-border-subtle">
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
                variant={computed.prinsipaltResultat === 'avslatt' || computed.erPrekludert ? 'danger' : 'primary'}
                size="sm"
                disabled={isSubmitting || !computed.prinsipaltResultat}
                data-testid="respond-grunnlag-submit"
              >
                {isSubmitting ? 'Sender...' : (
                  computed.isUpdateMode
                    ? (computed.erSnuoperasjon ? 'Godkjenn ansvarsgrunnlag' : 'Lagre endring')
                    : 'Send svar'
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
