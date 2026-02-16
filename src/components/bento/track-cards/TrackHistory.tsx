import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import type { SporHistoryEntry } from '../../views/SporHistory';

interface TrackHistoryProps {
  entries: SporHistoryEntry[];
  className?: string;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

const DEFAULT_VISIBLE = 2;
const MAX_VISIBLE = 5;

export function TrackHistory({ entries, className }: TrackHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  const visible = expanded
    ? entries.slice(0, MAX_VISIBLE)
    : entries.slice(0, DEFAULT_VISIBLE);
  const hasMore = entries.length > DEFAULT_VISIBLE;

  return (
    <div className={clsx('mt-2', className)}>
      <div className="bg-pkt-bg-subtle/30 rounded-sm p-2 space-y-1">
        {visible.map((entry) => (
          <div key={entry.id} className="flex items-baseline gap-2">
            <span className="text-bento-label font-mono text-pkt-text-body-muted tabular-nums shrink-0">
              {formatShortDate(entry.tidsstempel)}
            </span>
            <span className="text-bento-caption text-pkt-text-body-default truncate">
              {entry.sammendrag}
            </span>
            <span
              className={clsx(
                'text-bento-micro font-medium uppercase shrink-0 px-1 py-0.5 rounded-sm',
                entry.aktorRolle === 'BH'
                  ? 'bg-pkt-brand-warm-blue-1000/10 text-pkt-brand-warm-blue-1000'
                  : 'bg-pkt-grays-gray-100 text-pkt-text-body-subtle',
              )}
            >
              {entry.aktorRolle}
            </span>
          </div>
        ))}
        {hasMore && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 text-bento-caption text-pkt-text-body-subtle hover:text-pkt-text-body-default transition-colors mt-1"
          >
            <ChevronDownIcon className="w-3 h-3" />
            Vis alle {entries.length} hendelser
          </button>
        )}
        {expanded && entries.length > MAX_VISIBLE && (
          <button
            type="button"
            className="text-bento-caption text-pkt-brand-warm-blue-1000 hover:underline mt-1"
            onClick={() => {/* could expand further or open modal */}}
          >
            Vis alle {entries.length} hendelser
          </button>
        )}
        {expanded && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex items-center gap-1 text-bento-caption text-pkt-text-body-subtle hover:text-pkt-text-body-default transition-colors mt-1"
          >
            <ChevronUpIcon className="w-3 h-3" />
            Skjul
          </button>
        )}
      </div>
    </div>
  );
}
