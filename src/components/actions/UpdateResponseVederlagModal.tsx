/**
 * UpdateResponseVederlagModal Component
 *
 * Modal for BH to update their response on vederlag claim.
 *
 * ASYMMETRISK ENDRINGSRETT (NS 8407):
 * BH kan kun endre standpunkt til TEs gunst:
 * - Port 2 (Preklusjon): Fra "for sent" → "i tide" (ikke omvendt)
 * - Port 3 (Metode): Fra avvist → akseptert (ikke omvendt)
 * - Port 4 (Beløp): Kun øke beløp per krav (ikke redusere)
 *
 * Key logic: Can release HOLD_TILBAKE when TE has provided overslag (§30.2)
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Textarea } from '../primitives/Textarea';
import { FormField } from '../primitives/FormField';
import { Alert } from '../primitives/Alert';
import { AlertDialog } from '../primitives/AlertDialog';
import { Badge } from '../primitives/Badge';
import { RevisionTag } from '../primitives/RevisionTag';
import { RadioGroup, RadioItem } from '../primitives/RadioGroup';
import { CurrencyInput } from '../primitives/CurrencyInput';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useConfirmClose } from '../../hooks/useConfirmClose';
import { useMemo } from 'react';
import { VederlagTilstand, VederlagBeregningResultat } from '../../types/timeline';

const updateResponseSchema = z.object({
  // Port 2: Preklusjon - kan kun endres til TEs gunst
  endre_rigg_preklusjon: z.boolean().optional(),
  endre_produktivitet_preklusjon: z.boolean().optional(),

  // Port 3: Metode - kan kun endres til TEs gunst
  endre_metode_aksept: z.boolean().optional(),
  endre_ep_justering: z.boolean().optional(),

  // Port 4: Beløp - samlet eller granulær
  nytt_resultat: z.string().optional(),
  godkjent_belop: z.number().optional(),

  // Granulær beløpskontroll (kun økning)
  endre_hovedkrav: z.boolean().optional(),
  ny_hovedkrav_vurdering: z.enum(['godkjent', 'delvis', 'avslatt']).optional(),
  nytt_hovedkrav_belop: z.number().optional(),

  endre_rigg_belop: z.boolean().optional(),
  ny_rigg_vurdering: z.enum(['godkjent', 'delvis', 'avslatt']).optional(),
  nytt_rigg_belop: z.number().optional(),

  endre_produktivitet_belop: z.boolean().optional(),
  ny_produktivitet_vurdering: z.enum(['godkjent', 'delvis', 'avslatt']).optional(),
  nytt_produktivitet_belop: z.number().optional(),

  // Samlet
  kommentar: z.string().min(10, 'Begrunnelse er påkrevd'),
});

type UpdateResponseFormData = z.infer<typeof updateResponseSchema>;

// Type for beløpsvurdering
type BelopVurdering = 'godkjent' | 'delvis' | 'avslatt';

interface UpdateResponseVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  lastResponseEvent: {
    event_id: string;
    resultat: VederlagBeregningResultat;
    godkjent_belop?: number;
    /** Which version of the claim this response was for (0-indexed) */
    respondedToVersion?: number;
    // Tidligere vurderinger
    rigg_varslet_i_tide?: boolean;
    produktivitet_varslet_i_tide?: boolean;
    aksepterer_metode?: boolean;
    ep_justering_akseptert?: boolean;
    hovedkrav_vurdering?: BelopVurdering;
    hovedkrav_godkjent_belop?: number;
    rigg_vurdering?: BelopVurdering;
    rigg_godkjent_belop?: number;
    produktivitet_vurdering?: BelopVurdering;
    produktivitet_godkjent_belop?: number;
  };
  vederlagTilstand: VederlagTilstand;
}

const RESULTAT_LABELS: Record<VederlagBeregningResultat, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  hold_tilbake: 'Holder tilbake (§30.2)',
};

const VURDERING_LABELS: Record<BelopVurdering, string> = {
  godkjent: 'Godkjent',
  delvis: 'Delvis godkjent',
  avslatt: 'Avslått',
};

export function UpdateResponseVederlagModal({
  open,
  onOpenChange,
  sakId,
  lastResponseEvent,
  vederlagTilstand,
}: UpdateResponseVederlagModalProps) {
  const forrigeResultat = lastResponseEvent.resultat;
  const erTilbakehold = forrigeResultat === 'hold_tilbake';

  // Determine the relevant amount based on metode
  const erRegningsarbeid = vederlagTilstand.metode === 'REGNINGSARBEID';
  const krevdBelop = erRegningsarbeid
    ? vederlagTilstand.kostnads_overslag ?? 0
    : vederlagTilstand.belop_direkte ?? 0;

  // Særskilte krav
  const harRiggKrav = vederlagTilstand.saerskilt_krav?.rigg_drift !== undefined;
  const harProduktivitetKrav = vederlagTilstand.saerskilt_krav?.produktivitet !== undefined;
  const harSaerskiltKrav = harRiggKrav || harProduktivitetKrav;
  const riggBelop = vederlagTilstand.saerskilt_krav?.rigg_drift?.belop ?? 0;
  const produktivitetBelop = vederlagTilstand.saerskilt_krav?.produktivitet?.belop ?? 0;

  // Tidligere vurderinger
  const tidligereRiggVarsletITide = lastResponseEvent.rigg_varslet_i_tide;
  const tidligereProduktivitetVarsletITide = lastResponseEvent.produktivitet_varslet_i_tide;
  const tidligereAkseptererMetode = lastResponseEvent.aksepterer_metode;
  const tidligereEpJusteringAkseptert = lastResponseEvent.ep_justering_akseptert;
  const tidligereHovedkravVurdering = lastResponseEvent.hovedkrav_vurdering;
  const tidligereHovedkravBelop = lastResponseEvent.hovedkrav_godkjent_belop ?? 0;
  const tidligereRiggVurdering = lastResponseEvent.rigg_vurdering;
  const tidligereRiggBelop = lastResponseEvent.rigg_godkjent_belop ?? 0;
  const tidligereProduktivitetVurdering = lastResponseEvent.produktivitet_vurdering;
  const tidligereProduktivitetBelop = lastResponseEvent.produktivitet_godkjent_belop ?? 0;

  // Asymmetrisk endringsrett: Hva kan endres til TEs gunst?
  const kanEndreRiggPreklusjon = harRiggKrav && tidligereRiggVarsletITide === false;
  const kanEndreProduktivitetPreklusjon = harProduktivitetKrav && tidligereProduktivitetVarsletITide === false;
  const kanEndrePreklusjon = kanEndreRiggPreklusjon || kanEndreProduktivitetPreklusjon;

  const kanEndreMetodeAksept = tidligereAkseptererMetode === false;
  const kanEndreEpJustering = vederlagTilstand.krever_justert_ep && tidligereEpJusteringAkseptert === false;
  const kanEndreMetode = kanEndreMetodeAksept || kanEndreEpJustering;

  // Beløp: Kan øke hvis ikke allerede godkjent fullt
  const kanEndreHovedkrav = tidligereHovedkravVurdering !== 'godkjent';
  const kanEndreRiggBelop = harRiggKrav && tidligereRiggVurdering !== 'godkjent';
  const kanEndreProduktivitetBelop = harProduktivitetKrav && tidligereProduktivitetVurdering !== 'godkjent';
  const kanEndreGranularBelop = kanEndreHovedkrav || kanEndreRiggBelop || kanEndreProduktivitetBelop;

  // Samlet resultat kan endres?
  const varAvslatt = forrigeResultat === 'avslatt';
  const varDelvisGodkjent = forrigeResultat === 'delvis_godkjent';
  const varGodkjent = forrigeResultat === 'godkjent';
  const kanEndreSamletResultat = !varGodkjent || erTilbakehold;

  // Sjekk om noe kan endres
  const harNoeAAendre = kanEndrePreklusjon || kanEndreMetode || kanEndreGranularBelop || kanEndreSamletResultat;

  // Check if TE has now provided kostnadsoverslag (§30.2)
  const overslagMottatt = useMemo(() => {
    if (erTilbakehold && erRegningsarbeid) {
      return (vederlagTilstand.kostnads_overslag ?? 0) > 0;
    }
    return false;
  }, [erTilbakehold, erRegningsarbeid, vederlagTilstand.kostnads_overslag]);

  // Current claim version
  const currentClaimVersion = Math.max(0, (vederlagTilstand.antall_versjoner ?? 1) - 1);

  // Check if claim has been revised since BH's last response
  const kravRevidertEtterSvar = useMemo(() => {
    const respondedTo = lastResponseEvent.respondedToVersion ?? 0;
    return currentClaimVersion > respondedTo;
  }, [currentClaimVersion, lastResponseEvent.respondedToVersion]);

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    control,
    watch,
    reset,
  } = useForm<UpdateResponseFormData>({
    resolver: zodResolver(updateResponseSchema),
    defaultValues: {
      endre_rigg_preklusjon: false,
      endre_produktivitet_preklusjon: false,
      endre_metode_aksept: false,
      endre_ep_justering: false,
      nytt_resultat: '',
      godkjent_belop: undefined,
      endre_hovedkrav: false,
      ny_hovedkrav_vurdering: undefined,
      nytt_hovedkrav_belop: undefined,
      endre_rigg_belop: false,
      ny_rigg_vurdering: undefined,
      nytt_rigg_belop: undefined,
      endre_produktivitet_belop: false,
      ny_produktivitet_vurdering: undefined,
      nytt_produktivitet_belop: undefined,
      kommentar: '',
    },
  });

  const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
    isDirty,
    onReset: reset,
    onClose: () => onOpenChange(false),
  });

  // Watch form values
  const endreRiggPreklusjon = watch('endre_rigg_preklusjon');
  const endreProduktivitetPreklusjon = watch('endre_produktivitet_preklusjon');
  const endreMetodeAksept = watch('endre_metode_aksept');
  const endreEpJustering = watch('endre_ep_justering');
  const nyttResultat = watch('nytt_resultat') as VederlagBeregningResultat;
  const godkjentBelop = watch('godkjent_belop');
  const endreHovedkrav = watch('endre_hovedkrav');
  const nyHovedkravVurdering = watch('ny_hovedkrav_vurdering');
  const nyttHovedkravBelop = watch('nytt_hovedkrav_belop');
  const endreRiggBelop = watch('endre_rigg_belop');
  const nyRiggVurdering = watch('ny_rigg_vurdering');
  const nyttRiggBelop = watch('nytt_rigg_belop');
  const endreProduktivitetBelop = watch('endre_produktivitet_belop');
  const nyProduktivitetVurdering = watch('ny_produktivitet_vurdering');
  const nyttProduktivitetBelop = watch('nytt_produktivitet_belop');

  const tidligereGodkjentBelop = lastResponseEvent.godkjent_belop ?? 0;

  // Get available options for samlet resultat - kun endringer til TEs gunst
  const getSamletResultatOptions = () => {
    const options: { value: VederlagBeregningResultat; label: string; description?: string }[] = [];

    if (erTilbakehold) {
      options.push({
        value: 'godkjent',
        label: 'Opphev tilbakeholdelse: Godkjenn fullt',
        description: 'Overslag mottatt og akseptert. Betaling frigis.',
      });
      options.push({
        value: 'delvis_godkjent',
        label: 'Opphev tilbakeholdelse: Godkjenn delvis',
        description: 'Overslag mottatt, men kun deler av beløpet aksepteres.',
      });
      options.push({
        value: 'avslatt',
        label: 'Avslå kravet',
        description: 'Selv med overslag godtas ikke kravet.',
      });
    } else if (varAvslatt) {
      options.push({
        value: 'godkjent',
        label: `Snu til: Godkjent fullt (${krevdBelop.toLocaleString('nb-NO')} kr)`,
        description: 'Kravet aksepteres fullt ut.',
      });
      options.push({
        value: 'delvis_godkjent',
        label: 'Snu til: Delvis godkjent',
        description: 'Deler av kravet aksepteres.',
      });
    } else if (varDelvisGodkjent) {
      options.push({
        value: 'godkjent',
        label: `Øk til: Godkjent fullt (${krevdBelop.toLocaleString('nb-NO')} kr)`,
        description: 'Kravet aksepteres fullt ut.',
      });
      options.push({
        value: 'delvis_godkjent',
        label: 'Øk godkjent beløp',
        description: `Nåværende: ${tidligereGodkjentBelop.toLocaleString('nb-NO')} kr. Du kan kun øke beløpet.`,
      });
    }

    return options;
  };

  // Sjekk om noe faktisk er endret
  const harEndringer = useMemo(() => {
    return (
      endreRiggPreklusjon ||
      endreProduktivitetPreklusjon ||
      endreMetodeAksept ||
      endreEpJustering ||
      nyttResultat ||
      endreHovedkrav ||
      endreRiggBelop ||
      endreProduktivitetBelop
    );
  }, [
    endreRiggPreklusjon,
    endreProduktivitetPreklusjon,
    endreMetodeAksept,
    endreEpJustering,
    nyttResultat,
    endreHovedkrav,
    endreRiggBelop,
    endreProduktivitetBelop,
  ]);

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: UpdateResponseFormData) => {
    // Bygg event data basert på hva som endres
    const eventData: Record<string, unknown> = {
      original_respons_id: lastResponseEvent.event_id,
      kommentar: data.kommentar,
      dato_endret: new Date().toISOString().split('T')[0],
    };

    // Port 2: Preklusjon-endringer
    if (data.endre_rigg_preklusjon && kanEndreRiggPreklusjon) {
      eventData.ny_rigg_varslet_i_tide = true;
    }
    if (data.endre_produktivitet_preklusjon && kanEndreProduktivitetPreklusjon) {
      eventData.ny_produktivitet_varslet_i_tide = true;
    }

    // Port 3: Metode-endringer
    if (data.endre_metode_aksept && kanEndreMetodeAksept) {
      eventData.ny_aksepterer_metode = true;
    }
    if (data.endre_ep_justering && kanEndreEpJustering) {
      eventData.ny_ep_justering_akseptert = true;
    }

    // Port 4: Beløp-endringer (granulær)
    if (data.endre_hovedkrav && data.ny_hovedkrav_vurdering) {
      eventData.ny_hovedkrav_vurdering = data.ny_hovedkrav_vurdering;
      eventData.nytt_hovedkrav_belop =
        data.ny_hovedkrav_vurdering === 'godkjent'
          ? krevdBelop
          : data.ny_hovedkrav_vurdering === 'delvis'
            ? data.nytt_hovedkrav_belop
            : 0;
    }
    if (data.endre_rigg_belop && data.ny_rigg_vurdering) {
      eventData.ny_rigg_vurdering = data.ny_rigg_vurdering;
      eventData.nytt_rigg_belop =
        data.ny_rigg_vurdering === 'godkjent'
          ? riggBelop
          : data.ny_rigg_vurdering === 'delvis'
            ? data.nytt_rigg_belop
            : 0;
    }
    if (data.endre_produktivitet_belop && data.ny_produktivitet_vurdering) {
      eventData.ny_produktivitet_vurdering = data.ny_produktivitet_vurdering;
      eventData.nytt_produktivitet_belop =
        data.ny_produktivitet_vurdering === 'godkjent'
          ? produktivitetBelop
          : data.ny_produktivitet_vurdering === 'delvis'
            ? data.nytt_produktivitet_belop
            : 0;
    }

    // Port 4: Samlet resultat (hvis valgt)
    if (data.nytt_resultat) {
      eventData.nytt_resultat = data.nytt_resultat;
      eventData.nytt_godkjent_belop =
        data.nytt_resultat === 'godkjent' ? krevdBelop : data.godkjent_belop;
    }

    mutation.mutate({
      eventType: 'respons_vederlag_oppdatert',
      data: eventData,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Oppdater svar på vederlagskrav"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Revision warning */}
        {kravRevidertEtterSvar && (
          <Alert variant="warning" title="Kravet er revidert">
            <p>
              Entreprenøren har revidert vederlagskravet etter ditt forrige svar.
              Gjeldende krav er nå <strong>Rev. {currentClaimVersion}</strong>.
            </p>
          </Alert>
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
            {/* Samlet resultat */}
            <div className="flex justify-between items-center">
              <span>Samlet resultat:</span>
              <Badge
                variant={
                  forrigeResultat === 'hold_tilbake'
                    ? 'warning'
                    : forrigeResultat === 'avslatt'
                      ? 'danger'
                      : forrigeResultat === 'godkjent'
                        ? 'success'
                        : 'warning'
                }
              >
                {RESULTAT_LABELS[forrigeResultat]}
              </Badge>
            </div>

            {/* Preklusjon */}
            {harRiggKrav && (
              <div className="flex justify-between items-center">
                <span>Rigg/drift preklusjon:</span>
                <Badge variant={tidligereRiggVarsletITide ? 'success' : 'danger'}>
                  {tidligereRiggVarsletITide ? 'Varslet i tide' : 'For sent (prekludert)'}
                </Badge>
              </div>
            )}
            {harProduktivitetKrav && (
              <div className="flex justify-between items-center">
                <span>Produktivitet preklusjon:</span>
                <Badge variant={tidligereProduktivitetVarsletITide ? 'success' : 'danger'}>
                  {tidligereProduktivitetVarsletITide ? 'Varslet i tide' : 'For sent (prekludert)'}
                </Badge>
              </div>
            )}

            {/* Oppgjørsform */}
            <div className="flex justify-between items-center">
              <span>Oppgjørsform:</span>
              <Badge variant={tidligereAkseptererMetode ? 'success' : 'warning'}>
                {tidligereAkseptererMetode ? 'Akseptert' : 'Avvist'}
              </Badge>
            </div>
            {vederlagTilstand.krever_justert_ep && (
              <div className="flex justify-between items-center">
                <span>EP-justering (§34.3.3):</span>
                <Badge variant={tidligereEpJusteringAkseptert ? 'success' : 'danger'}>
                  {tidligereEpJusteringAkseptert ? 'Akseptert' : 'Avvist'}
                </Badge>
              </div>
            )}

            {/* Beløp */}
            {tidligereHovedkravVurdering && (
              <div className="flex justify-between items-center">
                <span>Hovedkrav:</span>
                <Badge
                  variant={
                    tidligereHovedkravVurdering === 'godkjent'
                      ? 'success'
                      : tidligereHovedkravVurdering === 'delvis'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {VURDERING_LABELS[tidligereHovedkravVurdering]}
                  {tidligereHovedkravVurdering === 'delvis' &&
                    ` (${tidligereHovedkravBelop.toLocaleString('nb-NO')} kr)`}
                </Badge>
              </div>
            )}
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

        {/* Overslag mottatt notification */}
        {erTilbakehold && overslagMottatt && (
          <Alert variant="success" title="Kostnadsoverslag mottatt">
            <p>
              Entreprenøren har nå levert kostnadsoverslag på{' '}
              <strong>kr {vederlagTilstand.kostnads_overslag?.toLocaleString('nb-NO')},-</strong>{' '}
              i henhold til §30.2.
            </p>
          </Alert>
        )}

        {/* ============================================
            PORT 2: PREKLUSJON - Endre til TEs gunst
            ============================================ */}
        {kanEndrePreklusjon && (
          <div className="p-4 border-2 border-pkt-border-subtle rounded-none space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="font-bold">Preklusjon (§34.1.3)</h4>
              <Badge variant="warning">Kan endres</Badge>
            </div>

            <p className="text-sm text-pkt-text-body-subtle">
              Du vurderte tidligere at særskilte krav kom <strong>for sent</strong>.
              Du kan nå endre dette til &ldquo;i tide&rdquo; hvis du har fått ny informasjon.
            </p>

            {kanEndreRiggPreklusjon && (
              <FormField label="Rigg/drift preklusjon">
                <Controller
                  name="endre_rigg_preklusjon"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value ? 'ja' : 'nei'}
                      onValueChange={(val: string) => field.onChange(val === 'ja')}
                    >
                      <RadioItem
                        value="ja"
                        label="Ja - rigg/drift var likevel varslet i tide"
                        description="Kravet er ikke lenger prekludert"
                      />
                      <RadioItem value="nei" label="Nei - behold vurdering (for sent)" />
                    </RadioGroup>
                  )}
                />
              </FormField>
            )}

            {kanEndreProduktivitetPreklusjon && (
              <FormField label="Produktivitet preklusjon">
                <Controller
                  name="endre_produktivitet_preklusjon"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value ? 'ja' : 'nei'}
                      onValueChange={(val: string) => field.onChange(val === 'ja')}
                    >
                      <RadioItem
                        value="ja"
                        label="Ja - produktivitet var likevel varslet i tide"
                        description="Kravet er ikke lenger prekludert"
                      />
                      <RadioItem value="nei" label="Nei - behold vurdering (for sent)" />
                    </RadioGroup>
                  )}
                />
              </FormField>
            )}
          </div>
        )}

        {/* ============================================
            PORT 3: OPPGJØRSFORM - Endre til TEs gunst
            ============================================ */}
        {kanEndreMetode && (
          <div className="p-4 border-2 border-pkt-border-subtle rounded-none space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="font-bold">Oppgjørsform</h4>
              <Badge variant="warning">Kan endres</Badge>
            </div>

            {kanEndreMetodeAksept && (
              <>
                <p className="text-sm text-pkt-text-body-subtle">
                  Du avviste tidligere den foreslåtte oppgjørsformen.
                  Du kan nå akseptere den.
                </p>
                <FormField label="Vil du akseptere oppgjørsformen?">
                  <Controller
                    name="endre_metode_aksept"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup
                        value={field.value ? 'ja' : 'nei'}
                        onValueChange={(val: string) => field.onChange(val === 'ja')}
                      >
                        <RadioItem
                          value="ja"
                          label="Ja - aksepter den foreslåtte oppgjørsformen"
                        />
                        <RadioItem value="nei" label="Nei - behold avvisning" />
                      </RadioGroup>
                    )}
                  />
                </FormField>
              </>
            )}

            {kanEndreEpJustering && (
              <>
                <p className="text-sm text-pkt-text-body-subtle">
                  Du avviste tidligere kravet om justerte enhetspriser (§34.3.3).
                  Du kan nå akseptere det.
                </p>
                <FormField label="Vil du akseptere EP-justering?">
                  <Controller
                    name="endre_ep_justering"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup
                        value={field.value ? 'ja' : 'nei'}
                        onValueChange={(val: string) => field.onChange(val === 'ja')}
                      >
                        <RadioItem
                          value="ja"
                          label="Ja - aksepter justering av enhetspriser"
                        />
                        <RadioItem value="nei" label="Nei - behold avvisning" />
                      </RadioGroup>
                    )}
                  />
                </FormField>
              </>
            )}
          </div>
        )}

        {/* ============================================
            PORT 4: BELØP - Endre til TEs gunst
            ============================================ */}
        {(kanEndreSamletResultat || kanEndreGranularBelop) && (
          <div className="p-4 border-2 border-pkt-border-subtle rounded-none space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="font-bold">Beløp</h4>
              <Badge variant="warning">Kan endres</Badge>
            </div>

            {/* Samlet resultat (enkel modus) */}
            {kanEndreSamletResultat && !erTilbakehold && (
              <>
                <p className="text-sm text-pkt-text-body-subtle">
                  {varAvslatt
                    ? 'Du avviste kravet. Du kan nå godkjenne helt eller delvis.'
                    : `Du godkjente ${tidligereGodkjentBelop.toLocaleString('nb-NO')} kr. Du kan kun øke beløpet.`}
                </p>

                <FormField label="Samlet resultat" error={errors.nytt_resultat?.message}>
                  <Controller
                    name="nytt_resultat"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup value={field.value ?? ''} onValueChange={field.onChange}>
                        <RadioItem value="" label="Ingen endring" />
                        {getSamletResultatOptions().map((option) => (
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

                {nyttResultat === 'delvis_godkjent' && (
                  <div className="ml-6 p-4 bg-pkt-grays-gray-100 rounded">
                    <FormField
                      label="Godkjent beløp"
                      hint={
                        varDelvisGodkjent
                          ? `Må være høyere enn tidligere godkjent (${tidligereGodkjentBelop.toLocaleString('nb-NO')} kr)`
                          : undefined
                      }
                    >
                      <Controller
                        name="godkjent_belop"
                        control={control}
                        render={({ field }) => (
                          <CurrencyInput
                            value={field.value ?? null}
                            onChange={field.onChange}
                            min={varDelvisGodkjent ? tidligereGodkjentBelop + 1 : 0}
                            max={krevdBelop - 1}
                          />
                        )}
                      />
                    </FormField>
                    {varDelvisGodkjent &&
                      godkjentBelop !== undefined &&
                      godkjentBelop <= tidligereGodkjentBelop && (
                        <p className="text-sm text-pkt-brand-red-1000 mt-2">
                          Beløpet må være høyere enn tidligere godkjent (
                          {tidligereGodkjentBelop.toLocaleString('nb-NO')} kr)
                        </p>
                      )}
                  </div>
                )}
              </>
            )}

            {/* Tilbakeholdelse spesialhåndtering */}
            {erTilbakehold && (
              <>
                <p className="text-sm text-pkt-text-body-subtle">
                  Du holder tilbake betaling (§30.2). Du kan nå oppheve tilbakeholdelsen.
                </p>

                <FormField label="Opphev tilbakeholdelse">
                  <Controller
                    name="nytt_resultat"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup value={field.value ?? ''} onValueChange={field.onChange}>
                        <RadioItem value="" label="Fortsett tilbakeholdelse" />
                        {getSamletResultatOptions().map((option) => (
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

                {nyttResultat === 'delvis_godkjent' && (
                  <div className="ml-6 p-4 bg-pkt-grays-gray-100 rounded">
                    <FormField label="Godkjent beløp">
                      <Controller
                        name="godkjent_belop"
                        control={control}
                        render={({ field }) => (
                          <CurrencyInput
                            value={field.value ?? null}
                            onChange={field.onChange}
                            min={0}
                            max={krevdBelop - 1}
                          />
                        )}
                      />
                    </FormField>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Begrunnelse */}
        <FormField label="Begrunnelse for endring" required error={errors.kommentar?.message}>
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
              (nyttResultat === 'delvis_godkjent' && !godkjentBelop) ||
              (nyttResultat === 'delvis_godkjent' &&
                varDelvisGodkjent &&
                (godkjentBelop ?? 0) <= tidligereGodkjentBelop) ||
              !watch('kommentar')
            }
            size="lg"
          >
            {isSubmitting ? 'Lagrer...' : 'Lagre Endringer'}
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
