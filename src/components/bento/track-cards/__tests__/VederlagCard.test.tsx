import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VederlagCard } from '../VederlagCard';
import type { SakState } from '../../../../types/timeline';
import type { VederlagEditState } from '../../../../hooks/useVederlagBridge';

const baseState = {
  sak_id: 'test-1',
  vederlag: {
    status: 'te_sendt',
    metode: 'ENHETSPRISER',
    belop: 100000,
    laast: false,
  },
  grunnlag: { status: 'godkjent', laast: false },
  frist: { status: 'utkast', laast: false },
} as unknown as SakState;

const noopActions = {
  canRespondToGrunnlag: false,
  canRespondToFrist: false,
  canRespondToVederlag: false,
} as any;

const noopKravLinje = {
  label: 'Hovedkrav',
  paragraf: '',
  krevdBelop: 100000,
  godkjentBelop: 100000,
  onGodkjentBelopChange: vi.fn(),
  showVarsling: false,
  varsletITide: true,
  onVarsletITideChange: vi.fn(),
  vurdering: 'godkjent' as const,
  erPrekludert: false,
  subsidiaertGodkjentBelop: 100000,
};

const baseEditState: VederlagEditState = {
  teMetode: 'ENHETSPRISER',
  bhMetode: 'ENHETSPRISER',
  onBhMetodeChange: vi.fn(),
  harMetodeendring: false,

  showEpJustering: false,
  onEpJusteringVarsletITideChange: vi.fn(),
  onEpJusteringAkseptertChange: vi.fn(),

  showTilbakeholdelse: false,
  holdTilbake: false,
  onHoldTilbakeChange: vi.fn(),

  hovedkrav: noopKravLinje,
  rigg: undefined,
  produktivitet: undefined,

  prinsipaltResultat: 'godkjent',
  subsidiaertResultat: 'godkjent',
  visSubsidiaertResultat: false,
  totalKrevd: 100000,
  totalGodkjent: 100000,
  totalGodkjentInklPrekludert: 100000,
  godkjenningsgradProsent: 100,

  erSubsidiaer: false,
  subsidiaerTriggers: [],

  onClose: vi.fn(),
  onSubmit: vi.fn(),
  isSubmitting: false,
  canSubmit: true,
  submitError: null,
  submitLabel: 'Send svar',
  showTokenExpired: false,
  onTokenExpiredClose: vi.fn(),
};

// ============================================================================
// READ-ONLY MODE
// ============================================================================

describe('VederlagCard read-only', () => {
  it('renders header with Vederlag label', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} />);
    expect(screen.getByText('Vederlag')).toBeInTheDocument();
  });

  it('renders dimmed state when isDimmed', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} isDimmed />);
    expect(screen.getByText('Krever ansvarsgrunnlag')).toBeInTheDocument();
  });
});

// ============================================================================
// INTERACTIVE MODE (editState)
// ============================================================================

describe('VederlagCard interactive mode', () => {
  it('shows close button when editState is provided', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={baseEditState} />);
    expect(screen.getByLabelText('Lukk')).toBeInTheDocument();
  });

  it('shows submit button with correct label', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={baseEditState} />);
    expect(screen.getByText('Send svar')).toBeInTheDocument();
  });

  it('disables submit button when canSubmit is false', () => {
    const editState = { ...baseEditState, canSubmit: false };
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText('Send svar')).toBeDisabled();
  });

  it('shows Beregningsmetode section', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={baseEditState} />);
    expect(screen.getByText('Beregningsmetode')).toBeInTheDocument();
  });

  it('shows EP-justering section when showEpJustering is true', () => {
    const editState = { ...baseEditState, showEpJustering: true };
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText(/EP-justering/)).toBeInTheDocument();
  });

  it('hides EP-justering section when showEpJustering is false', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={baseEditState} />);
    expect(screen.queryByText(/EP-justering/)).not.toBeInTheDocument();
  });

  it('shows Tilbakeholdelse section when showTilbakeholdelse is true', () => {
    const editState = { ...baseEditState, showTilbakeholdelse: true };
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText(/Tilbakeholdelse/)).toBeInTheDocument();
  });

  it('hides Tilbakeholdelse section when showTilbakeholdelse is false', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={baseEditState} />);
    expect(screen.queryByText(/Tilbakeholdelse/)).not.toBeInTheDocument();
  });

  it('renders rigg krav-linje when present', () => {
    const editState = {
      ...baseEditState,
      rigg: { ...noopKravLinje, label: 'Rigg/drift', paragraf: '§34.1.3', krevdBelop: 20000, godkjentBelop: 20000 },
    };
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText('Rigg/drift')).toBeInTheDocument();
  });

  it('renders produktivitet krav-linje when present', () => {
    const editState = {
      ...baseEditState,
      produktivitet: { ...noopKravLinje, label: 'Produktivitet', paragraf: '§34.1.3', krevdBelop: 15000, godkjentBelop: 15000 },
    };
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText('Produktivitet')).toBeInTheDocument();
  });

  it('does not render rigg/produktivitet when absent', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={baseEditState} />);
    expect(screen.queryByText('Rigg/drift')).not.toBeInTheDocument();
    expect(screen.queryByText('Produktivitet')).not.toBeInTheDocument();
  });

  it('shows resultat box when prinsipaltResultat is set', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={baseEditState} />);
    expect(screen.getByText('Resultat:')).toBeInTheDocument();
    // "Godkjent" appears in multiple places (result + method cards), so check the result text exists
    expect(screen.getAllByText('Godkjent').length).toBeGreaterThan(0);
  });

  it('shows subsidiært resultat when visSubsidiaertResultat is true', () => {
    const editState = {
      ...baseEditState,
      visSubsidiaertResultat: true,
      subsidiaertResultat: 'delvis_godkjent' as const,
      totalGodkjentInklPrekludert: 80000,
    };
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText(/Subsidiært/)).toBeInTheDocument();
  });

  it('shows subsidiær context alert when erSubsidiaer is true', () => {
    const editState = { ...baseEditState, erSubsidiaer: true };
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText(/Grunnlagskravet er avslått/)).toBeInTheDocument();
  });

  it('shows submit error alert', () => {
    const editState = { ...baseEditState, submitError: 'Nettverksfeil' };
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText('Nettverksfeil')).toBeInTheDocument();
  });

  it('shows Lagre utkast button when onSaveDraft is provided', () => {
    const editState = { ...baseEditState, onSaveDraft: vi.fn() };
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText('Lagre utkast')).toBeInTheDocument();
  });

  it('hides Lagre utkast button when onSaveDraft is not provided', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={baseEditState} />);
    expect(screen.queryByText('Lagre utkast')).not.toBeInTheDocument();
  });

  it('hides CTA strip when in edit mode', () => {
    const action = { label: 'Svar på krav', onClick: vi.fn() };
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={baseEditState} primaryAction={action} />);
    expect(screen.queryByText('Svar på krav')).not.toBeInTheDocument();
  });

  it('hides read-only key-value rows when in edit mode', () => {
    const stateWithBelop = {
      ...baseState,
      vederlag: { ...baseState.vederlag, bh_resultat: undefined },
    } as unknown as SakState;
    render(<VederlagCard state={stateWithBelop} krevdBelop={100000} entries={[]} userRole="BH" actions={noopActions} editState={baseEditState} />);
    // The read-only "Metode" key-value row should not appear in edit mode
    // (MethodCards component replaces it)
    const metodeLabels = screen.queryAllByText('Metode');
    expect(metodeLabels.length).toBe(0);
  });

  it('applies ring styling when in edit mode', () => {
    const { container } = render(
      <VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={baseEditState} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('ring-2');
  });

  it('shows Subsidiært badge in header when erSubsidiaer', () => {
    const editState = { ...baseEditState, erSubsidiaer: true };
    render(<VederlagCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    // The badge "Subsidiært" should appear in the header area
    const badges = screen.getAllByText(/Subsidiært/);
    expect(badges.length).toBeGreaterThan(0);
  });
});
