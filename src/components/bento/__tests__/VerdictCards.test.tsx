import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VerdictCards, type VerdictOption } from '../VerdictCards';

const defaultOptions: VerdictOption[] = [
  { value: 'godkjent', label: 'Godkjent', description: 'Grunnlag for krav anerkjent', icon: 'check', colorScheme: 'green' },
  { value: 'avslatt', label: 'Avslått', description: 'Grunnlag for krav avvist', icon: 'cross', colorScheme: 'red' },
];

describe('VerdictCards', () => {
  it('renders all options as clickable cards', () => {
    render(<VerdictCards value={undefined} onChange={() => {}} options={defaultOptions} />);
    expect(screen.getByText('Godkjent')).toBeInTheDocument();
    expect(screen.getByText('Avslått')).toBeInTheDocument();
    expect(screen.getByText('Grunnlag for krav anerkjent')).toBeInTheDocument();
  });

  it('calls onChange when a card is clicked', () => {
    const onChange = vi.fn();
    render(<VerdictCards value={undefined} onChange={onChange} options={defaultOptions} />);
    fireEvent.click(screen.getByText('Godkjent'));
    expect(onChange).toHaveBeenCalledWith('godkjent');
  });

  it('highlights the selected card and dims others', () => {
    const { container } = render(
      <VerdictCards value="godkjent" onChange={() => {}} options={defaultOptions} />
    );
    const cards = container.querySelectorAll('[data-verdict-card]');
    expect(cards[0]).toHaveAttribute('data-selected', 'true');
    expect(cards[1]).toHaveAttribute('data-selected', 'false');
  });

  it('shows error state when error prop is true', () => {
    const { container } = render(
      <VerdictCards value={undefined} onChange={() => {}} options={defaultOptions} error />
    );
    const wrapper = container.querySelector('[data-verdict-cards]');
    expect(wrapper?.className).toContain('ring-');
  });

  it('renders with three options including frafalt', () => {
    const threeOptions: VerdictOption[] = [
      ...defaultOptions,
      { value: 'frafalt', label: 'Frafalt', description: 'Pålegget frafalles', icon: 'undo', colorScheme: 'gray' },
    ];
    render(<VerdictCards value={undefined} onChange={() => {}} options={threeOptions} />);
    expect(screen.getByText('Frafalt')).toBeInTheDocument();
  });
});
