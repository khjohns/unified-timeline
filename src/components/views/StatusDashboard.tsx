/**
 * StatusDashboard Component
 *
 * Displays a grid of status cards for all three tracks.
 * Provides situational awareness of the case state at a glance.
 */

import { StatusCard } from './StatusCard';
import { SakState } from '../../types/timeline';
import { ReactNode } from 'react';

interface StatusDashboardProps {
  state: SakState;
  grunnlagActions?: ReactNode;
  vederlagActions?: ReactNode;
  fristActions?: ReactNode;
}

/**
 * StatusDashboard renders the three-track status overview with contextual actions
 */
export function StatusDashboard({
  state,
  grunnlagActions,
  vederlagActions,
  fristActions,
}: StatusDashboardProps) {
  return (
    <section aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading" className="sr-only">
        Status Dashboard
      </h2>

      {/* Three-column grid for status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          spor="grunnlag"
          status={state.grunnlag.status}
          title="Grunnlag"
          lastUpdated={state.grunnlag.siste_oppdatert}
          actions={grunnlagActions}
        />
        <StatusCard
          spor="vederlag"
          status={state.vederlag.status}
          title="Vederlag"
          lastUpdated={state.vederlag.siste_oppdatert}
          actions={vederlagActions}
        />
        <StatusCard
          spor="frist"
          status={state.frist.status}
          title="Frist"
          lastUpdated={state.frist.siste_oppdatert}
          actions={fristActions}
        />
      </div>

      {/* Live region for screen readers - announces overall status changes */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Overordnet status: {state.overordnet_status}
      </div>
    </section>
  );
}
