/**
 * OpprettSakPage Component
 *
 * Page for creating new KOE (Krav om Endringsordre) cases.
 * Used primarily for external deployments where users don't have
 * access to the terminal/Catenda integration.
 *
 * Creates a new case by submitting a grunnlag_opprettet event.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  FormField,
  Input,
  RadioGroup,
  RadioItem,
  Textarea,
} from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import {
  HOVEDKATEGORI_OPTIONS,
  getHovedkategori,
  getUnderkategoriObj,
  erLovendring,
  getGrupperteUnderkategorier,
  VARSEL_METODER_OPTIONS,
} from '../constants';
import { apiFetch, USE_MOCK_API, mockDelay } from '../api/client';

// Schema for the form
const opprettSakSchema = z.object({
  sak_id: z.string()
    .min(1, 'Sak-ID er påkrevd')
    .regex(/^[A-Za-z0-9\-_]+$/, 'Sak-ID kan kun inneholde bokstaver, tall, bindestrek og understrek'),
  hovedkategori: z.string().min(1, 'Hovedkategori er påkrevd'),
  underkategori: z.array(z.string()).min(1, 'Minst én underkategori må velges'),
  tittel: z.string().min(3, 'Tittel må være minst 3 tegn').max(100, 'Tittel kan ikke være lengre enn 100 tegn'),
  beskrivelse: z.string().min(10, 'Beskrivelse må være minst 10 tegn'),
  dato_oppdaget: z.string().min(1, 'Dato oppdaget er påkrevd'),
  varsel_sendes_na: z.boolean().optional(),
  dato_varsel_sendt: z.string().optional(),
  varsel_metode: z.array(z.string()).optional(),
  kontraktsreferanser: z.string().optional(),
  er_etter_tilbud: z.boolean().optional(),
});

type OpprettSakFormData = z.infer<typeof opprettSakSchema>;

// Generate a unique case ID
function generateSakId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SAK-${year}${month}${day}-${random}`;
}

interface BatchEventResponse {
  success: boolean;
  event_ids?: string[];
  new_version?: number;
  state?: Record<string, unknown>;
  error?: string;
  message?: string;
}

export function OpprettSakPage() {
  const navigate = useNavigate();
  const [selectedHovedkategori, setSelectedHovedkategori] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    control,
    watch,
  } = useForm<OpprettSakFormData>({
    resolver: zodResolver(opprettSakSchema),
    defaultValues: {
      sak_id: generateSakId(),
      hovedkategori: '',
      underkategori: [],
      varsel_sendes_na: true,
      varsel_metode: [],
      er_etter_tilbud: false,
    },
  });

  const hovedkategoriValue = watch('hovedkategori');
  const varselSendesNa = watch('varsel_sendes_na');
  const selectedUnderkategorier = watch('underkategori');
  const erEtterTilbud = watch('er_etter_tilbud');

  // Get selected category info
  const valgtHovedkategori = useMemo(
    () => getHovedkategori(selectedHovedkategori),
    [selectedHovedkategori]
  );

  // Get all selected underkategorier info
  const valgteUnderkategorier = useMemo(() => {
    if (!selectedUnderkategorier?.length) return [];
    return selectedUnderkategorier
      .map((kode) => getUnderkategoriObj(kode))
      .filter((obj): obj is NonNullable<typeof obj> => obj !== undefined);
  }, [selectedUnderkategorier]);

  // Check if any selected underkategori is a law change (§14.4)
  const harLovendring = useMemo(() => {
    return selectedUnderkategorier?.some((kode) => erLovendring(kode)) ?? false;
  }, [selectedUnderkategorier]);

  // Mutation for creating the case
  const createCaseMutation = useMutation<BatchEventResponse, Error, OpprettSakFormData>({
    mutationFn: async (data) => {
      // Mock mode
      if (USE_MOCK_API) {
        await mockDelay(800);
        return {
          success: true,
          event_ids: [`evt-mock-${Date.now()}`],
          new_version: 1,
        };
      }

      // Build VarselInfo structure
      const varselDato = data.varsel_sendes_na
        ? new Date().toISOString().split('T')[0]
        : data.dato_varsel_sendt;

      const varselMetode = data.varsel_sendes_na
        ? ['system']
        : (data.varsel_metode || []);

      const grunnlagVarsel = varselDato
        ? {
            dato_sendt: varselDato,
            metode: varselMetode,
          }
        : undefined;

      // Convert comma-separated string to array
      const kontraktsreferanser = data.kontraktsreferanser
        ? data.kontraktsreferanser.split(',').map((ref) => ref.trim())
        : [];

      // Create the batch request with grunnlag_opprettet event
      const batchPayload = {
        sak_id: data.sak_id,
        expected_version: 0,
        events: [
          {
            event_type: 'grunnlag_opprettet',
            aktor: 'Bruker',
            aktor_rolle: 'TE',
            data: {
              hovedkategori: data.hovedkategori,
              underkategori: data.underkategori,
              tittel: data.tittel,
              beskrivelse: data.beskrivelse,
              dato_oppdaget: data.dato_oppdaget,
              grunnlag_varsel: grunnlagVarsel,
              kontraktsreferanser,
              meta: harLovendring ? { er_etter_tilbud: data.er_etter_tilbud } : undefined,
            },
          },
        ],
      };

      return apiFetch<BatchEventResponse>('/api/events/batch', {
        method: 'POST',
        body: JSON.stringify(batchPayload),
      });
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        // Navigate to the newly created case
        navigate(`/saker/${variables.sak_id}`);
      }
    },
  });

  // Reset underkategori when hovedkategori changes
  const handleHovedkategoriChange = (value: string) => {
    setSelectedHovedkategori(value);
    setValue('hovedkategori', value);
    setValue('underkategori', []);
    setValue('er_etter_tilbud', false);
  };

  const onSubmit = (data: OpprettSakFormData) => {
    createCaseMutation.mutate(data);
  };

  const handleGenerateNewId = () => {
    setValue('sak_id', generateSakId());
  };

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      {/* Header */}
      <PageHeader
        title="Opprett ny sak"
        subtitle="Registrer en ny endringsmelding (KOE)"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/demo')}
          >
            Tilbake
          </Button>
        }
      />

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-2 py-4 sm:px-4 sm:py-6">
        <Card variant="outlined" padding="lg">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Sak-ID */}
            <FormField
              label="Sak-ID"
              required
              error={errors.sak_id?.message}
              helpText="Unik identifikator for saken. Du kan bruke den genererte ID-en eller skrive din egen."
            >
              <div className="flex gap-3">
                <Input
                  id="sak_id"
                  data-testid="sak-id"
                  {...register('sak_id')}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleGenerateNewId}
                >
                  Generer ny
                </Button>
              </div>
            </FormField>

            {/* Tittel */}
            <FormField
              label="Tittel på saken"
              required
              error={errors.tittel?.message}
              helpText="Kort beskrivende tittel for enkel identifikasjon"
            >
              <Input
                id="tittel"
                data-testid="sak-tittel"
                {...register('tittel')}
                fullWidth
                placeholder="F.eks. 'Endret fundamentering grunnet grunnforhold'"
              />
            </FormField>

            {/* Hovedkategori */}
            <FormField
              label="Hovedkategori (NS 8407)"
              required
              error={errors.hovedkategori?.message}
              labelTooltip="Velg juridisk grunnlag iht. NS 8407. Dette bestemmer hvilke kontraktsbestemmelser som gjelder."
            >
              <Controller
                name="hovedkategori"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleHovedkategoriChange(value);
                    }}
                    data-testid="sak-hovedkategori"
                  >
                    {HOVEDKATEGORI_OPTIONS.filter(opt => opt.value !== '').map((option) => (
                      <RadioItem
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        error={!!errors.hovedkategori}
                      />
                    ))}
                  </RadioGroup>
                )}
              />
            </FormField>

            {/* Category info box */}
            {valgtHovedkategori && (
              <Alert variant="info" title={`Hjemmel: NS 8407 §${valgtHovedkategori.hjemmel_frist}`}>
                {valgtHovedkategori.beskrivelse}
                <div className="mt-2 text-xs">
                  <strong>Type krav:</strong> {valgtHovedkategori.type_krav}
                  {valgtHovedkategori.hjemmel_vederlag && (
                    <> | <strong>Vederlag:</strong> §{valgtHovedkategori.hjemmel_vederlag}</>
                  )}
                </div>
              </Alert>
            )}

            {/* Underkategori */}
            {selectedHovedkategori && valgtHovedkategori && valgtHovedkategori.underkategorier.length > 0 && (
              <Controller
                name="underkategori"
                control={control}
                render={({ field }) => {
                  const grupperteUnderkategorier = getGrupperteUnderkategorier(valgtHovedkategori.underkategorier);
                  return (
                    <FormField
                      label="Underkategori"
                      required
                      error={errors.underkategori?.message}
                    >
                      <div className="space-y-4 max-h-80 overflow-y-auto border border-pkt-border-default rounded p-4 bg-pkt-bg-subtle" data-testid="sak-underkategori-list">
                        {Array.from(grupperteUnderkategorier.entries()).map(([gruppeNavn, underkategorier]) => (
                          <div key={gruppeNavn ?? 'ungrouped'}>
                            {gruppeNavn && (
                              <p className="text-sm font-semibold text-pkt-text-body mb-2">{gruppeNavn}</p>
                            )}
                            <div className="space-y-2 pl-0">
                              {underkategorier.map((uk) => (
                                <Checkbox
                                  key={uk.kode}
                                  id={`underkategori-${uk.kode}`}
                                  label={`${uk.label} (§${uk.hjemmel_basis})`}
                                  checked={field.value?.includes(uk.kode) ?? false}
                                  onCheckedChange={(checked) => {
                                    const current = field.value ?? [];
                                    if (checked) {
                                      field.onChange([...current, uk.kode]);
                                    } else {
                                      field.onChange(current.filter((v: string) => v !== uk.kode));
                                    }
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </FormField>
                  );
                }}
              />
            )}

            {/* Underkategori info */}
            {valgteUnderkategorier.length > 0 && (
              <div className="space-y-3">
                {valgteUnderkategorier.map((underkat) => (
                  <Alert key={underkat.kode} variant="info" title={underkat.label}>
                    {underkat.beskrivelse}
                    <p className="text-xs mt-2">
                      <strong>Hjemmel:</strong> §{underkat.hjemmel_basis} | <strong>Varslingskrav:</strong> §{underkat.varselkrav_ref}
                    </p>
                  </Alert>
                ))}
              </div>
            )}

            {/* Law change check (§14.4) */}
            {harLovendring && (
              <Alert variant="warning" title="Lovendring (§14.4)">
                <Controller
                  name="er_etter_tilbud"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="er_etter_tilbud"
                      label="Bekreft at endringen inntraff ETTER tilbudsfristens utløp"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                {!erEtterTilbud && (
                  <p className="text-xs text-pkt-text-danger mt-2">
                    Hvis lovendringen var kjent ved tilbudsfrist, ligger risikoen normalt hos deg.
                  </p>
                )}
              </Alert>
            )}

            {/* Beskrivelse */}
            <FormField
              label="Beskrivelse"
              required
              error={errors.beskrivelse?.message}
              helpText="Beskriv grunnlaget for endringsmeldingen"
            >
              <Textarea
                id="beskrivelse"
                data-testid="sak-beskrivelse"
                {...register('beskrivelse')}
                rows={5}
                fullWidth
                error={!!errors.beskrivelse}
                placeholder="Beskriv omstendighetene rundt kravet..."
              />
            </FormField>

            {/* Dato og varsel-seksjon */}
            <div className="bg-pkt-surface-subtle p-4 rounded border border-pkt-border-default space-y-4">
              <FormField
                label="Dato forhold oppdaget"
                required
                error={errors.dato_oppdaget?.message}
              >
                <Controller
                  name="dato_oppdaget"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      id="dato_oppdaget"
                      data-testid="sak-dato-oppdaget"
                      value={field.value}
                      onChange={field.onChange}
                      error={!!errors.dato_oppdaget}
                    />
                  )}
                />
              </FormField>

              {/* Varsel sendes nå checkbox */}
              <Controller
                name="varsel_sendes_na"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="varsel_sendes_na"
                    data-testid="sak-varsel-sendes-na"
                    label="Varsel sendes nå (sammen med denne registreringen)"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            {/* Dato varsel sendt - only show if NOT sending now */}
            {!varselSendesNa && (
              <FormField
                label="Dato varsel sendt tidligere"
                helpText="Dokumenter når byggherren ble varslet tidligere"
              >
                <Controller
                  name="dato_varsel_sendt"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      id="dato_varsel_sendt"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FormField>
            )}

            {/* Varsel metode - only show if NOT sending now */}
            {!varselSendesNa && (
              <FormField
                label="Varselmetode"
                helpText="Hvordan ble byggherren varslet? (Kan velge flere)"
              >
                <div className="space-y-3 border border-pkt-border-default rounded p-4 bg-pkt-bg-subtle">
                  {VARSEL_METODER_OPTIONS.map((option) => (
                    <Checkbox
                      key={option.value}
                      id={`varsel-${option.value}`}
                      label={option.label}
                      value={option.value}
                      {...register('varsel_metode')}
                    />
                  ))}
                </div>
              </FormField>
            )}

            {/* Kontraktsreferanser */}
            <FormField
              label="Kontraktsreferanser (valgfritt)"
              helpText="Separer flere referanser med komma"
            >
              <Input
                id="kontraktsreferanser"
                type="text"
                {...register('kontraktsreferanser')}
                fullWidth
                placeholder="F.eks. §12.3, Vedlegg A pkt. 4.2"
              />
            </FormField>

            {/* Guidance text */}
            <Alert variant="info" title="Hva skjer videre?">
              Etter at saken er opprettet, kan du legge til krav om vederlag (penger)
              og fristforlengelse (tid) i egne steg.
            </Alert>

            {/* Error Message */}
            {createCaseMutation.isError && (
              <Alert variant="danger" title="Feil ved opprettelse">
                {createCaseMutation.error instanceof Error
                  ? createCaseMutation.error.message
                  : 'En feil oppstod'}
              </Alert>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t-2 border-pkt-border-subtle">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/demo')}
                disabled={isSubmitting || createCaseMutation.isPending}
                size="lg"
                className="w-full sm:w-auto"
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || createCaseMutation.isPending}
                size="lg"
                className="w-full sm:w-auto"
                data-testid="sak-submit"
              >
                {createCaseMutation.isPending ? 'Oppretter...' : 'Opprett sak'}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}

export default OpprettSakPage;
