/**
 * BentoRespondFrist — Pure begrunnelse editor.
 *
 * All controls, context alerts, validation, and submit live in FristCard.
 * This panel is exclusively a writing surface for the begrunnelse text.
 *
 * Follows ADR-003: "begrunnelse-feltet er kun det — fullt fokus på skriving."
 */

import {
  Button,
  RichTextEditor,
} from '../primitives';
import type { FristEditorProps } from '../../hooks/useFristBridge';

// ============================================================================
// TYPES
// ============================================================================

export interface BentoRespondFristProps {
  editorProps: FristEditorProps;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BentoRespondFrist({ editorProps }: BentoRespondFristProps) {
  return (
    <div className="bg-pkt-bg-card rounded-lg p-3 h-full flex flex-col">
      <div className="mb-2">
        <span className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide">
          Byggherrens begrunnelse
        </span>
      </div>
      <RichTextEditor
        id="frist-begrunnelse"
        value={editorProps.begrunnelse}
        onChange={editorProps.onBegrunnelseChange}
        className="text-xs flex-1 flex flex-col"
        minHeight={200}
        fullWidth
        error={!!editorProps.begrunnelseError}
        placeholder={editorProps.placeholder}
      />
      {editorProps.begrunnelseError && (
        <p className="mt-2 text-sm font-medium text-pkt-brand-red-1000" role="alert">
          {editorProps.begrunnelseError}
        </p>
      )}
      {editorProps.showRegenerate && (
        <div className="flex justify-end mt-1">
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
  );
}
