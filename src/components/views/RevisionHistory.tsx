/**
 * RevisionHistory Component
 *
 * Displays revision history for each track with categorical grouping.
 * Shows TE claims and BH responses in a clear, scannable format.
 */

import { useParams } from 'react-router-dom';
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
      <div className="flex items-center justify-center p-8 bg-pkt-bg-subtle border border-pkt-grays-gray-300">
        <ReloadIcon className="w-5 h-5 animate-spin mr-2 text-pkt-grays-gray-500" />
        <span className="text-pkt-grays-gray-600">Laster revisjonshistorikk...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-pkt-surface-subtle-light-red border border-pkt-border-red">
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
      <div className="text-center p-8 bg-pkt-bg-subtle border border-pkt-grays-gray-300">
        <p className="text-pkt-grays-gray-600">Ingen krav er fremsatt ennå.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Vederlag Revision History */}
      {hasVederlag && (
        <section>
          <h3 className="flex items-center gap-2 text-base font-semibold text-pkt-text-body-default mb-4">
            <StackIcon className="w-5 h-5" />
            Vederlag - Revisjonshistorikk
          </h3>
          <VederlagHistorikkTable entries={vederlag} />
        </section>
      )}

      {/* Frist Revision History */}
      {hasFrist && (
        <section>
          <h3 className="flex items-center gap-2 text-base font-semibold text-pkt-text-body-default mb-4">
            <ClockIcon className="w-5 h-5" />
            Frist - Revisjonshistorikk
          </h3>
          <FristHistorikkTable entries={frist} />
        </section>
      )}
    </div>
  );
}

/** Format version label - 0 = Opprinnelig, 1+ = Rev. N */
function formatVersionLabel(version: number): string {
  return version === 0 ? 'Opprinnelig' : `Rev. ${version}`;
}

// ============ VEDERLAG TABLE ============

interface VederlagHistorikkTableProps {
  entries: VederlagHistorikkEntry[];
}

function VederlagHistorikkTable({ entries }: VederlagHistorikkTableProps) {
  const teEntries = getTeEntries(entries);
  const bhEntries = getBhEntries(entries);

  // Get unique versions for columns, sorted
  const versions = [...new Set(teEntries.map((e) => e.versjon))].sort((a, b) => a - b);

  // Map entries by version for quick lookup
  const teByVersion = new Map<number, VederlagHistorikkEntry>();
  for (const te of teEntries) {
    teByVersion.set(te.versjon, te);
  }

  const bhByVersion = new Map<number, VederlagHistorikkEntry>();
  for (const bh of bhEntries) {
    bhByVersion.set(bh.versjon, bh);
  }

  return (
    <div className="overflow-x-auto border border-pkt-grays-gray-300 bg-pkt-bg-card">
      <table className="w-full border-collapse text-sm">
        {/* Header */}
        <thead>
          <tr className="bg-pkt-bg-subtle border-b-2 border-pkt-grays-gray-300">
            <th className="sticky left-0 z-10 bg-pkt-bg-subtle text-left py-3 px-4 font-medium text-pkt-grays-gray-600 min-w-[160px] border-r-2 border-pkt-grays-gray-300">
              Felt
            </th>
            {versions.map((v) => {
              const te = teByVersion.get(v);
              return (
                <th key={v} className="text-center py-3 px-4 min-w-[140px] border-r border-pkt-grays-gray-200 last:border-r-0">
                  <div className="font-semibold text-pkt-text-body-default">
                    {formatVersionLabel(v)}
                  </div>
                  <div className="text-xs text-pkt-grays-gray-500 font-normal mt-0.5">
                    {te && formatRevisionDate(te.tidsstempel)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {/* KRAV (TE) Section */}
          <GroupHeader label="Krav (TE)" colSpan={versions.length + 1} color="green" />
          <DataRow
            label="Beløp"
            versions={versions}
            getValue={(v) => formatHistorikkBelop(teByVersion.get(v)?.krav_belop)}
          />
          <DataRow
            label="Metode"
            versions={versions}
            getValue={(v) => teByVersion.get(v)?.metode_label || '—'}
          />
          <DataRow
            label="Rigg/drift"
            versions={versions}
            getValue={(v) => {
              const te = teByVersion.get(v);
              return te?.inkluderer_rigg_drift ? '✓' : '—';
            }}
          />
          <DataRow
            label="Produktivitetstap"
            versions={versions}
            getValue={(v) => {
              const te = teByVersion.get(v);
              return te?.inkluderer_produktivitet ? '✓' : '—';
            }}
          />

          {/* RESPONS (BH) Section */}
          <GroupHeader label="Respons (BH)" colSpan={versions.length + 1} color="yellow" />
          <DataRow
            label="Resultat"
            versions={versions}
            getValue={(v) => bhByVersion.get(v)?.bh_resultat_label || '—'}
            highlight
          />
          <DataRow
            label="Godkjent beløp"
            versions={versions}
            getValue={(v) => formatHistorikkBelop(bhByVersion.get(v)?.godkjent_belop)}
            highlight
          />

          {/* META Section */}
          <GroupHeader label="Detaljer" colSpan={versions.length + 1} color="gray" />
          <DataRow
            label="TE aktør"
            versions={versions}
            getValue={(v) => teByVersion.get(v)?.aktor.navn || '—'}
          />
          <DataRow
            label="BH aktør"
            versions={versions}
            getValue={(v) => bhByVersion.get(v)?.aktor.navn || '—'}
          />
        </tbody>
      </table>
    </div>
  );
}

// ============ FRIST TABLE ============

interface FristHistorikkTableProps {
  entries: FristHistorikkEntry[];
}

function FristHistorikkTable({ entries }: FristHistorikkTableProps) {
  const teEntries = getTeEntries(entries);
  const bhEntries = getBhEntries(entries);

  // Get unique versions for columns, sorted
  const versions = [...new Set(teEntries.map((e) => e.versjon))].sort((a, b) => a - b);

  // Map entries by version for quick lookup
  const teByVersion = new Map<number, FristHistorikkEntry>();
  for (const te of teEntries) {
    teByVersion.set(te.versjon, te);
  }

  const bhByVersion = new Map<number, FristHistorikkEntry>();
  for (const bh of bhEntries) {
    bhByVersion.set(bh.versjon, bh);
  }

  return (
    <div className="overflow-x-auto border border-pkt-grays-gray-300 bg-pkt-bg-card">
      <table className="w-full border-collapse text-sm">
        {/* Header */}
        <thead>
          <tr className="bg-pkt-bg-subtle border-b-2 border-pkt-grays-gray-300">
            <th className="sticky left-0 z-10 bg-pkt-bg-subtle text-left py-3 px-4 font-medium text-pkt-grays-gray-600 min-w-[160px] border-r-2 border-pkt-grays-gray-300">
              Felt
            </th>
            {versions.map((v) => {
              const te = teByVersion.get(v);
              return (
                <th key={v} className="text-center py-3 px-4 min-w-[140px] border-r border-pkt-grays-gray-200 last:border-r-0">
                  <div className="font-semibold text-pkt-text-body-default">
                    {formatVersionLabel(v)}
                  </div>
                  <div className="text-xs text-pkt-grays-gray-500 font-normal mt-0.5">
                    {te && formatRevisionDate(te.tidsstempel)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {/* KRAV (TE) Section */}
          <GroupHeader label="Krav (TE)" colSpan={versions.length + 1} color="green" />
          <DataRow
            label="Antall dager"
            versions={versions}
            getValue={(v) => formatHistorikkDager(teByVersion.get(v)?.krav_dager)}
          />
          <DataRow
            label="Varseltype"
            versions={versions}
            getValue={(v) => teByVersion.get(v)?.varsel_type_label || '—'}
          />
          <DataRow
            label="Ny sluttdato"
            versions={versions}
            getValue={(v) => teByVersion.get(v)?.ny_sluttdato || '—'}
          />

          {/* RESPONS (BH) Section */}
          <GroupHeader label="Respons (BH)" colSpan={versions.length + 1} color="yellow" />
          <DataRow
            label="Resultat"
            versions={versions}
            getValue={(v) => bhByVersion.get(v)?.bh_resultat_label || '—'}
            highlight
          />
          <DataRow
            label="Godkjent dager"
            versions={versions}
            getValue={(v) => formatHistorikkDager(bhByVersion.get(v)?.godkjent_dager)}
            highlight
          />

          {/* META Section */}
          <GroupHeader label="Detaljer" colSpan={versions.length + 1} color="gray" />
          <DataRow
            label="TE aktør"
            versions={versions}
            getValue={(v) => teByVersion.get(v)?.aktor.navn || '—'}
          />
          <DataRow
            label="BH aktør"
            versions={versions}
            getValue={(v) => bhByVersion.get(v)?.aktor.navn || '—'}
          />
        </tbody>
      </table>
    </div>
  );
}

// ============ SHARED COMPONENTS ============

interface GroupHeaderProps {
  label: string;
  colSpan: number;
  color: 'green' | 'yellow' | 'gray';
}

function GroupHeader({ label, colSpan, color }: GroupHeaderProps) {
  const colorClasses = {
    green: 'bg-pkt-surface-light-green text-pkt-brand-dark-green-1000',
    yellow: 'bg-pkt-surface-yellow text-pkt-grays-gray-800',
    gray: 'bg-pkt-bg-subtle text-pkt-grays-gray-600',
  };

  return (
    <tr>
      <td
        colSpan={colSpan}
        className={`py-2 px-4 text-xs font-semibold uppercase tracking-wide border-y border-pkt-grays-gray-200 ${colorClasses[color]}`}
      >
        {label}
      </td>
    </tr>
  );
}

interface DataRowProps {
  label: string;
  versions: number[];
  getValue: (version: number) => string;
  highlight?: boolean;
}

function DataRow({ label, versions, getValue, highlight = false }: DataRowProps) {
  let prevValue: string | null = null;

  return (
    <tr className="border-b border-pkt-grays-gray-100 last:border-b-0">
      <td className="sticky left-0 z-10 bg-pkt-bg-card py-2.5 px-4 text-pkt-grays-gray-600 border-r-2 border-pkt-grays-gray-300">
        {label}
      </td>
      {versions.map((v) => {
        const value = getValue(v);
        const isChanged = prevValue !== null && value !== prevValue && value !== '—';
        prevValue = value;

        return (
          <td
            key={v}
            className={`py-2.5 px-4 text-center border-r border-pkt-grays-gray-100 last:border-r-0 ${
              highlight ? 'font-medium' : ''
            } ${isChanged ? 'text-pkt-brand-warm-blue-1000 font-semibold' : 'text-pkt-text-body-default'}`}
          >
            {value}
          </td>
        );
      })}
    </tr>
  );
}
