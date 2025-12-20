import React from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SakState } from '../types/timeline';
import { ContractorClaimPdf } from './ContractorClaimPdf';

/**
 * Generate PDF blob from SakState
 *
 * Creates a PDF document containing the latest revision of:
 * - Grunnlag (foundation/basis)
 * - Vederlagsjustering (compensation claim) - or indication that no claim was filed
 * - Fristforlengelse (deadline extension) - or indication that no claim was filed
 *
 * @param state - Current SakState computed from event log
 * @returns Object containing the blob and suggested filename
 */
export const generateContractorClaimPdf = async (
  state: SakState
): Promise<{ blob: Blob; filename: string }> => {
  // Create PDF document
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = React.createElement(ContractorClaimPdf, { state }) as any;
  const blob = await pdf(doc).toBlob();

  // Generate filename
  const dateSuffix = new Date().toISOString().split('T')[0];
  const sanitizedTitle = state.sakstittel
    ? state.sakstittel.replace(/[^a-zA-Z0-9æøåÆØÅ\-_]/g, '_').substring(0, 50)
    : '';
  const filename = `Entreprenorkrav_${state.sak_id}${sanitizedTitle ? '_' + sanitizedTitle : ''}_${dateSuffix}.pdf`;

  return { blob, filename };
};

/**
 * Generate PDF and trigger download in browser
 *
 * @param state - Current SakState
 * @returns Object containing the blob and filename (for potential backend upload)
 */
export const downloadContractorClaimPdf = async (
  state: SakState
): Promise<{ blob: Blob; filename: string }> => {
  const { blob, filename } = await generateContractorClaimPdf(state);

  // Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);

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
      resolve(base64.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
