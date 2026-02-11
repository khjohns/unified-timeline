/**
 * LockedValueExtension - TipTap extension for non-editable inline values
 *
 * Renders locked values (numbers, percentages, amounts, dates) as styled badges
 * that cannot be edited. Users must change the source value in the form to update.
 *
 * Token format: {{type:value:display}}
 * Examples:
 *   {{dager:20:20 dager}}
 *   {{belop:150000:kr 150 000,-}}
 *   {{prosent:67:67%}}
 *   {{dato:2026-06-15:15.06.2026}}
 *
 * @see BegrunnelseEditor.tsx for usage
 */

import { Node, mergeAttributes } from '@tiptap/core';

// Supported locked value types
export type LockedValueType = 'dager' | 'belop' | 'prosent' | 'dato' | 'paragraf' | 'tekst';

export interface LockedValueAttributes {
  type: LockedValueType;
  value: string;
  display: string;
}

// Token regex for parsing: {{type:value:display}}
export const LOCKED_VALUE_TOKEN_REGEX = /\{\{(\w+):([^:}]+):([^}]+)\}\}/g;

/**
 * Parse a string with locked value tokens into segments
 */
export interface ParsedSegment {
  type: 'text' | 'locked';
  content: string;
  lockedValue?: LockedValueAttributes;
}

export function parseLockedValueTokens(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let lastIndex = 0;

  const regex = new RegExp(LOCKED_VALUE_TOKEN_REGEX.source, 'g');
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add the locked value
    segments.push({
      type: 'locked',
      content: match[3]!, // display value
      lockedValue: {
        type: match[1]! as LockedValueType,
        value: match[2]!,
        display: match[3]!,
      },
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Convert segments back to token string
 */
export function serializeLockedValueTokens(segments: ParsedSegment[]): string {
  return segments
    .map((seg) => {
      if (seg.type === 'locked' && seg.lockedValue) {
        const { type, value, display } = seg.lockedValue;
        return `{{${type}:${value}:${display}}}`;
      }
      return seg.content;
    })
    .join('');
}

/**
 * TipTap Node extension for locked values
 */
export const LockedValueNode = Node.create({
  name: 'lockedValue',

  // Atomic means it's treated as a single unit - cannot be split or edited internally
  atom: true,

  // Inline element that flows with text
  inline: true,
  group: 'inline',

  // Can be selected and dragged to new positions
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      type: {
        default: 'tekst',
        parseHTML: (element) => element.getAttribute('data-locked-type'),
        renderHTML: (attributes) => ({ 'data-locked-type': attributes.type }),
      },
      value: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-locked-value'),
        renderHTML: (attributes) => ({ 'data-locked-value': attributes.value }),
      },
      display: {
        default: '',
        parseHTML: (element) => element.textContent,
        renderHTML: () => ({}), // Display is rendered as content, not attribute
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-locked-value]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-locked-value': node.attrs.value,
        'data-locked-type': node.attrs.type,
        class: `locked-value locked-value--${node.attrs.type}`,
        contenteditable: 'false',
      }),
      node.attrs.display,
    ];
  },

  // Keyboard handling - prevent deletion with backspace/delete
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;

        // Check if we're right after a locked value
        const nodeBefore = $from.nodeBefore;
        if (nodeBefore?.type.name === 'lockedValue') {
          // Prevent deletion - return true to stop the event
          return true;
        }
        return false;
      },
      Delete: ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;

        // Check if we're right before a locked value
        const nodeAfter = $from.nodeAfter;
        if (nodeAfter?.type.name === 'lockedValue') {
          return true;
        }
        return false;
      },
    };
  },
});

/**
 * Helper to create locked value token strings
 */
export function createLockedValueToken(
  type: LockedValueType,
  value: string | number,
  display: string
): string {
  return `{{${type}:${value}:${display}}}`;
}

/**
 * Formatting helpers for creating display strings
 */
export const lockedValueFormatters = {
  dager: (value: number): string => createLockedValueToken('dager', value, `${value} dager`),

  belop: (value: number): string => {
    const formatted = `kr ${value.toLocaleString('nb-NO')},-`;
    return createLockedValueToken('belop', value, formatted);
  },

  prosent: (value: number): string => createLockedValueToken('prosent', value, `${value}%`),

  dato: (value: string): string => {
    // Convert ISO date to Norwegian format
    const date = new Date(value);
    const formatted = date.toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return createLockedValueToken('dato', value, formatted);
  },

  paragraf: (value: string): string => createLockedValueToken('paragraf', value, value),

  tekst: (value: string): string => createLockedValueToken('tekst', value, value),
};

export default LockedValueNode;
