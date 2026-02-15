import { describe, it, expect } from 'vitest';
import { getConsequence, getFristConsequence, getVederlagConsequence } from '../consequenceCallout';

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

describe('getFristConsequence', () => {
  it('returns null when no resultat', () => {
    expect(getFristConsequence({ resultat: undefined })).toBeNull();
  });

  it('returns success for godkjent', () => {
    const result = getFristConsequence({ resultat: 'godkjent', godkjentDager: 10, krevdDager: 10 });
    expect(result?.variant).toBe('success');
    expect(result?.text).toContain('godkjent');
  });

  it('returns warning for delvis_godkjent', () => {
    const result = getFristConsequence({ resultat: 'delvis_godkjent', godkjentDager: 5, krevdDager: 10 });
    expect(result?.variant).toBe('warning');
  });

  it('returns danger for avslatt with forsering reference', () => {
    const result = getFristConsequence({ resultat: 'avslatt', godkjentDager: 0, krevdDager: 10 });
    expect(result?.variant).toBe('danger');
    expect(result?.text).toContain('§33.8');
  });

  it('includes subsidiary text when relevant', () => {
    const result = getFristConsequence({ resultat: 'godkjent', godkjentDager: 10, krevdDager: 10, erSubsidiaer: true });
    expect(result?.text).toContain('Subsidiært');
  });

  it('handles preclusion consequence', () => {
    const result = getFristConsequence({ resultat: 'avslatt', erPrekludert: true, godkjentDager: 0, krevdDager: 10 });
    expect(result?.variant).toBe('danger');
    expect(result?.text).toContain('preklu');
  });

  it('shows days comparison for delvis_godkjent', () => {
    const result = getFristConsequence({ resultat: 'delvis_godkjent', godkjentDager: 5, krevdDager: 10 });
    expect(result?.text).toContain('5');
    expect(result?.text).toContain('10');
  });
});

describe('getVederlagConsequence', () => {
  it('returns null when no resultat', () => {
    expect(getVederlagConsequence({ resultat: undefined })).toBeNull();
  });

  it('returns success for godkjent', () => {
    const result = getVederlagConsequence({ resultat: 'godkjent' });
    expect(result?.variant).toBe('success');
  });

  it('returns warning for delvis_godkjent', () => {
    const result = getVederlagConsequence({ resultat: 'delvis_godkjent', godkjentBelop: 50000, krevdBelop: 100000 });
    expect(result?.variant).toBe('warning');
  });

  it('returns info for hold_tilbake', () => {
    const result = getVederlagConsequence({ resultat: 'hold_tilbake' });
    expect(result?.variant).toBe('info');
    expect(result?.text).toContain('§30.2');
  });

  it('returns danger for avslatt', () => {
    const result = getVederlagConsequence({ resultat: 'avslatt' });
    expect(result?.variant).toBe('danger');
  });

  it('shows amount comparison for delvis_godkjent', () => {
    const result = getVederlagConsequence({ resultat: 'delvis_godkjent', godkjentBelop: 50000, krevdBelop: 100000 });
    expect(result?.text).toContain('50');
    expect(result?.text).toContain('100');
  });

  it('returns success with method change note', () => {
    const result = getVederlagConsequence({ resultat: 'godkjent', harMetodeendring: true });
    expect(result?.variant).toBe('warning');
    expect(result?.text).toContain('metode');
  });
});
