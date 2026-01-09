/**
 * ForseringDashboard Component
 *
 * Status dashboard for forsering cases.
 * Shows forsering status, dates, and BH response.
 * Includes cost tracking with 30% rule warnings.
 * Integrates action buttons for TE and BH.
 */

import type { ReactNode } from 'react';
import { Badge, Button, Collapsible, DashboardCard, DataList, DataListItem, Tooltip } from '../primitives';
import {
  ExclamationTriangleIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  StopIcon,
  Pencil1Icon,
  ChatBubbleIcon,
  InfoCircledIcon
} from '@radix-ui/react-icons';
import type { ForseringData } from '../../types/timeline';

/** Per-sak data for avslåtte fristkrav */
interface RelatertSakMedAvslag {
  sak_id: string;
  tittel: string;
  avslatte_dager: number;
}

interface ForseringDashboardProps {
  forseringData: ForseringData;
  userRole: 'TE' | 'BH';
  /** Per-sak data for avslåtte fristkrav (for BH standpunkt visning) */
  avslatteSaker?: RelatertSakMedAvslag[];
  onStoppForsering?: () => void;
  onOppdaterKostnader?: () => void;
  onGiStandpunkt?: () => void;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

/**
 * Get cost status based on 30% rule
 */
function getCostStatus(forseringData: ForseringData): {
  status: 'ok' | 'warning' | 'danger';
  label: string;
  icon: ReactNode;
} {
  const { paalopte_kostnader, estimert_kostnad, maks_forseringskostnad, er_iverksatt } = forseringData;

  if (!er_iverksatt || paalopte_kostnader === undefined) {
    return {
      status: 'ok',
      label: 'Ikke startet',
      icon: null,
    };
  }

  const prosentAvMaks = (paalopte_kostnader / maks_forseringskostnad) * 100;
  const prosentAvEstimert = (paalopte_kostnader / estimert_kostnad) * 100;

  if (paalopte_kostnader > maks_forseringskostnad) {
    return {
      status: 'danger',
      label: 'Over maksgrense',
      icon: <CrossCircledIcon className="w-3 h-3" />,
    };
  }
  if (prosentAvMaks >= 80) {
    return {
      status: 'warning',
      label: 'Nær maksgrense',
      icon: <ExclamationTriangleIcon className="w-3 h-3" />,
    };
  }
  if (paalopte_kostnader > estimert_kostnad) {
    return {
      status: 'warning',
      label: 'Over estimat',
      icon: <ExclamationTriangleIcon className="w-3 h-3" />,
    };
  }
  if (prosentAvEstimert >= 80) {
    return {
      status: 'warning',
      label: 'Nær estimat',
      icon: <ExclamationTriangleIcon className="w-3 h-3" />,
    };
  }
  return {
    status: 'ok',
    label: 'Innenfor ramme',
    icon: <CheckCircledIcon className="w-3 h-3" />,
  };
}

function getStatusBadge(forseringData: ForseringData) {
  if (forseringData.er_stoppet) {
    return <Badge variant="warning" size="sm">Stoppet</Badge>;
  }
  if (forseringData.er_iverksatt) {
    return <Badge variant="success" size="sm">Iverksatt</Badge>;
  }
  return <Badge variant="default" size="sm">Varslet</Badge>;
}

/**
 * Get BH response badge based on new bh_respons structure
 */
function getBHResponseBadge(forseringData: ForseringData) {
  const bhRespons = forseringData.bh_respons;

  // Check new bh_respons first, then fall back to legacy fields
  if (bhRespons) {
    const erSubsidiaert = bhRespons.subsidiaer_triggers && bhRespons.subsidiaer_triggers.length > 0;

    if (bhRespons.aksepterer) {
      // Check if it's partial (godkjent_belop < estimert_kostnad)
      const isPartial = bhRespons.total_godkjent !== undefined &&
        bhRespons.total_godkjent < forseringData.estimert_kostnad;

      if (erSubsidiaert) {
        return (
          <div className="flex gap-1">
            <Badge variant={isPartial ? 'warning' : 'success'} size="sm">
              {isPartial ? 'Delvis godkjent' : 'Godkjent'}
            </Badge>
            <Badge variant="warning" size="sm">Subsidiært</Badge>
          </div>
        );
      }
      return (
        <Badge variant={isPartial ? 'warning' : 'success'} size="sm">
          {isPartial ? 'Delvis godkjent' : 'Godkjent'}
        </Badge>
      );
    }
    return <Badge variant="danger" size="sm">Avslått</Badge>;
  }

  // Legacy fallback
  if (forseringData.bh_aksepterer_forsering === undefined) {
    return <Badge variant="default" size="sm">Venter på BH</Badge>;
  }
  if (forseringData.bh_aksepterer_forsering) {
    return <Badge variant="success" size="sm">Godkjent</Badge>;
  }
  return <Badge variant="danger" size="sm">Avslått</Badge>;
}

/**
 * Table component for per-sak forseringsrett vurdering
 */
interface ForseringsrettVurderingTableProps {
  avslatteSaker: RelatertSakMedAvslag[];
  vurderingPerSak?: Array<{ sak_id: string; avslag_berettiget?: boolean }>;
  harForseringsrettAvslag: boolean;
  dagerMedForseringsrett: number;
  totalAvslatteDager: number;
}

function ForseringsrettVurderingTable({
  avslatteSaker,
  vurderingPerSak,
  harForseringsrettAvslag,
  dagerMedForseringsrett,
  totalAvslatteDager,
}: ForseringsrettVurderingTableProps) {
  const harKonklusjon = (vurderingPerSak && vurderingPerSak.length > 0) || harForseringsrettAvslag || dagerMedForseringsrett > 0;

  // Helper to get status for a sak
  const getStatus = (sak: RelatertSakMedAvslag) => {
    const vurdering = vurderingPerSak?.find(v => v.sak_id === sak.sak_id);
    const harVurdering = vurdering !== undefined;

    if (harVurdering) {
      const erUberettiget = vurdering?.avslag_berettiget === false;
      return {
        variant: erUberettiget ? 'success' : 'danger' as const,
        label: erUberettiget ? 'Uberettiget' : 'Berettiget',
      };
    }

    // Infer from triggers
    const kanInferere = harForseringsrettAvslag || dagerMedForseringsrett > 0;
    if (kanInferere) {
      return {
        variant: harForseringsrettAvslag ? 'danger' : 'success' as const,
        label: harForseringsrettAvslag ? 'Berettiget' : 'Uberettiget',
      };
    }

    return { variant: 'default' as const, label: 'Ikke vurdert' };
  };

  const tableContent = (
    <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-pkt-border-subtle">
            <th className="text-left py-1.5 font-medium">Sak</th>
            <th className="text-right py-1.5 font-medium w-20">Dager</th>
            <th className="text-right py-1.5 font-medium w-28">Avslaget</th>
          </tr>
        </thead>
        <tbody>
          {avslatteSaker.map((sak) => {
            const status = getStatus(sak);
            return (
              <tr key={sak.sak_id} className="border-b border-pkt-border-subtle last:border-b-0">
                <td className="py-2">
                  <span className="font-medium">{sak.sak_id}</span>
                  <span className="text-pkt-text-body-subtle ml-2">{sak.tittel}</span>
                </td>
                <td className="text-right py-2 font-mono">{sak.avslatte_dager}</td>
                <td className="text-right py-2">
                  <Badge variant={status.variant} size="sm">{status.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
        {harKonklusjon && (
          <tfoot>
            <tr className="border-t-2 border-pkt-border-default">
              <td className="py-2 font-bold">Konklusjon</td>
              <td className="text-right py-2 font-mono font-bold">
                {dagerMedForseringsrett} / {totalAvslatteDager}
              </td>
              <td className="text-right py-2">
                {dagerMedForseringsrett > 0 ? (
                  <Badge variant="success" size="sm">Har rett</Badge>
                ) : (
                  <Badge variant="danger" size="sm">Ingen rett</Badge>
                )}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  // For 1-2 saker: vis direkte, for flere: bruk collapsible
  if (avslatteSaker.length <= 2) {
    return (
      <div>
        <h5 className="font-medium text-sm mb-2">Forseringsrett-vurdering</h5>
        {tableContent}
      </div>
    );
  }

  return (
    <Collapsible
      title={`Forseringsrett-vurdering (${avslatteSaker.length} saker)`}
      defaultOpen={avslatteSaker.length <= 4}
    >
      {tableContent}
    </Collapsible>
  );
}

export function ForseringDashboard({
  forseringData,
  userRole,
  avslatteSaker,
  onStoppForsering,
  onOppdaterKostnader,
  onGiStandpunkt,
}: ForseringDashboardProps) {
  const canStoppForsering = userRole === 'TE' && forseringData.er_iverksatt && !forseringData.er_stoppet;
  const canOppdaterKostnader = userRole === 'TE' && forseringData.er_iverksatt && !forseringData.er_stoppet;
  const canGiStandpunkt = userRole === 'BH' && forseringData.dato_varslet;

  // Check for BH response - prefer new structure, fallback to legacy
  const bhRespons = forseringData.bh_respons;
  const hasGittStandpunkt = bhRespons !== undefined || forseringData.bh_aksepterer_forsering !== undefined;

  // Computed values from bh_respons (with legacy fallback)
  const bhAksepterer = bhRespons?.aksepterer ?? forseringData.bh_aksepterer_forsering ?? false;
  const hovedkravGodkjentRaw = bhRespons?.godkjent_belop ?? forseringData.bh_godkjent_kostnad ?? 0;

  // Subsidiær trigger: BH mener TE ikke har forseringsrett (alle avslag var berettiget)
  const harForseringsrettAvslag = bhRespons?.subsidiaer_triggers?.includes('forseringsrett_avslatt') ?? false;

  // Når forseringsrett er avslått, er prinsipalt godkjent = 0
  const hovedkravGodkjent = harForseringsrettAvslag ? 0 : hovedkravGodkjentRaw;
  const godkjentBelop = harForseringsrettAvslag ? 0 : (bhRespons?.total_godkjent ?? hovedkravGodkjent);

  // Per-sak vurdering data
  const vurderingPerSak = bhRespons?.vurdering_per_sak;
  const harAvslatteSaker = avslatteSaker && avslatteSaker.length > 0;
  const dagerMedForseringsrett = bhRespons?.dager_med_forseringsrett ?? 0;

  // Særskilte krav data
  const harRiggKrav = (forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop ?? 0) > 0;
  const harProduktivitetKrav = (forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop ?? 0) > 0;
  const riggPrekludert = bhRespons?.rigg_varslet_i_tide === false;
  const produktivitetPrekludert = bhRespons?.produktivitet_varslet_i_tide === false;

  return (
    <div className="space-y-4">
      {/* Status and Cost cards side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Status card */}
        <DashboardCard
          title="Forseringsstatus"
          headerBadge={getStatusBadge(forseringData)}
          action={canStoppForsering && onStoppForsering && (
            <Button variant="danger" size="sm" onClick={onStoppForsering}>
              <StopIcon className="w-4 h-4 mr-2" />
              Stopp forsering
            </Button>
          )}
        >
          <DataList>
            <DataListItem label="Varslet byggherren">
              <span className="flex items-center gap-1">
                {formatDate(forseringData.dato_varslet)}
                <Tooltip content="Dato da entreprenøren varslet byggherren om forsering med antatt kostnad (NS 8407 §33.8)">
                  <button type="button" className="text-pkt-text-body-subtle hover:text-pkt-text-body-default">
                    <InfoCircledIcon className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </span>
            </DataListItem>
            {forseringData.er_iverksatt && (
              <DataListItem label="Iverksatt">
                {formatDate(forseringData.dato_iverksatt)}
              </DataListItem>
            )}
            {forseringData.er_stoppet && (
              <DataListItem label="Stoppet">
                {formatDate(forseringData.dato_stoppet)}
              </DataListItem>
            )}
            <DataListItem label="Avslåtte dager">
              <span className="font-bold">{forseringData.avslatte_dager} dager</span>
            </DataListItem>
          </DataList>
        </DashboardCard>

        {/* Cost card */}
        <DashboardCard
          title="Kostnader"
          headerBadge={forseringData.er_iverksatt && forseringData.paalopte_kostnader !== undefined && (
            <Badge
              variant={
                getCostStatus(forseringData).status === 'danger' ? 'danger' :
                getCostStatus(forseringData).status === 'warning' ? 'warning' :
                'success'
              }
              size="sm"
            >
              <span className="flex items-center gap-1">
                {getCostStatus(forseringData).icon}
                {getCostStatus(forseringData).label}
              </span>
            </Badge>
          )}
          action={canOppdaterKostnader && onOppdaterKostnader && (
            <Button variant="secondary" size="sm" onClick={onOppdaterKostnader}>
              <Pencil1Icon className="w-4 h-4 mr-2" />
              Oppdater kostnader
            </Button>
          )}
        >
          <DataList>
            <DataListItem label="Estimert kostnad">
              {formatCurrency(forseringData.estimert_kostnad)}
            </DataListItem>
            <DataListItem label="Maks (30%-regel)">
              {formatCurrency(forseringData.maks_forseringskostnad)}
            </DataListItem>
            {forseringData.paalopte_kostnader !== undefined && (
              <DataListItem label="Påløpt">
                <span className={`font-bold ${
                  getCostStatus(forseringData).status === 'danger' ? 'text-pkt-brand-red-1000' :
                  getCostStatus(forseringData).status === 'warning' ? 'text-pkt-brand-yellow-1000' :
                  'text-pkt-brand-dark-green-1000'
                }`}>
                  {formatCurrency(forseringData.paalopte_kostnader)}
                </span>
              </DataListItem>
            )}
          </DataList>
        </DashboardCard>
      </div>

      {/* BH Response card - full width */}
      <DashboardCard
        title="Byggherrens standpunkt"
        headerBadge={hasGittStandpunkt ? getBHResponseBadge(forseringData) : undefined}
        action={canGiStandpunkt && onGiStandpunkt && (
          <Button
            variant={hasGittStandpunkt ? 'secondary' : 'primary'}
            size="sm"
            onClick={onGiStandpunkt}
          >
            <ChatBubbleIcon className="w-4 h-4 mr-2" />
            {hasGittStandpunkt ? 'Endre standpunkt' : 'Gi standpunkt'}
          </Button>
        )}
      >
        {hasGittStandpunkt ? (
          <div className="space-y-4">
            {/* Per-sak forseringsrett vurdering */}
            {harAvslatteSaker && (
              <ForseringsrettVurderingTable
                avslatteSaker={avslatteSaker!}
                vurderingPerSak={vurderingPerSak}
                harForseringsrettAvslag={harForseringsrettAvslag}
                dagerMedForseringsrett={dagerMedForseringsrett}
                totalAvslatteDager={forseringData.avslatte_dager}
              />
            )}

            {/* Beløpsoversikt tabell */}
            <div className="p-3 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
              <h5 className="font-medium text-sm mb-3">Beløpsvurdering</h5>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pkt-border-subtle">
                    <th className="text-left py-1">Krav</th>
                    <th className="text-right py-1">Krevd</th>
                    <th className="text-right py-1">Godkjent</th>
                    <th className="text-right py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Forseringskostnader (hovedkrav) */}
                  <tr className="border-b border-pkt-border-subtle">
                    <td className="py-2">
                      Forseringskostnader
                      {harForseringsrettAvslag && <span className="text-xs text-pkt-grays-gray-500 ml-1">(prinsipalt)</span>}
                    </td>
                    <td className={`text-right font-mono ${harForseringsrettAvslag ? 'line-through text-pkt-grays-gray-400' : ''}`}>
                      {formatCurrency(forseringData.estimert_kostnad)}
                    </td>
                    <td className="text-right font-mono">{formatCurrency(hovedkravGodkjent)}</td>
                    <td className="text-right">
                      {harForseringsrettAvslag ? (
                        <Badge variant="danger" size="sm">Ingen rett</Badge>
                      ) : bhAksepterer ? (
                        hovedkravGodkjent >= (forseringData.estimert_kostnad ?? 0) ? (
                          <Badge variant="success" size="sm">Godkjent</Badge>
                        ) : (
                          <Badge variant="warning" size="sm">Delvis</Badge>
                        )
                      ) : (
                        <Badge variant="danger" size="sm">Avvist</Badge>
                      )}
                    </td>
                  </tr>
                  {/* Subsidiær rad for forseringsrett avslag */}
                  {harForseringsrettAvslag && (
                    <tr className="border-b border-pkt-border-subtle bg-alert-warning-bg text-alert-warning-text">
                      <td className="py-2 italic">↳ Subsidiært</td>
                      <td className="text-right font-mono">
                        ({formatCurrency(forseringData.estimert_kostnad)})
                      </td>
                      <td className="text-right font-mono">
                        {formatCurrency(hovedkravGodkjentRaw)}
                      </td>
                      <td className="text-right">
                        {hovedkravGodkjentRaw >= (forseringData.estimert_kostnad ?? 0) ? (
                          <Badge variant="success" size="sm">Godkjent</Badge>
                        ) : hovedkravGodkjentRaw > 0 ? (
                          <Badge variant="warning" size="sm">Delvis</Badge>
                        ) : (
                          <Badge variant="danger" size="sm">Avvist</Badge>
                        )}
                      </td>
                    </tr>
                  )}

                  {/* Rigg/Drift */}
                  {harRiggKrav && (
                    <>
                      <tr className="border-b border-pkt-border-subtle">
                        <td className="py-2">
                          Rigg/Drift
                          {riggPrekludert && <span className="text-xs text-pkt-grays-gray-500 ml-1">(prinsipalt)</span>}
                        </td>
                        <td className={`text-right font-mono ${riggPrekludert ? 'line-through text-pkt-grays-gray-400' : ''}`}>
                          {formatCurrency(forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop)}
                        </td>
                        <td className="text-right font-mono">
                          {riggPrekludert ? formatCurrency(0) : formatCurrency(bhRespons?.godkjent_rigg_drift ?? 0)}
                        </td>
                        <td className="text-right">
                          {riggPrekludert ? (
                            <Badge variant="danger" size="sm">Prekludert</Badge>
                          ) : bhRespons?.godkjent_rigg_drift === forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop ? (
                            <Badge variant="success" size="sm">Godkjent</Badge>
                          ) : (bhRespons?.godkjent_rigg_drift ?? 0) > 0 ? (
                            <Badge variant="warning" size="sm">Delvis</Badge>
                          ) : (
                            <Badge variant="danger" size="sm">Avvist</Badge>
                          )}
                        </td>
                      </tr>
                      {/* Subsidiær rad for prekludert rigg */}
                      {riggPrekludert && (
                        <tr className="border-b border-pkt-border-subtle bg-alert-warning-bg text-alert-warning-text">
                          <td className="py-2 italic">↳ Subsidiært</td>
                          <td className="text-right font-mono">
                            ({formatCurrency(forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop)})
                          </td>
                          <td className="text-right font-mono">
                            {formatCurrency(bhRespons?.godkjent_rigg_drift ?? 0)}
                          </td>
                          <td className="text-right">
                            {bhRespons?.godkjent_rigg_drift === forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop ? (
                              <Badge variant="success" size="sm">Godkjent</Badge>
                            ) : (bhRespons?.godkjent_rigg_drift ?? 0) > 0 ? (
                              <Badge variant="warning" size="sm">Delvis</Badge>
                            ) : (
                              <Badge variant="danger" size="sm">Avvist</Badge>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )}

                  {/* Produktivitet */}
                  {harProduktivitetKrav && (
                    <>
                      <tr className="border-b border-pkt-border-subtle">
                        <td className="py-2">
                          Produktivitet
                          {produktivitetPrekludert && <span className="text-xs text-pkt-grays-gray-500 ml-1">(prinsipalt)</span>}
                        </td>
                        <td className={`text-right font-mono ${produktivitetPrekludert ? 'line-through text-pkt-grays-gray-400' : ''}`}>
                          {formatCurrency(forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop)}
                        </td>
                        <td className="text-right font-mono">
                          {produktivitetPrekludert ? formatCurrency(0) : formatCurrency(bhRespons?.godkjent_produktivitet ?? 0)}
                        </td>
                        <td className="text-right">
                          {produktivitetPrekludert ? (
                            <Badge variant="danger" size="sm">Prekludert</Badge>
                          ) : bhRespons?.godkjent_produktivitet === forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop ? (
                            <Badge variant="success" size="sm">Godkjent</Badge>
                          ) : (bhRespons?.godkjent_produktivitet ?? 0) > 0 ? (
                            <Badge variant="warning" size="sm">Delvis</Badge>
                          ) : (
                            <Badge variant="danger" size="sm">Avvist</Badge>
                          )}
                        </td>
                      </tr>
                      {/* Subsidiær rad for prekludert produktivitet */}
                      {produktivitetPrekludert && (
                        <tr className="border-b border-pkt-border-subtle bg-alert-warning-bg text-alert-warning-text">
                          <td className="py-2 italic">↳ Subsidiært</td>
                          <td className="text-right font-mono">
                            ({formatCurrency(forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop)})
                          </td>
                          <td className="text-right font-mono">
                            {formatCurrency(bhRespons?.godkjent_produktivitet ?? 0)}
                          </td>
                          <td className="text-right">
                            {bhRespons?.godkjent_produktivitet === forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop ? (
                              <Badge variant="success" size="sm">Godkjent</Badge>
                            ) : (bhRespons?.godkjent_produktivitet ?? 0) > 0 ? (
                              <Badge variant="warning" size="sm">Delvis</Badge>
                            ) : (
                              <Badge variant="danger" size="sm">Avvist</Badge>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )}

                  {/* Totalt */}
                  <tr className="font-bold">
                    <td className="py-2">TOTALT</td>
                    <td className="text-right font-mono">
                      {formatCurrency(
                        (forseringData.estimert_kostnad ?? 0) +
                        (forseringData.vederlag?.saerskilt_krav?.rigg_drift?.belop ?? 0) +
                        (forseringData.vederlag?.saerskilt_krav?.produktivitet?.belop ?? 0)
                      )}
                    </td>
                    <td className="text-right font-mono">{formatCurrency(godkjentBelop)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        ) : (
          <p className="text-sm text-pkt-text-body-subtle">
            Byggherre har ikke gitt standpunkt til forseringen ennå.
          </p>
        )}
      </DashboardCard>
    </div>
  );
}
