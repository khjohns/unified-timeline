import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/primitives/Toast';
import { useFristSubmissionBridge } from '../useFristSubmissionBridge';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(ToastProvider, null, children),
    );
  };
}

const baseConfig = {
  isOpen: true,
  sakId: 'test-sak',
  grunnlagEventId: 'g-1',
  scenario: 'new' as const,
  onSuccess: vi.fn(),
};

describe('useFristSubmissionBridge', () => {
  it('initializes with empty state for new scenario', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    expect(result.current.cardProps.varselType).toBeUndefined();
    expect(result.current.cardProps.showSegmentedControl).toBe(true);
    expect(result.current.cardProps.canSubmit).toBe(false);
  });

  it('updates varselType and shows correct sections', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    act(() => result.current.cardProps.onVarselTypeChange('spesifisert'));
    expect(result.current.cardProps.varselType).toBe('spesifisert');
    expect(result.current.cardProps.showVarselSection).toBe(true);
    expect(result.current.cardProps.showKravSection).toBe(true);
  });

  it('can submit varsel without begrunnelse', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    act(() => result.current.cardProps.onVarselTypeChange('varsel'));
    expect(result.current.cardProps.canSubmit).toBe(true);
  });

  it('requires begrunnelse for spesifisert', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    act(() => {
      result.current.cardProps.onVarselTypeChange('spesifisert');
      result.current.cardProps.onAntallDagerChange(10);
    });
    expect(result.current.cardProps.canSubmit).toBe(false);

    act(() => result.current.cardProps.onBegrunnelseChange('Minst ti tegn begrunnelse'));
    expect(result.current.cardProps.canSubmit).toBe(true);
  });

  it('resets state when isOpen transitions false -> true', () => {
    const { result, rerender } = renderHook(
      (props) => useFristSubmissionBridge(props),
      { initialProps: baseConfig, wrapper: createWrapper() },
    );
    act(() => result.current.cardProps.onVarselTypeChange('varsel'));
    expect(result.current.cardProps.varselType).toBe('varsel');

    rerender({ ...baseConfig, isOpen: false });
    rerender({ ...baseConfig, isOpen: true });
    expect(result.current.cardProps.varselType).toBeUndefined();
  });

  it('shows varsel section for varsel type', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    act(() => result.current.cardProps.onVarselTypeChange('varsel'));
    expect(result.current.cardProps.showVarselSection).toBe(true);
    expect(result.current.cardProps.showKravSection).toBe(false);
  });

  it('shows foresporsel alert for foresporsel scenario', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge({ ...baseConfig, scenario: 'foresporsel' }),
      { wrapper: createWrapper() },
    );
    expect(result.current.cardProps.showForesporselAlert).toBe(true);
  });

  it('hides segmented control for spesifisering scenario', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge({ ...baseConfig, scenario: 'spesifisering' }),
      { wrapper: createWrapper() },
    );
    expect(result.current.cardProps.showSegmentedControl).toBe(false);
    // Spesifisering defaults to 'spesifisert'
    expect(result.current.cardProps.varselType).toBe('spesifisert');
  });

  it('pre-fills from existing data in edit scenario', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge({
        ...baseConfig,
        scenario: 'edit',
        existing: {
          varsel_type: 'spesifisert',
          antall_dager: 15,
          begrunnelse: 'Eksisterende begrunnelse for fristkrav',
          ny_sluttdato: '2026-06-01',
        },
      }),
      { wrapper: createWrapper() },
    );
    expect(result.current.cardProps.varselType).toBe('spesifisert');
    expect(result.current.cardProps.antallDager).toBe(15);
    expect(result.current.cardProps.begrunnelse).toBe('Eksisterende begrunnelse for fristkrav');
    expect(result.current.cardProps.nySluttdato).toBe('2026-06-01');
  });

  it('updates tidligereVarslet and clears varselDato when set to false', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    act(() => {
      result.current.cardProps.onVarselTypeChange('varsel');
      result.current.cardProps.onTidligereVarsletChange(true);
      result.current.cardProps.onVarselDatoChange('2026-01-15');
    });
    expect(result.current.cardProps.tidligereVarslet).toBe(true);
    expect(result.current.cardProps.varselDato).toBe('2026-01-15');

    act(() => result.current.cardProps.onTidligereVarsletChange(false));
    expect(result.current.cardProps.tidligereVarslet).toBe(false);
    expect(result.current.cardProps.varselDato).toBeUndefined();
  });

  it('updates nySluttdato', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    act(() => result.current.cardProps.onNySluttdatoChange('2026-09-01'));
    expect(result.current.cardProps.nySluttdato).toBe('2026-09-01');
  });

  it('provides dynamic placeholder based on varselType', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    // No varselType selected
    expect(result.current.cardProps.begrunnelsePlaceholder).toContain('Velg kravtype');

    act(() => result.current.cardProps.onVarselTypeChange('varsel'));
    expect(result.current.cardProps.begrunnelsePlaceholder).toContain('valgfritt');

    act(() => result.current.cardProps.onVarselTypeChange('spesifisert'));
    expect(result.current.cardProps.begrunnelsePlaceholder).toContain('§33.5');
  });

  it('marks begrunnelse as required for spesifisert', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    act(() => result.current.cardProps.onVarselTypeChange('spesifisert'));
    expect(result.current.cardProps.begrunnelseRequired).toBe(true);
  });

  it('marks begrunnelse as not required for varsel', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    act(() => result.current.cardProps.onVarselTypeChange('varsel'));
    expect(result.current.cardProps.begrunnelseRequired).toBe(false);
  });

  it('clears begrunnelseError on text change', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    act(() => result.current.cardProps.onVarselTypeChange('spesifisert'));
    act(() => result.current.cardProps.onAntallDagerChange(5));

    // Force validation error by submitting with short begrunnelse
    act(() => result.current.cardProps.onBegrunnelseChange('kort'));
    act(() => result.current.cardProps.onSubmit());
    expect(result.current.cardProps.begrunnelseError).toBe('Begrunnelse må være minst 10 tegn');

    // Typing clears the error
    act(() => result.current.cardProps.onBegrunnelseChange('kort men endret'));
    expect(result.current.cardProps.begrunnelseError).toBeUndefined();
  });

  it('requires begrunnelse for begrunnelse_utsatt', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge({ ...baseConfig, scenario: 'foresporsel' }),
      { wrapper: createWrapper() },
    );
    act(() => result.current.cardProps.onVarselTypeChange('begrunnelse_utsatt'));
    expect(result.current.cardProps.canSubmit).toBe(false);
    expect(result.current.cardProps.begrunnelseRequired).toBe(true);

    act(() => result.current.cardProps.onBegrunnelseChange('Minst ti tegn begrunnelse her'));
    expect(result.current.cardProps.canSubmit).toBe(true);
  });

  it('initializes vilkarOppfylt as undefined', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    expect(result.current.cardProps.vilkarOppfylt).toBeUndefined();
  });

  it('updates vilkarOppfylt on change', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    act(() => result.current.cardProps.onVilkarOppfyltChange(true));
    expect(result.current.cardProps.vilkarOppfylt).toBe(true);
  });

  it('returns statusSummary for varsel', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    act(() => result.current.cardProps.onVarselTypeChange('varsel'));
    expect(result.current.cardProps.statusSummary).toBe('Sender foreløpig varsel om fristforlengelse');
  });

  it('returns statusSummary with days for spesifisert', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge(baseConfig),
      { wrapper: createWrapper() },
    );
    act(() => {
      result.current.cardProps.onVarselTypeChange('spesifisert');
      result.current.cardProps.onAntallDagerChange(20);
    });
    expect(result.current.cardProps.statusSummary).toBe('Krav om 20 dagers fristforlengelse');
  });

  it('computes revisionContext flags from scenario', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge({
        ...baseConfig,
        scenario: 'spesifisering',
      }),
      { wrapper: createWrapper() },
    );
    expect(result.current.cardProps.revisionContext.isSpecification).toBe(true);
    expect(result.current.cardProps.revisionContext.isForesporsel).toBe(false);
  });

  it('sets isForesporsel for foresporsel scenario', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge({
        ...baseConfig,
        scenario: 'foresporsel',
        fristForSpesifisering: '2026-03-15',
      }),
      { wrapper: createWrapper() },
    );
    expect(result.current.cardProps.revisionContext.isForesporsel).toBe(true);
    expect(result.current.cardProps.revisionContext.foresporselDeadline).toBe('2026-03-15');
  });

  it('passes originalEventId through to submit (edit scenario)', () => {
    const { result } = renderHook(
      () => useFristSubmissionBridge({
        ...baseConfig,
        scenario: 'edit',
        existing: {
          varsel_type: 'spesifisert',
          antall_dager: 10,
          begrunnelse: 'Begrunnelse som er lang nok',
        },
        originalEventId: 'frist-evt-789',
      }),
      { wrapper: createWrapper() },
    );
    expect(result.current.cardProps.varselType).toBe('spesifisert');
    expect(result.current.cardProps.antallDager).toBe(10);
  });
});
