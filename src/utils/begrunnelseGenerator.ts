/**
 * Begrunnelse Generator
 *
 * Automatically generates legally precise justification text based on
 * user selections in the response modals. The generated text follows
 * NS 8407 terminology and structure.
 *
 * The text is NOT editable by the user, but they can supplement it
 * with additional comments.
 *
 * ============================================================================
 * NS 8407:2011 REFERANSER
 * ============================================================================
 *
 * VEDERLAG (Kapittel VI - Vederlag og betaling):
 * - §30.2 (1): Kostnadsoverslag ved regningsarbeid
 * - §30.2 (2): BH kan holde tilbake betaling inntil overslag foreligger
 * - §34.1.2 (2): Varslingskrav - "uten ugrunnet opphold når han blir klar over"
 * - §34.1.2 (2): Preklusjon - "Krav på vederlagsjustering tapes dersom..."
 * - §34.1.3 (1): Særskilt justering for rigg, drift, kapitalytelser
 * - §34.1.3 (2): Særskilt justering for produktivitetstap/forstyrrelser
 * - §34.1.3 (3): Preklusjon - "må varsle byggherren særskilt uten ugrunnet opphold"
 * - §34.2.1: Avtalt vederlagsjustering gjennom tilbud (fastpris)
 * - §34.2.2: Alminnelige regler - §34.3/§34.4 gjelder hvis tilbud ikke akseptert
 * - §34.3.1: Enhetspriser skal benyttes når de er anvendelige
 * - §34.3.2 (1): Justerte enhetspriser for likeartet arbeid
 * - §34.3.2 (2): Justering ved forrykket forutsetninger
 * - §34.3.3 (1): Varsel om justering - "uten ugrunnet opphold"
 * - §34.3.3 (2): Svarplikt - innsigelser tapes ved for sen respons
 * - §34.4 (1): Regningsarbeid som fallback når enhetspriser ikke foreligger
 *
 * FRISTFORLENGELSE (Kapittel VII - Endringer):
 * - §33.1: TE's rett på fristforlengelse pga BH's forhold (endringer, svikt)
 * - §33.3 (1): Force majeure - ekstraordinære værforhold, påbud, streik etc.
 * - §33.3 (3): Ingen rett hvis hindring burde vært forutsett ved kontraktsinngåelse
 * - §33.3 (5): "Partene har IKKE krav på justering av vederlaget" (force majeure)
 * - §33.4 (1): Varsel - "uten ugrunnet opphold, selv om spesifisert krav ikke kan fremsettes"
 * - §33.4 (2): Preklusjon - "Krav på fristforlengelse tapes dersom ikke varslet innen fristen"
 *   NB: §33.4 gjelder BÅDE nøytralt varsel OG spesifisert krav direkte (uten forutgående nøytralt)
 * - §33.5 (1): Beregning - "virkning på fremdriften som forholdet har forårsaket"
 * - §33.6.1 (1): TE's spesifisering - "angi og begrunne det antall dager han krever"
 * - §33.6.1 (2): Sen spesifisering = REDUKSJON - "bare krav på det den andre parten måtte forstå"
 *   NB: §33.6.1 reduksjon gjelder KUN når varsel om fristforlengelse ble sendt i tide først
 * - §33.6.2 (1): BH's forespørsel - krav om spesifisert krav
 * - §33.6.2 (2a): TE må svare "uten ugrunnet opphold" med dager+begrunnelse
 * - §33.6.2 (2b): ELLER begrunne hvorfor grunnlaget for beregning ikke foreligger
 * - §33.6.2 (3): Preklusjon - "Gjør ikke totalentreprenøren noen av delene, tapes kravet"
 * - §33.6.2 (5): Ved bokstav b gjelder §33.6.1 videre
 * - §33.7 (1): Svarplikt - "svare uten ugrunnet opphold"
 * - §33.7 (2): "Innsigelser mot kravet tapes dersom de ikke fremsettes innen fristen"
 * - §33.8 (1): Forsering - "kan velge å anse avslaget som et pålegg om forsering"
 * - §33.8 (1): 30%-begrensning - "ikke slik valgrett dersom vederlaget overstiger dagmulkt + 30%"
 * - §33.8 (2): Varslingskrav før forsering iverksettes
 *
 * ============================================================================
 */

import type { VederlagsMetode, FristVarselType } from '../types/timeline';

// ============================================================================
// TYPES
// ============================================================================

type BelopVurdering = 'godkjent' | 'delvis' | 'avslatt';

export interface VederlagResponseInput {
  // Claim context
  metode?: VederlagsMetode;
  hovedkravBelop?: number;
  riggBelop?: number;
  produktivitetBelop?: number;
  harRiggKrav: boolean;
  harProduktivitetKrav: boolean;

  // Preklusjon (Port 1/2)
  hovedkravVarsletITide?: boolean;  // §34.1.2 - kun SVIKT/ANDRE
  riggVarsletITide?: boolean;       // §34.1.3
  produktivitetVarsletITide?: boolean;  // §34.1.3

  // Metode (Port 2/3)
  akseptererMetode: boolean;
  oensketMetode?: VederlagsMetode;
  epJusteringVarsletITide?: boolean;  // §34.3.3 - TE varslet i tide?
  epJusteringAkseptert?: boolean;     // §34.3.3 - BH aksepterer?
  kreverJustertEp?: boolean;
  holdTilbake?: boolean;

  // Beløp (Port 3/4)
  hovedkravVurdering: BelopVurdering;
  hovedkravGodkjentBelop?: number;
  riggVurdering?: BelopVurdering;
  riggGodkjentBelop?: number;
  produktivitetVurdering?: BelopVurdering;
  produktivitetGodkjentBelop?: number;

  // Computed totals
  totalKrevd: number;
  totalGodkjent: number;
  totalGodkjentSubsidiaer?: number;
  harPrekludertKrav: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number): string {
  return `kr ${amount.toLocaleString('nb-NO')},-`;
}

/**
 * Get the effective calculation method (BH's chosen method if rejected, else TE's method)
 */
function getEffektivMetode(input: VederlagResponseInput): VederlagsMetode | undefined {
  if (!input.akseptererMetode && input.oensketMetode) {
    return input.oensketMetode;
  }
  return input.metode;
}

/**
 * Check if the effective method is regningsarbeid (cost reimbursement)
 */
function erRegningsarbeid(input: VederlagResponseInput): boolean {
  return getEffektivMetode(input) === 'REGNINGSARBEID';
}

/**
 * Check if the effective method is enhetspriser (unit prices)
 */
function erEnhetspriser(input: VederlagResponseInput): boolean {
  return getEffektivMetode(input) === 'ENHETSPRISER';
}

/**
 * Get terminology based on calculation method:
 * - Fastpris: "Hovedkravet" + "godkjennes" (fixed amount)
 * - Enhetspriser: "Beregningen" + "aksepteres" (based on estimated quantities)
 * - Regningsarbeid: "Kostnadsoverslaget" + "aksepteres" (cost estimate)
 */
function getMetodeTerminologi(input: VederlagResponseInput): {
  kravLabel: string;
  kravLabelLower: string;
  akseptVerb: string;
  belopLabel: string;
  introLabel: string;
} {
  const effektiv = getEffektivMetode(input);

  switch (effektiv) {
    case 'REGNINGSARBEID':
      return {
        kravLabel: 'Kostnadsoverslaget',
        kravLabelLower: 'kostnadsoverslaget',
        akseptVerb: 'aksepteres',
        belopLabel: 'akseptert kostnadsoverslag',
        introLabel: 'Hva gjelder kostnadsoverslaget:',
      };
    case 'ENHETSPRISER':
      return {
        kravLabel: 'Beregningen basert på anslåtte mengder',
        kravLabelLower: 'beregningen',
        akseptVerb: 'aksepteres',
        belopLabel: 'akseptert beløp basert på anslåtte mengder',
        introLabel: 'Hva gjelder beregningen:',
      };
    default: // FASTPRIS_TILBUD
      return {
        kravLabel: 'Hovedkravet',
        kravLabelLower: 'hovedkravet',
        akseptVerb: 'godkjennes',
        belopLabel: 'godkjent beløp',
        introLabel: 'Hva gjelder beløpet:',
      };
  }
}

function getMetodeLabel(metode?: VederlagsMetode): string {
  if (!metode) return 'ukjent beregningsmetode';
  const labels: Record<VederlagsMetode, string> = {
    'ENHETSPRISER': 'enhetspriser (§34.3)',
    'REGNINGSARBEID': 'regningsarbeid (§34.4)',
    'FASTPRIS_TILBUD': 'fastpris/tilbud (§34.2.1)',
  };
  return labels[metode] || metode;
}

function getVurderingVerb(vurdering: BelopVurdering): string {
  switch (vurdering) {
    case 'godkjent': return 'godkjennes';
    case 'delvis': return 'godkjennes delvis';
    case 'avslatt': return 'avvises';
  }
}

// ============================================================================
// SECTION GENERATORS
// ============================================================================

/**
 * Generate the method acceptance section
 */
function generateMetodeSection(input: VederlagResponseInput): string {
  const lines: string[] = [];

  if (input.akseptererMetode) {
    lines.push(`Byggherren godtar den foreslåtte beregningsmetoden ${getMetodeLabel(input.metode)}.`);
  } else {
    lines.push(
      `Byggherren godtar ikke den foreslåtte beregningsmetoden ${getMetodeLabel(input.metode)}, ` +
      `og krever i stedet beregning etter ${getMetodeLabel(input.oensketMetode)}.`
    );
  }

  // EP-justering response (§34.3.3)
  if (input.kreverJustertEp) {
    // Når BH avviser enhetspriser som metode, men TE har krevd justerte EP
    if (!input.akseptererMetode && input.metode === 'ENHETSPRISER') {
      lines.push('Byggherren tar likevel stilling til entreprenørens krav om justerte enhetspriser:');
    }

    // Først: Sjekk om TE varslet i tide
    if (input.epJusteringVarsletITide === false) {
      lines.push(
        'Kravet om justerte enhetspriser ble ikke varslet «uten ugrunnet opphold» (§34.3.3 første ledd). ' +
        'Entreprenøren har dermed bare krav på slik justering som byggherren måtte forstå at forholdet ville føre til.'
      );
    }
    // Deretter: BHs aksept/avvisning
    if (input.epJusteringAkseptert !== undefined) {
      if (input.epJusteringAkseptert) {
        lines.push('Kravet om justerte enhetspriser (§34.3.2) aksepteres.');
      } else {
        lines.push(
          'Kravet om justerte enhetspriser (§34.3.2) avvises. ' +
          'Vilkårene for justering anses ikke oppfylt.'
        );
      }
    }
  }

  // Hold tilbake (§30.2)
  if (input.holdTilbake) {
    lines.push(
      'Byggherren holder tilbake betaling inntil kostnadsoverslag mottas (§30.2). ' +
      'Utbetaling vil skje når tilfredsstillende overslag er levert.'
    );
  }

  return lines.join(' ');
}

/**
 * Generate the amount evaluation section for hovedkrav
 */
function generateHovedkravSection(input: VederlagResponseInput): string {
  const { hovedkravVurdering, hovedkravBelop, hovedkravGodkjentBelop, hovedkravVarsletITide } = input;

  if (!hovedkravBelop) {
    return '';
  }

  const lines: string[] = [];
  const isPrekludert = hovedkravVarsletITide === false;
  const terminologi = getMetodeTerminologi(input);
  const isRegningsarbeidOrEnhetspriser = erRegningsarbeid(input) || erEnhetspriser(input);

  if (isPrekludert) {
    // Prinsipalt: prekludert (§34.1.2)
    lines.push(
      `${terminologi.kravLabel} på ${formatCurrency(hovedkravBelop)} avvises prinsipalt som prekludert iht. §34.1.2, ` +
      `da varselet ikke ble fremsatt «uten ugrunnet opphold» etter at entreprenøren ble eller burde blitt klar over forholdet.`
    );

    // Subsidiært: faktisk vurdering
    const subsidiaerText = generateSubsidiaerKravText(
      terminologi.kravLabelLower,
      hovedkravBelop,
      hovedkravVurdering,
      hovedkravGodkjentBelop,
      isRegningsarbeidOrEnhetspriser
    );
    lines.push(subsidiaerText);

    return lines.join(' ');
  }

  // Ikke prekludert - vanlig vurdering
  switch (hovedkravVurdering) {
    case 'godkjent':
      return `${terminologi.kravLabel} på ${formatCurrency(hovedkravBelop)} ${terminologi.akseptVerb}.`;

    case 'delvis': {
      const godkjent = hovedkravGodkjentBelop ?? 0;
      const prosent = hovedkravBelop > 0 ? ((godkjent / hovedkravBelop) * 100).toFixed(0) : 0;
      return (
        `${terminologi.kravLabel} ${terminologi.akseptVerb} delvis med ${formatCurrency(godkjent)} ` +
        `av krevde ${formatCurrency(hovedkravBelop)} (${prosent}%).`
      );
    }

    case 'avslatt':
      return `${terminologi.kravLabel} på ${formatCurrency(hovedkravBelop)} avvises.`;
  }
}

/**
 * Generate section for særskilte krav (rigg/drift)
 */
function generateRiggSection(input: VederlagResponseInput): string {
  if (!input.harRiggKrav || !input.riggBelop) {
    return '';
  }

  const lines: string[] = [];
  const isPrekludert = input.riggVarsletITide === false;

  if (isPrekludert) {
    // Prinsipalt: prekludert
    lines.push(
      `Kravet om dekning av økte rigg- og driftskostnader på ${formatCurrency(input.riggBelop)} ` +
      `avvises prinsipalt som prekludert iht. §34.1.3, da varselet ikke ble fremsatt «uten ugrunnet opphold» ` +
      `etter at entreprenøren ble eller burde blitt klar over at utgiftene ville påløpe.`
    );

    // Subsidiært: faktisk vurdering
    if (input.riggVurdering) {
      const subsidiaerText = generateSubsidiaerKravText(
        'rigg- og driftskostnader',
        input.riggBelop,
        input.riggVurdering,
        input.riggGodkjentBelop
      );
      lines.push(subsidiaerText);
    }
  } else {
    // Ikke prekludert - vanlig vurdering
    lines.push(generateKravVurderingText(
      'rigg- og driftskostnader',
      input.riggBelop,
      input.riggVurdering ?? 'avslatt',
      input.riggGodkjentBelop
    ));
  }

  return lines.join(' ');
}

/**
 * Generate section for særskilte krav (produktivitetstap)
 */
function generateProduktivitetSection(input: VederlagResponseInput): string {
  if (!input.harProduktivitetKrav || !input.produktivitetBelop) {
    return '';
  }

  const lines: string[] = [];
  const isPrekludert = input.produktivitetVarsletITide === false;

  if (isPrekludert) {
    // Prinsipalt: prekludert
    lines.push(
      `Kravet om dekning av produktivitetstap på ${formatCurrency(input.produktivitetBelop)} ` +
      `avvises prinsipalt som prekludert iht. §34.1.3, da varselet ikke ble fremsatt «uten ugrunnet opphold» ` +
      `etter at entreprenøren burde ha innsett at forstyrrelsene medførte merkostnader.`
    );

    // Subsidiært: faktisk vurdering
    if (input.produktivitetVurdering) {
      const subsidiaerText = generateSubsidiaerKravText(
        'produktivitetstap',
        input.produktivitetBelop,
        input.produktivitetVurdering,
        input.produktivitetGodkjentBelop
      );
      lines.push(subsidiaerText);
    }
  } else {
    // Ikke prekludert - vanlig vurdering
    lines.push(generateKravVurderingText(
      'produktivitetstap',
      input.produktivitetBelop,
      input.produktivitetVurdering ?? 'avslatt',
      input.produktivitetGodkjentBelop
    ));
  }

  return lines.join(' ');
}

/**
 * Helper to generate standard krav vurdering text
 */
function generateKravVurderingText(
  kravType: string,
  krevdBelop: number,
  vurdering: BelopVurdering,
  godkjentBelop?: number
): string {
  switch (vurdering) {
    case 'godkjent':
      return `Kravet om dekning av ${kravType} på ${formatCurrency(krevdBelop)} ${getVurderingVerb('godkjent')}.`;

    case 'delvis': {
      const belop = godkjentBelop ?? 0;
      return (
        `Kravet om dekning av ${kravType} ${getVurderingVerb('delvis')} med ` +
        `${formatCurrency(belop)} av krevde ${formatCurrency(krevdBelop)}.`
      );
    }

    case 'avslatt':
      return `Kravet om dekning av ${kravType} på ${formatCurrency(krevdBelop)} ${getVurderingVerb('avslatt')}.`;
  }
}

/**
 * Helper to generate subsidiær vurdering text for prekluderte krav
 * @param isEstimatBasert - true for regningsarbeid/enhetspriser (uses "aksepteres"), false for fastpris (uses "godkjennes")
 */
function generateSubsidiaerKravText(
  kravType: string,
  krevdBelop: number,
  vurdering: BelopVurdering,
  godkjentBelop?: number,
  isEstimatBasert?: boolean
): string {
  // For regningsarbeid bruker vi "overslaget", for enhetspriser/fastpris bruker vi "kravet"
  const prefix = `Subsidiært, dersom ${kravType} ikke anses prekludert,`;

  switch (vurdering) {
    case 'godkjent':
      return `${prefix} aksepteres ${formatCurrency(krevdBelop)}.`;

    case 'delvis':
      return `${prefix} aksepteres ${formatCurrency(godkjentBelop ?? 0)} av krevde ${formatCurrency(krevdBelop)}.`;

    case 'avslatt':
      return `${prefix} ville ${kravType} uansett blitt avvist.`;
  }
}

/**
 * Generate the conclusion section with totals
 */
function generateKonklusjonSection(input: VederlagResponseInput): string {
  const lines: string[] = [];
  const terminologi = getMetodeTerminologi(input);

  // Prinsipalt resultat
  lines.push(
    `Samlet ${terminologi.belopLabel} utgjør etter dette ${formatCurrency(input.totalGodkjent)} ` +
    `av totalt krevde ${formatCurrency(input.totalKrevd)}.`
  );

  // Subsidiært resultat (kun hvis det er prekluderte krav)
  if (input.harPrekludertKrav && input.totalGodkjentSubsidiaer !== undefined) {
    const diff = input.totalGodkjentSubsidiaer - input.totalGodkjent;
    if (diff > 0) {
      // Bestem riktig formulering basert på om hovedkrav er prekludert
      const hovedkravPrekludert = input.hovedkravVarsletITide === false;
      const kravType = hovedkravPrekludert ? 'kravene' : 'særskilte kravene';
      lines.push(
        `Dersom de prekluderte ${kravType} hadde vært varslet i tide, ville samlet ${terminologi.belopLabel} ` +
        `utgjort ${formatCurrency(input.totalGodkjentSubsidiaer)} (subsidiært standpunkt).`
      );
    }
  }

  return lines.join(' ');
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate complete auto-begrunnelse for BH's response to vederlagskrav
 */
export function generateVederlagResponseBegrunnelse(input: VederlagResponseInput): string {
  const sections: string[] = [];

  // 1. Metode section
  const metodeSection = generateMetodeSection(input);
  if (metodeSection) {
    sections.push(metodeSection);
  }

  // 2. Beløpsvurdering intro
  if (!input.holdTilbake) {
    const terminologi = getMetodeTerminologi(input);
    sections.push(terminologi.introLabel);

    // 2a. Hovedkrav
    const hovedkravSection = generateHovedkravSection(input);
    if (hovedkravSection) {
      sections.push(hovedkravSection);
    }

    // 2b. Rigg/drift (særskilt krav)
    const riggSection = generateRiggSection(input);
    if (riggSection) {
      sections.push(riggSection);
    }

    // 2c. Produktivitetstap (særskilt krav)
    const produktivitetSection = generateProduktivitetSection(input);
    if (produktivitetSection) {
      sections.push(produktivitetSection);
    }

    // 3. Konklusjon
    const konklusjonSection = generateKonklusjonSection(input);
    if (konklusjonSection) {
      sections.push(konklusjonSection);
    }
  }

  return sections.join('\n\n');
}

/**
 * Combine auto-generated begrunnelse with user's additional comments
 */
export function combineBegrunnelse(
  autoBegrunnelse: string,
  tilleggsBegrunnelse?: string
): string {
  if (!tilleggsBegrunnelse?.trim()) {
    return autoBegrunnelse;
  }

  return `${autoBegrunnelse}\n\n---\n\nTilleggskommentar:\n${tilleggsBegrunnelse.trim()}`;
}

// ============================================================================
// FRIST RESPONSE GENERATOR
// ============================================================================

export interface FristResponseInput {
  // Claim context
  varselType?: FristVarselType;
  krevdDager: number;

  // Preklusjon (Port 1)
  fristVarselOk?: boolean;  // §33.4: Varsel om fristforlengelse rettidig?
  spesifisertKravOk?: boolean;
  foresporselSvarOk?: boolean;  // §33.6.2/§5: Svar på forespørsel i tide?
  sendForesporsel?: boolean;

  // Vilkår (Port 2)
  vilkarOppfylt: boolean;

  // Beregning (Port 3)
  godkjentDager: number;

  // Computed
  erPrekludert: boolean;  // §33.4: Varsel for sent (varsel ELLER spesifisert uten forutgående varsel)
  erForesporselSvarForSent?: boolean;  // §33.6.2 tredje ledd + §5: Sen respons på forespørsel
  erRedusert_33_6_1?: boolean;  // §33.6.1: Sen spesifisering ETTER at varsel ble sendt i tide
  harTidligereVarselITide?: boolean;  // For å vite om §33.6.1 er relevant ved spesifisert krav
  erGrunnlagSubsidiaer?: boolean;  // Grunnlag avslått - hele fristkravet behandles subsidiært
  prinsipaltResultat: string;
  subsidiaertResultat?: string;
  visSubsidiaertResultat: boolean;
}

/**
 * Get varsel type label for display
 */
function getVarselTypeLabel(varselType?: FristVarselType): string {
  if (!varselType) return 'varsel';
  const labels: Record<FristVarselType, string> = {
    'varsel': 'varsel om fristforlengelse (§33.4)',
    'spesifisert': 'spesifisert krav (§33.6)',
    'begrunnelse_utsatt': 'begrunnelse for utsettelse (§33.6.2 b)',
  };
  return labels[varselType] || varselType;
}

/**
 * Get preclusion paragraph reference based on varsel type
 */
function getPreklusjonParagraf(varselType?: FristVarselType): string {
  switch (varselType) {
    case 'varsel':
      return '§33.4';
    default:
      return '§33.6';
  }
}

/**
 * Generate the preclusion section for frist response
 */
function generateFristPreklusjonSection(input: FristResponseInput): string {
  // Forespørsel case
  if (input.sendForesporsel) {
    return (
      'Byggherren etterspør spesifisert krav iht. §33.6.2. ' +
      'Entreprenøren må «uten ugrunnet opphold» angi og begrunne antall dager fristforlengelse. ' +
      'Dersom dette ikke gjøres, tapes kravet.'
    );
  }

  // §33.6.2 tredje ledd + §5: Sen respons på forespørsel = preklusjon
  if (input.erForesporselSvarForSent) {
    return (
      'Kravet avvises som prekludert iht. §33.6.2 tredje ledd, jf. §5. ' +
      'Entreprenøren svarte ikke «uten ugrunnet opphold» på byggherrens forespørsel. ' +
      'Byggherren påberoper seg at fristen er oversittet, jf. §5.'
    );
  }

  // Prekludert (§33.4 - varsel for sent = full preklusjon)
  // Gjelder både nøytralt varsel for sent OG spesifisert krav direkte uten tidligere nøytralt varsel
  if (input.erPrekludert) {
    const prinsipaltTekst =
      'Kravet avvises prinsipalt som prekludert iht. §33.4, ' +
      'da varsel ikke ble fremsatt «uten ugrunnet opphold» ' +
      'etter at entreprenøren ble eller burde blitt klar over forholdet.';

    // Dobbel vurdering: Hvis også §33.6.1 er oversittet, nevn dette subsidiært
    if (input.erRedusert_33_6_1) {
      return (
        prinsipaltTekst +
        ' Subsidiært bemerkes at selv om §33.4-fristen ikke anses oversittet, ' +
        'ble det spesifiserte kravet uansett fremsatt for sent iht. §33.6.1. ' +
        'Entreprenøren ville da kun hatt krav på det byggherren måtte forstå at han hadde krav på.'
      );
    }

    return prinsipaltTekst;
  }

  // Redusert (§33.6.1 - krav om fristforlengelse for sent = reduksjon, ikke preklusjon)
  if (input.erRedusert_33_6_1) {
    return (
      'Kravet om fristforlengelse ble ikke fremsatt «uten ugrunnet opphold» etter at grunnlaget ' +
      'for å beregne kravet forelå (§33.6.1). Entreprenøren har dermed bare krav på slik ' +
      'fristforlengelse som byggherren måtte forstå at han hadde krav på.'
    );
  }

  // OK - Varslingskravene er oppfylt
  // Bestem riktig paragraf basert på kontekst:
  // - Svar på forespørsel i tide: §33.6.2 fjerde ledd (§33.6.1 kan ikke påberopes)
  // - Varsel om fristforlengelse: §33.4
  // - Spesifisert krav med tidligere varsel i tide: §33.4 og §33.6.1
  // - Spesifisert krav direkte (uten tidligere varsel): §33.4 (varselet fungerer som §33.4-varsel)
  if (input.foresporselSvarOk === true && input.varselType === 'spesifisert') {
    // Svar på forespørsel kom i tide - §33.6.2 fjerde ledd beskytter TE
    return (
      'Kravet er svar på byggherrens forespørsel og kom i tide. ' +
      'I henhold til §33.6.2 fjerde ledd kan byggherren ikke påberope at fristen i §33.6.1 er oversittet.'
    );
  }
  if (input.varselType === 'spesifisert' && input.harTidligereVarselITide) {
    return 'Varslingskravene i §33.4 og §33.6.1 anses oppfylt.';
  }
  // For varsel om fristforlengelse eller spesifisert krav direkte (uten tidligere varsel)
  return 'Varslingskravene i §33.4 anses oppfylt.';
}

/**
 * Generate the conditions section for frist response (§33.1)
 */
function generateFristVilkarSection(input: FristResponseInput): string {
  const { vilkarOppfylt, erPrekludert } = input;

  // Vilkår is always evaluated, even when sending forespørsel
  const prefix = erPrekludert ? 'Subsidiært, hva gjelder vilkårene (§33.1): ' : '';

  if (vilkarOppfylt) {
    return (
      prefix +
      'Det erkjennes at forholdet har hindret fremdriften, jf. §33.1.'
    );
  }

  return (
    prefix +
    'Det bestrides at forholdet har hindret fremdriften, jf. §33.1.'
  );
}

/**
 * Generate the calculation section for frist response
 */
function generateFristBeregningSection(input: FristResponseInput): string {
  const { krevdDager, godkjentDager, erPrekludert, vilkarOppfylt, varselType, sendForesporsel, erGrunnlagSubsidiaer } = input;

  // Skip calculation section when sending forespørsel or varsel about deadline extension without specified days
  if (sendForesporsel || (varselType === 'varsel' && krevdDager === 0)) {
    return '';
  }

  const erSubsidiaer = erPrekludert || !vilkarOppfylt || erGrunnlagSubsidiaer;
  const prefix = erSubsidiaer ? 'Subsidiært, hva gjelder antall dager: ' : 'Hva gjelder antall dager: ';

  if (godkjentDager === 0) {
    return prefix + `Kravet om ${krevdDager} dager fristforlengelse kan ikke imøtekommes.`;
  }

  if (godkjentDager >= krevdDager) {
    return prefix + `Kravet om ${krevdDager} dagers fristforlengelse godkjennes i sin helhet.`;
  }

  const prosent = krevdDager > 0 ? ((godkjentDager / krevdDager) * 100).toFixed(0) : 0;
  return (
    prefix +
    `Kravet godkjennes delvis med ${godkjentDager} dager av krevde ${krevdDager} dager (${prosent}%).`
  );
}

/**
 * Generate the conclusion section for frist response
 */
function generateFristKonklusjonSection(input: FristResponseInput): string {
  const { krevdDager, godkjentDager, prinsipaltResultat, visSubsidiaertResultat, varselType, sendForesporsel } = input;
  const lines: string[] = [];

  // Handle forespørsel case - no conclusion needed as we're waiting for specification
  if (sendForesporsel) {
    return '';
  }

  // Handle varsel about deadline extension without specified days (and no forespørsel sent)
  if (varselType === 'varsel' && krevdDager === 0) {
    // Vilkår section is already generated above, so just add conclusion
    lines.push('Antall dager kan først vurderes når entreprenøren spesifiserer kravet.');
    return lines.join(' ');
  }

  // Prinsipalt resultat
  if (prinsipaltResultat === 'avslatt') {
    lines.push(`Kravet om ${krevdDager} dagers fristforlengelse avvises i sin helhet.`);
  } else if (prinsipaltResultat === 'godkjent') {
    lines.push(`Samlet godkjennes ${godkjentDager} dagers fristforlengelse.`);
  } else {
    lines.push(`Samlet godkjennes ${godkjentDager} av ${krevdDager} krevde dager.`);
  }

  // Subsidiært standpunkt
  if (visSubsidiaertResultat && prinsipaltResultat === 'avslatt') {
    if (godkjentDager > 0) {
      lines.push(
        `Dersom byggherren ikke får medhold i sin prinsipale avvisning, ` +
        `kan entreprenøren maksimalt ha krav på ${godkjentDager} dager (subsidiært standpunkt).`
      );
    } else {
      lines.push(
        'Selv om byggherren ikke skulle få medhold i sin prinsipale avvisning, ' +
        'ville kravet uansett blitt avslått subsidiært.'
      );
    }
  }

  return lines.join(' ');
}

/**
 * Generate force majeure vederlag warning section
 *
 * Note: Force majeure is handled at grunnlag level, not frist varsel level.
 * This function is kept for backwards compatibility but always returns empty.
 */
function generateForceMajeureVederlagSection(_input: FristResponseInput): string {
  // Force majeure is handled at grunnlag (ansvarsgrunnlag) level, not frist varsel level
  return '';
}

/**
 * Generate §33.8 forsering warning if applicable
 */
function generateForseringWarningSection(input: FristResponseInput): string {
  const { krevdDager, godkjentDager, prinsipaltResultat } = input;
  const avslatteDager = krevdDager - godkjentDager;

  // Only show if days are rejected
  if (avslatteDager <= 0) {
    return '';
  }

  // Only show if not fully approved
  if (prinsipaltResultat === 'godkjent') {
    return '';
  }

  return (
    `Byggherren gjør oppmerksom på at dersom avslaget skulle vise seg å være uberettiget, ` +
    `kan entreprenøren velge å anse avslaget som et pålegg om forsering (§33.8). ` +
    `Denne valgretten gjelder dog ikke dersom forseringskostnadene overstiger dagmulkten med tillegg av 30%.`
  );
}

/**
 * Generate complete auto-begrunnelse for BH's response to fristkrav
 */
export function generateFristResponseBegrunnelse(input: FristResponseInput): string {
  const sections: string[] = [];

  // Skip if forespørsel - minimal response
  if (input.sendForesporsel) {
    return generateFristPreklusjonSection(input);
  }

  // §33.6.2 bokstav b - TE har begrunnet hvorfor beregning ikke er mulig
  // BH bekrefter mottak, vanlige §33.6.1-regler gjelder videre
  if (input.varselType === 'begrunnelse_utsatt') {
    return (
      'Byggherren bekrefter mottak av begrunnelse for hvorfor grunnlaget for å beregne ' +
      'fristforlengelseskravet ikke foreligger (§33.6.2 annet ledd bokstav b).\n\n' +
      'I henhold til §33.6.2 femte ledd gjelder bestemmelsen i §33.6.1 videre. ' +
      'Entreprenøren må fremsette spesifisert krav med antall dager «uten ugrunnet opphold» ' +
      'når grunnlaget for å beregne kravet foreligger.'
    );
  }

  // 0. Grunnlagsavslag - hele fristkravet er subsidiært
  if (input.erGrunnlagSubsidiaer) {
    sections.push(
      'Ansvarsgrunnlaget er avvist. Vurderingen av fristkravet nedenfor gjelder derfor ' +
      'subsidiært, for det tilfellet at byggherren ikke får medhold i avvisningen av grunnlaget.'
    );
  }

  // 1. Preklusjon section
  const preklusjonSection = generateFristPreklusjonSection(input);
  sections.push(preklusjonSection);

  // 2. Vilkår section (always evaluated, possibly subsidiary)
  const vilkarSection = generateFristVilkarSection(input);
  sections.push(vilkarSection);

  // 3. Beregning section (always evaluated, possibly subsidiary)
  const beregningSection = generateFristBeregningSection(input);
  sections.push(beregningSection);

  // 4. Konklusjon
  const konklusjonSection = generateFristKonklusjonSection(input);
  sections.push(konklusjonSection);

  // 5. §33.3 Force majeure vederlag notice (if applicable)
  const forceMajeureSection = generateForceMajeureVederlagSection(input);
  if (forceMajeureSection) {
    sections.push(forceMajeureSection);
  }

  // 6. §33.8 Forsering warning (if applicable)
  const forseringSection = generateForseringWarningSection(input);
  if (forseringSection) {
    sections.push(forseringSection);
  }

  return sections.join('\n\n');
}

// ============================================================================
// FORSERING RESPONSE GENERATOR (§33.8)
// ============================================================================

type BelopVurderingForsering = 'godkjent' | 'delvis' | 'avslatt';

/** Per-sak vurdering med detaljer for begrunnelse-generering */
interface PerSakVurderingMedDetaljer {
  sak_id: string;
  avslag_berettiget: boolean;
  sakTittel?: string;
  avslatteDager?: number;
}

export interface ForseringResponseInput {
  // Kalkulasjonsgrunnlag
  avslatteDager: number;
  dagmulktsats: number;
  maksForseringskostnad: number;
  estimertKostnad: number;

  // Port 1: Per-sak vurdering av forseringsrett (§33.8)
  vurderingPerSak?: PerSakVurderingMedDetaljer[];
  dagerMedForseringsrett?: number;
  // Computed from vurderingPerSak - true if any rejection was unjust
  teHarForseringsrett: boolean;

  // Port 2: 30%-regel
  trettiprosentOverholdt: boolean;
  trettiprosentBegrunnelse?: string;

  // Port 3: Beløpsvurdering
  hovedkravVurdering: BelopVurderingForsering;
  hovedkravBelop?: number;
  godkjentBelop?: number;

  // Port 3b: Særskilte krav
  harRiggKrav: boolean;
  riggBelop?: number;
  riggVarsletITide?: boolean;
  riggVurdering?: BelopVurderingForsering;
  godkjentRiggDrift?: number;

  harProduktivitetKrav: boolean;
  produktivitetBelop?: number;
  produktivitetVarsletITide?: boolean;
  produktivitetVurdering?: BelopVurderingForsering;
  godkjentProduktivitet?: number;

  // Computed
  totalKrevd: number;
  totalGodkjent: number;
  harPrekludertKrav: boolean;
  subsidiaerGodkjentBelop?: number;
}

/**
 * Generate section for Port 1: Forseringsrett (§33.8) with per-sak vurdering
 */
function generateForseringGrunnlagSection(input: ForseringResponseInput): string {
  const { vurderingPerSak, dagerMedForseringsrett, teHarForseringsrett, avslatteDager } = input;
  const lines: string[] = [];

  // If we have per-sak vurdering, generate detailed text
  if (vurderingPerSak && vurderingPerSak.length > 0) {
    const uberettigedeSaker = vurderingPerSak.filter(v => !v.avslag_berettiget);
    const berettigedeSaker = vurderingPerSak.filter(v => v.avslag_berettiget);

    if (uberettigedeSaker.length > 0 && berettigedeSaker.length > 0) {
      // Mixed case - some rejections were justified, some were not
      lines.push(
        'Byggherren har vurdert hver av de avslåtte fristsakene som ligger til grunn for forseringskravet:'
      );

      // List uberettigede
      const uberettigedeText = uberettigedeSaker.map(v => {
        const dager = v.avslatteDager ? ` (${v.avslatteDager} dager)` : '';
        return `${v.sak_id}${v.sakTittel ? ': ' + v.sakTittel : ''}${dager}`;
      }).join(', ');
      lines.push(
        `For følgende saker erkjennes det at avslaget var uberettiget: ${uberettigedeText}.`
      );

      // List berettigede
      const berettigedeText = berettigedeSaker.map(v => {
        const dager = v.avslatteDager ? ` (${v.avslatteDager} dager)` : '';
        return `${v.sak_id}${v.sakTittel ? ': ' + v.sakTittel : ''}${dager}`;
      }).join(', ');
      lines.push(
        `For følgende saker fastholdes det at avslaget var berettiget: ${berettigedeText}.`
      );

      // Summary
      const totalUberettigetDager = dagerMedForseringsrett ?? uberettigedeSaker.reduce(
        (sum, v) => sum + (v.avslatteDager ?? 0), 0
      );
      lines.push(
        `Entreprenøren har dermed rett til forseringsvederlag for ${totalUberettigetDager} av totalt ${avslatteDager} avslåtte dager iht. §33.8.`
      );
    } else if (uberettigedeSaker.length > 0) {
      // All rejections were unjust
      if (vurderingPerSak.length > 1) {
        lines.push(
          `Byggherren erkjenner at avslagene på fristforlengelse i alle ${vurderingPerSak.length} saker var uberettiget. ` +
          `Entreprenøren har dermed rett til forseringsvederlag for samtlige ${avslatteDager} dager iht. §33.8.`
        );
      } else {
        lines.push(
          'Byggherren erkjenner at avslaget på fristforlengelse var uberettiget. ' +
          'Entreprenøren har dermed rett til forseringsvederlag iht. §33.8.'
        );
      }
    } else {
      // All rejections were just (berettigedeSaker.length > 0)
      if (vurderingPerSak.length > 1) {
        lines.push(
          `Byggherren fastholder at avslagene på fristforlengelse i alle ${vurderingPerSak.length} saker var berettiget. ` +
          'Entreprenøren hadde ikke krav på fristforlengelse og har derfor ikke rett til forseringsvederlag etter §33.8.'
        );
      } else {
        lines.push(
          'Byggherren fastholder at avslaget på fristforlengelse var berettiget. ' +
          'Entreprenøren hadde ikke krav på fristforlengelse og har derfor ikke rett til forseringsvederlag etter §33.8.'
        );
      }
    }

    return lines.join(' ');
  }

  // Fallback: No per-sak vurdering available, use simple binary logic
  if (teHarForseringsrett) {
    return (
      'Byggherren erkjenner at avslaget på fristforlengelse var uberettiget. ' +
      'Entreprenøren har dermed rett til forseringsvederlag iht. §33.8.'
    );
  }

  return (
    'Byggherren fastholder at avslaget på fristforlengelse var berettiget. ' +
    'Entreprenøren hadde ikke krav på fristforlengelse og har derfor ikke rett til ' +
    'forseringsvederlag etter §33.8.'
  );
}

/**
 * Generate section for Port 2: 30%-regel
 */
function generateForsering30ProsentSection(input: ForseringResponseInput): string {
  const { avslatteDager, dagmulktsats, maksForseringskostnad, estimertKostnad, trettiprosentOverholdt, trettiprosentBegrunnelse } = input;
  const lines: string[] = [];

  lines.push(
    `Beregning av 30%-grensen (§33.8 første ledd): ${avslatteDager} avslåtte dager × ` +
    `${formatCurrency(dagmulktsats)} dagmulkt × 1,3 = ${formatCurrency(maksForseringskostnad)}.`
  );

  if (trettiprosentOverholdt) {
    lines.push(
      `Entreprenørens estimerte forseringskostnad på ${formatCurrency(estimertKostnad)} ` +
      `er innenfor grensen. Vilkåret i §33.8 er oppfylt.`
    );
  } else {
    const overskridelse = estimertKostnad - maksForseringskostnad;
    lines.push(
      `Entreprenørens estimerte forseringskostnad på ${formatCurrency(estimertKostnad)} ` +
      `overstiger grensen med ${formatCurrency(overskridelse)}. ` +
      `Entreprenøren hadde dermed ikke valgrett til forsering etter §33.8.`
    );
    if (trettiprosentBegrunnelse) {
      lines.push(trettiprosentBegrunnelse);
    }
  }

  return lines.join(' ');
}

/**
 * Generate section for Port 3: Beløpsvurdering
 */
function generateForseringBelopSection(input: ForseringResponseInput): string {
  const { hovedkravVurdering, hovedkravBelop, godkjentBelop } = input;
  const lines: string[] = [];

  // Hovedkrav vurdering
  switch (hovedkravVurdering) {
    case 'godkjent':
      lines.push(`Forseringskostnadene på ${formatCurrency(hovedkravBelop ?? 0)} godkjennes i sin helhet.`);
      break;
    case 'delvis': {
      const prosent = hovedkravBelop && hovedkravBelop > 0
        ? (((godkjentBelop ?? 0) / hovedkravBelop) * 100).toFixed(0)
        : 0;
      lines.push(
        `Forseringskostnadene godkjennes delvis med ${formatCurrency(godkjentBelop ?? 0)} ` +
        `av krevde ${formatCurrency(hovedkravBelop ?? 0)} (${prosent}%).`
      );
      break;
    }
    case 'avslatt':
      lines.push(`Kravet om dekning av forseringskostnader på ${formatCurrency(hovedkravBelop ?? 0)} avvises.`);
      break;
  }

  return lines.join(' ');
}

/**
 * Generate section for særskilte krav (rigg/drift) for forsering
 */
function generateForseringRiggSection(input: ForseringResponseInput): string {
  if (!input.harRiggKrav || !input.riggBelop) {
    return '';
  }

  const lines: string[] = [];
  const isPrekludert = input.riggVarsletITide === false;

  if (isPrekludert) {
    lines.push(
      `Kravet om dekning av økte rigg- og driftskostnader på ${formatCurrency(input.riggBelop)} ` +
      `avvises prinsipalt som prekludert iht. §34.1.3, da varselet ikke ble fremsatt «uten ugrunnet opphold».`
    );

    // Subsidiært
    if (input.riggVurdering) {
      switch (input.riggVurdering) {
        case 'godkjent':
          lines.push(`Subsidiært aksepteres ${formatCurrency(input.riggBelop)}.`);
          break;
        case 'delvis':
          lines.push(
            `Subsidiært aksepteres ${formatCurrency(input.godkjentRiggDrift ?? 0)} ` +
            `av krevde ${formatCurrency(input.riggBelop)}.`
          );
          break;
        case 'avslatt':
          lines.push('Subsidiært ville kravet uansett blitt avvist.');
          break;
      }
    }
  } else {
    // Ikke prekludert
    switch (input.riggVurdering) {
      case 'godkjent':
        lines.push(`Kravet om rigg- og driftskostnader på ${formatCurrency(input.riggBelop)} godkjennes.`);
        break;
      case 'delvis':
        lines.push(
          `Kravet om rigg- og driftskostnader godkjennes delvis med ${formatCurrency(input.godkjentRiggDrift ?? 0)} ` +
          `av krevde ${formatCurrency(input.riggBelop)}.`
        );
        break;
      case 'avslatt':
        lines.push(`Kravet om rigg- og driftskostnader på ${formatCurrency(input.riggBelop)} avvises.`);
        break;
    }
  }

  return lines.join(' ');
}

/**
 * Generate section for særskilte krav (produktivitetstap) for forsering
 */
function generateForseringProduktivitetSection(input: ForseringResponseInput): string {
  if (!input.harProduktivitetKrav || !input.produktivitetBelop) {
    return '';
  }

  const lines: string[] = [];
  const isPrekludert = input.produktivitetVarsletITide === false;

  if (isPrekludert) {
    lines.push(
      `Kravet om dekning av produktivitetstap på ${formatCurrency(input.produktivitetBelop)} ` +
      `avvises prinsipalt som prekludert iht. §34.1.3, da varselet ikke ble fremsatt «uten ugrunnet opphold».`
    );

    // Subsidiært
    if (input.produktivitetVurdering) {
      switch (input.produktivitetVurdering) {
        case 'godkjent':
          lines.push(`Subsidiært aksepteres ${formatCurrency(input.produktivitetBelop)}.`);
          break;
        case 'delvis':
          lines.push(
            `Subsidiært aksepteres ${formatCurrency(input.godkjentProduktivitet ?? 0)} ` +
            `av krevde ${formatCurrency(input.produktivitetBelop)}.`
          );
          break;
        case 'avslatt':
          lines.push('Subsidiært ville kravet uansett blitt avvist.');
          break;
      }
    }
  } else {
    // Ikke prekludert
    switch (input.produktivitetVurdering) {
      case 'godkjent':
        lines.push(`Kravet om produktivitetstap på ${formatCurrency(input.produktivitetBelop)} godkjennes.`);
        break;
      case 'delvis':
        lines.push(
          `Kravet om produktivitetstap godkjennes delvis med ${formatCurrency(input.godkjentProduktivitet ?? 0)} ` +
          `av krevde ${formatCurrency(input.produktivitetBelop)}.`
        );
        break;
      case 'avslatt':
        lines.push(`Kravet om produktivitetstap på ${formatCurrency(input.produktivitetBelop)} avvises.`);
        break;
    }
  }

  return lines.join(' ');
}

/**
 * Generate conclusion section for forsering response
 */
function generateForseringKonklusjonSection(input: ForseringResponseInput): string {
  const lines: string[] = [];

  // Prinsipalt resultat
  lines.push(
    `Samlet godkjent beløp utgjør ${formatCurrency(input.totalGodkjent)} ` +
    `av totalt krevde ${formatCurrency(input.totalKrevd)}.`
  );

  // Subsidiært (hvis prekluderte krav)
  if (input.harPrekludertKrav && input.subsidiaerGodkjentBelop !== undefined) {
    const diff = input.subsidiaerGodkjentBelop - input.totalGodkjent;
    if (diff > 0) {
      lines.push(
        `Dersom de prekluderte særskilte kravene hadde vært varslet i tide, ville samlet godkjent beløp ` +
        `utgjort ${formatCurrency(input.subsidiaerGodkjentBelop)} (subsidiært standpunkt).`
      );
    }
  }

  return lines.join(' ');
}

/**
 * Generate complete auto-begrunnelse for BH's response to forseringskrav (§33.8)
 */
export function generateForseringResponseBegrunnelse(input: ForseringResponseInput): string {
  const sections: string[] = [];

  // Port 1: Forseringsrett (§33.8)
  const grunnlagSection = generateForseringGrunnlagSection(input);
  sections.push(grunnlagSection);

  // Hvis TE ikke har forseringsrett, generer subsidiært standpunkt
  if (!input.teHarForseringsrett) {
    const subsidiaerSection = generateForseringSubsidiaerSection(input);
    if (subsidiaerSection) {
      sections.push(subsidiaerSection);
    }
    return sections.join('\n\n');
  }

  // Port 2: 30%-regel
  const trettiprosentSection = generateForsering30ProsentSection(input);
  sections.push(trettiprosentSection);

  // Hvis 30%-regel ikke overholdt, stopp her (men kan ha subsidiært standpunkt)
  if (!input.trettiprosentOverholdt) {
    return sections.join('\n\n');
  }

  // Port 3: Beløpsvurdering
  sections.push('Hva gjelder beløpet:');

  const belopSection = generateForseringBelopSection(input);
  if (belopSection) {
    sections.push(belopSection);
  }

  // Særskilte krav
  const riggSection = generateForseringRiggSection(input);
  if (riggSection) {
    sections.push(riggSection);
  }

  const produktivitetSection = generateForseringProduktivitetSection(input);
  if (produktivitetSection) {
    sections.push(produktivitetSection);
  }

  // Konklusjon
  const konklusjonSection = generateForseringKonklusjonSection(input);
  sections.push(konklusjonSection);

  return sections.join('\n\n');
}

/**
 * Generate subsidiary section when BH denies forseringsrett but still evaluates amounts
 */
function generateForseringSubsidiaerSection(input: ForseringResponseInput): string {
  const { hovedkravVurdering, hovedkravBelop, godkjentBelop, totalKrevd, subsidiaerGodkjentBelop } = input;
  const lines: string[] = [];

  lines.push('Subsidiært, dersom entreprenøren hadde hatt forseringsrett:');

  // Hovedkrav vurdering
  switch (hovedkravVurdering) {
    case 'godkjent':
      lines.push(
        `Forseringskostnadene på ${formatCurrency(hovedkravBelop ?? 0)} ville blitt godkjent i sin helhet.`
      );
      break;
    case 'delvis': {
      const prosent = hovedkravBelop && hovedkravBelop > 0
        ? (((godkjentBelop ?? 0) / hovedkravBelop) * 100).toFixed(0)
        : 0;
      lines.push(
        `Forseringskostnadene ville blitt godkjent delvis med ${formatCurrency(godkjentBelop ?? 0)} ` +
        `av krevde ${formatCurrency(hovedkravBelop ?? 0)} (${prosent}%).`
      );
      break;
    }
    case 'avslatt':
      lines.push(
        `Forseringskostnadene på ${formatCurrency(hovedkravBelop ?? 0)} ville uansett blitt avvist.`
      );
      break;
  }

  // Særskilte krav (rigg/produktivitet) - reuse existing functions but in subsidiary context
  const riggSection = generateForseringRiggSectionSubsidiaer(input);
  if (riggSection) {
    lines.push(riggSection);
  }

  const produktivitetSection = generateForseringProduktivitetSectionSubsidiaer(input);
  if (produktivitetSection) {
    lines.push(produktivitetSection);
  }

  // Konklusjon
  if (subsidiaerGodkjentBelop !== undefined && subsidiaerGodkjentBelop > 0) {
    lines.push(
      `Samlet subsidiært godkjent beløp ville utgjort ${formatCurrency(subsidiaerGodkjentBelop)} ` +
      `av totalt krevde ${formatCurrency(totalKrevd)}.`
    );
  } else if (subsidiaerGodkjentBelop === 0) {
    lines.push('Kravet ville uansett blitt avvist i sin helhet.');
  }

  return lines.join(' ');
}

/**
 * Generate rigg/drift text for subsidiary section
 */
function generateForseringRiggSectionSubsidiaer(input: ForseringResponseInput): string {
  if (!input.harRiggKrav || !input.riggBelop) {
    return '';
  }

  const isPrekludert = input.riggVarsletITide === false;

  if (isPrekludert) {
    // Double-subsidiary: no forseringsrett AND precluded
    switch (input.riggVurdering) {
      case 'godkjent':
        return `Rigg/driftskravet på ${formatCurrency(input.riggBelop)} er prekludert, men ville ellers blitt godkjent.`;
      case 'delvis':
        return `Rigg/driftskravet er prekludert, men ville ellers blitt delvis godkjent med ${formatCurrency(input.godkjentRiggDrift ?? 0)}.`;
      case 'avslatt':
        return `Rigg/driftskravet er prekludert og ville uansett blitt avvist.`;
      default:
        return '';
    }
  } else {
    switch (input.riggVurdering) {
      case 'godkjent':
        return `Rigg/driftskravet på ${formatCurrency(input.riggBelop)} ville blitt godkjent.`;
      case 'delvis':
        return `Rigg/driftskravet ville blitt delvis godkjent med ${formatCurrency(input.godkjentRiggDrift ?? 0)} av krevde ${formatCurrency(input.riggBelop)}.`;
      case 'avslatt':
        return `Rigg/driftskravet på ${formatCurrency(input.riggBelop)} ville blitt avvist.`;
      default:
        return '';
    }
  }
}

/**
 * Generate produktivitet text for subsidiary section
 */
function generateForseringProduktivitetSectionSubsidiaer(input: ForseringResponseInput): string {
  if (!input.harProduktivitetKrav || !input.produktivitetBelop) {
    return '';
  }

  const isPrekludert = input.produktivitetVarsletITide === false;

  if (isPrekludert) {
    // Double-subsidiary: no forseringsrett AND precluded
    switch (input.produktivitetVurdering) {
      case 'godkjent':
        return `Produktivitetskravet på ${formatCurrency(input.produktivitetBelop)} er prekludert, men ville ellers blitt godkjent.`;
      case 'delvis':
        return `Produktivitetskravet er prekludert, men ville ellers blitt delvis godkjent med ${formatCurrency(input.godkjentProduktivitet ?? 0)}.`;
      case 'avslatt':
        return `Produktivitetskravet er prekludert og ville uansett blitt avvist.`;
      default:
        return '';
    }
  } else {
    switch (input.produktivitetVurdering) {
      case 'godkjent':
        return `Produktivitetskravet på ${formatCurrency(input.produktivitetBelop)} ville blitt godkjent.`;
      case 'delvis':
        return `Produktivitetskravet ville blitt delvis godkjent med ${formatCurrency(input.godkjentProduktivitet ?? 0)} av krevde ${formatCurrency(input.produktivitetBelop)}.`;
      case 'avslatt':
        return `Produktivitetskravet på ${formatCurrency(input.produktivitetBelop)} ville blitt avvist.`;
      default:
        return '';
    }
  }
}
