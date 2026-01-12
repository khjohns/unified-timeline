/**
 * RevisionTag Component
 *
 * Displays revision version and optionally date.
 * Used in modals and timeline to show which revision an event represents.
 */

import clsx from 'clsx';
import { formatVersionLabel, formatRevisionDate } from '../../hooks/useRevisionHistory';

export interface RevisionTagProps {
  /** Version number (0 = original, 1+ = revision) */
  version: number;
  /** Optional ISO date string */
  date?: string;
  /** Show date alongside version */
  showDate?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

export function RevisionTag({
  version,
  date,
  showDate = false,
  size = 'sm',
  className,
}: RevisionTagProps) {
  const isOriginal = version === 0;
  const label = formatVersionLabel(version);

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 font-medium border rounded-none',
        // Original is neutral, revisions are highlighted (uses semantic colors)
        isOriginal
          ? 'bg-tag-neutral-bg text-tag-neutral-text border-tag-neutral-border'
          : 'bg-tag-info-bg text-tag-info-text border-tag-info-border',
        // Size variants
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm',
        className
      )}
    >
      <span>{label}</span>
      {showDate && date && (
        <>
          <span className="text-tag-neutral-text">•</span>
          <span className={isOriginal ? 'text-tag-neutral-text' : 'text-tag-info-text'}>
            {formatRevisionDate(date)}
          </span>
        </>
      )}
    </span>
  );
}

/**
 * UpdatedTag Component
 *
 * Shows "Oppdatert" tag for BH response updates (not new revisions).
 * Used when BH updates their response to the same claim version.
 */
export interface UpdatedTagProps {
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

export function UpdatedTag({ size = 'sm', className }: UpdatedTagProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 font-medium border rounded-none',
        // Uses semantic warning colors (amber in light, golden in dark)
        'bg-tag-warning-bg text-tag-warning-text border-tag-warning-border',
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm',
        className
      )}
    >
      Oppdatert
    </span>
  );
}

/**
 * RevisionTagGroup Component
 *
 * Shows version tag with optional "outdated" warning.
 */
export interface RevisionTagGroupProps {
  /** Current version */
  version: number;
  /** Date of this version */
  date?: string;
  /** Total number of revisions (for context) */
  totalRevisions?: number;
  /** Whether this represents an outdated response */
  isOutdated?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

export function RevisionTagGroup({
  version,
  date,
  totalRevisions,
  isOutdated = false,
  size = 'sm',
  className,
}: RevisionTagGroupProps) {
  return (
    <div className={clsx('inline-flex items-center gap-2', className)}>
      <RevisionTag version={version} date={date} showDate={!!date} size={size} />
      {totalRevisions !== undefined && totalRevisions > 0 && (
        <span
          className={clsx(
            'text-tag-neutral-text',
            size === 'sm' ? 'text-xs' : 'text-sm'
          )}
        >
          ({totalRevisions} {totalRevisions === 1 ? 'revisjon' : 'revisjoner'})
        </span>
      )}
      {isOutdated && (
        <span
          className={clsx(
            'inline-flex items-center gap-1 font-medium border rounded-none',
            // Uses semantic warning colors
            'bg-tag-warning-bg text-tag-warning-text border-tag-warning-border',
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
          )}
        >
          <svg
            className="w-3 h-3"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          Utdatert
        </span>
      )}
    </div>
  );
}
