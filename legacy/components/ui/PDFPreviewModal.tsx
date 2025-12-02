import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// KRITISK for Safari-kompatibilitet - bruk lokal worker, ikke CDN
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
// Wrap in try-catch to prevent crashes in headless browsers during E2E tests
try {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch (error) {
  console.warn('Failed to set PDF worker:', error);
}

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;  // Callback for confirming and submitting
  pdfBlob: Blob | null;
  type: 'varsel' | 'koe' | 'svar' | 'revidering';
  isSubmitting?: boolean;  // To show loading state on confirm button
}

const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  pdfBlob,
  type,
  isSubmitting = false
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [width, setWidth] = useState(600);

  // Convert Blob to URL
  useEffect(() => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

      // Cleanup when component unmounts
      return () => URL.revokeObjectURL(url);
    }
  }, [pdfBlob]);

  // Dynamic width for responsiveness
  useEffect(() => {
    const updateWidth = () => {
      const maxWidth = Math.min(window.innerWidth - 80, 800);
      setWidth(maxWidth);
    };
    window.addEventListener('resize', updateWidth);
    updateWidth();
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getTitleAndIcon = () => {
    switch (type) {
      case 'varsel':
        return { title: 'Forhåndsvis varsel', icon: '📨' };
      case 'koe':
        return { title: 'Forhåndsvis krav', icon: '📋' };
      case 'svar':
        return { title: 'Forhåndsvis svar', icon: '✍️' };
      case 'revidering':
        return { title: 'Forhåndsvis revisjon', icon: '🔄' };
      default:
        return { title: 'Forhåndsvisning', icon: '📄' };
    }
  };

  const { title, icon } = getTitleAndIcon();

  const handleDownload = () => {
    if (!pdfBlob) return;

    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    const filename = `${type.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Modal */}
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">{icon}</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-ink">{title}</h2>
              <p className="text-sm text-gray-600">Kontroller PDF-en før du sender inn</p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Lukk"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* PDF Container */}
        <div className="flex-1 overflow-y-auto p-6">
          {pdfUrl ? (
            <div className="flex flex-col items-center gap-4">
              <Document
                file={pdfUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pri"></div>
                  </div>
                }
                error={
                  <div className="text-center p-8 text-red-600">
                    <p className="font-medium">Feil ved lasting av PDF</p>
                    <p className="text-sm mt-2">Prøv å laste ned filen i stedet</p>
                  </div>
                }
              >
                {numPages &&
                  Array.from(new Array(numPages), (_, index) => (
                    <div key={`page_${index + 1}`} className="mb-4 shadow-lg">
                      <Page
                        pageNumber={index + 1}
                        width={width}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                      />
                    </div>
                  ))}
              </Document>
            </div>
          ) : (
            <div className="flex items-center justify-center p-8 text-gray-500">
              Ingen PDF tilgjengelig
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Avbryt
          </button>

          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-6 py-2 bg-pri text-white rounded hover:bg-pri-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sender...
              </>
            ) : (
              'Bekreft og send inn'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFPreviewModal;
