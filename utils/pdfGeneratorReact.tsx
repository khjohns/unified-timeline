/**
 * PDF Generator - Stub Module
 *
 * TEMPORARY: This module has been stubbed out during Phase 1 of the frontend
 * greenfield implementation. PDF generation will be re-implemented in a later
 * phase if needed.
 *
 * The @react-pdf/renderer package has been removed as part of the new architecture.
 */

// Stub exports to maintain backwards compatibility during migration
export const generatePdfReact = async (_formData: any) => {
  console.warn('PDF generation temporarily disabled during frontend migration');
  throw new Error('PDF generation is not available in this version');
};

export const generatePdfBlob = async (_formData: any): Promise<Blob> => {
  console.warn('PDF generation temporarily disabled during frontend migration');
  throw new Error('PDF generation is not available in this version');
};

export const COLORS = {};
export const styles = {};
export const KoePdfDocument = null;
