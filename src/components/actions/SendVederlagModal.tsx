/**
 * SendVederlagModal Component
 *
 * Thin modal wrapper around SendVederlagForm.
 * The form handles all logic; this component only provides the modal shell.
 */

import { Modal } from '../primitives';
import { SendVederlagForm } from './forms/SendVederlagForm';

// Grunnlag event info for context display
interface GrunnlagEventInfo {
  tittel?: string;
  status?: 'godkjent' | 'avslatt' | 'frafalt';
  dato_varslet?: string;
  dato_oppdaget?: string;
  hovedkategori?: 'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE';
}

interface SendVederlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the grunnlag event this vederlag claim is linked to (required for event sourcing) */
  grunnlagEventId: string;
  /** Optional grunnlag event data for context display and subsidiary logic */
  grunnlagEvent?: GrunnlagEventInfo;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
}

export function SendVederlagModal({
  open,
  onOpenChange,
  sakId,
  grunnlagEventId,
  grunnlagEvent,
  onCatendaWarning,
}: SendVederlagModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Krev vederlagsjustering"
      size="lg"
    >
      <SendVederlagForm
        sakId={sakId}
        grunnlagEventId={grunnlagEventId}
        grunnlagEvent={grunnlagEvent}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        onCatendaWarning={onCatendaWarning}
      />
    </Modal>
  );
}
