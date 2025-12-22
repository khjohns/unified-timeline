/**
 * CaseDashboard Component
 *
 * Alternative dashboard layout using DashboardCard (same as ForseringPage).
 * Displays status for all three tracks with badges instead of colored borders.
 */

import { ReactNode, useMemo } from 'react';
import { DashboardCard, DataList, DataListItem, Badge } from '../primitives';
import { SakState, SporStatus } from '../../types/timeline';

interface CaseDashboardProps {
  state: SakState;
  grunnlagActions?: ReactNode;
  vederlagActions?: ReactNode;
  fristActions?: ReactNode;
}

/**
 * Map SporStatus to Badge variant
 */
function getStatusBadge(status: SporStatus, erSubsidiaert?: boolean): ReactNode {
  // Subsidiary status gets special treatment
  if (erSubsidiaert) {
    return <Badge variant="warning" size="sm">Godkjent (subsidiært)</Badge>;
  }

  const config: Record<SporStatus, { variant: 'default' | 'info' | 'success' | 'warning' | 'danger'; label: string }> = {
    ikke_relevant: { variant: 'default', label: 'Ikke relevant' },
    utkast: { variant: 'default', label: 'Utkast' },
    sendt: { variant: 'info', label: 'Sendt' },
    under_behandling: { variant: 'warning', label: 'Under behandling' },
    godkjent: { variant: 'success', label: 'Godkjent' },
    delvis_godkjent: { variant: 'warning', label: 'Delvis godkjent' },
    avslatt: { variant: 'danger', label: 'Avslått' },
    under_forhandling: { variant: 'warning', label: 'Under forhandling' },
    trukket: { variant: 'default', label: 'Trukket' },
    laast: { variant: 'success', label: 'Låst' },
  };

  const { variant, label } = config[status];
  return <Badge variant={variant} size="sm">{label}</Badge>;
}

/**
 * Format a number for display (Norwegian locale)
 */
function formatCurrency(value?: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${value.toLocaleString('nb-NO')} kr`;
}

function formatDays(value?: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${value} dager`;
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

/**
 * Get krevd beløp based on vederlagsmetode
 */
function getKrevdBelop(state: SakState): number | undefined {
  const v = state.vederlag;
  if (v.metode === 'REGNINGSARBEID' && v.kostnads_overslag !== undefined) {
    return v.kostnads_overslag;
  }
  return v.belop_direkte;
}

/**
 * CaseDashboard renders three-track status using DashboardCard components
 * Same visual style as ForseringDashboard for consistency
 */
export function CaseDashboard({
  state,
  grunnlagActions,
  vederlagActions,
  fristActions,
}: CaseDashboardProps) {
  const krevdBelop = useMemo(() => getKrevdBelop(state), [state]);

  return (
    <section aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading" className="sr-only">
        Status Dashboard
      </h2>

      <div className="space-y-4">
        {/* Grunnlag Card */}
        <DashboardCard
          title="Ansvarsgrunnlag"
          headerBadge={getStatusBadge(state.grunnlag.status)}
          action={grunnlagActions}
        >
          <DataList>
            <DataListItem label="Hovedkategori">
              {state.grunnlag.hovedkategori || '-'}
            </DataListItem>
            {state.grunnlag.underkategori && (
              <DataListItem label="Underkategori">
                {state.grunnlag.underkategori}
              </DataListItem>
            )}
            {state.grunnlag.dato_oppdaget && (
              <DataListItem label="Dato oppdaget">
                {formatDate(state.grunnlag.dato_oppdaget)}
              </DataListItem>
            )}
            {state.grunnlag.grunnlag_varsel?.dato_sendt && (
              <DataListItem label="Varslet">
                {formatDate(state.grunnlag.grunnlag_varsel.dato_sendt)}
              </DataListItem>
            )}
            {state.grunnlag.bh_resultat && (
              <DataListItem label="BH resultat">
                <span className={
                  state.grunnlag.bh_resultat === 'godkjent' ? 'text-pkt-brand-green-1000 font-medium' :
                  state.grunnlag.bh_resultat === 'avslatt' ? 'text-pkt-brand-red-1000 font-medium' :
                  'text-pkt-brand-yellow-1000 font-medium'
                }>
                  {state.grunnlag.bh_resultat === 'godkjent' ? 'Godkjent' :
                   state.grunnlag.bh_resultat === 'avslatt' ? 'Avslått' :
                   'Delvis godkjent'}
                </span>
              </DataListItem>
            )}
          </DataList>
        </DashboardCard>

        {/* Vederlag Card */}
        <DashboardCard
          title="Vederlag"
          headerBadge={getStatusBadge(state.vederlag.status, state.er_subsidiaert_vederlag)}
          action={vederlagActions}
        >
          <DataList>
            {state.vederlag.metode && (
              <DataListItem label="Metode">
                {state.vederlag.metode === 'ENHETSPRISER' ? 'Enhetspriser' :
                 state.vederlag.metode === 'REGNINGSARBEID' ? 'Regningsarbeid' :
                 state.vederlag.metode === 'FASTPRIS_TILBUD' ? 'Fastpris/tilbud' :
                 state.vederlag.metode}
              </DataListItem>
            )}
            <DataListItem label="Krevd beløp">
              <span className="font-medium">{formatCurrency(krevdBelop)}</span>
            </DataListItem>
            {state.vederlag.godkjent_belop !== undefined && (
              <DataListItem label="Godkjent beløp">
                <span className="font-medium text-pkt-brand-green-1000">
                  {formatCurrency(state.vederlag.godkjent_belop)}
                </span>
              </DataListItem>
            )}
            {state.vederlag.bh_resultat && (
              <DataListItem label="BH resultat">
                <span className={
                  state.vederlag.bh_resultat === 'godkjent' ? 'text-pkt-brand-green-1000 font-medium' :
                  state.vederlag.bh_resultat === 'avslatt' ? 'text-pkt-brand-red-1000 font-medium' :
                  'text-pkt-brand-yellow-1000 font-medium'
                }>
                  {state.vederlag.bh_resultat === 'godkjent' ? 'Godkjent' :
                   state.vederlag.bh_resultat === 'avslatt' ? 'Avslått' :
                   'Delvis godkjent'}
                </span>
              </DataListItem>
            )}
          </DataList>
        </DashboardCard>

        {/* Frist Card */}
        <DashboardCard
          title="Fristforlengelse"
          headerBadge={getStatusBadge(state.frist.status, state.er_subsidiaert_frist)}
          action={fristActions}
        >
          <DataList>
            {state.frist.krevd_dager !== undefined && (
              <DataListItem label="Krevd">
                <span className="font-medium">{formatDays(state.frist.krevd_dager)}</span>
              </DataListItem>
            )}
            {state.frist.godkjent_dager !== undefined && (
              <DataListItem label="Godkjent">
                <span className="font-medium text-pkt-brand-green-1000">
                  {formatDays(state.frist.godkjent_dager)}
                </span>
              </DataListItem>
            )}
            {state.frist.varsel_type && (
              <DataListItem label="Varseltype">
                {state.frist.varsel_type === 'NOYTRAL' ? 'Nøytralt varsel' :
                 state.frist.varsel_type === 'SPESIFISERT' ? 'Spesifisert varsel' :
                 state.frist.varsel_type}
              </DataListItem>
            )}
            {state.frist.bh_resultat && (
              <DataListItem label="BH resultat">
                <span className={
                  state.frist.bh_resultat === 'godkjent' ? 'text-pkt-brand-green-1000 font-medium' :
                  state.frist.bh_resultat === 'avslatt' ? 'text-pkt-brand-red-1000 font-medium' :
                  'text-pkt-brand-yellow-1000 font-medium'
                }>
                  {state.frist.bh_resultat === 'godkjent' ? 'Godkjent' :
                   state.frist.bh_resultat === 'avslatt' ? 'Avslått' :
                   'Delvis godkjent'}
                </span>
              </DataListItem>
            )}
          </DataList>
        </DashboardCard>
      </div>
    </section>
  );
}
