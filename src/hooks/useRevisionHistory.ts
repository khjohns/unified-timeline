/**
 * useRevisionHistory Hook
 *
 * Extracts revision information from timeline events.
 * Uses the timeline as the source of truth for revision history.
 *
 * Also provides useHistorikk hook for fetching revision history from backend API.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TimelineEvent, SporType, extractEventType } from '../types/timeline';
import { HistorikkResponse, GrunnlagHistorikkEntry, VederlagHistorikkEntry, FristHistorikkEntry } from '../types/api';
import { fetchHistorikk } from '../api/state';
import { sakKeys } from '../queries';
import { STALE_TIME } from '../constants/queryConfig';

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
  events: TimelineEvent[],
  spor: SporType,
  rolle?: 'TE' | 'BH'
): RevisionSummary {
  return useMemo(() => {
    // Filter events for this track
    const trackEvents = events.filter((e) => e.spor === spor);

    // Separate originals and updates based on rolle
    let originals: TimelineEvent[];
    let updates: TimelineEvent[];

    if (rolle === 'TE') {
      // TE submissions and their updates
      originals = trackEvents.filter((e) => {
        const eventType = extractEventType(e.type);
        return e.actorrole === 'TE' && eventType && ORIGINAL_EVENT_TYPES.includes(eventType);
      });
      updates = trackEvents.filter((e) => {
        const eventType = extractEventType(e.type);
        return e.actorrole === 'TE' && eventType && UPDATE_EVENT_TYPES.includes(eventType);
      });
    } else if (rolle === 'BH') {
      // BH responses and their updates
      originals = trackEvents.filter((e) => {
        const eventType = extractEventType(e.type);
        return e.actorrole === 'BH' && eventType && ORIGINAL_EVENT_TYPES.includes(eventType);
      });
      updates = trackEvents.filter((e) => {
        const eventType = extractEventType(e.type);
        return e.actorrole === 'BH' && eventType && UPDATE_EVENT_TYPES.includes(eventType);
      });
    } else {
      // All events for this track
      originals = trackEvents.filter((e) => {
        const eventType = extractEventType(e.type);
        return eventType && ORIGINAL_EVENT_TYPES.includes(eventType);
      });
      updates = trackEvents.filter((e) => {
        const eventType = extractEventType(e.type);
        return eventType && UPDATE_EVENT_TYPES.includes(eventType);
      });
    }

    // Sort by timestamp (oldest first)
    const sortedOriginals = [...originals].sort(
      (a, b) => new Date(a.time || '').getTime() - new Date(b.time || '').getTime()
    );
    const sortedUpdates = [...updates].sort(
      (a, b) => new Date(a.time || '').getTime() - new Date(b.time || '').getTime()
    );

    // Build revision list
    const revisions: RevisionInfo[] = [];

    // Add original as version 0
    const original = sortedOriginals[0];
    if (original) {
      revisions.push({
        versjon: 0,
        event_id: original.id,
        dato: original.time || '',
        sammendrag: original.summary || '',
        erRevisjon: false,
      });
    }

    // Add updates as version 1, 2, etc.
    sortedUpdates.forEach((update, index) => {
      // Type-safe access to optional original_event_id/original_respons_id
      const data = update.data as Record<string, unknown> | undefined;
      revisions.push({
        versjon: index + 1,
        event_id: update.id,
        original_event_id:
          (data?.original_event_id as string | undefined) ||
          (data?.original_respons_id as string | undefined),
        dato: update.time || '',
        sammendrag: update.summary || '',
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
      originalEventId: sortedOriginals[0]?.id,
    };
  }, [events, spor, rolle]);
}

/**
 * Check if a claim has been revised after a response
 */
export function useIsResponseOutdated(
  events: TimelineEvent[],
  spor: SporType
): { isOutdated: boolean; claimVersion: number; responseVersion: number } {
  return useMemo(() => {
    const teHistory = events
      .filter((e) => {
        const eventType = extractEventType(e.type);
        return (
          e.spor === spor &&
          e.actorrole === 'TE' &&
          eventType &&
          [...ORIGINAL_EVENT_TYPES, ...UPDATE_EVENT_TYPES].includes(eventType)
        );
      })
      .sort(
        (a, b) => new Date(a.time || '').getTime() - new Date(b.time || '').getTime()
      );

    const bhHistory = events
      .filter((e) => {
        const eventType = extractEventType(e.type);
        return (
          e.spor === spor &&
          e.actorrole === 'BH' &&
          eventType &&
          [...ORIGINAL_EVENT_TYPES, ...UPDATE_EVENT_TYPES].includes(eventType)
        );
      })
      .sort(
        (a, b) => new Date(a.time || '').getTime() - new Date(b.time || '').getTime()
      );

    const claimVersion = teHistory.length - 1;
    const responseVersion = bhHistory.length - 1;

    // Check if TE has submitted something after BH's last response
    const lastTEEvent = teHistory[teHistory.length - 1];
    const lastBHEvent = bhHistory[bhHistory.length - 1];

    const isOutdated =
      lastTEEvent &&
      lastBHEvent &&
      new Date(lastTEEvent.time || '') > new Date(lastBHEvent.time || '');

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

// ============ NEW: Backend-based Historikk Hook ============

export interface UseHistorikkResult {
  grunnlag: GrunnlagHistorikkEntry[];
  vederlag: VederlagHistorikkEntry[];
  frist: FristHistorikkEntry[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for fetching revision history from backend API.
 *
 * This hook fetches the full revision history for all three tracks
 * (grunnlag, vederlag, frist), including all TE submissions and BH
 * responses with version numbers.
 *
 * Uses React Query for automatic cache invalidation and refetching
 * when events are submitted via useSubmitEvent.
 */
export function useHistorikk(sakId: string): UseHistorikkResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: sakKeys.historikk(sakId),
    queryFn: () => fetchHistorikk(sakId),
    enabled: !!sakId,
    staleTime: STALE_TIME.DEFAULT,
    refetchOnWindowFocus: true,
  });

  return {
    grunnlag: data?.grunnlag ?? [],
    vederlag: data?.vederlag ?? [],
    frist: data?.frist ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Group historikk entries by version for side-by-side comparison.
 *
 * Returns entries grouped by TE version number, with BH responses
 * attached to the version they responded to.
 */
export interface VersionGroup<T> {
  versjon: number;
  teEntry?: T;
  bhEntry?: T;
}

export function groupByVersion<T extends { versjon: number; aktor: { rolle: 'TE' | 'BH' } }>(
  entries: T[]
): VersionGroup<T>[] {
  const groups = new Map<number, VersionGroup<T>>();

  for (const entry of entries) {
    const versjon = entry.versjon;
    if (!groups.has(versjon)) {
      groups.set(versjon, { versjon });
    }
    const group = groups.get(versjon)!;

    if (entry.aktor.rolle === 'TE') {
      group.teEntry = entry;
    } else {
      group.bhEntry = entry;
    }
  }

  // Sort by version number
  return Array.from(groups.values()).sort((a, b) => a.versjon - b.versjon);
}

/**
 * Get only TE entries (claims/updates) from historikk
 */
export function getTeEntries<T extends { aktor: { rolle: 'TE' | 'BH' }; endring_type: string }>(
  entries: T[]
): T[] {
  return entries.filter(
    (e) => e.aktor.rolle === 'TE' && ['sendt', 'oppdatert', 'trukket'].includes(e.endring_type)
  );
}

/**
 * Get only BH entries (responses) from historikk
 */
export function getBhEntries<T extends { aktor: { rolle: 'TE' | 'BH' }; endring_type: string }>(
  entries: T[]
): T[] {
  return entries.filter(
    (e) => e.aktor.rolle === 'BH' && ['respons', 'respons_oppdatert'].includes(e.endring_type)
  );
}

/**
 * Format currency for historikk display
 */
export function formatHistorikkBelop(belop: number | null | undefined): string {
  if (belop === null || belop === undefined) return '—';
  return `${belop.toLocaleString('nb-NO')} NOK`;
}

/**
 * Format days for historikk display
 */
export function formatHistorikkDager(dager: number | null | undefined): string {
  if (dager === null || dager === undefined) return '—';
  return `${dager} dager`;
}
