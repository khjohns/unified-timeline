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

const MAX_VISIBLE = 5;

export function TrackHistory({ entries, className }: TrackHistoryProps) {
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;

  const label = entries.length === 1 ? '1 hendelse' : `${entries.length} hendelser`;
  const visible = open ? entries.slice(0, MAX_VISIBLE) : [];
  const hasMore = entries.length > MAX_VISIBLE;

  return (
    <div className={clsx('mt-2', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] text-pkt-text-body-subtle hover:text-pkt-text-body-default transition-colors"
      >
        {open ? (
          <ChevronUpIcon className="w-3 h-3" />
        ) : (
          <ChevronDownIcon className="w-3 h-3" />
        )}
        {label}
      </button>

      {open && (
        <div className="bg-pkt-bg-subtle/30 rounded-sm p-2 mt-1 space-y-1 animate-in slide-in-from-top-1 duration-200">
          {visible.map((entry) => (
            <div key={entry.id} className="flex items-baseline gap-2">
              <span className="text-[10px] font-mono text-pkt-text-body-muted tabular-nums shrink-0">
                {formatShortDate(entry.tidsstempel)}
              </span>
              <span className="text-[11px] text-pkt-text-body-default truncate">
                {entry.sammendrag}
              </span>
              <span
                className={clsx(
                  'text-[9px] font-medium uppercase shrink-0 px-1 py-0.5 rounded-sm',
                  entry.aktorRolle === 'BH'
                    ? 'bg-pkt-brand-warm-blue-1000/10 text-pkt-brand-warm-blue-1000'
                    : 'bg-pkt-grays-gray-100 text-pkt-text-body-subtle',
                )}
              >
                {entry.aktorRolle}
              </span>
            </div>
          ))}
          {hasMore && (
            <button
              type="button"
              className="text-[11px] text-pkt-brand-warm-blue-1000 hover:underline mt-1"
              onClick={() => {/* could expand further or open modal */}}
            >
              Vis alle {entries.length} hendelser
            </button>
          )}
        </div>
      )}
    </div>
  );
}
