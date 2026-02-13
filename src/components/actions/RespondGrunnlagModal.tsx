/**
 * RespondGrunnlagModal Component
 *
 * Thin modal wrapper around RespondGrunnlagForm.
 * The form handles all logic; this component only provides the modal shell.
 *
 * MODES:
 * - Create mode (default): Submit new response with event type 'respons_grunnlag'
 * - Update mode (when lastResponseEvent provided): Update existing response with 'respons_grunnlag_oppdatert'
 */

import { Modal } from '../primitives';
import { RespondGrunnlagForm } from './forms/RespondGrunnlagForm';
import type { GrunnlagResponsResultat, SakState } from '../../types/timeline';

// Event data from the grunnlag claim
interface GrunnlagEventInfo {
  hovedkategori?: string;
  underkategori?: string;
  beskrivelse?: string;
  dato_oppdaget?: string;
  dato_varslet?: string;
}

// Form data type (re-declared for onSaveDraft callback typing)
interface RespondGrunnlagFormData {
  grunnlag_varslet_i_tide?: boolean;
  resultat: string;
  begrunnelse: string;
}

interface RespondGrunnlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the grunnlag event being responded to (required for event sourcing) */
  grunnlagEventId: string;
  /** Optional grunnlag event data for context display and logic */
  grunnlagEvent?: GrunnlagEventInfo;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
  /** When true, show "Lagre utkast" instead of "Send svar" for approval workflow */
  approvalEnabled?: boolean;
  /** Callback when saving as draft (for approval workflow) */
  onSaveDraft?: (draftData: {
    resultat: string;
    begrunnelse: string;
    formData: RespondGrunnlagFormData;
  }) => void;
  /** UPDATE MODE: Previous response event to update. If provided, modal operates in update mode. */
  lastResponseEvent?: {
    event_id: string;
    resultat: GrunnlagResponsResultat;
  };
  /** Required in update mode for snuoperasjon logic */
  sakState?: SakState;
}

export function RespondGrunnlagModal({
  open,
  onOpenChange,
  sakId,
  grunnlagEventId,
  grunnlagEvent,
  onCatendaWarning,
  approvalEnabled = false,
  onSaveDraft,
  lastResponseEvent,
  sakState,
}: RespondGrunnlagModalProps) {
  const isUpdateMode = !!lastResponseEvent;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isUpdateMode ? "Oppdater svar på ansvarsgrunnlag" : "Svar på ansvarsgrunnlag"}
      size="lg"
    >
      <RespondGrunnlagForm
        sakId={sakId}
        grunnlagEventId={grunnlagEventId}
        grunnlagEvent={grunnlagEvent}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        onCatendaWarning={onCatendaWarning}
        approvalEnabled={approvalEnabled}
        onSaveDraft={onSaveDraft}
        lastResponseEvent={lastResponseEvent}
        sakState={sakState}
      />
    </Modal>
  );
}
