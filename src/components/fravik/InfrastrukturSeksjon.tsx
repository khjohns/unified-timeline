/**
 * InfrastrukturSeksjon Component
 *
 * Displays infrastructure data in a read-only view.
 * Used in FravikDashboard when soknad_type='infrastructure'.
 *
 * Unlike MaskinListe which shows multiple items, this shows a single
 * infrastructure configuration.
 */

import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { DataList, DataListItem } from '../primitives';
import type { InfrastrukturTilstand, InfrastrukturVurderingStatus } from '../../types/fravik';
import { formatDateShort } from '../../utils/formatters';

// ============================================================================
// HELPERS
// ============================================================================

function getStatusText(status: InfrastrukturVurderingStatus): string {
  switch (status) {
    case 'godkjent':
      return 'Godkjent';
    case 'avslatt':
      return 'Avslått';
    default:
      return 'Venter på vurdering';
  }
}

interface VurdertAlternativProps {
  checked: boolean;
  label: string;
}

function VurdertAlternativ({ checked, label }: VurdertAlternativProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {checked ? (
        <CheckIcon className="w-4 h-4 text-alert-success-text" />
      ) : (
        <Cross2Icon className="w-4 h-4 text-pkt-text-body-muted" />
      )}
      <span className={checked ? 'text-pkt-text-body' : 'text-pkt-text-body-muted'}>
        {label}
      </span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface InfrastrukturSeksjonProps {
  infrastruktur: InfrastrukturTilstand;
  /** Empty state message */
  emptyMessage?: string;
}

export function InfrastrukturSeksjon({
  infrastruktur,
  emptyMessage = 'Ingen infrastruktur-data lagt til.',
}: InfrastrukturSeksjonProps) {
  // Check if we have minimal required data
  const hasData = infrastruktur?.stromtilgang_beskrivelse;

  if (!hasData) {
    return (
      <p className="text-sm text-pkt-text-body-muted">{emptyMessage}</p>
    );
  }

  const periode = `${formatDateShort(infrastruktur.start_dato)} – ${formatDateShort(infrastruktur.slutt_dato)}`;
  const statusText = getStatusText(infrastruktur.samlet_status);

  return (
    <div className="space-y-4">
      {/* Status og periode */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-pkt-text-body">
          <span className="font-medium">Periode:</span> {periode}
        </span>
        <span className="text-sm font-medium text-pkt-text-body-default">
          {statusText}
        </span>
      </div>

      {/* Strømtilgang */}
      <div className="space-y-3">
        <div>
          <dt className="text-xs font-medium text-pkt-text-body-muted mb-1">
            Strømtilgang på byggeplassen
          </dt>
          <dd className="text-sm text-pkt-text-body whitespace-pre-wrap">
            {infrastruktur.stromtilgang_beskrivelse}
          </dd>
        </div>
      </div>

      {/* Vurderte alternativer */}
      <div className="p-3 rounded bg-pkt-bg-subtle">
        <h4 className="text-xs font-medium text-pkt-text-body-muted mb-2">Vurderte alternativer</h4>
        <div className="space-y-2">
          <VurdertAlternativ
            checked={infrastruktur.mobil_batteri_vurdert}
            label="Mobile batteriløsninger"
          />
          <VurdertAlternativ
            checked={infrastruktur.midlertidig_nett_vurdert}
            label="Midlertidig nett (transformatorstasjon)"
          />
        </div>
        {infrastruktur.alternative_metoder && (
          <div className="mt-2 pt-2 border-t border-pkt-border-subtle">
            <dt className="text-xs font-medium text-pkt-text-body-muted mb-1">Andre vurderte løsninger</dt>
            <dd className="text-sm text-pkt-text-body whitespace-pre-wrap">
              {infrastruktur.alternative_metoder}
            </dd>
          </div>
        )}
      </div>

      {/* Prosjektspesifikke forhold */}
      {infrastruktur.prosjektspesifikke_forhold && (
        <div>
          <dt className="text-xs font-medium text-pkt-text-body-muted mb-1">
            Prosjektspesifikke forhold
          </dt>
          <dd className="text-sm text-pkt-text-body whitespace-pre-wrap">
            {infrastruktur.prosjektspesifikke_forhold}
          </dd>
        </div>
      )}

      {/* Kostnadsvurdering og erstatningsløsning */}
      <div className="p-3 rounded bg-pkt-bg-subtle">
        <h4 className="text-xs font-medium text-pkt-text-body-muted mb-2">Kostnader og erstatning</h4>
        <DataList>
          <DataListItem label="Kostnadsvurdering">
            <span className="whitespace-pre-wrap">{infrastruktur.kostnadsvurdering}</span>
          </DataListItem>
          <DataListItem label="Erstatningsløsning">
            <span className="whitespace-pre-wrap">{infrastruktur.erstatningslosning}</span>
          </DataListItem>
        </DataList>
      </div>
    </div>
  );
}
