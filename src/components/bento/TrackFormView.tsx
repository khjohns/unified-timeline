/**
 * TrackFormView
 *
 * Generic wrapper that renders a form inside an expanded track card,
 * replacing Modal as the container for form actions in the bento layout.
 *
 * When a user clicks an action on a track card, the card expands to
 * col-span-12 and the form renders inside this view. The submit button
 * lives inside the children (the form content), NOT here. TrackFormView
 * only provides the Avbryt button with a dirty-check guard.
 */

import { useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { BentoCard } from '../dashboard/BentoCard';
import { Alert } from '../primitives/Alert';

interface TrackFormViewProps {
  trackName: string;
  actionTitle: string;
  hjemmel?: string;
  onCancel: () => void;
  isDirty: boolean;
  children: ReactNode;
}

export function TrackFormView({
  trackName,
  actionTitle,
  hjemmel,
  onCancel,
  isDirty,
  children,
}: TrackFormViewProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCancel = () => {
    if (isDirty) {
      setShowConfirm(true);
    } else {
      onCancel();
    }
  };

  const handleDiscard = () => {
    setShowConfirm(false);
    onCancel();
  };

  const handleContinue = () => {
    setShowConfirm(false);
  };

  return (
    <BentoCard colSpan="col-span-12" className="border-t-2 border-t-pkt-brand-dark-blue-1000">
      {/* Header */}
      <div className="px-4 py-3 border-b border-pkt-border-subtle bg-pkt-surface-strong-gray flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-sm">{trackName}</h3>
          {hjemmel && (
            <span className="text-[10px] font-mono text-pkt-text-body-muted shrink-0">
              {hjemmel}
            </span>
          )}
          <span className="text-xs text-pkt-text-body-subtle">{actionTitle}</span>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className={clsx(
            'text-xs font-medium px-3 py-1 rounded-md',
            'text-pkt-text-body-subtle hover:text-pkt-text-body-default',
            'bg-pkt-bg-subtle hover:bg-pkt-grays-gray-200',
            'transition-colors',
          )}
        >
          Avbryt
        </button>
      </div>

      {/* Dirty confirmation */}
      {showConfirm && (
        <div className="px-4 pt-3">
          <Alert variant="warning" size="sm">
            <p>Du har ulagrede endringer. Er du sikker?</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                className="text-xs font-medium px-2 py-1 rounded-md bg-alert-warning-text text-white hover:opacity-90 transition-opacity"
              >
                Forkast endringer
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="text-xs font-medium px-2 py-1 rounded-md border border-alert-warning-border text-alert-warning-text hover:bg-alert-warning-bg/50 transition-colors"
              >
                Fortsett redigering
              </button>
            </div>
          </Alert>
        </div>
      )}

      {/* Content area — the form content from the extracted modal */}
      <div className="p-4">
        {children}
      </div>
    </BentoCard>
  );
}
