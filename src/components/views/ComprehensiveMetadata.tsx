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
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {state.overordnet_status}
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
                    className="text-sm text-oslo-blue hover:underline"
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

      {/* Current State Summary */}
      <Collapsible title="Nåværende tilstand" defaultOpen>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Vederlag Status */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Vederlag
            </h4>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="text-gray-600">Status:</dt>
                <dd className="font-medium">{state.vederlag.status}</dd>
              </div>
              {state.vederlag.krevd_belop !== null && (
                <div>
                  <dt className="text-gray-600">Krevd:</dt>
                  <dd className="font-medium text-blue-700">
                    {state.vederlag.krevd_belop?.toLocaleString('nb-NO')} NOK
                  </dd>
                </div>
              )}
              {state.vederlag.godkjent_belop !== null && (
                <div>
                  <dt className="text-gray-600">Godkjent:</dt>
                  <dd className="font-medium text-green-700">
                    {state.vederlag.godkjent_belop?.toLocaleString('nb-NO')} NOK
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Frist Status */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Frist</h4>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="text-gray-600">Status:</dt>
                <dd className="font-medium">{state.frist.status}</dd>
              </div>
              {state.frist.krevd_dager !== null && (
                <div>
                  <dt className="text-gray-600">Krevd:</dt>
                  <dd className="font-medium text-blue-700">
                    {state.frist.krevd_dager} dager
                  </dd>
                </div>
              )}
              {state.frist.godkjent_dager !== null && (
                <div>
                  <dt className="text-gray-600">Godkjent:</dt>
                  <dd className="font-medium text-green-700">
                    {state.frist.godkjent_dager} dager
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Summary */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Sammendrag
            </h4>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="text-gray-600">Totalt krevd:</dt>
                <dd className="font-medium text-blue-700">
                  {state.sum_krevd.toLocaleString('nb-NO')} NOK
                </dd>
              </div>
              <div>
                <dt className="text-gray-600">Totalt godkjent:</dt>
                <dd className="font-medium text-green-700">
                  {state.sum_godkjent.toLocaleString('nb-NO')} NOK
                </dd>
              </div>
              <div>
                <dt className="text-gray-600">Antall hendelser:</dt>
                <dd className="font-medium">{state.antall_events}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Collapsible>
    </div>
  );
}
