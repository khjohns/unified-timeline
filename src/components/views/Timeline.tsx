/**
 * Timeline Component
 *
 * Displays an immutable, chronological history of all events.
 * Provides expandable details for each event.
 * Includes "Vis skjema" button to view full submitted form data.
 *
 * Design: Forslag 5 - Rolle-stripe + Spor-tag
 * - Farget rolle-indikator (TE=grønn, BH=gul)
 * - Spor som tag/badge (Ansvarsgrunnlag, Vederlag, Frist)
 * - Sammendrag forblir lesbart
 */

import { EventDetailModal } from './EventDetailModal';
import { RevisionTag, UpdatedTag } from '../primitives';
import { TimelineEvent, SporType, extractEventType } from '../../types/timeline';
import { useState } from 'react';
import { FileTextIcon, ClipboardIcon, ChevronDownIcon } from '@radix-ui/react-icons';

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
  events: TimelineEvent[]
): number {
  if (!spor || !timestamp) return 0;

  const priorTeUpdates = events.filter((e) => {
    const eventType = extractEventType(e.type);
    return (
      e.spor === spor &&
      e.actorrole === 'TE' &&
      eventType &&
      TE_CLAIM_UPDATE_TYPES.includes(eventType) &&
      e.time &&
      new Date(e.time) < new Date(timestamp)
    );
  });

  return priorTeUpdates.length;
}

/**
 * Determine what tags to show for an event
 * - TE claim updates: Show "Rev. X" (numbered based on update count)
 * - BH responses: Show "Rev. X" (which claim version they're responding to, if not original)
 * - BH response updates: Show "Rev. X" + "Oppdatert" (claim version + updated indicator)
 */
function getEventTagInfo(
  event: TimelineEvent,
  events: TimelineEvent[]
): EventTagInfo {
  const eventType = extractEventType(event.type);
  if (!eventType) {
    return { showRevision: false, showUpdated: false };
  }

  // TE claim updates get numbered revisions
  if (TE_CLAIM_UPDATE_TYPES.includes(eventType)) {
    // Count how many TE claim updates came before and including this one for this spor
    const priorUpdates = events
      .filter((e) => {
        const eType = extractEventType(e.type);
        return (
          e.spor === event.spor &&
          e.actorrole === 'TE' &&
          eType &&
          TE_CLAIM_UPDATE_TYPES.includes(eType) &&
          e.time &&
          event.time &&
          new Date(e.time) <= new Date(event.time)
        );
      })
      .sort(
        (a, b) =>
          new Date(a.time || '').getTime() - new Date(b.time || '').getTime()
      );

    const index = priorUpdates.findIndex((e) => e.id === event.id);
    // Revision number: 1-indexed (first update = Rev. 1)
    return {
      showRevision: true,
      version: index >= 0 ? index + 1 : 1,
      showUpdated: false,
    };
  }

  // BH initial responses show which claim version they're responding to
  if (BH_RESPONSE_TYPES.includes(eventType)) {
    const claimVersion = getClaimVersionAtTime(event.spor, event.time || '', events);
    // Only show revision tag if responding to a revision (not the original)
    return {
      showRevision: claimVersion > 0,
      version: claimVersion > 0 ? claimVersion : undefined,
      showUpdated: false,
    };
  }

  // BH response updates show BOTH: which claim version + "Oppdatert"
  if (BH_RESPONSE_UPDATE_TYPES.includes(eventType)) {
    const claimVersion = getClaimVersionAtTime(event.spor, event.time || '', events);
    return {
      showRevision: claimVersion > 0,
      version: claimVersion > 0 ? claimVersion : undefined,
      showUpdated: true,
    };
  }

  return { showRevision: false, showUpdated: false };
}

interface TimelineProps {
  events: TimelineEvent[];
}

/**
 * Get display label for spor type
 * "grunnlag" -> "Ansvarsgrunnlag" for clarity
 */
function getSporLabel(spor: SporType | null): string {
  if (!spor) return 'Generelt';
  const labels: Record<string, string> = {
    grunnlag: 'Ansvarsgrunnlag',
    vederlag: 'Vederlag',
    frist: 'Frist',
    forsering: 'Forsering',
  };
  return labels[spor] || spor;
}

/**
 * Get role indicator styling
 * TE = Green, BH = Yellow
 * Text colors use semantic variables that match circles in both light and dark mode
 */
function getRolleStyles(actorrole: 'TE' | 'BH' | undefined): { bg: string; text: string; ring: string; pillBg: string; pillText: string } {
  if (actorrole === 'TE') {
    return {
      bg: 'bg-pkt-brand-green-1000',
      text: 'text-pkt-brand-green-1000',
      ring: 'ring-pkt-brand-green-1000',
      pillBg: 'bg-role-te-pill-bg',
      pillText: 'text-row-te-text',
    };
  }
  return {
    bg: 'bg-pkt-brand-yellow-1000',
    text: 'text-pkt-brand-yellow-1000',
    ring: 'ring-pkt-brand-yellow-1000',
    pillBg: 'bg-role-bh-pill-bg',
    pillText: 'text-row-bh-text',
  };
}

/**
 * Get spor tag styling
 */
function getSporTagStyles(spor: SporType | null): string {
  if (!spor) return 'bg-pkt-grays-gray-100 text-pkt-grays-gray-600';

  const styles: Record<string, string> = {
    grunnlag: 'bg-badge-info-bg text-badge-info-text',
    vederlag: 'bg-badge-success-bg text-badge-success-text',
    frist: 'bg-tag-frist-bg text-tag-frist-text',
    forsering: 'bg-badge-warning-bg text-badge-warning-text',
  };
  return styles[spor] || 'bg-pkt-grays-gray-100 text-pkt-grays-gray-600';
}

/**
 * Timeline renders a chronological list of events
 */
export function Timeline({ events }: TimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

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

  /**
   * Format date for expanded view (full date with year)
   */
  function formatDateFull(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      {/* Forslag 5: Rolle-stripe + Spor-tag timeline */}
      <div className="space-y-0" role="list" aria-label="Tidslinje over hendelser">
        {events.map((event) => {
          const tagInfo = getEventTagInfo(event, events);
          const rolleStyles = getRolleStyles(event.actorrole);
          const isExpanded = expandedId === event.id;

          return (
            <div
              key={event.id}
              className="group cursor-pointer hover:bg-pkt-bg-subtle transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : event.id)}
              role="listitem"
            >
              {/* Main content - responsive layout */}
              <div className="py-2 px-2 sm:py-3 border-b border-pkt-grays-gray-100">
                {/* Desktop: Single row layout */}
                <div className="hidden sm:flex items-center gap-3">
                  {/* Role indicator - colored dot */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${rolleStyles.bg}`}
                    title={event.actorrole === 'TE' ? 'Entreprenør' : 'Byggherre'}
                    role="img"
                    aria-label={event.actorrole === 'TE' ? 'Entreprenør' : 'Byggherre'}
                  />

                  {/* Date */}
                  <span className="text-sm text-pkt-grays-gray-500 w-12 shrink-0 tabular-nums">
                    {event.time ? formatDateMinimal(event.time) : ''}
                  </span>

                  {/* Spor tag */}
                  {event.spor && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${getSporTagStyles(event.spor)}`}
                    >
                      {getSporLabel(event.spor)}
                    </span>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm text-pkt-text-body-dark truncate">
                      {event.summary}
                    </span>
                    {tagInfo.showRevision && tagInfo.version !== undefined && (
                      <RevisionTag version={tagInfo.version} size="sm" />
                    )}
                    {tagInfo.showUpdated && (
                      <UpdatedTag size="sm" />
                    )}
                  </div>

                  {/* Role label + expand indicator */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${rolleStyles.pillBg} ${rolleStyles.pillText}`}>
                      {event.actorrole}
                    </span>
                    <ChevronDownIcon
                      className={`w-4 h-4 text-pkt-grays-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Mobile: Two-row layout */}
                <div className="flex flex-col gap-1.5 sm:hidden">
                  {/* Row 1: Date, spor tag, role, chevron */}
                  <div className="flex items-center gap-2">
                    {/* Role indicator - colored dot */}
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${rolleStyles.bg}`}
                      title={event.actorrole === 'TE' ? 'Entreprenør' : 'Byggherre'}
                      role="img"
                      aria-label={event.actorrole === 'TE' ? 'Entreprenør' : 'Byggherre'}
                    />

                    {/* Date */}
                    <span className="text-xs text-pkt-grays-gray-500 shrink-0 tabular-nums">
                      {event.time ? formatDateMinimal(event.time) : ''}
                    </span>

                    {/* Spor tag */}
                    {event.spor && (
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${getSporTagStyles(event.spor)}`}
                      >
                        {getSporLabel(event.spor)}
                      </span>
                    )}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Role label + expand indicator */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${rolleStyles.pillBg} ${rolleStyles.pillText}`}>
                        {event.actorrole}
                      </span>
                      <ChevronDownIcon
                        className={`w-4 h-4 text-pkt-grays-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Row 2: Summary and tags */}
                  <div className="flex items-center gap-2 pl-4">
                    <span className="text-sm text-pkt-text-body-dark line-clamp-2 flex-1 min-w-0">
                      {event.summary}
                    </span>
                    {tagInfo.showRevision && tagInfo.version !== undefined && (
                      <RevisionTag version={tagInfo.version} size="sm" />
                    )}
                    {tagInfo.showUpdated && (
                      <UpdatedTag size="sm" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-2 py-2 sm:py-3 bg-pkt-bg-subtle border-b border-pkt-grays-gray-100">
                  <div className="ml-4 sm:ml-5 pl-3 border-l-2 border-pkt-grays-gray-200 space-y-2">
                    {/* Full timestamp and actor - stacked on mobile */}
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-0">
                      <span className="text-xs text-pkt-grays-gray-500">
                        {event.time ? formatDateFull(event.time) : ''}
                      </span>
                      <span className="text-xs text-pkt-grays-gray-500 hidden sm:inline"> • </span>
                      <span className="text-xs text-pkt-grays-gray-500">
                        {event.actor}
                      </span>
                    </div>

                    {/* Event type description */}
                    <p className="text-sm text-pkt-text-body-dark">
                      {extractEventType(event.type) || event.type}
                    </p>

                    {/* View form button */}
                    {event.data && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-badge-info-text bg-badge-info-bg hover:opacity-90 rounded-lg transition-colors mt-2 w-full sm:w-auto justify-center sm:justify-start"
                      >
                        <FileTextIcon className="h-4 w-4" />
                        Vis innsendt skjema
                      </button>
                    )}
                  </div>
                </div>
              )}
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
