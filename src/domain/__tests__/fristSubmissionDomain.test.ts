import { describe, it, expect } from 'vitest';
import * as domain from '../fristSubmissionDomain';

describe('fristSubmissionDomain', () => {
  // ── getDefaults ──
  describe('getDefaults', () => {
    it('returns empty state for new submission', () => {
      const state = domain.getDefaults({ scenario: 'new' });
      expect(state.varselType).toBeUndefined();
      expect(state.antallDager).toBe(0);
      expect(state.begrunnelse).toBe('');
      expect(state.tidligereVarslet).toBe(false);
    });

    it('returns spesifisert defaults for spesifisering scenario', () => {
      const state = domain.getDefaults({
        scenario: 'spesifisering',
        existingVarselDato: '2026-02-10',
      });
      expect(state.varselType).toBe('spesifisert');
      expect(state.tidligereVarslet).toBe(true);
      expect(state.varselDato).toBe('2026-02-10');
    });

    it('pre-fills from existing data in edit mode', () => {
      const state = domain.getDefaults({
        scenario: 'edit',
        existing: {
          varsel_type: 'spesifisert',
          antall_dager: 10,
          begrunnelse: 'Test',
          frist_varsel: { dato_sendt: '2026-02-10', metode: ['digital_oversendelse'] },
          ny_sluttdato: '2026-03-01',
        },
      });
      expect(state.varselType).toBe('spesifisert');
      expect(state.antallDager).toBe(10);
      expect(state.begrunnelse).toBe('Test');
      expect(state.varselDato).toBe('2026-02-10');
      expect(state.nySluttdato).toBe('2026-03-01');
    });
  });

  // ── beregnVisibility ──
  describe('beregnVisibility', () => {
    it('shows segmented control for new submission', () => {
      const v = domain.beregnVisibility({ varselType: undefined }, { scenario: 'new' });
      expect(v.showSegmentedControl).toBe(true);
      expect(v.showVarselSection).toBe(false);
      expect(v.showKravSection).toBe(false);
    });

    it('shows varsel section when varsel selected', () => {
      const v = domain.beregnVisibility({ varselType: 'varsel' }, { scenario: 'new' });
      expect(v.showVarselSection).toBe(true);
      expect(v.showKravSection).toBe(false);
    });

    it('shows both sections when spesifisert selected', () => {
      const v = domain.beregnVisibility({ varselType: 'spesifisert' }, { scenario: 'new' });
      expect(v.showVarselSection).toBe(true);
      expect(v.showKravSection).toBe(true);
    });

    it('hides segmented control for spesifisering scenario', () => {
      const v = domain.beregnVisibility({ varselType: 'spesifisert' }, { scenario: 'spesifisering' });
      expect(v.showSegmentedControl).toBe(false);
    });

    it('shows only krav + utsatt for forespørsel scenario', () => {
      const v = domain.beregnVisibility({ varselType: undefined }, { scenario: 'foresporsel' });
      expect(v.showSegmentedControl).toBe(true);
      expect(v.segmentOptions).toEqual([
        { value: 'spesifisert', label: 'Krav' },
        { value: 'begrunnelse_utsatt', label: 'Utsatt beregning' },
      ]);
    });
  });

  // ── beregnPreklusjonsvarsel ──
  describe('beregnPreklusjonsvarsel', () => {
    it('returns null when no dato_oppdaget', () => {
      expect(domain.beregnPreklusjonsvarsel({})).toBeNull();
    });

    it('returns warning after 7 days', () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 8);
      const result = domain.beregnPreklusjonsvarsel({
        datoOppdaget: sevenDaysAgo.toISOString().split('T')[0],
      });
      expect(result?.variant).toBe('warning');
    });

    it('returns danger after 14 days', () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      const result = domain.beregnPreklusjonsvarsel({
        datoOppdaget: fifteenDaysAgo.toISOString().split('T')[0],
      });
      expect(result?.variant).toBe('danger');
    });
  });

  // ── beregnCanSubmit ──
  describe('beregnCanSubmit', () => {
    it('cannot submit without varselType', () => {
      const state = domain.getDefaults({ scenario: 'new' });
      expect(domain.beregnCanSubmit(state, { scenario: 'new' })).toBe(false);
    });

    it('can submit varsel without begrunnelse', () => {
      const state = { ...domain.getDefaults({ scenario: 'new' }), varselType: 'varsel' as const };
      expect(domain.beregnCanSubmit(state, { scenario: 'new' })).toBe(true);
    });

    it('cannot submit spesifisert without begrunnelse', () => {
      const state = {
        ...domain.getDefaults({ scenario: 'new' }),
        varselType: 'spesifisert' as const,
        antallDager: 10,
      };
      expect(domain.beregnCanSubmit(state, { scenario: 'new' })).toBe(false);
    });

    it('can submit spesifisert with begrunnelse >= 10 chars', () => {
      const state = {
        ...domain.getDefaults({ scenario: 'new' }),
        varselType: 'spesifisert' as const,
        antallDager: 10,
        begrunnelse: 'Minst ti tegn her',
      };
      expect(domain.beregnCanSubmit(state, { scenario: 'new' })).toBe(true);
    });

    it('cannot submit spesifisert with 0 days', () => {
      const state = {
        ...domain.getDefaults({ scenario: 'new' }),
        varselType: 'spesifisert' as const,
        antallDager: 0,
        begrunnelse: 'Minst ti tegn her',
      };
      expect(domain.beregnCanSubmit(state, { scenario: 'new' })).toBe(false);
    });
  });

  // ── buildEventData ──
  describe('buildEventData', () => {
    it('builds varsel event data', () => {
      const state = {
        ...domain.getDefaults({ scenario: 'new' }),
        varselType: 'varsel' as const,
        tidligereVarslet: false,
      };
      const data = domain.buildEventData(state, { scenario: 'new', grunnlagEventId: 'g-1' });
      expect(data.varsel_type).toBe('varsel');
      expect(data.antall_dager).toBeUndefined();
      expect(data.frist_varsel?.metode).toContain('digital_oversendelse');
      expect(data.grunnlag_event_id).toBe('g-1');
    });

    it('builds spesifisert event data with days', () => {
      const state = {
        ...domain.getDefaults({ scenario: 'new' }),
        varselType: 'spesifisert' as const,
        antallDager: 14,
        begrunnelse: 'Hindret av regn',
        nySluttdato: '2026-04-01',
        tidligereVarslet: true,
        varselDato: '2026-02-10',
      };
      const data = domain.buildEventData(state, { scenario: 'new', grunnlagEventId: 'g-1' });
      expect(data.varsel_type).toBe('spesifisert');
      expect(data.antall_dager).toBe(14);
      expect(data.begrunnelse).toBe('Hindret av regn');
      expect(data.ny_sluttdato).toBe('2026-04-01');
      expect(data.frist_varsel?.dato_sendt).toBe('2026-02-10');
    });
  });

  // ── getEventType ──
  describe('getEventType', () => {
    it('returns frist_krav_sendt for new submission', () => {
      expect(domain.getEventType({ scenario: 'new' })).toBe('frist_krav_sendt');
    });

    it('returns frist_krav_spesifisert for spesifisering', () => {
      expect(domain.getEventType({ scenario: 'spesifisering' })).toBe('frist_krav_spesifisert');
    });

    it('returns frist_krav_spesifisert for foresporsel', () => {
      expect(domain.getEventType({ scenario: 'foresporsel' })).toBe('frist_krav_spesifisert');
    });

    it('returns frist_krav_oppdatert for edit', () => {
      expect(domain.getEventType({ scenario: 'edit' })).toBe('frist_krav_oppdatert');
    });
  });
});
