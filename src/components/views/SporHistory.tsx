/**
 * SporHistory Component
 *
 * Displays event history for a single track (spor) using ActivityHistory primitive.
 * Handles transformation of spor-specific data to generic activity entries.
 */

import { useMemo, useState } from 'react';
import {
  ArrowRightIcon,
  ReloadIcon,
  ChatBubbleIcon,
  CheckIcon,
  FileTextIcon,
  EnvelopeClosedIcon,
} from '@radix-ui/react-icons';
import { SporType, SakState, TimelineEvent, extractEventType } from '../../types/timeline';
import { isLetterSupportedEvent } from '../../types/letter';
import { GrunnlagHistorikkEntry, VederlagHistorikkEntry, FristHistorikkEntry } from '../../types/api';
import { formatDateMedium, formatCurrency, formatDays } from '../../utils/formatters';
import { ActivityHistory, ActivityHistoryEntry, ActivityHistoryVariant } from '../primitives/ActivityHistory';
import { EventDetailModal } from './EventDetailModal';
import { LetterPreviewModal } from './LetterPreviewModal';

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
  /** SakState for letter generation in EventDetailModal */
  sakState?: SakState;
  defaultOpen?: boolean;
  /** Externally controlled open state (hides internal trigger) */
  externalOpen?: boolean;
  className?: string;
}

// ============ CONFIGURATION ============

/** BH resultat til sammendrag-tekst */
const BH_RESULTAT_LABELS: Record<string, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  frafalt: 'Frafalt',
};

/** Entry type mapping basert på endring_type og rolle */
const ENTRY_TYPE_MAP: Record<string, Record<'TE' | 'BH', SporHistoryEntryType>> = {
  sendt: { TE: 'te_krav', BH: 'bh_respons' },
  opprettet: { TE: 'te_krav', BH: 'bh_respons' },
  oppdatert: { TE: 'te_oppdatering', BH: 'bh_oppdatering' },
  trukket: { TE: 'te_oppdatering', BH: 'bh_oppdatering' },
  respons: { TE: 'te_oppdatering', BH: 'bh_respons' },
  respons_oppdatert: { TE: 'te_oppdatering', BH: 'bh_oppdatering' },
};

// ============ TRANSFORMATION FUNCTIONS ============

function getVederlagSammendrag(entry: VederlagHistorikkEntry): string {
  const { endring_type, krav_belop, godkjent_belop, bh_resultat } = entry;

  switch (endring_type) {
    case 'sendt':
      return krav_belop != null ? `Krevd ${formatCurrency(krav_belop)}` : 'Vederlagskrav sendt';
    case 'oppdatert':
      return krav_belop != null ? `Oppdatert til ${formatCurrency(krav_belop)}` : 'Krav oppdatert';
    case 'trukket':
      return 'Krav trukket';
    case 'respons': {
      const belopText = godkjent_belop != null ? ` ${formatCurrency(godkjent_belop)}` : '';
      if (bh_resultat === 'godkjent') return `Godkjent${belopText}`;
      if (bh_resultat === 'delvis_godkjent') return `Delvis godkjent:${belopText}`;
      return 'Avslått';
    }
    case 'respons_oppdatert':
      return 'Standpunkt oppdatert';
    default:
      return '';
  }
}

function getFristSammendrag(entry: FristHistorikkEntry): string {
  const { endring_type, krav_dager, godkjent_dager, bh_resultat } = entry;

  switch (endring_type) {
    case 'sendt':
      return krav_dager != null ? `Krevd ${formatDays(krav_dager)}` : 'Fristkrav sendt';
    case 'oppdatert':
      return krav_dager != null ? `Oppdatert til ${formatDays(krav_dager)}` : 'Krav oppdatert';
    case 'trukket':
      return 'Krav trukket';
    case 'respons': {
      const dagerText = godkjent_dager != null ? ` ${formatDays(godkjent_dager)}` : '';
      if (bh_resultat === 'godkjent') return `Godkjent${dagerText}`;
      if (bh_resultat === 'delvis_godkjent') return `Delvis godkjent:${dagerText}`;
      return 'Avslått';
    }
    case 'respons_oppdatert':
      return 'Standpunkt oppdatert';
    default:
      return '';
  }
}

function getGrunnlagSammendrag(entry: GrunnlagHistorikkEntry): string {
  const { endring_type, bh_resultat, bh_resultat_label } = entry;

  switch (endring_type) {
    case 'opprettet':
      return 'Grunnlag opprettet';
    case 'oppdatert':
      return 'Grunnlag oppdatert';
    case 'trukket':
      return 'Grunnlag trukket';
    case 'respons':
      return BH_RESULTAT_LABELS[bh_resultat ?? ''] || bh_resultat_label || 'Svar mottatt';
    case 'respons_oppdatert':
      return 'Standpunkt oppdatert';
    default:
      return '';
  }
}

function getEntryType(endringType: string, rolle: 'TE' | 'BH'): SporHistoryEntryType {
  return ENTRY_TYPE_MAP[endringType]?.[rolle] ?? (rolle === 'TE' ? 'te_oppdatering' : 'bh_oppdatering');
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
    type: getEntryType(entry.endring_type, entry.aktor.rolle),
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

/** Icon mapping per entry type */
const ENTRY_ICONS: Record<SporHistoryEntryType, React.ReactNode> = {
  te_krav: <ArrowRightIcon className="h-4 w-4" />,
  te_oppdatering: <ReloadIcon className="h-4 w-4" />,
  bh_respons: <ChatBubbleIcon className="h-4 w-4" />,
  bh_oppdatering: <CheckIcon className="h-4 w-4" />,
};

/** Variant mapping for BH resultat */
const BH_RESULTAT_VARIANTS: Record<string, ActivityHistoryVariant> = {
  godkjent: 'success',
  avslatt: 'danger',
  delvis_godkjent: 'warning',
};

function getEntryIcon(type: SporHistoryEntryType): React.ReactNode {
  return ENTRY_ICONS[type];
}

function getEntryVariant(type: SporHistoryEntryType, resultat?: string | null): ActivityHistoryVariant {
  // TE actions: always info variant
  if (type === 'te_krav' || type === 'te_oppdatering') {
    return 'info';
  }
  // BH actions: variant based on resultat
  return BH_RESULTAT_VARIANTS[resultat ?? ''] ?? 'warning';
}

function getEntryLabel(entry: SporHistoryEntry): string {
  const teVersionRef = entry.versjon > 1 ? ` · Rev. ${entry.versjon - 1}` : '';

  const labels: Record<SporHistoryEntryType, string> = {
    te_krav: 'Krav sendt',
    te_oppdatering: `Krav oppdatert${teVersionRef}`,
    bh_respons: `${entry.sammendrag || 'Svar mottatt'}${teVersionRef}`,
    bh_oppdatering: `Standpunkt oppdatert${teVersionRef}`,
  };

  return labels[entry.type];
}

// ============ COMPONENT ============

export function SporHistory({ entries, events = [], sakState, defaultOpen = false, externalOpen, className }: SporHistoryProps) {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [letterEvent, setLetterEvent] = useState<TimelineEvent | null>(null);

  // Create a map from entry ID to event for quick lookup
  const eventMap = useMemo(() => {
    const map = new Map<string, TimelineEvent>();
    for (const event of events) {
      map.set(event.id, event);
    }
    return map;
  }, [events]);

  // Sort by timestamp ascending and transform to ActivityHistoryEntry
  const activityEntries = useMemo((): ActivityHistoryEntry[] => {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.tidsstempel).getTime() - new Date(b.tidsstempel).getTime()
    );

    return sorted.map((entry): ActivityHistoryEntry => {
      const event = eventMap.get(entry.id);
      const eventType = event ? extractEventType(event.type) : null;
      const canGenerateLetter = sakState && event && eventType && isLetterSupportedEvent(eventType);

      return {
        id: entry.id,
        icon: getEntryIcon(entry.type),
        variant: getEntryVariant(entry.type, entry.resultat),
        label: getEntryLabel(entry),
        meta: `${entry.aktorRolle} · ${entry.aktorNavn} · ${formatDateMedium(entry.tidsstempel)}`,
        description: entry.begrunnelse || undefined,
        onClick: event ? () => setSelectedEvent(event) : undefined,
        clickIndicator: event ? (
          <FileTextIcon className="h-4 w-4 text-pkt-text-body-muted" aria-hidden="true" />
        ) : undefined,
        action: canGenerateLetter ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLetterEvent(event);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-pkt-brand-dark-blue-1000 bg-pkt-surface-gray hover:bg-pkt-surface-gray-dark rounded transition-colors"
            aria-label="Generer brev"
          >
            <EnvelopeClosedIcon className="h-3.5 w-3.5" />
            Brev
          </button>
        ) : undefined,
      };
    });
  }, [entries, eventMap, sakState]);

  if (activityEntries.length === 0) {
    return null;
  }

  return (
    <>
      <ActivityHistory
        entries={activityEntries}
        defaultOpen={defaultOpen}
        externalOpen={externalOpen}
        className={className}
      />

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          open={!!selectedEvent}
          onOpenChange={(open) => !open && setSelectedEvent(null)}
          event={selectedEvent}
        />
      )}

      {/* Letter Preview Modal */}
      {letterEvent && sakState && (
        <LetterPreviewModal
          open={!!letterEvent}
          onOpenChange={(open) => !open && setLetterEvent(null)}
          event={letterEvent}
          sakState={sakState}
        />
      )}
    </>
  );
}
