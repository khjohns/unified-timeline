/**
 * OpprettSakPage Component
 *
 * Page for creating new KOE (Krav om Endringsordre) cases.
 * Used primarily for external deployments where users don't have
 * access to the terminal/Catenda integration.
 *
 * Creates a new case by submitting a grunnlag_opprettet event.
 */

import { useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  DropdownMenuItem,
  FormField,
  Input,
  RadioGroup,
  RadioItem,
  SectionContainer,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from '../components/primitives';
import { VarselSeksjon } from '../components/actions/shared/VarselSeksjon';
import { PageHeader } from '../components/PageHeader';
import { KontraktsregelInline } from '../components/shared';
import {
  HOVEDKATEGORI_OPTIONS,
  getHovedkategori,
  getUnderkategoriObj,
  getGrupperteUnderkategorier,
} from '../constants';
import { apiFetch } from '../api/client';
import type { StateResponse } from '../types/api';
import { getPreklusjonsvarsel, getPreklusjonsvarselMellomDatoer, beregnDagerSiden } from '../utils/preklusjonssjekk';

// Schema for the form
// Underkategori is only required if the hovedkategori has underkategorier (e.g., not Force Majeure)
const opprettSakSchema = z.object({
  sak_id: z.string()
    .min(1, 'Sak-ID er påkrevd')
    .regex(/^[A-Za-z0-9\-_]+$/, 'Sak-ID kan kun inneholde bokstaver, tall, bindestrek og understrek'),
  hovedkategori: z.string().min(1, 'Kategori er påkrevd'),
  underkategori: z.string().default(''),
  tittel: z.string().min(3, 'Tittel må være minst 3 tegn').max(100, 'Tittel kan ikke være lengre enn 100 tegn'),
  beskrivelse: z.string().min(10, 'Beskrivelse må være minst 10 tegn'),
  dato_oppdaget: z.string().min(1, 'Dato oppdaget er påkrevd'),
  varsel_sendes_na: z.boolean().optional(),
  dato_varsel_sendt: z.string().optional(),
  varsel_metode: z.array(z.string()).optional(),
}).refine(
  (data) => {
    // Check if hovedkategori has underkategorier
    const hovedkat = getHovedkategori(data.hovedkategori);
    if (!hovedkat || hovedkat.underkategorier.length === 0) {
      // No underkategorier required (e.g., Force Majeure)
      return true;
    }
    // Require underkategori to be selected
    return data.underkategori.length > 0;
  },
  {
    message: 'Hjemmel må velges',
    path: ['underkategori'],
  }
);

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
  const queryClient = useQueryClient();
  const [selectedHovedkategori, setSelectedHovedkategori] = useState<string>('');
  const toast = useToast();

  // Track pending toast for dismissal
  const pendingToastId = useRef<string | null>(null);

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
      underkategori: '',
      varsel_sendes_na: true,
      varsel_metode: [],
    },
  });

  const hovedkategoriValue = watch('hovedkategori');
  const varselSendesNa = watch('varsel_sendes_na');
  const selectedUnderkategorier = watch('underkategori');
  const datoOppdaget = watch('dato_oppdaget');
  const datoVarselSendt = watch('dato_varsel_sendt');

  // Get selected category info
  const valgtHovedkategori = useMemo(
    () => getHovedkategori(selectedHovedkategori),
    [selectedHovedkategori]
  );

  // Get selected underkategori info
  const valgtUnderkategori = useMemo(() => {
    if (!selectedUnderkategorier) return undefined;
    return getUnderkategoriObj(selectedUnderkategorier);
  }, [selectedUnderkategorier]);

  // Calculate preclusion risk for current moment (when sending now)
  const preklusjonsResultat = useMemo(() => {
    if (!datoOppdaget) return null;
    return getPreklusjonsvarsel(beregnDagerSiden(datoOppdaget), undefined, selectedHovedkategori);
  }, [datoOppdaget, selectedHovedkategori]);

  // Calculate preclusion risk between discovery and earlier notification date
  const preklusjonsResultatVarsel = useMemo(() => {
    if (!datoOppdaget || !datoVarselSendt || varselSendesNa) return null;
    return getPreklusjonsvarselMellomDatoer(datoOppdaget, datoVarselSendt, undefined, selectedHovedkategori);
  }, [datoOppdaget, datoVarselSendt, varselSendesNa, selectedHovedkategori]);

  // Mutation for creating the case
  const createCaseMutation = useMutation<BatchEventResponse, Error, OpprettSakFormData>({
    mutationFn: async (data) => {
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
      // Dismiss pending toast and show success
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      if (result.success) {
        toast.success('Sak opprettet', 'Du blir nå videresendt til saken.');
        // Pre-populate React Query cache with the state from POST response.
        // This prevents a race condition where the GET request might fail
        // if it arrives before the database write is fully committed.
        if (result.state && result.new_version !== undefined) {
          queryClient.setQueryData<StateResponse>(
            ['sak', variables.sak_id, 'state'],
            {
              version: result.new_version,
              state: result.state as unknown as StateResponse['state'],
            }
          );
        }
        navigate(`/saker/${variables.sak_id}`);
      }
    },
    onError: (error) => {
      // Dismiss pending toast
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      toast.error('Feil ved opprettelse', error.message || 'En feil oppstod');
    },
  });

  // Reset underkategori when hovedkategori changes
  const handleHovedkategoriChange = (value: string) => {
    setSelectedHovedkategori(value);
    setValue('hovedkategori', value, { shouldDirty: true });
    setValue('underkategori', '', { shouldDirty: true });
  };

  const onSubmit = (data: OpprettSakFormData) => {
    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending('Oppretter sak...', 'Vennligst vent mens saken behandles.');

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
        menuActions={
          <DropdownMenuItem asChild>
            <Link to="/saker">Tilbake til oversikt</Link>
          </DropdownMenuItem>
        }
      />

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-2 pt-2 pb-4 sm:px-4 sm:pt-3 sm:pb-6">
        <Card variant="outlined" padding="none">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
            {/* Seksjon 1: Identifikasjon */}
            <SectionContainer
              title="Identifikasjon"
              description="Sak-ID og tittel for enkel identifikasjon"
            >
              <div className="space-y-4">
                <FormField
                  label="Sak-ID"
                  required
                  error={errors.sak_id?.message}
                  helpText="Unik identifikator for saken. Du kan bruke den genererte ID-en eller skrive din egen."
                >
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      id="sak_id"
                      data-testid="sak-id"
                      {...register('sak_id')}
                      className="w-full sm:w-56"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleGenerateNewId}
                      className="w-full sm:w-auto"
                    >
                      Generer ny
                    </Button>
                  </div>
                </FormField>

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
                    className="w-full sm:max-w-md"
                    placeholder="F.eks. 'Endret fundamentering grunnet grunnforhold'"
                  />
                </FormField>
              </div>
            </SectionContainer>

            {/* Seksjon 2: Ansvarsgrunnlag */}
            <SectionContainer
              title="Ansvarsgrunnlag"
            >
              <div className="space-y-4">
                {/* Hovedkategori */}
                <FormField
                  label="Hovedkategori"
                  required
                  error={errors.hovedkategori?.message}
                  helpText="Velg rettslig grunnlag iht. NS 8407. Dette bestemmer hvilke kontraktsbestemmelser som gjelder og hvilke krav som kan fremmes."
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
                        {HOVEDKATEGORI_OPTIONS.filter(opt => opt.value !== '').map((option) => {
                          const erValgt = field.value === option.value;
                          const kategoriInfo = erValgt ? getHovedkategori(option.value) : null;
                          return (
                            <div key={option.value}>
                              <RadioItem
                                value={option.value}
                                label={option.label}
                                error={!!errors.hovedkategori}
                              />
                              {erValgt && kategoriInfo && (
                                <div className="mt-2 ml-6">
                                  <KontraktsregelInline
                                    custom={{
                                      tekst: kategoriInfo.beskrivelse,
                                      konsekvens: `Fristforlengelse: §${kategoriInfo.hjemmel_frist}${kategoriInfo.hjemmel_vederlag ? `, Vederlagsjustering: §${kategoriInfo.hjemmel_vederlag}` : ''}`,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </RadioGroup>
                    )}
                  />
                </FormField>

                {/* Underkategori - Dynamic based on hovedkategori, grouped Select */}
                {selectedHovedkategori && valgtHovedkategori && valgtHovedkategori.underkategorier.length > 0 && (
                  <Controller
                    name="underkategori"
                    control={control}
                    render={({ field }) => {
                      const grupperteUnderkategorier = getGrupperteUnderkategorier(valgtHovedkategori.underkategorier);
                      // Map underkategori til KontraktsregelInline hjemmel (der tilgjengelig)
                      const hjemmelMap: Record<string, '§10.2' | '§14.4' | '§14.6' | '§15.2' | '§19.1' | '§21.4' | '§22' | '§23.1' | '§23.3' | '§24.1' | '§24.2.2' | '§26.3' | '§29.2' | '§32.1' | '§38.1'> = {
                        'VALGRETT': '§14.6',
                        'SVAR_VARSEL': '§24.2.2',
                        'LOV_GJENSTAND': '§14.4',
                        'LOV_PROSESS': '§15.2',
                        'IRREG': '§32.1',
                        'GRUNN': '§23.1',
                        'KULTURMINNER': '§23.3',
                        'PROSJ_RISIKO': '§24.1',
                        'MEDVIRK': '§22',
                        'GEBYR': '§26.3',
                        'SAMORD': '§21.4',
                        'NEKT_MH': '§10.2',
                        'SKADE_BH': '§19.1',
                        'BRUKSTAKELSE': '§38.1',
                        'STANS_BET': '§29.2',
                      };
                      const hjemmel = field.value ? hjemmelMap[field.value] : undefined;
                      return (
                        <FormField
                          label="Hjemmel"
                          required
                          error={errors.underkategori?.message}
                        >
                          <div className="space-y-2">
                            <Select
                              value={field.value || ''}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                error={!!errors.underkategori}
                                data-testid="sak-underkategori-list"
                              >
                                <SelectValue placeholder="Velg hjemmel" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from(grupperteUnderkategorier.entries()).map(([gruppeNavn, underkategorier]) => (
                                  <SelectGroup key={gruppeNavn ?? 'ungrouped'}>
                                    {gruppeNavn && <SelectLabel>{gruppeNavn}</SelectLabel>}
                                    {underkategorier.map((uk) => (
                                      <SelectItem key={uk.kode} value={uk.kode}>
                                        {uk.label}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                ))}
                              </SelectContent>
                            </Select>
                            {/* Vis hjemmel-info for valgt underkategori */}
                            {field.value && valgtUnderkategori && (
                              <div className="mt-2">
                                {hjemmel ? (
                                  <KontraktsregelInline hjemmel={hjemmel} />
                                ) : (
                                  <KontraktsregelInline
                                    custom={{
                                      tekst: valgtUnderkategori.beskrivelse,
                                      hjemmel: `§${valgtUnderkategori.hjemmel_basis}`,
                                      konsekvens: `Varslingskrav: §${valgtUnderkategori.varselkrav_ref}`,
                                    }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </FormField>
                      );
                    }}
                  />
                )}

              </div>
            </SectionContainer>

            {/* Seksjon 3: Beskrivelse */}
            <SectionContainer
              title="Beskrivelse"
              description="Beskriv forholdet som varsles"
            >
              <div className="space-y-4">
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

              </div>
            </SectionContainer>

            {/* Seksjon 4: Tidspunkt - når ble forholdet oppdaget */}
            <SectionContainer
              title="Tidspunkt"
              description="Når ble endringsforholdet oppdaget?"
            >
              <FormField
                label="Dato forhold oppdaget"
                required
                error={errors.dato_oppdaget?.message}
                helpText="Datoen da forholdet som gir grunnlag for endringskravet ble kjent for deg"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
                  {datoOppdaget && (
                    <span className="text-sm text-pkt-text-body-subtle whitespace-nowrap">
                      {beregnDagerSiden(datoOppdaget)} dager siden
                    </span>
                  )}
                </div>
              </FormField>
            </SectionContainer>

            {/* Seksjon 5: Varsling - når og hvordan ble byggherre varslet */}
            <SectionContainer
              title="Varsling"
              description="Når og hvordan ble byggherre varslet om forholdet?"
            >
              <VarselSeksjon
                checkboxLabel="Varselet ble sendt tidligere"
                harTidligere={!(varselSendesNa ?? true)}
                onHarTidligereChange={(value) => setValue('varsel_sendes_na', !value)}
                datoSendt={watch('dato_varsel_sendt')}
                onDatoSendtChange={(value) => setValue('dato_varsel_sendt', value)}
                datoError={errors.dato_varsel_sendt?.message}
                registerMetoder={register('varsel_metode')}
                idPrefix="opprett_sak"
                testId="sak-varsel-valg"
                extraContent={
                  preklusjonsResultatVarsel?.alert && (
                    <div className="mt-3">
                      <Alert
                        variant={preklusjonsResultatVarsel.alert.variant}
                        title={preklusjonsResultatVarsel.alert.title}
                      >
                        {preklusjonsResultatVarsel.alert.message}
                      </Alert>
                    </div>
                  )
                }
              />
            </SectionContainer>

            {/* Guidance text */}
            <div className="p-4">
              <Alert variant="info" title="Hva skjer videre?">
                Etter at saken er opprettet, kan du legge til krav om vederlag (penger)
                og fristforlengelse (tid) i egne steg.
              </Alert>
            </div>

            {/* Error Message */}
            {createCaseMutation.isError && (
              <div className="px-4 pb-4">
                <Alert variant="danger" title="Feil ved opprettelse">
                  {createCaseMutation.error instanceof Error
                    ? createCaseMutation.error.message
                    : 'En feil oppstod'}
                </Alert>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-4 border-t-2 border-pkt-border-subtle">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/saker')}
                disabled={isSubmitting || createCaseMutation.isPending}
                className="w-full sm:w-auto"
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || createCaseMutation.isPending}
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
