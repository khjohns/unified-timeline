/**
 * BentoPageHeader - Beriklet header for bento-layouten.
 *
 * Integrerer prosjekt-metadata (parter, kategori, overordnet status)
 * direkte i headeren i stedet for en separat metadata-tile.
 *
 * Layout:
 * ┌────────────────────────────────────────────────────────┐
 * │ Sakstittel · Sak #123                                  │
 * │ Byggherre → Entreprenør  │  Kategori  │  Status-badge  │
 * └────────────────────────────────────────────────────────┘
 */

import { clsx } from 'clsx';
import { Badge } from '../primitives';
import { CategoryLabel } from '../shared';
import { getOverordnetStatusStyle } from '../../constants/statusStyles';
import type { SakState } from '../../types/timeline';

interface BentoPageHeaderMetaProps {
  state: SakState;
  className?: string;
}

/**
 * Compact metadata strip to embed in PageHeader area.
 * Shows project parties, category, and overall status.
 */
export function BentoHeaderMeta({ state, className }: BentoPageHeaderMetaProps) {
  const statusStyle = getOverordnetStatusStyle(state.overordnet_status);
  const hasParter = state.byggherre || state.entreprenor;
  const hasKategori = state.grunnlag.hovedkategori;

  if (!hasParter && !hasKategori) return null;

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-pkt-text-body-subtle',
        className,
      )}
    >
      {/* Kontraktsparter */}
      {hasParter && (
        <div className="flex items-center gap-1">
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
        </div>
      )}

      {/* Separator */}
      {hasParter && hasKategori && (
        <span className="text-pkt-grays-gray-300 hidden sm:inline">|</span>
      )}

      {/* Kategori */}
      {hasKategori && (
        <CategoryLabel
          hovedkategori={state.grunnlag.hovedkategori!}
          underkategori={Array.isArray(state.grunnlag.underkategori) ? state.grunnlag.underkategori[0] : state.grunnlag.underkategori}
        />
      )}

      {/* Separator */}
      <span className="text-pkt-grays-gray-300 hidden sm:inline">|</span>

      {/* Overordnet status */}
      <Badge variant={statusStyle.variant} size="sm">
        {statusStyle.label}
      </Badge>
    </div>
  );
}

/**
 * Contextual breadcrumb: Prosjekt > Sakstype > Sak-ID
 */
export function BentoBreadcrumb({
  prosjektNavn,
  sakId,
}: {
  prosjektNavn?: string;
  sakId: string;
}) {
  return (
    <div className="flex items-center gap-1 text-[11px] text-pkt-text-body-muted">
      {prosjektNavn && (
        <>
          <span>{prosjektNavn}</span>
          <span className="text-pkt-grays-gray-300">/</span>
        </>
      )}
      <span className="font-mono">{sakId}</span>
    </div>
  );
}

/**
 * Sum-indikatorer: Krevd vs Godkjent i headeren
 */
export function BentoSumIndicators({
  sumKrevd,
  sumGodkjent,
  className,
}: {
  sumKrevd: number;
  sumGodkjent: number;
  className?: string;
}) {
  if (sumKrevd === 0 && sumGodkjent === 0) return null;

  return (
    <div className={clsx('flex items-center gap-3 text-xs', className)}>
      {sumKrevd > 0 && (
        <div className="flex items-baseline gap-1">
          <span className="text-pkt-text-body-muted">Krevd</span>
          <span className="font-mono font-medium text-pkt-text-body-default">
            {sumKrevd.toLocaleString('nb-NO')} kr
          </span>
        </div>
      )}
      {sumGodkjent > 0 && (
        <div className="flex items-baseline gap-1">
          <span className="text-pkt-text-body-muted">Godkjent</span>
          <span className="font-mono font-medium text-badge-success-text">
            {sumGodkjent.toLocaleString('nb-NO')} kr
          </span>
        </div>
      )}
    </div>
  );
}
