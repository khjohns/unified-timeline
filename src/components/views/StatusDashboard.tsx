/**
 * StatusDashboard Component
 *
 * Displays a grid of status cards for all three tracks.
 * Provides situational awareness of the case state at a glance.
 */

import { StatusCard } from './StatusCard';
import { SakState } from '../../types/timeline';
import { ReactNode, useMemo } from 'react';

interface StatusDashboardProps {
  state: SakState;
  grunnlagActions?: ReactNode;
  vederlagActions?: ReactNode;
  fristActions?: ReactNode;
}

/**
 * Get krevd beløp based on vederlagsmetode
 * - ENHETSPRISER/FASTPRIS_TILBUD: belop_direkte
 * - REGNINGSARBEID: kostnads_overslag
 */
function getKrevdBelop(state: SakState): number | undefined {
  const v = state.vederlag;
  if (v.metode === 'REGNINGSARBEID' && v.kostnads_overslag !== undefined) {
    return v.kostnads_overslag;
  }
  return v.belop_direkte;
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
  const krevdBelop = useMemo(() => getKrevdBelop(state), [state]);

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
          krevd={krevdBelop}
          godkjent={state.vederlag.godkjent_belop}
          unit="kr"
        />
        <StatusCard
          spor="frist"
          status={state.frist.status}
          title="Frist"
          lastUpdated={state.frist.siste_oppdatert}
          actions={fristActions}
          krevd={state.frist.krevd_dager}
          godkjent={state.frist.godkjent_dager}
          unit="dager"
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
