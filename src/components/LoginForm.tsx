/**
 * LoginForm Component
 *
 * Email/password login form for Supabase Auth.
 * Split layout with animated KOE simulation on the left.
 */

import { useState, useEffect, useMemo } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useTheme } from '../context/ThemeContext';
import { EnvelopeClosedIcon, LockClosedIcon, PersonIcon, SunIcon, MoonIcon, EyeOpenIcon, EyeClosedIcon } from '@radix-ui/react-icons';

// Theme toggle button
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-20 p-2.5 rounded-full bg-pkt-bg-card border border-pkt-grays-gray-200 shadow-md
                 hover:bg-pkt-bg-subtle hover:border-pkt-border-default
                 focus:outline-none focus:ring-2 focus:ring-pkt-brand-warm-blue-1000/30
                 transition-all duration-200"
      aria-label={resolvedTheme === 'dark' ? 'Bytt til lys modus' : 'Bytt til mørk modus'}
    >
      {resolvedTheme === 'dark' ? (
        <SunIcon className="w-5 h-5 text-pkt-brand-yellow-1000" />
      ) : (
        <MoonIcon className="w-5 h-5 text-pkt-brand-dark-blue-1000" />
      )}
    </button>
  );
}

// Typewriter hook
function useTypewriter(text: string, speed: number = 30, delay: number = 0) {
  const [displayed, setDisplayed] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setIsComplete(false);

    const startTimeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        if (i < text.length) {
          setDisplayed(text.slice(0, i + 1));
          i++;
        } else {
          setIsComplete(true);
          clearInterval(interval);
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, delay]);

  return { displayed, isComplete };
}

// Animated KOE simulation
function KOESimulation() {
  const [step, setStep] = useState(0);

  const steps = useMemo(() => [
    { label: 'Saksnummer', value: 'KOE-2024-0847' },
    { label: 'Prosjekt', value: 'Nye Jordal Amfi' },
    { label: 'Beskrivelse', value: 'Endret fundamentering grunnet uforutsette grunnforhold ved hovedinngang...' },
    { label: 'Hjemmel', value: '§ 23.1 - Uforutsette grunnforhold' },
    { label: 'Vederlagskrav', value: 'kr 847 500,-' },
    { label: 'Fristforlengelse', value: '14 arbeidsdager' },
  ], []);

  useEffect(() => {
    if (step < steps.length) {
      const timeout = setTimeout(() => {
        setStep(s => s + 1);
      }, 1800);
      return () => clearTimeout(timeout);
    } else {
      const resetTimeout = setTimeout(() => {
        setStep(0);
      }, 4000);
      return () => clearTimeout(resetTimeout);
    }
  }, [step, steps.length]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-3 h-3 rounded-full bg-pkt-brand-green-1000 animate-pulse" />
        <span className="text-xs font-medium text-pkt-text-body-subtle uppercase tracking-wider">
          Krav om endring registreres...
        </span>
      </div>

      {/* Animated fields */}
      {steps.slice(0, step).map((field, index) => (
        <KOEField key={field.label} label={field.label} value={field.value} delay={index * 50} />
      ))}

      {/* Cursor line */}
      {step < steps.length && (
        <div className="flex items-center gap-2 mt-4">
          <span className="w-2 h-5 bg-pkt-brand-warm-blue-1000 animate-pulse" />
        </div>
      )}

      {/* Completion indicator */}
      {step >= steps.length && (
        <div className="mt-6 pt-4 border-t border-pkt-border-subtle">
          <div className="flex items-center gap-2 text-pkt-brand-dark-green-1000">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">Krav sendt til byggherre</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Individual animated field
function KOEField({ label, value, delay }: { label: string; value: string; delay: number }) {
  const { displayed, isComplete } = useTypewriter(value, 25, delay);

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-xs font-medium text-pkt-text-body-subtle mb-1">{label}</div>
      <div className="text-sm text-pkt-text-body-default font-medium">
        {displayed}
        {!isComplete && <span className="inline-block w-0.5 h-4 bg-pkt-text-body-default ml-0.5 animate-pulse" />}
      </div>
    </div>
  );
}

// Loading spinner for button
function ButtonSpinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export function LoginForm() {
  const { signIn, signUp } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        setMessage({ type: 'error', text: error.message });
      }
    } else {
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

  return (
    <div className="min-h-screen bg-pkt-bg-subtle flex relative">
      <ThemeToggle />

      {/* Full-page grid pattern */}
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--color-pkt-brand-dark-blue-1000) 1px, transparent 1px),
            linear-gradient(to bottom, var(--color-pkt-brand-dark-blue-1000) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Left side - Login form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center lg:justify-end p-6 sm:p-8 lg:pr-12">
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          {/* Login card */}
          <div className="bg-pkt-bg-card rounded-lg border border-pkt-grays-gray-200 shadow-xl shadow-pkt-brand-dark-blue-1000/5 p-8">
            {/* Header with Oslo kommune logo */}
            <div className="flex items-center gap-3 mb-6 w-fit">
              <img
                src={resolvedTheme === 'dark' ? '/logos/Oslo-logo-hvit-RGB.svg' : '/logos/Oslo-logo-sort-RGB.svg'}
                alt="Oslo kommune"
                className="h-16 w-auto -ml-4"
              />
              <div className="h-10 w-px bg-pkt-border-subtle" />
              <span className="text-xs font-semibold tracking-widest text-pkt-text-body-subtle uppercase">
                Oslobygg KF
              </span>
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold text-pkt-text-body-dark leading-tight mb-2">
              Digital håndtering av{' '}
              <span className="text-pkt-brand-warm-blue-1000">endringsmeldinger</span>
            </h1>
            <p className="text-sm text-pkt-text-body-subtle mb-6">
              Effektiv samhandling mellom byggherre og totalentreprenør etter NS 8407.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-pkt-text-body-default mb-2">
                  E-post
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <EnvelopeClosedIcon className="h-4 w-4 text-pkt-text-body-subtle" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-pkt-bg-card border border-pkt-grays-gray-200 rounded-md text-pkt-text-body-default
                               placeholder:text-pkt-text-placeholder
                               focus:outline-none focus:ring-2 focus:ring-pkt-brand-warm-blue-1000/20 focus:border-pkt-brand-warm-blue-1000
                               transition-colors"
                    placeholder="din@epost.no"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-pkt-text-body-default mb-2">
                  Passord
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-4 w-4 text-pkt-text-body-subtle" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-10 py-2.5 bg-pkt-bg-card border border-pkt-grays-gray-200 rounded-md text-pkt-text-body-default
                               placeholder:text-pkt-text-placeholder
                               focus:outline-none focus:ring-2 focus:ring-pkt-brand-warm-blue-1000/20 focus:border-pkt-brand-warm-blue-1000
                               transition-colors"
                    placeholder={mode === 'register' ? 'Minst 6 tegn' : '••••••••'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-pkt-text-body-subtle hover:text-pkt-text-body-default transition-colors"
                    aria-label={showPassword ? 'Skjul passord' : 'Vis passord'}
                  >
                    {showPassword ? (
                      <EyeClosedIcon className="h-4 w-4" />
                    ) : (
                      <EyeOpenIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Message */}
              {message && (
                <div
                  className={`p-3 rounded-md text-sm ${
                    message.type === 'error'
                      ? 'bg-alert-danger-bg text-alert-danger-text border border-alert-danger-border'
                      : 'bg-alert-success-bg text-alert-success-text border border-alert-success-border'
                  }`}
                  role={message.type === 'error' ? 'alert' : 'status'}
                >
                  {message.text}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-pkt-brand-dark-blue-1000 text-white font-medium rounded-md
                           hover:bg-pkt-brand-warm-blue-1000
                           focus:outline-none focus:ring-2 focus:ring-pkt-brand-warm-blue-1000/50 focus:ring-offset-2
                           disabled:opacity-60 disabled:cursor-not-allowed
                           transition-all duration-200
                           flex items-center justify-center gap-2"
              >
                {loading && <ButtonSpinner />}
                {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
              </button>
            </form>

            {/* Mode toggle */}
            <div className="mt-6 pt-6 border-t border-pkt-border-subtle text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setMessage(null);
                }}
                className="inline-flex items-center gap-2 text-sm text-pkt-text-action-active hover:text-pkt-text-action-hover transition-colors"
              >
                <PersonIcon className="w-4 h-4" />
                {mode === 'login' ? 'Har du ikke konto? Opprett en' : 'Har du konto? Logg inn'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-pkt-text-body-subtle">
            NS 8407:2011 Totalentreprise
          </p>
        </div>
      </div>

      {/* Right side - KOE Simulation (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 items-center justify-start p-12 xl:p-16 lg:pl-12">
        <div
          className={`w-full max-w-lg transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
          }`}
        >
          {/* Simulated KOE card */}
          <div className="bg-pkt-bg-card rounded-lg border border-pkt-grays-gray-200 shadow-lg p-6">
            <KOESimulation />
          </div>
        </div>
      </div>
    </div>
  );
}
