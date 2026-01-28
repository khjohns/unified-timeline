/**
 * ComprehensiveMetadata Component
 *
 * Displays metadata about the case including:
 * - Sak metadata (ID, status)
 * - Project information (names, parties)
 *
 * Uses hybrid layout:
 * - Sakstittel as full-width row (allows text wrapping)
 * - Compact InlineDataList for remaining metadata
 */

import { SakState } from '../../types/timeline';
import { InlineDataList, InlineDataListItem, Badge } from '../primitives';
import { getOverordnetStatusLabel } from '../../constants/statusLabels';
import { formatDateMedium } from '../../utils/formatters';

interface ComprehensiveMetadataProps {
  state: SakState;
  sakId: string;
}

export function ComprehensiveMetadata({
  state,
  sakId,
}: ComprehensiveMetadataProps) {
  return (
    <div className="space-y-3">
      {/* Sakstittel - full width for proper text wrapping */}
      <div className="pb-3 border-b border-pkt-border-subtle">
        <div className="text-xs text-pkt-text-body-subtle mb-1">Sakstittel</div>
        <div className="text-sm text-pkt-text-body-default">{state.sakstittel}</div>
      </div>

      {/* Compact metadata as InlineDataList */}
      <InlineDataList stackOnMobile>
        <InlineDataListItem label="Sak-ID">{sakId}</InlineDataListItem>
        <InlineDataListItem label="Opprettet">{formatDateMedium(state.grunnlag.siste_oppdatert)}</InlineDataListItem>
        <InlineDataListItem label="Prosjekt">{state.prosjekt_navn || '—'}</InlineDataListItem>
        <InlineDataListItem label="Byggherre">{state.byggherre || '—'}</InlineDataListItem>
        <InlineDataListItem label="Entreprenør">{state.entreprenor || '—'}</InlineDataListItem>
      </InlineDataList>

      {/* Status badge */}
      <div className="pt-2">
        <Badge variant="info">{getOverordnetStatusLabel(state.overordnet_status)}</Badge>
      </div>
    </div>
  );
}
