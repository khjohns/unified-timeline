import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-009: Passivitet - Irregulær endring ventilasjon
 *
 * Key event types:
 * - frist_krav_sendt: Deadline claim sent
 * - vederlag_krav_sendt: Compensation claim sent
 * - respons_grunnlag: Response to basis/grounds (passive acceptance)
 * - grunnlag_opprettet: Basis/grounds created
 */
export const mockTimelineEvents9: TimelineEntry[] = [
  {
    event_id: 'evt-901',
    tidsstempel: '2025-02-22T10:00:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 10 dager fristforlengelse for ventilasjonsendring',
    event_data: {
      varsel_type: 'spesifisert',
      noytralt_varsel: { dato_sendt: '2025-02-05', metode: ['epost'] },
      spesifisert_varsel: { dato_sendt: '2025-02-10', metode: ['epost'] },
      antall_dager: 10,
      begrunnelse: 'Omlegging av ventilasjonsanlegg krever 10 arbeidsdager.',
    },
  },
  {
    event_id: 'evt-902',
    tidsstempel: '2025-02-22T09:30:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 320.000 NOK for ventilasjonsendring',
    event_data: {
      metode: 'REGNINGSARBEID',
      kostnads_overslag: 320000,
      begrunnelse: 'Merarbeid for omlegging av ventilasjonsanlegg.',
      regningsarbeid_varsel: { dato_sendt: '2025-02-06', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-903',
    tidsstempel: '2025-02-20T08:00:00Z',
    type: 'Passiv aksept registrert',
    event_type: 'respons_grunnlag',
    aktor: 'System',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: '§32.3: BH svarte ikke i tide - endring anses godkjent',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'PASSIV AKSEPT: BH svarte ikke på varsel innen rimelig tid (15 dager). Jf. §32.3 anses varselet som godtatt.',
    },
  },
  {
    event_id: 'evt-904',
    tidsstempel: '2025-02-05T14:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om irregulær endring - ventilasjon',
    event_data: {
      tittel: 'Irregulær endring - ventilasjonsomlegging',
      hovedkategori: 'ENDRING',
      underkategori: 'IRREG',
      beskrivelse: 'Muntlig instruks om endret ventilasjonsløsning i byggemøte.',
      dato_oppdaget: '2025-02-05',
      grunnlag_varsel: { dato_sendt: '2025-02-05', metode: ['epost', 'byggemote'] },
      kontraktsreferanser: ['§32.1', '§32.2'],
    },
  },
];
