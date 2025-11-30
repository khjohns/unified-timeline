import { SakStatus, KoeStatus, BhSvarStatus } from '../types';

// ============ STATUS KONSTANTER ============
export const SAK_STATUS = {
  UNDER_VARSLING: '100000000',
  VARSLET: '100000001',
  VENTER_PAA_SVAR: '100000002',
  UNDER_AVKLARING: '100000003',
  VURDERES_AV_TE: '100000007',
  OMFORENT: '100000005',
  PAAGAAR: '100000013',
  UNDER_TVIST: '100000008',
  LUKKET_IMPLEMENTERT: '100000011',
  LUKKET_AVSLÅTT: '100000006',
  LUKKET_TILBAKEKALT: '100000009',
  LUKKET_ANNULLERT: '100000012',
} as const;

export const KOE_STATUS = {
  UTKAST: '100000001',
  SENDT_TIL_BH: '100000002',
  BESVART: '200000001',
  TILBAKEKALT: '100000009',
} as const;

export const BH_SVAR_STATUS = {
  UTKAST: '300000001',
  GODKJENT: '100000004',
  DELVIS_GODKJENT: '300000002',
  AVSLÅTT_FOR_SENT: '100000010',
  AVSLÅTT_UENIG: '100000006',
  KREVER_AVKLARING: '100000003',
} as const;

export const BH_VEDERLAG_KODER = {
  GODKJENT_FULLT: '100000000',
  DELVIS_GODKJENT: '100000001',
  AVSLÅTT_UENIG: '100000002',
  AVSLÅTT_FOR_SENT: '100000003',
  AVVENTER: '100000004',
  GODKJENT_ANNEN_METODE: '100000005',
} as const;

export const BH_FRIST_KODER = {
  GODKJENT_FULLT: '100000000',
  DELVIS_GODKJENT: '100000001',
  AVSLÅTT_UENIG: '100000002',
  AVSLÅTT_FOR_SENT: '100000003',
  AVVENTER: '100000004',
} as const;

// ============ SAK STATUS (Nivå 1: Hovedstatus) ============
export const SAK_STATUS_OPTIONS = [
  { value: '', label: '— Velg status —' },
  { value: '100000000', label: 'Under varsling' },
  { value: '100000001', label: 'Varslet' },
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

    case '100000001': // Varslet
      return 'blue';

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

// ============ BH VEDERLAG/FRIST HJELPEFUNKSJONER ============
export function isVederlagGodkjent(code?: string): boolean {
  return code === BH_VEDERLAG_KODER.GODKJENT_FULLT;
}

export function isVederlagDelvis(code?: string): boolean {
  return code === BH_VEDERLAG_KODER.DELVIS_GODKJENT;
}

export function isVederlagAvslått(code?: string): boolean {
  return code === BH_VEDERLAG_KODER.AVSLÅTT_UENIG ||
         code === BH_VEDERLAG_KODER.AVSLÅTT_FOR_SENT;
}

export function isFristGodkjent(code?: string): boolean {
  return code === BH_FRIST_KODER.GODKJENT_FULLT;
}

export function isFristDelvis(code?: string): boolean {
  return code === BH_FRIST_KODER.DELVIS_GODKJENT;
}

export function isFristAvslått(code?: string): boolean {
  return code === BH_FRIST_KODER.AVSLÅTT_UENIG ||
         code === BH_FRIST_KODER.AVSLÅTT_FOR_SENT;
}
