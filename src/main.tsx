import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';

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

// Configure React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000, // 30 seconds
    },
    mutations: {
      retry: 0,
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
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
