/**
 * RevisionHistory Component
 *
 * Displays side-by-side comparison of all revisions for each track.
 * Desktop-first approach with sticky first column for easy comparison.
 * Shows TE claims and BH responses in chronological order.
 */

import { SakState } from '../../types/timeline';
import { Collapsible } from '../primitives/Collapsible';
import { getVederlagsmetodeLabel } from '../../constants/paymentMethods';
import { getBhVederlagssvarLabel, getBhFristsvarLabel } from '../../constants/responseOptions';

interface RevisionHistoryProps {
  state: SakState;
}

export function RevisionHistory({ state }: RevisionHistoryProps) {
  // For now, we'll show the current state as "Revision 1"
  // In a full implementation, this would query event history
  // and reconstruct state at each revision point

  const hasVederlag = state.vederlag.status !== 'ikke_relevant';
  const hasFrist = state.frist.status !== 'ikke_relevant';

  if (!hasVederlag && !hasFrist) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-300">
        <p className="text-gray-600">Ingen krav er fremsatt ennå.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{`
        .revision-table {
          border-collapse: separate;
          border-spacing: 0;
          width: 100%;
        }
        .revision-table th,
        .revision-table td {
          padding: 12px 16px;
          font-size: 0.875rem;
          border-right: 1px solid #d1d5db;
          border-bottom: 1px solid #d1d5db;
        }
        .revision-table th:last-child,
        .revision-table td:last-child {
          border-right: none;
        }
        .revision-table tr:last-child td {
          border-bottom: none;
        }
        .sticky-col {
          position: sticky;
          left: 0;
          z-index: 10;
          background-color: #f9fafb;
          font-weight: 500;
          color: #4b5563;
          border-right: 2px solid #d1d5db !important;
        }
      `}</style>

      {/* Vederlag Revision History */}
      {hasVederlag && (
        <Collapsible
          title="Vederlag - Revisjonshistorikk"
          defaultOpen
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        >
          <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white shadow-sm">
            <table className="revision-table">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky-col text-left min-w-[200px]">Felt</th>
                  <th className="text-center font-semibold min-w-[160px] text-gray-700 bg-gray-50">
                    Nåværende
                  </th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow label="Status" values={[state.vederlag.status]} />
                <ComparisonRow
                  label="Krevd beløp"
                  values={[
                    state.vederlag.krevd_belop
                      ? `${state.vederlag.krevd_belop.toLocaleString('nb-NO')} NOK`
                      : '—',
                  ]}
                />
                <ComparisonRow
                  label="Metode"
                  values={[
                    state.vederlag.metode
                      ? getVederlagsmetodeLabel(state.vederlag.metode)
                      : '—',
                  ]}
                />
                <ComparisonRow
                  label="Produktivitetstap"
                  values={[state.vederlag.inkluderer_produktivitetstap ? '✓' : '—']}
                />
                <ComparisonRow
                  label="Rigg/drift"
                  values={[state.vederlag.inkluderer_rigg_drift ? '✓' : '—']}
                />
                <ComparisonRow
                  label="Særskilt varsel"
                  values={[state.vederlag.saerskilt_varsel_rigg_drift ? '✓' : '—']}
                />
                <ComparisonRow
                  label="BH Resultat"
                  values={[
                    state.vederlag.bh_resultat
                      ? getBhVederlagssvarLabel(state.vederlag.bh_resultat)
                      : '—',
                  ]}
                />
                <ComparisonRow
                  label="Godkjent beløp"
                  values={[
                    state.vederlag.godkjent_belop !== null
                      ? `${state.vederlag.godkjent_belop.toLocaleString('nb-NO')} NOK`
                      : '—',
                  ]}
                  highlight
                />
                {state.vederlag.bh_metode && (
                  <ComparisonRow
                    label="BH Godkjent metode"
                    values={[getVederlagsmetodeLabel(state.vederlag.bh_metode)]}
                  />
                )}
                <ComparisonRow
                  label="Begrunnelse"
                  values={[
                    state.vederlag.begrunnelse ? (
                      <button
                        onClick={() => alert(state.vederlag.begrunnelse)}
                        className="text-sm text-oslo-blue hover:underline"
                      >
                        Vis
                      </button>
                    ) : (
                      '—'
                    ),
                  ]}
                />
              </tbody>
            </table>
          </div>
        </Collapsible>
      )}

      {/* Frist Revision History */}
      {hasFrist && (
        <Collapsible
          title="Frist - Revisjonshistorikk"
          defaultOpen
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        >
          <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white shadow-sm">
            <table className="revision-table">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky-col text-left min-w-[200px]">Felt</th>
                  <th className="text-center font-semibold min-w-[160px] text-gray-700 bg-gray-50">
                    Nåværende
                  </th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow label="Status" values={[state.frist.status]} />
                <ComparisonRow
                  label="Krevd dager"
                  values={[
                    state.frist.krevd_dager
                      ? `${state.frist.krevd_dager} dager`
                      : '—',
                  ]}
                />
                <ComparisonRow
                  label="Fristtype"
                  values={[state.frist.frist_type || '—']}
                />
                <ComparisonRow
                  label="Påvirker kritisk linje"
                  values={[state.frist.pavirker_kritisk_linje ? '✓' : '—']}
                />
                <ComparisonRow
                  label="BH Resultat"
                  values={[
                    state.frist.bh_resultat
                      ? getBhFristsvarLabel(state.frist.bh_resultat)
                      : '—',
                  ]}
                />
                <ComparisonRow
                  label="Godkjent dager"
                  values={[
                    state.frist.godkjent_dager !== null
                      ? `${state.frist.godkjent_dager} dager`
                      : '—',
                  ]}
                  highlight
                />
                {state.frist.frist_for_spesifisering && (
                  <ComparisonRow
                    label="Frist for spesifisering"
                    values={[state.frist.frist_for_spesifisering]}
                  />
                )}
                <ComparisonRow
                  label="Begrunnelse"
                  values={[
                    state.frist.begrunnelse ? (
                      <button
                        onClick={() => alert(state.frist.begrunnelse)}
                        className="text-sm text-oslo-blue hover:underline"
                      >
                        Vis
                      </button>
                    ) : (
                      '—'
                    ),
                  ]}
                />
              </tbody>
            </table>
          </div>
        </Collapsible>
      )}
    </div>
  );
}

// Helper component for table rows
interface ComparisonRowProps {
  label: string;
  values: React.ReactNode[];
  highlight?: boolean;
}

function ComparisonRow({ label, values, highlight = false }: ComparisonRowProps) {
  return (
    <tr>
      <td className="sticky-col">{label}</td>
      {values.map((value, idx) => (
        <td
          key={idx}
          className={`text-center ${
            highlight ? 'bg-yellow-50 font-semibold' : ''
          }`}
        >
          {value}
        </td>
      ))}
    </tr>
  );
}
