import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ClaimContextPanel } from '../ClaimContextPanel';

describe('ClaimContextPanel', () => {
  const defaultProps = {
    grunnlagEvent: {
      hovedkategori: 'ENDRING',
      underkategori: 'IRREG',
      beskrivelse: 'Fundamenteringen ble endret fra peler til plate.',
      dato_oppdaget: '2024-01-12',
      dato_varslet: '2024-01-15',
    },
    entries: [],
  };

  it('renders hovedkategori label', () => {
    render(<ClaimContextPanel {...defaultProps} />);
    // Both mobile and desktop views render the label
    const matches = screen.getAllByText(/ENDRING/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders underkategori label', () => {
    render(<ClaimContextPanel {...defaultProps} />);
    // Both mobile compact line and desktop detail render the label
    const matches = screen.getAllByText(/Irregulær endring/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders beskrivelse', () => {
    render(<ClaimContextPanel {...defaultProps} />);
    expect(screen.getByText(/Fundamenteringen ble endret/)).toBeInTheDocument();
  });

  it('renders dates', () => {
    render(<ClaimContextPanel {...defaultProps} />);
    expect(screen.getByText('Oppdaget')).toBeInTheDocument();
    expect(screen.getByText('Varslet')).toBeInTheDocument();
  });

  it('renders entitlement info for ENDRING (vederlag + frist)', () => {
    render(<ClaimContextPanel {...defaultProps} />);
    expect(screen.getByText(/Vederlag/)).toBeInTheDocument();
    expect(screen.getByText(/Frist/)).toBeInTheDocument();
  });

  it('renders only frist for FORCE_MAJEURE', () => {
    render(
      <ClaimContextPanel
        grunnlagEvent={{ hovedkategori: 'FORCE_MAJEURE' }}
        entries={[]}
      />
    );
    expect(screen.getByText(/Kun frist/)).toBeInTheDocument();
  });

  it('renders gracefully with minimal data', () => {
    render(<ClaimContextPanel grunnlagEvent={{}} entries={[]} />);
    // Should not crash, just show empty/placeholder state (mobile + desktop both render "TE's krav")
    const matches = screen.getAllByText(/TE's krav/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
