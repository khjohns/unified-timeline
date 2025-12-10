/**
 * ComprehensiveMetadata Component
 *
 * Displays comprehensive metadata about the case including:
 * - Sak metadata (ID, dates, status)
 * - Project information (names, parties)
 * - Grunnlag information (hovedkategori, underkategori, dates)
 */

import { SakState } from '../../types/timeline';
import { Collapsible } from '../primitives/Collapsible';
import { MetadataGrid, GridItem, GridDivider } from '../primitives/MetadataGrid';
import {
  getHovedkategoriLabel,
  getUnderkategoriLabel,
} from '../../constants/categories';
import { getOverordnetStatusLabel } from '../../constants/statusLabels';

interface ComprehensiveMetadataProps {
  state: SakState;
  sakId: string;
}

export function ComprehensiveMetadata({
  state,
  sakId,
}: ComprehensiveMetadataProps) {
  // Format underkategori array to readable labels
  const underkategoriLabels = Array.isArray(state.grunnlag.underkategori)
    ? state.grunnlag.underkategori.map(getUnderkategoriLabel).join(', ')
    : state.grunnlag.underkategori
    ? getUnderkategoriLabel(state.grunnlag.underkategori)
    : '—';

  // Format varsel metoder
  const varselMetoder = state.grunnlag.varsel_metode?.join(', ') || '—';

  return (
    <div className="space-y-4">
      {/* Saksmetadata */}
      <Collapsible title="Saksmetadata" defaultOpen>
        <MetadataGrid>
          <GridItem label="Sak-ID" value={sakId} />
          <GridItem
            label="Opprettet dato"
            value={state.grunnlag.siste_oppdatert || '—'}
          />
          <GridDivider />
          <GridItem label="Opprettet av" value="—" />
          <GridItem
            label="Overordnet status"
            value={
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-none text-xs font-medium bg-pkt-brand-blue-100 text-pkt-brand-dark-blue-1000">
                {getOverordnetStatusLabel(state.overordnet_status)}
              </span>
            }
          />
        </MetadataGrid>
      </Collapsible>

      {/* Prosjektinformasjon */}
      <Collapsible title="Prosjektinformasjon" defaultOpen>
        <MetadataGrid>
          <GridItem label="Sakstittel" value={state.sakstittel} span />
          <GridDivider />
          <GridItem label="Prosjekt" value={state.prosjekt_navn || '—'} span />
          <GridDivider />
          <GridItem label="Entreprenør (TE)" value={state.entreprenor || '—'} />
          <GridItem label="Byggherre (BH)" value={state.byggherre || '—'} />
        </MetadataGrid>
      </Collapsible>

      {/* Grunnlag/Varsel */}
      {state.grunnlag.status !== 'ikke_relevant' && (
        <Collapsible title="Grunnlag / Varsel" defaultOpen>
          <MetadataGrid>
            <GridItem
              label="Dato oppdaget"
              value={state.grunnlag.dato_oppdaget || '—'}
            />
            <GridItem
              label="Dato varsel sendt"
              value={state.grunnlag.dato_varsel_sendt || '—'}
            />
            <GridDivider />
            <GridItem
              label="Hovedkategori"
              value={
                state.grunnlag.hovedkategori
                  ? getHovedkategoriLabel(state.grunnlag.hovedkategori)
                  : '—'
              }
              span
            />
            {state.grunnlag.underkategori && (
              <>
                <GridDivider />
                <GridItem label="Underkategori(er)" value={underkategoriLabels} span />
              </>
            )}
            <GridDivider />
            <GridItem label="Varselmetode(r)" value={varselMetoder} span />
            <GridDivider />
            <GridItem
              label="Beskrivelse"
              value={
                state.grunnlag.beskrivelse ? (
                  <button
                    onClick={() => {
                      // TODO: Show in modal
                      alert(state.grunnlag.beskrivelse);
                    }}
                    className="text-sm text-pkt-brand-warm-blue-1000 hover:underline"
                  >
                    Vis beskrivelse
                  </button>
                ) : (
                  '—'
                )
              }
              span
            />
          </MetadataGrid>
        </Collapsible>
      )}
    </div>
  );
}
