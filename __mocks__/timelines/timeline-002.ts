import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-002: Forsinket materialleveranse - Oslo Sykehus
 *
 * Key event types:
 * - sak_opprettet: Case created
 */
export const mockTimelineEvents2: TimelineEntry[] = [
  {
    event_id: 'evt-101',
    tidsstempel: '2025-01-25T10:00:00Z',
    type: 'Sak opprettet',
    event_type: 'sak_opprettet',
    aktor: 'System',
    rolle: 'TE',
    spor: null,
    sammendrag: 'Ny endringsmelding opprettet',
  },
];
