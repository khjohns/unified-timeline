/**
 * ReviseVederlagModal Component
 *
 * Modal for TE to revise vederlag claim amount, method, or related fields.
 *
 * KEY FEATURES:
 * - Shows context from previous claim and BH response
 * - Allows method change (TE can change freely)
 * - Allows updating krever_justert_ep and varslet_for_oppstart
 * - Validates that something has actually changed
 * - Forces kostnadsoverslag when BH has hold_tilbake status
 *
 * §30.2: ANY increase in overslag triggers varslingsplikt
 *
 * UPDATED (2025-12-17):
 * - Added BH response context display
 * - Added method change support
 * - Added krever_justert_ep and varslet_for_oppstart fields
 * - Added validation that values have changed
 * - Added hold_tilbake handling (forces overslag)
 */

import {
  Alert,
  AlertDialog,
  AttachmentUpload,
  Badge,
  Button,
  Checkbox,
  Collapsible,
  CurrencyInput,
  FormField,
  Modal,
  RadioGroup,
  RadioItem,
  RevisionTag,
  SectionContainer,
  Textarea,
} from '../primitives';
import type { AttachmentFile } from '../../types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import type { VederlagBeregningResultat } from '../../types/timeline';

// Metode type synced with SendVederlagModal
type VederlagsMetode = 'ENHETSPRISER' | 'REGNINGSARBEID' | 'FASTPRIS_TILBUD';

const METODE_LABELS: Record<VederlagsMetode, string> = {
  ENHETSPRISER: 'Enhetspriser (§34.3)',
  REGNINGSARBEID: 'Regningsarbeid (§34.4)',
  FASTPRIS_TILBUD: 'Fastpris/Tilbud (§34.2.1)',
};

const METODE_DESCRIPTIONS: Record<VederlagsMetode, string> = {
  ENHETSPRISER: 'Beregning basert på kontraktens enhetspriser',
  REGNINGSARBEID: 'Kostnader faktureres løpende etter medgått tid og materialer',
  FASTPRIS_TILBUD: 'Avtalt fastpris. Ved avslag faller oppgjøret tilbake på enhetspriser (§34.3) eller regningsarbeid (§34.4)',
};

const RESULTAT_LABELS: Record<VederlagBeregningResultat, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  hold_tilbake: 'Holder tilbake (§30.2)',
};

const RESULTAT_VARIANTS: Record<VederlagBeregningResultat, 'success' | 'warning' | 'danger'> = {
  godkjent: 'success',
  delvis_godkjent: 'warning',
  avslatt: 'danger',
  hold_tilbake: 'warning',
};

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

// Last vederlag event info - what TE previously submitted
interface LastVederlagEventInfo {
  event_id: string;
  metode: VederlagsMetode;
  belop_direkte?: number;
  kostnads_overslag?: number;
  begrunnelse?: string;
  krever_justert_ep?: boolean;
  varslet_for_oppstart?: boolean;
}

// BH response context - what BH answered (if any)
interface BhResponseInfo {
  resultat: VederlagBeregningResultat;
  godkjent_belop?: number;
  aksepterer_metode?: boolean;
  oensket_metode?: VederlagsMetode;
  ep_justering_akseptert?: boolean;
  begrunnelse?: string;
}

interface ReviseVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  lastVederlagEvent: LastVederlagEventInfo;
  /** Current version number (0 = original, 1+ = revisions). Next revision will be currentVersion + 1. */
  currentVersion?: number;
  /** BH's response to the claim (if any) */
  bhResponse?: BhResponseInfo;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
}

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const reviseVederlagSchema = z.object({
  // Method - all options shown, original pre-selected
  metode: z.enum(['ENHETSPRISER', 'REGNINGSARBEID', 'FASTPRIS_TILBUD']),

  // Amount fields
  nytt_belop_direkte: z.number().optional(),
  nytt_kostnads_overslag: z.number().optional(),

  // Method-related fields
  krever_justert_ep: z.boolean().optional(),
  varslet_for_oppstart: z.boolean().optional(),

  // Required
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
});

type ReviseVederlagFormData = z.infer<typeof reviseVederlagSchema>;

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviseVederlagModal({
  open,
  onOpenChange,
  sakId,
  lastVederlagEvent,
  currentVersion = 0,
  bhResponse,
  onCatendaWarning,
}: ReviseVederlagModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  // This revision will become the next version
  const nextVersion = currentVersion + 1;

  // Determine current effective metode
  const forrigeMetode = lastVederlagEvent.metode;
  const erRegningsarbeid = forrigeMetode === 'REGNINGSARBEID';
  const erEnhetspriser = forrigeMetode === 'ENHETSPRISER';

  // Get current values based on metode
  const forrigeBelop = erRegningsarbeid
    ? lastVederlagEvent.kostnads_overslag
    : lastVederlagEvent.belop_direkte;

  // BH context
  const harBhSvar = bhResponse !== undefined;
  const erHoldTilbake = bhResponse?.resultat === 'hold_tilbake';
  const bhAvvisteMetode = bhResponse?.aksepterer_metode === false;
  const bhAvvisteEpJustering =
    lastVederlagEvent.krever_justert_ep && bhResponse?.ep_justering_akseptert === false;

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    control,
    watch,
    reset,
    setValue,
  } = useForm<ReviseVederlagFormData>({
    resolver: zodResolver(reviseVederlagSchema),
    defaultValues: {
      metode: lastVederlagEvent.metode,
      nytt_belop_direkte: erRegningsarbeid ? undefined : lastVederlagEvent.belop_direkte,
      nytt_kostnads_overslag: erRegningsarbeid ? lastVederlagEvent.kostnads_overslag : undefined,
      krever_justert_ep: lastVederlagEvent.krever_justert_ep ?? false,
      varslet_for_oppstart: lastVederlagEvent.varslet_for_oppstart ?? true,
      begrunnelse: '',
      attachments: [],
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'vederlag_krav_oppdatert', formData, isDirty);

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

  // Watch form values
  const selectedMetode = watch('metode');
  const nyttBelopDirekte = watch('nytt_belop_direkte');
  const nyttKostnadsOverslag = watch('nytt_kostnads_overslag');
  const kreverJustertEp = watch('krever_justert_ep');
  const varsletForOppstart = watch('varslet_for_oppstart');

  // Selected metode determines field display
  const nyErRegningsarbeid = selectedMetode === 'REGNINGSARBEID';
  const nyErEnhetspriser = selectedMetode === 'ENHETSPRISER';

  // Get the relevant amount based on effective metode
  const nyttBelop = nyErRegningsarbeid ? nyttKostnadsOverslag : nyttBelopDirekte;

  // §30.2 andre ledd: ANY increase in overslag triggers varslingsplikt
  const overslagsokningVarselpliktig = useMemo(() => {
    if (!nyErRegningsarbeid) return false;
    if (!nyttKostnadsOverslag) return false;

    // If changing TO regningsarbeid, any overslag is new
    if (selectedMetode === 'REGNINGSARBEID' && forrigeMetode !== 'REGNINGSARBEID') {
      return true;
    }

    // If already regningsarbeid, check for increase
    if (!lastVederlagEvent.kostnads_overslag) return true;
    return nyttKostnadsOverslag > lastVederlagEvent.kostnads_overslag;
  }, [
    nyErRegningsarbeid,
    nyttKostnadsOverslag,
    selectedMetode,
    forrigeMetode,
    lastVederlagEvent.kostnads_overslag,
  ]);

  // Calculate change amount (for display)
  const belopEndring = useMemo(() => {
    if (!nyttBelop || !forrigeBelop) return null;
    // Only show change if same metode type
    if (selectedMetode !== forrigeMetode) return null;
    return nyttBelop - forrigeBelop;
  }, [nyttBelop, forrigeBelop, selectedMetode, forrigeMetode]);

  // Allow revision with only begrunnelse update (no field changes required)
  const harEndringer = true;

  // Hold tilbake: Must provide overslag
  const manglerPaakrevdOverslag = useMemo(() => {
    if (!erHoldTilbake) return false;
    // If changing to regningsarbeid or staying regningsarbeid, must have overslag
    if (nyErRegningsarbeid) {
      return !nyttKostnadsOverslag || nyttKostnadsOverslag <= 0;
    }
    return false;
  }, [erHoldTilbake, nyErRegningsarbeid, nyttKostnadsOverslag]);

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

  const onSubmit = (data: ReviseVederlagFormData) => {
    const erRegning = data.metode === 'REGNINGSARBEID';
    const erEP = data.metode === 'ENHETSPRISER';

    mutation.mutate({
      eventType: 'vederlag_krav_oppdatert',
      data: {
        original_event_id: lastVederlagEvent.event_id,

        // Use same field names as initial claim for consistency
        metode: data.metode,
        belop_direkte: erRegning ? undefined : data.nytt_belop_direkte,
        kostnads_overslag: erRegning ? data.nytt_kostnads_overslag : undefined,

        // Method-related fields
        krever_justert_ep: erEP ? data.krever_justert_ep : undefined,
        varslet_for_oppstart: erRegning ? data.varslet_for_oppstart : undefined,

        begrunnelse: data.begrunnelse,
        dato_revidert: new Date().toISOString().split('T')[0],
      },
    });
  };

  // Reset amount fields when method changes
  const handleMetodeChange = (newMetode: string) => {
    setValue('metode', newMetode as VederlagsMetode);
    // Clear amount fields when switching metode type
    setValue('nytt_belop_direkte', undefined);
    setValue('nytt_kostnads_overslag', undefined);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Revider vederlagskrav"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Revision info header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-pkt-text-body-subtle">Nåværende:</span>
            {currentVersion === 0 ? (
              <Badge variant="neutral">Original</Badge>
            ) : (
              <RevisionTag version={currentVersion} size="sm" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-pkt-text-body-subtle">Oppretter:</span>
            <RevisionTag version={nextVersion} size="sm" />
          </div>
        </div>

        {/* Seksjon 1: Nåværende status */}
        <SectionContainer title="Nåværende status" variant="subtle">
          <div className="space-y-4">
            {/* Ditt forrige krav - inline */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>
                <span className="text-pkt-text-body-subtle">Metode:</span>{' '}
                <span className="font-medium">{METODE_LABELS[forrigeMetode]}</span>
              </span>
              <span className="text-pkt-border-subtle">|</span>
              <span>
                <span className="text-pkt-text-body-subtle">
                  {erRegningsarbeid ? 'Overslag:' : 'Beløp:'}
                </span>{' '}
                <span className="font-mono font-bold">
                  kr {forrigeBelop?.toLocaleString('nb-NO') ?? 0},-
                </span>
              </span>
              {erEnhetspriser && lastVederlagEvent.krever_justert_ep && (
                <>
                  <span className="text-pkt-border-subtle">|</span>
                  <Badge variant="info">Justert EP</Badge>
                </>
              )}
            </div>

            {/* Byggherrens svar - collapsible */}
            {harBhSvar && bhResponse && (
              <Collapsible
                title="Byggherrens svar"
                defaultOpen={false}
              >
                <div className="space-y-3 text-sm">
                  {/* Resultat badge */}
                  <div className="flex justify-between items-center">
                    <span className="text-pkt-text-body-subtle">Resultat:</span>
                    <Badge variant={RESULTAT_VARIANTS[bhResponse.resultat]}>
                      {RESULTAT_LABELS[bhResponse.resultat]}
                    </Badge>
                  </div>

                  {/* Godkjent beløp */}
                  {bhResponse.godkjent_belop != null && (
                    <div className="flex justify-between">
                      <span className="text-pkt-text-body-subtle">Godkjent beløp:</span>
                      <span className="font-mono font-medium">
                        kr {bhResponse.godkjent_belop.toLocaleString('nb-NO')},-
                        {forrigeBelop && forrigeBelop > 0 && (
                          <span className="text-pkt-text-body-subtle ml-2">
                            ({((bhResponse.godkjent_belop / forrigeBelop) * 100).toFixed(0)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Metode-vurdering */}
                  {bhResponse.aksepterer_metode !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-pkt-text-body-subtle">Metode:</span>
                      {bhResponse.aksepterer_metode ? (
                        <Badge variant="success">Akseptert</Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="danger">Avvist</Badge>
                          {bhResponse.oensket_metode && (
                            <span className="text-xs">
                              → Ønsker {METODE_LABELS[bhResponse.oensket_metode]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* EP-justering */}
                  {lastVederlagEvent.krever_justert_ep &&
                    bhResponse.ep_justering_akseptert !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-pkt-text-body-subtle">EP-justering (§34.3.3):</span>
                        <Badge variant={bhResponse.ep_justering_akseptert ? 'success' : 'danger'}>
                          {bhResponse.ep_justering_akseptert ? 'Akseptert' : 'Avvist'}
                        </Badge>
                      </div>
                    )}

                  {/* Begrunnelse */}
                  {bhResponse.begrunnelse && (
                    <div className="pt-2 border-t border-pkt-border-subtle">
                      <span className="text-pkt-text-body-subtle block mb-1">Begrunnelse:</span>
                      <p className="italic text-pkt-text-body whitespace-pre-line">
                        &ldquo;{bhResponse.begrunnelse}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </Collapsible>
            )}
          </div>
        </SectionContainer>

        {/* Hold tilbake alert */}
        {erHoldTilbake && (
          <Alert variant="danger" title="Tilbakeholdelse (§30.2)">
            <p>
              Byggherren holder tilbake betaling fordi du ikke har levert kostnadsoverslag.
              Du <strong>må</strong> levere et kostnadsoverslag for å oppheve tilbakeholdelsen.
            </p>
          </Alert>
        )}

        {/* BH ønsker annen metode */}
        {bhAvvisteMetode && bhResponse?.oensket_metode && (
          <Alert variant="warning" title="Byggherren ønsker annen metode">
            <p>
              Byggherren har avvist din foreslåtte metode og ønsker{' '}
              <strong>{METODE_LABELS[bhResponse.oensket_metode]}</strong>.
              Vurder om du vil endre metode.
            </p>
          </Alert>
        )}

        {/* BH avviste EP-justering */}
        {bhAvvisteEpJustering && (
          <Alert variant="warning" title="EP-justering avvist (§34.3.3)">
            <p>
              Byggherren har avvist kravet om justerte enhetspriser.
              Du kan velge å opprettholde kravet eller droppe det.
            </p>
          </Alert>
        )}

        <div className="border-t-2 border-pkt-border-subtle pt-6">
          <h4 className="font-bold text-sm mb-4">Revider kravet</h4>

          {/* ============================================
              METODE-ENDRING
              ============================================ */}
          <div className="space-y-4 mb-6">
            <Controller
              name="endre_metode"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="endre_metode"
                  label="Endre beregningsmetode"
                  description={`Nåværende: ${METODE_LABELS[forrigeMetode]}`}
                  checked={field.value}
                  onCheckedChange={handleMetodeChange}
                />
              )}
            />

            {endreMetode && (
              <div className="ml-6 p-4 border-l-2 border-pkt-border-subtle bg-pkt-bg-subtle">
                <FormField label="Velg ny metode" required>
                  <Controller
                    name="ny_metode"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup value={field.value ?? ''} onValueChange={handleNyMetodeChange}>
                        {(['ENHETSPRISER', 'REGNINGSARBEID', 'FASTPRIS_TILBUD'] as const)
                          .filter((m) => m !== forrigeMetode)
                          .map((metode) => (
                            <RadioItem
                              key={metode}
                              value={metode}
                              label={METODE_LABELS[metode]}
                              description={
                                bhResponse?.oensket_metode === metode
                                  ? `${METODE_DESCRIPTIONS[metode]} ← Byggherrens ønskede metode`
                                  : METODE_DESCRIPTIONS[metode]
                              }
                            />
                          ))}
                      </RadioGroup>
                    )}
                  />
                </FormField>
              </div>
            )}
          </div>

          {/* ============================================
              BELØP / KOSTNADSOVERSLAG
              ============================================ */}
          <div className="space-y-4 mb-6">
            {nyErRegningsarbeid ? (
              <FormField
                label="Kostnadsoverslag"
                required={erHoldTilbake}
                helpText="Estimert totalkostnad for regningsarbeidet"
                error={manglerPaakrevdOverslag ? 'Kostnadsoverslag er påkrevd for å oppheve tilbakeholdelse' : undefined}
              >
                <Controller
                  name="nytt_kostnads_overslag"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value ?? null}
                      onChange={field.onChange}
                      error={manglerPaakrevdOverslag}
                    />
                  )}
                />
              </FormField>
            ) : (
              <FormField
                label={effektivMetode === 'FASTPRIS_TILBUD' ? 'Tilbudt fastpris' : 'Beløp'}
                helpText={
                  effektivMetode === 'ENHETSPRISER'
                    ? 'Bruk negativt beløp for fradrag (§34.4)'
                    : undefined
                }
              >
                <Controller
                  name="nytt_belop_direkte"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value ?? null}
                      onChange={field.onChange}
                      allowNegative={effektivMetode === 'ENHETSPRISER'}
                    />
                  )}
                />
              </FormField>
            )}

            {/* Change display */}
            {belopEndring !== null && belopEndring !== 0 && forrigeBelop && (
              <div
                className={`p-3 rounded-none border-2 ${
                  belopEndring > 0
                    ? 'bg-pkt-surface-faded-red border-pkt-border-red'
                    : 'bg-pkt-surface-faded-green border-pkt-border-green'
                }`}
              >
                <p className="text-sm">
                  Endring:{' '}
                  <strong
                    className={
                      belopEndring > 0 ? 'text-pkt-brand-red-1000' : 'text-pkt-brand-dark-green-1000'
                    }
                  >
                    {belopEndring > 0 ? '+' : ''}
                    {belopEndring.toLocaleString('nb-NO')} kr
                  </strong>{' '}
                  ({((belopEndring / forrigeBelop) * 100).toFixed(1)}%)
                </p>
              </div>
            )}
          </div>

          {/* ============================================
              METODE-RELATERTE FELT
              ============================================ */}
          {nyErEnhetspriser && (
            <div className="mb-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <Controller
                name="krever_justert_ep"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="krever_justert_ep"
                    label="Krever justerte enhetspriser (§34.3.3)"
                    description="Gjelder når forutsetningene for enhetsprisene forrykkes, f.eks. pga. endret omfang, tidspunkt eller antall endringsarbeider (§34.3.2)"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />

              {kreverJustertEp && bhAvvisteEpJustering && (
                <Alert variant="warning" className="mt-3">
                  Du opprettholder kravet om justerte enhetspriser selv om BH avviste det.
                  Begrunn hvorfor du mener varselet var i tide.
                </Alert>
              )}

              {kreverJustertEp && !bhAvvisteEpJustering && (
                <Alert variant="info" className="mt-3">
                  Krav om justerte enhetspriser må varsles «uten ugrunnet opphold» etter at forholdet oppsto.
                  Uten rettidig varsel har du bare krav på den justering BH «måtte forstå» (§34.3.3).
                </Alert>
              )}
            </div>
          )}

          {nyErRegningsarbeid && (
            <div className="mb-6 p-4 border-2 border-pkt-border-subtle rounded-none">
              <Controller
                name="varslet_for_oppstart"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="varslet_for_oppstart"
                    label="Byggherren ble varslet før regningsarbeidet startet (§34.4)"
                    description="Kreves for å ha krav på alle nødvendige kostnader"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />

              {!varsletForOppstart && (
                <Alert variant="danger" className="mt-3">
                  Uten forhåndsvarsel har du bare krav på det byggherren «måtte forstå» at du har
                  hatt av utgifter (§30.3.1).
                </Alert>
              )}
            </div>
          )}

          {/* Overslag increase warning (§30.2) */}
          {overslagsokningVarselpliktig && (
            <Alert variant="danger" title="Varslingsplikt (§30.2 andre ledd)">
              <p>
                Du øker kostnadsoverslaget. I henhold til §30.2 andre ledd <strong>må</strong> du
                varsle BH &ldquo;uten ugrunnet opphold&rdquo; når det er grunn til å anta at
                overslaget vil bli overskredet.
              </p>
              <p className="mt-2 text-sm">
                Ved å sende denne revisjonen dokumenterer du varselet. Begrunn hvorfor kostnadene
                øker.
              </p>
            </Alert>
          )}

          {/* ============================================
              BEGRUNNELSE
              ============================================ */}
          <FormField label="Begrunnelse for revisjon" required error={errors.begrunnelse?.message}>
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
                    overslagsokningVarselpliktig
                      ? 'Begrunn hvorfor kostnadene øker utover opprinnelig overslag...'
                      : harBhSvar
                        ? 'Begrunn hvorfor du reviderer kravet basert på byggherrens svar...'
                        : 'Begrunn endringen...'
                  }
                />
              )}
            />
          </FormField>
        </div>

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

        {/* Validation warning */}
        {!harEndringer && isDirty && (
          <Alert variant="warning">
            Du har ikke gjort noen endringer i kravet. Endre beløp, metode eller andre felt for å
            kunne sende revisjonen.
          </Alert>
        )}

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
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
            variant={overslagsokningVarselpliktig ? 'danger' : 'primary'}
            disabled={isSubmitting || !harEndringer || manglerPaakrevdOverslag}
            className="w-full sm:w-auto order-1 sm:order-2"
          >
            {isSubmitting
              ? 'Sender...'
              : overslagsokningVarselpliktig
                ? 'Send Varsel om Overslagsoverskridelse'
                : 'Send Revisjon'}
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
