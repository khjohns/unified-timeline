/**
 * SporHistory Component
 *
 * Displays event history for a single track (spor) using a vertical timeline design.
 * Similar to ApprovalHistory but for TE claims and BH responses.
 */

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ChevronDownIcon,
  ArrowRightIcon,
  ReloadIcon,
  ChatBubbleIcon,
  CheckIcon,
  FileTextIcon,
} from '@radix-ui/react-icons';
import { SporType, TimelineEvent, extractEventType } from '../../types/timeline';
import { GrunnlagHistorikkEntry, VederlagHistorikkEntry, FristHistorikkEntry } from '../../types/api';
import { formatDateMedium, formatCurrency, formatDays } from '../../utils/formatters';
import { EventDetailModal } from './EventDetailModal';

// ============ TYPES ============

export type SporHistoryEntryType = 'te_krav' | 'te_oppdatering' | 'bh_respons' | 'bh_oppdatering';

export interface SporHistoryEntry {
  id: string;
  type: SporHistoryEntryType;
  versjon: number;
  tidsstempel: string;
  aktorNavn: string;
  aktorRolle: 'TE' | 'BH';
  sammendrag: string;
  /** Beløp for vederlag */
  belop?: number | null;
  /** Dager for frist */
  dager?: number | null;
  /** BH resultat (godkjent, avslatt, delvis_godkjent) */
  resultat?: string | null;
  /** Begrunnelse/kommentar */
  begrunnelse?: string | null;
}

export interface SporHistoryProps {
  spor: SporType;
  entries: SporHistoryEntry[];
  /** Timeline events for EventDetailModal lookup */
  events?: TimelineEvent[];
  defaultOpen?: boolean;
  className?: string;
}

// ============ TRANSFORMATION FUNCTIONS ============

function getVederlagSammendrag(entry: VederlagHistorikkEntry): string {
  if (entry.endring_type === 'sendt') {
    return entry.krav_belop != null ? `Krevd ${formatCurrency(entry.krav_belop)}` : 'Vederlagskrav sendt';
  }
  if (entry.endring_type === 'oppdatert') {
    return entry.krav_belop != null ? `Oppdatert til ${formatCurrency(entry.krav_belop)}` : 'Krav oppdatert';
  }
  if (entry.endring_type === 'trukket') {
    return 'Krav trukket';
  }
  if (entry.endring_type === 'respons') {
    if (entry.bh_resultat === 'godkjent') {
      return entry.godkjent_belop != null ? `Godkjent ${formatCurrency(entry.godkjent_belop)}` : 'Godkjent';
    }
    if (entry.bh_resultat === 'delvis_godkjent') {
      return entry.godkjent_belop != null ? `Delvis godkjent: ${formatCurrency(entry.godkjent_belop)}` : 'Delvis godkjent';
    }
    return 'Avslått';
  }
  if (entry.endring_type === 'respons_oppdatert') {
    return 'Standpunkt oppdatert';
  }
  return '';
}

function getFristSammendrag(entry: FristHistorikkEntry): string {
  if (entry.endring_type === 'sendt') {
    return entry.krav_dager != null ? `Krevd ${formatDays(entry.krav_dager)}` : 'Fristkrav sendt';
  }
  if (entry.endring_type === 'oppdatert') {
    return entry.krav_dager != null ? `Oppdatert til ${formatDays(entry.krav_dager)}` : 'Krav oppdatert';
  }
  if (entry.endring_type === 'trukket') {
    return 'Krav trukket';
  }
  if (entry.endring_type === 'respons') {
    if (entry.bh_resultat === 'godkjent') {
      return entry.godkjent_dager != null ? `Godkjent ${formatDays(entry.godkjent_dager)}` : 'Godkjent';
    }
    if (entry.bh_resultat === 'delvis_godkjent') {
      return entry.godkjent_dager != null ? `Delvis godkjent: ${formatDays(entry.godkjent_dager)}` : 'Delvis godkjent';
    }
    return 'Avslått';
  }
  if (entry.endring_type === 'respons_oppdatert') {
    return 'Standpunkt oppdatert';
  }
  return '';
}

function getEntryType(endringType: string, rolle: 'TE' | 'BH'): SporHistoryEntryType {
  if (rolle === 'TE') {
    return endringType === 'sendt' ? 'te_krav' : 'te_oppdatering';
  }
  return endringType === 'respons' ? 'bh_respons' : 'bh_oppdatering';
}

function getGrunnlagEntryType(endringType: string, rolle: 'TE' | 'BH'): SporHistoryEntryType {
  if (rolle === 'TE') {
    return endringType === 'opprettet' ? 'te_krav' : 'te_oppdatering';
  }
  return endringType === 'respons' ? 'bh_respons' : 'bh_oppdatering';
}

function getGrunnlagSammendrag(entry: GrunnlagHistorikkEntry): string {
  if (entry.endring_type === 'opprettet') {
    return 'Grunnlag opprettet';
  }
  if (entry.endring_type === 'oppdatert') {
    return 'Grunnlag oppdatert';
  }
  if (entry.endring_type === 'trukket') {
    return 'Grunnlag trukket';
  }
  if (entry.endring_type === 'respons') {
    if (entry.bh_resultat === 'godkjent') {
      return 'Godkjent';
    }
    if (entry.bh_resultat === 'delvis_godkjent') {
      return 'Delvis godkjent';
    }
    if (entry.bh_resultat === 'avslatt') {
      return 'Avslått';
    }
    if (entry.bh_resultat === 'frafalt') {
      return 'Frafalt';
    }
    if (entry.bh_resultat === 'krever_avklaring') {
      return 'Krever avklaring';
    }
    return entry.bh_resultat_label || 'Svar mottatt';
  }
  if (entry.endring_type === 'respons_oppdatert') {
    return 'Standpunkt oppdatert';
  }
  return '';
}

export function transformVederlagHistorikk(entries: VederlagHistorikkEntry[]): SporHistoryEntry[] {
  return entries.map((entry) => ({
    id: entry.event_id,
    type: getEntryType(entry.endring_type, entry.aktor.rolle),
    versjon: entry.versjon,
    tidsstempel: entry.tidsstempel,
    aktorNavn: entry.aktor.navn,
    aktorRolle: entry.aktor.rolle,
    sammendrag: getVederlagSammendrag(entry),
    belop: entry.krav_belop ?? entry.godkjent_belop,
    resultat: entry.bh_resultat,
    begrunnelse: entry.begrunnelse ?? entry.bh_begrunnelse,
  }));
}

export function transformFristHistorikk(entries: FristHistorikkEntry[]): SporHistoryEntry[] {
  return entries.map((entry) => ({
    id: entry.event_id,
    type: getEntryType(entry.endring_type, entry.aktor.rolle),
    versjon: entry.versjon,
    tidsstempel: entry.tidsstempel,
    aktorNavn: entry.aktor.navn,
    aktorRolle: entry.aktor.rolle,
    sammendrag: getFristSammendrag(entry),
    dager: entry.krav_dager ?? entry.godkjent_dager,
    resultat: entry.bh_resultat,
    begrunnelse: entry.begrunnelse ?? entry.bh_begrunnelse,
  }));
}

export function transformGrunnlagHistorikk(entries: GrunnlagHistorikkEntry[]): SporHistoryEntry[] {
  return entries.map((entry) => ({
    id: entry.event_id,
    type: getGrunnlagEntryType(entry.endring_type, entry.aktor.rolle),
    versjon: entry.versjon,
    tidsstempel: entry.tidsstempel,
    aktorNavn: entry.aktor.navn,
    aktorRolle: entry.aktor.rolle,
    sammendrag: getGrunnlagSammendrag(entry),
    resultat: entry.bh_resultat,
    begrunnelse: entry.beskrivelse ?? entry.bh_begrunnelse,
  }));
}

/** @deprecated Use transformGrunnlagHistorikk with backend historikk data instead */
const GRUNNLAG_EVENT_TYPES = [
  'grunnlag_opprettet',
  'grunnlag_oppdatert',
  'respons_grunnlag',
  'respons_grunnlag_oppdatert',
];

export function transformGrunnlagEvents(events: TimelineEvent[]): SporHistoryEntry[] {
  let teVersion = 0;

  return events
    .filter((e) => e.spor === 'grunnlag')
    .filter((e) => {
      const eventType = extractEventType(e.type);
      return GRUNNLAG_EVENT_TYPES.includes(eventType || '');
    })
    .map((event) => {
      const eventType = extractEventType(event.type);
      const isTeEvent = eventType?.startsWith('grunnlag_');
      const isBhEvent = eventType?.startsWith('respons_');

      // Track TE versions
      if (eventType === 'grunnlag_opprettet') {
        teVersion = 0;
      } else if (eventType === 'grunnlag_oppdatert') {
        teVersion++;
      }

      let type: SporHistoryEntryType;
      if (eventType === 'grunnlag_opprettet') {
        type = 'te_krav';
      } else if (eventType === 'grunnlag_oppdatert') {
        type = 'te_oppdatering';
      } else if (eventType === 'respons_grunnlag') {
        type = 'bh_respons';
      } else {
        type = 'bh_oppdatering';
      }

      // Safely access event data properties
      const eventData = event.data as Record<string, unknown> | undefined;

      return {
        id: event.id,
        type,
        versjon: isTeEvent ? teVersion : 0,
        tidsstempel: event.time || '',
        aktorNavn: event.actor || '',
        aktorRolle: (isBhEvent ? 'BH' : 'TE') as 'TE' | 'BH',
        sammendrag: event.summary || '',
        resultat: eventData?.resultat as string | undefined,
        begrunnelse: eventData?.begrunnelse as string | undefined,
      };
    });
}

// ============ HELPER FUNCTIONS ============

function getEntryIcon(type: SporHistoryEntryType) {
  switch (type) {
    case 'te_krav':
      return <ArrowRightIcon className="h-4 w-4" />;
    case 'te_oppdatering':
      return <ReloadIcon className="h-4 w-4" />;
    case 'bh_respons':
      return <ChatBubbleIcon className="h-4 w-4" />;
    case 'bh_oppdatering':
      return <CheckIcon className="h-4 w-4" />;
  }
}

function getEntryStyle(type: SporHistoryEntryType, resultat?: string | null): { color: string; hasBackground: boolean } {
  // TE actions: no background, just icon color
  if (type === 'te_krav' || type === 'te_oppdatering') {
    return { color: 'text-pkt-text-body-muted', hasBackground: false };
  }

  // BH actions: colored background based on result
  if (resultat === 'godkjent') {
    return { color: 'text-pkt-text-success bg-pkt-bg-success', hasBackground: true };
  }
  if (resultat === 'avslatt') {
    return { color: 'text-pkt-text-error bg-pkt-bg-error', hasBackground: true };
  }
  // delvis_godkjent or unknown
  return { color: 'text-pkt-text-warning bg-pkt-bg-warning', hasBackground: true };
}

function getEntryLabel(entry: SporHistoryEntry): string {
  const versionSuffix = entry.type === 'te_oppdatering' && entry.versjon > 0 ? ` (Rev. ${entry.versjon})` : '';

  switch (entry.type) {
    case 'te_krav':
      return 'Krav sendt';
    case 'te_oppdatering':
      return `Krav oppdatert${versionSuffix}`;
    case 'bh_respons':
      return entry.sammendrag || 'Svar mottatt';
    case 'bh_oppdatering':
      return 'Standpunkt oppdatert';
  }
}

// ============ COMPONENTS ============

interface SporHistoryItemProps {
  entry: SporHistoryEntry;
  isLast: boolean;
  onShowDetails?: () => void;
}

function SporHistoryItem({ entry, isLast, onShowDetails }: SporHistoryItemProps) {
  const style = getEntryStyle(entry.type, entry.resultat);

  return (
    <div className="flex gap-3 pb-3">
      {/* Icon column */}
      <div className="flex flex-col items-center">
        <div
          className={clsx(
            'flex h-6 w-6 items-center justify-center flex-shrink-0',
            style.hasBackground && 'rounded-full',
            style.color
          )}
        >
          {getEntryIcon(entry.type)}
        </div>
        {!isLast && <div className="flex-1 w-0.5 bg-pkt-border-subtle mt-1" />}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">{getEntryLabel(entry)}</div>
          {onShowDetails && (
            <button
              onClick={onShowDetails}
              className="text-xs text-pkt-text-body-muted hover:text-pkt-text-action-active transition-colors flex items-center gap-1"
              title="Vis detaljer"
            >
              <FileTextIcon className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="text-xs text-pkt-text-body-muted">
          {entry.aktorRolle} · {entry.aktorNavn} · {formatDateMedium(entry.tidsstempel)}
        </div>
        {entry.begrunnelse && (
          <div className="mt-1 text-sm text-pkt-text-body-default italic truncate">
            "{entry.begrunnelse}"
          </div>
        )}
      </div>
    </div>
  );
}

export function SporHistory({ entries, events = [], defaultOpen = false, className }: SporHistoryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  // Sort by timestamp ascending
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(a.tidsstempel).getTime() - new Date(b.tidsstempel).getTime()),
    [entries]
  );

  // Create a map from entry ID to event for quick lookup
  const eventMap = useMemo(() => {
    const map = new Map<string, TimelineEvent>();
    for (const event of events) {
      map.set(event.id, event);
    }
    return map;
  }, [events]);

  if (sortedEntries.length === 0) {
    return null;
  }

  return (
    <div className={clsx('mt-4 pt-3 border-t border-pkt-border-subtle', className)}>
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 text-sm text-pkt-text-body-muted hover:text-pkt-text-body-default transition-colors"
        aria-expanded={isOpen}
      >
        <ChevronDownIcon
          className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
        />
        <span>Historikk ({sortedEntries.length})</span>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="mt-3">
          {sortedEntries.map((entry, index) => {
            const event = eventMap.get(entry.id);
            return (
              <SporHistoryItem
                key={entry.id}
                entry={entry}
                isLast={index === sortedEntries.length - 1}
                onShowDetails={event ? () => setSelectedEvent(event) : undefined}
              />
            );
          })}
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          open={!!selectedEvent}
          onOpenChange={(open) => !open && setSelectedEvent(null)}
          event={selectedEvent}
        />
      )}
    </div>
  );
}
