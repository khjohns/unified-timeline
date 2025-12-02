import React, { useEffect } from 'react';
import { PktButton } from '@oslokommune/punkt-react';

interface BegrunnelseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  revisjon: string;
  begrunnelse: string;
}

const BegrunnelseModal: React.FC<BegrunnelseModalProps> = ({
  isOpen,
  onClose,
  title,
  revisjon,
  begrunnelse,
}) => {
  // Keyboard support (Escape)
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border-color px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink-dim">{title}</h2>
            <p className="text-sm text-muted mt-1">{revisjon}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink transition-colors p-2"
            aria-label="Lukk"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
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

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {begrunnelse ? (
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-ink leading-relaxed">
                {begrunnelse}
              </p>
            </div>
          ) : (
            <p className="text-muted italic">Ingen begrunnelse registrert</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border-color px-6 py-4 flex justify-end">
          <PktButton onClick={onClose} skin="secondary" size="small">
            Lukk
          </PktButton>
        </div>
      </div>
    </div>
  );
};

export default BegrunnelseModal;
