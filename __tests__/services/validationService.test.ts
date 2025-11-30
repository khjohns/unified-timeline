/**
 * Unit tests for validationService
 *
 * Tests pure validation functions without React dependencies
 */

import { describe, it, expect } from 'vitest';
import { validationService } from '../../services/validationService';
import { INITIAL_FORM_DATA } from '../../config';
import type { FormDataModel } from '../../types';

describe('validationService', () => {
  describe('validateVarsel', () => {
    it('should return valid when all required fields are filled', () => {
      const varsel: FormDataModel['varsel'] = {
        ...INITIAL_FORM_DATA.varsel,
        dato_forhold_oppdaget: '2025-11-20',
        hovedkategori: 'Risiko',
      };

      const result = validationService.validateVarsel(varsel);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
      expect(result.firstInvalidFieldId).toBeNull();
    });

    it('should return error when dato_forhold_oppdaget is missing', () => {
      const varsel: FormDataModel['varsel'] = {
        ...INITIAL_FORM_DATA.varsel,
        dato_forhold_oppdaget: '',
        hovedkategori: 'Risiko',
      };

      const result = validationService.validateVarsel(varsel);

      expect(result.isValid).toBe(false);
      expect(result.errors['varsel.dato_forhold_oppdaget']).toBe('Dato forhold oppdaget er påkrevd');
      expect(result.firstInvalidFieldId).toBe('varsel.dato_forhold_oppdaget');
    });

    it('should return error when hovedkategori is missing', () => {
      const varsel: FormDataModel['varsel'] = {
        ...INITIAL_FORM_DATA.varsel,
        dato_forhold_oppdaget: '2025-11-20',
        hovedkategori: '',
      };

      const result = validationService.validateVarsel(varsel);

      expect(result.isValid).toBe(false);
      expect(result.errors['varsel.hovedkategori']).toBe('Hovedkategori er påkrevd');
      expect(result.firstInvalidFieldId).toBe('varsel.hovedkategori');
    });

    it('should return multiple errors when multiple fields are missing', () => {
      const varsel: FormDataModel['varsel'] = {
        ...INITIAL_FORM_DATA.varsel,
        dato_forhold_oppdaget: '',
        hovedkategori: '',
      };

      const result = validationService.validateVarsel(varsel);

      expect(result.isValid).toBe(false);
      expect(Object.keys(result.errors).length).toBe(2);
      expect(result.errors['varsel.dato_forhold_oppdaget']).toBeDefined();
      expect(result.errors['varsel.hovedkategori']).toBeDefined();
      expect(result.firstInvalidFieldId).toBe('varsel.dato_forhold_oppdaget');
    });

    it('should trim whitespace when checking required fields', () => {
      const varsel: FormDataModel['varsel'] = {
        ...INITIAL_FORM_DATA.varsel,
        dato_forhold_oppdaget: '   ',
        hovedkategori: '  ',
      };

      const result = validationService.validateVarsel(varsel);

      expect(result.isValid).toBe(false);
      expect(Object.keys(result.errors).length).toBe(2);
    });
  });

  describe('validateKoe', () => {
    it('should return valid when vederlag claim is properly filled', () => {
      const koeRevisjoner: FormDataModel['koe_revisjoner'] = [
        {
          ...INITIAL_FORM_DATA.koe_revisjoner[0],
          koe_revisjonsnr: '1',
          for_entreprenor: 'test@example.com',
          vederlag: {
            ...INITIAL_FORM_DATA.koe_revisjoner[0].vederlag,
            krav_vederlag: true,
            krav_vederlag_metode: 'Regning',
            krav_vederlag_belop: '100000',
            krav_vederlag_begrunnelse: 'Test begrunnelse',
          },
        },
      ];

      const result = validationService.validateKoe(koeRevisjoner);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
      expect(result.firstInvalidFieldId).toBeNull();
    });

    it('should return valid when frist claim is properly filled', () => {
      const koeRevisjoner: FormDataModel['koe_revisjoner'] = [
        {
          ...INITIAL_FORM_DATA.koe_revisjoner[0],
          koe_revisjonsnr: '1',
          for_entreprenor: 'test@example.com',
          frist: {
            ...INITIAL_FORM_DATA.koe_revisjoner[0].frist,
            krav_fristforlengelse: true,
            krav_frist_type: 'Suspensjon',
            krav_frist_antall_dager: '14',
            krav_frist_begrunnelse: 'Test begrunnelse',
          },
        },
      ];

      const result = validationService.validateKoe(koeRevisjoner);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should require at least one claim type to be selected', () => {
      const koeRevisjoner: FormDataModel['koe_revisjoner'] = [
        {
          ...INITIAL_FORM_DATA.koe_revisjoner[0],
          koe_revisjonsnr: '1',
          for_entreprenor: 'test@example.com',
          vederlag: {
            ...INITIAL_FORM_DATA.koe_revisjoner[0].vederlag,
            krav_vederlag: false,
          },
          frist: {
            ...INITIAL_FORM_DATA.koe_revisjoner[0].frist,
            krav_fristforlengelse: false,
          },
        },
      ];

      const result = validationService.validateKoe(koeRevisjoner);

      expect(result.isValid).toBe(false);
      expect(result.errors['krav_type']).toBe('Du må velge minst ett krav (vederlag eller fristforlengelse)');
    });

    it('should validate vederlag fields when vederlag is selected', () => {
      const koeRevisjoner: FormDataModel['koe_revisjoner'] = [
        {
          ...INITIAL_FORM_DATA.koe_revisjoner[0],
          koe_revisjonsnr: '1',
          for_entreprenor: 'test@example.com',
          vederlag: {
            ...INITIAL_FORM_DATA.koe_revisjoner[0].vederlag,
            krav_vederlag: true,
            krav_vederlag_metode: '',
            krav_vederlag_belop: '',
            krav_vederlag_begrunnelse: '',
          },
        },
      ];

      const result = validationService.validateKoe(koeRevisjoner);

      expect(result.isValid).toBe(false);
      expect(result.errors['koe.vederlag.krav_vederlag_metode']).toBe('Oppgjørsmetode er påkrevd');
      expect(result.errors['koe.vederlag.krav_vederlag_belop']).toBe('Krevd beløp er påkrevd');
      expect(result.errors['koe.vederlag.krav_vederlag_begrunnelse']).toBe('Begrunnelse for vederlagskrav er påkrevd');
    });

    it('should require vederlag belop to be greater than zero', () => {
      const koeRevisjoner: FormDataModel['koe_revisjoner'] = [
        {
          ...INITIAL_FORM_DATA.koe_revisjoner[0],
          koe_revisjonsnr: '1',
          for_entreprenor: 'test@example.com',
          vederlag: {
            ...INITIAL_FORM_DATA.koe_revisjoner[0].vederlag,
            krav_vederlag: true,
            krav_vederlag_metode: 'Regning',
            krav_vederlag_belop: '0',
            krav_vederlag_begrunnelse: 'Test',
          },
        },
      ];

      const result = validationService.validateKoe(koeRevisjoner);

      expect(result.isValid).toBe(false);
      expect(result.errors['koe.vederlag.krav_vederlag_belop']).toBe('Krevd beløp er påkrevd');
    });

    it('should validate frist fields when frist is selected', () => {
      const koeRevisjoner: FormDataModel['koe_revisjoner'] = [
        {
          ...INITIAL_FORM_DATA.koe_revisjoner[0],
          koe_revisjonsnr: '1',
          for_entreprenor: 'test@example.com',
          frist: {
            ...INITIAL_FORM_DATA.koe_revisjoner[0].frist,
            krav_fristforlengelse: true,
            krav_frist_type: '',
            krav_frist_antall_dager: '',
            krav_frist_begrunnelse: '',
          },
        },
      ];

      const result = validationService.validateKoe(koeRevisjoner);

      expect(result.isValid).toBe(false);
      expect(result.errors['koe.frist.krav_frist_type']).toBe('Type fristkrav er påkrevd');
      expect(result.errors['koe.frist.krav_frist_antall_dager']).toBe('Antall dager fristforlengelse er påkrevd');
      expect(result.errors['koe.frist.krav_frist_begrunnelse']).toBe('Begrunnelse for fristforlengelse er påkrevd');
    });

    it('should require email signature', () => {
      const koeRevisjoner: FormDataModel['koe_revisjoner'] = [
        {
          ...INITIAL_FORM_DATA.koe_revisjoner[0],
          koe_revisjonsnr: '1',
          for_entreprenor: '',
          vederlag: {
            ...INITIAL_FORM_DATA.koe_revisjoner[0].vederlag,
            krav_vederlag: true,
            krav_vederlag_metode: 'Regning',
            krav_vederlag_belop: '100000',
            krav_vederlag_begrunnelse: 'Test',
          },
        },
      ];

      const result = validationService.validateKoe(koeRevisjoner);

      expect(result.isValid).toBe(false);
      expect(result.errors['koe.signerende_epost']).toBe('E-post for signering må valideres');
    });

    it('should validate only the latest revision', () => {
      const koeRevisjoner: FormDataModel['koe_revisjoner'] = [
        // First revision (invalid but should be ignored)
        {
          ...INITIAL_FORM_DATA.koe_revisjoner[0],
          koe_revisjonsnr: '1',
          for_entreprenor: '',
          vederlag: {
            ...INITIAL_FORM_DATA.koe_revisjoner[0].vederlag,
            krav_vederlag: false,
          },
          frist: {
            ...INITIAL_FORM_DATA.koe_revisjoner[0].frist,
            krav_fristforlengelse: false,
          },
        },
        // Second revision (valid)
        {
          ...INITIAL_FORM_DATA.koe_revisjoner[0],
          koe_revisjonsnr: '2',
          for_entreprenor: 'test@example.com',
          vederlag: {
            ...INITIAL_FORM_DATA.koe_revisjoner[0].vederlag,
            krav_vederlag: true,
            krav_vederlag_metode: 'Regning',
            krav_vederlag_belop: '100000',
            krav_vederlag_begrunnelse: 'Test',
          },
        },
      ];

      const result = validationService.validateKoe(koeRevisjoner);

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateTab', () => {
    it('should validate Varsel tab when activeTab is 0', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        varsel: {
          ...INITIAL_FORM_DATA.varsel,
          dato_forhold_oppdaget: '',
        },
      };

      const result = validationService.validateTab(formData, 0);

      expect(result.isValid).toBe(false);
      expect(result.errors['varsel.dato_forhold_oppdaget']).toBeDefined();
    });

    it('should validate KOE tab when activeTab is 1', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        koe_revisjoner: [
          {
            ...INITIAL_FORM_DATA.koe_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.koe_revisjoner[0].vederlag,
              krav_vederlag: false,
            },
            frist: {
              ...INITIAL_FORM_DATA.koe_revisjoner[0].frist,
              krav_fristforlengelse: false,
            },
          },
        ],
      };

      const result = validationService.validateTab(formData, 1);

      expect(result.isValid).toBe(false);
      expect(result.errors['krav_type']).toBeDefined();
    });

    it('should return valid for BH Svar tab (no validation yet)', () => {
      const result = validationService.validateTab(INITIAL_FORM_DATA, 2);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should return valid for unknown tabs', () => {
      const result = validationService.validateTab(INITIAL_FORM_DATA, 99);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });
  });
});
