import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ExampleCasesPage } from './pages/ExampleCasesPage';
import { CasePage } from './pages/CasePage';

/**
 * Main App for Event Sourcing Architecture
 *
 * Routes:
 * - / : Example cases selector (mock mode)
 * - /saker/:sakId : Case detail view (timeline + dashboard + actions)
 */
const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<ExampleCasesPage />} />
      <Route path="/saker/:sakId" element={<CasePage />} />
    </Routes>
  );
};

export default App;
