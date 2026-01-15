/**
 * FravikDashboard Component
 *
 * Three-track dashboard for fravik-søknad following CaseDashboard patterns.
 * Displays:
 * - Spor 1: Søknadsinformasjon (application details)
 * - Spor 2: Maskiner (machines)
 * - Spor 3: Avbøtende tiltak og konsekvenser (mitigating measures)
 */

import { useMemo } from 'react';
import { Pencil1Icon, PlusIcon } from '@radix-ui/react-icons';
import { DashboardCard, DataList, DataListItem, Badge, Button } from '../primitives';
import type { FravikState, MaskinTilstand } from '../../types/fravik';
import { MASKIN_TYPE_LABELS } from '../../types/fravik';
import { formatDateShort } from '../../utils/formatters';

interface FravikDashboardProps {
  state: FravikState;
  onRedigerSoknad?: () => void;
  onLeggTilMaskin?: () => void;
  onRedigerAvbotende?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get badge for søknadsinformasjon based on required fields
 */
function getSoknadBadge(state: FravikState): { variant: 'success' | 'neutral'; label: string } {
  const isComplete = !!state.prosjekt_navn && !!state.soker_navn;
  return isComplete
    ? { variant: 'success', label: 'Utfylt' }
    : { variant: 'neutral', label: 'Ikke utfylt' };
}

/**
 * Get badge for maskiner section
 */
function getMaskinBadge(state: FravikState): { variant: 'info' | 'neutral'; label: string } {
  const count = Object.keys(state.maskiner).length;
  return count > 0
    ? { variant: 'info', label: `${count} maskin${count > 1 ? 'er' : ''}` }
    : { variant: 'neutral', label: 'Ingen maskiner' };
}

/**
 * Get badge for avbøtende tiltak section
 */
function getAvbotendeBadge(state: FravikState): { variant: 'success' | 'neutral'; label: string } {
  const isComplete = !!state.avbotende_tiltak && !!state.konsekvenser_ved_avslag;
  return isComplete
    ? { variant: 'success', label: 'Utfylt' }
    : { variant: 'neutral', label: 'Ikke utfylt' };
}

/**
 * Get maskin status badge variant
 */
function getMaskinStatusBadge(status: string): { variant: 'success' | 'danger' | 'warning' | 'neutral'; label: string } {
  switch (status) {
    case 'godkjent':
      return { variant: 'success', label: 'Godkjent' };
    case 'avslatt':
      return { variant: 'danger', label: 'Avslått' };
    case 'delvis_godkjent':
      return { variant: 'warning', label: 'Delvis' };
    default:
      return { variant: 'neutral', label: 'Ikke vurdert' };
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Compact maskin card
 */
function MaskinKort({ maskin }: { maskin: MaskinTilstand }) {
  const { variant, label } = getMaskinStatusBadge(maskin.samlet_status);

  return (
    <div className="p-3 rounded-lg border border-pkt-border-default bg-pkt-bg-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-medium text-sm text-pkt-text-body">
          {MASKIN_TYPE_LABELS[maskin.maskin_type] || maskin.maskin_type}
          {maskin.annet_type && `: ${maskin.annet_type}`}
        </span>
        <Badge variant={variant} size="sm">{label}</Badge>
      </div>
      <p className="text-xs text-pkt-text-body-muted">
        {formatDateShort(maskin.start_dato)} – {formatDateShort(maskin.slutt_dato)}
      </p>
      {maskin.erstatningsmaskin && (
        <p className="text-xs text-pkt-text-body-muted mt-1">
          {maskin.erstatningsmaskin}
          {maskin.erstatningsdrivstoff && ` (${maskin.erstatningsdrivstoff})`}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FravikDashboard({
  state,
  onRedigerSoknad,
  onLeggTilMaskin,
  onRedigerAvbotende,
}: FravikDashboardProps) {
  const maskiner = useMemo(() => Object.values(state.maskiner), [state.maskiner]);
  const canEdit = state.status === 'utkast';

  const soknadBadge = getSoknadBadge(state);
  const maskinBadge = getMaskinBadge(state);
  const avbotendeBadge = getAvbotendeBadge(state);

  return (
    <div className="space-y-4">
      {/* Spor 1: Søknadsinformasjon */}
      <DashboardCard
        title="Søknadsinformasjon"
        headerBadge={<Badge variant={soknadBadge.variant}>{soknadBadge.label}</Badge>}
        action={
          canEdit && onRedigerSoknad && (
            <Button variant="secondary" size="sm" onClick={onRedigerSoknad}>
              <Pencil1Icon className="w-4 h-4 mr-1" />
              Rediger
            </Button>
          )
        }
        variant="default"
      >
        <DataList variant="grid">
          <DataListItem label="Prosjekt">
            {state.prosjekt_navn || '-'}
            {state.prosjekt_nummer && (
              <span className="text-pkt-text-body-muted ml-1">({state.prosjekt_nummer})</span>
            )}
          </DataListItem>
          <DataListItem label="Søker">
            {state.soker_navn || '-'}
            {state.soker_epost && (
              <span className="text-pkt-text-body-muted ml-1">{state.soker_epost}</span>
            )}
          </DataListItem>
          {state.hovedentreprenor && (
            <DataListItem label="Hovedentreprenør">{state.hovedentreprenor}</DataListItem>
          )}
          {state.rammeavtale && (
            <DataListItem label="Rammeavtale">{state.rammeavtale}</DataListItem>
          )}
          <DataListItem label="Type">
            {state.soknad_type === 'machine' ? 'Maskin' : 'Infrastruktur'}
          </DataListItem>
          {state.frist_for_svar && (
            <DataListItem label="Ønsket frist">{formatDateShort(state.frist_for_svar)}</DataListItem>
          )}
        </DataList>
        {state.er_haste && (
          <p className="text-xs text-alert-danger-text mt-3">
            <span className="font-medium">Hastebehandling:</span>{' '}
            {state.haste_begrunnelse || 'Ja'}
          </p>
        )}
      </DashboardCard>

      {/* Spor 2: Maskiner */}
      {state.soknad_type === 'machine' && (
        <DashboardCard
          title="Maskiner"
          headerBadge={<Badge variant={maskinBadge.variant}>{maskinBadge.label}</Badge>}
          action={
            canEdit && onLeggTilMaskin && (
              <Button variant="secondary" size="sm" onClick={onLeggTilMaskin}>
                <PlusIcon className="w-4 h-4 mr-1" />
                Legg til
              </Button>
            )
          }
          variant="default"
        >
          {maskiner.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {maskiner.map((maskin) => (
                <MaskinKort key={maskin.maskin_id} maskin={maskin} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-pkt-text-body-muted">
              Ingen maskiner lagt til ennå.
              {canEdit && ' Klikk "Legg til" for å starte.'}
            </p>
          )}
        </DashboardCard>
      )}

      {/* Spor 3: Avbøtende tiltak og konsekvenser */}
      <DashboardCard
        title="Avbøtende tiltak og konsekvenser"
        headerBadge={<Badge variant={avbotendeBadge.variant}>{avbotendeBadge.label}</Badge>}
        action={
          canEdit && onRedigerAvbotende && (
            <Button variant="secondary" size="sm" onClick={onRedigerAvbotende}>
              <Pencil1Icon className="w-4 h-4 mr-1" />
              Rediger
            </Button>
          )
        }
        variant="default"
      >
        <DataList>
          <DataListItem label="Avbøtende tiltak">
            {state.avbotende_tiltak ? (
              <span className="whitespace-pre-wrap">{state.avbotende_tiltak}</span>
            ) : (
              <span className="text-pkt-text-body-muted">Ikke utfylt</span>
            )}
          </DataListItem>
          <DataListItem label="Konsekvenser ved avslag">
            {state.konsekvenser_ved_avslag ? (
              <span className="whitespace-pre-wrap">{state.konsekvenser_ved_avslag}</span>
            ) : (
              <span className="text-pkt-text-body-muted">Ikke utfylt</span>
            )}
          </DataListItem>
        </DataList>
      </DashboardCard>
    </div>
  );
}
