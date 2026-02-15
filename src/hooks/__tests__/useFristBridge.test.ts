import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/primitives/Toast';
import { useFristBridge } from '../useFristBridge';

const defaultConfig = {
  isOpen: true,
  sakId: 'test-1',
  fristKravId: 'frist-test-1',
  krevdDager: 10,
  varselType: 'spesifisert' as const,
  grunnlagStatus: 'godkjent' as const,
  fristTilstand: {},
  onSuccess: vi.fn(),
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(ToastProvider, null, children)
    );
  };
}

describe('useFristBridge', () => {
  it('initializes with TE-favorable defaults', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig), { wrapper: createWrapper() });
    expect(result.current.cardProps.fristVarselOk).toBe(true);
    expect(result.current.cardProps.vilkarOppfylt).toBe(true);
    expect(result.current.cardProps.godkjentDager).toBe(10); // krevd dager
  });

  it('computes prinsipalt resultat as godkjent when all positive', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig), { wrapper: createWrapper() });
    expect(result.current.cardProps.beregningsResultat).toBe('godkjent');
  });

  it('computes avslatt when prekludert', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig), { wrapper: createWrapper() });
    act(() => result.current.cardProps.onFristVarselOkChange(false));
    expect(result.current.cardProps.erPrekludert).toBe(true);
    expect(result.current.cardProps.beregningsResultat).toBe('avslatt');
  });

  it('computes avslatt when vilkar not met', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig), { wrapper: createWrapper() });
    act(() => result.current.cardProps.onVilkarOppfyltChange(false));
    expect(result.current.cardProps.beregningsResultat).toBe('avslatt');
  });

  it('computes delvis_godkjent when godkjent dager < krevd', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig), { wrapper: createWrapper() });
    act(() => result.current.cardProps.onGodkjentDagerChange(5));
    expect(result.current.cardProps.beregningsResultat).toBe('delvis_godkjent');
  });

  it('resets state when isOpen changes to true', () => {
    const { result, rerender } = renderHook(
      (props) => useFristBridge(props),
      { initialProps: { ...defaultConfig, isOpen: false }, wrapper: createWrapper() }
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
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.showFristVarselOk).toBe(true);
  });

  it('shows spesifisertKravOk for spesifisert type without prior varsel', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig), { wrapper: createWrapper() });
    // spesifisert without harTidligereVarselITide: show both frist_varsel_ok AND spesifisert_krav_ok
    expect(result.current.cardProps.showSpesifisertKravOk).toBe(true);
  });

  it('hides godkjentDager when sendForesporsel is true', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, varselType: 'varsel',
    }), { wrapper: createWrapper() });
    act(() => result.current.cardProps.onSendForesporselChange(true));
    expect(result.current.cardProps.showGodkjentDager).toBe(false);
  });

  it('computes subsidiary result ignoring preclusion', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig), { wrapper: createWrapper() });
    act(() => result.current.cardProps.onFristVarselOkChange(false));
    // Prekludert → prinsipalt avslått, but subsidiært still godkjent
    expect(result.current.cardProps.subsidiaertResultat).toBe('godkjent');
  });

  it('marks erGrunnlagSubsidiaer when grunnlag avslått', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, grunnlagStatus: 'avslatt',
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.erGrunnlagSubsidiaer).toBe(true);
  });

  it('marks erGrunnlagSubsidiaer when grunnlag varslet for sent', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, grunnlagVarsletForSent: true,
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.erGrunnlagSubsidiaer).toBe(true);
  });

  it('hides all varsel controls for begrunnelse_utsatt', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, varselType: 'begrunnelse_utsatt',
    }), { wrapper: createWrapper() });
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
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.showForesporselSvarOk).toBe(true);
  });

  it('computes sendForesporsel in cardProps', () => {
    const { result } = renderHook(() => useFristBridge({
      ...defaultConfig, varselType: 'varsel',
    }), { wrapper: createWrapper() });
    act(() => result.current.cardProps.onSendForesporselChange(true));
    expect(result.current.cardProps.sendForesporsel).toBe(true);
  });

  it('provides auto-begrunnelse in editorProps', () => {
    const { result } = renderHook(() => useFristBridge(defaultConfig), { wrapper: createWrapper() });
    expect(result.current.editorProps.autoBegrunnelse).toBeDefined();
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
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.fristVarselOk).toBe(false);
    expect(result.current.cardProps.vilkarOppfylt).toBe(true);
    expect(result.current.cardProps.godkjentDager).toBe(7);
  });
});
