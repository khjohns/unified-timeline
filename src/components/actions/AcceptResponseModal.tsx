/**
 * AcceptResponseModal Component
 *
 * Thin modal wrapper around AcceptResponseForm.
 * The form handles all logic; this component only provides the modal shell.
 *
 * Once accepted, the parties are in agreement on that track.
 * This action cannot be undone.
 */

import { Modal } from '../primitives';
import { AcceptResponseForm } from './forms/AcceptResponseForm';
import type { SakState } from '../../types/timeline';

// ============================================================================
// CONSTANTS
// ============================================================================

type TrackType = 'grunnlag' | 'vederlag' | 'frist';

const TRACK_TITLES: Record<TrackType, string> = {
  grunnlag: 'Godta svar på ansvarsgrunnlag',
  vederlag: 'Godta svar på vederlagskrav',
  frist: 'Godta svar på fristkrav',
};

// ============================================================================
// COMPONENT
// ============================================================================

interface AcceptResponseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  track: TrackType;
  sakState?: SakState;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
}

export function AcceptResponseModal({
  open,
  onOpenChange,
  sakId,
  track,
  sakState,
  onCatendaWarning,
}: AcceptResponseModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={TRACK_TITLES[track]}
      size="md"
    >
      <AcceptResponseForm
        sakId={sakId}
        track={track}
        sakState={sakState}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
        onCatendaWarning={onCatendaWarning}
      />
    </Modal>
  );
}
