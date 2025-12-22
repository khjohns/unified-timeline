/**
 * LoginForm Component
 *
 * Email/password login form for Supabase Auth.
 * Supports both login and registration.
 */

import { useState } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { ReloadIcon } from '@radix-ui/react-icons';

export function LoginForm() {
  const { signIn, signUp } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');

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
    <div className="min-h-screen bg-pkt-bg-default flex items-center justify-center px-4">
      <div className="max-w-md w-full p-6 sm:p-8 bg-white rounded-none shadow-lg border-2 border-pkt-border-default">
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
              className="w-full px-3 py-2 border-2 border-pkt-border-default bg-white text-pkt-text-body-default
                         focus:outline-none focus:border-pkt-brand-blue-700 focus:ring-0
                         placeholder:text-pkt-text-body-subtle"
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
              className="w-full px-3 py-2 border-2 border-pkt-border-default bg-white text-pkt-text-body-default
                         focus:outline-none focus:border-pkt-brand-blue-700 focus:ring-0
                         placeholder:text-pkt-text-body-subtle"
              placeholder={mode === 'register' ? 'Minst 6 tegn' : '********'}
            />
          </div>

          {message && (
            <div
              className={`p-3 text-sm ${
                message.type === 'error'
                  ? 'bg-red-50 text-pkt-brand-red-1000 border border-pkt-brand-red-1000'
                  : 'bg-green-50 text-green-800 border border-green-800'
              }`}
              role={message.type === 'error' ? 'alert' : 'status'}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-pkt-brand-blue-700 text-white font-medium
                       hover:bg-pkt-brand-blue-800 focus:outline-none focus:ring-2
                       focus:ring-pkt-brand-blue-700 focus:ring-offset-2
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
            className="text-sm text-pkt-brand-blue-700 hover:underline focus:outline-none"
          >
            {mode === 'login' ? 'Har du ikke konto? Registrer deg' : 'Har du allerede konto? Logg inn'}
          </button>
        </div>
      </div>
    </div>
  );
}
