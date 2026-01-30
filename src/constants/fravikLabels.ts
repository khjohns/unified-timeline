/**
 * Fravik Labels
 *
 * Lesbare norske labels for fravik-relaterte verdier.
 * Brukes i UI og Excel-eksport for brukervennlige tekster.
 */

// ========== LABEL RECORDS ==========

export const FRAVIK_GRUNN_LABELS: Record<string, string> = {
  markedsmangel: 'Markedsmangel',
  leveringstid: 'Leveringstid',
  tekniske_begrensninger: 'Tekniske begrensninger',
  hms_krav: 'HMS-krav',
  annet: 'Annet',
};

export const DRIVSTOFF_LABELS: Record<string, string> = {
  HVO100: 'HVO100 (palmefritt)',
  annet_biodrivstoff: 'Annet biodrivstoff',
  diesel: 'Diesel',
  diesel_euro6: 'Diesel Euro 6', // Legacy - for backwards compatibility
};

export const MASKIN_VEKT_LABELS: Record<string, string> = {
  liten: 'Liten (< 8 tonn)',
  medium: 'Medium (8–20 tonn)',
  stor: 'Stor (20–50 tonn)',
  svart_stor: 'Svært stor (> 50 tonn)',
};

export const ARBEIDSKATEGORI_LABELS: Record<string, string> = {
  graving: 'Graving',
  lasting: 'Lasting',
  lofting: 'Løfting',
  boring_peling: 'Boring/pæling',
  asfalt_komprimering: 'Asfalt/komprimering',
  annet: 'Annet',
};

export const BRUKSINTENSITET_LABELS: Record<string, string> = {
  sporadisk: 'Sporadisk (< 2 timer/dag)',
  normal: 'Normal (2–6 timer/dag)',
  intensiv: 'Intensiv (> 6 timer/dag)',
};

export const FRAVIK_BESLUTNING_LABELS: Record<string, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
};

export const FRAVIK_STATUS_LABELS: Record<string, string> = {
  utkast: 'Utkast',
  sendt_inn: 'Sendt inn',
  under_miljo_vurdering: 'Til vurdering hos miljørådgiver',
  returnert_fra_miljo: 'Returnert fra miljørådgiver',
  under_pl_vurdering: 'Til godkjenning hos prosjektleder',
  returnert_fra_pl: 'Returnert fra prosjektleder',
  under_arbeidsgruppe: 'Til behandling i arbeidsgruppen',
  under_eier_beslutning: 'Til beslutning hos eier',
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  trukket: 'Trukket',
};

export const MASKIN_STATUS_LABELS: Record<string, string> = {
  ikke_vurdert: 'Ikke vurdert',
  godkjent: 'Godkjent',
  avslatt: 'Avslått',
  delvis_godkjent: 'Delvis godkjent',
};

export const MASKIN_TYPE_LABELS: Record<string, string> = {
  Gravemaskin: 'Gravemaskin',
  Hjullaster: 'Hjullaster',
  Lift: 'Lift',
  Asfaltutlegger: 'Asfaltutlegger',
  Bergboremaskin: 'Bergboremaskin',
  Borerigg: 'Borerigg',
  Hjuldoser: 'Hjuldoser',
  Pælemaskin: 'Pælemaskin',
  Spuntmaskin: 'Spuntmaskin',
  Vals: 'Vals',
  Annet: 'Annet',
};

// ========== GETTER FUNCTIONS ==========

/**
 * Generisk label-formatter factory
 * Returnerer label fra record, eller nøkkelen selv hvis ikke funnet
 */
function createLabelGetter(labels: Record<string, string>) {
  return (key: string | undefined | null): string => {
    if (!key) return '-';
    return labels[key] || key;
  };
}

export const getFravikGrunnLabel = createLabelGetter(FRAVIK_GRUNN_LABELS);
export const getDrivstoffLabel = createLabelGetter(DRIVSTOFF_LABELS);
export const getMaskinVektLabel = createLabelGetter(MASKIN_VEKT_LABELS);
export const getArbeidskategoriLabel = createLabelGetter(ARBEIDSKATEGORI_LABELS);
export const getBruksintensitetLabel = createLabelGetter(BRUKSINTENSITET_LABELS);
export const getFravikBeslutningLabel = createLabelGetter(FRAVIK_BESLUTNING_LABELS);
export const getFravikStatusLabel = createLabelGetter(FRAVIK_STATUS_LABELS);
export const getMaskinStatusLabel = createLabelGetter(MASKIN_STATUS_LABELS);
export const getMaskinTypeLabel = createLabelGetter(MASKIN_TYPE_LABELS);

/**
 * Formater liste av grunner til lesbar tekst
 */
export function formatFravikGrunner(grunner?: string[] | null): string {
  if (!grunner || grunner.length === 0) return '-';
  return grunner.map(getFravikGrunnLabel).join(', ');
}
