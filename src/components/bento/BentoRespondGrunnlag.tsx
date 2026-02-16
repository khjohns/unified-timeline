/**
 * BentoRespondGrunnlag — Pure begrunnelse editor.
 *
 * All controls, context alerts, validation, and submit live in CaseMasterCard.
 * This panel is exclusively a writing surface for the begrunnelse text.
 *
 * Follows ADR-003: "begrunnelse-feltet er kun det — fullt fokus på skriving."
 */

import {
  Button,
  FormField,
  RichTextEditor,
} from '../primitives';
import type { GrunnlagEditorProps } from '../../hooks/useGrunnlagBridge';

// ============================================================================
// TYPES
// ============================================================================

export interface BentoRespondGrunnlagProps {
  editorProps: GrunnlagEditorProps;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BentoRespondGrunnlag({ editorProps }: BentoRespondGrunnlagProps) {
  return (
    <div className="bg-pkt-bg-subtle rounded-lg p-3 md:p-4 max-h-[70vh] overflow-y-auto">
      <FormField
        label="Byggherrens begrunnelse"
        required
        error={editorProps.begrunnelseError}
      >
        <RichTextEditor
          id="grunnlag-begrunnelse"
          value={editorProps.begrunnelse}
          onChange={editorProps.onBegrunnelseChange}
          className="text-xs"
          minHeight={280}
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
