/**
 * InfrastrukturVurderingDetalj Component
 *
 * Read-only display of vurdering status for infrastructure søknader.
 * Shows the approval chain status (Miljø → PL → Arbeidsgruppe → Eier)
 * in a compact format suitable for the dashboard.
 */

import { CheckCircledIcon, CrossCircledIcon, ClockIcon } from '@radix-ui/react-icons';
import { Badge, DataList, DataListItem } from '../../primitives';
import type { InfrastrukturVurdering, InfrastrukturVurderingStatus } from '../../../types/fravik';
import { formatDateShort } from '../../../utils/formatters';

// ============================================================================
// HELPERS
// ============================================================================

function getStatusIcon(status: InfrastrukturVurderingStatus | undefined) {
  switch (status) {
    case 'godkjent':
      return <CheckCircledIcon className="w-4 h-4 text-pkt-brand-dark-green-1000" />;
    case 'avslatt':
      return <CrossCircledIcon className="w-4 h-4 text-pkt-brand-red-1000" />;
    default:
      return <ClockIcon className="w-4 h-4 text-pkt-text-body-muted" />;
  }
}

function getStatusBadge(beslutning: string | undefined): { variant: 'success' | 'warning' | 'danger' | 'neutral'; label: string } {
  switch (beslutning) {
    case 'godkjent':
      return { variant: 'success', label: 'Godkjent' };
    case 'delvis_godkjent':
      return { variant: 'warning', label: 'Delvis godkjent' };
    case 'avslatt':
      return { variant: 'danger', label: 'Avslått' };
    default:
      return { variant: 'neutral', label: 'Venter' };
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface VurderingStegProps {
  label: string;
  vurdering?: InfrastrukturVurdering;
  isCurrentStep?: boolean;
}

function VurderingSteg({ label, vurdering, isCurrentStep }: VurderingStegProps) {
  const hasVurdering = !!vurdering;
  const badge = getStatusBadge(vurdering?.beslutning);

  return (
    <div
      className={`p-3 rounded border ${
        isCurrentStep
          ? 'border-pkt-border-default bg-pkt-surface-subtle'
          : 'border-pkt-border-subtle bg-pkt-bg-card'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={badge.variant} size="sm">
          {badge.label}
        </Badge>
      </div>
      {hasVurdering ? (
        <div className="text-xs text-pkt-text-body-muted space-y-1">
          {vurdering.vurdert_av && (
            <p>Vurdert av: {vurdering.vurdert_av}</p>
          )}
          {vurdering.vurdert_tidspunkt && (
            <p>{formatDateShort(vurdering.vurdert_tidspunkt)}</p>
          )}
          {vurdering.kommentar && (
            <p className="italic mt-1">&ldquo;{vurdering.kommentar}&rdquo;</p>
          )}
          {vurdering.vilkar && vurdering.vilkar.length > 0 && (
            <div className="mt-1">
              <span className="font-medium">Vilkår:</span>
              <ul className="list-disc pl-4 mt-0.5">
                {vurdering.vilkar.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-pkt-text-body-muted">
          {isCurrentStep ? 'Venter på vurdering...' : 'Ikke vurdert ennå'}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface InfrastrukturVurderingDetaljProps {
  miljoVurdering?: InfrastrukturVurdering;
  arbeidsgruppeVurdering?: InfrastrukturVurdering;
  eierBeslutning?: InfrastrukturVurdering;
  samletStatus: InfrastrukturVurderingStatus;
  gjeldendeStegg?: 'miljo' | 'pl' | 'arbeidsgruppe' | 'eier';
}

export function InfrastrukturVurderingDetalj({
  miljoVurdering,
  arbeidsgruppeVurdering,
  eierBeslutning,
  samletStatus,
  gjeldendeStegg,
}: InfrastrukturVurderingDetaljProps) {
  const isFerdig = samletStatus !== 'ikke_vurdert';

  return (
    <div className="space-y-4">
      {/* Samlet status header */}
      <div className="flex items-center gap-3 p-3 rounded bg-pkt-surface-subtle border border-pkt-border-subtle">
        {getStatusIcon(samletStatus)}
        <div>
          <p className="text-sm font-medium">
            Samlet status:{' '}
            <Badge
              variant={
                samletStatus === 'godkjent'
                  ? 'success'
                  : samletStatus === 'avslatt'
                  ? 'danger'
                  : 'neutral'
              }
            >
              {samletStatus === 'godkjent'
                ? 'Godkjent'
                : samletStatus === 'avslatt'
                ? 'Avslått'
                : 'Under behandling'}
            </Badge>
          </p>
          {!isFerdig && gjeldendeStegg && (
            <p className="text-xs text-pkt-text-body-muted mt-0.5">
              Venter på {gjeldendeStegg === 'miljo' ? 'miljørådgiver' :
                         gjeldendeStegg === 'pl' ? 'prosjektleder' :
                         gjeldendeStegg === 'arbeidsgruppe' ? 'arbeidsgruppen' :
                         'prosjekteier'}
            </p>
          )}
        </div>
      </div>

      {/* Vurderingssteg */}
      <div className="space-y-2">
        <VurderingSteg
          label="Miljørådgiver"
          vurdering={miljoVurdering}
          isCurrentStep={gjeldendeStegg === 'miljo'}
        />
        <VurderingSteg
          label="Arbeidsgruppe"
          vurdering={arbeidsgruppeVurdering}
          isCurrentStep={gjeldendeStegg === 'arbeidsgruppe'}
        />
        <VurderingSteg
          label="Prosjekteier"
          vurdering={eierBeslutning}
          isCurrentStep={gjeldendeStegg === 'eier'}
        />
      </div>
    </div>
  );
}
