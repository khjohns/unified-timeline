/**
 * Test-matrise for subsidiærlogikk
 *
 * Tester alle kombinasjoner av:
 * - Grunnlag: godkjent / avslått / prekludert
 * - Vederlag: preklusjon (§34.1.2, §34.1.3, §34.3.3)
 * - Frist: preklusjon (§33.4) og reduksjon (§33.6.1)
 * - §33.6.2 unntaket (BH-forespørsel)
 *
 * Ref: NS 8407:2011
 */

import { describe, it, expect } from 'vitest';
import type { SubsidiaerTrigger, SakState, SporStatus } from '@/types/timeline';

// ============================================================
// HELPERS
// ============================================================

/**
 * Beregner om saken er i subsidiær-modus for vederlag
 * Repliserer backend-logikken fra sak_state.py
 */
function erSubsidiaertVederlag(state: {
  grunnlagStatus: SporStatus;
  vederlagBhResultat: string | null;
  erFrafalt?: boolean;
}): boolean {
  if (state.erFrafalt) return false;

  const grunnlagAvslatt = state.grunnlagStatus === 'avslatt';
  const beregningGodkjent =
    state.vederlagBhResultat === 'godkjent' ||
    state.vederlagBhResultat === 'delvis_godkjent';

  return grunnlagAvslatt && beregningGodkjent;
}

/**
 * Beregner om saken er i subsidiær-modus for frist
 */
function erSubsidiaertFrist(state: {
  grunnlagStatus: SporStatus;
  fristBhResultat: string | null;
  erFrafalt?: boolean;
}): boolean {
  if (state.erFrafalt) return false;

  const grunnlagAvslatt = state.grunnlagStatus === 'avslatt';
  const beregningGodkjent =
    state.fristBhResultat === 'godkjent' || state.fristBhResultat === 'delvis_godkjent';

  return grunnlagAvslatt && beregningGodkjent;
}

/**
 * Bestemmer om §33.6.1 reduksjon gjelder
 * UNNTAK: Gjelder IKKE når kravet er svar på forespørsel (§33.6.2 fjerde ledd)
 */
function gjelder33_6_1_Reduksjon(params: {
  harBhForesporsel: boolean;
  varselITide: boolean;
  spesifisertITide: boolean;
}): boolean {
  // §33.6.2 fjerde ledd: BH kan ikke påberope §33.6.1 ved svar på forespørsel
  if (params.harBhForesporsel) return false;

  // §33.6.1 gjelder kun når §33.4 er oppfylt men spesifisering kom for sent
  return params.varselITide && !params.spesifisertITide;
}

/**
 * Bestemmer hvilke triggers som gjelder for vederlag
 */
function getVederlagTriggers(params: {
  grunnlagAvslatt: boolean;
  hovedkravPrekludert: boolean;
  riggPrekludert: boolean;
  produktivitetPrekludert: boolean;
  epJusteringForSent: boolean;
  ingenHindring: boolean;
}): SubsidiaerTrigger[] {
  const triggers: SubsidiaerTrigger[] = [];

  if (params.grunnlagAvslatt) triggers.push('grunnlag_avslatt');
  if (params.hovedkravPrekludert) triggers.push('preklusjon_hovedkrav');
  if (params.riggPrekludert) triggers.push('preklusjon_rigg');
  if (params.produktivitetPrekludert) triggers.push('preklusjon_produktivitet');
  if (params.epJusteringForSent) triggers.push('reduksjon_ep_justering');
  if (params.ingenHindring) triggers.push('ingen_hindring');

  return triggers;
}

/**
 * Bestemmer hvilke triggers som gjelder for frist
 */
function getFristTriggers(params: {
  grunnlagAvslatt: boolean;
  varselForSent: boolean;
  spesifisertForSent: boolean;
  harBhForesporsel: boolean;
  ingenHindring: boolean;
}): SubsidiaerTrigger[] {
  const triggers: SubsidiaerTrigger[] = [];

  if (params.grunnlagAvslatt) triggers.push('grunnlag_avslatt');
  if (params.varselForSent) triggers.push('preklusjon_varsel');

  // §33.6.2 fjerde ledd: Unntak ved BH-forespørsel
  if (params.spesifisertForSent && !params.harBhForesporsel) {
    triggers.push('reduksjon_spesifisert');
  }

  if (params.ingenHindring) triggers.push('ingen_hindring');

  return triggers;
}

// ============================================================
// TESTS: VEDERLAG SUBSIDIÆR
// ============================================================

describe('Subsidiær Vederlag', () => {
  describe('erSubsidiaertVederlag beregning', () => {
    it('skal være TRUE når grunnlag avslått OG vederlag godkjent', () => {
      expect(
        erSubsidiaertVederlag({
          grunnlagStatus: 'avslatt',
          vederlagBhResultat: 'godkjent',
        })
      ).toBe(true);
    });

    it('skal være TRUE når grunnlag avslått OG vederlag delvis_godkjent', () => {
      expect(
        erSubsidiaertVederlag({
          grunnlagStatus: 'avslatt',
          vederlagBhResultat: 'delvis_godkjent',
        })
      ).toBe(true);
    });

    it('skal være FALSE når grunnlag godkjent (uavhengig av vederlag)', () => {
      expect(
        erSubsidiaertVederlag({
          grunnlagStatus: 'godkjent',
          vederlagBhResultat: 'godkjent',
        })
      ).toBe(false);
    });

    it('skal være FALSE når vederlag avslått', () => {
      expect(
        erSubsidiaertVederlag({
          grunnlagStatus: 'avslatt',
          vederlagBhResultat: 'avslatt',
        })
      ).toBe(false);
    });

    it('skal være FALSE ved frafall (§32.3 c)', () => {
      expect(
        erSubsidiaertVederlag({
          grunnlagStatus: 'avslatt',
          vederlagBhResultat: 'godkjent',
          erFrafalt: true,
        })
      ).toBe(false);
    });
  });

  describe('Vederlag preklusjons-triggere', () => {
    describe('§34.1.2 - Hovedkrav preklusjon', () => {
      it('skal inkludere preklusjon_hovedkrav når hovedkrav varslet for sent', () => {
        const triggers = getVederlagTriggers({
          grunnlagAvslatt: false,
          hovedkravPrekludert: true,
          riggPrekludert: false,
          produktivitetPrekludert: false,
          epJusteringForSent: false,
          ingenHindring: false,
        });

        expect(triggers).toContain('preklusjon_hovedkrav');
        expect(triggers).not.toContain('grunnlag_avslatt');
      });

      it('skal kombinere grunnlag_avslatt OG preklusjon_hovedkrav', () => {
        const triggers = getVederlagTriggers({
          grunnlagAvslatt: true,
          hovedkravPrekludert: true,
          riggPrekludert: false,
          produktivitetPrekludert: false,
          epJusteringForSent: false,
          ingenHindring: false,
        });

        expect(triggers).toContain('grunnlag_avslatt');
        expect(triggers).toContain('preklusjon_hovedkrav');
      });
    });

    describe('§34.1.3 - Særskilte krav (rigg/produktivitet)', () => {
      it('skal inkludere preklusjon_rigg når rigg/drift varslet for sent', () => {
        const triggers = getVederlagTriggers({
          grunnlagAvslatt: false,
          hovedkravPrekludert: false,
          riggPrekludert: true,
          produktivitetPrekludert: false,
          epJusteringForSent: false,
          ingenHindring: false,
        });

        expect(triggers).toContain('preklusjon_rigg');
      });

      it('skal inkludere preklusjon_produktivitet når produktivitetstap varslet for sent', () => {
        const triggers = getVederlagTriggers({
          grunnlagAvslatt: false,
          hovedkravPrekludert: false,
          riggPrekludert: false,
          produktivitetPrekludert: true,
          epJusteringForSent: false,
          ingenHindring: false,
        });

        expect(triggers).toContain('preklusjon_produktivitet');
      });

      it('skal kunne ha både rigg OG produktivitet prekludert', () => {
        const triggers = getVederlagTriggers({
          grunnlagAvslatt: false,
          hovedkravPrekludert: false,
          riggPrekludert: true,
          produktivitetPrekludert: true,
          epJusteringForSent: false,
          ingenHindring: false,
        });

        expect(triggers).toContain('preklusjon_rigg');
        expect(triggers).toContain('preklusjon_produktivitet');
      });
    });

    describe('§34.3.3 - EP-justering', () => {
      it('skal inkludere reduksjon_ep_justering når EP-justering varslet for sent', () => {
        const triggers = getVederlagTriggers({
          grunnlagAvslatt: false,
          hovedkravPrekludert: false,
          riggPrekludert: false,
          produktivitetPrekludert: false,
          epJusteringForSent: true,
          ingenHindring: false,
        });

        expect(triggers).toContain('reduksjon_ep_justering');
      });
    });

    describe('Kombinerte triggere', () => {
      it('skal kunne ha alle triggere samtidig', () => {
        const triggers = getVederlagTriggers({
          grunnlagAvslatt: true,
          hovedkravPrekludert: true,
          riggPrekludert: true,
          produktivitetPrekludert: true,
          epJusteringForSent: true,
          ingenHindring: true,
        });

        expect(triggers).toHaveLength(6);
        expect(triggers).toContain('grunnlag_avslatt');
        expect(triggers).toContain('preklusjon_hovedkrav');
        expect(triggers).toContain('preklusjon_rigg');
        expect(triggers).toContain('preklusjon_produktivitet');
        expect(triggers).toContain('reduksjon_ep_justering');
        expect(triggers).toContain('ingen_hindring');
      });

      it('skal returnere tom liste når ingen triggere', () => {
        const triggers = getVederlagTriggers({
          grunnlagAvslatt: false,
          hovedkravPrekludert: false,
          riggPrekludert: false,
          produktivitetPrekludert: false,
          epJusteringForSent: false,
          ingenHindring: false,
        });

        expect(triggers).toHaveLength(0);
      });
    });
  });
});

// ============================================================
// TESTS: FRIST SUBSIDIÆR
// ============================================================

describe('Subsidiær Frist', () => {
  describe('erSubsidiaertFrist beregning', () => {
    it('skal være TRUE når grunnlag avslått OG frist godkjent', () => {
      expect(
        erSubsidiaertFrist({
          grunnlagStatus: 'avslatt',
          fristBhResultat: 'godkjent',
        })
      ).toBe(true);
    });

    it('skal være TRUE når grunnlag avslått OG frist delvis_godkjent', () => {
      expect(
        erSubsidiaertFrist({
          grunnlagStatus: 'avslatt',
          fristBhResultat: 'delvis_godkjent',
        })
      ).toBe(true);
    });

    it('skal være FALSE når grunnlag godkjent', () => {
      expect(
        erSubsidiaertFrist({
          grunnlagStatus: 'godkjent',
          fristBhResultat: 'godkjent',
        })
      ).toBe(false);
    });

    it('skal være FALSE ved frafall', () => {
      expect(
        erSubsidiaertFrist({
          grunnlagStatus: 'avslatt',
          fristBhResultat: 'godkjent',
          erFrafalt: true,
        })
      ).toBe(false);
    });
  });

  describe('Frist preklusjons-triggere', () => {
    describe('§33.4 - Varsel om fristforlengelse', () => {
      it('skal inkludere preklusjon_varsel når varsel kom for sent', () => {
        const triggers = getFristTriggers({
          grunnlagAvslatt: false,
          varselForSent: true,
          spesifisertForSent: false,
          harBhForesporsel: false,
          ingenHindring: false,
        });

        expect(triggers).toContain('preklusjon_varsel');
      });

      it('skal IKKE inkludere preklusjon_varsel når varsel kom i tide', () => {
        const triggers = getFristTriggers({
          grunnlagAvslatt: false,
          varselForSent: false,
          spesifisertForSent: false,
          harBhForesporsel: false,
          ingenHindring: false,
        });

        expect(triggers).not.toContain('preklusjon_varsel');
      });
    });

    describe('§33.6.1 - Spesifisert krav reduksjon', () => {
      it('skal inkludere reduksjon_spesifisert når spesifisering kom for sent', () => {
        const triggers = getFristTriggers({
          grunnlagAvslatt: false,
          varselForSent: false,
          spesifisertForSent: true,
          harBhForesporsel: false,
          ingenHindring: false,
        });

        expect(triggers).toContain('reduksjon_spesifisert');
      });

      it('skal IKKE inkludere reduksjon_spesifisert når spesifisering kom i tide', () => {
        const triggers = getFristTriggers({
          grunnlagAvslatt: false,
          varselForSent: false,
          spesifisertForSent: false,
          harBhForesporsel: false,
          ingenHindring: false,
        });

        expect(triggers).not.toContain('reduksjon_spesifisert');
      });
    });

    describe('§33.6.2 fjerde ledd - BH-forespørsel unntak', () => {
      it('skal IKKE inkludere reduksjon_spesifisert ved BH-forespørsel (selv om for sent)', () => {
        const triggers = getFristTriggers({
          grunnlagAvslatt: false,
          varselForSent: false,
          spesifisertForSent: true,
          harBhForesporsel: true, // UNNTAK!
          ingenHindring: false,
        });

        expect(triggers).not.toContain('reduksjon_spesifisert');
      });

      it('skal fortsatt inkludere preklusjon_varsel ved BH-forespørsel', () => {
        const triggers = getFristTriggers({
          grunnlagAvslatt: false,
          varselForSent: true,
          spesifisertForSent: true,
          harBhForesporsel: true,
          ingenHindring: false,
        });

        expect(triggers).toContain('preklusjon_varsel');
        expect(triggers).not.toContain('reduksjon_spesifisert');
      });
    });

    describe('Kombinerte triggere', () => {
      it('skal kunne ha varsel + spesifisert for sent (uten BH-forespørsel)', () => {
        const triggers = getFristTriggers({
          grunnlagAvslatt: false,
          varselForSent: true,
          spesifisertForSent: true,
          harBhForesporsel: false,
          ingenHindring: false,
        });

        expect(triggers).toContain('preklusjon_varsel');
        expect(triggers).toContain('reduksjon_spesifisert');
      });

      it('skal kombinere grunnlag_avslatt med preklusjon_varsel', () => {
        const triggers = getFristTriggers({
          grunnlagAvslatt: true,
          varselForSent: true,
          spesifisertForSent: false,
          harBhForesporsel: false,
          ingenHindring: false,
        });

        expect(triggers).toContain('grunnlag_avslatt');
        expect(triggers).toContain('preklusjon_varsel');
      });

      it('skal inkludere ingen_hindring når relevant', () => {
        const triggers = getFristTriggers({
          grunnlagAvslatt: false,
          varselForSent: false,
          spesifisertForSent: false,
          harBhForesporsel: false,
          ingenHindring: true,
        });

        expect(triggers).toContain('ingen_hindring');
      });
    });
  });
});

// ============================================================
// TESTS: §33.6.1 REDUKSJON LOGIKK
// ============================================================

describe('§33.6.1 Reduksjonslogikk', () => {
  it('skal gjelde når varsel i tide MEN spesifisering for sent', () => {
    expect(
      gjelder33_6_1_Reduksjon({
        harBhForesporsel: false,
        varselITide: true,
        spesifisertITide: false,
      })
    ).toBe(true);
  });

  it('skal IKKE gjelde når både varsel og spesifisering i tide', () => {
    expect(
      gjelder33_6_1_Reduksjon({
        harBhForesporsel: false,
        varselITide: true,
        spesifisertITide: true,
      })
    ).toBe(false);
  });

  it('skal IKKE gjelde når varsel for sent (da gjelder §33.4 preklusjon i stedet)', () => {
    expect(
      gjelder33_6_1_Reduksjon({
        harBhForesporsel: false,
        varselITide: false,
        spesifisertITide: false,
      })
    ).toBe(false);
  });

  it('skal IKKE gjelde ved BH-forespørsel (§33.6.2 fjerde ledd)', () => {
    expect(
      gjelder33_6_1_Reduksjon({
        harBhForesporsel: true, // UNNTAK!
        varselITide: true,
        spesifisertITide: false,
      })
    ).toBe(false);
  });
});

// ============================================================
// TESTS: KOMPLETT MATRISE
// ============================================================

describe('Komplett test-matrise', () => {
  /**
   * Matrise: Grunnlag × Vederlag/Frist
   *
   * | Grunnlag    | Vederlag resultat | er_subsidiaert |
   * |-------------|-------------------|----------------|
   * | godkjent    | godkjent          | FALSE          |
   * | godkjent    | avslått           | FALSE          |
   * | avslått     | godkjent          | TRUE           |
   * | avslått     | avslått           | FALSE          |
   * | avslått     | delvis_godkjent   | TRUE           |
   */

  const grunnlagStatuser: SporStatus[] = ['godkjent', 'avslatt', 'delvis_godkjent'];
  const bhResultater = ['godkjent', 'delvis_godkjent', 'avslatt', null];

  describe('Vederlag matrise', () => {
    for (const grunnlagStatus of grunnlagStatuser) {
      for (const vederlagResultat of bhResultater) {
        const expected =
          grunnlagStatus === 'avslatt' &&
          (vederlagResultat === 'godkjent' || vederlagResultat === 'delvis_godkjent');

        it(`grunnlag=${grunnlagStatus}, vederlag=${vederlagResultat} → subsidiær=${expected}`, () => {
          const result = erSubsidiaertVederlag({
            grunnlagStatus,
            vederlagBhResultat: vederlagResultat,
          });
          expect(result).toBe(expected);
        });
      }
    }
  });

  describe('Frist matrise', () => {
    for (const grunnlagStatus of grunnlagStatuser) {
      for (const fristResultat of bhResultater) {
        const expected =
          grunnlagStatus === 'avslatt' &&
          (fristResultat === 'godkjent' || fristResultat === 'delvis_godkjent');

        it(`grunnlag=${grunnlagStatus}, frist=${fristResultat} → subsidiær=${expected}`, () => {
          const result = erSubsidiaertFrist({
            grunnlagStatus,
            fristBhResultat: fristResultat,
          });
          expect(result).toBe(expected);
        });
      }
    }
  });

  describe('§33.6.2 unntak matrise', () => {
    const scenarios = [
      { varselITide: true, spesifisertITide: true, harBhForesporsel: false, expected: false },
      { varselITide: true, spesifisertITide: false, harBhForesporsel: false, expected: true },
      { varselITide: false, spesifisertITide: false, harBhForesporsel: false, expected: false },
      { varselITide: true, spesifisertITide: false, harBhForesporsel: true, expected: false }, // UNNTAK
      { varselITide: false, spesifisertITide: false, harBhForesporsel: true, expected: false },
    ];

    for (const scenario of scenarios) {
      const desc = `varsel=${scenario.varselITide}, spesifisert=${scenario.spesifisertITide}, forespørsel=${scenario.harBhForesporsel}`;
      it(`${desc} → reduksjon=${scenario.expected}`, () => {
        expect(gjelder33_6_1_Reduksjon(scenario)).toBe(scenario.expected);
      });
    }
  });
});
