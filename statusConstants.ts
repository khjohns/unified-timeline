/**
 * Sentral status-mapping for KOE-systemet
 * Disse verdiene må samsvare med backend (app.py) og constants.ts
 */

// ============================================
// SAK-STATUSER (hovedstatus for hele saken)
// ============================================
export const SAK_STATUS = {
  UNDER_VARSLING: '100000000',
  VARSLET: '100000001',
  VENTER_PAA_SVAR: '100000002',
  BEHANDLET: '100000003',
  LUKKET: '100000004',
} as const;

export type SakStatus = typeof SAK_STATUS[keyof typeof SAK_STATUS];

// ============================================
// KOE-STATUSER (status per krav-revisjon)
// ============================================
export const KOE_STATUS = {
  UTKAST: '100000001',              // Under utarbeidelse
  SENDT_TIL_BH: '100000002',        // Sendt til byggherre
  BESVART: '200000001',             // Byggherre har svart
} as const;

export type KoeStatus = typeof KOE_STATUS[keyof typeof KOE_STATUS];

// ============================================
// BH SVAR-STATUSER (status per BH svar)
// ============================================
export const BH_SVAR_STATUS = {
  UTKAST: '300000001',              // Under utarbeidelse
  GODKJENT: '300000002',            // Fullt godkjent
  DELVIS_GODKJENT: '300000003',     // Delvis godkjent
  AVSLÅTT: '300000004',             // Avslått
} as const;

export type BhSvarStatus = typeof BH_SVAR_STATUS[keyof typeof BH_SVAR_STATUS];

// ============================================
// VEDERLAG SVAR-KODER (BH respons på vederlag)
// ============================================
export const BH_VEDERLAG_SVAR = {
  GODKJENT_FULLT: '100000000',
  DELVIS_GODKJENT: '100000001',
  AVSLÅTT_UENIG: '100000002',
  AVSLÅTT_FOR_SENT: '100000003',
  AVVENTER: '100000004',
  GODKJENT_ANNEN_METODE: '100000005',
} as const;

export type BhVederlagSvar = typeof BH_VEDERLAG_SVAR[keyof typeof BH_VEDERLAG_SVAR];

// ============================================
// FRIST SVAR-KODER (BH respons på frist)
// ============================================
export const BH_FRIST_SVAR = {
  GODKJENT_FULLT: '100000000',
  DELVIS_GODKJENT: '100000001',
  AVSLÅTT: '100000002',
  AVVENTER: '100000003',
} as const;

export type BhFristSvar = typeof BH_FRIST_SVAR[keyof typeof BH_FRIST_SVAR];

// ============================================
// HJELPEFUNKSJONER
// ============================================

/**
 * Sjekker om en BH-respons krever revisjon av kravet
 */
export function kreverRevisjon(vederlagSvar?: string, fristSvar?: string): boolean {
  const vederlagKreverRevisjon = vederlagSvar && [
    BH_VEDERLAG_SVAR.DELVIS_GODKJENT,
    BH_VEDERLAG_SVAR.AVSLÅTT_UENIG,
  ].includes(vederlagSvar as BhVederlagSvar);

  const fristKreverRevisjon = fristSvar && [
    BH_FRIST_SVAR.DELVIS_GODKJENT,
    BH_FRIST_SVAR.AVSLÅTT,
  ].includes(fristSvar as BhFristSvar);

  return !!(vederlagKreverRevisjon || fristKreverRevisjon);
}

/**
 * Returnerer menneskelesbar beskrivelse av sak-status
 */
export function getSakStatusLabel(status?: string): string {
  switch (status) {
    case SAK_STATUS.UNDER_VARSLING:
      return 'Under varsling';
    case SAK_STATUS.VARSLET:
      return 'Varslet';
    case SAK_STATUS.VENTER_PAA_SVAR:
      return 'Venter på svar';
    case SAK_STATUS.BEHANDLET:
      return 'Behandlet';
    case SAK_STATUS.LUKKET:
      return 'Lukket';
    default:
      return 'Ukjent status';
  }
}

/**
 * Returnerer menneskelesbar beskrivelse av KOE-status
 */
export function getKoeStatusLabel(status?: string): string {
  switch (status) {
    case KOE_STATUS.UTKAST:
      return 'Utkast';
    case KOE_STATUS.SENDT_TIL_BH:
      return 'Sendt til BH';
    case KOE_STATUS.BESVART:
      return 'Besvart';
    default:
      return 'Ukjent';
  }
}

/**
 * Returnerer farge-skin for KOE-status (for PktTag)
 */
export function getKoeStatusSkin(status?: string): 'grey' | 'blue' | 'green' | 'red' | 'yellow' {
  switch (status) {
    case KOE_STATUS.UTKAST:
      return 'grey';
    case KOE_STATUS.SENDT_TIL_BH:
      return 'blue';
    case KOE_STATUS.BESVART:
      return 'green';
    default:
      return 'grey';
  }
}
