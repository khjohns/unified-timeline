import React from 'react';
import { PktButton } from '@oslokommune/punkt-react';

interface BottomBarProps {
  onReset: () => void;
  onDownloadPdf: () => void;
  onDemo: () => void;
  onSubmit: () => void;
  isApiConnected: boolean | null;
  isSubmitting: boolean;
  submitButtonText: React.ReactNode;
}

/**
 * Bottom action bar component
 *
 * Renders the bottom navigation bar with action buttons:
 * - Reset button (clears form)
 * - Download PDF button
 * - Load demo data button
 * - Submit button (only shown when API is connected)
 *
 * @param onReset - Callback when reset button is clicked
 * @param onDownloadPdf - Callback when download PDF button is clicked
 * @param onDemo - Callback when demo button is clicked
 * @param onSubmit - Callback when submit button is clicked
 * @param isApiConnected - Whether API is connected
 * @param isSubmitting - Whether form is currently submitting
 * @param submitButtonText - Text/component to display in submit button
 */
const BottomBar: React.FC<BottomBarProps> = ({
  onReset,
  onDownloadPdf,
  onDemo,
  onSubmit,
  isApiConnected,
  isSubmitting,
  submitButtonText,
}) => {
  return (
    <div className="px-4 sm:px-0" role="navigation" aria-label="Steg navigasjon">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <button
          onClick={onReset}
          className="text-sm text-red-600 hover:text-red-700 hover:underline"
        >
          Nullstill
        </button>
        <div className="flex gap-3 flex-wrap items-center">
          <PktButton
            skin="secondary"
            size="small"
            onClick={onDownloadPdf}
            iconName="document-pdf"
            variant="icon-left"
          >
            Last ned PDF
          </PktButton>
          <PktButton
            skin="secondary"
            size="small"
            onClick={onDemo}
            iconName="plus-circle"
            variant="icon-left"
          >
            Eksempel
          </PktButton>
          {isApiConnected && (
            <PktButton
              skin="primary"
              size="small"
              onClick={onSubmit}
              iconName="arrow-right"
              variant="icon-right"
              disabled={isSubmitting}
            >
              {submitButtonText}
            </PktButton>
          )}
        </div>
      </div>
    </div>
  );
};

export default BottomBar;
