/**
 * SendFristModal Component
 *
 * Thin modal wrapper around SendFristForm.
 * The form handles all logic; this component only provides the modal shell.
 */

import { Modal } from '../primitives';
import { SendFristForm } from './forms/SendFristForm';

// Grunnlag event info for context display
interface GrunnlagEventInfo {
  tittel?: string;
  hovedkategori?: string;
  dato_oppdaget?: string;
  dato_varslet?: string;
  status?: 'godkjent' | 'avslatt' | 'delvis_godkjent' | 'ubesvart';
}

interface SendFristModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  /** ID of the grunnlag event this frist claim is linked to (required for event sourcing) */
  grunnlagEventId: string;
  /** Optional grunnlag event data for context display */
  grunnlagEvent?: GrunnlagEventInfo;
  /** Whether BH has sent a foresporsel (§33.6.2) - triggers critical warning */
  harMottattForesporsel?: boolean;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
}

export function SendFristModal({
  open,
  onOpenChange,
  sakId,
  grunnlagEventId,
  grunnlagEvent,
  harMottattForesporsel,
  onCatendaWarning,
}: SendFristModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Krev fristforlengelse"
      size="lg"
    >
      <SendFristForm
        sakId={sakId}
        grunnlagEventId={grunnlagEventId}
        grunnlagEvent={grunnlagEvent}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        harMottattForesporsel={harMottattForesporsel}
        onCatendaWarning={onCatendaWarning}
      />
    </Modal>
  );
}
