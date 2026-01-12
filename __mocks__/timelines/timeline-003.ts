import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-003: Tilleggsarbeid - Rørføring omlegging
 *
 * Key event types:
 * - respons_frist: Response to deadline claims
 * - respons_vederlag: Response to compensation claims
 * - respons_grunnlag: Response to basis/grounds
 * - frist_krav_sendt: Deadline claim sent
 * - vederlag_krav_sendt: Compensation claim sent
 * - grunnlag_opprettet: Basis/grounds created
 */
export const mockTimelineEvents4: TimelineEntry[] = [
  {
    event_id: 'evt-301',
    tidsstempel: '2025-02-01T10:30:00Z',
    type: 'Respons på fristkrav',
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Avslått - mangler spesifikasjon',
    event_data: {
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: false,
      begrunnelse_varsel: 'Nøytralt varsel mottatt i tide, men spesifisert krav mangler.',
      vilkar_oppfylt: true,
      begrunnelse_vilkar: 'Grunnlag er akseptert, årsakssammenheng dokumentert.',
      beregnings_resultat: 'avslatt',
      begrunnelse: 'Fristkravet avslås da det mangler dokumentasjon av arbeidsoperasjoner og påvirkning på framdrift. TE oppfordres til å revidere kravet med detaljert framdriftsplan.',
    },
  },
  {
    event_id: 'evt-302',
    tidsstempel: '2025-02-01T10:00:00Z',
    type: 'Respons på vederlagskrav',
    event_type: 'respons_vederlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'vederlag',
    sammendrag: 'Avslått - detaljert kostnadskalkyle kreves',
    event_data: {
      beregnings_resultat: 'avslatt',
      begrunnelse: 'Grunnlaget er akseptert, men vederlagskravet avslås da det mangler tilstrekkelig spesifikasjon. TE oppfordres til å revidere kravet med detaljert kostnadskalkyle og dokumentasjon.',
    },
  },
  {
    event_id: 'evt-303',
    tidsstempel: '2025-01-30T14:00:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag godkjent - avvik dokumentert',
    event_data: {
      resultat: 'godkjent',
      begrunnelse: 'Grunnlag godkjent. Dokumentert med foto og nye målinger.',
    },
  },
  // Nøytralt varsel er nå inkludert i frist_krav_sendt event
  {
    event_id: 'evt-305',
    tidsstempel: '2025-01-29T11:00:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 450.000 NOK - direkte kostnader',
    event_data: {
      metode: 'REGNINGSARBEID',
      begrunnelse: 'Foreløpig krav basert på estimat. Endelig spesifikasjon med detaljert kostnadskalkyle følger innen fastsatt frist.',
      kostnads_overslag: 450000,
      saerskilt_krav: {
        produktivitet: { belop: 50000 },
        rigg_drift: { belop: 50000 },
      },
      regningsarbeid_varsel: { dato_sendt: '2025-01-28', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-306',
    tidsstempel: '2025-01-28T15:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om avvik i rørføring - må legges om',
    event_data: {
      tittel: 'Avvik i eksisterende rørføring',
      hovedkategori: 'SVIKT',
      underkategori: 'PROSJ_RISIKO',
      beskrivelse: 'Eksisterende rørføring for vann og avløp avviker fra tegninger. Må legges om for å unngå kollisjon med nye konstruksjoner.',
      dato_oppdaget: '2025-01-28',
      grunnlag_varsel: { dato_sendt: '2025-01-28', metode: ['epost', 'telefon'] },
      kontraktsreferanser: ['§24.1', '§25.2'],
    },
  },
];
