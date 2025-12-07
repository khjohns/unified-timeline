import { useState, useCallback } from 'react';

interface UseConfirmCloseOptions {
  /** Whether the form has unsaved changes */
  isDirty: boolean;
  /** Function to reset the form state */
  onReset: () => void;
  /** Function to close the modal */
  onClose: () => void;
}

interface UseConfirmCloseReturn {
  /** Whether the confirmation dialog is open */
  showConfirmDialog: boolean;
  /** Set the confirmation dialog open state */
  setShowConfirmDialog: (show: boolean) => void;
  /** Handle the cancel/close button click - shows confirmation if dirty */
  handleClose: () => void;
  /** Confirm closing and reset the form */
  confirmClose: () => void;
}

/**
 * Hook for handling form close confirmation when there are unsaved changes.
 *
 * Usage:
 * ```tsx
 * const { isDirty } = formState;
 * const { showConfirmDialog, setShowConfirmDialog, handleClose, confirmClose } = useConfirmClose({
 *   isDirty,
 *   onReset: reset,
 *   onClose: () => onOpenChange(false),
 * });
 *
 * // In your JSX:
 * <Button onClick={handleClose}>Avbryt</Button>
 *
 * <AlertDialog
 *   open={showConfirmDialog}
 *   onOpenChange={setShowConfirmDialog}
 *   title="Forkast endringer?"
 *   description="Du har ulagrede endringer som vil gå tapt."
 *   confirmLabel="Forkast"
 *   cancelLabel="Fortsett redigering"
 *   onConfirm={confirmClose}
 *   variant="warning"
 * />
 * ```
 */
export function useConfirmClose({
  isDirty,
  onReset,
  onClose,
}: UseConfirmCloseOptions): UseConfirmCloseReturn {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowConfirmDialog(true);
    } else {
      onReset();
      onClose();
    }
  }, [isDirty, onReset, onClose]);

  const confirmClose = useCallback(() => {
    setShowConfirmDialog(false);
    onReset();
    onClose();
  }, [onReset, onClose]);

  return {
    showConfirmDialog,
    setShowConfirmDialog,
    handleClose,
    confirmClose,
  };
}
