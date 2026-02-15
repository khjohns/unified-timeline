/**
 * SendGrunnlagModal Component
 *
 * Thin modal wrapper around SendGrunnlagForm.
 * The form handles all logic; this component only provides the modal shell.
 *
 * MODES:
 * - Create mode (default): Submit new grunnlag with event type 'grunnlag_opprettet'
 * - Update mode (when originalEvent provided): Update existing grunnlag with 'grunnlag_oppdatert'
 */

import { Modal } from '../primitives';
import { SendGrunnlagForm } from './forms/SendGrunnlagForm';
import type { GrunnlagTilstand } from '../../types/timeline';

interface SendGrunnlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
  /** UPDATE MODE: When provided, modal operates in update mode */
  originalEvent?: {
    event_id: string;
    grunnlag: GrunnlagTilstand;
  };
}

export function SendGrunnlagModal({
  open,
  onOpenChange,
  sakId,
  onCatendaWarning,
  originalEvent,
}: SendGrunnlagModalProps) {
  const isUpdateMode = !!originalEvent;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isUpdateMode ? "Oppdater ansvarsgrunnlag" : "Varsle ansvarsgrunnlag"}
      size="lg"
    >
      <SendGrunnlagForm
        sakId={sakId}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        onCatendaWarning={onCatendaWarning}
        originalEvent={originalEvent}
      />
    </Modal>
  );
}
