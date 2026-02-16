import { useMemo } from 'react';
import { ArrowRightIcon, CheckIcon, DotsHorizontalIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../primitives';
import type { SakState, SporType, SporStatus } from '../../../types/timeline';
import type { AvailableActions } from '../../../hooks/useActionPermissions';
import { generateStatusAlert } from '../../StatusAlert/statusAlertGenerator';
import { isResolved } from './trackCardUtils';

interface TrackCTAAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface TrackCTAProps {
  spor: SporType;
  status: SporStatus;
  state: SakState;
  userRole: 'TE' | 'BH';
  actions: AvailableActions;
  primaryAction?: { label: string; onClick: () => void };
  secondaryActions?: TrackCTAAction[];
  className?: string;
}

export function TrackCTA({
  spor,
  status,
  state,
  userRole,
  actions,
  primaryAction,
  secondaryActions = [],
  className,
}: TrackCTAProps) {
  // Use the status alert system to determine what the CTA text should be
  const hint = useMemo(() => {
    const alert = generateStatusAlert(state, userRole, actions);
    if (!alert || alert.relatedSpor !== spor) return null;
    return alert;
  }, [state, userRole, actions, spor]);

  const resolved = isResolved(status);

  const sporBg = spor === 'frist' ? 'bg-bento-frist' : spor === 'vederlag' ? 'bg-bento-vederlag' : 'bg-pkt-bg-subtle/50';

  // Determine primary CTA display
  let ctaText: string;
  let ctaClickable: boolean;
  let showArrow: boolean;

  if (resolved) {
    ctaText = 'Avgjort';
    ctaClickable = false;
    showArrow = false;
  } else if (primaryAction) {
    ctaText = primaryAction.label;
    ctaClickable = true;
    showArrow = true;
  } else if (hint) {
    ctaText = hint.title;
    ctaClickable = hint.type === 'action';
    showArrow = hint.type === 'action';
  } else {
    // Passive waiting state
    ctaText = 'Venter på svar';
    ctaClickable = false;
    showArrow = false;
  }

  const hasOverflow = secondaryActions.length > 0;

  return (
    <div className={clsx('mt-2', className)}>
      <hr className="border-pkt-border-subtle mx-1 mb-2" />
      <div
        className={clsx(
          'flex items-center justify-between',
          sporBg, '-mx-3 -mb-3 px-3 py-2 rounded-b-lg',
        )}
      >
      {/* Primary CTA */}
      {ctaClickable && primaryAction ? (
        <button
          type="button"
          onClick={primaryAction.onClick}
          className="flex items-center gap-1 text-bento-body font-medium text-pkt-brand-warm-blue-1000 hover:text-pkt-brand-dark-blue-1000 transition-colors"
        >
          {showArrow && <ArrowRightIcon className="w-3.5 h-3.5" />}
          {ctaText}
        </button>
      ) : (
        <span
          className={clsx(
            'flex items-center gap-1 text-bento-body',
            resolved
              ? 'text-pkt-text-body-muted font-medium'
              : 'text-pkt-text-body-subtle',
          )}
        >
          {resolved && <CheckIcon className="w-3 h-3" />}
          {ctaText}
        </span>
      )}

      {/* Overflow menu */}
      {hasOverflow && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-1 rounded-md text-pkt-text-body-subtle hover:text-pkt-text-body-default hover:bg-pkt-bg-subtle transition-colors"
              aria-label="Flere handlinger"
            >
              <DotsHorizontalIcon className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {secondaryActions.map((a) => (
              <DropdownMenuItem
                key={a.label}
                variant={a.variant}
                onClick={a.onClick}
              >
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      </div>
    </div>
  );
}
