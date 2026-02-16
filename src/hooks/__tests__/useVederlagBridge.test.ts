import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/primitives/Toast';
import { useVederlagBridge } from '../useVederlagBridge';

const defaultConfig = {
  isOpen: true,
  sakId: 'test-1',
  vederlagKravId: 'vederlag-test-1',
  teMetode: 'ENHETSPRISER' as const,
  hovedkravBelop: 100000,
  riggBelop: undefined,
  produktivitetBelop: undefined,
  harRiggKrav: false,
  harProduktivitetKrav: false,
  kreverJustertEp: false,
  grunnlagStatus: 'godkjent' as const,
  grunnlagVarsletForSent: false,
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

describe('useVederlagBridge', () => {
  it('initializes with TE-favorable defaults', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig), { wrapper: createWrapper() });
    expect(result.current.cardProps.bhMetode).toBe('ENHETSPRISER');
    expect(result.current.cardProps.harMetodeendring).toBe(false);
    expect(result.current.cardProps.holdTilbake).toBe(false);
    expect(result.current.cardProps.hovedkrav.godkjentBelop).toBe(100000);
    expect(result.current.cardProps.hovedkrav.vurdering).toBe('godkjent');
  });

  it('computes prinsipalt resultat as godkjent when full amount accepted', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig), { wrapper: createWrapper() });
    expect(result.current.cardProps.prinsipaltResultat).toBe('godkjent');
  });

  it('computes delvis_godkjent when partial amount', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig), { wrapper: createWrapper() });
    act(() => result.current.cardProps.hovedkrav.onGodkjentBelopChange(50000));
    expect(result.current.cardProps.prinsipaltResultat).toBe('delvis_godkjent');
  });

  it('computes avslatt when zero amount', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig), { wrapper: createWrapper() });
    act(() => result.current.cardProps.hovedkrav.onGodkjentBelopChange(0));
    expect(result.current.cardProps.prinsipaltResultat).toBe('avslatt');
  });

  it('reflects BH metode change', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig), { wrapper: createWrapper() });
    act(() => result.current.cardProps.onBhMetodeChange('REGNINGSARBEID'));
    expect(result.current.cardProps.bhMetode).toBe('REGNINGSARBEID');
    expect(result.current.cardProps.harMetodeendring).toBe(true);
  });

  it('handles rigg krav linje when present', () => {
    const { result } = renderHook(() => useVederlagBridge({
      ...defaultConfig,
      harRiggKrav: true,
      riggBelop: 20000,
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.rigg).toBeDefined();
    expect(result.current.cardProps.rigg!.krevdBelop).toBe(20000);
    expect(result.current.cardProps.rigg!.godkjentBelop).toBe(20000);
  });

  it('handles produktivitet krav linje when present', () => {
    const { result } = renderHook(() => useVederlagBridge({
      ...defaultConfig,
      harProduktivitetKrav: true,
      produktivitetBelop: 15000,
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.produktivitet).toBeDefined();
    expect(result.current.cardProps.produktivitet!.krevdBelop).toBe(15000);
  });

  it('shows EP-justering controls when kreverJustertEp', () => {
    const { result } = renderHook(() => useVederlagBridge({
      ...defaultConfig,
      kreverJustertEp: true,
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.showEpJustering).toBe(true);
  });

  it('hides EP-justering for non-ENHETSPRISER', () => {
    const { result } = renderHook(() => useVederlagBridge({
      ...defaultConfig,
      teMetode: 'REGNINGSARBEID',
      kreverJustertEp: true,
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.showEpJustering).toBe(false);
  });

  it('shows tilbakeholdelse for REGNINGSARBEID without overslag', () => {
    const { result } = renderHook(() => useVederlagBridge({
      ...defaultConfig,
      teMetode: 'REGNINGSARBEID',
      hovedkravBelop: 50000,
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.showTilbakeholdelse).toBe(true);
  });

  it('marks erSubsidiaer when grunnlag avslatt', () => {
    const { result } = renderHook(() => useVederlagBridge({
      ...defaultConfig,
      grunnlagStatus: 'avslatt',
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.erSubsidiaer).toBe(true);
  });

  it('marks erSubsidiaer when grunnlag varslet for sent (ENDRING)', () => {
    const { result } = renderHook(() => useVederlagBridge({
      ...defaultConfig,
      hovedkategori: 'ENDRING',
      grunnlagVarsletForSent: true,
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.erSubsidiaer).toBe(true);
  });

  it('resets state when isOpen changes to true', () => {
    const { result, rerender } = renderHook(
      (props) => useVederlagBridge(props),
      { initialProps: { ...defaultConfig, isOpen: false }, wrapper: createWrapper() }
    );
    act(() => result.current.cardProps.hovedkrav.onGodkjentBelopChange(30000));
    rerender({ ...defaultConfig, isOpen: true });
    expect(result.current.cardProps.hovedkrav.godkjentBelop).toBe(100000);
  });

  it('provides auto-begrunnelse in editorProps', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig), { wrapper: createWrapper() });
    expect(result.current.editorProps.autoBegrunnelse).toBeDefined();
  });

  it('computes totalKrevd correctly with saerskilt krav', () => {
    const { result } = renderHook(() => useVederlagBridge({
      ...defaultConfig,
      hovedkravBelop: 100000,
      harRiggKrav: true,
      riggBelop: 20000,
      harProduktivitetKrav: true,
      produktivitetBelop: 10000,
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.totalKrevd).toBe(130000);
  });

  it('computes godkjenningsgrad prosent correctly', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig), { wrapper: createWrapper() });
    act(() => result.current.cardProps.hovedkrav.onGodkjentBelopChange(75000));
    expect(result.current.cardProps.godkjenningsgradProsent).toBe(75);
  });

  it('pre-fills from lastResponseEvent in update mode', () => {
    const { result } = renderHook(() => useVederlagBridge({
      ...defaultConfig,
      lastResponseEvent: {
        eventId: 'evt-1',
        akseptererMetode: false,
        oensketMetode: 'REGNINGSARBEID' as const,
        godkjentBelop: 70000,
      },
    }), { wrapper: createWrapper() });
    expect(result.current.cardProps.bhMetode).toBe('REGNINGSARBEID');
    expect(result.current.cardProps.harMetodeendring).toBe(true);
  });

  it('provides onClose and onSubmit in cardProps', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig), { wrapper: createWrapper() });
    expect(typeof result.current.cardProps.onClose).toBe('function');
    expect(typeof result.current.cardProps.onSubmit).toBe('function');
  });

  it('canSubmit is false with short begrunnelse', () => {
    const { result } = renderHook(() => useVederlagBridge(defaultConfig), { wrapper: createWrapper() });
    act(() => result.current.editorProps.onBegrunnelseChange('kort'));
    expect(result.current.cardProps.canSubmit).toBe(false);
  });
});
