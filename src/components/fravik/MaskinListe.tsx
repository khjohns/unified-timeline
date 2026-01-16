/**
 * MaskinListe Component
 *
 * Displays machines in a table/list format with expandable accordion
 * for full søknad details. Follows RelatertKOEListe pattern for consistency.
 */

import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { DataList, DataListItem } from '../primitives';
import type { MaskinTilstand, MaskinVurderingStatus, Drivstoff, Arbeidskategori, Bruksintensitet } from '../../types/fravik';
import { MASKIN_TYPE_LABELS, MASKIN_VEKT_LABELS, ARBEIDSKATEGORI_LABELS, BRUKSINTENSITET_LABELS } from '../../types/fravik';
import { formatDateShort } from '../../utils/formatters';

// ============================================================================
// CONSTANTS
// ============================================================================

const DRIVSTOFF_LABELS: Record<Drivstoff, string> = {
  HVO100: 'HVO100 (palmefritt)',
  annet_biodrivstoff: 'Annet biodrivstoff',
  diesel: 'Diesel',
};

// ============================================================================
// HELPERS
// ============================================================================

function getStatusText(status: MaskinVurderingStatus): { label: string } {
  switch (status) {
    case 'godkjent':
      return { label: 'Godkjent' };
    case 'avslatt':
      return { label: 'Avslått' };
    case 'delvis_godkjent':
      return { label: 'Delvis' };
    default:
      return { label: 'Venter' };
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface MaskinDetaljerProps {
  maskin: MaskinTilstand;
}

function MaskinDetaljer({ maskin }: MaskinDetaljerProps) {
  return (
    <div className="pt-2 space-y-3">
      {/* Grunnleggende info */}
      <DataList>
        <DataListItem label="Periode">
          {formatDateShort(maskin.start_dato)} – {formatDateShort(maskin.slutt_dato)}
        </DataListItem>
        {maskin.vekt && (
          <DataListItem label="Vekt">{MASKIN_VEKT_LABELS[maskin.vekt]}</DataListItem>
        )}
        {maskin.registreringsnummer && (
          <DataListItem label="Reg.nr">{maskin.registreringsnummer}</DataListItem>
        )}
      </DataList>

      {/* Begrunnelse og alternativer */}
      <div className="space-y-3">
        <div>
          <dt className="text-xs font-medium text-pkt-text-body-muted mb-1">Begrunnelse</dt>
          <dd className="text-sm text-pkt-text-body whitespace-pre-wrap">
            {maskin.begrunnelse || <span className="text-pkt-text-body-muted">Ikke utfylt</span>}
          </dd>
        </div>
        {maskin.alternativer_vurdert && (
          <div>
            <dt className="text-xs font-medium text-pkt-text-body-muted mb-1">Alternativer vurdert</dt>
            <dd className="text-sm text-pkt-text-body whitespace-pre-wrap">{maskin.alternativer_vurdert}</dd>
          </div>
        )}
      </div>

      {/* Markedsundersøkelse */}
      {maskin.markedsundersokelse && (
        <div>
          <dt className="text-xs font-medium text-pkt-text-body-muted mb-1">Markedsundersøkelse</dt>
          <dd className="text-sm text-pkt-text-body">
            Ja{maskin.undersøkte_leverandorer && `: ${maskin.undersøkte_leverandorer}`}
          </dd>
        </div>
      )}

      {/* Erstatningsmaskin */}
      {maskin.erstatningsmaskin && (
        <div className="p-3 rounded bg-pkt-bg-subtle">
          <h4 className="text-xs font-medium text-pkt-text-body-muted mb-2">Erstatningsmaskin</h4>
          <DataList variant="grid">
            <DataListItem label="Type">{maskin.erstatningsmaskin}</DataListItem>
            {maskin.erstatningsdrivstoff && (
              <DataListItem label="Drivstoff">
                {DRIVSTOFF_LABELS[maskin.erstatningsdrivstoff as Drivstoff] || maskin.erstatningsdrivstoff}
              </DataListItem>
            )}
          </DataList>
          {maskin.arbeidsbeskrivelse && (
            <div className="mt-2">
              <dt className="text-xs font-medium text-pkt-text-body-muted mb-1">Arbeidsbeskrivelse</dt>
              <dd className="text-sm text-pkt-text-body whitespace-pre-wrap">{maskin.arbeidsbeskrivelse}</dd>
            </div>
          )}
        </div>
      )}

      {/* Bruk og forbruk */}
      <div className="p-3 rounded bg-pkt-bg-subtle">
        <h4 className="text-xs font-medium text-pkt-text-body-muted mb-2">Bruk og forbruk</h4>
        <DataList variant="grid">
          <DataListItem label="Arbeidskategori">
            {ARBEIDSKATEGORI_LABELS[maskin.arbeidskategori as Arbeidskategori] || maskin.arbeidskategori}
          </DataListItem>
          <DataListItem label="Bruksintensitet">
            {BRUKSINTENSITET_LABELS[maskin.bruksintensitet as Bruksintensitet] || maskin.bruksintensitet}
          </DataListItem>
          {maskin.estimert_drivstofforbruk && (
            <DataListItem label="Est. forbruk">
              {maskin.estimert_drivstofforbruk} liter/dag
            </DataListItem>
          )}
        </DataList>
      </div>

    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface MaskinListeProps {
  maskiner: MaskinTilstand[];
  /** Empty state message */
  emptyMessage?: string;
}

export function MaskinListe({ maskiner, emptyMessage = 'Ingen maskiner lagt til.' }: MaskinListeProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (maskiner.length === 0) {
    return (
      <p className="text-sm text-pkt-text-body-muted">{emptyMessage}</p>
    );
  }

  const toggleExpand = (maskinId: string) => {
    setExpandedId(expandedId === maskinId ? null : maskinId);
  };

  return (
    <div className="divide-y divide-pkt-border-subtle">
      {maskiner.map((maskin) => {
        const isExpanded = expandedId === maskin.maskin_id;
        const { label } = getStatusText(maskin.samlet_status);
        const maskinNavn = MASKIN_TYPE_LABELS[maskin.maskin_type] || maskin.maskin_type;
        const periode = `${formatDateShort(maskin.start_dato)} – ${formatDateShort(maskin.slutt_dato)}`;

        return (
          <div key={maskin.maskin_id} className="py-2">
            {/* Clickable row header */}
            <button
              type="button"
              onClick={() => toggleExpand(maskin.maskin_id)}
              className="w-full flex items-center gap-3 text-left hover:bg-pkt-surface-subtle rounded px-1 py-1 -mx-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-oslo-blue focus-visible:ring-offset-1"
            >
              {/* Expand/collapse icon */}
              <span className="text-pkt-text-body-muted">
                {isExpanded ? (
                  <ChevronDownIcon className="w-4 h-4" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4" />
                )}
              </span>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-pkt-text-body truncate">
                    {maskinNavn}
                    {maskin.annet_type && `: ${maskin.annet_type}`}
                  </span>
                </div>
                <span className="text-xs text-pkt-text-body-muted">{periode}</span>
              </div>

              {/* Status text */}
              <span className="text-sm font-medium text-pkt-text-body-default">{label}</span>
            </button>

            {/* Expandable details */}
            {isExpanded && (
              <div className="pl-7">
                <MaskinDetaljer maskin={maskin} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
