import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-005: Omtvistet endring - Teknisk rom
 *
 * Key event types:
 * - respons_grunnlag_oppdatert: Updated response to basis/grounds
 * - respons_frist: Response to deadline claims (subsidiary)
 * - respons_vederlag: Response to compensation claims (subsidiary)
 * - respons_grunnlag: Response to basis/grounds (disputed)
 * - frist_krav_sendt: Deadline claim sent
 * - vederlag_krav_sendt: Compensation claim sent
 * - grunnlag_opprettet: Basis/grounds created
 */
export const mockTimelineEvents5: TimelineEntry[] = [
  {
    event_id: 'evt-507',
    tidsstempel: '2025-02-07T10:00:00Z',
    type: 'Grunnlagsrespons oppdatert',
    event_type: 'respons_grunnlag_oppdatert',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Utdypet begrunnelse for avvisning',
    event_data: {
      original_respons_id: 'evt-502',
      resultat: 'avslatt',
      begrunnelse: 'BH bestrider at det foreligger en endring. Plasseringen var allerede avtalt i kontrakten. Se protokoll fra byggemøte 2024-12-15 hvor rominndelingen ble bekreftet.',
      dato_endret: '2025-02-07',
    },
  },
  {
    event_id: 'evt-501',
    tidsstempel: '2025-02-06T10:00:00Z',
    type: 'Subsidiært svar på frist',
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Subsidiært godkjent 14 dager (bestrider grunnlag)',
    event_data: {
      // Port 1: Varsling
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: true,
      begrunnelse_varsel: 'Varsler er mottatt i tide.',
      // Port 2: Vilkår - prinsipalt avslag pga grunnlag
      vilkar_oppfylt: false,
      begrunnelse_vilkar: 'Grunnlaget bestrides - vilkår ikke oppfylt.',
      // Port 3: Beregning - prinsipalt avslag
      beregnings_resultat: 'avslatt',
      begrunnelse_beregning: 'Prinsipalt avslått da grunnlaget bestrides.',
      // Subsidiært standpunkt
      subsidiaer_triggers: ['grunnlag_avslatt'],
      subsidiaer_resultat: 'godkjent',
      subsidiaer_godkjent_dager: 14,
      subsidiaer_begrunnelse: 'Dersom ansvar avklares til TEs fordel, godkjennes 14 dager.',
    },
  },
  {
    event_id: 'evt-503',
    tidsstempel: '2025-02-06T09:30:00Z',
    type: 'Subsidiært svar på vederlag',
    event_type: 'respons_vederlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'vederlag',
    sammendrag: 'Subsidiært delvis godkjent 400.000 NOK (bestrider grunnlag)',
    event_data: {
      // Port 1: Varsling
      saerskilt_varsel_rigg_drift_ok: true,
      begrunnelse_varsel: 'Særskilt varsel om rigg/drift mottatt i tide.',
      // Port 2: Beregning - prinsipalt avslag
      beregnings_resultat: 'avslatt',
      vederlagsmetode: 'REGNINGSARBEID',
      begrunnelse_beregning: 'Prinsipalt avslått da grunnlaget bestrides.',
      // Subsidiært standpunkt
      subsidiaer_triggers: ['grunnlag_avslatt'],
      subsidiaer_resultat: 'delvis_godkjent',
      subsidiaer_godkjent_belop: 400000,
      subsidiaer_begrunnelse: 'Dersom ansvar avklares til TEs fordel, godkjennes 400.000 NOK.',
    },
  },
  {
    event_id: 'evt-502',
    tidsstempel: '2025-02-05T14:00:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag avvist - uenig i at det er en endring',
    event_data: {
      resultat: 'avslatt',
      begrunnelse: 'BH bestrider at det foreligger en endring. Plasseringen var allerede avtalt i kontrakten.',
    },
  },
  {
    event_id: 'evt-504',
    tidsstempel: '2025-02-03T11:00:00Z',
    type: 'Fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 14 dager fristforlengelse',
    event_data: {
      varsel_type: 'spesifisert',
      noytralt_varsel: { dato_sendt: '2025-02-02', metode: ['epost'] },
      spesifisert_varsel: { dato_sendt: '2025-02-03', metode: ['epost'] },
      antall_dager: 14,
      begrunnelse: 'Omlegging av rør krever 14 ekstra dager.',
    },
  },
  {
    event_id: 'evt-505',
    tidsstempel: '2025-02-03T10:30:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 450.000 NOK for omlegging',
    event_data: {
      metode: 'REGNINGSARBEID',
      begrunnelse: 'Ekstra rørlegging og tilpasningsarbeid.',
      kostnads_overslag: 450000,
      saerskilt_krav: {
        rigg_drift: {
          belop: 50000,
          dato_klar_over: '2025-02-01',
        },
      },
      rigg_drift_varsel: { dato_sendt: '2025-02-02', metode: ['epost'] },
      regningsarbeid_varsel: { dato_sendt: '2025-02-02', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-506',
    tidsstempel: '2025-02-02T10:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om irregulær endring - teknisk rom',
    event_data: {
      tittel: 'Irregulær endring - plassering av teknisk rom',
      hovedkategori: 'ENDRING',
      underkategori: ['IRREG'],
      beskrivelse: 'Entreprenøren hevder at muntlig beskjed om endret plassering av teknisk rom utgjør en irregulær endring.',
      dato_oppdaget: '2025-02-01',
      grunnlag_varsel: { dato_sendt: '2025-02-02', metode: ['epost'] },
      kontraktsreferanser: ['§32.1'],
    },
  },
];
