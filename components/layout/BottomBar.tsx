/**
 * BottomBar component
 *
 * Navigation bar with action buttons (Reset, Download PDF, Demo, Submit)
 */

import React from 'react';
import { PktButton } from '@oslokommune/punkt-react';
import { FormDataModel } from '../../types';
import { Modus } from '../../services/api';
import { getSubmitButtonText } from '../../utils/submitButtonHelpers';

export interface BottomBarProps {
  formData: FormDataModel;
  modus: Modus | null;
  isApiConnected: boolean | null;
  isSubmitting: boolean;
  onReset: () => void;
  onDownloadPdf: () => void;
  onDemo: () => void;
  onSubmit: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  formData,
  modus,
  isApiConnected,
  isSubmitting,
  onReset,
  onDownloadPdf,
  onDemo,
  onSubmit,
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
              {getSubmitButtonText(modus, formData, isSubmitting)}
            </PktButton>
          )}
        </div>
      </div>
    </div>
  );
};
