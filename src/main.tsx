import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  STALE_TIME,
  RETRY_CONFIG,
  calculateRetryDelay,
} from './constants/queryConfig';
import { isRetryableError } from './api/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { UserRoleProvider } from './context/UserRoleContext';
import { SupabaseAuthProvider } from './context/SupabaseAuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/primitives/Toast';
import { ConnectionStatusProvider } from './hooks/useConnectionStatus';

// Handle GitHub Pages SPA routing redirect
// When 404.html redirects to /index.html?route=%2Fdemo, we need to
// update the URL to the actual route before React Router initializes
const params = new URLSearchParams(window.location.search);
const route = params.get('route');
if (route) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, ''); // Remove trailing slash
  const newUrl = basePath + route + window.location.hash;
  window.history.replaceState(null, '', newUrl);
}

// Configure React Query client with smart retry logic
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Only retry transient errors (network, 5xx, rate limit)
      retry: (failureCount, error) => {
        if (failureCount >= RETRY_CONFIG.MAX_QUERY_RETRIES) return false;
        return isRetryableError(error);
      },
      // Exponential backoff with jitter
      retryDelay: calculateRetryDelay,
      refetchOnWindowFocus: false,
      staleTime: STALE_TIME.DEFAULT,
    },
    mutations: {
      // Mutations get fewer retries to avoid duplicate state changes
      retry: (failureCount, error) => {
        if (failureCount >= RETRY_CONFIG.MAX_MUTATION_RETRIES) return false;
        return isRetryableError(error);
      },
      retryDelay: calculateRetryDelay,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode helps identify potential problems in the application during development.
  // It intentionally double-renders components to detect side effects.
  // TanStack Query v5 handles StrictMode correctly.
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <SupabaseAuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <ConnectionStatusProvider>
                <AuthProvider>
                  <UserRoleProvider>
                    <ErrorBoundary>
                      <App />
                    </ErrorBoundary>
                  </UserRoleProvider>
                </AuthProvider>
              </ConnectionStatusProvider>
            </ToastProvider>
          </ThemeProvider>
        </SupabaseAuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
