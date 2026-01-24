// @ts-nocheck - Legacy mock data, needs update to match current types
import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-006: Forsering - Prosjekteringsforsinkelse
 *
 * Key event types:
 * - forsering_varsel: Acceleration notice
 * - respons_frist: Response to deadline claims (rejected)
 * - vederlag_krav_sendt: Compensation claim sent
 * - frist_krav_sendt: Deadline claim sent
 * - respons_grunnlag: Response to basis/grounds
 * - grunnlag_opprettet: Basis/grounds created
 */
export const mockTimelineEvents6: TimelineEntry[] = [
  {
    event_id: 'evt-601',
    tidsstempel: '2025-02-02T09:00:00Z',
    type: 'Forsering varslet',
    event_type: 'forsering_varsel',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Forsering iverksatt - estimert kostnad kr 380 000,-',
    event_data: {
      frist_krav_id: 'evt-604',
      respons_frist_id: 'evt-602',
      estimert_kostnad: 380000,
      begrunnelse: 'Overtid og ekstra skift for elektrikere i 3 uker.',
      bekreft_30_prosent: true,
      dato_iverksettelse: '2025-02-02',
      avslatte_dager: 21,
      dagmulktsats: 50000,
      grunnlag_avslag_trigger: false,
    },
  },
  {
    event_id: 'evt-602',
    tidsstempel: '2025-02-01T15:00:00Z',
    type: 'Fristkrav avslått',
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Avslått - mener forsinkelse kan hentes inn',
    event_data: {
      frist_varsel_ok: true,
      spesifisert_krav_ok: true,
      begrunnelse_varsel: 'Varsler mottatt i tide.',
      vilkar_oppfylt: false,
      begrunnelse_vilkar: 'BH mener forsinkelsen kan tas igjen med parallellarbeid.',
      beregnings_resultat: 'avslatt',
      godkjent_dager: 0,
      begrunnelse: 'Fristforlengelse avslås. Forsinkelsen kan hentes inn uten fristforlengelse.',
    },
  },
  {
    event_id: 'evt-603',
    tidsstempel: '2025-01-28T10:00:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 850.000 NOK for stillstand og omorganisering',
    event_data: {
      metode: 'REGNINGSARBEID',
      begrunnelse: 'Stillstand og omorganisering av mannskap.',
      kostnads_overslag: 850000,
      saerskilt_krav: {
        produktivitet: {
          belop: 150000,
          dato_klar_over: '2025-01-20',
        },
      },
      // Forhåndsvarsel for regningsarbeid (§34.4) - varslet før oppstart
      regningsarbeid_varsel: { dato_sendt: '2025-01-20', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-604',
    tidsstempel: '2025-01-28T09:30:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 21 dager fristforlengelse',
    event_data: {
      varsel_type: 'spesifisert',
      frist_varsel: { dato_sendt: '2025-01-20', metode: ['epost', 'byggemote'] },
      spesifisert_varsel: { dato_sendt: '2025-01-28', metode: ['epost'] },
      antall_dager: 21,
      begrunnelse: 'Stopp i elektroarbeid i 3 uker.',
    },
  },
  {
    event_id: 'evt-605',
    tidsstempel: '2025-01-25T14:00:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - forsinkelse erkjent',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'Forsinkelsen erkjennes.',
    },
  },
  {
    event_id: 'evt-606',
    tidsstempel: '2025-01-20T08:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om prosjekteringsforsinkelse',
    event_data: {
      hovedkategori: 'SVIKT',
      underkategori: ['MEDVIRK'],
      beskrivelse: 'Forsinket leveranse av tegninger for elektroinstallasjon medførte stopp i arbeidet.',
      dato_oppdaget: '2025-01-20',
      grunnlag_varsel: { dato_sendt: '2025-01-20', metode: ['epost', 'byggemote'] },
      kontraktsreferanser: ['§22.3'],
    },
  },
];
