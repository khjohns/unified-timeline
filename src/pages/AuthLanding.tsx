/**
 * AuthLanding Component
 *
 * Landing page that handles magic link authentication.
 * Redirects to case page when token is verified.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ReloadIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';

export function AuthLanding() {
  const { token, sakId, isVerifying, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to case page when token is verified
    if (token && sakId) {
      navigate(`/saker/${sakId}`, { replace: true });
    }
  }, [token, sakId, navigate]);

  // Loading state
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-pkt-bg-default flex items-center justify-center">
        <div className="text-center">
          <ReloadIcon className="w-12 h-12 mx-auto mb-4 text-pkt-border-default animate-spin" />
          <p className="text-pkt-text-body-subtle">Verifiserer lenke...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-pkt-bg-default flex items-center justify-center px-4">
        <div className="max-w-md w-full p-6 sm:p-8 bg-white rounded-none shadow-lg border-2 border-pkt-border-default" role="alert">
          <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-4 text-pkt-brand-red-1000" />
          <h2 className="text-xl sm:text-2xl font-bold text-pkt-brand-red-1000 mb-4 text-center">
            Kunne ikke verifisere lenke
          </h2>
          <p className="text-pkt-text-body-default mb-4 text-center">{error}</p>
          <p className="text-sm text-pkt-text-body-subtle text-center">
            Kontakt prosjektleder for ny lenke.
          </p>
        </div>
      </div>
    );
  }

  // No token state - show instructions
  return (
    <div className="min-h-screen bg-pkt-bg-default flex items-center justify-center px-4">
      <div className="max-w-md w-full p-6 sm:p-8 bg-white rounded-none shadow-lg border-2 border-pkt-border-default">
        <h1 className="text-xl sm:text-2xl font-bold text-pkt-text-body-dark mb-4 text-center">
          Skjema Endringsmeldinger
        </h1>
        <p className="text-pkt-text-body-default mb-4 text-center">
          For tilgang til skjema, bruk lenken du har mottatt fra Catenda.
        </p>
        <p className="text-sm text-pkt-text-body-subtle text-center">
          Lenken inneholder en sikkerhetskode som gir deg tilgang til riktig sak.
        </p>
      </div>
    </div>
  );
}

export default AuthLanding;
