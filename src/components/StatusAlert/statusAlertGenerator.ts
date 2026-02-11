/**
 * Status Alert Generator
 *
 * Genererer kontekstuelle status-meldinger basert på brukerrolle og saksstatus.
 * Brukes til å vise en alert øverst i saksvisningen som informerer om
 * nåværende situasjon og neste steg.
 *
 * ARKITEKTUR: Rule-based pattern
 * - Hver regel har en condition og en getMessage-funksjon
 * - Reglene evalueres i prioritetsrekkefølge
 * - Første matchende regel returnerer meldingen
 */

import type { SakState, SporStatus } from '../../types/timeline';
import type { AvailableActions } from '../../hooks/useActionPermissions';
import { HOVEDKATEGORI_OPTIONS } from '../../constants/categories';

export type AlertType = 'info' | 'success' | 'warning' | 'action';

export interface StatusAlertMessage {
  /** Alert-type som bestemmer farge/ikon */
  type: AlertType;
  /** Kort tittel som beskriver situasjonen */
  title: string;
  /** Mer detaljert beskrivelse av situasjonen */
  description: string;
  /** Forslag til neste handling (valgfritt) */
  nextStep?: string;
  /** Hvilket spor meldingen gjelder (for highlighting) */
  relatedSpor?: 'grunnlag' | 'vederlag' | 'frist' | null;
}

/** Ekstra kontekst for alert-generering */
export interface AlertContext {
  /** Om det allerede finnes en forseringssak som refererer til denne saken */
  harForseringssak?: boolean;
  /** Om det allerede finnes en endringsordre som refererer til denne saken */
  harEndringsordre?: boolean;
}

/** Intern regel-type */
interface StatusAlertRule {
  id: string;
  condition: (state: SakState, actions: AvailableActions, context: AlertContext) => boolean;
  getMessage: (state: SakState, actions: AvailableActions, context: AlertContext) => StatusAlertMessage;
}

// ========== HJELPEFUNKSJONER ==========

function getKategoriNavn(kategoriId: string | undefined): string {
  if (!kategoriId) return 'et endringsforhold';
  const kategori = HOVEDKATEGORI_OPTIONS.find((k) => k.value === kategoriId);
  return kategori?.label.toLowerCase() ?? 'et endringsforhold';
}

function erVenterPaaSvar(status: SporStatus | undefined): boolean {
  return status === 'sendt' || status === 'under_behandling';
}

function harFaattRespons(status: SporStatus | undefined): boolean {
  return status === 'godkjent' || status === 'delvis_godkjent' || status === 'avslatt';
}

function erTrukket(status: SporStatus | undefined): boolean {
  return status === 'trukket';
}

function erGrunnlagSendt(state: SakState): boolean {
  return erVenterPaaSvar(state.grunnlag.status) || harFaattRespons(state.grunnlag.status);
}

function erForceMajeure(state: SakState): boolean {
  return state.grunnlag.hovedkategori === 'FORCE_MAJEURE';
}

function formatBelop(belop: number | undefined): string {
  return belop?.toLocaleString('nb-NO') ?? '–';
}

// ========== ENTREPRENØR-REGLER ==========

const entreprenorRules: StatusAlertRule[] = [
  // 1. Saken er i utkast - oppfordre til å sende grunnlag
  {
    id: 'te-utkast',
    condition: (state, actions) =>
      state.overordnet_status === 'UTKAST' && actions.canSendGrunnlag,
    getMessage: () => ({
      type: 'action',
      title: 'Saken er i utkast',
      description: 'Start med å varsle byggherre om endringsforholdet for å registrere kravet formelt.',
      relatedSpor: 'grunnlag',
    }),
  },

  // 2. Force Majeure med mulighet for fristforlengelse
  {
    id: 'te-force-majeure-frist',
    condition: (state, actions) =>
      erGrunnlagSendt(state) &&
      erForceMajeure(state) &&
      state.frist.status === 'utkast' &&
      actions.canSendFrist,
    getMessage: (state) => {
      const { grunnlag } = state;
      const statusTekst =
        grunnlag.bh_resultat === 'godkjent'
          ? 'Endringsforholdet er godkjent.'
          : 'Endringsforholdet er varslet.';
      return {
        type: 'action',
        title: 'Neste steg: Krev fristforlengelse',
        description: `${statusTekst} Ved force majeure kan du kreve fristforlengelse.`,
        relatedSpor: 'frist',
      };
    },
  },

  // 3. Begge krav kan sendes (vederlag og frist)
  {
    id: 'te-begge-krav',
    condition: (state, actions) =>
      erGrunnlagSendt(state) &&
      !erForceMajeure(state) &&
      state.vederlag.status === 'utkast' &&
      state.frist.status === 'utkast' &&
      actions.canSendVederlag &&
      actions.canSendFrist,
    getMessage: (state) => {
      const { grunnlag } = state;
      const statusTekst =
        grunnlag.bh_resultat === 'godkjent'
          ? 'Endringsforholdet er godkjent.'
          : 'Endringsforholdet er varslet til byggherre.';
      return {
        type: 'action',
        title: 'Neste steg: Spesifiser kravet',
        description: `${statusTekst} Du kan nå kreve konkret vederlagsjustering og/eller fristforlengelse.`,
        relatedSpor: 'vederlag',
      };
    },
  },

  // 4. Kun vederlag kan sendes
  {
    id: 'te-kun-vederlag',
    condition: (state, actions) =>
      erGrunnlagSendt(state) &&
      !erForceMajeure(state) &&
      state.vederlag.status === 'utkast' &&
      actions.canSendVederlag,
    getMessage: (state) => {
      const fristSendt = erVenterPaaSvar(state.frist.status) || harFaattRespons(state.frist.status);
      return {
        type: 'action',
        title: 'Neste steg: Krev vederlagsjustering',
        description: fristSendt
          ? 'Fristforlengelse er sendt. Du kan også kreve vederlagsjustering.'
          : 'Du har ikke sendt krav om vederlagsjustering ennå.',
        relatedSpor: 'vederlag',
      };
    },
  },

  // 5. Kun frist kan sendes
  {
    id: 'te-kun-frist',
    condition: (state, actions) =>
      erGrunnlagSendt(state) &&
      state.frist.status === 'utkast' &&
      actions.canSendFrist,
    getMessage: (state) => {
      const vederlagSendt = erVenterPaaSvar(state.vederlag.status) || harFaattRespons(state.vederlag.status);
      return {
        type: 'action',
        title: 'Neste steg: Krev fristforlengelse',
        description: vederlagSendt
          ? 'Vederlagsjustering er sendt. Du kan også kreve fristforlengelse.'
          : 'Du har ikke sendt krav om fristforlengelse ennå.',
        relatedSpor: 'frist',
      };
    },
  },

  // 6. Grunnlag avslått med subsidiære krav
  {
    id: 'te-grunnlag-avslatt-subsidiaer',
    condition: (state) =>
      state.grunnlag.bh_resultat === 'avslatt' &&
      ((state.vederlag.subsidiaer_triggers?.length ?? 0) > 0 ||
        (state.frist.subsidiaer_triggers?.length ?? 0) > 0),
    getMessage: () => ({
      type: 'warning',
      title: 'Endringsforholdet avslått – subsidiær behandling',
      description: 'Byggherre har avslått endringsforholdet. Eventuelle krav behandles subsidiært.',
      relatedSpor: 'grunnlag',
    }),
  },

  // 7. Grunnlag avslått uten subsidiære krav
  {
    id: 'te-grunnlag-avslatt',
    condition: (state, actions) =>
      state.grunnlag.bh_resultat === 'avslatt' && actions.canUpdateGrunnlag,
    getMessage: () => ({
      type: 'warning',
      title: 'Endringsforholdet avslått',
      description: 'Byggherre har avslått endringsforholdet. Du kan oppdatere med mer dokumentasjon eller trekke kravet.',
      relatedSpor: 'grunnlag',
    }),
  },

  // 8. Grunnlag trukket (automatisk pga alle krav trukket)
  {
    id: 'te-grunnlag-trukket-alle-krav',
    condition: (state) => erTrukket(state.grunnlag.status) && state.grunnlag.trukket_alle_krav === true,
    getMessage: () => ({
      type: 'info',
      title: 'Saken avsluttet',
      description: 'Alle krav er trukket tilbake. Ansvarsgrunnlaget ble automatisk trukket siden det ikke lenger finnes aktive krav.',
      relatedSpor: null,
    }),
  },

  // 8b. Grunnlag trukket (manuelt)
  {
    id: 'te-grunnlag-trukket',
    condition: (state) => erTrukket(state.grunnlag.status),
    getMessage: () => ({
      type: 'info',
      title: 'Endringsforholdet trukket',
      description: 'Du har trukket kravet. Saken er avsluttet.',
      relatedSpor: 'grunnlag',
    }),
  },

  // 9. Vederlag trukket, frist fortsatt aktiv
  {
    id: 'te-vederlag-trukket',
    condition: (state) =>
      erTrukket(state.vederlag.status) &&
      !erTrukket(state.frist.status) &&
      state.frist.status !== 'ikke_relevant',
    getMessage: () => ({
      type: 'info',
      title: 'Krav om vederlagsjustering trukket',
      description: 'Du har trukket kravet om vederlagsjustering. Krav om fristforlengelse behandles fortsatt.',
      relatedSpor: 'vederlag',
    }),
  },

  // 10. Frist trukket, vederlag fortsatt aktiv
  {
    id: 'te-frist-trukket',
    condition: (state) =>
      erTrukket(state.frist.status) &&
      !erTrukket(state.vederlag.status) &&
      state.vederlag.status !== 'ikke_relevant',
    getMessage: () => ({
      type: 'info',
      title: 'Krav om fristforlengelse trukket',
      description: 'Du har trukket kravet om fristforlengelse. Krav om vederlagsjustering behandles fortsatt.',
      relatedSpor: 'frist',
    }),
  },

  // 11. Vederlag avslått
  {
    id: 'te-vederlag-avslatt',
    condition: (state, actions) =>
      state.vederlag.bh_resultat === 'avslatt' && actions.canUpdateVederlag,
    getMessage: () => ({
      type: 'warning',
      title: 'Vederlagsjustering avslått',
      description: 'Byggherre har avslått kravet. Du kan oppdatere med justert beløp eller dokumentasjon.',
      relatedSpor: 'vederlag',
    }),
  },

  // 12. Vederlag delvis godkjent
  {
    id: 'te-vederlag-delvis',
    condition: (state, actions) =>
      state.vederlag.bh_resultat === 'delvis_godkjent' && actions.canUpdateVederlag,
    getMessage: (state) => {
      const { vederlag } = state;
      const krevd = vederlag.belop_direkte ?? vederlag.kostnads_overslag ?? 0;
      const godkjent = vederlag.godkjent_belop ?? 0;
      const differanse = krevd - godkjent;
      return {
        type: 'info',
        title: 'Vederlagsjustering delvis godkjent',
        description: `Godkjent ${formatBelop(godkjent)} kr av ${formatBelop(krevd)} kr (differanse: ${formatBelop(differanse)} kr).`,
        relatedSpor: 'vederlag',
      };
    },
  },

  // 13. Frist avslått med forsering-mulighet
  {
    id: 'te-frist-avslatt-forsering',
    condition: (state, actions, context) =>
      state.frist.bh_resultat === 'avslatt' &&
      actions.canSendForsering &&
      !context.harForseringssak,
    getMessage: () => ({
      type: 'warning',
      title: 'Fristforlengelse avslått',
      description: 'Byggherre har avslått kravet. Du kan vurdere forsering (§33.8) for å kreve forseringskostnadene dekket.',
      relatedSpor: 'frist',
    }),
  },

  // 14. Frist avslått uten forsering-mulighet
  {
    id: 'te-frist-avslatt',
    condition: (state, actions) =>
      state.frist.bh_resultat === 'avslatt' && actions.canUpdateFrist,
    getMessage: (_state, _actions, context) => ({
      type: 'warning',
      title: 'Fristforlengelse avslått',
      description: context.harForseringssak
        ? 'Byggherre har avslått kravet. Forseringssak er opprettet.'
        : 'Byggherre har avslått kravet. Du kan oppdatere med mer dokumentasjon.',
      relatedSpor: 'frist',
    }),
  },

  // 15. Frist delvis godkjent med forsering-mulighet
  {
    id: 'te-frist-delvis-forsering',
    condition: (state, actions, context) => {
      const { frist } = state;
      const godkjentDager = frist.godkjent_dager ?? 0;
      const krevdDager = frist.krevd_dager ?? 0;
      return (
        frist.bh_resultat === 'delvis_godkjent' &&
        actions.canSendForsering &&
        godkjentDager < krevdDager &&
        !context.harForseringssak
      );
    },
    getMessage: (state) => {
      const { frist } = state;
      return {
        type: 'info',
        title: 'Fristforlengelse delvis godkjent',
        description: `Godkjent ${frist.godkjent_dager ?? 0} av ${frist.krevd_dager ?? 0} dager. Du kan vurdere forsering for resterende.`,
        relatedSpor: 'frist',
      };
    },
  },

  // 16. Venter på byggherre
  {
    id: 'te-venter-bh',
    condition: (state) => {
      const { grunnlag, vederlag, frist } = state;
      const grunnlagSendt = erVenterPaaSvar(grunnlag.status) || harFaattRespons(grunnlag.status);
      const vederlagSendt = erVenterPaaSvar(vederlag.status) || harFaattRespons(vederlag.status);
      const fristSendt = erVenterPaaSvar(frist.status) || harFaattRespons(frist.status);

      if (!grunnlagSendt || grunnlag.bh_resultat) return false;

      const ventePå: string[] = [];
      if (!grunnlag.bh_resultat) ventePå.push('endringsforholdet');
      if (vederlagSendt && !vederlag.bh_resultat) ventePå.push('vederlagsjustering');
      if (fristSendt && !frist.bh_resultat) ventePå.push('fristforlengelse');

      return ventePå.length > 0;
    },
    getMessage: (state) => {
      const { grunnlag, vederlag, frist } = state;
      const vederlagSendt = erVenterPaaSvar(vederlag.status) || harFaattRespons(vederlag.status);
      const fristSendt = erVenterPaaSvar(frist.status) || harFaattRespons(frist.status);

      const ventePå: string[] = [];
      if (!grunnlag.bh_resultat) ventePå.push('endringsforholdet');
      if (vederlagSendt && !vederlag.bh_resultat) ventePå.push('vederlagsjustering');
      if (fristSendt && !frist.bh_resultat) ventePå.push('fristforlengelse');

      const relatedSpor =
        ventePå[0] === 'endringsforholdet'
          ? 'grunnlag'
          : ventePå[0] === 'vederlagsjustering'
          ? 'vederlag'
          : 'frist';

      return {
        type: 'info',
        title: 'Venter på byggherre',
        description: `Venter på respons på ${ventePå.join(' og ')}.`,
        relatedSpor,
      };
    },
  },

  // 17. Alle krav fullstendig godkjent
  {
    id: 'te-alle-godkjent',
    condition: (state) => {
      const { grunnlag, vederlag, frist } = state;
      return (
        harFaattRespons(grunnlag.status) &&
        (vederlag.status === 'ikke_relevant' || harFaattRespons(vederlag.status)) &&
        (frist.status === 'ikke_relevant' || harFaattRespons(frist.status)) &&
        grunnlag.bh_resultat === 'godkjent' &&
        (vederlag.status === 'ikke_relevant' || vederlag.bh_resultat === 'godkjent') &&
        (frist.status === 'ikke_relevant' || frist.bh_resultat === 'godkjent')
      );
    },
    getMessage: (_state, _actions, context) => ({
      type: 'success',
      title: 'Krav fullstendig godkjent',
      description: context.harEndringsordre
        ? 'Alle krav er godkjent. Endringsordre er utstedt.'
        : 'Alle krav er godkjent. Venter på formell endringsordre fra byggherre.',
      relatedSpor: null,
    }),
  },

  // 18. Alle krav behandlet (men ikke alle godkjent)
  {
    id: 'te-alle-behandlet',
    condition: (state, actions) => {
      const { grunnlag, vederlag, frist } = state;
      return (
        harFaattRespons(grunnlag.status) &&
        (vederlag.status === 'ikke_relevant' || harFaattRespons(vederlag.status)) &&
        (frist.status === 'ikke_relevant' || harFaattRespons(frist.status)) &&
        !actions.canUpdateGrunnlag &&
        !actions.canUpdateVederlag &&
        !actions.canUpdateFrist
      );
    },
    getMessage: () => ({
      type: 'info',
      title: 'Krav behandlet',
      description: 'Alle krav har fått respons fra byggherre.',
      relatedSpor: null,
    }),
  },

  // 19. Under forhandling
  {
    id: 'te-under-forhandling',
    condition: (state) => state.overordnet_status === 'UNDER_FORHANDLING',
    getMessage: () => ({
      type: 'info',
      title: 'Under forhandling',
      description: 'Du har oppdatert kravet. Venter på ny respons fra byggherre.',
      relatedSpor: null,
    }),
  },
];

// ========== BYGGHERRE-REGLER ==========

const byggherreRules: StatusAlertRule[] = [
  // 1. Flere krav venter på respons
  {
    id: 'bh-flere-krav',
    condition: (_state, actions) => {
      const kravSomVenter: string[] = [];
      if (actions.canRespondToGrunnlag) kravSomVenter.push('endringsforhold');
      if (actions.canRespondToVederlag) kravSomVenter.push('vederlagsjustering');
      if (actions.canRespondToFrist) kravSomVenter.push('fristforlengelse');
      return kravSomVenter.length > 1;
    },
    getMessage: (state, actions) => {
      const kravSomVenter: string[] = [];
      if (actions.canRespondToGrunnlag) kravSomVenter.push('endringsforhold');
      if (actions.canRespondToVederlag) kravSomVenter.push('vederlagsjustering');
      if (actions.canRespondToFrist) kravSomVenter.push('fristforlengelse');

      const { vederlag, frist } = state;
      const belopTekst = vederlag.belop_direkte ?? vederlag.kostnads_overslag;
      const dagerTekst = frist.krevd_dager;

      let beskrivelse = `${kravSomVenter.length} krav venter på din vurdering`;
      if (belopTekst && dagerTekst) {
        beskrivelse += `: ${formatBelop(belopTekst)} kr og ${dagerTekst} dager`;
      }
      beskrivelse += '.';

      const relatedSpor =
        kravSomVenter[0] === 'endringsforhold'
          ? 'grunnlag'
          : kravSomVenter[0] === 'vederlagsjustering'
          ? 'vederlag'
          : 'frist';

      return {
        type: 'action',
        title: 'Flere krav mottatt',
        description: beskrivelse,
        relatedSpor,
      };
    },
  },

  // 2. Nytt grunnlag mottatt
  {
    id: 'bh-nytt-grunnlag',
    condition: (_state, actions) => actions.canRespondToGrunnlag,
    getMessage: (state) => {
      const { grunnlag } = state;
      const kategoriNavn = getKategoriNavn(grunnlag.hovedkategori);
      const kravType = erForceMajeure(state)
        ? 'fristforlengelse'
        : 'vederlagsjustering og/eller fristforlengelse';
      return {
        type: 'action',
        title: 'Nytt endringsforhold mottatt',
        description: `Entreprenør har varslet om ${kategoriNavn} som kan gi grunnlag for ${kravType}.`,
        relatedSpor: 'grunnlag',
      };
    },
  },

  // 3. Entreprenør har oppdatert grunnlag
  {
    id: 'bh-grunnlag-oppdatert',
    condition: (state) => {
      const { grunnlag } = state;
      return (
        grunnlag.bh_resultat !== undefined &&
        grunnlag.bh_respondert_versjon !== undefined &&
        grunnlag.bh_respondert_versjon < Math.max(0, grunnlag.antall_versjoner - 1)
      );
    },
    getMessage: () => ({
      type: 'action',
      title: 'Oppdatert endringsforhold',
      description: 'Entreprenør har oppdatert endringsforholdet etter din respons.',
      relatedSpor: 'grunnlag',
    }),
  },

  // 4. Kun grunnlag sendt, venter på krav fra entreprenør
  {
    id: 'bh-venter-krav',
    condition: (state) => {
      const { grunnlag, vederlag, frist } = state;
      return (
        erVenterPaaSvar(grunnlag.status) &&
        !grunnlag.bh_resultat &&
        vederlag.status === 'utkast' &&
        frist.status === 'utkast'
      );
    },
    getMessage: (state) => {
      const { grunnlag } = state;
      const kategoriNavn = getKategoriNavn(grunnlag.hovedkategori);
      const kravType = erForceMajeure(state) ? 'fristforlengelse' : 'vederlagsjustering/fristforlengelse';
      return {
        type: 'info',
        title: 'Endringsforhold mottatt',
        description: `Entreprenør har varslet om ${kategoriNavn}. Avventer at entreprenør spesifiserer ${kravType}.`,
        relatedSpor: 'grunnlag',
      };
    },
  },

  // 5. Nytt vederlagskrav mottatt
  {
    id: 'bh-nytt-vederlag',
    condition: (_state, actions) => actions.canRespondToVederlag,
    getMessage: (state) => {
      const { vederlag } = state;
      const belop = vederlag.belop_direkte ?? vederlag.kostnads_overslag;
      return {
        type: 'action',
        title: 'Vederlagsjustering mottatt',
        description: `Entreprenør krever ${formatBelop(belop)} kr.`,
        relatedSpor: 'vederlag',
      };
    },
  },

  // 6. Nytt fristkrav mottatt
  {
    id: 'bh-nytt-frist',
    condition: (_state, actions) => actions.canRespondToFrist,
    getMessage: (state) => ({
      type: 'action',
      title: 'Fristforlengelse mottatt',
      description: `Entreprenør krever ${state.frist.krevd_dager ?? '–'} dagers fristforlengelse.`,
      relatedSpor: 'frist',
    }),
  },

  // 7. Entreprenør har oppdatert vederlag
  {
    id: 'bh-vederlag-oppdatert',
    condition: (state) => {
      const { vederlag } = state;
      return (
        vederlag.bh_resultat !== undefined &&
        vederlag.bh_respondert_versjon !== undefined &&
        vederlag.bh_respondert_versjon < Math.max(0, vederlag.antall_versjoner - 1)
      );
    },
    getMessage: () => ({
      type: 'action',
      title: 'Oppdatert vederlagskrav',
      description: 'Entreprenør har oppdatert kravet om vederlagsjustering.',
      relatedSpor: 'vederlag',
    }),
  },

  // 8. Entreprenør har oppdatert frist
  {
    id: 'bh-frist-oppdatert',
    condition: (state) => {
      const { frist } = state;
      return (
        frist.bh_resultat !== undefined &&
        frist.bh_respondert_versjon !== undefined &&
        frist.bh_respondert_versjon < Math.max(0, frist.antall_versjoner - 1)
      );
    },
    getMessage: () => ({
      type: 'action',
      title: 'Oppdatert fristkrav',
      description: 'Entreprenør har oppdatert kravet om fristforlengelse.',
      relatedSpor: 'frist',
    }),
  },

  // 9. Grunnlag behandlet, venter på krav
  {
    id: 'bh-grunnlag-behandlet-venter',
    condition: (state) => {
      const { grunnlag, vederlag, frist } = state;
      return (
        harFaattRespons(grunnlag.status) &&
        vederlag.status === 'utkast' &&
        frist.status === 'utkast'
      );
    },
    getMessage: (state) => {
      const { grunnlag } = state;
      const resultatTekst =
        grunnlag.bh_resultat === 'godkjent'
          ? 'godkjent'
          : 'avslått';
      const kravType = erForceMajeure(state) ? 'fristforlengelse' : 'vederlagsjustering/fristforlengelse';
      return {
        type: 'info',
        title: `Endringsforhold ${resultatTekst}`,
        description: `Venter på at entreprenør spesifiserer ${kravType}.`,
        relatedSpor: null,
      };
    },
  },

  // 10. Kan utstede endringsordre
  // Krever at minst ett krav (vederlag/frist) faktisk er sendt og behandlet.
  // Ellers venter vi fortsatt på at TE spesifiserer krav.
  {
    id: 'bh-kan-utstede-eo',
    condition: (state, actions, context) => {
      if (!state.kan_utstede_eo || !actions.canIssueEO || context.harEndringsordre) {
        return false;
      }
      // Sjekk at minst ett krav har blitt sendt (ikke bare utkast/ikke_relevant)
      const { vederlag, frist } = state;
      const vederlagSendt = vederlag.status !== 'utkast' && vederlag.status !== 'ikke_relevant';
      const fristSendt = frist.status !== 'utkast' && frist.status !== 'ikke_relevant';
      return vederlagSendt || fristSendt;
    },
    getMessage: () => ({
      type: 'success',
      title: 'Klar for endringsordre',
      description: 'Alle krav er behandlet. Du kan nå utstede formell endringsordre.',
      relatedSpor: null,
    }),
  },

  // 11. Alle krav behandlet
  {
    id: 'bh-alle-behandlet',
    condition: (state) => {
      const { grunnlag, vederlag, frist } = state;
      return (
        harFaattRespons(grunnlag.status) &&
        (vederlag.status === 'ikke_relevant' || harFaattRespons(vederlag.status) || erTrukket(vederlag.status)) &&
        (frist.status === 'ikke_relevant' || harFaattRespons(frist.status) || erTrukket(frist.status))
      );
    },
    getMessage: () => ({
      type: 'success',
      title: 'Alle krav behandlet',
      description: 'Du har gitt respons på alle mottatte krav.',
      relatedSpor: null,
    }),
  },

  // 12. Venter på at entreprenør sender flere krav
  {
    id: 'bh-venter-flere-krav',
    condition: (state) => {
      const { grunnlag, vederlag, frist } = state;
      if (!harFaattRespons(grunnlag.status)) return false;

      const venterPå: string[] = [];
      if (vederlag.status === 'utkast' && !erForceMajeure(state)) venterPå.push('vederlagsjustering');
      if (frist.status === 'utkast') venterPå.push('fristforlengelse');

      return venterPå.length > 0;
    },
    getMessage: (state) => {
      const { vederlag, frist } = state;
      const venterPå: string[] = [];
      if (vederlag.status === 'utkast' && !erForceMajeure(state)) venterPå.push('vederlagsjustering');
      if (frist.status === 'utkast') venterPå.push('fristforlengelse');

      return {
        type: 'info',
        title: 'Venter på entreprenør',
        description: `Entreprenør har ikke sendt krav om ${venterPå.join(' eller ')} ennå.`,
        relatedSpor: null,
      };
    },
  },
];

// ========== REGELMOTOR ==========

function evaluateRules(
  rules: StatusAlertRule[],
  state: SakState,
  actions: AvailableActions,
  context: AlertContext
): StatusAlertMessage | null {
  for (const rule of rules) {
    if (rule.condition(state, actions, context)) {
      return rule.getMessage(state, actions, context);
    }
  }
  return null;
}

// ========== HOVEDFUNKSJON ==========

/**
 * Hovedfunksjon: Generer status-melding basert på rolle og saksstatus
 *
 * @param state - Nåværende saksstatus
 * @param userRole - Brukerens rolle (TE eller BH)
 * @param actions - Tilgjengelige handlinger
 * @param context - Ekstra kontekst (eksisterende forsering/endringsordre)
 * @returns StatusAlertMessage eller null hvis ingen relevant melding
 */
export function generateStatusAlert(
  state: SakState,
  userRole: 'TE' | 'BH',
  actions: AvailableActions,
  context: AlertContext = {}
): StatusAlertMessage | null {
  // Ikke vis alert for lukkede saker
  if (state.overordnet_status === 'LUKKET' || state.overordnet_status === 'LUKKET_TRUKKET') {
    return null;
  }

  // Omforent sak har egen melding
  if (state.overordnet_status === 'OMFORENT') {
    return {
      type: 'success',
      title: 'Saken er avsluttet',
      description: 'Partene har kommet til enighet.',
      relatedSpor: null,
    };
  }

  const rules = userRole === 'TE' ? entreprenorRules : byggherreRules;
  return evaluateRules(rules, state, actions, context);
}

// Eksporter for testing
export const _testExports = {
  entreprenorRules,
  byggherreRules,
  evaluateRules,
  erVenterPaaSvar,
  harFaattRespons,
  erTrukket,
  erGrunnlagSendt,
  erForceMajeure,
  getKategoriNavn,
};
