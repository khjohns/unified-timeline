import type { TimelineEntry } from '@/types/timeline';

/**
 * Timeline for SAK-2025-011: Subsidiær preklusjonslogikk - Rigg varslet for sent
 *
 * Demonstrerer:
 * - BH avslår grunnlag som utløser subsidiær vurdering
 * - Rigg/drift varslet for sent (prekludert via rigg_varslet_i_tide = false)
 * - Produktivitet varslet i tide, vurdert subsidiært
 * - BelopVurdering er BH's faktiske vurdering - preklusjon er separat
 */
export const mockTimelineEvents11: TimelineEntry[] = [
  // === Nyeste først ===
  // Sent rigg-varsel (sendt ETTER BH-respons - viser preklusjonskonsekvens)
  {
    event_id: 'evt-1108',
    tidsstempel: '2025-03-01T10:00:00Z',
    type: 'Særskilt varsel rigg/drift (FOR SENT)',
    event_type: 'vederlag_saerskilt_varsel',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Rigg/drift varsel - sendt 19 dager etter kjennskap (for sent)',
    event_data: {
      varsel_type: 'rigg_drift',
      rigg_drift_varsel: { dato_sendt: '2025-03-01', metode: ['epost'] },
      dato_klar_over: '2025-02-10',
      dager_siden_kjennskap: 19,
      frist_beskrivelse: 'uten ugrunnet opphold (§34.1.3)',
      begrunnelse:
        'Varsel om rigg/drift-kostnader på 80.000 kr. (NB: Sendt 19 dager etter kjennskap - for sent jf. §34.1.3)',
    },
  },
  {
    event_id: 'evt-1101',
    tidsstempel: '2025-02-25T15:00:00Z',
    type: 'Respons på fristkrav',
    event_type: 'respons_frist',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'frist',
    sammendrag: 'Avslått prinsipalt - subsidiært 10 dager',
    event_data: {
      // Port 1: Varsling OK
      noytralt_varsel_ok: true,
      spesifisert_krav_ok: true,
      begrunnelse_varsel: 'Begge varsler mottatt i tide.',

      // Port 2: Vilkår
      vilkar_oppfylt: true,
      begrunnelse_vilkar:
        'Subsidiært: Årsakssammenheng dokumentert, gitt at ansvar hadde foreligget.',

      // Port 3: Prinsipal - Avslått pga grunnlag
      beregnings_resultat: 'avslatt',
      begrunnelse_beregning: 'Kravet avslås prinsipalt da grunnlaget bestrides.',

      // Port 3: Beregning - Prinsipalt
      godkjent_dager: 0,

      // Subsidiært standpunkt
      subsidiaer_triggers: ['grunnlag_avslatt'],
      subsidiaer_resultat: 'delvis_godkjent',
      subsidiaer_godkjent_dager: 10,
      subsidiaer_begrunnelse:
        'Subsidiært: Dersom ansvar hadde foreligget, ville 10 av 15 dager vært godkjent. BH mener dokumentasjonen kun understøtter 10 dagers reell hindring.',
    },
  },
  {
    event_id: 'evt-1102',
    tidsstempel: '2025-02-25T14:30:00Z',
    type: 'Respons på vederlagskrav',
    event_type: 'respons_vederlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'vederlag',
    sammendrag: 'Avslått prinsipalt - subsidiært 535.000 kr (rigg prekludert)',
    event_data: {
      // Port 1: Preklusjon av særskilte krav
      rigg_varslet_i_tide: false, // PREKLUDERT - 19 dager etter kjennskap
      produktivitet_varslet_i_tide: true, // OK - varslet samme dag som kjennskap
      begrunnelse_preklusjon:
        'Rigg/drift ble varslet 2025-03-01, 19 dager etter at forholdet ble kjent (2025-02-10). Dette overskrider "uten ugrunnet opphold" jf. §34.1.3. Produktivitetstap ble varslet samme dag som kjennskap (2025-02-15).',

      // Port 2: Metode (regningsarbeid OK subsidiært)
      aksepterer_metode: true,
      begrunnelse_metode: 'Regningsarbeid aksepteres subsidiært.',

      // Port 3: Beløpsvurdering - Hovedkrav
      // NB: Dette er BH's faktiske vurdering av kravets innhold
      hovedkrav_vurdering: 'delvis',
      hovedkrav_godkjent_belop: 500000,
      hovedkrav_begrunnelse:
        'Dokumentasjonen understøtter 500.000 kr av 700.000 kr krevd. Manglende spesifikasjon av ventetidskostnader.',

      // Port 3: Beløpsvurdering - Rigg/drift
      // NB: Selv om rigg er prekludert (rigg_varslet_i_tide = false),
      // angir BH likevel sin faktiske vurdering av kravet.
      // Dette viser at BH mener kravet var berettiget, men det utbetales
      // ikke pga sen varsling.
      rigg_vurdering: 'godkjent', // BH mener kravet er OK
      rigg_godkjent_belop: 0, // Men beløp = 0 fordi det er prekludert

      // Port 3: Beløpsvurdering - Produktivitet
      produktivitet_vurdering: 'delvis',
      produktivitet_godkjent_belop: 35000,

      // Port 4: Samlet resultat - Prinsipal
      beregnings_resultat: 'avslatt',
      begrunnelse_beregning: 'Kravet avslås prinsipalt da grunnlaget bestrides.',
      total_godkjent_belop: 0,

      // Subsidiært standpunkt
      subsidiaer_triggers: ['grunnlag_avslatt', 'preklusjon_rigg'],
      subsidiaer_resultat: 'delvis_godkjent',
      subsidiaer_godkjent_belop: 535000,
      subsidiaer_begrunnelse:
        'Subsidiært: Dersom ansvar hadde foreligget, ville totalt 535.000 kr vært godkjent (hovedkrav 500k + produktivitet 35k). Rigg/drift på 80k er prekludert pga sen varsling.',
    },
  },
  {
    event_id: 'evt-1103',
    tidsstempel: '2025-02-20T10:00:00Z',
    type: 'Respons på grunnlag',
    event_type: 'respons_grunnlag',
    aktor: 'Kari Nordmann',
    rolle: 'BH',
    spor: 'grunnlag',
    sammendrag: 'Grunnlag bestridt - subsidiært standpunkt avgis',
    event_data: {
      resultat: 'avslatt',
      begrunnelse:
        'BH bestrider at forsinkelsen skyldes byggherreforhold. Leverandøren hadde egen forsinkelse som ikke er BH risiko. Subsidiært standpunkt avgis for vederlag og frist.',
    },
  },
  {
    event_id: 'evt-1104',
    tidsstempel: '2025-02-18T11:00:00Z',
    type: 'Spesifisert fristkrav sendt',
    event_type: 'frist_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Spesifisert krav: 15 dager fristforlengelse',
    event_data: {
      varsel_type: 'spesifisert',
      spesifisert_varsel: { dato_sendt: '2025-02-18', metode: ['epost'] },
      antall_dager: 15,
      begrunnelse:
        'Forsinkelsen medførte 15 dagers hindring av kritisk linje. Fremdriftsplan vedlagt.',
      ny_sluttdato: '2025-06-15',
    },
  },
  {
    event_id: 'evt-1105',
    tidsstempel: '2025-02-15T14:00:00Z',
    type: 'Vederlagskrav sendt',
    event_type: 'vederlag_krav_sendt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'vederlag',
    sammendrag: 'Krav på 830.000 kr - hovedkrav + særskilte krav',
    event_data: {
      metode: 'REGNINGSARBEID',
      kostnads_overslag: 700000,
      begrunnelse:
        'Hovedkrav på 700k for ventetid og omlegging av arbeidsplan.',
      saerskilt_krav: {
        rigg_drift: {
          belop: 80000,
          dato_klar_over: '2025-02-10',
        },
        produktivitet: {
          belop: 50000,
          dato_klar_over: '2025-02-15',
        },
      },
      // Forhåndsvarsel for regningsarbeid (§34.4) - varslet før oppstart
      regningsarbeid_varsel: { dato_sendt: '2025-02-12', metode: ['epost'] },
    },
  },
  {
    event_id: 'evt-1106',
    tidsstempel: '2025-02-12T09:30:00Z',
    type: 'Nøytralt varsel sendt',
    event_type: 'frist_varsel_noytralt',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'frist',
    sammendrag: 'Nøytralt varsel om mulig fristforlengelse',
    event_data: {
      noytralt_varsel: { dato_sendt: '2025-02-12', metode: ['epost'] },
      begrunnelse:
        'Forsinket stålleveranse kan medføre behov for fristforlengelse. Spesifisert krav følger.',
    },
  },
  {
    event_id: 'evt-1107',
    tidsstempel: '2025-02-12T09:00:00Z',
    type: 'Grunnlag opprettet',
    event_type: 'grunnlag_opprettet',
    aktor: 'Per Hansen',
    rolle: 'TE',
    spor: 'grunnlag',
    sammendrag: 'Varsel om forsinket stålleveranse fra BH',
    event_data: {
      tittel: 'Forsinket leveranse av stålkonstruksjoner',
      hovedkategori: 'BH_FORHOLD',
      underkategori: 'FORSINKET_LEVERANSE',
      beskrivelse:
        'Stålkonstruksjoner levert 3 uker etter avtalt dato. TE krever kompensasjon for ventetid og omlegging av arbeidsplan.',
      dato_oppdaget: '2025-02-10',
      grunnlag_varsel: { dato_sendt: '2025-02-12', metode: ['epost', 'telefon'] },
      kontraktsreferanser: ['§24.1', '§25.1'],
    },
  },
];
