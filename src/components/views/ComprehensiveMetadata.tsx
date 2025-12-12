/**
 * ComprehensiveMetadata Component
 *
 * Displays metadata about the case including:
 * - Sak metadata (ID, dates, status)
 * - Project information (names, parties)
 */

import { SakState } from '../../types/timeline';
import { DataList, DataListItem } from '../primitives/DataList';
import { getOverordnetStatusLabel } from '../../constants/statusLabels';

interface ComprehensiveMetadataProps {
  state: SakState;
  sakId: string;
}

export function ComprehensiveMetadata({
  state,
  sakId,
}: ComprehensiveMetadataProps) {
  return (
    <DataList>
      <DataListItem label="Sak-ID">{sakId}</DataListItem>
      <DataListItem label="Prosjekt">{state.prosjekt_navn || '—'}</DataListItem>
      <DataListItem label="Sakstittel">{state.sakstittel}</DataListItem>
      <DataListItem label="Entreprenør (TE)">{state.entreprenor || '—'}</DataListItem>
      <DataListItem label="Byggherre (BH)">{state.byggherre || '—'}</DataListItem>
      <DataListItem label="Opprettet">{state.grunnlag.siste_oppdatert || '—'}</DataListItem>
      <DataListItem label="Status">
        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-pkt-brand-blue-100 text-pkt-brand-dark-blue-1000">
          {getOverordnetStatusLabel(state.overordnet_status)}
        </span>
      </DataListItem>
    </DataList>
  );
}
