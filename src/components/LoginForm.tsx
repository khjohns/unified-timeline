/**
 * LoginForm Component
 *
 * Email/password login form for Supabase Auth.
 * Supports both login and registration, with MFA verification.
 */

import { useState, useRef, useEffect } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { ReloadIcon, LockClosedIcon } from '@radix-ui/react-icons';

type FormMode = 'login' | 'register' | 'mfa';

export function LoginForm() {
  const { signIn, signUp, mfaFactors, challengeMFA, verifyMFA } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [mode, setMode] = useState<FormMode>('login');

  // MFA state
  const [mfaCode, setMfaCode] = useState(['', '', '', '', '', '']);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first MFA input when entering MFA mode
  useEffect(() => {
    if (mode === 'mfa' && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === 'login') {
      const { error, mfaRequired } = await signIn(email, password);
      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else if (mfaRequired) {
        // User has MFA enabled - need to verify
        await initiateMFAChallenge();
      }
      // If successful without MFA, the auth state change will handle redirect
    } else if (mode === 'register') {
      const { error } = await signUp(email, password);
      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({
          type: 'success',
          text: 'Sjekk e-posten din for bekreftelseslenke',
        });
      }
    }

    setLoading(false);
  };

  const initiateMFAChallenge = async () => {
    // Find the first verified TOTP factor
    const verifiedFactor = mfaFactors.find((f) => f.status === 'verified');
    if (!verifiedFactor) {
      setMessage({ type: 'error', text: 'Ingen verifisert MFA-faktor funnet' });
      return;
    }

    const { data, error } = await challengeMFA(verifiedFactor.id);
    if (error || !data) {
      setMessage({ type: 'error', text: error?.message || 'Kunne ikke starte MFA-verifisering' });
      return;
    }

    setMfaFactorId(data.factorId);
    setMfaChallengeId(data.challengeId);
    setMode('mfa');
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || !mfaChallengeId) return;

    setLoading(true);
    setMessage(null);

    const code = mfaCode.join('');
    if (code.length !== 6) {
      setMessage({ type: 'error', text: 'Skriv inn alle 6 sifrene' });
      setLoading(false);
      return;
    }

    const { error } = await verifyMFA(mfaFactorId, mfaChallengeId, code);
    if (error) {
      setMessage({ type: 'error', text: 'Ugyldig kode. Prøv igjen.' });
      setMfaCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
    // If successful, auth state change will handle redirect

    setLoading(false);
  };

  const handleMfaCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...mfaCode];
    newCode[index] = value;
    setMfaCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleMfaKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !mfaCode[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleMfaPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const newCode = [...mfaCode];
      for (let i = 0; i < pastedData.length; i++) {
        newCode[i] = pastedData[i];
      }
      setMfaCode(newCode);
      // Focus the next empty input or the last one
      const nextEmptyIndex = newCode.findIndex((c) => !c);
      inputRefs.current[nextEmptyIndex === -1 ? 5 : nextEmptyIndex]?.focus();
    }
  };

  // MFA verification view
  if (mode === 'mfa') {
    return (
      <div className="min-h-screen bg-pkt-bg-default flex items-center justify-center px-4">
        <div className="max-w-md w-full p-6 sm:p-8 bg-pkt-bg-card rounded-none shadow-md border border-pkt-border-default">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto mb-4 bg-pkt-surface-strong-dark-blue rounded-full flex items-center justify-center">
              <LockClosedIcon className="w-6 h-6 text-pkt-text-body-light" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-pkt-text-body-dark mb-2">
              Tofaktor-verifisering
            </h1>
            <p className="text-sm text-pkt-text-body-subtle">
              Skriv inn koden fra autentiseringsappen din
            </p>
          </div>

          <form onSubmit={handleMFASubmit} className="space-y-6">
            <div className="flex justify-center gap-2" onPaste={handleMfaPaste}>
              {mfaCode.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleMfaCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleMfaKeyDown(index, e)}
                  className="w-10 h-12 text-center text-lg font-mono border-2 border-pkt-border-default bg-pkt-bg-card text-pkt-text-body-default
                             focus:outline-none focus:border-pkt-brand-warm-blue-1000 focus:ring-0"
                  aria-label={`Siffer ${index + 1}`}
                />
              ))}
            </div>

            {message && (
              <div
                className={`p-3 text-sm rounded-none ${
                  message.type === 'error'
                    ? 'bg-alert-danger-bg text-alert-danger-text border border-alert-danger-border'
                    : 'bg-alert-success-bg text-alert-success-text border border-alert-success-border'
                }`}
                role={message.type === 'error' ? 'alert' : 'status'}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || mfaCode.some((d) => !d)}
              className="w-full py-2.5 px-4 bg-pkt-surface-strong-dark-blue text-pkt-text-body-light font-medium
                         rounded-none border-2 border-pkt-border-default
                         hover:bg-pkt-brand-warm-blue-1000 hover:border-pkt-border-hover
                         focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {loading && <ReloadIcon className="w-4 h-4 animate-spin" />}
              Bekreft
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setMfaCode(['', '', '', '', '', '']);
                setMfaChallengeId(null);
                setMfaFactorId(null);
                setMessage(null);
              }}
              className="text-sm text-pkt-text-action-active hover:underline focus:outline-none"
            >
              Tilbake til innlogging
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal login/register view
  return (
    <div className="min-h-screen bg-pkt-bg-default flex items-center justify-center px-4">
      <div className="max-w-md w-full p-6 sm:p-8 bg-pkt-bg-card rounded-none shadow-md border border-pkt-border-default">
        <h1 className="text-xl sm:text-2xl font-bold text-pkt-text-body-dark mb-2 text-center">
          Skjema Endringsmeldinger
        </h1>
        <p className="text-sm text-pkt-text-body-subtle mb-6 text-center">
          {mode === 'login' ? 'Logg inn for tilgang' : 'Opprett ny konto'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-pkt-text-body-default mb-1"
            >
              E-post
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border-2 border-pkt-border-default bg-pkt-bg-card text-pkt-text-body-default
                         focus:outline-none focus:border-pkt-brand-warm-blue-1000 focus:ring-0
                         placeholder:text-pkt-text-placeholder"
              placeholder="din@epost.no"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-pkt-text-body-default mb-1"
            >
              Passord
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border-2 border-pkt-border-default bg-pkt-bg-card text-pkt-text-body-default
                         focus:outline-none focus:border-pkt-brand-warm-blue-1000 focus:ring-0
                         placeholder:text-pkt-text-placeholder"
              placeholder={mode === 'register' ? 'Minst 6 tegn' : '********'}
            />
          </div>

          {message && (
            <div
              className={`p-3 text-sm rounded-none ${
                message.type === 'error'
                  ? 'bg-alert-danger-bg text-alert-danger-text border border-alert-danger-border'
                  : 'bg-alert-success-bg text-alert-success-text border border-alert-success-border'
              }`}
              role={message.type === 'error' ? 'alert' : 'status'}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-pkt-surface-strong-dark-blue text-pkt-text-body-light font-medium
                       rounded-none border-2 border-pkt-border-default
                       hover:bg-pkt-brand-warm-blue-1000 hover:border-pkt-border-hover
                       focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {loading && <ReloadIcon className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Logg inn' : 'Registrer'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setMessage(null);
            }}
            className="text-sm text-pkt-text-action-active hover:underline focus:outline-none"
          >
            {mode === 'login' ? 'Har du ikke konto? Registrer deg' : 'Har du allerede konto? Logg inn'}
          </button>
        </div>
      </div>
    </div>
  );
}
