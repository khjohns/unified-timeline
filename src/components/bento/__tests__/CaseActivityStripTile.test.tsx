import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CaseActivityStripTile } from '../CaseActivityStripTile';

describe('CaseActivityStripTile', () => {
  it('renders last event per track', () => {
    const events = [
      { event_type: 'respons_grunnlag', created_at: new Date().toISOString() },
      { event_type: 'vederlag_krav_sendt', created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
    ];
    render(<CaseActivityStripTile events={events as any} />);
    expect(screen.getByText(/Grunnlag/)).toBeInTheDocument();
    expect(screen.getByText(/Vederlag/)).toBeInTheDocument();
  });

  it('shows waiting state for tracks without events', () => {
    render(<CaseActivityStripTile events={[]} />);
    expect(screen.getByText(/venter/i)).toBeInTheDocument();
  });
});
