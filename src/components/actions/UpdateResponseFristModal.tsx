/**
 * UpdateResponseFristModal Component
 *
 * Modal for BH to update their response on frist claim.
 *
 * ASYMMETRISK ENDRINGSRETT (NS 8407):
 * BH kan kun endre standpunkt til TEs gunst:
 * - Preklusjon: Fra "for sent" → "i tide" (ikke omvendt)
 * - Vilkår: Fra "ingen hindring" → "hindring erkjent" (ikke omvendt)
 * - Beregning: Kun øke antall dager (ikke redusere)
 *
 * Critical: If forsering is in progress, BH can stop it by approving the frist claim.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Textarea } from '../primitives/Textarea';
import { FormField } from '../primitives/FormField';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { Badge } from '../primitives/Badge';
import { RadioGroup, RadioItem } from '../primitives/RadioGroup';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useMemo, useState, useEffect } from 'react';
import { useFormBackup } from '../../hooks/useFormBackup';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { FristTilstand, FristBeregningResultat } from '../../types/timeline';

const updateResponseSchema = z.object({
  // Port 2: Preklusjon - kan kun endres til TEs gunst
  endre_preklusjon: z.boolean().optional(),
  noytralt_varsel_ok: z.boolean().optional(),
  spesifisert_krav_ok: z.boolean().optional(),

  // Port 3: Vilkår - kan kun endres til TEs gunst
  endre_vilkar: z.boolean().optional(),
  vilkar_oppfylt: z.boolean().optional(),

  // Port 4: Beregning
  beregnings_resultat: z.string().optional(),
  godkjent_dager: z.number().optional(),

  // Samlet
  kommentar: z.string().min(10, 'Begrunnelse er påkrevd'),
});

type UpdateResponseFormData = z.infer<typeof updateResponseSchema>;

interface UpdateResponseFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  lastResponseEvent: {
    event_id: string;
    resultat: FristBeregningResultat;
    godkjent_dager?: number;
  };
  fristTilstand: FristTilstand;
}

const RESULTAT_LABELS: Record<FristBeregningResultat, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
};

export function UpdateResponseFristModal({
  open,
  onOpenChange,
  sakId,
  lastResponseEvent,
  fristTilstand,
}: UpdateResponseFristModalProps) {
  const [showTokenExpired, setShowTokenExpired] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const forsering = fristTilstand.forsering;
  const erForseringVarslet = forsering?.er_varslet ?? false;
  const forseringsKostnad = forsering?.estimert_kostnad ?? 0;
  const krevdDager = fristTilstand.krevd_dager ?? 0;
  const varselType = fristTilstand.varsel_type;

  // Tidligere vurderinger fra fristTilstand
  const tidligereNoytraltVarselOk = fristTilstand.noytralt_varsel_ok;
  const tidligereSpesifisertKravOk = fristTilstand.spesifisert_krav_ok;
  const tidligereVilkarOppfylt = fristTilstand.vilkar_oppfylt;

  // Asymmetrisk endringsrett: Kan disse endres til TEs gunst?
  // Preklusjon: Kun hvis tidligere vurdert som "for sent" (false)
  const kanEndrePreklusjonTilGunst = useMemo(() => {
    if (varselType === 'noytralt') {
      return tidligereNoytraltVarselOk === false;
    }
    return tidligereSpesifisertKravOk === false;
  }, [varselType, tidligereNoytraltVarselOk, tidligereSpesifisertKravOk]);

  // Vilkår: Kun hvis tidligere vurdert som "ingen hindring" (false)
  const kanEndreVilkarTilGunst = tidligereVilkarOppfylt === false;

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    control,
    watch,
    reset,
  } = useForm<UpdateResponseFormData>({
    resolver: zodResolver(updateResponseSchema),
    defaultValues: {
      endre_preklusjon: false,
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: true,
      endre_vilkar: false,
      vilkar_oppfylt: true,
      beregnings_resultat: '',
      godkjent_dager: undefined,
      kommentar: '',
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  const formData = watch();
  const { getBackup, clearBackup, hasBackup } = useFormBackup(sakId, 'respons_frist_oppdatert', formData, isDirty);

  useEffect(() => { if (open && hasBackup) setShowRestorePrompt(true); }, [open, hasBackup]);
  const handleRestoreBackup = () => { const backup = getBackup(); if (backup) reset(backup); setShowRestorePrompt(false); };
  const handleDiscardBackup = () => { clearBackup(); setShowRestorePrompt(false); };

  const endrePreklusjon = watch('endre_preklusjon');
  const endreVilkar = watch('endre_vilkar');
  const nyttResultat = watch('beregnings_resultat') as FristBeregningResultat;
  const nyGodkjentDager = watch('godkjent_dager');

  // Asymmetrisk endringsrett for beregning
  const forrigeResultat = lastResponseEvent.resultat;
  const varAvslatt = forrigeResultat === 'avslatt';
  const varDelvisGodkjent = forrigeResultat === 'delvis_godkjent';
  const varGodkjent = forrigeResultat === 'godkjent';
  const tidligereGodkjentDager = lastResponseEvent.godkjent_dager ?? 0;

  // Sjekk om noe kan endres
  const harNoeAAendre = kanEndrePreklusjonTilGunst || kanEndreVilkarTilGunst || !varGodkjent;

  // Check if this will stop forsering
  const stopperForsering = useMemo(() => {
    // Stopper forsering hvis vi endrer preklusjon eller vilkår til gunst
    if (endrePreklusjon || endreVilkar) return erForseringVarslet;
    // Eller hvis vi øker godkjente dager
    return erForseringVarslet &&
      (nyttResultat === 'godkjent' || nyttResultat === 'delvis_godkjent');
  }, [erForseringVarslet, nyttResultat, endrePreklusjon, endreVilkar]);

  // Get available options for beregning - kun endringer til TEs gunst
  const getBeregningOptions = () => {
    const options: { value: FristBeregningResultat; label: string; description?: string }[] = [];

    if (varAvslatt) {
      options.push({
        value: 'godkjent',
        label: erForseringVarslet
          ? 'Snu i saken: Godkjenn fristforlengelsen'
          : `Snu til: Godkjenn ${krevdDager} dager`,
        description: erForseringVarslet
          ? 'STOPPER FORSERINGEN. TE får dagene, og du slipper å betale forseringskostnaden.'
          : 'Fristen forlenges tilsvarende.',
      });
      options.push({
        value: 'delvis_godkjent',
        label: 'Snu til: Delvis godkjent',
        description: erForseringVarslet
          ? 'Delvis godkjenning kan også stoppe forsering.'
          : 'Godkjenn færre dager enn kravet.',
      });
    } else if (varDelvisGodkjent) {
      options.push({
        value: 'godkjent',
        label: erForseringVarslet
          ? 'Øk til: Godkjenn fullt (stopper forsering)'
          : `Øk til: Godkjenn ${krevdDager} dager`,
        description: erForseringVarslet
          ? 'STOPPER FORSERINGEN. TE får alle krevde dager.'
          : 'Fristen forlenges tilsvarende.',
      });
      options.push({
        value: 'delvis_godkjent',
        label: 'Øk antall godkjente dager',
        description: `Nåværende: ${tidligereGodkjentDager} dager. Du kan kun øke antallet.`,
      });
    }

    return options;
  };

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      clearBackup();
      reset();
      onOpenChange(false);
    },
    onError: (error) => {
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      }
    },
  });

  const onSubmit = (data: UpdateResponseFormData) => {
    // Bygg event data basert på hva som endres
    const eventData: Record<string, unknown> = {
      original_respons_id: lastResponseEvent.event_id,
      kommentar: data.kommentar,
      stopper_forsering: stopperForsering,
      dato_endret: new Date().toISOString().split('T')[0],
    };

    // Port 2: Preklusjon-endringer
    if (data.endre_preklusjon && kanEndrePreklusjonTilGunst) {
      if (varselType === 'noytralt') {
        eventData.noytralt_varsel_ok = true;
      } else {
        eventData.spesifisert_krav_ok = true;
      }
    }

    // Port 3: Vilkår-endringer
    if (data.endre_vilkar && kanEndreVilkarTilGunst) {
      eventData.vilkar_oppfylt = true;
    }

    // Port 4: Beregning-endringer
    if (data.beregnings_resultat) {
      eventData.beregnings_resultat = data.beregnings_resultat;
      eventData.godkjent_dager = data.beregnings_resultat === 'godkjent'
        ? krevdDager
        : data.godkjent_dager;
    }

    mutation.mutate({
      eventType: 'respons_frist_oppdatert',
      data: eventData,
    });
  };

  // Sjekk om noe faktisk er endret
  const harEndringer = endrePreklusjon || endreVilkar || nyttResultat;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Oppdater svar på fristkrav"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* DRAMATIC FORSERING WARNING */}
        {erForseringVarslet && (
          <div className="bg-pkt-surface-faded-red p-4 border-l-4 border-pkt-border-red rounded">
            <h4 className="text-pkt-brand-red-1000 font-bold flex items-center gap-2">
              <span className="text-xl">!</span>
              FORSERING VARSLET
            </h4>
            <p className="text-sm text-pkt-brand-red-1000 mt-2">
              Entreprenøren har iverksatt forsering med en estimert kostnad på:
            </p>
            <div className="text-3xl font-mono font-bold text-pkt-brand-red-1000 my-3">
              kr {forseringsKostnad.toLocaleString('nb-NO')},-
            </div>
            <p className="text-sm text-pkt-brand-red-1000">
              Hvis du endrer til TEs gunst, <strong>faller plikten til å forsere bort</strong>.
            </p>
          </div>
        )}

        {/* Info om asymmetrisk endringsrett */}
        <Alert variant="info" title="Asymmetrisk endringsrett">
          <p>
            Du kan kun endre standpunkt til <strong>entreprenørens gunst</strong>.
            Standpunkter som allerede er til TEs gunst kan ikke endres tilbake.
          </p>
        </Alert>

        {/* Nåværende status */}
        <div className="bg-pkt-bg-subtle p-4 rounded border border-pkt-grays-gray-200">
          <h4 className="font-medium mb-3">Nåværende vurdering</h4>
          <div className="space-y-2 text-sm">
            {/* Preklusjon */}
            <div className="flex justify-between items-center">
              <span>Preklusjon ({varselType === 'noytralt' ? '§33.4' : '§33.6'}):</span>
              {varselType === 'noytralt' ? (
                <Badge variant={tidligereNoytraltVarselOk ? 'success' : 'danger'}>
                  {tidligereNoytraltVarselOk ? 'Varslet i tide' : 'For sent'}
                </Badge>
              ) : (
                <Badge variant={tidligereSpesifisertKravOk ? 'success' : 'danger'}>
                  {tidligereSpesifisertKravOk ? 'Kravet i tide' : 'For sent'}
                </Badge>
              )}
            </div>
            {/* Vilkår */}
            <div className="flex justify-between items-center">
              <span>Vilkår (§33.5):</span>
              <Badge variant={tidligereVilkarOppfylt ? 'success' : 'warning'}>
                {tidligereVilkarOppfylt ? 'Hindring erkjent' : 'Ingen hindring'}
              </Badge>
            </div>
            {/* Beregning */}
            <div className="flex justify-between items-center">
              <span>Resultat:</span>
              <Badge variant={varGodkjent ? 'success' : varDelvisGodkjent ? 'warning' : 'danger'}>
                {RESULTAT_LABELS[forrigeResultat]}
                {tidligereGodkjentDager > 0 && ` (${tidligereGodkjentDager} dager)`}
              </Badge>
            </div>
          </div>
        </div>

        {/* Alt er bindende - ingen endringer mulig */}
        {!harNoeAAendre && (
          <Alert variant="info" title="Alle standpunkter er bindende">
            <p>
              Alle dine standpunkter er allerede til entreprenørens gunst.
              Det er ingenting å endre.
            </p>
          </Alert>
        )}

        {/* ============================================
            PORT 2: PREKLUSJON - Endre til TEs gunst
            ============================================ */}
        {kanEndrePreklusjonTilGunst && (
          <div className="p-4 border-2 border-pkt-border-subtle rounded-none space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="font-bold">Preklusjon ({varselType === 'noytralt' ? '§33.4' : '§33.6'})</h4>
              <Badge variant="warning">Kan endres</Badge>
            </div>

            <p className="text-sm text-pkt-text-body-subtle">
              Du vurderte tidligere at varselet kom <strong>for sent</strong>.
              Du kan nå endre dette til &ldquo;i tide&rdquo; hvis du har fått ny informasjon.
            </p>

            <FormField label="Vil du endre preklusjonsvurderingen?">
              <Controller
                name="endre_preklusjon"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value ? 'ja' : 'nei'}
                    onValueChange={(val: string) => field.onChange(val === 'ja')}
                  >
                    <RadioItem
                      value="ja"
                      label={varselType === 'noytralt'
                        ? 'Ja - nøytralt varsel var likevel i tide'
                        : 'Ja - spesifisert krav var likevel i tide'
                      }
                      description="Kravet er ikke lenger prekludert"
                    />
                    <RadioItem
                      value="nei"
                      label="Nei - behold vurdering (for sent)"
                    />
                  </RadioGroup>
                )}
              />
            </FormField>
          </div>
        )}

        {/* ============================================
            PORT 3: VILKÅR - Endre til TEs gunst
            ============================================ */}
        {kanEndreVilkarTilGunst && (
          <div className="p-4 border-2 border-pkt-border-subtle rounded-none space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="font-bold">Vilkår (§33.5)</h4>
              <Badge variant="warning">Kan endres</Badge>
            </div>

            <p className="text-sm text-pkt-text-body-subtle">
              Du vurderte tidligere at det <strong>ikke var reell hindring</strong>.
              Du kan nå erkjenne at forholdet faktisk hindret fremdriften.
            </p>

            <FormField label="Vil du endre vilkårsvurderingen?">
              <Controller
                name="endre_vilkar"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value ? 'ja' : 'nei'}
                    onValueChange={(val: string) => field.onChange(val === 'ja')}
                  >
                    <RadioItem
                      value="ja"
                      label="Ja - forholdet medførte likevel hindring"
                      description="Vilkårene for fristforlengelse er oppfylt"
                    />
                    <RadioItem
                      value="nei"
                      label="Nei - behold vurdering (ingen hindring)"
                    />
                  </RadioGroup>
                )}
              />
            </FormField>
          </div>
        )}

        {/* ============================================
            PORT 4: BEREGNING - Endre til TEs gunst
            ============================================ */}
        {!varGodkjent && (
          <div className="p-4 border-2 border-pkt-border-subtle rounded-none space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="font-bold">Beregning</h4>
              <Badge variant="warning">Kan endres</Badge>
            </div>

            <p className="text-sm text-pkt-text-body-subtle">
              {varAvslatt
                ? 'Du avviste kravet. Du kan nå godkjenne helt eller delvis.'
                : `Du godkjente ${tidligereGodkjentDager} dager. Du kan kun øke antallet.`
              }
            </p>

            <FormField
              label="Ny avgjørelse"
              error={errors.beregnings_resultat?.message}
            >
              <Controller
                name="beregnings_resultat"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                  >
                    <RadioItem
                      value=""
                      label="Ingen endring i beregning"
                    />
                    {getBeregningOptions().map((option) => (
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

            {/* Partial approval input */}
            {nyttResultat === 'delvis_godkjent' && (
              <div className="ml-6 p-4 bg-pkt-grays-gray-100 rounded animate-in fade-in duration-200">
                <FormField
                  label="Antall dager du godkjenner"
                  hint={varDelvisGodkjent
                    ? `Må være høyere enn tidligere godkjent (${tidligereGodkjentDager} dager)`
                    : undefined
                  }
                >
                  <Controller
                    name="godkjent_dager"
                    control={control}
                    render={({ field }) => (
                      <Input
                        type="number"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        max={krevdDager - 1}
                        min={varDelvisGodkjent ? tidligereGodkjentDager + 1 : 1}
                        width="xs"
                      />
                    )}
                  />
                </FormField>
                {varDelvisGodkjent && nyGodkjentDager !== undefined && nyGodkjentDager <= tidligereGodkjentDager && (
                  <p className="text-sm text-pkt-brand-red-1000 mt-2">
                    Antall dager må være høyere enn tidligere godkjent ({tidligereGodkjentDager} dager)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Confirmation alert when stopping forsering */}
        {stopperForsering && harEndringer && (
          <Alert variant="success" title="Forsering stoppes">
            <p>
              Ved å endre til entreprenørens gunst vil forseringen stoppes.
              Du vil kun måtte betale for påløpte forseringskostnader frem til i dag.
            </p>
          </Alert>
        )}

        {/* Begrunnelse */}
        <FormField
          label="Begrunnelse for endring"
          required
          error={errors.kommentar?.message}
        >
          <Controller
            name="kommentar"
            control={control}
            render={({ field }) => (
              <Textarea
                id="kommentar"
                value={field.value}
                onChange={field.onChange}
                rows={4}
                fullWidth
                error={!!errors.kommentar}
                placeholder="Begrunn hvorfor du endrer standpunkt..."
              />
            )}
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
          <Button
            type="submit"
            variant="primary"
            disabled={
              isSubmitting ||
              !harEndringer ||
              !harNoeAAendre ||
              (nyttResultat === 'delvis_godkjent' && !nyGodkjentDager) ||
              (nyttResultat === 'delvis_godkjent' && varDelvisGodkjent && (nyGodkjentDager ?? 0) <= tidligereGodkjentDager) ||
              !watch('kommentar')
            }
            size="lg"
          >
            {isSubmitting
              ? 'Lagrer...'
              : stopperForsering
                ? 'Stopp Forsering & Lagre'
                : 'Lagre Endringer'}
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
