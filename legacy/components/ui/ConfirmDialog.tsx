import React, { useEffect } from 'react';
import { PktButton, PktAlert } from '@oslokommune/punkt-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  skin?: 'info' | 'success' | 'warning' | 'error';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Bekreft',
  cancelText = 'Avbryt',
  skin = 'warning',
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

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h2
          id="confirm-dialog-title"
          className="text-xl font-semibold text-ink mb-4"
        >
          {title}
        </h2>

        <PktAlert skin={skin} compact>
          <span>{message}</span>
        </PktAlert>

        <div className="flex gap-3 justify-end mt-6">
          <PktButton
            skin="tertiary"
            onClick={onClose}
          >
            {cancelText}
          </PktButton>
          <PktButton
            skin="primary"
            onClick={handleConfirm}
          >
            {confirmText}
          </PktButton>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
