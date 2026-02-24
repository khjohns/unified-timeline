import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VederlagCard } from '../VederlagCard';
import type { SakState } from '../../../../types/timeline';
import type { VederlagEditState } from '../../../../hooks/useVederlagBridge';
import type { VederlagTeEditState } from '../../../../hooks/useVederlagSubmissionBridge';

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

// ============================================================================
// TE EDIT MODE (teEditState — card-anchored TE submission, ADR-003 L21)
// ============================================================================

const baseTeEditState: VederlagTeEditState = {
  metode: 'ENHETSPRISER',
  onMetodeChange: vi.fn(),
  belopDirekte: 250000,
  onBelopDirekteChange: vi.fn(),
  showBelopDirekte: true,
  kostnadsOverslag: undefined,
  onKostnadsOverslagChange: vi.fn(),
  showKostnadsOverslag: false,
  kreverJustertEp: false,
  onKreverJustertEpChange: vi.fn(),
  showJustertEp: true,
  varsletForOppstart: true,
  onVarsletForOppstartChange: vi.fn(),
  showVarsletForOppstart: false,
  harRiggKrav: false,
  onHarRiggKravChange: vi.fn(),
  belopRigg: undefined,
  onBelopRiggChange: vi.fn(),
  datoKlarOverRigg: undefined,
  onDatoKlarOverRiggChange: vi.fn(),
  harProduktivitetKrav: false,
  onHarProduktivitetKravChange: vi.fn(),
  belopProduktivitet: undefined,
  onBelopProduktivitetChange: vi.fn(),
  datoKlarOverProduktivitet: undefined,
  onDatoKlarOverProduktivitetChange: vi.fn(),
  statusSummary: 'Krav om kr 250 000 i vederlag',
  begrunnelse: '',
  onBegrunnelseChange: vi.fn(),
  begrunnelseError: undefined,
  begrunnelsePlaceholder: 'Begrunn kravets omfang...',
  onClose: vi.fn(),
  onSubmit: vi.fn(),
  isSubmitting: false,
  canSubmit: false,
  submitError: null,
  submitLabel: 'Send vederlagskrav',
  showTokenExpired: false,
  onTokenExpiredClose: vi.fn(),
};

describe('VederlagCard TE edit mode (teEditState)', () => {
  it('shows close button in right column', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.getByLabelText('Lukk')).toBeInTheDocument();
  });

  it('shows Vederlag title in right column (header hidden)', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    // The header is hidden in teEditState, but title appears in the right column
    expect(screen.getByText('Vederlag')).toBeInTheDocument();
  });

  it('hides original header when teEditState is active', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    // Only one "Vederlag" text should appear (the one in right column), not the header
    const vederlagTexts = screen.getAllByText('Vederlag');
    expect(vederlagTexts).toHaveLength(1);
  });

  it('shows Begrunnelse label with required indicator', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.getByText('Begrunnelse')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows begrunnelse textarea with placeholder', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.getByPlaceholderText('Begrunn kravets omfang...')).toBeInTheDocument();
  });

  it('shows begrunnelse validation error when present', () => {
    const teEditState = { ...baseTeEditState, begrunnelseError: 'Minst 10 tegn' };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    expect(screen.getByText('Minst 10 tegn')).toBeInTheDocument();
  });

  it('shows status summary when present', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.getByText('Krav om kr 250 000 i vederlag')).toBeInTheDocument();
  });

  it('hides status summary when null', () => {
    const teEditState = { ...baseTeEditState, statusSummary: null };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    expect(screen.queryByText(/Krav om/)).not.toBeInTheDocument();
  });

  it('shows Beregningsmetode section with segmented control', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.getByText('Beregningsmetode')).toBeInTheDocument();
    expect(screen.getByText('Enhetspriser')).toBeInTheDocument();
    expect(screen.getByText('Regning')).toBeInTheDocument();
    expect(screen.getByText('Fastpris')).toBeInTheDocument();
  });

  it('shows belopDirekte input when showBelopDirekte is true', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.getByText('Beløp (eks. mva)')).toBeInTheDocument();
  });

  it('hides belopDirekte input when showBelopDirekte is false', () => {
    const teEditState = { ...baseTeEditState, showBelopDirekte: false };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    expect(screen.queryByText('Beløp (eks. mva)')).not.toBeInTheDocument();
  });

  it('shows kostnadsOverslag input when showKostnadsOverslag is true', () => {
    const teEditState = {
      ...baseTeEditState,
      metode: 'REGNINGSARBEID' as const,
      showBelopDirekte: false,
      showKostnadsOverslag: true,
      showJustertEp: false,
      showVarsletForOppstart: true,
    };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    expect(screen.getByText('Estimert beløp')).toBeInTheDocument();
  });

  it('shows Justert EP section when showJustertEp is true', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.getByText('Justert EP')).toBeInTheDocument();
    expect(screen.getByText(/Krever justerte enhetspriser/)).toBeInTheDocument();
  });

  it('hides Justert EP section when showJustertEp is false', () => {
    const teEditState = { ...baseTeEditState, showJustertEp: false };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    expect(screen.queryByText('Justert EP')).not.toBeInTheDocument();
  });

  it('shows Varsling section when showVarsletForOppstart is true', () => {
    const teEditState = {
      ...baseTeEditState,
      metode: 'REGNINGSARBEID' as const,
      showVarsletForOppstart: true,
      showJustertEp: false,
    };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    expect(screen.getByText('Varsling')).toBeInTheDocument();
    expect(screen.getByText(/Varslet før oppstart/)).toBeInTheDocument();
  });

  it('hides Varsling section when showVarsletForOppstart is false', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.queryByText('Varsling')).not.toBeInTheDocument();
  });

  it('shows Særskilte krav section with rigg and produktivitet toggles', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.getByText('Særskilte krav')).toBeInTheDocument();
    expect(screen.getByText(/Økte rigg/)).toBeInTheDocument();
    expect(screen.getByText(/Nedsatt produktivitet/)).toBeInTheDocument();
  });

  it('shows rigg nested inputs when harRiggKrav is true', () => {
    const teEditState = { ...baseTeEditState, harRiggKrav: true, belopRigg: 30000 };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    // Should see "Estimert beløp" for rigg and "Dato erkjent"
    const estimertLabels = screen.getAllByText('Estimert beløp');
    expect(estimertLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Dato erkjent')).toBeInTheDocument();
  });

  it('hides rigg nested inputs when harRiggKrav is false', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.queryByText('Dato erkjent')).not.toBeInTheDocument();
  });

  it('shows produktivitet nested inputs when harProduktivitetKrav is true', () => {
    const teEditState = { ...baseTeEditState, harProduktivitetKrav: true, belopProduktivitet: 20000 };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    const datoLabels = screen.getAllByText('Dato erkjent');
    expect(datoLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows both rigg and produktivitet nested inputs when both are true', () => {
    const teEditState = {
      ...baseTeEditState,
      harRiggKrav: true,
      belopRigg: 30000,
      harProduktivitetKrav: true,
      belopProduktivitet: 20000,
    };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    const datoLabels = screen.getAllByText('Dato erkjent');
    expect(datoLabels).toHaveLength(2);
  });

  it('shows submit button with correct label', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.getByText('Send vederlagskrav')).toBeInTheDocument();
  });

  it('disables submit button when canSubmit is false', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.getByText('Send vederlagskrav')).toBeDisabled();
  });

  it('enables submit button when canSubmit is true', () => {
    const teEditState = { ...baseTeEditState, canSubmit: true };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    expect(screen.getByText('Send vederlagskrav')).not.toBeDisabled();
  });

  it('disables submit button when isSubmitting', () => {
    const teEditState = { ...baseTeEditState, canSubmit: true, isSubmitting: true };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    expect(screen.getByText('Send vederlagskrav')).toBeDisabled();
  });

  it('shows submit error alert when submitError is set', () => {
    const teEditState = { ...baseTeEditState, submitError: 'Server utilgjengelig' };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    expect(screen.getByText('Server utilgjengelig')).toBeInTheDocument();
  });

  it('hides read-only key-value rows when teEditState is active', () => {
    render(<VederlagCard state={baseState} krevdBelop={100000} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    const metodeLabels = screen.queryAllByText('Metode');
    expect(metodeLabels).toHaveLength(0);
  });

  it('hides CTA strip when teEditState is active', () => {
    const action = { label: 'Send krav', onClick: vi.fn() };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} primaryAction={action} />);
    expect(screen.queryByText('Send krav')).not.toBeInTheDocument();
  });

  it('applies ring styling when teEditState is active', () => {
    const { container } = render(
      <VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('ring-2');
  });

  it('shows Subsidiært badge when isSubsidiary is true', () => {
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} isSubsidiary />);
    expect(screen.getByText(/Subsidiært/)).toBeInTheDocument();
  });

  it('does not show isEmpty message when teEditState is active', () => {
    const emptyState = {
      ...baseState,
      vederlag: { status: 'utkast', laast: false },
    } as unknown as SakState;
    render(<VederlagCard state={emptyState} entries={[]} userRole="TE" actions={noopActions} teEditState={baseTeEditState} />);
    expect(screen.queryByText('Ingen data ennå')).not.toBeInTheDocument();
  });

  it('hides Særskilte krav section when metode is undefined', () => {
    const teEditState = { ...baseTeEditState, metode: undefined };
    render(<VederlagCard state={baseState} entries={[]} userRole="TE" actions={noopActions} teEditState={teEditState} />);
    expect(screen.queryByText('Særskilte krav')).not.toBeInTheDocument();
  });
});
