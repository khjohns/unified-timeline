/**
 * Status Alert Generator
 *
 * Genererer kontekstuelle status-meldinger basert på brukerrolle og saksstatus.
 * Brukes til å vise en alert øverst i saksvisningen som informerer om
 * nåværende situasjon og neste steg.
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

/**
 * Hent lesbart kategorinavn
 */
function getKategoriNavn(kategoriId: string | undefined): string {
  if (!kategoriId) return 'et endringsforhold';
  const kategori = HOVEDKATEGORI_OPTIONS.find((k) => k.value === kategoriId);
  return kategori?.label.toLowerCase() ?? 'et endringsforhold';
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
 * Sjekk om spor er trukket
 */
function erTrukket(status: SporStatus | undefined): boolean {
  return status === 'trukket';
}

/**
 * Generer status-melding for entreprenør
 */
function generateEntreprenorMessage(
  state: SakState,
  actions: AvailableActions
): StatusAlertMessage | null {
  const { grunnlag, vederlag, frist, overordnet_status } = state;
  const erForceMajeure = grunnlag.hovedkategori === 'FORCE_MAJEURE';

  // Hjelpefunksjoner for å sjekke tilstand
  const grunnlagSendt = erVenterPaaSvar(grunnlag.status) || harFaattRespons(grunnlag.status);
  const vederlagIUtkast = vederlag.status === 'utkast';
  const fristIUtkast = frist.status === 'utkast';
  const vederlagSendt = erVenterPaaSvar(vederlag.status) || harFaattRespons(vederlag.status);
  const fristSendt = erVenterPaaSvar(frist.status) || harFaattRespons(frist.status);

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

  // 2. Byggherre krever avklaring på grunnlag
  if (grunnlag.bh_resultat === 'krever_avklaring') {
    return {
      type: 'warning',
      title: 'Byggherre krever avklaring',
      description: 'Byggherre trenger mer informasjon før de kan vurdere grunnlaget.',
      nextStep: 'Oppdater grunnlaget med etterspurt dokumentasjon eller avklaring.',
      relatedSpor: 'grunnlag',
    };
  }

  // 3. Grunnlag sendt - sjekk om entreprenør bør sende vederlagsjustering/fristforlengelse
  if (grunnlagSendt) {
    const kanSendeVederlag = vederlagIUtkast && actions.canSendVederlag && !erForceMajeure;
    const kanSendeFrist = fristIUtkast && actions.canSendFrist;

    // Force Majeure: kun fristforlengelse er mulig
    if (erForceMajeure && kanSendeFrist) {
      const grunnlagStatus = grunnlag.bh_resultat
        ? `Grunnlag er ${grunnlag.bh_resultat === 'godkjent' ? 'godkjent' : grunnlag.bh_resultat === 'delvis_godkjent' ? 'delvis godkjent' : 'behandlet'}.`
        : 'Grunnlag er sendt.';
      return {
        type: 'action',
        title: 'Send krav om fristforlengelse',
        description: `${grunnlagStatus} Ved force majeure kan du kreve fristforlengelse.`,
        nextStep: 'Fyll ut og send krav om fristforlengelse.',
        relatedSpor: 'frist',
      };
    }

    if (kanSendeVederlag && kanSendeFrist) {
      const grunnlagStatus = grunnlag.bh_resultat
        ? `Grunnlag er ${grunnlag.bh_resultat === 'godkjent' ? 'godkjent' : grunnlag.bh_resultat === 'delvis_godkjent' ? 'delvis godkjent' : 'behandlet'}.`
        : 'Grunnlag er sendt.';
      return {
        type: 'action',
        title: 'Send krav om vederlagsjustering eller fristforlengelse',
        description: `${grunnlagStatus} Du kan nå sende krav om vederlagsjustering eller fristforlengelse.`,
        nextStep: 'Fyll ut og send krav om vederlagsjustering eller fristforlengelse.',
        relatedSpor: 'vederlag',
      };
    }

    if (kanSendeVederlag) {
      return {
        type: 'action',
        title: 'Send krav om vederlagsjustering',
        description: fristSendt
          ? 'Krav om fristforlengelse er sendt. Du kan også sende krav om vederlagsjustering.'
          : 'Du har ikke sendt krav om vederlagsjustering ennå.',
        nextStep: 'Fyll ut og send krav om vederlagsjustering.',
        relatedSpor: 'vederlag',
      };
    }

    if (kanSendeFrist) {
      return {
        type: 'action',
        title: 'Send krav om fristforlengelse',
        description: vederlagSendt
          ? 'Krav om vederlagsjustering er sendt. Du kan også sende krav om fristforlengelse.'
          : 'Du har ikke sendt krav om fristforlengelse ennå.',
        nextStep: 'Fyll ut og send krav om fristforlengelse hvis du trenger mer tid.',
        relatedSpor: 'frist',
      };
    }
  }

  // 4. Grunnlag avslått - informer om muligheter
  if (grunnlag.bh_resultat === 'avslatt') {
    const harSubsidiaer =
      (vederlag.subsidiaer_triggers && vederlag.subsidiaer_triggers.length > 0) ||
      (frist.subsidiaer_triggers && frist.subsidiaer_triggers.length > 0);

    if (harSubsidiaer) {
      return {
        type: 'warning',
        title: 'Grunnlag avslått - subsidiær vurdering',
        description: 'Byggherre har avslått grunnlaget. Eventuelle krav behandles subsidiært.',
        nextStep: 'Du kan oppdatere grunnlaget eller akseptere subsidiær behandling.',
        relatedSpor: 'grunnlag',
      };
    }

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

  // 5. Trukket krav - informer
  if (erTrukket(grunnlag.status)) {
    return {
      type: 'info',
      title: 'Grunnlag trukket',
      description: 'Du har trukket grunnlaget. Saken er avsluttet.',
      relatedSpor: 'grunnlag',
    };
  }

  if (erTrukket(vederlag.status) && !erTrukket(frist.status) && frist.status !== 'ikke_relevant') {
    return {
      type: 'info',
      title: 'Krav om vederlagsjustering trukket',
      description: 'Du har trukket kravet om vederlagsjustering. Krav om fristforlengelse behandles fortsatt.',
      relatedSpor: 'vederlag',
    };
  }

  if (erTrukket(frist.status) && !erTrukket(vederlag.status) && vederlag.status !== 'ikke_relevant') {
    return {
      type: 'info',
      title: 'Krav om fristforlengelse trukket',
      description: 'Du har trukket kravet om fristforlengelse. Krav om vederlagsjustering behandles fortsatt.',
      relatedSpor: 'frist',
    };
  }

  // 6. Vederlagsjustering/fristforlengelse avslått eller delvis godkjent
  if (vederlag.bh_resultat === 'avslatt' && actions.canUpdateVederlag) {
    return {
      type: 'warning',
      title: 'Krav om vederlagsjustering avslått',
      description: 'Byggherre har avslått kravet om vederlagsjustering.',
      nextStep: 'Du kan oppdatere kravet med justert beløp eller dokumentasjon.',
      relatedSpor: 'vederlag',
    };
  }

  if (vederlag.bh_resultat === 'delvis_godkjent' && actions.canUpdateVederlag) {
    const krevd = vederlag.belop_direkte ?? vederlag.kostnads_overslag ?? 0;
    const godkjent = vederlag.godkjent_belop ?? 0;
    const differanse = krevd - godkjent;
    return {
      type: 'info',
      title: 'Vederlagsjustering delvis godkjent',
      description: `Byggherre har godkjent ${godkjent.toLocaleString('nb-NO')} kr av ${krevd.toLocaleString('nb-NO')} kr (differanse: ${differanse.toLocaleString('nb-NO')} kr).`,
      nextStep: 'Du kan oppdatere kravet hvis du mener differansen bør dekkes.',
      relatedSpor: 'vederlag',
    };
  }

  if (frist.bh_resultat === 'avslatt') {
    if (actions.canSendForsering) {
      return {
        type: 'warning',
        title: 'Krav om fristforlengelse avslått',
        description: 'Byggherre har avslått kravet om fristforlengelse.',
        nextStep: 'Du kan vurdere forsering (§33.8) for å kreve dagmulktkompensasjon.',
        relatedSpor: 'frist',
      };
    }
    if (actions.canUpdateFrist) {
      return {
        type: 'warning',
        title: 'Krav om fristforlengelse avslått',
        description: 'Byggherre har avslått kravet om fristforlengelse.',
        nextStep: 'Du kan oppdatere kravet med mer dokumentasjon.',
        relatedSpor: 'frist',
      };
    }
  }

  if (frist.bh_resultat === 'delvis_godkjent') {
    const godkjentDager = frist.godkjent_dager ?? 0;
    const krevdDager = frist.krevd_dager ?? 0;
    if (actions.canSendForsering && godkjentDager < krevdDager) {
      return {
        type: 'info',
        title: 'Fristforlengelse delvis godkjent',
        description: `Byggherre har godkjent ${godkjentDager} av ${krevdDager} dager.`,
        nextStep: 'Du kan vurdere forsering for resterende dager.',
        relatedSpor: 'frist',
      };
    }
  }

  // 7. Alle krav sendt og venter på respons
  if (
    grunnlagSendt &&
    !grunnlag.bh_resultat &&
    (vederlagSendt || vederlagIUtkast) &&
    (fristSendt || fristIUtkast)
  ) {
    const ventePå: string[] = [];
    if (!grunnlag.bh_resultat) ventePå.push('grunnlag');
    if (vederlagSendt && !vederlag.bh_resultat) ventePå.push('vederlagsjustering');
    if (fristSendt && !frist.bh_resultat) ventePå.push('fristforlengelse');

    if (ventePå.length > 0) {
      return {
        type: 'info',
        title: 'Venter på byggherre',
        description: `Venter på respons på ${ventePå.join(' og ')}.`,
        relatedSpor: ventePå[0] === 'grunnlag' ? 'grunnlag' : ventePå[0] === 'vederlagsjustering' ? 'vederlag' : 'frist',
      };
    }
  }

  // 8. Alle krav behandlet og godkjent
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

    if (!actions.canUpdateGrunnlag && !actions.canUpdateVederlag && !actions.canUpdateFrist) {
      return {
        type: 'info',
        title: 'Krav behandlet',
        description: 'Alle krav har fått respons fra byggherre.',
        nextStep: 'Gjennomgå resultatet.',
        relatedSpor: null,
      };
    }
  }

  // 9. Under forhandling
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
 * Generer status-melding for byggherre
 */
function generateByggherreMessage(
  state: SakState,
  actions: AvailableActions
): StatusAlertMessage | null {
  const { grunnlag, vederlag, frist, kan_utstede_eo } = state;

  // Tell opp hva som venter på respons
  const kravSomVenter: string[] = [];
  if (actions.canRespondToGrunnlag) kravSomVenter.push('grunnlag');
  if (actions.canRespondToVederlag) kravSomVenter.push('vederlagsjustering');
  if (actions.canRespondToFrist) kravSomVenter.push('fristforlengelse');

  // 1. Flere krav venter på respons - vis samlet oversikt
  if (kravSomVenter.length > 1) {
    const belopTekst = vederlag.belop_direkte ?? vederlag.kostnads_overslag;
    const dagerTekst = frist.krevd_dager;

    let beskrivelse = `Du har ${kravSomVenter.length} krav som venter på din vurdering`;
    if (belopTekst && dagerTekst) {
      beskrivelse += `: ${belopTekst.toLocaleString('nb-NO')} kr og ${dagerTekst} dager`;
    }
    beskrivelse += '.';

    return {
      type: 'action',
      title: 'Flere krav mottatt',
      description: beskrivelse,
      nextStep: 'Vurder og gi respons på hvert krav.',
      relatedSpor: kravSomVenter[0] === 'grunnlag' ? 'grunnlag' : kravSomVenter[0] === 'vederlagsjustering' ? 'vederlag' : 'frist',
    };
  }

  // 2. Nytt grunnlag mottatt - trenger respons
  if (actions.canRespondToGrunnlag) {
    const kategoriNavn = getKategoriNavn(grunnlag.hovedkategori);
    const erForceMajeure = grunnlag.hovedkategori === 'FORCE_MAJEURE';
    const kravType = erForceMajeure
      ? 'krav om fristforlengelse'
      : 'krav om vederlagsjustering eller fristforlengelse';
    return {
      type: 'action',
      title: 'Nytt endringsforhold mottatt',
      description: `Entreprenør har varslet om ${kategoriNavn} som kan gi grunnlag for ${kravType}.`,
      nextStep: 'Vurder grunnlaget og gi din respons.',
      relatedSpor: 'grunnlag',
    };
  }

  // 3. Entreprenør har oppdatert grunnlag - trenger ny vurdering
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

  // 4. Kun grunnlag sendt, venter på vederlagsjustering/fristforlengelse fra entreprenør
  if (
    erVenterPaaSvar(grunnlag.status) &&
    !grunnlag.bh_resultat &&
    vederlag.status === 'utkast' &&
    frist.status === 'utkast'
  ) {
    const kategoriNavn = getKategoriNavn(grunnlag.hovedkategori);
    const erForceMajeure = grunnlag.hovedkategori === 'FORCE_MAJEURE';
    const kravType = erForceMajeure
      ? 'krav om fristforlengelse'
      : 'krav om vederlagsjustering eller fristforlengelse';
    return {
      type: 'info',
      title: 'Grunnlag mottatt',
      description: `Entreprenør har varslet om ${kategoriNavn}. Avventer at entreprenør sender ${kravType}.`,
      nextStep: 'Du kan vente på krav, eller gi respons på grunnlaget nå.',
      relatedSpor: 'grunnlag',
    };
  }

  // 5. Nytt krav om vederlagsjustering mottatt
  if (actions.canRespondToVederlag) {
    const belop = vederlag.belop_direkte ?? vederlag.kostnads_overslag;
    return {
      type: 'action',
      title: 'Krav om vederlagsjustering mottatt',
      description: `Entreprenør krever ${belop?.toLocaleString('nb-NO') ?? '–'} kr i vederlagsjustering.`,
      nextStep: 'Vurder kravet og gi din respons.',
      relatedSpor: 'vederlag',
    };
  }

  // 6. Nytt krav om fristforlengelse mottatt
  if (actions.canRespondToFrist) {
    return {
      type: 'action',
      title: 'Krav om fristforlengelse mottatt',
      description: `Entreprenør krever ${frist.krevd_dager ?? '–'} dagers fristforlengelse.`,
      nextStep: 'Vurder kravet og gi din respons.',
      relatedSpor: 'frist',
    };
  }

  // 7. Entreprenør har oppdatert vederlagsjustering/fristforlengelse
  if (
    vederlag.bh_resultat &&
    vederlag.bh_respondert_versjon !== undefined &&
    vederlag.bh_respondert_versjon < Math.max(0, vederlag.antall_versjoner - 1)
  ) {
    return {
      type: 'action',
      title: 'Oppdatert krav om vederlagsjustering',
      description: 'Entreprenør har oppdatert kravet om vederlagsjustering.',
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
      title: 'Oppdatert krav om fristforlengelse',
      description: 'Entreprenør har oppdatert kravet om fristforlengelse.',
      nextStep: 'Vurder det oppdaterte kravet.',
      relatedSpor: 'frist',
    };
  }

  // 8. Grunnlag behandlet, venter på krav fra entreprenør
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
    const erForceMajeure = grunnlag.hovedkategori === 'FORCE_MAJEURE';
    const kravType = erForceMajeure
      ? 'krav om fristforlengelse'
      : 'krav om vederlagsjustering eller fristforlengelse';
    return {
      type: 'info',
      title: `Grunnlag ${resultatTekst}`,
      description: `Venter på at entreprenør sender ${kravType}.`,
      relatedSpor: null,
    };
  }

  // 9. Kan utstede endringsordre
  if (kan_utstede_eo && actions.canIssueEO) {
    return {
      type: 'success',
      title: 'Klar for endringsordre',
      description: 'Alle krav er behandlet. Du kan nå utstede formell endringsordre.',
      nextStep: 'Utsted endringsordre for å formalisere avtalen.',
      relatedSpor: null,
    };
  }

  // 10. Alle krav behandlet
  if (
    harFaattRespons(grunnlag.status) &&
    (vederlag.status === 'ikke_relevant' || harFaattRespons(vederlag.status) || erTrukket(vederlag.status)) &&
    (frist.status === 'ikke_relevant' || harFaattRespons(frist.status) || erTrukket(frist.status))
  ) {
    return {
      type: 'success',
      title: 'Alle krav behandlet',
      description: 'Du har gitt respons på alle mottatte krav.',
      relatedSpor: null,
    };
  }

  // 11. Venter på at entreprenør sender flere krav
  if (harFaattRespons(grunnlag.status)) {
    const erForceMajeure = grunnlag.hovedkategori === 'FORCE_MAJEURE';
    const venterPå: string[] = [];
    // Ved Force Majeure kan entreprenør kun kreve fristforlengelse
    if (vederlag.status === 'utkast' && !erForceMajeure) venterPå.push('vederlagsjustering');
    if (frist.status === 'utkast') venterPå.push('fristforlengelse');

    if (venterPå.length > 0) {
      return {
        type: 'info',
        title: 'Venter på entreprenør',
        description: `Entreprenør har ikke sendt krav om ${venterPå.join(' eller ')} ennå.`,
        relatedSpor: null,
      };
    }
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
    return generateEntreprenorMessage(state, actions);
  } else {
    return generateByggherreMessage(state, actions);
  }
}
