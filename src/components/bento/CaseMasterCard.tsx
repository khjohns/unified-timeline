/**
 * CaseMasterCard — Merged identity + grunnlag card.
 *
 * Combines CaseIdentityTile (case ID, title, parties, status) with
 * GrunnlagCard (category, dates, BH response) into a single master card
 * that anchors Row 1 of the bento grid.
 */

import { clsx } from 'clsx';
import { CheckIcon, Cross2Icon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Badge } from '../primitives';
import { getOverordnetStatusStyle, getSakstypeStyle } from '../../constants/statusStyles';
import {
  getHovedkategori,
  getUnderkategoriObj,
} from '../../constants/categories';
import { formatDateShort } from '../../utils/formatters';
import { StatusDot } from './track-cards/StatusDot';
import { TrackHistory } from './track-cards/TrackHistory';
import { TrackCTA } from './track-cards/TrackCTA';
import { VerdictCards, type VerdictOption } from './VerdictCards';
import type { SakState } from '../../types/timeline';
import type { AvailableActions } from '../../hooks/useActionPermissions';
import type { SporHistoryEntry } from '../views/SporHistory';

interface CaseMasterCardProps {
  state: SakState;
  userRole: 'TE' | 'BH';
  actions: AvailableActions;
  grunnlagEntries: SporHistoryEntry[];
  primaryAction?: { label: string; onClick: () => void };
  secondaryActions?: { label: string; onClick: () => void; variant?: 'default' | 'danger' }[];
  isGrunnlagFormExpanded?: boolean;
  /** Inline form controls when grunnlag form is expanded */
  formVarsletITide?: boolean;
  onFormVarsletITideChange?: (value: boolean) => void;
  formResultat?: string;
  onFormResultatChange?: (value: string) => void;
  formResultatError?: boolean;
  verdictOptions?: VerdictOption[];
  showVarsletToggle?: boolean;
  className?: string;
}

// ---- Category helpers ----

interface CategoryInfo {
  line1: string;
  line1Hjemmel: string | null;
  line2: string | null;
  /** What this category entitles: vederlag ref + frist ref */
  entitles: { vederlag: string | null; frist: string };
}

function formatCategoryInfo(hovedkategori: string | undefined, underkategori: string | string[] | undefined): CategoryInfo | null {
  if (!hovedkategori) return null;

  const hkObj = getHovedkategori(hovedkategori);
  if (!hkObj) return null;

  const entitles = {
    vederlag: hkObj.hjemmel_vederlag ? `§${hkObj.hjemmel_vederlag}` : null,
    frist: `§${hkObj.hjemmel_frist}`,
  };

  if (hkObj.kode === 'FORCE_MAJEURE') {
    return { line1: 'FORCE MAJEURE', line1Hjemmel: `§${hkObj.hjemmel_frist}`, line2: null, entitles };
  }

  const ukCode = Array.isArray(underkategori) ? underkategori[0] : underkategori;
  const ukObj = ukCode ? getUnderkategoriObj(ukCode) : undefined;

  const codeLabel = hkObj.kode.replace(/_/g, ' ');
  const hjemmel = ukObj ? `§${ukObj.hjemmel_basis}` : null;

  let line2: string | null = null;
  if (ukObj) {
    line2 = ukObj.label.replace(/\s*\(([^)]+)\)\s*$/, ' — $1');
  }

  return { line1: codeLabel, line1Hjemmel: hjemmel, line2, entitles };
}

export function CaseMasterCard({
  state,
  userRole,
  actions,
  grunnlagEntries,
  primaryAction,
  secondaryActions,
  isGrunnlagFormExpanded,
  formVarsletITide,
  onFormVarsletITideChange,
  formResultat,
  onFormResultatChange,
  formResultatError,
  verdictOptions,
  showVarsletToggle,
  className,
}: CaseMasterCardProps) {
  const g = state.grunnlag;
  const status = g.status;
  const statusStyle = getOverordnetStatusStyle(state.overordnet_status);
  const sakstypeStyle = getSakstypeStyle(state.sakstype ?? 'standard');

  const hasCategory = !!g.hovedkategori;
  const hasDates = !!(g.dato_oppdaget || g.grunnlag_varsel?.dato_sendt);
  const hasBhResponse = !!g.bh_resultat;
  const isEmpty = !hasCategory && !hasDates && status === 'utkast';

  const categoryInfo = formatCategoryInfo(g.hovedkategori, g.underkategori);

  return (
    <div
      className={clsx(
        'bg-pkt-bg-card rounded-lg p-4',
        className,
      )}
    >
      {/* ===== Identity section ===== */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-pkt-text-body-subtle tracking-wide">
            {state.sak_id}
            <span className="text-pkt-grays-gray-300 mx-1.5">&middot;</span>
            <span className="font-sans">{sakstypeStyle.label}</span>
          </p>
          <h2 className="text-lg font-semibold text-pkt-text-body-dark leading-tight mt-0.5">
            {state.sakstittel}
          </h2>
          {(state.byggherre || state.entreprenor) && (
            <p className="text-xs text-pkt-text-body-subtle mt-1">
              {state.byggherre && (
                <span className="font-medium text-pkt-text-body-default">{state.byggherre}</span>
              )}
              {state.byggherre && state.entreprenor && (
                <span className="mx-1.5 text-pkt-text-body-muted">&rarr;</span>
              )}
              {state.entreprenor && (
                <span className="font-medium text-pkt-text-body-default">{state.entreprenor}</span>
              )}
            </p>
          )}
        </div>
        <Badge variant={statusStyle.variant} size="sm" className="shrink-0 mt-0.5">
          {statusStyle.label}
        </Badge>
      </div>

      {/* ===== Divider ===== */}
      <hr className="border-pkt-border-subtle my-3" />

      {/* ===== Grunnlag section ===== */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Ansvarsgrunnlag
          </span>
          <span className="text-[10px] text-pkt-text-body-muted">
            &sect;25.2
          </span>
        </div>
        <StatusDot status={status} />
      </div>

      {isEmpty ? (
        <p className="text-xs text-pkt-text-body-muted italic">Ingen data enn&aring;</p>
      ) : (
        <>
          {/* Category: type + hjemmel + what it entitles */}
          {categoryInfo && (
            <div className="mb-2">
              <p className="text-[11px] font-semibold text-pkt-text-body-default uppercase tracking-wide">
                {categoryInfo.line1}
                {categoryInfo.line1Hjemmel && (
                  <span className="text-pkt-text-body-muted font-normal ml-1.5">
                    &middot; {categoryInfo.line1Hjemmel}
                  </span>
                )}
              </p>
              {categoryInfo.line2 && (
                <p className="text-sm text-pkt-text-body-default mt-0.5">
                  {categoryInfo.line2}
                </p>
              )}
              {/* What this entitles */}
              <p className="text-[10px] text-pkt-text-body-muted mt-1">
                Gir krav p&aring;:
                {categoryInfo.entitles.vederlag && (
                  <> Vederlag ({categoryInfo.entitles.vederlag})</>
                )}
                {categoryInfo.entitles.vederlag && <> &middot; </>}
                Frist ({categoryInfo.entitles.frist})
              </p>
            </div>
          )}

          {/* Beskrivelse */}
          {g.beskrivelse && (
            <p className="text-sm text-pkt-text-body-default italic mb-2 line-clamp-4">
              &laquo;{g.beskrivelse}&raquo;
            </p>
          )}

          {/* Key-value rows: dates */}
          {hasDates && (
            <div className="space-y-1">
              {g.dato_oppdaget && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-pkt-text-body-subtle">Oppdaget</span>
                  <span className="text-xs font-mono text-pkt-text-body-default">
                    {formatDateShort(g.dato_oppdaget)}
                  </span>
                </div>
              )}
              {g.grunnlag_varsel?.dato_sendt && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-pkt-text-body-subtle">Varslet</span>
                  <span className="text-xs font-mono text-pkt-text-body-default">
                    {formatDateShort(g.grunnlag_varsel.dato_sendt)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Inline form controls when grunnlag form is expanded */}
          {isGrunnlagFormExpanded && (showVarsletToggle || verdictOptions) && (
            <div className={clsx(hasDates && 'mt-2 pt-2 border-t border-pkt-border-subtle', 'space-y-3')}>
              {/* Varslet i tide toggle */}
              {showVarsletToggle && onFormVarsletITideChange && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-pkt-text-body-subtle">Varslet i tide?</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onFormVarsletITideChange(true)}
                      className={clsx(
                        'flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all cursor-pointer',
                        formVarsletITide === true
                          ? 'border-pkt-brand-dark-green-1000 bg-pkt-brand-dark-green-1000/5 text-pkt-brand-dark-green-1000'
                          : 'border-pkt-border-default bg-pkt-bg-subtle text-pkt-text-body-default',
                        formVarsletITide !== undefined && formVarsletITide !== true && 'opacity-50',
                      )}
                    >
                      <CheckIcon className="w-3 h-3" />
                      Ja
                    </button>
                    <button
                      type="button"
                      onClick={() => onFormVarsletITideChange(false)}
                      className={clsx(
                        'flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all cursor-pointer',
                        formVarsletITide === false
                          ? 'border-pkt-brand-red-1000 bg-pkt-brand-red-1000/5 text-pkt-brand-red-1000'
                          : 'border-pkt-border-default bg-pkt-bg-subtle text-pkt-text-body-default',
                        formVarsletITide !== undefined && formVarsletITide !== false && 'opacity-50',
                      )}
                    >
                      <Cross2Icon className="w-3 h-3" />
                      Nei
                    </button>
                  </div>
                </div>
              )}

              {/* Verdict cards */}
              {verdictOptions && onFormResultatChange && (
                <div>
                  <p className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-1.5">
                    Ditt svar
                  </p>
                  <VerdictCards
                    value={formResultat}
                    onChange={onFormResultatChange}
                    error={formResultatError}
                    options={verdictOptions}
                  />
                </div>
              )}
            </div>
          )}

          {/* BH assessment section — below divider */}
          {!isGrunnlagFormExpanded && hasBhResponse && (
            <div className={clsx(hasDates && 'mt-2 pt-2 border-t border-pkt-border-subtle', 'space-y-1')}>
              {/* Varslet i tide — only shown when BH has assessed it */}
              {g.grunnlag_varslet_i_tide != null && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-pkt-text-body-subtle">Varslet i tide</span>
                  {g.grunnlag_varslet_i_tide ? (
                    <span className="text-xs font-semibold text-pkt-brand-dark-green-1000 flex items-center gap-1">
                      Ja <CheckIcon className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-pkt-brand-red-1000 flex items-center gap-1">
                      Nei <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              )}

              {/* BH resultat */}
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-pkt-text-body-subtle">BH resultat</span>
                <span
                  className={clsx(
                    'text-sm font-semibold flex items-center gap-1',
                    g.bh_resultat === 'godkjent' && 'text-pkt-brand-dark-green-1000',
                    g.bh_resultat === 'avslatt' && 'text-pkt-brand-red-1000',
                    g.bh_resultat === 'frafalt' && 'text-pkt-text-body-muted',
                  )}
                >
                  {g.bh_resultat === 'godkjent' ? 'Godkjent' : g.bh_resultat === 'avslatt' ? 'Avsl\u00e5tt' : 'Frafalt'}
                  {g.bh_resultat === 'godkjent' && <CheckIcon className="w-4 h-4" />}
                  {g.bh_resultat === 'avslatt' && <Cross2Icon className="w-4 h-4" />}
                </span>
              </div>

              {/* BH begrunnelse */}
              {g.bh_begrunnelse && (
                <p className="text-[11px] text-pkt-text-body-muted italic line-clamp-4 mt-0.5">
                  &laquo;{g.bh_begrunnelse}&raquo;
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* History */}
      <TrackHistory entries={grunnlagEntries} />

      {/* CTA strip */}
      {!isGrunnlagFormExpanded && (
        <TrackCTA
          spor="grunnlag"
          status={status}
          state={state}
          userRole={userRole}
          actions={actions}
          primaryAction={primaryAction}
          secondaryActions={secondaryActions}
        />
      )}
    </div>
  );
}
