/**
 * PDF Generation Module
 *
 * This module exports all PDF-related functionality for the KOE application.
 * The code has been split from the original pdfGeneratorReact.tsx (1055 lines)
 * into smaller, more maintainable files:
 *
 * - pdfStyles.ts: Colors and StyleSheet definitions
 * - pdfComponents.tsx: All React PDF components
 * - pdfGenerator.ts: PDF generation functions
 */

// Export styles and colors
export { COLORS, styles, baseUrl, PDF_FONT } from './pdfStyles';

// Export components
export {
  Header,
  Footer,
  MetadataFooter,
  TableRow,
  TextBlock,
  StatusBadge,
  SignatureBlock,
  AttachmentsSection,
  ExecutiveSummary,
  TitlePage,
  SummarySection,
  VarselSection,
  KoeRevisionSection,
  BhSvarRevisionSection,
  KoePdfDocument,
} from './pdfComponents';

// Export generator functions
export { generatePdfReact, generatePdfBlob } from './pdfGenerator';
