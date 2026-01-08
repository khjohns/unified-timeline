import React from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SakState } from '../types/timeline';
import type { DraftResponseData, BhResponsPakke, ApprovalStep } from '../types/approval';
import { ContractorClaimPdf, SignatureInfo } from './ContractorClaimPdf';
import { mergeDraftsIntoState } from '../utils/mergeDraftsIntoState';

interface DraftSet {
  grunnlagDraft?: DraftResponseData;
  vederlagDraft?: DraftResponseData;
  fristDraft?: DraftResponseData;
}

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

/**
 * Generate PDF with draft responses merged into state and trigger download
 *
 * Used in approval modals to preview PDF with pending BH responses
 * that haven't been formally sent yet.
 *
 * @param state - Current SakState
 * @param drafts - Draft responses to merge (grunnlag, vederlag, frist)
 */
export const downloadPdfWithDrafts = async (
  state: SakState,
  drafts: DraftSet
): Promise<void> => {
  const mergedState = mergeDraftsIntoState(state, drafts);
  await downloadContractorClaimPdf(mergedState);
};

/**
 * Format ISO date to Norwegian locale date string
 */
const formatDateNorwegian = (isoDate?: string): string => {
  if (!isoDate) return '';
  try {
    return new Date(isoDate).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Oslo',
    });
  } catch {
    return isoDate;
  }
};

/**
 * Get the last approver from the approval steps
 */
const getLastApprover = (steps: ApprovalStep[]): ApprovalStep | undefined => {
  const approvedSteps = steps.filter(s => s.status === 'approved');
  return approvedSteps[approvedSteps.length - 1];
};

/**
 * Extract signature info from BhResponsPakke
 */
const extractSignatureInfo = (pakke: BhResponsPakke): {
  saksbehandler: SignatureInfo;
  godkjenner: SignatureInfo;
} | undefined => {
  // Only extract if package is fully approved
  if (pakke.status !== 'approved') {
    return undefined;
  }

  const lastApprover = getLastApprover(pakke.steps);
  if (!lastApprover?.approvedBy) {
    return undefined;
  }

  // Parse saksbehandler info from submittedBy
  // Format is typically "Rollenavn (mock)" from ApprovalContext
  const submittedByMatch = pakke.submittedBy?.match(/^(.+?)\s*\(.*\)$/);
  const saksbehandlerRolle = submittedByMatch?.[1] ?? pakke.submittedBy ?? 'Saksbehandler';
  const saksbehandlerNavn = pakke.submittedBy?.replace(/\s*\(mock\)$/, '') ?? 'Saksbehandler';

  return {
    saksbehandler: {
      navn: saksbehandlerNavn,
      rolle: saksbehandlerRolle,
      dato: formatDateNorwegian(pakke.submittedAt),
    },
    godkjenner: {
      navn: lastApprover.approvedBy ?? 'Godkjenner',
      rolle: lastApprover.roleName,
      dato: formatDateNorwegian(lastApprover.approvedAt),
    },
  };
};

/**
 * Generate PDF with approval signatures and trigger download
 *
 * Used after a BhResponsPakke has been fully approved.
 * Includes signature fields for saksbehandler and godkjenner.
 *
 * @param state - Current SakState (should include merged BH responses)
 * @param pakke - The approved BhResponsPakke
 */
export const downloadApprovedPdf = async (
  state: SakState,
  pakke: BhResponsPakke
): Promise<{ blob: Blob; filename: string } | undefined> => {
  // Extract signature info - returns undefined if not fully approved
  const signatures = extractSignatureInfo(pakke);
  if (!signatures) {
    console.warn('Cannot generate approved PDF: package not fully approved');
    return undefined;
  }

  // Merge draft responses into state
  const drafts: DraftSet = {
    grunnlagDraft: pakke.grunnlagRespons,
    vederlagDraft: pakke.vederlagRespons,
    fristDraft: pakke.fristRespons,
  };
  const mergedState = mergeDraftsIntoState(state, drafts);

  // Create PDF document with signatures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = React.createElement(ContractorClaimPdf, {
    state: mergedState,
    saksbehandler: signatures.saksbehandler,
    godkjenner: signatures.godkjenner,
  }) as any;
  const blob = await pdf(doc).toBlob();

  // Generate filename with "Godkjent" suffix
  const dateSuffix = new Date().toISOString().split('T')[0];
  const sanitizedTitle = state.sakstittel
    ? state.sakstittel.replace(/[^a-zA-Z0-9æøåÆØÅ\-_]/g, '_').substring(0, 50)
    : '';
  const filename = `Entreprenorkrav_${state.sak_id}${sanitizedTitle ? '_' + sanitizedTitle : ''}_Godkjent_${dateSuffix}.pdf`;

  // Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);

  return { blob, filename };
};
