/**
 * CaseIdentityTile - Case identity header for bento case page.
 *
 * Displays case ID, title, status, parties, amounts, and days
 * in a structured tile at the top of the bento grid.
 */

import { Badge } from '../primitives';
import { BentoCard } from '../dashboard/BentoCard';
import { getOverordnetStatusStyle, getSakstypeStyle } from '../../constants/statusStyles';
import { formatCurrency, formatDays } from '../../utils/formatters';
import type { SakState } from '../../types/timeline';

interface CaseIdentityTileProps {
  state: SakState;
  delay?: number;
}

export function CaseIdentityTile({ state, delay = 0 }: CaseIdentityTileProps) {
  const statusStyle = getOverordnetStatusStyle(state.overordnet_status);
  const sakstypeStyle = getSakstypeStyle(state.sakstype ?? 'standard');

  return (
    <BentoCard colSpan="col-span-12" delay={delay}>
      <div className="p-4">
        {/* Row 1: Case ID */}
        <p className="text-[11px] font-mono text-pkt-text-body-subtle tracking-wide">
          {state.sak_id}
        </p>

        {/* Row 2: Title */}
        <h2 className="text-lg font-semibold text-pkt-text-body-dark leading-tight mt-1">
          {state.sakstittel}
        </h2>

        {/* Row 3: Status badge + parties + sakstype */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-xs text-pkt-text-body-subtle">
          <Badge variant={statusStyle.variant} size="sm">
            {statusStyle.label}
          </Badge>

          {(state.byggherre || state.entreprenor) && (
            <>
              <span className="text-pkt-grays-gray-300">&middot;</span>
              <span className="flex items-center gap-1.5">
                {state.byggherre && (
                  <span className="font-medium text-pkt-text-body-default">{state.byggherre}</span>
                )}
                {state.byggherre && state.entreprenor && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-pkt-text-body-muted shrink-0">
                    <path d="M1 4H9M9 4L6 1M9 4L6 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {state.entreprenor && (
                  <span className="font-medium text-pkt-text-body-default">{state.entreprenor}</span>
                )}
              </span>
            </>
          )}

          <span className="text-pkt-grays-gray-300">&middot;</span>
          <Badge variant={sakstypeStyle.variant} size="sm">
            {sakstypeStyle.label}
          </Badge>
        </div>

        {/* Row 4: Amounts and days */}
        {(state.sum_krevd > 0 || state.sum_godkjent > 0 || state.frist?.krevd_dager || state.frist?.godkjent_dager) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-pkt-text-body-subtle">
            {state.sum_krevd > 0 && (
              <div className="flex items-baseline gap-1">
                <span>Krevd</span>
                <span className="font-mono font-medium text-pkt-text-body-default">
                  {formatCurrency(state.sum_krevd)}
                </span>
              </div>
            )}
            {state.sum_godkjent > 0 && (
              <div className="flex items-baseline gap-1">
                <span>Godkjent</span>
                <span className="font-mono font-medium text-badge-success-text">
                  {formatCurrency(state.sum_godkjent)}
                </span>
              </div>
            )}
            {state.frist?.krevd_dager != null && (
              <div className="flex items-baseline gap-1">
                <span>Krevd frist</span>
                <span className="font-mono font-medium text-pkt-text-body-default">
                  {formatDays(state.frist.krevd_dager)}
                </span>
              </div>
            )}
            {state.frist?.godkjent_dager != null && (
              <div className="flex items-baseline gap-1">
                <span>Godkjent frist</span>
                <span className="font-mono font-medium text-badge-success-text">
                  {formatDays(state.frist.godkjent_dager)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </BentoCard>
  );
}
