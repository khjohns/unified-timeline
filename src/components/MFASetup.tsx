/**
 * MFASetup Component
 *
 * Allows users to enable/disable two-factor authentication.
 * Shows QR code for authenticator app enrollment.
 */

import { useState, useRef, useEffect } from 'react';
import { useSupabaseAuth, MFAEnrollResult } from '../context/SupabaseAuthContext';
import {
  ReloadIcon,
  LockClosedIcon,
  LockOpen1Icon,
  CheckCircledIcon,
  CrossCircledIcon,
  CopyIcon,
} from '@radix-ui/react-icons';

type SetupStep = 'idle' | 'enrolling' | 'verifying' | 'success';

export function MFASetup() {
  const {
    mfaEnabled,
    mfaFactors,
    enrollMFA,
    verifyMFAEnrollment,
    unenrollMFA,
  } = useSupabaseAuth();

  const [step, setStep] = useState<SetupStep>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollData, setEnrollData] = useState<MFAEnrollResult | null>(null);
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);
  const [secretCopied, setSecretCopied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input when entering verify step
  useEffect(() => {
    if (step === 'verifying' && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  const handleStartEnrollment = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await enrollMFA();
    if (error || !data) {
      setError(error?.message || 'Kunne ikke starte MFA-oppsett');
      setLoading(false);
      return;
    }

    setEnrollData(data);
    setStep('enrolling');
    setLoading(false);
  };

  const handleVerifyEnrollment = async () => {
    if (!enrollData) return;

    setLoading(true);
    setError(null);

    const code = verifyCode.join('');
    if (code.length !== 6) {
      setError('Skriv inn alle 6 sifrene');
      setLoading(false);
      return;
    }

    const { error } = await verifyMFAEnrollment(enrollData.factorId, code);
    if (error) {
      setError('Ugyldig kode. Sjekk at koden er riktig og prøv igjen.');
      setVerifyCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setLoading(false);
      return;
    }

    setStep('success');
    setLoading(false);

    // Reset after showing success
    setTimeout(() => {
      setStep('idle');
      setEnrollData(null);
      setVerifyCode(['', '', '', '', '', '']);
    }, 2000);
  };

  const handleDisableMFA = async () => {
    const verifiedFactor = mfaFactors.find((f) => f.status === 'verified');
    if (!verifiedFactor) return;

    setLoading(true);
    setError(null);

    const { error } = await unenrollMFA(verifiedFactor.id);
    if (error) {
      setError(error.message);
    }

    setLoading(false);
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...verifyCode];
    newCode[index] = value;
    setVerifyCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter' && verifyCode.every((d) => d)) {
      handleVerifyEnrollment();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const newCode = [...verifyCode];
      for (let i = 0; i < pastedData.length; i++) {
        newCode[i] = pastedData[i];
      }
      setVerifyCode(newCode);
      const nextEmptyIndex = newCode.findIndex((c) => !c);
      inputRefs.current[nextEmptyIndex === -1 ? 5 : nextEmptyIndex]?.focus();
    }
  };

  const copySecret = async () => {
    if (enrollData?.secret) {
      await navigator.clipboard.writeText(enrollData.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    }
  };

  // Success state
  if (step === 'success') {
    return (
      <div className="p-6 bg-pkt-bg-card border border-pkt-border-default">
        <div className="text-center">
          <CheckCircledIcon className="w-12 h-12 mx-auto mb-4 text-alert-success-text" />
          <h3 className="text-lg font-semibold text-pkt-text-body-dark mb-2">
            Tofaktor aktivert
          </h3>
          <p className="text-sm text-pkt-text-body-subtle">
            Kontoen din er nå sikret med tofaktor-autentisering.
          </p>
        </div>
      </div>
    );
  }

  // Verifying enrollment step
  if (step === 'verifying' && enrollData) {
    return (
      <div className="p-6 bg-pkt-bg-card border border-pkt-border-default">
        <h3 className="text-lg font-semibold text-pkt-text-body-dark mb-4">
          Bekreft oppsett
        </h3>
        <p className="text-sm text-pkt-text-body-subtle mb-6">
          Skriv inn den 6-sifrede koden fra autentiseringsappen din for å fullføre oppsettet.
        </p>

        <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
          {verifyCode.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-10 h-12 text-center text-lg font-mono border-2 border-pkt-border-default bg-pkt-bg-card text-pkt-text-body-default
                         focus:outline-none focus:border-pkt-brand-warm-blue-1000 focus:ring-0"
              aria-label={`Siffer ${index + 1}`}
            />
          ))}
        </div>

        {error && (
          <div className="p-3 mb-4 text-sm bg-alert-danger-bg text-alert-danger-text border border-alert-danger-border" role="alert">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setStep('enrolling');
              setVerifyCode(['', '', '', '', '', '']);
              setError(null);
            }}
            className="flex-1 py-2 px-4 border-2 border-pkt-border-default text-pkt-text-body-default
                       hover:bg-pkt-bg-subtle focus:outline-none focus:ring-2 focus:ring-pkt-brand-warm-blue-1000/30"
          >
            Tilbake
          </button>
          <button
            type="button"
            onClick={handleVerifyEnrollment}
            disabled={loading || verifyCode.some((d) => !d)}
            className="flex-1 py-2 px-4 bg-pkt-surface-strong-dark-blue text-pkt-text-body-light font-medium
                       border-2 border-pkt-border-default
                       hover:bg-pkt-brand-warm-blue-1000 hover:border-pkt-border-hover
                       focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {loading && <ReloadIcon className="w-4 h-4 animate-spin" />}
            Aktiver
          </button>
        </div>
      </div>
    );
  }

  // Enrolling step - show QR code
  if (step === 'enrolling' && enrollData) {
    return (
      <div className="p-6 bg-pkt-bg-card border border-pkt-border-default">
        <h3 className="text-lg font-semibold text-pkt-text-body-dark mb-4">
          Skann QR-kode
        </h3>
        <p className="text-sm text-pkt-text-body-subtle mb-6">
          Åpne autentiseringsappen din (Google Authenticator, Authy, etc.) og skann QR-koden under.
        </p>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div
            className="p-4 bg-white border border-pkt-border-default"
            dangerouslySetInnerHTML={{ __html: enrollData.qrCode }}
          />
        </div>

        {/* Manual entry option */}
        <div className="mb-6">
          <p className="text-xs text-pkt-text-body-subtle mb-2 text-center">
            Kan ikke skanne? Skriv inn denne koden manuelt:
          </p>
          <div className="flex items-center justify-center gap-2">
            <code className="px-3 py-1.5 bg-pkt-bg-subtle text-sm font-mono text-pkt-text-body-default border border-pkt-border-default">
              {enrollData.secret}
            </code>
            <button
              type="button"
              onClick={copySecret}
              className="p-1.5 text-pkt-text-body-subtle hover:text-pkt-text-body-default focus:outline-none"
              title="Kopier kode"
            >
              {secretCopied ? (
                <CheckCircledIcon className="w-4 h-4 text-alert-success-text" />
              ) : (
                <CopyIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setStep('idle');
              setEnrollData(null);
              setError(null);
            }}
            className="flex-1 py-2 px-4 border-2 border-pkt-border-default text-pkt-text-body-default
                       hover:bg-pkt-bg-subtle focus:outline-none focus:ring-2 focus:ring-pkt-brand-warm-blue-1000/30"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={() => setStep('verifying')}
            className="flex-1 py-2 px-4 bg-pkt-surface-strong-dark-blue text-pkt-text-body-light font-medium
                       border-2 border-pkt-border-default
                       hover:bg-pkt-brand-warm-blue-1000 hover:border-pkt-border-hover
                       focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30
                       flex items-center justify-center gap-2"
          >
            Neste
          </button>
        </div>
      </div>
    );
  }

  // Idle state - show current status
  return (
    <div className="p-6 bg-pkt-bg-card border border-pkt-border-default">
      <div className="flex items-start gap-4 mb-6">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            mfaEnabled ? 'bg-alert-success-bg' : 'bg-pkt-bg-subtle'
          }`}
        >
          {mfaEnabled ? (
            <LockClosedIcon className="w-5 h-5 text-alert-success-text" />
          ) : (
            <LockOpen1Icon className="w-5 h-5 text-pkt-text-body-subtle" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-pkt-text-body-dark mb-1">
            Tofaktor-autentisering (2FA)
          </h3>
          <p className="text-sm text-pkt-text-body-subtle">
            {mfaEnabled
              ? 'Kontoen din er sikret med tofaktor-autentisering.'
              : 'Legg til et ekstra lag med sikkerhet ved innlogging.'}
          </p>
        </div>
        <div
          className={`px-2 py-1 text-xs font-medium ${
            mfaEnabled
              ? 'bg-alert-success-bg text-alert-success-text'
              : 'bg-pkt-bg-subtle text-pkt-text-body-subtle'
          }`}
        >
          {mfaEnabled ? 'Aktivert' : 'Av'}
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 text-sm bg-alert-danger-bg text-alert-danger-text border border-alert-danger-border" role="alert">
          {error}
        </div>
      )}

      {mfaEnabled ? (
        <button
          type="button"
          onClick={handleDisableMFA}
          disabled={loading}
          className="w-full py-2 px-4 border-2 border-alert-danger-border text-alert-danger-text
                     hover:bg-alert-danger-bg focus:outline-none focus:ring-2 focus:ring-alert-danger-border/30
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {loading ? (
            <ReloadIcon className="w-4 h-4 animate-spin" />
          ) : (
            <CrossCircledIcon className="w-4 h-4" />
          )}
          Deaktiver tofaktor
        </button>
      ) : (
        <button
          type="button"
          onClick={handleStartEnrollment}
          disabled={loading}
          className="w-full py-2 px-4 bg-pkt-surface-strong-dark-blue text-pkt-text-body-light font-medium
                     border-2 border-pkt-border-default
                     hover:bg-pkt-brand-warm-blue-1000 hover:border-pkt-border-hover
                     focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {loading ? (
            <ReloadIcon className="w-4 h-4 animate-spin" />
          ) : (
            <LockClosedIcon className="w-4 h-4" />
          )}
          Aktiver tofaktor
        </button>
      )}

      <p className="mt-4 text-xs text-pkt-text-body-subtle text-center">
        Krever en autentiseringsapp som Google Authenticator eller Authy.
      </p>
    </div>
  );
}
