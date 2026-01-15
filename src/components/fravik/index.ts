/**
 * Fravik Components
 *
 * Components for fravik-søknad (exemption application) management.
 */

export { FravikDashboard } from './FravikDashboard';
export { OpprettFravikModal } from './OpprettFravikModal';
export { LeggTilMaskinModal } from './LeggTilMaskinModal';
export { AvbotendeTiltakModal } from './AvbotendeTiltakModal';
export { SendInnModal } from './SendInnModal';

// Vurdering modals (4-step approval workflow)
export {
  BOIVurderingModal,
  PLVurderingModal,
  ArbeidsgruppeModal,
  EierBeslutningModal,
} from './vurdering';

// Re-export schemas for use in tests
export {
  maskinSchema,
  opprettSoknadSchema,
  sendInnSchema,
  MASKIN_TYPE_OPTIONS,
  SOKNAD_TYPE_OPTIONS,
  type MaskinFormData,
  type OpprettSoknadFormData,
  type SendInnFormData,
} from './schemas';
