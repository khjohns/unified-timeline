/**
 * MFARequired Component
 *
 * Shown when user must set up MFA before accessing the application.
 */

import { MFASetup } from './MFASetup';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { ExitIcon, LockClosedIcon } from '@radix-ui/react-icons';

export function MFARequired() {
  const { user, signOut } = useSupabaseAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-pkt-bg-default flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-pkt-surface-strong-dark-blue rounded-full flex items-center justify-center">
            <LockClosedIcon className="w-8 h-8 text-pkt-text-body-light" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-pkt-text-body-dark mb-2">
            Tofaktor påkrevd
          </h1>
          <p className="text-sm text-pkt-text-body-subtle">
            For å beskytte sensitive data krever denne applikasjonen tofaktor-autentisering (2FA).
          </p>
          {user?.email && (
            <p className="text-xs text-pkt-text-body-subtle mt-2">
              Logget inn som: {user.email}
            </p>
          )}
        </div>

        {/* MFA Setup */}
        <MFASetup />

        {/* Sign out option */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 text-sm text-pkt-text-body-subtle hover:text-pkt-text-body-default focus:outline-none"
          >
            <ExitIcon className="w-4 h-4" />
            Logg ut og bruk en annen konto
          </button>
        </div>
      </div>
    </div>
  );
}
