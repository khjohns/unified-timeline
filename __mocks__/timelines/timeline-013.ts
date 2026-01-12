// @ts-nocheck - Legacy mock data, needs update to match current types
import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-013: Forsinkelse - Ventilasjonsmontasje
 *
 * Key event types:
 * - respons_frist: BH rejected deadline extension
 * - frist_krav_sendt: Deadline extension claim sent
 * - vederlag_krav_sendt: Compensation claim sent
 * - respons_grunnlag: Response to basis/grounds
 * - grunnlag_opprettet: Basis/grounds created
 */
export const mockTimelineEvents13: TimelineEntry[] = [
  {
    event_id: 'evt-1306',
    tidsstempel: '2025-02-05T15:00:00Z',
    type: 'Fristkrav avslått',
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Avslått - mener arbeid kan utføres parallelt',
    event_data: {
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: true,
      begrunnelse_varsel: 'Varsler mottatt i tide.',
      vilkar_oppfylt: false,
      begrunnelse_vilkar: 'BH mener arbeidet kan utføres parallelt med andre aktiviteter.',
      beregnings_resultat: 'avslatt',
      godkjent_dager: 0,
      begrunnelse:
        'Fristforlengelse avslås. Ventilasjonsarbeidet kan utføres parallelt med andre pågående arbeider.',
    },
  },
  {
    event_id: 'evt-1305',
    tidsstempel: '2025-02-01T10:00:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 10 dager fristforlengelse',
    event_data: {
      varsel_type: 'spesifisert',
      noytralt_varsel: { dato_sendt: '2025-01-25', metode: ['epost', 'byggemote'] },
      spesifisert_varsel: { dato_sendt: '2025-02-01', metode: ['epost'] },
      antall_dager: 10,
      begrunnelse: 'Stopp i ventilasjonsarbeid i 10 dager grunnet manglende tilgang.',
    },
  },
  {
    event_id: 'evt-1304',
    tidsstempel: '2025-02-01T09:00:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 320.000 NOK for stillstand',
    event_data: {
      metode: 'REGNINGSARBEID',
      begrunnelse: 'Stillstand for ventilasjonsmannskap i 10 dager, samt omorganisering.',
      kostnads_overslag: 320000,
      saerskilt_krav: {
        produktivitet: {
          belop: 80000,
          dato_klar_over: '2025-01-25',
        },
      },
      regningsarbeid_varsel: { dato_sendt: '2025-01-25', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-1303',
    tidsstempel: '2025-01-30T14:00:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - forsinkelse erkjent',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'Forsinkelsen erkjennes. Tilgang ble forsinket grunnet andre arbeider.',
    },
  },
  {
    event_id: 'evt-1302',
    tidsstempel: '2025-01-25T16:00:00Z',
    type: 'Nøytralt varsel sendt',
    event_type: 'noytral_varsel_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Nøytralt varsel om forsinkelse sendt',
    event_data: {
      metode: ['epost', 'byggemote'],
      beskrivelse: 'Varsel om at tilgang til ventilasjonssjakter ikke er gitt som avtalt.',
    },
  },
  {
    event_id: 'evt-1301',
    tidsstempel: '2025-01-25T08:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om forsinket tilgang til ventilasjonssjakter',
    event_data: {
      hovedkategori: 'SVIKT',
      underkategori: ['MEDVIRK'],
      beskrivelse:
        'BH ga ikke tilgang til ventilasjonssjakter som avtalt. Arbeidet stoppet i 10 arbeidsdager.',
      dato_oppdaget: '2025-01-25',
      grunnlag_varsel: { dato_sendt: '2025-01-25', metode: ['epost', 'byggemote'] },
      kontraktsreferanser: ['§21.1', '§22.3'],
    },
  },
];
