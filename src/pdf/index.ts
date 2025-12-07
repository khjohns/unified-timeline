/**
 * PDF Generation Module
 *
 * Provides PDF generation for contractor claims (entreprenørkrav) based on SakState.
 * Uses @react-pdf/renderer with Oslo Kommune design system.
 *
 * Key features:
 * - Shows only the latest revision of each track (Grunnlag, Vederlag, Frist)
 * - Clearly indicates when Vederlag or Frist claims are not filed
 * - Includes all legally relevant information (descriptions, justifications, etc.)
 * - Follows Oslo Kommune branding (Oslo Sans font, official color palette)
 *
 * Usage:
 * ```typescript
 * import { generateContractorClaimPdf, downloadContractorClaimPdf } from '@/pdf';
 *
 * // Generate blob for backend upload
 * const { blob, filename } = await generateContractorClaimPdf(sakState);
 *
 * // Generate and download in browser
 * await downloadContractorClaimPdf(sakState);
 * ```
 */

// Main PDF component
export { ContractorClaimPdf } from './ContractorClaimPdf';
export type { ContractorClaimPdfProps } from './ContractorClaimPdf';

// Generator functions
export {
  generateContractorClaimPdf,
  downloadContractorClaimPdf,
  blobToBase64,
} from './generator';

// Styles and colors (for advanced customization)
export { styles, COLORS, PDF_FONT, baseUrl } from './styles';
