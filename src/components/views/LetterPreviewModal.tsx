/**
 * LetterPreviewModal
 *
 * Modal for editing and previewing formal letters generated from response events.
 * Features section-based editing with reset capability.
 * Uses tabs for editor/preview navigation on all screen sizes.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { pdf } from '@react-pdf/renderer';
import { ResetIcon, DownloadIcon } from '@radix-ui/react-icons';
import { Modal, Button, Tabs } from '../primitives';
import { PdfPreview } from '../pdf/PdfPreview';
import { LetterDocument } from '../../pdf/LetterDocument';
import { buildLetterContent, isSeksjonEdited, resetSeksjon } from '../../utils/letterContentBuilder';
import type { TimelineEvent, SakState } from '../../types/timeline';
import type { BrevInnhold, BrevSeksjon } from '../../types/letter';
import clsx from 'clsx';

interface LetterPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TimelineEvent;
  sakState: SakState;
}

/**
 * Section editor component with reset button.
 */
interface SectionEditorProps {
  seksjon: BrevSeksjon;
  onChange: (tekst: string) => void;
  onReset: () => void;
}

function SectionEditor({ seksjon, onChange, onReset }: SectionEditorProps) {
  const isEdited = isSeksjonEdited(seksjon);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-pkt-text-body-default">
          {seksjon.tittel}
        </label>
        {isEdited && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-pkt-text-body-subtle hover:text-pkt-text-body-default transition-colors"
            title="Tilbakestill til original"
          >
            <ResetIcon className="w-3 h-3" />
            Nullstill
          </button>
        )}
      </div>
      <textarea
        value={seksjon.redigertTekst}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'w-full p-3 border rounded-md text-sm font-mono',
          'focus:outline-none focus:ring-2 focus:ring-editor-focus-ring',
          'resize-y min-h-[100px]',
          'text-pkt-text-body-default',
          isEdited
            ? 'border-editor-edited-border bg-editor-edited-bg'
            : 'border-pkt-border-default bg-pkt-bg-card'
        )}
        rows={seksjon.tittel === 'Begrunnelse' ? 10 : 5}
      />
      {isEdited && (
        <p className="mt-1 text-xs text-editor-edited-text">
          Redigert fra original
        </p>
      )}
    </div>
  );
}

/**
 * Main modal component.
 */
export function LetterPreviewModal({
  open,
  onOpenChange,
  event,
  sakState,
}: LetterPreviewModalProps) {
  // Initialize letter content from event
  const initialContent = useMemo(
    () => buildLetterContent(event, sakState),
    [event, sakState]
  );

  // State for editable content
  const [brevInnhold, setBrevInnhold] = useState<BrevInnhold>(initialContent);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  // Reset content when event changes
  useEffect(() => {
    setBrevInnhold(initialContent);
  }, [initialContent]);

  // Generate PDF when content changes
  const generatePdf = useCallback(async () => {
    setIsGenerating(true);
    setError(undefined);

    try {
      const blob = await pdf(<LetterDocument brevInnhold={brevInnhold} />).toBlob();
      setPdfBlob(blob);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      setError('Kunne ikke generere PDF. Vennligst prøv igjen.');
    } finally {
      setIsGenerating(false);
    }
  }, [brevInnhold]);

  // Generate PDF on mount and when content changes (debounced)
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      generatePdf();
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [open, brevInnhold, generatePdf]);

  // Section update handlers
  const updateSeksjon = useCallback(
    (key: 'innledning' | 'begrunnelse' | 'avslutning', tekst: string) => {
      setBrevInnhold((prev) => ({
        ...prev,
        seksjoner: {
          ...prev.seksjoner,
          [key]: {
            ...prev.seksjoner[key],
            redigertTekst: tekst,
          },
        },
      }));
    },
    []
  );

  const resetSeksjonHandler = useCallback(
    (key: 'innledning' | 'begrunnelse' | 'avslutning') => {
      setBrevInnhold((prev) => ({
        ...prev,
        seksjoner: {
          ...prev.seksjoner,
          [key]: resetSeksjon(prev.seksjoner[key]),
        },
      }));
    },
    []
  );

  // Download handler
  const handleDownload = useCallback(() => {
    if (!pdfBlob) return;

    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `brev-${sakState.sak_id}-${brevInnhold.referanser.sporType}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [pdfBlob, sakState.sak_id, brevInnhold.referanser.sporType]);

  const handleClose = () => onOpenChange(false);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Generer brev"
      description={brevInnhold.tittel}
      size="lg"
    >
      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'editor', label: 'Rediger' },
          { id: 'preview', label: 'Forhåndsvis' },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as 'editor' | 'preview')}
        className="mb-4"
      />

      {/* Tab content */}
      {activeTab === 'editor' ? (
        <div className="space-y-2">
          <SectionEditor
            seksjon={brevInnhold.seksjoner.innledning}
            onChange={(tekst) => updateSeksjon('innledning', tekst)}
            onReset={() => resetSeksjonHandler('innledning')}
          />

          <SectionEditor
            seksjon={brevInnhold.seksjoner.begrunnelse}
            onChange={(tekst) => updateSeksjon('begrunnelse', tekst)}
            onReset={() => resetSeksjonHandler('begrunnelse')}
          />

          <SectionEditor
            seksjon={brevInnhold.seksjoner.avslutning}
            onChange={(tekst) => updateSeksjon('avslutning', tekst)}
            onReset={() => resetSeksjonHandler('avslutning')}
          />
        </div>
      ) : (
        <PdfPreview
          blob={pdfBlob}
          isLoading={isGenerating}
          error={error}
          height="calc(85dvh - 280px)"
          filename={`brev-${sakState.sak_id}.pdf`}
        />
      )}

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-pkt-border-subtle mt-4">
        <Button variant="secondary" onClick={handleClose}>
          Avbryt
        </Button>
        <Button
          variant="primary"
          onClick={handleDownload}
          disabled={!pdfBlob || isGenerating}
        >
          <DownloadIcon className="w-4 h-4 mr-2" />
          Last ned PDF
        </Button>
      </div>
    </Modal>
  );
}

export default LetterPreviewModal;
