import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InlineDatePicker } from '../InlineDatePicker';

describe('InlineDatePicker', () => {
  it('renders label', () => {
    render(<InlineDatePicker label="Varseldato" value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('Varseldato')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<InlineDatePicker label="Ny sluttdato" subtitle="valgfritt" value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('valgfritt')).toBeInTheDocument();
  });

  it('renders formatted date in trigger', () => {
    render(<InlineDatePicker label="Dato" value="2026-02-14" onChange={vi.fn()} />);
    expect(screen.getByText('14.02.2026')).toBeInTheDocument();
  });

  it('shows placeholder when no value', () => {
    render(<InlineDatePicker label="Dato" value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('Velg dato')).toBeInTheDocument();
  });

  it('shows error text', () => {
    render(<InlineDatePicker label="Dato" value={undefined} onChange={vi.fn()} error="Dato er påkrevd" />);
    expect(screen.getByText('Dato er påkrevd')).toBeInTheDocument();
  });

  it('shows helper text when no error', () => {
    render(<InlineDatePicker label="Dato" value="2026-02-14" onChange={vi.fn()} helperText="Ekstra info" />);
    expect(screen.getByText('Ekstra info')).toBeInTheDocument();
  });

  it('hides helper text when error is present', () => {
    render(
      <InlineDatePicker label="Dato" value={undefined} onChange={vi.fn()} helperText="Valgfritt felt" error="Påkrevd" />
    );
    expect(screen.queryByText('Valgfritt felt')).not.toBeInTheDocument();
    expect(screen.getByText('Påkrevd')).toBeInTheDocument();
  });

  it('disables the trigger when disabled', () => {
    render(<InlineDatePicker label="Dato" value={undefined} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
