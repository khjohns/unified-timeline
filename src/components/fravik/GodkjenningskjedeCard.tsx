/**
 * GodkjenningskjedeCard Component
 *
 * Displays the 4-step approval chain for fravik-søknader.
 * Shows status and allows BH roles to submit their vurdering.
 *
 * Steps:
 * 1. BOI-rådgiver - Initial review
 * 2. Prosjektleder - PL review
 * 3. Arbeidsgruppe - Group recommendation (per-machine)
 * 4. Prosjekteier - Final decision
 */

import { ReactNode } from 'react';
import { CheckCircledIcon, CrossCircledIcon, QuestionMarkCircledIcon } from '@radix-ui/react-icons';
import { DashboardCard, DataList, DataListItem, Badge, Button, Card } from '../primitives';
import type { FravikState, VurderingSteg, FravikBeslutning } from '../../types/fravik';
import { formatDateShort } from '../../utils/formatters';

interface GodkjenningskjedeCardProps {
  state: FravikState;
  onBOIVurdering?: () => void;
  onPLVurdering?: () => void;
  onArbeidsgruppeVurdering?: () => void;
  onEierBeslutning?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get badge for a vurderingssteg based on completion and beslutning.
 */
function getVurderingBadge(
  steg: VurderingSteg,
  isCurrentStep: boolean
): { variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral'; label: string } {
  if (!steg.fullfort) {
    return isCurrentStep
      ? { variant: 'info', label: 'Aktiv' }
      : { variant: 'neutral', label: 'Venter' };
  }

  // Check for returnert (dokumentasjon ikke tilstrekkelig)
  if (steg.dokumentasjon_tilstrekkelig === false) {
    return { variant: 'warning', label: 'Returnert' };
  }

  // Map beslutning to badge
  switch (steg.beslutning) {
    case 'godkjent':
      return { variant: 'success', label: 'Anbefalt' };
    case 'delvis_godkjent':
      return { variant: 'warning', label: 'Delvis' };
    case 'avslatt':
      return { variant: 'danger', label: 'Ikke anbefalt' };
    default:
      return { variant: 'success', label: 'Fullført' };
  }
}

/**
 * Get beslutning label.
 */
function getBeslutningLabel(beslutning?: FravikBeslutning): string {
  switch (beslutning) {
    case 'godkjent':
      return 'Godkjent';
    case 'delvis_godkjent':
      return 'Delvis godkjent';
    case 'avslatt':
      return 'Avslått';
    case 'krever_avklaring':
      return 'Krever avklaring';
    default:
      return '-';
  }
}

/**
 * Get step icon based on completion status.
 */
function getStepIcon(steg: VurderingSteg): ReactNode {
  if (!steg.fullfort) {
    return <QuestionMarkCircledIcon className="w-4 h-4 text-pkt-text-body-muted" />;
  }
  if (steg.beslutning === 'avslatt') {
    return <CrossCircledIcon className="w-4 h-4 text-alert-danger-text" />;
  }
  return <CheckCircledIcon className="w-4 h-4 text-alert-success-text" />;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface VurderingStegCardProps {
  title: string;
  stegNummer: number;
  steg: VurderingSteg;
  isCurrentStep: boolean;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

function VurderingStegCard({
  title,
  stegNummer,
  steg,
  isCurrentStep,
  actionLabel = 'Gi vurdering',
  onAction,
  children,
}: VurderingStegCardProps) {
  const badge = getVurderingBadge(steg, isCurrentStep);
  const canAct = isCurrentStep && !steg.fullfort && onAction;

  return (
    <DashboardCard
      title={`${stegNummer}. ${title}`}
      headerBadge={<Badge variant={badge.variant}>{badge.label}</Badge>}
      action={
        canAct && (
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        )
      }
      variant="default"
    >
      {steg.fullfort ? (
        <div className="space-y-2">
          <DataList variant="list">
            {steg.beslutning && (
              <DataListItem label="Beslutning">
                <span className="flex items-center gap-1">
                  {getStepIcon(steg)}
                  {getBeslutningLabel(steg.beslutning)}
                </span>
              </DataListItem>
            )}
            {steg.vurdert_av && (
              <DataListItem label="Vurdert av">{steg.vurdert_av}</DataListItem>
            )}
            {steg.vurdert_tidspunkt && (
              <DataListItem label="Tidspunkt">
                {formatDateShort(steg.vurdert_tidspunkt)}
              </DataListItem>
            )}
          </DataList>
          {steg.kommentar && (
            <p className="text-sm text-pkt-text-body-muted whitespace-pre-wrap">
              {steg.kommentar}
            </p>
          )}
          {steg.manglende_dokumentasjon && (
            <div className="mt-2 p-2 bg-alert-warning-surface rounded border border-alert-warning-border">
              <p className="text-sm text-alert-warning-text">
                <strong>Mangler:</strong> {steg.manglende_dokumentasjon}
              </p>
            </div>
          )}
          {children}
        </div>
      ) : (
        <p className="text-sm text-pkt-text-body-muted">
          {isCurrentStep
            ? 'Venter på vurdering.'
            : 'Ikke påbegynt.'}
        </p>
      )}
    </DashboardCard>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function GodkjenningskjedeCard({
  state,
  onBOIVurdering,
  onPLVurdering,
  onArbeidsgruppeVurdering,
  onEierBeslutning,
}: GodkjenningskjedeCardProps) {
  const { godkjenningskjede } = state;
  const gjeldende = godkjenningskjede.gjeldende_steg;

  return (
    <Card variant="outlined" padding="md">
      <h2 className="text-base font-semibold text-pkt-text-body-dark mb-4">
        Godkjenningskjede
      </h2>

      <div className="space-y-4">
        {/* Trinn 1: BOI-rådgiver */}
        <VurderingStegCard
          title="BOI-rådgiver"
          stegNummer={1}
          steg={godkjenningskjede.boi_vurdering}
          isCurrentStep={gjeldende === 'boi'}
          actionLabel="Gi vurdering"
          onAction={onBOIVurdering}
        />

        {/* Trinn 2: Prosjektleder */}
        <VurderingStegCard
          title="Prosjektleder"
          stegNummer={2}
          steg={godkjenningskjede.pl_vurdering}
          isCurrentStep={gjeldende === 'pl'}
          actionLabel="Gi vurdering"
          onAction={onPLVurdering}
        />

        {/* Trinn 3: Arbeidsgruppe */}
        <VurderingStegCard
          title="Arbeidsgruppe"
          stegNummer={3}
          steg={godkjenningskjede.arbeidsgruppe_vurdering}
          isCurrentStep={gjeldende === 'arbeidsgruppe'}
          actionLabel="Gi innstilling"
          onAction={onArbeidsgruppeVurdering}
        />

        {/* Trinn 4: Prosjekteier */}
        <VurderingStegCard
          title="Prosjekteier"
          stegNummer={4}
          steg={godkjenningskjede.eier_beslutning}
          isCurrentStep={gjeldende === 'eier'}
          actionLabel="Fatt beslutning"
          onAction={onEierBeslutning}
        />
      </div>

      {/* Neste handling indikator */}
      {state.neste_handling.rolle && !state.er_ferdigbehandlet && (
        <div className="mt-4 pt-4 border-t border-pkt-border-subtle">
          <p className="text-sm text-pkt-text-body-muted">
            <strong>Neste:</strong> {state.neste_handling.handling}
          </p>
        </div>
      )}
    </Card>
  );
}
