/**
 * BentoSubmitFrist — TE's begrunnelse editor for frist submission.
 *
 * All controls (segmented control, dates, days) live in FristCard.
 * This panel is exclusively a writing surface for begrunnelse.
 *
 * Follows ADR-003: "begrunnelse-feltet er kun det — fullt fokus på skriving."
 */

import { Textarea } from '../primitives';

// ============================================================================
// TYPES
// ============================================================================

// Defined locally until useFristSubmissionBridge.ts is available (Task 4).
// TODO: Replace with: import type { FristTeEditorProps } from '../../hooks/useFristSubmissionBridge';
export interface FristTeEditorProps {
  begrunnelse: string;
  onBegrunnelseChange: (v: string) => void;
  begrunnelseError: string | undefined;
  placeholder: string;
  required: boolean;
}

export interface BentoSubmitFristProps {
  editorProps: FristTeEditorProps;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BentoSubmitFrist({ editorProps }: BentoSubmitFristProps) {
  return (
    <div className="bg-pkt-bg-card rounded-lg p-3 h-full flex flex-col">
      <div className="mb-2 bg-bento-frist -mx-3 -mt-3 px-3 pt-3 pb-2 rounded-t-lg">
        <span className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide">
          Begrunnelse
        </span>
        {editorProps.required && (
          <span className="text-pkt-brand-red-1000 ml-1">*</span>
        )}
      </div>
      <Textarea
        id="frist-te-begrunnelse"
        value={editorProps.begrunnelse}
        onChange={(e) => editorProps.onBegrunnelseChange(e.target.value)}
        rows={8}
        fullWidth
        error={!!editorProps.begrunnelseError}
        placeholder={editorProps.placeholder}
        className="flex-1"
      />
      {editorProps.begrunnelseError && (
        <div className="bg-bento-frist -mx-3 -mb-3 px-3 pt-2 pb-3 rounded-b-lg mt-2">
          <p className="text-sm font-medium text-pkt-brand-red-1000" role="alert">
            {editorProps.begrunnelseError}
          </p>
        </div>
      )}
    </div>
  );
}
