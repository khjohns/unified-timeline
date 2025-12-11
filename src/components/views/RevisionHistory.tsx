/**
 * RevisionHistory Component
 *
 * Displays side-by-side comparison of all revisions for each track.
 * Fetches revision history from backend API and shows:
 * - All TE claim versions chronologically
 * - BH responses attached to the version they responded to
 * - Visual indicators for changes between versions
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import { Collapsible } from '../primitives/Collapsible';
import { StackIcon, ClockIcon, ReloadIcon } from '@radix-ui/react-icons';
import {
  useHistorikk,
  getTeEntries,
  getBhEntries,
  formatHistorikkBelop,
  formatHistorikkDager,
  formatRevisionDate,
} from '../../hooks/useRevisionHistory';
import { VederlagHistorikkEntry, FristHistorikkEntry } from '../../types/api';

export function RevisionHistory() {
  const { sakId } = useParams<{ sakId: string }>();
  const { vederlag, frist, isLoading, error, refetch } = useHistorikk(sakId || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-pkt-bg-subtle rounded-lg border border-pkt-grays-gray-300">
        <ReloadIcon className="w-5 h-5 animate-spin mr-2 text-pkt-grays-gray-500" />
        <span className="text-pkt-grays-gray-600">Laster revisjonshistorikk...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-pkt-surface-subtle-light-red rounded-lg border border-pkt-border-red">
        <p className="text-pkt-brand-red-1000 mb-2">Kunne ikke laste revisjonshistorikk</p>
        <button
          onClick={refetch}
          className="text-sm text-pkt-brand-red-1000 hover:underline flex items-center justify-center gap-1 mx-auto"
        >
          <ReloadIcon className="w-4 h-4" />
          Prøv igjen
        </button>
      </div>
    );
  }

  const hasVederlag = vederlag.length > 0;
  const hasFrist = frist.length > 0;

  if (!hasVederlag && !hasFrist) {
    return (
      <div className="text-center p-8 bg-pkt-bg-subtle rounded-lg border border-pkt-grays-gray-300">
        <p className="text-pkt-grays-gray-600">Ingen krav er fremsatt ennå.</p>
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
          border-right: 1px solid var(--color-pkt-grays-gray-300);
          border-bottom: 1px solid var(--color-pkt-grays-gray-300);
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
          background-color: var(--color-pkt-bg-subtle);
          font-weight: 500;
          color: var(--color-pkt-grays-gray-600);
          border-right: 2px solid var(--color-pkt-grays-gray-300) !important;
        }
        .te-header {
          background-color: var(--color-pkt-surface-light-green);
          color: var(--color-pkt-brand-dark-green-1000);
        }
        .bh-header {
          background-color: var(--color-pkt-surface-yellow);
          color: var(--color-pkt-brand-neutrals-1000);
        }
        .te-cell {
          background-color: var(--color-pkt-surface-faded-green);
        }
        .bh-cell {
          background-color: var(--color-pkt-surface-yellow);
        }
        .changed-value {
          font-weight: 600;
          color: var(--color-pkt-brand-warm-blue-1000);
        }
      `}</style>

      {/* Vederlag Revision History */}
      {hasVederlag && (
        <Collapsible
          title="Vederlag - Revisjonshistorikk"
          defaultOpen
          icon={<StackIcon className="w-5 h-5" />}
        >
          <VederlagHistorikkTable entries={vederlag} />
        </Collapsible>
      )}

      {/* Frist Revision History */}
      {hasFrist && (
        <Collapsible
          title="Frist - Revisjonshistorikk"
          defaultOpen
          icon={<ClockIcon className="w-5 h-5" />}
        >
          <FristHistorikkTable entries={frist} />
        </Collapsible>
      )}
    </div>
  );
}

// ============ VEDERLAG TABLE ============

interface VederlagHistorikkTableProps {
  entries: VederlagHistorikkEntry[];
}

function VederlagHistorikkTable({ entries }: VederlagHistorikkTableProps) {
  const teEntries = getTeEntries(entries);
  const bhEntries = getBhEntries(entries);

  // Get unique versions for columns
  const versions = [...new Set(teEntries.map((e) => e.versjon))].sort((a, b) => a - b);

  // Map BH responses to the TE version they responded to
  const bhByVersion = new Map<number, VederlagHistorikkEntry>();
  for (const bh of bhEntries) {
    bhByVersion.set(bh.versjon, bh);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-pkt-grays-gray-300 bg-pkt-bg-card shadow-sm">
      <table className="revision-table">
        <thead>
          <tr className="bg-pkt-bg-subtle">
            <th className="sticky-col text-left min-w-[180px]">Felt</th>
            {versions.map((v) => {
              const te = teEntries.find((e) => e.versjon === v);
              const bh = bhByVersion.get(v);
              return (
                <th key={v} colSpan={bh ? 2 : 1} className="text-center min-w-[160px]">
                  <div className="font-semibold text-pkt-grays-gray-700">
                    {v === 1 ? 'Versjon 1' : `Rev. ${v}`}
                  </div>
                  <div className="text-xs text-pkt-grays-gray-500 font-normal">
                    {te && formatRevisionDate(te.tidsstempel)}
                  </div>
                </th>
              );
            })}
          </tr>
          <tr>
            <th className="sticky-col text-left">Kilde</th>
            {versions.map((v) => {
              const bh = bhByVersion.get(v);
              return bh ? (
                <React.Fragment key={`kilde-${v}`}>
                  <th className="te-header text-center">TE</th>
                  <th className="bh-header text-center">BH</th>
                </React.Fragment>
              ) : (
                <th key={`te-${v}`} className="te-header text-center">
                  TE
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <VederlagRow
            label="Krevd beløp"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={(e) => formatHistorikkBelop(e.krav_belop)}
            getBhValue={() => '—'}
          />
          <VederlagRow
            label="Metode"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={(e) => e.metode_label || '—'}
            getBhValue={() => '—'}
          />
          <VederlagRow
            label="Rigg/drift"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={(e) => (e.inkluderer_rigg_drift ? '✓' : '—')}
            getBhValue={() => '—'}
          />
          <VederlagRow
            label="Produktivitetstap"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={(e) => (e.inkluderer_produktivitet ? '✓' : '—')}
            getBhValue={() => '—'}
          />
          <VederlagRow
            label="BH Resultat"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={() => '—'}
            getBhValue={(e) => e.bh_resultat_label || '—'}
            highlight
          />
          <VederlagRow
            label="Godkjent beløp"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={() => '—'}
            getBhValue={(e) => formatHistorikkBelop(e.godkjent_belop)}
            highlight
          />
          <VederlagRow
            label="Aktør"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={(e) => e.aktor.navn}
            getBhValue={(e) => e.aktor.navn}
          />
          <VederlagRow
            label="Status"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={(e) =>
              e.endring_type === 'sendt'
                ? 'Sendt'
                : e.endring_type === 'oppdatert'
                ? 'Oppdatert'
                : 'Trukket'
            }
            getBhValue={(e) =>
              e.endring_type === 'respons' ? 'Svar sendt' : 'Svar oppdatert'
            }
          />
        </tbody>
      </table>
    </div>
  );
}

interface VederlagRowProps {
  label: string;
  versions: number[];
  teEntries: VederlagHistorikkEntry[];
  bhByVersion: Map<number, VederlagHistorikkEntry>;
  getValue: (entry: VederlagHistorikkEntry) => string;
  getBhValue: (entry: VederlagHistorikkEntry) => string;
  highlight?: boolean;
}

function VederlagRow({
  label,
  versions,
  teEntries,
  bhByVersion,
  getValue,
  getBhValue,
  highlight = false,
}: VederlagRowProps) {
  // Track previous value for change highlighting
  let prevTeValue: string | null = null;

  return (
    <tr>
      <td className="sticky-col">{label}</td>
      {versions.map((v) => {
        const te = teEntries.find((e) => e.versjon === v);
        const bh = bhByVersion.get(v);
        const teValue = te ? getValue(te) : '—';
        const isChanged = prevTeValue !== null && teValue !== prevTeValue && teValue !== '—';
        prevTeValue = teValue;

        return bh ? (
          <React.Fragment key={`row-${v}`}>
            <td
              className={`te-cell text-center ${highlight ? 'bg-pkt-surface-faded-green' : ''} ${
                isChanged ? 'changed-value' : ''
              }`}
            >
              {teValue}
            </td>
            <td
              className={`bh-cell text-center ${highlight ? 'bg-pkt-surface-yellow font-semibold' : ''}`}
            >
              {getBhValue(bh)}
            </td>
          </React.Fragment>
        ) : (
          <td
            key={`te-${v}`}
            className={`te-cell text-center ${highlight ? 'bg-pkt-surface-faded-green' : ''} ${
              isChanged ? 'changed-value' : ''
            }`}
          >
            {teValue}
          </td>
        );
      })}
    </tr>
  );
}

// ============ FRIST TABLE ============

interface FristHistorikkTableProps {
  entries: FristHistorikkEntry[];
}

function FristHistorikkTable({ entries }: FristHistorikkTableProps) {
  const teEntries = getTeEntries(entries);
  const bhEntries = getBhEntries(entries);

  // Get unique versions for columns
  const versions = [...new Set(teEntries.map((e) => e.versjon))].sort((a, b) => a - b);

  // Map BH responses to the TE version they responded to
  const bhByVersion = new Map<number, FristHistorikkEntry>();
  for (const bh of bhEntries) {
    bhByVersion.set(bh.versjon, bh);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-pkt-grays-gray-300 bg-pkt-bg-card shadow-sm">
      <table className="revision-table">
        <thead>
          <tr className="bg-pkt-bg-subtle">
            <th className="sticky-col text-left min-w-[180px]">Felt</th>
            {versions.map((v) => {
              const te = teEntries.find((e) => e.versjon === v);
              const bh = bhByVersion.get(v);
              return (
                <th key={v} colSpan={bh ? 2 : 1} className="text-center min-w-[160px]">
                  <div className="font-semibold text-pkt-grays-gray-700">
                    {v === 1 ? 'Versjon 1' : `Rev. ${v}`}
                  </div>
                  <div className="text-xs text-pkt-grays-gray-500 font-normal">
                    {te && formatRevisionDate(te.tidsstempel)}
                  </div>
                </th>
              );
            })}
          </tr>
          <tr>
            <th className="sticky-col text-left">Kilde</th>
            {versions.map((v) => {
              const bh = bhByVersion.get(v);
              return bh ? (
                <React.Fragment key={`frist-kilde-${v}`}>
                  <th className="te-header text-center">TE</th>
                  <th className="bh-header text-center">BH</th>
                </React.Fragment>
              ) : (
                <th key={`te-${v}`} className="te-header text-center">
                  TE
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <FristRow
            label="Krevd dager"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={(e) => formatHistorikkDager(e.krav_dager)}
            getBhValue={() => '—'}
          />
          <FristRow
            label="Varseltype"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={(e) => e.varsel_type_label || '—'}
            getBhValue={() => '—'}
          />
          <FristRow
            label="Ny sluttdato"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={(e) => e.ny_sluttdato || '—'}
            getBhValue={() => '—'}
          />
          <FristRow
            label="BH Resultat"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={() => '—'}
            getBhValue={(e) => e.bh_resultat_label || '—'}
            highlight
          />
          <FristRow
            label="Godkjent dager"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={() => '—'}
            getBhValue={(e) => formatHistorikkDager(e.godkjent_dager)}
            highlight
          />
          <FristRow
            label="Aktør"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={(e) => e.aktor.navn}
            getBhValue={(e) => e.aktor.navn}
          />
          <FristRow
            label="Status"
            versions={versions}
            teEntries={teEntries}
            bhByVersion={bhByVersion}
            getValue={(e) =>
              e.endring_type === 'sendt'
                ? 'Sendt'
                : e.endring_type === 'oppdatert'
                ? 'Oppdatert'
                : 'Trukket'
            }
            getBhValue={(e) =>
              e.endring_type === 'respons' ? 'Svar sendt' : 'Svar oppdatert'
            }
          />
        </tbody>
      </table>
    </div>
  );
}

interface FristRowProps {
  label: string;
  versions: number[];
  teEntries: FristHistorikkEntry[];
  bhByVersion: Map<number, FristHistorikkEntry>;
  getValue: (entry: FristHistorikkEntry) => string;
  getBhValue: (entry: FristHistorikkEntry) => string;
  highlight?: boolean;
}

function FristRow({
  label,
  versions,
  teEntries,
  bhByVersion,
  getValue,
  getBhValue,
  highlight = false,
}: FristRowProps) {
  // Track previous value for change highlighting
  let prevTeValue: string | null = null;

  return (
    <tr>
      <td className="sticky-col">{label}</td>
      {versions.map((v) => {
        const te = teEntries.find((e) => e.versjon === v);
        const bh = bhByVersion.get(v);
        const teValue = te ? getValue(te) : '—';
        const isChanged = prevTeValue !== null && teValue !== prevTeValue && teValue !== '—';
        prevTeValue = teValue;

        return bh ? (
          <React.Fragment key={`frist-row-${v}`}>
            <td
              className={`te-cell text-center ${highlight ? 'bg-pkt-surface-faded-green' : ''} ${
                isChanged ? 'changed-value' : ''
              }`}
            >
              {teValue}
            </td>
            <td
              className={`bh-cell text-center ${highlight ? 'bg-pkt-surface-yellow font-semibold' : ''}`}
            >
              {getBhValue(bh)}
            </td>
          </React.Fragment>
        ) : (
          <td
            key={`te-${v}`}
            className={`te-cell text-center ${highlight ? 'bg-pkt-surface-faded-green' : ''} ${
              isChanged ? 'changed-value' : ''
            }`}
          >
            {teValue}
          </td>
        );
      })}
    </tr>
  );
}
