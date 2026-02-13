/**
 * WithdrawModal Component
 *
 * Thin modal wrapper around WithdrawForm.
 * The form handles all logic; this component only provides the modal shell.
 *
 * Business logic:
 * - Withdrawing grunnlag -> Cascades to withdraw vederlag and frist
 * - Withdrawing vederlag -> Only withdraws vederlag track
 * - Withdrawing frist -> Only withdraws frist track
 */

import { Modal } from '../primitives';
import { WithdrawForm } from './forms/WithdrawForm';
import type { SakState } from '../../types/timeline';

// ============================================================================
// CONSTANTS
// ============================================================================

type TrackType = 'grunnlag' | 'vederlag' | 'frist';

const TRACK_TITLES: Record<TrackType, string> = {
  grunnlag: 'Trekk tilbake ansvarsgrunnlag',
  vederlag: 'Trekk tilbake vederlagskrav',
  frist: 'Trekk tilbake fristkrav',
};

// ============================================================================
// COMPONENT
// ============================================================================

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  track: TrackType;
  sakState?: SakState;
  /** Callback when Catenda sync was skipped or failed */
  onCatendaWarning?: () => void;
}

export function WithdrawModal({
  open,
  onOpenChange,
  sakId,
  track,
  sakState,
  onCatendaWarning,
}: WithdrawModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={TRACK_TITLES[track]}
      size="md"
    >
      <WithdrawForm
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
