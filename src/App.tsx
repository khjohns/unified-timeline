import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ExampleCasesPage } from './pages/ExampleCasesPage';
import { CasePage } from './pages/CasePage';
import { ForseringPage } from './pages/ForseringPage';
import { EndringsordePage } from './pages/EndringsordePage';
import { ComponentShowcase } from './pages/ComponentShowcase';
import { AuthLanding } from './pages/AuthLanding';

/**
 * Main App for Event Sourcing Architecture
 *
 * Routes:
 * - / : Auth landing (handles magic link token, redirects to case)
 * - /demo : Example cases selector (mock mode)
 * - /saker/:sakId : Case detail view (timeline + dashboard + actions)
 * - /forsering/:sakId : Forsering case view (§33.8)
 * - /endringsordre/:sakId : Endringsordre case view (§31.3)
 * - /showcase : Component showcase for testing primitives
 */
const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AuthLanding />} />
      <Route path="/demo" element={<ExampleCasesPage />} />
      <Route path="/saker/:sakId" element={<CasePage />} />
      <Route path="/forsering/:sakId" element={<ForseringPage />} />
      <Route path="/endringsordre/:sakId" element={<EndringsordePage />} />
      <Route path="/showcase" element={<ComponentShowcase />} />
    </Routes>
  );
};

export default App;
