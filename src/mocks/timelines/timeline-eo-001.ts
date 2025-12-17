import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-EO-001: Endringsordre - Sprinkler og fasadeendringer
 *
 * Key event types for endringsordre cases:
 * - eo_opprettet: Endringsordre created with related KOE cases
 * - eo_utstedt: Endringsordre issued by BH
 * - eo_akseptert: TE accepts the EO
 * - eo_avvist: TE rejects/disputes the EO
 * - eo_revidert: EO revised by BH
 */
export const mockTimelineEventsEO001: TimelineEntry[] = [
  {
    event_id: 'evt-eo-003',
    tidsstempel: '2025-02-20T14:00:00Z',
    type: 'Endringsordre utstedt',
    event_type: 'eo_utstedt',
    aktor: 'Kari Byggherre',
    rolle: 'BH',
    spor: null,
    sammendrag: 'Endringsordre EO-001 utstedt for signering',
    event_data: {
      eo_nummer: 'EO-001',
      kompensasjon_belop: 1035000,
      frist_dager: 19,
      ny_sluttdato: '2025-04-15',
      oppgjorsform: 'ENHETSPRISER',
      konsekvenser: {
        fremdrift: true,
        pris: true,
      },
    },
  },
  {
    event_id: 'evt-eo-002',
    tidsstempel: '2025-02-20T11:30:00Z',
    type: 'KOE lagt til',
    event_type: 'eo_koe_lagt_til',
    aktor: 'Kari Byggherre',
    rolle: 'BH',
    spor: null,
    sammendrag: 'SAK-2024-089 lagt til endringsordre',
    event_data: {
      koe_sak_id: 'SAK-2024-089',
      koe_sak_tittel: 'Ekstraarbeid - Fasadeendringer',
      godkjent_vederlag: 850000,
      godkjent_dager: 14,
    },
  },
  {
    event_id: 'evt-eo-001',
    tidsstempel: '2025-02-20T11:00:00Z',
    type: 'Endringsordre opprettet',
    event_type: 'eo_opprettet',
    aktor: 'Kari Byggherre',
    rolle: 'BH',
    spor: null,
    sammendrag: 'Endringsordre EO-001 opprettet med SAK-2025-010',
    event_data: {
      eo_nummer: 'EO-001',
      relaterte_koe_saker: ['SAK-2025-010'],
      beskrivelse:
        'Endringsordre for utvidelse av sprinkleranlegg til teknisk rom (brannkrav) samt fasadeendringer iht. revidert arkitektprosjekt.',
    },
  },
];
