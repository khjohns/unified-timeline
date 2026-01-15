/**
 * FravikDashboard Component
 *
 * Dashboard for fravik-søknad with role-based views:
 * - TE: Edit søknad, maskiner, avbøtende tiltak
 * - BH: Read-only søknad + "Din oppgave" section for vurdering
 *
 * Design principle: "Les først, vurder nederst"
 * - Søknadsdata vises read-only for BH
 * - Én tydelig "Din oppgave"-seksjon med kontekstuell CTA
 */

import { useMemo } from 'react';
import { Pencil1Icon, PlusIcon } from '@radix-ui/react-icons';
import { DashboardCard, DataList, DataListItem, Badge, Button, Alert } from '../primitives';
import type { FravikState, MaskinTilstand, FravikBeslutning } from '../../types/fravik';
import { MASKIN_TYPE_LABELS } from '../../types/fravik';
import { formatDateShort } from '../../utils/formatters';

interface FravikDashboardProps {
  state: FravikState;
  userRole: 'TE' | 'BH';
  // TE actions
  onRedigerSoknad?: () => void;
  onLeggTilMaskin?: () => void;
  onRedigerAvbotende?: () => void;
  // BH actions
  onBOIVurdering?: () => void;
  onPLVurdering?: () => void;
  onArbeidsgruppeVurdering?: () => void;
  onEierBeslutning?: () => void;
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
 * Compact maskin card with BOI status
 */
function MaskinKort({ maskin }: { maskin: MaskinTilstand }) {
  const { variant, label } = getMaskinStatusBadge(maskin.samlet_status);
  const hasBOI = maskin.boi_vurdering?.beslutning;

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

      {/* BOI vurderingsstatus */}
      {hasBOI && maskin.boi_vurdering && (
        <span className={`inline-flex text-xs mt-2 px-2 py-0.5 rounded-sm ${
          maskin.boi_vurdering.beslutning === 'godkjent'
            ? 'bg-alert-success-bg text-alert-success-text'
            : maskin.boi_vurdering.beslutning === 'delvis_godkjent'
            ? 'bg-alert-warning-bg text-alert-warning-text'
            : 'bg-alert-danger-bg text-alert-danger-text'
        }`}>
          BOI: {maskin.boi_vurdering.beslutning === 'godkjent' ? 'Godkjent' :
                maskin.boi_vurdering.beslutning === 'delvis_godkjent' ? 'Delvis' : 'Avslått'}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FravikDashboard({
  state,
  userRole,
  onRedigerSoknad,
  onLeggTilMaskin,
  onRedigerAvbotende,
  onBOIVurdering,
  onPLVurdering,
  onArbeidsgruppeVurdering,
  onEierBeslutning,
}: FravikDashboardProps) {
  const maskiner = useMemo(() => Object.values(state.maskiner), [state.maskiner]);
  const canEdit = state.status === 'utkast';
  const gjeldende = state.godkjenningskjede.gjeldende_steg;
  const isBH = userRole === 'BH';
  const isTE = userRole === 'TE';

  const soknadBadge = getSoknadBadge(state);
  const maskinBadge = getMaskinBadge(state);
  const avbotendeBadge = getAvbotendeBadge(state);

  // Show "Din oppgave" for BH when søknad is submitted and not finished
  const showDinOppgave = isBH && state.status !== 'utkast' && gjeldende !== 'ferdig';

  return (
    <div className="space-y-4">
      {/* Din oppgave - øverst for BH når søknad er sendt inn */}
      {showDinOppgave && (
        <>
          <DinOppgaveAlert
            gjeldende={gjeldende}
            onBOIVurdering={onBOIVurdering}
            onPLVurdering={onPLVurdering}
            onArbeidsgruppeVurdering={onArbeidsgruppeVurdering}
            onEierBeslutning={onEierBeslutning}
          />
          {/* Tidligere vurderinger - detaljert visning for AG og Eier */}
          {(gjeldende === 'arbeidsgruppe' || gjeldende === 'eier') && (
            <TidligereVurderingerKort state={state} gjeldende={gjeldende} />
          )}

          {/* Semantisk skille mellom vurdering og søknadsdata */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 border-t border-pkt-border-subtle" />
            <span className="text-xs font-medium text-pkt-text-body-muted uppercase tracking-wide">
              Søknadsdata
            </span>
            <div className="flex-1 border-t border-pkt-border-subtle" />
          </div>
        </>
      )}

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
            isTE && canEdit && onLeggTilMaskin && (
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

interface TidligereVurderingerKortProps {
  state: FravikState;
  gjeldende: 'boi' | 'pl' | 'arbeidsgruppe' | 'eier' | 'ferdig';
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
  vurderingType: 'boi' | 'arbeidsgruppe';
}) {
  const vurderteMaskiner = maskiner.filter(m =>
    vurderingType === 'boi' ? m.boi_vurdering : m.arbeidsgruppe_vurdering
  );

  if (vurderteMaskiner.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {vurderteMaskiner.map((maskin) => {
        const vurdering = vurderingType === 'boi'
          ? maskin.boi_vurdering
          : maskin.arbeidsgruppe_vurdering;
        if (!vurdering) return null;

        const maskinNavn = MASKIN_TYPE_LABELS[maskin.maskin_type] || maskin.maskin_type;
        const beslutningStyle = vurdering.beslutning === 'godkjent'
          ? { label: 'Godkjent', bg: 'bg-alert-success-bg', text: 'text-alert-success-text' }
          : vurdering.beslutning === 'delvis_godkjent'
          ? { label: 'Delvis', bg: 'bg-alert-warning-bg', text: 'text-alert-warning-text' }
          : { label: 'Avslått', bg: 'bg-alert-danger-bg', text: 'text-alert-danger-text' };

        return (
          <div key={maskin.maskin_id} className="p-3 rounded bg-pkt-bg-subtle">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{maskinNavn}</span>
              <span className={`text-xs px-2 py-0.5 rounded-sm ${beslutningStyle.bg} ${beslutningStyle.text}`}>
                {beslutningStyle.label}
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

function TidligereVurderingerKort({ state, gjeldende }: TidligereVurderingerKortProps) {
  const { godkjenningskjede } = state;
  const maskiner = Object.values(state.maskiner);

  return (
    <DashboardCard
      title="Tidligere vurderinger"
      variant="outlined"
    >
      <div className="space-y-4">
        {/* BOI-vurdering */}
        <div>
          <VurderingDetalj
            rolle="BOI-rådgiver"
            vurdering={godkjenningskjede.boi_vurdering}
          />
          {/* Per-maskin BOI-vurderinger */}
          {godkjenningskjede.boi_vurdering.fullfort && (
            <MaskinVurderingListe maskiner={maskiner} vurderingType="boi" />
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

interface DinOppgaveAlertProps {
  gjeldende: 'boi' | 'pl' | 'arbeidsgruppe' | 'eier' | 'ferdig';
  onBOIVurdering?: () => void;
  onPLVurdering?: () => void;
  onArbeidsgruppeVurdering?: () => void;
  onEierBeslutning?: () => void;
}

/**
 * Get oppgave config based on current step
 */
function getOppgaveConfig(gjeldende: string) {
  switch (gjeldende) {
    case 'boi':
      return {
        stegNummer: 1,
        tittel: 'BOI-vurdering',
        beskrivelse: 'Vurder om søknaden oppfyller miljøkravene.',
        knappTekst: 'Gi BOI-vurdering',
      };
    case 'pl':
      return {
        stegNummer: 2,
        tittel: 'Prosjektleder-anbefaling',
        beskrivelse: 'Gi din anbefaling basert på prosjektets behov.',
        knappTekst: 'Gi PL-anbefaling',
      };
    case 'arbeidsgruppe':
      return {
        stegNummer: 3,
        tittel: 'Arbeidsgruppens innstilling',
        beskrivelse: 'Vurder søknaden samlet og gi innstilling til prosjekteier.',
        knappTekst: 'Gi innstilling',
      };
    case 'eier':
      return {
        stegNummer: 4,
        tittel: 'Prosjekteiers beslutning',
        beskrivelse: 'Fatt endelig beslutning.',
        knappTekst: 'Fatt beslutning',
      };
    default:
      return null;
  }
}

function DinOppgaveAlert({
  gjeldende,
  onBOIVurdering,
  onPLVurdering,
  onArbeidsgruppeVurdering,
  onEierBeslutning,
}: DinOppgaveAlertProps) {
  const config = getOppgaveConfig(gjeldende);
  if (!config) return null;

  const handleClick = () => {
    switch (gjeldende) {
      case 'boi': onBOIVurdering?.(); break;
      case 'pl': onPLVurdering?.(); break;
      case 'arbeidsgruppe': onArbeidsgruppeVurdering?.(); break;
      case 'eier': onEierBeslutning?.(); break;
    }
  };

  return (
    <Alert
      variant="info"
      title={
        <span className="flex items-center gap-2">
          Din oppgave: {config.tittel}
          <Badge variant="info" size="sm">Steg {config.stegNummer}/4</Badge>
        </span>
      }
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
