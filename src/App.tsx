import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ExampleCasesPage } from './pages/ExampleCasesPage';
import { CasePage } from './pages/CasePage';
import { ComponentShowcase } from './pages/ComponentShowcase';

/**
 * Main App for Event Sourcing Architecture
 *
 * Routes:
 * - / : Example cases selector (mock mode)
 * - /saker/:sakId : Case detail view (timeline + dashboard + actions)
 * - /showcase : Component showcase for testing primitives
 */
const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<ExampleCasesPage />} />
      <Route path="/saker/:sakId" element={<CasePage />} />
      <Route path="/showcase" element={<ComponentShowcase />} />
    </Routes>
  );
};

export default App;
