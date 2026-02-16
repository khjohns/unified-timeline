/**
 * vederlagDomain.ts — Ren NS 8407 domenelogikk for vederlag (kompensasjon).
 *
 * Ingen React-avhengigheter. Alle funksjoner er rene (input → output).
 * Importeres av useVederlagBridge.ts (fremtidig) og RespondVederlagModal.
 *
 * Ref: ADR-003 L14, §34 / §30.2 NS 8407:2011
 */

import type {
  VederlagsMetode,
  VederlagBeregningResultat,
  SubsidiaerTrigger,
} from '../types/timeline';

// ============================================================================
// TYPES
// ============================================================================

export type BelopVurdering = 'godkjent' | 'delvis' | 'avslatt';

/**
 * Flat representasjon av alle BH-valg i vederlagsresponsen.
 * Speiler wizard-portene 1–4 i RespondVederlagModal.
 */
export interface VederlagFormState {
  // Port 1: Preklusjon
  hovedkravVarsletITide: boolean;       // §34.1.2 (kun SVIKT/ANDRE)
  riggVarsletITide: boolean;            // §34.1.3
  produktivitetVarsletITide: boolean;   // §34.1.3

  // Port 2: Metode
  akseptererMetode: boolean;
  oensketMetode?: VederlagsMetode;
  epJusteringVarsletITide?: boolean;    // §34.3.3
  epJusteringAkseptert?: boolean;
  holdTilbake: boolean;

  // Port 3: Beløp
  hovedkravVurdering: BelopVurdering;
  hovedkravGodkjentBelop?: number;
  riggVurdering?: BelopVurdering;
  riggGodkjentBelop?: number;
  produktivitetVurdering?: BelopVurdering;
  produktivitetGodkjentBelop?: number;

  // Port 4: Begrunnelse
  begrunnelse: string;
}

/**
 * Kontekst fra TE-kravet og sak-state. Leses, aldri muteres.
 */
export interface VederlagDomainConfig {
  metode?: VederlagsMetode;
  hovedkravBelop: number;
  riggBelop?: number;
  produktivitetBelop?: number;
  harRiggKrav: boolean;
  harProduktivitetKrav: boolean;
  kreverJustertEp: boolean;
  kostnadsOverslag?: number;
  hovedkategori?: 'ENDRING' | 'SVIKT' | 'ANDRE' | 'FORCE_MAJEURE';
  grunnlagVarsletForSent: boolean;
  grunnlagStatus?: 'godkjent' | 'avslatt' | 'frafalt';
}

/**
 * Beregnede verdier fra form state + config. Alle avledninger samlet.
 */
export interface VederlagComputedValues {
  // Preklusjon
  har34_1_2_Preklusjon: boolean;
  erHelVederlagSubsidiaerPgaGrunnlag: boolean;
  erSubsidiaer: boolean;
  hovedkravPrekludert: boolean;
  riggPrekludert: boolean;
  produktivitetPrekludert: boolean;
  harPrekludertKrav: boolean;
  harPreklusjonsSteg: boolean;

  // Metode-avledninger
  kanHoldeTilbake: boolean;
  maSvarePaJustering: boolean;

  // Beløp-totaler
  totalKrevd: number;
  totalKrevdInklPrekludert: number;
  totalGodkjent: number;
  totalGodkjentInklPrekludert: number;
  harMetodeendring: boolean;

  // Resultater
  prinsipaltResultat: VederlagBeregningResultat;
  subsidiaertResultat: VederlagBeregningResultat;
  visSubsidiaertResultat: boolean;
  subsidiaerTriggers: SubsidiaerTrigger[];

  // Placeholder
  dynamicPlaceholder: string;
}

/** Subset av forrige respons-event for update mode */
export interface VederlagLastResponseData {
  eventId: string;
  hovedkravVarsletITide?: boolean;
  riggVarsletITide?: boolean;
  produktivitetVarsletITide?: boolean;
  akseptererMetode?: boolean;
  oensketMetode?: VederlagsMetode;
  epJusteringVarsletITide?: boolean;
  epJusteringAkseptert?: boolean;
  holdTilbake?: boolean;
  hovedkravVurdering?: BelopVurdering;
  hovedkravGodkjentBelop?: number;
  riggVurdering?: BelopVurdering;
  riggGodkjentBelop?: number;
  produktivitetVurdering?: BelopVurdering;
  produktivitetGodkjentBelop?: number;
  godkjentBelop?: number;
}

export interface VederlagDefaultsConfig {
  isUpdateMode: boolean;
  lastResponseEvent?: VederlagLastResponseData;
}

/** Badge-visning for vurdering */
export interface VurderingBadge {
  variant: 'success' | 'warning' | 'danger';
  label: string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

export function getDefaults(config: VederlagDefaultsConfig): VederlagFormState {
  if (config.isUpdateMode && config.lastResponseEvent) {
    const prev = config.lastResponseEvent;
    return {
      hovedkravVarsletITide: prev.hovedkravVarsletITide ?? true,
      riggVarsletITide: prev.riggVarsletITide ?? true,
      produktivitetVarsletITide: prev.produktivitetVarsletITide ?? true,
      akseptererMetode: prev.akseptererMetode ?? true,
      oensketMetode: prev.oensketMetode,
      epJusteringVarsletITide: prev.epJusteringVarsletITide,
      epJusteringAkseptert: prev.epJusteringAkseptert,
      holdTilbake: prev.holdTilbake ?? false,
      hovedkravVurdering: prev.hovedkravVurdering ?? 'godkjent',
      hovedkravGodkjentBelop: prev.hovedkravGodkjentBelop,
      riggVurdering: prev.riggVurdering,
      riggGodkjentBelop: prev.riggGodkjentBelop,
      produktivitetVurdering: prev.produktivitetVurdering,
      produktivitetGodkjentBelop: prev.produktivitetGodkjentBelop,
      begrunnelse: '',
    };
  }
  return {
    hovedkravVarsletITide: true,
    riggVarsletITide: true,
    produktivitetVarsletITide: true,
    akseptererMetode: true,
    holdTilbake: false,
    hovedkravVurdering: 'godkjent',
    begrunnelse: '',
  };
}

// ============================================================================
// PRECLUSION (§34.1.2, §34.1.3, §32.2)
// ============================================================================

/**
 * §34.1.2 preklusjon gjelder KUN for SVIKT/ANDRE kategorier.
 * IKKE for ENDRING med §32.2-preklusjon.
 */
export function har34_1_2Preklusjon(config: Pick<VederlagDomainConfig, 'hovedkategori'>): boolean {
  return config.hovedkategori === 'SVIKT' || config.hovedkategori === 'ANDRE';
}

/**
 * §32.2: Når BH har påberopt at grunnlagsvarselet kom for sent (ENDRING-kategori),
 * er hele vederlagskravet automatisk subsidiært.
 */
export function erHelVederlagSubsidiaerPgaGrunnlag(
  config: Pick<VederlagDomainConfig, 'hovedkategori' | 'grunnlagVarsletForSent'>,
): boolean {
  return config.hovedkategori === 'ENDRING' && config.grunnlagVarsletForSent === true;
}

/**
 * Vederlag behandles subsidiært når:
 * 1. Grunnlag er avslått av BH, ELLER
 * 2. Grunnlag er prekludert pga §32.2
 */
export function erSubsidiaer(config: Pick<VederlagDomainConfig, 'grunnlagStatus' | 'hovedkategori' | 'grunnlagVarsletForSent'>): boolean {
  return config.grunnlagStatus === 'avslatt' || erHelVederlagSubsidiaerPgaGrunnlag(config);
}

export function beregnHovedkravPrekludert(
  state: Pick<VederlagFormState, 'hovedkravVarsletITide'>,
  config: Pick<VederlagDomainConfig, 'hovedkategori'>,
): boolean {
  return har34_1_2Preklusjon(config) && state.hovedkravVarsletITide === false;
}

export function beregnRiggPrekludert(
  state: Pick<VederlagFormState, 'riggVarsletITide'>,
  config: Pick<VederlagDomainConfig, 'harRiggKrav'>,
): boolean {
  return config.harRiggKrav && state.riggVarsletITide === false;
}

export function beregnProduktivitetPrekludert(
  state: Pick<VederlagFormState, 'produktivitetVarsletITide'>,
  config: Pick<VederlagDomainConfig, 'harProduktivitetKrav'>,
): boolean {
  return config.harProduktivitetKrav && state.produktivitetVarsletITide === false;
}

/** Preklusjons-steget vises når: harSaerskiltKrav ELLER har §34.1.2-preklusjon */
export function harPreklusjonsSteg(config: VederlagDomainConfig): boolean {
  return config.harRiggKrav || config.harProduktivitetKrav || har34_1_2Preklusjon(config);
}

// ============================================================================
// METHOD DERIVATIONS
// ============================================================================

/** §30.2: BH kan holde tilbake betaling for regningsarbeid uten kostnadsoverslag */
export function kanHoldeTilbake(config: Pick<VederlagDomainConfig, 'metode' | 'kostnadsOverslag'>): boolean {
  return config.metode === 'REGNINGSARBEID' && !config.kostnadsOverslag;
}

/** §34.3.3: BH må svare på EP-justering "uten ugrunnet opphold" */
export function maSvarePaJustering(config: Pick<VederlagDomainConfig, 'metode' | 'kreverJustertEp'>): boolean {
  return config.metode === 'ENHETSPRISER' && config.kreverJustertEp === true;
}

// ============================================================================
// AMOUNT CALCULATIONS
// ============================================================================

/**
 * Beregn godkjent beløp for et enkelt krav basert på vurdering.
 */
export function beregnGodkjentBelop(
  vurdering: BelopVurdering | undefined,
  krevdBelop: number,
  delvisGodkjentBelop: number | undefined,
  prekludert?: boolean,
): number {
  if (prekludert) return 0;
  switch (vurdering) {
    case 'godkjent':
      return krevdBelop;
    case 'delvis':
      return delvisGodkjentBelop ?? 0;
    default:
      return 0;
  }
}

export interface VederlagTotaler {
  totalKrevd: number;
  totalKrevdInklPrekludert: number;
  totalGodkjent: number;
  totalGodkjentInklPrekludert: number;
  harMetodeendring: boolean;
  harPrekludertKrav: boolean;
}

/**
 * Beregn alle beløp-totaler (principal og subsidiary).
 * Flytt fra RespondVederlagModal computed useMemo (linje 553–643).
 */
export function beregnTotaler(
  state: VederlagFormState,
  config: VederlagDomainConfig,
  preklusjon: { hovedkrav: boolean; rigg: boolean; produktivitet: boolean },
): VederlagTotaler {
  const { hovedkravBelop, harRiggKrav, harProduktivitetKrav } = config;
  const riggBelop = config.riggBelop ?? 0;
  const produktivitetBelop = config.produktivitetBelop ?? 0;

  // Total krevd (principal — respekterer preklusjon)
  const totalKrevd =
    (hovedkravBelop || 0) +
    (harRiggKrav && !preklusjon.rigg ? riggBelop : 0) +
    (harProduktivitetKrav && !preklusjon.produktivitet ? produktivitetBelop : 0);

  // Total krevd inkl. prekluderte (for subsidiary)
  const totalKrevdInklPrekludert =
    (hovedkravBelop || 0) +
    (harRiggKrav ? riggBelop : 0) +
    (harProduktivitetKrav ? produktivitetBelop : 0);

  // Principal godkjent (respekterer preklusjon)
  let totalGodkjent = 0;

  if (!preklusjon.hovedkrav) {
    totalGodkjent += beregnGodkjentBelop(
      state.hovedkravVurdering, hovedkravBelop, state.hovedkravGodkjentBelop,
    );
  }
  if (harRiggKrav && !preklusjon.rigg) {
    totalGodkjent += beregnGodkjentBelop(
      state.riggVurdering, riggBelop, state.riggGodkjentBelop,
    );
  }
  if (harProduktivitetKrav && !preklusjon.produktivitet) {
    totalGodkjent += beregnGodkjentBelop(
      state.produktivitetVurdering, produktivitetBelop, state.produktivitetGodkjentBelop,
    );
  }

  // Subsidiary godkjent (inkluderer prekluderte krav-evalueringer)
  let totalGodkjentInklPrekludert = totalGodkjent;

  if (preklusjon.hovedkrav) {
    totalGodkjentInklPrekludert += beregnGodkjentBelop(
      state.hovedkravVurdering, hovedkravBelop, state.hovedkravGodkjentBelop,
    );
  }
  if (harRiggKrav && preklusjon.rigg) {
    totalGodkjentInklPrekludert += beregnGodkjentBelop(
      state.riggVurdering, riggBelop, state.riggGodkjentBelop,
    );
  }
  if (harProduktivitetKrav && preklusjon.produktivitet) {
    totalGodkjentInklPrekludert += beregnGodkjentBelop(
      state.produktivitetVurdering, produktivitetBelop, state.produktivitetGodkjentBelop,
    );
  }

  return {
    totalKrevd,
    totalKrevdInklPrekludert,
    totalGodkjent,
    totalGodkjentInklPrekludert,
    harMetodeendring: !state.akseptererMetode,
    harPrekludertKrav: preklusjon.hovedkrav || preklusjon.rigg || preklusjon.produktivitet,
  };
}

// ============================================================================
// RESULT COMPUTATION
// ============================================================================

/**
 * Beregn prinsipalt resultat basert på wizard-inputs.
 * Følger NS 8407 logikk fra Datasett_varslingsregler_8407.py.
 */
export function beregnPrinsipaltResultat(computed: {
  totalKrevdInklPrekludert: number;
  totalGodkjent: number;
  harMetodeendring: boolean;
  holdTilbake: boolean;
}): VederlagBeregningResultat {
  // 1. Tilbakeholdelse (§30.2) har prioritet
  if (computed.holdTilbake) return 'hold_tilbake';

  // 2. Godkjenningsprosent (relativ til totalt krevd, ikke bare kvalifisert)
  const godkjentProsent =
    computed.totalKrevdInklPrekludert > 0
      ? computed.totalGodkjent / computed.totalKrevdInklPrekludert
      : 0;

  // 3. Totalt avslag — ingenting godkjent prinsipalt
  if (computed.totalGodkjent === 0) return 'avslatt';

  // 4. Full godkjenning
  if (godkjentProsent >= 0.99 && !computed.harMetodeendring) return 'godkjent';

  // 5. Metodeendring eller delvis godkjenning
  return 'delvis_godkjent';
}

/**
 * Beregn subsidiært resultat (ignorerer preklusjon, evaluerer alle beløp).
 * Brukes når særskilte krav er prekludert men BH evaluerer subsidiært.
 */
export function beregnSubsidiaertResultat(computed: {
  totalKrevdInklPrekludert: number;
  totalGodkjentInklPrekludert: number;
  harMetodeendring: boolean;
  hovedkravVurdering: BelopVurdering;
}): VederlagBeregningResultat {
  const godkjentProsent =
    computed.totalKrevdInklPrekludert > 0
      ? computed.totalGodkjentInklPrekludert / computed.totalKrevdInklPrekludert
      : 0;

  if (godkjentProsent === 0 && computed.hovedkravVurdering === 'avslatt') return 'avslatt';
  if (godkjentProsent >= 0.99 && !computed.harMetodeendring) return 'godkjent';

  return 'delvis_godkjent';
}

// ============================================================================
// SUBSIDIARY TRIGGERS
// ============================================================================

export function beregnSubsidiaerTriggers(
  state: VederlagFormState,
  config: VederlagDomainConfig,
  preklusjon: { hovedkrav: boolean; rigg: boolean; produktivitet: boolean },
): SubsidiaerTrigger[] {
  const triggers: SubsidiaerTrigger[] = [];

  if (preklusjon.hovedkrav) triggers.push('preklusjon_hovedkrav');
  if (preklusjon.rigg) triggers.push('preklusjon_rigg');
  if (preklusjon.produktivitet) triggers.push('preklusjon_produktivitet');

  // §34.3.3: EP-justering begrenset hvis TE varslet for sent
  if (config.kreverJustertEp && state.epJusteringVarsletITide === false) {
    triggers.push('reduksjon_ep_justering');
  }

  if (!state.akseptererMetode) triggers.push('metode_avslatt');

  return triggers;
}

// ============================================================================
// BADGE HELPERS
// ============================================================================

export function getVurderingBadge(
  vurdering: BelopVurdering | undefined,
  prekludert?: boolean,
): VurderingBadge {
  if (prekludert) return { variant: 'danger', label: 'Prekludert' };
  switch (vurdering) {
    case 'godkjent':
      return { variant: 'success', label: 'Godkjent' };
    case 'delvis':
      return { variant: 'warning', label: 'Delvis' };
    case 'avslatt':
    default:
      return { variant: 'danger', label: 'Avvist' };
  }
}

// ============================================================================
// DYNAMIC PLACEHOLDER
// ============================================================================

export function getDynamicPlaceholder(resultat: VederlagBeregningResultat | undefined): string {
  if (!resultat) return 'Gjør valgene i wizarden, deretter skriv begrunnelse...';
  if (resultat === 'godkjent') return 'Begrunn din godkjenning av vederlagskravet...';
  if (resultat === 'delvis_godkjent') return 'Forklar hvorfor du kun godkjenner deler av vederlagskravet...';
  if (resultat === 'hold_tilbake') return 'Begrunn tilbakeholdelsen av betaling (§30.2)...';
  return 'Begrunn ditt avslag på vederlagskravet...';
}

// ============================================================================
// BUILD EVENT DATA
// ============================================================================

export function buildEventData(
  state: VederlagFormState,
  config: VederlagDomainConfig,
  computed: Pick<VederlagComputedValues,
    'har34_1_2_Preklusjon' | 'prinsipaltResultat' | 'subsidiaertResultat' |
    'visSubsidiaertResultat' | 'totalGodkjent' | 'totalKrevdInklPrekludert' |
    'totalGodkjentInklPrekludert'
  >,
  refs: {
    vederlagKravId: string;
    lastResponseEventId?: string;
    isUpdateMode: boolean;
  },
  autoBegrunnelse: string,
  subsidiaerTriggers: SubsidiaerTrigger[],
): { eventType: string; data: Record<string, unknown> } {
  const begrunnelseTekst = state.begrunnelse || autoBegrunnelse;

  // Beregn godkjente beløp per krav
  const hovedkravGodkjentBelop =
    state.hovedkravVurdering === 'godkjent'
      ? config.hovedkravBelop
      : state.hovedkravVurdering === 'delvis'
        ? state.hovedkravGodkjentBelop
        : 0;

  const riggGodkjentBelop =
    state.riggVurdering === 'godkjent'
      ? (config.riggBelop ?? 0)
      : state.riggVurdering === 'delvis'
        ? state.riggGodkjentBelop
        : 0;

  const produktivitetGodkjentBelop =
    state.produktivitetVurdering === 'godkjent'
      ? (config.produktivitetBelop ?? 0)
      : state.produktivitetVurdering === 'delvis'
        ? state.produktivitetGodkjentBelop
        : 0;

  // Felles data for begge modi
  const commonData: Record<string, unknown> = {
    // Port 1: Preklusjon
    hovedkrav_varslet_i_tide: computed.har34_1_2_Preklusjon ? state.hovedkravVarsletITide : undefined,
    rigg_varslet_i_tide: state.riggVarsletITide,
    produktivitet_varslet_i_tide: state.produktivitetVarsletITide,

    // Port 2: Beregningsmetode
    aksepterer_metode: state.akseptererMetode,
    oensket_metode: state.oensketMetode,
    ep_justering_varslet_i_tide: state.epJusteringVarsletITide,
    ep_justering_akseptert: state.epJusteringAkseptert,
    hold_tilbake: state.holdTilbake,

    // Port 3: Beløp
    hovedkrav_vurdering: state.hovedkravVurdering,
    hovedkrav_godkjent_belop: hovedkravGodkjentBelop,
    rigg_vurdering: state.riggVurdering,
    rigg_godkjent_belop: riggGodkjentBelop,
    produktivitet_vurdering: state.produktivitetVurdering,
    produktivitet_godkjent_belop: produktivitetGodkjentBelop,

    // Begrunnelse
    begrunnelse: begrunnelseTekst,
    auto_begrunnelse: autoBegrunnelse,

    // Automatisk beregnet (prinsipalt)
    beregnings_resultat: computed.prinsipaltResultat,
    total_godkjent_belop: computed.totalGodkjent,
    total_krevd_belop: computed.totalKrevdInklPrekludert,

    // Subsidiært standpunkt (kun når relevant)
    subsidiaer_triggers: subsidiaerTriggers.length > 0 ? subsidiaerTriggers : undefined,
    subsidiaer_resultat: computed.visSubsidiaertResultat ? computed.subsidiaertResultat : undefined,
    subsidiaer_godkjent_belop: computed.visSubsidiaertResultat
      ? computed.totalGodkjentInklPrekludert
      : undefined,
    subsidiaer_begrunnelse: computed.visSubsidiaertResultat
      ? begrunnelseTekst
      : undefined,
  };

  if (refs.isUpdateMode && refs.lastResponseEventId) {
    return {
      eventType: 'respons_vederlag_oppdatert',
      data: {
        original_respons_id: refs.lastResponseEventId,
        dato_endret: new Date().toISOString().split('T')[0],
        vurdering_begrunnelse: begrunnelseTekst,
        ...commonData,
      },
    };
  }

  return {
    eventType: 'respons_vederlag',
    data: {
      vederlag_krav_id: refs.vederlagKravId,
      ...commonData,
    },
  };
}

// ============================================================================
// DISPLAY HELPERS (L14: ren domenelogikk, ingen React)
// ============================================================================

/**
 * Avled vurdering fra godkjent vs krevd beløp.
 * Brukes av bridge-hook for å oppdatere vurdering når bruker endrer beløp.
 */
export function deriveVurdering(godkjent: number, krevd: number): BelopVurdering {
  if (godkjent >= krevd && krevd > 0) return 'godkjent';
  if (godkjent > 0) return 'delvis';
  return 'avslatt';
}

/**
 * Beregn visningsverdi for godkjent-beløp basert på vurdering.
 * Returnerer krevd ved 'godkjent', bruker-input ved 'delvis', 0 ved 'avslatt'.
 */
export function getGodkjentForDisplay(
  vurdering: BelopVurdering | undefined,
  krevdBelop: number,
  godkjentBelop: number | undefined,
): number {
  if (vurdering === 'godkjent' || vurdering === undefined) return krevdBelop;
  if (vurdering === 'delvis') return godkjentBelop ?? 0;
  return 0;
}

// ============================================================================
// CONVENIENCE: beregnAlt
// ============================================================================

export function beregnAlt(state: VederlagFormState, config: VederlagDomainConfig): VederlagComputedValues {
  const _har34_1_2 = har34_1_2Preklusjon(config);
  const _erHelSubsidiaer = erHelVederlagSubsidiaerPgaGrunnlag(config);
  const _erSubsidiaer = erSubsidiaer(config);

  const hovedkravPrekludert = beregnHovedkravPrekludert(state, config);
  const riggPrekludert = beregnRiggPrekludert(state, config);
  const produktivitetPrekludert = beregnProduktivitetPrekludert(state, config);
  const preklusjon = { hovedkrav: hovedkravPrekludert, rigg: riggPrekludert, produktivitet: produktivitetPrekludert };

  const totaler = beregnTotaler(state, config, preklusjon);
  const _kanHoldeTilbake = kanHoldeTilbake(config);
  const _maSvarePaJustering = maSvarePaJustering(config);

  const prinsipaltResultat = beregnPrinsipaltResultat({
    totalKrevdInklPrekludert: totaler.totalKrevdInklPrekludert,
    totalGodkjent: totaler.totalGodkjent,
    harMetodeendring: totaler.harMetodeendring,
    holdTilbake: state.holdTilbake,
  });

  const subsidiaertResultat = beregnSubsidiaertResultat({
    totalKrevdInklPrekludert: totaler.totalKrevdInklPrekludert,
    totalGodkjentInklPrekludert: totaler.totalGodkjentInklPrekludert,
    harMetodeendring: totaler.harMetodeendring,
    hovedkravVurdering: state.hovedkravVurdering,
  });

  const visSubsidiaertResultat = totaler.harPrekludertKrav;

  const subsidiaerTriggers = beregnSubsidiaerTriggers(state, config, preklusjon);

  const dynamicPlaceholder = getDynamicPlaceholder(prinsipaltResultat);

  return {
    har34_1_2_Preklusjon: _har34_1_2,
    erHelVederlagSubsidiaerPgaGrunnlag: _erHelSubsidiaer,
    erSubsidiaer: _erSubsidiaer,
    hovedkravPrekludert,
    riggPrekludert,
    produktivitetPrekludert,
    harPrekludertKrav: totaler.harPrekludertKrav,
    harPreklusjonsSteg: harPreklusjonsSteg(config),
    kanHoldeTilbake: _kanHoldeTilbake,
    maSvarePaJustering: _maSvarePaJustering,
    totalKrevd: totaler.totalKrevd,
    totalKrevdInklPrekludert: totaler.totalKrevdInklPrekludert,
    totalGodkjent: totaler.totalGodkjent,
    totalGodkjentInklPrekludert: totaler.totalGodkjentInklPrekludert,
    harMetodeendring: totaler.harMetodeendring,
    prinsipaltResultat,
    subsidiaertResultat,
    visSubsidiaertResultat,
    subsidiaerTriggers,
    dynamicPlaceholder,
  };
}
