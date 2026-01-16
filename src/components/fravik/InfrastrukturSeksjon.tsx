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
import type { InfrastrukturTilstand, InfrastrukturVurderingStatus, ProsjektforholdType } from '../../types/fravik';
import { formatDateShort } from '../../utils/formatters';

function formatNumber(value: number): string {
  return value.toLocaleString('nb-NO');
}

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

function getStromtilgangStatusText(status: string): string {
  switch (status) {
    case 'ingen_strom':
      return 'Ingen strøm tilgjengelig';
    case 'utilstrekkelig':
      return 'Utilstrekkelig kapasitet';
    case 'geografisk_avstand':
      return 'Geografisk avstand til tilkobling';
    default:
      return status;
  }
}

function getProsjektforholdLabel(type: ProsjektforholdType): string {
  switch (type) {
    case 'plassmangel':
      return 'Plassmangel';
    case 'hms_hensyn':
      return 'HMS-hensyn';
    case 'stoykrav':
      return 'Støykrav';
    case 'adkomstbegrensninger':
      return 'Adkomstbegrensninger';
    case 'annet':
      return 'Annet';
    default:
      return type;
  }
}

function getAggregatTypeLabel(type: string): string {
  switch (type) {
    case 'dieselaggregat':
      return 'Dieselaggregat';
    case 'hybridaggregat':
      return 'Hybridaggregat';
    case 'annet':
      return 'Annet';
    default:
      return type;
  }
}

function getEuroklasseLabel(klasse: string): string {
  switch (klasse) {
    case 'euro_5':
      return 'Euro 5';
    case 'euro_6':
      return 'Euro 6';
    case 'euro_vi':
      return 'Euro VI';
    default:
      return klasse;
  }
}

function getDrivstoffLabel(drivstoff: string): string {
  switch (drivstoff) {
    case 'HVO100':
      return 'HVO100 (palmefritt)';
    case 'annet_biodrivstoff':
      return 'Annet biodrivstoff';
    case 'diesel':
      return 'Diesel';
    default:
      return drivstoff;
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
  const hasData = infrastruktur?.stromtilgang_status;

  if (!hasData) {
    return (
      <p className="text-sm text-pkt-text-body-muted">{emptyMessage}</p>
    );
  }

  const periode = `${formatDateShort(infrastruktur.start_dato)} – ${formatDateShort(infrastruktur.slutt_dato)}`;
  const statusText = getStatusText(infrastruktur.samlet_status);

  // Calculate merkostnad percentage
  const merkostnadProsent = infrastruktur.kostnad_fossil_nok > 0
    ? ((infrastruktur.kostnad_utslippsfri_nok - infrastruktur.kostnad_fossil_nok) / infrastruktur.kostnad_fossil_nok) * 100
    : null;

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
        <div className="p-3 rounded bg-pkt-bg-subtle">
          <h4 className="text-xs font-medium text-pkt-text-body-muted mb-2">Strømtilgang på byggeplassen</h4>
          <DataList>
            <DataListItem label="Status">
              {getStromtilgangStatusText(infrastruktur.stromtilgang_status)}
            </DataListItem>
            {infrastruktur.avstand_til_tilkobling_meter !== undefined && (
              <DataListItem label="Avstand til tilkobling">
                {formatNumber(infrastruktur.avstand_til_tilkobling_meter)} m
              </DataListItem>
            )}
            {infrastruktur.tilgjengelig_effekt_kw !== undefined && (
              <DataListItem label="Tilgjengelig effekt">
                {formatNumber(infrastruktur.tilgjengelig_effekt_kw)} kW
              </DataListItem>
            )}
            <DataListItem label="Effektbehov">
              {formatNumber(infrastruktur.effektbehov_kw)} kW
            </DataListItem>
          </DataList>
          {infrastruktur.stromtilgang_tilleggsbeskrivelse && (
            <div className="mt-2 pt-2 border-t border-pkt-border-subtle">
              <dt className="text-xs font-medium text-pkt-text-body-muted mb-1">Tilleggsbeskrivelse</dt>
              <dd className="text-sm text-pkt-text-body whitespace-pre-wrap">
                {infrastruktur.stromtilgang_tilleggsbeskrivelse}
              </dd>
            </div>
          )}
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
          <VurdertAlternativ
            checked={infrastruktur.redusert_effekt_vurdert}
            label="Redusert effektbehov"
          />
          <VurdertAlternativ
            checked={infrastruktur.faseinndeling_vurdert}
            label="Faseinndeling av arbeid"
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
      {(infrastruktur.prosjektforhold?.length > 0 || infrastruktur.prosjektforhold_beskrivelse) && (
        <div className="p-3 rounded bg-pkt-bg-subtle">
          <h4 className="text-xs font-medium text-pkt-text-body-muted mb-2">Prosjektspesifikke forhold</h4>
          {infrastruktur.prosjektforhold?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {infrastruktur.prosjektforhold.map((forhold) => (
                <span
                  key={forhold}
                  className="px-2 py-0.5 text-xs rounded bg-pkt-bg-default text-pkt-text-body"
                >
                  {getProsjektforholdLabel(forhold)}
                </span>
              ))}
            </div>
          )}
          {infrastruktur.prosjektforhold_beskrivelse && (
            <dd className="text-sm text-pkt-text-body whitespace-pre-wrap">
              {infrastruktur.prosjektforhold_beskrivelse}
            </dd>
          )}
        </div>
      )}

      {/* Kostnadsvurdering */}
      <div className="p-3 rounded bg-pkt-bg-subtle">
        <h4 className="text-xs font-medium text-pkt-text-body-muted mb-2">Kostnadsvurdering</h4>
        <DataList>
          <DataListItem label="Kostnad utslippsfri">
            {formatNumber(infrastruktur.kostnad_utslippsfri_nok)} NOK
          </DataListItem>
          <DataListItem label="Kostnad fossil">
            {formatNumber(infrastruktur.kostnad_fossil_nok)} NOK
          </DataListItem>
          {merkostnadProsent !== null && (
            <DataListItem label="Merkostnad">
              <span className={merkostnadProsent > 10 ? 'text-pkt-status-warning font-medium' : ''}>
                {merkostnadProsent.toFixed(1)}%
                {merkostnadProsent > 10 && ' (over 10%-grensen)'}
              </span>
            </DataListItem>
          )}
          {infrastruktur.prosjektkostnad_nok && (
            <DataListItem label="Prosjektkostnad">
              {formatNumber(infrastruktur.prosjektkostnad_nok)} NOK
            </DataListItem>
          )}
        </DataList>
        {infrastruktur.kostnad_tilleggsbeskrivelse && (
          <div className="mt-2 pt-2 border-t border-pkt-border-subtle">
            <dt className="text-xs font-medium text-pkt-text-body-muted mb-1">Tilleggsbeskrivelse</dt>
            <dd className="text-sm text-pkt-text-body whitespace-pre-wrap">
              {infrastruktur.kostnad_tilleggsbeskrivelse}
            </dd>
          </div>
        )}
      </div>

      {/* Erstatningsløsning */}
      <div className="p-3 rounded bg-pkt-bg-subtle">
        <h4 className="text-xs font-medium text-pkt-text-body-muted mb-2">Erstatningsløsning</h4>
        <DataList>
          <DataListItem label="Type">
            {getAggregatTypeLabel(infrastruktur.aggregat_type)}
            {infrastruktur.aggregat_type === 'annet' && infrastruktur.aggregat_type_annet && (
              <span> ({infrastruktur.aggregat_type_annet})</span>
            )}
          </DataListItem>
          <DataListItem label="Euroklasse">
            {getEuroklasseLabel(infrastruktur.euroklasse)}
          </DataListItem>
          <DataListItem label="Drivstoff">
            {getDrivstoffLabel(infrastruktur.erstatningsdrivstoff)}
          </DataListItem>
          {infrastruktur.aggregat_modell && (
            <DataListItem label="Modell">
              {infrastruktur.aggregat_modell}
            </DataListItem>
          )}
        </DataList>
      </div>
    </div>
  );
}
