import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FristCard } from '../FristCard';
import type { SakState } from '../../../../types/timeline';

const baseState = {
  sak_id: 'test-1',
  frist: {
    status: 'te_sendt',
    krevd_dager: 10,
    frist_varsel: { dato_sendt: '2024-01-15' },
    ny_sluttdato: '2024-06-01',
    laast: false,
  },
  grunnlag: { status: 'utkast', laast: false },
  vederlag: { status: 'utkast', laast: false },
} as unknown as SakState;

const noopActions = {
  canRespondToGrunnlag: false,
  canRespondToFrist: false,
  canRespondToVederlag: false,
} as any;

describe('FristCard read-only', () => {
  it('renders krevd dager', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} />);
    expect(screen.getByText('10d')).toBeInTheDocument();
  });

  it('renders header', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} />);
    expect(screen.getByText('Fristforlengelse')).toBeInTheDocument();
  });
});

describe('FristCard interactive mode', () => {
  const editState = {
    fristVarselOk: true,
    onFristVarselOkChange: vi.fn(),
    showFristVarselOk: true,
    spesifisertKravOk: true,
    onSpesifisertKravOkChange: vi.fn(),
    showSpesifisertKravOk: false,
    foresporselSvarOk: true,
    onForesporselSvarOkChange: vi.fn(),
    showForesporselSvarOk: false,
    sendForesporsel: false,
    onSendForesporselChange: vi.fn(),
    showSendForesporsel: false,
    vilkarOppfylt: true,
    onVilkarOppfyltChange: vi.fn(),
    godkjentDager: 10,
    onGodkjentDagerChange: vi.fn(),
    showGodkjentDager: true,
    erPrekludert: false,
    erRedusert: false,
    port2ErSubsidiaer: false,
    port3ErSubsidiaer: false,
    erSvarPaForesporsel: false,
    erGrunnlagSubsidiaer: false,
    beregningsResultat: 'godkjent',
  };

  it('shows InlineYesNo for varslet i tide when editState.showFristVarselOk', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText(/Ble varselet sendt i tide/)).toBeInTheDocument();
  });

  it('shows vilkår toggle', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText(/Har forholdet hindret fremdriften/)).toBeInTheDocument();
  });

  it('shows godkjent dager input when showGodkjentDager is true', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('hides godkjent dager input when showGodkjentDager is false', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={{ ...editState, showGodkjentDager: false }} />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('hides CTA strip when in edit mode', () => {
    // When in edit mode with a primary action, the CTA strip should not render
    const actionWithPrimary = { label: 'Svar på krav', onClick: vi.fn() };
    render(
      <FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} primaryAction={actionWithPrimary} />
    );
    expect(screen.queryByText('Svar på krav')).not.toBeInTheDocument();
  });

  it('does not show varslet toggle when showFristVarselOk is false', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={{ ...editState, showFristVarselOk: false }} />);
    expect(screen.queryByText(/Ble varselet sendt i tide/)).not.toBeInTheDocument();
  });

  it('shows spesifisert toggle when showSpesifisertKravOk is true', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={{ ...editState, showSpesifisertKravOk: true }} />);
    expect(screen.getByText(/Ble kravet fremsatt i tide/)).toBeInTheDocument();
  });

  it('shows Oppsummering when beregningsResultat is set', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText('Oppsummering')).toBeInTheDocument();
    expect(screen.getByText('Godkjent')).toBeInTheDocument();
  });

  it('hides Oppsummering when beregningsResultat is undefined', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={{ ...editState, beregningsResultat: undefined }} />);
    expect(screen.queryByText('Oppsummering')).not.toBeInTheDocument();
  });

  it('shows Preklusjon callout when fristVarselOk is false', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={{ ...editState, fristVarselOk: false, erPrekludert: true }} />);
    expect(screen.getByText(/Preklusjon/)).toBeInTheDocument();
    expect(screen.getByText(/Husk skriftlig innsigelse/)).toBeInTheDocument();
  });

  it('shows section header Foreløpig varsel when showFristVarselOk', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={editState} />);
    expect(screen.getByText('Foreløpig varsel')).toBeInTheDocument();
  });

  it('shows Subsidiært badge on §33.6.1 when erPrekludert', () => {
    render(<FristCard state={baseState} entries={[]} userRole="BH" actions={noopActions} editState={{ ...editState, showSpesifisertKravOk: true, erPrekludert: true }} />);
    expect(screen.getByText('Krav om fristforlengelse')).toBeInTheDocument();
    expect(screen.getAllByText('Subsidiært').length).toBeGreaterThan(0);
  });
});
