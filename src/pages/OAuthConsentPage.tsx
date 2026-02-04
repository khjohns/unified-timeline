/**
 * OAuth Consent Page
 *
 * Displays authorization request details and allows users to approve or deny
 * third-party applications (like Claude.ai) access to their account.
 *
 * This page is part of the Supabase OAuth 2.1 Server flow.
 * When a client requests authorization, Supabase redirects here with an
 * authorization_id parameter.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { LoadingState, ErrorState } from '../components/PageStateHelpers';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

interface AuthorizationDetails {
  client: {
    name: string;
    client_id: string;
  };
  scopes: string[];
  redirect_uri: string;
}

export default function OAuthConsentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useSupabaseAuth();

  const [authDetails, setAuthDetails] = useState<AuthorizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const authorizationId = searchParams.get('authorization_id');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      const returnUrl = `/oauth/consent?authorization_id=${authorizationId}`;
      navigate(`/?redirect=${encodeURIComponent(returnUrl)}`);
    }
  }, [authLoading, user, authorizationId, navigate]);

  // Fetch authorization details via backend API (server-side proxy to Supabase)
  useEffect(() => {
    async function fetchAuthDetails() {
      if (!authorizationId) {
        setLoading(false);
        return;
      }
      if (!user) return;

      try {
        // Get the user's session token
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        if (!accessToken) {
          setError('Ingen gyldig sesjon. Vennligst logg inn på nytt.');
          setLoading(false);
          return;
        }

        console.log('Fetching authorization details via backend for:', authorizationId);

        // Call our backend API which proxies to Supabase
        const response = await fetch(
          `${API_BASE_URL}/api/oauth/authorization/${authorizationId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const data = await response.json();
        console.log('Authorization details response:', { status: response.status, data });

        if (!response.ok) {
          setError(`${data.message || data.error || 'Ukjent feil'} (${response.status})`);
          return;
        }

        if (!data) {
          setError('Ingen autorisasjonsdetaljer returnert. authorization_id kan være utløpt.');
          return;
        }

        setAuthDetails(data);
      } catch (err) {
        console.error('Error fetching auth details:', err);
        setError(err instanceof Error ? err.message : 'Kunne ikke hente autorisasjonsdetaljer');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchAuthDetails();
    }
  }, [authorizationId, user]);

  const handleApprove = async () => {
    if (!authorizationId) return;

    setProcessing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        setError('Ingen gyldig sesjon. Vennligst logg inn på nytt.');
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/oauth/authorization/${authorizationId}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || data.error || 'Kunne ikke godkjenne autorisasjonen');
        return;
      }

      // Redirect back to the client with the authorization code
      if (data?.redirect_to) {
        window.location.href = data.redirect_to;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke godkjenne autorisasjonen');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeny = async () => {
    if (!authorizationId) return;

    setProcessing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        setError('Ingen gyldig sesjon. Vennligst logg inn på nytt.');
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/oauth/authorization/${authorizationId}/deny`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || data.error || 'Kunne ikke avslå autorisasjonen');
        return;
      }

      // Redirect back to the client with error
      if (data?.redirect_to) {
        window.location.href = data.redirect_to;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke avslå autorisasjonen');
    } finally {
      setProcessing(false);
    }
  };

  // Show loading while checking auth
  if (authLoading || (loading && user)) {
    return <LoadingState />;
  }

  // Missing authorization_id
  if (!authorizationId) {
    return (
      <ErrorState
        title="Mangler autorisasjons-ID"
        message="Ingen authorization_id parameter i URL-en."
      />
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pkt-bg-subtle p-4">
        <div className="bg-pkt-bg-default rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
          <h1 className="text-xl font-semibold text-red-600">Autorisasjonsfeil</h1>
          <p className="text-pkt-text-body-default">{error}</p>
          <div className="text-xs text-pkt-text-body-subtle space-y-1 bg-pkt-bg-subtle p-3 rounded font-mono">
            <p><strong>authorization_id:</strong> {authorizationId || 'mangler'}</p>
            <p><strong>Innlogget bruker:</strong> {user?.email || 'ikke innlogget'}</p>
            <p><strong>supabase.auth.oauth:</strong> {
              // @ts-expect-error - checking if oauth exists
              supabase.auth.oauth ? 'tilgjengelig' : 'ikke tilgjengelig'
            }</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  // Not authenticated (should redirect, but show fallback)
  if (!user) {
    return <LoadingState />;
  }

  // No auth details yet
  if (!authDetails) {
    return <LoadingState />;
  }

  const scopeDescriptions: Record<string, string> = {
    openid: 'Grunnleggende identitet',
    profile: 'Profilinformasjon (navn)',
    email: 'E-postadresse',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pkt-bg-subtle p-4">
      <div className="bg-pkt-bg-default rounded-lg shadow-lg max-w-md w-full p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-pkt-bg-subtle rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-pkt-text-body-subtle"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-pkt-text-body-default">
            Gi tilgang til {authDetails.client.name}?
          </h1>
          <p className="text-sm text-pkt-text-body-subtle mt-2">
            {authDetails.client.name} ber om tilgang til kontoen din.
          </p>
        </div>

        {/* User info */}
        <div className="bg-pkt-bg-subtle rounded-md p-3">
          <p className="text-sm text-pkt-text-body-subtle">Logget inn som</p>
          <p className="text-sm font-medium text-pkt-text-body-default">{user.email}</p>
        </div>

        {/* Requested permissions */}
        {authDetails.scopes && authDetails.scopes.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-pkt-text-body-default mb-2">
              Tillatelser som forespørres:
            </h2>
            <ul className="space-y-2">
              {authDetails.scopes.map((scope) => (
                <li
                  key={scope}
                  className="flex items-center gap-2 text-sm text-pkt-text-body-subtle"
                >
                  <svg
                    className="w-4 h-4 text-green-600 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {scopeDescriptions[scope] || scope}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleDeny}
            disabled={processing}
            className="flex-1 px-4 py-2.5 rounded-md border border-pkt-border-default bg-pkt-bg-default text-pkt-text-body-default hover:bg-pkt-bg-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Avslå
          </button>
          <button
            onClick={handleApprove}
            disabled={processing}
            className="flex-1 px-4 py-2.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Behandler...' : 'Godkjenn'}
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-pkt-text-body-subtle text-center">
          Ved å godkjenne gir du {authDetails.client.name} tilgang til informasjonen nevnt
          ovenfor. Du kan når som helst trekke tilbake tilgangen.
        </p>
      </div>
    </div>
  );
}
