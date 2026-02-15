import { describe, it, expect } from 'vitest';
import {
  getDefaults,
  beregnVisibility,
  beregnPreklusjon,
  beregnReduksjon,
  beregnPrinsipaltResultat,
  beregnSubsidiaertResultat,
  beregnSubsidiaerTriggers,
  getDynamicPlaceholder,
  buildEventData,
  beregnAlt,
  type FristFormState,
  type FristDomainConfig,
} from '../fristDomain';

// ============================================================================
// HELPERS
// ============================================================================

function makeState(overrides: Partial<FristFormState> = {}): FristFormState {
  return {
    fristVarselOk: true,
    spesifisertKravOk: true,
    foresporselSvarOk: true,
    vilkarOppfylt: true,
    sendForesporsel: false,
    godkjentDager: 10,
    begrunnelse: '',
    begrunnelseValidationError: undefined,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<FristDomainConfig> = {}): FristDomainConfig {
  return {
    varselType: 'spesifisert',
    krevdDager: 10,
    erSvarPaForesporsel: false,
    harTidligereVarselITide: false,
    erGrunnlagSubsidiaer: false,
    erHelFristSubsidiaerPgaGrunnlag: false,
    ...overrides,
  };
}

// ============================================================================
// getDefaults
// ============================================================================

describe('getDefaults', () => {
  it('returns TE-favorable defaults for create mode', () => {
    const defaults = getDefaults({ krevdDager: 10, isUpdateMode: false });
    expect(defaults.fristVarselOk).toBe(true);
    expect(defaults.spesifisertKravOk).toBe(true);
    expect(defaults.vilkarOppfylt).toBe(true);
    expect(defaults.godkjentDager).toBe(10);
    expect(defaults.sendForesporsel).toBe(false);
    expect(defaults.begrunnelse).toBe('');
  });

  it('pre-fills from lastResponseEvent in update mode', () => {
    const defaults = getDefaults({
      krevdDager: 10,
      isUpdateMode: true,
      lastResponseEvent: { godkjent_dager: 7 },
      fristTilstand: { frist_varsel_ok: false, vilkar_oppfylt: true },
    });
    expect(defaults.fristVarselOk).toBe(false);
    expect(defaults.vilkarOppfylt).toBe(true);
    expect(defaults.godkjentDager).toBe(7);
  });

  it('falls back to krevdDager when godkjent_dager is missing in update mode', () => {
    const defaults = getDefaults({
      krevdDager: 15,
      isUpdateMode: true,
      lastResponseEvent: {},
      fristTilstand: {},
    });
    expect(defaults.godkjentDager).toBe(15);
  });
});

// ============================================================================
// beregnVisibility
// ============================================================================

describe('beregnVisibility', () => {
  it('shows fristVarselOk for varsel type', () => {
    const vis = beregnVisibility(makeState(), makeConfig({ varselType: 'varsel' }));
    expect(vis.showFristVarselOk).toBe(true);
  });

  it('shows fristVarselOk for spesifisert without prior varsel', () => {
    const vis = beregnVisibility(makeState(), makeConfig({ varselType: 'spesifisert', harTidligereVarselITide: false }));
    expect(vis.showFristVarselOk).toBe(true);
  });

  it('hides fristVarselOk for spesifisert with prior varsel i tide', () => {
    const vis = beregnVisibility(makeState(), makeConfig({ varselType: 'spesifisert', harTidligereVarselITide: true }));
    expect(vis.showFristVarselOk).toBe(false);
  });

  it('shows spesifisertKravOk for spesifisert type', () => {
    const vis = beregnVisibility(makeState(), makeConfig({ varselType: 'spesifisert' }));
    expect(vis.showSpesifisertKravOk).toBe(true);
  });

  it('hides spesifisertKravOk for varsel type', () => {
    const vis = beregnVisibility(makeState(), makeConfig({ varselType: 'varsel' }));
    expect(vis.showSpesifisertKravOk).toBe(false);
  });

  it('hides spesifisertKravOk when svar pa foresporsel', () => {
    const vis = beregnVisibility(makeState(), makeConfig({ varselType: 'spesifisert', erSvarPaForesporsel: true }));
    expect(vis.showSpesifisertKravOk).toBe(false);
  });

  it('shows foresporselSvarOk when svar pa foresporsel', () => {
    const vis = beregnVisibility(makeState(), makeConfig({ erSvarPaForesporsel: true }));
    expect(vis.showForesporselSvarOk).toBe(true);
  });

  it('shows sendForesporsel when varsel type and fristVarselOk is true', () => {
    const vis = beregnVisibility(makeState({ fristVarselOk: true }), makeConfig({ varselType: 'varsel' }));
    expect(vis.showSendForesporsel).toBe(true);
  });

  it('hides sendForesporsel when fristVarselOk is false', () => {
    const vis = beregnVisibility(makeState({ fristVarselOk: false }), makeConfig({ varselType: 'varsel' }));
    expect(vis.showSendForesporsel).toBe(false);
  });

  it('hides all controls for begrunnelse_utsatt', () => {
    const vis = beregnVisibility(makeState(), makeConfig({ varselType: 'begrunnelse_utsatt' }));
    expect(vis.showFristVarselOk).toBe(false);
    expect(vis.showSpesifisertKravOk).toBe(false);
    expect(vis.showForesporselSvarOk).toBe(false);
    expect(vis.showSendForesporsel).toBe(false);
  });
});

// ============================================================================
// beregnPreklusjon
// ============================================================================

describe('beregnPreklusjon', () => {
  it('returns true for varsel when fristVarselOk is false', () => {
    expect(beregnPreklusjon(
      makeState({ fristVarselOk: false }),
      makeConfig({ varselType: 'varsel' }),
    )).toBe(true);
  });

  it('returns false for varsel when fristVarselOk is true', () => {
    expect(beregnPreklusjon(
      makeState({ fristVarselOk: true }),
      makeConfig({ varselType: 'varsel' }),
    )).toBe(false);
  });

  it('returns true for spesifisert without prior varsel when fristVarselOk is false', () => {
    expect(beregnPreklusjon(
      makeState({ fristVarselOk: false }),
      makeConfig({ varselType: 'spesifisert', harTidligereVarselITide: false }),
    )).toBe(true);
  });

  it('returns false for spesifisert with prior varsel i tide', () => {
    expect(beregnPreklusjon(
      makeState({ fristVarselOk: false }),
      makeConfig({ varselType: 'spesifisert', harTidligereVarselITide: true }),
    )).toBe(false);
  });

  it('returns true when foresporsel svar er for sent', () => {
    expect(beregnPreklusjon(
      makeState({ foresporselSvarOk: false }),
      makeConfig({ erSvarPaForesporsel: true }),
    )).toBe(true);
  });

  it('returns false for begrunnelse_utsatt', () => {
    expect(beregnPreklusjon(
      makeState({ fristVarselOk: false }),
      makeConfig({ varselType: 'begrunnelse_utsatt' }),
    )).toBe(false);
  });
});

// ============================================================================
// beregnReduksjon
// ============================================================================

describe('beregnReduksjon', () => {
  it('returns true when spesifisert with prior varsel and spesifisertKravOk is false', () => {
    expect(beregnReduksjon(
      makeState({ spesifisertKravOk: false }),
      makeConfig({ varselType: 'spesifisert', harTidligereVarselITide: true }),
    )).toBe(true);
  });

  it('returns true when spesifisert without prior varsel, fristVarselOk true, spesifisertKravOk false', () => {
    expect(beregnReduksjon(
      makeState({ fristVarselOk: true, spesifisertKravOk: false }),
      makeConfig({ varselType: 'spesifisert', harTidligereVarselITide: false }),
    )).toBe(true);
  });

  it('returns false when fristVarselOk is false (prekludert, not reduced)', () => {
    expect(beregnReduksjon(
      makeState({ fristVarselOk: false, spesifisertKravOk: false }),
      makeConfig({ varselType: 'spesifisert', harTidligereVarselITide: false }),
    )).toBe(false);
  });

  it('returns false for svar pa foresporsel', () => {
    expect(beregnReduksjon(
      makeState({ spesifisertKravOk: false }),
      makeConfig({ varselType: 'spesifisert', erSvarPaForesporsel: true }),
    )).toBe(false);
  });

  it('returns false for varsel type', () => {
    expect(beregnReduksjon(
      makeState(),
      makeConfig({ varselType: 'varsel' }),
    )).toBe(false);
  });
});

// ============================================================================
// beregnPrinsipaltResultat
// ============================================================================

describe('beregnPrinsipaltResultat', () => {
  it('returns godkjent when all positive', () => {
    expect(beregnPrinsipaltResultat({
      erPrekludert: false, sendForesporsel: false, harHindring: true,
      krevdDager: 10, godkjentDager: 10,
    })).toBe('godkjent');
  });

  it('returns avslatt when prekludert', () => {
    expect(beregnPrinsipaltResultat({
      erPrekludert: true, sendForesporsel: false, harHindring: true,
      krevdDager: 10, godkjentDager: 10,
    })).toBe('avslatt');
  });

  it('returns avslatt when sendForesporsel', () => {
    expect(beregnPrinsipaltResultat({
      erPrekludert: false, sendForesporsel: true, harHindring: true,
      krevdDager: 10, godkjentDager: 10,
    })).toBe('avslatt');
  });

  it('returns avslatt when no hindring', () => {
    expect(beregnPrinsipaltResultat({
      erPrekludert: false, sendForesporsel: false, harHindring: false,
      krevdDager: 10, godkjentDager: 10,
    })).toBe('avslatt');
  });

  it('returns delvis_godkjent when godkjent < krevd', () => {
    expect(beregnPrinsipaltResultat({
      erPrekludert: false, sendForesporsel: false, harHindring: true,
      krevdDager: 10, godkjentDager: 5,
    })).toBe('delvis_godkjent');
  });

  it('returns godkjent when krevdDager is 0', () => {
    expect(beregnPrinsipaltResultat({
      erPrekludert: false, sendForesporsel: false, harHindring: true,
      krevdDager: 0, godkjentDager: 0,
    })).toBe('godkjent');
  });

  it('returns godkjent when godkjent >= 99% of krevd', () => {
    expect(beregnPrinsipaltResultat({
      erPrekludert: false, sendForesporsel: false, harHindring: true,
      krevdDager: 100, godkjentDager: 99,
    })).toBe('godkjent');
  });
});

// ============================================================================
// beregnSubsidiaertResultat
// ============================================================================

describe('beregnSubsidiaertResultat', () => {
  it('returns godkjent when hindring and full days', () => {
    expect(beregnSubsidiaertResultat({
      harHindring: true, krevdDager: 10, godkjentDager: 10,
    })).toBe('godkjent');
  });

  it('returns avslatt when no hindring (ignores preclusion)', () => {
    expect(beregnSubsidiaertResultat({
      harHindring: false, krevdDager: 10, godkjentDager: 10,
    })).toBe('avslatt');
  });

  it('returns delvis_godkjent when partial days', () => {
    expect(beregnSubsidiaertResultat({
      harHindring: true, krevdDager: 10, godkjentDager: 5,
    })).toBe('delvis_godkjent');
  });

  it('returns godkjent when krevdDager is 0', () => {
    expect(beregnSubsidiaertResultat({
      harHindring: true, krevdDager: 0, godkjentDager: 0,
    })).toBe('godkjent');
  });
});

// ============================================================================
// beregnSubsidiaerTriggers
// ============================================================================

describe('beregnSubsidiaerTriggers', () => {
  it('returns empty when nothing triggers', () => {
    expect(beregnSubsidiaerTriggers({
      erGrunnlagSubsidiaer: false, erPrekludert: false, harHindring: true,
    })).toEqual([]);
  });

  it('includes grunnlag_avslatt when erGrunnlagSubsidiaer', () => {
    const triggers = beregnSubsidiaerTriggers({
      erGrunnlagSubsidiaer: true, erPrekludert: false, harHindring: true,
    });
    expect(triggers).toContain('grunnlag_avslatt');
  });

  it('includes preklusjon_varsel when prekludert', () => {
    const triggers = beregnSubsidiaerTriggers({
      erGrunnlagSubsidiaer: false, erPrekludert: true, harHindring: true,
    });
    expect(triggers).toContain('preklusjon_varsel');
  });

  it('includes ingen_hindring when vilkar not met', () => {
    const triggers = beregnSubsidiaerTriggers({
      erGrunnlagSubsidiaer: false, erPrekludert: false, harHindring: false,
    });
    expect(triggers).toContain('ingen_hindring');
  });

  it('includes all triggers when all conditions met', () => {
    const triggers = beregnSubsidiaerTriggers({
      erGrunnlagSubsidiaer: true, erPrekludert: true, harHindring: false,
    });
    expect(triggers).toHaveLength(3);
    expect(triggers).toContain('grunnlag_avslatt');
    expect(triggers).toContain('preklusjon_varsel');
    expect(triggers).toContain('ingen_hindring');
  });
});

// ============================================================================
// getDynamicPlaceholder
// ============================================================================

describe('getDynamicPlaceholder', () => {
  it('returns default when no resultat', () => {
    expect(getDynamicPlaceholder(undefined)).toContain('Gjør valgene');
  });

  it('returns godkjent placeholder', () => {
    expect(getDynamicPlaceholder('godkjent')).toContain('godkjenning');
  });

  it('returns delvis_godkjent placeholder', () => {
    expect(getDynamicPlaceholder('delvis_godkjent')).toContain('deler');
  });

  it('returns avslatt placeholder', () => {
    expect(getDynamicPlaceholder('avslatt')).toContain('avslag');
  });
});

// ============================================================================
// buildEventData
// ============================================================================

describe('buildEventData', () => {
  it('includes subsidiaer_triggers when present', () => {
    const state = makeState({ begrunnelse: 'Test begrunnelse' });
    const config = makeConfig();
    const computed = {
      prinsipaltResultat: 'avslatt' as const,
      subsidiaertResultat: 'godkjent' as const,
      visSubsidiaertResultat: true,
      subsidiaerTriggers: ['preklusjon_varsel' as const],
    };
    const data = buildEventData(state, config, computed, 'frist-1', 'auto-tekst');
    expect(data.subsidiaer_triggers).toEqual(['preklusjon_varsel']);
    expect(data.subsidiaer_resultat).toBe('godkjent');
    expect(data.subsidiaer_begrunnelse).toBe('Test begrunnelse');
  });

  it('omits subsidiaer fields when prinsipalt is not avslatt', () => {
    const state = makeState({ begrunnelse: 'Test begrunnelse' });
    const config = makeConfig();
    const computed = {
      prinsipaltResultat: 'godkjent' as const,
      subsidiaertResultat: 'godkjent' as const,
      visSubsidiaertResultat: false,
      subsidiaerTriggers: [],
    };
    const data = buildEventData(state, config, computed, 'frist-1', 'auto-tekst');
    expect(data.subsidiaer_triggers).toBeUndefined();
    expect(data.subsidiaer_resultat).toBeUndefined();
  });

  it('sets godkjent_dager to 0 when avslatt', () => {
    const state = makeState({ godkjentDager: 10, begrunnelse: 'Test' });
    const config = makeConfig();
    const computed = {
      prinsipaltResultat: 'avslatt' as const,
      subsidiaertResultat: 'godkjent' as const,
      visSubsidiaertResultat: true,
      subsidiaerTriggers: ['preklusjon_varsel' as const],
    };
    const data = buildEventData(state, config, computed, 'frist-1', '');
    expect(data.godkjent_dager).toBe(0);
  });

  it('uses autoBegrunnelse as fallback when begrunnelse is empty', () => {
    const state = makeState({ begrunnelse: '' });
    const config = makeConfig();
    const computed = {
      prinsipaltResultat: 'godkjent' as const,
      subsidiaertResultat: 'godkjent' as const,
      visSubsidiaertResultat: false,
      subsidiaerTriggers: [],
    };
    const data = buildEventData(state, config, computed, 'frist-1', 'auto-tekst');
    expect(data.begrunnelse).toBe('auto-tekst');
    expect(data.auto_begrunnelse).toBe('auto-tekst');
  });

  it('includes core fields', () => {
    const state = makeState({ begrunnelse: 'Begrunnelse her' });
    const config = makeConfig({ krevdDager: 15 });
    const computed = {
      prinsipaltResultat: 'godkjent' as const,
      subsidiaertResultat: 'godkjent' as const,
      visSubsidiaertResultat: false,
      subsidiaerTriggers: [],
    };
    const data = buildEventData(state, config, computed, 'frist-42', '');
    expect(data.frist_krav_id).toBe('frist-42');
    expect(data.krevd_dager).toBe(15);
    expect(data.beregnings_resultat).toBe('godkjent');
  });
});

// ============================================================================
// beregnAlt (convenience)
// ============================================================================

describe('beregnAlt', () => {
  it('computes all values consistently', () => {
    const state = makeState();
    const config = makeConfig();
    const computed = beregnAlt(state, config);

    expect(computed.erPrekludert).toBe(false);
    expect(computed.prinsipaltResultat).toBe('godkjent');
    expect(computed.visSubsidiaertResultat).toBe(false);
    expect(computed.visibility.showSpesifisertKravOk).toBe(true);
  });

  it('reflects preclusion in all derived values', () => {
    const state = makeState({ fristVarselOk: false });
    const config = makeConfig({ varselType: 'varsel' });
    const computed = beregnAlt(state, config);

    expect(computed.erPrekludert).toBe(true);
    expect(computed.prinsipaltResultat).toBe('avslatt');
    expect(computed.visSubsidiaertResultat).toBe(true);
    expect(computed.subsidiaertResultat).toBe('godkjent');
    expect(computed.subsidiaerTriggers).toContain('preklusjon_varsel');
    expect(computed.port2ErSubsidiaer).toBe(true);
    expect(computed.port3ErSubsidiaer).toBe(true);
  });
});
