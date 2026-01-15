/**
 * MaskinListe Component
 *
 * Displays machines in a table/list format with expandable accordion
 * for full søknad details. Follows RelatertKOEListe pattern for consistency.
 */

import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { Badge, DataList, DataListItem } from '../primitives';
import type { MaskinTilstand, MaskinVurderingStatus, FravikGrunn, Drivstoff } from '../../types/fravik';
import { MASKIN_TYPE_LABELS } from '../../types/fravik';
import { formatDateShort } from '../../utils/formatters';

// ============================================================================
// CONSTANTS
// ============================================================================

const FRAVIK_GRUNN_LABELS: Record<FravikGrunn, string> = {
  markedsmangel: 'Markedsmangel',
  leveringstid: 'Leveringstid',
  tekniske_begrensninger: 'Tekniske begrensninger',
  hms_krav: 'HMS-krav',
  annet: 'Annet',
};

const DRIVSTOFF_LABELS: Record<Drivstoff, string> = {
  HVO100: 'HVO100',
  annet_biodrivstoff: 'Annet biodrivstoff',
  diesel_euro6: 'Diesel Euro 6',
};

// ============================================================================
// HELPERS
// ============================================================================

function getStatusBadge(status: MaskinVurderingStatus): { variant: 'success' | 'danger' | 'warning' | 'neutral'; label: string } {
  switch (status) {
    case 'godkjent':
      return { variant: 'success', label: 'Godkjent' };
    case 'avslatt':
      return { variant: 'danger', label: 'Avslått' };
    case 'delvis_godkjent':
      return { variant: 'warning', label: 'Delvis' };
    default:
      return { variant: 'neutral', label: 'Venter' };
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
    <div className="pt-3 pb-1 space-y-4">
      {/* Grunnleggende info */}
      <DataList>
        <DataListItem label="Periode">
          {formatDateShort(maskin.start_dato)} – {formatDateShort(maskin.slutt_dato)}
        </DataListItem>
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

      {/* Vurderinger (hvis noen) */}
      {(maskin.miljo_vurdering || maskin.arbeidsgruppe_vurdering || maskin.eier_beslutning) && (
        <div className="pt-3 border-t border-pkt-border-subtle space-y-3">
          <h4 className="text-xs font-medium text-pkt-text-body-muted">Vurderinger</h4>

          {maskin.miljo_vurdering && (
            <VurderingRad
              rolle="Miljørådgiver"
              beslutning={maskin.miljo_vurdering.beslutning}
              kommentar={maskin.miljo_vurdering.kommentar}
              vilkar={maskin.miljo_vurdering.vilkar}
            />
          )}

          {maskin.arbeidsgruppe_vurdering && (
            <VurderingRad
              rolle="Arbeidsgruppe"
              beslutning={maskin.arbeidsgruppe_vurdering.beslutning}
              kommentar={maskin.arbeidsgruppe_vurdering.kommentar}
              vilkar={maskin.arbeidsgruppe_vurdering.vilkar}
            />
          )}

          {maskin.eier_beslutning && (
            <VurderingRad
              rolle="Prosjekteier"
              beslutning={maskin.eier_beslutning.beslutning}
              kommentar={maskin.eier_beslutning.kommentar}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface VurderingRadProps {
  rolle: string;
  beslutning: string;
  kommentar?: string;
  vilkar?: string[];
}

function VurderingRad({ rolle, beslutning, kommentar, vilkar }: VurderingRadProps) {
  const beslutningLabel = beslutning === 'godkjent'
    ? 'Godkjent'
    : beslutning === 'delvis_godkjent'
    ? 'Delvis'
    : beslutning === 'avslatt'
    ? 'Avslått'
    : beslutning;

  return (
    <div className="p-2 rounded bg-pkt-bg-card">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-pkt-text-body">{rolle}</span>
        <span className="text-sm text-pkt-text-body">{beslutningLabel}</span>
      </div>
      {kommentar && (
        <p className="text-sm text-pkt-text-body-muted mt-1">{kommentar}</p>
      )}
      {vilkar && vilkar.length > 0 && (
        <p className="text-xs text-pkt-text-body-muted mt-1">
          Vilkår: {vilkar.join(', ')}
        </p>
      )}
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
        const { variant, label } = getStatusBadge(maskin.samlet_status);
        const maskinNavn = MASKIN_TYPE_LABELS[maskin.maskin_type] || maskin.maskin_type;
        const periode = `${formatDateShort(maskin.start_dato)} – ${formatDateShort(maskin.slutt_dato)}`;

        return (
          <div key={maskin.maskin_id} className="py-2">
            {/* Clickable row header */}
            <button
              type="button"
              onClick={() => toggleExpand(maskin.maskin_id)}
              className="w-full flex items-center gap-3 text-left hover:bg-pkt-surface-subtle rounded px-1 py-1 -mx-1 transition-colors"
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

              {/* Status badge */}
              <Badge variant={variant} size="sm">{label}</Badge>
            </button>

            {/* Expandable details */}
            {isExpanded && (
              <div className="pl-7 pr-1">
                <MaskinDetaljer maskin={maskin} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
