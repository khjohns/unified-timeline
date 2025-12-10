/**
 * StatusDashboard Component
 *
 * Displays a grid of status cards for all three tracks.
 * Provides situational awareness of the case state at a glance.
 */

import { StatusCard } from './StatusCard';
import { SakState } from '../../types/timeline';
import { ReactNode, useMemo } from 'react';
import { getOverordnetStatusLabel } from '../../constants/statusLabels';

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
 * Using vertical list layout (Forslag B: Minimal Soft)
 *
 * Supports subsidiary status display:
 * - When grunnlag is rejected but vederlag/frist is approved
 * - Uses visningsstatus from backend for full status text
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

      {/* Vertical list layout with rounded container */}
      <div className="bg-pkt-bg-subtle rounded-lg overflow-hidden divide-y divide-pkt-grays-gray-200">
        <StatusCard
          spor="grunnlag"
          status={state.grunnlag.status}
          title="Ansvarsgrunnlag"
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
          visningsstatus={state.visningsstatus_vederlag}
          erSubsidiaert={state.er_subsidiaert_vederlag}
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
          visningsstatus={state.visningsstatus_frist}
          erSubsidiaert={state.er_subsidiaert_frist}
        />
      </div>

      {/* Live region for screen readers - announces overall status changes */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Overordnet status: {getOverordnetStatusLabel(state.overordnet_status)}
      </div>
    </section>
  );
}
