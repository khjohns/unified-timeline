/**
 * Tests for categories constants
 *
 * Tests the KRAV_STRUKTUR_NS8407 data structure and helper functions
 * to ensure correct NS 8407 legal references and category relationships.
 */

import { describe, it, expect } from 'vitest';
import {
  KRAV_STRUKTUR_NS8407,
  HOVEDKATEGORI_OPTIONS,
  UNDERKATEGORI_MAP,
  getUnderkategorier,
  getHovedkategoriLabel,
  getUnderkategoriLabel,
  getHovedkategori,
  getUnderkategoriObj,
  erLovendring,
  erForceMajeure,
  erIrregulaerEndring,
  getTypeKrav,
  getHjemmelReferanser,
} from '@/src/constants/categories';

describe('KRAV_STRUKTUR_NS8407', () => {
  it('should have all required hovedkategorier', () => {
    expect(KRAV_STRUKTUR_NS8407).toHaveLength(4);

    const koder = KRAV_STRUKTUR_NS8407.map(k => k.kode);
    expect(koder).toContain('ENDRING');
    expect(koder).toContain('SVIKT');
    expect(koder).toContain('ANDRE');
    expect(koder).toContain('FORCE_MAJEURE');
  });

  it('should have correct hjemmel references for ENDRING', () => {
    const endring = KRAV_STRUKTUR_NS8407.find(k => k.kode === 'ENDRING');
    expect(endring).toBeDefined();
    expect(endring?.hjemmel_frist).toBe('33.1 a)');
    expect(endring?.hjemmel_vederlag).toBe('34.1.1');
    expect(endring?.type_krav).toBe('Tid og Penger');
  });

  it('should have correct hjemmel references for SVIKT', () => {
    const svikt = KRAV_STRUKTUR_NS8407.find(k => k.kode === 'SVIKT');
    expect(svikt).toBeDefined();
    expect(svikt?.hjemmel_frist).toBe('33.1 b)');
    expect(svikt?.hjemmel_vederlag).toBe('34.1.2');
    expect(svikt?.type_krav).toBe('Tid og Penger');
  });

  it('should have correct hjemmel references for ANDRE', () => {
    const andre = KRAV_STRUKTUR_NS8407.find(k => k.kode === 'ANDRE');
    expect(andre).toBeDefined();
    expect(andre?.hjemmel_frist).toBe('33.1 c)');
    expect(andre?.hjemmel_vederlag).toBe('34.1.2');
    expect(andre?.type_krav).toBe('Tid og Penger');
  });

  it('should have correct hjemmel references for FORCE_MAJEURE', () => {
    const fm = KRAV_STRUKTUR_NS8407.find(k => k.kode === 'FORCE_MAJEURE');
    expect(fm).toBeDefined();
    expect(fm?.hjemmel_frist).toBe('33.3');
    expect(fm?.hjemmel_vederlag).toBeNull();
    expect(fm?.type_krav).toBe('Tid');
  });

  it('should have underkategorier for all hovedkategorier', () => {
    KRAV_STRUKTUR_NS8407.forEach(kategori => {
      expect(kategori.underkategorier).toBeDefined();
      expect(kategori.underkategorier.length).toBeGreaterThan(0);
    });
  });

  it('should have correct underkategorier structure', () => {
    const endring = KRAV_STRUKTUR_NS8407.find(k => k.kode === 'ENDRING');
    const eo = endring?.underkategorier.find(u => u.kode === 'EO');

    expect(eo).toBeDefined();
    expect(eo?.kode).toBe('EO');
    expect(eo?.label).toBe('Formell endringsordre');
    expect(eo?.hjemmel_basis).toBe('31.1');
    expect(eo?.beskrivelse).toBeTruthy();
    expect(eo?.varselkrav_ref).toBe('31.3 (Mottatt ordre)');
  });

  it('should have law change underkategorier', () => {
    const endring = KRAV_STRUKTUR_NS8407.find(k => k.kode === 'ENDRING');
    const lovGjenstand = endring?.underkategorier.find(u => u.kode === 'LOV_GJENSTAND');
    const lovProsess = endring?.underkategorier.find(u => u.kode === 'LOV_PROSESS');
    const gebyr = endring?.underkategorier.find(u => u.kode === 'GEBYR');

    expect(lovGjenstand).toBeDefined();
    expect(lovProsess).toBeDefined();
    expect(gebyr).toBeDefined();
  });
});

describe('HOVEDKATEGORI_OPTIONS', () => {
  it('should include all hovedkategorier as dropdown options', () => {
    // Should have empty option + 4 kategorier
    expect(HOVEDKATEGORI_OPTIONS.length).toBe(5);

    const values = HOVEDKATEGORI_OPTIONS.map(o => o.value);
    expect(values).toContain('');
    expect(values).toContain('ENDRING');
    expect(values).toContain('SVIKT');
    expect(values).toContain('ANDRE');
    expect(values).toContain('FORCE_MAJEURE');
  });

  it('should have labels with hjemmel references', () => {
    const endring = HOVEDKATEGORI_OPTIONS.find(o => o.value === 'ENDRING');
    expect(endring?.label).toContain('33.1 a)');
  });
});

describe('UNDERKATEGORI_MAP', () => {
  it('should map all hovedkategorier to their underkategorier', () => {
    expect(UNDERKATEGORI_MAP['ENDRING']).toBeDefined();
    expect(UNDERKATEGORI_MAP['SVIKT']).toBeDefined();
    expect(UNDERKATEGORI_MAP['ANDRE']).toBeDefined();
    expect(UNDERKATEGORI_MAP['FORCE_MAJEURE']).toBeDefined();
  });

  it('should have correct underkategorier for ENDRING', () => {
    const underkategorier = UNDERKATEGORI_MAP['ENDRING'];
    expect(underkategorier.length).toBeGreaterThan(0);

    const koder = underkategorier.map(u => u.value);
    expect(koder).toContain('EO');
    expect(koder).toContain('IRREG');
    expect(koder).toContain('LOV_GJENSTAND');
  });
});

describe('Helper Functions', () => {
  describe('getUnderkategorier', () => {
    it('should return underkategorier for valid hovedkategori', () => {
      const underkategorier = getUnderkategorier('ENDRING');
      expect(underkategorier.length).toBeGreaterThan(0);
      expect(underkategorier[0]).toHaveProperty('value');
      expect(underkategorier[0]).toHaveProperty('label');
    });

    it('should return empty array for invalid hovedkategori', () => {
      const underkategorier = getUnderkategorier('INVALID');
      expect(underkategorier).toEqual([]);
    });
  });

  describe('getHovedkategoriLabel', () => {
    it('should return correct label for valid code', () => {
      expect(getHovedkategoriLabel('ENDRING')).toBe('Endringer');
      expect(getHovedkategoriLabel('SVIKT')).toBe('Forsinkelse eller svikt ved byggherrens ytelser');
      expect(getHovedkategoriLabel('FORCE_MAJEURE')).toBe('Force Majeure');
    });

    it('should return code for invalid code', () => {
      expect(getHovedkategoriLabel('INVALID')).toBe('INVALID');
    });
  });

  describe('getUnderkategoriLabel', () => {
    it('should return correct label for valid code', () => {
      expect(getUnderkategoriLabel('EO')).toBe('Formell endringsordre');
      expect(getUnderkategoriLabel('IRREG')).toBe('Irregulær endring (Pålegg)');
    });

    it('should return code for invalid code', () => {
      expect(getUnderkategoriLabel('INVALID')).toBe('INVALID');
    });
  });

  describe('getHovedkategori', () => {
    it('should return hovedkategori object for valid code', () => {
      const kategori = getHovedkategori('ENDRING');
      expect(kategori).toBeDefined();
      expect(kategori?.kode).toBe('ENDRING');
      expect(kategori?.underkategorier).toBeDefined();
    });

    it('should return undefined for invalid code', () => {
      expect(getHovedkategori('INVALID')).toBeUndefined();
    });
  });

  describe('getUnderkategoriObj', () => {
    it('should return underkategori object for valid code', () => {
      const underkategori = getUnderkategoriObj('EO');
      expect(underkategori).toBeDefined();
      expect(underkategori?.kode).toBe('EO');
      expect(underkategori?.hjemmel_basis).toBe('31.1');
    });

    it('should return undefined for invalid code', () => {
      expect(getUnderkategoriObj('INVALID')).toBeUndefined();
    });
  });

  describe('erLovendring', () => {
    it('should return true for law change codes', () => {
      expect(erLovendring('LOV_GJENSTAND')).toBe(true);
      expect(erLovendring('LOV_PROSESS')).toBe(true);
      expect(erLovendring('GEBYR')).toBe(true);
    });

    it('should return false for non-law change codes', () => {
      expect(erLovendring('EO')).toBe(false);
      expect(erLovendring('IRREG')).toBe(false);
    });
  });

  describe('erForceMajeure', () => {
    it('should return true for FORCE_MAJEURE code', () => {
      expect(erForceMajeure('FORCE_MAJEURE')).toBe(true);
    });

    it('should return false for other codes', () => {
      expect(erForceMajeure('ENDRING')).toBe(false);
      expect(erForceMajeure('SVIKT')).toBe(false);
    });
  });

  describe('erIrregulaerEndring', () => {
    it('should return true for ENDRING + IRREG combination', () => {
      expect(erIrregulaerEndring('ENDRING', 'IRREG')).toBe(true);
    });

    it('should return false for other combinations', () => {
      expect(erIrregulaerEndring('ENDRING', 'EO')).toBe(false);
      expect(erIrregulaerEndring('SVIKT', 'IRREG')).toBe(false);
    });
  });

  describe('getTypeKrav', () => {
    it('should return correct type krav for hovedkategori', () => {
      expect(getTypeKrav('ENDRING')).toBe('Tid og Penger');
      expect(getTypeKrav('SVIKT')).toBe('Tid og Penger');
      expect(getTypeKrav('FORCE_MAJEURE')).toBe('Tid');
    });

    it('should return undefined for invalid code', () => {
      expect(getTypeKrav('INVALID')).toBeUndefined();
    });
  });

  describe('getHjemmelReferanser', () => {
    it('should return correct hjemmel references for hovedkategori only', () => {
      const refs = getHjemmelReferanser('ENDRING');
      expect(refs.frist).toBe('33.1 a)');
      expect(refs.vederlag).toBe('34.1.1');
      expect(refs.varsel).toBe('');
    });

    it('should return correct hjemmel references for hovedkategori + underkategori', () => {
      const refs = getHjemmelReferanser('ENDRING', 'EO');
      expect(refs.frist).toBe('33.1 a)');
      expect(refs.vederlag).toBe('34.1.1');
      expect(refs.varsel).toBe('31.3 (Mottatt ordre)');
    });

    it('should return null for vederlag when Force Majeure', () => {
      const refs = getHjemmelReferanser('FORCE_MAJEURE');
      expect(refs.frist).toBe('33.3');
      expect(refs.vederlag).toBeNull();
    });

    it('should handle invalid codes gracefully', () => {
      const refs = getHjemmelReferanser('INVALID');
      expect(refs.frist).toBe('');
      expect(refs.vederlag).toBeNull();
      expect(refs.varsel).toBe('');
    });
  });
});

describe('Data Integrity', () => {
  it('should have unique hovedkategori codes', () => {
    const koder = KRAV_STRUKTUR_NS8407.map(k => k.kode);
    const uniqueKoder = new Set(koder);
    expect(koder.length).toBe(uniqueKoder.size);
  });

  it('should have unique underkategori codes across all hovedkategorier', () => {
    const allUnderkategorier: string[] = [];
    KRAV_STRUKTUR_NS8407.forEach(hovedkat => {
      hovedkat.underkategorier.forEach(underkat => {
        allUnderkategorier.push(underkat.kode);
      });
    });

    const uniqueUnderkategorier = new Set(allUnderkategorier);
    expect(allUnderkategorier.length).toBe(uniqueUnderkategorier.size);
  });

  it('should have non-empty beskrivelse for all kategorier', () => {
    KRAV_STRUKTUR_NS8407.forEach(hovedkat => {
      expect(hovedkat.beskrivelse).toBeTruthy();
      hovedkat.underkategorier.forEach(underkat => {
        expect(underkat.beskrivelse).toBeTruthy();
      });
    });
  });

  it('should have valid hjemmel references format', () => {
    KRAV_STRUKTUR_NS8407.forEach(hovedkat => {
      expect(hovedkat.hjemmel_frist).toBeTruthy();

      hovedkat.underkategorier.forEach(underkat => {
        expect(underkat.hjemmel_basis).toBeTruthy();
        expect(underkat.varselkrav_ref).toBeTruthy();
      });
    });
  });
});
