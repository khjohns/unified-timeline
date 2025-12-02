import {
  getSakStatusLabel,
  getKravStatusLabel,
  getSvarStatusLabel,
} from './statusHelpers';
import {
  getVederlagsmetoderLabel as getVederlagsmetoderLabelGenerated,
  getBhVederlagSvarLabel as getBhVederlagSvarLabelGenerated,
  getBhFristSvarLabel as getBhFristSvarLabelGenerated,
} from './generatedConstants';

/**
 * Mapper hovedkategori-verdi til lesbar tekst
 * Simplified version - returns value as-is or fallback
 */
export const getHovedkategoriLabel = (value: string): string => {
  if (!value) return '—';
  // Return the value as-is since we don't have the OPTIONS array anymore
  return value;
};

/**
 * Mapper underkategori-verdi til lesbar tekst
 * Simplified version - returns value as-is or fallback
 */
export const getUnderkategoriLabel = (hovedkategori: string, value: string): string => {
  if (!value || !hovedkategori) return '—';
  // Return the value as-is since we don't have the UNDERKATEGORI_MAP anymore
  return value;
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
  return getVederlagsmetoderLabelGenerated(value);
};

/**
 * Mapper BH vederlagssvar-verdi til lesbar tekst
 */
export const getBhVederlagssvarLabel = (value: string): string => {
  if (!value) return '—';
  return getBhVederlagSvarLabelGenerated(value);
};

/**
 * Mapper BH fristsvar-verdi til lesbar tekst
 */
export const getBhFristsvarLabel = (value: string): string => {
  if (!value) return '—';
  return getBhFristSvarLabelGenerated(value);
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
