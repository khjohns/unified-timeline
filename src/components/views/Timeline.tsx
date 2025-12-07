/**
 * Timeline Component
 *
 * Displays an immutable, chronological history of all events.
 * Provides expandable details for each event.
 * Includes "Vis skjema" button to view full submitted form data.
 */

import { TimelineItem } from './TimelineItem';
import { ViewSubmittedEventModal } from './ViewSubmittedEventModal';
import { RevisionTag, UpdatedTag } from '../primitives/RevisionTag';
import { TimelineEntry, SporType } from '../../types/timeline';
import { useState } from 'react';
import { FileTextIcon, ClipboardIcon } from '@radix-ui/react-icons';

// TE claim update event types - these get numbered revisions (Rev. 1, Rev. 2, etc.)
const TE_CLAIM_UPDATE_TYPES = [
  'grunnlag_oppdatert',
  'vederlag_krav_oppdatert',
  'frist_krav_oppdatert',
];

// BH initial response event types - these show which claim version they respond to
const BH_RESPONSE_TYPES = [
  'respons_grunnlag',
  'respons_vederlag',
  'respons_frist',
];

// BH response update event types - these get "Oppdatert" tag
const BH_RESPONSE_UPDATE_TYPES = [
  'respons_grunnlag_oppdatert',
  'respons_vederlag_oppdatert',
  'respons_frist_oppdatert',
];

interface EventTagInfo {
  /** Show revision tag with version number */
  showRevision: boolean;
  version?: number;
  /** Show "Oppdatert" tag */
  showUpdated: boolean;
}

/**
 * Get the current claim version at a given point in time
 * (how many TE claim updates existed before this timestamp)
 */
function getClaimVersionAtTime(
  spor: SporType | null,
  timestamp: string,
  events: TimelineEntry[]
): number {
  if (!spor) return 0;

  const priorTeUpdates = events.filter(
    (e) =>
      e.spor === spor &&
      e.rolle === 'TE' &&
      e.event_type &&
      TE_CLAIM_UPDATE_TYPES.includes(e.event_type) &&
      new Date(e.tidsstempel) < new Date(timestamp)
  );

  return priorTeUpdates.length;
}

/**
 * Determine what tags to show for an event
 * - TE claim updates: Show "Rev. X" (numbered based on update count)
 * - BH responses: Show "Rev. X" (which claim version they're responding to, if not original)
 * - BH response updates: Show "Rev. X" + "Oppdatert" (claim version + updated indicator)
 */
function getEventTagInfo(
  event: TimelineEntry,
  events: TimelineEntry[]
): EventTagInfo {
  if (!event.event_type) {
    return { showRevision: false, showUpdated: false };
  }

  // TE claim updates get numbered revisions
  if (TE_CLAIM_UPDATE_TYPES.includes(event.event_type)) {
    // Count how many TE claim updates came before and including this one for this spor
    const priorUpdates = events
      .filter(
        (e) =>
          e.spor === event.spor &&
          e.rolle === 'TE' &&
          e.event_type &&
          TE_CLAIM_UPDATE_TYPES.includes(e.event_type) &&
          new Date(e.tidsstempel) <= new Date(event.tidsstempel)
      )
      .sort(
        (a, b) =>
          new Date(a.tidsstempel).getTime() - new Date(b.tidsstempel).getTime()
      );

    const index = priorUpdates.findIndex((e) => e.event_id === event.event_id);
    // Revision number: 1-indexed (first update = Rev. 1)
    return {
      showRevision: true,
      version: index >= 0 ? index + 1 : 1,
      showUpdated: false,
    };
  }

  // BH initial responses show which claim version they're responding to
  if (BH_RESPONSE_TYPES.includes(event.event_type)) {
    const claimVersion = getClaimVersionAtTime(event.spor, event.tidsstempel, events);
    // Only show revision tag if responding to a revision (not the original)
    return {
      showRevision: claimVersion > 0,
      version: claimVersion > 0 ? claimVersion : undefined,
      showUpdated: false,
    };
  }

  // BH response updates show BOTH: which claim version + "Oppdatert"
  if (BH_RESPONSE_UPDATE_TYPES.includes(event.event_type)) {
    const claimVersion = getClaimVersionAtTime(event.spor, event.tidsstempel, events);
    return {
      showRevision: claimVersion > 0,
      version: claimVersion > 0 ? claimVersion : undefined,
      showUpdated: true,
    };
  }

  return { showRevision: false, showUpdated: false };
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
          const tagInfo = getEventTagInfo(event, events);

          return (
          <TimelineItem
            key={event.event_id}
            timestamp={event.tidsstempel}
            actor={`${event.aktor} (${event.rolle})`}
            eventType={event.type}
            description={
              <div className="flex items-start gap-2">
                <span>{event.sammendrag}</span>
                {tagInfo.showRevision && tagInfo.version !== undefined && (
                  <RevisionTag version={tagInfo.version} size="sm" />
                )}
                {tagInfo.showUpdated && (
                  <UpdatedTag size="sm" />
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
