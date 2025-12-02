/**
 * Timeline Component
 *
 * Displays an immutable, chronological history of all events.
 * Provides expandable details for each event.
 */

import { TimelineItem } from './TimelineItem';
import { TimelineEntry } from '../../types/timeline';
import { useState } from 'react';

interface TimelineProps {
  events: TimelineEntry[];
}

/**
 * Timeline renders a chronological list of events
 */
export function Timeline({ events }: TimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Show empty state if no events
  if (events.length === 0) {
    return (
      <div className="p-pkt-08 text-center text-gray-500">
        <p>Ingen hendelser ennå.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-0" role="feed" aria-label="Tidslinje over hendelser">
      {events.map((event) => (
        <TimelineItem
          key={event.event_id}
          timestamp={event.tidsstempel}
          actor={`${event.aktor} (${event.rolle})`}
          eventType={event.type}
          description={event.sammendrag}
          details={
            // TODO: Add details rendering based on event type
            // For now, just show event ID
            <div className="text-sm text-gray-600">
              <p>Event ID: {event.event_id}</p>
              <p>Spor: {event.spor || 'N/A'}</p>
            </div>
          }
          isExpanded={expandedId === event.event_id}
          onToggle={() =>
            setExpandedId(expandedId === event.event_id ? null : event.event_id)
          }
        />
      ))}
    </ul>
  );
}
