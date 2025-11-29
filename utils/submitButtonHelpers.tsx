/**
 * Helper utilities for submit button text and state
 */

import React from 'react';
import { FormDataModel } from '../types';
import { Modus } from '../services/api';

/**
 * Get submit button text based on modus and form data
 */
export const getSubmitButtonText = (
  modus: Modus | null,
  formData: FormDataModel,
  isSubmitting: boolean
): React.ReactNode => {
  if (isSubmitting) {
    return (
      <span className="flex flex-col">
        <span>Sender...</span>
      </span>
    );
  }

  // Get latest revision for context
  const sisteKoeIndex = formData.koe_revisjoner.length - 1;
  const sisteKoe = formData.koe_revisjoner[sisteKoeIndex];
  const sisteBhSvarIndex = formData.bh_svar_revisjoner.length - 1;
  const sisteBhSvar = formData.bh_svar_revisjoner[sisteBhSvarIndex];

  switch (modus) {
    case 'varsel': {
      return (
        <span className="flex flex-col">
          <span>Send varsel til BH</span>
          <span className="text-xs opacity-75">Byggherre varsles automatisk</span>
        </span>
      );
    }
    case 'koe': {
      const beløp = sisteKoe?.vederlag?.krevd_belop;
      const text = beløp ? `Send krav (${beløp} NOK)` : 'Send krav';
      return (
        <span className="flex flex-col">
          <span>{text}</span>
          <span className="text-xs opacity-75">PDF genereres og sendes til BH</span>
        </span>
      );
    }
    case 'svar': {
      const vederlagStatus = sisteBhSvar?.vederlag?.bh_svar_vederlag;
      const godkjent = vederlagStatus === '100000004'; // Godkjent
      const subtext = godkjent ? '✅ Godkjenner krav' : '⚠️ Krever revisjon';
      return (
        <span className="flex flex-col">
          <span>Send svar til TE</span>
          <span className="text-xs opacity-75">{subtext}</span>
        </span>
      );
    }
    case 'revidering': {
      const nextRevNr = Number(sisteKoe?.koe_revisjonsnr || 0) + 1;
      return (
        <span className="flex flex-col">
          <span>Send revisjon {nextRevNr}</span>
          <span className="text-xs opacity-75">Oppdatert krav sendes til BH</span>
        </span>
      );
    }
    default:
      return 'Send';
  }
};
