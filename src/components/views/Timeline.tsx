/**
 * Timeline Component
 *
 * Displays an immutable, chronological history of all events.
 * Provides expandable details for each event.
 * Includes "Vis skjema" button to view full submitted form data.
 */

import { TimelineItem } from './TimelineItem';
import { ViewSubmittedEventModal } from './ViewSubmittedEventModal';
import { TimelineEntry } from '../../types/timeline';
import { useState } from 'react';
import { FileTextIcon, ClipboardIcon } from '@radix-ui/react-icons';

interface TimelineProps {
  events: TimelineEntry[];
}

/**
 * Timeline renders a chronological list of events
 */
export function Timeline({ events }: TimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEntry | null>(null);

  // Show empty state if no events
  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <ClipboardIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Ingen hendelser ennå.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-0" aria-label="Tidslinje over hendelser">
        {events.map((event) => (
          <TimelineItem
            key={event.event_id}
            timestamp={event.tidsstempel}
            actor={`${event.aktor} (${event.rolle})`}
            eventType={event.type}
            description={event.sammendrag}
            details={
              <div className="text-sm text-gray-600 space-y-3">
                <div>
                  <p>Event ID: {event.event_id}</p>
                  <p>Spor: {event.spor || 'N/A'}</p>
                </div>
                {/* Show "Vis skjema" button if event has data */}
                {event.event_data && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(event);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-oslo-blue hover:bg-oslo-blue-dark rounded transition-colors"
                  >
                    <FileTextIcon className="h-4 w-4" />
                    Vis innsendt skjema
                  </button>
                )}
              </div>
            }
            isExpanded={expandedId === event.event_id}
            onToggle={() =>
              setExpandedId(expandedId === event.event_id ? null : event.event_id)
            }
          />
        ))}
      </ul>

      {/* Modal for viewing full submitted form */}
      {selectedEvent && (
        <ViewSubmittedEventModal
          open={!!selectedEvent}
          onOpenChange={(open) => !open && setSelectedEvent(null)}
          event={selectedEvent}
        />
      )}
    </>
  );
}
