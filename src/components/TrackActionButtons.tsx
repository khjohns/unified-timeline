/**
 * TrackActionButtons Components
 *
 * Extracted action button components for each track (Grunnlag, Vederlag, Frist).
 * Reduces complexity in CasePage by isolating conditional rendering logic.
 */

import { Button, Alert } from './primitives';
import {
  PaperPlaneIcon,
  Pencil1Icon,
  Pencil2Icon,
  ChatBubbleIcon,
  FileTextIcon,
  RocketIcon,
  CrossCircledIcon,
} from '@radix-ui/react-icons';
import type { UserRole, AvailableActions } from '../hooks/useActionPermissions';
import type { GrunnlagTilstand, FristTilstand } from '../types/timeline';

// ----- Grunnlag Action Buttons -----

interface GrunnlagActionButtonsProps {
  userRole: UserRole;
  actions: AvailableActions;
  grunnlagState: GrunnlagTilstand;
  onSendGrunnlag: () => void;
  onUpdateGrunnlag: () => void;
  onWithdrawGrunnlag: () => void;
  onRespondGrunnlag: () => void;
  onUpdateGrunnlagResponse: () => void;
  onUtstEO: () => void;
}

/**
 * Action buttons for Grunnlag track
 */
export function GrunnlagActionButtons({
  userRole,
  actions,
  grunnlagState,
  onSendGrunnlag,
  onUpdateGrunnlag,
  onWithdrawGrunnlag,
  onRespondGrunnlag,
  onUpdateGrunnlagResponse,
  onUtstEO,
}: GrunnlagActionButtonsProps) {
  // Compute update button variant: Primary if BH rejected and TE hasn't sent new version
  const updateVariant =
    grunnlagState.bh_resultat &&
    grunnlagState.bh_resultat !== 'godkjent' &&
    grunnlagState.antall_versjoner - 1 === grunnlagState.bh_respondert_versjon
      ? 'primary'
      : 'secondary';

  return (
    <>
      {/* TE Actions: "Send" and "Oppdater" are mutually exclusive */}
      {userRole === 'TE' && actions.canSendGrunnlag && (
        <Button variant="primary" size="sm" onClick={onSendGrunnlag}>
          <PaperPlaneIcon className="w-4 h-4 mr-2" />
          Varsle endringsforhold
        </Button>
      )}
      {userRole === 'TE' && actions.canUpdateGrunnlag && (
        <Button variant={updateVariant} size="sm" onClick={onUpdateGrunnlag}>
          <Pencil1Icon className="w-4 h-4 mr-2" />
          Oppdater
        </Button>
      )}
      {userRole === 'TE' && actions.canWithdrawGrunnlag && (
        <Button variant="ghost" size="sm" onClick={onWithdrawGrunnlag}>
          <CrossCircledIcon className="w-4 h-4 mr-2" />
          Trekk tilbake
        </Button>
      )}
      {/* BH Actions: Respond to TE's submission */}
      {userRole === 'BH' && actions.canRespondToGrunnlag && (
        <Button variant="primary" size="sm" onClick={onRespondGrunnlag}>
          <ChatBubbleIcon className="w-4 h-4 mr-2" />
          Svar
        </Button>
      )}
      {/* BH Actions: Update existing response (snuoperasjon) */}
      {userRole === 'BH' && actions.canUpdateGrunnlagResponse && (
        <Button variant="secondary" size="sm" onClick={onUpdateGrunnlagResponse}>
          <Pencil2Icon className="w-4 h-4 mr-2" />
          Endre svar
        </Button>
      )}
      {/* BH Actions: Issue endringsordre when grunnlag is approved */}
      {userRole === 'BH' && actions.canIssueEO && (
        <Button variant="primary" size="sm" onClick={onUtstEO}>
          <FileTextIcon className="w-4 h-4 mr-2" />
          Utsted endringsordre
        </Button>
      )}
    </>
  );
}

// ----- Vederlag Action Buttons -----

interface VederlagActionButtonsProps {
  userRole: UserRole;
  actions: AvailableActions;
  isForceMajeure: boolean;
  onSendVederlag: () => void;
  onWithdrawVederlag: () => void;
  onRespondVederlag: () => void;
  onUpdateVederlagResponse: () => void;
}

/**
 * Action buttons for Vederlag track
 */
export function VederlagActionButtons({
  userRole,
  actions,
  isForceMajeure,
  onSendVederlag,
  onWithdrawVederlag,
  onRespondVederlag,
  onUpdateVederlagResponse,
}: VederlagActionButtonsProps) {
  return (
    <>
      {/* Force Majeure info - vederlag ikke aktuelt */}
      {isForceMajeure && (
        <Alert variant="info" size="sm">
          Force majeure (§33.3) gir kun rett til fristforlengelse, ikke vederlagsjustering.
        </Alert>
      )}
      {/* TE Actions: Send initial claim (before inline revision is available) */}
      {userRole === 'TE' && actions.canSendVederlag && (
        <Button variant="primary" size="sm" onClick={onSendVederlag}>
          <PaperPlaneIcon className="w-4 h-4 mr-2" />
          Send krav
        </Button>
      )}
      {/* TE "Oppdater" now handled by inlineVederlagRevision prop */}
      {userRole === 'TE' && actions.canWithdrawVederlag && (
        <Button variant="ghost" size="sm" onClick={onWithdrawVederlag}>
          <CrossCircledIcon className="w-4 h-4 mr-2" />
          Trekk tilbake
        </Button>
      )}
      {/* BH Actions: Respond to TE's submission */}
      {userRole === 'BH' && actions.canRespondToVederlag && (
        <Button variant="primary" size="sm" onClick={onRespondVederlag}>
          <ChatBubbleIcon className="w-4 h-4 mr-2" />
          Svar
        </Button>
      )}
      {/* BH Actions: Update existing response */}
      {userRole === 'BH' && actions.canUpdateVederlagResponse && (
        <Button variant="secondary" size="sm" onClick={onUpdateVederlagResponse}>
          <Pencil2Icon className="w-4 h-4 mr-2" />
          Endre svar
        </Button>
      )}
    </>
  );
}

// ----- Frist Action Buttons -----

interface FristActionButtonsProps {
  userRole: UserRole;
  actions: AvailableActions;
  fristState: FristTilstand;
  onSendFrist: () => void;
  onReviseFrist: () => void;
  onWithdrawFrist: () => void;
  onSendForsering: () => void;
  onRespondFrist: () => void;
  onUpdateFristResponse: () => void;
}

/**
 * Action buttons for Frist track
 */
export function FristActionButtons({
  userRole,
  actions,
  fristState,
  onSendFrist,
  onReviseFrist,
  onWithdrawFrist,
  onSendForsering,
  onRespondFrist,
  onUpdateFristResponse,
}: FristActionButtonsProps) {
  return (
    <>
      {/* TE Actions: "Send" (before inline revision is available) */}
      {userRole === 'TE' && actions.canSendFrist && (
        <Button variant="primary" size="sm" onClick={onSendFrist}>
          <PaperPlaneIcon className="w-4 h-4 mr-2" />
          Send krav
        </Button>
      )}
      {/* Exception: When BH has sent forespørsel, use full modal for critical warnings */}
      {userRole === 'TE' && actions.canUpdateFrist && fristState.har_bh_foresporsel && (
        <Button variant="danger" size="sm" onClick={onReviseFrist}>
          <Pencil1Icon className="w-4 h-4 mr-2" />
          Svar på forespørsel
        </Button>
      )}
      {userRole === 'TE' && actions.canWithdrawFrist && (
        <Button variant="ghost" size="sm" onClick={onWithdrawFrist}>
          <CrossCircledIcon className="w-4 h-4 mr-2" />
          Trekk tilbake
        </Button>
      )}
      {/* TE Actions: Forsering (§33.8) - available when BH has rejected */}
      {userRole === 'TE' && actions.canSendForsering && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onSendForsering}
          className="border-action-danger-border text-action-danger-text hover:bg-action-danger-hover-bg"
        >
          <RocketIcon className="w-4 h-4 mr-2" />
          Forsering (§33.8)
        </Button>
      )}
      {/* BH Actions: Respond to TE's submission */}
      {userRole === 'BH' && actions.canRespondToFrist && (
        <Button variant="primary" size="sm" onClick={onRespondFrist}>
          <ChatBubbleIcon className="w-4 h-4 mr-2" />
          Svar
        </Button>
      )}
      {/* BH Actions: Update existing response */}
      {userRole === 'BH' && actions.canUpdateFristResponse && (
        <Button variant="secondary" size="sm" onClick={onUpdateFristResponse}>
          <Pencil2Icon className="w-4 h-4 mr-2" />
          Endre svar
        </Button>
      )}
    </>
  );
}
