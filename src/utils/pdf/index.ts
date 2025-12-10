/**
 * PDF Generation Module
 *
 * Exports PDF generation functionality for the KOE application.
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
  KoePdfDocument,
} from './pdfComponents';

// Export generator functions
export { generatePdfBlobFromState, blobToBase64 } from './pdfGenerator';
