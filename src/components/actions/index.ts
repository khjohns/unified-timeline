/**
 * Action Components Index
 *
 * Action components for submitting events (write operations).
 * All mutations happen through these modal forms.
 */

// Initial submission modals (TE)
export { SendGrunnlagModal } from './SendGrunnlagModal';
export { SendVederlagModal } from './SendVederlagModal';
export { SendFristModal } from './SendFristModal';

// Initial response modals (BH)
export { RespondGrunnlagModal } from './RespondGrunnlagModal';
export { RespondVederlagModal } from './RespondVederlagModal';
export { RespondFristModal } from './RespondFristModal';

// Update modals (TE) - for revising previously sent claims
export { SendGrunnlagUpdateModal } from './SendGrunnlagUpdateModal';
export { ReviseVederlagModal } from './ReviseVederlagModal';
export { ReviseFristModal } from './ReviseFristModal';

// Update response modals (BH) - for changing previous responses
export { RespondGrunnlagUpdateModal } from './RespondGrunnlagUpdateModal';
export { UpdateResponseVederlagModal } from './UpdateResponseVederlagModal';
export { UpdateResponseFristModal } from './UpdateResponseFristModal';

// Special action modals (TE)
export { SendForseringModal } from './SendForseringModal';
