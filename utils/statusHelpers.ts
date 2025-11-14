import { KoeStatus } from '../types';

export const STATUS_OPTIONS = [
  { value: '', label: '— Velg status —' },
  { value: '100000000', label: 'Under varsling' },
  { value: '100000001', label: 'Under utarbeidelse' },
  { value: '100000002', label: 'KOE sendt' },
  { value: '100000003', label: 'Under avklaring' },
  { value: '100000004', label: 'Godkjent' },
  { value: '100000005', label: 'EO utstedes' },
  { value: '100000006', label: 'Avslått - Komplett' },
  { value: '100000007', label: 'Avslått - Under vurdering' },
  { value: '100000008', label: 'Avslått - Under tvist' },
  { value: '100000009', label: 'Tilbakekalt av TE' },
  { value: '100000010', label: 'For sent varslet' },
  { value: '100000011', label: 'Lukket - Implementert' },
  { value: '100000012', label: 'Lukket - Annullert' },
  { value: '100000013', label: 'Pågår - Under utførelse' },
];

export const getStatusLabel = (status?: KoeStatus): string => {
  if (!status) return 'Utkast';
  const option = STATUS_OPTIONS.find((opt) => opt.value === status);
  return option ? option.label : 'Ukjent status';
};

export const getStatusSkin = (status?: KoeStatus): 'blue' | 'green' | 'red' | 'beige' | 'yellow' | 'grey' => {
  if (!status) return 'grey'; // Utkast

  switch (status) {
    // Under arbeid / pågående
    case '100000000': // Under varsling
    case '100000001': // Under utarbeidelse
    case '100000002': // KOE sendt
    case '100000003': // Under avklaring
      return 'blue';

    // Positivt / godkjent
    case '100000004': // Godkjent
    case '100000005': // EO utstedes
    case '100000011': // Lukket - Implementert
    case '100000013': // Pågår - Under utførelse
      return 'green';

    // Avslag / problemer
    case '100000006': // Avslått - Komplett
    case '100000007': // Avslått - Under vurdering
    case '100000008': // Avslått - Under tvist
    case '100000010': // For sent varslet
      return 'red';

    // Avbrutt / annullert
    case '100000009': // Tilbakekalt av TE
    case '100000012': // Lukket - Annullert
      return 'beige';

    default:
      return 'grey';
  }
};
