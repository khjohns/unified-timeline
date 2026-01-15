/**
 * SendInnModal Component
 *
 * Modal for submitting a fravik-søknad for review.
 * Shows summary and confirmation before submission.
 */

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Checkbox,
  DataList,
  DataListItem,
  FormField,
  Modal,
  SectionContainer,
  Textarea,
  useToast,
} from '../primitives';
import { useFravikSubmit } from '../../hooks/useFravikSubmit';
import { oppdaterFravikSoknad } from '../../api/fravik';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
import { sendInnSchema, type SendInnFormData } from './schemas';
import type { FravikState } from '../../types/fravik';
import { formatDateShort } from '../../utils/formatters';

interface SendInnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  state: FravikState;
  onSuccess?: () => void;
}

export function SendInnModal({
  open,
  onOpenChange,
  sakId,
  state,
  onSuccess,
}: SendInnModalProps) {
  const toast = useToast();
  const [showTokenExpired, setShowTokenExpired] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = useForm<SendInnFormData>({
    resolver: zodResolver(sendInnSchema),
    defaultValues: {
      avbotende_tiltak: state.avbotende_tiltak || '',
      konsekvenser_ved_avslag: state.konsekvenser_ved_avslag || '',
      bekreft_korrekt: false,
    },
  });

  const mutation = useFravikSubmit({
    onSuccess: (result) => {
      reset();
      onOpenChange(false);
      if (result.type === 'send_inn') {
        toast.success('Søknad sendt inn', 'Søknaden er nå til vurdering hos BOI-rådgiver.');
        onSuccess?.();
      }
    },
    onError: (error) => {
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'TOKEN_MISSING') {
        setShowTokenExpired(true);
      } else {
        toast.error('Feil ved innsending', error.message);
      }
    },
  });

  // Check if søknad can be submitted
  const kanSendesInn = state.kan_sendes_inn;
  const antallMaskiner = state.antall_maskiner;

  const onSubmit = async (data: SendInnFormData) => {
    const aktor = 'bruker'; // TODO: Get from auth context
    let currentVersion = state.antall_events;

    console.log('[SendInnModal] Starting submit', { sakId, currentVersion, state });

    try {
      // Check if we need to update avbotende_tiltak (only if changed from state)
      const needsUpdate =
        data.avbotende_tiltak !== state.avbotende_tiltak ||
        data.konsekvenser_ved_avslag !== state.konsekvenser_ved_avslag;

      if (needsUpdate) {
        console.log('[SendInnModal] Calling oppdater with version', currentVersion);
        // Update søknad with additional info first
        await oppdaterFravikSoknad(
          sakId,
          {
            avbotende_tiltak: data.avbotende_tiltak,
            konsekvenser_ved_avslag: data.konsekvenser_ved_avslag,
          },
          aktor,
          currentVersion
        );
        // Version incremented after oppdater
        currentVersion += 1;
        console.log('[SendInnModal] Oppdater succeeded, new version', currentVersion);
      }

      console.log('[SendInnModal] Calling send_inn with version', currentVersion);
      // Submit the søknad with correct version
      mutation.mutate({
        type: 'send_inn',
        sakId,
        aktor,
        expectedVersion: currentVersion,
      });
    } catch (error) {
      console.error('[SendInnModal] Error in submit', error);
      toast.error('Feil ved oppdatering', error instanceof Error ? error.message : 'Ukjent feil');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send inn søknad"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Warning if not ready */}
        {!kanSendesInn && (
          <Alert variant="warning" title="Søknaden kan ikke sendes inn ennå">
            {antallMaskiner === 0
              ? 'Du må legge til minst én maskin før søknaden kan sendes inn.'
              : 'Søknaden mangler påkrevd informasjon.'}
          </Alert>
        )}

        {/* Summary */}
        <SectionContainer title="Oppsummering">
          <DataList>
            <DataListItem label="Prosjekt">{state.prosjekt_navn}</DataListItem>
            {state.prosjekt_nummer && (
              <DataListItem label="Prosjektnummer">{state.prosjekt_nummer}</DataListItem>
            )}
            <DataListItem label="Søker">{state.soker_navn}</DataListItem>
            <DataListItem label="Type søknad">
              {state.soknad_type === 'machine' ? 'Maskin' : 'Infrastruktur'}
            </DataListItem>
            <DataListItem label="Antall maskiner">{antallMaskiner}</DataListItem>
            {state.er_haste && (
              <DataListItem label="Hastebehandling">Ja</DataListItem>
            )}
            {state.opprettet && (
              <DataListItem label="Opprettet">{formatDateShort(state.opprettet)}</DataListItem>
            )}
          </DataList>
        </SectionContainer>

        {/* Tilleggsinformasjon */}
        <SectionContainer
          title="Tilleggsinformasjon"
          description="Påkrevd informasjon til saksbehandler"
        >
          <div className="space-y-4">
            <FormField
              label="Avbøtende tiltak"
              required
              error={errors.avbotende_tiltak?.message}
              helpText="Beskriv tiltak for å minimere miljøbelastning"
            >
              <Textarea
                id="avbotende_tiltak"
                {...register('avbotende_tiltak')}
                rows={3}
                fullWidth
                error={!!errors.avbotende_tiltak}
              />
            </FormField>

            <FormField
              label="Konsekvenser ved avslag"
              required
              error={errors.konsekvenser_ved_avslag?.message}
              helpText="Beskriv konsekvensene hvis søknaden avslås"
            >
              <Textarea
                id="konsekvenser_ved_avslag"
                {...register('konsekvenser_ved_avslag')}
                rows={3}
                fullWidth
                error={!!errors.konsekvenser_ved_avslag}
              />
            </FormField>
          </div>
        </SectionContainer>

        {/* Confirmation */}
        <div className="p-4 bg-pkt-bg-subtle rounded border border-pkt-border-default">
          <Controller
            name="bekreft_korrekt"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="bekreft_korrekt"
                label="Jeg bekrefter at informasjonen i søknaden er korrekt og fullstendig"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          {errors.bekreft_korrekt && (
            <p className="mt-2 text-sm text-alert-danger-text">
              {errors.bekreft_korrekt.message}
            </p>
          )}
        </div>

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
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting || mutation.isPending}
            disabled={!kanSendesInn}
            className="w-full sm:w-auto order-1 sm:order-2"
          >
            Send inn søknad
          </Button>
        </div>
      </form>

      {/* Token expired alert */}
      <TokenExpiredAlert
        open={showTokenExpired}
        onClose={() => setShowTokenExpired(false)}
      />
    </Modal>
  );
}
