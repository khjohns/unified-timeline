import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-012: Forseringssak - Samlet forsering
 *
 * Key event types for forsering cases:
 * - forsering_varsel: TE varsler om forsering (med iverksettelse)
 * - vederlag_krav_sendt: Cost claim sent
 * - forsering_kostnader_oppdatert: Accrued costs updated
 * - forsering_respons: BH accepts/rejects forsering
 * - forsering_stoppet: TE stops active forsering
 * - forsering_koe_lagt_til: KOE added to forsering
 * - forsering_koe_fjernet: KOE removed from forsering
 */
export const mockTimelineEvents12: TimelineEntry[] = [
  {
    event_id: 'evt-1205',
    tidsstempel: '2025-02-18T10:00:00Z',
    type: 'KOE lagt til forsering',
    event_type: 'forsering_koe_lagt_til',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'SAK-2025-013 lagt til som grunnlag for forsering',
    event_data: {
      relatert_sak_id: 'SAK-2025-013',
      relatert_sak_tittel: 'Forsinkelse - Ventilasjonsmontasje',
      avslatte_dager_tillagt: 15,
      ny_total_avslatte_dager: 45,
    },
  },
  {
    event_id: 'evt-1204',
    tidsstempel: '2025-02-15T14:00:00Z',
    type: 'Forseringskostnader oppdatert',
    event_type: 'forsering_kostnader_oppdatert',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Påløpte kostnader oppdatert til kr 520 000,-',
    event_data: {
      paalopte_kostnader: 520000,
      forrige_paalopte_kostnader: 0,
      estimert_kostnad: 1250000,
      maks_forseringskostnad: 4387500,
      prosent_av_estimert: 41.6,
      kommentar: 'Uke 1-2 av forsering fullført. Overtidskostnader og ekstra mannskap.',
    },
  },
  {
    event_id: 'evt-1203',
    tidsstempel: '2025-02-12T08:00:00Z',
    type: 'Varsel om forsering',
    event_type: 'forsering_varsel',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Forsering iverksatt - ekstra skift og overtid starter',
    event_data: {
      er_iverksatt: true,
      dato_iverksatt: '2025-02-12',
      estimert_kostnad: 1250000,
      avslatte_dager: 45,
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
    type: 'Sak opprettet',
    event_type: 'sak_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Forseringssak opprettet basert på 3 avslåtte fristforlengelser',
    event_data: {
      relaterte_saker: ['SAK-2025-003', 'SAK-2025-006', 'SAK-2025-013'],
      avslatte_dager: 45,
      estimert_kostnad: 1250000,
      dagmulktsats: 75000,
      maks_forseringskostnad: 4387500,
      bekreft_30_prosent_regel: true,
      begrunnelse:
        'BH har avslått fristforlengelser for til sammen 45 dager. TE velger å behandle avslagene som pålegg om forsering iht. §33.8.',
    },
  },
];
