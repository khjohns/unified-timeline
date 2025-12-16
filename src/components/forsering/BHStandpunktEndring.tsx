/**
 * BHStandpunktEndring Component
 *
 * Displays alerts when BH has changed their position on related cases
 * during an active forsering. Per NS 8407 §33.8, TE may be entitled to
 * compensation for costs incurred before BH changed their position.
 *
 * Scenarios:
 * 1. BH originally rejected frist, now approves (fully or partially)
 * 2. BH originally rejected grunnlag, now approves
 * 3. BH stops contesting during active forsering
 */

import { useMemo } from 'react';
import { Card } from '../primitives/Card';
import { Badge } from '../primitives/Badge';
import { Alert } from '../primitives/Alert';
import { DataList, DataListItem } from '../primitives/DataList';
import { InfoCircledIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import type { SakState, ForseringData, SakRelasjon } from '../../types/timeline';

interface BHStandpunktEndringProps {
  forseringData: ForseringData;
  relaterteSaker: SakRelasjon[];
  sakStates: Record<string, SakState>;
}

interface StandpunktEndring {
  sakId: string;
  sakTittel: string;
  endringType: 'frist_godkjent' | 'frist_delvis' | 'grunnlag_godkjent' | 'grunnlag_delvis';
  opprinneligAvslatteDager: number;
  naaGodkjenteDager: number;
  datoEndret?: string;
}

/**
 * Calculate days between two dates
 */
function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Detect if BH has changed their position on a related case
 * This is a simplified detection - in a real system, this would
 * compare historical events to detect actual changes.
 *
 * Position change scenarios:
 * 1. Frist was rejected (avslått), now approved or partially approved
 * 2. Grunnlag was rejected (avslått), now approved or partially approved
 *    (making the frist claim valid again)
 */
function detectStandpunktEndringer(
  forseringData: ForseringData,
  relaterteSaker: SakRelasjon[],
  sakStates: Record<string, SakState>
): StandpunktEndring[] {
  const endringer: StandpunktEndring[] = [];

  for (const relasjon of relaterteSaker) {
    const state = sakStates[relasjon.relatert_sak_id];
    if (!state) continue;

    // Check if this case was originally in the forsering (rejected frist)
    const wasInForsering = forseringData.avslatte_fristkrav.includes(relasjon.relatert_sak_id);
    if (!wasInForsering) continue;

    const opprinneligDager = state.frist?.krevd_dager || 0;

    // Scenario 1: Frist is now approved or partially approved
    // If this case was in forsering, it means frist was originally rejected
    if (state.frist?.bh_resultat === 'godkjent' || state.frist?.bh_resultat === 'delvis_godkjent') {
      const godkjentDager = state.frist.bh_resultat === 'godkjent'
        ? opprinneligDager
        : (state.frist.godkjent_dager || 0);

      // If any days are now approved, that's a position change from full rejection
      if (godkjentDager > 0) {
        endringer.push({
          sakId: relasjon.relatert_sak_id,
          sakTittel: state.sakstittel,
          endringType: state.frist.bh_resultat === 'godkjent' ? 'frist_godkjent' : 'frist_delvis',
          opprinneligAvslatteDager: opprinneligDager,
          naaGodkjenteDager: godkjentDager,
          datoEndret: state.frist.siste_oppdatert,
        });
        continue; // Don't check grunnlag if we already detected frist change
      }
    }

    // Scenario 2: Grunnlag was rejected but is now approved
    // This is relevant when forsering was triggered by grunnlag rejection
    // (where BH rejected grunnlag but subsidiarily agreed with frist)
    if (state.grunnlag?.bh_resultat === 'godkjent' || state.grunnlag?.bh_resultat === 'delvis_godkjent') {
      // Check if there's an active frist claim that would now be valid
      if (opprinneligDager > 0 && state.frist?.status !== 'avslatt') {
        const godkjentDager = state.frist?.bh_resultat === 'godkjent'
          ? opprinneligDager
          : (state.frist?.godkjent_dager || opprinneligDager);

        // Only add if not already added via frist detection
        const alreadyAdded = endringer.some(e => e.sakId === relasjon.relatert_sak_id);
        if (!alreadyAdded && godkjentDager > 0) {
          endringer.push({
            sakId: relasjon.relatert_sak_id,
            sakTittel: state.sakstittel,
            endringType: state.grunnlag.bh_resultat === 'godkjent' ? 'grunnlag_godkjent' : 'grunnlag_delvis',
            opprinneligAvslatteDager: opprinneligDager,
            naaGodkjenteDager: godkjentDager,
            datoEndret: state.grunnlag.siste_oppdatert,
          });
        }
      }
    }
  }

  return endringer;
}

/**
 * Format currency in Norwegian style
 */
function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('nb-NO')} kr`;
}

/**
 * Format date in Norwegian style
 */
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

export function BHStandpunktEndring({
  forseringData,
  relaterteSaker,
  sakStates,
}: BHStandpunktEndringProps) {
  // Detect position changes
  const endringer = useMemo(
    () => detectStandpunktEndringer(forseringData, relaterteSaker, sakStates),
    [forseringData, relaterteSaker, sakStates]
  );

  // Calculate forsering days before position change
  const forseringsDagerBeforeChange = useMemo(() => {
    if (!forseringData.er_iverksatt || !forseringData.dato_iverksatt) return 0;

    // Find the earliest position change date
    const endringsDatoer = endringer
      .filter(e => e.datoEndret)
      .map(e => new Date(e.datoEndret!).getTime());

    if (endringsDatoer.length === 0) return 0;

    const earliestChange = new Date(Math.min(...endringsDatoer)).toISOString();
    return daysBetween(forseringData.dato_iverksatt, earliestChange);
  }, [forseringData, endringer]);

  // Calculate compensation for forsering period
  const kompensasjonsBeregning = useMemo(() => {
    if (!forseringData.er_iverksatt || forseringsDagerBeforeChange === 0) return null;

    // If there are incurred costs, use those; otherwise estimate based on days
    const faktiskePaalopte = forseringData.paalopte_kostnader || 0;

    // Estimated daily cost (simplified: total estimated / total days)
    const estimertDagskost = forseringData.avslatte_dager > 0
      ? forseringData.estimert_kostnad / forseringData.avslatte_dager
      : 0;

    const estimertKompensasjon = forseringsDagerBeforeChange * estimertDagskost;

    // Sum of days that are now approved
    const naaGodkjenteDager = endringer.reduce((sum, e) => sum + e.naaGodkjenteDager, 0);

    return {
      forseringsDager: forseringsDagerBeforeChange,
      faktiskePaalopte,
      estimertKompensasjon: faktiskePaalopte || estimertKompensasjon,
      naaGodkjenteDager,
      gjenstaendeAvslatteDager: forseringData.avslatte_dager - naaGodkjenteDager,
    };
  }, [forseringData, forseringsDagerBeforeChange, endringer]);

  // Don't show anything if no position changes detected
  if (endringer.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Alert about position change */}
      <Alert
        variant="warning"
        title="Byggherre har endret standpunkt"
      >
        <p className="mb-2">
          Byggherren har endret sitt standpunkt på én eller flere relaterte saker
          etter at forseringen ble iverksatt.
        </p>
        <p className="text-sm">
          Per NS 8407 §33.8 kan entreprenøren ha krav på kompensasjon for
          forseringskostnader påløpt før standpunktendringen.
        </p>
      </Alert>

      {/* Position changes details */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle flex items-center gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 text-alert-warning-text" />
          <h3 className="font-bold text-sm">Standpunktendringer</h3>
        </div>
        <div className="p-4">
          <ul className="space-y-3">
            {endringer.map((endring) => (
              <li
                key={endring.sakId}
                className="p-3 bg-pkt-surface-subtle rounded-none border-l-4 border-pkt-brand-yellow-500"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{endring.sakTittel}</p>
                    <p className="text-xs text-pkt-text-body-subtle mt-1">
                      {endring.sakId}
                    </p>
                  </div>
                  <Badge
                    variant={endring.endringType.includes('godkjent') ? 'success' : 'warning'}
                    size="sm"
                  >
                    {endring.endringType === 'grunnlag_godkjent' && 'Grunnlag godkjent'}
                    {endring.endringType === 'grunnlag_delvis' && 'Grunnlag delvis'}
                    {endring.endringType === 'frist_godkjent' && 'Frist godkjent'}
                    {endring.endringType === 'frist_delvis' && 'Frist delvis'}
                  </Badge>
                </div>
                <div className="mt-2 text-xs">
                  <span className="text-pkt-text-body-subtle">Opprinnelig avslått: </span>
                  <span className="font-medium">{endring.opprinneligAvslatteDager} dager</span>
                  <span className="mx-2">→</span>
                  <span className="text-pkt-text-body-subtle">Nå godkjent: </span>
                  <span className="font-medium text-badge-success-text">
                    {endring.naaGodkjenteDager} dager
                  </span>
                </div>
                {endring.datoEndret && (
                  <p className="text-xs text-pkt-text-body-subtle mt-1">
                    Endret: {formatDate(endring.datoEndret)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Compensation calculation */}
      {kompensasjonsBeregning && forseringData.er_iverksatt && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle flex items-center gap-2">
            <InfoCircledIcon className="w-4 h-4 text-pkt-text-brand" />
            <h3 className="font-bold text-sm">Kompensasjonsberegning</h3>
          </div>
          <div className="p-4">
            <DataList>
              <DataListItem label="Forseringsdager før endring">
                <span className="font-bold">{kompensasjonsBeregning.forseringsDager} dager</span>
              </DataListItem>

              {kompensasjonsBeregning.faktiskePaalopte > 0 && (
                <DataListItem label="Faktisk påløpte kostnader">
                  {formatCurrency(kompensasjonsBeregning.faktiskePaalopte)}
                </DataListItem>
              )}

              <DataListItem label="Estimert kompensasjon">
                <span className="font-bold text-pkt-text-brand">
                  {formatCurrency(kompensasjonsBeregning.estimertKompensasjon)}
                </span>
              </DataListItem>

              <DataListItem label="Nå godkjente dager">
                <Badge variant="success">{kompensasjonsBeregning.naaGodkjenteDager} dager</Badge>
              </DataListItem>

              {kompensasjonsBeregning.gjenstaendeAvslatteDager > 0 && (
                <DataListItem label="Gjenstående avslåtte dager">
                  <Badge variant="danger">{kompensasjonsBeregning.gjenstaendeAvslatteDager} dager</Badge>
                </DataListItem>
              )}
            </DataList>

            <div className="mt-4 p-3 bg-pkt-brand-yellow-500/20 border-2 border-pkt-border-yellow rounded-none">
              <p className="text-sm">
                <strong>Merk:</strong> Kompensasjon for forseringskostnader påløpt før
                BH endret standpunkt kan kreves som vederlagsjustering. Dokumenter
                faktiske påløpte kostnader for perioden {formatDate(forseringData.dato_iverksatt)}
                {' '}til standpunktendring.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
