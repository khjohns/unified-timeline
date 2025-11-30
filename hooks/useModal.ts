import { useState, useCallback } from 'react';

export interface ModalState {
  isOpen: boolean;
  type: 'varsel' | 'koe' | 'svar' | 'revidering';
  message?: string;
  nextStep?: string;
  pdfBlob: Blob | null;
}

interface UseModalReturn {
  modal: ModalState;
  openModal: (blob: Blob, type: 'varsel' | 'koe' | 'svar' | 'revidering', message?: string, nextStep?: string) => void;
  closeModal: () => void;
  setModal: (state: ModalState) => void;
}

/**
 * Custom hook for modal state management
 *
 * Manages PDF preview modal state including:
 * - Open/close state
 * - PDF blob content
 * - Modal type (varsel/koe/svar/revidering)
 * - Optional message and next step text
 *
 * @returns Modal state and control functions
 *
 * @example
 * ```tsx
 * const { modal, openModal, closeModal } = useModal();
 *
 * // Open modal with PDF
 * openModal(pdfBlob, 'koe', 'Krav sendt', 'Venter på svar fra BH');
 *
 * // Close modal
 * closeModal();
 * ```
 */
export const useModal = (): UseModalReturn => {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: 'koe',
    pdfBlob: null,
  });

  const openModal = useCallback((
    blob: Blob,
    type: 'varsel' | 'koe' | 'svar' | 'revidering',
    message?: string,
    nextStep?: string
  ) => {
    setModal({
      isOpen: true,
      type,
      pdfBlob: blob,
      message,
      nextStep,
    });
  }, []);

  const closeModal = useCallback(() => {
    setModal({
      isOpen: false,
      type: 'koe',
      pdfBlob: null,
    });
  }, []);

  return {
    modal,
    openModal,
    closeModal,
    setModal,
  };
};
