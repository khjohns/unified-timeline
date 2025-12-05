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
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { FormField } from '../primitives/FormField';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { Badge } from '../primitives/Badge';
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

// Vederlag event info for context display and conditional logic
// Matches payload from SendVederlagModal
interface VederlagEventInfo {
  metode?: 'ENHETSPRISER' | 'REGNINGSARBEID' | 'FASTPRIS_TILBUD';
  belop_direkte?: number;
  kostnads_overslag?: number;
  begrunnelse?: string;
  krever_justert_ep?: boolean;
  saerskilt_krav?: {
    rigg_drift?: boolean;
    produktivitet?: boolean;
    belop?: number;
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
    formState: { errors, isSubmitting },
    reset,
    watch,
    control,
  } = useForm<RespondVederlagFormData>({
    resolver: zodResolver(respondVederlagSchema),
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
    vederlagEvent?.saerskilt_krav?.rigg_drift || vederlagEvent?.saerskilt_krav?.produktivitet;

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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-05">
        {/* Subsidiary badge and info */}
        {erSubsidiaer && (
          <div className="p-pkt-04 bg-amber-50 border-2 border-amber-300 rounded-none">
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
            className="p-pkt-05 bg-pkt-surface-subtle-light-red border-2 border-pkt-border-red rounded-none"
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
        {vederlagEvent && (metodeLabel || visningsbelop !== undefined) && (
          <div className="p-pkt-04 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
            <h4 className="font-bold text-sm text-pkt-text-body-dark mb-2">
              Entreprenørens krav:
            </h4>
            <div className="flex justify-between items-center">
              {metodeLabel && (
                <span className="font-medium">{metodeLabel}</span>
              )}
              {visningsbelop !== undefined && (
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
              <div className="mt-2 flex gap-2">
                {vederlagEvent.saerskilt_krav.rigg_drift && (
                  <Badge variant="default">Inkl. Rigg/Drift</Badge>
                )}
                {vederlagEvent.saerskilt_krav.produktivitet && (
                  <Badge variant="default">Inkl. Produktivitetstap</Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Show claimed amount if available (fallback if no vederlagEvent) */}
        {krevdBelop !== undefined && visningsbelop === undefined && (
          <div className="p-pkt-04 bg-info-100 rounded-pkt-md">
            <p className="text-sm font-medium text-info-700">
              Krevd beløp: {krevdBelop.toLocaleString('nb-NO')} NOK
            </p>
          </div>
        )}

        {/* §30.2 Tilbakeholdelse warning */}
        {kanHoldeTilbake && (
          <div className="p-pkt-04 bg-amber-50 border-2 border-amber-300 rounded-none">
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
          <div className="p-pkt-04 bg-pkt-surface-subtle rounded-none border-l-4 border-pkt-border-focus">
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
          <div
            className="p-pkt-05 bg-pkt-surface-subtle-light-red border-2 border-pkt-border-red rounded-none"
            role="alert"
          >
            <p className="text-base text-pkt-border-red font-medium">
              {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-pkt-04 pt-pkt-06 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
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
    </Modal>
  );
}
