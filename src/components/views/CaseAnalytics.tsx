/**
 * CaseAnalytics Component
 *
 * Displays key metrics and analysis for a case:
 * - Vederlag progress (krevd vs godkjent)
 * - Frist progress (krevd vs godkjent dager)
 * - Frist status indicators (varsler, frister)
 * - Subsidiær comparison (when applicable)
 */

import { useMemo } from 'react';
import { DashboardCard, Badge, DataList, DataListItem } from '../primitives';
import { SakState } from '../../types/timeline';
import { formatCurrency, formatDays } from '../../utils/formatters';
import {
  CheckCircledIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
} from '@radix-ui/react-icons';

interface CaseAnalyticsProps {
  state: SakState;
}

// ============ MAIN COMPONENT ============

export function CaseAnalytics({ state }: CaseAnalyticsProps) {
  const harVederlagData = state.vederlag.status !== 'utkast';
  const harFristData = state.frist.status !== 'utkast';

  // Subsidiær vises hvis det finnes subsidiaer_triggers eller har_subsidiaert_standpunkt
  const harSubsidiaer =
    state.vederlag.har_subsidiaert_standpunkt ||
    state.frist.har_subsidiaert_standpunkt ||
    (state.vederlag.subsidiaer_triggers && state.vederlag.subsidiaer_triggers.length > 0) ||
    (state.frist.subsidiaer_triggers && state.frist.subsidiaer_triggers.length > 0);

  if (!harVederlagData && !harFristData) {
    return (
      <div className="text-center py-6 text-pkt-text-body-subtle">
        Ingen krav er fremsatt ennå.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Nøkkeltall - side by side on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {harVederlagData && <VederlagNokkelkort state={state} />}
        {harFristData && <FristNokkelkort state={state} />}
      </div>

      {/* Fristindikator - kun hvis relevant */}
      {harFristData && <FriststatusIndikator state={state} />}

      {/* Subsidiær-sammenligning - kun hvis subsidiært */}
      {harSubsidiaer && <SubsidiaerSammenligning state={state} />}
    </div>
  );
}

// ============ PROGRESS BAR ============

interface ProgressBarProps {
  prosent: number;
  /** Invert colors: high = bad (red), low = good (green) */
  invertColors?: boolean;
}

function ProgressBar({ prosent, invertColors = false }: ProgressBarProps) {
  const clampedProsent = Math.min(Math.max(prosent, 0), 100);

  // Color logic: green = good, yellow = medium, red = bad
  // For godkjenning: høy prosent = bra (grønn)
  // invertColors flips this for cases where high = bad
  let colorClass: string;
  if (invertColors) {
    colorClass =
      clampedProsent >= 80
        ? 'bg-pkt-brand-red-1000'
        : clampedProsent >= 50
          ? 'bg-pkt-brand-yellow-1000'
          : 'bg-pkt-brand-dark-green-1000';
  } else {
    colorClass =
      clampedProsent >= 80
        ? 'bg-pkt-brand-dark-green-1000'
        : clampedProsent >= 50
          ? 'bg-pkt-brand-yellow-1000'
          : 'bg-pkt-brand-red-1000';
  }

  return (
    <div className="h-2 bg-pkt-border-subtle overflow-hidden">
      <div
        className={`h-full transition-all ${colorClass}`}
        style={{ width: `${clampedProsent}%` }}
      />
    </div>
  );
}

// ============ VEDERLAG NØKKELTALLKORT ============

function VederlagNokkelkort({ state }: { state: SakState }) {
  const krevdBelop = useMemo(() => {
    const v = state.vederlag;
    if (v.metode === 'REGNINGSARBEID' && v.kostnads_overslag !== undefined) {
      return v.kostnads_overslag;
    }
    return v.belop_direkte ?? 0;
  }, [state.vederlag]);

  const godkjentBelop = state.vederlag.godkjent_belop ?? 0;
  const prosent = krevdBelop > 0 ? (godkjentBelop / krevdBelop) * 100 : 0;
  const harRespons = state.vederlag.bh_resultat !== undefined;

  return (
    <DashboardCard title="Vederlag" variant="default">
      <div className="space-y-3">
        <DataList variant="list">
          <DataListItem label="Krevd">
            <span className="font-mono">{formatCurrency(krevdBelop)}</span>
          </DataListItem>
          {harRespons && (
            <DataListItem label="Godkjent">
              <span className="font-mono font-semibold text-pkt-brand-dark-green-1000">
                {formatCurrency(godkjentBelop)}
              </span>
              <span className="text-pkt-text-body-subtle ml-2">
                ({prosent.toFixed(0)}%)
              </span>
            </DataListItem>
          )}
        </DataList>

        {harRespons && <ProgressBar prosent={prosent} />}

        {!harRespons && (
          <p className="text-sm text-pkt-text-body-subtle italic">
            Venter på respons fra byggherre
          </p>
        )}
      </div>
    </DashboardCard>
  );
}

// ============ FRIST NØKKELTALLKORT ============

function FristNokkelkort({ state }: { state: SakState }) {
  const krevdDager = state.frist.krevd_dager ?? 0;
  const godkjentDager = state.frist.godkjent_dager ?? 0;
  const prosent = krevdDager > 0 ? (godkjentDager / krevdDager) * 100 : 0;
  const harRespons = state.frist.bh_resultat !== undefined;

  return (
    <DashboardCard title="Fristforlengelse" variant="default">
      <div className="space-y-3">
        <DataList variant="list">
          <DataListItem label="Krevd">
            <span className="font-mono">{formatDays(krevdDager)}</span>
          </DataListItem>
          {harRespons && (
            <DataListItem label="Godkjent">
              <span className="font-mono font-semibold text-pkt-brand-dark-green-1000">
                {formatDays(godkjentDager)}
              </span>
              <span className="text-pkt-text-body-subtle ml-2">
                ({prosent.toFixed(0)}%)
              </span>
            </DataListItem>
          )}
        </DataList>

        {harRespons && <ProgressBar prosent={prosent} />}

        {!harRespons && (
          <p className="text-sm text-pkt-text-body-subtle italic">
            Venter på respons fra byggherre
          </p>
        )}
      </div>
    </DashboardCard>
  );
}

// ============ FRISTSTATUS INDIKATOR ============

function FriststatusIndikator({ state }: { state: SakState }) {
  const { frist } = state;

  // Samle statuslinjer
  const statusItems: { label: string; ok: boolean; warning?: boolean }[] = [];

  // Varsel om fristforlengelse (§33.4)
  if (frist.frist_varsel?.dato_sendt) {
    statusItems.push({ label: 'Varsel om fristforlengelse sendt (§33.4)', ok: true });
  }

  // Spesifisert krav (§33.6)
  if (frist.spesifisert_varsel?.dato_sendt) {
    statusItems.push({ label: 'Spesifisert krav sendt (§33.6)', ok: true });
  } else if (frist.varsel_type === 'varsel' && frist.frist_for_spesifisering) {
    // Frist for spesifisering er satt, men ikke sendt ennå
    statusItems.push({
      label: 'Spesifisert krav ikke sendt',
      ok: false,
      warning: true,
    });
  }

  // BH har sendt forespørsel (§33.6.2)
  if (frist.har_bh_foresporsel) {
    statusItems.push({
      label: 'Byggherre har sendt forespørsel om spesifisering',
      ok: false,
      warning: true,
    });
  }

  // Hvis ingen status å vise, ikke render komponenten
  if (statusItems.length === 0) {
    return null;
  }

  return (
    <div className="p-3 bg-pkt-bg-subtle border border-pkt-border-subtle rounded">
      <h4 className="text-xs font-semibold text-pkt-text-body-subtle uppercase tracking-wide mb-2">
        Varselstatus
      </h4>
      <div className="space-y-1.5">
        {statusItems.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            {item.ok ? (
              <CheckCircledIcon className="w-4 h-4 text-pkt-brand-dark-green-1000 flex-shrink-0" />
            ) : item.warning ? (
              <ExclamationTriangleIcon className="w-4 h-4 text-badge-warning-text flex-shrink-0" />
            ) : (
              <CrossCircledIcon className="w-4 h-4 text-pkt-brand-red-1000 flex-shrink-0" />
            )}
            <span className={item.ok ? '' : 'text-pkt-text-body-subtle'}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ SUBSIDIÆR SAMMENLIGNING ============

function getResultatBadge(resultat?: string): { variant: 'success' | 'warning' | 'danger'; label: string } {
  switch (resultat) {
    case 'godkjent':
      return { variant: 'success', label: 'Godkjent' };
    case 'delvis_godkjent':
    case 'delvis':
      return { variant: 'warning', label: 'Delvis' };
    case 'avslatt':
      return { variant: 'danger', label: 'Avslått' };
    default:
      return { variant: 'warning', label: resultat || '—' };
  }
}

interface StandpunktRad {
  id: string;
  label: string;
  krevd: string;
  godkjent: string;
  badge: { variant: 'success' | 'warning' | 'danger'; label: string };
  isSubsidiaer?: boolean;
  strikethrough?: boolean;
}

function SubsidiaerSammenligning({ state }: { state: SakState }) {
  const harVederlagSubsidiaer = state.vederlag.har_subsidiaert_standpunkt ||
    (state.vederlag.subsidiaer_triggers && state.vederlag.subsidiaer_triggers.length > 0);
  const harFristSubsidiaer = state.frist.har_subsidiaert_standpunkt ||
    (state.frist.subsidiaer_triggers && state.frist.subsidiaer_triggers.length > 0);

  // Build rows
  const rows: StandpunktRad[] = [];

  // Vederlag
  if (harVederlagSubsidiaer) {
    const krevdBelop = state.vederlag.belop_direkte ?? state.vederlag.kostnads_overslag ?? 0;

    // Prinsipalt rad
    rows.push({
      id: 'vederlag-prinsipalt',
      label: 'Vederlag (prinsipalt)',
      krevd: formatCurrency(krevdBelop),
      godkjent: formatCurrency(state.vederlag.godkjent_belop),
      badge: getResultatBadge(state.vederlag.bh_resultat),
      strikethrough: state.vederlag.bh_resultat === 'avslatt',
    });

    // Subsidiær rad
    rows.push({
      id: 'vederlag-subsidiaer',
      label: '↳ Subsidiært',
      krevd: `(${formatCurrency(krevdBelop)})`,
      godkjent: formatCurrency(state.vederlag.subsidiaer_godkjent_belop),
      badge: getResultatBadge(state.vederlag.subsidiaer_resultat),
      isSubsidiaer: true,
    });
  }

  // Frist
  if (harFristSubsidiaer) {
    const krevdDager = state.frist.krevd_dager ?? 0;

    // Prinsipalt rad
    rows.push({
      id: 'frist-prinsipalt',
      label: 'Fristforlengelse (prinsipalt)',
      krevd: formatDays(krevdDager),
      godkjent: formatDays(state.frist.godkjent_dager),
      badge: getResultatBadge(state.frist.bh_resultat),
      strikethrough: state.frist.bh_resultat === 'avslatt',
    });

    // Subsidiær rad
    rows.push({
      id: 'frist-subsidiaer',
      label: '↳ Subsidiært',
      krevd: `(${formatDays(krevdDager)})`,
      godkjent: formatDays(state.frist.subsidiaer_godkjent_dager),
      badge: getResultatBadge(state.frist.subsidiaer_resultat),
      isSubsidiaer: true,
    });
  }

  return (
    <div className="p-3 bg-pkt-surface-subtle border border-pkt-border-subtle rounded">
      <h5 className="font-medium text-sm mb-3">Prinsipalt vs Subsidiært</h5>

      {/* Desktop: Table view */}
      <table className="hidden sm:table w-full text-sm">
        <thead>
          <tr className="border-b border-pkt-border-subtle">
            <th className="text-left py-1">Spor</th>
            <th className="text-right py-1">Krevd</th>
            <th className="text-right py-1">Godkjent</th>
            <th className="text-right py-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-pkt-border-subtle last:border-b-0 ${
                row.isSubsidiaer ? 'bg-alert-warning-bg' : ''
              }`}
            >
              <td className={`py-2 ${row.isSubsidiaer ? 'italic text-alert-warning-text' : ''}`}>
                {row.label}
              </td>
              <td className={`text-right font-mono ${
                row.strikethrough ? 'line-through text-pkt-text-body-subtle' : ''
              } ${row.isSubsidiaer ? 'text-alert-warning-text' : ''}`}>
                {row.krevd}
              </td>
              <td className={`text-right font-mono ${row.isSubsidiaer ? 'text-alert-warning-text' : ''}`}>
                {row.godkjent}
              </td>
              <td className="text-right">
                <Badge variant={row.badge.variant}>{row.badge.label}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: Card stack view */}
      <div className="sm:hidden space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`p-2 rounded border ${
              row.isSubsidiaer
                ? 'bg-alert-warning-bg border-alert-warning-border ml-3'
                : 'bg-pkt-bg-card border-pkt-border-subtle'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`font-medium text-sm ${row.isSubsidiaer ? 'italic text-alert-warning-text' : ''}`}>
                {row.label}
              </span>
              <Badge variant={row.badge.variant}>{row.badge.label}</Badge>
            </div>
            <div className={`flex justify-between text-xs ${row.isSubsidiaer ? 'text-alert-warning-text' : 'text-pkt-text-body-subtle'}`}>
              <span>Krevd: <span className={`font-mono ${row.strikethrough ? 'line-through' : ''}`}>{row.krevd}</span></span>
              <span>Godkjent: <span className="font-mono">{row.godkjent}</span></span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-pkt-text-body-subtle mt-3">
        Subsidiært standpunkt gjelder dersom prinsipalt standpunkt ikke får medhold.
      </p>
    </div>
  );
}
