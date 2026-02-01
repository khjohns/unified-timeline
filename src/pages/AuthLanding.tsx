/**
 * AuthLanding Component
 *
 * Landing page that handles magic link authentication.
 * Features a split layout with animated KOE simulation on the left
 * and login card on the right.
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ExclamationTriangleIcon, LockClosedIcon, SunIcon, MoonIcon } from '@radix-ui/react-icons';

// Oslo kommune logo component for mobile header
function OsloLogo() {
  const { resolvedTheme } = useTheme();
  return (
    <img
      src={resolvedTheme === 'dark' ? '/logos/Oslo-logo-hvit-RGB.svg' : '/logos/Oslo-logo-sort-RGB.svg'}
      alt="Oslo kommune"
      className="h-16 w-auto -ml-4"
    />
  );
}

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
    { label: 'Hjemmel', value: '§ 25.2 - Byggherrens risiko' },
    { label: 'Vederlagskrav', value: 'kr 847 500,-' },
    { label: 'Fristforlengelse', value: '14 arbeidsdager' },
  ], []);

  // Progress through steps
  useEffect(() => {
    if (step < steps.length) {
      const timeout = setTimeout(() => {
        setStep(s => s + 1);
      }, 1800);
      return () => clearTimeout(timeout);
    } else {
      // Reset after showing all
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

// Geometric loading spinner
function LoadingSpinner() {
  return (
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 rounded-full border-2 border-pkt-border-subtle" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-pkt-brand-warm-blue-1000 animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-pkt-brand-warm-blue-1000" />
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center justify-center gap-1.5 mt-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-pkt-text-body-subtle animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

export function AuthLanding() {
  const { token, sakId, isVerifying, error } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (token && sakId) {
      navigate(`/saker/${sakId}`, { replace: true });
    }
  }, [token, sakId, navigate]);

  // Loading state
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle flex items-center justify-center relative">
        <ThemeToggle />
        <div
          className={`text-center transition-all duration-500 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <LoadingSpinner />
          <p className="mt-5 text-pkt-text-body-subtle font-medium">Verifiserer tilgang</p>
          <LoadingDots />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-pkt-bg-subtle flex items-center justify-center px-4 relative">
        <ThemeToggle />
        <div
          className={`w-full max-w-md transition-all duration-500 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="bg-pkt-bg-card rounded-lg border border-pkt-grays-gray-200 shadow-lg p-8">
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-pkt-brand-red-100 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-7 h-7 text-pkt-brand-red-1000" />
            </div>
            <h2 className="text-xl font-bold text-pkt-brand-red-1000 text-center mb-3">Tilgang avvist</h2>
            <p className="text-pkt-text-body-default text-center leading-relaxed mb-6">{error}</p>
            <div className="pt-5 border-t border-pkt-border-subtle">
              <p className="text-sm text-pkt-text-body-subtle text-center">
                Kontakt prosjektleder for ny tilgangslenke
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default state - split layout
  return (
    <div className="min-h-screen bg-pkt-bg-subtle flex relative">
      <ThemeToggle />

      {/* Left side - KOE Simulation (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-pkt-brand-dark-blue-1000 relative overflow-hidden">
        {/* Subtle pattern overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Gradient accents */}
        <div
          className="absolute top-0 right-0 w-96 h-96 opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-pkt-brand-blue-1000) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-80 h-80 opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-pkt-brand-green-1000) 0%, transparent 70%)' }}
        />

        {/* Content */}
        <div
          className={`relative z-10 flex flex-col justify-center p-12 xl:p-16 max-w-xl transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
          }`}
        >
          {/* Branding */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <div className="w-5 h-5 rounded border-2 border-pkt-brand-blue-1000" />
              </div>
              <span className="text-xs font-semibold tracking-widest text-white/60 uppercase">
                Oslobygg KF
              </span>
            </div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
              Digital håndtering av
              <br />
              <span className="text-pkt-brand-blue-1000">endringsordrer</span>
            </h1>
            <p className="mt-4 text-white/70 leading-relaxed">
              Effektiv samhandling mellom byggherre og totalentreprenør etter NS 8407.
            </p>
          </div>

          {/* Simulated KOE card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/10 p-6">
            <KOESimulation />
          </div>
        </div>
      </div>

      {/* Right side - Login card */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 sm:p-8">
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          {/* Mobile header (shown only on small screens) */}
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-3 mb-4 w-fit">
              <OsloLogo />
              <div className="h-10 w-px bg-pkt-border-subtle" />
              <span className="text-xs font-semibold tracking-widest text-pkt-text-body-subtle uppercase">
                Oslobygg KF
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-pkt-text-body-dark leading-tight mb-2">
              Digital håndtering av{' '}
              <span className="text-pkt-brand-warm-blue-1000">endringsmeldinger</span>
            </h1>
            <p className="text-sm text-pkt-text-body-subtle">
              Effektiv samhandling mellom byggherre og totalentreprenør etter NS 8407.
            </p>
          </div>

          {/* Login card */}
          <div className="bg-pkt-bg-card rounded-lg border border-pkt-grays-gray-200 shadow-xl shadow-pkt-brand-dark-blue-1000/5 p-8">
            <h2 className="text-xl font-bold text-pkt-text-body-dark mb-2">Velkommen</h2>
            <p className="text-sm text-pkt-text-body-subtle mb-8">
              Logg inn for å håndtere dine saker
            </p>

            {/* Info box */}
            <div className="p-4 rounded-lg bg-pkt-surface-subtle-pale-blue border border-pkt-border-blue/30">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pkt-brand-blue-300 flex items-center justify-center">
                  <LockClosedIcon className="w-4 h-4 text-pkt-brand-dark-blue-1000" />
                </div>
                <div>
                  <p className="text-sm text-pkt-text-body-default leading-relaxed">
                    For tilgang, bruk lenken du har mottatt fra Catenda. Lenken inneholder en unik sikkerhetskode.
                  </p>
                </div>
              </div>
            </div>

            {/* Decorative divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-pkt-border-subtle" />
              <span className="text-xs text-pkt-text-body-subtle">NS 8407:2011</span>
              <div className="flex-1 h-px bg-pkt-border-subtle" />
            </div>

            {/* Feature highlights */}
            <div className="space-y-3">
              {[
                'Tre-spor modellen: Grunnlag, Vederlag, Frist',
                'Full revisjonssporing av alle endringer',
                'Sanntidsoppdateringer mellom parter',
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 text-pkt-brand-dark-green-1000 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-pkt-text-body-subtle">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-pkt-text-body-subtle">
            NS 8407:2011 Totalentreprise
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthLanding;
