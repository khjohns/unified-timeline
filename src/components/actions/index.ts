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
// Note: SendGrunnlagUpdateModal removed - SendGrunnlagModal handles updates via originalEvent prop
export { ReviseVederlagModal } from './ReviseVederlagModal';
export { ReviseFristModal } from './ReviseFristModal';

// Inline revision components (TE) - compact inline forms for quick updates
export { InlineReviseVederlag } from './InlineReviseVederlag';

// Update response modals (BH) - for changing previous responses
// Note: RespondGrunnlagUpdateModal removed - RespondGrunnlagModal handles updates via lastResponseEvent prop
// Note: UpdateResponseVederlagModal removed - RespondVederlagModal handles updates via lastResponseEvent prop
// Note: UpdateResponseFristModal removed - RespondFristModal handles updates via lastResponseEvent prop

// Special action modals (TE)
export { SendForseringModal } from './SendForseringModal';

// Withdrawal modals (TE)
export { WithdrawModal } from './WithdrawModal';

// Accept response modal (TE)
export { AcceptResponseModal } from './AcceptResponseModal';
