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
 * - §33.5 (1): Beregning - "virkning på fremdriften som forholdet har forårsaket"
 * - §33.6.1: TE's spesifisering - "angi og begrunne det antall dager han krever"
 * - §33.6.2 (1): BH's forespørsel (etterlysning) - krav om spesifisert krav
 * - §33.6.2 (2): TE må svare "uten ugrunnet opphold" med dager+begrunnelse
 * - §33.6.2 (3): Preklusjon - "Gjør ikke totalentreprenøren noen av delene, tapes kravet"
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
  riggVarsletITide?: boolean;
  produktivitetVarsletITide?: boolean;

  // Metode (Port 2/3)
  akseptererMetode: boolean;
  oensketMetode?: VederlagsMetode;
  epJusteringAkseptert?: boolean;
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

function getMetodeLabel(metode?: VederlagsMetode): string {
  if (!metode) return 'ukjent oppgjørsform';
  const labels: Record<VederlagsMetode, string> = {
    'ENHETSPRISER': 'enhetspriser (§34.3)',
    'REGNINGSARBEID': 'regningsarbeid (§30.2/§34.4)',
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
    lines.push(`Byggherren godtar den foreslåtte oppgjørsformen ${getMetodeLabel(input.metode)}.`);
  } else {
    lines.push(
      `Byggherren godtar ikke den foreslåtte oppgjørsformen ${getMetodeLabel(input.metode)}, ` +
      `og krever i stedet oppgjør etter ${getMetodeLabel(input.oensketMetode)}.`
    );

    // Special case: rejecting fastpris - explain fallback based on chosen method
    if (input.metode === 'FASTPRIS_TILBUD') {
      if (input.oensketMetode === 'ENHETSPRISER') {
        lines.push('Ved å avslå fastpristilbudet (§34.2.1) kreves oppgjør etter kontraktens enhetspriser (§34.3).');
      } else {
        lines.push('Ved å avslå fastpristilbudet (§34.2.1), faller oppgjøret tilbake på regningsarbeid (§34.4).');
      }
    }
  }

  // EP-justering response (§34.3.3)
  if (input.kreverJustertEp && input.epJusteringAkseptert !== undefined) {
    if (input.epJusteringAkseptert) {
      lines.push('Kravet om justerte enhetspriser (§34.3.3) aksepteres.');
    } else {
      lines.push('Kravet om justerte enhetspriser (§34.3.3) avvises.');
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
  const { hovedkravVurdering, hovedkravBelop, hovedkravGodkjentBelop } = input;

  if (!hovedkravBelop) {
    return '';
  }

  switch (hovedkravVurdering) {
    case 'godkjent':
      return `Hovedkravet på ${formatCurrency(hovedkravBelop)} ${getVurderingVerb('godkjent')}.`;

    case 'delvis': {
      const godkjent = hovedkravGodkjentBelop ?? 0;
      const prosent = hovedkravBelop > 0 ? ((godkjent / hovedkravBelop) * 100).toFixed(0) : 0;
      return (
        `Hovedkravet ${getVurderingVerb('delvis')} med ${formatCurrency(godkjent)} ` +
        `av krevde ${formatCurrency(hovedkravBelop)} (${prosent}%).`
      );
    }

    case 'avslatt':
      return `Hovedkravet på ${formatCurrency(hovedkravBelop)} ${getVurderingVerb('avslatt')}.`;
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
 */
function generateSubsidiaerKravText(
  kravType: string,
  krevdBelop: number,
  vurdering: BelopVurdering,
  godkjentBelop?: number
): string {
  const prefix = 'Subsidiært, dersom kravet ikke anses prekludert,';

  switch (vurdering) {
    case 'godkjent':
      return `${prefix} aksepteres ${formatCurrency(krevdBelop)}.`;

    case 'delvis':
      return `${prefix} aksepteres ${formatCurrency(godkjentBelop ?? 0)} av krevde ${formatCurrency(krevdBelop)}.`;

    case 'avslatt':
      return `${prefix} ville kravet uansett blitt avvist.`;
  }
}

/**
 * Generate the conclusion section with totals
 */
function generateKonklusjonSection(input: VederlagResponseInput): string {
  const lines: string[] = [];

  // Prinsipalt resultat
  lines.push(
    `Samlet godkjent beløp utgjør etter dette ${formatCurrency(input.totalGodkjent)} ` +
    `av totalt krevde ${formatCurrency(input.totalKrevd)}.`
  );

  // Subsidiært resultat (kun hvis det er prekluderte krav)
  if (input.harPrekludertKrav && input.totalGodkjentSubsidiaer !== undefined) {
    const diff = input.totalGodkjentSubsidiaer - input.totalGodkjent;
    if (diff > 0) {
      lines.push(
        `Dersom de prekluderte særskilte kravene hadde vært varslet i tide, ville samlet godkjent beløp ` +
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
    sections.push('Hva gjelder beløpet:');

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
  noytraltVarselOk?: boolean;
  spesifisertKravOk?: boolean;
  sendEtterlysning?: boolean;

  // Vilkår (Port 2)
  vilkarOppfylt: boolean;

  // Beregning (Port 3)
  godkjentDager: number;

  // Computed
  erPrekludert: boolean;
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
    'noytralt': 'nøytralt varsel (§33.4)',
    'spesifisert': 'spesifisert krav (§33.6)',
    'force_majeure': 'force majeure-varsel (§33.3)',
  };
  return labels[varselType] || varselType;
}

/**
 * Get preclusion paragraph reference based on varsel type
 */
function getPreklusjonParagraf(varselType?: FristVarselType): string {
  switch (varselType) {
    case 'noytralt':
      return '§33.4';
    case 'force_majeure':
      return '§33.3';
    default:
      return '§33.6';
  }
}

/**
 * Generate the preclusion section for frist response
 */
function generateFristPreklusjonSection(input: FristResponseInput): string {
  // Etterlysning case
  if (input.sendEtterlysning) {
    return (
      'Byggherren etterspør spesifisert krav iht. §33.6.2. ' +
      'Entreprenøren må «uten ugrunnet opphold» angi og begrunne antall dager fristforlengelse. ' +
      'Dersom dette ikke gjøres, tapes kravet.'
    );
  }

  // Prekludert
  if (input.erPrekludert) {
    const paragraf = getPreklusjonParagraf(input.varselType);
    return (
      `Kravet avvises prinsipalt som prekludert iht. ${paragraf}, ` +
      `da ${getVarselTypeLabel(input.varselType)} ikke ble fremsatt «uten ugrunnet opphold» ` +
      `etter at entreprenøren ble eller burde blitt klar over forholdet.`
    );
  }

  // OK
  return `Varslingskravene i ${getPreklusjonParagraf(input.varselType)} anses oppfylt.`;
}

/**
 * Generate the conditions section for frist response (§33.5)
 */
function generateFristVilkarSection(input: FristResponseInput): string {
  const { vilkarOppfylt, erPrekludert } = input;

  // Vilkår is always evaluated, even when sending etterlysning
  const prefix = erPrekludert ? 'Subsidiært, hva gjelder vilkårene (§33.5): ' : '';

  if (vilkarOppfylt) {
    return (
      prefix +
      'Det erkjennes at det påberopte forholdet har forårsaket faktisk hindring av fremdriften, ' +
      'og at det foreligger årsakssammenheng mellom forholdet og forsinkelsen.'
    );
  }

  return (
    prefix +
    'Det bestrides at det påberopte forholdet har medført reell hindring av fremdriften. ' +
    'Entreprenøren hadde tilstrekkelig slakk i fremdriftsplanen, eller forsinkelsen skyldes andre forhold.'
  );
}

/**
 * Generate the calculation section for frist response
 */
function generateFristBeregningSection(input: FristResponseInput): string {
  const { krevdDager, godkjentDager, erPrekludert, vilkarOppfylt, varselType, sendEtterlysning } = input;

  // Skip calculation section when sending etterlysning or neutral notice without specified days
  if (sendEtterlysning || (varselType === 'noytralt' && krevdDager === 0)) {
    return '';
  }

  const erSubsidiaer = erPrekludert || !vilkarOppfylt;
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
  const { krevdDager, godkjentDager, prinsipaltResultat, visSubsidiaertResultat, varselType, sendEtterlysning } = input;
  const lines: string[] = [];

  // Handle etterlysning case - no conclusion needed as we're waiting for specification
  if (sendEtterlysning) {
    return '';
  }

  // Handle neutral notice without specified days (and no etterlysning sent)
  if (varselType === 'noytralt' && krevdDager === 0) {
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
 * Generate §33.3 (5) force majeure vederlag notice if applicable
 *
 * NS 8407 §33.3 (5): "Partene har ikke krav på justering av vederlaget
 * som følge av fristforlengelse etter denne bestemmelsen."
 *
 * This is critical information for the contractor to understand that while
 * force majeure grants time extensions, it does NOT grant compensation.
 */
function generateForceMajeureVederlagSection(input: FristResponseInput): string {
  const { varselType, godkjentDager, prinsipaltResultat } = input;

  // Only show for force majeure claims where days are approved
  if (varselType !== 'force_majeure') {
    return '';
  }

  // Only show if some extension is granted
  if (godkjentDager === 0 && prinsipaltResultat === 'avslatt') {
    return '';
  }

  return (
    'Byggherren gjør oppmerksom på at fristforlengelse innvilget etter §33.3 (force majeure) ' +
    'ikke gir grunnlag for vederlagsjustering, jf. §33.3 (5).'
  );
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

  // Skip if etterlysning - minimal response
  if (input.sendEtterlysning) {
    return generateFristPreklusjonSection(input);
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
