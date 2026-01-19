/**
 * FravikDashboard Component
 *
 * Dashboard for fravik-søknad showing TE's application data:
 * - Søknadsinformasjon
 * - Maskiner
 * - Avbøtende tiltak og konsekvenser
 *
 * BH's review sections (Din oppgave, Tidligere vurderinger) are now
 * rendered separately at page level for clearer visual hierarchy.
 */

import { useMemo } from 'react';
import { Pencil1Icon, PlusIcon } from '@radix-ui/react-icons';
import { DashboardCard, DataList, DataListItem, Badge, Button, Alert } from '../primitives';
import { MaskinListe } from './MaskinListe';
import { InfrastrukturSeksjon } from './InfrastrukturSeksjon';
import type { FravikState, MaskinTilstand, FravikBeslutning } from '../../types/fravik';
import { MASKIN_TYPE_LABELS } from '../../types/fravik';
import { formatDateShort } from '../../utils/formatters';

interface FravikDashboardProps {
  state: FravikState;
  userRole: 'TE' | 'BH';
  // TE actions
  onRedigerSoknad?: () => void;
  onLeggTilMaskin?: () => void;
  onRedigerInfrastruktur?: () => void;
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
 * Get badge for infrastruktur section
 */
function getInfrastrukturBadge(state: FravikState): { variant: 'success' | 'neutral'; label: string } {
  const hasData = !!state.infrastruktur?.stromtilgang_status;
  return hasData
    ? { variant: 'success', label: 'Utfylt' }
    : { variant: 'neutral', label: 'Ikke utfylt' };
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FravikDashboard({
  state,
  userRole,
  onRedigerSoknad,
  onLeggTilMaskin,
  onRedigerInfrastruktur,
  onRedigerAvbotende,
}: FravikDashboardProps) {
  const maskiner = useMemo(() => Object.values(state.maskiner), [state.maskiner]);
  const canEdit = state.status === 'utkast';
  const isTE = userRole === 'TE';

  const soknadBadge = getSoknadBadge(state);
  const maskinBadge = getMaskinBadge(state);
  const infrastrukturBadge = getInfrastrukturBadge(state);
  const avbotendeBadge = getAvbotendeBadge(state);

  return (
    <div className="space-y-4">
      {/* Spor 1: Søknadsinformasjon */}
      <DashboardCard
        title="Søknadsinformasjon"
        headerBadge={<Badge variant={soknadBadge.variant}>{soknadBadge.label}</Badge>}
        action={
          isTE && canEdit && onRedigerSoknad && (
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
          {state.entreprenor && (
            <DataListItem label="Entreprenør">{state.entreprenor}</DataListItem>
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
          <p className="text-xs text-pkt-brand-red-1000 mt-3">
            <span className="font-medium">Hastebehandling:</span>{' '}
            {state.haste_begrunnelse || 'Ja'}
          </p>
        )}
      </DashboardCard>

      {/* Spor 2: Maskiner (for machine type) */}
      {state.soknad_type === 'machine' && (
        <DashboardCard
          title="Maskiner"
          headerBadge={<Badge variant={maskinBadge.variant}>{maskinBadge.label}</Badge>}
          action={
            isTE && canEdit && onLeggTilMaskin && (
              <Button variant="secondary" size="sm" onClick={onLeggTilMaskin}>
                <PlusIcon className="w-4 h-4 mr-1" />
                Legg til
              </Button>
            )
          }
          variant="default"
        >
          <MaskinListe
            maskiner={maskiner}
            emptyMessage={
              canEdit
                ? 'Ingen maskiner lagt til ennå. Klikk "Legg til" for å starte.'
                : 'Ingen maskiner lagt til.'
            }
          />
        </DashboardCard>
      )}

      {/* Spor 2: Infrastruktur (for infrastructure type) */}
      {state.soknad_type === 'infrastructure' && (
        <DashboardCard
          title="Infrastruktur"
          headerBadge={<Badge variant={infrastrukturBadge.variant}>{infrastrukturBadge.label}</Badge>}
          action={
            isTE && canEdit && onRedigerInfrastruktur && (
              <Button variant="secondary" size="sm" onClick={onRedigerInfrastruktur}>
                {state.infrastruktur ? (
                  <Pencil1Icon className="w-4 h-4 mr-1" />
                ) : (
                  <PlusIcon className="w-4 h-4 mr-1" />
                )}
                {state.infrastruktur ? 'Rediger' : 'Legg til'}
              </Button>
            )
          }
          variant="default"
        >
          {state.infrastruktur ? (
            <InfrastrukturSeksjon
              infrastruktur={state.infrastruktur}
              emptyMessage={
                canEdit
                  ? 'Ingen infrastruktur-data lagt til ennå. Klikk "Legg til" for å starte.'
                  : 'Ingen infrastruktur-data lagt til.'
              }
            />
          ) : (
            <p className="text-sm text-pkt-text-body-muted">
              {canEdit
                ? 'Ingen infrastruktur-data lagt til ennå. Klikk "Legg til" for å starte.'
                : 'Ingen infrastruktur-data lagt til.'}
            </p>
          )}
        </DashboardCard>
      )}

      {/* Spor 3: Avbøtende tiltak og konsekvenser */}
      <DashboardCard
        title="Avbøtende tiltak og konsekvenser"
        headerBadge={<Badge variant={avbotendeBadge.variant}>{avbotendeBadge.label}</Badge>}
        action={
          isTE && canEdit && onRedigerAvbotende && (
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

// ============================================================================
// DIN OPPGAVE COMPONENT
// ============================================================================

// ============================================================================
// TIDLIGERE VURDERINGER COMPONENT
// ============================================================================

export interface TidligereVurderingerKortProps {
  state: FravikState;
  gjeldende: 'miljo' | 'pl' | 'arbeidsgruppe' | 'eier' | 'ferdig';
}

function VurderingDetalj({
  rolle,
  vurdering,
}: {
  rolle: string;
  vurdering: {
    fullfort: boolean;
    beslutning?: FravikBeslutning;
    kommentar?: string;
    vurdert_av?: string;
    vurdert_tidspunkt?: string;
  };
}) {
  if (!vurdering.fullfort) {
    return (
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{rolle}</span>
        <span className="text-sm text-pkt-text-body-muted">Venter</span>
      </div>
    );
  }

  const beslutningConfig = vurdering.beslutning === 'godkjent'
    ? { label: 'Anbefalt', variant: 'success' as const }
    : vurdering.beslutning === 'delvis_godkjent'
    ? { label: 'Delvis anbefalt', variant: 'warning' as const }
    : { label: 'Ikke anbefalt', variant: 'danger' as const };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm">{rolle}</span>
        <Badge variant={beslutningConfig.variant} size="sm">
          {beslutningConfig.label}
        </Badge>
      </div>
      {vurdering.kommentar && (
        <p className="text-sm text-pkt-text-body-muted whitespace-pre-wrap">
          {vurdering.kommentar}
        </p>
      )}
      {vurdering.vurdert_av && (
        <p className="text-xs text-pkt-text-body-muted mt-1">
          {vurdering.vurdert_av}
          {vurdering.vurdert_tidspunkt && ` • ${formatDateShort(vurdering.vurdert_tidspunkt)}`}
        </p>
      )}
    </div>
  );
}

function MaskinVurderingListe({
  maskiner,
  vurderingType,
}: {
  maskiner: MaskinTilstand[];
  vurderingType: 'miljo' | 'arbeidsgruppe';
}) {
  const vurderteMaskiner = maskiner.filter(m =>
    vurderingType === 'miljo' ? m.miljo_vurdering : m.arbeidsgruppe_vurdering
  );

  if (vurderteMaskiner.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {vurderteMaskiner.map((maskin) => {
        const vurdering = vurderingType === 'miljo'
          ? maskin.miljo_vurdering
          : maskin.arbeidsgruppe_vurdering;
        if (!vurdering) return null;

        const maskinNavn = MASKIN_TYPE_LABELS[maskin.maskin_type] || maskin.maskin_type;
        const beslutningLabel = vurdering.beslutning === 'godkjent'
          ? 'Godkjent'
          : vurdering.beslutning === 'delvis_godkjent'
          ? 'Delvis'
          : 'Avslått';

        return (
          <div key={maskin.maskin_id} className="p-3 rounded bg-pkt-bg-subtle">
            <div className="flex items-center justify-between">
              <span className="text-sm text-pkt-text-body-default">{maskinNavn}</span>
              <span className="text-sm font-medium text-pkt-text-body-default">
                {beslutningLabel}
              </span>
            </div>
            {vurdering.kommentar && (
              <p className="text-sm text-pkt-text-body-muted mt-1">{vurdering.kommentar}</p>
            )}
            {vurdering.vilkar && vurdering.vilkar.length > 0 && (
              <div className="mt-2 pt-2 border-t border-pkt-border-subtle">
                <p className="text-xs font-medium text-pkt-text-body-muted">
                  Vilkår: {vurdering.vilkar.join(', ')}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TidligereVurderingerKort({ state, gjeldende }: TidligereVurderingerKortProps) {
  const { godkjenningskjede } = state;
  const maskiner = Object.values(state.maskiner);

  return (
    <DashboardCard
      title="Tidligere vurderinger"
      variant="outlined"
    >
      <div className="space-y-4">
        {/* Miljørådgiver-vurdering */}
        <div>
          <VurderingDetalj
            rolle="Miljørådgiver"
            vurdering={godkjenningskjede.miljo_vurdering}
          />
          {/* Per-maskin miljøvurderinger */}
          {godkjenningskjede.miljo_vurdering.fullfort && (
            <MaskinVurderingListe maskiner={maskiner} vurderingType="miljo" />
          )}
        </div>

        {/* PL-vurdering */}
        <div className="pt-4 border-t border-pkt-border-subtle">
          <VurderingDetalj
            rolle="Prosjektleder"
            vurdering={godkjenningskjede.pl_vurdering}
          />
        </div>

        {/* Arbeidsgruppe (kun for Eier) */}
        {gjeldende === 'eier' && (
          <div className="pt-4 border-t border-pkt-border-subtle">
            <VurderingDetalj
              rolle="Arbeidsgruppe"
              vurdering={godkjenningskjede.arbeidsgruppe_vurdering}
            />
            {/* Per-maskin Arbeidsgruppe-vurderinger */}
            {godkjenningskjede.arbeidsgruppe_vurdering.fullfort && (
              <MaskinVurderingListe maskiner={maskiner} vurderingType="arbeidsgruppe" />
            )}
          </div>
        )}
      </div>
    </DashboardCard>
  );
}

// ============================================================================
// DIN OPPGAVE ALERT COMPONENT
// ============================================================================

export interface DinOppgaveAlertProps {
  gjeldende: 'miljo' | 'pl' | 'arbeidsgruppe' | 'eier' | 'ferdig';
  onMiljoVurdering?: () => void;
  onPLVurdering?: () => void;
  onArbeidsgruppeVurdering?: () => void;
  onEierBeslutning?: () => void;
}

/**
 * Get oppgave config based on current step
 */
function getOppgaveConfig(gjeldende: string) {
  switch (gjeldende) {
    case 'miljo':
      return {
        tittel: 'Miljøvurdering',
        beskrivelse: 'Steg 1 av 4: Vurder om søknaden oppfyller miljøkravene.',
        knappTekst: 'Gi miljøvurdering',
      };
    case 'pl':
      return {
        tittel: 'Prosjektleder-anbefaling',
        beskrivelse: 'Steg 2 av 4: Gi din anbefaling basert på prosjektets behov.',
        knappTekst: 'Gi PL-anbefaling',
      };
    case 'arbeidsgruppe':
      return {
        tittel: 'Arbeidsgruppens innstilling',
        beskrivelse: 'Steg 3 av 4: Vurder søknaden samlet og gi innstilling til prosjekteier.',
        knappTekst: 'Gi innstilling',
      };
    case 'eier':
      return {
        tittel: 'Prosjekteiers beslutning',
        beskrivelse: 'Steg 4 av 4: Fatt endelig beslutning.',
        knappTekst: 'Fatt beslutning',
      };
    default:
      return null;
  }
}

export function DinOppgaveAlert({
  gjeldende,
  onMiljoVurdering,
  onPLVurdering,
  onArbeidsgruppeVurdering,
  onEierBeslutning,
}: DinOppgaveAlertProps) {
  const config = getOppgaveConfig(gjeldende);
  if (!config) return null;

  const handleClick = () => {
    switch (gjeldende) {
      case 'miljo': onMiljoVurdering?.(); break;
      case 'pl': onPLVurdering?.(); break;
      case 'arbeidsgruppe': onArbeidsgruppeVurdering?.(); break;
      case 'eier': onEierBeslutning?.(); break;
    }
  };

  return (
    <Alert
      variant="info"
      title={config.tittel}
      action={
        <Button variant="primary" size="sm" onClick={handleClick}>
          {config.knappTekst}
        </Button>
      }
    >
      {config.beskrivelse}
    </Alert>
  );
}
