/**
 * Timeline Component
 *
 * Displays an immutable, chronological history of all events.
 * Provides expandable details for each event.
 * Includes "Vis skjema" button to view full submitted form data.
 */

import { TimelineItem } from './TimelineItem';
import { ViewSubmittedEventModal } from './ViewSubmittedEventModal';
import { RevisionTag } from '../primitives/RevisionTag';
import { TimelineEntry, SporType } from '../../types/timeline';
import { useState, useMemo } from 'react';
import { FileTextIcon, ClipboardIcon } from '@radix-ui/react-icons';

// Event types that represent updates/revisions
const UPDATE_EVENT_TYPES = [
  'grunnlag_oppdatert',
  'vederlag_krav_oppdatert',
  'frist_krav_oppdatert',
  'respons_grunnlag_oppdatert',
  'respons_vederlag_oppdatert',
  'respons_frist_oppdatert',
];

/**
 * Calculate revision number for an event based on timeline history
 */
function getRevisionNumber(
  event: TimelineEntry,
  events: TimelineEntry[]
): number | null {
  if (!event.event_type || !UPDATE_EVENT_TYPES.includes(event.event_type)) {
    return null;
  }

  // Count how many updates of the same type came before this one
  const sameTypeUpdates = events
    .filter(
      (e) =>
        e.event_type === event.event_type &&
        e.spor === event.spor &&
        e.rolle === event.rolle &&
        new Date(e.tidsstempel) <= new Date(event.tidsstempel)
    )
    .sort(
      (a, b) =>
        new Date(a.tidsstempel).getTime() - new Date(b.tidsstempel).getTime()
    );

  const index = sameTypeUpdates.findIndex((e) => e.event_id === event.event_id);
  // Return revision number (1-indexed since 0 is the original)
  return index >= 0 ? index + 1 : null;
}

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
        {events.map((event) => {
          const revisionNumber = getRevisionNumber(event, events);
          const isRevision = revisionNumber !== null;

          return (
          <TimelineItem
            key={event.event_id}
            timestamp={event.tidsstempel}
            actor={`${event.aktor} (${event.rolle})`}
            eventType={event.type}
            description={
              <div className="flex items-start gap-2">
                <span>{event.sammendrag}</span>
                {isRevision && (
                  <RevisionTag version={revisionNumber} size="sm" />
                )}
              </div>
            }
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
          );
        })}
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
