/**
 * SporSection Component
 *
 * Eksperimentell horisontal layout for spor på desktop.
 * Viser hjemmel, data og historikk side-by-side for å spare vertikal plass.
 *
 * Mobil: Bruker eksisterende vertikal layout (fallback til DashboardCard-stil)
 * Desktop (lg+): Horisontal 3-kolonne layout
 */

import { ReactNode, useState, useMemo } from 'react';
import { Badge } from '../primitives';
import { SakState, SporStatus, TimelineEvent } from '../../types/timeline';
import { getSporStatusStyle } from '../../constants/statusStyles';
import { KontraktsregelInline } from '../shared/KontraktsregelInline';
import { getHovedkategoriLabel, getUnderkategoriLabel } from '../../constants/categories';
import { getVederlagsmetodeLabel } from '../../constants/paymentMethods';
import {
  formatCurrency,
  formatDays,
  formatDateMedium,
  formatBHResultat,
  formatVarselType,
} from '../../utils/formatters';
import { SporHistoryEntry, SporHistoryEntryType } from './SporHistory';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDownIcon } from '@radix-ui/react-icons';

type SporType = 'grunnlag' | 'vederlag' | 'frist';

interface SporSectionProps {
  spor: SporType;
  state: SakState;
  historyEntries: SporHistoryEntry[];
  events?: TimelineEvent[];
  actions?: ReactNode;
}

/** Map SporStatus til Badge */
function getStatusBadge(status: SporStatus): ReactNode {
  const { variant, label } = getSporStatusStyle(status);
  return <Badge variant={variant} size="sm">{label}</Badge>;
}

/** Titler per spor */
const SPOR_TITLES: Record<SporType, string> = {
  grunnlag: 'Ansvarsgrunnlag',
  vederlag: 'Vederlag',
  frist: 'Fristforlengelse',
};

/** Hjemler per spor (forenklet mapping) */
function getHjemmelForSpor(spor: SporType, state: SakState): '§25.2' | '§32.2' | '§33.4' | null {
  switch (spor) {
    case 'grunnlag':
      // Forenklet: bruk §32.2 for irregulære endringer som default
      return '§32.2';
    case 'vederlag':
      return null; // Vederlag har ikke enkel hjemmel-mapping
    case 'frist':
      return '§33.4';
    default:
      return null;
  }
}

/** Get variant fra entry type og resultat */
function getEntryVariant(type: SporHistoryEntryType, resultat?: string | null): 'info' | 'success' | 'warning' | 'danger' {
  if (type === 'te_krav' || type === 'te_oppdatering') {
    return 'info';
  }
  if (resultat === 'godkjent') return 'success';
  if (resultat === 'avslatt') return 'danger';
  return 'warning';
}

/** Kompakt historikk-visning for desktop */
function CompactHistory({
  entries,
  maxVisible = 3,
}: {
  entries: SporHistoryEntry[];
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-pkt-text-body-muted italic">Ingen hendelser</p>
    );
  }

  // Sort by timestamp ascending
  const sorted = [...entries].sort(
    (a, b) => new Date(a.tidsstempel).getTime() - new Date(b.tidsstempel).getTime()
  );

  const visibleEntries = expanded ? sorted : sorted.slice(0, maxVisible);
  const hasMore = sorted.length > maxVisible;

  return (
    <div className="space-y-1.5">
      {visibleEntries.map((entry) => {
        const variant = getEntryVariant(entry.type, entry.resultat);
        return (
          <div key={entry.id} className="flex items-start gap-2">
            <div
              className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                variant === 'success'
                  ? 'bg-badge-success-bg'
                  : variant === 'danger'
                    ? 'bg-badge-danger-bg'
                    : variant === 'warning'
                      ? 'bg-badge-warning-bg'
                      : 'bg-badge-info-bg'
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-pkt-text-body truncate">{entry.sammendrag}</p>
              <p className="text-xs text-pkt-text-body-muted">
                {entry.aktorRolle} · {formatDateMedium(entry.tidsstempel)}
              </p>
            </div>
          </div>
        );
      })}
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-pkt-text-interactive hover:underline"
        >
          +{sorted.length - maxVisible} flere
        </button>
      )}
      {hasMore && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-pkt-text-interactive hover:underline"
        >
          Vis færre
        </button>
      )}
    </div>
  );
}

/** Data-felt for et spor */
function SporDataFields({ spor, state }: { spor: SporType; state: SakState }) {
  const vederlagErSubsidiaer = state.vederlag.subsidiaer_godkjent_belop != null;
  const fristErSubsidiaer = state.frist.subsidiaer_godkjent_dager != null;

  const krevdBelop = useMemo(() => {
    const v = state.vederlag;
    if (v.metode === 'REGNINGSARBEID' && v.kostnads_overslag !== undefined) {
      return v.kostnads_overslag;
    }
    return v.belop_direkte;
  }, [state.vederlag]);

  switch (spor) {
    case 'grunnlag':
      return (
        <div className="space-y-1.5 text-sm">
          {state.grunnlag.hovedkategori && (
            <div>
              <span className="text-pkt-text-body-subtle">Kategori: </span>
              <span className="text-pkt-text-body">
                {getHovedkategoriLabel(state.grunnlag.hovedkategori)}
                {state.grunnlag.underkategori && (
                  <> → {Array.isArray(state.grunnlag.underkategori)
                    ? state.grunnlag.underkategori.map(uk => getUnderkategoriLabel(uk)).join(', ')
                    : getUnderkategoriLabel(state.grunnlag.underkategori)}</>
                )}
              </span>
            </div>
          )}
          {state.grunnlag.grunnlag_varsel?.dato_sendt && (
            <div>
              <span className="text-pkt-text-body-subtle">Varslet: </span>
              <span className="text-pkt-text-body">
                {formatDateMedium(state.grunnlag.grunnlag_varsel.dato_sendt)}
              </span>
            </div>
          )}
          {state.grunnlag.bh_resultat && (
            <div>
              <span className="text-pkt-text-body-subtle">Resultat: </span>
              <span className="text-pkt-text-body font-medium">
                {formatBHResultat(state.grunnlag.bh_resultat).label}
              </span>
            </div>
          )}
        </div>
      );

    case 'vederlag':
      return (
        <div className="space-y-1.5 text-sm">
          {state.vederlag.metode && (
            <div>
              <span className="text-pkt-text-body-subtle">Metode: </span>
              <span className="text-pkt-text-body">
                {getVederlagsmetodeLabel(state.vederlag.metode)}
              </span>
            </div>
          )}
          <div>
            <span className="text-pkt-text-body-subtle">Krevd: </span>
            <span className="text-pkt-text-body font-medium">
              {formatCurrency(krevdBelop)}
            </span>
          </div>
          {vederlagErSubsidiaer ? (
            state.vederlag.subsidiaer_godkjent_belop != null && (
              <div>
                <span className="text-pkt-text-body-subtle">Subs. godkjent: </span>
                <span className="text-pkt-text-body">
                  {formatCurrency(state.vederlag.subsidiaer_godkjent_belop)}
                </span>
              </div>
            )
          ) : (
            state.vederlag.godkjent_belop !== undefined && (
              <div>
                <span className="text-pkt-text-body-subtle">Godkjent: </span>
                <span className="text-pkt-text-body">
                  {formatCurrency(state.vederlag.godkjent_belop)}
                </span>
              </div>
            )
          )}
          {state.vederlag.bh_resultat && (
            <div>
              <span className="text-pkt-text-body-subtle">Resultat: </span>
              <span className="text-pkt-text-body font-medium">
                {formatBHResultat(state.vederlag.bh_resultat).label}
              </span>
            </div>
          )}
        </div>
      );

    case 'frist':
      return (
        <div className="space-y-1.5 text-sm">
          {state.frist.krevd_dager !== undefined && (
            <div>
              <span className="text-pkt-text-body-subtle">Krevd: </span>
              <span className="text-pkt-text-body font-medium">
                {formatDays(state.frist.krevd_dager)}
              </span>
            </div>
          )}
          {fristErSubsidiaer ? (
            state.frist.subsidiaer_godkjent_dager != null && (
              <div>
                <span className="text-pkt-text-body-subtle">Subs. godkjent: </span>
                <span className="text-pkt-text-body">
                  {formatDays(state.frist.subsidiaer_godkjent_dager)}
                </span>
              </div>
            )
          ) : (
            state.frist.godkjent_dager !== undefined && (
              <div>
                <span className="text-pkt-text-body-subtle">Godkjent: </span>
                <span className="text-pkt-text-body">
                  {formatDays(state.frist.godkjent_dager)}
                </span>
              </div>
            )
          )}
          {state.frist.varsel_type && (
            <div>
              <span className="text-pkt-text-body-subtle">Varseltype: </span>
              <span className="text-pkt-text-body">
                {formatVarselType(state.frist.varsel_type)}
              </span>
            </div>
          )}
          {state.frist.bh_resultat && (
            <div>
              <span className="text-pkt-text-body-subtle">Resultat: </span>
              <span className="text-pkt-text-body font-medium">
                {formatBHResultat(state.frist.bh_resultat).label}
              </span>
            </div>
          )}
        </div>
      );
  }
}

/** Begrunnelse-visning */
function BegrunnelseSection({ spor, state }: { spor: SporType; state: SakState }) {
  const begrunnelse = spor === 'grunnlag'
    ? state.grunnlag.beskrivelse
    : spor === 'vederlag'
      ? state.vederlag.begrunnelse
      : state.frist.begrunnelse;

  if (!begrunnelse) return null;

  return (
    <div className="mt-2">
      <p className="text-xs text-pkt-text-body-subtle mb-1">Begrunnelse:</p>
      <p className="text-sm text-pkt-text-body italic line-clamp-3">
        "{begrunnelse}"
      </p>
    </div>
  );
}

/**
 * SporSection - Horisontal layout for desktop
 */
export function SporSection({
  spor,
  state,
  historyEntries,
  actions,
}: SporSectionProps) {
  const [hjemmelOpen, setHjemmelOpen] = useState(false);

  const status = spor === 'grunnlag'
    ? state.grunnlag.status
    : spor === 'vederlag'
      ? state.vederlag.status
      : state.frist.status;

  const hjemmel = getHjemmelForSpor(spor, state);

  return (
    <div className="rounded-lg border border-pkt-border-subtle bg-pkt-bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-pkt-surface-strong-gray border-b border-pkt-border-subtle">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm text-pkt-text-body-dark">
            {SPOR_TITLES[spor]}
          </h3>
          {hjemmel && (
            <span className="text-xs text-pkt-text-body-subtle">{hjemmel}</span>
          )}
        </div>
        {getStatusBadge(status)}
      </div>

      {/* Content - Horisontal grid på desktop */}
      <div className="p-4">
        {/* Desktop: 3-kolonne grid */}
        <div className="hidden lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)] lg:gap-6">
          {/* Kolonne 1: Hjemmel */}
          <div className="min-w-0">
            <p className="text-xs font-medium text-pkt-text-body-subtle mb-2 uppercase tracking-wide">
              Hjemmel
            </p>
            {hjemmel ? (
              <div className="text-sm">
                <Collapsible.Root open={hjemmelOpen} onOpenChange={setHjemmelOpen}>
                  <Collapsible.Trigger asChild>
                    <button
                      type="button"
                      className="flex items-start gap-1 text-left text-pkt-text-body hover:text-pkt-text-body-dark transition-colors"
                    >
                      <ChevronDownIcon
                        className={`h-4 w-4 mt-0.5 shrink-0 transition-transform ${hjemmelOpen ? '' : '-rotate-90'}`}
                      />
                      <span className="line-clamp-2">
                        {hjemmel === '§32.2' && 'Varslingsplikt ved irregulær endring'}
                        {hjemmel === '§33.4' && 'Varslingsplikt for fristforlengelse'}
                        {hjemmel === '§25.2' && 'Varslingsplikt ved uegnet prosjektering'}
                      </span>
                    </button>
                  </Collapsible.Trigger>
                  <Collapsible.Content className="mt-2">
                    <KontraktsregelInline hjemmel={hjemmel} />
                  </Collapsible.Content>
                </Collapsible.Root>
              </div>
            ) : (
              <p className="text-sm text-pkt-text-body-muted italic">
                {spor === 'vederlag' ? '§34 Vederlagsjustering' : 'Ikke angitt'}
              </p>
            )}
          </div>

          {/* Kolonne 2: Data + Begrunnelse */}
          <div className="min-w-0">
            <p className="text-xs font-medium text-pkt-text-body-subtle mb-2 uppercase tracking-wide">
              Krav
            </p>
            <SporDataFields spor={spor} state={state} />
            <BegrunnelseSection spor={spor} state={state} />
          </div>

          {/* Kolonne 3: Historikk */}
          <div className="min-w-0">
            <p className="text-xs font-medium text-pkt-text-body-subtle mb-2 uppercase tracking-wide">
              Historikk
            </p>
            <CompactHistory entries={historyEntries} />
          </div>
        </div>

        {/* Mobil: Vertikal stacking */}
        <div className="lg:hidden space-y-4">
          <SporDataFields spor={spor} state={state} />
          <BegrunnelseSection spor={spor} state={state} />
          {historyEntries.length > 0 && (
            <div className="pt-3 border-t border-pkt-border-subtle">
              <p className="text-xs font-medium text-pkt-text-body-subtle mb-2">
                Historikk ({historyEntries.length})
              </p>
              <CompactHistory entries={historyEntries} maxVisible={2} />
            </div>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="mt-4 pt-3 border-t border-pkt-border-subtle flex flex-wrap gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
