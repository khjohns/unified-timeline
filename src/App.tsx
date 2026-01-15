import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { PageLoadingFallback } from './components/PageLoadingFallback';
import { ProtectedRoute } from './components/ProtectedRoute';

// Lazy load all pages for code splitting
const AuthLanding = lazy(() => import('./pages/AuthLanding'));
const ExampleCasesPage = lazy(() => import('./pages/ExampleCasesPage'));
const OpprettSakPage = lazy(() => import('./pages/OpprettSakPage'));
const SaksoversiktPage = lazy(() => import('./pages/SaksoversiktPage'));
const CasePage = lazy(() => import('./pages/CasePage'));
const ForseringPage = lazy(() => import('./pages/ForseringPage'));
const EndringsordePage = lazy(() => import('./pages/EndringsordePage'));
const FravikOversiktPage = lazy(() => import('./pages/FravikOversiktPage'));
const FravikPage = lazy(() => import('./pages/FravikPage'));
const ComponentShowcase = lazy(() => import('./pages/ComponentShowcase'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const IntegrasjonerPage = lazy(() => import('./pages/IntegrasjonerPage'));
const MappingDetailPage = lazy(() => import('./pages/MappingDetailPage'));

/**
 * Main App for Event Sourcing Architecture
 *
 * Routes:
 * - / : Auth landing (handles magic link token, redirects to case)
 * - /demo : Example cases selector (mock mode)
 * - /saker : Case overview page (list all cases from Supabase)
 * - /saker/ny : Create new case page (for external deployments)
 * - /saker/:sakId : Case detail view (timeline + dashboard + actions)
 * - /forsering/:sakId : Forsering case view (§33.8)
 * - /endringsordre/:sakId : Endringsordre case view (§31.3)
 * - /fravik : Fravik overview page (exemption applications)
 * - /fravik/:soknadId : Fravik detail view (søknad + approval chain)
 * - /analyse : Analytics dashboard (project/portfolio insights)
 * - /integrasjoner : Dalux-Catenda sync management
 * - /showcase : Component showcase for testing primitives
 */
const App: React.FC = () => {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<AuthLanding />} />
        <Route path="/demo" element={<ExampleCasesPage />} />
        <Route path="/showcase" element={<ComponentShowcase />} />

        {/* Protected routes - require Supabase Auth */}
        <Route
          path="/saker"
          element={
            <ProtectedRoute>
              <SaksoversiktPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saker/ny"
          element={
            <ProtectedRoute>
              <OpprettSakPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saker/:sakId"
          element={
            <ProtectedRoute>
              <CasePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forsering/:sakId"
          element={
            <ProtectedRoute>
              <ForseringPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/endringsordre/:sakId"
          element={
            <ProtectedRoute>
              <EndringsordePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analyse"
          element={
            <ProtectedRoute>
              <AnalyticsDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/integrasjoner"
          element={
            <ProtectedRoute>
              <IntegrasjonerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/integrasjoner/:id"
          element={
            <ProtectedRoute>
              <MappingDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fravik"
          element={
            <ProtectedRoute>
              <FravikOversiktPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fravik/:soknadId"
          element={
            <ProtectedRoute>
              <FravikPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
};

export default App;
