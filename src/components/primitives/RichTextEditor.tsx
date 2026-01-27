/**
 * RichTextEditor Component
 *
 * WYSIWYG editor using TipTap with markdown import/export.
 * Provides familiar formatting without requiring markdown knowledge.
 * Mobile-optimized with responsive toolbar.
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import * as Toolbar from '@radix-ui/react-toolbar';
import TurndownService from 'turndown';
import { marked } from 'marked';
import clsx from 'clsx';
import { useEffect, useMemo, useCallback } from 'react';
import {
  FontBoldIcon,
  FontItalicIcon,
  ListBulletIcon,
  CodeIcon,
  QuoteIcon,
  Link2Icon,
  TableIcon,
  StrikethroughIcon,
  ChevronDownIcon,
} from '@radix-ui/react-icons';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './DropdownMenu';

// Custom icon for ordered/numbered list (not in Radix Icons)
function OrderedListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 2H3.5V5H2.5V2Z" fill="currentColor"/>
      <text x="2.3" y="11.5" fontSize="4" fill="currentColor" fontFamily="system-ui">2</text>
      <path d="M5.5 3.5H12.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5.5 7.5H12.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5.5 11.5H12.5" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

// Custom icon for inline code (backtick style)
function InlineCodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="3" y="11" fontSize="10" fill="currentColor" fontFamily="monospace">`</text>
      <text x="8" y="11" fontSize="10" fill="currentColor" fontFamily="monospace">`</text>
    </svg>
  );
}

export interface RichTextEditorProps {
  /** Current value (markdown string) */
  value: string;
  /** Change handler (returns markdown string) */
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
  /** ID for accessibility */
  id?: string;
  /** aria-describedby for accessibility */
  'aria-describedby'?: string;
  /** Minimum height in pixels */
  minHeight?: number;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  hideOnMobile?: boolean;
}

function ToolbarButton({ icon, label, onClick, disabled, active, hideOnMobile }: ToolbarButtonProps) {
  return (
    <Toolbar.Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={clsx(
        'p-2 sm:p-1.5 rounded transition-colors',
        active
          ? 'bg-pkt-bg-subtle text-pkt-text-body-dark'
          : 'hover:bg-pkt-bg-subtle active:bg-pkt-bg-subtle text-pkt-text-body-muted hover:text-pkt-text-body-default',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-pkt-brand-purple-1000/30',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        hideOnMobile && 'hidden sm:inline-flex'
      )}
    >
      {icon}
    </Toolbar.Button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Skriv her...',
  error,
  disabled,
  fullWidth,
  className,
  id,
  'aria-describedby': ariaDescribedBy,
  minHeight = 150,
}: RichTextEditorProps) {
  // Turndown for HTML -> Markdown conversion
  const turndown = useMemo(() => {
    const service = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
    });
    // Handle tables
    service.addRule('tableCell', {
      filter: ['th', 'td'],
      replacement: (content) => ` ${content.trim()} |`,
    });
    service.addRule('tableRow', {
      filter: 'tr',
      replacement: (content) => `|${content}\n`,
    });
    service.addRule('table', {
      filter: 'table',
      replacement: (_content, node) => {
        const rows = node.querySelectorAll('tr');
        let result = '';
        rows.forEach((row, i) => {
          const cells = row.querySelectorAll('th, td');
          const cellContents: string[] = [];
          cells.forEach((cell) => cellContents.push(cell.textContent?.trim() || ''));
          result += `| ${cellContents.join(' | ')} |\n`;
          if (i === 0) {
            result += `| ${cellContents.map(() => '---').join(' | ')} |\n`;
          }
        });
        return result + '\n';
      },
    });
    // Handle strikethrough: <s>, <strike>, <del> -> ~~text~~
    // Note: 'strike' is deprecated HTML but still used by some editors
    service.addRule('strikethrough', {
      filter: ['s', 'del'] as const,
      replacement: (content) => `~~${content}~~`,
    });
    return service;
  }, []);

  // Convert markdown to HTML for initial content
  const initialContent = useMemo(() => {
    if (!value) return '';
    return marked.parse(value, { async: false }) as string;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-pkt-text-action-active underline',
        },
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: 'rich-editor-table',
        },
      }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = turndown.turndown(html);
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        id: id || '',
        'aria-describedby': ariaDescribedBy || '',
        'aria-invalid': error ? 'true' : 'false',
        class: 'focus:outline-none',
      },
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== turndown.turndown(editor.getHTML())) {
      const html = marked.parse(value, { async: false }) as string;
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [value, editor, turndown]);

  // Update editable state
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className={clsx(
        'border-2 rounded-lg overflow-hidden',
        error ? 'border-pkt-border-red' : 'border-pkt-border-default',
        disabled && 'opacity-50',
        fullWidth && 'w-full',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center bg-pkt-bg-subtle border-b border-pkt-border-subtle">
        <Toolbar.Root
          className="flex items-center gap-0.5 px-2 py-1.5 overflow-x-auto flex-1"
          aria-label="Formateringsverktoy"
        >
          <ToolbarButton
            icon={<FontBoldIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
            label="Fet tekst"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={disabled}
            active={editor.isActive('bold')}
          />
          <ToolbarButton
            icon={<FontItalicIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
            label="Kursiv"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={disabled}
            active={editor.isActive('italic')}
          />
          <ToolbarButton
            icon={<StrikethroughIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
            label="Gjennomstreking"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={disabled}
            active={editor.isActive('strike')}
          />
          <ToolbarButton
            icon={<ListBulletIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
            label="Punktliste"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={disabled}
            active={editor.isActive('bulletList')}
          />
          <ToolbarButton
            icon={<OrderedListIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
            label="Nummerert liste"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={disabled}
            active={editor.isActive('orderedList')}
          />

          <Toolbar.Separator className="w-px h-5 bg-pkt-border-subtle mx-1" />

          {/* Heading dropdown menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Toolbar.Button
                type="button"
                disabled={disabled}
                aria-label="Overskrift"
                title="Overskrift"
                className={clsx(
                  'inline-flex items-center gap-0.5 p-2 sm:p-1.5 rounded transition-colors',
                  editor.isActive('heading')
                    ? 'bg-pkt-bg-subtle text-pkt-text-body-dark'
                    : 'hover:bg-pkt-bg-subtle active:bg-pkt-bg-subtle text-pkt-text-body-muted hover:text-pkt-text-body-default',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-pkt-brand-purple-1000/30',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <span className="text-xs sm:text-[11px] font-bold leading-none">H</span>
                <ChevronDownIcon className="w-3 h-3" />
              </Toolbar.Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={4}>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={editor.isActive('heading', { level: 1 }) ? 'bg-pkt-bg-subtle' : ''}
              >
                <span className="text-lg font-bold">Overskrift 1</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={editor.isActive('heading', { level: 2 }) ? 'bg-pkt-bg-subtle' : ''}
              >
                <span className="text-base font-bold">Overskrift 2</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={editor.isActive('heading', { level: 3 }) ? 'bg-pkt-bg-subtle' : ''}
              >
                <span className="text-sm font-bold">Overskrift 3</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().setParagraph().run()}
                className={editor.isActive('paragraph') && !editor.isActive('heading') ? 'bg-pkt-bg-subtle' : ''}
              >
                <span className="text-sm">Normal tekst</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarButton
            icon={<QuoteIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
            label="Sitat"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            disabled={disabled}
            active={editor.isActive('blockquote')}
          />
          <ToolbarButton
            icon={<InlineCodeIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
            label="Inline kode"
            onClick={() => editor.chain().focus().toggleCode().run()}
            disabled={disabled}
            active={editor.isActive('code')}
          />
          <ToolbarButton
            icon={<CodeIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
            label="Kodeblokk"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            disabled={disabled}
            active={editor.isActive('codeBlock')}
            hideOnMobile
          />
          <ToolbarButton
            icon={<Link2Icon className="w-5 h-5 sm:w-4 sm:h-4" />}
            label="Lenke"
            onClick={setLink}
            disabled={disabled}
            active={editor.isActive('link')}
            hideOnMobile
          />
          <ToolbarButton
            icon={<TableIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
            label="Tabell"
            onClick={insertTable}
            disabled={disabled}
            active={editor.isActive('table')}
            hideOnMobile
          />
        </Toolbar.Root>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className={clsx(
          'rich-editor-content',
          'px-3 py-3 bg-pkt-bg-default',
          'text-pkt-text-body-default'
        )}
        style={{ minHeight }}
      />
    </div>
  );
}

RichTextEditor.displayName = 'RichTextEditor';
