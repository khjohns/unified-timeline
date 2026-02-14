import { describe, it, expect } from 'vitest';
import { getAccentBorderClass, getStatusDotClass, getStatusLabel } from '../trackCardUtils';

describe('getAccentBorderClass', () => {
  it('returns gray for utkast', () => {
    expect(getAccentBorderClass('utkast')).toBe('border-t-pkt-grays-gray-400');
  });
  it('returns blue for sendt', () => {
    expect(getAccentBorderClass('sendt')).toBe('border-t-pkt-brand-warm-blue-1000');
  });
  it('returns blue for under_behandling', () => {
    expect(getAccentBorderClass('under_behandling')).toBe('border-t-pkt-brand-warm-blue-1000');
  });
  it('returns green for godkjent', () => {
    expect(getAccentBorderClass('godkjent')).toBe('border-t-pkt-brand-dark-green-1000');
  });
  it('returns amber for delvis_godkjent', () => {
    expect(getAccentBorderClass('delvis_godkjent')).toBe('border-t-pkt-brand-yellow-1000');
  });
  it('returns red for avslatt', () => {
    expect(getAccentBorderClass('avslatt')).toBe('border-t-pkt-brand-red-1000');
  });
  it('returns amber for under_forhandling', () => {
    expect(getAccentBorderClass('under_forhandling')).toBe('border-t-pkt-brand-yellow-1000');
  });
  it('returns gray for trukket', () => {
    expect(getAccentBorderClass('trukket')).toBe('border-t-pkt-grays-gray-400');
  });
  it('returns gray for ikke_relevant', () => {
    expect(getAccentBorderClass('ikke_relevant')).toBe('border-t-pkt-grays-gray-300');
  });
});

describe('getStatusDotClass', () => {
  it('returns green dot for godkjent', () => {
    expect(getStatusDotClass('godkjent')).toBe('bg-pkt-brand-dark-green-1000');
  });
  it('returns red dot for avslatt', () => {
    expect(getStatusDotClass('avslatt')).toBe('bg-pkt-brand-red-1000');
  });
  it('returns gray for utkast (open circle)', () => {
    expect(getStatusDotClass('utkast')).toBe('bg-pkt-grays-gray-400');
  });
});

describe('getStatusLabel', () => {
  it('returns Norwegian label', () => {
    expect(getStatusLabel('under_behandling')).toBe('Under behandling');
  });
});
