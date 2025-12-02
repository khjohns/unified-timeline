/**
 * StatusDashboard Component
 *
 * Displays a grid of status cards for all three tracks.
 * Provides situational awareness of the case state at a glance.
 */

import { StatusCard } from './StatusCard';
import { SakState } from '../../types/timeline';

interface StatusDashboardProps {
  state: SakState;
}

/**
 * StatusDashboard renders the three-track status overview
 */
export function StatusDashboard({ state }: StatusDashboardProps) {
  return (
    <section aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading" className="sr-only">
        Status Dashboard
      </h2>

      {/* Three-column grid for status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-pkt-04">
        <StatusCard
          spor="grunnlag"
          status={state.grunnlag.status}
          title="Grunnlag"
          lastUpdated={state.grunnlag.siste_oppdatert}
        />
        <StatusCard
          spor="vederlag"
          status={state.vederlag.status}
          title="Vederlag"
          lastUpdated={state.vederlag.siste_oppdatert}
        />
        <StatusCard
          spor="frist"
          status={state.frist.status}
          title="Frist"
          lastUpdated={state.frist.siste_oppdatert}
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
