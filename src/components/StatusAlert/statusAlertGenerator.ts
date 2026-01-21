/**
 * Status Alert Generator
 *
 * Genererer kontekstuelle status-meldinger basert på brukerrolle og saksstatus.
 * Brukes til å vise en alert øverst i saksvisningen som informerer om
 * nåværende situasjon og neste steg.
 */

import type { SakState, SporStatus } from '../../types/timeline';
import type { AvailableActions } from '../../hooks/useActionPermissions';

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

/**
 * Sjekk om et spor er i "venter på svar"-tilstand
 */
function erVenterPaaSvar(status: SporStatus | undefined): boolean {
  return status === 'sendt' || status === 'under_behandling';
}

/**
 * Sjekk om et spor har fått respons
 */
function harFaattRespons(status: SporStatus | undefined): boolean {
  return (
    status === 'godkjent' ||
    status === 'delvis_godkjent' ||
    status === 'avslatt'
  );
}

/**
 * Generer status-melding for totalentreprenør (TE)
 */
function generateTEMessage(
  state: SakState,
  actions: AvailableActions
): StatusAlertMessage | null {
  const { grunnlag, vederlag, frist, overordnet_status } = state;

  // 1. Saken er helt ny - oppfordre til å sende grunnlag
  if (overordnet_status === 'UTKAST' && actions.canSendGrunnlag) {
    return {
      type: 'action',
      title: 'Saken er i utkast',
      description: 'Start med å varsle byggherre om endringsforholdet.',
      nextStep: 'Send grunnlag for å registrere kravet formelt.',
      relatedSpor: 'grunnlag',
    };
  }

  // 2. Grunnlag sendt, venter på BH-respons
  if (
    erVenterPaaSvar(grunnlag.status) &&
    !grunnlag.bh_resultat
  ) {
    return {
      type: 'info',
      title: 'Venter på byggherre',
      description: 'Grunnlaget er sendt og avventer respons fra byggherre.',
      nextStep: 'Du vil få beskjed når byggherre har vurdert kravet.',
      relatedSpor: 'grunnlag',
    };
  }

  // 3. Grunnlag godkjent - oppfordre til å sende vederlag/frist
  if (grunnlag.bh_resultat === 'godkjent' || grunnlag.bh_resultat === 'delvis_godkjent') {
    const manglerVederlag = vederlag.status === 'utkast' && actions.canSendVederlag;
    const manglerFrist = frist.status === 'utkast' && actions.canSendFrist;
    const erForceMajeure = grunnlag.hovedkategori === 'FORCE_MAJEURE';

    if (manglerVederlag && manglerFrist) {
      return {
        type: 'action',
        title: 'Grunnlag godkjent',
        description: `Byggherre har ${grunnlag.bh_resultat === 'delvis_godkjent' ? 'delvis ' : ''}godkjent grunnlaget.`,
        nextStep: 'Send krav om vederlag og/eller fristforlengelse.',
        relatedSpor: 'vederlag',
      };
    }

    if (manglerVederlag && !erForceMajeure) {
      return {
        type: 'action',
        title: 'Mangler vederlagskrav',
        description: 'Grunnlaget er godkjent, men du har ikke sendt krav om vederlag.',
        nextStep: 'Send vederlagskrav for å kreve kompensasjon.',
        relatedSpor: 'vederlag',
      };
    }

    if (manglerFrist) {
      return {
        type: 'action',
        title: 'Mangler fristkrav',
        description: 'Grunnlaget er godkjent, men du har ikke sendt krav om fristforlengelse.',
        nextStep: 'Send fristkrav hvis du trenger mer tid.',
        relatedSpor: 'frist',
      };
    }
  }

  // 4. Grunnlag avslått - informer om muligheter
  if (grunnlag.bh_resultat === 'avslatt') {
    if (actions.canUpdateGrunnlag) {
      return {
        type: 'warning',
        title: 'Grunnlag avslått',
        description: 'Byggherre har avslått grunnlaget.',
        nextStep: 'Du kan oppdatere grunnlaget med mer dokumentasjon eller trekke kravet.',
        relatedSpor: 'grunnlag',
      };
    }
  }

  // 5. Vederlag/frist sendt, venter på respons
  if (erVenterPaaSvar(vederlag.status) && !vederlag.bh_resultat) {
    return {
      type: 'info',
      title: 'Venter på vederlagsrespons',
      description: 'Vederlagskravet er sendt og avventer respons fra byggherre.',
      relatedSpor: 'vederlag',
    };
  }

  if (erVenterPaaSvar(frist.status) && !frist.bh_resultat) {
    return {
      type: 'info',
      title: 'Venter på fristrespons',
      description: 'Fristkravet er sendt og avventer respons fra byggherre.',
      relatedSpor: 'frist',
    };
  }

  // 6. Vederlag/frist avslått eller delvis godkjent
  if (vederlag.bh_resultat === 'avslatt' && actions.canUpdateVederlag) {
    return {
      type: 'warning',
      title: 'Vederlagskrav avslått',
      description: 'Byggherre har avslått vederlagskravet.',
      nextStep: 'Du kan oppdatere kravet med justert beløp eller dokumentasjon.',
      relatedSpor: 'vederlag',
    };
  }

  if (vederlag.bh_resultat === 'delvis_godkjent' && actions.canUpdateVederlag) {
    return {
      type: 'info',
      title: 'Vederlag delvis godkjent',
      description: `Byggherre har godkjent ${state.vederlag.godkjent_belop?.toLocaleString('nb-NO')} kr.`,
      nextStep: 'Du kan oppdatere kravet hvis du mener differansen bør dekkes.',
      relatedSpor: 'vederlag',
    };
  }

  if (frist.bh_resultat === 'avslatt' && actions.canSendForsering) {
    return {
      type: 'warning',
      title: 'Fristkrav avslått',
      description: 'Byggherre har avslått fristkravet.',
      nextStep: 'Du kan vurdere forsering (§33.8) for å kreve dagmulktkompensasjon.',
      relatedSpor: 'frist',
    };
  }

  if (frist.bh_resultat === 'delvis_godkjent') {
    const godkjentDager = frist.godkjent_dager ?? 0;
    const krevdDager = frist.krevd_dager ?? 0;
    if (actions.canSendForsering && godkjentDager < krevdDager) {
      return {
        type: 'info',
        title: 'Frist delvis godkjent',
        description: `Byggherre har godkjent ${godkjentDager} av ${krevdDager} dager.`,
        nextStep: 'Du kan vurdere forsering for resterende dager.',
        relatedSpor: 'frist',
      };
    }
  }

  // 7. Alle krav behandlet og godkjent - suksess!
  if (
    harFaattRespons(grunnlag.status) &&
    (vederlag.status === 'ikke_relevant' || harFaattRespons(vederlag.status)) &&
    (frist.status === 'ikke_relevant' || harFaattRespons(frist.status))
  ) {
    const alleGodkjent =
      grunnlag.bh_resultat === 'godkjent' &&
      (vederlag.status === 'ikke_relevant' || vederlag.bh_resultat === 'godkjent') &&
      (frist.status === 'ikke_relevant' || frist.bh_resultat === 'godkjent');

    if (alleGodkjent) {
      return {
        type: 'success',
        title: 'Krav fullstendig godkjent',
        description: 'Alle krav er godkjent av byggherre.',
        nextStep: 'Vent på at byggherre utsteder formell endringsordre.',
        relatedSpor: null,
      };
    }

    // Noe ble godkjent, noe avslått
    return {
      type: 'info',
      title: 'Krav behandlet',
      description: 'Alle krav har fått respons fra byggherre.',
      nextStep: 'Gjennomgå resultatet og vurder om du vil oppdatere avslåtte krav.',
      relatedSpor: null,
    };
  }

  // 8. Under forhandling
  if (overordnet_status === 'UNDER_FORHANDLING') {
    return {
      type: 'info',
      title: 'Under forhandling',
      description: 'Du har oppdatert kravet. Venter på ny respons fra byggherre.',
      relatedSpor: null,
    };
  }

  return null;
}

/**
 * Generer status-melding for byggherre (BH)
 */
function generateBHMessage(
  state: SakState,
  actions: AvailableActions
): StatusAlertMessage | null {
  const { grunnlag, vederlag, frist, kan_utstede_eo } = state;

  // 1. Nytt grunnlag mottatt - trenger respons
  if (actions.canRespondToGrunnlag) {
    return {
      type: 'action',
      title: 'Nytt endringsforhold mottatt',
      description: 'Entreprenør har varslet om et endringsforhold som krever din vurdering.',
      nextStep: 'Vurder grunnlaget og gi din respons.',
      relatedSpor: 'grunnlag',
    };
  }

  // 2. TE har oppdatert grunnlag - trenger ny vurdering
  if (
    grunnlag.bh_resultat &&
    grunnlag.bh_respondert_versjon !== undefined &&
    grunnlag.bh_respondert_versjon < Math.max(0, grunnlag.antall_versjoner - 1)
  ) {
    return {
      type: 'action',
      title: 'Oppdatert grunnlag',
      description: 'Entreprenør har oppdatert grunnlaget etter din respons.',
      nextStep: 'Vurder det oppdaterte grunnlaget.',
      relatedSpor: 'grunnlag',
    };
  }

  // 3. Venter på at TE sender krav
  if (
    harFaattRespons(grunnlag.status) &&
    vederlag.status === 'utkast' &&
    frist.status === 'utkast'
  ) {
    const resultatTekst =
      grunnlag.bh_resultat === 'godkjent'
        ? 'godkjent'
        : grunnlag.bh_resultat === 'delvis_godkjent'
        ? 'delvis godkjent'
        : 'avslått';
    return {
      type: 'info',
      title: `Grunnlag ${resultatTekst}`,
      description: 'Venter på at entreprenør sender vederlag- og/eller fristkrav.',
      relatedSpor: null,
    };
  }

  // 4. Nytt vederlagskrav mottatt
  if (actions.canRespondToVederlag) {
    return {
      type: 'action',
      title: 'Vederlagskrav mottatt',
      description: `Entreprenør krever ${
        (vederlag.belop_direkte ?? vederlag.kostnads_overslag)?.toLocaleString('nb-NO') ?? '–'
      } kr i vederlag.`,
      nextStep: 'Vurder kravet og gi din respons.',
      relatedSpor: 'vederlag',
    };
  }

  // 5. Nytt fristkrav mottatt
  if (actions.canRespondToFrist) {
    return {
      type: 'action',
      title: 'Fristkrav mottatt',
      description: `Entreprenør krever ${frist.krevd_dager ?? '–'} dagers fristforlengelse.`,
      nextStep: 'Vurder kravet og gi din respons.',
      relatedSpor: 'frist',
    };
  }

  // 6. TE har oppdatert vederlag/frist - trenger ny vurdering
  if (
    vederlag.bh_resultat &&
    vederlag.bh_respondert_versjon !== undefined &&
    vederlag.bh_respondert_versjon < Math.max(0, vederlag.antall_versjoner - 1)
  ) {
    return {
      type: 'action',
      title: 'Oppdatert vederlagskrav',
      description: 'Entreprenør har oppdatert vederlagskravet.',
      nextStep: 'Vurder det oppdaterte kravet.',
      relatedSpor: 'vederlag',
    };
  }

  if (
    frist.bh_resultat &&
    frist.bh_respondert_versjon !== undefined &&
    frist.bh_respondert_versjon < Math.max(0, frist.antall_versjoner - 1)
  ) {
    return {
      type: 'action',
      title: 'Oppdatert fristkrav',
      description: 'Entreprenør har oppdatert fristkravet.',
      nextStep: 'Vurder det oppdaterte kravet.',
      relatedSpor: 'frist',
    };
  }

  // 7. Kan utstede endringsordre
  if (kan_utstede_eo && actions.canIssueEO) {
    return {
      type: 'success',
      title: 'Klar for endringsordre',
      description: 'Alle krav er behandlet. Du kan nå utstede formell endringsordre.',
      nextStep: 'Utsted endringsordre for å formalisere avtalen.',
      relatedSpor: null,
    };
  }

  // 8. Alle krav behandlet - saken er "ferdig"
  if (
    harFaattRespons(grunnlag.status) &&
    (vederlag.status === 'ikke_relevant' || harFaattRespons(vederlag.status)) &&
    (frist.status === 'ikke_relevant' || harFaattRespons(frist.status))
  ) {
    return {
      type: 'success',
      title: 'Alle krav behandlet',
      description: 'Du har gitt respons på alle mottatte krav.',
      relatedSpor: null,
    };
  }

  return null;
}

/**
 * Hovedfunksjon: Generer status-melding basert på rolle og saksstatus
 *
 * @param state - Nåværende saksstatus
 * @param userRole - Brukerens rolle (TE eller BH)
 * @param actions - Tilgjengelige handlinger
 * @returns StatusAlertMessage eller null hvis ingen relevant melding
 */
export function generateStatusAlert(
  state: SakState,
  userRole: 'TE' | 'BH',
  actions: AvailableActions
): StatusAlertMessage | null {
  // Ikke vis alert for lukkede saker
  if (state.overordnet_status === 'LUKKET' || state.overordnet_status === 'LUKKET_TRUKKET') {
    return null;
  }

  // Ikke vis alert for omforente saker
  if (state.overordnet_status === 'OMFORENT') {
    return {
      type: 'success',
      title: 'Saken er avsluttet',
      description: 'Partene har kommet til enighet.',
      relatedSpor: null,
    };
  }

  if (userRole === 'TE') {
    return generateTEMessage(state, actions);
  } else {
    return generateBHMessage(state, actions);
  }
}
