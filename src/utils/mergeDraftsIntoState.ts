/**
 * Merge Drafts Into State
 *
 * Merges draft response data into SakState for PDF preview.
 * Creates a "preview" state that shows what the PDF will look like
 * after the BH responses are formally sent.
 */

import type { SakState } from '../types/timeline';
import type { DraftResponseData } from '../types/approval';

interface DraftSet {
  grunnlagDraft?: DraftResponseData;
  vederlagDraft?: DraftResponseData;
  fristDraft?: DraftResponseData;
}

/**
 * Merges draft response data into a copy of SakState for PDF preview.
 * This allows previewing what the PDF will look like with the pending responses.
 */
export function mergeDraftsIntoState(
  baseState: SakState,
  drafts: DraftSet
): SakState {
  // Deep clone the base state to avoid mutations
  const merged: SakState = JSON.parse(JSON.stringify(baseState));

  if (drafts.grunnlagDraft && merged.grunnlag) {
    merged.grunnlag = {
      ...merged.grunnlag,
      bh_resultat: drafts.grunnlagDraft.resultat as SakState['grunnlag']['bh_resultat'],
      bh_begrunnelse: drafts.grunnlagDraft.begrunnelse,
    };
  }

  if (drafts.vederlagDraft && merged.vederlag) {
    merged.vederlag = {
      ...merged.vederlag,
      bh_resultat: drafts.vederlagDraft.resultat as SakState['vederlag']['bh_resultat'],
      godkjent_belop: drafts.vederlagDraft.belop,
      bh_begrunnelse: drafts.vederlagDraft.begrunnelse,
    };
  }

  if (drafts.fristDraft && merged.frist) {
    merged.frist = {
      ...merged.frist,
      bh_resultat: drafts.fristDraft.resultat as SakState['frist']['bh_resultat'],
      godkjent_dager: drafts.fristDraft.dager,
      bh_begrunnelse: drafts.fristDraft.begrunnelse,
    };
  }

  return merged;
}
