/**
 * PDF Generator - Facade Module
 *
 * This file now serves as a facade that re-exports functionality from the
 * split PDF module in utils/pdf/. This maintains backwards compatibility
 * with existing imports.
 *
 * The original 1055-line file has been split into:
 * - utils/pdf/pdfStyles.ts - Colors and StyleSheet definitions
 * - utils/pdf/pdfComponents.tsx - All React PDF components
 * - utils/pdf/pdfGenerator.ts - PDF generation functions
 *
 * For new code, prefer importing directly from utils/pdf/
 */

// Re-export generator functions (main exports)
export { generatePdfReact, generatePdfBlob } from './pdf';

// Re-export styles and colors for potential external use
export { COLORS, styles } from './pdf';

// Re-export document component for testing or direct rendering
export { KoePdfDocument } from './pdf';
