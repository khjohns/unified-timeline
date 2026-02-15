import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InlineNumberInput } from '../InlineNumberInput';

describe('InlineNumberInput', () => {
  it('renders label and input', () => {
    render(<InlineNumberInput label="Godkjent" value={10} onChange={() => {}} />);
    expect(screen.getByText('Godkjent')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(10);
  });

  it('renders suffix', () => {
    render(<InlineNumberInput label="Dager" value={5} onChange={() => {}} suffix="d" />);
    expect(screen.getByText('d')).toBeInTheDocument();
  });

  it('calls onChange on input', () => {
    const onChange = vi.fn();
    render(<InlineNumberInput label="Test" value={0} onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('shows error state', () => {
    const { container } = render(
      <InlineNumberInput label="Test" value={-1} onChange={() => {}} error="Må være >= 0" />
    );
    expect(screen.getByText('Må være >= 0')).toBeInTheDocument();
    expect(container.querySelector('input')?.className).toContain('border-pkt-brand-red-1000');
  });

  it('shows reference value for comparison', () => {
    render(<InlineNumberInput label="Godkjent" value={5} onChange={() => {}} referenceLabel="Krevd" referenceValue="10d" />);
    expect(screen.getByText('Krevd')).toBeInTheDocument();
    expect(screen.getByText('10d')).toBeInTheDocument();
  });

  it('respects min value', () => {
    render(<InlineNumberInput label="Test" value={0} onChange={() => {}} min={0} />);
    expect(screen.getByRole('spinbutton')).toHaveAttribute('min', '0');
  });

  it('disables input when disabled is true', () => {
    render(<InlineNumberInput label="Test" value={0} onChange={() => {}} disabled />);
    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });
});
