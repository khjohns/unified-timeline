/**
 * Begrunnelse Generator
 *
 * Automatically generates legally precise justification text based on
 * user selections in the response modals. The generated text follows
 * NS 8407 terminology and structure.
 *
 * The text is NOT editable by the user, but they can supplement it
 * with additional comments.
 */

import type { VederlagsMetode } from '../types/timeline';

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
    lines.push(`Byggherren godtar den foreslåtte oppgjørsformen ${getMetodeLabel(input.metode)}.`);
  } else {
    lines.push(
      `Byggherren godtar ikke den foreslåtte oppgjørsformen ${getMetodeLabel(input.metode)}, ` +
      `og krever i stedet oppgjør etter ${getMetodeLabel(input.oensketMetode)}.`
    );

    // Special case: rejecting fastpris falls back to regningsarbeid
    if (input.metode === 'FASTPRIS_TILBUD') {
      lines.push('Ved å avslå fastpristilbudet (§34.2.1), faller oppgjøret tilbake på regningsarbeid (§34.4).');
    }
  }

  // EP-justering response (§34.3.3)
  if (input.kreverJustertEp && input.epJusteringAkseptert !== undefined) {
    if (input.epJusteringAkseptert) {
      lines.push('Kravet om justerte enhetspriser (§34.3.3) aksepteres.');
    } else {
      lines.push(
        'Kravet om justerte enhetspriser (§34.3.3) avvises. ' +
        'Varselet anses ikke å være fremsatt «uten ugrunnet opphold».'
      );
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

    case 'delvis':
      const godkjent = hovedkravGodkjentBelop ?? 0;
      const prosent = hovedkravBelop > 0 ? ((godkjent / hovedkravBelop) * 100).toFixed(0) : 0;
      return (
        `Hovedkravet ${getVurderingVerb('delvis')} med ${formatCurrency(godkjent)} ` +
        `av krevde ${formatCurrency(hovedkravBelop)} (${prosent}%).`
      );

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
      `etter at entreprenøren ble eller burde blitt klar over forholdet.`
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

    case 'delvis':
      const belop = godkjentBelop ?? 0;
      return (
        `Kravet om dekning av ${kravType} ${getVurderingVerb('delvis')} med ` +
        `${formatCurrency(belop)} av krevde ${formatCurrency(krevdBelop)}.`
      );

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
