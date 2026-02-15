import { describe, it, expect } from 'vitest';
import type { SubsidiaerTrigger } from '../../types/timeline';
import {
  getDefaults,
  har34_1_2Preklusjon,
  erHelVederlagSubsidiaerPgaGrunnlag,
  erSubsidiaer,
  beregnHovedkravPrekludert,
  beregnRiggPrekludert,
  beregnProduktivitetPrekludert,
  harPreklusjonsSteg,
  kanHoldeTilbake,
  maSvarePaJustering,
  beregnGodkjentBelop,
  beregnTotaler,
  beregnPrinsipaltResultat,
  beregnSubsidiaertResultat,
  beregnSubsidiaerTriggers,
  getVurderingBadge,
  getDynamicPlaceholder,
  buildEventData,
  beregnAlt,
  type VederlagFormState,
  type VederlagDomainConfig,
} from '../vederlagDomain';

// ============================================================================
// HELPERS
// ============================================================================

function makeState(overrides: Partial<VederlagFormState> = {}): VederlagFormState {
  return {
    hovedkravVarsletITide: true,
    riggVarsletITide: true,
    produktivitetVarsletITide: true,
    akseptererMetode: true,
    holdTilbake: false,
    hovedkravVurdering: 'godkjent',
    begrunnelse: '',
    ...overrides,
  };
}

function makeConfig(overrides: Partial<VederlagDomainConfig> = {}): VederlagDomainConfig {
  return {
    metode: 'ENHETSPRISER',
    hovedkravBelop: 100000,
    harRiggKrav: false,
    harProduktivitetKrav: false,
    kreverJustertEp: false,
    grunnlagVarsletForSent: false,
    ...overrides,
  };
}

const noPreklusjon = { hovedkrav: false, rigg: false, produktivitet: false };

// ============================================================================
// getDefaults
// ============================================================================

describe('getDefaults', () => {
  it('returns TE-favorable defaults for create mode', () => {
    const defaults = getDefaults({ isUpdateMode: false });
    expect(defaults.hovedkravVarsletITide).toBe(true);
    expect(defaults.riggVarsletITide).toBe(true);
    expect(defaults.produktivitetVarsletITide).toBe(true);
    expect(defaults.akseptererMetode).toBe(true);
    expect(defaults.holdTilbake).toBe(false);
    expect(defaults.hovedkravVurdering).toBe('godkjent');
    expect(defaults.begrunnelse).toBe('');
  });

  it('pre-fills from lastResponseEvent in update mode', () => {
    const defaults = getDefaults({
      isUpdateMode: true,
      lastResponseEvent: {
        eventId: 'e1',
        akseptererMetode: false,
        oensketMetode: 'REGNINGSARBEID',
        hovedkravVurdering: 'delvis',
        hovedkravGodkjentBelop: 50000,
        riggVarsletITide: false,
      },
    });
    expect(defaults.akseptererMetode).toBe(false);
    expect(defaults.oensketMetode).toBe('REGNINGSARBEID');
    expect(defaults.hovedkravVurdering).toBe('delvis');
    expect(defaults.hovedkravGodkjentBelop).toBe(50000);
    expect(defaults.riggVarsletITide).toBe(false);
    expect(defaults.begrunnelse).toBe('');
  });

  it('falls back to TE-favorable defaults for missing fields in update mode', () => {
    const defaults = getDefaults({
      isUpdateMode: true,
      lastResponseEvent: { eventId: 'e1' },
    });
    expect(defaults.hovedkravVarsletITide).toBe(true);
    expect(defaults.akseptererMetode).toBe(true);
    expect(defaults.holdTilbake).toBe(false);
    expect(defaults.hovedkravVurdering).toBe('godkjent');
  });
});

// ============================================================================
// Preclusion
// ============================================================================

describe('har34_1_2Preklusjon', () => {
  it('returns true for SVIKT', () => {
    expect(har34_1_2Preklusjon({ hovedkategori: 'SVIKT' })).toBe(true);
  });

  it('returns true for ANDRE', () => {
    expect(har34_1_2Preklusjon({ hovedkategori: 'ANDRE' })).toBe(true);
  });

  it('returns false for ENDRING', () => {
    expect(har34_1_2Preklusjon({ hovedkategori: 'ENDRING' })).toBe(false);
  });

  it('returns false for FORCE_MAJEURE', () => {
    expect(har34_1_2Preklusjon({ hovedkategori: 'FORCE_MAJEURE' })).toBe(false);
  });

  it('returns false when undefined', () => {
    expect(har34_1_2Preklusjon({})).toBe(false);
  });
});

describe('erHelVederlagSubsidiaerPgaGrunnlag', () => {
  it('returns true for ENDRING with grunnlagVarsletForSent', () => {
    expect(erHelVederlagSubsidiaerPgaGrunnlag({
      hovedkategori: 'ENDRING',
      grunnlagVarsletForSent: true,
    })).toBe(true);
  });

  it('returns false for ENDRING without grunnlagVarsletForSent', () => {
    expect(erHelVederlagSubsidiaerPgaGrunnlag({
      hovedkategori: 'ENDRING',
      grunnlagVarsletForSent: false,
    })).toBe(false);
  });

  it('returns false for SVIKT even with grunnlagVarsletForSent', () => {
    expect(erHelVederlagSubsidiaerPgaGrunnlag({
      hovedkategori: 'SVIKT',
      grunnlagVarsletForSent: true,
    })).toBe(false);
  });
});

describe('erSubsidiaer', () => {
  it('returns true when grunnlag is avslått', () => {
    expect(erSubsidiaer({
      grunnlagStatus: 'avslatt',
      hovedkategori: 'ENDRING',
      grunnlagVarsletForSent: false,
    })).toBe(true);
  });

  it('returns true when grunnlag varslet for sent (§32.2)', () => {
    expect(erSubsidiaer({
      grunnlagStatus: 'godkjent',
      hovedkategori: 'ENDRING',
      grunnlagVarsletForSent: true,
    })).toBe(true);
  });

  it('returns false when grunnlag is godkjent and not §32.2', () => {
    expect(erSubsidiaer({
      grunnlagStatus: 'godkjent',
      hovedkategori: 'ENDRING',
      grunnlagVarsletForSent: false,
    })).toBe(false);
  });
});

describe('beregnHovedkravPrekludert', () => {
  it('precluded when SVIKT and varslet for sent', () => {
    expect(beregnHovedkravPrekludert(
      { hovedkravVarsletITide: false },
      { hovedkategori: 'SVIKT' },
    )).toBe(true);
  });

  it('not precluded when SVIKT and varslet i tide', () => {
    expect(beregnHovedkravPrekludert(
      { hovedkravVarsletITide: true },
      { hovedkategori: 'SVIKT' },
    )).toBe(false);
  });

  it('never precluded for ENDRING (§34.1.2 does not apply)', () => {
    expect(beregnHovedkravPrekludert(
      { hovedkravVarsletITide: false },
      { hovedkategori: 'ENDRING' },
    )).toBe(false);
  });
});

describe('beregnRiggPrekludert', () => {
  it('precluded when harRiggKrav and varslet for sent', () => {
    expect(beregnRiggPrekludert(
      { riggVarsletITide: false },
      { harRiggKrav: true },
    )).toBe(true);
  });

  it('not precluded when no rigg krav', () => {
    expect(beregnRiggPrekludert(
      { riggVarsletITide: false },
      { harRiggKrav: false },
    )).toBe(false);
  });
});

describe('beregnProduktivitetPrekludert', () => {
  it('precluded when harProduktivitetKrav and varslet for sent', () => {
    expect(beregnProduktivitetPrekludert(
      { produktivitetVarsletITide: false },
      { harProduktivitetKrav: true },
    )).toBe(true);
  });
});

describe('harPreklusjonsSteg', () => {
  it('true when harRiggKrav', () => {
    expect(harPreklusjonsSteg(makeConfig({ harRiggKrav: true }))).toBe(true);
  });

  it('true when SVIKT (§34.1.2 applies)', () => {
    expect(harPreklusjonsSteg(makeConfig({ hovedkategori: 'SVIKT' }))).toBe(true);
  });

  it('false when ENDRING with no særskilte krav', () => {
    expect(harPreklusjonsSteg(makeConfig({ hovedkategori: 'ENDRING' }))).toBe(false);
  });
});

// ============================================================================
// Method derivations
// ============================================================================

describe('kanHoldeTilbake', () => {
  it('true for REGNINGSARBEID without kostnadsoverslag', () => {
    expect(kanHoldeTilbake({ metode: 'REGNINGSARBEID' })).toBe(true);
  });

  it('false for REGNINGSARBEID with kostnadsoverslag', () => {
    expect(kanHoldeTilbake({ metode: 'REGNINGSARBEID', kostnadsOverslag: 50000 })).toBe(false);
  });

  it('false for ENHETSPRISER', () => {
    expect(kanHoldeTilbake({ metode: 'ENHETSPRISER' })).toBe(false);
  });
});

describe('maSvarePaJustering', () => {
  it('true for ENHETSPRISER with kreverJustertEp', () => {
    expect(maSvarePaJustering({ metode: 'ENHETSPRISER', kreverJustertEp: true })).toBe(true);
  });

  it('false for ENHETSPRISER without kreverJustertEp', () => {
    expect(maSvarePaJustering({ metode: 'ENHETSPRISER', kreverJustertEp: false })).toBe(false);
  });

  it('false for REGNINGSARBEID even with kreverJustertEp', () => {
    expect(maSvarePaJustering({ metode: 'REGNINGSARBEID', kreverJustertEp: true })).toBe(false);
  });
});

// ============================================================================
// beregnGodkjentBelop
// ============================================================================

describe('beregnGodkjentBelop', () => {
  it('returns full amount when godkjent', () => {
    expect(beregnGodkjentBelop('godkjent', 100000, undefined)).toBe(100000);
  });

  it('returns delvis amount when delvis', () => {
    expect(beregnGodkjentBelop('delvis', 100000, 60000)).toBe(60000);
  });

  it('returns 0 when delvis but no amount specified', () => {
    expect(beregnGodkjentBelop('delvis', 100000, undefined)).toBe(0);
  });

  it('returns 0 when avslatt', () => {
    expect(beregnGodkjentBelop('avslatt', 100000, undefined)).toBe(0);
  });

  it('returns 0 when prekludert regardless of vurdering', () => {
    expect(beregnGodkjentBelop('godkjent', 100000, undefined, true)).toBe(0);
  });
});

// ============================================================================
// beregnTotaler
// ============================================================================

describe('beregnTotaler', () => {
  it('calculates totals for hovedkrav only', () => {
    const state = makeState({ hovedkravVurdering: 'godkjent' });
    const config = makeConfig({ hovedkravBelop: 100000 });
    const totaler = beregnTotaler(state, config, noPreklusjon);

    expect(totaler.totalKrevd).toBe(100000);
    expect(totaler.totalKrevdInklPrekludert).toBe(100000);
    expect(totaler.totalGodkjent).toBe(100000);
    expect(totaler.totalGodkjentInklPrekludert).toBe(100000);
    expect(totaler.harPrekludertKrav).toBe(false);
  });

  it('includes rigg and produktivitet in totals', () => {
    const state = makeState({
      hovedkravVurdering: 'godkjent',
      riggVurdering: 'godkjent',
      produktivitetVurdering: 'delvis',
      produktivitetGodkjentBelop: 15000,
    });
    const config = makeConfig({
      hovedkravBelop: 100000,
      harRiggKrav: true,
      riggBelop: 30000,
      harProduktivitetKrav: true,
      produktivitetBelop: 20000,
    });
    const totaler = beregnTotaler(state, config, noPreklusjon);

    expect(totaler.totalKrevd).toBe(150000);
    expect(totaler.totalGodkjent).toBe(145000); // 100k + 30k + 15k
  });

  it('excludes precluded krav from principal totals', () => {
    const state = makeState({
      hovedkravVurdering: 'godkjent',
      riggVurdering: 'godkjent',
    });
    const config = makeConfig({
      hovedkravBelop: 100000,
      harRiggKrav: true,
      riggBelop: 30000,
    });
    const preklusjon = { hovedkrav: false, rigg: true, produktivitet: false };
    const totaler = beregnTotaler(state, config, preklusjon);

    // Principal: rigg excluded
    expect(totaler.totalKrevd).toBe(100000);
    expect(totaler.totalGodkjent).toBe(100000);

    // Subsidiary: rigg included
    expect(totaler.totalKrevdInklPrekludert).toBe(130000);
    expect(totaler.totalGodkjentInklPrekludert).toBe(130000);
    expect(totaler.harPrekludertKrav).toBe(true);
  });

  it('handles delvis godkjent for precluded krav in subsidiary', () => {
    const state = makeState({
      hovedkravVurdering: 'godkjent',
      riggVurdering: 'delvis',
      riggGodkjentBelop: 10000,
    });
    const config = makeConfig({
      hovedkravBelop: 100000,
      harRiggKrav: true,
      riggBelop: 30000,
    });
    const preklusjon = { hovedkrav: false, rigg: true, produktivitet: false };
    const totaler = beregnTotaler(state, config, preklusjon);

    expect(totaler.totalGodkjent).toBe(100000); // rigg excluded
    expect(totaler.totalGodkjentInklPrekludert).toBe(110000); // 100k + 10k subsidiary
  });

  it('tracks harMetodeendring', () => {
    const state = makeState({ akseptererMetode: false });
    const totaler = beregnTotaler(state, makeConfig(), noPreklusjon);
    expect(totaler.harMetodeendring).toBe(true);
  });
});

// ============================================================================
// beregnPrinsipaltResultat
// ============================================================================

describe('beregnPrinsipaltResultat', () => {
  it('returns hold_tilbake when holdTilbake is true', () => {
    expect(beregnPrinsipaltResultat({
      totalKrevdInklPrekludert: 100000,
      totalGodkjent: 100000,
      harMetodeendring: false,
      holdTilbake: true,
    })).toBe('hold_tilbake');
  });

  it('returns godkjent when fully approved', () => {
    expect(beregnPrinsipaltResultat({
      totalKrevdInklPrekludert: 100000,
      totalGodkjent: 100000,
      harMetodeendring: false,
      holdTilbake: false,
    })).toBe('godkjent');
  });

  it('returns delvis_godkjent when partially approved', () => {
    expect(beregnPrinsipaltResultat({
      totalKrevdInklPrekludert: 100000,
      totalGodkjent: 50000,
      harMetodeendring: false,
      holdTilbake: false,
    })).toBe('delvis_godkjent');
  });

  it('returns delvis_godkjent when method changed even if fully approved', () => {
    expect(beregnPrinsipaltResultat({
      totalKrevdInklPrekludert: 100000,
      totalGodkjent: 100000,
      harMetodeendring: true,
      holdTilbake: false,
    })).toBe('delvis_godkjent');
  });

  it('returns avslatt when nothing approved', () => {
    expect(beregnPrinsipaltResultat({
      totalKrevdInklPrekludert: 100000,
      totalGodkjent: 0,
      harMetodeendring: false,
      holdTilbake: false,
    })).toBe('avslatt');
  });

  it('handles 99% threshold for godkjent', () => {
    expect(beregnPrinsipaltResultat({
      totalKrevdInklPrekludert: 100000,
      totalGodkjent: 99000,
      harMetodeendring: false,
      holdTilbake: false,
    })).toBe('godkjent');
  });
});

// ============================================================================
// beregnSubsidiaertResultat
// ============================================================================

describe('beregnSubsidiaertResultat', () => {
  it('returns godkjent when fully approved ignoring preclusion', () => {
    expect(beregnSubsidiaertResultat({
      totalKrevdInklPrekludert: 130000,
      totalGodkjentInklPrekludert: 130000,
      harMetodeendring: false,
      hovedkravVurdering: 'godkjent',
    })).toBe('godkjent');
  });

  it('returns avslatt when all rejected', () => {
    expect(beregnSubsidiaertResultat({
      totalKrevdInklPrekludert: 130000,
      totalGodkjentInklPrekludert: 0,
      harMetodeendring: false,
      hovedkravVurdering: 'avslatt',
    })).toBe('avslatt');
  });

  it('returns delvis_godkjent when partially approved', () => {
    expect(beregnSubsidiaertResultat({
      totalKrevdInklPrekludert: 130000,
      totalGodkjentInklPrekludert: 80000,
      harMetodeendring: false,
      hovedkravVurdering: 'delvis',
    })).toBe('delvis_godkjent');
  });

  it('returns delvis_godkjent when method changed', () => {
    expect(beregnSubsidiaertResultat({
      totalKrevdInklPrekludert: 100000,
      totalGodkjentInklPrekludert: 100000,
      harMetodeendring: true,
      hovedkravVurdering: 'godkjent',
    })).toBe('delvis_godkjent');
  });
});

// ============================================================================
// beregnSubsidiaerTriggers
// ============================================================================

describe('beregnSubsidiaerTriggers', () => {
  it('returns empty array when no triggers', () => {
    const state = makeState();
    const config = makeConfig();
    expect(beregnSubsidiaerTriggers(state, config, noPreklusjon)).toEqual([]);
  });

  it('includes preklusjon_hovedkrav when hovedkrav precluded', () => {
    const triggers = beregnSubsidiaerTriggers(
      makeState(),
      makeConfig(),
      { hovedkrav: true, rigg: false, produktivitet: false },
    );
    expect(triggers).toContain('preklusjon_hovedkrav');
  });

  it('includes preklusjon_rigg and preklusjon_produktivitet', () => {
    const triggers = beregnSubsidiaerTriggers(
      makeState(),
      makeConfig(),
      { hovedkrav: false, rigg: true, produktivitet: true },
    );
    expect(triggers).toContain('preklusjon_rigg');
    expect(triggers).toContain('preklusjon_produktivitet');
  });

  it('includes reduksjon_ep_justering when EP varslet for sent', () => {
    const triggers = beregnSubsidiaerTriggers(
      makeState({ epJusteringVarsletITide: false }),
      makeConfig({ kreverJustertEp: true }),
      noPreklusjon,
    );
    expect(triggers).toContain('reduksjon_ep_justering');
  });

  it('includes metode_avslatt when method rejected', () => {
    const triggers = beregnSubsidiaerTriggers(
      makeState({ akseptererMetode: false }),
      makeConfig(),
      noPreklusjon,
    );
    expect(triggers).toContain('metode_avslatt');
  });

  it('collects multiple triggers simultaneously', () => {
    const triggers = beregnSubsidiaerTriggers(
      makeState({ akseptererMetode: false, epJusteringVarsletITide: false }),
      makeConfig({ kreverJustertEp: true }),
      { hovedkrav: true, rigg: true, produktivitet: false },
    );
    expect(triggers).toHaveLength(4);
    expect(triggers).toContain('preklusjon_hovedkrav');
    expect(triggers).toContain('preklusjon_rigg');
    expect(triggers).toContain('reduksjon_ep_justering');
    expect(triggers).toContain('metode_avslatt');
  });
});

// ============================================================================
// getVurderingBadge
// ============================================================================

describe('getVurderingBadge', () => {
  it('returns success for godkjent', () => {
    expect(getVurderingBadge('godkjent')).toEqual({ variant: 'success', label: 'Godkjent' });
  });

  it('returns warning for delvis', () => {
    expect(getVurderingBadge('delvis')).toEqual({ variant: 'warning', label: 'Delvis' });
  });

  it('returns danger for avslatt', () => {
    expect(getVurderingBadge('avslatt')).toEqual({ variant: 'danger', label: 'Avvist' });
  });

  it('returns danger prekludert when prekludert flag is set', () => {
    expect(getVurderingBadge('godkjent', true)).toEqual({ variant: 'danger', label: 'Prekludert' });
  });
});

// ============================================================================
// getDynamicPlaceholder
// ============================================================================

describe('getDynamicPlaceholder', () => {
  it('returns generic placeholder when no resultat', () => {
    expect(getDynamicPlaceholder(undefined)).toContain('Gjør valgene');
  });

  it('returns godkjenning text', () => {
    expect(getDynamicPlaceholder('godkjent')).toContain('godkjenning');
  });

  it('returns delvis text', () => {
    expect(getDynamicPlaceholder('delvis_godkjent')).toContain('deler');
  });

  it('returns avslag text', () => {
    expect(getDynamicPlaceholder('avslatt')).toContain('avslag');
  });

  it('returns hold_tilbake text', () => {
    expect(getDynamicPlaceholder('hold_tilbake')).toContain('§30.2');
  });
});

// ============================================================================
// buildEventData
// ============================================================================

describe('buildEventData', () => {
  const baseState = makeState({ begrunnelse: 'Test begrunnelse' });
  const baseConfig = makeConfig({ hovedkravBelop: 100000 });
  const baseComputed = {
    har34_1_2_Preklusjon: false,
    prinsipaltResultat: 'godkjent' as const,
    subsidiaertResultat: 'godkjent' as const,
    visSubsidiaertResultat: false,
    totalGodkjent: 100000,
    totalKrevdInklPrekludert: 100000,
    totalGodkjentInklPrekludert: 100000,
  };

  it('builds new response event', () => {
    const result = buildEventData(
      baseState, baseConfig, baseComputed,
      { vederlagKravId: 'v1', isUpdateMode: false },
      'Auto begrunnelse', [],
    );

    expect(result.eventType).toBe('respons_vederlag');
    expect(result.data.vederlag_krav_id).toBe('v1');
    expect(result.data.begrunnelse).toBe('Test begrunnelse');
    expect(result.data.beregnings_resultat).toBe('godkjent');
    expect(result.data.total_godkjent_belop).toBe(100000);
    expect(result.data.total_krevd_belop).toBe(100000);
    expect(result.data.subsidiaer_triggers).toBeUndefined();
  });

  it('builds update response event', () => {
    const result = buildEventData(
      baseState, baseConfig, baseComputed,
      { vederlagKravId: 'v1', lastResponseEventId: 'r1', isUpdateMode: true },
      'Auto begrunnelse', [],
    );

    expect(result.eventType).toBe('respons_vederlag_oppdatert');
    expect(result.data.original_respons_id).toBe('r1');
    expect(result.data.dato_endret).toBeDefined();
    expect(result.data.vederlag_krav_id).toBeUndefined();
  });

  it('includes subsidiary data when visSubsidiaertResultat is true', () => {
    const computed = {
      ...baseComputed,
      visSubsidiaertResultat: true,
      subsidiaertResultat: 'delvis_godkjent' as const,
      totalGodkjentInklPrekludert: 80000,
    };
    const triggers: SubsidiaerTrigger[] = ['preklusjon_rigg'];

    const result = buildEventData(
      baseState, baseConfig, computed,
      { vederlagKravId: 'v1', isUpdateMode: false },
      'Auto begrunnelse', triggers,
    );

    expect(result.data.subsidiaer_triggers).toEqual(['preklusjon_rigg']);
    expect(result.data.subsidiaer_resultat).toBe('delvis_godkjent');
    expect(result.data.subsidiaer_godkjent_belop).toBe(80000);
  });

  it('uses auto-begrunnelse when user begrunnelse is empty', () => {
    const state = makeState({ begrunnelse: '' });
    const result = buildEventData(
      state, baseConfig, baseComputed,
      { vederlagKravId: 'v1', isUpdateMode: false },
      'Auto-generert tekst', [],
    );
    expect(result.data.begrunnelse).toBe('Auto-generert tekst');
  });

  it('calculates correct godkjent beløp per krav', () => {
    const state = makeState({
      hovedkravVurdering: 'delvis',
      hovedkravGodkjentBelop: 60000,
      riggVurdering: 'godkjent',
      produktivitetVurdering: 'avslatt',
    });
    const config = makeConfig({
      hovedkravBelop: 100000,
      harRiggKrav: true,
      riggBelop: 30000,
      harProduktivitetKrav: true,
      produktivitetBelop: 20000,
    });

    const result = buildEventData(
      state, config, baseComputed,
      { vederlagKravId: 'v1', isUpdateMode: false },
      '', [],
    );

    expect(result.data.hovedkrav_godkjent_belop).toBe(60000);
    expect(result.data.rigg_godkjent_belop).toBe(30000);
    expect(result.data.produktivitet_godkjent_belop).toBe(0);
  });

  it('includes §34.1.2 fields only when applicable', () => {
    const computed = { ...baseComputed, har34_1_2_Preklusjon: true };
    const result = buildEventData(
      baseState, baseConfig, computed,
      { vederlagKravId: 'v1', isUpdateMode: false },
      '', [],
    );
    expect(result.data.hovedkrav_varslet_i_tide).toBe(true);

    const result2 = buildEventData(
      baseState, baseConfig, baseComputed,
      { vederlagKravId: 'v1', isUpdateMode: false },
      '', [],
    );
    expect(result2.data.hovedkrav_varslet_i_tide).toBeUndefined();
  });
});

// ============================================================================
// beregnAlt (integration)
// ============================================================================

describe('beregnAlt', () => {
  it('computes all values for simple godkjent case', () => {
    const state = makeState({ hovedkravVurdering: 'godkjent' });
    const config = makeConfig({ hovedkravBelop: 100000 });
    const result = beregnAlt(state, config);

    expect(result.prinsipaltResultat).toBe('godkjent');
    expect(result.totalGodkjent).toBe(100000);
    expect(result.harPrekludertKrav).toBe(false);
    expect(result.visSubsidiaertResultat).toBe(false);
    expect(result.subsidiaerTriggers).toEqual([]);
    expect(result.dynamicPlaceholder).toContain('godkjenning');
  });

  it('computes subsidiary for SVIKT with precluded rigg', () => {
    const state = makeState({
      hovedkravVurdering: 'godkjent',
      riggVarsletITide: false,
      riggVurdering: 'godkjent',
    });
    const config = makeConfig({
      hovedkravBelop: 100000,
      hovedkategori: 'SVIKT',
      harRiggKrav: true,
      riggBelop: 30000,
    });
    const result = beregnAlt(state, config);

    expect(result.har34_1_2_Preklusjon).toBe(true);
    expect(result.riggPrekludert).toBe(true);
    expect(result.harPrekludertKrav).toBe(true);
    expect(result.visSubsidiaertResultat).toBe(true);

    // Principal: rigg excluded → 100k godkjent
    expect(result.totalGodkjent).toBe(100000);
    expect(result.prinsipaltResultat).toBe('delvis_godkjent'); // 100k of 130k

    // Subsidiary: rigg included → 130k godkjent
    expect(result.totalGodkjentInklPrekludert).toBe(130000);
    expect(result.subsidiaertResultat).toBe('godkjent');

    expect(result.subsidiaerTriggers).toContain('preklusjon_rigg');
  });

  it('computes hold_tilbake for REGNINGSARBEID without overslag', () => {
    const state = makeState({ holdTilbake: true });
    const config = makeConfig({ metode: 'REGNINGSARBEID' });
    const result = beregnAlt(state, config);

    expect(result.kanHoldeTilbake).toBe(true);
    expect(result.prinsipaltResultat).toBe('hold_tilbake');
  });

  it('computes maSvarePaJustering for ENHETSPRISER with EP krav', () => {
    const state = makeState();
    const config = makeConfig({ metode: 'ENHETSPRISER', kreverJustertEp: true });
    const result = beregnAlt(state, config);

    expect(result.maSvarePaJustering).toBe(true);
  });

  it('handles full scenario with multiple preklusjoner and metodeendring', () => {
    const state = makeState({
      hovedkravVurdering: 'delvis',
      hovedkravGodkjentBelop: 60000,
      riggVarsletITide: false,
      riggVurdering: 'godkjent',
      produktivitetVarsletITide: false,
      produktivitetVurdering: 'delvis',
      produktivitetGodkjentBelop: 10000,
      akseptererMetode: false,
      oensketMetode: 'REGNINGSARBEID',
    });
    const config = makeConfig({
      hovedkravBelop: 100000,
      hovedkategori: 'ENDRING',
      harRiggKrav: true,
      riggBelop: 30000,
      harProduktivitetKrav: true,
      produktivitetBelop: 20000,
    });
    const result = beregnAlt(state, config);

    // ENDRING → no §34.1.2, but rigg+produktivitet can still be precluded via §34.1.3
    expect(result.har34_1_2_Preklusjon).toBe(false);
    expect(result.hovedkravPrekludert).toBe(false);
    expect(result.riggPrekludert).toBe(true);
    expect(result.produktivitetPrekludert).toBe(true);

    // Principal: only hovedkrav (60k delvis)
    expect(result.totalGodkjent).toBe(60000);
    expect(result.prinsipaltResultat).toBe('delvis_godkjent');

    // Subsidiary includes rigg (30k) + produktivitet (10k)
    expect(result.totalGodkjentInklPrekludert).toBe(100000); // 60k + 30k + 10k

    // Triggers
    expect(result.subsidiaerTriggers).toContain('preklusjon_rigg');
    expect(result.subsidiaerTriggers).toContain('preklusjon_produktivitet');
    expect(result.subsidiaerTriggers).toContain('metode_avslatt');
    expect(result.harMetodeendring).toBe(true);
    expect(result.harPreklusjonsSteg).toBe(true);
  });
});
