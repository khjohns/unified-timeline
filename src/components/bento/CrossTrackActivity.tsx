/**
 * CrossTrackActivity - Siste aktivitet på tvers av alle tre spor.
 *
 * Viser de 3 siste hendelsene (events) uavhengig av spor,
 * som en kompakt horisontal stripe. Gir umiddelbar kontekst
 * om hva som sist skjedde i saken uten å ekspandere noe.
 */

import { useMemo } from 'react';
import { clsx } from 'clsx';
import {
  ArrowRightIcon,
  ReloadIcon,
  ChatBubbleIcon,
  CrossCircledIcon,
  CheckCircledIcon,
} from '@radix-ui/react-icons';
import type { GrunnlagHistorikkEntry, VederlagHistorikkEntry, FristHistorikkEntry } from '../../types/api';
import { formatCurrency, formatDays } from '../../utils/formatters';
import type { SporType } from '../../types/timeline';

const MAX_ITEMS = 3;

interface UnifiedEntry {
  id: string;
  spor: SporType;
  sporLabel: string;
  tidsstempel: string;
  aktorRolle: 'TE' | 'BH';
  sammendrag: string;
  endringType: string;
}

const SPOR_DOT_COLORS: Record<SporType, string> = {
  grunnlag: 'bg-pkt-brand-dark-blue-1000',
  vederlag: 'bg-pkt-brand-warm-blue-1000',
  frist: 'bg-pkt-brand-yellow-1000',
};

const SPOR_LABELS: Record<SporType, string> = {
  grunnlag: 'Grunnlag',
  vederlag: 'Vederlag',
  frist: 'Frist',
};

function getEntryIcon(endringType: string, rolle: 'TE' | 'BH') {
  if (endringType === 'trukket') return <CrossCircledIcon className="w-3 h-3" />;
  if (endringType === 'akseptert') return <CheckCircledIcon className="w-3 h-3" />;
  if (endringType === 'oppdatert' || endringType === 'respons_oppdatert') return <ReloadIcon className="w-3 h-3" />;
  if (rolle === 'BH') return <ChatBubbleIcon className="w-3 h-3" />;
  return <ArrowRightIcon className="w-3 h-3" />;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Nå';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}t`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'I går';
    if (diffD < 7) return `${diffD}d`;
    return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function transformGrunnlag(entries: GrunnlagHistorikkEntry[]): UnifiedEntry[] {
  return entries.map(e => ({
    id: e.event_id,
    spor: 'grunnlag' as SporType,
    sporLabel: SPOR_LABELS.grunnlag,
    tidsstempel: e.tidsstempel,
    aktorRolle: e.aktor.rolle,
    sammendrag: getSammendragGrunnlag(e),
    endringType: e.endring_type,
  }));
}

function transformVederlag(entries: VederlagHistorikkEntry[]): UnifiedEntry[] {
  return entries.map(e => ({
    id: e.event_id,
    spor: 'vederlag' as SporType,
    sporLabel: SPOR_LABELS.vederlag,
    tidsstempel: e.tidsstempel,
    aktorRolle: e.aktor.rolle,
    sammendrag: getSammendragVederlag(e),
    endringType: e.endring_type,
  }));
}

function transformFrist(entries: FristHistorikkEntry[]): UnifiedEntry[] {
  return entries.map(e => ({
    id: e.event_id,
    spor: 'frist' as SporType,
    sporLabel: SPOR_LABELS.frist,
    tidsstempel: e.tidsstempel,
    aktorRolle: e.aktor.rolle,
    sammendrag: getSammendragFrist(e),
    endringType: e.endring_type,
  }));
}

function getSammendragGrunnlag(e: GrunnlagHistorikkEntry): string {
  if (e.endring_type === 'opprettet') return 'Opprettet';
  if (e.endring_type === 'oppdatert') return 'Oppdatert';
  if (e.endring_type === 'trukket') return 'Trukket';
  if (e.endring_type === 'akseptert') return 'Godtatt';
  if (e.endring_type === 'respons') {
    if (e.bh_resultat === 'godkjent') return 'Godkjent';
    if (e.bh_resultat === 'avslatt') return 'Avslått';
    return 'Svar mottatt';
  }
  if (e.endring_type === 'respons_oppdatert') return 'Svar oppdatert';
  return '';
}

function getSammendragVederlag(e: VederlagHistorikkEntry): string {
  if (e.endring_type === 'sendt') return e.krav_belop != null ? `Krevd ${formatCurrency(e.krav_belop)}` : 'Sendt';
  if (e.endring_type === 'oppdatert') return e.krav_belop != null ? `Oppdatert ${formatCurrency(e.krav_belop)}` : 'Oppdatert';
  if (e.endring_type === 'trukket') return 'Trukket';
  if (e.endring_type === 'akseptert') return 'Godtatt';
  if (e.endring_type === 'respons') {
    if (e.bh_resultat === 'godkjent') return `Godkjent ${formatCurrency(e.godkjent_belop)}`;
    if (e.bh_resultat === 'delvis_godkjent') return `Delvis ${formatCurrency(e.godkjent_belop)}`;
    return 'Avslått';
  }
  if (e.endring_type === 'respons_oppdatert') return 'Svar oppdatert';
  return '';
}

function getSammendragFrist(e: FristHistorikkEntry): string {
  if (e.endring_type === 'sendt') return e.krav_dager != null ? `Krevd ${formatDays(e.krav_dager)}` : 'Sendt';
  if (e.endring_type === 'oppdatert') return e.krav_dager != null ? `Oppdatert ${formatDays(e.krav_dager)}` : 'Oppdatert';
  if (e.endring_type === 'trukket') return 'Trukket';
  if (e.endring_type === 'akseptert') return 'Godtatt';
  if (e.endring_type === 'respons') {
    if (e.bh_resultat === 'godkjent') return `Godkjent ${formatDays(e.godkjent_dager)}`;
    if (e.bh_resultat === 'delvis_godkjent') return `Delvis ${formatDays(e.godkjent_dager)}`;
    return 'Avslått';
  }
  if (e.endring_type === 'respons_oppdatert') return 'Svar oppdatert';
  return '';
}

interface CrossTrackActivityProps {
  grunnlagHistorikk: GrunnlagHistorikkEntry[];
  vederlagHistorikk: VederlagHistorikkEntry[];
  fristHistorikk: FristHistorikkEntry[];
  className?: string;
}

export function CrossTrackActivity({
  grunnlagHistorikk,
  vederlagHistorikk,
  fristHistorikk,
  className,
}: CrossTrackActivityProps) {
  const recentEntries = useMemo(() => {
    const all = [
      ...transformGrunnlag(grunnlagHistorikk),
      ...transformVederlag(vederlagHistorikk),
      ...transformFrist(fristHistorikk),
    ];
    return all
      .sort((a, b) => new Date(b.tidsstempel).getTime() - new Date(a.tidsstempel).getTime())
      .slice(0, MAX_ITEMS);
  }, [grunnlagHistorikk, vederlagHistorikk, fristHistorikk]);

  if (recentEntries.length === 0) return null;

  return (
    <div className={clsx('rounded-lg bg-pkt-bg-card border border-pkt-border-subtle overflow-hidden', className)}>
      <div className="px-4 py-2.5">
        {/* Mobile: label above, items stack. Desktop: horizontal */}
        <p className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-2 sm:hidden">
          Siste aktivitet
        </p>

        <div className="sm:flex sm:items-center sm:gap-4">
          <p className="text-[10px] font-medium text-pkt-text-body-subtle uppercase tracking-wide shrink-0 hidden sm:block">
            Siste aktivitet
          </p>

          {/* Entries */}
          <div className="flex flex-col sm:flex-row gap-1 sm:gap-3 flex-1">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 px-2 py-1 rounded-md min-w-0"
              >
                {/* Spor dot */}
                <div className={clsx('w-1.5 h-1.5 rounded-full shrink-0', SPOR_DOT_COLORS[entry.spor])} />
                {/* Icon */}
                <span className="text-pkt-text-body-muted shrink-0">
                  {getEntryIcon(entry.endringType, entry.aktorRolle)}
                </span>
                {/* Text */}
                <div className="min-w-0 flex items-baseline gap-1">
                  <span className="text-[11px] font-medium text-pkt-text-body-default truncate">
                    {entry.sporLabel}
                  </span>
                  <span className="text-[11px] text-pkt-text-body-subtle truncate">
                    {entry.sammendrag}
                  </span>
                  <span className="text-[10px] text-pkt-text-body-muted shrink-0">
                    {formatRelativeTime(entry.tidsstempel)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
