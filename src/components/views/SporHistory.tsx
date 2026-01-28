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

function getEntryVariant(type: SporHistoryEntryType, resultat?: string | null): ActivityHistoryVariant {
  // TE actions: info variant (neutral cyan)
  if (type === 'te_krav' || type === 'te_oppdatering') {
    return 'info';
  }

  // BH actions: variant based on result
  if (resultat === 'godkjent') {
    return 'success';
  }
  if (resultat === 'avslatt') {
    return 'danger';
  }
  // delvis_godkjent or unknown
  return 'warning';
}

function getEntryLabel(entry: SporHistoryEntry): string {
  // TE-versjonsreferanse for oppdateringer og BH-responser
  const teVersionRef = entry.versjon > 1 ? ` · Rev. ${entry.versjon}` : '';

  switch (entry.type) {
    case 'te_krav':
      return 'Krav sendt';
    case 'te_oppdatering':
      return `Krav oppdatert${teVersionRef}`;
    case 'bh_respons':
      return `${entry.sammendrag || 'Svar mottatt'}${teVersionRef}`;
    case 'bh_oppdatering':
      return `Standpunkt oppdatert${teVersionRef}`;
  }
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
