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
  FormField,
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
    <div className="bg-pkt-bg-subtle rounded-lg p-4 max-h-[70vh] overflow-y-auto">
      <FormField
        label="Byggherrens begrunnelse"
        required
        error={editorProps.begrunnelseError}
      >
        <RichTextEditor
          id="frist-begrunnelse"
          value={editorProps.begrunnelse}
          onChange={editorProps.onBegrunnelseChange}
          className="text-xs"
          minHeight={200}
          fullWidth
          error={!!editorProps.begrunnelseError}
          placeholder={editorProps.placeholder}
        />
        {editorProps.showRegenerate && (
          <div className="flex justify-end mt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={editorProps.onRegenerate}
            >
              Regenerer fra valg
            </Button>
          </div>
        )}
      </FormField>
    </div>
  );
}
