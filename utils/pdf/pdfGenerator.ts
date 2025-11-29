import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { FormDataModel } from '../../types';
import { KoePdfDocument } from './pdfComponents';

/**
 * Generate PDF and download locally
 *
 * @param data - Form data to generate PDF from
 * @returns Object containing the blob and filename
 */
export const generatePdfReact = async (data: FormDataModel): Promise<{ blob: Blob; filename: string }> => {
  const blob = await pdf(React.createElement(KoePdfDocument, { data })).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const filename = `KOE_${data.sak.sak_id_display || 'rapport'}_${new Date().toISOString().split('T')[0]}.pdf`;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);

  // Return blob and filename for potential upload to backend
  return { blob, filename };
};

/**
 * Generate PDF blob without downloading (for backend upload only)
 *
 * @param data - Form data to generate PDF from
 * @returns Object containing the blob and filename
 */
export const generatePdfBlob = async (data: FormDataModel): Promise<{ blob: Blob; filename: string }> => {
  const blob = await pdf(React.createElement(KoePdfDocument, { data })).toBlob();
  const filename = `KOE_${data.sak.sak_id_display || 'rapport'}_${new Date().toISOString().split('T')[0]}.pdf`;
  return { blob, filename };
};
