/**
 * Timeline Component
 *
 * Displays an immutable, chronological history of all events.
 * Provides expandable details for each event.
 * Includes "Vis skjema" button to view full submitted form data.
 */

import { EventDetailModal } from './EventDetailModal';
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

  /**
   * Format date for minimal display (dd.mm)
   */
  function formatDateMinimal(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  // Show empty state if no events
  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-pkt-grays-gray-500">
        <ClipboardIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Ingen hendelser ennå.</p>
      </div>
    );
  }

  return (
    <>
      {/* Simple line-style timeline (Forslag B: Minimal Soft) */}
      <div className="space-y-0" role="list" aria-label="Tidslinje over hendelser">
        {events.map((event) => {
          const tagInfo = getEventTagInfo(event, events);

          return (
            <div
              key={event.event_id}
              className="flex gap-4 py-3 border-b border-pkt-grays-gray-100 last:border-b-0 group cursor-pointer hover:bg-pkt-bg-subtle transition-colors"
              onClick={() => setExpandedId(expandedId === event.event_id ? null : event.event_id)}
              role="listitem"
            >
              {/* Date column */}
              <span className="text-sm text-pkt-grays-gray-500 w-12 shrink-0">
                {formatDateMinimal(event.tidsstempel)}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <span className="text-sm text-pkt-text-body-dark">
                    {event.sammendrag}
                  </span>
                  {tagInfo.showRevision && tagInfo.version !== undefined && (
                    <RevisionTag version={tagInfo.version} size="sm" />
                  )}
                  {tagInfo.showUpdated && (
                    <UpdatedTag size="sm" />
                  )}
                </div>

                {/* Expanded details */}
                {expandedId === event.event_id && (
                  <div className="mt-3 text-sm text-pkt-grays-gray-600 space-y-2">
                    <p className="text-xs text-pkt-grays-gray-500">
                      {event.aktor} ({event.rolle}) • {event.spor || 'Generelt'}
                    </p>
                    {event.event_data && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-pkt-brand-blue-1000 bg-pkt-surface-light-blue hover:bg-pkt-brand-blue-100 rounded-lg transition-colors"
                      >
                        <FileTextIcon className="h-4 w-4" />
                        Vis innsendt skjema
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for viewing full submitted form */}
      {selectedEvent && (
        <EventDetailModal
          open={!!selectedEvent}
          onOpenChange={(open) => !open && setSelectedEvent(null)}
          event={selectedEvent}
        />
      )}
    </>
  );
}
