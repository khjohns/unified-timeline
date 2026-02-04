/**
 * MarkdownEditor Component
 *
 * GitHub-style markdown editor with Write/Preview tabs and formatting toolbar.
 * Uses Radix UI Toolbar and react-markdown for preview.
 * Mobile-optimized with stacked layout and larger touch targets.
 */

import { forwardRef, useState, useRef, useCallback, useMemo } from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TurndownService from 'turndown';
import clsx from 'clsx';
import {
  FontBoldIcon,
  FontItalicIcon,
  ListBulletIcon,
  CodeIcon,
  QuoteIcon,
  Link2Icon,
  HeadingIcon,
  TableIcon,
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

type FormatAction = 'bold' | 'italic' | 'heading' | 'list' | 'code' | 'quote' | 'link' | 'table';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Hide on mobile */
  hideOnMobile?: boolean;
}

function ToolbarButton({ icon, label, onClick, disabled, hideOnMobile }: ToolbarButtonProps) {
  return (
    <Toolbar.Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx(
        'p-2 sm:p-1.5 rounded transition-colors',
        'hover:bg-pkt-bg-subtle active:bg-pkt-bg-subtle',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-pkt-brand-purple-1000/30',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'text-pkt-text-body-muted hover:text-pkt-text-body-default',
        hideOnMobile && 'hidden sm:inline-flex'
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
      rows = 8,
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

    // Turndown instance for HTML to Markdown conversion (e.g., pasting from Word)
    const turndown = useMemo(() => {
      const service = new TurndownService({
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
      });
      // Remove empty links and spans that Word often produces
      service.addRule('removeEmptyLinks', {
        filter: (node) =>
          node.nodeName === 'A' && !node.textContent?.trim(),
        replacement: () => '',
      });
      return service;
    }, []);

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
          case 'heading': {
            // If at line start or selection starts at line start
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const prefix = start === lineStart ? '' : '\n';
            newText = `${prefix}## ${selectedText || 'Overskrift'}`;
            cursorOffset = selectedText ? newText.length : 3;
            break;
          }
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
          case 'table':
            newText = `\n| Kolonne 1 | Kolonne 2 |\n|-----------|-----------|\n| Celle 1   | Celle 2   |\n`;
            cursorOffset = 3;
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

    // Handle paste - convert HTML (e.g., from Word) to Markdown
    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const html = e.clipboardData.getData('text/html');
        if (!html) return; // No HTML, let default paste handle plain text

        // Check if this looks like rich content (not just plain text wrapped in HTML)
        const hasFormatting = /<(strong|em|b|i|ul|ol|li|h[1-6]|p|table|tr|td|th|blockquote|a\s)/i.test(html);
        if (!hasFormatting) return; // Plain text, use default behavior

        e.preventDefault();

        const markdown = turndown.turndown(html).trim();
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = value.substring(0, start) + markdown + value.substring(end);
        onChange(newValue);

        // Position cursor after inserted text
        requestAnimationFrame(() => {
          textarea.focus();
          const newCursorPos = start + markdown.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        });
      },
      [value, onChange, textareaRef, turndown]
    );

    return (
      <div className={clsx('border-2 rounded-lg overflow-hidden',
        error ? 'border-pkt-border-red' : 'border-pkt-border-default',
        disabled && 'opacity-50',
        fullWidth && 'w-full',
        className
      )}>
        {/* Header with tabs and toolbar - stacked on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-pkt-bg-subtle border-b border-pkt-border-subtle">
          {/* Tabs */}
          <div className="flex border-b sm:border-b-0 border-pkt-border-subtle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'write'}
              onClick={() => setActiveTab('write')}
              disabled={disabled}
              className={clsx(
                'flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-sm font-medium transition-colors',
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
                'flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-sm font-medium transition-colors',
                activeTab === 'preview'
                  ? 'bg-pkt-bg-default text-pkt-text-body-dark border-b-2 border-pkt-text-body-dark -mb-px'
                  : 'text-pkt-text-body-muted hover:text-pkt-text-body-default'
              )}
            >
              Forhåndsvis
            </button>
          </div>

          {/* Toolbar - visible in write mode, scrollable on mobile */}
          {activeTab === 'write' && (
            <Toolbar.Root
              className="flex items-center gap-0.5 px-2 py-1.5 overflow-x-auto"
              aria-label="Formateringsverktøy"
            >
              <ToolbarButton
                icon={<FontBoldIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
                label="Fet tekst"
                onClick={() => insertFormat('bold')}
                disabled={disabled}
              />
              <ToolbarButton
                icon={<FontItalicIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
                label="Kursiv"
                onClick={() => insertFormat('italic')}
                disabled={disabled}
              />
              <ToolbarButton
                icon={<ListBulletIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
                label="Punktliste"
                onClick={() => insertFormat('list')}
                disabled={disabled}
              />

              <Toolbar.Separator className="w-px h-5 bg-pkt-border-subtle mx-1" />

              <ToolbarButton
                icon={<HeadingIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
                label="Overskrift"
                onClick={() => insertFormat('heading')}
                disabled={disabled}
              />
              <ToolbarButton
                icon={<QuoteIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
                label="Sitat"
                onClick={() => insertFormat('quote')}
                disabled={disabled}
              />
              <ToolbarButton
                icon={<CodeIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
                label="Kode"
                onClick={() => insertFormat('code')}
                disabled={disabled}
                hideOnMobile
              />
              <ToolbarButton
                icon={<Link2Icon className="w-5 h-5 sm:w-4 sm:h-4" />}
                label="Lenke"
                onClick={() => insertFormat('link')}
                disabled={disabled}
                hideOnMobile
              />
              <ToolbarButton
                icon={<TableIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
                label="Tabell"
                onClick={() => insertFormat('table')}
                disabled={disabled}
                hideOnMobile
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
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            aria-describedby={ariaDescribedBy}
            aria-invalid={error ? 'true' : 'false'}
            className={clsx(
              'w-full px-3 py-3 text-base',
              'bg-pkt-bg-default text-pkt-text-body-default',
              'placeholder:text-pkt-text-placeholder',
              'resize-y min-h-[180px] sm:min-h-[150px]',
              'focus:outline-none',
              'border-0'
            )}
          />
        ) : (
          <div
            className={clsx(
              'px-3 py-3 min-h-[180px] sm:min-h-[150px] bg-pkt-bg-default',
              'markdown-preview'
            )}
            style={{ minHeight: `${rows * 1.5}rem` }}
          >
            {value ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            ) : (
              <p className="text-pkt-text-placeholder italic">Ingen innhold å forhåndsvise</p>
            )}
          </div>
        )}

        {/* Footer hint - hidden on mobile for space */}
        <div className="hidden sm:block px-3 py-1.5 bg-pkt-bg-subtle border-t border-pkt-border-subtle">
          <p className="text-xs text-pkt-text-body-muted">
            Markdown støttes. Bruk **fet**, *kursiv*, - lister, og mer.
          </p>
        </div>
      </div>
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';
