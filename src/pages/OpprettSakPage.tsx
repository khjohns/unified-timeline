/**
 * OpprettSakPage Component
 *
 * Page for creating new KOE (Krav om Endringsordre) cases.
 * Uses the shared GrunnlagForm component for consistent UI.
 *
 * Creates a new case by submitting a grunnlag_opprettet event.
 */

import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  DropdownMenuItem,
  FormField,
  Input,
  SectionContainer,
  useToast,
} from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import {
  GrunnlagForm,
  grunnlagFormSchema,
  grunnlagFormRefine,
  grunnlagFormRefineMessage,
} from '../components/forms';
import { apiFetch } from '../api/client';
import type { StateResponse } from '../types/api';

// Schema extends grunnlagFormSchema with sak_id
const opprettSakSchema = grunnlagFormSchema.extend({
  sak_id: z.string()
    .min(1, 'Sak-ID er påkrevd')
    .regex(/^[A-Za-z0-9\-_]+$/, 'Sak-ID kan kun inneholde bokstaver, tall, bindestrek og understrek'),
}).refine(grunnlagFormRefine, grunnlagFormRefineMessage);

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

  const form = useForm<OpprettSakFormData>({
    resolver: zodResolver(opprettSakSchema),
    defaultValues: {
      sak_id: generateSakId(),
      hovedkategori: '',
      underkategori: '',
      tittel: '',
      beskrivelse: '',
      dato_oppdaget: '',
      varsel_sendes_na: true,
      varsel_metode: [],
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = form;

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
            {/* Seksjon 1: Identifikasjon (unique to this page) */}
            <SectionContainer
              title="Identifikasjon"
              description="Unik identifikator for saken"
            >
              <FormField
                label="Sak-ID"
                required
                error={errors.sak_id?.message}
                helpText="Du kan bruke den genererte ID-en eller skrive din egen."
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
            </SectionContainer>

            {/* Shared GrunnlagForm sections */}
            <GrunnlagForm
              form={form}
              selectedHovedkategori={selectedHovedkategori}
              onHovedkategoriChange={handleHovedkategoriChange}
              testIdPrefix="sak"
            />

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
