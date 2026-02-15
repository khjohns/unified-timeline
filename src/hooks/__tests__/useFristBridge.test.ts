import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useFristBridge } from '../useFristBridge';

const defaultConfig = {
  isOpen: true,
  krevdDager: 10,
  varselType: 'spesifisert' as const,
  grunnlagStatus: 'godkjent' as const,
  fristTilstand: {},
};

describe('useFristBridge', () => {
  it('initializes with TE-favorable defaults', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    expect(result.current.cardProps.fristVarselOk).toBe(true);
    expect(result.current.cardProps.vilkarOppfylt).toBe(true);
    expect(result.current.cardProps.godkjentDager).toBe(10); // krevd dager
  });

  it('computes prinsipalt resultat as godkjent when all positive', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    expect(result.current.computed.prinsipaltResultat).toBe('godkjent');
  });

  it('computes avslatt when prekludert', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    act(() => result.current.cardProps.onFristVarselOkChange(false));
    expect(result.current.computed.erPrekludert).toBe(true);
    expect(result.current.computed.prinsipaltResultat).toBe('avslatt');
  });

  it('computes avslatt when vilkar not met', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    act(() => result.current.cardProps.onVilkarOppfyltChange(false));
    expect(result.current.computed.prinsipaltResultat).toBe('avslatt');
  });

  it('computes delvis_godkjent when godkjent dager < krevd', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    act(() => result.current.cardProps.onGodkjentDagerChange(5));
    expect(result.current.computed.prinsipaltResultat).toBe('delvis_godkjent');
  });

  it('resets state when isOpen changes to true', () => {
    const { result, rerender } = renderHook(
      (props) => useFristBridge(props),
      { initialProps: { ...defaultConfig, isOpen: false } }
    );
    // Modify state while closed (should not matter)
    act(() => result.current.cardProps.onGodkjentDagerChange(3));
    // Re-open: should reset
    rerender({ ...defaultConfig, isOpen: true });
    expect(result.current.cardProps.godkjentDager).toBe(10);
  });

  it('shows fristVarselOk for varsel type', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, varselType: 'varsel',
    }));
    expect(result.current.cardProps.showFristVarselOk).toBe(true);
  });

  it('shows spesifisertKravOk for spesifisert type without prior varsel', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    // spesifisert without harTidligereVarselITide: show both frist_varsel_ok AND spesifisert_krav_ok
    expect(result.current.cardProps.showSpesifisertKravOk).toBe(true);
  });

  it('hides godkjentDager when sendForesporsel is true', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, varselType: 'varsel',
    }));
    act(() => result.current.cardProps.onSendForesporselChange(true));
    expect(result.current.cardProps.showGodkjentDager).toBe(false);
  });

  it('computes subsidiary result ignoring preclusion', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    act(() => result.current.cardProps.onFristVarselOkChange(false));
    // Prekludert → prinsipalt avslått, but subsidiært still godkjent
    expect(result.current.computed.subsidiaertResultat).toBe('godkjent');
  });

  it('shows forsering when dager avslått', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    act(() => result.current.cardProps.onGodkjentDagerChange(0));
    act(() => result.current.cardProps.onVilkarOppfyltChange(false));
    expect(result.current.computed.visForsering).toBe(true);
  });

  it('computes avslatteDager correctly', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig));
    act(() => result.current.cardProps.onGodkjentDagerChange(3));
    expect(result.current.computed.avslatteDager).toBe(7);
  });

  it('marks erGrunnlagSubsidiaer when grunnlag avslått', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, grunnlagStatus: 'avslatt',
    }));
    expect(result.current.computed.erGrunnlagSubsidiaer).toBe(true);
  });

  it('marks erGrunnlagSubsidiaer when grunnlag varslet for sent', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, grunnlagVarsletForSent: true,
    }));
    expect(result.current.computed.erGrunnlagSubsidiaer).toBe(true);
  });

  it('hides all varsel controls for begrunnelse_utsatt', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, varselType: 'begrunnelse_utsatt',
    }));
    expect(result.current.cardProps.showFristVarselOk).toBe(false);
    expect(result.current.cardProps.showSpesifisertKravOk).toBe(false);
    expect(result.current.cardProps.showForesporselSvarOk).toBe(false);
    expect(result.current.cardProps.showSendForesporsel).toBe(false);
  });

  it('shows foresporselSvarOk when svar pa foresporsel', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig,
      varselType: 'spesifisert',
      fristTilstand: { har_bh_foresporsel: true },
    }));
    expect(result.current.cardProps.showForesporselSvarOk).toBe(true);
  });

  it('computes sendForesporsel in computed', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, varselType: 'varsel',
    }));
    act(() => result.current.cardProps.onSendForesporselChange(true));
    expect(result.current.computed.sendForesporsel).toBe(true);
  });

  it('computes subsidiaerTriggers', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, grunnlagStatus: 'avslatt',
    }));
    act(() => result.current.cardProps.onFristVarselOkChange(false));
    const triggers = result.current.computed.subsidiaerTriggers;
    expect(triggers).toContain('grunnlag_avslatt');
    expect(triggers).toContain('preklusjon_varsel');
  });

  it('pre-fills from lastResponseEvent in update mode', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig,
      fristTilstand: {
        frist_varsel_ok: false,
        vilkar_oppfylt: true,
      },
      lastResponseEvent: {
        event_id: 'evt-1',
        resultat: 'delvis_godkjent',
        godkjent_dager: 7,
      },
    }));
    expect(result.current.cardProps.fristVarselOk).toBe(false);
    expect(result.current.cardProps.vilkarOppfylt).toBe(true);
    expect(result.current.cardProps.godkjentDager).toBe(7);
  });
});
