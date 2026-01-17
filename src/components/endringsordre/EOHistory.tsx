/**
 * EOHistory Component
 *
 * Displays event history for endringsordre cases using ActivityHistory primitive.
 * Transforms EO-specific TimelineEvent[] to ActivityHistoryEntry[].
 */

import { useMemo } from 'react';
import {
  PlusCircledIcon,
  PaperPlaneIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  UpdateIcon,
  PlusIcon,
  MinusIcon,
  FileTextIcon,
} from '@radix-ui/react-icons';
import type { TimelineEvent } from '../../types/timeline';
import { extractEventType } from '../../types/timeline';
import { formatDateMedium } from '../../utils/formatters';
import { ActivityHistory, type ActivityHistoryEntry, type ActivityHistoryVariant } from '../primitives/ActivityHistory';

// Event type configuration
const EO_EVENT_CONFIG: Record<string, {
  icon: React.ReactNode;
  variant: ActivityHistoryVariant;
  label: string;
}> = {
  'eo_opprettet': {
    icon: <PlusCircledIcon className="h-3.5 w-3.5" />,
    variant: 'info',
    label: 'Endringsordre opprettet',
  },
  'eo_utstedt': {
    icon: <PaperPlaneIcon className="h-3.5 w-3.5" />,
    variant: 'warning',
    label: 'Endringsordre utstedt',
  },
  'eo_akseptert': {
    icon: <CheckCircledIcon className="h-3.5 w-3.5" />,
    variant: 'success',
    label: 'Akseptert av TE',
  },
  'eo_bestridt': {
    icon: <CrossCircledIcon className="h-3.5 w-3.5" />,
    variant: 'danger',
    label: 'Bestridt av TE',
  },
  'eo_revidert': {
    icon: <UpdateIcon className="h-3.5 w-3.5" />,
    variant: 'warning',
    label: 'Revidert av BH',
  },
  'eo_koe_lagt_til': {
    icon: <PlusIcon className="h-3.5 w-3.5" />,
    variant: 'neutral',
    label: 'KOE lagt til',
  },
  'eo_koe_fjernet': {
    icon: <MinusIcon className="h-3.5 w-3.5" />,
    variant: 'neutral',
    label: 'KOE fjernet',
  },
};

const DEFAULT_CONFIG = {
  icon: <FileTextIcon className="h-3.5 w-3.5" />,
  variant: 'neutral' as ActivityHistoryVariant,
  label: 'Hendelse',
};

function transformEOEvent(event: TimelineEvent): ActivityHistoryEntry {
  const eventType = extractEventType(event.type) || '';
  const config = EO_EVENT_CONFIG[eventType] || DEFAULT_CONFIG;

  return {
    id: event.id,
    icon: config.icon,
    variant: config.variant,
    label: config.label,
    meta: `${event.actorrole || 'System'} · ${event.actor || 'Ukjent'} · ${formatDateMedium(event.time)}`,
    description: event.summary || undefined,
  };
}

interface EOHistoryProps {
  entries: TimelineEvent[];
  defaultOpen?: boolean;
  className?: string;
}

export function EOHistory({ entries, defaultOpen = false, className }: EOHistoryProps) {
  const activityEntries = useMemo((): ActivityHistoryEntry[] => {
    // Sort by time ascending (oldest first)
    const sorted = [...entries].sort(
      (a, b) => new Date(a.time || '').getTime() - new Date(b.time || '').getTime()
    );
    return sorted.map(transformEOEvent);
  }, [entries]);

  if (activityEntries.length === 0) {
    return null;
  }

  return (
    <ActivityHistory
      entries={activityEntries}
      label="Historikk"
      defaultOpen={defaultOpen}
      className={className}
    />
  );
}
