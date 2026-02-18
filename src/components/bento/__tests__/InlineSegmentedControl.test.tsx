import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { InlineSegmentedControl } from '../InlineSegmentedControl';

const options = [
  { value: 'varsel', label: 'Varsel' },
  { value: 'krav', label: 'Krav' },
];

describe('InlineSegmentedControl', () => {
  it('renders all options', () => {
    render(<InlineSegmentedControl options={options} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('Varsel')).toBeInTheDocument();
    expect(screen.getByText('Krav')).toBeInTheDocument();
  });

  it('highlights selected option', () => {
    render(<InlineSegmentedControl options={options} value="varsel" onChange={vi.fn()} />);
    const varselBtn = screen.getByText('Varsel').closest('button');
    expect(varselBtn?.className).toContain('bg-pkt-brand-dark-green-1000');
  });

  it('calls onChange when option clicked', async () => {
    const onChange = vi.fn();
    render(<InlineSegmentedControl options={options} value={undefined} onChange={onChange} />);
    await userEvent.click(screen.getByText('Krav'));
    expect(onChange).toHaveBeenCalledWith('krav');
  });

  it('does not call onChange when disabled', async () => {
    const onChange = vi.fn();
    render(<InlineSegmentedControl options={options} value={undefined} onChange={onChange} disabled />);
    await userEvent.click(screen.getByText('Krav'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
