/**
 * RespondVederlagModal Component
 *
 * Action modal for BH (client) to respond to a vederlag (compensation) claim.
 * Includes fields for approved amount and result.
 * Now includes legacy NS 8407 response options.
 *
 * UPDATED (2025-12-05):
 * - Added subsidiary badge and info when grunnlag is rejected
 * - Added §30.2 hold_tilbake option for regningsarbeid without kostnadsoverslag
 * - Added §34.1.3 rigg-preklusjon option
 * - Added §34.3.3 EP-justering alert
 * - Added display of vederlagskrav details
 *
 * UPDATED (2025-12-06):
 * - Updated saerskilt_krav interface to handle separate rigg_drift and produktivitet
 *   objects with individual belop and dato_klar_over fields (per §34.1.3)
 * - Enhanced display to show amounts and dates for each særskilt krav type
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { FormField } from '../primitives/FormField';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { Badge } from '../primitives/Badge';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/Select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import {
  BH_VEDERLAGSSVAR_OPTIONS,
  VEDERLAGSMETODER_OPTIONS,
  getBhVederlagssvarValues,
  BH_VEDERLAGSSVAR_DESCRIPTIONS,
  getVederlagsmetodeLabel,
} from '../../constants';

const respondVederlagSchema = z.object({
  resultat: z.enum(getBhVederlagssvarValues(), {
    errorMap: () => ({ message: 'Resultat er påkrevd' }),
  }),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  godkjent_belop: z.number().min(0, 'Beløp kan ikke være negativt').optional(),
  godkjent_metode: z.string().optional(),
});

type RespondVederlagFormData = z.infer<typeof respondVederlagSchema>;

// Særskilt krav item structure (§34.1.3)
interface SaerskiltKravItem {
  belop?: number;
  dato_klar_over?: string;
}

// Vederlag event info for context display and conditional logic
// Matches payload from SendVederlagModal (updated 2025-12-06)
interface VederlagEventInfo {
  metode?: 'ENHETSPRISER' | 'REGNINGSARBEID' | 'FASTPRIS_TILBUD';
  belop_direkte?: number;
  kostnads_overslag?: number;
  begrunnelse?: string;
  krever_justert_ep?: boolean;
  saerskilt_krav?: {
    rigg_drift?: SaerskiltKravItem;
    produktivitet?: SaerskiltKravItem;
  };
}

interface RespondVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the vederlag claim event being responded to (required for event sourcing) */
  vederlagKravId: string;
  krevdBelop?: number;
  /** Optional vederlag event data for context display and conditional logic */
  vederlagEvent?: VederlagEventInfo;
  /** Status of the grunnlag response (for subsidiary treatment) */
  grunnlagStatus?: 'godkjent' | 'avvist_uenig' | 'delvis_godkjent';
}

export function RespondVederlagModal({
  open,
  onOpenChange,
  sakId,
  vederlagKravId,
  krevdBelop,
  vederlagEvent,
  grunnlagStatus,
}: RespondVederlagModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
  } = useForm<RespondVederlagFormData>({
    resolver: zodResolver(respondVederlagSchema),
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const selectedResultat = watch('resultat');
  const godkjentBelop = watch('godkjent_belop');

  // Determine if this is subsidiary treatment (grunnlag was rejected)
  const erSubsidiaer = grunnlagStatus === 'avvist_uenig';

  // §30.2 Logic: Can hold back payment if regningsarbeid without kostnadsoverslag
  const kanHoldeTilbake =
    vederlagEvent?.metode === 'REGNINGSARBEID' && !vederlagEvent?.kostnads_overslag;

  // §34.3.3 Logic: Must respond to EP adjustment request
  const maSvarePaJustering =
    vederlagEvent?.metode === 'ENHETSPRISER' && vederlagEvent?.krever_justert_ep;

  // §34.1.3 Logic: Can reject rigg/drift if sent too late
  const harSaerskiltKrav =
    vederlagEvent?.saerskilt_krav?.rigg_drift !== undefined ||
    vederlagEvent?.saerskilt_krav?.produktivitet !== undefined;

  // Get method label for display
  const metodeLabel = vederlagEvent?.metode
    ? getVederlagsmetodeLabel(vederlagEvent.metode)
    : undefined;

  // Get display amount (belop_direkte for ENHETSPRISER/FASTPRIS, kostnads_overslag for REGNINGSARBEID)
  const visningsbelop = vederlagEvent?.metode === 'REGNINGSARBEID'
    ? vederlagEvent?.kostnads_overslag
    : vederlagEvent?.belop_direkte;

  const onSubmit = (data: RespondVederlagFormData) => {
    mutation.mutate({
      eventType: 'respons_vederlag',
      data: {
        vederlag_krav_id: vederlagKravId,
        ...data,
      },
    });
  };

  // Determine if we should show amount field
  const showAmountField =
    selectedResultat === 'godkjent_fullt' ||
    selectedResultat === 'delvis_godkjent' ||
    selectedResultat === 'godkjent_annen_metode';

  // Determine if we should show method field
  const showMethodField = selectedResultat === 'godkjent_annen_metode';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Svar på vederlagskrav"
      description="Vurder beregning og beløp (ren utmåling). Ansvarsvurdering håndteres i Grunnlag-sporet."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Subsidiary badge and info */}
        {erSubsidiaer && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-none">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="warning">Subsidiær behandling</Badge>
            </div>
            <p className="text-sm text-amber-900 font-medium mb-1">
              Viktig prinsipp:
            </p>
            <p className="text-sm text-amber-800">
              Du har avvist ansvarsgrunnlaget i denne saken. Dine svar nedenfor
              gjelder derfor <strong>kun subsidiært</strong>.
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm text-amber-800">
              <li>
                Hvis du svarer &ldquo;Godkjenn&rdquo;: Du godkjenner beløpet,
                men opprettholder at du ikke skal betale det (ingen endring).
              </li>
              <li>
                Dette hindrer at du senere møter et ukontrollert krav hvis
                Entreprenøren vinner frem med endringskravet.
              </li>
            </ul>
          </div>
        )}

        {/* §34.3.3 EP-justering alert */}
        {maSvarePaJustering && (
          <div
            className="p-5 bg-pkt-surface-subtle-light-red border-2 border-pkt-border-red rounded-none"
            role="alert"
          >
            <p className="text-base text-pkt-border-red font-medium">
              Svarplikt (§34.3.3)
            </p>
            <p className="text-sm text-pkt-border-red mt-1">
              TE krever justerte enhetspriser. Hvis du er uenig <strong>MÅ</strong> du
              svare nå. Passivitet kan medføre at kravet anses akseptert.
            </p>
          </div>
        )}

        {/* Display of vederlagskrav details */}
        {vederlagEvent && (metodeLabel || visningsbelop != null) && (
          <div className="p-4 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
            <h4 className="font-bold text-sm text-pkt-text-body-dark mb-2">
              Entreprenørens krav:
            </h4>
            <div className="flex justify-between items-center">
              {metodeLabel && (
                <span className="font-medium">{metodeLabel}</span>
              )}
              {visningsbelop != null && (
                <span className="text-lg font-mono">
                  {vederlagEvent.metode === 'REGNINGSARBEID'
                    ? `Overslag: kr ${visningsbelop.toLocaleString('nb-NO')},-`
                    : `kr ${visningsbelop.toLocaleString('nb-NO')},-`}
                </span>
              )}
            </div>
            {vederlagEvent.metode === 'REGNINGSARBEID' && (
              <p className="text-sm mt-1 text-pkt-text-body-subtle">
                Endelig beløp fastsettes etter medgått tid
              </p>
            )}
            {vederlagEvent.begrunnelse && (
              <p className="italic text-pkt-text-body-subtle mt-2 text-sm">
                &ldquo;{vederlagEvent.begrunnelse}&rdquo;
              </p>
            )}
            {(vederlagEvent.saerskilt_krav?.rigg_drift ||
              vederlagEvent.saerskilt_krav?.produktivitet) && (
              <div className="mt-3 pt-2 border-t border-blue-200">
                <p className="text-xs font-medium text-pkt-text-body-subtle mb-2">
                  Særskilte krav (§34.1.3):
                </p>
                <div className="flex flex-col gap-1">
                  {vederlagEvent.saerskilt_krav.rigg_drift && (
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Rigg/Drift</Badge>
                      {vederlagEvent.saerskilt_krav.rigg_drift.belop && (
                        <span className="text-sm font-mono">
                          kr {vederlagEvent.saerskilt_krav.rigg_drift.belop.toLocaleString('nb-NO')},-
                        </span>
                      )}
                      {vederlagEvent.saerskilt_krav.rigg_drift.dato_klar_over && (
                        <span className="text-xs text-gray-500">
                          (klar over: {vederlagEvent.saerskilt_krav.rigg_drift.dato_klar_over})
                        </span>
                      )}
                    </div>
                  )}
                  {vederlagEvent.saerskilt_krav.produktivitet && (
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Produktivitetstap</Badge>
                      {vederlagEvent.saerskilt_krav.produktivitet.belop && (
                        <span className="text-sm font-mono">
                          kr {vederlagEvent.saerskilt_krav.produktivitet.belop.toLocaleString('nb-NO')},-
                        </span>
                      )}
                      {vederlagEvent.saerskilt_krav.produktivitet.dato_klar_over && (
                        <span className="text-xs text-gray-500">
                          (klar over: {vederlagEvent.saerskilt_krav.produktivitet.dato_klar_over})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show claimed amount if available (fallback if no vederlagEvent) */}
        {krevdBelop != null && visningsbelop == null && (
          <div className="p-4 bg-info-100 rounded-none">
            <p className="text-sm font-medium text-info-700">
              Krevd beløp: {krevdBelop.toLocaleString('nb-NO')} NOK
            </p>
          </div>
        )}

        {/* §30.2 Tilbakeholdelse warning */}
        {kanHoldeTilbake && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-none">
            <p className="text-sm font-medium text-amber-900">
              Mangler kostnadsoverslag (§30.2)
            </p>
            <p className="text-sm text-amber-800 mt-1">
              TE har ikke levert kostnadsoverslag for regningsarbeidet. Du kan
              velge å holde tilbake betaling inntil overslag mottas.
            </p>
          </div>
        )}

        {/* Resultat - Using NS 8407 response options */}
        <FormField
          label="Resultat (vederlagsberegning)"
          required
          error={errors.resultat?.message}
          labelTooltip="Vurder BARE beregningen/beløpet. Ansvarsvurdering håndteres i Grunnlag-sporet. Subsidiær vurdering tillatt."
        >
          <Controller
            name="resultat"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger error={!!errors.resultat}>
                  <SelectValue placeholder="Velg resultat" />
                </SelectTrigger>
                <SelectContent>
                  {BH_VEDERLAGSSVAR_OPTIONS.filter(opt => {
                    // Filter out empty placeholder
                    if (opt.value === '') return false;
                    // Filter out "hold_tilbake" if NOT regningsarbeid without overslag (§30.2)
                    if (opt.value === 'hold_tilbake' && !kanHoldeTilbake) return false;
                    // Filter out "avvist_preklusjon_rigg" if NO rigg/drift claims (§34.1.3)
                    if (opt.value === 'avvist_preklusjon_rigg' && !harSaerskiltKrav) return false;
                    return true;
                  }).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        {/* Show description of selected resultat */}
        {selectedResultat && BH_VEDERLAGSSVAR_DESCRIPTIONS[selectedResultat] && (
          <div className="p-4 bg-pkt-surface-subtle rounded-none border-l-4 border-pkt-border-focus">
            <p className="text-sm text-pkt-text-body-subtle">
              {BH_VEDERLAGSSVAR_DESCRIPTIONS[selectedResultat]}
            </p>
          </div>
        )}

        {/* Godkjent beløp - show if godkjent, delvis_godkjent, or godkjent_annen_metode */}
        {showAmountField && (
          <FormField
            label="Godkjent beløp (NOK)"
            required={selectedResultat === 'godkjent_fullt'}
            error={errors.godkjent_belop?.message}
            helpText={
              krevdBelop !== undefined && godkjentBelop !== undefined
                ? `Differanse: ${(krevdBelop - godkjentBelop).toLocaleString('nb-NO')} NOK (${((godkjentBelop / krevdBelop) * 100).toFixed(1)}% godkjent)`
                : undefined
            }
          >
            <Input
              id="godkjent_belop"
              type="number"
              step="0.01"
              {...register('godkjent_belop', { valueAsNumber: true })}
              fullWidth
              placeholder="0.00"
              error={!!errors.godkjent_belop}
            />
          </FormField>
        )}

        {/* Godkjent metode - only show if godkjent_annen_metode */}
        {showMethodField && (
          <FormField
            label="Godkjent vederlagsmetode"
            required
            error={errors.godkjent_metode?.message}
            helpText="BH endrer beregningsmetode (f.eks. fra 'Regningsarbeid' til 'Fastpris'). Krever ofte aksept fra TE."
          >
            <Controller
              name="godkjent_metode"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger error={!!errors.godkjent_metode}>
                    <SelectValue placeholder="Velg metode" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEDERLAGSMETODER_OPTIONS.filter(opt => opt.value !== '').map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        )}

        {/* Begrunnelse */}
        <FormField
          label="Begrunnelse"
          required
          error={errors.begrunnelse?.message}
        >
          <Textarea
            id="begrunnelse"
            {...register('begrunnelse')}
            rows={5}
            fullWidth
            placeholder="Begrunn din vurdering av vederlagskravet..."
            error={!!errors.begrunnelse}
          />
        </FormField>

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
          <Button type="submit" variant="primary" disabled={isSubmitting} size="lg">
            {isSubmitting ? 'Sender...' : 'Send svar'}
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
    </Modal>
  );
}
