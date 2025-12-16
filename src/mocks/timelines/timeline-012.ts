import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-012: Forseringssak - Samlet forsering
 *
 * Key event types for forsering cases:
 * - forsering_opprettet: Forsering case created with relations
 * - forsering_iverksatt: Acceleration started
 * - vederlag_krav_sendt: Cost claim sent
 * - forsering_kostnad_oppdatert: Accrued costs updated
 */
export const mockTimelineEvents12: TimelineEntry[] = [
  {
    event_id: 'evt-1204',
    tidsstempel: '2025-02-15T14:00:00Z',
    type: 'Forseringskostnad oppdatert',
    event_type: 'forsering_kostnad_oppdatert',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Påløpte kostnader oppdatert til kr 520 000,-',
    event_data: {
      paalopte_kostnader: 520000,
      estimert_kostnad: 1250000,
      kommentar: 'Uke 1-2 av forsering fullført. Overtidskostnader og ekstra mannskap.',
    },
  },
  {
    event_id: 'evt-1203',
    tidsstempel: '2025-02-12T08:00:00Z',
    type: 'Forsering iverksatt',
    event_type: 'forsering_iverksatt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Forsering iverksatt - ekstra skift og overtid starter',
    event_data: {
      dato_iverksatt: '2025-02-12',
      tiltak: [
        'Overtid for alle fag',
        'Ekstra skift lørdager',
        'Innleie av 5 ekstra montører',
      ],
    },
  },
  {
    event_id: 'evt-1202',
    tidsstempel: '2025-02-10T15:00:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på forseringskostnader kr 1 250 000,-',
    event_data: {
      metode: 'REGNINGSARBEID',
      begrunnelse:
        'Forseringskostnader for å hente inn forsinkelse fra avslåtte fristforlengelser. Omfatter overtid, ekstra skift og leie av ekstra mannskap.',
      kostnads_overslag: 1250000,
      saerskilt_krav: {
        produktivitet: {
          belop: 200000,
          dato_klar_over: '2025-02-10',
        },
      },
      regningsarbeid_varsel: { dato_sendt: '2025-02-10', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-1201',
    tidsstempel: '2025-02-10T10:00:00Z',
    type: 'Forseringssak opprettet',
    event_type: 'forsering_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'generelt',
    sammendrag: 'Forseringssak opprettet basert på 3 avslåtte fristforlengelser',
    event_data: {
      relaterte_saker: ['SAK-2025-003', 'SAK-2025-006', 'SAK-2025-013'],
      avslatte_dager: 45,
      estimert_kostnad: 1250000,
      dagmulktsats: 75000,
      maks_forseringskostnad: 4387500,
      begrunnelse:
        'BH har avslått fristforlengelser for til sammen 45 dager. TE velger å behandle avslagene som pålegg om forsering iht. §33.8.',
    },
  },
];
