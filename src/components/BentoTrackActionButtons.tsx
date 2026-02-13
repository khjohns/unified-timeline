/**
 * BentoTrackActionButtons
 *
 * Compact icon-button action bar for bento grid track cards.
 * Primary action gets a full (small) button, secondary actions
 * are icon-only circles with tooltip on hover.
 *
 * Preserves same primary/secondary logic as TrackActionButtons:
 * - "Revider" is primary when BH has responded and TE hasn't revised yet
 * - "Oppdater" is secondary when TE voluntarily updates
 * - BH "Svar" is always primary
 */

import { ReactNode } from 'react';
import { Button, Tooltip } from './primitives';
import {
  PaperPlaneIcon,
  Pencil1Icon,
  Pencil2Icon,
  ChatBubbleIcon,
  FileTextIcon,
  RocketIcon,
  CrossCircledIcon,
  CheckCircledIcon,
} from '@radix-ui/react-icons';
import type { UserRole, AvailableActions } from '../hooks/useActionPermissions';
import type { GrunnlagTilstand, FristTilstand } from '../types/timeline';

// ========== Icon Action Button ==========

function IconAction({
  icon,
  label,
  onClick,
  variant = 'default',
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success';
}) {
  const colorClass = {
    default: 'text-pkt-text-body-subtle hover:text-pkt-text-body-default hover:bg-pkt-bg-subtle',
    danger: 'text-action-danger-text hover:bg-action-danger-hover-bg/20',
    success: 'text-badge-success-border hover:bg-badge-success-border/10',
  }[variant];

  return (
    <Tooltip content={label} side="bottom">
      <button
        onClick={onClick}
        className={`p-1.5 rounded-md transition-colors ${colorClass}`}
        aria-label={label}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

// ========== Primary Action (small full button) ==========

function PrimaryAction({
  icon,
  label,
  onClick,
  variant = 'primary',
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <Button variant={variant} size="sm" onClick={onClick} className="!px-3 !py-1.5 !min-h-[28px] !text-xs">
      {icon}
      <span className="ml-1.5">{label}</span>
    </Button>
  );
}

// ========== Grunnlag Actions ==========

interface BentoGrunnlagActionButtonsProps {
  userRole: UserRole;
  actions: AvailableActions;
  grunnlagState: GrunnlagTilstand;
  onSendGrunnlag: () => void;
  onUpdateGrunnlag: () => void;
  onWithdrawGrunnlag: () => void;
  onRespondGrunnlag: () => void;
  onUpdateGrunnlagResponse: () => void;
  onAcceptGrunnlagResponse: () => void;
  onUtstEO: () => void;
}

export function BentoGrunnlagActionButtons({
  userRole,
  actions,
  grunnlagState,
  onSendGrunnlag,
  onUpdateGrunnlag,
  onWithdrawGrunnlag,
  onRespondGrunnlag,
  onUpdateGrunnlagResponse,
  onAcceptGrunnlagResponse,
  onUtstEO,
}: BentoGrunnlagActionButtonsProps) {
  const isUpdatePrimary =
    grunnlagState.bh_resultat &&
    grunnlagState.bh_resultat !== 'godkjent' &&
    grunnlagState.antall_versjoner - 1 === grunnlagState.bh_respondert_versjon;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* TE: primary send or update */}
      {userRole === 'TE' && actions.canSendGrunnlag && (
        <PrimaryAction
          icon={<PaperPlaneIcon className="w-3.5 h-3.5" />}
          label="Varsle"
          onClick={onSendGrunnlag}
        />
      )}
      {userRole === 'TE' && actions.canUpdateGrunnlag && (
        isUpdatePrimary ? (
          <PrimaryAction
            icon={<Pencil1Icon className="w-3.5 h-3.5" />}
            label="Oppdater"
            onClick={onUpdateGrunnlag}
          />
        ) : (
          <IconAction
            icon={<Pencil1Icon className="w-3.5 h-3.5" />}
            label="Oppdater grunnlag"
            onClick={onUpdateGrunnlag}
          />
        )
      )}

      {/* TE: secondary actions */}
      <div className="flex items-center gap-0.5 ml-auto">
        {userRole === 'TE' && actions.canAcceptGrunnlagResponse && (
          <IconAction
            icon={<CheckCircledIcon className="w-3.5 h-3.5" />}
            label="Godta svaret"
            onClick={onAcceptGrunnlagResponse}
            variant="success"
          />
        )}
        {userRole === 'TE' && actions.canWithdrawGrunnlag && (
          <IconAction
            icon={<CrossCircledIcon className="w-3.5 h-3.5" />}
            label="Trekk tilbake"
            onClick={onWithdrawGrunnlag}
            variant="danger"
          />
        )}
      </div>

      {/* BH: respond / update */}
      {userRole === 'BH' && actions.canRespondToGrunnlag && (
        <PrimaryAction
          icon={<ChatBubbleIcon className="w-3.5 h-3.5" />}
          label="Svar"
          onClick={onRespondGrunnlag}
        />
      )}
      {userRole === 'BH' && actions.canUpdateGrunnlagResponse && (
        <IconAction
          icon={<Pencil2Icon className="w-3.5 h-3.5" />}
          label="Endre svar"
          onClick={onUpdateGrunnlagResponse}
        />
      )}
      {userRole === 'BH' && actions.canIssueEO && (
        <PrimaryAction
          icon={<FileTextIcon className="w-3.5 h-3.5" />}
          label="Utsted EO"
          onClick={onUtstEO}
        />
      )}
    </div>
  );
}

// ========== Vederlag Actions ==========

interface BentoVederlagActionButtonsProps {
  userRole: UserRole;
  actions: AvailableActions;
  isForceMajeure: boolean;
  onSendVederlag: () => void;
  onWithdrawVederlag: () => void;
  onRespondVederlag: () => void;
  onUpdateVederlagResponse: () => void;
  onAcceptVederlagResponse: () => void;
}

export function BentoVederlagActionButtons({
  userRole,
  actions,
  isForceMajeure,
  onSendVederlag,
  onWithdrawVederlag,
  onRespondVederlag,
  onUpdateVederlagResponse,
  onAcceptVederlagResponse,
}: BentoVederlagActionButtonsProps) {
  if (isForceMajeure) {
    return (
      <p className="text-[10px] text-pkt-text-body-subtle italic">
        Force majeure — kun fristforlengelse
      </p>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* TE: primary send */}
      {userRole === 'TE' && actions.canSendVederlag && (
        <PrimaryAction
          icon={<PaperPlaneIcon className="w-3.5 h-3.5" />}
          label="Send krav"
          onClick={onSendVederlag}
        />
      )}
      {/* TE: Revider handled by inlineVederlagRevision in CaseDashboardBento */}

      {/* TE: secondary actions */}
      <div className="flex items-center gap-0.5 ml-auto">
        {userRole === 'TE' && actions.canAcceptVederlagResponse && (
          <IconAction
            icon={<CheckCircledIcon className="w-3.5 h-3.5" />}
            label="Godta svaret"
            onClick={onAcceptVederlagResponse}
            variant="success"
          />
        )}
        {userRole === 'TE' && actions.canWithdrawVederlag && (
          <IconAction
            icon={<CrossCircledIcon className="w-3.5 h-3.5" />}
            label="Trekk tilbake"
            onClick={onWithdrawVederlag}
            variant="danger"
          />
        )}
      </div>

      {/* BH: respond / update */}
      {userRole === 'BH' && actions.canRespondToVederlag && (
        <PrimaryAction
          icon={<ChatBubbleIcon className="w-3.5 h-3.5" />}
          label="Svar"
          onClick={onRespondVederlag}
        />
      )}
      {userRole === 'BH' && actions.canUpdateVederlagResponse && (
        <IconAction
          icon={<Pencil2Icon className="w-3.5 h-3.5" />}
          label="Endre svar"
          onClick={onUpdateVederlagResponse}
        />
      )}
    </div>
  );
}

// ========== Frist Actions ==========

interface BentoFristActionButtonsProps {
  userRole: UserRole;
  actions: AvailableActions;
  fristState: FristTilstand;
  onSendFrist: () => void;
  onReviseFrist: () => void;
  onWithdrawFrist: () => void;
  onSendForsering: () => void;
  onRespondFrist: () => void;
  onUpdateFristResponse: () => void;
  onAcceptFristResponse: () => void;
}

export function BentoFristActionButtons({
  userRole,
  actions,
  fristState,
  onSendFrist,
  onReviseFrist,
  onWithdrawFrist,
  onSendForsering,
  onRespondFrist,
  onUpdateFristResponse,
  onAcceptFristResponse,
}: BentoFristActionButtonsProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* TE: primary send */}
      {userRole === 'TE' && actions.canSendFrist && (
        <PrimaryAction
          icon={<PaperPlaneIcon className="w-3.5 h-3.5" />}
          label="Send krav"
          onClick={onSendFrist}
        />
      )}
      {/* TE: BH forespørsel (critical - full button) */}
      {userRole === 'TE' && actions.canUpdateFrist && fristState.har_bh_foresporsel && (
        <PrimaryAction
          icon={<Pencil1Icon className="w-3.5 h-3.5" />}
          label="Svar forespørsel"
          onClick={onReviseFrist}
          variant="danger"
        />
      )}
      {/* TE: Forsering */}
      {userRole === 'TE' && actions.canSendForsering && (
        <IconAction
          icon={<RocketIcon className="w-3.5 h-3.5" />}
          label="Forsering (§33.8)"
          onClick={onSendForsering}
          variant="danger"
        />
      )}
      {/* TE: Revider frist handled by inlineFristRevision in CaseDashboardBento */}

      {/* TE: secondary actions */}
      <div className="flex items-center gap-0.5 ml-auto">
        {userRole === 'TE' && actions.canAcceptFristResponse && (
          <IconAction
            icon={<CheckCircledIcon className="w-3.5 h-3.5" />}
            label="Godta svaret"
            onClick={onAcceptFristResponse}
            variant="success"
          />
        )}
        {userRole === 'TE' && actions.canWithdrawFrist && (
          <IconAction
            icon={<CrossCircledIcon className="w-3.5 h-3.5" />}
            label="Trekk tilbake"
            onClick={onWithdrawFrist}
            variant="danger"
          />
        )}
      </div>

      {/* BH: respond / update */}
      {userRole === 'BH' && actions.canRespondToFrist && (
        <PrimaryAction
          icon={<ChatBubbleIcon className="w-3.5 h-3.5" />}
          label="Svar"
          onClick={onRespondFrist}
        />
      )}
      {userRole === 'BH' && actions.canUpdateFristResponse && (
        <IconAction
          icon={<Pencil2Icon className="w-3.5 h-3.5" />}
          label="Endre svar"
          onClick={onUpdateFristResponse}
        />
      )}
    </div>
  );
}
