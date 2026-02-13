/**
 * OpprettEndringsordre Page
 *
 * Page for creating new Endringsordre (Change Order) cases.
 * Uses the shared EndringsordreForm component for consistent UI.
 *
 * Follows the same pattern as OpprettSakPage.tsx:
 * - PageHeader with title and subtitle
 * - Card containing the form
 * - Auto-fill from backend data
 * - Submit via API, navigate on success
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  DropdownMenuItem,
  useToast,
} from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import {
  EndringsordreForm,
  endringsordreFormSchema,
  type EndringsordreFormData,
} from '../components/forms';
import {
  opprettEndringsordre,
  fetchKandidatKOESaker,
  fetchNesteEONummer,
  type OpprettEORequest,
} from '../api/endringsordre';
import { endringsordreKeys } from '../queries';
import { STALE_TIME } from '../constants/queryConfig';

export function OpprettEndringsordre() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  // KOE selection state (managed separately from form due to array handling)
  const [selectedKoeIds, setSelectedKoeIds] = useState<string[]>([]);

  // Form setup with react-hook-form + zod
  const form = useForm<EndringsordreFormData>({
    resolver: zodResolver(endringsordreFormSchema),
    mode: 'onTouched',
    defaultValues: {
      eo_nummer: '',
      tittel: '',
      beskrivelse: '',
      konsekvenser_sha: false,
      konsekvenser_kvalitet: false,
      konsekvenser_fremdrift: false,
      konsekvenser_pris: false,
      konsekvenser_annet: false,
      konsekvens_beskrivelse: '',
      er_estimat: false,
      kompensasjon_belop: null,
      fradrag_belop: null,
      frist_dager: null,
    },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
    watch,
    setValue,
  } = form;

  const formValues = watch();

  // Fetch candidate KOE cases
  const { data: kandidaterData, isLoading: kandidaterLoading } = useQuery({
    queryKey: endringsordreKeys.kandidater(),
    queryFn: fetchKandidatKOESaker,
    staleTime: STALE_TIME.DEFAULT,
  });

  const kandidatSaker = kandidaterData?.kandidat_saker ?? [];

  // Fetch next EO number from backend
  const { data: nesteNummerData } = useQuery({
    queryKey: endringsordreKeys.nesteNummer(),
    queryFn: fetchNesteEONummer,
    staleTime: STALE_TIME.DEFAULT,
  });

  // Auto-fill EO-nummer when backend data arrives and field is empty
  const hasAutoFilled = useRef(false);
  useEffect(() => {
    if (nesteNummerData?.neste_nummer && !hasAutoFilled.current) {
      const currentValue = formValues.eo_nummer;
      if (!currentValue) {
        setValue('eo_nummer', nesteNummerData.neste_nummer);
        hasAutoFilled.current = true;
      }
    }
  }, [nesteNummerData, formValues.eo_nummer, setValue]);

  // Computed values from KOE selection
  const totalFromKOE = useMemo(() => {
    return kandidatSaker
      .filter((k) => selectedKoeIds.includes(k.sak_id))
      .reduce((sum, k) => sum + (k.sum_godkjent || 0), 0);
  }, [kandidatSaker, selectedKoeIds]);

  const totalDagerFromKOE = useMemo(() => {
    return kandidatSaker
      .filter((k) => selectedKoeIds.includes(k.sak_id))
      .reduce((sum, k) => sum + (k.godkjent_dager || 0), 0);
  }, [kandidatSaker, selectedKoeIds]);

  // Auto-sett konsekvenser og beløp basert på KOE-valg
  useEffect(() => {
    // Auto-check priskonsekvens hvis det er godkjent beløp
    if (totalFromKOE > 0 && !formValues.konsekvenser_pris) {
      setValue('konsekvenser_pris', true);
    }
    // Auto-check fremdriftskonsekvens hvis det er godkjente dager
    if (totalDagerFromKOE > 0 && !formValues.konsekvenser_fremdrift) {
      setValue('konsekvenser_fremdrift', true);
    }
    // Auto-fyll kompensasjon hvis tomt og vi har KOE-beløp
    if (totalFromKOE > 0 && !formValues.kompensasjon_belop) {
      setValue('kompensasjon_belop', totalFromKOE);
    }
    // Auto-fyll frist hvis tomt og vi har KOE-dager
    if (totalDagerFromKOE > 0 && !formValues.frist_dager) {
      setValue('frist_dager', totalDagerFromKOE);
    }
  }, [totalFromKOE, totalDagerFromKOE, formValues.konsekvenser_pris, formValues.konsekvenser_fremdrift, formValues.kompensasjon_belop, formValues.frist_dager, setValue]);

  // Auto-sett er_estimat basert på beregningsmetode
  // ENHETSPRISER: Estimat (mengder varierer, derav enhetspriser)
  // REGNINGSARBEID: Estimat (kostnadsoverslag -> sluttoppgjør)
  // FASTPRIS_TILBUD: Ikke estimat (fast avtalt pris)
  useEffect(() => {
    if (formValues.oppgjorsform === 'FASTPRIS_TILBUD') {
      setValue('er_estimat', false);
    } else if (formValues.oppgjorsform) {
      setValue('er_estimat', true);
    }
  }, [formValues.oppgjorsform, setValue]);

  // Toggle KOE selection
  const toggleKoeSelection = (koeId: string) => {
    setSelectedKoeIds((prev) =>
      prev.includes(koeId) ? prev.filter((id) => id !== koeId) : [...prev, koeId]
    );
  };

  // Track pending toast for dismissal
  const pendingToastId = useRef<string | null>(null);

  // Create EO mutation
  const createEOMutation = useMutation({
    mutationFn: async (data: OpprettEORequest) => {
      return opprettEndringsordre(data);
    },
    onSuccess: (response) => {
      // Dismiss pending toast and show success
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      queryClient.invalidateQueries({ queryKey: endringsordreKeys.nesteNummer() });
      toast.success('Endringsordre opprettet', 'Du blir nå videresendt til endringsordren.');
      navigate(`/endringsordre/${response.sak_id}`);
    },
    onError: (error) => {
      // Dismiss pending toast
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      toast.error('Feil ved opprettelse', error instanceof Error ? error.message : 'En feil oppstod');
    },
  });

  // Submit handler
  const onSubmit = (data: EndringsordreFormData) => {
    const request: OpprettEORequest = {
      eo_nummer: data.eo_nummer,
      tittel: data.tittel,
      beskrivelse: data.beskrivelse,
      koe_sak_ids: selectedKoeIds.length > 0 ? selectedKoeIds : undefined,
      konsekvenser: {
        sha: data.konsekvenser_sha,
        kvalitet: data.konsekvenser_kvalitet,
        fremdrift: data.konsekvenser_fremdrift,
        pris: data.konsekvenser_pris,
        annet: data.konsekvenser_annet,
      },
      konsekvens_beskrivelse: data.konsekvens_beskrivelse || undefined,
      oppgjorsform: data.oppgjorsform || undefined,
      kompensasjon_belop: data.kompensasjon_belop ?? undefined,
      fradrag_belop: data.fradrag_belop ?? undefined,
      er_estimat: data.er_estimat,
      frist_dager: data.frist_dager ?? undefined,
      ny_sluttdato: data.ny_sluttdato || undefined,
    };

    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending('Oppretter endringsordre...', 'Vennligst vent mens endringsordren behandles.');
    createEOMutation.mutate(request);
  };

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      {/* Header */}
      <PageHeader
        title="Opprett endringsordre"
        subtitle="Utsted en formell endringsordre iht. NS 8407 §31.3"
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
            {/* Shared EndringsordreForm sections */}
            <EndringsordreForm
              form={form}
              kandidatSaker={kandidatSaker}
              kandidaterLoading={kandidaterLoading}
              selectedKoeIds={selectedKoeIds}
              onToggleKoeSelection={toggleKoeSelection}
              totalFromKOE={totalFromKOE}
              totalDagerFromKOE={totalDagerFromKOE}
              onGenererNesteNummer={() => {
                if (nesteNummerData?.neste_nummer) {
                  setValue('eo_nummer', nesteNummerData.neste_nummer);
                }
              }}
              genererNesteDisabled={!nesteNummerData}
            />

            {/* Guidance text */}
            <div className="p-4">
              <Alert variant="info" title="Hva skjer videre?">
                Etter at endringsordren er opprettet kan TE akseptere eller bestride den.
              </Alert>
            </div>

            {/* Error Message */}
            {createEOMutation.isError && (
              <div className="px-4 pb-4">
                <Alert variant="danger" title="Feil ved opprettelse">
                  {createEOMutation.error instanceof Error
                    ? createEOMutation.error.message
                    : 'En uventet feil oppstod'}
                </Alert>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-4 border-t-2 border-pkt-border-subtle">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/saker')}
                disabled={isSubmitting || createEOMutation.isPending}
                className="w-full sm:w-auto"
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || createEOMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createEOMutation.isPending ? 'Oppretter...' : 'Opprett endringsordre'}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}

export default OpprettEndringsordre;
