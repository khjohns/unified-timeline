/**
 * BentoRespondVederlag — Pure begrunnelse editor.
 *
 * All controls, context alerts, validation, and submit live in VederlagCard.
 * This panel is exclusively a writing surface for the begrunnelse text.
 *
 * Follows ADR-003: "begrunnelse-feltet er kun det — fullt fokus på skriving."
 */

import {
  Button,
  RichTextEditor,
} from '../primitives';
import type { VederlagEditorProps } from '../../hooks/useVederlagBridge';

// ============================================================================
// TYPES
// ============================================================================

export interface BentoRespondVederlagProps {
  editorProps: VederlagEditorProps;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BentoRespondVederlag({ editorProps }: BentoRespondVederlagProps) {
  const hasFooter = editorProps.begrunnelseError || editorProps.showRegenerate;

  return (
    <div className="bg-pkt-bg-card rounded-lg p-3 h-full flex flex-col">
      <div className="mb-2 bg-bento-vederlag -mx-3 -mt-3 px-3 pt-3 pb-2 rounded-t-lg">
        <span className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide">
          Byggherrens begrunnelse
        </span>
      </div>
      <RichTextEditor
        id="vederlag-begrunnelse"
        value={editorProps.begrunnelse}
        onChange={editorProps.onBegrunnelseChange}
        className="text-bento-body flex-1 flex flex-col"
        minHeight={200}
        fullWidth
        error={!!editorProps.begrunnelseError}
        placeholder={editorProps.placeholder}
      />
      {hasFooter && (
        <div className="bg-bento-vederlag -mx-3 -mb-3 px-3 pt-2 pb-3 rounded-b-lg mt-2">
          {editorProps.begrunnelseError && (
            <p className="text-sm font-medium text-pkt-brand-red-1000" role="alert">
              {editorProps.begrunnelseError}
            </p>
          )}
          {editorProps.showRegenerate && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={editorProps.onRegenerate}
              >
                Regenerer fra valg
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
