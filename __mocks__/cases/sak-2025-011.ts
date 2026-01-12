import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-011: Subsidiær preklusjonslogikk - Rigg varslet for sent
 *
 * Scenario: BH bestrider grunnlag men gir subsidiært standpunkt.
 * Illustrerer hvordan preklusjon av rigg/drift påvirker vederlagsberegningen.
 *
 * - Grunnlag: Avslått av BH - utløser subsidiær vurdering
 * - Vederlag (subsidiært):
 *     - Hovedkrav: delvis godkjent (500k av 700k)
 *     - Rigg/drift: varslet for sent (rigg_varslet_i_tide = false) → prekludert → 0 kr
 *     - Produktivitet: varslet i tide, delvis godkjent (35k av 50k)
 *     - Total subsidiært: 535k
 * - Frist (subsidiært): delvis godkjent (10 av 15 dager)
 *
 * Demonstrerer: Preklusjon bestemmes i Port 1 (rigg_varslet_i_tide),
 * ikke som en BelopVurdering. BH kan faktisk mene kravet er berettiget,
 * men det utbetales ikke pga sen varsling.
 */
export const mockSakState11: SakState = {
  sak_id: 'SAK-2025-011',
  sakstittel: 'Subsidiær preklusjon - Rigg varslet for sent',

  grunnlag: {
    status: 'avslatt',
    tittel: 'Forsinket leveranse av stålkonstruksjoner',
    hovedkategori: 'BH_FORHOLD',
    underkategori: 'FORSINKET_LEVERANSE',
    beskrivelse:
      'Stålkonstruksjoner levert 3 uker etter avtalt dato. TE krever kompensasjon for ventetid og omlegging av arbeidsplan.',
    dato_oppdaget: '2025-02-10',
    grunnlag_varsel: {
      dato_sendt: '2025-02-12',
      metode: ['epost', 'telefon'],
    },
    kontraktsreferanser: ['§24.1', '§25.1'],
    bh_resultat: 'avslatt',
    bh_begrunnelse:
      'BH bestrider at forsinkelsen skyldes byggherreforhold. Leverandøren hadde egen forsinkelse. Subsidiært standpunkt avgis for det tilfelle at ansvar skulle foreligge.',
    laast: false,
    siste_oppdatert: '2025-02-20',
    antall_versjoner: 1,
  },

  vederlag: {
    status: 'under_behandling',
    metode: 'REGNINGSARBEID',
    kostnads_overslag: 700000,
    begrunnelse:
      'Hovedkrav på 700k for ventetid og omlegging. I tillegg kreves rigg/drift på 80k og produktivitetstap på 50k.',
    saerskilt_krav: {
      rigg_drift: {
        belop: 80000,
        dato_klar_over: '2025-02-10',
        // NB: Varslet først 2025-03-01 - etter 14-dagersfristen!
      },
      produktivitet: {
        belop: 50000,
        dato_klar_over: '2025-02-15',
      },
    },
    // Rigg varslet FOR SENT (dato_sendt > dato_klar_over + 14 dager)
    rigg_drift_varsel: {
      dato_sendt: '2025-03-01', // 19 dager etter dato_klar_over - FOR SENT
      metode: ['epost'],
    },
    // Produktivitet varslet i tide
    produktivitetstap_varsel: {
      dato_sendt: '2025-02-20', // 5 dager etter dato_klar_over - OK
      metode: ['epost'],
    },
    regningsarbeid_varsel: {
      dato_sendt: '2025-02-12',
      metode: ['epost'],
    },

    // BH respons - subsidiært (pga grunnlag avvist)
    bh_resultat: 'avslatt', // Prinsipalt avslått pga grunnlag
    bh_begrunnelse: `Byggherren godtar den foreslåtte oppgjørsformen regningsarbeid (§34.4).

Hva gjelder beløpet:

Hovedkravet godkjennes delvis med kr 500 000,- av krevde kr 700 000,- (71%).

Kravet om dekning av økte rigg- og driftskostnader på kr 80 000,- avvises prinsipalt som prekludert iht. §34.1.3, da varselet ikke ble fremsatt «uten ugrunnet opphold» etter at entreprenøren ble eller burde blitt klar over at utgiftene ville påløpe. Subsidiært, dersom kravet ikke anses prekludert, aksepteres kr 50 000,-.

Kravet om dekning av produktivitetstap godkjennes delvis med kr 35 000,- av krevde kr 50 000,-.

Samlet godkjent beløp utgjør etter dette kr 535 000,- av totalt krevde kr 830 000,-. Dersom de prekluderte særskilte kravene hadde vært varslet i tide, ville samlet godkjent beløp utgjort kr 585 000,- (subsidiært standpunkt).`,

    // Subsidiært standpunkt
    subsidiaer_triggers: ['grunnlag_avslatt', 'preklusjon_rigg'],
    subsidiaer_resultat: 'delvis_godkjent',
    subsidiaer_godkjent_belop: 535000, // 500k hovedkrav + 0 rigg (prekludert) + 35k produktivitet
    subsidiaer_begrunnelse: `Byggherren godtar den foreslåtte oppgjørsformen regningsarbeid (§34.4).

Hva gjelder beløpet:

Hovedkravet godkjennes delvis med kr 500 000,- av krevde kr 700 000,- (71%).

Kravet om dekning av økte rigg- og driftskostnader på kr 80 000,- avvises prinsipalt som prekludert iht. §34.1.3, da varselet ikke ble fremsatt «uten ugrunnet opphold» etter at entreprenøren ble eller burde blitt klar over at utgiftene ville påløpe. Subsidiært, dersom kravet ikke anses prekludert, aksepteres kr 50 000,-.

Kravet om dekning av produktivitetstap godkjennes delvis med kr 35 000,- av krevde kr 50 000,-.

Samlet godkjent beløp utgjør etter dette kr 535 000,- av totalt krevde kr 830 000,-. Dersom de prekluderte særskilte kravene hadde vært varslet i tide, ville samlet godkjent beløp utgjort kr 585 000,- (subsidiært standpunkt).`,

    har_subsidiaert_standpunkt: true,
    siste_oppdatert: '2025-02-25',
    antall_versjoner: 1,
  },

  frist: {
    status: 'under_behandling',
    varsel_type: 'spesifisert',
    noytralt_varsel: {
      dato_sendt: '2025-02-12',
      metode: ['epost'],
    },
    spesifisert_varsel: {
      dato_sendt: '2025-02-18',
      metode: ['epost'],
    },
    krevd_dager: 15,
    begrunnelse:
      'Forsinkelsen medførte 15 dagers hindring av kritisk linje. Dokumentert med oppdatert fremdriftsplan.',
    noytralt_varsel_ok: true,
    spesifisert_krav_ok: true,
    vilkar_oppfylt: true,

    // BH respons - subsidiært
    bh_resultat: 'avslatt', // Prinsipalt avslått pga grunnlag
    bh_begrunnelse: `Kravet avvises prinsipalt som prekludert iht. §33.6, da spesifisert krav (§33.6) ikke ble fremsatt «uten ugrunnet opphold» etter at entreprenøren ble eller burde blitt klar over forholdet.

Subsidiært, hva gjelder vilkårene (§33.5): Det erkjennes at det påberopte forholdet har forårsaket faktisk hindring av fremdriften, og at det foreligger årsakssammenheng mellom forholdet og forsinkelsen.

Subsidiært, hva gjelder antall dager: Kravet godkjennes delvis med 10 dager av krevde 15 dager (67%).

Kravet om 15 dagers fristforlengelse avvises i sin helhet. Dersom byggherren ikke får medhold i sin prinsipale avvisning, kan entreprenøren maksimalt ha krav på 10 dager (subsidiært standpunkt).

Byggherren gjør oppmerksom på at dersom avslaget skulle vise seg å være uberettiget, kan entreprenøren velge å anse avslaget som et pålegg om forsering (§33.8). Denne valgretten gjelder dog ikke dersom forseringskostnadene overstiger dagmulkten med tillegg av 30%.`,

    // Subsidiært standpunkt
    subsidiaer_triggers: ['grunnlag_avslatt'],
    subsidiaer_resultat: 'delvis_godkjent',
    subsidiaer_godkjent_dager: 10,
    subsidiaer_begrunnelse: `Kravet avvises prinsipalt som prekludert iht. §33.6, da spesifisert krav (§33.6) ikke ble fremsatt «uten ugrunnet opphold» etter at entreprenøren ble eller burde blitt klar over forholdet.

Subsidiært, hva gjelder vilkårene (§33.5): Det erkjennes at det påberopte forholdet har forårsaket faktisk hindring av fremdriften, og at det foreligger årsakssammenheng mellom forholdet og forsinkelsen.

Subsidiært, hva gjelder antall dager: Kravet godkjennes delvis med 10 dager av krevde 15 dager (67%).

Kravet om 15 dagers fristforlengelse avvises i sin helhet. Dersom byggherren ikke får medhold i sin prinsipale avvisning, kan entreprenøren maksimalt ha krav på 10 dager (subsidiært standpunkt).

Byggherren gjør oppmerksom på at dersom avslaget skulle vise seg å være uberettiget, kan entreprenøren velge å anse avslaget som et pålegg om forsering (§33.8). Denne valgretten gjelder dog ikke dersom forseringskostnadene overstiger dagmulkten med tillegg av 30%.`,

    har_subsidiaert_standpunkt: true,
    siste_oppdatert: '2025-02-25',
    antall_versjoner: 1,
  },

  // Computed - Subsidiær logikk
  er_subsidiaert_vederlag: true,
  er_subsidiaert_frist: true,
  visningsstatus_vederlag: 'Avslått prinsipalt, subsidiært 535.000 kr',
  visningsstatus_frist: 'Avslått prinsipalt, subsidiært 10 dager',

  overordnet_status: 'UNDER_FORHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'TE',
    handling: 'Vurdere videre prosess - tvist om grunnlag',
    spor: null,
  },

  sum_krevd: 830000, // 700k + 80k + 50k
  sum_godkjent: 0, // Prinsipalt avslått

  opprettet: '2025-02-10',
  siste_aktivitet: '2025-02-25',
  antall_events: 8,
};
