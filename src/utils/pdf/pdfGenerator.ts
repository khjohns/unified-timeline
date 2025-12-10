import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { SakState } from '../../types/timeline';
import { KoePdfDocument } from './pdfComponents';

/**
 * Generate PDF blob from SakState
 *
 * @param state - Current SakState computed from event log
 * @param version - Version number to include in filename
 * @returns Object containing the blob and filename
 */
export const generatePdfBlobFromState = async (
  state: SakState,
  version?: number
): Promise<{ blob: Blob; filename: string }> => {
  const blob = await pdf(React.createElement(KoePdfDocument, { state })).toBlob();

  const versionSuffix = version ? `_v${version}` : '';
  const dateSuffix = new Date().toISOString().split('T')[0];
  const filename = `KOE_${state.sak_id}${versionSuffix}_${dateSuffix}.pdf`;

  return { blob, filename };
};

/**
 * Convert blob to base64 for backend upload
 *
 * @param blob - PDF blob
 * @returns Base64-encoded string (without data URI prefix)
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove "data:application/pdf;base64," prefix
      resolve(base64.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
