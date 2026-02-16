/**
 * CaseActivityCard - Compact vertical card showing the last event per track.
 *
 * Placed in Row 1 next to CaseIdentityTile and Grunnlag card to give a quick
 * overview of latest activity across all three tracks (Grunnlag, Vederlag, Frist).
 *
 * Uses BentoCard with responsive col-span for the hierarchical bento layout.
 *
 * Also exports the old name CaseActivityStripTile as an alias for backwards compat.
 */

import { useMemo } from 'react';
import { clsx } from 'clsx';
import { BentoCard } from '../dashboard/BentoCard';
import type { TimelineEvent, SporType, EventType } from '../../types/timeline';
import { extractEventType, extractSpor } from '../../types/timeline';
import { getEventTypeLabel } from '../../constants/eventTypeLabels';

// ========== Constants ==========

const SPOR_DOT_COLORS: Record<SporType, string> = {
  grunnlag: 'bg-pkt-brand-dark-blue-1000',
  vederlag: 'bg-pkt-brand-warm-blue-1000',
  frist: 'bg-pkt-brand-yellow-1000',
};

const SPOR_LABELS: Record<SporType, string> = {
  grunnlag: 'Grunnlag',
  vederlag: 'Vederlag',
  frist: 'Frist',
};

const ALL_TRACKS: SporType[] = ['grunnlag', 'vederlag', 'frist'];

// ========== Helpers ==========

/**
 * Extract the raw event type from either CloudEvent format or simplified format.
 * CloudEvent: { type: 'no.oslo.koe.respons_grunnlag', time: '...' }
 * Simplified: { event_type: 'respons_grunnlag', created_at: '...' }
 */
function getEventType(event: TimelineEvent): EventType | null {
  // CloudEvent format
  if (event.type) {
    return extractEventType(event.type);
  }
  // Simplified/legacy format
  const simplified = event as Record<string, unknown>;
  if (typeof simplified.event_type === 'string') {
    return simplified.event_type as EventType;
  }
  return null;
}

/**
 * Get the track (spor) for an event, checking both CloudEvent and simplified format.
 */
function getEventSpor(event: TimelineEvent): SporType | null {
  // Use CloudEvent spor extension if available
  if (event.spor) return event.spor;

  // Try extracting from CloudEvent type
  if (event.type) {
    return extractSpor(event.type);
  }

  // Try extracting from simplified event_type
  const eventType = getEventType(event);
  if (!eventType) return null;

  // Map event_type prefix to track
  if (eventType.includes('grunnlag')) return 'grunnlag';
  if (eventType.includes('vederlag')) return 'vederlag';
  if (eventType.includes('frist')) return 'frist';

  // te_aksepterer_respons: check data.spor if available
  if (eventType === 'te_aksepterer_respons') {
    const data = event.data as Record<string, unknown> | undefined;
    if (data?.spor && typeof data.spor === 'string') {
      return data.spor as SporType;
    }
  }

  return null;
}

/**
 * Get event timestamp from either CloudEvent or simplified format.
 */
function getEventTime(event: TimelineEvent): string | null {
  if (event.time) return event.time;
  const simplified = event as Record<string, unknown>;
  if (typeof simplified.created_at === 'string') return simplified.created_at as string;
  return null;
}

/**
 * Short, human-readable descriptions for the activity strip.
 * These omit the track name prefix since the track label is shown separately.
 */
const SHORT_DESCRIPTIONS: Partial<Record<EventType, string>> = {
  sak_opprettet: 'Sak opprettet',
  grunnlag_opprettet: 'Sendt',
  grunnlag_oppdatert: 'Oppdatert',
  grunnlag_trukket: 'Trukket',
  vederlag_krav_sendt: 'Krav sendt',
  vederlag_krav_oppdatert: 'Krav oppdatert',
  vederlag_krav_trukket: 'Trukket',
  frist_krav_sendt: 'Krav sendt',
  frist_krav_oppdatert: 'Krav oppdatert',
  frist_krav_spesifisert: 'Spesifisert',
  frist_krav_trukket: 'Trukket',
  respons_grunnlag: 'Svar fra BH',
  respons_grunnlag_oppdatert: 'Svar oppdatert',
  respons_vederlag: 'Svar fra BH',
  respons_vederlag_oppdatert: 'Svar oppdatert',
  respons_frist: 'Svar fra BH',
  respons_frist_oppdatert: 'Svar oppdatert',
  te_aksepterer_respons: 'Godtatt av TE',
};

function getShortDescription(eventType: EventType): string {
  return SHORT_DESCRIPTIONS[eventType] ?? getEventTypeLabel(eventType);
}

/**
 * Format relative time in Norwegian.
 */
function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Na';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}t`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'I gar';
    if (diffD < 7) return `${diffD}d`;
    return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

// ========== Types ==========

interface TrackActivity {
  spor: SporType;
  label: string;
  eventType: EventType;
  description: string;
  time: string;
}

interface CaseActivityCardProps {
  events: TimelineEvent[];
  delay?: number;
  /** Override the default responsive col-span classes */
  colSpan?: string;
}

// ========== Component ==========

export function CaseActivityCard({ events, delay = 0, colSpan }: CaseActivityCardProps) {
  const trackActivities = useMemo(() => {
    const lastPerTrack = new Map<SporType, TrackActivity>();

    // Sort by time descending so we can pick the most recent per track
    const sorted = [...events]
      .filter(e => getEventTime(e) != null)
      .sort((a, b) => {
        const ta = getEventTime(a) ?? '';
        const tb = getEventTime(b) ?? '';
        return tb.localeCompare(ta);
      });

    for (const event of sorted) {
      const spor = getEventSpor(event);
      if (!spor) continue;
      if (lastPerTrack.has(spor)) continue;

      const eventType = getEventType(event);
      if (!eventType) continue;

      const time = getEventTime(event);
      if (!time) continue;

      lastPerTrack.set(spor, {
        spor,
        label: SPOR_LABELS[spor],
        eventType,
        description: getShortDescription(eventType),
        time,
      });
    }

    return lastPerTrack;
  }, [events]);

  // Build items for all three tracks
  const items = ALL_TRACKS.map(spor => ({
    spor,
    label: SPOR_LABELS[spor],
    activity: trackActivities.get(spor) ?? null,
  }));

  const hasAnyActivity = items.some(i => i.activity !== null);

  return (
    <BentoCard colSpan={colSpan ?? "col-span-12 md:col-span-6 lg:col-span-3"} delay={delay}>
      <div className="p-3">
        {/* Header */}
        <p className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-2">
          Siste aktivitet
        </p>

        {/* Vertical stack of track activities */}
        <div className="flex flex-col gap-1">
          {hasAnyActivity ? (
            items.map(({ spor, label, activity }) => (
              <div
                key={spor}
                className="flex items-center gap-2 min-w-0"
              >
                {/* Track dot */}
                <div
                  className={clsx(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    activity ? SPOR_DOT_COLORS[spor] : 'bg-pkt-grays-gray-300',
                  )}
                />
                {/* Text content */}
                <div className="flex items-baseline gap-1 min-w-0 flex-1">
                  <span className="text-[11px] font-medium text-pkt-text-body-default shrink-0">
                    {label}
                  </span>
                  {activity ? (
                    <>
                      <span className="text-[11px] text-pkt-text-body-subtle truncate">
                        {activity.description}
                      </span>
                      <span className="text-[10px] text-pkt-text-body-muted shrink-0 ml-auto">
                        {formatRelativeTime(activity.time)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-pkt-text-body-muted italic">
                      Venter
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-pkt-grays-gray-300" />
              <span className="text-[11px] text-pkt-text-body-muted italic">
                Ingen aktivitet enna — venter
              </span>
            </div>
          )}
        </div>
      </div>
    </BentoCard>
  );
}

/** Backwards-compatible alias */
export const CaseActivityStripTile = CaseActivityCard;
