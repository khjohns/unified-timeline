import { SakStatus, KoeStatus, BhSvarStatus } from '../types';

// ============ SAK STATUS (Nivå 1: Hovedstatus) ============
export const SAK_STATUS_OPTIONS = [
  { value: '', label: '— Velg status —' },
  { value: '100000000', label: 'Under varsling' },
  { value: '100000002', label: 'Venter på svar' },
  { value: '100000003', label: 'Under avklaring' },
  { value: '100000007', label: 'Vurderes av TE' },
  { value: '100000005', label: 'Omforent (EO utstedes)' },
  { value: '100000013', label: 'Pågår - Under utførelse' },
  { value: '100000008', label: 'Under tvist' },
  { value: '100000011', label: 'Lukket (Implementert)' },
  { value: '100000006', label: 'Lukket (Avslått)' },
  { value: '100000009', label: 'Lukket (Tilbakekalt)' },
  { value: '100000012', label: 'Lukket (Annullert)' },
];

export const getSakStatusLabel = (status?: SakStatus): string => {
  if (!status) return 'Ikke satt';
  const option = SAK_STATUS_OPTIONS.find((opt) => opt.value === status);
  return option ? option.label : 'Ukjent status';
};

export const getSakStatusSkin = (status?: SakStatus): 'blue' | 'green' | 'red' | 'beige' | 'yellow' | 'grey' => {
  if (!status) return 'grey';

  switch (status) {
    case '100000000': // Under varsling
      return 'grey';

    case '100000002': // Venter på svar
    case '100000013': // Pågår - Under utførelse
      return 'blue';

    case '100000003': // Under avklaring
    case '100000007': // Vurderes av TE
      return 'yellow';

    case '100000005': // Omforent (EO utstedes)
    case '100000011': // Lukket (Implementert)
      return 'green';

    case '100000008': // Under tvist
      return 'red';

    case '100000006': // Lukket (Avslått)
    case '100000009': // Lukket (Tilbakekalt)
    case '100000012': // Lukket (Annullert)
      return 'grey';

    default:
      return 'grey';
  }
};

// ============ KRAV STATUS (Nivå 2: TEs Revisjon) ============
export const KRAV_STATUS_OPTIONS = [
  { value: '', label: '— Velg status —' },
  { value: '100000001', label: 'Utkast' },
  { value: '100000002', label: 'Sendt til BH' },
  { value: '200000001', label: 'Besvart' },
  { value: '100000009', label: 'Tilbakekalt' },
];

export const getKravStatusLabel = (status?: KoeStatus): string => {
  if (!status) return 'Utkast';
  const option = KRAV_STATUS_OPTIONS.find((opt) => opt.value === status);
  return option ? option.label : 'Ukjent status';
};

export const getKravStatusSkin = (status?: KoeStatus): 'blue' | 'green' | 'red' | 'beige' | 'yellow' | 'grey' => {
  if (!status || status === '100000001') return 'grey'; // Utkast

  switch (status) {
    case '100000002': // Sendt til BH
      return 'blue';

    case '200000001': // Besvart
      return 'green';

    case '100000009': // Tilbakekalt
      return 'beige';

    default:
      return 'grey';
  }
};

// ============ BH SVAR STATUS (Nivå 3: BHs Revisjon) ============
export const SVAR_STATUS_OPTIONS = [
  { value: '', label: '— Velg status —' },
  { value: '300000001', label: 'Utkast' },
  { value: '100000004', label: 'Godkjent' },
  { value: '300000002', label: 'Delvis Godkjent' },
  { value: '100000010', label: 'Avslått (For sent)' },
  { value: '100000006', label: 'Avslått (Uenig)' },
  { value: '100000003', label: 'Krever avklaring' },
];

export const getSvarStatusLabel = (status?: BhSvarStatus): string => {
  if (!status) return 'Utkast';
  const option = SVAR_STATUS_OPTIONS.find((opt) => opt.value === status);
  return option ? option.label : 'Ukjent status';
};

export const getSvarStatusSkin = (status?: BhSvarStatus): 'blue' | 'green' | 'red' | 'beige' | 'yellow' | 'grey' => {
  if (!status || status === '300000001') return 'grey'; // Utkast

  switch (status) {
    case '100000004': // Godkjent
    case '300000002': // Delvis Godkjent
      return 'green';

    case '100000010': // Avslått (For sent)
    case '100000006': // Avslått (Uenig)
      return 'red';

    case '100000003': // Krever avklaring
      return 'yellow';

    default:
      return 'grey';
  }
};

// ============ DEPRECATED (for bakoverkompatibilitet) ============
// Disse kan fjernes når alle komponenter er oppdatert
export const STATUS_OPTIONS = KRAV_STATUS_OPTIONS;
export const getStatusLabel = getKravStatusLabel;
export const getStatusSkin = getKravStatusSkin;
