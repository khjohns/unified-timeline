/**
 * SendGrunnlagModal Component
 *
 * Action modal for submitting a new grunnlag (basis/foundation) claim,
 * or updating an existing one (when originalEvent is provided).
 * Uses the shared GrunnlagForm component for consistent UI.
 *
 * MODES:
 * - Create mode (default): Submit new grunnlag with event type 'grunnlag_opprettet'
 * - Update mode (when originalEvent provided): Update existing grunnlag with 'grunnlag_oppdatert'
 */

import {
  Alert,
  AttachmentUpload,
  Button,
  InlineDataList,
  InlineDataListItem,
  Modal,
  SectionContainer,
  useToast,
} from '../primitives';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import {
  GrunnlagForm,
  grunnlagFormSchema,
  grunnlagFormRefine,
  grunnlagFormRefineMessage,
} from '../forms';
import type { AttachmentFile } from '../../types';
import type { GrunnlagTilstand } from '../../types/timeline';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useFormBackup } from '../../hooks/useFormBackup';
import { useState, useMemo, useEffect, useRef } from 'react';
import { getHovedkategoriLabel } from '../../constants';

// Schema for create mode - extends grunnlagFormSchema with attachments
const createGrunnlagSchema = grunnlagFormSchema.extend({
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
}).refine(grunnlagFormRefine, grunnlagFormRefineMessage);

// Schema for update mode - all fields optional
const updateGrunnlagSchema = z.object({
  hovedkategori: z.string().optional(),
  underkategori: z.string().optional(),
  tittel: z.string().optional(),
  beskrivelse: z.string().optional(),
  dato_oppdaget: z.string().optional(),
  varsel_sendes_na: z.boolean().optional(),
  dato_varsel_sendt: z.string().optional(),
  varsel_metode: z.array(z.string()).optional(),
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
  endrings_begrunnelse: z.string().optional(),
});

type GrunnlagFormData = z.infer<typeof createGrunnlagSchema>;

interface SendGrunnlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
  /** UPDATE MODE: When provided, modal operates in update mode */
  originalEvent?: {
    event_id: string;
    grunnlag: GrunnlagTilstand;
  };
}

export function SendGrunnlagModal({
  open,
  onOpenChange,
  sakId,
  onCatendaWarning,
  originalEvent,
}: SendGrunnlagModalProps) {
  // UPDATE MODE detection
  const isUpdateMode = !!originalEvent;
  const grunnlag = originalEvent?.grunnlag;

  const [selectedHovedkategori, setSelectedHovedkategori] = useState<string>('');
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const toast = useToast();

  // Compute default values based on mode
  const computedDefaultValues = useMemo((): Partial<GrunnlagFormData> => {
    if (isUpdateMode && grunnlag) {
      // UPDATE MODE: Pre-fill from existing grunnlag
      // Handle legacy array format by taking first element
      const underkategoriValue = Array.isArray(grunnlag.underkategori)
        ? grunnlag.underkategori[0] || ''
        : grunnlag.underkategori || '';
      return {
        hovedkategori: grunnlag.hovedkategori || '',
        underkategori: underkategoriValue,
        tittel: grunnlag.tittel || '',
        beskrivelse: grunnlag.beskrivelse || '',
        dato_oppdaget: grunnlag.dato_oppdaget || '',
        varsel_sendes_na: false, // In update mode, varsel was already sent
        dato_varsel_sendt: grunnlag.grunnlag_varsel?.dato_sendt || '',
        varsel_metode: grunnlag.grunnlag_varsel?.metode || [],
        attachments: [],
      };
    }
    // CREATE MODE: Default values
    return {
      hovedkategori: '',
      underkategori: '',
      tittel: '',
      beskrivelse: '',
      dato_oppdaget: '',
      varsel_sendes_na: true,  // Forhåndsvalgt: varsel sendes nå
      varsel_metode: [],
      attachments: [],
    };
  }, [isUpdateMode, grunnlag]);

  const form = useForm<GrunnlagFormData>({
    resolver: zodResolver(isUpdateMode ? updateGrunnlagSchema : createGrunnlagSchema),
    defaultValues: computedDefaultValues,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    setValue,
    control,
    watch,
  } = form;

  // Reset form when opening in update mode with new originalEvent
  useEffect(() => {
    if (open && isUpdateMode && originalEvent) {
      reset(computedDefaultValues);
      if (computedDefaultValues.hovedkategori) {
        setSelectedHovedkategori(computedDefaultValues.hovedkategori);
      }
    }
  }, [open, isUpdateMode, originalEvent, reset, computedDefaultValues]);

  // Form backup for token expiry protection
  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(
    sakId,
    isUpdateMode ? 'grunnlag_oppdatert' : 'grunnlag_opprettet',
    formData,
    isDirty
  );

  // Auto-restore backup on mount (silent restoration with toast notification)
  const hasCheckedBackup = useRef(false);
  useEffect(() => {
    if (open && hasBackup && !isDirty && !hasCheckedBackup.current) {
      hasCheckedBackup.current = true;
      const backup = getBackup();
      if (backup) {
        reset(backup);
        if (backup.hovedkategori) {
          setSelectedHovedkategori(backup.hovedkategori);
        }
        toast.info('Skjemadata gjenopprettet', 'Fortsetter fra forrige økt.');
      }
    }
    if (!open) {
      hasCheckedBackup.current = false;
    }
  }, [open, hasBackup, isDirty, getBackup, reset, toast]);

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
      setSelectedHovedkategori('');
      onOpenChange(false);
      toast.success(
        isUpdateMode ? 'Ansvarsgrunnlag oppdatert' : 'Varsel sendt',
        isUpdateMode
          ? 'Endringene i ansvarsgrunnlaget er registrert.'
          : 'Endringsforholdet er registrert og varslet til byggherre.'
      );
      // Show warning if Catenda sync failed
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

  // Reset underkategori when hovedkategori changes
  const handleHovedkategoriChange = (value: string) => {
    setSelectedHovedkategori(value);
    setValue('hovedkategori', value, { shouldDirty: true });
    setValue('underkategori', '', { shouldDirty: true });
  };

  const onSubmit = (data: GrunnlagFormData) => {
    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending(
      isUpdateMode ? 'Lagrer endringer...' : 'Sender varsel...',
      'Vennligst vent mens forespørselen behandles.'
    );

    // ========== UPDATE MODE SUBMIT ==========
    if (isUpdateMode && originalEvent) {
      // Only send changed fields
      const eventData: Record<string, unknown> = {
        original_event_id: originalEvent.event_id,
      };

      // Check each field for changes
      if (data.tittel !== grunnlag?.tittel) {
        eventData.tittel = data.tittel;
      }
      if (data.beskrivelse !== grunnlag?.beskrivelse) {
        eventData.beskrivelse = data.beskrivelse;
      }
      if (data.dato_oppdaget !== grunnlag?.dato_oppdaget) {
        eventData.dato_oppdaget = data.dato_oppdaget;
      }
      if (data.hovedkategori !== grunnlag?.hovedkategori) {
        eventData.hovedkategori = data.hovedkategori;
      }
      // Always include underkategori if it might have changed
      eventData.underkategori = data.underkategori;

      mutation.mutate({
        eventType: 'grunnlag_oppdatert',
        data: eventData,
      });
      return;
    }

    // ========== CREATE MODE SUBMIT ==========
    // Build VarselInfo structure
    const varselDato = data.varsel_sendes_na
      ? new Date().toISOString().split('T')[0]
      : data.dato_varsel_sendt;

    const varselMetode = data.varsel_sendes_na
      ? ['digital_oversendelse']
      : (data.varsel_metode || []);

    const grunnlagVarsel = varselDato
      ? {
          dato_sendt: varselDato,
          metode: varselMetode,
        }
      : undefined;

    mutation.mutate({
      eventType: 'grunnlag_opprettet',
      data: {
        hovedkategori: data.hovedkategori,
        underkategori: data.underkategori,
        tittel: data.tittel,
        beskrivelse: data.beskrivelse,
        dato_oppdaget: data.dato_oppdaget,
        grunnlag_varsel: grunnlagVarsel,
      },
    });
  };

  // Calculate warnings for update mode
  const nyHovedkategori = watch('hovedkategori');

  // Check if category is changing (update mode)
  const kategoriEndres = useMemo(() => {
    if (!isUpdateMode) return false;
    return nyHovedkategori && nyHovedkategori !== grunnlag?.hovedkategori;
  }, [isUpdateMode, nyHovedkategori, grunnlag?.hovedkategori]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isUpdateMode ? "Oppdater ansvarsgrunnlag" : "Varsle ansvarsgrunnlag"}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
        {/* UPDATE MODE: Current grunnlag summary */}
        {isUpdateMode && grunnlag && (
          <SectionContainer
            title="Nåværende ansvarsgrunnlag"
            variant="subtle"
          >
            <InlineDataList stackOnMobile>
              <InlineDataListItem label="Kategori" bold>
                {getHovedkategoriLabel(grunnlag.hovedkategori || '')}
              </InlineDataListItem>
              <InlineDataListItem label="Oppdaget">
                {grunnlag.dato_oppdaget}
              </InlineDataListItem>
              <InlineDataListItem label="Varslet">
                {grunnlag.grunnlag_varsel?.dato_sendt || 'Ikke varslet'}
              </InlineDataListItem>
            </InlineDataList>
          </SectionContainer>
        )}

        {/* UPDATE MODE: Category change warning */}
        {isUpdateMode && kategoriEndres && (
          <Alert variant="warning" title="Kategoriendring">
            Du endrer kategorien fra &ldquo;{getHovedkategoriLabel(grunnlag?.hovedkategori || '')}&rdquo;
            til &ldquo;{getHovedkategoriLabel(nyHovedkategori || '')}&rdquo;.
            Dette kan påvirke hvilke hjemler og varslingskrav som gjelder.
          </Alert>
        )}

        {/* Shared GrunnlagForm sections */}
        <GrunnlagForm
          form={form}
          selectedHovedkategori={selectedHovedkategori}
          onHovedkategoriChange={handleHovedkategoriChange}
          hideVarsling={isUpdateMode}
          testIdPrefix="grunnlag"
        />

        {/* Vedlegg section (unique to modal) */}
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

        {/* Guidance text - only in create mode */}
        {!isUpdateMode && (
          <p className="text-xs text-pkt-text-body-subtle">
            Dette er et nøytralt varsel om ansvarsgrunnlaget. Spesifiserte krav om penger (Vederlag)
            og tid (Frist) legger du til i egne steg etterpå.
          </p>
        )}

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            className="w-full sm:w-auto"
            data-testid="grunnlag-submit"
          >
            {isUpdateMode ? 'Lagre endringer' : 'Send varsel'}
          </Button>
        </div>
      </form>

      {/* Token expired alert */}
      <TokenExpiredAlert
        open={showTokenExpired}
        onClose={() => setShowTokenExpired(false)}
      />
    </Modal>
  );
}
