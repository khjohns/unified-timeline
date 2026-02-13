import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LoadingState } from './components/PageStateHelpers';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

// Lazy load all pages for code splitting
const AuthLanding = lazy(() => import('./pages/AuthLanding'));
const OpprettSakPage = lazy(() => import('./pages/OpprettSakPage'));
const SaksoversiktPage = lazy(() => import('./pages/SaksoversiktPage'));
const CasePage = lazy(() => import('./pages/CasePage'));
const CasePageBento = lazy(() => import('./pages/CasePageBento'));
const ForseringPage = lazy(() => import('./pages/ForseringPage'));
const EndringsordePage = lazy(() => import('./pages/EndringsordePage'));
const OpprettEndringsordre = lazy(() => import('./pages/OpprettEndringsordre'));
const FravikOversiktPage = lazy(() => import('./pages/FravikOversiktPage'));
const FravikPage = lazy(() => import('./pages/FravikPage'));
const FravikAnalysePage = lazy(() => import('./pages/FravikAnalysePage'));
const ComponentShowcase = lazy(() => import('./pages/ComponentShowcase'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const IntegrasjonerPage = lazy(() => import('./pages/IntegrasjonerPage'));
const MappingDetailPage = lazy(() => import('./pages/MappingDetailPage'));
const PersonvernPage = lazy(() => import('./pages/PersonvernPage'));
const CookiesPage = lazy(() => import('./pages/CookiesPage'));
const OAuthConsentPage = lazy(() => import('./pages/OAuthConsentPage'));
const ProjectMembersPage = lazy(() => import('./pages/ProjectMembersPage'));
const OpprettProsjektPage = lazy(() => import('./pages/OpprettProsjektPage'));
const ProsjektInnstillingerPage = lazy(() => import('./pages/ProsjektInnstillingerPage'));

/**
 * Main App for Event Sourcing Architecture
 *
 * Routes:
 * - / : Auth landing (handles magic link token, redirects to case)
 * - /saker : Case overview page (list all cases from Supabase)
 * - /saker/ny : Create new case page (for external deployments)
 * - /saker/:sakId : Case detail view (timeline + dashboard + actions)
 * - /forsering/:sakId : Forsering case view (§33.8)
 * - /endringsordre/ny : Create new endringsordre (§31.3)
 * - /endringsordre/:sakId : Endringsordre case view (§31.3)
 * - /fravik : Fravik overview page (exemption applications)
 * - /fravik/:sakId : Fravik detail view (søknad + approval chain)
 * - /fravik-analyse : Fravik analytics (decision support for BH)
 * - /analyse : Analytics dashboard (project/portfolio insights)
 * - /integrasjoner : Dalux-Catenda sync management
 * - /medlemmer : Project members management
 * - /prosjekter/nytt : Create new project
 * - /innstillinger : Project settings
 * - /showcase : Component showcase for testing primitives
 * - /personvern : Privacy policy page (GDPR)
 * - /cookies : Cookie and local storage information
 */
const App: React.FC = () => {
  return (
    <Layout>
      <Suspense fallback={<LoadingState />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<AuthLanding />} />
          <Route path="/showcase" element={<ComponentShowcase />} />
          <Route path="/personvern" element={<PersonvernPage />} />
          <Route path="/cookies" element={<CookiesPage />} />
          <Route path="/oauth/consent" element={<OAuthConsentPage />} />

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
            path="/saker/:sakId/bento"
            element={
              <ProtectedRoute>
                <CasePageBento />
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
            path="/endringsordre/ny"
            element={
              <ProtectedRoute>
                <OpprettEndringsordre />
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
            path="/medlemmer"
            element={
              <ProtectedRoute>
                <ProjectMembersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/prosjekter/nytt"
            element={
              <ProtectedRoute>
                <OpprettProsjektPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/innstillinger"
            element={
              <ProtectedRoute>
                <ProsjektInnstillingerPage />
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
            path="/fravik/:sakId"
            element={
              <ProtectedRoute>
                <FravikPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/fravik-analyse"
            element={
              <ProtectedRoute>
                <FravikAnalysePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </Layout>
  );
};

export default App;
