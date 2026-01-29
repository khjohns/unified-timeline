import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-001: Endring av grunnforhold - Bjørvika
 *
 * Key event types:
 * - respons_frist: Response to deadline claims
 * - respons_grunnlag: Response to basis/grounds
 * - respons_vederlag: Response to compensation claims
 * - vederlag_krav_sendt: Compensation claim sent
 * - frist_krav_sendt: Deadline claim sent
 * - grunnlag_oppdatert: Basis/grounds updated
 * - grunnlag_opprettet: Basis/grounds created
 * - sak_opprettet: Case created
 */
export const mockTimelineEvents1: TimelineEntry[] = [
  {
    event_id: 'evt-001',
    tidsstempel: '2025-01-22T14:30:00Z',
    type: 'Respons på fristkrav',
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Fristkrav delvis godkjent - 30 av 45 dager godkjent',
    event_data: {
      frist_varsel_ok: true,
      spesifisert_krav_ok: false,
      begrunnelse_varsel: 'Nøytralt varsel mottatt i tide. Spesifisert krav mangler detaljert framdriftsanalyse.',
      vilkar_oppfylt: true,
      beregnings_resultat: 'delvis_godkjent',
      godkjent_dager: 30,
      begrunnelse: '30 dager godkjent. Omprosjektering kan gjøres parallelt med andre arbeider. Sprengningsarbeider påvirker kritisk linje.',
    },
  },
  {
    event_id: 'evt-002',
    tidsstempel: '2025-01-20T11:15:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - fjellforhold bekreftet',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'Grunnlaget er godkjent. Fjellforhold bekreftet av geolog. Endringsordre kan utstedes.',
    },
  },
  {
    event_id: 'evt-003',
    tidsstempel: '2025-01-18T09:45:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 2.500.000 NOK - direkte kostnader',
    event_data: {
      metode: 'REGNINGSARBEID',
      begrunnelse: 'Kravet inkluderer:\n- Ekstra borekostnader: 1.200.000 NOK\n- Endret fundamentløsning: 800.000 NOK\n- Prosjektering og rådgivning: 300.000 NOK\n- Rigg og drift: 200.000 NOK',
      kostnads_overslag: 2500000,
      saerskilt_krav: {
        rigg_drift: { belop: 200000 },
      },
      rigg_drift_varsel: { dato_sendt: '2025-01-15', metode: ['epost'] },
      regningsarbeid_varsel: { dato_sendt: '2025-01-15', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-004',
    tidsstempel: '2025-01-18T09:40:00Z',
    type: 'Spesifisert fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Krav på 45 dager fristforlengelse',
    event_data: {
      varsel_type: 'spesifisert',
      frist_varsel: { dato_sendt: '2025-01-15', metode: ['epost', 'byggemote'] },
      spesifisert_varsel: { dato_sendt: '2025-01-18', metode: ['epost'] },
      antall_dager: 45,
      begrunnelse: 'Fristforlengelse nødvendig pga. omprosjektering av fundament (20 dager) og ekstra boring/sprengning (25 dager). Påvirker kritisk linje.',
    },
  },
  // Nøytralt varsel er nå inkludert i frist_krav_sendt event
  {
    event_id: 'evt-005',
    tidsstempel: '2025-01-17T16:20:00Z',
    type: 'Grunnlag oppdatert',
    event_type: 'grunnlag_oppdatert',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Lagt til geologisk rapport og reviderte tegninger',
    event_data: {
      original_event_id: 'evt-006',
      endrings_begrunnelse: 'Lagt til geologisk rapport fra Multiconsult og reviderte tegninger som dokumenterer avvik fra prosjekteringsgrunnlaget.',
    },
  },
  {
    event_id: 'evt-006',
    tidsstempel: '2025-01-15T13:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om endrede grunnforhold - uventet fjell',
    event_data: {
      tittel: 'Uventet fjell ved fundament B3',
      hovedkategori: 'SVIKT',
      underkategori: 'GRUNN',
      beskrivelse: 'Ved peling av fundament B3 ble det påtruffet uventet fjell 2,5 meter høyere enn antatt i prosjekteringsgrunnlaget. Dette krever omprosjektering og endrede løsninger for fundamentering.',
      dato_oppdaget: '2025-01-15',
      grunnlag_varsel: { dato_sendt: '2025-01-15', metode: ['epost', 'byggemote'] },
      kontraktsreferanser: ['§23.1', 'Vedlegg A - Geoteknisk rapport'],
    },
  },
  {
    event_id: 'evt-007',
    tidsstempel: '2025-01-15T12:00:00Z',
    type: 'Sak opprettet',
    event_type: 'sak_opprettet',
    aktor: 'System',
    rolle: 'TE',
    spor: null,
    sammendrag: 'Ny endringsmelding opprettet',
  },
];
