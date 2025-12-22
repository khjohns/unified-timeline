/**
 * ProtectedRoute Component
 *
 * Wrapper that requires Supabase authentication.
 * Shows login form if user is not authenticated.
 */

import { ReactNode } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { LoginForm } from './LoginForm';
import { ReloadIcon } from '@radix-ui/react-icons';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, isConfigured } = useSupabaseAuth();

  // If Supabase is not configured, allow access (dev mode)
  if (!isConfigured) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-pkt-bg-default flex items-center justify-center">
        <div className="text-center">
          <ReloadIcon className="w-12 h-12 mx-auto mb-4 text-pkt-border-default animate-spin" />
          <p className="text-pkt-text-body-subtle">Laster...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!user) {
    return <LoginForm />;
  }

  // Authenticated - render children
  return <>{children}</>;
}
