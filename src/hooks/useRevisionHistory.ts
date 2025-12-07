/**
 * useRevisionHistory Hook
 *
 * Extracts revision information from timeline events.
 * Uses the timeline as the source of truth for revision history.
 */

import { useMemo } from 'react';
import { TimelineEntry, SporType } from '../types/timeline';

export interface RevisionInfo {
  versjon: number; // 0 = original, 1 = first revision, etc.
  event_id: string;
  original_event_id?: string;
  dato: string;
  sammendrag: string;
  erRevisjon: boolean;
}

export interface RevisionSummary {
  currentVersion: number;
  totalRevisions: number;
  revisions: RevisionInfo[];
  lastRevisionDate?: string;
  originalEventId?: string;
}

// Event types that represent original submissions
const ORIGINAL_EVENT_TYPES = [
  'grunnlag_opprettet',
  'vederlag_krav_sendt',
  'frist_krav_sendt',
  'respons_grunnlag',
  'respons_vederlag',
  'respons_frist',
];

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
 * Get revision history for a specific track (spor)
 */
export function useRevisionHistory(
  events: TimelineEntry[],
  spor: SporType,
  rolle?: 'TE' | 'BH'
): RevisionSummary {
  return useMemo(() => {
    // Filter events for this track
    const trackEvents = events.filter((e) => e.spor === spor);

    // Separate originals and updates based on rolle
    let originals: TimelineEntry[];
    let updates: TimelineEntry[];

    if (rolle === 'TE') {
      // TE submissions and their updates
      originals = trackEvents.filter(
        (e) =>
          e.rolle === 'TE' &&
          e.event_type &&
          ORIGINAL_EVENT_TYPES.includes(e.event_type)
      );
      updates = trackEvents.filter(
        (e) =>
          e.rolle === 'TE' &&
          e.event_type &&
          UPDATE_EVENT_TYPES.includes(e.event_type)
      );
    } else if (rolle === 'BH') {
      // BH responses and their updates
      originals = trackEvents.filter(
        (e) =>
          e.rolle === 'BH' &&
          e.event_type &&
          ORIGINAL_EVENT_TYPES.includes(e.event_type)
      );
      updates = trackEvents.filter(
        (e) =>
          e.rolle === 'BH' &&
          e.event_type &&
          UPDATE_EVENT_TYPES.includes(e.event_type)
      );
    } else {
      // All events for this track
      originals = trackEvents.filter(
        (e) => e.event_type && ORIGINAL_EVENT_TYPES.includes(e.event_type)
      );
      updates = trackEvents.filter(
        (e) => e.event_type && UPDATE_EVENT_TYPES.includes(e.event_type)
      );
    }

    // Sort by timestamp (oldest first)
    const sortedOriginals = [...originals].sort(
      (a, b) => new Date(a.tidsstempel).getTime() - new Date(b.tidsstempel).getTime()
    );
    const sortedUpdates = [...updates].sort(
      (a, b) => new Date(a.tidsstempel).getTime() - new Date(b.tidsstempel).getTime()
    );

    // Build revision list
    const revisions: RevisionInfo[] = [];

    // Add original as version 0
    if (sortedOriginals.length > 0) {
      const original = sortedOriginals[0];
      revisions.push({
        versjon: 0,
        event_id: original.event_id,
        dato: original.tidsstempel,
        sammendrag: original.sammendrag,
        erRevisjon: false,
      });
    }

    // Add updates as version 1, 2, etc.
    sortedUpdates.forEach((update, index) => {
      revisions.push({
        versjon: index + 1,
        event_id: update.event_id,
        original_event_id:
          update.event_data?.original_event_id ||
          update.event_data?.original_respons_id,
        dato: update.tidsstempel,
        sammendrag: update.sammendrag,
        erRevisjon: true,
      });
    });

    const currentVersion = revisions.length > 0 ? revisions.length - 1 : 0;
    const lastRevision = revisions[revisions.length - 1];

    return {
      currentVersion,
      totalRevisions: Math.max(0, revisions.length - 1), // Don't count original
      revisions,
      lastRevisionDate: lastRevision?.dato,
      originalEventId: sortedOriginals[0]?.event_id,
    };
  }, [events, spor, rolle]);
}

/**
 * Check if a claim has been revised after a response
 */
export function useIsResponseOutdated(
  events: TimelineEntry[],
  spor: SporType
): { isOutdated: boolean; claimVersion: number; responseVersion: number } {
  return useMemo(() => {
    const teHistory = events
      .filter(
        (e) =>
          e.spor === spor &&
          e.rolle === 'TE' &&
          e.event_type &&
          [...ORIGINAL_EVENT_TYPES, ...UPDATE_EVENT_TYPES].includes(e.event_type)
      )
      .sort(
        (a, b) => new Date(a.tidsstempel).getTime() - new Date(b.tidsstempel).getTime()
      );

    const bhHistory = events
      .filter(
        (e) =>
          e.spor === spor &&
          e.rolle === 'BH' &&
          e.event_type &&
          [...ORIGINAL_EVENT_TYPES, ...UPDATE_EVENT_TYPES].includes(e.event_type)
      )
      .sort(
        (a, b) => new Date(a.tidsstempel).getTime() - new Date(b.tidsstempel).getTime()
      );

    const claimVersion = teHistory.length - 1;
    const responseVersion = bhHistory.length - 1;

    // Check if TE has submitted something after BH's last response
    const lastTEEvent = teHistory[teHistory.length - 1];
    const lastBHEvent = bhHistory[bhHistory.length - 1];

    const isOutdated =
      lastTEEvent &&
      lastBHEvent &&
      new Date(lastTEEvent.tidsstempel) > new Date(lastBHEvent.tidsstempel);

    return {
      isOutdated: isOutdated || false,
      claimVersion: Math.max(0, claimVersion),
      responseVersion: Math.max(0, responseVersion),
    };
  }, [events, spor]);
}

/**
 * Format version number for display
 */
export function formatVersionLabel(version: number): string {
  if (version === 0) return 'Original';
  return `Rev. ${version}`;
}

/**
 * Format date for revision display
 */
export function formatRevisionDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
