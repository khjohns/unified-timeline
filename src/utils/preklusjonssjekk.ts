/**
 * Preklusjonssjekk Utility
 *
 * Functions for checking notification deadlines and preclusion risks
 * based on NS 8407 Norwegian Standard.
 *
 * Viktig: NS 8407 har forskjellige preklusjonsregler for grunnlag vs vederlag:
 *
 * Grunnlagsvarsel (brukes i SendGrunnlagModal):
 * - ENDRING (§32.2): Taper retten til å påberope at forholdet er en endring
 * - SVIKT/ANDRE (§25.1.2): BH kan kreve erstatning for tap som kunne vært unngått
 * - FORCE_MAJEURE (§33.4): Taper retten til fristforlengelse
 *
 * Vederlagsvarsel - ulikt per hovedkategori:
 * - ENDRING (§34.1.1): Ingen preklusjon - TE taper ikke vederlagskravet ved sen varsling
 * - SVIKT/ANDRE (§34.1.2): Preklusjon - «Krav på vederlagsjustering tapes»
 * - FORCE_MAJEURE: Ingen vederlag (kun fristforlengelse)
 *
 * Særskilte krav (§34.1.3) - gjelder alle hovedkategorier:
 * - Rigg/drift og produktivitetstap krever særskilt varsel
 * - Preklusjon: «taper han retten til å påberope seg påløpte utgifter»
 * - Sjekkes med sjekkRiggDriftFrist()
 */

import { differenceInDays, parseISO } from 'date-fns';

// Alert configuration for UI rendering
export interface AlertConfig {
  variant: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
}

// Preclusion status
export type PreklusjonsStatus = 'ok' | 'varsel' | 'kritisk';

export interface PreklusjonsResultat {
  status: PreklusjonsStatus;
  dagerSiden: number;
  alert?: AlertConfig;
}

// Thresholds for "uten ugrunnet opphold" (without undue delay)
const VARSEL_TERSKEL_DAGER = 3;   // Soft warning after 3 days
const KRITISK_TERSKEL_DAGER = 14; // Critical after 14 days (rule of thumb)

/**
 * Calculate days since a given date
 */
export function beregnDagerSiden(dato: string | Date): number {
  const parsedDato = typeof dato === 'string' ? parseISO(dato) : dato;
  return differenceInDays(new Date(), parsedDato);
}

/**
 * Check if preclusion is critical based on days and rule type
 */
export function erPreklusjonKritisk(dager: number, regelType?: string): boolean {
  // For different rule types, thresholds might vary
  switch (regelType) {
    case 'RIGG_DRIFT':
      return dager > 7; // Stricter for rigg/drift
    case 'IRREGULAER':
      return dager > 10; // Irregulære endringer
    case 'SPESIFISERT':
      return dager > 21; // Spesifisert krav after neutral notice
    default:
      return dager > KRITISK_TERSKEL_DAGER;
  }
}

/**
 * Get category-specific preclusion consequence text for GRUNNLAGSVARSEL.
 *
 * MERK: Dette gjelder KUN grunnlagsvarsel, IKKE vederlagsvarsel.
 * For vederlag, se sjekkVederlagspreklusjon().
 *
 * Grunnlagspreklusjon per hovedkategori:
 * - ENDRING (§32.2): Taper retten til å påberope at forholdet innebærer en endring
 * - SVIKT/ANDRE (§25.1.2): BH kan kreve erstatning for tap som kunne vært unngått
 * - FORCE_MAJEURE (§33.4): Taper retten til fristforlengelse
 */
function getPreklusjonskonsekvens(hovedkategori?: string): {
  kritiskTittel: string;
  kritiskMelding: string;
  varselTittel: string;
  varselMelding: string;
} {
  switch (hovedkategori) {
    case 'ENDRING':
      return {
        kritiskTittel: 'Preklusjonsfare (§32.2)',
        kritiskMelding: 'Du risikerer å tape retten til å påberope at forholdet innebærer en endring. Sørg for å begrunne tidsbruken godt.',
        varselTittel: 'Husk varslingsfrist (§32.2)',
        varselMelding: 'Varsel skal sendes raskest mulig for å unngå diskusjon om frister.',
      };
    case 'SVIKT':
    case 'ANDRE':
      return {
        kritiskTittel: 'Preklusjonsfare (§25.1.2)',
        kritiskMelding: 'Ved sen varsling kan byggherren kreve erstatning for tap som kunne vært unngått ved rettidig varsel. Dokumenter årsaken til tidsbruken.',
        varselTittel: 'Husk varslingsfrist (§25.1.2)',
        varselMelding: 'Varsle snarest for å unngå erstatningsansvar for tap byggherren kunne unngått.',
      };
    case 'FORCE_MAJEURE':
      return {
        kritiskTittel: 'Preklusjonsfare (§33.4)',
        kritiskMelding: 'Kravet på fristforlengelse kan være tapt. Dokumenter godt hvorfor varsling tok tid.',
        varselTittel: 'Husk varslingsfrist (§33.4)',
        varselMelding: 'Varsle snarest for å sikre retten til fristforlengelse.',
      };
    default:
      // Fallback for ukjent kategori
      return {
        kritiskTittel: 'Preklusjonsfare!',
        kritiskMelding: 'NS 8407 krever varsling "uten ugrunnet opphold". Ved å sende dette nå, risikerer du at kravet er svekket. Sørg for å begrunne tidsbruken godt.',
        varselTittel: 'Husk varslingsfrist',
        varselMelding: 'Varsel skal sendes raskest mulig for å sikre bevis og unngå diskusjon om frister.',
      };
  }
}

/**
 * Get preclusion warning/alert based on days since discovery
 */
export function getPreklusjonsvarsel(
  dager: number,
  regelType?: string,
  hovedkategori?: string
): PreklusjonsResultat {
  const kritisk = erPreklusjonKritisk(dager, regelType);
  const konsekvens = getPreklusjonskonsekvens(hovedkategori);

  if (kritisk) {
    return {
      status: 'kritisk',
      dagerSiden: dager,
      alert: {
        variant: 'danger',
        title: konsekvens.kritiskTittel,
        message: `Det er gått ${dager} dager siden forholdet ble oppdaget. ${konsekvens.kritiskMelding}`,
      },
    };
  }

  if (dager > VARSEL_TERSKEL_DAGER) {
    return {
      status: 'varsel',
      dagerSiden: dager,
      alert: {
        variant: 'warning',
        title: konsekvens.varselTittel,
        message: `Det er gått ${dager} dager siden oppdagelse. ${konsekvens.varselMelding}`,
      },
    };
  }

  return {
    status: 'ok',
    dagerSiden: dager,
  };
}

/**
 * Check BH passivity for irregular changes (§32.3)
 */
export function sjekkBHPassivitet(
  datoMottak: string | Date,
  svarType?: string
): PreklusjonsResultat {
  const dager = beregnDagerSiden(datoMottak);

  // BH should respond quickly to irregular change notices
  if (dager > 10 && svarType === 'AVVIST') {
    return {
      status: 'kritisk',
      dagerSiden: dager,
      alert: {
        variant: 'danger',
        title: 'Passivitet (§32.3)',
        message: `Du har brukt ${dager} dager på å svare. Ved irregulær endring kan passivitet medføre at endringen anses akseptert (§32.3).`,
      },
    };
  }

  if (dager > 5) {
    return {
      status: 'varsel',
      dagerSiden: dager,
      alert: {
        variant: 'warning',
        title: 'Svar raskt',
        message: `Det er gått ${dager} dager siden mottak. Svar "uten ugrunnet opphold" for å unngå tap av innsigelsesrett.`,
      },
    };
  }

  return {
    status: 'ok',
    dagerSiden: dager,
  };
}

/**
 * Check if rigg/drift notice is too late (§34.1.3)
 */
export function sjekkRiggDriftFrist(datoKlarOver: string | Date): PreklusjonsResultat {
  const dager = beregnDagerSiden(datoKlarOver);

  if (dager > 7) {
    return {
      status: 'kritisk',
      dagerSiden: dager,
      alert: {
        variant: 'danger',
        title: 'Preklusjonsfare (§34.1.3)',
        message: `Det er gått ${dager} dager. Du risikerer at retten til å kreve rigg/drift/produktivitet er tapt fordi varselet ikke er sendt "uten ugrunnet opphold".`,
      },
    };
  }

  if (dager > 3) {
    return {
      status: 'varsel',
      dagerSiden: dager,
      alert: {
        variant: 'warning',
        title: 'Varsle snart (§34.1.3)',
        message: `Særskilt varsel for rigg/drift kreves "uten ugrunnet opphold". Ikke vent for lenge.`,
      },
    };
  }

  return {
    status: 'ok',
    dagerSiden: dager,
  };
}

/**
 * Check if specification of frist claim is too late (§33.6.1)
 */
export function sjekkFristSpesifiseringFrist(
  datoFristVarsel: string | Date,
  harMottattForesporsel: boolean
): PreklusjonsResultat {
  const dager = beregnDagerSiden(datoFristVarsel);

  // If BH has sent a formal forespørsel, it's critical
  if (harMottattForesporsel) {
    return {
      status: 'kritisk',
      dagerSiden: dager,
      alert: {
        variant: 'danger',
        title: 'KRITISK: Forespørsel mottatt (§33.6.2)',
        message: `Byggherren har etterspurt dette kravet per brev. Du må svare "uten ugrunnet opphold". Hvis du ikke sender kravet nå, TAPES HELE RETTEN til fristforlengelse i denne saken.`,
      },
    };
  }

  // Normal case - check against soft deadline
  if (dager > 21) {
    return {
      status: 'kritisk',
      dagerSiden: dager,
      alert: {
        variant: 'warning',
        title: 'Risiko for avkortning (§33.6.1)',
        message: `Det er gått ${dager} dager siden du varslet om hendelsen. Når du venter med å spesifisere, har du kun krav på den fristforlengelsen Byggherren "måtte forstå" at du trengte. Begrunn behovet ekstra godt.`,
      },
    };
  }

  if (dager > 14) {
    return {
      status: 'varsel',
      dagerSiden: dager,
      alert: {
        variant: 'info',
        title: 'Spesifiser snart',
        message: `Det er gått ${dager} dager siden varsel om fristforlengelse. Jo lengre du venter, jo større er risikoen for reduksjon etter skjønn.`,
      },
    };
  }

  return {
    status: 'ok',
    dagerSiden: dager,
  };
}

/**
 * Check if overslagssøkning requires notice (§30.2)
 */
export function erOverslagsokningVarselpliktig(
  gammeltOverslag: number,
  nyttOverslag: number,
  vesentlighetsterskel = 0.15 // 15% increase is "vesentlig"
): boolean {
  if (!gammeltOverslag || gammeltOverslag <= 0) return false;
  const okning = (nyttOverslag - gammeltOverslag) / gammeltOverslag;
  return okning > vesentlighetsterskel;
}

/**
 * Get preclusion warning based on time between two dates (e.g., discovery and notification)
 * Used when user reports that notification was sent earlier (not now via system)
 */
export function getPreklusjonsvarselMellomDatoer(
  datoOppdaget: string | Date,
  datoVarselSendt: string | Date,
  regelType?: string,
  hovedkategori?: string
): PreklusjonsResultat {
  const parsedOppdaget = typeof datoOppdaget === 'string' ? parseISO(datoOppdaget) : datoOppdaget;
  const parsedVarsel = typeof datoVarselSendt === 'string' ? parseISO(datoVarselSendt) : datoVarselSendt;
  const dager = differenceInDays(parsedVarsel, parsedOppdaget);

  // Negative days means varsel was sent before discovery (which is fine/unusual)
  if (dager < 0) {
    return {
      status: 'ok',
      dagerSiden: 0,
      alert: {
        variant: 'info',
        title: 'Varseldato før oppdagelse',
        message: 'Varselet ble sendt før oppdagelsesdato. Kontroller at datoene er korrekte.',
      },
    };
  }

  const kritisk = erPreklusjonKritisk(dager, regelType);
  const konsekvens = getPreklusjonskonsekvens(hovedkategori);

  if (kritisk) {
    return {
      status: 'kritisk',
      dagerSiden: dager,
      alert: {
        variant: 'danger',
        title: konsekvens.kritiskTittel,
        message: `Det gikk ${dager} dager fra oppdagelse til varsling. ${konsekvens.kritiskMelding}`,
      },
    };
  }

  if (dager > VARSEL_TERSKEL_DAGER) {
    return {
      status: 'varsel',
      dagerSiden: dager,
      alert: {
        variant: 'warning',
        title: konsekvens.varselTittel,
        message: `Det gikk ${dager} dager fra oppdagelse til varsling. Dokumenter årsaken til tidsbruken.`,
      },
    };
  }

  return {
    status: 'ok',
    dagerSiden: dager,
  };
}

// ============================================================================
// VEDERLAGSPREKLUSJON (§34.1.1 vs §34.1.2)
// ============================================================================

/**
 * Vederlagspreklusjon - resultat fra sjekk
 */
export interface VederlagspreklusjonsResultat {
  /** Om preklusjon gjelder for denne hovedkategorien */
  harPreklusjon: boolean;
  /** Hjemmel for preklusjonsregelen (eller mangel på sådan) */
  hjemmel: string;
  /** Forklaring til brukeren */
  forklaring: string;
  /** Alert-konfigurasjon hvis relevant */
  alert?: AlertConfig;
}

/**
 * Sjekk om vederlagspreklusjon gjelder for gitt hovedkategori.
 *
 * NS 8407 har forskjellige regler:
 * - §34.1.1 (ENDRING): Ingen preklusjon - TE taper ikke vederlagskravet
 * - §34.1.2 (SVIKT/ANDRE): Preklusjon - kravet tapes ved for sen varsling
 * - FORCE_MAJEURE: Ingen vederlag (kun fristforlengelse)
 *
 * Merk: Dette gjelder hovedkravet. Særskilte krav (§34.1.3) har alltid
 * preklusjon uavhengig av hovedkategori - bruk sjekkRiggDriftFrist() for disse.
 *
 * @param hovedkategori - ENDRING, SVIKT, ANDRE, eller FORCE_MAJEURE
 * @param dagerSidenOppdagelse - Antall dager siden forholdet ble oppdaget
 * @returns VederlagspreklusjonsResultat med info om preklusjon gjelder
 */
export function sjekkVederlagspreklusjon(
  hovedkategori: string,
  dagerSidenOppdagelse?: number
): VederlagspreklusjonsResultat {
  switch (hovedkategori) {
    case 'ENDRING':
      // §34.1.1: Ingen preklusjonsregel for vederlag ved endringer
      return {
        harPreklusjon: false,
        hjemmel: '§34.1.1',
        forklaring:
          'Ved endringer (§34.1.1) tapes ikke vederlagskravet selv om varselet kommer sent. ' +
          'Men grunnlagsvarselet (§32.2) må fortsatt sendes i tide for å påberope at forholdet er en endring.',
      };

    case 'SVIKT':
    case 'ANDRE':
      // §34.1.2: Preklusjon - kravet tapes
      const erKritisk = dagerSidenOppdagelse !== undefined && dagerSidenOppdagelse > KRITISK_TERSKEL_DAGER;
      const erVarsel = dagerSidenOppdagelse !== undefined && dagerSidenOppdagelse > VARSEL_TERSKEL_DAGER;

      const resultat: VederlagspreklusjonsResultat = {
        harPreklusjon: true,
        hjemmel: '§34.1.2',
        forklaring:
          'Ved svikt eller andre forhold (§34.1.2) tapes vederlagskravet dersom det ikke varsles ' +
          '«uten ugrunnet opphold» etter at TE blir eller burde ha blitt klar over forholdet.',
      };

      // Legg til alert hvis dager er oppgitt og terskel er overskredet
      if (erKritisk) {
        resultat.alert = {
          variant: 'danger',
          title: 'Preklusjonsfare - vederlagskrav (§34.1.2)',
          message:
            `Det er gått ${dagerSidenOppdagelse} dager siden forholdet ble oppdaget. ` +
            'Krav på vederlagsjustering kan være tapt. Dokumenter godt hvorfor varsling tok tid.',
        };
      } else if (erVarsel) {
        resultat.alert = {
          variant: 'warning',
          title: 'Varsle snart - vederlagskrav (§34.1.2)',
          message:
            `Det er gått ${dagerSidenOppdagelse} dager. Vederlagskravet tapes dersom det ikke varsles i tide.`,
        };
      }

      return resultat;

    case 'FORCE_MAJEURE':
      return {
        harPreklusjon: false,
        hjemmel: '§33.3',
        forklaring: 'Force majeure gir kun fristforlengelse, ikke vederlagsjustering.',
      };

    default:
      return {
        harPreklusjon: true,
        hjemmel: '§34.1.2',
        forklaring: 'Ukjent kategori - anvender standard preklusjonsregel (§34.1.2).',
      };
  }
}
