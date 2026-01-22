/**
 * SendInnModal Component
 *
 * Modal for submitting a fravik-søknad for review.
 * Shows read-only summary before submission.
 *
 * Confirmation is implicit: user clicks "Send inn" on page,
 * then confirms by clicking "Send inn" in modal.
 */

import { useState, useRef } from 'react';
import {
  Alert,
  Button,
  DataList,
  DataListItem,
  Modal,
  SectionContainer,
  useToast,
} from '../primitives';
import { useFravikSubmit } from '../../hooks/useFravikSubmit';
import { TokenExpiredAlert } from '../alerts/TokenExpiredAlert';
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

  // Track pending toast for dismissal
  const pendingToastId = useRef<string | null>(null);

  const mutation = useFravikSubmit({
    onSuccess: (result) => {
      // Dismiss pending toast and show success
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      onOpenChange(false);
      if (result.type === 'send_inn') {
        toast.success('Søknad sendt inn', 'Søknaden er nå til vurdering hos miljørådgiver.');
        onSuccess?.();
      }
    },
    onError: (error) => {
      // Dismiss pending toast
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
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

  const handleSubmit = () => {
    // Show pending toast immediately for better UX
    pendingToastId.current = toast.pending('Sender inn søknad...', 'Vennligst vent mens søknaden behandles.');

    mutation.mutate({
      type: 'send_inn',
      sakId,
      aktor: 'bruker', // TODO: Get from auth context
      expectedVersion: state.antall_events,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send inn søknad"
      size="md"
    >
      <div className="space-y-6">
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

        {/* Avbøtende tiltak (read-only) */}
        <SectionContainer title="Avbøtende tiltak og konsekvenser">
          <DataList>
            <DataListItem label="Avbøtende tiltak">
              <span className="whitespace-pre-wrap">{state.avbotende_tiltak}</span>
            </DataListItem>
            <DataListItem label="Konsekvenser ved avslag">
              <span className="whitespace-pre-wrap">{state.konsekvenser_ved_avslag}</span>
            </DataListItem>
          </DataList>
        </SectionContainer>

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
            disabled={mutation.isPending}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Avbryt
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={mutation.isPending}
            disabled={!kanSendesInn}
            onClick={handleSubmit}
            className="w-full sm:w-auto order-1 sm:order-2"
          >
            Send inn søknad
          </Button>
        </div>
      </div>

      {/* Token expired alert */}
      <TokenExpiredAlert
        open={showTokenExpired}
        onClose={() => setShowTokenExpired(false)}
      />
    </Modal>
  );
}
