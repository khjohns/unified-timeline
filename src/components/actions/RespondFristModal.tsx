/**
 * RespondFristModal Component
 *
 * Action modal for BH (client) to respond to a frist (deadline extension) claim.
 * Includes fields for approved number of days and result.
 * Now includes legacy NS 8407 response options.
 *
 * UPDATED (2025-12-05):
 * - Added §33.8 forsering warning when rejecting/partial approval
 * - Added subsidiary badge and info when grunnlag is rejected
 * - Added display of fristkrav details
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { FormField } from '../primitives/FormField';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { DatePicker } from '../primitives/DatePicker';
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
  BH_FRISTSVAR_OPTIONS,
  getBhFristsvarValues,
  BH_FRISTSVAR_DESCRIPTIONS,
} from '../../constants';

const respondFristSchema = z.object({
  resultat: z.enum(getBhFristsvarValues(), {
    errorMap: () => ({ message: 'Resultat er påkrevd' }),
  }),
  begrunnelse: z.string().min(10, 'Begrunnelse må være minst 10 tegn'),
  godkjent_dager: z.number().min(0, 'Antall dager kan ikke være negativt').optional(),
  frist_for_spesifisering: z.string().optional(),
});

type RespondFristFormData = z.infer<typeof respondFristSchema>;

// Frist event info for context display
interface FristEventInfo {
  antall_dager?: number;
  ny_sluttfrist?: string;
  begrunnelse?: string;
}

interface RespondFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the frist claim event being responded to (required for event sourcing) */
  fristKravId: string;
  krevdDager?: number;
  fristType?: 'kalenderdager' | 'arbeidsdager';
  /** Optional frist event data for context display */
  fristEvent?: FristEventInfo;
  /** Status of the grunnlag response (for subsidiary treatment) */
  grunnlagStatus?: 'godkjent' | 'avvist_uenig' | 'delvis_godkjent';
}

export function RespondFristModal({
  open,
  onOpenChange,
  sakId,
  fristKravId,
  krevdDager,
  fristType,
  fristEvent,
  grunnlagStatus,
}: RespondFristModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    control,
  } = useForm<RespondFristFormData>({
    resolver: zodResolver(respondFristSchema),
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
  const godkjentDager = watch('godkjent_dager');

  // Determine if this is subsidiary treatment (grunnlag was rejected)
  const erSubsidiaer = grunnlagStatus === 'avvist_uenig';

  // Effective days to compare (from fristEvent or krevdDager prop)
  const effektivKrevdDager = fristEvent?.antall_dager ?? krevdDager ?? 0;

  // §33.8: Show forsering warning when rejecting or partial approval
  const visForsering =
    selectedResultat === 'avslatt_ingen_hindring' ||
    (selectedResultat === 'delvis_godkjent' &&
      godkjentDager !== undefined &&
      godkjentDager < effektivKrevdDager);

  const onSubmit = (data: RespondFristFormData) => {
    mutation.mutate({
      eventType: 'respons_frist',
      data: {
        frist_krav_id: fristKravId,
        ...data,
      },
    });
  };

  // Show days field for full or partial approval
  const showDaysField =
    selectedResultat === 'godkjent_fullt' ||
    selectedResultat === 'delvis_godkjent';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Svar på fristkrav"
      description="Vurder tid-beregning (ren utmåling). Ansvarsvurdering håndteres i Grunnlag-sporet."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-06">
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
                Hvis du svarer &ldquo;Godkjenn&rdquo;: Du godkjenner antall
                dager, men opprettholder at det ikke foreligger grunnlag for
                fristforlengelse.
              </li>
              <li>
                Dette sikrer at du har tatt stilling til beregningen tidlig,
                selv om ansvaret er omtvistet.
              </li>
            </ul>
          </div>
        )}

        {/* Display of fristkrav details */}
        {fristEvent && (fristEvent.antall_dager || fristEvent.begrunnelse) && (
          <div className="p-pkt-04 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
            <h4 className="font-bold text-sm text-pkt-text-body-dark mb-2">
              Entreprenørens krav:
            </h4>
            <div className="flex justify-between items-center">
              <span className="text-xs text-pkt-text-body-subtle uppercase font-bold">
                Krav fra Entreprenør
              </span>
              {fristEvent.antall_dager !== undefined && (
                <span className="text-2xl font-bold">
                  {fristEvent.antall_dager} dager
                </span>
              )}
            </div>
            {fristEvent.ny_sluttfrist && (
              <p className="text-sm text-pkt-text-body-subtle mt-1">
                Ny sluttfrist:{' '}
                {new Date(fristEvent.ny_sluttfrist).toLocaleDateString('nb-NO')}
              </p>
            )}
            {fristEvent.begrunnelse && (
              <p className="italic text-pkt-text-body-subtle mt-2 text-sm border-t pt-2 border-pkt-border-subtle">
                &ldquo;{fristEvent.begrunnelse}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Show claimed days if available (fallback if no fristEvent) */}
        {krevdDager !== undefined && !fristEvent?.antall_dager && (
          <div className="p-pkt-04 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
            <p className="text-sm font-medium text-pkt-text-body-default">
              Krevd forlengelse: {krevdDager} {fristType || 'dager'}
            </p>
          </div>
        )}

        {/* Resultat - Using NS 8407 response options */}
        <FormField
          label="Resultat (fristberegning)"
          required
          error={errors.resultat?.message}
          labelTooltip="Vurder BARE dagberegningen. Ansvarsvurdering håndteres i Grunnlag-sporet. Subsidiær vurdering tillatt."
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
                  {BH_FRISTSVAR_OPTIONS.filter(opt => opt.value !== '').map((option) => (
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
        {selectedResultat && BH_FRISTSVAR_DESCRIPTIONS[selectedResultat] && (
          <div className="p-pkt-04 bg-pkt-surface-subtle rounded-none border-l-4 border-pkt-border-focus">
            <p className="text-sm text-pkt-text-body-subtle">
              {BH_FRISTSVAR_DESCRIPTIONS[selectedResultat]}
            </p>
          </div>
        )}

        {/* Godkjent dager - only show if godkjent or delvis_godkjent */}
        {showDaysField && (
          <FormField
            label="Godkjent antall dager"
            required={selectedResultat === 'godkjent_fullt'}
            error={errors.godkjent_dager?.message}
            helpText={
              krevdDager !== undefined && godkjentDager !== undefined
                ? `Differanse: ${krevdDager - godkjentDager} dager (${((godkjentDager / krevdDager) * 100).toFixed(1)}% godkjent)`
                : selectedResultat === 'delvis_godkjent'
                ? 'BH mener forsinkelsen er kortere enn TE krever'
                : undefined
            }
          >
            <Input
              id="godkjent_dager"
              type="number"
              {...register('godkjent_dager', { valueAsNumber: true })}
              fullWidth
              placeholder="0"
              error={!!errors.godkjent_dager}
            />
          </FormField>
        )}

        {/* §33.8 Forsering warning - show when rejecting or partial approval */}
        {visForsering && (
          <div className="p-pkt-04 bg-pkt-surface-subtle-light-blue border-2 border-pkt-border-focus rounded-none">
            <p className="text-sm font-medium text-pkt-text-body-default mb-2">
              Informasjon om risiko (§33.8)
            </p>
            <p className="text-sm text-pkt-text-body-subtle">
              Du avslår nå dager som TE mener å ha krav på.
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm text-pkt-text-body-subtle">
              <li>
                Dersom avslaget ditt er uberettiget, kan TE velge å anse avslaget
                som et <strong>pålegg om forsering</strong>.
              </li>
              <li>
                TE må i så fall sende et nytt varsel med kostnadsoverslag for
                forseringen før de setter i gang (Fase 4).
              </li>
              <li>
                Du trenger ikke ta stilling til forsering nå, men vær forberedt
                på at et slikt krav kan komme.
              </li>
            </ul>
          </div>
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
            placeholder="Begrunn din vurdering av fristkravet..."
            error={!!errors.begrunnelse}
          />
        </FormField>

        {/* Frist for spesifisering - only show when avventer_spesifikasjon */}
        {selectedResultat === 'avventer_spesifikasjon' && (
          <FormField
            label="Frist for spesifisering"
            error={errors.frist_for_spesifisering?.message}
            helpText="Angi fristen innen hvilken entreprenøren må levere ytterligere spesifikasjon av kravet."
          >
            <Controller
              name="frist_for_spesifisering"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="frist_for_spesifisering"
                  value={field.value}
                  onChange={field.onChange}
                  fullWidth
                  error={!!errors.frist_for_spesifisering}
                  placeholder="Velg dato"
                />
              )}
            />
          </FormField>
        )}

        {/* Error Message */}
        {mutation.isError && (
          <Alert variant="danger" title="Feil ved innsending">
            {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-pkt-04 pt-pkt-06 border-t-2 border-pkt-border-subtle">
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
