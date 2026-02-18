import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InlineDatePicker } from '../InlineDatePicker';

describe('InlineDatePicker', () => {
  it('renders label', () => {
    render(<InlineDatePicker label="Varseldato" value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('Varseldato')).toBeInTheDocument();
  });

  it('renders date picker with formatted date', () => {
    render(<InlineDatePicker label="Dato" value="2026-02-14" onChange={vi.fn()} />);
    // DatePicker renders a button with the formatted date as text
    expect(screen.getByText('14.02.2026')).toBeInTheDocument();
  });

  it('shows error text', () => {
    render(<InlineDatePicker label="Dato" value={undefined} onChange={vi.fn()} error="Dato er påkrevd" />);
    expect(screen.getByText('Dato er påkrevd')).toBeInTheDocument();
  });

  it('shows helper text when no error', () => {
    render(<InlineDatePicker label="Dato" value="2026-02-14" onChange={vi.fn()} helperText="Velg dato" />);
    expect(screen.getByText('Velg dato')).toBeInTheDocument();
  });

  it('hides helper text when error is present', () => {
    render(
      <InlineDatePicker label="Dato" value={undefined} onChange={vi.fn()} helperText="Valgfritt felt" error="Påkrevd" />
    );
    expect(screen.queryByText('Valgfritt felt')).not.toBeInTheDocument();
    expect(screen.getByText('Påkrevd')).toBeInTheDocument();
  });

  it('disables the date picker when disabled is true', () => {
    render(<InlineDatePicker label="Dato" value={undefined} onChange={vi.fn()} disabled />);
    // DatePicker renders a button that should be disabled
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
