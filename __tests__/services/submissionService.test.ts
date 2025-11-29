/**
 * Unit tests for submissionService
 *
 * Tests pure status/modus transition functions
 */

import { describe, it, expect } from 'vitest';
import { submissionService } from '../../services/submissionService';
import { INITIAL_FORM_DATA } from '../../constants';
import { SAK_STATUS } from '../../utils/statusHelpers';
import type { FormDataModel } from '../../types';

describe('submissionService', () => {
  describe('getVarselTransition', () => {
    it('should transition from varsel to koe', () => {
      const transition = submissionService.getVarselTransition();

      expect(transition.nextStatus).toBe(SAK_STATUS.VARSLET);
      expect(transition.nextModus).toBe('koe');
      expect(transition.requiresRevision).toBeUndefined();
    });
  });

  describe('getSvarTransition', () => {
    it('should require revision when BH partially approves vederlag', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '100000001', // Delvis godkjent
            },
          },
        ],
      };

      const transition = submissionService.getSvarTransition(formData);

      expect(transition.nextStatus).toBe(SAK_STATUS.VURDERES_AV_TE);
      expect(transition.nextModus).toBe('revidering');
      expect(transition.requiresRevision).toBe(true);
    });

    it('should require revision when BH rejects vederlag (uenig)', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '100000002', // Avslått uenig
            },
          },
        ],
      };

      const transition = submissionService.getSvarTransition(formData);

      expect(transition.nextStatus).toBe(SAK_STATUS.VURDERES_AV_TE);
      expect(transition.nextModus).toBe('revidering');
      expect(transition.requiresRevision).toBe(true);
    });

    it('should require revision when BH rejects varsel (for sent)', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '100000003', // Avslått for sent
            },
          },
        ],
      };

      const transition = submissionService.getSvarTransition(formData);

      expect(transition.nextStatus).toBe(SAK_STATUS.VURDERES_AV_TE);
      expect(transition.nextModus).toBe('revidering');
      expect(transition.requiresRevision).toBe(true);
    });

    it('should require revision when BH awaits more details', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '100000004', // Avventer
            },
          },
        ],
      };

      const transition = submissionService.getSvarTransition(formData);

      expect(transition.nextStatus).toBe(SAK_STATUS.VURDERES_AV_TE);
      expect(transition.nextModus).toBe('revidering');
      expect(transition.requiresRevision).toBe(true);
    });

    it('should require revision when BH partially approves frist', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            frist: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].frist,
              bh_svar_frist: '100000001', // Delvis godkjent
            },
          },
        ],
      };

      const transition = submissionService.getSvarTransition(formData);

      expect(transition.nextStatus).toBe(SAK_STATUS.VURDERES_AV_TE);
      expect(transition.nextModus).toBe('revidering');
      expect(transition.requiresRevision).toBe(true);
    });

    it('should finalize (omforent) when BH fully approves', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '100000005', // Not a revision code
            },
            frist: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].frist,
              bh_svar_frist: '100000005', // Not a revision code
            },
          },
        ],
      };

      const transition = submissionService.getSvarTransition(formData);

      expect(transition.nextStatus).toBe(SAK_STATUS.OMFORENT);
      expect(transition.nextModus).toBe('ferdig');
      expect(transition.requiresRevision).toBe(false);
    });

    it('should finalize when BH response codes are empty', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '',
            },
            frist: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].frist,
              bh_svar_frist: '',
            },
          },
        ],
      };

      const transition = submissionService.getSvarTransition(formData);

      expect(transition.nextStatus).toBe(SAK_STATUS.OMFORENT);
      expect(transition.nextModus).toBe('ferdig');
      expect(transition.requiresRevision).toBe(false);
    });

    it('should check only the latest BH svar revision', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          // First revision - requires revision (but should be ignored)
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '100000001', // Delvis godkjent
            },
          },
          // Second revision - approved (this should be used)
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '100000005', // Approved
            },
          },
        ],
      };

      const transition = submissionService.getSvarTransition(formData);

      expect(transition.nextStatus).toBe(SAK_STATUS.OMFORENT);
      expect(transition.nextModus).toBe('ferdig');
      expect(transition.requiresRevision).toBe(false);
    });
  });

  describe('getRevideringTransition', () => {
    it('should transition from revidering to svar', () => {
      const transition = submissionService.getRevideringTransition();

      expect(transition.nextStatus).toBe(SAK_STATUS.VENTER_PAA_SVAR);
      expect(transition.nextModus).toBe('svar');
      expect(transition.requiresRevision).toBeUndefined();
    });
  });

  describe('getKoeTransition', () => {
    it('should transition from koe to svar', () => {
      const transition = submissionService.getKoeTransition();

      expect(transition.nextStatus).toBe(SAK_STATUS.VENTER_PAA_SVAR);
      expect(transition.nextModus).toBe('svar');
      expect(transition.requiresRevision).toBeUndefined();
    });
  });

  describe('getTransition', () => {
    it('should route to varsel transition when modus is varsel', () => {
      const transition = submissionService.getTransition('varsel', INITIAL_FORM_DATA);

      expect(transition.nextStatus).toBe(SAK_STATUS.VARSLET);
      expect(transition.nextModus).toBe('koe');
    });

    it('should route to svar transition when modus is svar', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '100000001', // Requires revision
            },
          },
        ],
      };

      const transition = submissionService.getTransition('svar', formData);

      expect(transition.nextStatus).toBe(SAK_STATUS.VURDERES_AV_TE);
      expect(transition.nextModus).toBe('revidering');
    });

    it('should route to revidering transition when modus is revidering', () => {
      const transition = submissionService.getTransition('revidering', INITIAL_FORM_DATA);

      expect(transition.nextStatus).toBe(SAK_STATUS.VENTER_PAA_SVAR);
      expect(transition.nextModus).toBe('svar');
    });

    it('should route to koe transition when modus is koe', () => {
      const transition = submissionService.getTransition('koe', INITIAL_FORM_DATA);

      expect(transition.nextStatus).toBe(SAK_STATUS.VENTER_PAA_SVAR);
      expect(transition.nextModus).toBe('svar');
    });

    it('should default to koe transition when modus is null', () => {
      const transition = submissionService.getTransition(null, INITIAL_FORM_DATA);

      expect(transition.nextStatus).toBe(SAK_STATUS.VENTER_PAA_SVAR);
      expect(transition.nextModus).toBe('svar');
    });
  });

  describe('requiresRevision', () => {
    it('should return true when BH response requires revision', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '100000001', // Delvis godkjent
            },
          },
        ],
      };

      const result = submissionService.requiresRevision(formData);

      expect(result).toBe(true);
    });

    it('should return false when BH response does not require revision', () => {
      const formData: FormDataModel = {
        ...INITIAL_FORM_DATA,
        bh_svar_revisjoner: [
          {
            ...INITIAL_FORM_DATA.bh_svar_revisjoner[0],
            vederlag: {
              ...INITIAL_FORM_DATA.bh_svar_revisjoner[0].vederlag,
              bh_svar_vederlag: '100000005', // Approved
            },
          },
        ],
      };

      const result = submissionService.requiresRevision(formData);

      expect(result).toBe(false);
    });
  });
});
