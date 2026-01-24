/**
 * MarkdownEditor Component
 *
 * GitHub-style markdown editor with Write/Preview tabs and formatting toolbar.
 * Uses Radix UI Toolbar and react-markdown for preview.
 */

import { forwardRef, useState, useRef, useCallback } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';
import {
  FontBoldIcon,
  FontItalicIcon,
  ListBulletIcon,
  CodeIcon,
  QuoteIcon,
  Link2Icon,
  HeadingIcon,
} from '@radix-ui/react-icons';

export interface MarkdownEditorProps {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Number of rows for textarea */
  rows?: number;
  /** Error state */
  error?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Additional class names */
  className?: string;
  /** ID for the textarea */
  id?: string;
  /** aria-describedby for accessibility */
  'aria-describedby'?: string;
}

type FormatAction = 'bold' | 'italic' | 'heading' | 'list' | 'code' | 'quote' | 'link';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function ToolbarButton({ icon, label, onClick, disabled }: ToolbarButtonProps) {
  return (
    <Toolbar.Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx(
        'p-1.5 rounded transition-colors',
        'hover:bg-pkt-bg-subtle',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-pkt-brand-purple-1000/30',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'text-pkt-text-body-muted hover:text-pkt-text-body-default'
      )}
    >
      {icon}
    </Toolbar.Button>
  );
}

export const MarkdownEditor = forwardRef<HTMLTextAreaElement, MarkdownEditorProps>(
  (
    {
      value,
      onChange,
      placeholder = 'Skriv her...',
      rows = 5,
      error,
      disabled,
      fullWidth,
      className,
      id,
      'aria-describedby': ariaDescribedBy,
    },
    ref
  ) => {
    const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    // Insert formatting around selection or at cursor
    const insertFormat = useCallback(
      (action: FormatAction) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end);
        let newText = '';
        let cursorOffset = 0;

        switch (action) {
          case 'bold':
            newText = `**${selectedText || 'tekst'}**`;
            cursorOffset = selectedText ? newText.length : 2;
            break;
          case 'italic':
            newText = `*${selectedText || 'tekst'}*`;
            cursorOffset = selectedText ? newText.length : 1;
            break;
          case 'heading':
            // If at line start or selection starts at line start
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const prefix = start === lineStart ? '' : '\n';
            newText = `${prefix}## ${selectedText || 'Overskrift'}`;
            cursorOffset = selectedText ? newText.length : 3;
            break;
          case 'list':
            newText = `\n- ${selectedText || 'Listeelement'}`;
            cursorOffset = selectedText ? newText.length : 3;
            break;
          case 'code':
            if (selectedText.includes('\n')) {
              newText = `\`\`\`\n${selectedText}\n\`\`\``;
            } else {
              newText = `\`${selectedText || 'kode'}\``;
            }
            cursorOffset = selectedText ? newText.length : 1;
            break;
          case 'quote':
            newText = `\n> ${selectedText || 'Sitat'}`;
            cursorOffset = selectedText ? newText.length : 3;
            break;
          case 'link':
            newText = `[${selectedText || 'lenketekst'}](url)`;
            cursorOffset = selectedText ? newText.length - 1 : 1;
            break;
        }

        const newValue = value.substring(0, start) + newText + value.substring(end);
        onChange(newValue);

        // Restore focus and set cursor position
        requestAnimationFrame(() => {
          textarea.focus();
          const newCursorPos = start + cursorOffset;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        });
      },
      [value, onChange, textareaRef]
    );

    return (
      <div className={clsx('border-2 rounded overflow-hidden',
        error ? 'border-pkt-border-red' : 'border-pkt-border-default',
        disabled && 'opacity-50',
        fullWidth && 'w-full',
        className
      )}>
        {/* Header with tabs and toolbar */}
        <div className="flex items-center justify-between bg-pkt-bg-subtle border-b border-pkt-border-subtle px-2 py-1">
          {/* Tabs */}
          <div className="flex" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'write'}
              onClick={() => setActiveTab('write')}
              disabled={disabled}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-t transition-colors',
                activeTab === 'write'
                  ? 'bg-pkt-bg-default text-pkt-text-body-dark border-b-2 border-pkt-text-body-dark -mb-px'
                  : 'text-pkt-text-body-muted hover:text-pkt-text-body-default'
              )}
            >
              Skriv
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'preview'}
              onClick={() => setActiveTab('preview')}
              disabled={disabled}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-t transition-colors',
                activeTab === 'preview'
                  ? 'bg-pkt-bg-default text-pkt-text-body-dark border-b-2 border-pkt-text-body-dark -mb-px'
                  : 'text-pkt-text-body-muted hover:text-pkt-text-body-default'
              )}
            >
              Forhåndsvis
            </button>
          </div>

          {/* Toolbar - only visible in write mode */}
          {activeTab === 'write' && (
            <Toolbar.Root
              className="flex items-center gap-0.5"
              aria-label="Formateringsverktøy"
            >
              <ToolbarButton
                icon={<HeadingIcon className="w-4 h-4" />}
                label="Overskrift"
                onClick={() => insertFormat('heading')}
                disabled={disabled}
              />
              <ToolbarButton
                icon={<FontBoldIcon className="w-4 h-4" />}
                label="Fet tekst"
                onClick={() => insertFormat('bold')}
                disabled={disabled}
              />
              <ToolbarButton
                icon={<FontItalicIcon className="w-4 h-4" />}
                label="Kursiv"
                onClick={() => insertFormat('italic')}
                disabled={disabled}
              />

              <Toolbar.Separator className="w-px h-4 bg-pkt-border-subtle mx-1" />

              <ToolbarButton
                icon={<ListBulletIcon className="w-4 h-4" />}
                label="Punktliste"
                onClick={() => insertFormat('list')}
                disabled={disabled}
              />
              <ToolbarButton
                icon={<QuoteIcon className="w-4 h-4" />}
                label="Sitat"
                onClick={() => insertFormat('quote')}
                disabled={disabled}
              />
              <ToolbarButton
                icon={<CodeIcon className="w-4 h-4" />}
                label="Kode"
                onClick={() => insertFormat('code')}
                disabled={disabled}
              />
              <ToolbarButton
                icon={<Link2Icon className="w-4 h-4" />}
                label="Lenke"
                onClick={() => insertFormat('link')}
                disabled={disabled}
              />
            </Toolbar.Root>
          )}
        </div>

        {/* Content area */}
        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            aria-describedby={ariaDescribedBy}
            aria-invalid={error ? 'true' : 'false'}
            className={clsx(
              'w-full px-3 py-2 text-base',
              'bg-pkt-bg-default text-pkt-text-body-default',
              'placeholder:text-pkt-text-placeholder',
              'resize-y min-h-[100px]',
              'focus:outline-none',
              'border-0'
            )}
          />
        ) : (
          <div
            className={clsx(
              'px-3 py-2 min-h-[100px] bg-pkt-bg-default',
              'prose prose-sm max-w-none',
              'prose-headings:text-pkt-text-body-dark prose-headings:font-semibold',
              'prose-p:text-pkt-text-body-default prose-p:my-2',
              'prose-strong:text-pkt-text-body-dark',
              'prose-ul:my-2 prose-li:my-0.5',
              'prose-code:bg-pkt-bg-subtle prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm',
              'prose-blockquote:border-l-4 prose-blockquote:border-pkt-border-default prose-blockquote:pl-4 prose-blockquote:italic',
              'prose-a:text-pkt-text-link prose-a:underline'
            )}
            style={{ minHeight: `${rows * 1.5}rem` }}
          >
            {value ? (
              <ReactMarkdown>{value}</ReactMarkdown>
            ) : (
              <p className="text-pkt-text-placeholder italic">Ingen innhold å forhåndsvise</p>
            )}
          </div>
        )}

        {/* Footer hint */}
        <div className="px-3 py-1.5 bg-pkt-bg-subtle border-t border-pkt-border-subtle">
          <p className="text-xs text-pkt-text-body-muted">
            Markdown støttes. Bruk **fet**, *kursiv*, - lister, og mer.
          </p>
        </div>
      </div>
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';
