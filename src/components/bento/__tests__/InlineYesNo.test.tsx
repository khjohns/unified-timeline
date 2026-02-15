import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InlineYesNo } from '../InlineYesNo';

describe('InlineYesNo', () => {
  it('renders label and both buttons', () => {
    render(<InlineYesNo label="Varslet i tide?" value={undefined} onChange={() => {}} />);
    expect(screen.getByText('Varslet i tide?')).toBeInTheDocument();
    expect(screen.getByText('Ja')).toBeInTheDocument();
    expect(screen.getByText('Nei')).toBeInTheDocument();
  });

  it('calls onChange with true when Ja is clicked', () => {
    const onChange = vi.fn();
    render(<InlineYesNo label="Test" value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByText('Ja'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when Nei is clicked', () => {
    const onChange = vi.fn();
    render(<InlineYesNo label="Test" value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByText('Nei'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('highlights Ja when value is true', () => {
    const { container } = render(<InlineYesNo label="Test" value={true} onChange={() => {}} />);
    const jaBtn = container.querySelector('[data-value="true"]');
    expect(jaBtn?.className).toContain('border-pkt-brand-dark-green-1000');
  });

  it('highlights Nei when value is false', () => {
    const { container } = render(<InlineYesNo label="Test" value={false} onChange={() => {}} />);
    const neiBtn = container.querySelector('[data-value="false"]');
    expect(neiBtn?.className).toContain('border-pkt-brand-red-1000');
  });

  it('shows PREKLUDERT badge when value is false and showPrekludert is true', () => {
    render(<InlineYesNo label="Test" value={false} onChange={() => {}} showPrekludert />);
    expect(screen.getByText('PREKLUDERT')).toBeInTheDocument();
  });

  it('does not show PREKLUDERT badge when value is true', () => {
    render(<InlineYesNo label="Test" value={true} onChange={() => {}} showPrekludert />);
    expect(screen.queryByText('PREKLUDERT')).not.toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<InlineYesNo label="Test" subtitle="§33.4" value={undefined} onChange={() => {}} />);
    expect(screen.getByText('§33.4')).toBeInTheDocument();
  });

  it('disables buttons when disabled is true', () => {
    const onChange = vi.fn();
    render(<InlineYesNo label="Test" value={undefined} onChange={onChange} disabled />);
    fireEvent.click(screen.getByText('Ja'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
