import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CaseIdentityTile } from '../CaseIdentityTile';

const mockState = {
  sak_id: 'KOE-2024-042',
  sakstittel: 'Grunnforhold avviker fra beskrivelse',
  overordnet_status: 'SENDT' as const,
  entreprenor: 'Veidekke',
  byggherre: 'Oslobygg',
  sakstype: 'standard' as const,
  sum_krevd: 1200000,
  sum_godkjent: 800000,
  frist: { krevd_dager: 45, godkjent_dager: 30 },
};

describe('CaseIdentityTile', () => {
  it('renders case ID and title', () => {
    render(<CaseIdentityTile state={mockState as any} />);
    expect(screen.getByText('KOE-2024-042')).toBeInTheDocument();
    expect(screen.getByText(/Grunnforhold avviker/)).toBeInTheDocument();
  });

  it('renders parties', () => {
    render(<CaseIdentityTile state={mockState as any} />);
    expect(screen.getByText(/Veidekke/)).toBeInTheDocument();
    expect(screen.getByText(/Oslobygg/)).toBeInTheDocument();
  });

  it('renders amounts and days', () => {
    render(<CaseIdentityTile state={mockState as any} />);
    expect(screen.getByText(/1\s*200\s*000/)).toBeInTheDocument();
    expect(screen.getByText(/800\s*000/)).toBeInTheDocument();
    expect(screen.getByText(/45 dager/)).toBeInTheDocument();
    expect(screen.getByText(/30 dager/)).toBeInTheDocument();
  });
});
