/**
 * KontraktsregelInline Component
 *
 * Kompakt, inline komponent for å vise kontraktsregler fra NS 8407.
 * Progressiv avsløring via accordion.
 *
 * Støtter:
 * - Grunnlagspor: §10.2, §14.4, §14.6, §15.2, §19.1, §21.4, §22, §23.1, §23.3, §24.1, §24.2.2, §25.1.2, §25.2, §26.3, §32.1, §32.2, §32.3
 * - Fristspor: §33.1, §33.3, §33.4, §33.5, §33.6.1, §33.6.2, §33.7, §33.8
 * - Custom mode: Dynamisk innhold med samme visuelle stil
 *
 * Struktur:
 * - Inline tekst: Parafrasert kontraktsregel (alltid synlig)
 * - Accordion: Konsekvenser/detaljer (lukket som default)
 *
 * VIKTIG - OPPHAVSRETT (NS 8407):
 * Standard Norge har opphavsrett til NS 8407. Ved nye hjemler:
 * 1. PARAFRASÉR - ikke kopier ordrett fra kontrakten
 * 2. Bruk fulle navn, ikke forkortelser (totalentreprenør, ikke TE)
 * 3. Bevar juridiske nøkkelbegreper («uten ugrunnet opphold», «pålegg»)
 * 4. Omskriv setningsstruktur og ordvalg
 * 5. Systematikk-punkter skal forklare innholdet, ikke sitere det
 */

import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRightIcon } from '@radix-ui/react-icons';

/** Støttede hjemler */
type Hjemmel =
  // Grunnlagspor
  | '§10.2'   // Nektelse av kontraktsmedhjelper
  | '§14.4'   // Lovendring (kontraktsgjenstand)
  | '§14.6'   // Valg av løsninger (valgrettsbegrensning)
  | '§15.2'   // Lovendring (prosess)
  | '§19.1'   // Skade forårsaket av byggherren
  | '§21.4'   // Samordning utover påregnelig
  | '§22'     // Byggherrens medvirkningsplikt
  | '§26.3'   // Offentlige gebyrer og avgifter
  | '§23.1'   // Uforutsette grunnforhold
  | '§23.3'   // Kulturminner
  | '§24.1'   // Byggherrens prosjekteringsrisiko
  | '§24.2.2' // Risikoovergang - kontroll av byggherrens materiale
  | '§25.1.2' // Varslingsplikt ved forhold som forstyrrer gjennomføringen
  | '§25.2'   // Varslingsplikt ved uegnet prosjektering (funksjonskrav)
  | '§32.1'   // Definisjon av pålegg og utførelsesplikt
  | '§32.2'   // Irregulære endringer (pålegg uten endringsordre)
  | '§32.3'   // Passivitetsrisiko (byggherre)
  // Fristspor
  | '§33.1' | '§33.3' | '§33.4' | '§33.5' | '§33.6.1' | '§33.6.2' | '§33.7' | '§33.8';

/** Systematikk-referanse for å vise sammenhenger */
interface SystematikkRef {
  ref: string;
  tekst: string;
}

/** Systematikk-innhold for accordion */
interface Systematikk {
  label: string;
  innhold: SystematikkRef[];
}

/** Custom innhold for dynamisk bruk */
interface CustomInnhold {
  inline: string;
  hjemmel: string;
  /** Valgfri - vises i accordion hvis angitt */
  konsekvens?: string;
  /** Valgfri accordion-label, default "Detaljer" */
  accordionLabel?: string;
}

/** Props: Enten fast hjemmel ELLER custom innhold */
type KontraktsregelInlineProps =
  | { hjemmel: Hjemmel; custom?: never }
  | { hjemmel?: never; custom: CustomInnhold };

/**
 * Innhold per hjemmel.
 *
 * HUSK OPPHAVSRETT: Parafrasér alltid - se kommentar øverst i filen.
 *
 * HVORDAN BYGGE EN NY HJEMMEL:
 * (Se også docs/NS8407_VARSLINGSREGLER_KARTLEGGING.md for fullstendig analyse)
 *
 * 1. ANALYSER MED 5 DIMENSJONER:
 *    - HVEM: Hvem har plikten? (totalentreprenøren/byggherren/begge)
 *    - TRIGGER: Hva utløser plikten? (pålegg, varsel, forhold, etc.)
 *    - SKJÆRINGSTIDSPUNKT: Når begynner fristen? Se aktsomhetsnorm under.
 *    - FRIST: Hvor lang? («uten ugrunnet opphold», 5 uker, etc.)
 *    - KONSEKVENS: Hva ved brudd? (preklusjon, erstatning, passiv aksept, reduksjon)
 *
 * 2. AKTSOMHETSNORM (for skjæringstidspunkt):
 *    - "blir oppmerksom på"       → Faktisk kunnskap (mildest krav til varslende)
 *    - "burde ha blitt klar over" → Normal aktsomhet (strengest krav til varslende)
 *    - "måtte ha blitt klar over" → Kun åpenbare mangler (midt imellom)
 *
 * 3. §5-MEKANISMEN (varsler og krav):
 *    §5 ligger "over" spesialreglene som et filter og er en forutsetning for at
 *    spesialregelens konsekvens skal inntre.
 *
 *    Systematikk:
 *    ┌─────────────────────────────────────────────────────────────────────────┐
 *    │ §5 (overordnet)                                                         │
 *    │ Den som vil påberope senhet må gjøre det skriftlig uten ugrunnet        │
 *    │ opphold etter mottak. Gjør han ikke det, anses varselet/svaret rettidig.│
 *    ├─────────────────────────────────────────────────────────────────────────┤
 *    │ Spesialregel (f.eks. §32.3, §33.7)                                      │
 *    │ Definerer konsekvensen ved brudd (passiv aksept, preklusjon, etc.)      │
 *    └─────────────────────────────────────────────────────────────────────────┘
 *
 *    Eksempel - §32.3 (byggherrens svarplikt på §32.2-varsel):
 *    1. Totalentreprenøren sender §32.2-varsel
 *    2. Byggherren svarer med avslag - men for sent
 *    3. §32.3 definerer konsekvensen: "pålegget anses å innebære en endring"
 *    4. MEN §5 krever at totalentreprenøren påberoper senheten i tide
 *    5. Påberoper totalentreprenøren for sent → §5 slår inn: svaret anses rettidig
 *    6. Resultat: Avslaget står, ingen endring
 *
 *    Viktig: §5 anvendes kun én gang - ikke rekursivt. Motparten trenger ikke
 *    påberope at senhetspåberopelsen var for sen. §5 slår direkte inn når
 *    fristen "uten ugrunnet opphold" er oversittet.
 *
 * 4. STRUKTURÉR INNHOLDET:
 *    - inline: Hovedregelen i én setning. Start med subjekt, deretter handling og frist.
 *    - konsekvens: Hva skjer ved brudd? Bruk konsekvenstyper fra kartleggingen.
 *    - paragraf5: paaberoper = hvem må påberope senhet ('TE'/'BH'), tekst = påminnelse.
 *    - systematikk: Valgfritt. For underpunkter, definisjoner, eller sammenhenger.
 *
 * 5. EKSEMPEL (§32.3):
 *    - HVEM: BH | TRIGGER: Mottar varsel etter §32.2 | FRIST: Uten ugrunnet opphold
 *    - KONSEKVENS: Passiv aksept (pålegget anses som endring)
 *    - inline: "Når byggherren mottar varsel etter §32.2, skal han..."
 *    - paragraf5: TE må påberope passivitet.
 *    - systematikk: Vis svaralternativene (a, b, c) med forklarende tekst.
 */
const HJEMMEL_INNHOLD: Record<Hjemmel, {
  inline: string;
  konsekvens: string;
  paragraf5: { paaberoper: 'TE' | 'BH'; tekst: string };
  systematikk?: Systematikk;
}> = {
  // ========== GRUNNLAGSPOR ==========

  '§10.2': {
    inline: 'Nekter byggherren å godta totalentreprenørens valg av kontraktsmedhjelper uten saklig grunn, kan totalentreprenøren kreve fristforlengelse eller vederlagsjustering etter §33 og §34.',
    konsekvens: 'Byggherren må godtgjøre at nektelsen er saklig begrunnet i kontraktsmedhjelperens forhold. Kan han ikke det, har totalentreprenøren krav på kompensasjon.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '',
    },
    systematikk: {
      label: 'Vilkår for nektelse (§10.2)',
      innhold: [
        { ref: 'Frist', tekst: 'Byggherren må melde fra uten ugrunnet opphold, senest 14 dager etter mottatt underretning.' },
        { ref: 'Saklig grunn', tekst: 'Nektelsen må være begrunnet i kontraktsmedhjelperens forhold (ikke totalentreprenørens).' },
      ],
    },
  },
  '§14.4': {
    inline: 'Skjer det lovendringer eller fattes enkeltvedtak etter tilbudet som krever endring av kontraktsgjenstanden, kan totalentreprenøren påberope dette som endring og skal varsle etter §32.2.',
    konsekvens: 'Preklusjon – manglende varsel etter §32.2 medfører tap av retten til å påberope forholdet som endring. Gjelder kun forhold totalentreprenøren ikke burde ha tatt i betraktning ved tilbudet.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope sen varsling skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
  },
  '§14.6': {
    inline: 'Mottar totalentreprenøren pålegg som begrenser valgretten for materiale, utførelse eller løsning innenfor kontraktens rammer (§14.1-14.5), er dette en endring.',
    konsekvens: 'Vil totalentreprenøren påberope begrensning av valgrett som endring, må han varsle etter §32.2. Manglende varsel medfører tap av rett.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope sen varsling skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
    systematikk: {
      label: '§14.6: Valg av løsninger',
      innhold: [
        { ref: 'Hovedregel', tekst: 'Totalentreprenøren velger materiale, utførelse og løsning innenfor kontraktens rammer.' },
        { ref: 'Rammer', tekst: 'Begrenset av §14.1-14.5 (funksjonskrav, standarder, offentlige krav, etc.).' },
        { ref: 'Begrensning = endring', tekst: 'Pålegg (jf. §32.1) som begrenser valgretten er en endring.' },
        { ref: 'Varsling', tekst: 'Totalentreprenøren må varsle etter §32.2 for å påberope endringen.' },
      ],
    },
  },
  '§15.2': {
    inline: 'Skjer det lovendringer eller fattes enkeltvedtak etter tilbudet som krever endring av avtalte prosesskrav (§15.1), kan totalentreprenøren påberope dette som endring og skal varsle etter §32.2.',
    konsekvens: 'Preklusjon – manglende varsel etter §32.2 medfører tap av retten til å påberope forholdet som endring. Gjelder kun forhold totalentreprenøren ikke burde ha tatt i betraktning ved tilbudet.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope sen varsling skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
  },
  '§19.1': {
    inline: 'Forårsaker byggherren eller hans kontraktsmedhjelpere skade på kontraktsgjenstanden i byggetiden, bærer byggherren risikoen.',
    konsekvens: 'Totalentreprenøren bærer ikke risikoen for skade forårsaket av byggherren, eller for ekstraordinære omstendigheter som krig, opprør og naturkatastrofer.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '',
    },
  },
  '§21.4': {
    inline: 'Medfører byggherrens koordinering at totalentreprenøren må legge om sin utførelse utover det som er påregnelig etter kontrakten, kan han påberope dette som endring og skal varsle etter §32.2.',
    konsekvens: 'Preklusjon – manglende varsel etter §32.2 medfører tap av retten til å påberope forholdet som endring.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope sen varsling skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
    systematikk: {
      label: 'Hva er «påregnelig» samordning?',
      innhold: [
        { ref: 'Rammer', tekst: 'Det som følger av kontraktens angivelse av arbeidets art, omfang og fremdrift.' },
        { ref: 'Sideentrepriser', tekst: 'Kontraktens opplysninger om sideentreprisenes antall, art og fremdrift.' },
      ],
    },
  },
  '§22': {
    inline: 'Svikter byggherren i sin medvirkningsplikt etter §22.1-22.4, skal totalentreprenøren varsle uten ugrunnet opphold etter §25.1.2.',
    konsekvens: 'Erstatning – byggherren kan kreve erstatning for tap som kunne vært unngått ved rettidig varsel. Kravet tapes ikke.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope sen varsling skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
    systematikk: {
      label: 'Byggherrens medvirkningsplikter (§22.1-22.4)',
      innhold: [
        { ref: '§22.1', tekst: 'Overholde lover, forskrifter og offentlige vedtak for sine kontraktsforpliktelser.' },
        { ref: '§22.2', tekst: 'Sørge for nødvendig offentligrettslig og privatrettslig råderett over eiendommen.' },
        { ref: '§22.3', tekst: 'Stille til rådighet fysisk arbeidsgrunnlag som totalentreprenøren skal bygge på.' },
        { ref: '§22.4', tekst: 'Levere materialer dersom avtalt; bærer risikoen for at leveransene er i henhold til avtalen.' },
      ],
    },
  },
  '§23.1': {
    inline: 'Blir eller burde totalentreprenøren ha blitt oppmerksom på at grunnforholdene avviker fra det han hadde grunn til å regne med ved tilbudet, skal han varsle byggherren etter §25.1.2 uten ugrunnet opphold.',
    konsekvens: 'Erstatning – byggherren kan kreve erstatning for tap som kunne vært unngått ved rettidig varsel. Kravet tapes ikke.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope sen varsling skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
    systematikk: {
      label: 'Ved avtalt risikoovergang (§23.2)',
      innhold: [
        { ref: 'Terskel', tekst: 'Har totalentreprenøren overtatt risikoen, kan han likevel påberope seg forhold som avviker vesentlig fra det han hadde grunn til å regne med.' },
      ],
    },
  },
  '§23.3': {
    inline: 'Oppdager totalentreprenøren kulturminner, skal han straks innstille arbeidet i nærheten, iverksette nødvendig sikring og varsle byggherren uten ugrunnet opphold etter §25.1.2.',
    konsekvens: 'Erstatning – byggherren kan kreve erstatning for tap som kunne vært unngått ved rettidig varsel. Totalentreprenøren har ikke risikoen for kulturminner med mindre han hadde kunnskap ved tilbudet.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope sen varsling skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
  },
  '§24.1': {
    inline: 'Oppdager totalentreprenøren svikt i løsninger eller prosjektering som byggherren har foreskrevet eller pålagt, skal han varsle uten ugrunnet opphold etter §25.1.2.',
    konsekvens: 'Erstatning – byggherren kan kreve erstatning for tap som kunne vært unngått ved rettidig varsel. Merk: Kravet tapes IKKE. Byggherren bærer risikoen for egen prosjektering.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope sen varsling skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
    systematikk: {
      label: '§24.1: Byggherrens prosjekteringsrisiko',
      innhold: [
        { ref: 'Omfang', tekst: 'Byggherren har risikoen for løsninger og prosjektering i egne kontraktsdokumenter, samt pålegg gitt etter kontraktsinngåelse.' },
        { ref: 'Aktsomhet', tekst: '«burde» (§25.1.2) – normal aktsomhet ved forhold som kan forstyrre gjennomføringen.' },
      ],
    },
  },
  '§24.2.2': {
    inline: 'Innebærer byggherrens svar på varsel etter §24.2.2 en endring uten at endringsordre utstedes, skal totalentreprenøren varsle etter §32.2.',
    konsekvens: 'Uten varsel etter §32.2 tapes retten til å påberope at svaret innebærer en endring.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '',
    },
    systematikk: {
      label: '§24.2.2: Kontroll, varsling og svar',
      innhold: [
        { ref: 'Forutsetning', tekst: 'Bestemmelsen gjelder kun når partene har avtalt risikoovergang etter §24.2.1 (totalentreprenøren overtar risiko for byggherrens prosjektering).' },
        { ref: '1. Varslingsfrist', tekst: 'Totalentreprenøren har en frist på 5 uker fra kontraktsinngåelse til å varsle (utsettes ved senere mottak av materiale).' },
        { ref: '2. Risikoovergang', tekst: 'Rettidig varsel: totalentreprenøren overtar ikke risikoen. Manglende varsel: risikoen overtas.' },
        { ref: '3. Byggherrens svarplikt', tekst: 'Byggherren må besvare varselet «uten ugrunnet opphold».' },
        { ref: '4. Fastholdelse', tekst: 'Fastholder byggherren sin løsning, bærer byggherren risikoen for sitt valg.' },
        { ref: '5. Svaret er endring', tekst: 'Innebærer svaret en endring, skal byggherren utstede endringsordre (§31.3). Gjør han ikke det, må totalentreprenøren varsle etter §32.2.' },
      ],
    },
  },
  '§25.1.2': {
    inline: 'Blir eller burde totalentreprenøren ha blitt oppmerksom på forhold som kan forstyrre gjennomføringen, skal han varsle byggherren uten ugrunnet opphold.',
    konsekvens: 'Erstatning – byggherren kan kreve erstatning for tap som kunne vært unngått ved rettidig varsel. Merk: Kravet tapes IKKE (ingen preklusjon).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope sen varsling skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
    systematikk: {
      label: 'Hva er «forhold» (§25.1.1)?',
      innhold: [
        { ref: 'Generelt', tekst: 'Byggherrens ytelser og andre forhold byggherren har risikoen for, som vil kunne forstyrre gjennomføringen – særlig:' },
        { ref: 'a)', tekst: 'Ufullstendigheter, uoverensstemmelser eller svakheter i byggherrens prosjektering' },
        { ref: 'b)', tekst: 'Behov for grunnundersøkelser / utilstrekkelige undersøkelser' },
        { ref: 'c)', tekst: 'Feil ved materialer eller andre ytelser fra byggherren' },
        { ref: 'd)', tekst: 'Fysisk arbeidsgrunnlag eller grunnforhold avviker fra forventning' },
      ],
    },
  },
  '§25.2': {
    inline: 'Blir eller måtte totalentreprenøren ha blitt klar over at byggherrens prosjektering ikke er egnet til å oppfylle funksjonskravene i §14, skal han varsle byggherren uten ugrunnet opphold.',
    konsekvens: 'Erstatning – byggherren kan kreve erstatning for tap som kunne vært unngått ved rettidig varsel. Merk: Kravet tapes IKKE (ingen preklusjon).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope sen varsling skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
    systematikk: {
      label: 'Hva er «funksjonskravene»?',
      innhold: [
        { ref: '§14', tekst: 'Krav til kontraktsgjenstanden – ytelse, kvalitet, egenskaper' },
        { ref: 'Aktsomhet', tekst: '«måtte» = kun åpenbare feil utløser varslingsplikt' },
        { ref: 'Plikt', tekst: 'Vurdere «i rimelig utstrekning» – ikke aktiv undersøkelsesplikt' },
      ],
    },
  },
  '§26.3': {
    inline: 'Endres offentlige gebyrer eller avgifter som totalentreprenøren etter kontrakten skal betale etter at han inngav sitt tilbud, kan han påberope dette som endring og skal varsle etter §32.2.',
    konsekvens: 'Preklusjon – manglende varsel etter §32.2 medfører tap av retten til å påberope forholdet som endring. Vederlagsjustering er uten påslag for indirekte kostnader, risiko og fortjeneste.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope sen varsling skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
  },
  '§32.1': {
    inline: 'Mottar totalentreprenøren pålegg uten endringsordre fra person med fullmakt (a, b) eller via arbeidstegninger/beskrivelser (c), skal han iverksette det selv om han mener det er en endring.',
    konsekvens: 'Vil totalentreprenøren påberope at pålegget er en endring, må han varsle etter §32.2 uten ugrunnet opphold. Manglende varsel medfører tap av rett.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope sen varsling skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
    systematikk: {
      label: 'Hva er et «pålegg» (§32.1)?',
      innhold: [
        { ref: 'a)', tekst: 'Pålegg fra person med fullmakt til å gi endringsordre (§31.3)' },
        { ref: 'b)', tekst: 'Pålegg fra person med kontroll-/påleggsfullmakt, gitt under ordinære oppgaver' },
        { ref: 'c)', tekst: 'Arbeidstegninger, arbeidsbeskrivelser eller lignende fra byggherren' },
        { ref: '+', tekst: 'Pålegg fra offentlig myndighet (§32.2 annet ledd)' },
      ],
    },
  },
  '§32.2': {
    inline: 'Mottar totalentreprenøren pålegg uten endringsordre og vil påberope det som endring, skal han varsle byggherren uten ugrunnet opphold.',
    konsekvens: 'Gjør han ikke det, taper han retten til å påberope seg at pålegget innebærer en endring.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope at varselet er for sent skriftlig «uten ugrunnet opphold» – ellers anses varselet gitt i tide.',
    },
  },
  '§32.3': {
    inline: 'Mottar byggherren varsel etter §32.2, skal han besvare det uten ugrunnet opphold ved enten å utstede endringsordre, avslå kravet, eller frafalle pålegget.',
    konsekvens: 'Svarer ikke byggherren uten ugrunnet opphold, anses pålegget å innebære en endring. Ved avslag skal byggherren begrunne avslaget uten ugrunnet opphold.',
    paragraf5: {
      paaberoper: 'TE',
      tekst: 'Totalentreprenøren må påberope passivitet skriftlig «uten ugrunnet opphold» – ellers anses svaret gitt i tide.',
    },
    systematikk: {
      label: 'Svaralternativer (§32.3)',
      innhold: [
        { ref: 'a)', tekst: 'Godta kravet og utstede formell endringsordre (§31.3)' },
        { ref: 'b)', tekst: 'Avvise kravet om at forholdet utgjør en endring' },
        { ref: 'c)', tekst: 'Trekke tilbake pålegget (kun kompensasjon for utført arbeid)' },
        { ref: 'Passivitet', tekst: 'Manglende svar innen rimelig tid medfører at forholdet anses som endring' },
        { ref: 'Begrunnelse', tekst: 'Ved avvisning skal byggherren gi en skriftlig begrunnelse uten ugrunnet opphold' },
      ],
    },
  },

  // ========== FRISTSPOR ==========

  '§33.1': {
    inline: 'Fristforlengelse forutsetter at (1) fremdriften er hindret, og (2) hindringen skyldes det påberopte forholdet (årsakssammenheng).',
    konsekvens: 'Vilkår: Både hindring og årsakssammenheng må påvises. Partene har tapsbegrensningsplikt (§33.5).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '',
    },
    systematikk: {
      label: 'Hvilke forhold gir rett?',
      innhold: [
        { ref: 'a) Endringer', tekst: '§31 (formell EO) og §32 (irregulær) – vederlag etter §34.1.1' },
        { ref: 'b) Svikt/forsinkelse', tekst: 'BHs ytelser (§22-24) – vederlag etter §34.1.2' },
        { ref: 'c) Andre forhold', tekst: 'Sekkepost for byggherrerisiko – vederlag etter §34.1.2' },
      ],
    },
  },
  '§33.3': {
    inline: 'Force majeure er forhold utenfor partenes kontroll, slik som ekstraordinære værforhold, offentlige påbud og forbud, streik, lockout og overenskomstbestemmelser.',
    konsekvens: 'Force majeure gir kun fristforlengelse – ikke vederlagsjustering. Gjelder begge parter og deres kontraktsmedhjelpere.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '',
    },
  },
  '§33.4': {
    inline: 'Totalentreprenøren skal varsle «uten ugrunnet opphold» etter at forholdet oppstår, selv om han ennå ikke kan fremsette et spesifisert krav.',
    konsekvens: 'Krav på fristforlengelse tapes dersom det ikke varsles innen fristen.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope senhet skriftlig «uten ugrunnet opphold» etter mottak – ellers anses varselet gitt i tide.',
    },
    systematikk: {
      label: 'Hva er «forholdet»?',
      innhold: [
        { ref: '§33.1 a)', tekst: 'Endringer (§31, §32)' },
        { ref: '§33.1 b)', tekst: 'Svikt ved BHs ytelser (§22-24) – se også §25.1.2 ("burde") / §25.2 ("måtte")' },
        { ref: '§33.1 c)', tekst: 'Andre forhold byggherren har risikoen for' },
        { ref: '§33.3', tekst: 'Force majeure (kun fristforlengelse, ikke vederlag)' },
      ],
    },
  },
  '§33.5': {
    inline: 'Fristforlengelsen skal svare til den virkning på fremdriften som forholdet har forårsaket, der det blant annet tas hensyn til nødvendig avbrudd og eventuell forskyvning til ugunstigere eller gunstigere årstid. Det skal også tas hensyn til samlet virkning av tidligere varslede forhold som kunne gi rett til fristforlengelse.',
    konsekvens: 'Partene plikter å forebygge og begrense skadevirkningene av en fristforlengelse og samarbeide om tiltak som kan iverksettes (tapsbegrensningsplikt).',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '', // Ingen §5-mekanisme for beregningsregler
    },
  },
  '§33.6.1': {
    inline: 'Når parten har grunnlag for å beregne omfanget, skal han «uten ugrunnet opphold» angi og begrunne antall dager.',
    konsekvens: 'Bare krav på slik fristforlengelse som byggherren «måtte forstå» at han hadde krav på.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope senhet skriftlig «uten ugrunnet opphold» etter mottak – ellers anses kravet gitt i tide.',
    },
    systematikk: {
      label: 'Når har du «beregningsgrunnlag»?',
      innhold: [
        { ref: 'Skjæringstidspunkt', tekst: 'Når du kan beregne virkningen på fremdriften' },
        { ref: 'For sent?', tekst: 'Kun det byggherren «måtte forstå» godkjennes ved for sent varsel' },
      ],
    },
  },
  '§33.6.2': {
    inline: 'Totalentreprenøren skal svare «uten ugrunnet opphold» etter mottak av byggherrens forespørsel – enten (a) angi og begrunne antall dager, eller (b) begrunne hvorfor grunnlaget for å beregne kravet ikke foreligger.',
    konsekvens: 'Krav på fristforlengelse tapes dersom totalentreprenøren ikke gjør noen av delene.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: 'Byggherren må påberope senhet skriftlig «uten ugrunnet opphold» etter mottak – ellers anses svaret gitt i tide.',
    },
  },
  '§33.7': {
    inline: 'Byggherren skal svare «uten ugrunnet opphold» etter mottak av begrunnet krav med angivelse av antall dager.',
    konsekvens: 'Innsigelser mot kravet tapes dersom de ikke fremsettes innen fristen.',
    paragraf5: {
      paaberoper: 'TE',
      tekst: 'Totalentreprenøren må påberope senhet skriftlig «uten ugrunnet opphold» etter mottak – ellers anses svaret gitt i tide.',
    },
  },
  '§33.8': {
    inline: 'Før forsering iverksettes, skal byggherren varsles med angivelse av hva forseringen antas å ville koste.',
    konsekvens: 'Ikke eksplisitt angitt i kontrakten.',
    paragraf5: {
      paaberoper: 'BH',
      tekst: '', // Ingen §5-mekanisme for §33.8
    },
  },
};

export function KontraktsregelInline(props: KontraktsregelInlineProps) {
  const [konsekvensOpen, setKonsekvensOpen] = useState(false);
  const [systematikkOpen, setSystematikkOpen] = useState(false);

  // Bestem innhold basert på modus
  const isCustom = 'custom' in props && props.custom;
  const hjemmelInnhold = !isCustom && props.hjemmel ? HJEMMEL_INNHOLD[props.hjemmel] : null;

  // Custom modus
  if (isCustom) {
    const { inline, hjemmel, konsekvens, accordionLabel } = props.custom;
    const harAccordion = !!konsekvens;

    return (
      <div className="rounded-md border border-pkt-border-subtle bg-pkt-bg-subtle p-4">
        <p className="text-sm text-pkt-text-body">
          {inline}{hjemmel && <span className="text-pkt-text-body-subtle"> ({hjemmel})</span>}
        </p>

        {harAccordion && (
          <Collapsible.Root open={konsekvensOpen} onOpenChange={setKonsekvensOpen} className="mt-3">
            <Collapsible.Trigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-pkt-text-interactive hover:text-pkt-text-interactive-hover transition-colors"
              >
                <ChevronRightIcon
                  className={`h-4 w-4 transition-transform duration-200 ${konsekvensOpen ? 'rotate-90' : ''}`}
                />
                {accordionLabel ?? 'Detaljer'}
              </button>
            </Collapsible.Trigger>

            <Collapsible.Content className="mt-2 pl-5 border-l-2 border-pkt-border-subtle">
              <p className="text-sm text-pkt-text-body whitespace-pre-line">{konsekvens}</p>
            </Collapsible.Content>
          </Collapsible.Root>
        )}
      </div>
    );
  }

  // Fast hjemmel modus
  if (!hjemmelInnhold) {
    return null;
  }

  const visParagraf5 = hjemmelInnhold.paragraf5.tekst.length > 0;
  const harSystematikk = !!hjemmelInnhold.systematikk;

  return (
    <div className="rounded-md border border-pkt-border-subtle bg-pkt-bg-subtle p-4">
      {/* Inline tekst - alltid synlig */}
      <p className="text-sm text-pkt-text-body">
        {hjemmelInnhold.inline} <span className="text-pkt-text-body-subtle">({props.hjemmel})</span>
      </p>

      {/* Accordion for konsekvenser */}
      <Collapsible.Root open={konsekvensOpen} onOpenChange={setKonsekvensOpen} className="mt-3">
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium text-pkt-text-interactive hover:text-pkt-text-interactive-hover transition-colors"
          >
            <ChevronRightIcon
              className={`h-4 w-4 transition-transform duration-200 ${konsekvensOpen ? 'rotate-90' : ''}`}
            />
            Konsekvenser
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content className="mt-2 pl-5 border-l-2 border-pkt-border-subtle">
          <div className="space-y-2 text-sm text-pkt-text-body">
            {/* Konsekvens ved brudd */}
            <p>{hjemmelInnhold.konsekvens}</p>

            {/* §5-mekanismen */}
            {visParagraf5 && (
              <p className="text-pkt-text-body-subtle">
                {hjemmelInnhold.paragraf5.tekst} <span className="font-medium">(§5)</span>
              </p>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      {/* Accordion for systematikk */}
      {harSystematikk && (
        <Collapsible.Root open={systematikkOpen} onOpenChange={setSystematikkOpen} className="mt-2">
          <Collapsible.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-pkt-text-interactive hover:text-pkt-text-interactive-hover transition-colors"
            >
              <ChevronRightIcon
                className={`h-4 w-4 transition-transform duration-200 ${systematikkOpen ? 'rotate-90' : ''}`}
              />
              {hjemmelInnhold.systematikk!.label}
            </button>
          </Collapsible.Trigger>

          <Collapsible.Content className="mt-2 pl-5 border-l-2 border-pkt-border-subtle">
            <dl className="space-y-3 sm:space-y-1 text-sm">
              {hjemmelInnhold.systematikk!.innhold.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:gap-2">
                  <dt className="font-medium text-pkt-text-body-subtle shrink-0">{item.ref}:</dt>
                  <dd className="text-pkt-text-body">{item.tekst}</dd>
                </div>
              ))}
            </dl>
          </Collapsible.Content>
        </Collapsible.Root>
      )}
    </div>
  );
}

/** @deprecated Bruk KontraktsregelInline i stedet */
export const VarslingsregelInline = KontraktsregelInline;
