/**
 * AuthContext
 *
 * Manages magic link token authentication.
 * Reads token from URL query params and provides it to API client.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setAuthToken } from '../api/client';

interface AuthContextType {
  token: string | null;
  sakId: string | null;
  isVerifying: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  sakId: null,
  isVerifying: false,
  error: null,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

const SESSION_TOKEN_KEY = 'koe_auth_token';
const SESSION_SAK_KEY = 'koe_sak_id';

export function AuthProvider({ children }: AuthProviderProps) {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(SESSION_TOKEN_KEY));
  const [sakId, setSakId] = useState<string | null>(() => sessionStorage.getItem(SESSION_SAK_KEY));
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    const storedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const storedSakId = sessionStorage.getItem(SESSION_SAK_KEY);

    // If we have a stored token, use it
    if (!urlToken && storedToken && storedSakId) {
      setToken(storedToken);
      setSakId(storedSakId);
      setAuthToken(storedToken);
      setIsVerifying(false);
      return;
    }

    // No token at all
    if (!urlToken) {
      setIsVerifying(false);
      return;
    }

    // Verify new token with backend
    const verifyToken = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
        const response = await fetch(`${API_BASE_URL}/api/magic-link/verify?token=${urlToken}`);
        const data = await response.json();

        if (data.success && data.sakId) {
          // Store in sessionStorage for persistence across navigation
          sessionStorage.setItem(SESSION_TOKEN_KEY, urlToken);
          sessionStorage.setItem(SESSION_SAK_KEY, data.sakId);

          setToken(urlToken);
          setSakId(data.sakId);
          setAuthToken(urlToken); // Set token for API client
          setError(null);
        } else {
          setError(data.error || data.detail || 'Ugyldig eller utløpt lenke');
        }
      } catch (err) {
        setError('Kunne ikke verifisere lenke');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [searchParams]);

  return (
    <AuthContext.Provider value={{ token, sakId, isVerifying, error }}>
      {children}
    </AuthContext.Provider>
  );
}
