/**
 * SettingsPage Component
 *
 * User settings page with MFA configuration.
 */

import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { MFASetup } from '../components/auth';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Button } from '../components/primitives';
import { ExitIcon, PersonIcon } from '@radix-ui/react-icons';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useSupabaseAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      <PageHeader
        title="Innstillinger"
        subtitle="Administrer kontoen din"
        maxWidth="narrow"
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate('/saker')}>
            Tilbake til saker
          </Button>
        }
      />

      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-8">
        <div className="space-y-6">
          {/* User info */}
          <section className="p-6 bg-pkt-bg-card border border-pkt-border-default">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-pkt-surface-strong-dark-blue flex items-center justify-center">
                <PersonIcon className="w-6 h-6 text-pkt-text-body-light" />
              </div>
              <div>
                <h3 className="font-semibold text-pkt-text-body-dark">
                  {user?.email || 'Bruker'}
                </h3>
                <p className="text-sm text-pkt-text-body-subtle">
                  Logget inn
                </p>
              </div>
            </div>
          </section>

          {/* Security section */}
          <section>
            <h2 className="text-sm font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-3">
              Sikkerhet
            </h2>
            <MFASetup />
          </section>

          {/* Sign out */}
          <section>
            <h2 className="text-sm font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-3">
              Sesjon
            </h2>
            <div className="p-6 bg-pkt-bg-card border border-pkt-border-default">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-2 text-pkt-text-body-default hover:text-alert-danger-text focus:outline-none"
              >
                <ExitIcon className="w-4 h-4" />
                Logg ut
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default SettingsPage;
