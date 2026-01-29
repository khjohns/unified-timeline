/**
 * ExpandableText Component
 *
 * Shows truncated text with a chevron that expands to full text.
 * Chevron animates smoothly, text swaps instantly.
 */

import { useState } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import clsx from 'clsx';

interface ExpandableTextProps {
  /** The full text to display */
  children: string;
  /** Text shown when collapsed. If not provided, uses first sentence of children */
  preview?: string;
  /** Start expanded */
  defaultExpanded?: boolean;
  /** Additional class names */
  className?: string;
}

export function ExpandableText({
  children,
  preview,
  defaultExpanded = false,
  className = '',
}: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Use provided preview or extract first sentence
  const previewText = preview ?? extractFirstSentence(children);

  // Don't show expand/collapse if preview equals full text
  const needsExpansion = previewText.trim() !== children.trim();

  if (!needsExpansion) {
    return <span className={className}>{children}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => setIsExpanded(!isExpanded)}
      className={clsx('inline-flex items-start gap-1.5 text-left', className)}
    >
      <span>{isExpanded ? children : previewText}</span>
      <ChevronDownIcon
        className={clsx(
          'w-4 h-4 shrink-0 mt-0.5 text-pkt-text-body-muted transition-transform duration-200',
          isExpanded && 'rotate-180'
        )}
      />
    </button>
  );
}

/**
 * Extract first sentence from text.
 * Handles common sentence endings: . ! ?
 */
function extractFirstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0] : text;
}
