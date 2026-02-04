/**
 * Unit tests for useActionPermissions hook
 *
 * Tests the business logic for determining available actions based on state and user role.
 */

import { describe, it, expect } from 'vitest';
import { useActionPermissions, UserRole, AvailableActions } from '@/hooks/useActionPermissions';
import { SakState, SporStatus } from '@/types/timeline';

// Helper to create a minimal valid state for testing
function createMockState(overrides: Partial<{
  grunnlagStatus: SporStatus;
  grunnlagLaast: boolean;
  vederlagStatus: SporStatus;
  fristStatus: SporStatus;
  kanUtstedeEo: boolean;
}>): SakState {
  const {
    grunnlagStatus = 'utkast',
    grunnlagLaast = false,
    vederlagStatus = 'utkast',
    fristStatus = 'utkast',
    kanUtstedeEo = false,
  } = overrides;

  return {
    sak_id: 'TEST-001',
    sakstittel: 'Test Case',
    grunnlag: {
      status: grunnlagStatus,
      laast: grunnlagLaast,
      antall_versjoner: 1,
    },
    vederlag: {
      status: vederlagStatus,
      antall_versjoner: 1,
    },
    frist: {
      status: fristStatus,
      antall_versjoner: 1,
    },
    er_subsidiaert_vederlag: false,
    er_subsidiaert_frist: false,
    visningsstatus_vederlag: '',
    visningsstatus_frist: '',
    overordnet_status: 'UTKAST',
    kan_utstede_eo: kanUtstedeEo,
    neste_handling: {
      rolle: 'TE',
      handling: 'Varsle endringsforhold',
      spor: 'grunnlag',
    },
    sum_krevd: 0,
    sum_godkjent: 0,
    antall_events: 1,
  };
}

describe('useActionPermissions', () => {
  describe('TE (Totalentreprenør) actions', () => {
    const role: UserRole = 'TE';

    describe('Send actions (initial submission)', () => {
      it('should allow sending grunnlag when status is utkast', () => {
        const state = createMockState({ grunnlagStatus: 'utkast' });
        const actions = useActionPermissions(state, role);
        expect(actions.canSendGrunnlag).toBe(true);
      });

      it.each<SporStatus>(['sendt', 'under_behandling', 'godkjent', 'avslatt'])(
        'should not allow sending grunnlag when status is %s',
        (status) => {
          const state = createMockState({ grunnlagStatus: status });
          const actions = useActionPermissions(state, role);
          expect(actions.canSendGrunnlag).toBe(false);
        }
      );

      it('should allow sending vederlag when status is utkast', () => {
        const state = createMockState({ vederlagStatus: 'utkast' });
        const actions = useActionPermissions(state, role);
        expect(actions.canSendVederlag).toBe(true);
      });

      it('should allow sending frist when status is utkast', () => {
        const state = createMockState({ fristStatus: 'utkast' });
        const actions = useActionPermissions(state, role);
        expect(actions.canSendFrist).toBe(true);
      });
    });

    describe('Update actions', () => {
      it('should allow updating grunnlag when sendt and not locked', () => {
        const state = createMockState({ grunnlagStatus: 'sendt', grunnlagLaast: false });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateGrunnlag).toBe(true);
      });

      it('should allow updating grunnlag when under_behandling and not locked', () => {
        const state = createMockState({ grunnlagStatus: 'under_behandling', grunnlagLaast: false });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateGrunnlag).toBe(true);
      });

      it('should allow updating grunnlag when avvist and not locked', () => {
        const state = createMockState({ grunnlagStatus: 'avslatt', grunnlagLaast: false });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateGrunnlag).toBe(true);
      });

      it('should not allow updating grunnlag when locked', () => {
        const state = createMockState({ grunnlagStatus: 'sendt', grunnlagLaast: true });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateGrunnlag).toBe(false);
      });

      it('should not allow updating grunnlag when status is utkast', () => {
        const state = createMockState({ grunnlagStatus: 'utkast' });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateGrunnlag).toBe(false);
      });

      it('should allow updating vederlag when sendt', () => {
        const state = createMockState({ vederlagStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateVederlag).toBe(true);
      });

      it('should allow updating vederlag when under_behandling', () => {
        const state = createMockState({ vederlagStatus: 'under_behandling' });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateVederlag).toBe(true);
      });

      it('should allow updating vederlag when avvist', () => {
        const state = createMockState({ vederlagStatus: 'avslatt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateVederlag).toBe(true);
      });

      it('should allow updating frist when sendt', () => {
        const state = createMockState({ fristStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateFrist).toBe(true);
      });

      it('should allow updating frist when under_behandling', () => {
        const state = createMockState({ fristStatus: 'under_behandling' });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateFrist).toBe(true);
      });

      it('should allow updating frist when avvist', () => {
        const state = createMockState({ fristStatus: 'avslatt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateFrist).toBe(true);
      });
    });

    describe('Withdraw actions', () => {
      it('should allow withdrawing grunnlag when sendt and not locked', () => {
        const state = createMockState({ grunnlagStatus: 'sendt', grunnlagLaast: false });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawGrunnlag).toBe(true);
      });

      it('should allow withdrawing grunnlag when under_behandling and not locked', () => {
        const state = createMockState({ grunnlagStatus: 'under_behandling', grunnlagLaast: false });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawGrunnlag).toBe(true);
      });

      it('should not allow withdrawing grunnlag when locked', () => {
        const state = createMockState({ grunnlagStatus: 'sendt', grunnlagLaast: true });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawGrunnlag).toBe(false);
      });

      it('should allow withdrawing grunnlag when avslatt (TE kan alltid trekke unntatt godkjent)', () => {
        const state = createMockState({ grunnlagStatus: 'avslatt', grunnlagLaast: false });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawGrunnlag).toBe(true);
      });

      it('should not allow withdrawing grunnlag when godkjent', () => {
        const state = createMockState({ grunnlagStatus: 'godkjent', grunnlagLaast: false });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawGrunnlag).toBe(false);
      });

      it('should allow withdrawing vederlag when sendt', () => {
        const state = createMockState({ vederlagStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawVederlag).toBe(true);
      });

      it('should allow withdrawing vederlag when under_behandling', () => {
        const state = createMockState({ vederlagStatus: 'under_behandling' });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawVederlag).toBe(true);
      });

      it('should allow withdrawing vederlag when avslatt (TE kan alltid trekke unntatt godkjent)', () => {
        const state = createMockState({ vederlagStatus: 'avslatt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawVederlag).toBe(true);
      });

      it('should not allow withdrawing vederlag when godkjent', () => {
        const state = createMockState({ vederlagStatus: 'godkjent' });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawVederlag).toBe(false);
      });

      it('should allow withdrawing frist when sendt', () => {
        const state = createMockState({ fristStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawFrist).toBe(true);
      });

      it('should allow withdrawing frist when under_behandling', () => {
        const state = createMockState({ fristStatus: 'under_behandling' });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawFrist).toBe(true);
      });
    });

    describe('TE cannot respond to claims', () => {
      it('should not allow responding to grunnlag', () => {
        const state = createMockState({ grunnlagStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canRespondToGrunnlag).toBe(false);
      });

      it('should not allow responding to vederlag', () => {
        const state = createMockState({ vederlagStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canRespondToVederlag).toBe(false);
      });

      it('should not allow responding to frist', () => {
        const state = createMockState({ fristStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canRespondToFrist).toBe(false);
      });
    });
  });

  describe('BH (Byggherre) actions', () => {
    const role: UserRole = 'BH';

    describe('BH cannot send initial claims', () => {
      it('should not allow sending grunnlag', () => {
        const state = createMockState({ grunnlagStatus: 'utkast' });
        const actions = useActionPermissions(state, role);
        expect(actions.canSendGrunnlag).toBe(false);
      });

      it('should not allow sending vederlag', () => {
        const state = createMockState({ vederlagStatus: 'utkast' });
        const actions = useActionPermissions(state, role);
        expect(actions.canSendVederlag).toBe(false);
      });

      it('should not allow sending frist', () => {
        const state = createMockState({ fristStatus: 'utkast' });
        const actions = useActionPermissions(state, role);
        expect(actions.canSendFrist).toBe(false);
      });
    });

    describe('BH cannot update claims', () => {
      it('should not allow updating grunnlag', () => {
        const state = createMockState({ grunnlagStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateGrunnlag).toBe(false);
      });

      it('should not allow updating vederlag', () => {
        const state = createMockState({ vederlagStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateVederlag).toBe(false);
      });

      it('should not allow updating frist', () => {
        const state = createMockState({ fristStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canUpdateFrist).toBe(false);
      });
    });

    describe('BH cannot withdraw claims', () => {
      it('should not allow withdrawing grunnlag', () => {
        const state = createMockState({ grunnlagStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawGrunnlag).toBe(false);
      });

      it('should not allow withdrawing vederlag', () => {
        const state = createMockState({ vederlagStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawVederlag).toBe(false);
      });

      it('should not allow withdrawing frist', () => {
        const state = createMockState({ fristStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canWithdrawFrist).toBe(false);
      });
    });

    describe('Response actions', () => {
      it('should allow responding to grunnlag when sendt', () => {
        const state = createMockState({ grunnlagStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canRespondToGrunnlag).toBe(true);
      });

      it('should allow responding to grunnlag when under_behandling', () => {
        const state = createMockState({ grunnlagStatus: 'under_behandling' });
        const actions = useActionPermissions(state, role);
        expect(actions.canRespondToGrunnlag).toBe(true);
      });

      it('should not allow responding to grunnlag when utkast', () => {
        const state = createMockState({ grunnlagStatus: 'utkast' });
        const actions = useActionPermissions(state, role);
        expect(actions.canRespondToGrunnlag).toBe(false);
      });

      it('should not allow responding to grunnlag when already godkjent', () => {
        const state = createMockState({ grunnlagStatus: 'godkjent' });
        const actions = useActionPermissions(state, role);
        expect(actions.canRespondToGrunnlag).toBe(false);
      });

      it('should allow responding to vederlag when sendt', () => {
        const state = createMockState({ vederlagStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canRespondToVederlag).toBe(true);
      });

      it('should allow responding to vederlag when under_behandling', () => {
        const state = createMockState({ vederlagStatus: 'under_behandling' });
        const actions = useActionPermissions(state, role);
        expect(actions.canRespondToVederlag).toBe(true);
      });

      it('should allow responding to frist when sendt', () => {
        const state = createMockState({ fristStatus: 'sendt' });
        const actions = useActionPermissions(state, role);
        expect(actions.canRespondToFrist).toBe(true);
      });

      it('should allow responding to frist when under_behandling', () => {
        const state = createMockState({ fristStatus: 'under_behandling' });
        const actions = useActionPermissions(state, role);
        expect(actions.canRespondToFrist).toBe(true);
      });
    });
  });

  describe('EO (Endringsordre) issuance', () => {
    it('should reflect kan_utstede_eo from state', () => {
      const stateWithEo = createMockState({ kanUtstedeEo: true });
      const stateWithoutEo = createMockState({ kanUtstedeEo: false });

      const actionsWithEo = useActionPermissions(stateWithEo, 'TE');
      const actionsWithoutEo = useActionPermissions(stateWithoutEo, 'TE');

      expect(actionsWithEo.canIssueEO).toBe(true);
      expect(actionsWithoutEo.canIssueEO).toBe(false);
    });

    it('should be available for both roles when enabled', () => {
      const state = createMockState({ kanUtstedeEo: true });

      const teActions = useActionPermissions(state, 'TE');
      const bhActions = useActionPermissions(state, 'BH');

      expect(teActions.canIssueEO).toBe(true);
      expect(bhActions.canIssueEO).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle laast status correctly for grunnlag', () => {
      const state = createMockState({ grunnlagStatus: 'laast' });
      const teActions = useActionPermissions(state, 'TE');
      const bhActions = useActionPermissions(state, 'BH');

      // Cannot send, update, withdraw, or respond to locked grunnlag
      expect(teActions.canSendGrunnlag).toBe(false);
      expect(teActions.canUpdateGrunnlag).toBe(false);
      expect(teActions.canWithdrawGrunnlag).toBe(false);
      expect(bhActions.canRespondToGrunnlag).toBe(false);
    });

    it('should handle trukket status correctly', () => {
      const state = createMockState({ grunnlagStatus: 'trukket' });
      const teActions = useActionPermissions(state, 'TE');
      const bhActions = useActionPermissions(state, 'BH');

      expect(teActions.canSendGrunnlag).toBe(false);
      expect(teActions.canUpdateGrunnlag).toBe(false);
      expect(teActions.canWithdrawGrunnlag).toBe(false);
      expect(bhActions.canRespondToGrunnlag).toBe(false);
    });

    it('should handle ikke_relevant status correctly', () => {
      const state = createMockState({ vederlagStatus: 'ikke_relevant' });
      const teActions = useActionPermissions(state, 'TE');

      expect(teActions.canSendVederlag).toBe(false);
      expect(teActions.canUpdateVederlag).toBe(false);
      expect(teActions.canWithdrawVederlag).toBe(false);
    });

    it('should return all fields as booleans', () => {
      const state = createMockState({});
      const actions = useActionPermissions(state, 'TE');

      const expectedFields: (keyof AvailableActions)[] = [
        'canSendGrunnlag',
        'canSendVederlag',
        'canSendFrist',
        'canUpdateGrunnlag',
        'canUpdateVederlag',
        'canUpdateFrist',
        'canWithdrawGrunnlag',
        'canWithdrawVederlag',
        'canWithdrawFrist',
        'canRespondToGrunnlag',
        'canRespondToVederlag',
        'canRespondToFrist',
        'canUpdateGrunnlagResponse',
        'canUpdateVederlagResponse',
        'canUpdateFristResponse',
        'canSendForsering',
        'canIssueEO',
      ];

      for (const field of expectedFields) {
        expect(typeof actions[field]).toBe('boolean');
      }
    });
  });

  describe('BH Response Updates (Snuoperasjoner)', () => {
    const role: UserRole = 'BH';

    it('should allow updating grunnlag response when BH has responded to current version', () => {
      const state = createMockState({ grunnlagStatus: 'sendt' });
      state.grunnlag.bh_resultat = 'godkjent';
      state.grunnlag.bh_respondert_versjon = 0; // Responded to version 0
      state.grunnlag.antall_versjoner = 1; // Current version is 0 (1-1=0)

      const actions = useActionPermissions(state, role);
      expect(actions.canUpdateGrunnlagResponse).toBe(true);
    });

    it('should not allow updating grunnlag response when BH responded to old version', () => {
      const state = createMockState({ grunnlagStatus: 'sendt' });
      state.grunnlag.bh_resultat = 'godkjent';
      state.grunnlag.bh_respondert_versjon = 0; // Responded to version 0
      state.grunnlag.antall_versjoner = 2; // Current version is 1 (2-1=1)

      const actions = useActionPermissions(state, role);
      expect(actions.canUpdateGrunnlagResponse).toBe(false);
    });

    it('should not allow updating grunnlag response when BH has not responded', () => {
      const state = createMockState({ grunnlagStatus: 'sendt' });
      state.grunnlag.bh_resultat = null;

      const actions = useActionPermissions(state, role);
      expect(actions.canUpdateGrunnlagResponse).toBe(false);
    });

    it('should allow updating vederlag response when BH has responded to current version', () => {
      const state = createMockState({ vederlagStatus: 'godkjent' });
      state.vederlag.bh_resultat = 'godkjent';
      state.vederlag.bh_respondert_versjon = 1;
      state.vederlag.antall_versjoner = 2; // Current version is 1

      const actions = useActionPermissions(state, role);
      expect(actions.canUpdateVederlagResponse).toBe(true);
    });

    it('should allow updating frist response when BH has responded to current version', () => {
      const state = createMockState({ fristStatus: 'delvis_godkjent' });
      state.frist.bh_resultat = 'delvis_godkjent';
      state.frist.bh_respondert_versjon = 0;
      state.frist.antall_versjoner = 1;

      const actions = useActionPermissions(state, role);
      expect(actions.canUpdateFristResponse).toBe(true);
    });

    it('TE should not be able to update BH responses', () => {
      const state = createMockState({ grunnlagStatus: 'godkjent' });
      state.grunnlag.bh_resultat = 'godkjent';
      state.grunnlag.bh_respondert_versjon = 0;
      state.grunnlag.antall_versjoner = 1;

      const actions = useActionPermissions(state, 'TE');
      expect(actions.canUpdateGrunnlagResponse).toBe(false);
      expect(actions.canUpdateVederlagResponse).toBe(false);
      expect(actions.canUpdateFristResponse).toBe(false);
    });
  });

  describe('Forsering (§33.8)', () => {
    const role: UserRole = 'TE';

    it('should allow sending forsering when frist is rejected', () => {
      const state = createMockState({ fristStatus: 'avslatt' });
      state.frist.bh_resultat = 'avslatt';

      const actions = useActionPermissions(state, role);
      expect(actions.canSendForsering).toBe(true);
    });

    it('should allow sending forsering when frist is partially approved', () => {
      const state = createMockState({ fristStatus: 'delvis_godkjent' });
      state.frist.bh_resultat = 'delvis_godkjent';

      const actions = useActionPermissions(state, role);
      expect(actions.canSendForsering).toBe(true);
    });

    it('should allow sending forsering when grunnlag is rejected (implies frist rejection)', () => {
      const state = createMockState({ grunnlagStatus: 'avslatt', fristStatus: 'sendt' });
      state.grunnlag.bh_resultat = 'avslatt';
      state.frist.bh_resultat = 'avslatt'; // Must have bh_resultat to trigger

      const actions = useActionPermissions(state, role);
      expect(actions.canSendForsering).toBe(true);
    });

    it('should not allow sending forsering when frist is approved', () => {
      const state = createMockState({ fristStatus: 'godkjent' });
      state.frist.bh_resultat = 'godkjent';

      const actions = useActionPermissions(state, role);
      expect(actions.canSendForsering).toBe(false);
    });

    it('should not allow sending forsering when BH has not responded to frist', () => {
      const state = createMockState({ fristStatus: 'sendt' });
      state.frist.bh_resultat = null;

      const actions = useActionPermissions(state, role);
      expect(actions.canSendForsering).toBe(false);
    });

    it('BH should not be able to send forsering', () => {
      const state = createMockState({ fristStatus: 'avslatt' });
      state.frist.bh_resultat = 'avslatt';

      const actions = useActionPermissions(state, 'BH');
      expect(actions.canSendForsering).toBe(false);
    });
  });

  describe('Force Majeure (§33.3)', () => {
    it('should not allow sending vederlag when grunnlag is Force Majeure', () => {
      const state = createMockState({ vederlagStatus: 'utkast' });
      state.grunnlag.hovedkategori = 'FORCE_MAJEURE';

      const actions = useActionPermissions(state, 'TE');
      expect(actions.canSendVederlag).toBe(false);
    });

    it('should allow sending frist when grunnlag is Force Majeure', () => {
      const state = createMockState({ fristStatus: 'utkast' });
      state.grunnlag.hovedkategori = 'FORCE_MAJEURE';

      const actions = useActionPermissions(state, 'TE');
      expect(actions.canSendFrist).toBe(true);
    });

    it('should allow sending vederlag when grunnlag is not Force Majeure', () => {
      const state = createMockState({ vederlagStatus: 'utkast' });
      state.grunnlag.hovedkategori = 'ENDRING_PAALAGTE_KRAV';

      const actions = useActionPermissions(state, 'TE');
      expect(actions.canSendVederlag).toBe(true);
    });
  });

  describe('Versioning - harSvartPaaGjeldendeVersjon logic', () => {
    const role: UserRole = 'BH';

    it('should allow responding when BH has not responded yet', () => {
      const state = createMockState({ grunnlagStatus: 'sendt' });
      state.grunnlag.bh_resultat = null;
      state.grunnlag.bh_respondert_versjon = undefined;
      state.grunnlag.antall_versjoner = 1;

      const actions = useActionPermissions(state, role);
      expect(actions.canRespondToGrunnlag).toBe(true);
      expect(actions.canUpdateGrunnlagResponse).toBe(false);
    });

    it('should allow responding when TE has updated after BH response', () => {
      const state = createMockState({ grunnlagStatus: 'sendt' });
      state.grunnlag.bh_resultat = 'godkjent';
      state.grunnlag.bh_respondert_versjon = 0;
      state.grunnlag.antall_versjoner = 2; // TE updated, now at version 1

      const actions = useActionPermissions(state, role);
      expect(actions.canRespondToGrunnlag).toBe(true); // Can respond to new version
      expect(actions.canUpdateGrunnlagResponse).toBe(false); // Cannot update old response
    });

    it('should allow updating response when BH responded to current version', () => {
      const state = createMockState({ grunnlagStatus: 'sendt' });
      state.grunnlag.bh_resultat = 'avslatt';
      state.grunnlag.bh_respondert_versjon = 2;
      state.grunnlag.antall_versjoner = 3; // Current version is 2 (3-1)

      const actions = useActionPermissions(state, role);
      expect(actions.canRespondToGrunnlag).toBe(false); // Already responded
      expect(actions.canUpdateGrunnlagResponse).toBe(true); // Can update
    });

    it('should handle version 0 correctly (original submission)', () => {
      const state = createMockState({ vederlagStatus: 'sendt' });
      state.vederlag.bh_resultat = 'godkjent';
      state.vederlag.bh_respondert_versjon = 0;
      state.vederlag.antall_versjoner = 1; // Only original, version 0

      const actions = useActionPermissions(state, role);
      expect(actions.canRespondToVederlag).toBe(false);
      expect(actions.canUpdateVederlagResponse).toBe(true);
    });
  });

  describe('delvis_godkjent status', () => {
    it('should allow TE to update grunnlag when partially approved', () => {
      const state = createMockState({ grunnlagStatus: 'delvis_godkjent', grunnlagLaast: false });
      const actions = useActionPermissions(state, 'TE');
      expect(actions.canUpdateGrunnlag).toBe(true);
    });

    it('should allow TE to update vederlag when partially approved', () => {
      const state = createMockState({ vederlagStatus: 'delvis_godkjent' });
      const actions = useActionPermissions(state, 'TE');
      expect(actions.canUpdateVederlag).toBe(true);
    });

    it('should allow TE to update frist when partially approved', () => {
      const state = createMockState({ fristStatus: 'delvis_godkjent' });
      const actions = useActionPermissions(state, 'TE');
      expect(actions.canUpdateFrist).toBe(true);
    });
  });
});
