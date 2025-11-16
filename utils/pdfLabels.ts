import {
  HOVEDKATEGORI_OPTIONS,
  UNDERKATEGORI_MAP,
  VEDERLAGSMETODER_OPTIONS,
  BH_VEDERLAGSSVAR_OPTIONS,
  BH_FRISTSVAR_OPTIONS,
} from '../constants';
import {
  getSakStatusLabel,
  getKravStatusLabel,
  getSvarStatusLabel,
} from './statusHelpers';

/**
 * Mapper hovedkategori-verdi til lesbar tekst
 */
export const getHovedkategoriLabel = (value: string): string => {
  if (!value) return '—';
  const option = HOVEDKATEGORI_OPTIONS.find((opt) => opt.value === value);
  return option ? option.label : value;
};

/**
 * Mapper underkategori-verdi til lesbar tekst
 */
export const getUnderkategoriLabel = (hovedkategori: string, value: string): string => {
  if (!value || !hovedkategori) return '—';

  const underkategorier = UNDERKATEGORI_MAP[hovedkategori];
  if (!underkategorier) return value;

  const option = underkategorier.find((opt) => opt.value === value);
  return option ? option.label : value;
};

/**
 * Mapper flere underkategorier til lesbare tekster (for array av verdier)
 */
export const getUnderkategorierLabels = (hovedkategori: string, values: string[] | string): string => {
  if (!values) return '—';

  // Håndter både array og enkeltverdi (string)
  const valueArray = Array.isArray(values) ? values : [values];

  if (valueArray.length === 0) return '—';

  const labels = valueArray.map(value => getUnderkategoriLabel(hovedkategori, value));
  return labels.join(', ');
};

/**
 * Mapper vederlagsmetode-verdi til lesbar tekst
 */
export const getVederlagsmetodeLabel = (value: string): string => {
  if (!value) return '—';
  const option = VEDERLAGSMETODER_OPTIONS.find((opt) => opt.value === value);
  return option ? option.label : value;
};

/**
 * Mapper BH vederlagssvar-verdi til lesbar tekst
 */
export const getBhVederlagssvarLabel = (value: string): string => {
  if (!value) return '—';
  const option = BH_VEDERLAGSSVAR_OPTIONS.find((opt) => opt.value === value);
  return option ? option.label : value;
};

/**
 * Mapper BH fristsvar-verdi til lesbar tekst
 */
export const getBhFristsvarLabel = (value: string): string => {
  if (!value) return '—';
  const option = BH_FRISTSVAR_OPTIONS.find((opt) => opt.value === value);
  return option ? option.label : value;
};

/**
 * Samlet funksjon for alle label-mappinger
 * Eksporteres for enkel bruk i PDF-generatoren
 */
export const pdfLabels = {
  sakStatus: getSakStatusLabel,
  kravStatus: getKravStatusLabel,
  svarStatus: getSvarStatusLabel,
  hovedkategori: getHovedkategoriLabel,
  underkategori: getUnderkategoriLabel,
  underkategorier: getUnderkategorierLabels,
  vederlagsmetode: getVederlagsmetodeLabel,
  bhVederlagssvar: getBhVederlagssvarLabel,
  bhFristsvar: getBhFristsvarLabel,
};
