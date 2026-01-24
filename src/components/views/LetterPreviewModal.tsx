/**
 * LetterPreviewModal
 *
 * Modal for editing and previewing formal letters generated from response events.
 * Features section-based editing with reset capability.
 * Responsive: side-by-side on desktop, tabs on mobile.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { pdf } from '@react-pdf/renderer';
import { ResetIcon, DownloadIcon, Cross2Icon, Pencil1Icon, FileTextIcon } from '@radix-ui/react-icons';
import { Button, Tabs } from '../primitives';
import { PdfPreview } from '../pdf/PdfPreview';
import { LetterDocument } from '../../pdf/LetterDocument';
import { buildLetterContent, isSeksjonEdited, resetSeksjon } from '../../utils/letterContentBuilder';
import type { TimelineEvent, SakState } from '../../types/timeline';
import type { BrevInnhold, BrevSeksjon } from '../../types/letter';
import clsx from 'clsx';

interface LetterPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  isOpen,
  onClose,
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
  // Tab state for mobile view
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
    if (!isOpen) return;

    const timer = setTimeout(() => {
      generatePdf();
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [isOpen, brevInnhold, generatePdf]);

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

  if (!isOpen) return null;

  // Editor content (shared between desktop and mobile)
  const editorContent = (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-pkt-text-body-default mb-4 hidden md:block">
        Rediger brevinnhold
      </h3>

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
  );

  // Preview content (shared between desktop and mobile)
  const previewContent = (
    <>
      <h3 className="text-sm font-semibold text-pkt-text-body-default mb-4 hidden md:block">
        Forhåndsvisning
      </h3>
      <PdfPreview
        blob={pdfBlob}
        isLoading={isGenerating}
        error={error}
        height="calc(100% - 40px)"
        filename={`brev-${sakState.sak_id}.pdf`}
      />
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-pkt-bg-canvas rounded-lg shadow-xl w-[95vw] max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-pkt-border-subtle">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-pkt-text-body-default">
              Generer brev
            </h2>
            <p className="text-sm text-pkt-text-body-subtle truncate">
              {brevInnhold.tittel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-pkt-text-body-subtle hover:text-pkt-text-body-default rounded-md hover:bg-pkt-bg-subtle transition-colors ml-2"
            aria-label="Lukk"
          >
            <Cross2Icon className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile tabs - only visible on small screens */}
        <div className="md:hidden px-4 pt-3">
          <Tabs
            tabs={[
              { id: 'editor', label: 'Rediger', icon: <Pencil1Icon className="w-4 h-4" /> },
              { id: 'preview', label: 'Forhåndsvis', icon: <FileTextIcon className="w-4 h-4" /> },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as 'editor' | 'preview')}
          />
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Mobile: Tab content */}
          <div className="md:hidden flex-1 overflow-y-auto">
            {activeTab === 'editor' ? (
              <div className="p-4">
                {editorContent}
              </div>
            ) : (
              <div className="p-4 h-full bg-pkt-bg-subtle">
                {previewContent}
              </div>
            )}
          </div>

          {/* Desktop: Side-by-side layout */}
          <div className="hidden md:flex flex-1">
            {/* Left: Editor */}
            <div className="w-1/2 p-6 overflow-y-auto border-r border-pkt-border-subtle">
              {editorContent}
            </div>

            {/* Right: PDF Preview */}
            <div className="w-1/2 p-6 bg-pkt-bg-subtle overflow-y-auto">
              {previewContent}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 md:px-6 py-4 border-t border-pkt-border-subtle">
          <Button variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            onClick={handleDownload}
            disabled={!pdfBlob || isGenerating}
          >
            <DownloadIcon className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Last ned PDF</span>
            <span className="sm:hidden">Last ned</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default LetterPreviewModal;
