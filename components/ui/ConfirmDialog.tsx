import React from 'react';
import { PktButton, PktAlert, PktModal } from '@oslokommune/punkt-react';

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
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <PktModal
      isOpen={isOpen}
      onClose={onClose}
      headingText={title}
      closeOnBackdropClick={true}
      size="medium"
    >
      <div className="space-y-6">
        <PktAlert skin={skin} compact>
          <span>{message}</span>
        </PktAlert>

        <div className="flex gap-3 justify-end">
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
    </PktModal>
  );
};

export default ConfirmDialog;
