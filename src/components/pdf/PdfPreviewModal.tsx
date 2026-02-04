/**
 * PdfPreviewModal Component
 *
 * Modal wrapper for PDF preview with draft responses.
 * Generates PDF when modal opens and displays it in PdfPreview.
 */

import { useState, useEffect } from 'react';
import { Modal } from '../primitives';
import { PdfPreview } from './PdfPreview';
import { generateContractorClaimPdf } from '../../pdf/generator';
import { mergeDraftsIntoState } from '../../utils/mergeDraftsIntoState';
import type { SakState } from '../../types/timeline';
import type { DraftResponseData } from '../../types/approval';

interface DraftSet {
  grunnlagDraft?: DraftResponseData;
  vederlagDraft?: DraftResponseData;
  fristDraft?: DraftResponseData;
}

interface PdfPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakState: SakState;
  drafts?: DraftSet;
  title?: string;
}

export function PdfPreviewModal({
  open,
  onOpenChange,
  sakState,
  drafts,
  title = 'Krav om endringsordre',
}: PdfPreviewModalProps) {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate PDF when modal opens
  useEffect(() => {
    if (open && !pdfBlob && !isGenerating) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Trigger async PDF generation
      setIsGenerating(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);

      // Merge drafts if provided
      const stateToRender = drafts
        ? mergeDraftsIntoState(sakState, drafts)
        : sakState;

      generateContractorClaimPdf(stateToRender)
        .then(({ blob }) => setPdfBlob(blob))
        .catch((err) => setError(err instanceof Error ? err.message : 'Ukjent feil'))
        .finally(() => setIsGenerating(false));
    }
  }, [open, pdfBlob, isGenerating, sakState, drafts]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset on modal close
      setPdfBlob(null);
       
      setError(null);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="xl"
    >
      <PdfPreview
        blob={pdfBlob}
        isLoading={isGenerating}
        error={error ?? undefined}
        height="calc(85dvh - 240px)"
        filename={`BH-respons_${sakState.sak_id}.pdf`}
        onClose={() => onOpenChange(false)}
      />
    </Modal>
  );
}
