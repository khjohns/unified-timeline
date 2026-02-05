/**
 * Lovdata MCP Landing Page
 *
 * Split layout with animated law lookup simulation on the left
 * and info card on the right. Inspired by AuthLanding.
 */

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import {
  GitHubLogoIcon,
  CheckCircledIcon,
  CopyIcon,
  EnvelopeClosedIcon,
  Cross2Icon,
} from '@radix-ui/react-icons';

// ============================================================================
// Law Lookup Simulation
// ============================================================================

function LawLookupSimulation() {
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);

  // Verified against actual MCP responses
  const simulations = useMemo(() => [
    // Simulation 1: Oppsigelse av leieforhold
    [
      { type: 'question' as const, content: 'Kan utleier si meg opp?' },
      { type: 'search' as const, content: 'Søker "oppsigelse leie"...' },
      { type: 'results' as const, content: '4 treff: husleieloven §§ 9-7, 9-8, 11-2, 11-3' },
      { type: 'fetch' as const, content: 'Henter § 9-7...' },
      { type: 'law' as const, content: '§ 9-7 Formkrav til utleierens oppsigelse\n\nOppsigelse fra utleier skal være skriftlig.\n\nOppsigelsen skal begrunnes. Oppsigelsen skal også opplyse om at leieren kan protestere skriftlig til utleieren innen én måned...' },
    ],
    // Simulation 2: Prisavslag ved mangel
    [
      { type: 'question' as const, content: 'Boligen har feil - hva kan jeg kreve?' },
      { type: 'search' as const, content: 'Søker "prisavslag mangel"...' },
      { type: 'results' as const, content: '4 treff: avhendingslova § 4-12, buofl § 33, ...' },
      { type: 'fetch' as const, content: 'Henter avhendingslova § 4-12...' },
      { type: 'law' as const, content: '§ 4-12 Prisavslag\n\n(1) Har eigedomen ein mangel, kan kjøparen krevje eit forholdsmessig prisavslag.\n\n(2) Med mindre noko anna vert godtgjort, skal prisavslaget fastsetjast til kostnadene ved å få mangelen retta.' },
    ],
    // Simulation 3: Midlertidig ansettelse
    [
      { type: 'question' as const, content: 'Er midlertidig ansettelse lovlig?' },
      { type: 'search' as const, content: 'Søker "midlertidig ansettelse"...' },
      { type: 'results' as const, content: '5 treff: aml § 14-9, statsansatteloven § 9, ...' },
      { type: 'fetch' as const, content: 'Henter aml § 14-9...' },
      { type: 'law' as const, content: '§ 14-9 Fast og midlertidig ansettelse\n\n(1) Arbeidstaker skal ansettes fast. Med fast ansettelse menes i denne lov at ansettelsen er løpende og tidsubegrenset...' },
    ],
    // Simulation 4: Miljøkrav i offentlige anskaffelser (OR-søk)
    [
      { type: 'question' as const, content: 'Må offentlige innkjøp ta miljøhensyn?' },
      { type: 'search' as const, content: 'Søker "miljø OR klima"...' },
      { type: 'results' as const, content: '5 treff: anskaffelsesforskriften § 7-9, aml § 3-1, ...' },
      { type: 'fetch' as const, content: 'Henter anskaffelsesforskriften § 7-9...' },
      { type: 'law' as const, content: '§ 7-9 Klima- og miljøhensyn i offentlige anskaffelser\n\n(1) Krav og kriterier etter denne bestemmelsen skal ha som mål å redusere anskaffelsens samlede klimaavtrykk eller miljøbelastning.\n\n(2) Oppdragsgiver skal vekte klima- og miljøhensyn med minimum tretti prosent.' },
    ],
  ], []);

  const currentSim = simulations[cycle % simulations.length];
  const steps = currentSim;

  useEffect(() => {
    if (step < steps.length) {
      const delays = [400, 800, 1000, 600, 800];
      const timeout = setTimeout(() => {
        setStep(s => s + 1);
      }, delays[step] || 800);
      return () => clearTimeout(timeout);
    } else {
      const resetTimeout = setTimeout(() => {
        setStep(0);
        setCycle(c => c + 1);
      }, 4000);
      return () => clearTimeout(resetTimeout);
    }
  }, [step, steps.length]);

  return (
    <div className="text-sm h-80 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10 flex-shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
        </div>
        <span className="text-xs text-white/40 ml-2">lovdata-mcp</span>
      </div>

      {/* Content area - fixed height with scroll */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {/* Step 1: User question */}
        {step >= 1 && (
          <div className="animate-fade-in">
            <span className="text-white">{steps[0].content}</span>
          </div>
        )}

        {/* Step 2: AI searching */}
        {step >= 2 && (
          <div className="flex gap-2 text-white/50 text-xs animate-fade-in">
            <span className="text-pkt-brand-green-1000">●</span>
            {steps[1].content}
          </div>
        )}

        {/* Step 3: Search results */}
        {step >= 3 && (
          <div className="flex gap-2 text-white/50 text-xs animate-fade-in">
            <span className="text-pkt-brand-green-1000">●</span>
            {steps[2].content}
          </div>
        )}

        {/* Step 4: Fetching */}
        {step >= 4 && (
          <div className="flex gap-2 text-white/50 text-xs animate-fade-in">
            <span className="text-pkt-brand-green-1000">●</span>
            {steps[3].content}
          </div>
        )}

        {/* Step 5: Law text */}
        {step >= 5 && (
          <div className="p-3 rounded bg-white/5 border border-white/10 animate-fade-in">
            <div className="text-white/90 whitespace-pre-wrap leading-relaxed text-xs">
              {steps[4].content}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {step > 0 && step < steps.length && (
          <div className="flex gap-1 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Registration Flow
// ============================================================================

type RegistrationState =
  | { step: 'idle' }
  | { step: 'info' }
  | { step: 'input' }
  | { step: 'sending'; email: string }
  | { step: 'sent'; email: string }
  | { step: 'success'; apiKey: string };

function RegistrationFlow({
  state,
  onStart,
  onSubmit,
  onClose
}: {
  state: RegistrationState;
  onStart: () => void;
  onSubmit: (email: string) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Idle state - show button
  if (state.step === 'idle') {
    return (
      <Button variant="primary" size="md" className="flex-1" onClick={onStart}>
        Kom i gang
      </Button>
    );
  }

  // Info step - explain what happens
  if (state.step === 'info') {
    return (
      <div className="flex-1 p-4 rounded-lg border border-pkt-border-subtle bg-white animate-fade-in">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-medium text-pkt-text-body-dark">Få tilgang</h3>
          <button
            onClick={onClose}
            className="p-1 text-pkt-text-body-subtle hover:text-pkt-text-body-default"
          >
            <Cross2Icon className="w-4 h-4" />
          </button>
        </div>
        <ul className="space-y-2 text-sm text-pkt-text-body-subtle mb-4">
          <li className="flex items-start gap-2">
            <CheckCircledIcon className="w-4 h-4 text-pkt-brand-dark-green-1000 flex-shrink-0 mt-0.5" />
            <span>100 gratis oppslag per måned</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircledIcon className="w-4 h-4 text-pkt-brand-dark-green-1000 flex-shrink-0 mt-0.5" />
            <span>Fungerer med Claude, Cursor, m.fl.</span>
          </li>
        </ul>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="din@epost.no"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            width="full"
            onKeyDown={(e) => e.key === 'Enter' && email && onSubmit(email)}
          />
          <Button
            variant="primary"
            size="md"
            onClick={() => onSubmit(email)}
            disabled={!email || !email.includes('@')}
          >
            Send
          </Button>
        </div>
        <p className="text-xs text-pkt-text-body-subtle mt-3">
          Vi sender en aktiveringskode på e-post.
        </p>
      </div>
    );
  }

  // Email input (fallback, but info step is primary now)
  if (state.step === 'input') {
    return (
      <div className="flex-1 animate-fade-in">
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="din@epost.no"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            width="full"
            onKeyDown={(e) => e.key === 'Enter' && email && onSubmit(email)}
          />
          <Button
            variant="primary"
            size="md"
            onClick={() => onSubmit(email)}
            disabled={!email || !email.includes('@')}
          >
            Send
          </Button>
          <button
            onClick={onClose}
            className="p-2 text-pkt-text-body-subtle hover:text-pkt-text-body-default"
          >
            <Cross2Icon className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Sending state
  if (state.step === 'sending') {
    return (
      <div className="flex-1 p-3 rounded-lg bg-pkt-bg-subtle text-center animate-fade-in">
        <div className="flex items-center justify-center gap-2 text-sm text-pkt-text-body-subtle">
          <div className="w-4 h-4 border-2 border-pkt-brand-warm-blue-1000 border-t-transparent rounded-full animate-spin" />
          Sender...
        </div>
      </div>
    );
  }

  // Email sent - waiting for magic link
  if (state.step === 'sent') {
    return (
      <div className="flex-1 p-4 rounded-lg bg-pkt-surface-subtle-pale-blue border border-pkt-brand-warm-blue-1000/20 animate-fade-in">
        <div className="flex items-start gap-3">
          <EnvelopeClosedIcon className="w-5 h-5 text-pkt-brand-warm-blue-1000 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-pkt-text-body-dark">Sjekk e-posten din</p>
            <p className="text-xs text-pkt-text-body-subtle mt-1">
              Vi har sendt en lenke til {state.email}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success - show API key
  if (state.step === 'success') {
    return (
      <div className="flex-1 p-4 rounded-lg bg-alert-success-bg border border-pkt-brand-dark-green-1000/20 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircledIcon className="w-5 h-5 text-pkt-brand-dark-green-1000" />
          <span className="text-sm font-medium text-pkt-text-body-dark">Din aktiveringskode</span>
        </div>
        <div className="flex items-center gap-2 p-2 bg-white rounded border border-pkt-border-subtle">
          <code className="flex-1 text-xs font-mono text-pkt-text-body-default truncate">
            {state.apiKey}
          </code>
          <button
            onClick={() => handleCopy(state.apiKey)}
            className="p-1.5 rounded hover:bg-pkt-bg-subtle transition-colors"
            title="Kopier"
          >
            {copied ? (
              <CheckCircledIcon className="w-4 h-4 text-pkt-brand-dark-green-1000" />
            ) : (
              <CopyIcon className="w-4 h-4 text-pkt-text-body-subtle" />
            )}
          </button>
        </div>
        <p className="text-xs text-pkt-text-body-subtle mt-2">
          Også sendt til din e-post med instruksjoner.
        </p>
      </div>
    );
  }

  return null;
}

// ============================================================================
// Info Card
// ============================================================================

// Check URL for magic link token and return initial state
function getInitialRegState(): RegistrationState {
  if (typeof window === 'undefined') return { step: 'idle' };

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (token) {
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    // TODO: Verify token with backend, get API key
    // For now, mock it
    return { step: 'success', apiKey: 'sk_live_' + token.slice(0, 24) };
  }

  return { step: 'idle' };
}

function InfoCard() {
  const [regState, setRegState] = useState<RegistrationState>(getInitialRegState);

  const handleStart = () => {
    setRegState({ step: 'info' });
  };

  const handleSubmit = async (email: string) => {
    setRegState({ step: 'sending', email });
    // TODO: Call Supabase auth.signInWithOtp({ email })
    // Mock delay for now
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRegState({ step: 'sent', email });
  };

  const handleClose = () => {
    setRegState({ step: 'idle' });
  };

  return (
    <div className="bg-pkt-bg-card rounded-lg border border-pkt-grays-gray-200 shadow-xl shadow-pkt-brand-dark-blue-1000/5 p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-pkt-brand-dark-blue-1000 flex items-center justify-center">
          <span className="text-white font-bold text-xl">§</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-pkt-text-body-dark">Lovdata MCP</h1>
          <p className="text-sm text-pkt-text-body-subtle">Model Context Protocol</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-pkt-text-body-default leading-relaxed mb-6">
        Gir AI-assistenter tilgang til norske lover og forskrifter fra Lovdata.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-pkt-bg-subtle mb-6">
        <div className="text-center">
          <div className="text-lg font-bold text-pkt-text-body-dark">770</div>
          <div className="text-xs text-pkt-text-body-subtle">Lover</div>
        </div>
        <div className="text-center border-x border-pkt-border-subtle">
          <div className="text-lg font-bold text-pkt-text-body-dark">3 600</div>
          <div className="text-xs text-pkt-text-body-subtle">Forskrifter</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-pkt-text-body-dark">92k</div>
          <div className="text-xs text-pkt-text-body-subtle">Paragrafer</div>
        </div>
      </div>

      {/* Pricing */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-pkt-border-subtle">
            <div className="text-sm font-medium text-pkt-text-body-dark">Gratis</div>
            <div className="text-xs text-pkt-text-body-subtle mt-1">100 oppslag/mnd</div>
          </div>
          <div className="p-3 rounded-lg border-2 border-pkt-brand-warm-blue-1000 bg-pkt-surface-subtle-pale-blue">
            <div className="text-sm font-medium text-pkt-text-body-dark">Pro · 49 kr/mnd</div>
            <div className="text-xs text-pkt-text-body-subtle mt-1">Ubegrenset</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <RegistrationFlow
          state={regState}
          onStart={handleStart}
          onSubmit={handleSubmit}
          onClose={handleClose}
        />
        {regState.step === 'idle' && (
          <Button variant="secondary" size="md">
            <a
              href="https://github.com/user/lovdata-mcp"
              className="flex items-center gap-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubLogoIcon className="w-4 h-4" />
              GitHub
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-pkt-bg-subtle flex">
      {/* Left side - Simulation (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-pkt-brand-dark-blue-1000 relative overflow-hidden">
        {/* Grid pattern */}
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
          className={`relative z-10 flex flex-col justify-center p-12 xl:p-16 w-full max-w-2xl transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
          }`}
        >
          {/* Header */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-3">
              Faktisk lovtekst, ikke gjetning
            </h2>
            <p className="text-white/60 leading-relaxed">
              AI hallusinerer ofte juss. Med tilgang til Lovdata kan de sitere korrekt.
            </p>
          </div>

          {/* Terminal simulation */}
          <div className="bg-black/30 backdrop-blur-sm rounded-lg border border-white/10 p-6">
            <LawLookupSimulation />
          </div>

          {/* Supported clients */}
          <div className="mt-8">
            <p className="text-xs text-white/40 mb-3">Fungerer med</p>
            <div className="flex flex-wrap gap-2">
              {['Claude', 'Cursor', 'VS Code', 'Windsurf'].map((client) => (
                <span
                  key={client}
                  className="px-3 py-1 text-xs text-white/70 bg-white/5 rounded-full border border-white/10"
                >
                  {client}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Info card */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 sm:p-8">
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          {/* Mobile header */}
          <div className="lg:hidden mb-6">
            <h1 className="text-2xl font-bold text-pkt-text-body-dark mb-2">
              Lovdata MCP
            </h1>
            <p className="text-sm text-pkt-text-body-subtle">
              Norsk lov for AI-assistenter
            </p>
          </div>

          <InfoCard />

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-pkt-text-body-subtle">
            Data fra{' '}
            <a href="https://lovdata.no" className="hover:underline">Lovdata</a>
            {' '}under NLOD 2.0 · Kode under MIT
          </p>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
