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
      <div className="p-pkt-08 text-center text-gray-500">
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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
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
