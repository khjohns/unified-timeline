import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// KRITISK for Safari-kompatibilitet - bruk lokal worker, ikke CDN
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBlob: Blob | null;
  type: 'varsel' | 'koe' | 'svar' | 'revidering';
  message?: string;
  nextStep?: string;
}

const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  isOpen,
  onClose,
  pdfBlob,
  type,
  message,
  nextStep
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
        return { title: 'Varsel sendt!', icon: '📨' };
      case 'koe':
        return { title: 'Krav sendt!', icon: '📋' };
      case 'svar':
        return { title: 'Svar sendt!', icon: '✍️' };
      case 'revidering':
        return { title: 'Revisjon sendt!', icon: '🔄' };
      default:
        return { title: 'Sendt!', icon: '✅' };
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
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">{icon}</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-ink">{title}</h2>
              {message && <p className="text-sm text-gray-600">{message}</p>}
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

        {/* Next Step Info */}
        {nextStep && (
          <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm font-medium text-blue-900 mb-1">
              Neste steg:
            </p>
            <p className="text-sm text-blue-800">{nextStep}</p>
          </div>
        )}

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
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 text-pri border border-pri rounded hover:bg-pri hover:text-white transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Last ned PDF
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2 bg-pri text-white rounded hover:bg-pri-dark transition-colors font-medium"
          >
            Lukk
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFPreviewModal;
