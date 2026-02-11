/**
 * KontraktsregelInline Component
 *
 * Kompakt, inline komponent for å vise kontraktsregler fra NS 8407.
 *
 * Hver hjemmel har to velformulerte avsnitt:
 * - Første avsnitt: Trigger, handling og frist i naturlig prosa
 * - Andre avsnitt: Konsekvens ved brudd (inkludert §5-mekanismen)
 *
 * VIKTIG - OPPHAVSRETT (NS 8407):
 * Standard Norge har opphavsrett til NS 8407. Ved nye hjemler:
 * 1. PARAFRASÉR - ikke kopier ordrett fra kontrakten
 * 2. Bruk fulle navn, ikke forkortelser (totalentreprenør, ikke TE)
 * 3. Bevar juridiske nøkkelbegreper (uten ugrunnet opphold, pålegg)
 * 4. Omskriv setningsstruktur og ordvalg
 */

// Ingen eksterne avhengigheter - enkel inline-komponent

/** Støttede hjemler */
type Hjemmel =
  // Grunnlagspor - varslingsregler
  | '§10.2'   // Nektelse av kontraktsmedhjelper
  | '§14.4'   // Lovendring (kontraktsgjenstand)
  | '§14.6'   // Valg av løsninger (valgrettsbegrensning)
  | '§15.2'   // Lovendring (prosess)
  | '§19.1'   // Skade forårsaket av byggherren
  | '§21.4'   // Samordning utover påregnelig
  | '§22'     // Byggherrens medvirkningsplikt
  | '§26.3'   // Offentlige gebyrer og avgifter
  | '§29.2'   // Stansing ved betalingsmislighold
  | '§23.1'   // Uforutsette grunnforhold
  | '§23.3'   // Kulturminner
  | '§24.1'   // Byggherrens prosjekteringsrisiko
  | '§24.2.2' // Risikoovergang - kontroll av byggherrens materiale
  | '§25.1.2' // Varslingsplikt ved forhold som forstyrrer gjennomføringen
  | '§25.2'   // Varslingsplikt ved uegnet prosjektering (funksjonskrav)
  | '§31.3'   // Formell endringsordre
  | '§32.1'   // Definisjon av pålegg og utførelsesplikt
  | '§32.2'   // Irregulære endringer (pålegg uten endringsordre)
  | '§32.3'   // Passivitetsrisiko (byggherre)
  | '§38.1'   // Urettmessig brukstakelse
  // Fristspor - vilkår og varslingsregler
  | '§33.1'   // Vilkår for fristforlengelse (BH-risiko)
  | '§33.3'   // Vilkår for fristforlengelse (force majeure)
  | '§33.4'   // Nøytralt fristvarsel
  | '§33.6.1' // Spesifisert fristkrav
  | '§33.6.2' // Svar på etterlysning
  | '§33.7'   // BHs svarplikt på fristkrav
  | '§33.8';  // Varsel før forsering

/** Custom innhold for dynamisk bruk */
interface CustomInnhold {
  /** Hovedtekst - bruk enten 'tekst' eller 'inline' (bakoverkompatibel) */
  tekst?: string;
  /** @deprecated Bruk 'tekst' i stedet */
  inline?: string;
  /** Hjemmelreferanse */
  hjemmel?: string;
  /** Tilleggstekst (konsekvens/detaljer) */
  konsekvens?: string;
}

/** Props: Enten fast hjemmel ELLER custom innhold */
type KontraktsregelInlineProps =
  | { hjemmel: Hjemmel; custom?: never }
  | { hjemmel?: never; custom: CustomInnhold };

/**
 * Varslingsregel med fullstendige, velformulerte tekstblokker.
 */
interface Varslingsregel {
  /** Første avsnitt: Trigger, handling og frist i naturlig prosa */
  regel: string;
  /** Andre avsnitt: Konsekvens ved brudd (inkludert §5) */
  konsekvens: string;
}

/**
 * Varslingsregler med fullstendige, velformulerte tekstblokker.
 *
 * HUSK OPPHAVSRETT: Parafrasér alltid - se kommentar øverst i filen.
 */
const VARSLINGSREGLER: Record<Hjemmel, Varslingsregel> = {
  // ========== GRUNNLAGSPOR ==========

  '§10.2': {
    regel: 'Mottar byggherren underretning om valg av kontraktsmedhjelper (§10.2), må han melde fra om eventuell nektelse med saklig begrunnelse uten ugrunnet opphold, senest 14 dager etter mottak.',
    konsekvens: 'Nektes kontraktsmedhjelperen uten saklig grunn, kan totalentreprenøren kreve fristforlengelse og vederlagsjustering.',
  },

  '§14.4': {
    regel: 'Krever lovendring eller enkeltvedtak etter tilbudet endring av kontraktsgjenstanden (§14.4), må totalentreprenøren varsle etter §32.2 uten ugrunnet opphold dersom han mener dette utgjør en endring.',
    konsekvens: 'Varsles det ikke i tide, tapes retten til å påberope forholdet som endring. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§14.6': {
    regel: 'Mottar totalentreprenøren pålegg som begrenser valgretten for materiale, utførelse eller løsning (§14.6), må han varsle etter §32.2 uten ugrunnet opphold dersom han mener dette utgjør en endring.',
    konsekvens: 'Varsles det ikke i tide, tapes retten til å påberope begrensningen som endring. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§15.2': {
    regel: 'Krever lovendring eller enkeltvedtak etter tilbudet endring av avtalte prosesskrav (§15.2), må totalentreprenøren varsle etter §32.2 uten ugrunnet opphold dersom han mener dette utgjør en endring.',
    konsekvens: 'Varsles det ikke i tide, tapes retten til å påberope forholdet som endring. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§19.1': {
    regel: 'Forårsaker byggherren eller hans kontraktsmedhjelpere skade på kontraktsgjenstanden (§19.1), må totalentreprenøren varsle uten ugrunnet opphold (§5).',
    konsekvens: 'Byggherren bærer risikoen for slik skade. Dette gjelder også ekstraordinære omstendigheter som krig, opprør og naturkatastrofer.',
  },

  '§21.4': {
    regel: 'Medfører byggherrens koordinering omlegging utover det påregnelige etter kontrakten (§21.4), må totalentreprenøren varsle etter §32.2 uten ugrunnet opphold dersom han mener dette utgjør en endring.',
    konsekvens: 'Varsles det ikke i tide, tapes retten til å påberope forholdet som endring. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§22': {
    regel: 'Svikter byggherren i sin medvirkningsplikt etter §22.1-22.4, må totalentreprenøren varsle etter §25.1.2 uten ugrunnet opphold.',
    konsekvens: 'Byggherren kan kreve erstatning for tap som kunne vært unngått ved rettidig varsel, men kravet tapes ikke. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§23.1': {
    regel: 'Blir eller burde totalentreprenøren bli oppmerksom på at grunnforholdene avviker fra det han hadde grunn til å regne med (§23.1), må han varsle byggherren etter §25.1.2 uten ugrunnet opphold.',
    konsekvens: 'Byggherren kan kreve erstatning for tap som kunne vært unngått ved rettidig varsel, men kravet tapes ikke. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§23.3': {
    regel: 'Oppdager totalentreprenøren kulturminner (§23.3), må han straks innstille arbeidet, iverksette sikring og varsle byggherren etter §25.1.2 uten ugrunnet opphold.',
    konsekvens: 'Byggherren kan kreve erstatning for tap som kunne vært unngått. Totalentreprenøren har ikke risikoen for kulturminner med mindre han hadde kunnskap ved tilbudet.',
  },

  '§24.1': {
    regel: 'Oppdager totalentreprenøren svikt i løsninger eller prosjektering som byggherren har foreskrevet eller pålagt (§24.1), må han varsle etter §25.1.2 uten ugrunnet opphold.',
    konsekvens: 'Byggherren kan kreve erstatning for tap som kunne vært unngått, men kravet tapes ikke. Byggherren bærer risikoen for egen prosjektering. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§24.2.2': {
    regel: 'Mottar totalentreprenøren svar fra byggherren på varsel etter §24.2.2 som innebærer en endring uten at endringsordre utstedes, må han varsle etter §32.2 uten ugrunnet opphold.',
    konsekvens: 'Varsles det ikke i tide, tapes retten til å påberope at svaret innebærer en endring. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§25.1.2': {
    regel: 'Blir eller burde totalentreprenøren bli oppmerksom på forhold som kan forstyrre gjennomføringen (§25.1.2), må han varsle byggherren uten ugrunnet opphold.',
    konsekvens: 'Byggherren kan kreve erstatning for tap som kunne vært unngått ved rettidig varsel, men kravet tapes ikke. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§25.2': {
    regel: 'Blir eller måtte totalentreprenøren bli klar over at byggherrens prosjektering ikke er egnet til å oppfylle funksjonskravene i §14, må han varsle byggherren uten ugrunnet opphold (§25.2).',
    konsekvens: 'Byggherren kan kreve erstatning for tap som kunne vært unngått ved rettidig varsel, men kravet tapes ikke. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§26.3': {
    regel: 'Endres offentlige gebyrer eller avgifter etter tilbudet (§26.3), må totalentreprenøren varsle etter §32.2 uten ugrunnet opphold dersom han mener dette utgjør en endring.',
    konsekvens: 'Varsles det ikke i tide, tapes retten til å påberope forholdet som endring. Vederlagsjustering er uten påslag for indirekte kostnader, risiko og fortjeneste. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§29.2': {
    regel: 'Ved vesentlig betalingsmislighold fra byggherren, eller dersom slikt mislighold klart vil inntre (§29.2), må totalentreprenøren varsle skriftlig minst 24 timer før stansing iverksettes.',
    konsekvens: 'Stansingsrett forutsetter vesentlig mislighold.',
  },

  '§31.3': {
    regel: 'Byggherren kan pålegge totalentreprenøren endringer ved å utstede skriftlig endringsordre (§31.3). Endringen kan gjelde arbeidsomfang, kvalitet, art, utførelse eller fremdrift.',
    konsekvens: 'En endringsordre etter §31.3 etablerer at endringen er avtalt. Totalentreprenøren har utførelsesplikt og kan kreve vederlagsjustering (§34) og fristforlengelse (§33.1 a).',
  },

  '§32.1': {
    regel: 'Mottar totalentreprenøren pålegg uten endringsordre fra person med fullmakt eller via arbeidstegninger (§32.1), skal han iverksette pålegget og varsle etter §32.2 uten ugrunnet opphold dersom han mener det utgjør en endring.',
    konsekvens: 'Varsles det ikke i tide, tapes retten til å påberope at pålegget innebærer en endring. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§32.2': {
    regel: 'Mottar totalentreprenøren pålegg uten endringsordre og mener det utgjør en endring (§32.2), må han varsle byggherren skriftlig uten ugrunnet opphold.',
    konsekvens: 'Varsles det ikke i tide, tapes retten til å påberope at pålegget innebærer en endring. Byggherren må påberope at varselet er for sent skriftlig uten ugrunnet opphold (§5).',
  },

  '§32.3': {
    regel: 'Mottar byggherren varsel etter §32.2, skal han besvare det uten ugrunnet opphold ved å utstede endringsordre (a), avslå kravet (b), eller frafalle pålegget (c).',
    konsekvens: 'Svarer ikke byggherren i tide, anses pålegget å innebære en endring (§32.3). Totalentreprenøren må påberope passivitet skriftlig uten ugrunnet opphold (§5).',
  },

  '§38.1': {
    regel: 'Tar byggherren kontraktsgjenstanden i bruk før overtakelse uten avtale (§38.1), må totalentreprenøren varsle uten ugrunnet opphold (§5).',
    konsekvens: 'Risikoen for delene som tas i bruk går automatisk over til byggherren, og eventuell dagmulkt reduseres forholdsmessig.',
  },

  // ========== FRISTSPOR ==========

  '§33.1': {
    regel: 'Totalentreprenøren har krav på fristforlengelse dersom fremdriften hindres av endringer (a), svikt ved byggherrens medvirkning (b), eller andre forhold byggherren har risikoen for (c).',
    konsekvens: 'Fristforlengelsen skal svare til den virkning på fremdriften som forholdet har forårsaket (§33.5). Kravet må varsles uten ugrunnet opphold etter §33.4.',
  },

  '§33.3': {
    regel: 'Partene har krav på fristforlengelse ved force majeure: ekstraordinære omstendigheter utenfor partens kontroll som han ikke burde ha forutsett ved avtaleinngåelsen og ikke med rimelighet kunne ha overvunnet eller avverget følgene av.',
    konsekvens: 'Force majeure gir bare rett til fristforlengelse, ikke vederlagsjustering. Kravet må varsles uten ugrunnet opphold etter §33.4.',
  },

  '§33.4': {
    regel: 'Oppstår forhold som gir rett til fristforlengelse etter §33.1, §33.2 eller §33.3, må parten varsle krav om fristforlengelse uten ugrunnet opphold (§33.4).',
    konsekvens: 'Varsles det ikke i tide, tapes kravet på fristforlengelse. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§33.6.1': {
    regel: 'Når parten har grunnlag for å beregne omfanget av fristforlengelse, må han angi og begrunne antall dager uten ugrunnet opphold (§33.6.1).',
    konsekvens: 'Spesifiseres ikke kravet i tide, har parten bare krav på slik fristforlengelse som motparten måtte forstå at han hadde krav på. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§33.6.2': {
    regel: 'Mottar totalentreprenøren forespørsel per brev fra byggherren om å spesifisere fristkrav (§33.6.2), må han uten ugrunnet opphold enten angi og begrunne antall dager, eller begrunne hvorfor beregningsgrunnlag ikke foreligger.',
    konsekvens: 'Gjør totalentreprenøren ingen av delene i tide, tapes kravet på fristforlengelse. Byggherren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§33.7': {
    regel: 'Mottar byggherren begrunnet fristkrav med angivelse av antall dager (§33.6.1), skal han besvare kravet uten ugrunnet opphold (§33.7).',
    konsekvens: 'Besvares ikke kravet i tide, tapes innsigelser mot kravet. Totalentreprenøren må påberope sen varsling skriftlig uten ugrunnet opphold (§5).',
  },

  '§33.8': {
    regel: 'Vil totalentreprenøren iverksette forsering etter avslått fristkrav (§33.8), må han varsle byggherren med angivelse av antatt forseringskostnad før forsering iverksettes.',
    konsekvens: 'Forseringsrett forutsetter at fristkravet som ble avslått var berettiget, og at forseringskostnaden ikke overstiger dagmulkt pluss 30 prosent.',
  },
};

export function KontraktsregelInline(props: KontraktsregelInlineProps) {
  // Custom modus - enkel inline-tekst
  if ('custom' in props && props.custom) {
    const { tekst, inline, hjemmel, konsekvens } = props.custom;
    const hovedtekst = tekst ?? inline ?? '';
    return (
      <div className="rounded-md border border-pkt-border-subtle bg-pkt-bg-subtle p-4">
        <p className="text-sm text-pkt-text-body">
          {hovedtekst}
          {konsekvens && ` ${konsekvens}`}
          {hjemmel && <span className="text-pkt-text-body-subtle"> ({hjemmel})</span>}
        </p>
      </div>
    );
  }

  // Fast hjemmel modus
  const regel = props.hjemmel ? VARSLINGSREGLER[props.hjemmel] : null;
  if (!regel) {
    return null;
  }

  return (
    <div className="rounded-md border border-pkt-border-subtle bg-pkt-bg-subtle p-4 space-y-3">
      <p className="text-sm text-pkt-text-body">{regel.regel}</p>
      <p className="text-sm text-pkt-text-body">{regel.konsekvens}</p>
    </div>
  );
}

/** @deprecated Bruk KontraktsregelInline i stedet */
export const VarslingsregelInline = KontraktsregelInline;

/**
 * Hent regel-tekst for en hjemmel (til bruk i tooltips etc.)
 * Returnerer null hvis hjemmelen ikke er støttet.
 */
export function getRegelTekst(hjemmel: string): string | null {
  const key = hjemmel.startsWith('§') ? hjemmel : `§${hjemmel}`;
  const regel = VARSLINGSREGLER[key as Hjemmel];
  return regel?.regel ?? null;
}

/**
 * Hent komplett varslingsregel for en hjemmel.
 * Returnerer null hvis hjemmelen ikke er støttet.
 */
export function getVarslingsregel(hjemmel: string): Varslingsregel | null {
  const key = hjemmel.startsWith('§') ? hjemmel : `§${hjemmel}`;
  return VARSLINGSREGLER[key as Hjemmel] ?? null;
}

/**
 * @deprecated Bruk getRegelTekst i stedet
 */
export function getHjemmelTrigger(hjemmel: string): string | null {
  return getRegelTekst(hjemmel);
}

/**
 * @deprecated Bruk getRegelTekst i stedet
 */
export function getHjemmelInline(hjemmel: string): string | null {
  return getRegelTekst(hjemmel);
}
