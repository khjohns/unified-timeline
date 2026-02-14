interface ConsequenceInput {
  resultat: string | undefined;
  erEndringMed32_2?: boolean;
  varsletITide?: boolean;
  erForceMajeure?: boolean;
  erSnuoperasjon?: boolean;
  harSubsidiaereSvar?: boolean;
}

interface ConsequenceResult {
  variant: 'success' | 'warning' | 'danger' | 'info';
  text: string;
  snuoperasjonText?: string;
}

export function getConsequence(input: ConsequenceInput): ConsequenceResult | null {
  const { resultat, erEndringMed32_2, varsletITide, erForceMajeure, erSnuoperasjon, harSubsidiaereSvar } = input;

  if (!resultat) return null;

  const erPrekludert = erEndringMed32_2 && varsletITide === false;
  const snuoperasjonText = erSnuoperasjon && harSubsidiaereSvar
    ? 'Subsidiaere svar på vederlag og frist konverteres til prinsipale svar.'
    : undefined;

  // ---------- GODKJENT ----------
  if (resultat === 'godkjent') {
    if (erForceMajeure) {
      return {
        variant: 'success',
        text: 'Byggherren anerkjenner force majeure. TE kan ha grunnlag for krav om fristforlengelse — ikke vederlag (§33.3).',
        snuoperasjonText,
      };
    }
    if (erEndringMed32_2 && erPrekludert) {
      return {
        variant: 'success',
        text: 'Byggherren mener varselet ble sendt for sent (§32.2), men anerkjenner subsidiært grunnlag for krav. Preklusjonsstandpunktet gjelder prinsipalt.',
        snuoperasjonText,
      };
    }
    if (erEndringMed32_2 && varsletITide) {
      return {
        variant: 'success',
        text: 'Byggherren godtar at varselet ble sendt i tide, og anerkjenner grunnlag for krav. Vederlag og frist behandles separat.',
        snuoperasjonText,
      };
    }
    return {
      variant: 'success',
      text: 'Byggherren anerkjenner at TE kan ha grunnlag for krav. Vederlag og frist behandles separat.',
      snuoperasjonText,
    };
  }

  // ---------- AVSLÅTT ----------
  if (resultat === 'avslatt') {
    if (erForceMajeure) {
      return {
        variant: 'warning',
        text: 'Byggherren mener forholdet ikke kvalifiserer som force majeure. TE kan likevel sende krav om fristforlengelse.',
      };
    }
    if (erEndringMed32_2 && erPrekludert) {
      return {
        variant: 'danger',
        text: 'Byggherren påberoper §32.2-preklusjon (varslet for sent) og avslår subsidiært grunnlaget. Vederlag og frist behandles dobbelt-subsidiært.',
      };
    }
    if (erEndringMed32_2 && varsletITide) {
      return {
        variant: 'warning',
        text: 'Byggherren godtar at varselet ble sendt i tide, men avslår grunnlaget. Vederlag og frist behandles subsidiært.',
      };
    }
    return {
      variant: 'warning',
      text: 'Saken markeres som omtvistet. TE kan fortsatt sende krav om vederlag og frist, som BH behandler subsidiært.',
    };
  }

  // ---------- FRAFALT ----------
  if (resultat === 'frafalt') {
    return {
      variant: 'info',
      text: 'Pålegget frafalles (§32.3 c). Arbeidet trenger ikke utføres.',
    };
  }

  return null;
}
