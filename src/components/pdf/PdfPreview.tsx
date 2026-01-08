/**
 * PdfPreview Component
 *
 * Displays a PDF preview from a blob with page navigation and download functionality.
 * Uses react-pdf for rendering.
 */

import { useState, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ReloadIcon, DownloadIcon } from '@radix-ui/react-icons';
import { Button } from '../primitives';
import clsx from 'clsx';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker - uses the file copied by vite-plugin-static-copy
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfPreviewProps {
  blob: Blob | null;
  isLoading: boolean;
  error?: string;
  height?: string;
  filename?: string;
  className?: string;
  onClose?: () => void;
}

export function PdfPreview({
  blob,
  isLoading,
  error,
  height = '500px',
  filename = 'dokument.pdf',
  className,
  onClose,
}: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Create and cleanup object URL from blob
  useEffect(() => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    setPdfUrl(null);
    return undefined;
  }, [blob]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    setPdfError(`Kunne ikke laste PDF: ${error.message}`);
  };

  const handleDownload = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Create array of page numbers for rendering all pages
  const pageNumbers = useMemo(() =>
    Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages]
  );

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx('flex flex-col items-center justify-center gap-4 py-12', className)}
        style={{ height }}
      >
        <ReloadIcon className="w-8 h-8 animate-spin text-pkt-brand-purple-1000" />
        <p className="text-sm text-pkt-text-body-default">Genererer PDF...</p>
      </div>
    );
  }

  // Error state
  if (error || pdfError) {
    return (
      <div
        className={clsx('flex flex-col items-center justify-center gap-4 py-12 text-center', className)}
        style={{ height }}
      >
        <p className="text-sm text-pkt-text-danger">{error || pdfError}</p>
        <p className="text-xs text-pkt-text-body-muted">
          Prøv å oppdatere siden eller kontakt support hvis problemet vedvarer.
        </p>
      </div>
    );
  }

  // No blob yet
  if (!pdfUrl) {
    return (
      <div
        className={clsx('flex items-center justify-center py-12', className)}
        style={{ height }}
      >
        <p className="text-sm text-pkt-text-body-muted">Ingen PDF tilgjengelig</p>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col', className)}>
      {/* PDF Viewer - all pages */}
      <div
        className="border border-pkt-border-subtle bg-pkt-grays-gray-100 overflow-auto"
        style={{ height }}
      >
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center justify-center h-full py-12">
              <ReloadIcon className="w-6 h-6 animate-spin text-pkt-brand-purple-1000" />
            </div>
          }
        >
          <div className="flex flex-col items-center gap-4 py-4">
            {pageNumbers.map((pageNum) => (
              <Page
                key={pageNum}
                pageNumber={pageNum}
                width={580}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            ))}
          </div>
        </Document>
      </div>

      {/* Controls - at bottom */}
      <div className="flex items-center justify-between pt-4 border-t border-pkt-border-subtle mt-4">
        <span className="text-sm text-pkt-text-body-muted">
          {numPages > 0 ? `${numPages} ${numPages === 1 ? 'side' : 'sider'}` : ''}
        </span>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleDownload}>
            <DownloadIcon className="w-4 h-4 mr-2" />
            Last ned PDF
          </Button>
          {onClose && (
            <Button variant="secondary" onClick={onClose}>
              Lukk
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
