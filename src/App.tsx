import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { PageLoadingFallback } from './components/PageLoadingFallback';

// Lazy load all pages for code splitting
const AuthLanding = lazy(() => import('./pages/AuthLanding'));
const ExampleCasesPage = lazy(() => import('./pages/ExampleCasesPage'));
const OpprettSakPage = lazy(() => import('./pages/OpprettSakPage'));
const SaksoversiktPage = lazy(() => import('./pages/SaksoversiktPage'));
const CasePage = lazy(() => import('./pages/CasePage'));
const ForseringPage = lazy(() => import('./pages/ForseringPage'));
const EndringsordePage = lazy(() => import('./pages/EndringsordePage'));
const ComponentShowcase = lazy(() => import('./pages/ComponentShowcase'));

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
 * - /showcase : Component showcase for testing primitives
 */
const App: React.FC = () => {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        <Route path="/" element={<AuthLanding />} />
        <Route path="/demo" element={<ExampleCasesPage />} />
        <Route path="/saker" element={<SaksoversiktPage />} />
        <Route path="/saker/ny" element={<OpprettSakPage />} />
        <Route path="/saker/:sakId" element={<CasePage />} />
        <Route path="/forsering/:sakId" element={<ForseringPage />} />
        <Route path="/endringsordre/:sakId" element={<EndringsordePage />} />
        <Route path="/showcase" element={<ComponentShowcase />} />
      </Routes>
    </Suspense>
  );
};

export default App;
