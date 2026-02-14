import { describe, it, expect } from 'vitest';
import { getConsequence } from '../consequenceCallout';

describe('getConsequence', () => {
  it('returns null when no resultat selected', () => {
    expect(getConsequence({ resultat: undefined })).toBeNull();
  });

  it('returns success for godkjent (non-ENDRING)', () => {
    const result = getConsequence({ resultat: 'godkjent' });
    expect(result?.variant).toBe('success');
    expect(result?.text).toContain('grunnlag for krav');
  });

  it('returns success for godkjent ENDRING varslet i tide', () => {
    const result = getConsequence({ resultat: 'godkjent', erEndringMed32_2: true, varsletITide: true });
    expect(result?.variant).toBe('success');
    expect(result?.text).toContain('varselet ble sendt i tide');
  });

  it('returns success for godkjent ENDRING varslet for sent (subsidiaer godkjenning)', () => {
    const result = getConsequence({ resultat: 'godkjent', erEndringMed32_2: true, varsletITide: false });
    expect(result?.variant).toBe('success');
    expect(result?.text).toContain('for sent');
    expect(result?.text).toContain('subsidiært');
  });

  it('returns success for godkjent force majeure', () => {
    const result = getConsequence({ resultat: 'godkjent', erForceMajeure: true });
    expect(result?.variant).toBe('success');
    expect(result?.text).toContain('fristforlengelse');
    expect(result?.text).toContain('ikke vederlag');
  });

  it('returns warning for avslatt (non-ENDRING)', () => {
    const result = getConsequence({ resultat: 'avslatt' });
    expect(result?.variant).toBe('warning');
    expect(result?.text).toContain('omtvistet');
  });

  it('returns warning for avslatt ENDRING varslet i tide', () => {
    const result = getConsequence({ resultat: 'avslatt', erEndringMed32_2: true, varsletITide: true });
    expect(result?.variant).toBe('warning');
    expect(result?.text).toContain('varselet ble sendt i tide');
    expect(result?.text).toContain('subsidiært');
  });

  it('returns danger for avslatt ENDRING varslet for sent (double subsidiary)', () => {
    const result = getConsequence({ resultat: 'avslatt', erEndringMed32_2: true, varsletITide: false });
    expect(result?.variant).toBe('danger');
    expect(result?.text).toContain('preklusjon');
  });

  it('returns warning for avslatt force majeure', () => {
    const result = getConsequence({ resultat: 'avslatt', erForceMajeure: true });
    expect(result?.variant).toBe('warning');
    expect(result?.text).toContain('force majeure');
  });

  it('returns info for frafalt', () => {
    const result = getConsequence({ resultat: 'frafalt' });
    expect(result?.variant).toBe('info');
    expect(result?.text).toContain('frafalles');
  });

  it('appends snuoperasjon text when applicable', () => {
    const result = getConsequence({ resultat: 'godkjent', erSnuoperasjon: true, harSubsidiaereSvar: true });
    expect(result?.snuoperasjonText).toContain('prinsipale');
  });

  it('does not append snuoperasjon text when no subsidiaere svar', () => {
    const result = getConsequence({ resultat: 'godkjent', erSnuoperasjon: true, harSubsidiaereSvar: false });
    expect(result?.snuoperasjonText).toBeUndefined();
  });
});
