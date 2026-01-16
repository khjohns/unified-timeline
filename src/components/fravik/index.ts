/**
 * Fravik Components
 *
 * Components for fravik-søknad (exemption application) management.
 */

export { FravikDashboard, DinOppgaveAlert, TidligereVurderingerKort } from './FravikDashboard';
export type { DinOppgaveAlertProps, TidligereVurderingerKortProps } from './FravikDashboard';
export { MaskinListe } from './MaskinListe';
export { OpprettFravikModal } from './OpprettFravikModal';
export { LeggTilMaskinModal } from './LeggTilMaskinModal';
export { InfrastrukturModal } from './InfrastrukturModal';
export { AvbotendeTiltakModal } from './AvbotendeTiltakModal';
export { SendInnModal } from './SendInnModal';

// Vurdering modals (4-step approval workflow)
export {
  MiljoVurderingModal,
  PLVurderingModal,
  ArbeidsgruppeModal,
  EierBeslutningModal,
} from './vurdering';

// Re-export schemas for use in tests
export {
  maskinSchema,
  opprettSoknadSchema,
  MASKIN_TYPE_OPTIONS,
  SOKNAD_TYPE_OPTIONS,
  type MaskinFormData,
  type OpprettSoknadFormData,
} from './schemas';
