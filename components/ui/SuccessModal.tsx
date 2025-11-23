import React, { useEffect } from 'react';

export interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'varsel' | 'koe' | 'svar' | 'revidering';
  message?: string;
  nextStep?: string;
  pdfUrl?: string;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  type,
  message,
  nextStep,
  pdfUrl
}) => {
  // Prevent backdrop clicks immediately after opening (to avoid click-through from submit button)
  const [allowBackdropClick, setAllowBackdropClick] = React.useState(false);

  // Reset backdrop click flag when modal opens
  useEffect(() => {
    if (isOpen) {
      setAllowBackdropClick(false);
      // Allow backdrop clicks after a short delay
      const timer = setTimeout(() => {
        setAllowBackdropClick(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (allowBackdropClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-modal-title"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
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

        {/* Content */}
        <div className="text-center p-8">
          {/* Icon */}
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">{icon}</span>
          </div>

          {/* Title */}
          <h2
            id="success-modal-title"
            className="text-2xl font-semibold text-ink mb-3"
          >
            {title}
          </h2>

          {/* Message */}
          {message && (
            <p className="text-gray-600 mb-6">{message}</p>
          )}

          {/* Next Step */}
          {nextStep && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6 text-left">
              <p className="text-sm font-medium text-blue-900 mb-1">
                Neste steg:
              </p>
              <p className="text-sm text-blue-800">{nextStep}</p>
            </div>
          )}

          {/* PDF Download Link */}
          {pdfUrl && (
            <div className="mb-6">
              <a
                href={pdfUrl}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 underline text-sm"
                download
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
                Last ned PDF-kopi
              </a>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-pri text-white rounded hover:bg-pri-dark transition-colors font-medium"
          >
            Lukk
          </button>
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes scale-in {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default SuccessModal;
