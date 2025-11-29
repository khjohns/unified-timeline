import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { showToast } from '../utils/toastHelpers';

interface UseEmailValidationOptions {
  sakId: string;
  onValidated: (name: string) => void;
  setToastMessage?: (message: string) => void;
  initialName?: string;
}

interface UseEmailValidationReturn {
  signerEmail: string;
  signerName: string;
  isValidating: boolean;
  validationError: string;
  handleEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleEmailValidation: (email: string) => Promise<void>;
  resetValidation: () => void;
}

/**
 * Custom hook for email validation against Catenda API
 *
 * This hook encapsulates the email validation logic that was previously
 * duplicated across VarselPanel, KravKoePanel, and BhSvarPanel.
 *
 * Features:
 * - Debounced validation (800ms after last keystroke)
 * - Automatic cleanup of timers on unmount
 * - Toast notifications for validation results
 * - Callback when validation succeeds
 *
 * @example
 * ```tsx
 * const {
 *   signerEmail,
 *   signerName,
 *   isValidating,
 *   validationError,
 *   handleEmailChange,
 *   handleEmailValidation
 * } = useEmailValidation({
 *   sakId: sak.sak_id_display || '',
 *   onValidated: (name) => setFormData('varsel', 'for_entreprenor', name),
 *   setToastMessage,
 *   initialName: varsel?.for_entreprenor || ''
 * });
 * ```
 */
export const useEmailValidation = ({
  sakId,
  onValidated,
  setToastMessage,
  initialName = ''
}: UseEmailValidationOptions): UseEmailValidationReturn => {
  const [signerEmail, setSignerEmail] = useState('');
  const [signerName, setSignerName] = useState(initialName);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [validationTimer, setValidationTimer] = useState<NodeJS.Timeout | null>(null);

  // Initialize signer name from initialName
  useEffect(() => {
    if (initialName) {
      setSignerName(initialName);
    }
  }, [initialName]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (validationTimer) {
        clearTimeout(validationTimer);
      }
    };
  }, [validationTimer]);

  // Validate email against Catenda API
  const handleEmailValidation = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) {
      setValidationError('');
      setSignerName('');
      return;
    }

    setIsValidating(true);
    setValidationError('');

    try {
      const response = await api.validateUser(sakId, email);

      if (response.success && response.data) {
        const validatedName = response.data.name;
        setSignerName(validatedName);
        setValidationError('');
        onValidated(validatedName);
        showToast(setToastMessage, `Bruker validert: ${validatedName}`);
      } else {
        setSignerName('');
        setValidationError(response.error || 'Brukeren er ikke medlem i Catenda-prosjektet');
        showToast(setToastMessage, response.error || 'Brukeren er ikke medlem i Catenda-prosjektet');
      }
    } catch (error) {
      setSignerName('');
      setValidationError('Feil ved validering');
      showToast(setToastMessage, 'Feil ved validering av bruker');
    } finally {
      setIsValidating(false);
    }
  }, [sakId, onValidated, setToastMessage]);

  // Debounced validation (800ms)
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setSignerEmail(email);

    // Clear existing timer
    if (validationTimer) {
      clearTimeout(validationTimer);
    }

    // Only start validation timer if email contains '@'
    if (email && email.includes('@')) {
      const timer = setTimeout(() => {
        handleEmailValidation(email);
      }, 800); // 800ms debounce
      setValidationTimer(timer);
    } else {
      // Clear validation state if email is incomplete
      setSignerName('');
      setValidationError('');
    }
  }, [validationTimer, handleEmailValidation]);

  const resetValidation = useCallback(() => {
    setSignerEmail('');
    setSignerName('');
    setValidationError('');
  }, []);

  return {
    signerEmail,
    signerName,
    isValidating,
    validationError,
    handleEmailChange,
    handleEmailValidation,
    resetValidation
  };
};
