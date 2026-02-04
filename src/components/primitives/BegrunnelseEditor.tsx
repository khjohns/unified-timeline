/**
 * BegrunnelseEditor Component
 *
 * A specialized TipTap editor for begrunnelse text that supports locked values.
 * Locked values (days, amounts, percentages) are rendered as non-editable badges
 * that can only be changed by modifying the source values in the form.
 *
 * Token format: {{type:value:display}}
 * Example: "Godkjennes med {{dager:20:20 dager}} av {{dager:30:30 dager}} ({{prosent:67:67%}})"
 */

import { useEditor, EditorContent, NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import {
  LockedValueNode,
  LOCKED_VALUE_TOKEN_REGEX,
  type LockedValueType,
} from './LockedValueExtension';

// ============================================================================
// TYPES
// ============================================================================

export interface BegrunnelseEditorProps {
  /** Current value with locked value tokens */
  value: string;
  /** Change handler (returns string with tokens) */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Error state */
  error?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Additional class names */
  className?: string;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Help text shown below editor */
  helpText?: string;
}

// ============================================================================
// LOCKED VALUE NODE VIEW (React component for rendering)
// ============================================================================

function LockedValueNodeView({ node }: NodeViewProps) {
  const { type, display } = node.attrs as { type: LockedValueType; display: string };

  // Different styling based on type
  const typeStyles: Record<LockedValueType, string> = {
    dager: 'bg-blue-50 border-blue-200 text-blue-800',
    belop: 'bg-green-50 border-green-200 text-green-800',
    prosent: 'bg-purple-50 border-purple-200 text-purple-800',
    dato: 'bg-amber-50 border-amber-200 text-amber-800',
    paragraf: 'bg-slate-50 border-slate-200 text-slate-800',
    tekst: 'bg-gray-50 border-gray-200 text-gray-800',
  };

  return (
    <NodeViewWrapper as="span" className="inline" draggable data-drag-handle>
      <span
        className={clsx(
          'inline-flex items-center px-1.5 py-0.5 mx-0.5',
          'border rounded-sm text-sm font-medium',
          'select-none cursor-grab active:cursor-grabbing',
          'transition-colors duration-150',
          'hover:ring-2 hover:ring-offset-1 hover:ring-pkt-brand-purple-1000/30',
          typeStyles[type] || typeStyles.tekst
        )}
        contentEditable={false}
        data-locked-value
        data-drag-handle
        title={`Låst verdi (${type}) - dra for å flytte, eller endre verdien i skjemaet over`}
      >
        {display}
      </span>
    </NodeViewWrapper>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert token string to HTML for TipTap
 * Replaces {{type:value:display}} with <span data-locked-value="value" data-locked-type="type">display</span>
 */
function tokensToHtml(text: string): string {
  return text.replace(
    LOCKED_VALUE_TOKEN_REGEX,
    (_match, type, value, display) =>
      `<span data-locked-value="${value}" data-locked-type="${type}">${display}</span>`
  );
}

/**
 * Convert HTML back to token string
 */
function htmlToTokens(html: string): string {
  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Replace all locked value spans with tokens
  const lockedSpans = temp.querySelectorAll('span[data-locked-value]');
  lockedSpans.forEach((span) => {
    const type = span.getAttribute('data-locked-type') || 'tekst';
    const value = span.getAttribute('data-locked-value') || '';
    const display = span.textContent || '';
    const token = `{{${type}:${value}:${display}}}`;
    // Create a text node to replace the span
    const textNode = document.createTextNode(token);
    span.parentNode?.replaceChild(textNode, span);
  });

  // Process paragraphs - each <p> becomes a paragraph separated by double newlines
  const paragraphs = temp.querySelectorAll('p');
  const result: string[] = [];

  paragraphs.forEach((p) => {
    // Replace <br> with single newlines within paragraphs
    let text = p.innerHTML.replace(/<br\s*\/?>/gi, '\n');
    // Remove any remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');
    // Decode HTML entities
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    // Keep empty paragraphs as empty strings (they become blank lines)
    result.push(textArea.value);
  });

  // If no paragraphs found, fall back to processing the whole content
  if (result.length === 0) {
    let text = temp.innerHTML;
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<[^>]+>/g, '');
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value.trim();
  }

  // Join paragraphs with double newlines
  return result.join('\n\n');
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BegrunnelseEditor({
  value,
  onChange,
  placeholder = 'Begrunnelse genereres automatisk basert på valgene dine...',
  error,
  disabled,
  fullWidth,
  className,
  minHeight = 200,
  helpText,
}: BegrunnelseEditorProps) {
  // Convert initial value (with tokens) to HTML
  // Only compute once on mount - useEffect handles subsequent updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialContent = useMemo(() => {
    if (!value) return '';
    // Convert tokens to HTML and wrap in paragraphs
    const html = tokensToHtml(value);
    // Split by double newlines for paragraphs, single newlines become <br>
    const paragraphs = html.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`);
    return paragraphs.join('');
  }, []);

  // Create TipTap editor with LockedValueNode extension
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable features we don't need for begrunnelse
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
      }),
      LockedValueNode.extend({
        addNodeView() {
          return ReactNodeViewRenderer(LockedValueNodeView);
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const tokenString = htmlToTokens(html);
      onChange(tokenString);
    },
    editorProps: {
      attributes: {
        'aria-invalid': error ? 'true' : 'false',
        class: 'focus:outline-none prose prose-sm max-w-none',
      },
    },
  });

  // Update editor content when value changes externally (e.g., regenerate)
  useEffect(() => {
    if (!editor) return;

    const currentTokens = htmlToTokens(editor.getHTML());
    if (currentTokens !== value) {
      const html = tokensToHtml(value);
      const paragraphs = html.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`);
      editor.commands.setContent(paragraphs.join(''), false);
    }
  }, [value, editor]);

  // Update editable state
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) return null;

  return (
    <div className={clsx('space-y-2', fullWidth && 'w-full', className)}>
      {/* Editor container */}
      <div
        className={clsx(
          'border-2 rounded-lg overflow-hidden',
          error ? 'border-pkt-border-red' : 'border-pkt-border-default',
          disabled && 'opacity-50 bg-pkt-bg-subtle',
          'focus-within:border-pkt-brand-purple-1000/50 focus-within:ring-2 focus-within:ring-pkt-brand-purple-1000/20'
        )}
      >
        {/* Info banner */}
        <div className="flex items-center gap-2 px-3 py-2 bg-pkt-bg-subtle border-b border-pkt-border-subtle text-sm text-pkt-text-body-muted">
          <svg
            className="w-4 h-4 text-pkt-text-body-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Verdier markert med farge er låst og kan kun endres i feltene over.
          </span>
        </div>

        {/* Editor content */}
        <EditorContent
          editor={editor}
          className={clsx(
            'px-3 py-3 bg-pkt-bg-default',
            'text-pkt-text-body-default',
            'begrunnelse-editor'
          )}
          style={{ minHeight }}
        />
      </div>

      {/* Help text */}
      {helpText && (
        <p className="text-sm text-pkt-text-body-muted">{helpText}</p>
      )}
    </div>
  );
}

BegrunnelseEditor.displayName = 'BegrunnelseEditor';

export default BegrunnelseEditor;
